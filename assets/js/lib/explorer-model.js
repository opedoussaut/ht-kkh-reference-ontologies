// Ontology Explorer view-model: pure functions over an `atlas-ontology-graph/1` asset.
// No DOM access, so it is unit-tested in Node.

export const ENTITY_TYPES = {
  class: 'Class',
  objectProperty: 'Object property',
  datatypeProperty: 'Datatype property',
  annotationProperty: 'Annotation property',
  individual: 'Individual',
  datatype: 'Datatype',
};

// Relationship groups for filtering the graph view.
export const EDGE_GROUPS = {
  hierarchy: { label: 'Subclass', types: ['subClassOf'] },
  property: { label: 'Properties (domain → range)', types: ['property'] },
  restriction: { label: 'Restrictions', types: ['restriction'] },
  axiom: { label: 'Equivalent / disjoint', types: ['equivalentClass', 'disjointWith'] },
  instance: { label: 'Instances', types: ['type'] },
};

export function curie(iri, prefixes = {}) {
  let best = null;
  for (const [p, ns] of Object.entries(prefixes)) {
    if (ns && iri.startsWith(ns) && iri.length > ns.length && (!best || ns.length > best[1].length)) best = [p, ns];
  }
  return best ? `${best[0]}:${iri.slice(best[1].length)}` : iri;
}

export function namespaceOf(iri) {
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return i > 0 ? iri.slice(0, i + 1) : iri;
}

export function createModel(graph) {
  const byId = new Map(graph.entities.map((e) => [e.id, e]));
  const out = new Map();
  const inc = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const e of graph.edges) { push(out, e.s, e); push(inc, e.o, e); }
  const outs = (id, t) => (out.get(id) || []).filter((e) => !t || (Array.isArray(t) ? t.includes(e.t) : e.t === t));
  const ins = (id, t) => (inc.get(id) || []).filter((e) => !t || (Array.isArray(t) ? t.includes(e.t) : e.t === t));

  const parents = (id) => outs(id, ['subClassOf', 'subPropertyOf']).map((e) => e.o);
  const children = (id) => ins(id, ['subClassOf', 'subPropertyOf']).map((e) => e.s).sort(byLabel);
  function byLabel(a, b) { return (byId.get(a)?.label || a).localeCompare(byId.get(b)?.label || b); }

  const ownClasses = graph.entities.filter((e) => e.t === 'class' && !e.external);
  // Roots: own classes with no parent declared in this ontology.
  const roots = ownClasses.filter((c) => !parents(c.id).some((p) => byId.get(p) && !byId.get(p).external)).map((c) => c.id).sort(byLabel);

  const domainOf = (pid) => outs(pid, ['domain', 'domainIncludes']).map((e) => e.o);
  const rangeOf = (pid) => outs(pid, ['range', 'rangeIncludes']).map((e) => e.o);

  // Properties are drawn as labelled edges between their domain and range classes (VOWL-inspired).
  const propertyEdges = [];
  for (const p of graph.entities.filter((e) => e.t === 'objectProperty' || e.t === 'datatypeProperty')) {
    for (const d of domainOf(p.id)) for (const r of rangeOf(p.id)) propertyEdges.push({ s: d, o: r, t: 'property', p: p.id });
  }

  function inspect(id) {
    const e = byId.get(id);
    if (!e) return null;
    return {
      entity: e,
      parents: parents(id),
      children: children(id),
      equivalent: [...outs(id, 'equivalentClass').map((x) => x.o), ...ins(id, 'equivalentClass').map((x) => x.s)],
      disjoint: [...outs(id, 'disjointWith').map((x) => x.o), ...ins(id, 'disjointWith').map((x) => x.s)],
      asDomain: ins(id, ['domain', 'domainIncludes']).map((x) => ({ p: x.s, soft: x.t === 'domainIncludes' })),
      asRange: ins(id, ['range', 'rangeIncludes']).map((x) => ({ p: x.s, soft: x.t === 'rangeIncludes' })),
      restrictions: outs(id, 'restriction'),
      restrictedBy: ins(id, 'restriction'),
      constraints: e.constraints || [],
      instances: ins(id, 'type').map((x) => x.s),
      types: outs(id, 'type').map((x) => x.o),
      domain: outs(id, 'domain').map((x) => x.o),
      range: outs(id, 'range').map((x) => x.o),
      domainIncludes: outs(id, 'domainIncludes').map((x) => x.o),
      rangeIncludes: outs(id, 'rangeIncludes').map((x) => x.o),
      inverse: [...outs(id, 'inverseOf').map((x) => x.o), ...ins(id, 'inverseOf').map((x) => x.s)],
    };
  }

  // Graph-node neighbours of a node (classes, datatypes, individuals), across all edge groups.
  function neighbours(id, groups = Object.keys(EDGE_GROUPS)) {
    const set = new Set();
    for (const edge of viewEdges(groups)) {
      if (edge.s === id) set.add(edge.o);
      if (edge.o === id) set.add(edge.s);
    }
    // A property id expands to its domain and range classes.
    const e = byId.get(id);
    if (e && e.t.endsWith('Property')) for (const x of [...domainOf(id), ...rangeOf(id)]) set.add(x);
    set.delete(id);
    return [...set];
  }

  function viewEdges(groups) {
    const types = new Set(groups.flatMap((g) => EDGE_GROUPS[g]?.types || []));
    const base = graph.edges.filter((e) => types.has(e.t) && byId.get(e.s)?.t !== 'objectProperty' && byId.get(e.s)?.t !== 'datatypeProperty');
    return types.has('property') ? [...base, ...propertyEdges] : base;
  }

  // Initial view: top-level classes then their children, breadth-first, capped.
  function initialNodes(limit = 60) {
    const seen = new Set();
    const queue = [...roots];
    while (queue.length && seen.size < limit) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(...children(id));
    }
    return [...seen];
  }

  function search(q, { types = null, namespace = null, limit = 200 } = {}) {
    const needle = q.trim().toLowerCase();
    return graph.entities
      .filter((e) => (!types || types.includes(e.t)) && (!namespace || namespaceOf(e.id) === namespace))
      .filter((e) => !needle || e.label.toLowerCase().includes(needle) || e.id.toLowerCase().includes(needle) || (e.definition || '').toLowerCase().includes(needle))
      .sort((a, b) => Number(a.external) - Number(b.external) || rank(a, needle) - rank(b, needle) || a.label.localeCompare(b.label))
      .slice(0, limit);
  }
  const rank = (e, n) => (!n ? 0 : e.label.toLowerCase() === n ? 0 : e.label.toLowerCase().startsWith(n) ? 1 : e.label.toLowerCase().includes(n) ? 2 : 3);

  function namespaces() {
    const counts = {};
    for (const e of graph.entities) { const ns = namespaceOf(e.id); counts[ns] = (counts[ns] || 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([ns, n]) => ({ ns, n, prefix: Object.entries(graph.ontology.prefixes || {}).find(([, v]) => v === ns)?.[0] || null }));
  }

  return { graph, byId, roots, parents, children, inspect, neighbours, viewEdges, initialNodes, search, namespaces, domainOf, rangeOf, label: (id) => byId.get(id)?.label || id };
}
