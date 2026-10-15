// Ontology Explorer: three-panel view (hierarchy · graph · inspector) over build-time graph assets.
import { html, raw, esc, safeUrl } from './lib/html.js';
import { createModel, curie, namespaceOf, ENTITY_TYPES, EDGE_GROUPS } from './lib/explorer-model.js';

const CYTOSCAPE_URL = new URL('../vendor/cytoscape-3.30.4.esm.min.js', import.meta.url).href;
const INITIAL_LIMIT = 60;
const MAX_VISIBLE = 250;

export const AVAILABILITY = {
  interactive: { label: 'Interactive graph available', cls: 'v-verified' },
  'source-available': { label: 'Source available, not yet processed', cls: 'm-stable' },
  'documentation-only': { label: 'Documentation only', cls: 'a-licensed' },
  unavailable: { label: 'Source unavailable or incompatible', cls: 'v-unverified' },
  'not-assessed': { label: 'Not yet assessed', cls: '' },
};

const assetCache = new Map();
const loadAsset = (url) => {
  if (!assetCache.has(url)) assetCache.set(url, fetch(url, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }));
  return assetCache.get(url);
};

let S = null; // explorer session state for the mounted view

// ---------- static view ----------
export function explorerView({ record, entry, interactive }) {
  if (typeof document !== 'undefined') document.title = `${record.name} explorer · Reference Ontology Atlas`;
  const status = entry?.status || 'not-assessed';
  const av = AVAILABILITY[status];
  if (status !== 'interactive') {
    return html`
    <nav class="crumbs"><a href="#/catalog">Catalogue</a> <span>/</span> <a href="#/ontology/${record.id}">${record.name}</a> <span>/</span> Explorer</nav>
    <section class="page-head"><p class="eyebrow">Ontology Explorer</p><h1>${record.name}</h1>
      <p class="pill-row"><span class="pill ${av.cls}">${av.label}</span></p>
      <p class="lead small">${entry?.reason || 'This record has not yet been assessed for the explorer.'}</p>
      <p class="muted">The explorer shows only structures parsed from the publisher's own machine-readable files. It never builds a graph from a description.</p>
      <div class="btn-row">
        ${record.links.official ? html`<a class="btn btn-primary" href="${safeUrl(record.links.official)}" target="_blank" rel="noopener noreferrer">Official source ↗</a>` : ''}
        <a class="btn" href="#/ontology/${record.id}">Back to record</a>
      </div>
    </section>
    <section class="section"><h2>Ontologies you can explore now</h2>
      <div class="chips">${interactive.map((r) => html`<a class="chip chip-ont" href="#/explore/${r.id}">${r.name}</a>`)}</div>
    </section>`;
  }
  return html`
  <nav class="crumbs"><a href="#/catalog">Catalogue</a> <span>/</span> <a href="#/ontology/${record.id}">${record.name}</a> <span>/</span> Explorer</nav>
  <section class="explorer-head">
    <div>
      <p class="eyebrow">Ontology Explorer</p>
      <h1>${record.name} <span class="muted ex-version ${entry.version.startsWith('sha-') ? '' : 'mono'}">${entry.version.startsWith('sha-') ? 'no version number declared' : entry.version}</span></h1>
      <p class="muted small" id="ex-meta">Loading the parsed ontology…</p>
    </div>
    <label class="sort">Ontology
      <select id="ex-switch" aria-label="Switch ontology">${interactive.map((r) => html`<option value="${r.id}" ${r.id === record.id ? raw('selected') : ''}>${r.name}</option>`)}</select>
    </label>
  </section>
  <div class="explorer" id="explorer" data-id="${record.id}">
    <aside class="ex-panel ex-left" aria-label="Ontology hierarchy">
      <div class="search-box ex-search"><input id="ex-q" type="search" placeholder="Search concepts, properties, IRIs…" aria-label="Search concepts" autocomplete="off"></div>
      <div class="ex-types" role="group" aria-label="Entity types">
        ${[['class', 'Classes'], ['objectProperty', 'Object props'], ['datatypeProperty', 'Data props'], ['individual', 'Individuals']].map(([t, l]) => html`<label class="toggle"><input type="checkbox" data-ex-type="${t}" checked>${l}</label>`)}
      </div>
      <label class="sort ex-ns">Namespace <select id="ex-ns" aria-label="Namespace filter"><option value="">All</option></select></label>
      <div id="ex-tree" class="ex-tree" role="tree" aria-label="Class hierarchy"></div>
    </aside>
    <section class="ex-panel ex-center" aria-label="Graph view">
      <div class="ex-toolbar">
        <div class="seg" role="group" aria-label="Relationship filters">
          ${Object.entries(EDGE_GROUPS).map(([k, g]) => html`<label class="toggle"><input type="checkbox" data-ex-edge="${k}" ${k === 'instance' ? '' : raw('checked')}><span class="swatch ex-${k}"></span>${g.label}</label>`)}
        </div>
        <div class="ex-actions">
          <div class="segmented" role="group" aria-label="Layout">
            <button class="seg-btn is-on" data-ex-layout="hierarchy">Hierarchy</button><button class="seg-btn" data-ex-layout="network">Network</button>
          </div>
          <button class="btn small" data-ex-act="expand" title="Add neighbours of the selected concept">Expand</button>
          <button class="btn small" data-ex-act="focus" title="Show only the selected concept and its neighbours">Focus</button>
          <button class="btn small" data-ex-act="reset" title="Back to the top-level overview">Overview</button>
          <button class="btn small" data-ex-act="zoom-in" aria-label="Zoom in">+</button><button class="btn small" data-ex-act="zoom-out" aria-label="Zoom out">−</button>
          <button class="btn small" data-ex-act="fit" aria-label="Fit graph to view">Fit</button>
        </div>
      </div>
      <div id="ex-cy" class="ex-cy" role="img" aria-label="Interactive graph of the ontology. The hierarchy panel and the inspector give the same information as text."></div>
      <p class="ex-layout-note muted small" id="ex-layout-note" hidden>This view is too flat or too wide for a readable hierarchy, so it is shown as a network. Select a concept and use Focus to see its branch as a hierarchy.</p>
      <p class="ex-hint muted small" id="ex-hint">Click a node to inspect it · double-click to expand its neighbours · drag to rearrange · Ctrl/⌘ + scroll to zoom.</p>
    </section>
    <aside class="ex-panel ex-right" id="ex-inspector" aria-label="Concept inspector" aria-live="polite"></aside>
  </div>`;
}

