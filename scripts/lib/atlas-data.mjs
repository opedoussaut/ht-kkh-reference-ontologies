// Data layer for the Reference Ontology Atlas: load, validate, bundle and export.
// Used by scripts/build-data.mjs and by the test suite.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export const SITE_URL = 'https://opedoussaut.github.io/ht-kkh-reference-ontologies/';
export const NS = `${SITE_URL}ns#`;

// Hosts and markers that must never appear in public data (internal platform content).
export const FORBIDDEN_PATTERNS = [
  /3dexperience\.3ds\.com/i,
  /3dswym/i,
  /dsext\d+/i,
  /swym:/i,
  /\.dsone\.3ds\.com/i,
  /intranet/i,
];

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function loadSources(root) {
  const dir = join(root, 'data/ontologies');
  const ontologies = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: `data/ontologies/${f}`, record: readJson(join(dir, f)) }));
  return {
    ontologies,
    industries: readJson(join(root, 'data/taxonomy/industries.json')).items,
    useCases: readJson(join(root, 'data/taxonomy/use-cases.json')).items,
    relations: readJson(join(root, 'data/taxonomy/relations.json')),
    resourceTypes: readJson(join(root, 'data/taxonomy/resource-types.json')),
    knowledgeDomains: readJson(join(root, 'data/taxonomy/knowledge-domains.json')),
    capabilities: readJson(join(root, 'data/taxonomy/capabilities.json')),
    physicalAi: readJson(join(root, 'data/taxonomy/physical-ai.json')),
    evidenceTypes: readJson(join(root, 'data/taxonomy/evidence-types.json')),
    questions: readJson(join(root, 'data/taxonomy/questions.json')),
    legacy: readJson(join(root, 'data/legacy/catalog-v1.json')).records,
    schema: readJson(join(root, 'schema/ontology.schema.json')),
  };
}

