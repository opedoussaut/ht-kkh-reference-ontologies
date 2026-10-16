import { html, raw, esc, safeUrl } from './lib/html.js';
import { buildIndex, query, facetCounts, FACETS, stateFromParams, paramsFromState, search } from './lib/search.js';
import { buildGraph, renderGraph } from './lib/graph.js';
import { icon } from './lib/icons.js';
import { explorerView, mountExplorer, AVAILABILITY } from './explorer.js';

const REPO = 'https://github.com/opedoussaut/ht-kkh-reference-ontologies';

const LABELS = {
  layer: { upper: 'Upper', 'mid-level': 'Mid-level', 'cross-domain': 'Cross-domain', domain: 'Domain' },
  kind: { 'file-format': 'File format', specification: 'Specification', 'reference-architecture': 'Reference architecture', 'software-framework': 'Software framework', middleware: 'Middleware', simulator: 'Simulator', 'physics-engine': 'Physics engine', 'ai-framework': 'AI framework', 'model-architecture': 'Model architecture', 'trained-model': 'Trained model', dataset: 'Dataset', benchmark: 'Benchmark', 'evaluation-protocol': 'Evaluation protocol', ontology: 'Ontology', vocabulary: 'Vocabulary', 'meta-model': 'Meta-model', 'information-model': 'Information model', 'modeling-language': 'Modelling language', classification: 'Classification' },
  maturity: { standard: 'Standard', stable: 'Stable', emerging: 'Emerging', research: 'Research', legacy: 'Legacy', discontinued: 'Discontinued' },
  access: { open: 'Open', 'open-with-terms': 'Open with terms', licensed: 'Licensed', unknown: 'Unknown' },
  verification: { verified: 'Verified', 'partially-verified': 'Partially verified', unverified: 'Unverified' },
  format: { owl: 'OWL', rdf: 'RDF / JSON-LD', shacl: 'SHACL', xml: 'XML / XMI', json: 'JSON', uml: 'UML / MOF', express: 'EXPRESS / STEP', logic: 'Logic (KIF, CL)', csv: 'CSV' },
  publisherType: { 'standards-body': 'Standards body', 'industry-association': 'Industry association', consortium: 'Consortium', research: 'Research', government: 'Government', industry: 'Industry' },
  limitCat: { technical: 'Technical', scope: 'Scope', access: 'Access', 'unverified-claim': 'Unverified claim', 'catalogue-gap': 'Catalogue gap' },
  licScope: { all: 'Everything', specification: 'Specification text', 'model-files': 'Model files', documentation: 'Documentation', software: 'Software', 'model-weights': 'Model weights', dataset: 'Dataset', 'file-format': 'File format' },
  reuse: { permitted: 'Permitted (after licence review)', restricted: 'Restricted', 'not-permitted': 'Not permitted', unknown: 'Unknown' },
  status: { published: 'Published', candidate: 'Candidate', draft: 'Draft', superseded: 'Superseded', discontinued: 'Discontinued', unknown: 'Unknown' },
};

const state = { data: null, index: null, byId: new Map(), maps: {}, explorer: { ontologies: {} } };
const explorerEntry = (id) => state.explorer.ontologies[id] || { status: 'not-assessed', reason: 'Not yet reviewed.' };
const interactiveRecords = () => state.data.ontologies.filter((o) => explorerEntry(o.id).status === 'interactive');
const app = document.getElementById('app');

// ---------- helpers ----------
const label = (group, v) => LABELS[group]?.[v] || v;
const ont = (id) => state.byId.get(id);
const industryName = (id) => state.maps.industry[id]?.name || id;
const useCaseName = (id) => state.maps.useCase[id]?.name || id;
const relLabel = (t) => (t === 'used-together' ? 'used together (editorial)' : t === 'reference-workflow' ? 'reference workflow (editorial)' : state.maps.relType[t]?.label || t);

// Editorial overlay for the Atlas network: ontologies in the same layer of a use-case stack.
// Never stored as relations and never shown unless requested.
function editorialRelations() {
  const formal = new Set(state.data.relations.flatMap((r) => [`${r.source}|${r.target}`, `${r.target}|${r.source}`]));
  const out = new Map();
  for (const u of state.data.useCases) for (const l of u.stack) {
    const ids = l.ontologies;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const key = [ids[i], ids[j]].sort().join('|');
      if (formal.has(`${ids[i]}|${ids[j]}`) || out.has(key)) continue;
      out.set(key, { source: ids[i], target: ids[j], type: 'used-together', editorial: true, useCase: u.id, evidence: { url: `#/use-cases/${u.id}`, note: `Editorial: same layer (${l.layer}) of the ${u.name} reference stack.` } });
    }
  }
  return [...out.values()];
}

const typeLabel = (id) => state.maps.type[id]?.label || id;
const capLabel = (id) => state.maps.capability[id]?.label || id;
const evidenceLabel = (id) => state.maps.evidence[id]?.label || id;
const evidenceSummary = (id) => state.maps.evidence[id]?.summary || '';
function domainLabel(id, withParent = false) {
  if (id === 'not-assessed') return 'Not assessed';
  const d = state.maps.domain[id];
  return d ? (withParent ? `${d.parent.label} › ${d.label}` : d.label) : id;
}
// Source/Editorial provenance tag used throughout the UI.
const tag = (basis, tip = '') => html`<span class="pill ${basis === 'source' ? 'basis-source' : 'editorial'}" ${tip ? raw(`title="${esc(tip)}"`) : ''}>${basis === 'source' ? 'Source' : 'Editorial'}</span>`;

function facetLabel(key, v) {
  if (key === 'capability') return capLabel(v);
  if (key === 'domain') return domainLabel(v);
  if (key === 'type') return typeLabel(v);
  if (key === 'physicalAi') return state.maps.pai[v]?.label || v;
  if (key === 'industry') return industryName(v);
  if (key === 'useCase') return useCaseName(v);
  return label(key, v);
}

const pill = (cls, text, title = '') => html`<span class="pill ${cls}" ${title ? raw(`title="${esc(title)}"`) : ''}>${text}</span>`;
const verifPill = (o) => pill(`v-${o.verification.status}`, label('verification', o.verification.status), `Checked ${o.verification.checkedOn}`);
const accessPill = (o) => pill(`a-${o.license.access}`, label('access', o.license.access), o.license.name);
const maturityPill = (o) => pill(`m-${o.maturity}`, label('maturity', o.maturity));
const ext = (url, text) => html`<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="ext">${text}</a>`;
const link = (hash, text, cls = '') => html`<a href="${hash}" class="${cls}">${text}</a>`;
const chip = (hash, text) => html`<a class="chip" href="${hash}">${text}</a>`;

function setTitle(t) { document.title = t ? `${t} · Reference Ontology Atlas` : 'Reference Ontology Atlas'; }

// Derived cross-references: ontologies that share a use-case stack with this one (editorial grouping, not a relation).
function usedTogether(id) {
  const byUc = [];
  for (const u of state.data.useCases) {
    const layers = u.stack.filter((s) => s.ontologies.includes(id));
    if (!layers.length) continue;
    const peers = [...new Set(u.stack.flatMap((s) => s.ontologies))].filter((x) => x !== id);
    byUc.push({ u, layers: layers.map((l) => l.layer), peers });
  }
  return byUc;
}

function relationsOf(id) {
  const out = state.data.relations.filter((r) => r.source === id);
  const inc = state.data.relations.filter((r) => r.target === id);
  return { out, inc };
}

// ---------- shared components ----------
function card(o) {
  return html`
  <a class="card" href="#/resource/${o.id}">
    <div class="card-head">
      <div>
        <div class="card-kicker">${typeLabel(o.resourceType)} · ${domainLabel(o.knowledge.domain)}</div>
        <h3 class="card-title">${o.name}</h3>
      </div>
      ${verifPill(o)}
    </div>
    <p class="card-full">${o.fullName}</p>
    <p class="card-summary">${o.summary}</p>
    <div class="card-meta">
      <span class="mono">${o.version.label}</span>
    </div>
    <div class="card-foot">
      ${maturityPill(o)} ${accessPill(o)}
      <span class="card-publisher">${o.publisher}</span>
    </div>
  </a>`;
}

function emptyState(msg, action = '') {
  return html`<div class="empty"><p>${msg}</p>${action}</div>`;
}

