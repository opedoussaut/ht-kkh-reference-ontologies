#!/usr/bin/env node
// Schema v3.1 (Phase 2 consolidation, 2026-10-16). One-off, idempotent structural update of the JSON Schema and the
// resource-type / evidence-type taxonomies. Kept for audit. See docs/PHASE2-CONSOLIDATION.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const wr = (p, v) => writeFileSync(join(ROOT, p), JSON.stringify(v, null, 2) + '\n');

// ---------- A1: resource types ----------
const rt = rd('data/taxonomy/resource-types.json');
rt._version = '2.0.0';
rt._note = 'Resource type = the nature of the artefact, independent of standardisation status (`maturity`) and of the knowledge it represents. v2.0.0: added specification family, reference-architecture, software-framework, ai-model, benchmark; removed the unused `framework` (split into reference-architecture and software-framework). `kind` is the finer sub-type from which the type is derived.';
rt.families = [
  { id: 'semantic', label: 'Ontologies & semantic models', default: true, summary: 'Machine-readable models of meaning and structure: ontologies, vocabularies, data schemas and modelling languages. The catalogue opens on this family.' },
  { id: 'specification', label: 'Standards & architectures', default: false, summary: 'Normative documents and reference architectures that do not provide a machine-readable model of their own.' },
  { id: 'technology', label: 'Engineering & AI technology', default: false, summary: 'Software frameworks, simulation platforms, AI frameworks, AI models, datasets and benchmarks.' },
];
rt.items = [
  { id: 'ontology', family: 'semantic', label: 'Ontology', summary: 'Formal model of concepts and relations with defined semantics (e.g. OWL, Common Logic).', fromKind: ['ontology'] },
  { id: 'vocabulary', family: 'semantic', label: 'Vocabulary / taxonomy', summary: 'Controlled terms, thesauri, classification systems or lightweight RDF vocabularies.', fromKind: ['vocabulary', 'classification'] },
  { id: 'data-schema', family: 'semantic', label: 'Data schema / exchange format', summary: 'Information model, meta-model or file format for describing and exchanging engineering data (e.g. EXPRESS, UML/MOF, URDF).', fromKind: ['information-model', 'meta-model', 'file-format'] },
  { id: 'modelling-language', family: 'semantic', label: 'Modelling language', summary: 'Language with defined syntax and semantics for building engineering models.', fromKind: ['modeling-language'] },
  { id: 'standard', family: 'specification', label: 'Technical standard / specification', summary: 'Normative document (requirements, test methods, terminology) without a machine-readable model of its own.', fromKind: ['specification'] },
  { id: 'reference-architecture', family: 'specification', label: 'Reference architecture', summary: 'Documented architecture pattern describing how components should be organised.', fromKind: ['reference-architecture'] },
  { id: 'software-framework', family: 'technology', label: 'Software framework / middleware', summary: 'Reusable software libraries, middleware or runtime used to build engineering systems (e.g. robotics middleware).', fromKind: ['software-framework', 'middleware'] },
  { id: 'simulation', family: 'technology', label: 'Simulation platform / environment', summary: 'Simulator, physics engine or simulation environment.', fromKind: ['simulator', 'physics-engine'] },
  { id: 'ai-framework', family: 'technology', label: 'AI framework / toolkit', summary: 'Software for building, training or evaluating AI systems. Not a model itself.', fromKind: ['ai-framework'] },
  { id: 'ai-model', family: 'technology', label: 'AI model', summary: 'A model architecture or a trained model (with or without published weights). `details.aiModel.artefact` says which; weights carry their own licence scope.', fromKind: ['model-architecture', 'trained-model'] },
  { id: 'dataset', family: 'technology', label: 'Dataset', summary: 'Published collection of data with stated provenance and licence.', fromKind: ['dataset'] },
  { id: 'benchmark', family: 'technology', label: 'Benchmark / evaluation protocol', summary: 'Task suite, metric set or test protocol used to evaluate systems. Not training data.', fromKind: ['benchmark', 'evaluation-protocol'] },
];
wr('data/taxonomy/resource-types.json', rt);
const kinds = rt.items.flatMap((t) => t.fromKind);

