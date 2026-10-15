import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources, validate, buildBundle, toLegacyJson, toTurtle, FORBIDDEN_PATTERNS } from '../scripts/lib/atlas-data.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = loadSources(ROOT);

test('all sources pass schema and referential validation', () => {
  assert.deepEqual(validate(src), []);
});

test('the 26 v1 records are preserved verbatim', () => {
  assert.equal(src.legacy.length, 26);
  const migrated = src.ontologies.map((o) => o.record).filter((r) => r.origin === 'v1');
  assert.equal(migrated.length, 26);
  for (const rec of src.legacy) {
    const m = migrated.find((r) => r.legacy.name === rec.name);
    assert.ok(m, `missing v1 record ${rec.name}`);
    assert.deepEqual(m.legacy, rec);
  }
});

test('validation catches a dropped v1 record', () => {
  const broken = { ...src, ontologies: src.ontologies.filter((o) => o.record.legacy?.name !== 'PROV-O') };
  assert.ok(validate(broken).some((e) => e.includes('"PROV-O" is missing')));
});

test('validation catches internal platform links', () => {
  const [first, ...rest] = src.ontologies;
  const tainted = { file: first.file, record: { ...first.record, links: { ...first.record.links, related: 'https://example.3dexperience.3ds.com/x' } } };
  assert.ok(validate({ ...src, ontologies: [tainted, ...rest] }).some((e) => e.includes('forbidden internal reference')));
});

test('validation catches relations without evidence or with unknown ends', () => {
  const relations = { ...src.relations, items: [...src.relations.items, { source: 'sosa', target: 'nope', type: 'extends', evidence: {} }] };
  const errs = validate({ ...src, relations });
  assert.ok(errs.some((e) => e.includes('unknown target "nope"')));
  assert.ok(errs.some((e) => e.includes('evidence.url is required')));
});

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '.claude'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

test('no published file contains internal platform references', () => {
  const published = /\.(html|js|mjs|css|json|ttl|md|svg|yml)$/;
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (!published.test(rel) || rel === 'package-lock.json' || rel.startsWith('tests/')) continue;
    if (rel === 'scripts/lib/atlas-data.mjs') continue; // defines the patterns themselves
    const text = readFileSync(file, 'utf8');
    for (const re of FORBIDDEN_PATTERNS) assert.ok(!re.test(text), `${rel} matches ${re}`);
  }
});

test('generated files are up to date', () => {
  const generatedOn = src.ontologies.map((o) => o.record.verification.checkedOn).sort().at(-1);
  const bundle = buildBundle(src, { generatedOn });
  const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(read('data/atlas.json'), JSON.stringify(bundle, null, 2) + '\n', 'run npm run build');
  assert.equal(read('htkkh_reference_ontologies_map_catalog.json'), JSON.stringify(toLegacyJson(bundle), null, 2) + '\n');
  assert.equal(read('htkkh_reference_ontologies_map.ttl'), toTurtle(bundle));
});

test('legacy JSON export keeps the v1 shape for every record', () => {
  const bundle = JSON.parse(readFileSync(join(ROOT, 'data/atlas.json'), 'utf8'));
  const legacy = toLegacyJson(bundle);
  for (const r of legacy) {
    for (const k of ['name', 'category', 'publisher', 'official', 'endObjects', 'imds', 'description', 'parentOntology', 'stabilityStatus', 'usageStatus']) {
      assert.ok(k in r, `${r.name} lacks ${k}`);
    }
    assert.ok(!('wiki' in r));
  }
  for (const v1 of src.legacy) assert.ok(legacy.some((r) => r.description === bundle.ontologies.find((o) => o.legacy?.name === v1.name).summary));
});

test('brand evidence is only claimed with a cited source', () => {
  for (const { record } of src.ontologies) {
    for (const ev of record.publicEvidence) {
      assert.match(ev.source.url, /^https:\/\//);
      assert.ok(['official', 'third-party'].includes(ev.source.type));
    }
  }
});

test('turtle export declares prefixes and one subject per ontology', () => {
  const ttl = readFileSync(join(ROOT, 'htkkh_reference_ontologies_map.ttl'), 'utf8');
  assert.match(ttl, /^@prefix atlas: </m);
  const subjects = ttl.match(/^atlas:\S+ a atlas:ReferenceOntology/gm) || [];
  assert.equal(subjects.length, src.ontologies.length);
});
