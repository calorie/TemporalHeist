import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/render/webgpu.ts', import.meta.url), 'utf8');
const literal = source.match(/const cube = new Float32Array\((\[[\s\S]*?\])\)/)?.[1];
assert.ok(literal, 'cube vertex array is present');
const cube = runInNewContext(literal);

function assertCubeMesh(mesh) {
  assert.equal(mesh.length, 108, 'a cube needs 12 triangles of 3 vertices with 3 coordinates');
  const faces = new Map();
  for (let i = 0; i < mesh.length; i += 9) {
    const vertices = [mesh.slice(i, i + 3), mesh.slice(i + 3, i + 6), mesh.slice(i + 6, i + 9)];
    assert.equal(new Set(vertices.map((vertex) => vertex.join(','))).size, 3, 'three distinct vertices');
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
    const first = new Set(triangles[0].map((vertex) => vertex.join(',')));
    const second = new Set(triangles[1].map((vertex) => vertex.join(',')));
    const shared = [...first].filter((corner) => second.has(corner));
    assert.equal(shared.length, 2, `${face} triangles share two vertices`);
    const unshared = [...corners].filter((corner) => !shared.includes(corner));
    for (const pair of [shared, unshared]) {
      const [a, b] = pair.map((corner) => corner.split(','));
      assert.equal(a.filter((value, axis) => value !== b[axis]).length, 2, `${face} face diagonal`);
    }
  }
}

assertCubeMesh(cube);
const degenerate = cube.slice();
degenerate.splice(3, 3, ...cube.slice(0, 3));
degenerate.splice(9, 3, ...cube.slice(3, 6));
assert.throws(() => assertCubeMesh(degenerate), /three distinct vertices/);
const overlap = cube.slice();
overlap.splice(12, 3, ...cube.slice(3, 6));
assert.throws(() => assertCubeMesh(overlap), /face diagonal/);
console.log('cube mesh tests passed');
