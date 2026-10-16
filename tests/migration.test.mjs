// Phase 2 (schema v3) migration: backward compatibility, classification and evidence rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources, validate, buildBundle, toLegacyJson } from '../scripts/lib/atlas-data.mjs';
import { PROPOSED } from '../scripts/phase2/proposed-mapping.mjs';
import { REVIEW_B1, REVIEW_B2, REVIEW_B4 } from '../scripts/phase2/review-2026-10.mjs';
import { RECORDS as ECO } from '../scripts/phase2/ecosystem-robotics.mjs';
import { LINK_EXISTING, ECOSYSTEM } from '../scripts/phase2/ecosystem-links.mjs';
import { resourceTypeFor, sourceTypeFor, loadTaxonomies, stripPhase2 } from '../scripts/phase2/rules.mjs';
import { buildIndex, query, applyFilters, facetCounts } from '../assets/js/lib/search.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = loadSources(ROOT);
const tax = loadTaxonomies(ROOT);
const records = src.ontologies.map((o) => o.record);
const byId = new Map(records.map((r) => [r.id, r]));
const preIds = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/pre-phase2-ids.json'), 'utf8')).ids;
const bundle = JSON.parse(readFileSync(join(ROOT, 'data/atlas.json'), 'utf8'));

// Validate a modified copy of the sources; returns the error list.
function validateWith(id, mutate) {
  const ontologies = src.ontologies.map((o) => (o.record.id === id ? { ...o, record: mutate(structuredClone(o.record)) } : o));
  return validate({ ...src, ontologies });
}

// ---------- backward compatibility ----------
test('all 46 pre-migration records remain present, discoverable and in the default family', () => {
  assert.equal(preIds.length, 46);
  const familyOf = Object.fromEntries(bundle.resourceTypes.map((t) => [t.id, t.family]));
  const def = bundle.resourceFamilies.find((f) => f.default).id;
  for (const id of preIds) {
    assert.ok(byId.has(id), `${id} missing`);
    assert.equal(familyOf[byId.get(id).resourceType], def, `${id} would disappear from the default catalogue`);
  }
  // Bundle keeps the `ontologies` alias for old consumers and adds `resources`.
  // `ontologies` stays the default-family alias; `resources` holds everything.
  for (const id of preIds) assert.ok(bundle.ontologies.some((o) => o.id === id), `${id} missing from the ontologies alias`);
  assert.ok(bundle.ontologies.every((o) => familyOf[o.resourceType] === def));
  assert.equal(bundle.resources.length, bundle.ontologies.length + bundle.resources.filter((r) => familyOf[r.resourceType] !== def).length);
  const index = buildIndex(bundle.resources, bundle);
  const shown = query(bundle.resources, index, { family: def, familyOf }).map((r) => r.id);
  for (const id of preIds) assert.ok(shown.includes(id), `default catalogue view must still show ${id}`);
});

test('v1-compatible JSON export keeps its exact shape and records', () => {
  const legacy = toLegacyJson(buildBundle(src, { generatedOn: bundle.meta.generatedOn }));
  assert.equal(legacy.length, bundle.ontologies.length, 'v1-compatible export lists the semantic family');
  for (const id of preIds) assert.ok(legacy.some((r) => r.id === id), id);
  const keys = ['id', 'name', 'category', 'publisher', 'official', 'endObjects', 'imds', 'description', 'parentOntology', 'stabilityStatus', 'usageStatus', 'version', 'license', 'atlasUrl'];
  for (const r of legacy) assert.deepEqual(Object.keys(r), keys);
});

