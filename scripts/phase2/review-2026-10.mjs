#!/usr/bin/env node
// Checkpoint 1 data-quality review (2026-10-16). Applies reviewed decisions to records and writes the audit report
// docs/DATA-QUALITY-REVIEW-2026-10.md. Idempotent: re-running produces the same records and report.
//   node scripts/phase2/review-2026-10.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROPOSED } from './proposed-mapping.mjs';
import { sourceTypeFor } from './rules.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DATE = '2026-10-16';
const dir = join(ROOT, 'data/ontologies');

// ---------- B1: knowledge-domain review of the 13 tentative rows ----------
// decision: retain | revise. `confidence` stays tentative where a single primary domain is a real simplification.
export const REVIEW_B1 = {
  bot: { decision: 'retain', domain: 'product.structure', confidence: 'clear', why: 'Tentative because BOT also locates elements in spaces.', rationale: 'BOT models the topological decomposition of buildings (sites, buildings, storeys, spaces, elements): the structure of built assets (BOT specification).' },
  'dmtf-cim': { decision: 'revise', domain: 'product.catalogues', confidence: 'tentative', why: 'Operational data was chosen because CIM also defines metrics and events.', rationale: 'DMTF CIM primarily describes managed IT elements and their configuration (systems, chassis, devices), which is asset information. It also covers metrics and events, so the classification stays tentative.' },
  'gs1-webvoc': { decision: 'retain', domain: 'product.catalogues', confidence: 'clear', why: 'Could also be read as commerce or supply chain.', rationale: 'The GS1 Web Vocabulary describes product master data and identifiers (GTIN, dimensions, composition), which is product information. Commerce use comes through schema.org.' },
  'iec-cim': { decision: 'retain', domain: 'product.structure', confidence: 'tentative', why: 'The IEC CIM spans network models, measurements and market data.', rationale: 'IEC 61970-301 models the topology and equipment of power systems. Measurements and market profiles (IEC 62325) also exist, so a single primary domain is a simplification.' },
  'ieee-rtr': { decision: 'retain', domain: 'product.behaviour', confidence: 'clear', why: 'Tasks could be read as business processes.', rationale: 'IEEE 1872.1 represents robot tasks and their hierarchical decomposition: behaviour of a technical system, not organisational processes.' },
  'iso-15926-14': { decision: 'retain', domain: 'product.catalogues', confidence: 'tentative', why: 'Lifecycle data spans structure and asset information.', rationale: 'ISO 15926-14 integrates process-plant lifecycle data. The standard text (sold by ISO) has not been reviewed, so the classification stays tentative.' },
  oeo: { decision: 'retain', domain: 'foundations.science', confidence: 'tentative', why: 'No sub-domain covers energy-system modelling specifically.', rationale: 'The OEO describes energy-system models, scenarios and technologies used in research. "Scientific methods & research data" is the closest fit; a dedicated energy domain does not exist.' },
  oriont: { decision: 'retain', domain: 'foundations.sustainability', confidence: 'tentative', why: 'The resource itself is unverified.', rationale: 'Only the ORIENTING project description is public. The classification follows the stated LCSA scope and cannot be confirmed.' },
  saref4bldg: { decision: 'retain', domain: 'product.structure', confidence: 'clear', why: 'Devices could suggest interfaces.', rationale: 'ETSI states SAREF4BLDG is based on IFC and describes building devices as elements within spaces: structure of the built asset.' },
  saref4city: { decision: 'retain', domain: 'product.operations', confidence: 'tentative', why: 'Spans IoT data, administrative areas and KPIs.', rationale: 'SAREF4CITY covers city objects, administrative areas, public services and KPIs for IoT data. Operational data is the main use, but geographic and administrative concepts are also central.' },
  saref4ener: { decision: 'retain', domain: 'product.interfaces', confidence: 'clear', why: 'Energy could suggest operations.', rationale: 'SAREF4ENER specifies the exchange of power profiles and flexibility between devices and energy managers, which is an interface between systems.' },
  'schema-org': { decision: 'revise', domain: 'foundations.metadata', confidence: 'clear', why: 'Commerce was chosen because of the GoodRelations heritage.', rationale: 'Schema.org is a general-purpose vocabulary for describing things on the web. Commerce is one part of it, so metadata and cataloguing is the better primary domain.' },
  vsso: { decision: 'retain', domain: 'product.operations', confidence: 'clear', why: 'Could be read as interfaces.', rationale: 'VSSo models vehicle signals as observable and actuatable properties following SOSA/SSN: operational data of a vehicle.' },
};

