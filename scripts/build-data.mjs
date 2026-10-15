#!/usr/bin/env node
// Validate the atlas sources and generate the published data files.
//   npm run build     -> validate + write data/atlas.json and the legacy JSON/TTL exports
//   npm run validate  -> validate + fail if generated files are out of date (CI)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources, validate, buildBundle, toLegacyJson, toTurtle } from './lib/atlas-data.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const checkOnly = process.argv.includes('--check');

const src = loadSources(ROOT);
const errors = validate(src);
if (errors.length) {
  console.error(`✗ ${errors.length} validation error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// generatedOn is the newest verification date, so rebuilding the same data is deterministic.
const generatedOn = src.ontologies.map((o) => o.record.verification.checkedOn).sort().at(-1);
const bundle = buildBundle(src, { generatedOn });

const outputs = {
  'data/atlas.json': JSON.stringify(bundle, null, 2) + '\n',
  'htkkh_reference_ontologies_map_catalog.json': JSON.stringify(toLegacyJson(bundle), null, 2) + '\n',
  'htkkh_reference_ontologies_map.ttl': toTurtle(bundle),
};

let stale = 0;
for (const [rel, content] of Object.entries(outputs)) {
  const p = join(ROOT, rel);
  const current = existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
  if (current === content) continue;
  if (checkOnly) { console.error(`✗ ${rel} is out of date — run \`npm run build\``); stale++; }
  else { writeFileSync(p, content); console.log(`  wrote ${rel}`); }
}
if (stale) process.exit(1);
const c = bundle.meta.counts;
console.log(`✓ ${c.ontologies} ontologies, ${c.relations} relations, ${c.useCases} use cases — valid.`);
