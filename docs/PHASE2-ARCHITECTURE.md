# Phase 2 architecture — from ontology directory to engineering knowledge atlas

Status: **approved 2026-10-16 and implemented** (schema v3, migration of all 46 records, discovery UI) · Branch: `feature/physical-ai-atlas-enrichment` · Baseline: `d1cdb86`

Related documents: [RESOURCE-TAXONOMY.md](RESOURCE-TAXONOMY.md) · [KNOWLEDGE-QUALIFICATION.md](KNOWLEDGE-QUALIFICATION.md) ·
[PUBLIC-DATA-GOVERNANCE.md](PUBLIC-DATA-GOVERNANCE.md) · [PHASE2-CLASSIFICATION.md](PHASE2-CLASSIFICATION.md) ·
[ONTOLOGY-EXPLORER.md](ONTOLOGY-EXPLORER.md)

## 1. Audit summary (Step A)

| Finding | Impact on Phase 2 |
| --- | --- |
| 46 records in `data/ontologies/`, one JSON file each, validated by `schema/ontology.schema.json` (`additionalProperties: false`). | The per-file model generalises well. Every new field must be added to the schema explicitly. That is a feature: nothing slips in unnoticed. |
| `kind` already distinguishes ontology (34), vocabulary (6), classification (1), information-model (3), meta-model (1) and modeling-language (1). | Resource types can be **derived mechanically** from `kind` without editorial guesswork. |
| "Ontology" is built into the folder name, the bundle key (`ontologies`), the route (`#/ontology/<id>`), the export file names and the UI copy. | This is the main **breaking-change risk**. The plan keeps every existing name working (§5). |
| `industries` (12 + Cross-Industry), `useCases`, `engineeringUses` (editorial) and `relations` already exist and are independent. | Knowledge domain, capabilities and Physical AI are added as **further independent axes**. Nothing is duplicated per industry. |
| `verification.sources` are untyped (72 sources, 37 hosts). | The evidence model needs a source type, and migration must not guess it (§4). |
| No field for licence review, known limitations or editorial review date. | Add these with explicit `not-assessed` / `unknown` defaults. |
| 20 of 46 records have no evidence-backed relationship, and 14 have no version date. | These are data-quality gaps. They are reported, not filled with guesses. |
| `maturity` (what the resource is) and `verification.status` (how well the atlas checked it) already exist. | Keep them; add licence-review and suitability as **separate** concepts (see KNOWLEDGE-QUALIFICATION.md). |

## 2. Entities

```
Resource ──┬─ resourceType ───────────▶ ResourceType (family: semantic | technology)
           ├─ knowledge.domain ───────▶ KnowledgeDomain (one primary sub-domain)
           ├─ industries[] ───────────▶ Industry (12 + Cross-Industry)
           ├─ capabilities[] ─────────▶ EngineeringCapability
           ├─ physicalAi[] ───────────▶ PhysicalAiCategory (empty in Phase 2)
           ├─ useCases[] ─────────────▶ UseCase (editorial reference stacks)
           ├─ verification.sources[] ─▶ Source { url, title, type: EvidenceType }
           └─ details.<type> ─────────  type-specific extension (dataset, framework, …)
Relation { source, target, type, category, evidence }   — between resources
```

A resource exists **once**. Industries, capabilities, knowledge domain and Physical AI categories are references to it,
never copies of it.

## 3. Resource record — field definitions (proposed schema v3)

Existing fields keep their names and meaning. New fields are marked **new**.