// ---------- mount ----------
export async function mountExplorer({ record, entry, concept, onConceptChange }) {
  const root = document.getElementById('explorer');
  if (!root) return;
  const meta = document.getElementById('ex-meta');
  let graph;
  try {
    graph = await loadAsset(entry.asset);
  } catch (err) {
    root.innerHTML = `<div class="empty"><p>The graph file could not be loaded (${esc(err.message)}).</p><a class="btn" href="#/ontology/${esc(record.id)}">Back to record</a></div>`;
    return;
  }
  if (!document.body.contains(root)) return; // navigated away while loading
  const model = createModel(graph);
  const o = graph.ontology;
  meta.innerHTML = html`${o.title || o.iri} · ${graph.stats.classes} classes · ${graph.stats.objectProperties + graph.stats.datatypeProperties} properties · ${graph.stats.individuals} individuals · retrieved ${o.source.retrievedOn} · ${o.source.license}`.toString();

  S = { record, entry, model, cy: null, visible: new Set(), selected: null, groups: new Set(Object.keys(EDGE_GROUPS).filter((g) => g !== 'instance')), layout: 'hierarchy', types: new Set(['class', 'objectProperty', 'datatypeProperty', 'individual']), ns: '', q: '', onConceptChange };

  const nsSel = document.getElementById('ex-ns');
  for (const { ns, n, prefix } of model.namespaces()) nsSel.insertAdjacentHTML('beforeend', html`<option value="${ns}">${prefix ? prefix + ': ' : ''}${ns} (${n})</option>`.toString());

  renderTree();
  renderInspector();
  bindPanels(root);

  let cytoscape;
  try {
    cytoscape = (await import(CYTOSCAPE_URL)).default;
  } catch {
    document.getElementById('ex-cy').innerHTML = '<div class="empty"><p>The graph view could not be loaded. The hierarchy and inspector remain available.</p></div>';
  }
  if (cytoscape && document.body.contains(root)) initGraph(cytoscape);

  const start = concept && model.byId.has(concept) ? concept : null;
  if (start) select(start, { reveal: true, focus: true });
  else showOverview();
}

