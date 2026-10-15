import { html, raw, esc, safeUrl } from './lib/html.js';
import { buildIndex, query, facetCounts, FACETS, stateFromParams, paramsFromState, search } from './lib/search.js';
import { buildGraph, renderGraph } from './lib/graph.js';
import { icon } from './lib/icons.js';

const REPO = 'https://github.com/opedoussaut/ht-kkh-reference-ontologies';

const LABELS = {
  layer: { upper: 'Upper', 'mid-level': 'Mid-level', 'cross-domain': 'Cross-domain', domain: 'Domain' },
  kind: { ontology: 'Ontology', vocabulary: 'Vocabulary', 'meta-model': 'Meta-model', 'information-model': 'Information model', 'modeling-language': 'Modelling language', classification: 'Classification' },
  maturity: { standard: 'Standard', stable: 'Stable', emerging: 'Emerging', research: 'Research', legacy: 'Legacy', discontinued: 'Discontinued' },
  access: { open: 'Open', 'open-with-terms': 'Open with terms', licensed: 'Licensed', unknown: 'Unknown' },
  verification: { verified: 'Verified', 'partially-verified': 'Partially verified', unverified: 'Unverified' },
  format: { owl: 'OWL', rdf: 'RDF / JSON-LD', shacl: 'SHACL', xml: 'XML / XMI', json: 'JSON', uml: 'UML / MOF', express: 'EXPRESS / STEP', logic: 'Logic (KIF, CL)', csv: 'CSV' },
  publisherType: { 'standards-body': 'Standards body', 'industry-association': 'Industry association', consortium: 'Consortium', research: 'Research', government: 'Government', industry: 'Industry' },
  status: { published: 'Published', candidate: 'Candidate', draft: 'Draft', superseded: 'Superseded', discontinued: 'Discontinued', unknown: 'Unknown' },
};

const state = { data: null, index: null, byId: new Map(), maps: {} };
const app = document.getElementById('app');

// ---------- helpers ----------
const label = (group, v) => LABELS[group]?.[v] || v;
const ont = (id) => state.byId.get(id);
const industryName = (id) => state.maps.industry[id]?.name || id;
const useCaseName = (id) => state.maps.useCase[id]?.name || id;
const relLabel = (t) => state.maps.relType[t]?.label || t;

function facetLabel(key, v) {
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
  <a class="card" href="#/ontology/${o.id}">
    <div class="card-head">
      <div>
        <div class="card-kicker">${label('layer', o.layer)} · ${label('kind', o.kind)}</div>
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
      ${raw(icon(i.icon))}<span class="ind-name">${i.name}</span><span class="ind-n">${n} ontologies</span></a>`;
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
    [d.ontologies.length, 'reference ontologies'],
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
    <h1>Public semantic standards,<br><span class="grad">mapped for engineering.</span></h1>
    <p class="lead">A curated, cited atlas of public reference ontologies and semantic standards across industries. Each record shows its version, licence and sources.</p>
    <form class="hero-search" data-action="hero-search" role="search">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="icon"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>
      <input name="q" type="search" placeholder="Search ontologies, standards, topics…  e.g. sensors, IEEE 1872, provenance" aria-label="Search the atlas" autocomplete="off">
      <button type="submit" class="btn btn-primary">Search</button>
    </form>
    <div class="stats">
      ${stats.map(([n, t]) => html`<div class="stat"><div class="stat-n">${n}</div><div class="stat-t">${t}</div></div>`)}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Engineering use cases</h2>${link('#/use-cases', 'All use cases →', 'more')}</div>
    <div class="uc-grid">
      ${d.useCases.map((u) => html`
        <a class="uc-card uc-${u.id}" href="#/use-cases/${u.id}">
          <div class="uc-kicker">${u.stack.length} semantic layers · ${new Set(u.stack.flatMap((s) => s.ontologies)).size} ontologies</div>
          <h3>${u.name}</h3>
          <p>${u.tagline}</p>
        </a>`)}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Explore by industry</h2>${link('#/industries', 'All industries →', 'more')}</div>
    ${industryTiles(d.industries)}
  </section>

  <section class="section legend">
    <h2>How to read this atlas</h2>
    <div class="legend-grid">
      <div><h3>${pill('v-verified', 'Verified')}</h3><p>The publisher, version and licence were checked against the official source on the date shown.</p></div>
      <div><h3>${pill('v-partially-verified', 'Partially verified')}</h3><p>The official source was confirmed, but at least one fact (such as the exact version or licence wording) is still open.</p></div>
      <div><h3>${pill('v-unverified', 'Unverified')}</h3><p>A candidate with no authoritative public source yet. Flagged for review.</p></div>
      <div><h3><span class="pill editorial">Editorial</span></h3><p>Practical uses and use-case stacks written by atlas editors. They are kept apart from verified facts. See ${link('#/about', 'label criteria')}.</p></div>
      <div><h3><span class="pill">Relationships</span></h3><p>Only links stated by the publisher or a primary source are drawn in the graph, and each one cites its source.</p></div>
    </div>
  </section>`;
}