// ---------- B2: source review (type = provenance of the document; supports = which claims it is cited for) ----------
const S = (type, supports, note = '') => ({ type, supports, note });
export const REVIEW_B2 = {
  'https://industrialdigitaltwin.org/wp-content/uploads/2025/08/IDTA-01001-3-1-1_AAS-Specification_Part1_Metamodel.pdf': S('published-specification', ['identity', 'version', 'scope']),
  'https://industrialdigitaltwin.org/en/content-hub/aasspecifications': S('official-documentation', ['identity', 'licence', 'version']),
  'https://standards.ieee.org/ieee/1872.2/7094/': S('published-specification', ['identity', 'version', 'status', 'licence']),
  'https://github.com/BFO-ontology/BFO-2020': S('publisher-repository', ['licence', 'version']),
  'https://webstore.iec.ch/en/publication/72703': S('published-specification', ['identity', 'version'], 'ISO/IEC catalogue entry (IEC webstore).'),
  'https://w3c-lbd-cg.github.io/bot/': S('official-documentation', ['identity', 'version', 'status'], 'Community Group report, not a W3C standard.'),
  'https://github.com/BrickSchema/Brick/releases': S('publisher-repository', ['version']),
  'https://brickschema.org/': S('official-documentation', ['identity', 'scope', 'licence']),
  'https://github.com/CommonCoreOntology/CommonCoreOntologies': S('publisher-repository', ['identity', 'licence', 'version', 'relationship', 'limitation']),
  'https://standards.ieee.org/standard/1872-2015.html': S('published-specification', ['identity', 'status', 'licence']),
  'https://github.com/srfiorini/IEEE1872-owl': S('third-party', ['licence', 'limitation'], 'Community OWL conversion by researchers involved in IEEE 1872; not an IEEE publication.'),
  'https://standards.ieee.org/ieee/1872/12250': S('official-documentation', ['status']),
  'https://www.w3.org/TR/vocab-dcat-3/': S('published-specification', ['identity', 'version', 'status']),
  'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/': S('published-specification', ['identity', 'version', 'licence']),
  'https://ifx-dr.github.io/DigitalReference/': S('official-documentation', ['identity', 'scope']),
  'https://www.informs-sim.org/wsc25papers/con142.pdf': S('peer-reviewed', ['scope'], 'Winter Simulation Conference proceedings.'),
  'https://dmtf.org/node/3585': S('official-documentation', ['version']),
  'https://www.dmtf.org/sites/default/files/cim/cim_schema_v2541/releasenotes.html': S('official-documentation', ['version']),
  'https://eclass.eu/shop/en/product/eclass-15-0': S('official-documentation', ['version', 'licence']),
  'https://eclass.eu/shop/en/product/eclass-16-0': S('official-documentation', ['version', 'licence']),
  'https://eclass.eu/en/news/news/first-eclass-as-rdf-specification': S('official-documentation', ['scope']),
  'https://op.europa.eu/en/web/eu-vocabularies/eli': S('official-documentation', ['identity', 'scope', 'licence']),
  'https://interoperable-europe.ec.europa.eu/collection/eli-european-legislation-identifier/solution/eli-ontology/releases': S('official-documentation', ['version'], 'European Commission release listing.'),
  'https://github.com/emmo-repo/EMMO': S('publisher-repository', ['identity', 'licence', 'limitation']),
  'https://zenodo.org/records/8318236': S('publisher-repository', ['version']),
  'https://www.ogc.org/standard/geosparql/': S('published-specification', ['identity', 'version', 'status']),
  'https://lists.w3.org/Archives/Public/public-sdw-wg/2024Feb/0000.html': S('third-party', ['version'], 'Mailing-list announcement; the OGC page is authoritative.'),
  'http://www.heppnetz.de/projects/goodrelations/': S('official-documentation', ['identity', 'licence']),
  'https://blog.schema.org/2012/11/08/good-relations-and-schema-org/': S('official-documentation', ['status', 'relationship']),
  'https://ref.gs1.org/voc/': S('official-documentation', ['identity', 'scope', 'relationship']),
  'https://ref.gs1.org/voc/data/archive': S('official-documentation', ['version']),
  'https://github.com/gs1/WebVoc': S('publisher-repository', ['licence']),
  'https://connect.snv.ch/en/iec-61970-301-2013-ed4': S('third-party', ['version'], 'National standards body listing.'),
  'https://webstore.iec.ch/en/publication/6215': S('published-specification', ['identity', 'licence']),
  'https://technical.buildingsmart.org/standards/ifc/ifc-formats/ifcowl/': S('official-documentation', ['identity', 'status', 'limitation']),
  'https://technical.buildingsmart.org/standards/ifc/ifc-schema-specifications/': S('official-documentation', ['scope']),
  'https://spec.industrialontologies.org/portal/release/202603/core.html': S('published-specification', ['identity', 'version', 'licence']),
  'https://spec.industrialontologies.org/portal/release/202401/core/CoreOntology.html': S('published-specification', ['version', 'relationship']),
  'https://knowledge.bsigroup.com/products/industrial-automation-systems-and-integration-integration-of-life-cycle-data-for-process-plants-including-oil-and-gas-production-facilities-implementation-methods-for-the-integration-of-distributed-systems-web-ontology-language-owl-1': S('third-party', ['identity', 'scope'], 'BSI shop listing of the ISO document.'),
  'https://15926.org/': S('third-party', ['scope'], 'Community site; not an ISO publication.'),
  'https://obi-ontology.org/': S('official-documentation', ['identity', 'scope']),
  'https://github.com/obi-ontology/obi': S('publisher-repository', ['licence']),
  'https://openenergyplatform.org/ontology/': S('official-documentation', ['identity', 'version']),
  'https://github.com/OpenEnergyPlatform/ontology': S('publisher-repository', ['licence', 'relationship']),
  'https://cordis.europa.eu/project/id/958231': S('project-documentation', ['scope'], 'Describes the ORIENTING project, not an ontology.'),
  'https://www.w3.org/TR/owl-time/': S('published-specification', ['identity', 'version', 'status']),
  'https://www.w3.org/TR/prov-o/': S('published-specification', ['identity', 'version', 'status']),
  'https://qudt.org/': S('official-documentation', ['identity', 'licence']),
  'https://qudt.org/doc/2026/01/DOC_VOCAB-CONSTANTS.html': S('official-documentation', ['version'], 'Superseded for the schema version by the schema file itself.'),
  'https://qudt.org/schema/qudt/': S('publisher-repository', ['version'], 'The published schema file.'),
  'https://standards.ieee.org/ieee/1872.1/6993/': S('published-specification', ['identity', 'version', 'status', 'licence']),
  'https://saref.etsi.org/core/': S('published-specification', ['identity', 'version', 'licence']),
  'https://saref.etsi.org/saref4auto/': S('published-specification', ['identity', 'version', 'licence']),
  'https://saref.etsi.org/saref4bldg/': S('published-specification', ['identity', 'version', 'licence']),
  'https://saref.etsi.org/saref4city/': S('published-specification', ['identity', 'version', 'licence']),
  'https://saref.etsi.org/saref4ener/': S('published-specification', ['identity', 'version', 'licence']),
  'https://saref.etsi.org/saref4inma/': S('published-specification', ['identity', 'version', 'licence']),
  'https://schema.org/docs/terms.html': S('official-documentation', ['licence']),
  'https://www.w3.org/TR/skos-reference/': S('published-specification', ['identity', 'version', 'status']),
  'https://www.w3.org/TR/vocab-ssn/': S('published-specification', ['identity', 'version', 'status']),
  'https://www.evs.ee/en/iso-10303-242-2025': S('third-party', ['identity', 'version'], 'Estonian standards body shop listing.'),
  'https://online.standard.no/en/iso-10303-242-2025': S('third-party', ['version'], 'Norwegian standards body shop listing.'),
  'https://www.ontologyportal.org/': S('official-documentation', ['identity', 'licence']),
  'https://raw.githubusercontent.com/ontologyportal/sumo/master/Merge.kif': S('publisher-repository', ['licence']),
  'https://github.com/Systems-Modeling/SysML-v2-Release': S('publisher-repository', ['version', 'status']),
  'https://www.omg.org/sysml/sst_aiaa_award.htm': S('official-documentation', ['status']),
  'https://www.w3.org/TR/vsso-core/': S('published-specification', ['identity', 'status', 'limitation']),
};