export function validate(src) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const check = ajv.compile(src.schema);

  const ids = new Set();
  const industryIds = new Set(src.industries.map((i) => i.id));
  const useCaseIds = new Set(src.useCases.map((u) => u.id));
  const relationTypes = new Set(src.relations.types.map((t) => t.id));
  const relationCategories = new Set((src.relations.categories || []).map((c) => c.id));
  const typeIds = new Set(src.resourceTypes.items.map((x) => x.id));
  const subDomains = new Set(src.knowledgeDomains.items.flatMap((d) => d.children.map((c) => c.id)));
  const capIds = new Set(src.capabilities.items.map((x) => x.id));
  const paiIds = new Set(src.physicalAi.items.map((x) => x.id));
  const evidenceIds = new Set(src.evidenceTypes.items.map((x) => x.id));
  const familyOf = Object.fromEntries(src.resourceTypes.items.map((t) => [t.id, t.family]));
  const kindToType = Object.fromEntries(src.resourceTypes.items.flatMap((t) => t.fromKind.map((k) => [k, t.id])));
  for (const t of src.relations.types) if (!relationCategories.has(t.category) || t.category === 'editorial') err(`relation type ${t.id}`, `category must be a stored (non-editorial) category, got "${t.category}"`);

  for (const { file, record: r } of src.ontologies) {
    if (!check(r)) {
      for (const e of check.errors) err(file, `schema ${e.instancePath || '/'} ${e.message}`);
      continue;
    }
    if (`data/ontologies/${r.id}.json` !== file) err(file, `file name must match id "${r.id}"`);
    if (ids.has(r.id)) err(file, `duplicate id "${r.id}"`);
    ids.add(r.id);
    for (const i of r.industries) if (!industryIds.has(i)) err(file, `unknown industry "${i}"`);
    for (const u of r.useCases) if (!useCaseIds.has(u)) err(file, `unknown use case "${u}"`);
    if (r.origin === 'v1' && !r.legacy) err(file, 'v1 records must keep their legacy block');
    if (r.verification.status === 'unverified' && !r.needsReview) err(file, 'unverified records must set needsReview: true');
    // Phase 2 (schema v3) classification and evidence rules.
    if (!typeIds.has(r.resourceType)) err(file, `unknown resourceType "${r.resourceType}"`);
    if (r.knowledge.domain !== 'not-assessed' && !subDomains.has(r.knowledge.domain)) err(file, `unknown knowledge sub-domain "${r.knowledge.domain}"`);
    if (r.knowledge.basis === 'source' && !r.knowledge.sourceRef) err(file, 'knowledge.basis "source" requires knowledge.sourceRef');
    for (const c of r.capabilities) if (!capIds.has(c)) err(file, `unknown capability "${c}"`);
    for (const p of r.physicalAi) if (!paiIds.has(p)) err(file, `unknown Physical AI category "${p}"`);
    if (r.physicalAi.length && src.physicalAi._status === 'proposed') err(file, 'Physical AI categories are still proposed: no assignments allowed');
    if (r.physicalAi.length) {
      // Assignment needs documentation from the resource itself that describes the capability.
      if (!r.classificationBasis.physicalAi) err(file, 'physicalAi assignments need classificationBasis.physicalAi');
      const strong = new Set(['official-documentation', 'published-specification', 'publisher-repository', 'peer-reviewed']);
      if (!r.verification.sources.some((s) => strong.has(s.type) && s.supports.includes('capability'))) err(file, 'physicalAi assignments need a publisher, specification or peer-reviewed source supporting "capability"');
    }
    for (const s of r.verification.sources) if (!evidenceIds.has(s.type)) err(file, `unknown source type "${s.type}" for ${s.url}`);
    if (r.license.commercialReuse !== 'unknown' && r.license.reviewStatus !== 'reviewed') err(file, 'commercialReuse may only be stated after a licence review');
    if (r.license.access === 'unknown' && r.license.commercialReuse !== 'unknown') err(file, 'unknown licence access implies unknown commercial reuse');
    for (const l of r.limitations) if (l.basis === 'source' && !l.sourceRef) err(file, 'limitations with basis "source" need a sourceRef');
    // Schema v3.1: family-specific requirements and scoped licences.
    const family = familyOf[r.resourceType];
    if (family === 'semantic' && !r.layer) err(file, 'semantic resources need a layer');
    if (family !== 'semantic' && !r.licenses?.length) err(file, 'non-semantic resources need at least one scoped licence in `licenses`');
    if (r.resourceType === 'ai-model' && !r.details?.aiModel) err(file, 'AI models need details.aiModel (architecture vs trained model, weights published)');
    if (kindToType[r.kind] !== r.resourceType) err(file, `kind "${r.kind}" implies resourceType "${kindToType[r.kind]}", not "${r.resourceType}"`);
    for (const l of r.licenses || []) {
      if (l.commercialUse !== 'unknown' && l.reviewStatus !== 'reviewed') err(file, `licenses[${l.scope}]: commercialUse may only be stated after a review`);
      if (l.commercialUse === 'permitted' && !l.spdx) err(file, `licenses[${l.scope}]: "permitted" requires an identified (SPDX) licence`);
    }
  }

  for (const [n, rel] of src.relations.items.entries()) {
    const where = `relations[${n}] ${rel.source}->${rel.target}`;
    if (!ids.has(rel.source)) err(where, `unknown source "${rel.source}"`);
    if (!ids.has(rel.target)) err(where, `unknown target "${rel.target}"`);
    if (!relationTypes.has(rel.type)) err(where, `unknown type "${rel.type}"`);
    if (!rel.evidence || !/^https?:\/\//.test(rel.evidence.url || '')) err(where, 'evidence.url is required');
    if (!evidenceIds.has(rel.evidence?.type)) err(where, 'evidence.type must be a known evidence type');
    if (['editorial', 'unclassified', 'third-party'].includes(rel.evidence?.type)) err(where, `evidence of type "${rel.evidence?.type}" cannot establish a stored relationship`);
    if (!['verified', 'partially-verified'].includes(rel.status)) err(where, 'status must be verified or partially-verified');
    if (rel.status === 'partially-verified' && !rel.conditions) err(where, 'partially-verified relations must state their conditions');
    if (rel.source === rel.target) err(where, 'self-relation');
  }

  for (const uc of src.useCases) {
    for (const layer of uc.stack) for (const o of layer.ontologies) if (!ids.has(o)) err(`use case ${uc.id}`, `unknown ontology "${o}"`);
    for (const i of uc.industries) if (!industryIds.has(i)) err(`use case ${uc.id}`, `unknown industry "${i}"`);
  }

  // Curated engineering questions resolve to ordinary filters over existing taxonomy ids.
  const questionIds = new Set();
  for (const q of src.questions.items) {
    if (questionIds.has(q.id)) err(`question ${q.id}`, 'duplicate id');
    questionIds.add(q.id);
    const known = { capability: capIds, industry: industryIds, useCase: useCaseIds, type: typeIds, domain: subDomains };
    for (const [k, vs] of Object.entries(q.filters)) {
      if (!known[k]) { err(`question ${q.id}`, `unsupported filter "${k}"`); continue; }
      for (const v of vs) if (!known[k].has(v)) err(`question ${q.id}`, `unknown ${k} "${v}"`);
    }
  }

  // Every v1 record must survive the migration, unchanged.
  const byLegacyName = new Map(src.ontologies.filter((o) => o.record.legacy).map((o) => [o.record.legacy.name, o.record]));
  for (const rec of src.legacy) {
    const migrated = byLegacyName.get(rec.name);
    if (!migrated) { err('legacy', `v1 record "${rec.name}" is missing`); continue; }
    if (JSON.stringify(migrated.legacy) !== JSON.stringify(rec)) err('legacy', `v1 record "${rec.name}" legacy block differs from the snapshot`);
  }

  for (const hit of findForbidden(src)) err(hit.where, `forbidden internal reference "${hit.match}"`);
  return errors;
}