function viewCatalog(params) {
  setTitle('Catalogue');
  const s = stateFromParams(params);
  const all = state.data.ontologies;
  const results = query(all, state.index, s);
  const activeCount = Object.values(s.filters).reduce((n, v) => n + v.length, 0);

  const facets = FACETS.map((f) => {
    const counts = facetCounts(search(state.index, s.q).map((h) => ont(h.id)), s.filters, f.key);
    let values = Object.keys(counts);
    if (f.key === 'industry') values = state.data.industries.map((i) => i.id).filter((v) => counts[v] || s.filters[f.key]?.includes(v));
    else if (f.key === 'useCase') values = state.data.useCases.map((u) => u.id).filter((v) => counts[v] || s.filters[f.key]?.includes(v));
    else values = Object.keys(LABELS[f.key] || {}).filter((v) => counts[v] || s.filters[f.key]?.includes(v));
    if (!values.length) return '';
    const open = ['industry', 'useCase'].includes(f.key) || s.filters[f.key]?.length;
    return html`
      <details class="facet" ${open ? raw('open') : ''}>
        <summary>${f.label}${s.filters[f.key]?.length ? html` <span class="facet-active">${s.filters[f.key].length}</span>` : ''}</summary>
        <div class="facet-body">
          ${values.map((v) => {
            const checked = s.filters[f.key]?.includes(v);
            return html`<label class="facet-opt"><input type="checkbox" data-facet="${f.key}" value="${v}" ${checked ? raw('checked') : ''}><span>${facetLabel(f.key, v)}</span><span class="count">${counts[v] || 0}</span></label>`;
          })}
        </div>
      </details>`;
  });

  const activeChips = Object.entries(s.filters).flatMap(([k, vs]) => vs.map((v) => html`<button class="chip chip-x" data-remove="${k}:${v}" title="Remove filter">${facetLabel(k, v)} ✕</button>`));

  return html`
  <section class="page-head">
    <h1>Catalogue</h1>
    <p class="lead small">Search and filter ${all.length} public reference ontologies. Filters combine (AND across groups, OR within a group), and every view can be shared by its URL.</p>
  </section>
  <div class="catalog">
    <aside class="filters" aria-label="Filters">
      <div class="filters-head"><strong>Filters</strong>${activeCount ? html`<button class="link-btn" data-action="clear">Clear all</button>` : ''}</div>
      ${facets}
    </aside>
    <div class="results">
      <div class="toolbar">
        <div class="search-box">
          <svg aria-hidden="true" viewBox="0 0 24 24" class="icon"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>
          <input id="catalog-q" type="search" value="${s.q}" placeholder="Search name, topic, publisher, standard number…" aria-label="Search" autocomplete="off">
          <kbd>/</kbd>
        </div>
        <label class="sort">Sort
          <select id="catalog-sort" aria-label="Sort">
            ${[['relevance', 'Relevance'], ['name', 'Name'], ['updated', 'Most recent version'], ['maturity', 'Maturity']].map(([v, t]) => html`<option value="${v}" ${s.sort === v ? raw('selected') : ''}>${t}</option>`)}
          </select>
        </label>
      </div>
      <div class="result-meta" aria-live="polite"><strong>${results.length}</strong> of ${all.length} ontologies ${activeChips.length ? html`<span class="active-chips">${activeChips}</span>` : ''}</div>
      ${results.length ? html`<div class="card-grid">${results.map(card)}</div>` : emptyState('No ontology matches these criteria.', html`<button class="btn" data-action="clear">Reset filters</button>`)}
    </div>
  </div>`;
}

