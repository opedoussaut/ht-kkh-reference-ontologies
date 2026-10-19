// Checkpoint 3/4: robot ecosystem, resource-type distinctions, rights, relationship evidence, navigation and images.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources, validate } from '../scripts/lib/atlas-data.mjs';
import { RECORDS } from '../scripts/phase2/ecosystem-robotics.mjs';
import { ECOSYSTEM, TECH_RELATIONS } from '../scripts/phase2/ecosystem-links.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = loadSources(ROOT);
const byId = new Map(src.ontologies.map((o) => [o.record.id, o.record]));
const bundle = JSON.parse(readFileSync(join(ROOT, 'data/atlas.json'), 'utf8'));
const app = readFileSync(join(ROOT, 'assets/js/app.js'), 'utf8');
const css = readFileSync(join(ROOT, 'assets/css/atlas.css'), 'utf8');
const index = readFileSync(join(ROOT, 'index.html'), 'utf8');

// ---------- resource-type distinctions ----------
test('model, framework, dataset and benchmark resources are typed distinctly', () => {
  const t = (id) => byId.get(id).resourceType;
  assert.equal(t('openvla'), 'ai-model');
  assert.equal(t('isaac-lab'), 'ai-framework');
  assert.equal(t('lerobot'), 'ai-framework');
  assert.equal(t('open-x-embodiment'), 'dataset');
  assert.equal(t('libero'), 'benchmark');
  assert.equal(t('isaac-sim'), 'simulation');
  assert.equal(t('ros2'), 'software-framework');
  assert.equal(t('iso-10218-1'), 'standard');
  assert.equal(t('urdf'), 'data-schema');
  const m = byId.get('openvla').details.aiModel;
  assert.equal(m.artefact, 'trained-model');
  assert.match(m.trainingData, /Open X-Embodiment/);
});

test('every ecosystem record is present exactly as researched (idempotent seed)', () => {
  for (const r of RECORDS) {
    const now = byId.get(r.id);
    assert.ok(now, r.id);
    for (const k of ['resourceType', 'kind', 'version', 'license', 'licenses', 'limitations', 'physicalAi']) assert.deepEqual(now[k], r[k], `${r.id}.${k}`);
  }
});

// ---------- rights ----------
test('rights are scoped and cautious: unknown stays unknown, weights differ from code', () => {
  for (const r of RECORDS) {
    const rec = byId.get(r.id);
    assert.ok(rec.licenses.length >= 1, r.id);
    if (rec.license.access === 'unknown') assert.ok(rec.licenses.every((l) => l.commercialUse === 'unknown'), r.id);
    for (const l of rec.licenses) if (l.commercialUse === 'permitted') {
      assert.equal(l.reviewStatus, 'reviewed', r.id);
      assert.ok(['Apache-2.0', 'MIT', 'BSD-3-Clause', 'CC-BY-4.0'].includes(l.spdx), `${r.id}: ${l.spdx}`);
      assert.match(l.reviewNote, /not legal advice/i, r.id);
    }
  }
  const vla = byId.get('openvla').licenses;
  assert.equal(vla.find((l) => l.scope === 'software').spdx, 'MIT');
  assert.equal(vla.find((l) => l.scope === 'model-weights').commercialUse, 'unknown');
  assert.equal(byId.get('open-x-embodiment').license.access, 'unknown', 'licence not stated by publisher');
  assert.ok(byId.get('isaac-sim').licenses.some((l) => /Omniverse/.test(l.name) && l.commercialUse === 'unknown'));
});

test('publisher identity is always visible and vendor capability statements are flagged in the UI', () => {
  for (const r of RECORDS) assert.ok(byId.get(r.id).publisher.length > 2, r.id);
  assert.ok(app.includes('function publisherStated'));
});

// ---------- relationships ----------
test('technical relationships are evidenced by a source cited on one of their two records', () => {
  const techTypes = new Set(src.relations.types.filter((t) => t.category === 'technical').map((t) => t.id));
  const tech = src.relations.items.filter((r) => techTypes.has(r.type));
  assert.equal(tech.length, TECH_RELATIONS.length);
  for (const r of tech) {
    const cited = [...byId.get(r.source).verification.sources, ...byId.get(r.target).verification.sources].map((s) => s.url);
    assert.ok(cited.includes(r.evidence.url), `${r.source} -> ${r.target}: ${r.evidence.url} not cited by either record`);
  }
});

