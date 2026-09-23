import assert from 'node:assert/strict';
import { guardVisuals } from '../src/guard-view.ts';

const GuardState = { PATROL: 1, INVESTIGATE: 2, RETURN: 3, UNRECOGNIZED: -1 };

const facility = {
  guards: [
    {
      id: 51,
      x: 17200,
      z: 4000,
      facingX: 1000,
      facingZ: 0,
      speedPerTick: 20,
      range: 2600,
      halfWidth: 1400,
      searchTicks: 180,
      waypoints: [
        { id: 511, x: 17200, z: 4000 },
        { id: 512, x: 20500, z: 4000 },
      ],
    },
  ],
};
const presentation = (state, overrides = {}) => ({
  live: [],
  echoes: [],
  renderTick: 105,
  guards: [
    {
      id: 51,
      xMm: 17300,
      zMm: 4050,
      facingX: 0,
      facingZ: -1000,
      state,
      waypointId: 512,
      investigationTarget: undefined,
      stateEnteredTick: 100,
      searchExpiresTick: 0,
      ...overrides,
    },
  ],
});

const patrol = guardVisuals(facility, presentation(GuardState.PATROL))[0];
assert.deepEqual(
  { id: patrol.id, x: patrol.x, z: patrol.z, range: patrol.range, halfWidth: patrol.halfWidth },
  { id: 51, x: 17300, z: 4050, range: 2600, halfWidth: 1400 },
);
assert.deepEqual(patrol.forward, [0, -1]);
assert.deepEqual(patrol.lateral, [1, 0]);
assert.deepEqual(patrol.bodyColor, [0.95, 0.72, 0.16, 1]);
assert.deepEqual(patrol.coneColor, [0.12, 0.75, 0.72, 0.22]);

const investigate = guardVisuals(
  facility,
  presentation(GuardState.INVESTIGATE, { investigationTarget: { xMm: 0, zMm: 0 } }),
)[0];
assert.deepEqual(investigate.bodyColor, [1, 0.18, 0.12, 1]);
assert.deepEqual(investigate.coneColor, [1, 0.08, 0.05, 0.4]);
assert.deepEqual(investigate.target, [0, 0]);

const returning = guardVisuals(facility, presentation(GuardState.RETURN))[0];
assert.deepEqual(returning.bodyColor, [0.35, 0.65, 1, 1]);
assert.deepEqual(returning.coneColor, [0.2, 0.45, 1, 0.25]);

const unknown = guardVisuals(
  facility,
  presentation(GuardState.UNRECOGNIZED, { facingX: 0, facingZ: 0 }),
)[0];
assert.deepEqual(unknown.forward, [1, 0]);
assert.deepEqual(unknown.lateral, [0, 1]);
assert.deepEqual(unknown.bodyColor, [0.55, 0.55, 0.6, 1]);
assert.deepEqual(unknown.coneColor, [0.45, 0.45, 0.5, 0.18]);

assert.deepEqual(guardVisuals(facility, { live: [], echoes: [], guards: [], renderTick: 0 }), []);
console.log('guard view tests passed');
