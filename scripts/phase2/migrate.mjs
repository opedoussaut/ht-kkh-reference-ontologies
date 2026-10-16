#!/usr/bin/env node
// Phase 2 migration (approved 2026-10-16): adds schema-v3 fields to every record without removing or changing any
// existing value. Idempotent: records that already have `resourceType` are left untouched.
//   node scripts/phase2/migrate.mjs [--dry-run]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROPOSED } from './proposed-mapping.mjs';
import { loadTaxonomies, resourceTypeFor, sourceTypeFor, stripPhase2 } from './rules.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DATE = '2026-10-16';
const dryRun = process.argv.includes('--dry-run');
const tax = loadTaxonomies(ROOT);
const dir = join(ROOT, 'data/ontologies');

// Insert `extra` keys right after `afterKey`, keeping the existing key order readable.
function insertAfter(obj, afterKey, extra) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === afterKey) Object.assign(out, extra);
  }
  for (const [k, v] of Object.entries(extra)) if (!(k in out)) out[k] = v;
  return out;
}

const report = [];
let migrated = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(dir, file);
  const before = JSON.parse(readFileSync(path, 'utf8'));
  if (before.resourceType) { report.push({ id: before.id, skipped: true }); continue; }
  const map = PROPOSED[before.id];
  if (!map) throw new Error(`No approved mapping for ${before.id}`);

  let r = structuredClone(before);
  r = insertAfter(r, 'fullName', { resourceType: resourceTypeFor(r.kind, tax.resourceTypes) });
  r = insertAfter(r, 'summary', { knowledge: { domain: map.domain, basis: 'editorial' } });
  r = insertAfter(r, 'useCases', {
    capabilities: map.capabilities,
    classificationBasis: { industries: 'editorial', capabilities: 'editorial' },
    physicalAi: [],
  });
  r.license = { ...r.license, reviewStatus: 'not-assessed', commercialReuse: 'unknown' };
  r.verification = { ...r.verification, sources: r.verification.sources.map((s) => ({ ...s, type: sourceTypeFor(r, s.url) })) };
  r = insertAfter(r, r.engineeringUses ? 'engineeringUses' : 'useCases', { limitations: [] });
  r = insertAfter(r, 'verification', { editorialReview: { reviewedOn: DATE, reviewer: 'atlas-editors' } });

  // No-loss guarantee: removing the added fields must give back the original record exactly.
  if (!isDeepStrictEqual(stripPhase2(r), before)) throw new Error(`${before.id}: migration would alter existing data`);

  if (!dryRun) writeFileSync(path, JSON.stringify(r, null, 2) + '\n');
  migrated++;
  report.push({ id: r.id, name: r.name, type: r.resourceType, domain: map.domain, fit: map.fit, caps: map.capabilities.length,
    official: r.verification.sources.filter((s) => s.type === 'official-documentation').length, sources: r.verification.sources.length });
}

const done = report.filter((x) => !x.skipped);
const byType = done.reduce((m, x) => ((m[x.type] = (m[x.type] || 0) + 1), m), {});
console.log(`${dryRun ? '[dry run] ' : ''}Migrated ${migrated} record(s); ${report.length - migrated} already on schema v3.`);
if (done.length) {
  console.log(`  by type: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`  tentative knowledge domains: ${done.filter((x) => x.fit === 'tentative').length}`);
  console.log(`  sources typed official-documentation: ${done.reduce((n, x) => n + x.official, 0)} / ${done.reduce((n, x) => n + x.sources, 0)}`);
}
