// Build-time ontology extraction: RDF (Turtle / N-Triples) -> compact `atlas-ontology-graph/1` JSON.
// Pure (no network, no file system) so it can be unit-tested on fixtures.
import { Parser, Store, DataFactory } from 'n3';

const { namedNode } = DataFactory;
export const FORMAT = 'atlas-ontology-graph/1';

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const DCT = 'http://purl.org/dc/terms/';
const DCE = 'http://purl.org/dc/elements/1.1/';
// schema.org-style soft domain/range (used by W3C SOSA/SSN instead of rdfs:domain/range).
const INCLUDES = [['http://schema.org/domainIncludes', 'domainIncludes'], ['https://schema.org/domainIncludes', 'domainIncludes'],
  ['http://schema.org/rangeIncludes', 'rangeIncludes'], ['https://schema.org/rangeIncludes', 'rangeIncludes']];

const TYPE_MAP = [
  [`${OWL}Class`, 'class'], [`${RDFS}Class`, 'class'],
  [`${OWL}ObjectProperty`, 'objectProperty'],
  [`${OWL}DatatypeProperty`, 'datatypeProperty'],
  [`${OWL}AnnotationProperty`, 'annotationProperty'],
  [`${RDF}Property`, 'objectProperty'],
  [`${OWL}NamedIndividual`, 'individual'],
];
const LABEL_PREDICATES = [`${SKOS}prefLabel`, `${RDFS}label`];
const DEFINITION_PREDICATES = [`${SKOS}definition`, `${RDFS}comment`, `${DCT}description`, `${DCE}description`];
const RESTRICTION_KINDS = {
  [`${OWL}someValuesFrom`]: 'some', [`${OWL}allValuesFrom`]: 'all', [`${OWL}hasValue`]: 'value',
  [`${OWL}minCardinality`]: 'min', [`${OWL}maxCardinality`]: 'max', [`${OWL}cardinality`]: 'exact',
  [`${OWL}minQualifiedCardinality`]: 'min', [`${OWL}maxQualifiedCardinality`]: 'max', [`${OWL}qualifiedCardinality`]: 'exact',
};
const STRUCTURAL = new Set([`${RDF}type`, `${RDFS}subClassOf`, `${RDFS}subPropertyOf`, `${RDFS}domain`, `${RDFS}range`,
  `${OWL}equivalentClass`, `${OWL}disjointWith`, `${OWL}inverseOf`, ...LABEL_PREDICATES, ...INCLUDES.map(([p]) => p)]);

export function parseRdf(text, { format = 'text/turtle', baseIRI } = {}) {
  const prefixes = {};
  const quads = new Parser({ format, baseIRI }).parse(text, null, (p, iri) => { prefixes[p] = iri.value ?? iri; });
  return { store: new Store(quads), prefixes, triples: quads.length };
}

const isNamed = (t) => t.termType === 'NamedNode';

function pickLiteral(objs) {
  const lits = objs.filter((o) => o.termType === 'Literal');
  return (lits.find((l) => l.language === 'en') || lits.find((l) => !l.language) || lits.find((l) => l.language?.startsWith('en')) || lits[0])?.value;
}

