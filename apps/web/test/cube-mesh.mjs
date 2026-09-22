import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/render/webgpu.ts', import.meta.url), 'utf8');
const literal = source.match(/const cube = new Float32Array\((\[[\s\S]*?\])\)/)?.[1];
assert.ok(literal, 'cube vertex array is present');
const cube = runInNewContext(literal);
assert.equal(cube.length, 108, 'a cube needs 12 triangles of 3 vertices with 3 coordinates');

const faces = new Map();
for (let i = 0; i < cube.length; i += 9) {
  const vertices = [cube.slice(i, i + 3), cube.slice(i + 3, i + 6), cube.slice(i + 6, i + 9)];
  for (const vertex of vertices)
    for (const coordinate of vertex) assert.ok(coordinate === -1 || coordinate === 1);
  const fixed = [0, 1, 2].filter((axis) => vertices.every((vertex) => vertex[axis] === vertices[0][axis]));
  assert.equal(fixed.length, 1, `triangle ${i / 9} lies on exactly one cube face`);
  const face = `${fixed[0]}:${vertices[0][fixed[0]]}`;
  faces.set(face, [...(faces.get(face) ?? []), vertices]);
}

assert.equal(faces.size, 6, 'all six cube faces are present');
for (const [face, triangles] of faces) {
  assert.equal(triangles.length, 2, `${face} has two triangles`);
  const corners = new Set(triangles.flat().map((vertex) => vertex.join(',')));
  assert.equal(corners.size, 4, `${face} covers all four corners`);
}
console.log('cube mesh tests passed');
