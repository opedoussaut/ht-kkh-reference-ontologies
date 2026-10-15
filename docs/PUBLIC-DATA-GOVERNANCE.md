# Public data governance

The atlas is a **public, independent** reference. This document defines what may be published, how claims are
evidenced, and how editorial content is reviewed.

## 1. Publication safeguards

**Allowed:** publicly available, citable information, in the atlas's own words; short factual descriptions; links to
official sources.

**Never published:**
- internal company taxonomies, documents, strategy, processes, portfolio information or internal links;
- source documents supplied for alignment (PDFs or other files, including excerpts);
- text copied from proprietary standards, beyond the titles and designations needed to identify them;
- statements implying endorsement by publishers, standards bodies or any company;
- vendor, product or brand mappings, or adoption claims.

**Technical safeguards (enforced by `npm test`):**
- known internal hosts and markers are rejected in all published files;
- vendor product names are rejected in site and data files;
- reference-classification category names are rejected in published files;
- `private/` is git-ignored and is where any internal crosswalk lives;
- PDF files are rejected anywhere in the repository.

Any future internal integration is a separate project. It may consume the public data, but it must not feed internal
content back into this repository.

## 2. Evidence model

Every source and every claim has an evidence type (`data/taxonomy/proposed/evidence-types.json`):

| Type | Examples | Can support |
| --- | --- | --- |
| Official publisher documentation | Publisher web pages, official repositories, model cards | Facts about the resource (version, licence, scope) |
| Published standard or specification | Standards-body catalogue entry or text | Normative status, designation, edition |
| Peer-reviewed research | Journal or conference papers | Methods and research results |
| Public project documentation | CORDIS pages, project deliverables | Project origin and scope |
| Independent verification | Third-party tests or reviews | Performance or interoperability claims |
| Vendor-reported claim | A company describing its own product or results | Only the fact that the vendor claims it, always labelled |
| Other third-party | Registries, reseller pages, news | Supporting context only |
| Editorial interpretation | Atlas editors | Engineering uses, use-case stacks, classifications, "used together" |

Principles:
- A live website is not proof of accuracy, maintenance, interoperability or industrial suitability.
- Confidence is never raised just because a link works.
- A relationship between two resources does not imply functional interoperability. Formal relationships (cited) and
  editorial "used together" groupings are always displayed separately.
- Each claim should be traceable to a source where practical. Editorial claims carry the editorial label and a review date.

## 3. Roles and responsibilities (generic)

| Activity | Contributor | Editor | Maintainer | Owner |
| --- | --- | --- | --- | --- |
| Propose a resource or correction | R | C | I | I |
| Verify sources and facts | S | R | C | I |
| Write editorial content (uses, classifications) | S | R | C | I |
| Approve taxonomy changes | C | S | R | A |
| Merge to `main` (publishes the site) | – | C | R | A |
| Decide on publishing any reference alignment | – | C | C | A |

R = responsible, A = accountable, S = supports, C = consulted, I = informed.

## 4. Review cycle

- `verification.checkedOn` is updated whenever facts are re-checked. `editorialReview.reviewedOn` is updated whenever editorial content is reviewed.
- Records not checked for 12 months are flagged for re-verification (planned check in `npm run validate`).
- Run `npm run links` before every release. A 404/410 must be fixed; a 403 or 429 is checked by hand.
- Corrections are recorded in `corrections[]` with their source, and are never applied silently.
