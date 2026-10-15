import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources } from '../scripts/lib/atlas-data.mjs';
import { PROPOSED } from '../scripts/phase2/proposed-mapping.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = loadSources(ROOT);
const tax = (f) => JSON.parse(readFileSync(join(ROOT, 'data/taxonomy/proposed', f), 'utf8'));
const TAXONOMIES = ['resource-types.json', 'knowledge-domains.json', 'capabilities.json', 'physical-ai.json', 'evidence-types.json'];

test('proposed taxonomies are versioned, flagged as proposed, with unique ids and labels', () => {
  for (const f of TAXONOMIES) {
    const t = tax(f);
    assert.equal(t._status, 'proposed', f);
    assert.match(t._version, /^\d+\.\d+\.\d+$/, f);
    const items = f === 'knowledge-domains.json' ? t.items.flatMap((d) => [d, ...d.children]) : t.items;
    const ids = items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${f}: duplicate ids`);
    for (const i of items) assert.ok(i.label && i.summary, `${f}: ${i.id} needs label and summary`);
  }
});

test('every existing kind maps to exactly one resource type, in the default semantic family', () => {
  const types = tax('resource-types.json');
  const def = types.families.find((f) => f.default).id;
  for (const { record } of src.ontologies) {
    const matches = types.items.filter((t) => t.fromKind.includes(record.kind));
    assert.equal(matches.length, 1, `${record.id} kind ${record.kind}`);
    assert.equal(matches[0].family, def, `${record.id} must stay in the default catalogue view`);
  }
});

test('proposed mapping covers every record exactly, with valid domain and capability ids', () => {
  const ids = src.ontologies.map((o) => o.record.id).sort();
  assert.deepEqual(Object.keys(PROPOSED).sort(), ids);
  const sub = new Set(tax('knowledge-domains.json').items.flatMap((d) => d.children.map((c) => c.id)));
  const caps = new Set(tax('capabilities.json').items.map((c) => c.id));
  for (const [id, p] of Object.entries(PROPOSED)) {
    assert.ok(sub.has(p.domain), `${id}: unknown domain ${p.domain}`);
    assert.ok(['clear', 'tentative'].includes(p.fit), id);
    for (const c of p.capabilities) assert.ok(caps.has(c), `${id}: unknown capability ${c}`);
  }
});

test('no Physical AI assignments in Phase 2', () => {
  for (const { record } of src.ontologies) assert.ok(!record.physicalAi?.length, record.id);
});

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '.claude', 'private', '.cache'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

test('no internal reference-classification category names in the repository', () => {
  const internal = /(product|organi[sz]ation|business model)\s+virtual\s+twin/i;
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (rel.startsWith('tests/') || !/\.(md|json|js|mjs|html|css|ttl|yml)$/.test(rel)) continue;
    assert.ok(!internal.test(readFileSync(file, 'utf8')), `${rel} contains an internal category name`);
  }
});

test('no PDF documents are tracked and private/ is ignored', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
  assert.deepEqual(tracked.filter((f) => /\.pdf$/i.test(f)), []);
  assert.match(readFileSync(join(ROOT, '.gitignore'), 'utf8'), /^private\/$/m);
});
