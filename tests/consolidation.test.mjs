// Schema v3.1 consolidation: resource-type distinctions, scoped licences, evidence and relation rules, review audit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources, validate } from '../scripts/lib/atlas-data.mjs';
import { REVIEW_B1, REVIEW_B3, REVIEW_B4 } from '../scripts/phase2/review-2026-10.mjs';
import { RECORDS as ECO } from '../scripts/phase2/ecosystem-robotics.mjs';
const preIds = new Set(JSON.parse(readFileSync(new URL('./fixtures/pre-phase2-ids.json', import.meta.url), 'utf8')).ids);

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = loadSources(ROOT);
const records = src.ontologies.map((o) => o.record);
const byId = new Map(records.map((r) => [r.id, r]));
const rt = src.resourceTypes;

function validateWith(id, mutate) {
  const ontologies = src.ontologies.map((o) => (o.record.id === id ? { ...o, record: mutate(structuredClone(o.record)) } : o));
  return validate({ ...src, ontologies });
}
function validateRelations(mutate) {
  return validate({ ...src, relations: { ...src.relations, items: mutate(structuredClone(src.relations.items)) } });
}

// ---------- A1: resource types ----------
test('model, framework, dataset and benchmark are distinct resource types with distinct kinds', () => {
  const type = (id) => rt.items.find((t) => t.id === id);
  for (const id of ['ai-model', 'ai-framework', 'software-framework', 'simulation', 'dataset', 'benchmark', 'standard', 'reference-architecture']) assert.ok(type(id), id);
  const kinds = rt.items.flatMap((t) => t.fromKind);
  assert.equal(new Set(kinds).size, kinds.length, 'each kind maps to exactly one type');
  assert.deepEqual(type('ai-model').fromKind.sort(), ['model-architecture', 'trained-model']);
  assert.ok(!rt.items.some((t) => t.id === 'framework'), 'the ambiguous `framework` type is gone');
  assert.deepEqual(rt.families.map((f) => f.id), ['semantic', 'specification', 'technology']);
});

test('kind/type mismatch, missing AI-model details and missing scoped licences are rejected', () => {
  assert.ok(validateWith('sosa', (r) => ({ ...r, kind: 'dataset' })).some((e) => e.includes('implies resourceType')));
  const asModel = (r) => ({ ...r, kind: 'trained-model', resourceType: 'ai-model', licenses: [{ scope: 'model-weights', name: 'x licence', statedAt: 'https://example.org/l', commercialUse: 'unknown', reviewStatus: 'not-assessed' }] });
  assert.ok(validateWith('sosa', asModel).some((e) => e.includes('details.aiModel')));
  assert.ok(validateWith('sosa', (r) => ({ ...r, kind: 'dataset', resourceType: 'dataset' })).some((e) => e.includes('scoped licence')));
  assert.ok(validateWith('sosa', (r) => { delete r.layer; return r; }).some((e) => e.includes('semantic resources need a layer')));
});

// ---------- A2: licences ----------
test('scoped licences: commercial use needs a review, "permitted" needs an SPDX id', () => {
  const lic = (extra) => (r) => ({ ...r, licenses: [{ scope: 'software', name: 'Some licence', statedAt: 'https://example.org/l', commercialUse: 'unknown', reviewStatus: 'not-assessed', ...extra }] });
  assert.deepEqual(validateWith('sosa', lic({})), []);
  assert.ok(validateWith('sosa', lic({ commercialUse: 'permitted' })).some((e) => e.includes('only be stated after a review')));
  assert.ok(validateWith('sosa', lic({ commercialUse: 'permitted', reviewStatus: 'reviewed' })).some((e) => e.includes('SPDX')));
  assert.deepEqual(validateWith('sosa', lic({ commercialUse: 'permitted', reviewStatus: 'reviewed', spdx: 'Apache-2.0' })), []);
});

test('IEEE CORA separates the purchased standard text from the CC BY 4.0 OWL conversion', () => {
  const l = byId.get('ieee-cora').licenses;
  assert.deepEqual(l.map((x) => x.scope), ['specification', 'model-files']);
  assert.equal(l[1].spdx, 'CC-BY-4.0');
  for (const x of l) assert.equal(x.commercialUse, 'unknown');
});

// ---------- B: review audit ----------
test('all 13 reviewed classifications are applied, with rationale; uncertainty is preserved', () => {
  assert.equal(Object.keys(REVIEW_B1).length, 13);
  for (const [id, d] of Object.entries(REVIEW_B1)) {
    const k = byId.get(id).knowledge;
    assert.equal(k.domain, d.domain, id);
    assert.equal(k.confidence, d.confidence, id);
    assert.equal(k.rationale, d.rationale, id);
    assert.equal(k.basis, 'editorial', `${id} stays editorial`);
  }
  assert.equal(records.filter((r) => preIds.has(r.id) && r.knowledge.confidence === 'tentative').length, 6);
});

test('limitations come only from the review, are categorised, and sourced ones cite a URL', () => {
  const ecoLim = Object.fromEntries(ECO.map((r) => [r.id, r.limitations]));
  for (const r of records) {
    assert.deepEqual(r.limitations, preIds.has(r.id) ? REVIEW_B3[r.id] || [] : ecoLim[r.id], r.id);
    for (const l of r.limitations) if (l.basis === 'source') assert.match(l.sourceRef, /^https?:\/\//, r.id);
  }
});

test('editorial corrections are applied exactly as recorded', () => {
  for (const [id, c] of Object.entries(REVIEW_B4)) {
    assert.ok(byId.get(id).engineeringUses.includes(c.to), id);
    assert.ok(!byId.get(id).engineeringUses.includes(c.from), id);
  }
});

test('editorial uses make no certification, integration-guarantee or endorsement claims', () => {
  const banned = /\b(certif|guarantee|endorse|fully compatible|seamless|plug-and-play|out of the box)/i;
  for (const r of records) for (const u of r.engineeringUses || []) assert.ok(!banned.test(u), `${r.id}: ${u}`);
});

// ---------- D1 groundwork: relations ----------
test('relations carry typed evidence and a verification status; weak evidence is rejected', () => {
  for (const r of src.relations.items) {
    assert.ok(['verified', 'partially-verified'].includes(r.status));
    if (r.status === 'partially-verified') assert.ok(r.conditions?.length > 10);
  }
  assert.ok(validateRelations((items) => { items[0].evidence.type = 'third-party'; return items; }).some((e) => e.includes('cannot establish')));
  assert.ok(validateRelations((items) => { items[0].status = 'partially-verified'; delete items[0].conditions; return items; }).some((e) => e.includes('conditions')));
  assert.ok(validateRelations((items) => { delete items[0].evidence.type; return items; }).some((e) => e.includes('evidence.type')));
});

test('About page publishes the inclusion and neutrality policy', () => {
  const app = readFileSync(join(ROOT, 'assets/js/app.js'), 'utf8');
  for (const s of ['Inclusion and neutrality policy', 'vendor-neutral, not vendor-free', 'No endorsement', 'publisher-stated']) assert.ok(app.includes(s), s);
});
