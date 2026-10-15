# Reference Ontology Atlas

An evidence-based, cross-industry atlas of **public** reference ontologies and semantic standards for engineering.

**→ https://opedoussaut.github.io/ht-kkh-reference-ontologies/**

- **42 ontologies.** Each record carries its publisher, version, licence, official links and cited verification sources.
- **Cross-industry discovery**: High-Tech, Industrial Equipment, Aerospace & Defense, Transportation & Mobility,
  Energy & Materials, Infrastructure & Cities, Life Sciences, Consumer Goods, plus cross-industry foundations.
- **Engineering use cases**: AI Factories, General Purpose Robotics, Semiconductors, Sustainability & Circularity
  and Personal Electronics, each described as a layered reference semantic stack.
- **Brand relevance** for CATIA, SIMULIA, ENOVIA, DELMIA, NETVIBES, BIOVIA, GEOVIA, 3DEXCITE and SOLIDWORKS. Editorial
  *potential relevance* is shown separately from *public evidence*, and each piece of evidence is cited.
- **Interactive graph** that draws only relationships stated by the publisher or a primary source.
- **Faceted search** with typo tolerance and shareable URLs; a detail page for every ontology.
- Downloads: [`data/atlas.json`](data/atlas.json), the v1-compatible
  [`htkkh_reference_ontologies_map_catalog.json`](htkkh_reference_ontologies_map_catalog.json) and
  [`htkkh_reference_ontologies_map.ttl`](htkkh_reference_ontologies_map.ttl).

> Public information only. This is not an official Dassault Systèmes publication. Product and brand names belong to
> their respective owners.

## Develop

```bash
npm install
npm run build    # validate data + regenerate outputs
npm test
npm run serve    # http://localhost:8080
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the data model and review rules, [CLAUDE.md](CLAUDE.md) for the project
instructions, and [docs/AUDIT-2026-10.md](docs/AUDIT-2026-10.md) for the v1 audit and migration report.
