import assert from 'node:assert/strict';
import { renderIfChanged } from '../src/render-cache.ts';

const cache = new Map();
let mutations = 0;
let node = {};
const firstNode = node;
const render = () => {
  mutations += 1;
  node = {};
};

assert.equal(renderIfChanged(cache, 'mission', 'current:steal', render), true);
assert.equal(mutations, 1);
const renderedNode = node;
assert.notEqual(renderedNode, firstNode);
assert.equal(renderIfChanged(cache, 'mission', 'current:steal', render), false);
assert.equal(mutations, 1, 'stable semantic state must not mutate the DOM');
assert.equal(node, renderedNode, 'stable semantic state must retain existing nodes');
assert.equal(renderIfChanged(cache, 'mission', 'complete:steal', render), true);
assert.equal(mutations, 2);

console.log('render cache tests passed');
