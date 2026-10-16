# Editorial policy — inclusion, neutrality and rights

This policy is published on the atlas About page and applies to every record.

## 1. Inclusion

A resource is included when **all** of the following hold:

1. It materially supports a documented engineering use: a use case, an engineering question or a capability in the taxonomy.
2. It has a public, authoritative description: a published specification, official documentation or a publisher repository.
3. Its identity, publisher and current version or release can be established from those sources. Otherwise the record
   says what is missing (`limitations` with category `catalogue-gap`).

Marketing pages, press releases and reseller material can add context, but they never qualify a resource for
inclusion on their own.

## 2. Vendor-neutral, not vendor-free

- Commercial and open-source resources are treated alike: same fields, same criteria, same labels.
- The publisher and publisher type are always visible.
- Capability statements taken only from a publisher's own material are shown as **publisher-stated**. Performance or
  results claims by a company about its own product are typed `vendor-reported`. Neither is independent verification.
- Inclusion implies no endorsement, certification or recommendation by the atlas, by any standards body or by any company.
- The atlas publishes no rankings. Any future comparison must apply transparent, documented criteria identically to
  every compared resource.
- No brand-relevance mappings or adoption claims are made for Dassault Systèmes products.

## 3. Rights and licences

- `license` is a short summary; `licenses[]` records statements **per scope**: specification text, model files,
  software, model weights, dataset, file format, documentation.
- Every scoped statement cites where the publisher states it (`statedAt`).
- `commercialUse` stays `unknown` until a review cites the licence text (`reviewStatus: reviewed`). `permitted`
  additionally requires an identified SPDX licence. The atlas does not give legal advice.
- An openly accessible website is not permission to redistribute or reuse its contents. Code, model weights and
  training data often carry different terms.

## 4. Relationships

- Stored relationships (`data/taxonomy/relations.json`) need a source typed as a specification, official
  documentation, publisher repository or peer-reviewed publication. Third-party and editorial sources cannot establish one.
- Each relationship records its evidence type, a verification status, and the conditions under which it applies when
  it is only partially verified.
- A relationship never implies functional interoperability. Suggested combinations ("used together", reference
  workflows) are editorial and drawn separately.

## 5. Corrections and review

- Factual corrections go in `corrections[]` with a source. Editorial changes are dated in `editorialReview`, and material
  changes are listed in the dated review reports (`docs/DATA-QUALITY-REVIEW-*.md`).