function industryTiles(items) {
  return html`<div class="ind-grid">${items.map((i) => {
    const n = state.data.ontologies.filter((o) => o.industries.includes(i.id)).length;
    return html`<a class="ind-tile${i.horizontal ? ' ind-horizontal' : ''}" href="#/industries/${i.id}" title="${i.summary}">
      ${raw(icon(i.icon))}<span class="ind-name">${i.name}</span><span class="ind-n">${n} resources</span></a>`;
  })}</div>`;
}
const sectorIndustries = () => state.data.industries.filter((i) => !i.horizontal);
const horizontalIndustries = () => state.data.industries.filter((i) => i.horizontal);

// ---------- views ----------
function viewHome() {
  setTitle('');
  const d = state.data;
  const verified = d.ontologies.filter((o) => o.verification.status === 'verified').length;
  const stats = [
    [d.ontologies.length, 'public knowledge resources'],
    [verified, 'fully verified records'],
    [d.relations.length, 'evidence-backed relationships'],
    [sectorIndustries().length, 'industries'],
  ];
  return html`
  <section class="atlas-cover" aria-label="Reference Ontology Atlas illustrated cover">
    <img src="assets/images/reference-ontology-atlas-cover.png"
         alt="Reference Ontology Atlas — Updated & Enriched. A connected globe links aerospace, energy, biology, manufacturing, infrastructure and other engineering domains."
         width="1536" height="864" fetchpriority="high" decoding="async">
    <div class="atlas-cover-mobile-title" aria-hidden="true">
      <strong>REFERENCE<br>ONTOLOGY ATLAS</strong>
      <span>Updated &amp; Enriched</span>
    </div>
  </section>
  <section class="hero hero-with-cover">
    <p class="eyebrow">Reference Ontology Atlas</p>
    <h1>Discover the knowledge foundations<br><span class="grad">of modern engineering.</span></h1>
    <p class="lead">A curated, evidence-based map of public ontologies, semantic standards and information models. Each one is classified by industry, knowledge domain and engineering capability, and every fact traces back to its source.</p>
    <form class="hero-search" data-action="hero-search" role="search">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="icon"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>
      <input name="q" type="search" placeholder="Search by topic: digital twin, robot tasks, units of measure, IEEE 1872…" aria-label="Search the atlas" autocomplete="off">
      <button type="submit" class="btn btn-primary">Search</button>
    </form>
    <div class="stats">
      ${stats.map(([n, t]) => html`<div class="stat"><div class="stat-n">${n}</div><div class="stat-t">${t}</div></div>`)}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Start from an engineering question ${tag('editorial', 'Curated by atlas editors; each question opens an ordinary, traceable catalogue filter.')}</h2></div>
    <div class="q-grid">
      ${d.questions.map((q) => html`
        <a class="q-card${q.ecosystem ? ' q-eco' : ''}" href="${q.ecosystem ? `#/use-cases/${q.ecosystem}` : questionHref(q)}">
          <span class="q-text">${q.question}</span>
          <span class="q-meta">${q.ecosystem ? `Reference ecosystem · ${new Set(state.maps.useCase[q.ecosystem].stack.flatMap((s) => s.ontologies)).size} resources →` : `${questionResults(q).length} resources →`}</span>
        </a>`)}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Explore by engineering capability</h2>${link('#/catalog', 'Open the catalogue →', 'more')}</div>
    <div class="cap-grid">
      ${d.capabilities.map((c) => {
        const n = d.ontologies.filter((o) => o.capabilities.includes(c.id)).length;
        return n ? html`<a class="cap-tile" href="#/catalog?capability=${c.id}"><span class="cap-name">${c.label}</span><span class="cap-sum">${c.summary}</span><span class="cap-n">${n}</span></a>` : '';
      })}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Explore by industry</h2>${link('#/industries', 'All industries →', 'more')}</div>
    ${industryTiles(d.industries)}
  </section>

  <section class="section">
    <div class="section-head"><h2>Engineering use cases</h2>${link('#/use-cases', 'All use cases →', 'more')}</div>
    <div class="uc-grid">
      ${d.useCases.map((u) => html`
        <a class="uc-card uc-${u.id}" href="#/use-cases/${u.id}">
          <div class="uc-kicker">${u.stack.length} semantic layers · ${new Set(u.stack.flatMap((s) => s.ontologies)).size} resources</div>
          <h3>${u.name}</h3>
          <p>${u.tagline}</p>
        </a>`)}
    </div>
  </section>

  <section class="section legend">
    <h2>How to read this atlas</h2>
    <div class="legend-grid">
      <div><h3>${tag('source')}</h3><p>A statement taken from a cited public source: publisher pages, published specifications or official repositories.</p></div>
      <div><h3>${tag('editorial')}</h3><p>Classifications, engineering uses and use-case stacks written by atlas editors. They are reviewable and dated, but they are interpretation, not fact.</p></div>
      <div><h3>${pill('v-verified', 'Verified')}</h3><p>The publisher, version and licence were checked against the official source on the date shown.</p></div>
      <div><h3>${pill('v-partially-verified', 'Partially verified')}</h3><p>The official source is confirmed, but at least one fact is still open. The record says which.</p></div>
      <div><h3>${pill('', 'Not assessed')}</h3><p>Licence review and suitability for your application are not assessed by the atlas. Nothing here is a certification or an endorsement.</p></div>
      <div><h3><span class="pill">Relationships</span></h3><p>Formal relationships cite their source. A relationship does not mean two resources interoperate. See ${link('#/about', 'label criteria')}.</p></div>
    </div>
  </section>`;
}

function questionHref(q) {
  const p = paramsFromState({ q: '', sort: 'relevance', filters: q.filters, question: q.id });
  return `#/catalog?${p}`;
}
function questionResults(q) {
  return query(state.data.ontologies, state.index, { filters: q.filters });
}

function facetValues(key, counts, selected) {
  const keep = (v) => counts[v] || selected?.includes(v);
  if (key === 'industry') return state.data.industries.map((i) => i.id).filter(keep);
  if (key === 'useCase') return state.data.useCases.map((u) => u.id).filter(keep);
  if (key === 'capability') return state.data.capabilities.map((c) => c.id).filter(keep);
  if (key === 'type') return state.data.resourceTypes.map((t) => t.id).filter(keep);
  if (key === 'domain') return state.data.knowledgeDomains.flatMap((d) => d.children.map((c) => c.id)).filter(keep);
  if (key === 'physicalAi') return state.data.physicalAi.items.map((p) => p.id).filter(keep);
  return Object.keys(LABELS[key] || {}).filter(keep);
}

