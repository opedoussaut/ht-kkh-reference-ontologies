# Contributing

Thank you for helping keep the atlas accurate. Two rules come first:

1. **Public information only.** Cite a public source for every fact. Never include confidential, internal, customer or
   login-only material, including internal community or wiki links.
2. **Vendor-neutral.** The atlas describes ontologies and standards, not software products. Do not add vendor, product
   or brand mappings or adoption claims.

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
   | `kind`, `layer` | kind: `ontology`, `vocabulary`, `meta-model`, `information-model`, `modeling-language`, `classification`. layer: `upper`, `mid-level`, `cross-domain`, `domain` |
   | `version` | `label` as the publisher states it, ISO `date` (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`) or `null`, `status` |
   | `maturity` | `standard`, `stable`, `emerging`, `research`, `legacy`, `discontinued` |
   | `license` | `name`, `access` (`open`, `open-with-terms`, `licensed`, `unknown`), `url` |
   | `links` | `official` (required, may be `null`), optional `specification`, `repository`, `namespace`, `related` |
   | `industries`, `useCases` | ids from `data/taxonomy/` |
   | `engineeringUses` | 1–5 short **editorial** examples of practical engineering use. Shown with an *Editorial* label; never claims of adoption or certification |
   | `verification` | `status` (`verified`, `partially-verified`, `unverified`), `checkedOn`, `sources[]`, `notes` |
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
- no vendor, product or brand mappings

## Before a release

Run `npm run links` to check every external URL in the data. It is not part of CI because some publishers block automated clients: treat 403/429 results as items to check by hand, and fix 404/410 results.

## Review and publishing

Pull requests target `main`. GitHub Pages publishes `main`, so the maintainer approves every merge.
