# Release readiness — feature/physical-ai-atlas-enrichment (2026-10-19)

## Status

| Check | Result |
| --- | --- |
| `npm run validate` | Pass: 58 resources, 31 relations, 6 use cases; generated files current |
| `npm test` | **92 pass, 0 fail, 1 skipped** (the skipped test checks a private crosswalk that does not exist locally yet) |
| Browser: home → question → ecosystem → resource detail → map | Pass (navy and light themes; desktop 800–1440 px; mobile 375 px; no horizontal overflow, no console errors) |
| `npm run links` | 127 of 131 URLs OK. GS1 namespace and ontologyportal.org block bots (403; known, valid). technical.buildingsmart.org returned 500 for the whole site on 2026-10-19: **recheck before release** |
| `main` / live site | Unchanged |

## What the next version contains

- Schema v3.1: 12 resource types in three families; scoped licences; typed and annotated evidence; limitation categories; classification confidence.
- 58 resources: the original 46 (all preserved, with no data loss against the pre-migration commit) plus 12 robot-ecosystem resources.
- Robot development reference ecosystem with 10 documented technical relationships and an editorial workflow.
- Ontology Explorer pilot (SAREF Core, SOSA, SSN, QUDT).
- Inclusion, neutrality and rights policy on the About page.
- Text-free homepage background (62 KB WebP at full width, from a 1.66 MB source) behind an HTML "Ontology Atlas" wordmark.

## Needed before merging into `main`

1. **Owner review of editorial content.** Six tentative classifications; engineering uses; the selection and "why it matters" notes of the robot ecosystem; the six engineering questions; the reference workflow.
2. **Recheck buildingSMART** (ifcOWL record) once the site is back.
3. **Decide on the partially verified records**: ROS 2, URDF, Isaac Sim, LeRobot, Open X-Embodiment, ISO 10218-1. They can ship labelled as they are, or be confirmed by hand.
4. **Open a pull request** to `main` so CI runs on the merge result. The CI runner installs `sharp` as a dev dependency, but the build does not use it.
5. Optional, but recommended before wide circulation:
   - choose a repository licence for code and data;
   - decide whether to rewrite git history to remove the pre-v2 internal links.

## Not blocking a public release

- Private KKH alignment (Checkpoint 2). The safeguards are in place; the documents are not on this machine yet.

## Recommendation

**Ready for review as a public preview, not yet for production merge.** All automated checks pass, and every new fact is
sourced, dated and labelled. What remains is editorial judgement that only the owner can give (items 1 and 3), plus a
recheck of one external site. Once those are done, merging is low-risk: every pre-existing record, route and export is
covered by backward-compatibility tests.
