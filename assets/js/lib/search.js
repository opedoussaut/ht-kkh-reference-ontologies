// Pure search & filtering logic shared by the browser app and the Node test suite.

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function tokenize(s) {
  return normalize(s).split(/[^a-z0-9.]+/).map((t) => t.replace(/^\.+|\.+$/g, '')).filter(Boolean);
}

// Field weights: an exact token hit counts the full weight, a prefix hit 60 %, a fuzzy hit 30 %.
const FIELDS = [
  ['name', 10],
  ['aliases', 8],
  ['fullName', 5],
  ['standardRef', 5],
  ['topics', 4],
  ['publisher', 3],
  ['context', 2],
  ['summary', 1],
];

export function buildIndex(ontologies, lookups = {}) {
  const ucName = Object.fromEntries((lookups.useCases || []).map((u) => [u.id, u.name]));
  const indName = Object.fromEntries((lookups.industries || []).map((i) => [i.id, i.name]));
  const capName = Object.fromEntries((lookups.capabilities || []).map((c) => [c.id, c.label]));
  const domName = Object.fromEntries((lookups.knowledgeDomains || []).flatMap((d) => d.children.map((c) => [c.id, `${c.label} ${d.label}`])));
  const typeName = Object.fromEntries((lookups.resourceTypes || []).map((x) => [x.id, x.label]));
  return ontologies.map((o) => {
    const fields = {
      name: o.name,
      aliases: [o.id, o.legacy?.name].filter(Boolean).join(' '),
      fullName: o.fullName,
      standardRef: o.standardRef || '',
      topics: o.topics.join(' '),
      publisher: o.publisher,
      context: [
        ...o.industries.map((i) => indName[i] || i),
        ...o.useCases.map((u) => ucName[u] || u),
        ...(o.capabilities || []).map((c) => capName[c] || c),
        o.knowledge ? domName[o.knowledge.domain] || '' : '',
        typeName[o.resourceType] || '',
        o.kind, o.layer, o.maturity, ...o.formats,
      ].join(' '),
      summary: [o.summary, ...(o.engineeringUses || [])].join(' '),
    };
    const tokens = {};
    for (const [f] of FIELDS) tokens[f] = tokenize(fields[f]);
    return { id: o.id, tokens };
  });
}

function editDistanceAtMost1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else { i++; j++; }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

function tokenScore(q, words) {
  let best = 0;
  for (const w of words) {
    if (w === q) return 1;
    if (w.startsWith(q)) best = Math.max(best, 0.6);
    else if (q.length >= 5 && editDistanceAtMost1(q, w)) best = Math.max(best, 0.3);
  }
  return best;
}