// ---------- tree ----------
function renderTree() {
  const { model } = S;
  const el = document.getElementById('ex-tree');
  const types = [...S.types];
  if (S.q || S.ns) {
    const hits = model.search(S.q, { types, namespace: S.ns || null });
    el.innerHTML = hits.length
      ? html`<p class="muted small">${hits.length} result${hits.length === 1 ? '' : 's'}</p><ul class="ex-list">${hits.map((e) => treeItem(e.id, false))}</ul>`.toString()
      : '<p class="muted small">No matching entity.</p>';
    return;
  }
  const sections = [];
  if (S.types.has('class')) sections.push(html`<h3 class="sub">Classes</h3><ul class="ex-list" role="group">${model.roots.map((id) => treeNode(id, 0))}</ul>`);
  for (const [t, title] of [['objectProperty', 'Object properties'], ['datatypeProperty', 'Datatype properties'], ['individual', 'Individuals']]) {
    if (!S.types.has(t)) continue;
    const ids = model.graph.entities.filter((e) => e.t === t && !e.external).map((e) => e.id).sort((a, b) => model.label(a).localeCompare(model.label(b)));
    if (ids.length) sections.push(html`<details class="ex-group"><summary>${title} <span class="muted">${ids.length}</span></summary><ul class="ex-list">${ids.map((id) => treeItem(id, false))}</ul></details>`);
  }
  el.innerHTML = sections.join('');
}

function treeItem(id, hasToggle) {
  const e = S.model.byId.get(id);
  return html`<li role="treeitem" aria-selected="${S.selected === id}"><button class="ex-item t-${e.t} ${S.selected === id ? 'is-sel' : ''} ${e.external ? 'is-ext' : ''}" data-ex-select="${id}" title="${curie(id, S.model.graph.ontology.prefixes)}"><span class="ex-dot"></span>${e.label}${e.external ? html` <span class="muted small">ext.</span>` : ''}</button></li>`;
}

function treeNode(id, depth) {
  const kids = S.model.children(id).filter((k) => S.model.byId.get(k)?.t === 'class');
  if (!kids.length || depth > 12) return treeItem(id, false);
  const open = depth < 1;
  const e = S.model.byId.get(id);
  return html`<li role="treeitem" aria-expanded="${open}"><details ${open ? raw('open') : ''}><summary><button class="ex-item t-${e.t} ${S.selected === id ? 'is-sel' : ''}" data-ex-select="${id}" title="${curie(id, S.model.graph.ontology.prefixes)}"><span class="ex-dot"></span>${e.label} <span class="muted small">${kids.length}</span></button></summary>
    <ul class="ex-list" role="group">${kids.map((k) => treeNode(k, depth + 1))}</ul></details></li>`;
}

// ---------- inspector ----------
function entityLink(id) {
  const e = S.model.byId.get(id);
  if (!e) return html`<span class="mono small">${curie(id, S.model.graph.ontology.prefixes)}</span>`;
  return html`<button class="ex-ref t-${e.t}" data-ex-select="${id}">${e.label}</button>`;
}
const refList = (ids, empty = '—') => (ids.length ? html`<div class="ex-refs">${ids.map(entityLink)}</div>` : html`<span class="muted">${empty}</span>`);
const shortKind = { some: 'some', all: 'only', value: 'value', min: 'min', max: 'max', exact: 'exactly' };

