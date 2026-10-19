// Dependency-free force-directed graph: a deterministic layout (testable in Node)
// plus an SVG renderer with pan, zoom, drag, hover highlighting and selection.

export function buildGraph(ontologies, relations, { types = null, includeIsolated = false } = {}) {
  const edges = relations.filter((r) => !types || types.includes(r.type));
  const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
  const nodes = ontologies
    .filter((o) => includeIsolated || linked.has(o.id))
    .map((o) => ({ id: o.id, label: o.name, layer: o.layer || 'technology', maturity: o.maturity, degree: 0 }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const l of links) { byId.get(l.source).degree++; byId.get(l.target).degree++; }
  return { nodes, links };
}

export function neighbours(graph, id) {
  const set = new Set([id]);
  for (const l of graph.links) {
    if (l.source === id) set.add(l.target);
    if (l.target === id) set.add(l.source);
  }
  return set;
}

// Deterministic: nodes start on a circle in input order; no randomness.
export function layout(graph, { width = 900, height = 640, iterations = 400 } = {}) {
  const n = graph.nodes.length;
  const cx = width / 2, cy = height / 2;
  const r0 = Math.min(width, height) * 0.38;
  graph.nodes.forEach((node, i) => {
    const a = (2 * Math.PI * i) / Math.max(n, 1);
    node.x = cx + r0 * Math.cos(a);
    node.y = cy + r0 * Math.sin(a);
    node.vx = 0; node.vy = 0;
  });
  for (let i = 0; i < iterations; i++) tick(graph, { cx, cy, alpha: 1 - i / iterations });
  return graph;
}

export function tick(graph, { cx, cy, alpha = 0.3, fixed = null }) {
  const nodes = graph.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const repulsion = 5200, spring = 0.035, rest = 95, gravity = 0.012, damping = 0.82;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = 0.1 * (i - j); dy = 0.1; d2 = dx * dx + dy * dy; }
      const f = (repulsion / d2) * alpha;
      const d = Math.sqrt(d2);
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
  }
  for (const l of graph.links) {
    const s = byId.get(l.source), t = byId.get(l.target);
    const dx = t.x - s.x, dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - rest) * spring * alpha;
    s.vx += (dx / d) * f; s.vy += (dy / d) * f;
    t.vx -= (dx / d) * f; t.vy -= (dy / d) * f;
  }
  for (const node of nodes) {
    node.vx += (cx - node.x) * gravity * alpha;
    node.vy += (cy - node.y) * gravity * alpha;
    if (node === fixed) { node.vx = 0; node.vy = 0; continue; }
    node.vx *= damping; node.vy *= damping;
    node.x += Math.max(-30, Math.min(30, node.vx));
    node.y += Math.max(-30, Math.min(30, node.vy));
  }
}

