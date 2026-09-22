import assert from 'node:assert/strict';
import { clipDepth, surveillanceVisuals } from '../src/surveillance-view.ts';

const map = {
  cameras: [
    { id: 41, x: 4500, z: 7500, directionX: 0, directionZ: -1000, range: 2200, halfWidth: 1200 },
  ],
};

const idle = surveillanceVisuals(map, undefined)[0];
assert.equal(idle.id, 41);
assert.equal(idle.detected, false);
assert.deepEqual(idle.forward, [0, -1]);
assert.deepEqual(idle.lateral, [1, 0]);
assert(clipDepth(idle.coneY - idle.coneHalfHeight) >= 0);
assert(clipDepth(idle.coneY + idle.coneHalfHeight) <= 1);
assert(clipDepth(-220) <= 1, 'floor must be inside WebGPU clip depth');
assert(clipDepth(760) >= 0, 'tallest geometry must be inside WebGPU clip depth');
assert.deepEqual(idle.bodyColor, [0.95, 0.72, 0.16, 1]);
assert.deepEqual(idle.coneColor, [0.12, 0.75, 0.72, 0.22]);

const detected = surveillanceVisuals(map, {
  hazards: [{ id: 41, active: true, detectedPlayerId: 2 }],
})[0];
assert.equal(detected.detected, true);
assert.equal(detected.detectedPlayerId, 2);
assert.deepEqual(detected.bodyColor, [1, 0.18, 0.12, 1]);
assert.deepEqual(detected.coneColor, [1, 0.08, 0.05, 0.4]);

console.log('surveillance view tests passed');