function factRow(k, v) { return v ? html`<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>` : ''; }

function viewOntology(id) {
  const o = ont(id);
  if (!o) return viewNotFound();
  setTitle(o.name);
  const { out, inc } = relationsOf(id);

  const relItem = (r, dir) => {
    const other = ont(dir === 'out' ? r.target : r.source);
    const otherLink = link(`#/ontology/${other.id}`, other.name, 'rel-name');
    const sentence = dir === 'out'
      ? html`<span class="rel-self">${o.name}</span> <span class="rel-type">${relLabel(r.type)}</span> ${otherLink}`
      : html`${otherLink} <span class="rel-type">${relLabel(r.type)}</span> <span class="rel-self">${o.name}</span>`;
    return html`<li class="rel">
      <div>${sentence}</div>
      <span class="rel-ev">${r.evidence.note} ${ext(r.evidence.url, 'Source')}</span>
    </li>`;
  };

  return html`
  <nav class="crumbs">${link('#/catalog', 'Catalogue')} <span>/</span> ${o.name}</nav>
  <section class="detail-hero">
    <div class="detail-kicker">${label('layer', o.layer)} · ${label('kind', o.kind)}${o.standardRef ? html` · <span class="mono">${o.standardRef}</span>` : ''}</div>
    <h1>${o.name}</h1>
    <p class="detail-full">${o.fullName}</p>
    <div class="pill-row">${verifPill(o)} ${maturityPill(o)} ${accessPill(o)} ${o.needsReview ? pill('warn', 'Needs review') : ''} ${o.origin === 'v1' ? pill('', 'Since v1') : pill('', 'Added in v2')}</div>
    <p class="detail-summary">${o.summary}</p>
    <div class="btn-row">
      ${o.links.official ? html`<a class="btn btn-primary" href="${safeUrl(o.links.official)}" target="_blank" rel="noopener noreferrer">Official source ↗</a>` : html`<span class="btn btn-disabled" title="No authoritative public source identified">No official source yet</span>`}
      ${out.length + inc.length ? html`<a class="btn" href="#/graph?focus=${o.id}">View in graph</a>` : ''}
      <a class="btn" href="${REPO}/blob/main/data/ontologies/${o.id}.json" target="_blank" rel="noopener noreferrer">Record JSON ↗</a>
    </div>
  </section>

  <div class="detail-grid">
    <div class="detail-main">
      <section class="panel">
        <h2>Key facts</h2>
        <dl class="facts">
          ${factRow('Publisher', html`${o.publisher} <span class="muted">· ${label('publisherType', o.publisherType)}</span>`)}
          ${factRow('Version', html`<span class="mono">${o.version.label}</span>${o.version.date ? html` <span class="muted">· ${o.version.date}</span>` : ''} <span class="muted">· ${label('status', o.version.status)}</span>`)}
          ${factRow('Licence', html`${o.license.name}${o.license.url ? html` · ${ext(o.license.url, 'terms')}` : ''}`)}
          ${factRow('Formats', o.formats.length ? o.formats.join(' · ') : null)}
          ${factRow('Namespace', o.links.namespace ? html`<span class="mono break">${o.links.namespace}</span>` : null)}
          ${factRow('Specification', o.links.specification ? ext(o.links.specification, o.links.specification) : null)}
          ${factRow('Repository', o.links.repository ? ext(o.links.repository, o.links.repository) : null)}
          ${factRow('Related', o.links.related ? ext(o.links.related, o.links.related) : null)}
          ${factRow('Topics', o.topics.join(' · '))}
        </dl>
      </section>

      ${o.engineeringUses?.length ? html`
      <section class="panel">
        <h2>Practical engineering uses <span class="pill editorial" title="Written by atlas editors to illustrate typical uses. Not a claim of adoption.">Editorial</span></h2>
        <ul class="bullets">${o.engineeringUses.map((x) => html`<li>${x}</li>`)}</ul>
      </section>` : ''}

      <section class="panel">
        <h2>Relationships</h2>
        ${out.length + inc.length ? html`<ul class="rels">${out.map((r) => relItem(r, 'out'))}${inc.map((r) => relItem(r, 'in'))}</ul>` : html`<p class="muted">No evidence-backed relationships recorded yet.</p>`}
        ${usedTogether(o.id).length ? html`
        <h3 class="sub">Used together in reference stacks</h3>
        <p class="muted small">Grouped by the atlas use cases (editorial architecture suggestions), not stated by the publishers.</p>
        <div class="together">${usedTogether(o.id).map(({ u, layers, peers }) => html`
          <div class="together-row"><div>${link(`#/use-cases/${u.id}`, u.name, 'rel-name')} <span class="muted small">· ${layers.join(', ')}</span></div>
          <div class="chips">${peers.map((pid) => html`<a class="chip chip-ont" href="#/ontology/${pid}">${ont(pid).name}</a>`)}</div></div>`)}</div>` : ''}
      </section>

      ${o.corrections?.length ? html`
      <section class="panel">
        <h2>Corrections made in v2</h2>
        <ul class="corrections">${o.corrections.map((c) => html`<li><span class="mono">${c.field}</span>: <s>${c.from}</s> → <strong>${c.to}</strong><br><span class="muted">${c.reason} ${ext(c.source, 'Source')}</span></li>`)}</ul>
      </section>` : ''}

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
      <section class="panel">
        <h2>Verification</h2>
        <p>${verifPill(o)} <span class="muted">Checked ${o.verification.checkedOn}</span></p>
        ${o.verification.notes ? html`<p class="small">${o.verification.notes}</p>` : ''}
        <h3 class="sub">Sources</h3>
        <ol class="sources">${o.verification.sources.map((s) => html`<li>${ext(s.url, s.title)}</li>`)}</ol>
      </section>
      <section class="panel">
        <h2>Industries</h2>
        <div class="chips">${o.industries.map((i) => chip(`#/industries/${i}`, industryName(i)))}</div>
        <h2 class="mt">Use cases</h2>
        ${o.useCases.length ? html`<div class="chips">${o.useCases.map((u) => chip(`#/use-cases/${u}`, useCaseName(u)))}</div>` : html`<p class="muted small">Not mapped to a use case.</p>`}
      </section>
      <section class="panel">
        <h2>Improve this record</h2>
        <p class="small">Found a newer version or a better source? ${ext(`${REPO}/issues/new?template=correction.yml&title=${encodeURIComponent(`[Correction] ${o.name}`)}`, 'Open a correction request')}.</p>
      </section>
    </aside>
  </div>`;
}

function viewGraph(params) {
  setTitle('Relationship graph');
  const focus = params.get('focus');
  const types = params.get('types')?.split(',').filter(Boolean) || state.data.relationTypes.map((t) => t.id);
  const isolated = params.get('isolated') === '1';
  return html`
  <section class="page-head">
    <h1>Relationship graph</h1>
    <p class="lead small">Only relationships stated by the publisher or a primary source are drawn, and each edge cites its evidence. Drag nodes, scroll to zoom, and click a node for details.</p>
  </section>
  <div class="graph-wrap">
    <div class="graph-controls">
      <div class="seg">
        ${state.data.relationTypes.map((t) => html`<label class="toggle"><input type="checkbox" data-reltype="${t.id}" ${types.includes(t.id) ? raw('checked') : ''}><span class="swatch type-${t.id}"></span>${t.label}</label>`)}
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
    <a class="btn btn-primary small" href="#/ontology/${o.id}">Open details</a>`;
}

function mountGraph(params) {
  const container = document.getElementById('graph');
  if (!container) return;
  const types = [...document.querySelectorAll('[data-reltype]')].filter((c) => c.checked).map((c) => c.dataset.reltype);
  const includeIsolated = document.getElementById('graph-isolated').checked;
  const graph = buildGraph(state.data.ontologies, state.data.relations, { types, includeIsolated });
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

function viewUseCase(id) {
  const u = state.maps.useCase[id];
  if (!u) return viewNotFound();
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
                  return html`<a class="chip chip-ont v-${o.verification.status}" href="#/ontology/${oid}" title="${o.fullName}">${o.name}</a>`;
                })}</div>
              </div>
            </div>`)}
        </div>
      </section>
      ${rels.length ? html`<section class="panel"><h2>Verified links inside this stack</h2><ul class="rels compact">${rels.map((r) => html`<li>${link(`#/ontology/${r.source}`, ont(r.source).name)} <span class="rel-type">${relLabel(r.type)}</span> ${link(`#/ontology/${r.target}`, ont(r.target).name)} ${ext(r.evidence.url, 'source')}</li>`)}</ul>
        <a class="btn small" href="#/graph">Open the full graph</a></section>` : ''}
    </div>
    <aside class="detail-side">
      <section class="panel"><h2>Engineering challenges</h2><ul class="bullets">${u.challenges.map((c) => html`<li>${c}</li>`)}</ul></section>
      <section class="panel"><a class="btn" href="#/catalog?useCase=${u.id}">All ${state.data.ontologies.filter((o) => o.useCases.includes(u.id)).length} mapped ontologies →</a></section>
    </aside>
  </div>`;
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
    case 'ontology': view = viewOntology(id); break;
    case 'graph': view = viewGraph(params); break;
    case 'industries': view = id ? viewIndustry(id) : viewIndustries(); break;
    case 'use-cases': view = id ? viewUseCase(id) : viewUseCases(); break;
    case 'about': view = viewAbout(); break;
    default: view = viewNotFound();
  }
  const path = parts.join('/');
  const focusSearch = section === 'catalog' && document.activeElement?.id === 'catalog-q';
  const caret = focusSearch ? document.activeElement.selectionStart : null;
  app.innerHTML = view.toString();
  setNav(section === 'ontology' ? 'catalog' : section);
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
  if (section === 'graph') mountGraph(params);
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
  else if (t.dataset.reltype || t.id === 'graph-isolated') updateGraphParams();
});
app.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-remove]');
  if (rm) {
    const [k, v] = rm.dataset.remove.split(':');
    updateCatalog((s) => { s.filters[k] = (s.filters[k] || []).filter((x) => x !== v); });
  }
  if (e.target.closest('[data-action="clear"]')) updateCatalog((s) => { s.filters = {}; s.q = ''; });
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
  } catch (err) {
    app.innerHTML = `<section class="page-head"><h1>Could not load the atlas data</h1><p class="lead small">${esc(err.message)}. If you opened the file directly, serve the folder over HTTP (<code>npm run serve</code>).</p></section>`;
    return;
  }
  const d = state.data;
  state.byId = new Map(d.ontologies.map((o) => [o.id, o]));
  state.maps = {
    industry: Object.fromEntries(d.industries.map((x) => [x.id, x])),
    useCase: Object.fromEntries(d.useCases.map((x) => [x.id, x])),
    relType: Object.fromEntries(d.relationTypes.map((x) => [x.id, x])),
  };
  state.index = buildIndex(d.ontologies, d);
  document.getElementById('footer-meta').textContent = `Dataset ${d.meta.version} · generated ${d.meta.generatedOn} · ${d.meta.counts.ontologies} ontologies`;
  // Legacy deep links (v1 had none) and old anchors fall back to home.
  route();
}
boot();
