// Private-data exclusion: internal KKH material must never reach tracked files, the public bundle or exports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const tracked = git('ls-files').split('\n').filter(Boolean);
const PUBLIC_TEXT = tracked.filter((f) => /\.(md|json|js|mjs|html|css|ttl|yml|txt)$/.test(f) && !f.startsWith('tests/'));

// Internal process and status vocabulary (kept here in tests only; tests/ is not published as content).
const INTERNAL_MARKERS = [
  /\bhowto(classify|qualify)\b/i,
  /\brasci\.pdf\b/i,
  /identify\s*(→|->|>)\s*capitali[sz]e/i,
  /capitali[sz]e\s*(→|->|>)\s*reveal/i,
  /drafted\s*(→|->|>)\s*specified/i,
  /specified\s*(→|->|>)\s*implemented\s*(→|->|>)\s*evaluated/i,
  /(product|organi[sz]ation|business model)\s+virtual\s+twin/i,
  /k&kh\s+(classification|qualification)/i,
];

test('nothing under private/ is tracked, and private/ is ignored', () => {
  assert.deepEqual(tracked.filter((f) => f.startsWith('private/')), []);
  const ignored = git('check-ignore', 'private/kkh/howtoclassify.pdf', 'private/reference-crosswalk.json').trim().split('\n');
  assert.equal(ignored.length, 2);
});

test('no internal process, status or classification vocabulary in published files', () => {
  for (const f of PUBLIC_TEXT) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    for (const re of INTERNAL_MARKERS) assert.ok(!re.test(text), `${f} matches ${re}`);
  }
});

test('the public bundle and exports never reference private/', () => {
  for (const f of ['data/atlas.json', 'htkkh_reference_ontologies_map_catalog.json', 'htkkh_reference_ontologies_map.ttl', 'data/explorer/manifest.json']) {
    assert.ok(!/private\//.test(readFileSync(join(ROOT, f), 'utf8')), f);
  }
  const build = readFileSync(join(ROOT, 'scripts/build-data.mjs'), 'utf8') + readFileSync(join(ROOT, 'scripts/lib/atlas-data.mjs'), 'utf8');
  assert.ok(!/['"`]private\//.test(build), 'the build must not read private/');
});

test('local preview server refuses /private', () => {
  assert.ok(readFileSync(join(ROOT, 'scripts/serve.mjs'), 'utf8').includes('(private|'), 'serve.mjs must block private/');
});

// When a private crosswalk exists locally, none of its internal terms may appear in published files.
test('private crosswalk terms (if present locally) do not leak into published files', (t) => {
  const p = join(ROOT, 'private/reference-crosswalk.json');
  if (!existsSync(p)) { t.skip('no local crosswalk'); return; }
  const cw = JSON.parse(readFileSync(p, 'utf8'));
  const terms = new Set();
  const collect = (v) => {
    if (typeof v === 'string' && v.length >= 8) terms.add(v.toLowerCase());
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (/^(reference|internal)/i.test(k) || typeof x === 'object') collect(x);
  };
  collect(cw.mappings || cw);
  for (const f of PUBLIC_TEXT) {
    const text = readFileSync(join(ROOT, f), 'utf8').toLowerCase();
    for (const term of terms) assert.ok(!text.includes(term), `${f} contains internal term "${term}"`);
  }
});