function viewCatalog(params) {
  setTitle('Catalogue');
  const s = stateFromParams(params);
  const families = state.data.resourceFamilies;
  const defaultFamily = families.find((f) => f.default).id;
  const family = s.family || defaultFamily;
  const familyOf = state.maps.familyOf;
  const scope = state.data.ontologies.filter((o) => family === 'all' || familyOf[o.resourceType] === family);
  const results = query(state.data.ontologies, state.index, { ...s, family, familyOf });
  const activeCount = Object.values(s.filters).reduce((n, v) => n + v.length, 0);
  const question = s.question ? state.data.questions.find((q) => q.id === s.question) : null;
  const inScope = new Set(scope.map((o) => o.id));

  const facets = FACETS.map((f) => {
    const counts = facetCounts(search(state.index, s.q).map((h) => ont(h.id)).filter((o) => inScope.has(o.id)), s.filters, f.key);
    const values = facetValues(f.key, counts, s.filters[f.key]);
    if (!values.length) return '';
    const open = ['capability', 'industry', 'domain', 'type'].includes(f.key) || s.filters[f.key]?.length;
    return html`
      <details class="facet" ${open ? raw('open') : ''}>
        <summary>${f.label}${s.filters[f.key]?.length ? html` <span class="facet-active">${s.filters[f.key].length}</span>` : ''}${['capability', 'domain', 'industry'].includes(f.key) ? html` <span class="facet-ed" title="Editorial classification">ed.</span>` : ''}</summary>
        <div class="facet-body">
          ${values.map((v) => {
            const checked = s.filters[f.key]?.includes(v);
            return html`<label class="facet-opt"><input type="checkbox" data-facet="${f.key}" value="${v}" ${checked ? raw('checked') : ''}><span>${facetLabel(f.key, v)}</span><span class="count">${counts[v] || 0}</span></label>`;
          })}
        </div>
      </details>`;
  });

  const activeChips = Object.entries(s.filters).flatMap(([k, vs]) => vs.map((v) => html`<button class="chip chip-x" data-remove="${k}:${v}" title="Remove filter">${facetLabel(k, v)} ✕</button>`));
  const familyLabel = family === 'all' ? 'resources' : `resources · ${families.find((f) => f.id === family)?.label}`;

  return html`
  <section class="page-head">
    <h1>Catalogue</h1>
    <p class="lead small">Search and filter public engineering knowledge resources by capability, industry, knowledge domain and resource type. Filters combine (AND across groups, OR within a group), and every view can be shared by its URL.</p>
  </section>
  ${question ? html`
  <section class="q-banner" aria-label="Engineering question">
    <div class="q-banner-head"><span class="q-text">${question.question}</span>${tag('editorial', 'Curated question; it resolves to the filters shown below.')}</div>
    <p class="small">${question.explanation}</p>
    ${question.note ? html`<p class="small muted">Known gap: ${question.note}</p>` : ''}
  </section>` : ''}
  <div class="catalog">
    <aside class="filters" aria-label="Filters">
      <div class="filters-head"><strong>Filters</strong>${activeCount ? html`<button class="link-btn" data-action="clear">Clear all</button>` : ''}</div>
      ${facets}
    </aside>
    <div class="results">
      <div class="toolbar">
        <div class="segmented family-switch" role="group" aria-label="Resource family">
          ${[...families, { id: 'all', label: 'All resources' }].map((f) => html`<button class="seg-btn ${family === f.id ? 'is-on' : ''}" data-family="${f.id}" aria-pressed="${family === f.id}">${f.label}</button>`)}
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <svg aria-hidden="true" viewBox="0 0 24 24" class="icon"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>
          <input id="catalog-q" type="search" value="${s.q}" placeholder="Search name, topic, capability, publisher, standard number…" aria-label="Search" autocomplete="off">
          <kbd>/</kbd>
        </div>
        <label class="sort">Sort
          <select id="catalog-sort" aria-label="Sort">
            ${[['relevance', 'Relevance'], ['name', 'Name'], ['updated', 'Most recent version'], ['maturity', 'Maturity']].map(([v, t]) => html`<option value="${v}" ${s.sort === v ? raw('selected') : ''}>${t}</option>`)}
          </select>
        </label>
      </div>
      <div class="result-meta" aria-live="polite"><strong>${results.length}</strong> of ${scope.length} ${familyLabel} ${activeChips.length ? html`<span class="active-chips">${activeChips}</span>` : ''}</div>
      ${results.length ? html`<div class="card-grid">${results.map(card)}</div>` : emptyState(scope.length ? 'No resource matches these criteria.' : 'No resources of this family are catalogued yet.', html`<button class="btn" data-action="clear">Reset filters</button>`)}
    </div>
  </div>`;
}

function detailRows(o) {
  const d = o.details || {};
  const rows = [];
  if (d.aiModel) {
    rows.push(factRow('Model artefact', html`${d.aiModel.artefact === 'trained-model' ? 'Trained model' : 'Model architecture'} · weights published: ${d.aiModel.weightsPublished}`));
    if (d.aiModel.baseModel) rows.push(factRow('Base model', d.aiModel.baseModel));
    if (d.aiModel.trainingData) rows.push(factRow('Training data', d.aiModel.trainingData));
    if (d.aiModel.modalities) rows.push(factRow('Modalities', d.aiModel.modalities.join(' · ')));
  }
  if (d.dataset) {
    if (d.dataset.size) rows.push(factRow('Size', d.dataset.size));
    if (d.dataset.embodiments) rows.push(factRow('Robot embodiments', d.dataset.embodiments));
    if (d.dataset.collection) rows.push(factRow('Collection', d.dataset.collection));
    if (d.dataset.modalities) rows.push(factRow('Modalities', d.dataset.modalities.join(' · ')));
  }
  if (d.benchmark) {
    if (d.benchmark.evaluates) rows.push(factRow('Evaluates', d.benchmark.evaluates));
    if (d.benchmark.metrics) rows.push(factRow('Metrics', d.benchmark.metrics.join(' · ')));
    if (d.benchmark.environment) rows.push(factRow('Environment', d.benchmark.environment));
  }
  if (d.standard?.designation) rows.push(factRow('Designation', html`${d.standard.designation}${d.standard.edition ? ` · edition ${d.standard.edition}` : ''}`));
  if (o.physicalAi?.length) rows.push(factRow('Physical AI', html`${o.physicalAi.map((p) => state.maps.pai[p]?.label || p).join(' · ')} ${tag(o.classificationBasis.physicalAi || 'editorial')}`));
  return rows;
}

function licenceTable(list) {
  return html`<table class="lic-table"><thead><tr><th>Scope</th><th>Licence</th><th>Commercial use</th></tr></thead><tbody>${list.map((l) => html`<tr>
    <td>${label('licScope', l.scope)}</td>
    <td>${l.url ? ext(l.url, l.name) : l.name}${l.spdx ? html` <span class="mono small">${l.spdx}</span>` : ''}<div class="muted small">Stated at ${ext(l.statedAt, new URL(l.statedAt).host)}${l.reviewNote ? html` · ${l.reviewNote}` : ''}</div>${(l.restrictions || []).map((x) => html`<div class="small">⚠ ${x}</div>`)}</td>
    <td>${l.commercialUse === 'unknown' ? html`<span class="muted">Unknown</span>` : label('reuse', l.commercialUse)}<div class="muted small">${l.reviewStatus === 'reviewed' ? 'Reviewed by atlas editors (not legal advice)' : 'Not assessed'}</div></td></tr>`)}</tbody></table>`;
}

// True when every source cited for a capability is the publisher's own material (vendor-stated capabilities).
function publisherStated(o) {
  const cap = o.verification.sources.filter((s) => s.supports.includes('capability'));
  return o.publisherType === 'industry' && cap.length > 0 && cap.every((s) => ['official-documentation', 'publisher-repository', 'vendor-reported'].includes(s.type));
}

function factRow(k, v) { return v ? html`<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>` : ''; }

function qualification(o) {
  const host = (u) => { try { return new URL(u).host; } catch { return null; } };
  const rows = [
    ['What', html`${typeLabel(o.resourceType)} · ${domainLabel(o.knowledge.domain, true)}`],
    ['Why', o.capabilities.length ? o.capabilities.slice(0, 3).map(capLabel).join(' · ') : html`<span class="muted">Not assessed</span>`],
    ['Who', o.publisher],
    ['How', html`${o.formats.length ? o.formats.slice(0, 3).join(', ') : html`<span class="muted">Formats not documented</span>`} · licence: ${label('access', o.license.access).toLowerCase()}`],
    ['When', html`${o.version.label}${o.version.date ? ` (${o.version.date})` : ''} · checked ${o.verification.checkedOn}`],
    ['Where', o.links.official ? ext(o.links.official, host(o.links.official)) : html`<span class="muted">No official source</span>`],
  ];
  return html`<dl class="qual">${rows.map(([k, v]) => html`<div class="qual-row"><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
}

function sectionHead(n, title, basis, tip) {
  return html`<h2 class="sec-h"><span class="sec-n">${n}</span>${title} ${basis ? tag(basis, tip) : ''}</h2>`;
}

