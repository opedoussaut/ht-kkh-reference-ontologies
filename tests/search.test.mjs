import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex, search, query, applyFilters, facetCounts, tokenize, normalize, stateFromParams, paramsFromState } from '../assets/js/lib/search.js';

const data = JSON.parse(readFileSync(new URL('../data/atlas.json', import.meta.url), 'utf8'));
const index = buildIndex(data.ontologies, data);
const ids = (q, filters = {}, sort) => query(data.ontologies, index, { q, filters, sort }).map((o) => o.id);

test('normalize strips accents and case', () => {
  assert.equal(normalize('Systèmes ÉTSI'), 'systemes etsi');
  assert.deepEqual(tokenize('IEEE 1872.2-2021, AuR'), ['ieee', '1872.2', '2021', 'aur']);
});

test('exact name match ranks first', () => {
  assert.equal(ids('sosa')[0], 'sosa');
  assert.equal(ids('brick')[0], 'brick');
});

test('prefix and standard-number search', () => {
  assert.ok(ids('prov').includes('prov-o'));
  assert.ok(ids('1872.1').includes('ieee-rtr'));
  assert.ok(ids('ISO/IEC 21838').includes('bfo'));
});

test('typo tolerance for longer words', () => {
  assert.ok(ids('provenence').includes('prov-o'));
});

test('multi-word queries use AND semantics', () => {
  const r = ids('robot parts');
  assert.ok(r.includes('ieee-rparts'));
  assert.ok(!r.includes('qudt'));
});

test('legacy names are searchable', () => {
  assert.ok(ids('CIM').includes('dmtf-cim'));
  assert.ok(ids('CIM').includes('iec-cim'));
});

test('empty query returns everything sorted by name', () => {
  const r = query(data.ontologies, index, {});
  assert.equal(r.length, data.ontologies.length);
  const names = r.map((o) => o.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test('filters: OR within a facet, AND across facets', () => {
  const energy = applyFilters(data.ontologies, { industry: ['energy-materials'] });
  const either = applyFilters(data.ontologies, { industry: ['energy-materials', 'aerospace-defense'] });
  assert.ok(either.length >= energy.length);
  const both = applyFilters(data.ontologies, { industry: ['energy-materials'], access: ['licensed'] });
  for (const o of both) {
    assert.ok(o.industries.includes('energy-materials'));
    assert.equal(o.license.access, 'licensed');
  }
});

test('brand facet includes evidence-only brands', () => {
  const r = applyFilters(data.ontologies, { brand: ['solidworks'] }).map((o) => o.id);
  assert.ok(r.includes('step-ap242'));
});

test('facet counts ignore their own facet selection', () => {
  const counts = facetCounts(data.ontologies, { industry: ['high-tech'] }, 'industry');
  assert.ok(counts['energy-materials'] > 0, 'other industry values remain countable');
});

test('search search() returns scores sorted descending', () => {
  const r = search(index, 'ontology');
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
});

test('URL state round-trips', () => {
  const s = { q: 'sensor data', sort: 'name', filters: { industry: ['high-tech', 'energy-materials'], verification: ['verified'] } };
  const back = stateFromParams(paramsFromState(s));
  assert.deepEqual(back, s);
});