function renderInspector() {
  const el = document.getElementById('ex-inspector');
  if (!el) return;
  const { model, record, entry } = S;
  const o = model.graph.ontology;
  const sourceBlock = html`
    <section class="ex-block">
      <h3 class="sub">Source ontology</h3>
      <dl class="facts compact">
        <div class="fact"><dt>Ontology</dt><dd>${o.title || o.iri}</dd></div>
        ${o.iri ? html`<div class="fact"><dt>IRI</dt><dd class="mono break">${o.iri}</dd></div>` : ''}
        <div class="fact"><dt>Version</dt><dd>${o.versionInfo && /\d/.test(o.versionInfo) ? o.versionInfo : entry.version}${entry.version.startsWith('sha-') ? html` <span class="muted small">(no version number declared; identified by content hash)</span>` : ''}</dd></div>
        <div class="fact"><dt>Retrieved</dt><dd>${o.source.retrievedOn} · <span class="mono small">sha256 ${o.source.sha256.slice(0, 12)}…</span></dd></div>
        <div class="fact"><dt>Licence</dt><dd><a class="ext" href="${safeUrl(o.source.licenseUrl)}" target="_blank" rel="noopener noreferrer">${o.source.license}</a></dd></div>
        <div class="fact"><dt>Source file</dt><dd><a class="ext break" href="${safeUrl(o.source.url)}" target="_blank" rel="noopener noreferrer">${o.source.url}</a></dd></div>
        ${o.imports?.length ? html`<div class="fact"><dt>Imports</dt><dd>${o.imports.map((i) => html`<div class="mono small break">${i}</div>`)}<span class="muted small">Listed, not loaded.</span></dd></div>` : ''}
      </dl>
      ${model.graph.notes.complexExpressions ? html`<p class="muted small">${model.graph.notes.complexExpressions} complex class expressions (for example nested unions) are not drawn.</p>` : ''}
    </section>`;

  const editorial = record.engineeringUses?.length ? html`
    <section class="ex-block ex-editorial">
      <h3 class="sub">Engineering interpretation <span class="pill editorial">Editorial</span></h3>
      <p class="muted small">Written by atlas editors for the ontology as a whole. Not part of the source semantics.</p>
      <ul class="bullets small">${record.engineeringUses.map((u) => html`<li>${u}</li>`)}</ul>
    </section>` : '';

  if (!S.selected) {
    el.innerHTML = html`<h2 class="ex-title">${o.title || record.name}</h2>
      ${o.description ? html`<p class="small">${o.description}</p><p class="muted small">Source-defined description.</p>` : ''}
      <p class="muted small">Select a concept in the hierarchy or graph to inspect it.</p>${sourceBlock}${editorial}`.toString();
    return;
  }
  const i = model.inspect(S.selected);
  const e = i.entity;
  const pfx = o.prefixes;
  const isClass = e.t === 'class';
  const isProp = e.t.endsWith('Property');
  const restr = (list, dir) => list.map((r) => html`<li>${dir === 'out' ? '' : html`${entityLink(r.s)} `}<span class="rel-type">${model.label(r.p)} ${shortKind[r.k] || r.k}${r.n ? ' ' + r.n : ''}</span> ${dir === 'out' ? entityLink(r.o) : html`<span class="muted">this</span>`}</li>`);

  el.innerHTML = html`
    <p class="detail-kicker">${ENTITY_TYPES[e.t] || e.t}${e.external ? ' · referenced from another ontology' : ''}${e.deprecated ? ' · deprecated' : ''}</p>
    <h2 class="ex-title">${e.label}</h2>
    <p class="mono small break">${curie(e.id, pfx)}</p>
    <p class="mono small muted break"><a href="${safeUrl(e.id)}" target="_blank" rel="noopener noreferrer">${e.id}</a></p>
    <div class="btn-row ex-btns"><button class="btn small" data-ex-act="expand">Expand neighbours</button><button class="btn small" data-ex-act="focus">Focus</button><button class="btn small" data-ex-act="copy">Copy link</button></div>

    <section class="ex-block">
      <h3 class="sub">Source-defined semantics</h3>
      ${e.definition ? html`<p class="ex-def">${e.definition}</p>` : html`<p class="muted small">No definition declared in the source.</p>`}
      ${e.external ? html`<p class="muted small">Defined outside this ontology. Only its identifier${e.label !== e.id ? ' and label' : ''} appear here; imports are not loaded.</p>` : ''}
      <dl class="facts compact">
        ${isClass ? html`
          <div class="fact"><dt>Parents</dt><dd>${refList(i.parents, 'Top-level')}</dd></div>
          <div class="fact"><dt>Children</dt><dd>${refList(i.children, 'None')}</dd></div>
          ${i.equivalent.length ? html`<div class="fact"><dt>Equivalent</dt><dd>${refList(i.equivalent)}</dd></div>` : ''}
          ${i.disjoint.length ? html`<div class="fact"><dt>Disjoint with</dt><dd>${refList(i.disjoint)}</dd></div>` : ''}
          <div class="fact"><dt>Domain of</dt><dd>${i.asDomain.length ? html`<div class="ex-refs">${i.asDomain.map((x) => html`${entityLink(x.p)}${x.soft ? html`<span class="muted small" title="schema:domainIncludes (non-binding)">≈</span>` : ''}`)}</div>` : html`<span class="muted">—</span>`}</dd></div>
          <div class="fact"><dt>Range of</dt><dd>${i.asRange.length ? html`<div class="ex-refs">${i.asRange.map((x) => html`${entityLink(x.p)}${x.soft ? html`<span class="muted small" title="schema:rangeIncludes (non-binding)">≈</span>` : ''}`)}</div>` : html`<span class="muted">—</span>`}</dd></div>
          ${i.restrictions.length ? html`<div class="fact"><dt>Restrictions</dt><dd><ul class="ex-restr">${restr(i.restrictions, 'out')}</ul></dd></div>` : ''}
          ${i.constraints.length ? html`<div class="fact"><dt>Cardinality</dt><dd><ul class="ex-restr">${i.constraints.map((c) => html`<li><span class="rel-type">${model.label(c.p)} ${shortKind[c.k] || c.k} ${c.n}</span></li>`)}</ul></dd></div>` : ''}
          ${i.restrictedBy.length ? html`<div class="fact"><dt>Used in restrictions of</dt><dd><ul class="ex-restr">${restr(i.restrictedBy, 'in')}</ul></dd></div>` : ''}
          ${i.instances.length ? html`<div class="fact"><dt>Individuals</dt><dd>${refList(i.instances)}</dd></div>` : ''}` : ''}
        ${isProp ? html`
          <div class="fact"><dt>Domain</dt><dd>${refList(i.domain, 'Not declared')}</dd></div>
          <div class="fact"><dt>Range</dt><dd>${refList(i.range, 'Not declared')}</dd></div>
          ${i.domainIncludes.length ? html`<div class="fact"><dt>Domain includes</dt><dd>${refList(i.domainIncludes)}<span class="muted small">schema:domainIncludes (non-binding)</span></dd></div>` : ''}
          ${i.rangeIncludes.length ? html`<div class="fact"><dt>Range includes</dt><dd>${refList(i.rangeIncludes)}<span class="muted small">schema:rangeIncludes (non-binding)</span></dd></div>` : ''}
          <div class="fact"><dt>Super-properties</dt><dd>${refList(i.parents, 'None')}</dd></div>
          <div class="fact"><dt>Sub-properties</dt><dd>${refList(i.children, 'None')}</dd></div>
          ${i.inverse.length ? html`<div class="fact"><dt>Inverse of</dt><dd>${refList(i.inverse)}</dd></div>` : ''}` : ''}
        ${e.t === 'individual' ? html`<div class="fact"><dt>Type</dt><dd>${refList(i.types)}</dd></div>` : ''}
      </dl>
      ${e.annotations?.length ? html`<details class="ex-ann"><summary>Annotations (${e.annotations.length})</summary><dl class="facts compact">${e.annotations.map((a) => html`<div class="fact"><dt class="mono small">${curie(a.p, pfx)}</dt><dd>${a.iri ? html`<span class="mono small break">${curie(a.iri, pfx)}</span>` : a.v}${a.lang ? html` <span class="muted small">@${a.lang}</span>` : ''}</dd></div>`)}</dl></details>` : ''}
    </section>
    ${sourceBlock}${editorial}`.toString();
}

