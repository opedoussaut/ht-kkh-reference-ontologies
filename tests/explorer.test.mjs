import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGraph, versionSlug, FORMAT } from '../scripts/explorer/extract.mjs';
import { createModel, curie, namespaceOf } from '../assets/js/lib/explorer-model.js';
import { explorerView } from '../assets/js/explorer.js';
import { loadSources } from '../scripts/lib/atlas-data.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NS = 'https://example.org/mini#';
const src = { url: 'https://example.org/mini.ttl', sha256: 'a'.repeat(64), bytes: 1, retrievedOn: '2026-10-15', license: 'CC0', licenseUrl: 'https://example.org/l' };
const mini = extractGraph(readFileSync(join(ROOT, 'tests/fixtures/mini.ttl'), 'utf8'), { atlasId: 'mini', format: 'text/turtle', source: src });
const byId = new Map(mini.entities.map((e) => [e.id, e]));
const has = (s, o, t, extra = {}) => mini.edges.some((e) => e.s === NS + s && e.o === (o.startsWith('http') ? o : NS + o) && e.t === t && Object.entries(extra).every(([k, v]) => e[k] === v));

// ---------- parsing ----------
test('extracts ontology header, imports and prefixes without loading imports', () => {
  assert.equal(mini.format, FORMAT);
  assert.equal(mini.ontology.iri, 'https://example.org/mini');
  assert.equal(mini.ontology.versionInfo, 'v1.2.0');
  assert.deepEqual(mini.ontology.imports, ['https://example.org/other']);
  assert.equal(mini.ontology.prefixes[''], NS);
  assert.equal(versionSlug(mini.ontology, src.sha256), 'v1.2.0');
});

test('extracts entity types, labels (English preferred) and definitions', () => {
  assert.equal(byId.get(NS + 'Machine').t, 'class');
  assert.equal(byId.get(NS + 'hasPart').t, 'objectProperty');
  assert.equal(byId.get(NS + 'serialNumber').t, 'datatypeProperty');
  assert.equal(byId.get(NS + 'r2d2').t, 'individual');
  assert.equal(byId.get(NS + 'Machine').definition, 'A device that performs work.');
  assert.equal(byId.get(NS + 'Robot').definition, 'A programmable machine.');
  assert.equal(byId.get(NS + 'RobotArm').label, 'RobotArm', 'falls back to the local name, never invents a label');
});

test('extracts hierarchy, domains/ranges (incl. unions), restrictions, axioms and individuals', () => {
  assert.ok(has('Robot', 'Machine', 'subClassOf'));
  assert.ok(has('Robot', 'Actuator', 'restriction', { p: NS + 'hasPart', k: 'some' }));
  assert.deepEqual(byId.get(NS + 'Robot').constraints, [{ p: NS + 'serialNumber', k: 'max', n: '1' }]);
  assert.ok(has('hasPart', 'Machine', 'domain') && has('hasPart', 'Robot', 'domain'), 'union domain expanded to its members');
  assert.ok(has('hasPart', 'Actuator', 'range'));
  assert.ok(has('hasPart', 'partOf', 'inverseOf'));
  assert.ok(has('serialNumber', 'http://www.w3.org/2001/XMLSchema#string', 'range'));
  assert.equal(byId.get('http://www.w3.org/2001/XMLSchema#string').t, 'datatype');
  assert.ok(has('Actuator', 'Robot', 'disjointWith'));
  assert.ok(has('Manipulator', 'RobotArm', 'equivalentClass'));
  assert.ok(has('observes', 'Robot', 'domainIncludes') && has('observes', 'Machine', 'rangeIncludes'));
  assert.ok(has('r2d2', 'Robot', 'type'));
});

test('referenced terms from other ontologies become external stubs', () => {
  const art = byId.get('https://example.org/other#Artefact');
  assert.equal(art.external, true);
  assert.equal(byId.get('http://www.w3.org/2001/XMLSchema#string').external, true);
  assert.equal(mini.stats.externalReferences, 2, 'ext:Artefact and xsd:string');
});

test('invalid RDF raises a parse error instead of producing a graph', () => {
  assert.throws(() => extractGraph('@prefix : <x> . :a :b', { atlasId: 'bad', format: 'text/turtle', source: src }));
});

test('version slug never invents a version: falls back to a content hash', () => {
  assert.equal(versionSlug({ versionInfo: 'New modular version.' }, 'b'.repeat(64)), `sha-${'b'.repeat(12)}`);
  assert.equal(versionSlug({ title: 'QUDT Schema - Version 3.5.2' }, 'c'.repeat(64)), '3.5.2');
});