function viewOntology(id) {
  const o = ont(id);
  if (!o) return viewNotFound();
  setTitle(o.name);
  const { out, inc } = relationsOf(id);
  const ex = explorerEntry(o.id);
  const together = usedTogether(o.id);

  const relItem = (r, dir) => {
    const other = ont(dir === 'out' ? r.target : r.source);
    const otherLink = link(`#/resource/${other.id}`, other.name, 'rel-name');
    const sentence = dir === 'out'
      ? html`<span class="rel-self">${o.name}</span> <span class="rel-type">${relLabel(r.type)}</span> ${otherLink}`
      : html`${otherLink} <span class="rel-type">${relLabel(r.type)}</span> <span class="rel-self">${o.name}</span>`;
    return html`<li class="rel"><div>${sentence} ${r.status === 'partially-verified' ? pill('v-partially-verified', 'Partially verified') : ''}</div>
      <span class="rel-ev">${r.evidence.note} ${ext(r.evidence.url, 'Source')} <span class="pill ev-${r.evidence.type}">${evidenceLabel(r.evidence.type)}</span></span>
      ${r.conditions ? html`<span class="rel-ev"><strong>Applies when:</strong> ${r.conditions}</span>` : ''}</li>`;
  };

  return html`
  <nav class="crumbs">${link('#/catalog', 'Catalogue')} <span>/</span> ${o.name}</nav>
  <section class="detail-hero">
    <div class="detail-kicker">${typeLabel(o.resourceType)}${o.layer ? ` · ${label('layer', o.layer)}` : ''}${o.standardRef ? html` · <span class="mono">${o.standardRef}</span>` : ''}</div>
    <h1>${o.name}</h1>
    <p class="detail-full">${o.fullName}</p>
    <div class="pill-row">${verifPill(o)} ${maturityPill(o)} ${accessPill(o)} ${o.needsReview ? pill('warn', 'Needs review') : ''} ${o.origin === 'v1' ? pill('', 'Since v1') : pill('', 'Added in v2')}</div>
    <p class="detail-summary">${o.summary}</p>
    <div class="btn-row">
      ${o.links.official ? html`<a class="btn btn-primary" href="${safeUrl(o.links.official)}" target="_blank" rel="noopener noreferrer">Official source ↗</a>` : html`<span class="btn btn-disabled" title="No authoritative public source identified">No official source yet</span>`}
      ${ex.status === 'interactive' ? html`<a class="btn btn-explore" href="#/explore/${o.id}">Explore ontology</a>` : ''}
      ${out.length + inc.length ? html`<a class="btn" href="#/graph?focus=${o.id}">View in Atlas network</a>` : ''}
      <a class="btn" href="${REPO}/blob/main/data/ontologies/${o.id}.json" target="_blank" rel="noopener noreferrer">Record JSON ↗</a>
    </div>
  </section>

  <div class="detail-grid">
    <div class="detail-main">
      <section class="panel" id="what">
        ${sectionHead(1, 'What this resource is', 'source', 'Facts from the cited sources (see section 6).')}
        <dl class="facts">
          ${factRow('Resource type', html`${typeLabel(o.resourceType)}${label('kind', o.kind) !== typeLabel(o.resourceType) ? html` <span class="muted">· ${label('kind', o.kind)}</span>` : ''}`)}
          ${factRow('Knowledge domain', html`${domainLabel(o.knowledge.domain, true)} ${tag(o.knowledge.basis)} ${o.knowledge.confidence === 'tentative' ? pill('v-partially-verified', 'Tentative', 'A single primary domain simplifies this resource; see the rationale.') : ''}${o.knowledge.rationale ? html`<div class="muted small">${o.knowledge.rationale}</div>` : ''}`)}
          ${factRow('Publisher', html`${o.publisher} <span class="muted">· ${label('publisherType', o.publisherType)}</span>`)}
          ${factRow('Version', html`<span class="mono">${o.version.label}</span>${o.version.date ? html` <span class="muted">· ${o.version.date}</span>` : ''} <span class="muted">· ${label('status', o.version.status)}</span>`)}
          ${factRow('Maturity', html`${label('maturity', o.maturity)} <span class="muted small">· ${link('#/about', 'criteria')}</span>`)}
          ${factRow('Topics', o.topics.join(' · '))}
          ${detailRows(o)}
          ${factRow('Namespace', o.links.namespace ? html`<span class="mono break">${o.links.namespace}</span>` : null)}
        </dl>
      </section>

      <section class="panel" id="why">
        ${sectionHead(2, 'Engineering problems it helps address', 'editorial', 'Written by atlas editors; not a claim of adoption.')}
        ${o.capabilities.length ? html`<div class="chips">${o.capabilities.map((c) => chip(`#/catalog?capability=${c}`, capLabel(c)))}</div>` : html`<p class="muted">Capabilities not assessed yet.</p>`}
        ${o.engineeringUses?.length ? html`<h3 class="sub">Typical uses</h3><ul class="bullets">${o.engineeringUses.map((x) => html`<li>${x}</li>`)}</ul>` : ''}
      </section>

      <section class="panel" id="industries">
        ${sectionHead(3, 'Industries that may benefit', o.classificationBasis.industries, 'Editorial mapping unless marked as source.')}
        <div class="chips">${o.industries.map((i) => chip(`#/industries/${i}`, industryName(i)))}</div>
        ${o.useCases.length ? html`<h3 class="sub">Appears in reference stacks</h3><div class="chips">${o.useCases.map((u) => chip(`#/use-cases/${u}`, useCaseName(u)))}</div>` : ''}
      </section>

      <section class="panel" id="how">
        ${sectionHead(4, 'How it can be used', 'source')}
        <dl class="facts">
          ${factRow('Formats', o.formats.length ? o.formats.join(' · ') : html`<span class="muted">Not documented</span>`)}
          ${factRow('Licence', html`${o.license.name}${o.license.url ? html` · ${ext(o.license.url, 'terms')}` : ''} <span class="muted">· ${label('access', o.license.access)}</span>`)}
          ${o.licenses?.length ? factRow('Licence by scope', licenceTable(o.licenses)) : ''}
          ${factRow('Specification', o.links.specification ? ext(o.links.specification, o.links.specification) : null)}
          ${factRow('Repository', o.links.repository ? ext(o.links.repository, o.links.repository) : null)}
          ${factRow('Distributions', o.links.distributions?.length ? html`${o.links.distributions.map((x) => html`<div>${ext(x.url, x.format)}</div>`)}` : null)}
          ${factRow('Related', o.links.related ? ext(o.links.related, o.links.related) : null)}
          ${state.maps.familyOf[o.resourceType] !== 'semantic' ? '' : factRow('Ontology Explorer', html`<a href="#/explore/${o.id}"><span class="pill ${AVAILABILITY[ex.status].cls}">${AVAILABILITY[ex.status].label}</span></a> <span class="muted small">${ex.status === 'interactive' ? '' : ex.reason}</span>`)}
        </dl>
      </section>

      <section class="panel" id="complements">
        ${sectionHead(5, 'Complementary resources')}
        <p class="muted small">A relationship does not mean the two resources interoperate functionally.</p>
        <h3 class="sub">Formal relationships ${tag('source')}</h3>
        ${out.length + inc.length ? html`<ul class="rels">${out.map((r) => relItem(r, 'out'))}${inc.map((r) => relItem(r, 'in'))}</ul>` : html`<p class="muted">No evidence-backed relationships recorded yet.</p>`}
        ${together.length ? html`
        <h3 class="sub">Used together in reference stacks ${tag('editorial')}</h3>
        <div class="together">${together.map(({ u, layers, peers }) => html`
          <div class="together-row"><div>${link(`#/use-cases/${u.id}`, u.name, 'rel-name')} <span class="muted small">· ${layers.join(', ')}</span></div>
          <div class="chips">${peers.map((pid) => html`<a class="chip chip-ont" href="#/resource/${pid}">${ont(pid).name}</a>`)}</div></div>`)}</div>` : ''}
      </section>

      <section class="panel" id="evidence">
        ${sectionHead(6, 'Evidence')}
        <p>${verifPill(o)} <span class="muted">Facts checked ${o.verification.checkedOn} · editorial content reviewed ${o.editorialReview.reviewedOn} by ${o.editorialReview.reviewer}</span></p>
        <ol class="sources">${o.verification.sources.map((s) => html`<li>${ext(s.url, s.title)} <span class="pill ev-${s.type}" title="${evidenceSummary(s.type)}">${evidenceLabel(s.type)}</span><div class="muted small">Cited for: ${s.supports.join(', ')}</div></li>`)}</ol>
        ${publisherStated(o) ? html`<p class="small muted"><strong>Note:</strong> capability statements for this resource come from its publisher's own documentation. They describe what the publisher states, not independent verification.</p>` : ''}
        ${o.corrections?.length ? html`<h3 class="sub">Corrections</h3>
          <ul class="corrections">${o.corrections.map((c) => html`<li><span class="mono">${c.field}</span>: <s>${c.from}</s> → <strong>${c.to}</strong><br><span class="muted">${c.reason} ${ext(c.source, 'Source')}</span></li>`)}</ul>` : ''}
      </section>

      <section class="panel" id="limits">
        ${sectionHead(7, 'Limitations, licence and uncertainty')}
        ${o.limitations.length ? html`<ul class="bullets">${o.limitations.map((l) => html`<li><span class="lim-cat">${label('limitCat', l.category)}</span> ${l.text} ${tag(l.basis)}${l.sourceRef ? html` ${ext(l.sourceRef, 'Source')}` : ''}</li>`)}</ul>` : html`<p class="muted">No limitations recorded yet. That does not mean none exist.</p>`}
        ${o.verification.notes ? html`<p class="small"><strong>Verification note:</strong> ${o.verification.notes}</p>` : ''}
        <dl class="facts compact">
          ${factRow('Licence review', html`${o.license.reviewStatus === 'reviewed' ? 'Reviewed' : 'Not assessed'} <span class="muted small">· the atlas does not give legal advice</span>`)}
          ${factRow('Commercial reuse', o.license.commercialReuse === 'unknown' ? html`<span class="muted">Unknown: check the licence terms yourself</span>` : label('reuse', o.license.commercialReuse))}
          ${factRow('Suitability', html`<span class="muted">Not assessed. Suitability for a specific engineering application is your own judgement.</span>`)}
        </dl>
      </section>

      ${o.legacy ? html`
      <section class="panel">
        <details>
          <summary><h2 class="inline">Original v1 record</h2></summary>
          <p class="muted small">Preserved as published in catalogue v1. ${o.legacy.hasInternalWikiLink ? 'The link to an internal community wiki page was removed for public release.' : ''}</p>
          <dl class="facts compact">
            ${['name', 'category', 'publisher', 'official', 'parentOntology', 'stabilityStatus', 'usageStatus'].map((k) => factRow(k, o.legacy[k] || '—'))}
            ${factRow('endObjects', o.legacy.endObjects.join(' · '))}
            ${factRow('imds', o.legacy.imds.join(' · '))}
            ${factRow('description', o.legacy.description)}
          </dl>
        </details>
      </section>` : ''}
    </div>

    <aside class="detail-side">
      <section class="panel sticky-side">
        <h2>At a glance</h2>
        ${qualification(o)}
        <nav class="toc" aria-label="On this page">
          ${[['what', 'What it is'], ['why', 'Problems addressed'], ['industries', 'Industries'], ['how', 'How to use it'], ['complements', 'Complementary resources'], ['evidence', 'Evidence'], ['limits', 'Limitations']].map(([a, t], n) => html`<a href="#/resource/${o.id}" data-scroll="${a}"><span class="sec-n small">${n + 1}</span>${t}</a>`)}
        </nav>
        <p class="small muted">Found a newer version or a better source? ${ext(`${REPO}/issues/new?template=correction.yml&title=${encodeURIComponent(`[Correction] ${o.name}`)}`, 'Open a correction request')}.</p>
      </section>
    </aside>
  </div>`;
}

function viewGraph(params) {
  setTitle('Atlas network');
  const editorial = params.get('editorial') === '1';
  const focus = params.get('focus');
  const types = params.get('types')?.split(',').filter(Boolean) || state.data.relationTypes.map((t) => t.id);
  const isolated = params.get('isolated') === '1';
  return html`
  <section class="page-head">
    <h1>Atlas network</h1>
    <p class="lead small">How the catalogued ontologies relate to each other. Formal, mapping and shared relationships are stated by a publisher or primary source and cite their evidence. Editorially proposed links are off by default and drawn dashed. No relationship implies functional interoperability. To look inside a single ontology, use the ${link('#/explore', 'Ontology Explorer')}.</p>
  </section>
  <div class="graph-wrap">
    <div class="graph-controls">
      <div class="rel-cats">
        ${state.data.relationCategories.map((c) => html`<div class="rel-cat" title="${c.description}"><span class="rel-cat-name">${c.label}</span><div class="seg">${c.id === 'editorial'
          ? html`<label class="toggle"><input type="checkbox" id="graph-editorial" ${editorial ? raw('checked') : ''}><span class="swatch type-used-together"></span>used together</label>`
          : state.data.relationTypes.filter((t) => t.category === c.id).map((t) => html`<label class="toggle"><input type="checkbox" data-reltype="${t.id}" ${types.includes(t.id) ? raw('checked') : ''}><span class="swatch type-${t.id}"></span>${t.label}</label>`)}</div></div>`)}
      </div>
      <label class="toggle"><input type="checkbox" id="graph-isolated" ${isolated ? raw('checked') : ''}>Show unconnected ontologies</label>
      <div class="zoom-btns"><button class="btn small" data-zoom="1.2" aria-label="Zoom in">+</button><button class="btn small" data-zoom="0.83" aria-label="Zoom out">−</button><button class="btn small" data-zoom="reset">Reset</button></div>
    </div>
    <div class="graph-body">
      <div id="graph" class="graph-canvas" data-focus="${focus || ''}"></div>
      <aside id="graph-panel" class="graph-panel"></aside>
    </div>
    <div class="graph-legend">
      ${Object.entries(LABELS.layer).map(([k, v]) => html`<span><i class="dot layer-${k}"></i>${v}</span>`)}
    </div>
  </div>`;
}

function graphPanel(id) {
  const o = ont(id);
  if (!o) return html`<p class="muted">Select a node to see its relationships.</p>`;
  const { out, inc } = relationsOf(id);
  return html`
    <div class="detail-kicker">${label('layer', o.layer)} · ${label('kind', o.kind)}</div>
    <h2>${o.name}</h2>
    <p class="small">${o.fullName}</p>
    <div class="pill-row">${verifPill(o)} ${maturityPill(o)}</div>
    <ul class="rels compact">
      ${out.map((r) => html`<li><span class="rel-type">${relLabel(r.type)}</span> ${link(`#/graph?focus=${r.target}`, ont(r.target).name)} ${ext(r.evidence.url, 'source')}</li>`)}
      ${inc.map((r) => html`<li>${link(`#/graph?focus=${r.source}`, ont(r.source).name)} <span class="rel-type">${relLabel(r.type)}</span> this ${ext(r.evidence.url, 'source')}</li>`)}
    </ul>
    <a class="btn btn-primary small" href="#/resource/${o.id}">Open details</a>`;
}

function mountGraph(params) {
  const container = document.getElementById('graph');
  if (!container) return;
  const types = [...document.querySelectorAll('[data-reltype]')].filter((c) => c.checked).map((c) => c.dataset.reltype);
  const includeIsolated = document.getElementById('graph-isolated').checked;
  const relations = document.getElementById('graph-editorial')?.checked ? [...state.data.relations, ...editorialRelations()] : state.data.relations;
  const graph = buildGraph(state.data.ontologies, relations, { types: [...types, 'used-together'], includeIsolated });
  const panel = document.getElementById('graph-panel');
  const focus = container.dataset.focus || null;
  if (!graph.nodes.length) { container.innerHTML = '<div class="empty"><p>No relationships of the selected types.</p></div>'; return; }
  const api = renderGraph(container, graph, {
    selected: focus,
    relationLabel: relLabel,
    onSelect: (id) => { panel.innerHTML = graphPanel(id).toString(); },
  });
  panel.innerHTML = graphPanel(focus).toString();
  document.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => (b.dataset.zoom === 'reset' ? api.reset() : api.zoom(Number(b.dataset.zoom)))));
}

function groupByLayer(list) {
  const order = ['upper', 'mid-level', 'cross-domain', 'domain'];
  return order.map((l) => [l, list.filter((o) => o.layer === l)]).filter(([, xs]) => xs.length);
}

function viewIndustries() {
  setTitle('Industries');
  return html`
  <section class="page-head"><h1>Industries</h1><p class="lead small">Cross-industry discovery: see which public ontologies serve each industry segment.</p></section>
  ${industryTiles(sectorIndustries())}
  <section class="section"><h2>Horizontal foundations</h2><p class="muted">Ontologies that apply to every industry, such as provenance, units, time and metadata.</p>${industryTiles(horizontalIndustries())}</section>`;
}

function viewIndustry(id) {
  const i = state.maps.industry[id];
  if (!i) return viewNotFound();
  setTitle(i.name);
  const list = state.data.ontologies.filter((o) => o.industries.includes(id));
  const ucs = state.data.useCases.filter((u) => u.industries.includes(id));
  return html`
  <nav class="crumbs">${link('#/industries', 'Industries')} <span>/</span> ${i.name}</nav>
  <section class="ind-hero">
    <div class="ind-hero-icon">${raw(icon(i.icon))}</div>
    <div><p class="eyebrow">Industry</p><h1>${i.name}</h1><p class="lead small">${i.summary}</p>
    <div class="btn-row"><a class="btn btn-primary" href="#/catalog?industry=${id}">Filter ${list.length} ontologies in catalogue</a></div></div>
  </section>
  ${ucs.length ? html`<section class="section"><h2>Related use cases</h2><div class="chips">${ucs.map((u) => chip(`#/use-cases/${u.id}`, u.name))}</div></section>` : ''}
  ${groupByLayer(list).map(([layer, xs]) => html`
    <section class="section"><h2>${label('layer', layer)} <span class="muted">${xs.length}</span></h2><div class="card-grid">${xs.map(card)}</div></section>`)}`;
}

function viewUseCases() {
  setTitle('Use cases');
  return html`
  <section class="page-head"><h1>Engineering use cases</h1><p class="lead small">Reference semantic stacks for strategic engineering domains. The roles are architecture suggestions built from public ontologies. They do not describe any vendor's implementation.</p></section>
  <div class="uc-grid">
    ${state.data.useCases.map((u) => html`
      <a class="uc-card uc-${u.id}" href="#/use-cases/${u.id}">
        <div class="uc-kicker">${u.stack.length} semantic layers</div>
        <h3>${u.name}</h3><p>${u.tagline}</p>
      </a>`)}
  </div>`;
}

// Resources whose terms need attention before reuse (any scoped licence not known to permit commercial use).
function termsToCheck(o) {
  return (o.licenses || []).filter((l) => l.commercialUse !== 'permitted');
}

function viewEcosystem(u) {
  setTitle(u.name);
  const ids = new Set(u.stack.flatMap((s) => s.ontologies));
  const rels = state.data.relations.filter((r) => ids.has(r.source) && ids.has(r.target));
  const technical = rels.filter((r) => state.maps.relType[r.type]?.category === 'technical');
  const semantic = rels.filter((r) => state.maps.relType[r.type]?.category !== 'technical');
  const relLi = (r) => html`<li class="rel"><div>${link(`#/resource/${r.source}`, ont(r.source).name, 'rel-name')} <span class="rel-type">${relLabel(r.type)}</span> ${link(`#/resource/${r.target}`, ont(r.target).name, 'rel-name')}</div>
    <span class="rel-ev">${r.evidence.note} ${ext(r.evidence.url, 'Source')} <span class="pill ev-${r.evidence.type}">${evidenceLabel(r.evidence.type)}</span></span>
    ${r.conditions ? html`<span class="rel-ev"><strong>Applies when:</strong> ${r.conditions}</span>` : ''}</li>`;
  const check = [...ids].map(ont).filter((o) => termsToCheck(o).length);
  return html`
  <nav class="crumbs">${link('#/use-cases', 'Use cases')} <span>/</span> ${u.name}</nav>
  <section class="uc-hero uc-${u.id}">
    <p class="eyebrow">Reference ecosystem</p>
    <h1>${u.name}</h1>
    <p class="lead">${u.summary}</p>
    <div class="chips">${u.industries.map((i) => chip(`#/industries/${i}`, industryName(i)))}</div>
  </section>
  <section class="eco-scope" aria-label="Scope of this ecosystem">
    ${tag('editorial', 'Selection, ordering and the reference workflow are editorial.')}
    <p><strong>A discovery and architecture aid, not a tested integration.</strong> Connections marked <em>Source</em> are stated in the publishers' documentation. The reference workflow is an editorial suggestion, and nothing here shows that these resources work together in your context.</p>
  </section>
  <nav class="eco-stages" aria-label="Stages">
    ${u.stack.map((s, n) => html`<a href="#/use-cases/${u.id}" data-scroll="stage-${n + 1}"><span class="sec-n small">${n + 1}</span>${s.layer}</a>`)}
  </nav>
  <div class="detail-grid">
    <div class="detail-main">
      ${u.stack.map((s, n) => html`
      <section class="panel" id="stage-${n + 1}">
        ${sectionHead(n + 1, s.layer, 'editorial', 'Why each resource matters is an editorial note.')}
        <p class="muted">${s.role}</p>
        <div class="eco-list">${s.ontologies.map((oid) => {
          const o = ont(oid);
          return html`<a class="eco-row" href="#/resource/${oid}">
            <div class="eco-main"><span class="eco-name">${o.name}</span> <span class="eco-type">${typeLabel(o.resourceType)}</span>
              <div class="eco-why">${s.notes?.[oid] || o.summary}</div>
              <div class="eco-pub muted small">${o.publisher}</div></div>
            <div class="eco-badges">${verifPill(o)} ${accessPill(o)} ${termsToCheck(o).length ? pill('a-licensed', 'Check terms', termsToCheck(o).map((l) => `${label('licScope', l.scope)}: ${l.name}`).join(' · ')) : ''}</div>
          </a>`;
        })}</div>
      </section>`)}

      <section class="panel" id="connections">
        <h2 class="sec-h">How these resources connect</h2>
        <p class="muted small">A relationship does not mean a working integration in your context. Check each publisher's documentation for versions and conditions.</p>
        <h3 class="sub">Documented technical connections ${tag('source')}</h3>
        ${technical.length ? html`<ul class="rels">${technical.map(relLi)}</ul>` : html`<p class="muted">None recorded.</p>`}
        ${semantic.length ? html`<h3 class="sub">Formal semantic relationships ${tag('source')}</h3><ul class="rels compact">${semantic.map(relLi)}</ul>` : ''}
        <h3 class="sub">Reference workflow ${tag('editorial')}</h3>
        <ol class="eco-flow">${(u.workflow || []).map((w) => html`<li>${link(`#/resource/${w.from}`, ont(w.from).name)} <span class="muted">→</span> ${link(`#/resource/${w.to}`, ont(w.to).name)} <span class="muted small">· ${w.label}</span></li>`)}</ol>
      </section>

      <section class="panel">
        <div class="section-head"><h2 class="sec-h">Ecosystem map</h2>
          <label class="toggle"><input type="checkbox" id="eco-workflow">Show the reference workflow (editorial, dashed gold)</label></div>
        <div id="eco-graph" class="graph-canvas eco-graph" data-eco="${u.id}" role="img" aria-label="Map of the resources in this ecosystem and their documented connections. The lists above give the same information as text."></div>
        <div class="graph-legend">
          ${Object.entries(LABELS.layer).map(([k, v]) => html`<span><i class="dot layer-${k}"></i>${v} semantic</span>`)}
          <span><i class="dot layer-technology"></i>Technology / standard</span>
        </div>
      </section>
    </div>
    <aside class="detail-side">
      <section class="panel sticky-side">
        <h2>Engineering challenges</h2>
        <ul class="bullets">${u.challenges.map((c) => html`<li>${c}</li>`)}</ul>
        <h3 class="sub">Rights to check before reuse</h3>
        ${check.length ? html`<ul class="rights-list">${check.map((o) => html`<li>${link(`#/resource/${o.id}`, o.name)}<span class="muted small">${termsToCheck(o).map((l) => `${label('licScope', l.scope)}: ${l.name}`).join(' · ')}</span></li>`)}</ul>` : html`<p class="muted small">None flagged.</p>`}
        <p class="small muted">"Permitted" appears only where the licence text was reviewed. Everything else needs your own review.</p>
        <a class="btn" href="#/catalog?useCase=${u.id}&family=all">Open all ${ids.size} resources in the catalogue →</a>
      </section>
    </aside>
  </div>`;
}

function mountEcosystemGraph() {
  const box = document.getElementById('eco-graph');
  if (!box) return;
  const u = state.maps.useCase[box.dataset.eco];
  const ids = new Set(u.stack.flatMap((s) => s.ontologies));
  const draw = () => {
    const nodes = state.data.ontologies.filter((o) => ids.has(o.id));
    let rels = state.data.relations.filter((r) => ids.has(r.source) && ids.has(r.target));
    if (document.getElementById('eco-workflow')?.checked) rels = [...rels, ...(u.workflow || []).map((w) => ({ source: w.from, target: w.to, type: 'reference-workflow' }))];
    renderGraph(box, buildGraph(nodes, rels, { includeIsolated: true }), { relationLabel: relLabel, onSelect: (rid) => { location.hash = `#/resource/${rid}`; } });
  };
  draw();
  document.getElementById('eco-workflow')?.addEventListener('change', draw);
}

function viewUseCase(id) {
  const u = state.maps.useCase[id];
  if (!u) return viewNotFound();
  if (u.kind === 'ecosystem') return viewEcosystem(u);
  setTitle(u.name);
  const ids = new Set(u.stack.flatMap((s) => s.ontologies));
  const rels = state.data.relations.filter((r) => ids.has(r.source) && ids.has(r.target));
  return html`
  <nav class="crumbs">${link('#/use-cases', 'Use cases')} <span>/</span> ${u.name}</nav>
  <section class="uc-hero uc-${u.id}">
    <p class="eyebrow">Engineering use case</p>
    <h1>${u.name}</h1>
    <p class="lead">${u.summary}</p>
    <div class="chips">${u.industries.map((i) => chip(`#/industries/${i}`, industryName(i)))}</div>
  </section>
  <div class="detail-grid">
    <div class="detail-main">
      <section class="panel">
        <h2>Reference semantic stack</h2>
        <div class="stack">
          ${u.stack.map((s, n) => html`
            <div class="stack-layer">
              <div class="stack-idx">${String(n + 1).padStart(2, '0')}</div>
              <div class="stack-body">
                <h3>${s.layer}</h3>
                <p class="muted small">${s.role}</p>
                <div class="chips">${s.ontologies.map((oid) => {
                  const o = ont(oid);
                  return html`<a class="chip chip-ont v-${o.verification.status}" href="#/resource/${oid}" title="${o.fullName}">${o.name}</a>`;
                })}</div>
              </div>
            </div>`)}
        </div>
      </section>
      ${rels.length ? html`<section class="panel"><h2>Verified links inside this stack</h2><ul class="rels compact">${rels.map((r) => html`<li>${link(`#/resource/${r.source}`, ont(r.source).name)} <span class="rel-type">${relLabel(r.type)}</span> ${link(`#/resource/${r.target}`, ont(r.target).name)} ${ext(r.evidence.url, 'source')}</li>`)}</ul>
        <a class="btn small" href="#/graph">Open the full graph</a></section>` : ''}
    </div>
    <aside class="detail-side">
      <section class="panel"><h2>Engineering challenges</h2><ul class="bullets">${u.challenges.map((c) => html`<li>${c}</li>`)}</ul></section>
      <section class="panel"><a class="btn" href="#/catalog?useCase=${u.id}">All ${state.data.ontologies.filter((o) => o.useCases.includes(u.id)).length} mapped ontologies →</a></section>
    </aside>
  </div>`;
}

function viewExplorerIndex() {
  setTitle('Ontology Explorer');
  const groups = Object.keys(AVAILABILITY).map((s) => [s, state.data.ontologies.filter((o) => explorerEntry(o.id).status === s)]).filter(([, xs]) => xs.length);
  return html`
  <section class="page-head"><p class="eyebrow">Ontology Explorer</p><h1>Look inside an ontology</h1>
    <p class="lead small">Navigate the classes, properties, restrictions and definitions published in an ontology's own machine-readable files, without needing to read OWL or RDF. Graphs are parsed from the official distributions at build time. The explorer never builds a graph from a description.</p></section>
  <div class="card-grid">${interactiveRecords().map((o) => { const m = explorerEntry(o.id); return html`
    <a class="card" href="#/explore/${o.id}"><div class="card-head"><div><div class="card-kicker">Interactive · ${m.version}</div><h3 class="card-title">${o.name}</h3></div>${pill('v-verified', 'Explore')}</div>
      <p class="card-full">${o.fullName}</p>
      <p class="card-summary">${m.stats.classes} classes · ${m.stats.objectProperties} object properties · ${m.stats.datatypeProperties} datatype properties · ${m.stats.individuals} individuals</p>
      <div class="card-foot"><span class="card-publisher">${m.source.license}</span></div></a>`; })}</div>
  <section class="section"><h2>Availability of all catalogue records</h2>
    ${groups.filter(([s]) => s !== 'interactive').map(([s, xs]) => html`
      <h3 class="sub">${pill(AVAILABILITY[s].cls, AVAILABILITY[s].label)} <span class="muted">${xs.length}</span></h3>
      <ul class="ex-status-list">${xs.map((o) => html`<li>${link(`#/resource/${o.id}`, o.name, 'rel-name')} <span class="muted small">${explorerEntry(o.id).reason}</span></li>`)}</ul>`)}
  </section>`;
}

function viewAbout() {
  setTitle('About');
  const m = state.data.meta;
  return html`
  <section class="page-head"><h1>About the atlas</h1><p class="lead small">${m.disclaimer}</p></section>
  <div class="prose">
    <h2>Method</h2>
    <p>Each record is checked against the publisher's official pages. The checks cover the publisher, the current version or edition, the licence and access terms, and the official source. Every record lists its sources and the date it was checked. Where a fact could not be confirmed, the record is marked partially verified or unverified and explains why.</p>
    <h2>Label criteria</h2>
    <p>Labels describe what a resource is and how well the atlas has checked it. They are not certifications or endorsements.</p>
    <dl class="facts criteria">
      ${[['standard', 'Published by a recognised standards body (ISO, IEC, IEEE, W3C, OGC, ETSI, OMG, DCMI).'],
        ['stable', 'Versioned public releases from a maintained community or consortium.'],
        ['emerging', 'Public and active, but without stable releases or broad uptake yet.'],
        ['research', 'Described mainly in research publications or project outputs.'],
        ['legacy', 'Superseded by another resource, according to its publisher.'],
        ['discontinued', 'No longer maintained, according to its publisher.']].map(([k, v]) => factRow(pill(`m-${k}`, label('maturity', k)), v))}
      ${[['verified', 'Publisher, version and licence confirmed on official pages on the date shown.'],
        ['partially-verified', 'Official source confirmed, with at least one fact still open (explained on the record).'],
        ['unverified', 'No authoritative public source yet; flagged for review.']].map(([k, v]) => factRow(pill(`v-${k}`, label('verification', k)), v))}
      ${factRow(html`<span class="pill editorial">Editorial</span>`, 'Content written by atlas editors, such as practical engineering uses and use-case stacks. It illustrates typical uses and does not state facts about adoption.')}
    </dl>
    <h2>Inclusion and neutrality policy</h2>
    <p>The atlas is <strong>vendor-neutral, not vendor-free</strong>. Open-source and commercial resources can both be included when they materially support a documented engineering use.</p>
    <ul>
      <li><strong>Inclusion</strong> requires a public, authoritative description of the resource: specification, official documentation or publisher repository. A resource is never included because of marketing material alone.</li>
      <li><strong>Objective classification.</strong> Resource type, knowledge domain and capabilities use the same criteria for every publisher, and editorial classifications are labelled as such.</li>
      <li><strong>Visible publisher.</strong> Every record names its publisher and publisher type, so commercial origin is never hidden.</li>
      <li><strong>Vendor claims are labelled.</strong> Capabilities described only in a publisher's own material are shown as publisher-stated, and performance or results claims are typed <em>vendor-reported</em>. Neither counts as independent verification.</li>
      <li><strong>No endorsement.</strong> Inclusion does not imply endorsement, certification or recommendation by the atlas, by any standards body or by any company.</li>
      <li><strong>Comparisons</strong> are only published with transparent criteria applied identically to every compared resource. The atlas currently publishes no rankings.</li>
      <li><strong>Rights.</strong> Licences are recorded per scope (specification, software, model weights, datasets). Commercial-use status stays <em>unknown</em> until a review cites the licence text, and an openly accessible website is not treated as permission to redistribute or reuse.</li>
    </ul>
    <h2>Discovery dimensions</h2>
    <p>Every resource is described once and classified along independent dimensions. None is derived from another, and no resource is duplicated per industry.</p>
    <dl class="facts criteria">
      ${factRow('Resource type', html`What kind of artefact it is: ${state.data.resourceTypes.map((x) => x.label).join(', ')}. Derived from the record's own artefact type.`)}
      ${factRow('Knowledge domain', html`What engineering knowledge it represents, as one primary sub-domain of: ${state.data.knowledgeDomains.map((d) => d.label).join(', ')}. ${tag('editorial')} The atlas's own public taxonomy.`)}
      ${factRow('Engineering capability', html`What engineers and AI systems can do with it (several allowed). ${tag('editorial')}`)}
      ${factRow('Industry', html`Which of the ${sectorIndustries().length} industries may benefit, plus cross-industry foundations. ${tag('editorial')}`)}
      ${factRow('Physical AI', html`Proposed application categories (${state.data.physicalAi.items.map((x) => x.label).join(', ')}). No resource is assigned yet: an assignment needs documentation from the resource itself.`)}
    </dl>
    <h2>Evidence types</h2>
    <p>Each verification source carries its type. A working link is not evidence of accuracy, maintenance, interoperability or industrial suitability.</p>
    <dl class="facts criteria">${state.data.evidenceTypes.map((x) => factRow(html`<span class="pill ev-${x.id}">${x.label}</span>`, x.summary))}</dl>
    <h2>Relationships</h2>
    <p>Only relationships stated by a publisher or primary source are drawn, and each edge carries a citation. Relationship types: ${state.data.relationTypes.map((t) => t.label).join(', ')}.</p>
    <h2>Migration from v1</h2>
    <p>All ${m.counts.legacyRecords} records from the original High-Tech catalogue are preserved. Each detail page shows its original v1 fields, along with any corrections and the reason for them. Links to internal community pages were removed before public release.</p>
    <h2>Downloads</h2>
    <ul>
      <li><a href="data/atlas.json">data/atlas.json</a>: the complete dataset (v2 model)</li>
      <li><a href="htkkh_reference_ontologies_map_catalog.json">htkkh_reference_ontologies_map_catalog.json</a>: a v1-compatible JSON export</li>
      <li><a href="htkkh_reference_ontologies_map.ttl">htkkh_reference_ontologies_map.ttl</a>: an RDF/Turtle export</li>
      <li><a href="schema/ontology.schema.json">schema/ontology.schema.json</a>: the JSON Schema for records</li>
    </ul>
    <h2>Contribute</h2>
    <p>Corrections and new public ontologies are welcome through ${ext(`${REPO}/issues/new/choose`, 'GitHub issues')} or pull requests. See ${ext(`${REPO}/blob/main/CONTRIBUTING.md`, 'CONTRIBUTING.md')}. Please include only public, citable information.</p>
    <p class="muted small">Dataset generated ${m.generatedOn} · ${m.counts.ontologies} ontologies · ${m.counts.relations} relationships.</p>
  </div>`;
}

function viewNotFound() {
  setTitle('Not found');
  return html`<section class="page-head"><h1>Not found</h1><p class="lead small">That page does not exist.</p><a class="btn" href="#/">Back to home</a></section>`;
}

// ---------- router ----------
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(qs) };
}

function setNav(section) {
  document.querySelectorAll('.nav-links a').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));
}

let lastPath = '';
function route() {
  const { parts, params } = parseHash();
  const [section = '', id] = parts;
  let view;
  switch (section) {
    case '': view = viewHome(); break;
    case 'catalog': view = viewCatalog(params); break;
    case 'ontology': // permanent alias of #/resource/<id>
    case 'resource': view = viewOntology(id); break;
    case 'graph': view = viewGraph(params); break;
    case 'industries': view = id ? viewIndustry(id) : viewIndustries(); break;
    case 'use-cases': view = id ? viewUseCase(id) : viewUseCases(); break;
    case 'about': view = viewAbout(); break;
    case 'explore': view = id ? (ont(id) ? explorerView({ record: ont(id), entry: explorerEntry(id), interactive: interactiveRecords() }) : viewNotFound()) : viewExplorerIndex(); break;
    default: view = viewNotFound();
  }
  const path = parts.join('/');
  const focusSearch = section === 'catalog' && document.activeElement?.id === 'catalog-q';
  const caret = focusSearch ? document.activeElement.selectionStart : null;
  app.innerHTML = view.toString();
  setNav(section === 'ontology' || section === 'resource' ? 'catalog' : section);
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
  if (section === 'graph') mountGraph(params);
  if (section === 'use-cases' && id && state.maps.useCase[id]?.kind === 'ecosystem') mountEcosystemGraph();
  if (section === 'explore' && id && explorerEntry(id).status === 'interactive') {
    mountExplorer({ record: ont(id), entry: explorerEntry(id), concept: params.get('c'), onConceptChange: (iri) => history.replaceState(null, '', `#/explore/${id}?c=${encodeURIComponent(iri)}`) });
  }
  if (focusSearch) {
    const q = document.getElementById('catalog-q');
    q.focus();
    q.setSelectionRange(caret, caret);
  }
}

function updateCatalog(mutator) {
  const { params } = parseHash();
  const s = stateFromParams(params);
  mutator(s);
  // The question banner only stays while the filters still match that question exactly.
  if (s.question) {
    const q = state.data.questions.find((x) => x.id === s.question);
    const norm = (f) => JSON.stringify(Object.entries(f).filter(([, v]) => v?.length).map(([k, v]) => [k, [...v].sort()]).sort());
    if (!q || s.q || norm(q.filters) !== norm(s.filters)) s.question = null;
  }
  const qs = paramsFromState(s).toString();
  history.replaceState(null, '', `#/catalog${qs ? '?' + qs : ''}`);
  route();
}

function updateGraphParams() {
  const types = [...document.querySelectorAll('[data-reltype]')].filter((c) => c.checked).map((c) => c.dataset.reltype);
  const p = new URLSearchParams();
  const { params } = parseHash();
  if (params.get('focus')) p.set('focus', params.get('focus'));
  if (types.length !== state.data.relationTypes.length) p.set('types', types.join(','));
  if (document.getElementById('graph-isolated').checked) p.set('isolated', '1');
  if (document.getElementById('graph-editorial')?.checked) p.set('editorial', '1');
  history.replaceState(null, '', `#/graph${p.toString() ? '?' + p : ''}`);
  route();
}

// ---------- events ----------
let debounce;
app.addEventListener('input', (e) => {
  if (e.target.id === 'catalog-q') {
    clearTimeout(debounce);
    const v = e.target.value;
    debounce = setTimeout(() => updateCatalog((s) => { s.q = v; }), 120);
  }
});
app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.facet) {
    updateCatalog((s) => {
      const cur = new Set(s.filters[t.dataset.facet] || []);
      t.checked ? cur.add(t.value) : cur.delete(t.value);
      s.filters[t.dataset.facet] = [...cur];
    });
  } else if (t.id === 'catalog-sort') updateCatalog((s) => { s.sort = t.value; });
  else if (t.dataset.reltype || t.id === 'graph-isolated' || t.id === 'graph-editorial') updateGraphParams();
  else if (t.id === 'ex-switch') location.hash = `#/explore/${t.value}`;
});
app.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-remove]');
  if (rm) {
    const [k, v] = rm.dataset.remove.split(':');
    updateCatalog((s) => { s.filters[k] = (s.filters[k] || []).filter((x) => x !== v); });
  }
  if (e.target.closest('[data-action="clear"]')) updateCatalog((s) => { s.filters = {}; s.q = ''; s.question = null; });
  const fam = e.target.closest('[data-family]');
  if (fam) updateCatalog((s) => { s.family = fam.dataset.family === state.data.resourceFamilies.find((x) => x.default).id ? null : fam.dataset.family; });
  const jump = e.target.closest('[data-scroll]');
  if (jump) { e.preventDefault(); document.getElementById(jump.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});
app.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-action="hero-search"]');
  if (f) {
    e.preventDefault();
    const q = new FormData(f).get('q');
    location.hash = `#/catalog${q ? '?q=' + encodeURIComponent(q) : ''}`;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    const q = document.getElementById('catalog-q') || document.querySelector('.hero-search input');
    if (q) q.focus();
    else location.hash = '#/catalog';
  }
});