// ---------- B3: limitations (only where supported or where a catalogue gap is known) ----------
const L = (category, text, basis, sourceRef) => ({ text, basis, category, ...(sourceRef ? { sourceRef } : {}) });
const IEEE_TEXT = (url) => L('access', 'The normative text is sold by IEEE; only catalogue information is publicly available.', 'source', url);
export const REVIEW_B3 = {
  ifcowl: [L('scope', 'The ifcOWL authors advise against production use and point semantic-web users to bSDD.', 'source', 'https://technical.buildingsmart.org/standards/ifc/ifc-formats/ifcowl/'),
    L('catalogue-gap', 'The former IFC4 ADD2 ontology page no longer resolves; the licence statement could not be re-checked.', 'editorial')],
  vsso: [L('status', 'Published as a W3C Discontinued Draft: not maintained.', 'source', 'https://www.w3.org/TR/vsso-core/')],
  goodrelations: [L('status', 'Integrated into schema.org in 2012; new work should use schema.org.', 'source', 'https://blog.schema.org/2012/11/08/good-relations-and-schema-org/')],
  sosa: [L('technical', 'Uses schema:domainIncludes / rangeIncludes instead of rdfs:domain / rdfs:range, so domains and ranges are non-binding.', 'source', 'https://www.w3.org/ns/sosa/')],
  'ieee-cora': [IEEE_TEXT('https://standards.ieee.org/standard/1872-2015.html'),
    L('technical', 'The public OWL conversion is under-specified relative to the SUO-KIF axioms and allows models not consistent with IEEE 1872.', 'source', 'https://github.com/srfiorini/IEEE1872-owl')],
  'ieee-corax': [IEEE_TEXT('https://standards.ieee.org/standard/1872-2015.html')],
  'ieee-pos': [IEEE_TEXT('https://standards.ieee.org/standard/1872-2015.html')],
  'ieee-rparts': [IEEE_TEXT('https://standards.ieee.org/standard/1872-2015.html')],
  'sumo-cora': [IEEE_TEXT('https://standards.ieee.org/standard/1872-2015.html'), L('catalogue-gap', 'Not confirmed as a separately published artefact.', 'editorial')],
  'ieee-rtr': [IEEE_TEXT('https://standards.ieee.org/ieee/1872.1/6993/')],
  'ieee-aur': [IEEE_TEXT('https://standards.ieee.org/ieee/1872.2/7094/'), L('catalogue-gap', 'Public availability of the OWL files under the IEEE SA open-source programme is not yet confirmed.', 'editorial')],
  'step-ap242': [L('scope', 'An EXPRESS information model, not an RDF/OWL ontology: using it requires STEP tooling.', 'source', 'https://www.evs.ee/en/iso-10303-242-2025'),
    L('catalogue-gap', 'Only national-standards-body listings are cited; the ISO catalogue page blocks automated checks.', 'editorial')],
  'dmtf-cim': [L('scope', 'A MOF/UML information model for IT management, not an RDF/OWL ontology.', 'source', 'https://www.dmtf.org/sites/default/files/cim/cim_schema_v2541/releasenotes.html')],
  'sysml-v2': [L('scope', 'A modelling language with its own notation and API, not an RDF/OWL ontology.', 'source', 'https://github.com/Systems-Modeling/SysML-v2-Release')],
  'iso-15926-14': [L('access', 'ISO technical specification sold by ISO.', 'source', 'https://knowledge.bsigroup.com/products/industrial-automation-systems-and-integration-integration-of-life-cycle-data-for-process-plants-including-oil-and-gas-production-facilities-implementation-methods-for-the-integration-of-distributed-systems-web-ontology-language-owl-1'),
    L('catalogue-gap', 'Only third-party listings are cited, and the publication year is not confirmed.', 'editorial')],
  'iec-cim': [L('access', 'IEC standard sold by IEC.', 'source', 'https://webstore.iec.ch/en/publication/6215'), L('catalogue-gap', 'The current ENTSO-E CGMES profile version has not been confirmed.', 'editorial')],
  eclass: [L('access', 'All ECLASS releases, including the RDF serialisation, require a commercial licence.', 'source', 'https://eclass.eu/shop/en/product/eclass-16-0')],
  cco: [L('status', 'Under restructuring: version 3.0 is planned by 31 December 2026 and 4.0 by 30 June 2027, and maintainers recommend waiting for 4.0 before updating.', 'source', 'https://github.com/CommonCoreOntology/CommonCoreOntologies')],
  emmo: [L('status', 'Modules below the reference level (discipline and domain levels) continue to evolve after 1.0.0.', 'source', 'https://github.com/emmo-repo/EMMO')],
  'owl-time': [L('status', 'The current document is a W3C Candidate Recommendation Draft (2022) revising the 2017 Recommendation.', 'source', 'https://www.w3.org/TR/owl-time/')],
  oriont: [L('catalogue-gap', 'No public ontology named ORIONT was found; only the ORIENTING project description is cited.', 'editorial')],
  'digital-reference': [L('catalogue-gap', 'The licence of the ontology files has not been confirmed.', 'editorial')],
  obi: [L('catalogue-gap', 'The current release version is not stated on the website or repository front page.', 'editorial')],
  qudt: [L('catalogue-gap', 'The release date of schema 3.5.2 is not stated in the schema file.', 'editorial')],
  bot: [L('catalogue-gap', 'No licence statement on the specification page.', 'editorial')],
};
// `status` is not a limitation category; map it to scope (applicability over time).
for (const list of Object.values(REVIEW_B3)) for (const l of list) if (l.category === 'status') l.category = 'scope';

