#!/usr/bin/env node
// Download pilot ontologies (official distributions only), parse them, and write versioned graph assets + manifest.
// Network-dependent: run by maintainers (`npm run graphs`), not in CI. Outputs are committed.
//   node scripts/explorer/build-graphs.mjs [--offline]   (--offline: rebuild from .cache only)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGraph, versionSlug, FORMAT } from './extract.mjs';
import { loadSources } from '../lib/atlas-data.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const offline = process.argv.includes('--offline');
const cfg = JSON.parse(readFileSync(join(ROOT, 'data/explorer/sources.json'), 'utf8'));
const atlasIds = loadSources(ROOT).ontologies.map((o) => o.record.id);
const today = new Date().toISOString().slice(0, 10);
const manifestPath = join(ROOT, 'data/explorer/manifest.json');
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { ontologies: {} };

async function download(url) {
  const res = await fetch(url, {
    headers: { Accept: 'text/turtle, application/n-triples;q=0.9', 'User-Agent': 'ReferenceOntologyAtlas-graphs/1.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(cfg.limits.timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!/^https?:/.test(res.url)) throw new Error('non-http redirect');
  const len = Number(res.headers.get('content-length') || 0);
  if (len > cfg.limits.maxBytes) throw new Error(`too large (${len} bytes)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > cfg.limits.maxBytes) throw new Error(`too large (${buf.length} bytes)`);
  return buf;
}

function cached(id) {
  const dir = join(ROOT, '.cache/explorer', id);
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).sort().at(-1);
  return f ? readFileSync(join(dir, f)) : null;
}

const entries = {};
let failures = 0;
for (const [id, src] of Object.entries(cfg.pilots)) {
  try {
    const buf = offline ? cached(id) : await download(src.url);
    if (!buf) throw new Error('not in cache (run without --offline)');
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const cacheDir = join(ROOT, '.cache/explorer', id);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, `${sha256}.ttl`), buf);

    const prev = previous.ontologies[id];
    if (prev?.source?.sha256 === sha256 && prev.asset && existsSync(join(ROOT, prev.asset))) {
      entries[id] = prev; // cache hit: unchanged source version
      console.log(`  = ${id} unchanged (${prev.asset})`);
      continue;
    }
    const source = { url: src.url, sha256, bytes: buf.length, retrievedOn: today, license: src.license, licenseUrl: src.licenseUrl, documentation: src.documentation };
    const graph = extractGraph(buf.toString('utf8'), { atlasId: id, format: src.format, source });
    if (!graph.stats.classes && !graph.stats.objectProperties) throw new Error('no classes or properties found');
    const slug = versionSlug(graph.ontology, sha256);
    const asset = `assets/graphs/${id}/${slug}.json`;
    mkdirSync(join(ROOT, 'assets/graphs', id), { recursive: true });
    writeFileSync(join(ROOT, asset), JSON.stringify(graph) + '\n');
    entries[id] = { status: 'interactive', asset, version: slug, format: FORMAT, source, stats: graph.stats, notes: graph.notes };
    console.log(`  ✓ ${id} → ${asset} (${graph.stats.classes} classes, ${graph.stats.edges} edges)`);
  } catch (err) {
    failures++;
    entries[id] = { status: 'source-available', reason: `Processing failed: ${err.message}` };
    console.error(`  ✗ ${id}: ${err.message}`);
  }
}

for (const id of atlasIds) {
  if (entries[id]) continue;
  const a = cfg.availability[id];
  entries[id] = a ? { status: a.status, reason: a.reason } : { status: 'not-assessed', reason: 'Not yet reviewed.' };
}
const ontologies = Object.fromEntries(Object.keys(entries).sort().map((k) => [k, entries[k]]));
writeFileSync(manifestPath, JSON.stringify({ format: 'atlas-explorer-manifest/1', ontologies }, null, 2) + '\n');
console.log(`Manifest: ${Object.values(ontologies).filter((e) => e.status === 'interactive').length} interactive of ${atlasIds.length} records.`);
process.exit(failures ? 1 : 0);
