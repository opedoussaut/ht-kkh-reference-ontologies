# Reference Ontology Atlas

![Reference Ontology Atlas — Updated & Enriched](assets/images/reference-ontology-atlas-cover.png)

An evidence-based, cross-industry atlas of **public** reference ontologies and semantic standards for engineering.

**→ https://opedoussaut.github.io/ht-kkh-reference-ontologies/**

- **46 public knowledge resources** (34 ontologies, 7 vocabularies, 4 data schemas, 1 modelling language). Each one is described once, with its publisher, version, licence, official links and typed, cited verification sources.
- **Four independent discovery dimensions**: industry, knowledge domain, resource type and engineering capability, plus curated engineering questions such as *Which resources help connect engineering requirements with verification evidence?*
- **Cross-industry discovery** across 12 industries: Transportation & Mobility, Aerospace & Defense, Marine & Offshore,
  Industrial Equipment, High-Tech, Home & Lifestyle, Consumer Packaged Goods & Retail, Life Sciences & Healthcare,
  Infrastructure, Energy & Materials, Architecture, Engineering & Construction, Business Services, and Cities & Public
  Services, plus horizontal cross-industry foundations.
- **Engineering use cases**: AI Factories, General Purpose Robotics, Semiconductors, Sustainability & Circularity
  and Personal Electronics, each described as a layered reference semantic stack.
- **Interactive graph** that draws only relationships stated by the publisher or a primary source.
- **Ontology Explorer**: browse the classes, properties, restrictions and definitions of selected ontologies (SAREF Core, SOSA, SSN, QUDT), parsed at build time from their official distributions.
- **Faceted search** with typo tolerance and shareable URLs; a detail page for every ontology.
- Downloads: [`data/atlas.json`](data/atlas.json), the v1-compatible
  [`htkkh_reference_ontologies_map_catalog.json`](htkkh_reference_ontologies_map_catalog.json) and
  [`htkkh_reference_ontologies_map.ttl`](htkkh_reference_ontologies_map.ttl).

> Public information only. Every record cites its sources and the date they were checked.

## Develop

```bash
npm install
npm run build    # validate data + regenerate outputs
npm test
npm run serve    # http://localhost:8080
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the data model and review rules, [CLAUDE.md](CLAUDE.md) for the project
instructions, and [docs/AUDIT-2026-10.md](docs/AUDIT-2026-10.md) for the v1 audit and migration report.
