// Deterministic Phase 2 classification rules, shared by the migration and its preview.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadTaxonomies(root) {
  const tax = (f) => JSON.parse(readFileSync(join(root, 'data/taxonomy', f), 'utf8'));
  return {
    resourceTypes: tax('resource-types.json'),
    knowledgeDomains: tax('knowledge-domains.json'),
    capabilities: tax('capabilities.json'),
    physicalAi: tax('physical-ai.json'),
    evidenceTypes: tax('evidence-types.json'),
  };
}

// Resource type is derived mechanically from the existing `kind` field.
export function resourceTypeFor(kind, resourceTypes) {
  const t = resourceTypes.items.find((x) => x.fromKind.includes(kind));
  if (!t) throw new Error(`No resource type for kind "${kind}"`);
  return t.id;
}

// A source counts as official documentation only when it is hosted on the record's official host.
// Everything else stays `unclassified` for human review — no guessing.
export function sourceTypeFor(record, url) {
  try {
    const off = record.links.official && new URL(record.links.official).host;
    return off && new URL(url).host === off ? 'official-documentation' : 'unclassified';
  } catch {
    return 'unclassified';
  }
}

// Remove everything the migration adds, so the result can be compared with the original record.
export function stripPhase2(r) {
  const c = structuredClone(r);
  // v3 + v3.1 additions (scoped licences, source `supports`).
  for (const k of ['resourceType', 'knowledge', 'capabilities', 'classificationBasis', 'physicalAi', 'limitations', 'editorialReview', 'licenses']) delete c[k];
  delete c.license.reviewStatus;
  delete c.license.commercialReuse;
  for (const s of c.verification.sources) { delete s.type; delete s.supports; }
  return c;
}
