import assert from 'node:assert/strict';
import { extractionVisual, sceneClearColor, worldPixel } from '../src/presentation-view.ts';
import { map } from '../src/map.ts';
import { guardPrimitives } from '../src/render/guard-geometry.ts';

const RoomPhase = { ACTIVE: 2, WON: 3, FAILED: 4 };
const facility = {
  extraction: { minX: 22800, maxX: 23750, minZ: 3000, maxZ: 5000 },
};
const snapshot = (phase, echoOpenedFinalDoor = false) => ({
  room: { phase, echoOpenedFinalDoor },
});

const locked = extractionVisual(facility, snapshot(RoomPhase.ACTIVE));
assert.deepEqual(
  { x: locked.x, z: locked.z, sx: locked.sx, sz: locked.sz },
  { x: 23275, z: 4000, sx: 475, sz: 1000 },
);
assert(locked.color[1] < 0.5, 'extraction must stay dim before the Echo proof');

const unlocked = extractionVisual(facility, snapshot(RoomPhase.ACTIVE, true));
assert(unlocked.color[1] > 0.8, 'extraction must brighten after the Echo proof');

const won = extractionVisual(facility, snapshot(RoomPhase.WON, true));
const failed = extractionVisual(facility, snapshot(RoomPhase.FAILED));
assert(won.color[1] > won.color[0], 'success must read green');
assert(failed.color[0] > failed.color[1], 'failure must read red');
assert.deepEqual(sceneClearColor(snapshot(RoomPhase.WON, true)), [0.015, 0.09, 0.045, 1]);
assert.deepEqual(sceneClearColor(snapshot(RoomPhase.FAILED)), [0.11, 0.018, 0.025, 1]);
assert.deepEqual(sceneClearColor(undefined), [0.015, 0.035, 0.055, 1]);
assert.deepEqual(worldPixel(12000, 4000, 1280, 720), [640, 360]);
assert.deepEqual(worldPixel(23275, 4000, 1280, 720).map(Math.round), [1195, 360]);

const guard = {
  id: 51,
  xMm: 19100,
  zMm: 4000,
  facingX: -1000,
  facingZ: 0,
  state: 1,
  waypointId: 512,
  stateEnteredTick: 0,
  searchExpiresTick: 0,
};
const presentation = (state, investigationTarget) => ({
  live: [],
  echoes: [],
  guards: [{ ...guard, state, investigationTarget }],
  renderTick: 0,
});
const patrol = guardPrimitives(map, presentation(1));
assert.equal(patrol.cones.length, 1);
assert.deepEqual(patrol.cones[0].color, [0.12, 0.75, 0.72, 0.22]);
assert.deepEqual(patrol.cones[0].matrix, [0, 0, -1400, 0, 0, 20, 0, 0, -2600, 0, 0, 0, 19100, 400, 4000, 1]);
assert.equal(patrol.objects.length, 3, 'body, facing indicator, and authored route');
assert.deepEqual(patrol.objects[0].color, [0.95, 0.72, 0.16, 1]);
assert.deepEqual(
  [patrol.objects[1].x, patrol.objects[1].z, patrol.objects[2].x, patrol.objects[2].z],
  [18840, 4000, 19800, 4000],
);
assert(patrol.objects[2].y > patrol.cones[0].y + patrol.cones[0].sy, 'route stays visible over the cone');
const investigate = guardPrimitives(
  map,
  presentation(2, { xMm: 18000, zMm: 3000 }),
);
assert.deepEqual(investigate.cones[0].color, [1, 0.08, 0.05, 0.4]);
assert.equal(investigate.objects.length, 4, 'investigation target is drawn');
assert.deepEqual(investigate.objects.at(-1).color, [1, 0.18, 0.12, 1]);
assert(investigate.objects.at(-1).y > investigate.cones[0].y + investigate.cones[0].sy, 'target stays visible over the cone');
const returning = guardPrimitives(map, presentation(3));
assert.deepEqual(returning.cones[0].color, [0.2, 0.45, 1, 0.25]);
assert.deepEqual(returning.objects[0].color, [0.35, 0.65, 1, 1]);
assert.deepEqual(guardPrimitives(map, { ...presentation(1), guards: [] }), {
  cones: [],
  objects: [],
});
assert(
  2 + map.walls.length + map.doors.length + map.plates.length + map.terminals.length +
    map.cameras.length * 2 + 2 + 2 + 1 + investigate.cones.length + investigate.objects.length < 256,
  'authored scene and two players/two Echoes fit the persistent instance buffer',
);

console.log('presentation view tests passed');
