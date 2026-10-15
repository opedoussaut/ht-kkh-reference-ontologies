# Resource taxonomy — discovery dimensions and controlled vocabularies

Status: **proposed v0.1.0**. The files live in `data/taxonomy/proposed/`, are validated by tests, and are not yet
referenced by records.

The atlas classifies every resource along **independent** dimensions. None is derived from another, and a resource is
never duplicated to appear in several places.

| Dimension | Question | Cardinality | File |
| --- | --- | --- | --- |
| Industry | Which industries can benefit? | 1..n | `data/taxonomy/industries.json` (in use) |
| Knowledge domain | What engineering knowledge does it represent? | exactly 1 primary sub-domain (or `not-assessed`) | `proposed/knowledge-domains.json` |
| Resource type | What kind of artefact is it? | exactly 1 | `proposed/resource-types.json` |
| Engineering capability | What can engineers and AI systems do with it? | 0..n | `proposed/capabilities.json` |
| Physical AI | Which Physical AI area does it serve? | 0..n (empty in Phase 2) | `proposed/physical-ai.json` |
| Evidence type | What kind of source supports a statement? | per source or claim | `proposed/evidence-types.json` |

Example: SAREF4INMA is an *ontology* (type) about *manufacturing processes & methods* (knowledge). It serves
*Industrial Equipment* and *High-Tech* (industries) and supports *manufacturing & operations* and *supply chain &
traceability* (capabilities).

## Versioning and configuration

- Each taxonomy file carries `_version` (semver) and `_status` (`proposed` → `active` → `deprecated`).
- Ids are stable and never reused. Labels can change freely; ids cannot.
- Removing an id is a major version bump and requires a migration of all records that use it.
- Tests check unique ids, required labels, and that every reference from a record or mapping resolves.

## Resource types

Two families keep fundamentally different things apart:

- **Ontologies & semantic models** (default view): `ontology`, `vocabulary`, `data-schema`, `modelling-language`.
- **Engineering & AI technology**: `standard`, `dataset`, `framework`, `simulation`, `ai-framework`.

The resource type describes the artefact's nature. Standardisation status is separate (`maturity`). For example,
SAREF is an *ontology* published as an ETSI Technical Specification, so its maturity is *Standard*.

## Knowledge domains — public taxonomy and reference alignment

The public taxonomy has four top-level domains: *Products, systems & assets*, *Organisations, people & processes*,
*Business, commerce & supply*, and *Foundational & scientific knowledge*. Each has 4–9 sub-domains. The wording is the
atlas's own, written for a public audience.

Alignment with an organisation's internal reference classification (for example a Knowledge & Know-How framework)
works as follows:

- The exact source terminology is preserved **only** in a crosswalk file outside the public repository:
  `private/reference-crosswalk.json`, which is git-ignored. Its format is
  `{ "<atlas sub-domain id>": { "referenceCategory": "<exact term>", "referenceSubcategory": "<exact term>", "match": "exact" | "broader" | "narrower" | "related" } }`.
- No internal category names, structures or documents are published in the repository or on the site.
- Publishing an attributed alignment is a separate decision that requires authorisation for publication and reuse.
- When no atlas sub-domain fits, the record uses `not-assessed` rather than a forced match.

## Engineering capabilities

The capabilities are: interoperability & data exchange; digital twins & asset information; requirements & systems
engineering; simulation, verification & validation; manufacturing & operations; supply chain & traceability;
sustainability & compliance; IoT, sensing & monitoring; knowledge graphs & AI reasoning; data cataloguing &
provenance; spatial, building & facility modelling; robotics & autonomy; energy systems & flexibility.

## Physical AI (proposed application categories)

Perception & world modelling · Reasoning & planning · Robot capabilities & control · Embodied interaction ·
Simulation & digital twins · Sim-to-real transfer · Safety, testing & validation · Semantic interoperability.

These are proposed atlas categories, not an established formal taxonomy. They are maintained independently of
industry and resource type, and no resource is assigned to them in Phase 2.

## Classification basis

Each classification records whether it is directly supported by a source or is an editorial mapping
(`basis: "source" | "editorial"`). Editorial is the default and is displayed as such.