// ---------- graph ----------
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function initGraph(cytoscape) {
  const fg = cssVar('--fg-2') || '#c3d2e8';
  const line = cssVar('--line-strong') || 'rgba(142,178,232,.3)';
  const halo = cssVar('--bg-solid') || '#0c2244';
  S.cy = cytoscape({
    container: document.getElementById('ex-cy'),
    userZoomingEnabled: false, // wheel zoom only with Ctrl/⌘ so the page keeps scrolling (see below)
    minZoom: 0.15,
    maxZoom: 3,
    style: [
      { selector: 'node', style: { label: 'data(label)', 'font-size': 11, color: fg, 'text-valign': 'bottom', 'text-margin-y': 5, 'text-outline-color': halo, 'text-outline-width': 2.5, width: 22, height: 22, 'background-color': '#4f9bff', 'border-width': 2, 'border-color': halo } },
      { selector: 'node[t = "class"][?ext]', style: { 'background-color': '#8ba2c4', 'border-style': 'dashed', 'border-color': '#8ba2c4', 'background-opacity': 0.35 } },
      { selector: 'node[t = "datatype"]', style: { shape: 'round-rectangle', width: 34, height: 16, 'background-color': '#ffb547' } },
      { selector: 'node[t = "individual"]', style: { shape: 'diamond', 'background-color': '#b48cff' } },
      { selector: 'node:selected, node.is-sel', style: { 'border-color': '#6fd3ff', 'border-width': 4, width: 30, height: 30, 'font-weight': 700 } },
      { selector: 'edge', style: { width: 1.4, 'line-color': line, 'target-arrow-color': line, 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 0.9 } },
      { selector: 'edge[t = "subClassOf"]', style: { 'line-color': '#6fa8ff', 'target-arrow-color': '#6fa8ff', 'target-arrow-shape': 'triangle-backcurve', width: 1.8 } },
      { selector: 'edge[t = "property"]', style: { label: '', 'font-size': 9, color: fg, 'text-rotation': 'autorotate', 'text-background-color': halo, 'text-background-opacity': 0.85, 'text-background-padding': 2, 'line-color': '#42d392', 'target-arrow-color': '#42d392' } },
      { selector: 'edge[t = "restriction"]', style: { label: '', 'font-size': 9, color: fg, 'text-rotation': 'autorotate', 'text-background-color': halo, 'text-background-opacity': 0.85, 'text-background-padding': 2, 'line-style': 'dashed', 'line-color': '#ffb547', 'target-arrow-color': '#ffb547' } },
      { selector: 'edge[t = "equivalentClass"]', style: { 'line-color': '#b48cff', 'target-arrow-shape': 'none', 'line-style': 'double', width: 3 } },
      { selector: 'edge[t = "disjointWith"]', style: { 'line-color': '#ff8a80', 'target-arrow-shape': 'none', 'line-style': 'dotted', width: 2 } },
      { selector: 'edge[t = "type"]', style: { 'line-color': '#b48cff', 'target-arrow-color': '#b48cff', 'line-style': 'dashed' } },
      { selector: 'edge.lbl', style: { label: 'data(label)' } },
      { selector: 'edge.hl', style: { width: 2.6, 'z-index': 9 } },
      { selector: '.faded', style: { opacity: 0.18 } },
    ],
  });
  const box = document.getElementById('ex-cy');
  box.addEventListener('wheel', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey)) return; // plain scroll scrolls the page
    ev.preventDefault();
    const rect = box.getBoundingClientRect();
    const level = Math.min(3, Math.max(0.15, S.cy.zoom() * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
    S.cy.zoom({ level, renderedPosition: { x: ev.clientX - rect.left, y: ev.clientY - rect.top } });
  }, { passive: false });
  S.cy.on('tap', 'node', (evt) => select(evt.target.id()));
  S.cy.on('dbltap', 'node', (evt) => { select(evt.target.id()); expand(evt.target.id()); });
  S.cy.on('tap', 'edge', (evt) => { const p = evt.target.data('p'); if (p) select(p); });
}