export function findForbidden(src) {
  const hits = [];
  const scan = (where, value) => {
    const text = JSON.stringify(value);
    for (const re of FORBIDDEN_PATTERNS) {
      const m = text.match(re);
      if (m) hits.push({ where, match: m[0] });
    }
  };
  for (const { file, record } of src.ontologies) scan(file, record);
  scan('data/taxonomy/industries.json', src.industries);
  scan('data/taxonomy/use-cases.json', src.useCases);
  scan('data/taxonomy/relations.json', src.relations);
  scan('data/legacy/catalog-v1.json', src.legacy);
  scan('data/taxonomy/questions.json', src.questions);
  for (const k of ['resourceTypes', 'knowledgeDomains', 'capabilities', 'physicalAi', 'evidenceTypes']) scan(`taxonomy ${k}`, src[k]);
  return hits;
}

export function buildBundle(src, { generatedOn }) {
  const resources = src.ontologies.map((o) => o.record).sort((a, b) => a.name.localeCompare(b.name));
  const defaultFamily = src.resourceTypes.families.find((f) => f.default).id;
  const familyOf = Object.fromEntries(src.resourceTypes.items.map((t) => [t.id, t.family]));
  // `ontologies` stays as a backward-compatible alias: the default (semantic) family.
  const ontologies = resources.filter((r) => familyOf[r.resourceType] === defaultFamily);
  const byType = resources.reduce((m, r) => ((m[r.resourceType] = (m[r.resourceType] || 0) + 1), m), {});
  return {
    meta: {
      title: 'Reference Ontology Atlas',
      version: '3.0.0',
      schema: 'v3',
      generatedOn,
      site: SITE_URL,
      counts: {
        resources: resources.length,
        ontologies: ontologies.length,
        byResourceType: byType,
        relations: src.relations.items.length,
        industries: src.industries.length,
        useCases: src.useCases.length,
        legacyRecords: src.legacy.length,
      },
      disclaimer: 'Public information only. Every fact is backed by a cited public source; verification status and date are shown on each record.',
    },
    resources,
    ontologies,
    resourceFamilies: src.resourceTypes.families,
    resourceTypes: src.resourceTypes.items,
    knowledgeDomains: src.knowledgeDomains.items,
    capabilities: src.capabilities.items,
    physicalAi: { status: src.physicalAi._status, items: src.physicalAi.items },
    evidenceTypes: src.evidenceTypes.items,
    questions: src.questions.items,
    industries: src.industries,
    useCases: src.useCases,
    relationCategories: src.relations.categories,
    relationTypes: src.relations.types,
    relations: src.relations.items,
  };
}

const ACCESS_TO_V1 = { open: 'open', 'open-with-terms': 'open', licensed: 'licensed', unknown: 'restricted' };

// Backwards-compatible export in the v1 JSON shape (internal wiki links removed).
export function toLegacyJson(bundle) {
  const ucName = Object.fromEntries(bundle.useCases.map((u) => [u.id, u.legacyEndObject || u.name]));
  const indName = Object.fromEntries(bundle.industries.map((i) => [i.id, i.name]));
  return bundle.ontologies.map((o) => ({
    id: o.id,
    name: o.name,
    category: o.legacy?.category || indName[o.industries[0]],
    publisher: o.publisher,
    official: o.links.official || '',
    endObjects: o.legacy?.endObjects || o.useCases.map((u) => ucName[u]),
    imds: o.legacy?.imds || o.topics,
    description: o.summary,
    parentOntology: o.legacy?.parentOntology || '',
    stabilityStatus: ['standard', 'stable'].includes(o.maturity) ? 'stable' : 'not stable',
    usageStatus: ACCESS_TO_V1[o.license.access],
    version: o.version.label,
    license: o.license.name,
    atlasUrl: `${SITE_URL}#/ontology/${o.id}`,
  }));
}