const SVG = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export function renderGraph(container, graph, { onSelect, selected = null, relationLabel = (t) => t } = {}) {
  container.innerHTML = '';
  const width = container.clientWidth || 900;
  const height = Math.max(520, container.clientHeight || 640);
  layout(graph, { width, height });

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'graph-svg', role: 'img', 'aria-label': 'Ontology relationship graph' });
  const defs = el('defs');
  const marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '10', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
  marker.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'graph-arrow' }));
  defs.appendChild(marker);
  svg.appendChild(defs);
  const viewport = el('g');
  svg.appendChild(viewport);
  const linkLayer = el('g', { class: 'graph-links' });
  const nodeLayer = el('g', { class: 'graph-nodes' });
  viewport.append(linkLayer, nodeLayer);

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const radius = (n) => 7 + Math.min(n.degree, 8) * 1.6;

  const linkEls = graph.links.map((l) => {
    const g = el('g', { class: `graph-link type-${l.type}` });
    const line = el('line', { 'marker-end': 'url(#arrow)' });
    const title = el('title');
    title.textContent = `${byId.get(l.source).label} ${relationLabel(l.type)} ${byId.get(l.target).label}`;
    line.appendChild(title);
    g.appendChild(line);
    linkLayer.appendChild(g);
    return { l, line, g };
  });

  const nodeEls = graph.nodes.map((n) => {
    const g = el('g', { class: `graph-node layer-${n.layer}`, tabindex: '0', role: 'button', 'aria-label': n.label });
    const c = el('circle', { r: radius(n) });
    const t = el('text', { dy: radius(n) + 14, 'text-anchor': 'middle' });
    t.textContent = n.label;
    g.append(c, t);
    nodeLayer.appendChild(g);
    return { n, g };
  });

  function draw() {
    for (const { l, line } of linkEls) {
      const s = byId.get(l.source), t = byId.get(l.target);
      const dx = t.x - s.x, dy = t.y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rt = radius(t) + 3;
      line.setAttribute('x1', s.x); line.setAttribute('y1', s.y);
      line.setAttribute('x2', t.x - (dx / d) * rt); line.setAttribute('y2', t.y - (dy / d) * rt);
    }
    for (const { n, g } of nodeEls) g.setAttribute('transform', `translate(${n.x},${n.y})`);
  }

  function highlight(id) {
    const near = id ? neighbours(graph, id) : null;
    svg.classList.toggle('has-focus', !!id);
    for (const { n, g } of nodeEls) {
      g.classList.toggle('is-near', !!near && near.has(n.id));
      g.classList.toggle('is-selected', n.id === selectedId);
    }
    for (const { l, g } of linkEls) g.classList.toggle('is-near', !!id && (l.source === id || l.target === id));
  }

  let selectedId = selected;
  let view = { x: 0, y: 0, k: 1 };
  const applyView = () => viewport.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);

  const toGraph = (evt) => {
    const rect = svg.getBoundingClientRect();
    const sx = ((evt.clientX - rect.left) / rect.width) * width;
    const sy = ((evt.clientY - rect.top) / rect.height) * height;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k, sx, sy };
  };

  let drag = null;
  for (const { n, g } of nodeEls) {
    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      g.setPointerCapture(e.pointerId);
      drag = { node: n, moved: false };
    });
    g.addEventListener('pointerenter', () => !drag && highlight(n.id));
    g.addEventListener('pointerleave', () => !drag && highlight(selectedId));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); } });
    g.addEventListener('focus', () => highlight(n.id));
  }

  let pan = null;
  svg.addEventListener('pointerdown', (e) => { pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; svg.classList.add('is-panning'); });
  svg.addEventListener('pointermove', (e) => {
    if (drag) {
      const p = toGraph(e);
      drag.node.x = p.x; drag.node.y = p.y; drag.moved = true;
      for (let i = 0; i < 2; i++) tick(graph, { cx: width / 2, cy: height / 2, alpha: 0.15, fixed: drag.node });
      draw();
    } else if (pan) {
      const rect = svg.getBoundingClientRect();
      view.x = pan.vx + ((e.clientX - pan.x) / rect.width) * width;
      view.y = pan.vy + ((e.clientY - pan.y) / rect.height) * height;
      applyView();
    }
  });
  const end = () => {
    if (drag && !drag.moved) select(drag.node.id);
    drag = null; pan = null;
    svg.classList.remove('is-panning');
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toGraph(e);
    const k = Math.max(0.4, Math.min(3, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    view.x = p.sx - p.x * k; view.y = p.sy - p.y * k; view.k = k;
    applyView();
  }, { passive: false });

  function select(id) {
    selectedId = id;
    highlight(id);
    onSelect?.(id);
  }

  container.appendChild(svg);
  draw();
  applyView();
  highlight(selectedId);

  return {
    select,
    zoom(f) {
      const k = Math.max(0.4, Math.min(3, view.k * f));
      const r = k / view.k;
      view = { x: width / 2 - (width / 2 - view.x) * r, y: height / 2 - (height / 2 - view.y) * r, k };
      applyView();
    },
    reset() { view = { x: 0, y: 0, k: 1 }; applyView(); },
  };
}