function edgeLabel(e) {
  const m = S.model;
  if (e.t === 'property') return m.label(e.p);
  if (e.t === 'restriction') return `${m.label(e.p)} ${shortKind[e.k] || e.k}${e.n ? ' ' + e.n : ''}`;
  return '';
}

function syncGraph({ relayout = true } = {}) {
  if (!S.cy) return;
  const m = S.model;
  const nodes = [...S.visible].filter((id) => m.byId.has(id));
  const set = new Set(nodes);
  const edges = m.viewEdges([...S.groups]).filter((e) => set.has(e.s) && set.has(e.o) && e.s !== e.o);
  const els = [
    ...nodes.map((id) => { const e = m.byId.get(id); return { group: 'nodes', data: { id, label: e.label, t: e.t, ext: !!e.external } }; }),
    ...edges.map((e, n) => ({ group: 'edges', data: { id: `e${n}-${e.t}`, source: e.s, target: e.o, t: e.t, p: e.p || '', label: edgeLabel(e) } })),
  ];
  const old = new Map(S.cy.nodes().map((n) => [n.id(), n.position()]));
  S.cy.batch(() => { S.cy.elements().remove(); S.cy.add(els); });
  for (const n of S.cy.nodes()) if (old.has(n.id())) n.position(old.get(n.id()));
  if (edges.length <= 24) S.cy.edges().addClass('lbl');
  if (S.selected && set.has(S.selected)) highlightNode(S.selected);
  if (relayout) runLayout();
  const hint = document.getElementById('ex-hint');
  if (hint) hint.textContent = `${nodes.length} nodes · ${edges.length} relationships shown${nodes.length >= MAX_VISIBLE ? ' (limit reached — use Focus or Overview)' : ''} · double-click a node to expand it · Ctrl/⌘ + scroll to zoom.`;
}