test('migration lost no data: stripping the Phase 2 fields restores the pre-migration records', (t) => {
  const BASE = '8cdbb02';
  try { execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { cwd: ROOT, stdio: 'ignore' }); } catch { t.skip('pre-migration commit not available (shallow clone)'); return; }
  for (const id of preIds) {
    const before = JSON.parse(execFileSync('git', ['show', `${BASE}:data/ontologies/${id}.json`], { cwd: ROOT, encoding: 'utf8' }));
    const now = stripPhase2(byId.get(id));
    // The only permitted content change is a documented editorial correction (REVIEW_B4).
    const b4 = REVIEW_B4[id];
    if (b4) now.engineeringUses = now.engineeringUses.map((u) => (u === b4.to ? b4.from : u));
    // Checkpoint 3 linked selected records to the robot-development ecosystem (documented in ecosystem-links.mjs).
    if (LINK_EXISTING.includes(id)) now.useCases = now.useCases.filter((u) => u !== ECOSYSTEM.id);
    assert.deepEqual(now, before, id);
  }
});

test('migration is idempotent', () => {
  const out = execFileSync(process.execPath, ['scripts/phase2/migrate.mjs', '--dry-run'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /Migrated 0 record\(s\); \d+ already on schema v3/);
});

test('routes: #/resource is canonical and #/ontology stays a permanent alias', () => {
  const app = readFileSync(join(ROOT, 'assets/js/app.js'), 'utf8');
  assert.match(app, /case 'ontology':[^\n]*\n\s*case 'resource': view = viewOntology\(id\)/);
});

// ---------- classification ----------
test('resource types follow the deterministic kind -> type rule', () => {
  for (const r of records) assert.equal(r.resourceType, resourceTypeFor(r.kind, tax.resourceTypes), r.id);
  const pre = records.filter((r) => preIds.includes(r.id)).reduce((m, r) => ((m[r.resourceType] = (m[r.resourceType] || 0) + 1), m), {});
  assert.deepEqual(pre, { 'data-schema': 4, ontology: 34, vocabulary: 7, 'modelling-language': 1 }, 'pre-migration records keep their types');
});

test('knowledge domains and capabilities match the approved editorial mapping', () => {
  for (const r of records.filter((x) => preIds.includes(x.id))) {
    assert.equal(r.knowledge.domain, REVIEW_B1[r.id]?.domain ?? PROPOSED[r.id].domain, `${r.id}: only reviewed decisions may change the approved mapping`);
    assert.equal(r.knowledge.basis, 'editorial', r.id);
    assert.deepEqual(r.capabilities, PROPOSED[r.id].capabilities, r.id);
    assert.deepEqual(r.classificationBasis, { industries: 'editorial', capabilities: 'editorial' }, r.id);
  }
});

test('validation rejects unknown types, domains and capabilities', () => {
  assert.ok(validateWith('sosa', (r) => ({ ...r, resourceType: 'gadget' })).some((e) => e.includes('unknown resourceType')));
  assert.ok(validateWith('sosa', (r) => ({ ...r, knowledge: { domain: 'product.magic', basis: 'editorial', confidence: 'clear' } })).some((e) => e.includes('unknown knowledge sub-domain')));
  assert.ok(validateWith('sosa', (r) => ({ ...r, capabilities: ['teleportation'] })).some((e) => e.includes('unknown capability')));
  assert.ok(validateWith('sosa', (r) => ({ ...r, knowledge: { domain: 'not-assessed', basis: 'editorial', confidence: 'tentative' } })).length === 0, 'not-assessed is allowed');
  assert.ok(validateWith('sosa', (r) => ({ ...r, knowledge: { domain: 'product.operations', basis: 'source', confidence: 'clear' } })).some((e) => e.includes('requires knowledge.sourceRef')));
});

test('no duplicate identifiers across resources', () => {
  const ids = bundle.resources.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

// ---------- evidence & licences ----------
test('every source is attributed, typed by human review and states what it supports', () => {
  const evidenceIds = new Set(tax.evidenceTypes.items.map((x) => x.id));
  for (const r of records) {
    assert.ok(r.verification.sources.length >= 1, r.id);
    for (const s of r.verification.sources) {
      assert.ok(s.url && s.title, `${r.id}: source needs url and title`);
      assert.ok(evidenceIds.has(s.type), `${r.id}: ${s.type}`);
      // Every citation matches the human review (Checkpoint 1); nothing is left unclassified.
      const reviewed = REVIEW_B2[s.url] || ECO.find((e) => e.id === r.id)?.verification.sources.find((x) => x.url === s.url);
      assert.ok(reviewed, `${r.id}: unreviewed source ${s.url}`);
      assert.equal(s.type, reviewed.type, `${r.id}: ${s.url}`);
      assert.deepEqual(s.supports, reviewed.supports, `${r.id}: ${s.url}`);
      assert.notEqual(s.type, 'unclassified', `${r.id}: ${s.url}`);
    }
    assert.match(r.editorialReview.reviewedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!r.editorialReview.reviewer.includes('@'), 'no personal emails');
  }
});

test('Physical AI assignments need a basis and capability evidence from the resource itself', () => {
  for (const r of records.filter((x) => preIds.includes(x.id))) assert.deepEqual(r.physicalAi, [], `${r.id}: no assignment without capability evidence`);
  for (const r of records.filter((x) => x.physicalAi.length)) assert.equal(r.classificationBasis.physicalAi, 'editorial', r.id);
  const errs = validateWith('ieee-cora', (r) => ({ ...r, physicalAi: ['robot-capabilities-control'] }));
  assert.ok(errs.some((e) => e.includes('classificationBasis.physicalAi')));
  assert.ok(errs.some((e) => e.includes('supporting "capability"')));
});

test('unknown licences are handled cautiously; no commercial-reuse claim without review', () => {
  for (const r of records) {
    assert.equal(r.license.reviewStatus, 'not-assessed', r.id);
    assert.equal(r.license.commercialReuse, 'unknown', r.id);
  }
  assert.ok(validateWith('qudt', (r) => ({ ...r, license: { ...r.license, commercialReuse: 'permitted' } })).some((e) => e.includes('only be stated after a licence review')));
  assert.ok(validateWith('oriont', (r) => ({ ...r, license: { ...r.license, reviewStatus: 'reviewed', commercialReuse: 'permitted' } })).some((e) => e.includes('unknown licence access')));
});

test('limitations with a source basis need a source reference', () => {
  assert.ok(validateWith('sosa', (r) => ({ ...r, limitations: [{ text: 'Soft domains only (schema:domainIncludes).', basis: 'source', category: 'technical' }] })).some((e) => e.includes('need a sourceRef')));
});

// ---------- discovery ----------
const index = buildIndex(bundle.resources, bundle);
const familyOf = Object.fromEntries(bundle.resourceTypes.map((t) => [t.id, t.family]));

test('every curated engineering question resolves to at least one resource', () => {
  assert.equal(bundle.questions.length, 6);
  for (const q of bundle.questions) {
    const res = query(bundle.resources, index, { filters: q.filters });
    assert.ok(res.length >= 1, `${q.id} has no results`);
  }
});

test('new facets: capability, knowledge domain and resource type', () => {
  const dt = applyFilters(bundle.resources, { capability: ['digital-twin'] }).map((r) => r.id);
  assert.ok(dt.includes('aas') && dt.includes('step-ap242'));
  const vocab = applyFilters(bundle.resources, { type: ['vocabulary'] });
  assert.equal(vocab.length, 7);
  assert.ok(applyFilters(bundle.resources, { domain: ['foundations.quantities'] }).some((r) => r.id === 'qudt'));
  const counts = facetCounts(bundle.resources, { capability: ['robotics-autonomy'] }, 'capability');
  assert.ok(counts['iot-monitoring'] > 0, 'own facet ignored when counting');
});

test('family filter separates semantic models, specifications and technology', () => {
  const n = (family) => query(bundle.resources, index, { family, familyOf }).length;
  assert.equal(n('technology'), 9);
  assert.equal(n('specification'), 1);
  assert.equal(n('semantic') + n('specification') + n('technology'), n('all'));
  assert.equal(n('all'), bundle.resources.length);
});

test('search understands capability and knowledge-domain labels', () => {
  const ids = query(bundle.resources, index, { q: 'digital twins' }).map((r) => r.id);
  assert.ok(ids.includes('aas'));
  const units = query(bundle.resources, index, { q: 'units measurement' }).map((r) => r.id);
  assert.ok(units.includes('qudt'));
});