test('no stored relation links the IEEE ontologies to the technology stack (only editorial workflow does)', () => {
  const ieee = new Set(['ieee-cora', 'ieee-rparts', 'ieee-pos', 'ieee-rtr', 'ieee-aur', 'ieee-corax', 'sumo-cora']);
  const tech = new Set(RECORDS.map((r) => r.id));
  assert.ok(!src.relations.items.some((r) => (ieee.has(r.source) && tech.has(r.target)) || (tech.has(r.source) && ieee.has(r.target))));
  assert.ok(ECOSYSTEM.workflow.some((w) => ieee.has(w.from)), 'the editorial workflow may suggest it');
});

test('validator rejects an ecosystem workflow edge to an unknown resource', () => {
  const useCases = src.useCases.map((u) => (u.id === ECOSYSTEM.id ? { ...u, workflow: [...u.workflow, { from: 'ros2', to: 'nope', label: 'x' }] } : u));
  assert.ok(validate({ ...src, useCases }).some((e) => e.includes('refers to an unknown resource')));
});

// ---------- ecosystem & journey ----------
test('ecosystem has the five stages and every stage resource is linked back to it', () => {
  const uc = bundle.useCases.find((u) => u.id === 'robot-development');
  assert.deepEqual(uc.stack.map((s) => s.layer), ['Concepts & semantics', 'Engineering representations & models', 'Frameworks & environments', 'Datasets & AI models', 'Testing, verification & validation']);
  for (const s of uc.stack) for (const id of s.ontologies) {
    assert.ok(bundle.resources.find((r) => r.id === id).useCases.includes('robot-development'), id);
    assert.ok(s.notes[id], `${id} needs a "why it matters" note`);
  }
  const q = bundle.questions.find((x) => x.ecosystem === 'robot-development');
  assert.match(q.question, /understand, simulate and develop a robot/);
});

test('journey wiring: home question -> ecosystem -> catalogue/details/graph', () => {
  assert.ok(app.includes("q.ecosystem ? `#/use-cases/${q.ecosystem}`"), 'home question opens the ecosystem');
  assert.ok(app.includes('#/catalog?useCase=${u.id}&family=all'), 'ecosystem opens the catalogue with all families');
  assert.ok(app.includes('mountEcosystemGraph'), 'ecosystem map reuses the graph');
  assert.ok(app.includes('A discovery and architecture aid, not a tested integration.'));
});

test('existing navigation is preserved (old and new routes, industries, nav items)', () => {
  for (const label of ['Catalogue', 'Explorer', 'Network', 'Industries', 'Use cases', 'About']) assert.ok(index.includes(`>${label}</a>`), label);
  assert.match(app, /case 'ontology':[^\n]*\n\s*case 'resource':/);
  for (const r of ['industries', 'use-cases', 'catalog', 'graph', 'explore', 'about']) assert.ok(app.includes(`case '${r}'`), r);
  assert.equal(bundle.industries.filter((i) => !i.horizontal).length, 12);
});

// ---------- images ----------
test('homepage background: optimised, responsive, decorative and text-free', () => {
  const files = ['atlas-background-768.webp', 'atlas-background-1280.webp', 'atlas-background-2056.webp', 'atlas-background-1280.jpg'];
  for (const f of files) {
    const p = join(ROOT, 'assets/images', f);
    assert.ok(existsSync(p), f);
    assert.ok(statSync(p).size < 150_000, `${f} should stay small`);
    assert.ok(app.includes(`assets/images/${f}`), `${f} must be referenced`);
  }
  assert.match(app, /<picture class="hero-bg" aria-hidden="true">/);
  assert.match(app, /<img src="assets\/images\/atlas-background-1280\.jpg" alt="" width="2056" height="765"/);
  assert.ok(app.includes('<p class="wordmark">Ontology Atlas</p>'), 'title rendered as HTML text');
  const tracked = execFileSync('git', ['ls-files', 'assets/images'], { cwd: ROOT, encoding: 'utf8' });
  assert.ok(!/reference-ontology-atlas-cover/.test(tracked + app + readFileSync(join(ROOT, 'README.md'), 'utf8')), 'old text cover removed');
  for (const txt of [app, index, css]) assert.ok(!/Updated &(amp;)? Enriched|REFERENCE<br>ONTOLOGY/i.test(txt), 'old banner messages removed');
});
