# CLAUDE.md — Reference Ontology Atlas

Instructions for Claude (and humans) working in this repository.

## What this is

A **public**, evidence-based atlas of public reference ontologies and semantic standards, with cross-industry
discovery, engineering use cases and a verified relationship graph.

- Public site (GitHub Pages, served from the repository root of `main`): https://opedoussaut.github.io/ht-kkh-reference-ontologies/
- The URL must not change: keep `index.html` at the root and do not rename the repository.

## Non-negotiable rules

1. **Public information only.** Every fact must be supportable from a public source listed in the record's
   `verification.sources`. Never add confidential or proprietary material, internal platform data, customer
   names, roadmaps, or links to internal or login-only systems (3DEXPERIENCE community pages, internal networks).
   `npm run validate` and the test suite reject known internal hosts; treat that as a safety net, not a licence.
2. **Vendor-neutral.** The atlas is generic: no software-vendor, product or brand mappings, adoption claims or
   vendor-specific views. Do not reintroduce them unless the owner explicitly asks (a test enforces this).
3. **Relationships need evidence.** Only add an edge to `data/taxonomy/relations.json` when the publisher or a
   primary source states it; include `evidence.url` and a short note.
4. **Never drop v1 records.** The 26 records of catalogue v1 live on as `origin: "v1"` with their `legacy` block
   byte-identical to `data/legacy/catalog-v1.json`. Corrections go in `corrections[]`, not by editing `legacy`.
5. **Don't guess versions or licences.** If you cannot confirm a fact, say so in `verification.notes`, use
   `partially-verified` / `unverified`, and set `needsReview: true` when unverified.
6. **Git workflow.** Work on a `dev/*` branch. Do not merge to `main` or deploy (GitHub Pages publishes `main`)
   without the owner's explicit approval. Do not rewrite history without approval.

## Layout

```
index.html                 SPA shell (hash routing: #/catalog, #/ontology/<id>, #/graph, #/industries, #/use-cases, #/about)
assets/css/atlas.css       Design tokens (light/dark) and components
assets/js/app.js           Views, router, events
assets/js/lib/search.js    Pure search/filter logic (shared with tests)
assets/js/lib/graph.js     Dependency-free force layout + SVG renderer
assets/js/lib/html.js      Escaping template helper — always use html`` for markup
data/ontologies/<id>.json  SOURCE OF TRUTH — one record per ontology
data/taxonomy/*.json       industries, use cases, relations (+ relation types)
data/legacy/catalog-v1.json  Sanitised snapshot of the 26 v1 records (do not edit)
schema/ontology.schema.json  JSON Schema for records
scripts/build-data.mjs     Validate + generate outputs
scripts/lib/atlas-data.mjs Validation rules, bundle, legacy JSON + Turtle exporters
scripts/migrate-v1.mjs     One-off v1→v2 migration (kept for audit; refuses to overwrite)
tests/*.test.mjs           node:test suites
```

Generated (commit them, never hand-edit): `data/atlas.json`, `htkkh_reference_ontologies_map_catalog.json`,
`htkkh_reference_ontologies_map.ttl`. The two root files keep their v1 names for backward compatibility.

## Commands

```bash
npm install          # dev deps: ajv, ajv-formats
npm run build        # validate + regenerate data/atlas.json and the exports
npm run validate     # validate + fail if generated files are stale (CI)
npm test             # node:test suites
npm run check        # validate + test
npm run serve        # http://localhost:8080 (the app fetches data/atlas.json, so file:// won't work)
```

Always run `npm run build && npm test` after touching `data/`, `schema/` or `scripts/`.

## Conventions

- No framework and no bundler: native ES modules, served as-is by GitHub Pages. No runtime CDN dependencies.
- All markup goes through `html``…``` (escapes by default) and links through `safeUrl()`.
- Keep `assets/js/lib/*` free of DOM access except `renderGraph`, so it stays testable in Node.
- British/International English in UI copy; dates as ISO `YYYY-MM-DD`.
- When updating a record, bump `verification.checkedOn` to the date you checked the sources.