| Field | Req. | Qualification | Definition |
| --- | --- | --- | --- |
| `id`, `name`, `fullName` | ✓ | WHAT | Stable identifier (kebab-case, never reused) and titles. |
| `resourceType` **new** | ✓ | WHAT | Controlled value from `resource-types.json`. |
| `kind` | ✓ | WHAT | Existing finer sub-type, kept for backward compatibility. |
| `summary` | ✓ | WHAT | Factual description, supported by `verification.sources`. |
| `knowledge` **new** | ✓ | WHAT | `{ domain, basis: "editorial" \| "source", sourceRef? }`. Exactly one primary sub-domain. `domain: "not-assessed"` is allowed. |
| `industries` | ✓ | WHY | Existing. Gains `classificationBasis.industries` (`editorial` by default). |
| `capabilities` **new** | ✓ | WHY | Zero or more capability ids. Basis recorded in `classificationBasis.capabilities`. |
| `physicalAi` **new** | – | WHY | Zero or more Physical AI category ids. Must be empty in Phase 2 (§6). |
| `engineeringUses` |  | WHY | Existing, **editorial**. |
| `limitations` **new** |  | WHY / HOW | `[{ text, basis: "source" \| "editorial", sourceRef? }]`. Known limitations and uncertainties. An empty list displays as "None recorded", never as "None". |
| `publisher`, `publisherType` | ✓ | WHO | Existing. |
| `formats`, `license` | ✓ | HOW | Existing. `license` gains `reviewStatus` (`not-assessed` \| `reviewed`) and `commercialReuse` (`unknown` \| `permitted` \| `restricted` \| `not-permitted`), both defaulting to the most cautious value. |
| `version`, `verification.checkedOn` | ✓ | WHEN | Existing. |
| `editorialReview` **new** | ✓ | WHEN | `{ reviewedOn, reviewer }`: when the editorial fields were last reviewed, and by whom (a role or handle, never a private email). |
| `links` | ✓ | WHERE | Existing. Gains optional `distributions[]` `{ url, format, mediaType }` for machine-readable files (also used by the Ontology Explorer). |
| `verification.sources[].type` **new** | ✓ | evidence | Value from `evidence-types.json`; `unclassified` until reviewed. |
| `maturity`, `layer`, `standardRef`, `corrections`, `legacy`, `origin` |  |  | Existing, unchanged. `layer` stays meaningful for semantic types only. |
| `details` **new** |  |  | Type-specific extension, keyed by type (see examples). |

## 4. Migration strategy (Step C — requires approval)

1. **Schema v3**: add the new fields; keep all existing fields. `npm run validate` must pass before and after.
2. **Scripted, idempotent migration** (`scripts/phase2/migrate.mjs`, to be written after approval). For each record:
   - `resourceType`: derived from `kind` (deterministic; see the preview).
   - `knowledge`, `capabilities`: taken from the **approved** version of `scripts/phase2/proposed-mapping.mjs`, with `basis: "editorial"`.
   - `classificationBasis`: `{ industries: "editorial", capabilities: "editorial" }`.
   - `license.reviewStatus = "not-assessed"`, `license.commercialReuse = "unknown"`.
   - `verification.sources[].type`: `official-documentation` only when the source host equals the official link host; otherwise `unclassified`.
   - `physicalAi = []`, `limitations = []`, and `editorialReview = { reviewedOn: <migration date>, reviewer: "atlas-editors" }`.
3. **Tests added before running it**: every pre-existing id still resolves; no field lost (deep compare of v2 fields); the `legacy` blocks are unchanged; exports are byte-identical apart from the added fields.
4. **Storage location**: keep `data/ontologies/` during Phase 2 (no file moves, so blob links stay valid). Rename it to `data/resources/` only when the first non-semantic resource is added. That is a separate, approved commit made with `git mv`.
5. **Exports**: `data/atlas.json` gains `resources` (all records) and keeps `ontologies` as an alias containing the semantic family. The v1-compatible JSON keeps its shape and lists the semantic family only. The Turtle export adds `atlas:resourceType`.
6. **Routes**: add `#/resource/<id>` as canonical and keep `#/ontology/<id>` working permanently. The catalogue opens with `family=semantic`, so all 46 current records stay visible by default.

## 5. Backward compatibility guarantees

- All 46 ids, routes and blob URLs keep working.
- The default catalogue view shows exactly the records it shows today.
- `htkkh_reference_ontologies_map_catalog.json` keeps the v1 shape.
- `legacy` blocks are never modified.

## 6. Physical AI dimension — model, navigation, evidence (preparation only)

- **Model**: `physicalAi[]` ids from `data/taxonomy/physical-ai.json`. It is an *application* taxonomy, not an established standard.
- **Navigation**: an additional "Physical AI" entry, with one panel per category linking to the filtered catalogue. It appears only once at least three categories contain at least one resource.
- **Evidence required to assign a category**: a source of type `official-documentation`, `published-specification` or `peer-reviewed` that describes the resource's role in that area. Editorial assignment is allowed only alongside the resource's own documentation, and must be marked `basis: "editorial"`. Vendor-reported performance claims never justify an assignment on their own.
- **Out of scope in Phase 2**: adding Physical AI resources (models, simulators, datasets).

## 7. Discovery by engineering question (Step D)

Questions are **curated entry points**: a stored list of question, explanation and filter combination, for example:

```json
{ "id": "robot-development", "question": "Which knowledge resources can help me develop an industrial robot?",
  "filters": { "capability": ["robotics-autonomy"], "industry": ["industrial-equipment"] },
  "basis": "editorial" }
```

They resolve to ordinary catalogue filters, so every result remains traceable to record data.

The detail page is reorganised into seven sections, each tagged *Source* or *Editorial*:
what it is, problem addressed, industries, how to use it, complementary resources, evidence, and limitations/licence/uncertainty.
Complementary resources keep two visibly different lists: **formal relationships** (cited) and **used together** (editorial). Neither implies functional interoperability.