const lit = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
const iri = (u) => `<${u}>`;
const local = (id) => `atlas:${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;

export function toTurtle(bundle) {
  const out = [];
  out.push(`@prefix atlas: <${NS}> .`);
  out.push('@prefix dcterms: <http://purl.org/dc/terms/> .');
  out.push('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
  out.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  out.push('@prefix owl: <http://www.w3.org/2002/07/owl#> .');
  out.push('@prefix skos: <http://www.w3.org/2004/02/skos/core#> .');
  out.push('');
  out.push(`# Reference Ontology Atlas — generated ${bundle.meta.generatedOn}. Do not edit by hand; run \`npm run build\`.`);
  out.push(`# ${bundle.meta.disclaimer}`);
  out.push('');
  out.push('atlas:ReferenceOntology a rdfs:Class ; rdfs:label "Reference ontology" .');
  out.push('atlas:Industry a rdfs:Class ; rdfs:label "Industry" .');
  out.push('atlas:UseCase a rdfs:Class ; rdfs:label "Engineering use case" .');
  for (const p of ['resourceType', 'knowledgeDomain', 'capability', 'licenseReviewStatus', 'publisher', 'officialSource', 'namespaceIri', 'versionLabel', 'licenseName', 'licenseAccess', 'maturity', 'layer', 'kind', 'industry', 'useCase', 'verificationStatus', 'topic']) {
    out.push(`atlas:${p} a rdf:Property .`);
  }
  for (const t of bundle.relationTypes) out.push(`atlas:${t.id.replace(/-/g, '_')} a owl:ObjectProperty ; rdfs:label ${lit(t.label)} ; rdfs:comment ${lit(t.description)} .`);
  out.push('');
  for (const i of bundle.industries) out.push(`${local('industry-' + i.id)} a atlas:Industry ; skos:prefLabel ${lit(i.name)} ; dcterms:description ${lit(i.summary)} .`);
  for (const u of bundle.useCases) out.push(`${local('usecase-' + u.id)} a atlas:UseCase ; skos:prefLabel ${lit(u.name)} ; dcterms:description ${lit(u.summary)} .`);
  out.push('');
  for (const o of bundle.resources) {
    const t = [`${local(o.id)} a atlas:ReferenceOntology`];
    t.push(`dcterms:title ${lit(o.name)}`);
    t.push(`skos:altLabel ${lit(o.fullName)}`);
    t.push(`dcterms:description ${lit(o.summary)}`);
    t.push(`atlas:publisher ${lit(o.publisher)}`);
    if (o.links.official) t.push(`atlas:officialSource ${iri(o.links.official)}`);
    if (o.links.namespace) t.push(`atlas:namespaceIri ${iri(o.links.namespace)}`);
    t.push(`atlas:versionLabel ${lit(o.version.label)}`);
    t.push(`atlas:licenseName ${lit(o.license.name)}`);
    t.push(`atlas:licenseAccess ${lit(o.license.access)}`);
    t.push(`atlas:maturity ${lit(o.maturity)}`);
    t.push(`atlas:layer ${lit(o.layer)}`);
    t.push(`atlas:kind ${lit(o.kind)}`);
    t.push(`atlas:verificationStatus ${lit(o.verification.status)}`);
    t.push(`atlas:resourceType ${lit(o.resourceType)}`);
    t.push(`atlas:knowledgeDomain ${lit(o.knowledge.domain)}`);
    for (const c of o.capabilities) t.push(`atlas:capability ${lit(c)}`);
    t.push(`atlas:licenseReviewStatus ${lit(o.license.reviewStatus)}`);
    for (const topic of o.topics) t.push(`atlas:topic ${lit(topic)}`);
    for (const i of o.industries) t.push(`atlas:industry ${local('industry-' + i)}`);
    for (const u of o.useCases) t.push(`atlas:useCase ${local('usecase-' + u)}`);
    t.push(`rdfs:seeAlso ${iri(`${SITE_URL}#/ontology/${o.id}`)}`);
    out.push(t.join(' ;\n    ') + ' .');
    out.push('');
  }
  for (const r of bundle.relations) out.push(`${local(r.source)} atlas:${r.type.replace(/-/g, '_')} ${local(r.target)} .`);
  return out.join('\n') + '\n';
}
