// Phase 2 (schema v3) migration: backward compatibility, classification and evidence rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources, validate, buildBundle, toLegacyJson } from '../scripts/lib/atlas-data.mjs';
import { PROPOSED } from '../scripts/phase2/proposed-mapping.mjs';
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
  assert.deepEqual(bundle.ontologies.map((o) => o.id).sort(), [...preIds].sort());
  assert.deepEqual(bundle.resources.map((o) => o.id).sort(), [...preIds].sort());
  const index = buildIndex(bundle.resources, bundle);
  const shown = query(bundle.resources, index, { family: def, familyOf });
  assert.equal(shown.length, 46, 'default catalogue view shows every pre-migration record');
});

test('v1-compatible JSON export keeps its exact shape and records', () => {
  const legacy = toLegacyJson(buildBundle(src, { generatedOn: bundle.meta.generatedOn }));
  assert.equal(legacy.length, 46);
  const keys = ['id', 'name', 'category', 'publisher', 'official', 'endObjects', 'imds', 'description', 'parentOntology', 'stabilityStatus', 'usageStatus', 'version', 'license', 'atlasUrl'];
  for (const r of legacy) assert.deepEqual(Object.keys(r), keys);
});

test('migration lost no data: stripping the Phase 2 fields restores the pre-migration records', (t) => {
  const BASE = '8cdbb02';
  try { execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { cwd: ROOT, stdio: 'ignore' }); } catch { t.skip('pre-migration commit not available (shallow clone)'); return; }
  for (const id of preIds) {
    const before = JSON.parse(execFileSync('git', ['show', `${BASE}:data/ontologies/${id}.json`], { cwd: ROOT, encoding: 'utf8' }));
    assert.deepEqual(stripPhase2(byId.get(id)), before, id);
  }
});

test('migration is idempotent', () => {
  const out = execFileSync(process.execPath, ['scripts/phase2/migrate.mjs', '--dry-run'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /Migrated 0 record\(s\); 46 already on schema v3/);
});

test('routes: #/resource is canonical and #/ontology stays a permanent alias', () => {
  const app = readFileSync(join(ROOT, 'assets/js/app.js'), 'utf8');
  assert.match(app, /case 'ontology':[^\n]*\n\s*case 'resource': view = viewOntology\(id\)/);
});

// ---------- classification ----------
test('resource types follow the deterministic kind -> type rule', () => {
  for (const r of records) assert.equal(r.resourceType, resourceTypeFor(r.kind, tax.resourceTypes), r.id);
  const counts = bundle.meta.counts.byResourceType;
  assert.deepEqual(counts, { 'data-schema': 4, ontology: 34, vocabulary: 7, 'modelling-language': 1 });
});

test('knowledge domains and capabilities match the approved editorial mapping', () => {
  for (const r of records) {
    assert.equal(r.knowledge.domain, PROPOSED[r.id].domain, r.id);
    assert.equal(r.knowledge.basis, 'editorial', r.id);
    assert.deepEqual(r.capabilities, PROPOSED[r.id].capabilities, r.id);
    assert.deepEqual(r.classificationBasis, { industries: 'editorial', capabilities: 'editorial' }, r.id);
  }
});

test('validation rejects unknown types, domains and capabilities', () => {
  assert.ok(validateWith('sosa', (r) => ({ ...r, resourceType: 'gadget' })).some((e) => e.includes('unknown resourceType')));
  assert.ok(validateWith('sosa', (r) => ({ ...r, knowledge: { domain: 'product.magic', basis: 'editorial' } })).some((e) => e.includes('unknown knowledge sub-domain')));
  assert.ok(validateWith('sosa', (r) => ({ ...r, capabilities: ['teleportation'] })).some((e) => e.includes('unknown capability')));
  assert.ok(validateWith('sosa', (r) => ({ ...r, knowledge: { domain: 'not-assessed', basis: 'editorial' } })).length === 0, 'not-assessed is allowed');
  assert.ok(validateWith('sosa', (r) => ({ ...r, knowledge: { domain: 'product.operations', basis: 'source' } })).some((e) => e.includes('requires knowledge.sourceRef')));
});

test('no duplicate identifiers across resources', () => {
  const ids = bundle.resources.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

// ---------- evidence & licences ----------
test('every source is attributed and typed; official-documentation only on the official host', () => {
  const evidenceIds = new Set(tax.evidenceTypes.items.map((x) => x.id));
  for (const r of records) {
    assert.ok(r.verification.sources.length >= 1, r.id);
    for (const s of r.verification.sources) {
      assert.ok(s.url && s.title, `${r.id}: source needs url and title`);
      assert.ok(evidenceIds.has(s.type), `${r.id}: ${s.type}`);
      if (s.type === 'official-documentation') assert.equal(sourceTypeFor(r, s.url), 'official-documentation', `${r.id}: ${s.url}`);
    }
    assert.match(r.editorialReview.reviewedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!r.editorialReview.reviewer.includes('@'), 'no personal emails');
  }
});

test('Physical AI assignments are refused while the categories are proposed', () => {
  for (const r of records) assert.deepEqual(r.physicalAi, [], r.id);
  assert.ok(validateWith('ieee-cora', (r) => ({ ...r, physicalAi: ['robot-capabilities-control'] })).some((e) => e.includes('still proposed')));
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
  assert.ok(validateWith('sosa', (r) => ({ ...r, limitations: [{ text: 'Soft domains only (schema:domainIncludes).', basis: 'source' }] })).some((e) => e.includes('need a sourceRef')));
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

test('family filter: technology family is empty today, "all" equals the default', () => {
  assert.equal(query(bundle.resources, index, { family: 'technology', familyOf }).length, 0);
  assert.equal(query(bundle.resources, index, { family: 'all', familyOf }).length, 46);
});

test('search understands capability and knowledge-domain labels', () => {
  const ids = query(bundle.resources, index, { q: 'digital twins' }).map((r) => r.id);
  assert.ok(ids.includes('aas'));
  const units = query(bundle.resources, index, { q: 'units measurement' }).map((r) => r.id);
  assert.ok(units.includes('qudt'));
});