## 8. Concrete JSON examples

Ontology (real record, migrated shape; existing fields abbreviated):

```json
{
  "id": "saref4inma",
  "name": "SAREF4INMA",
  "resourceType": "ontology",
  "kind": "ontology",
  "summary": "SAREF extension for industry and manufacturing…",
  "knowledge": { "domain": "product.manufacturing", "basis": "editorial" },
  "industries": ["industrial-equipment", "high-tech"],
  "capabilities": ["manufacturing-operations", "supply-chain"],
  "classificationBasis": { "industries": "editorial", "capabilities": "editorial" },
  "physicalAi": [],
  "publisher": "ETSI", "publisherType": "standards-body",
  "version": { "label": "SAREF4INMA v2.1.1 (ETSI TS 103 410-5 V2.1.1)", "date": "2025-04-25", "status": "published" },
  "license": { "name": "ETSI Software License (BSD-3-Clause style)", "access": "open",
               "url": "https://forge.etsi.org/etsi-software-license",
               "reviewStatus": "not-assessed", "commercialReuse": "unknown" },
  "links": { "official": "https://saref.etsi.org/saref4inma/" },
  "limitations": [],
  "verification": { "status": "verified", "checkedOn": "2026-10-15",
    "sources": [{ "url": "https://saref.etsi.org/saref4inma/", "title": "ETSI SAREF4INMA", "type": "official-documentation" }] },
  "editorialReview": { "reviewedOn": "2026-10-15", "reviewer": "atlas-editors" }
}
```

Standard (**illustrative only**: placeholder values, not catalogue data):

```json
{
  "id": "example-safety-standard",
  "name": "EXAMPLE-STD 0000",
  "resourceType": "standard",
  "kind": "specification",
  "summary": "Illustrative record showing how a normative document without a machine-readable model is described.",
  "knowledge": { "domain": "product.requirements", "basis": "editorial" },
  "capabilities": ["simulation-validation"],
  "license": { "name": "Standard text sold by the publisher", "access": "licensed", "url": "https://example.org/terms",
               "reviewStatus": "not-assessed", "commercialReuse": "unknown" },
  "links": { "official": "https://example.org/standards/0000" },
  "details": { "standard": { "body": "EXAMPLE", "designation": "EXAMPLE-STD 0000:2026", "edition": "unknown", "machineReadableArtefacts": [] } },
  "verification": { "status": "unverified", "checkedOn": "2026-10-15", "sources": [{ "url": "https://example.org/standards/0000", "title": "Publisher catalogue entry", "type": "published-specification" }] }
}
```

Dataset (**illustrative only**):

```json
{
  "id": "example-robot-dataset",
  "name": "Example Robot Dataset",
  "resourceType": "dataset",
  "summary": "Illustrative record showing dataset-specific metadata.",
  "knowledge": { "domain": "product.operations", "basis": "editorial" },
  "capabilities": ["robotics-autonomy"],
  "physicalAi": [],
  "license": { "name": "unknown", "access": "unknown", "url": null, "reviewStatus": "not-assessed", "commercialReuse": "unknown" },
  "details": { "dataset": {
      "modalities": ["rgb", "joint-state"], "size": "unknown", "collection": "unknown",
      "licenseFacets": { "data": "unknown", "code": "unknown" },
      "personalData": "not-assessed" } },
  "limitations": [{ "text": "Collection conditions not documented by the publisher.", "basis": "editorial" }],
  "verification": { "status": "unverified", "checkedOn": "2026-10-15", "sources": [] }
}
```

The dataset example would currently fail validation (`sources` requires at least one item), and that is intentional: a dataset cannot be published without a source.

## 9. Decisions (approved 2026-10-16)

All five decisions below were approved as proposed: generic public taxonomy plus a private crosswalk; resource types derived from `kind`; the editorial domain and capability mapping, including the tentative rows; `#/resource/<id>` with the `#/ontology/<id>` alias; and keeping `data/ontologies/`.


1. **Reference classification publication.** The atlas uses a *generic public* knowledge taxonomy written in its own words. A crosswalk to the internal reference classification is kept outside the public repository (`private/`, git-ignored). Publishing an attributed mapping requires explicit authorisation.
2. **Resource-type mapping** from `kind` (preview table).
3. **Knowledge-domain and capability proposals**, especially the 13 *tentative* rows.
4. **Canonical route** `#/resource/<id>`, with `#/ontology/<id>` kept as a permanent alias.
5. **Folder rename** deferred until the first non-semantic resource is added.