// Every query token must match at least one field (AND semantics). Returns ids sorted by score.
export function search(index, query) {
  const qs = tokenize(query);
  if (!qs.length) return index.map((e) => ({ id: e.id, score: 0 }));
  const results = [];
  for (const entry of index) {
    let total = 0;
    let ok = true;
    for (const q of qs) {
      let best = 0;
      for (const [f, weight] of FIELDS) best = Math.max(best, tokenScore(q, entry.tokens[f]) * weight);
      if (best === 0) { ok = false; break; }
      total += best;
    }
    if (ok) results.push({ id: entry.id, score: total });
  }
  return results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

// Normalised format families for the Format facet (records keep the publisher's wording in `formats`).
const FORMAT_FAMILIES = [
  ['owl', /\bOWL\b/i],
  ['rdf', /RDF|Turtle|JSON-LD|N-Triples|RDFa|Microdata/i],
  ['shacl', /SHACL/i],
  ['xml', /\bXML\b|XMI/i],
  ['json', /\bJSON\b(?!-LD)/i],
  ['uml', /UML|MOF/i],
  ['express', /EXPRESS|Part 21/i],
  ['logic', /SUO-KIF|Common Logic|TPTP/i],
  ['csv', /CSV/i],
];
export function formatFamilies(o) {
  const text = o.formats.join(' | ');
  return FORMAT_FAMILIES.filter(([, re]) => re.test(text)).map(([k]) => k);
}

export const FACETS = [
  { key: 'capability', label: 'Engineering capability', get: (o) => o.capabilities || [] },
  { key: 'industry', label: 'Industry', get: (o) => o.industries },
  { key: 'domain', label: 'Knowledge domain', get: (o) => (o.knowledge ? [o.knowledge.domain] : []) },
  { key: 'type', label: 'Resource type', get: (o) => (o.resourceType ? [o.resourceType] : []) },
  { key: 'useCase', label: 'Use case', get: (o) => o.useCases },
  { key: 'layer', label: 'Layer', get: (o) => [o.layer] },
  { key: 'format', label: 'Format', get: formatFamilies },
  { key: 'maturity', label: 'Maturity', get: (o) => [o.maturity] },
  { key: 'access', label: 'Licence access', get: (o) => [o.license.access] },
  { key: 'verification', label: 'Verification', get: (o) => [o.verification.status] },
  { key: 'publisherType', label: 'Publisher type', get: (o) => [o.publisherType] },
];

const facetByKey = Object.fromEntries(FACETS.map((f) => [f.key, f]));

// filters: { [facetKey]: string[] } — OR within a facet, AND across facets.
export function matchesFilters(o, filters, skipKey) {
  for (const [key, values] of Object.entries(filters)) {
    if (key === skipKey || !values?.length || !facetByKey[key]) continue;
    const have = facetByKey[key].get(o);
    if (!values.some((v) => have.includes(v))) return false;
  }
  return true;
}

export function applyFilters(ontologies, filters) {
  return ontologies.filter((o) => matchesFilters(o, filters));
}

// Counts for each value of a facet, given all *other* active filters (standard faceted-search behaviour).
export function facetCounts(ontologies, filters, key) {
  const counts = {};
  for (const o of ontologies) {
    if (!matchesFilters(o, filters, key)) continue;
    for (const v of facetByKey[key].get(o)) counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

export const SORTS = {
  relevance: null,
  name: (a, b) => a.name.localeCompare(b.name),
  updated: (a, b) => String(b.version.date || '').localeCompare(String(a.version.date || '')) || a.name.localeCompare(b.name),
  maturity: (a, b) => MATURITY_RANK[a.maturity] - MATURITY_RANK[b.maturity] || a.name.localeCompare(b.name),
};
const MATURITY_RANK = { standard: 0, stable: 1, emerging: 2, research: 3, legacy: 4, discontinued: 5 };

// Full pipeline used by the catalogue view.
// `family`: restrict to one resource family (`familyOf` maps resourceType -> family); 'all' or omitted = no restriction.
export function query(ontologies, index, { q = '', filters = {}, sort = 'relevance', family = null, familyOf = null } = {}) {
  const byId = new Map(ontologies.map((o) => [o.id, o]));
  const hits = search(index, q);
  const inFamily = (o) => !family || family === 'all' || !familyOf || familyOf[o.resourceType] === family;
  let list = hits.map((h) => byId.get(h.id)).filter((o) => inFamily(o) && matchesFilters(o, filters));
  const cmp = SORTS[sort];
  if (cmp) list = [...list].sort(cmp);
  else if (!tokenize(q).length) list = [...list].sort(SORTS.name);
  return list;
}

// URL <-> state helpers for shareable catalogue links.
export function stateFromParams(params) {
  const filters = {};
  for (const f of FACETS) {
    const v = params.get(f.key);
    if (v) filters[f.key] = v.split(',').filter(Boolean);
  }
  // family: null = the default family; question: id of the curated question that produced these filters (if any).
  return { q: params.get('q') || '', sort: params.get('sort') || 'relevance', filters, family: params.get('family') || null, question: params.get('question') || null };
}

export function paramsFromState({ q, sort, filters, family = null, question = null }) {
  const p = new URLSearchParams();
  if (question) p.set('question', question);
  if (family) p.set('family', family);
  if (q) p.set('q', q);
  if (sort && sort !== 'relevance') p.set('sort', sort);
  for (const f of FACETS) if (filters[f.key]?.length) p.set(f.key, filters[f.key].join(','));
  return p;
}
