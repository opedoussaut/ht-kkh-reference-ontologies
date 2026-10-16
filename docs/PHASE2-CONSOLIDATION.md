# Phase 2 consolidation — schema v3.1

Date: 2026-10-16 · Scripts: `scripts/phase2/schema-v3-1.mjs` (structure) and `scripts/phase2/review-2026-10.mjs` (data
review). Both are idempotent and kept for audit.

## A1. Resource types (resource-types.json 1.0.0 → 2.0.0)

| Family | Types (`fromKind`) | Change |
| --- | --- | --- |
| Ontologies & semantic models *(default)* | ontology (ontology) · vocabulary (vocabulary, classification) · data-schema (information-model, meta-model, **file-format**) · modelling-language (modeling-language) | `data-schema` relabelled "Data schema / exchange format"; new kind `file-format` (e.g. URDF) |
| **Standards & architectures** *(new family)* | standard (**specification**) · **reference-architecture** (reference-architecture) | `standard` moved here from the technology family |
| Engineering & AI technology | **software-framework** (software-framework, middleware) · simulation (simulator, physics-engine) · ai-framework (ai-framework) · **ai-model** (model-architecture, trained-model) · dataset (dataset) · **benchmark** (benchmark, evaluation-protocol) | `framework` removed (it was never used) and split into `reference-architecture` and `software-framework`; `ai-model` and `benchmark` added |

Distinctions enforced by validation:
- **Model vs. framework:** `ai-framework` is software for building or training models. `ai-model` is a model, and needs
  `details.aiModel.artefact` (`architecture` or `trained-model`) and `weightsPublished`.
- **Dataset vs. benchmark:** a benchmark evaluates; a dataset provides data. They are separate types.
- `kind` determines `resourceType` (one kind maps to exactly one type), and the validator checks the pair.
- `layer` is required for the semantic family only.

**Compatibility:** none of the 46 existing records changed type. URLs, exports and the default catalogue view are unchanged.

## A2. Licences and usage rights

- `license` (summary) is unchanged. `access` gains `registration`.
- New `licenses[]` holds **scoped** statements: `scope` (all, specification, model-files, documentation, software,
  model-weights, dataset, file-format), `name`, optional `spdx` and `url`, `statedAt` (where the publisher states it),
  `restrictions[]`, `commercialUse` (unknown, permitted, restricted, not-permitted), `reviewStatus`, `reviewNote`.
- Rules: `licenses[]` is required for the non-semantic families. `commercialUse ≠ unknown` requires `reviewStatus: reviewed`,
  and `permitted` additionally requires an SPDX identifier.
- Applied to existing records where the scope matters: IEEE CORA (standard text vs. CC BY 4.0 community OWL), SUMO
  (core vs. extensions), IEC CIM.

## B. Evidence, classification and limitations

- Sources gain `supports[]` (identity, scope, version, licence, status, capability, relationship, limitation). This
  separates **provenance** (`type`: who published the document) from **what the source is cited to establish**.
- Evidence types 1.0.0 → 2.0.0: added `publisher-repository` and `research-publication`; `third-party` relabelled
  "Third-party reference".
- `knowledge` gains `confidence` (clear, tentative) and an optional `rationale`.
- `limitations[]` items gain `category` (technical, scope, access, unverified-claim, catalogue-gap).
- Relations gain `evidence.type`, `status` (verified, partially-verified) and `conditions`. Third-party, editorial and
  unclassified evidence cannot establish a stored relation.
- Physical AI assignments need `classificationBasis.physicalAi`, plus a publisher, specification or peer-reviewed source
  that supports `capability`.

## Migration behaviour

`stripPhase2()` removes every v3 and v3.1 addition. A test compares the result with the pre-migration commit
(`8cdbb02`); the only permitted content difference is the documented editorial correction listed in
`DATA-QUALITY-REVIEW-2026-10.md` (B4).
