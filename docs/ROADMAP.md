# Roadmap — Reference Ontology Atlas

Status as of 2026-10-16 on `feature/physical-ai-atlas-enrichment`. The published site (`main`) still shows the release of
2026-10-15. This file describes **what is actually in the repository**. The original phase plan is kept in git history.

## 1. Completed (merged to `main` and published)

- Catalogue v2: 42 records, vendor-neutral, navy design system, 12 industries, Atlas network graph, use cases.

## 2. Implemented on the feature branch, awaiting review

| Area | What exists | Reference |
| --- | --- | --- |
| Phase 1 enrichment | 46 records; link checker (`npm run links`); editorial engineering uses; Format facet; "used together" cross-references; label criteria | `docs/AUDIT-2026-10.md` |
| Phase 2 data model | Schema v3 → **v3.1**: resource types, knowledge domains, capabilities, typed and scoped evidence, scoped licences, limitation categories, classification confidence | `docs/PHASE2-ARCHITECTURE.md`, `docs/PHASE2-CONSOLIDATION.md` |
| Migration | 46 records migrated with a no-loss check; idempotent | `scripts/phase2/migrate.mjs` |
| Data-quality review | 13 tentative classifications reviewed (2 revised, 6 still tentative); 67 unique source URLs (73 citations) typed and annotated; 32 limitations on 25 records; 1 editorial correction | `docs/DATA-QUALITY-REVIEW-2026-10.md` |
| Discovery UI | Engineering questions; capability, knowledge-domain and resource-type facets; resource families; seven-section detail pages; `#/resource/<id>` route with `#/ontology/<id>` alias | `assets/js/app.js` |
| Ontology Explorer pilot | 4 interactive ontologies (SAREF Core, SOSA, SSN, QUDT) parsed at build time; availability status for every record | `docs/ONTOLOGY-EXPLORER.md` |
| Atlas network | Relation categories (formal, mapping, shared) with an editorial overlay | — |
| Editorial policy | Inclusion, neutrality and rights policy on the About page | `docs/EDITORIAL-POLICY.md` |
| Safeguards | Internal-host, vendor-product and internal-classification checks; `private/` ignored; no PDFs tracked | `docs/PUBLIC-DATA-GOVERNANCE.md` |

## 3. Remaining data-quality work

- 6 knowledge-domain classifications remain **tentative** by design: DMTF CIM, IEC CIM, ISO 15926-14, OEO, ORIONT, SAREF4CITY.
- ORIONT is still **unverified** (no public source found).
- 20 records have no evidence-backed relationship, and 15 have no version date (QUDT lost its date when corrected to 3.5.2: the schema file states no date).
- Records with `limitations: []` have not been assessed for limitations. That does not mean they have none.
- Licence `reviewStatus` is `not-assessed` for all existing semantic records.
- Third-party-only identity evidence: ISO 15926-14 and STEP AP242 (the ISO catalogue blocks automated checks).

## 4. Proposed (designed, not built)

- Physical AI exploration axis (categories defined in `data/taxonomy/physical-ai.json`, plus evidence rules). See Checkpoint 3.
- More Explorer ontologies (SAREF extensions, PROV-O, BFO) and RDF/XML and JSON-LD parsing.
- An attributed alignment with an organisation's reference classification. This requires authorisation; the internal crosswalk stays private.
- A periodic re-verification flag for records not checked for 12 months.

## 5. Explicitly deferred

- Rankings or comparative scoring of resources.
- SPARQL endpoint, side-by-side ontology comparison and cross-ontology concept mapping. These need published alignment files.
- AI-assisted natural-language discovery.
- Rewriting git history to remove internal links from pre-v2 commits (owner decision pending).