function localName(iri) {
  const m = iri.match(/[#/]([^#/]+)$/);
  return m ? decodeURIComponent(m[1]) : iri;
}

function listItems(store, head) {
  const out = [];
  let node = head;
  for (let guard = 0; node && guard < 1000; guard++) {
    if (node.termType === 'NamedNode' && node.value === `${RDF}nil`) break;
    const first = store.getObjects(node, namedNode(`${RDF}first`), null)[0];
    if (first) out.push(first);
    node = store.getObjects(node, namedNode(`${RDF}rest`), null)[0];
  }
  return out;
}

// Named classes in a (possibly blank-node) class expression: the IRI itself, or the members of a union/intersection.
function namedMembers(store, term) {
  if (isNamed(term)) return { members: [term.value], complex: false };
  for (const op of ['unionOf', 'intersectionOf']) {
    const head = store.getObjects(term, namedNode(`${OWL}${op}`), null)[0];
    if (head) {
      const items = listItems(store, head);
      return { members: items.filter(isNamed).map((i) => i.value), complex: items.some((i) => !isNamed(i)), op };
    }
  }
  return { members: [], complex: true };
}

/**
 * @param {string} text   RDF source
 * @param {object} meta   { atlasId, source: { url, sha256, bytes, retrievedOn, license, licenseUrl }, format }
 */
export function extractGraph(text, meta) {
  const { store, prefixes, triples } = parseRdf(text, { format: meta.format });
  const entities = new Map();
  const edges = [];
  const edgeKeys = new Set();
  let complexExpressions = 0;

  const ensure = (iri, t, external = false) => {
    let e = entities.get(iri);
    if (!e) { e = { id: iri, t, external }; entities.set(iri, e); }
    else if (!external && e.external) { e.external = false; e.t = t; }
    return e;
  };
  const addEdge = (s, o, t, extra = {}) => {
    const key = `${s}|${o}|${t}|${extra.p || ''}|${extra.k || ''}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ s, o, t, ...extra });
  };

  // 1. Declared entities.
  for (const [typeIri, t] of TYPE_MAP) {
    for (const s of store.getSubjects(namedNode(`${RDF}type`), namedNode(typeIri), null)) {
      if (isNamed(s) && !s.value.startsWith(OWL) && !s.value.startsWith(RDFS) && !s.value.startsWith(RDF)) ensure(s.value, t);
    }
  }
  // Individuals typed with a declared class.
  for (const q of store.getQuads(null, namedNode(`${RDF}type`), null, null)) {
    if (isNamed(q.subject) && isNamed(q.object) && entities.get(q.object.value)?.t === 'class' && !entities.has(q.subject.value)) {
      ensure(q.subject.value, 'individual');
    }
  }

  const declared = [...entities.values()];
  // 2. Labels, definitions, other annotations.
  for (const e of declared) {
    const s = namedNode(e.id);
    for (const p of LABEL_PREDICATES) { const v = pickLiteral(store.getObjects(s, namedNode(p), null)); if (v) { e.label = v; break; } }
    for (const p of DEFINITION_PREDICATES) { const v = pickLiteral(store.getObjects(s, namedNode(p), null)); if (v) { e.definition = v; e.definitionSource = p; break; } }
    const annotations = [];
    for (const q of store.getQuads(s, null, null, null)) {
      if (STRUCTURAL.has(q.predicate.value) || q.predicate.value === e.definitionSource) continue;
      if (q.object.termType === 'Literal') annotations.push({ p: q.predicate.value, v: q.object.value, ...(q.object.language ? { lang: q.object.language } : {}) });
      else if (isNamed(q.object) && !q.predicate.value.startsWith(OWL)) annotations.push({ p: q.predicate.value, iri: q.object.value });
    }
    if (annotations.length) e.annotations = annotations.slice(0, 40);
    if (store.getObjects(s, namedNode(`${OWL}deprecated`), null).some((o) => o.value === 'true')) e.deprecated = true;
  }

  // 3. Structural edges.
  const classLike = (iri) => entities.get(iri)?.t || 'class';
  for (const e of declared) {
    const s = namedNode(e.id);
    if (e.t === 'class') {
      for (const o of store.getObjects(s, namedNode(`${RDFS}subClassOf`), null)) {
        if (isNamed(o)) { ensure(o.value, 'class', true); addEdge(e.id, o.value, 'subClassOf'); continue; }
        const prop = store.getObjects(o, namedNode(`${OWL}onProperty`), null)[0];
        if (prop && isNamed(prop)) {
          let matched = false;
          for (const [kp, k] of Object.entries(RESTRICTION_KINDS)) {
            for (const filler of store.getObjects(o, namedNode(kp), null)) {
              matched = true;
              const onClass = store.getObjects(o, namedNode(`${OWL}onClass`), null)[0] || store.getObjects(o, namedNode(`${OWL}onDataRange`), null)[0];
              const target = filler.termType === 'Literal' ? onClass : filler;
              ensure(prop.value, entities.get(prop.value)?.t || 'objectProperty', !entities.has(prop.value));
              if (target && isNamed(target)) {
                ensure(target.value, classLike(target.value), !entities.has(target.value));
                addEdge(e.id, target.value, 'restriction', { p: prop.value, k, ...(filler.termType === 'Literal' ? { n: filler.value } : {}) });
              } else if (filler.termType === 'Literal') {
                // Unqualified cardinality: keep it as a constraint on the class rather than an edge.
                (e.constraints ||= []).push({ p: prop.value, k, n: filler.value });
              } else {
                complexExpressions++;
              }
            }
          }
          if (!matched) complexExpressions++;
        } else {
          const { members, complex } = namedMembers(store, o);
          if (complex || !members.length) complexExpressions++;
        }
      }
      for (const o of store.getObjects(s, namedNode(`${OWL}equivalentClass`), null)) {
        if (isNamed(o)) { ensure(o.value, 'class', true); addEdge(e.id, o.value, 'equivalentClass'); } else complexExpressions++;
      }
      for (const o of store.getObjects(s, namedNode(`${OWL}disjointWith`), null)) {
        if (isNamed(o)) { ensure(o.value, 'class', true); addEdge(e.id, o.value, 'disjointWith'); }
      }
    }
    if (e.t.endsWith('Property')) {
      for (const o of store.getObjects(s, namedNode(`${RDFS}subPropertyOf`), null)) {
        if (isNamed(o)) { ensure(o.value, e.t, true); addEdge(e.id, o.value, 'subPropertyOf'); }
      }
      for (const [pred, t] of [[`${RDFS}domain`, 'domain'], [`${RDFS}range`, 'range']]) {
        for (const o of store.getObjects(s, namedNode(pred), null)) {
          const { members, complex } = namedMembers(store, o);
          if (complex) complexExpressions++;
          for (const m of members) {
            const isDatatype = t === 'range' && (m.startsWith('http://www.w3.org/2001/XMLSchema#') || m === `${RDFS}Literal` || m === `${RDF}langString`);
            ensure(m, isDatatype ? 'datatype' : 'class', true);
            addEdge(e.id, m, t, members.length > 1 ? { union: true } : {});
          }
        }
      }
      for (const [pred, t] of INCLUDES) {
        for (const o of store.getObjects(s, namedNode(pred), null)) {
          if (!isNamed(o)) continue;
          const isDatatype = o.value.startsWith('http://www.w3.org/2001/XMLSchema#') || o.value === `${RDFS}Literal`;
          ensure(o.value, isDatatype ? 'datatype' : 'class', true);
          addEdge(e.id, o.value, t);
        }
      }
      for (const o of store.getObjects(s, namedNode(`${OWL}inverseOf`), null)) {
        if (isNamed(o)) { ensure(o.value, 'objectProperty', true); addEdge(e.id, o.value, 'inverseOf'); }
      }
    }
    if (e.t === 'individual') {
      for (const o of store.getObjects(s, namedNode(`${RDF}type`), null)) {
        if (isNamed(o) && !o.value.startsWith(OWL)) { ensure(o.value, 'class', true); addEdge(e.id, o.value, 'type'); }
      }
    }
  }

  // External stubs keep a label only if the source itself declares one.
  for (const e of entities.values()) {
    if (!e.external || e.label) continue;
    const v = pickLiteral(LABEL_PREDICATES.flatMap((p) => store.getObjects(namedNode(e.id), namedNode(p), null)));
    if (v) e.label = v;
  }

  // 4. Ontology header.
  const ontNode = store.getSubjects(namedNode(`${RDF}type`), namedNode(`${OWL}Ontology`), null).find(isNamed);
  const header = { atlasId: meta.atlasId, iri: ontNode?.value || null };
  if (ontNode) {
    const get = (p) => pickLiteral(store.getObjects(ontNode, namedNode(p), null));
    header.title = get(`${DCT}title`) || get(`${RDFS}label`) || get(`${DCE}title`) || null;
    header.description = get(`${DCT}description`) || get(`${RDFS}comment`) || null;
    header.versionInfo = get(`${OWL}versionInfo`) || null;
    header.versionIri = store.getObjects(ontNode, namedNode(`${OWL}versionIRI`), null).find(isNamed)?.value || null;
    header.imports = store.getObjects(ontNode, namedNode(`${OWL}imports`), null).filter(isNamed).map((o) => o.value);
    const lic = store.getObjects(ontNode, namedNode(`${DCT}license`), null)[0];
    if (lic) header.declaredLicense = lic.value;
  } else {
    header.imports = [];
  }
  header.prefixes = prefixes;
  header.source = meta.source;

  const list = [...entities.values()].map((e) => ({ ...e, label: e.label || localName(e.id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const e of list) delete e.definitionSource;
  const count = (t) => list.filter((e) => e.t === t && !e.external).length;
  return {
    format: FORMAT,
    ontology: header,
    stats: {
      triples,
      classes: count('class'),
      objectProperties: count('objectProperty'),
      datatypeProperties: count('datatypeProperty'),
      annotationProperties: count('annotationProperty'),
      individuals: count('individual'),
      externalReferences: list.filter((e) => e.external).length,
      edges: edges.length,
    },
    entities: list,
    edges: edges.sort((a, b) => (a.s + a.t + a.o).localeCompare(b.s + b.t + b.o)),
    notes: { complexExpressions },
  };
}

// Version slug for asset file names: an explicit version number when the source states one, else a content hash.
export function versionSlug(header, sha256) {
  const num = (s) => String(s || '').match(/v?\d+(?:\.\d+)+/i)?.[0];
  const v = num(header.versionInfo) || num(header.versionIri) || num(header.title?.match(/version\s+v?[\d.]+/i)?.[0])
    || `sha-${sha256.slice(0, 12)}`;
  return String(v).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}
