# Contributing

Thank you for helping keep the atlas accurate. Two rules come first:

1. **Public information only.** Cite a public source for every fact. Never include confidential, internal, customer or
   login-only material, including internal community or wiki links.
2. **Vendor-neutral, not vendor-free.** Open-source and commercial resources can both be added when they materially
   support an engineering use and have authoritative public documentation. Publisher claims are labelled as such, and no
   endorsement is implied. See [docs/EDITORIAL-POLICY.md](docs/EDITORIAL-POLICY.md).

## Ways to contribute

- **Correction**: open a *Correct a record* issue, or edit `data/ontologies/<id>.json` in a pull request.
- **New ontology**: open a *Propose an ontology* issue, or add a record (see below).
- **New relationship**: add an entry to `data/taxonomy/relations.json` with `evidence.url` from the publisher or a
  primary source.

## Adding or editing a record

1. Create `data/ontologies/<id>.json`. The `id` is kebab-case and must match the file name. Copy a similar record as a
   starting point. The schema is in [`schema/ontology.schema.json`](schema/ontology.schema.json).
2. Fill in the fields:

   | Field | Notes |
   | --- | --- |
   | `name`, `fullName`, `summary` | `summary` is 1–3 sentences, factual. |
   | `publisher`, `publisherType` | `standards-body`, `industry-association`, `consortium`, `research`, `government`, `industry` |
   | `kind`, `layer` | `kind` determines `resourceType` (see `resource-types.json` → `fromKind`), e.g. `ontology`, `file-format`, `middleware`, `simulator`, `ai-framework`, `trained-model`, `dataset`, `benchmark`, `specification`. `layer` (`upper`, `mid-level`, `cross-domain`, `domain`) is required for the semantic family only |
   | `version` | `label` as the publisher states it, ISO `date` (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`) or `null`, `status` |
   | `maturity` | `standard`, `stable`, `emerging`, `research`, `legacy`, `discontinued` |
   | `license` | `name`, `access` (`open`, `open-with-terms`, `licensed`, `unknown`), `url`, `reviewStatus` (`not-assessed` until someone reviews it), `commercialReuse` (`unknown` unless reviewed) |
   | `links` | `official` (required, may be `null`), optional `specification`, `repository`, `namespace`, `related` |
   | `industries`, `useCases` | ids from `data/taxonomy/` |
   | `resourceType` | from `data/taxonomy/resource-types.json` (derived from `kind` for semantic resources) |
   | `knowledge` | `{ domain, basis }`: one primary sub-domain from `knowledge-domains.json`, or `not-assessed`. `basis: source` needs `sourceRef` |
   | `capabilities`, `classificationBasis` | capability ids from `capabilities.json`; basis of the industry and capability mappings (`editorial` unless sourced) |
   | `physicalAi` | atlas Physical AI categories; requires `classificationBasis.physicalAi` and a publisher/specification/peer-reviewed source whose `supports` includes `capability` |
   | `licenses` | scoped licence statements (`scope`, `name`, `spdx?`, `url`, `statedAt`, `restrictions?`, `commercialUse`, `reviewStatus`); required for non-semantic resources; `permitted` needs a review and an SPDX id |
   | `details` | type-specific: `aiModel` (required for AI models: `artefact`, `weightsPublished`, …), `dataset`, `benchmark`, `standard` |
   | `limitations` | known limitations `{ text, basis, category, sourceRef? }`, category one of `technical`, `scope`, `access`, `unverified-claim`, `catalogue-gap`; leave empty rather than guess |
   | `editorialReview` | `{ reviewedOn, reviewer }`; reviewer is a role or handle, never an email |
   | `engineeringUses` | 1–5 short **editorial** examples of practical engineering use. Shown with an *Editorial* label; never claims of adoption or certification |
   | `verification` | `status` (`verified`, `partially-verified`, `unverified`), `checkedOn`, `sources[]` (each with `url`, `title`, `type` from `evidence-types.json` and `supports`: which claims the source is cited for), `notes` |
   | `origin` | `v2` for new records |

3. Run `npm run build` to validate and regenerate the outputs, then `npm test`.
4. Commit the record **and** the regenerated files, then open a pull request on a branch.

### Verification levels

- **verified**: publisher, version and licence were confirmed on official pages on `checkedOn`.
- **partially-verified**: the official source was confirmed, but at least one fact is open. Explain which one in `notes`.
- **unverified**: no authoritative public source yet. This level requires `needsReview: true`.

### Records from catalogue v1

The 26 original records keep a `legacy` block that must stay identical to `data/legacy/catalog-v1.json`. Record a fix
in `corrections[]` (`field`, `from`, `to`, `reason`, `source`) and change the current fields; never edit `legacy`.

## Automated checks

CI (`.github/workflows/ci.yml`) runs `npm run validate` and `npm test` on every pull request:

- JSON Schema validation of every record
- referential integrity (industries, use cases, relation endpoints, use-case stacks)
- unique ids that match their file names
- every v1 record preserved verbatim
- every relation has an evidence URL
- no internal-platform hosts or markers in any published file
- generated files are up to date
- no Dassault Systèmes brand mappings; no internal KKH vocabulary or private/ content in published files
- technical relationships cite a source that one of their two records also cites

## Adding an ontology to the Explorer

1. Check that the publisher offers a machine-readable distribution (Turtle or N-Triples for now) under a licence that allows redistribution with attribution.
2. Add it under `pilots` in `data/explorer/sources.json` with its official URL, licence and licence URL, and remove it from `availability`.
3. Run `npm run graphs`, check the console summary, and commit the new `assets/graphs/<id>/<version>.json` and `data/explorer/manifest.json`.
4. Run `npm test`. The asset-integrity tests check versioned paths, licences, hashes and that no edge points to a missing entity.

## Before a release

Run `npm run links` to check every external URL in the data. It is not part of CI because some publishers block automated clients: treat 403/429 results as items to check by hand, and fix 404/410 results.

## Review and publishing

Pull requests target `main`. GitHub Pages publishes `main`, so the maintainer approves every merge.
