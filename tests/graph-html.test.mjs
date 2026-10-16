import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGraph, layout, neighbours } from '../assets/js/lib/graph.js';
import { html, raw, esc, safeUrl } from '../assets/js/lib/html.js';

const bundle = JSON.parse(readFileSync(new URL('../data/atlas.json', import.meta.url), 'utf8'));
// The app works on all resources (the bundle's `ontologies` key is the semantic-family alias).
const data = { ...bundle, ontologies: bundle.resources };

test('graph contains only connected nodes by default', () => {
  const g = buildGraph(data.ontologies, data.relations);
  const linked = new Set(data.relations.flatMap((r) => [r.source, r.target]));
  assert.equal(g.nodes.length, linked.size);
  assert.equal(g.links.length, data.relations.length);
  const all = buildGraph(data.ontologies, data.relations, { includeIsolated: true });
  assert.equal(all.nodes.length, data.ontologies.length);
});

test('graph filters by relation type', () => {
  const g = buildGraph(data.ontologies, data.relations, { types: ['part-of'] });
  assert.ok(g.links.every((l) => l.type === 'part-of'));
  assert.ok(g.nodes.every((n) => g.links.some((l) => l.source === n.id || l.target === n.id)));
});

test('layout is deterministic and finite', () => {
  const a = layout(buildGraph(data.ontologies, data.relations), { width: 800, height: 600, iterations: 120 });
  const b = layout(buildGraph(data.ontologies, data.relations), { width: 800, height: 600, iterations: 120 });
  for (let i = 0; i < a.nodes.length; i++) {
    assert.ok(Number.isFinite(a.nodes[i].x) && Number.isFinite(a.nodes[i].y));
    assert.equal(a.nodes[i].x, b.nodes[i].x);
  }
});

test('neighbours of CORA include its IEEE 1872 modules', () => {
  const n = neighbours(buildGraph(data.ontologies, data.relations), 'ieee-cora');
  for (const id of ['ieee-corax', 'ieee-rparts', 'ieee-pos', 'ieee-aur', 'sumo']) assert.ok(n.has(id), id);
});

test('html escapes interpolations but not nested templates', () => {
  const evil = '<img src=x onerror=alert(1)>';
  assert.equal(String(html`<p>${evil}</p>`), `<p>${esc(evil)}</p>`);
  assert.equal(String(html`<div>${html`<b>${'a&b'}</b>`}</div>`), '<div><b>a&amp;b</b></div>');
  assert.equal(String(html`${raw('<i>ok</i>')}`), '<i>ok</i>');
  assert.equal(String(html`${['<a>', '<b>']}`), '&lt;a&gt;&lt;b&gt;');
});

test('safeUrl only allows http(s)', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('https://w3.org'), 'https://w3.org');
});