function runLayout() {
  if (!S.cy || !S.cy.nodes().length) return;
  const visible = new Set(S.cy.nodes().map((n) => n.id()));
  const roots = S.cy.nodes().filter((n) => !S.model.parents(n.id()).some((p) => visible.has(p))).map((n) => n.id());
  // A hierarchy layout only helps when there is a hierarchy to show; flat vocabularies fall back to the network layout.
  const subEdges = S.cy.edges('[t = "subClassOf"]').length;
  // Widest level of the visible hierarchy (breadth-first from the roots over subclass links).
  const depth = new Map(roots.map((r) => [r, 0]));
  const queue = [...roots];
  while (queue.length) {
    const id = queue.shift();
    for (const c of S.model.children(id)) if (visible.has(c) && !depth.has(c)) { depth.set(c, depth.get(id) + 1); queue.push(c); }
  }
  const widths = {};
  for (const d of depth.values()) widths[d] = (widths[d] || 0) + 1;
  const widest = Math.max(0, ...Object.values(widths));
  const flat = S.layout === 'hierarchy' && (subEdges < Math.max(2, visible.size / 5) || widest > 14);
  const note = document.getElementById('ex-layout-note');
  if (note) note.hidden = !flat;
  const opts = S.layout === 'hierarchy' && !flat
    ? { name: 'breadthfirst', directed: false, roots: roots.length ? roots.map((r) => `#${CSS.escape(r)}`).join(',') : undefined, spacingFactor: 1.1, padding: 24, animate: false }
    : { name: 'cose', animate: false, padding: 24, nodeRepulsion: () => 9000, idealEdgeLength: () => 90, randomize: false, numIter: 800 };
  try { S.cy.layout(opts).run(); } catch { S.cy.layout({ name: 'grid', padding: 24 }).run(); }
  S.cy.fit(undefined, 28);
}