// ---------- B2 support: evidence types ----------
const ev = rd('data/taxonomy/evidence-types.json');
ev._version = '2.0.0';
const add = (after, item) => { if (!ev.items.some((x) => x.id === item.id)) ev.items.splice(ev.items.findIndex((x) => x.id === after) + 1, 0, item); };
add('published-specification', { id: 'publisher-repository', label: 'Publisher repository', summary: 'Source repository, release page or data archive maintained by the publisher (e.g. its GitHub organisation or Zenodo record).' });
add('peer-reviewed', { id: 'research-publication', label: 'Research publication (not peer-reviewed)', summary: 'Preprint, technical report or project paper without formal peer review (e.g. arXiv).' });
const ot = ev.items.find((x) => x.id === 'third-party');
ot.label = 'Third-party reference';
ot.summary = 'Registries, standards resellers, mailing lists, reseller tutorials or news. Supporting context only; never sole evidence for a capability.';
wr('data/taxonomy/evidence-types.json', ev);

// ---------- schema ----------
const s = rd('schema/ontology.schema.json');
s.title = 'Reference Ontology Atlas — resource record (schema v3.1)';
const P = s.properties;
P.kind = { description: 'Finer sub-type; determines resourceType via resource-types.json `fromKind`.', enum: kinds };
s.required = s.required.filter((k) => k !== 'layer'); // layer only applies to the semantic family (validated in code)

// A2: scoped licences
P.license.properties.access = { enum: ['open', 'open-with-terms', 'registration', 'licensed', 'unknown'] };
P.licenses = {
  description: 'Scoped licence statements (A2). Required for non-semantic resources. Code, model weights, datasets and specification text are licensed separately.',
  type: 'array',
  items: {
    type: 'object', additionalProperties: false,
    required: ['scope', 'name', 'statedAt', 'commercialUse', 'reviewStatus'],
    properties: {
      scope: { enum: ['all', 'specification', 'model-files', 'documentation', 'software', 'model-weights', 'dataset', 'file-format'] },
      name: { type: 'string', minLength: 2 },
      spdx: { type: 'string', pattern: '^[A-Za-z0-9.+-]+$' },
      url: { oneOf: [{ $ref: '#/definitions/url' }, { type: 'null' }] },
      statedAt: { $ref: '#/definitions/url', description: 'Where the publisher states this licence (evidence).' },
      restrictions: { type: 'array', items: { type: 'string', minLength: 10 } },
      commercialUse: { enum: ['unknown', 'permitted', 'restricted', 'not-permitted'] },
      reviewStatus: { enum: ['not-assessed', 'reviewed'] },
      reviewNote: { type: 'string' },
    },
  },
};

// B1: classification confidence + rationale
P.knowledge.required = ['domain', 'basis', 'confidence'];
P.knowledge.properties.confidence = { enum: ['clear', 'tentative'] };
P.knowledge.properties.rationale = { type: 'string', minLength: 10 };

// B3: limitation categories
const lim = P.limitations.items;
lim.required = ['text', 'basis', 'category'];
lim.properties.category = { enum: ['technical', 'scope', 'access', 'unverified-claim', 'catalogue-gap'] };

// B2: what each source is cited for
const src = s.definitions.source;
src.required = ['url', 'title', 'type', 'supports'];
src.properties.supports = { type: 'array', minItems: 1, uniqueItems: true, items: { enum: ['identity', 'scope', 'version', 'licence', 'status', 'capability', 'relationship', 'limitation'] } };

// Physical AI evidence basis
P.classificationBasis.properties.physicalAi = { enum: ['editorial', 'source'] };

// AI-model / dataset / benchmark details
P.details = {
  description: 'Type-specific extension keyed by resource type.',
  type: 'object', additionalProperties: false,
  properties: {
    aiModel: {
      type: 'object', additionalProperties: false, required: ['artefact', 'weightsPublished'],
      properties: {
        artefact: { enum: ['architecture', 'trained-model'] },
        weightsPublished: { enum: ['yes', 'no', 'unknown'] },
        baseModel: { type: 'string' },
        trainingData: { type: 'string' },
        modalities: { type: 'array', items: { type: 'string' } },
      },
    },
    dataset: {
      type: 'object', additionalProperties: false,
      properties: { modalities: { type: 'array', items: { type: 'string' } }, size: { type: 'string' }, collection: { type: 'string' }, embodiments: { type: 'string' } },
    },
    benchmark: {
      type: 'object', additionalProperties: false,
      properties: { evaluates: { type: 'string' }, metrics: { type: 'array', items: { type: 'string' } }, environment: { type: 'string' } },
    },
    standard: {
      type: 'object', additionalProperties: false,
      properties: { body: { type: 'string' }, designation: { type: 'string' }, edition: { type: 'string' } },
    },
  },
};
wr('schema/ontology.schema.json', s);
console.log(`Schema v3.1 written; ${kinds.length} kinds; ${rt.items.length} resource types; ${ev.items.length} evidence types.`);