// Theme: navy by default; the toggle stores an explicit light choice.
const themeBtn = document.getElementById('theme-toggle');
function applyTheme(t) {
  if (t) document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
try { applyTheme(localStorage.getItem('atlas-theme') === 'light' ? 'light' : null); } catch { /* storage unavailable */ }
themeBtn?.addEventListener('click', () => {
  // Navy is the default; the toggle switches to (or back from) the light variant.
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? null : 'light';
  applyTheme(next);
  try { next ? localStorage.setItem('atlas-theme', next) : localStorage.removeItem('atlas-theme'); } catch { /* storage unavailable */ }
});

const menuBtn = document.getElementById('menu-toggle');
menuBtn?.addEventListener('click', () => document.body.classList.toggle('nav-open'));
window.addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); route(); });

// ---------- boot ----------
async function boot() {
  try {
    const res = await fetch('data/atlas.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
    // Schema v3: work on all resources; `ontologies` in the bundle is the default-family alias kept for old consumers.
    if (state.data.resources) state.data.ontologies = state.data.resources;
    // Explorer manifest is optional: the catalogue works without it.
    state.explorer = await fetch('data/explorer/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : { ontologies: {} })).catch(() => ({ ontologies: {} }));
  } catch (err) {
    app.innerHTML = `<section class="page-head"><h1>Could not load the atlas data</h1><p class="lead small">${esc(err.message)}. If you opened the file directly, serve the folder over HTTP (<code>npm run serve</code>).</p></section>`;
    return;
  }
  const d = state.data;
  state.byId = new Map(d.ontologies.map((o) => [o.id, o]));
  state.maps = {
    industry: Object.fromEntries(d.industries.map((x) => [x.id, x])),
    type: Object.fromEntries(d.resourceTypes.map((x) => [x.id, x])),
    familyOf: Object.fromEntries(d.resourceTypes.map((x) => [x.id, x.family])),
    capability: Object.fromEntries(d.capabilities.map((x) => [x.id, x])),
    evidence: Object.fromEntries(d.evidenceTypes.map((x) => [x.id, x])),
    pai: Object.fromEntries(d.physicalAi.items.map((x) => [x.id, x])),
    domain: Object.fromEntries(d.knowledgeDomains.flatMap((p) => p.children.map((c) => [c.id, { ...c, parent: p }]))),
    useCase: Object.fromEntries(d.useCases.map((x) => [x.id, x])),
    relType: Object.fromEntries(d.relationTypes.map((x) => [x.id, x])),
  };
  state.index = buildIndex(d.ontologies, d);
  document.getElementById('footer-meta').textContent = `Dataset ${d.meta.version} · generated ${d.meta.generatedOn} · ${d.meta.counts.ontologies} ontologies`;
  // Legacy deep links (v1 had none) and old anchors fall back to home.
  route();
}
boot();
