import assert from 'node:assert/strict';
import { extractionVisual, sceneClearColor, worldPixel } from '../src/presentation-view.ts';

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

console.log('presentation view tests passed');