function highlightNode(id) {
  S.cy.$('.is-sel').removeClass('is-sel');
  S.cy.edges('.hl').removeClass('hl');
  if (S.cy.edges().length > 24) S.cy.edges('.lbl').removeClass('lbl');
  const n = S.cy.$id(id);
  if (n.length) { n.addClass('is-sel'); n.connectedEdges().addClass('lbl hl'); }
  // Selecting a property highlights the edges that represent it.
  S.cy.edges().filter((e) => e.data('p') === id).addClass('lbl hl');
  return n;
}

function showOverview() {
  S.visible = new Set(S.model.initialNodes(INITIAL_LIMIT));
  syncGraph();
}

function addVisible(ids) {
  for (const id of ids) { if (S.visible.size >= MAX_VISIBLE) break; S.visible.add(id); }
}

function expand(id = S.selected) {
  if (!id) return;
  const e = S.model.byId.get(id);
  if (e?.t.endsWith('Property')) addVisible(S.model.domainOf(id).concat(S.model.rangeOf(id)));
  else { S.visible.add(id); addVisible(S.model.neighbours(id, [...S.groups])); }
  syncGraph();
}

function focus(id = S.selected) {
  if (!id) return;
  const e = S.model.byId.get(id);
  const nb = e?.t.endsWith('Property') ? S.model.domainOf(id).concat(S.model.rangeOf(id)) : [id, ...S.model.neighbours(id, [...S.groups])];
  S.visible = new Set(nb.slice(0, MAX_VISIBLE));
  syncGraph();
}

function select(id, { reveal = false, focus: doFocus = false } = {}) {
  S.selected = id;
  const e = S.model.byId.get(id);
  if (doFocus) focus(id);
  else if (reveal && e && !e.t.endsWith('Property') && !S.visible.has(id)) { S.visible.add(id); addVisible(S.model.parents(id)); syncGraph(); }
  if (S.cy) {
    const n = highlightNode(id);
    if (n?.length) S.cy.animate({ center: { eles: n } }, { duration: 200 });
  }
  renderInspector();
  document.querySelectorAll('#ex-tree .ex-item').forEach((b) => b.classList.toggle('is-sel', b.dataset.exSelect === id));
  S.onConceptChange?.(id);
}

// ---------- events ----------
function bindPanels(root) {
  let t;
  root.addEventListener('input', (ev) => {
    if (ev.target.id === 'ex-q') { clearTimeout(t); t = setTimeout(() => { S.q = ev.target.value; renderTree(); }, 120); }
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.exType) { el.checked ? S.types.add(el.dataset.exType) : S.types.delete(el.dataset.exType); renderTree(); }
    else if (el.id === 'ex-ns') { S.ns = el.value; renderTree(); }
    else if (el.dataset.exEdge) { el.checked ? S.groups.add(el.dataset.exEdge) : S.groups.delete(el.dataset.exEdge); syncGraph({ relayout: false }); }
  });
  root.addEventListener('click', (ev) => {
    const sel = ev.target.closest('[data-ex-select]');
    if (sel) { ev.preventDefault(); select(sel.dataset.exSelect, { reveal: true }); return; }
    const lay = ev.target.closest('[data-ex-layout]');
    if (lay) {
      S.layout = lay.dataset.exLayout;
      root.querySelectorAll('[data-ex-layout]').forEach((b) => b.classList.toggle('is-on', b === lay));
      runLayout();
      return;
    }
    const act = ev.target.closest('[data-ex-act]')?.dataset.exAct;
    if (act === 'expand') expand();
    else if (act === 'focus') focus();
    else if (act === 'reset') showOverview();
    else if (act === 'fit') S.cy?.fit(undefined, 28);
    else if (act === 'zoom-in' || act === 'zoom-out') S.cy?.zoom({ level: Math.min(3, Math.max(0.15, S.cy.zoom() * (act === 'zoom-in' ? 1.25 : 0.8))), renderedPosition: { x: S.cy.width() / 2, y: S.cy.height() / 2 } });
    else if (act === 'copy') navigator.clipboard?.writeText(location.href).catch(() => {});
  });
}
