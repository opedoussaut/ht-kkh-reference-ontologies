#!/usr/bin/env node
// Check every external URL in the atlas data (records + relation evidence).
// Network-dependent, so it is not part of CI: run `npm run links` before a release.
//   node scripts/check-links.mjs [--json]
import { fileURLToPath } from 'node:url';
import { loadSources } from './lib/atlas-data.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = loadSources(ROOT);

const urls = new Map(); // url -> Set(where)
const add = (url, where) => {
  if (!/^https?:\/\//.test(url || '')) return;
  if (!urls.has(url)) urls.set(url, new Set());
  urls.get(url).add(where);
};
for (const { record: r } of src.ontologies) {
  for (const [k, v] of Object.entries(r.links)) add(v, `${r.id}.links.${k}`);
  if (r.license.url) add(r.license.url, `${r.id}.license`);
  r.verification.sources.forEach((s, i) => add(s.url, `${r.id}.sources[${i}]`));
  (r.corrections || []).forEach((c, i) => add(c.source, `${r.id}.corrections[${i}]`));
}
src.relations.items.forEach((rel) => add(rel.evidence.url, `relation ${rel.source}->${rel.target}`));

const UA = 'Mozilla/5.0 (compatible; ReferenceOntologyAtlas-linkcheck/1.0)';
async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (res.ok || method === 'GET') return { status: res.status, ok: res.ok, final: res.url };
    } catch (e) {
      if (method === 'GET') return { status: 0, ok: false, error: e.cause?.code || e.name };
    }
  }
}

const list = [...urls.keys()];
const results = [];
const CONCURRENCY = 8;
for (let i = 0; i < list.length; i += CONCURRENCY) {
  const batch = list.slice(i, i + CONCURRENCY);
  results.push(...(await Promise.all(batch.map(async (u) => ({ url: u, where: [...urls.get(u)], ...(await check(u)) })))));
}

const bad = results.filter((r) => !r.ok);
if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
else {
  console.log(`Checked ${results.length} unique URLs: ${results.length - bad.length} OK, ${bad.length} need attention.`);
  for (const b of bad) console.log(`  ${b.status || b.error}  ${b.url}\n        used by: ${b.where.join(', ')}`);
}
// Some publishers block automated clients (403/429); review those manually rather than failing hard.
process.exit(bad.some((b) => b.status === 404 || b.status === 410 || b.status === 0) ? 1 : 0);