// ---------- view model ----------
test('view model: roots, children, inspector and neighbourhood expansion', () => {
  const m = createModel(mini);
  assert.ok(m.roots.includes(NS + 'Machine'), 'external parent does not hide a top-level class');
  assert.ok(!m.roots.includes(NS + 'Robot'));
  assert.deepEqual(m.children(NS + 'Robot'), [NS + 'Manipulator']);
  const i = m.inspect(NS + 'Robot');
  assert.deepEqual(i.parents.sort(), [NS + 'Machine']);
  assert.ok(i.asDomain.some((x) => x.p === NS + 'hasPart'));
  assert.ok(i.asDomain.some((x) => x.p === NS + 'observes' && x.soft), 'domainIncludes flagged as non-binding');
  assert.deepEqual(i.disjoint, [NS + 'Actuator']);
  assert.deepEqual(i.instances, [NS + 'r2d2']);
  const nb = m.neighbours(NS + 'Robot');
  for (const x of ['Machine', 'Actuator', 'Manipulator']) assert.ok(nb.includes(NS + x), x);
  assert.ok(!nb.includes(NS + 'Robot'));
});

test('view model: property edges connect domain to range; group filters apply', () => {
  const m = createModel(mini);
  assert.ok(m.viewEdges(['property']).some((e) => e.s === NS + 'Machine' && e.o === NS + 'Actuator' && e.p === NS + 'hasPart'));
  assert.ok(m.viewEdges(['hierarchy']).every((e) => e.t === 'subClassOf'));
});

test('view model: search ranks exact and prefix matches first and filters by type', () => {
  const m = createModel(mini);
  assert.equal(m.search('robot')[0].id, NS + 'Robot');
  assert.ok(m.search('', { types: ['objectProperty'] }).every((e) => e.t === 'objectProperty'));
  assert.equal(curie(NS + 'Robot', mini.ontology.prefixes), ':Robot');
  assert.equal(namespaceOf(NS + 'Robot'), NS);
});

// ---------- committed assets & manifest ----------
const manifest = JSON.parse(readFileSync(join(ROOT, 'data/explorer/manifest.json'), 'utf8'));
const STATUSES = ['interactive', 'source-available', 'documentation-only', 'unavailable', 'not-assessed'];

test('manifest covers every semantic-family record exactly once (and no technology resource) with a valid status and reason', () => {
  const src = loadSources(ROOT);
  const semantic = new Set(src.resourceTypes.items.filter((t) => t.family === 'semantic').map((t) => t.id));
  const ids = src.ontologies.map((o) => o.record).filter((r) => semantic.has(r.resourceType)).map((r) => r.id).sort();
  assert.deepEqual(Object.keys(manifest.ontologies).sort(), ids);
  for (const [id, e] of Object.entries(manifest.ontologies)) {
    assert.ok(STATUSES.includes(e.status), id);
    if (e.status !== 'interactive') assert.ok(e.reason?.length > 10, `${id} needs a reason`);
  }
});

test('at least three pilots are interactive and their assets are intact', () => {
  const pilots = Object.entries(manifest.ontologies).filter(([, e]) => e.status === 'interactive');
  assert.ok(pilots.length >= 3);
  for (const [id, e] of pilots) {
    const file = join(ROOT, e.asset);
    assert.ok(existsSync(file), e.asset);
    assert.ok(statSync(file).size < 1_000_000, `${id} asset too large`);
    assert.match(e.asset, new RegExp(`^assets/graphs/${id}/[a-z0-9.-]+\\.json$`), 'versioned asset path');
    const g = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(g.format, FORMAT);
    assert.equal(g.ontology.atlasId, id);
    assert.match(g.ontology.source.sha256, /^[0-9a-f]{64}$/);
    assert.equal(g.ontology.source.sha256, e.source.sha256);
    assert.match(g.ontology.source.url, /^https:\/\//);
    assert.ok(g.ontology.source.license && g.ontology.source.licenseUrl, `${id} licence`);
    const ids = new Set(g.entities.map((x) => x.id));
    assert.equal(ids.size, g.entities.length, `${id}: duplicate entity ids`);
    for (const edge of g.edges) assert.ok(ids.has(edge.s) && ids.has(edge.o), `${id}: dangling edge ${edge.s} -> ${edge.o}`);
    assert.ok(g.stats.classes > 0);
  }
});

test('SAREF pilot: known source semantics are preserved', () => {
  const e = manifest.ontologies['saref-core'];
  const m = createModel(JSON.parse(readFileSync(join(ROOT, e.asset), 'utf8')));
  const S = 'https://saref.etsi.org/core/';
  assert.ok(m.children(S + 'Device').includes(S + 'Sensor'));
  assert.match(m.byId.get(S + 'Sensor').definition, /observe/i);
});

// ---------- graceful UI handling ----------
test('explorer view explains unavailable graphs and never renders an empty graph', () => {
  const record = { id: 'step-ap242', name: 'STEP AP242', links: { official: 'https://www.iso.org/standard/84300.html' } };
  const out = String(explorerView({ record, entry: manifest.ontologies['step-ap242'], interactive: [] }));
  assert.match(out, /EXPRESS information model/);
  assert.ok(!out.includes('id="explorer"'));
  const missing = String(explorerView({ record: { id: 'x', name: 'X', links: { official: null } }, entry: undefined, interactive: [] }));
  assert.match(missing, /not yet been assessed/);
});