// ---------- B4: editorial engineering-use corrections ----------
export const REVIEW_B4 = {
  'iec-cim': {
    from: 'Exchanging power-grid models between transmission and distribution operators (e.g. CGMES)',
    to: 'Exchanging power-grid models between transmission system operators (e.g. the ENTSO-E CGMES profiles)',
    why: 'CGMES is the profile used for model exchange among transmission system operators; the original wording overstated its scope.',
  },
};

// ---------- scoped licences (A2) where the scope distinction matters for existing records ----------
export const REVIEW_LICENSES = {
  'ieee-cora': [
    { scope: 'specification', name: 'IEEE standard text (purchase required)', url: null, statedAt: 'https://standards.ieee.org/standard/1872-2015.html', commercialUse: 'unknown', reviewStatus: 'not-assessed' },
    { scope: 'model-files', name: 'CC BY 4.0 (community OWL conversion)', spdx: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', statedAt: 'https://github.com/srfiorini/IEEE1872-owl', commercialUse: 'unknown', reviewStatus: 'not-assessed', reviewNote: 'Covers the conversion published by its authors, not the IEEE text.' },
  ],
  sumo: [
    { scope: 'model-files', name: 'IEEE licence stated in the source files', url: null, statedAt: 'https://raw.githubusercontent.com/ontologyportal/sumo/master/Merge.kif', commercialUse: 'unknown', reviewStatus: 'not-assessed' },
    { scope: 'model-files', name: 'GNU GPL (SUMO extensions, as stated by the publisher)', url: null, statedAt: 'https://www.ontologyportal.org/', commercialUse: 'unknown', reviewStatus: 'not-assessed', reviewNote: 'Applies to ontologies extending SUMO, not to the core.' },
  ],
  'iec-cim': [
    { scope: 'specification', name: 'IEC standard text (purchase required)', url: null, statedAt: 'https://webstore.iec.ch/en/publication/6215', commercialUse: 'unknown', reviewStatus: 'not-assessed' },
  ],
};

// ---------- apply ----------
function apply(r) {
  const log = [];
  const k = { ...r.knowledge };
  const b1 = REVIEW_B1[r.id];
  if (b1) {
    if (k.domain !== b1.domain) log.push(`knowledge.domain ${k.domain} → ${b1.domain}`);
    k.domain = b1.domain; k.confidence = b1.confidence; k.rationale = b1.rationale;
  } else {
    k.confidence = k.confidence || (PROPOSED[r.id]?.fit === 'tentative' ? 'tentative' : 'clear');
  }
  // keep key order: domain, basis, confidence, rationale
  r.knowledge = { domain: k.domain, basis: k.basis, confidence: k.confidence, ...(k.rationale ? { rationale: k.rationale } : {}) };
  r.verification.sources = r.verification.sources.map((s) => {
    const rev = REVIEW_B2[s.url];
    if (!rev) throw new Error(`${r.id}: no source review for ${s.url}`);
    if (s.type !== rev.type) log.push(`source type ${s.type} → ${rev.type}: ${s.url}`);
    return { url: s.url, title: s.title, type: rev.type, supports: rev.supports };
  });
  if (REVIEW_B3[r.id]) r.limitations = REVIEW_B3[r.id];
  const b4 = REVIEW_B4[r.id];
  if (b4 && r.engineeringUses) r.engineeringUses = r.engineeringUses.map((u) => (u === b4.from ? b4.to : u));
  if (REVIEW_LICENSES[r.id]) r.licenses = REVIEW_LICENSES[r.id];
  r.editorialReview = { reviewedOn: DATE, reviewer: 'atlas-editors' };
  return log;
}

// Executed only when run directly, so tests can import the decision tables without side effects.
function main() {
  const changes = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const p = join(dir, f);
    const r = JSON.parse(readFileSync(p, 'utf8'));
    changes[r.id] = apply(r);
    // insert `licenses` right after `license` for readability
    const out = {};
    for (const [key, v] of Object.entries(r)) { if (key === 'licenses') continue; out[key] = v; if (key === 'license' && r.licenses) out.licenses = r.licenses; }
    writeFileSync(p, JSON.stringify(out, null, 2) + '\n');
  }

  // ---------- D1 groundwork: relations carry evidence type, verification status and conditions ----------
  const REL_PARTIAL = {
    'aas|eclass': 'The AAS metamodel allows semantic IDs from any dictionary; ECLASS IRDIs are a common choice, not a requirement.',
    'saref4bldg|ifcowl': 'SAREF4BLDG is derived from the IFC standard; the relation to the ifcOWL serialisation is indirect.',
  };
  const relPath = join(ROOT, 'data/taxonomy/relations.json');
  const rels = JSON.parse(readFileSync(relPath, 'utf8'));
  rels.items = rels.items.map((r) => {
    const known = REVIEW_B2[r.evidence.url];
    const type = r.evidence.type || known?.type || (r.evidence.url.startsWith('https://saref.etsi.org/') ? 'published-specification' : 'official-documentation');
    const partial = REL_PARTIAL[`${r.source}|${r.target}`];
    return {
      source: r.source, target: r.target, type: r.type,
      evidence: { url: r.evidence.url, type, note: r.evidence.note },
      status: r.status || (partial ? 'partially-verified' : 'verified'),
      ...(partial || r.conditions ? { conditions: r.conditions || partial } : {}),
    };
  });
  writeFileSync(relPath, JSON.stringify(rels, null, 2) + '\n');

  // ---------- report ----------
  const urls = Object.entries(REVIEW_B2);
  const byType = urls.reduce((m, [, v]) => ((m[v.type] = (m[v.type] || 0) + 1), m), {});
  const lines = [];
  lines.push('# Data-quality review, October 2026 (Checkpoint 1)', '');
  lines.push(`Generated by \`scripts/phase2/review-2026-10.mjs\` on ${DATE}. Re-running it is idempotent. All classification decisions stay **editorial**.`, '');
  lines.push('## B1. Tentative knowledge-domain classifications (13 reviewed)', '', '| Record | Why it was tentative | Decision | Domain | Confidence now | Rationale |', '| --- | --- | --- | --- | --- | --- |');
  for (const [id, d] of Object.entries(REVIEW_B1)) lines.push(`| \`${id}\` | ${d.why} | **${d.decision}** | ${d.domain} | ${d.confidence} | ${d.rationale} |`);
  lines.push('', `Result: ${Object.values(REVIEW_B1).filter((d) => d.decision === 'revise').length} revised, ${Object.values(REVIEW_B1).filter((d) => d.decision === 'retain').length} retained, ${Object.values(REVIEW_B1).filter((d) => d.confidence === 'tentative').length} remain tentative. Uncertainty was kept where a single primary domain is a simplification.`, '');
  lines.push(`## B2. Sources (${urls.length} unique URLs, all reviewed)`, '');
  lines.push('Each source now records its **type** (who published the document) and **supports** (the claims it is cited for). A publisher\'s domain was a signal, not proof: catalogue pages of standards bodies are typed *published specification*, publisher GitHub organisations *publisher repository*, and resellers, community conversions and mailing lists *third-party*.', '');
  lines.push(`Types after review: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(' · ')}.`, '');
  lines.push('| Source | Type | Cited for | Note |', '| --- | --- | --- | --- |');
  for (const [u, v] of urls) lines.push(`| ${u.length > 90 ? u.slice(0, 87) + '…' : u} | ${v.type} | ${v.supports.join(', ')} | ${v.note} |`);
  lines.push('', '## B3. Limitations', '', 'Added only where a source supports them or where the gap is in the catalogue itself. Categories: technical, scope, access, unverified-claim, catalogue-gap. A record without limitations shows "none recorded yet", never "none".', '');
  for (const [id, list] of Object.entries(REVIEW_B3)) for (const l of list) lines.push(`- \`${id}\` · ${l.category} · ${l.basis}: ${l.text}`);
  lines.push('', '## B4. Editorial engineering uses', '', 'All 46 records\' uses were re-read for plausibility, readability, specificity and unsupported claims (no integration or certification claims were found). Material corrections:', '');
  for (const [id, c] of Object.entries(REVIEW_B4)) lines.push(`- \`${id}\`: "${c.from}" → "${c.to}". ${c.why}`);
  lines.push('', '## Source types changed from the automated migration rule', '', "The migration typed a source as official documentation only when it was hosted on the official link's host. The review changed these:", '');
  let changed = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const s of r.verification.sources) {
      const auto = sourceTypeFor(r, s.url);
      if (auto !== s.type) { changed++; lines.push(`- \`${r.id}\`: ${auto} → **${s.type}** · ${s.url}`); }
    }
  }
  lines.push('', `${changed} source citations changed type; the others were confirmed.`);
  writeFileSync(join(ROOT, 'docs/DATA-QUALITY-REVIEW-2026-10.md'), lines.join('\n') + '\n');
  console.log(`Reviewed ${Object.keys(changes).length} records; ${Object.values(changes).filter((l) => l.length).length} with type/domain changes.`);

}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
