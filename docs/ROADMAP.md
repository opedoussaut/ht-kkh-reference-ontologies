# Enrichment roadmap — towards a Physical AI Knowledge & Technology Atlas

Status: proposal · Branch: `feature/physical-ai-atlas-enrichment` · Baseline: published `main` at `0200919`

The atlas evolves **by enrichment, not replacement**. The published ontology catalogue, the 12-industry navigation and
the navy design system stay in place. Each phase is shipped separately and needs the owner's approval before it is
merged.

## 1. Audit of the published atlas (baseline)

| Area | State | Reuse / gap |
| --- | --- | --- |
| Data model | One JSON record per ontology (`data/ontologies/<id>.json`), JSON Schema, provenance (`verification`), v1 legacy blocks | **Reuse as is.** It extends cleanly by adding optional fields, and the schema has `additionalProperties: false`, so every addition is explicit. |
| Taxonomies | 12 industries plus a horizontal *Cross-Industry* tag; 5 use cases; 7 relation types; 18 cited relations | **Reuse.** Coverage is uneven: Marine, Home & Lifestyle, CPG, Life Sciences and Cities had only 4–6 records each. |
| Discovery | Faceted catalogue (8 facets), typo-tolerant search, shareable URLs, graph, industry and use-case pages | **Reuse.** No facet for formats (OWL/SHACL/XML…), and few cross-references between related records beyond explicit relations. |
| Content | Each record has a factual summary and verified facts | Practical engineering uses were not described per record. |
| Link reliability | 95 unique URLs | 2 dead links (AAS landing page, ifcOWL IFC4 page). 3 publishers block automated checks (ISO, SUMO, GS1 namespace), but those URLs are valid. |
| Build / CI | `npm run build` / `validate` / `test`, GitHub Actions CI; Pages serves `main` root | **Reuse.** No link check existed. |
| Labels | `maturity` and `verification.status` exist | Their criteria were not stated in the UI. |

## 2. Phases

### Phase 1 — Strengthen the ontology atlas *(started on this branch)*
- Link-reliability tooling (`npm run links`) and fixes for dead links.
- Fill under-represented industries with verified public ontologies only.
- Add an editorial `engineeringUses` field per record, kept clearly apart from verified facts.
- Discovery: a *Format* facet, a *Has relationships* facet, and "used together" cross-references derived from use-case stacks.
- Publish explicit criteria for the maturity and verification labels.
- Backlog of candidate ontologies to evaluate next, each needing an authoritative public source: SAREF4AGRI, SAREF4WATR,
  ASHRAE 223P, RealEstateCore, OM 2, ODRL, ChEBI, the SSN/SOSA 2023 edition, SysML v2 semantic model mappings,
  and the IOF Maintenance and Supply Chain modules.

### Phase 2 — Additional knowledge and technology assets

> Detailed architecture: [PHASE2-ARCHITECTURE.md](PHASE2-ARCHITECTURE.md) (supersedes the outline below).

Goal: describe resources beyond ontologies without mixing them up.

**Proposed data-model change (substantial, so the migration comes first):**
1. Add `assetType` to the schema with a controlled vocabulary. `ontology` covers the current records; new values are
   `standard`, `reference-architecture`, `information-model`, `knowledge-graph`, `digital-twin-framework`,
   `ai-framework`, `model`, `simulation-tool`, `dataset`, `benchmark` and `tooling`. The existing `kind` field stays as
   a finer sub-type.
2. Add `purpose` (one sentence) and `domain` tags, and keep the existing `industries`.
3. For assets that are not purely specifications, record the licence per facet: `license.facets` with `code`,
   `weights`, `data` and `specification`. Open code does not imply open weights or open data.
4. Migration: a scripted, idempotent migration sets `assetType: "ontology"` on every existing record (no other
   change). It is followed by a schema bump and a test asserting that all pre-existing ids are still present.
   Generated exports keep their current shape. The v1-compatible JSON keeps listing ontologies only.
5. UI: an *Asset type* facet, a type label on every card, and distinct card accents per type. The catalogue still
   opens on ontologies by default, so the current experience is unchanged.

### Phase 3 — Physical AI perspective
An **additional exploration dimension** alongside industries:
- `physicalAi` tags with a controlled vocabulary: *perception & world modelling, reasoning & planning, robot
  capabilities & skills, embodied interaction, simulation & digital twins, safety / verification & validation,
  knowledge representation & interoperability*.
- A "Physical AI" landing page with one panel per entry point that links back into the catalogue. The General Purpose
  Robotics use case becomes its first worked example.
- Candidate assets come only from primary sources: standards bodies, official repositories and model cards. Vendor
  performance claims are labelled as such (see Phase 4).

### Phase 4 — Transparency and confidence indicators
Two independent labels, each with explicit criteria. Neither is a certification or an endorsement.

| Label | Values and criteria |
| --- | --- |
| **Maturity** (what the resource is) | *Standard*: published by a recognised standards body (ISO, IEC, IEEE, W3C, OGC, ETSI, OMG, DCMI). *Stable*: versioned public releases from a maintained community or consortium. *Emerging*: public and active but without stable releases or broad uptake. *Research*: described mainly in research publications or project outputs. *Legacy / Discontinued*: superseded or no longer maintained, according to its publisher. |
| **Verification** (how well the atlas has checked it) | *Verified*: publisher, version and licence confirmed on official pages on the date shown. *Partially verified*: official source confirmed, with at least one fact open (noted on the record). *Unverified*: no authoritative source yet; flagged for review. |
| **Evidence type** (Phase 3 assets) | *Specification* · *Peer-reviewed publication* · *Publisher-reported* (for example vendor results without independent replication) · *Community* (third-party implementation or benchmark). |

Phase 1 publishes the first two sets of criteria on the About page.

## 3. Principles
- Only public, citable information; no vendor or brand mappings.
- No invented ontologies, capabilities or ratings. When a fact cannot be confirmed, the record says so.
- Verified facts and editorial interpretation are labelled separately in both data and UI.
- Changes stay backward-compatible. Exports keep their shape, and the v1 records stay preserved.
