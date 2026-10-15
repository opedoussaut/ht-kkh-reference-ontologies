# Ontology Explorer — architecture assessment and pilot

Status: **pilot** on `feature/physical-ai-atlas-enrichment`. It is isolated from the catalogue and from the Phase 2
schema migration, and adds no fields to resource records.

## 1. Goal

Let an engineer open a catalogued ontology and navigate its **actual** semantic structure (classes, properties,
domains and ranges, restrictions, equivalences, disjointness, annotations, individuals, imports) without knowing OWL or
RDF. Source-defined semantics and editorial interpretation are kept visibly separate.

## 2. Options assessed

| Concern | Options | Decision |
| --- | --- | --- |
| Hosting | Server-side triple store / SPARQL endpoint vs. **static files** | **Static.** GitHub Pages has no server, so ontologies are parsed **at build time** into compact, versioned JSON and loaded on demand. |
| Parsing | RDFLib (Python), **N3.js** (JavaScript), rdflib.js | **N3.js** (MIT, mature, Turtle / N-Triples / TriG / N3). It keeps a single Node toolchain. RDFLib would add Python to CI for no gain at pilot scope. RDF/XML (`rdfxml-streaming-parser`, MIT) and JSON-LD (`jsonld`) will be added when a selected ontology needs them. |
| Rendering | **Cytoscape.js**, the existing custom SVG graph, D3, WebVOWL | **Cytoscape.js** (MIT) for the explorer: fit/zoom/pan, layouts, batch updates and good performance for hundreds of nodes. It is vendored as a pinned ES module, with no CDN at runtime. The existing dependency-free SVG graph stays for the Atlas Network. |
| Notation | VOWL (WebVOWL / VOWLGrapher) | Used as a **design reference only**. Classes are circles, datatypes are rectangles and properties are labelled edges; subclass edges are distinct from property edges. WebVOWL's full notation is not reproduced. Clarity takes priority. |
| Accessibility | Canvas graphs are not screen-reader friendly | The **hierarchy tree and the inspector are the accessible primary path** (keyboard-navigable buttons, text). The graph is a visual complement, labelled as such. |

## 3. Pipeline

```
data/explorer/sources.json        pinned official distribution URL, format, licence, size limit
        │  npm run graphs  (network; run by maintainers, not in CI)
        ▼
.cache/explorer/<id>/<sha256>.ttl  raw download (git-ignored), integrity hash recorded
        │  scripts/explorer/extract.mjs (pure; unit-tested on fixtures)
        ▼
assets/graphs/<id>/<version>.json  compact graph, versioned by owl:versionInfo / versionIRI
data/explorer/manifest.json        availability status for every catalogue record, plus asset path, sha256, counts
```

Safeguards:
- **No recursive import resolution.** `owl:imports` are listed and linked, never downloaded. Imported terms that are
  referenced appear as *external* stubs (IRI and label only when the source declares one).
- **Limits.** 5 MB per source, a 60 s timeout, and http(s) only. A parse error fails the build for that source but does not affect the others.
- **Integrity.** The sha256 of each downloaded source is stored in the manifest and the asset. A re-run with an unchanged hash reuses the cached output (caching by source version).
- **Licence.** Every pilot is redistributable with attribution (ETSI Software License, W3C Software and Document License, CC BY 4.0). Each asset carries its licence and source URL. A record whose licence does not allow redistribution can only be *documentation-only*.

## 4. Availability statuses (per catalogue record)

| Status | Meaning |
| --- | --- |
| `interactive` | A parsed graph asset exists and can be explored. |
| `source-available` | A public machine-readable distribution is known (link recorded), but it has not been processed yet. |
| `documentation-only` | Only documentation or a purchasable standard text is available. No machine-readable ontology is known to be public. |
| `unavailable` | No public source, or the format is not an RDF/OWL ontology (for example EXPRESS, MOF/UML, SysML). |
| `not-assessed` | Not yet reviewed. This is the honest default. |

The explorer never builds a graph from a description. Records without the `interactive` status show an explanation and
their official links instead.

## 5. Graph asset format (`atlas-ontology-graph/1`)

```json
{
  "format": "atlas-ontology-graph/1",
  "ontology": { "atlasId": "sosa", "iri": "http://www.w3.org/ns/sosa/", "versionInfo": "…", "title": "…",
                "imports": [], "prefixes": { "sosa": "http://www.w3.org/ns/sosa/" },
                "source": { "url": "…", "sha256": "…", "bytes": 27326, "retrievedOn": "2026-10-15",
                            "license": "…", "licenseUrl": "…" } },
  "stats": { "triples": 0, "classes": 0, "objectProperties": 0, "datatypeProperties": 0, "individuals": 0 },
  "entities": [ { "id": "<full IRI>", "t": "class|objectProperty|datatypeProperty|annotationProperty|individual",
                  "label": "…", "definition": "…", "annotations": [{ "p": "<IRI>", "v": "…", "lang": "en" }],
                  "external": false } ],
  "edges": [ { "s": "<IRI>", "o": "<IRI>", "t": "subClassOf|subPropertyOf|domain|range|equivalentClass|disjointWith|inverseOf|type|restriction",
               "p": "<property IRI, restrictions only>", "k": "some|all|value|min|max|exact" } ],
  "notes": { "complexExpressions": 0 }
}
```

Identifiers are the original IRIs. Labels are the source's `rdfs:label` / `skos:prefLabel`, with English preferred.
Definitions come from `skos:definition`, `rdfs:comment` or `dcterms:description`, in that order.

## 6. UI

`#/explore/<atlasId>?c=<IRI-encoded concept>` deep-links to a concept.

- **Left:** searchable hierarchy (classes; property and individual lists), entity-type filter, namespace filter.
- **Centre:** Cytoscape graph with fit, zoom, a hierarchy/network layout switch, relationship-type filters, focus mode, and expand-on-demand from the selected concept. The initial view is capped at 60 nodes.
- **Right:** inspector showing label and IRI, source definition and annotations, parents and children, properties (as domain and as range), restrictions, equivalences and disjointness, and the source ontology, version and licence. The atlas's editorial engineering uses appear in a separate, labelled block.

## 7. Atlas Network (catalogue-level graph)

Relation types are grouped into categories, each shown with its own line style:
**formal** (imports, extends, part of), **mapping** (aligns with), **shared** (references, follows pattern of, integrated into) and **editorial** (used together in a reference stack). The editorial category is off by default and dashed.
No relation implies functional interoperability.

## 8. Extension points (not implemented)

- **Comparison and mapping**: assets share one format, so two can be loaded side by side. Cross-ontology links would only come from published alignment files (for example SSSOM), never be inferred.
- **SPARQL**: assets keep IRIs, so a future in-browser store (for example Comunica over the original sources) can coexist.
- **Natural-language discovery**: it would search labels and definitions in the assets, and answers would cite IRIs.
- **Use-case overlays and gap analysis**: highlight concepts referenced by an editorial use-case stack, labelled editorial.
- **Export**: PNG and JSON export of the current view (Cytoscape supports both).

## 9. Pilot ontologies

| Atlas id | Source | Licence |
| --- | --- | --- |
| `saref-core` | ETSI SAREF Core v4.1.1 (Turtle) | ETSI Software License |
| `sosa` | W3C SOSA namespace document (Turtle) | W3C Software and Document License |
| `ssn` | W3C SSN namespace document (Turtle) | W3C Software and Document License |
| `qudt` | QUDT schema (Turtle) | CC BY 4.0 |
