#!/usr/bin/env node
// One-off migration of catalogue v1 (26 records) to the v2 per-file data model.
// Kept in the repository for audit. Refuses to overwrite existing records unless --force.
//   node scripts/migrate-v1.mjs [--force]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY, NEW, CHECKED } from './migration/v2-enrichment.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const force = process.argv.includes('--force');
const legacy = JSON.parse(readFileSync(join(ROOT, 'data/legacy/catalog-v1.json'), 'utf8')).records;

const END_OBJECT_TO_USE_CASE = {
  'AI Factories': 'ai-factories',
  'Semiconductors': 'semiconductors',
  'Personal Electronics': 'personal-electronics',
  'General Purpose Robotics': 'general-purpose-robotics',
};

const uniq = (xs) => [...new Set(xs.filter(Boolean))];

function fromLegacy(rec) {
  const e = LEGACY[rec.name];
  if (!e) throw new Error(`No enrichment for v1 record "${rec.name}"`);
  const useCases = uniq([
    ...rec.endObjects.map((eo) => END_OBJECT_TO_USE_CASE[eo]),
    ...(rec.imds.includes('Circular Design') ? ['sustainability'] : []),
    ...(e.useCases || []),
  ]);
  const corrections = [...(e.corrections || [])];
  if (rec.name === 'GS1 WebVoc') {
    corrections.push({ field: 'usageStatus', from: 'licensed', to: 'open', reason: 'The GS1 Web Vocabulary is published under Apache 2.0.', source: 'https://github.com/gs1/WebVoc' });
  }
  const out = {
    id: e.id,
    name: e.name || rec.name,
    fullName: e.fullName,
    summary: e.summary || rec.description,
    publisher: e.publisher || rec.publisher,
    publisherType: e.publisherType,
    kind: e.kind || 'ontology',
    layer: e.layer,
    topics: e.topics,
    ...(e.standardRef ? { standardRef: e.standardRef } : {}),
    version: e.version,
    maturity: e.maturity,
    license: e.license,
    links: { official: rec.official || null, ...e.links },
    formats: e.formats || [],
    industries: uniq(['high-tech', ...(e.industries || [])]),
    useCases,
    brandRelevance: e.brandRelevance || [],
    publicEvidence: e.publicEvidence || [],
    verification: { checkedOn: CHECKED, ...e.verification },
    ...(e.needsReview ? { needsReview: true } : {}),
    ...(corrections.length ? { corrections } : {}),
    origin: 'v1',
    legacy: rec,
  };
  if (e.links && 'official' in e.links) out.links.official = e.links.official;
  return out;
}

function fromNew(e) {
  return {
    publicEvidence: [],
    ...e,
    verification: { checkedOn: CHECKED, ...e.verification },
    origin: 'v2',
  };
}

const records = [...legacy.map(fromLegacy), ...NEW.map(fromNew)];
let written = 0;
for (const r of records) {
  const file = join(ROOT, 'data/ontologies', `${r.id}.json`);
  if (existsSync(file) && !force) continue;
  writeFileSync(file, JSON.stringify(r, null, 2) + '\n');
  written++;
}
console.log(`Migrated ${legacy.length} v1 records + ${NEW.length} new records; wrote ${written} file(s).`);
