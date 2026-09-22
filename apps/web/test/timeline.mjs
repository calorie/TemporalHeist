import assert from 'node:assert/strict';
import { Timeline } from '../src/timeline.ts';
import './room-hud.mjs';

const snapshot = (epoch, tick, players, guards) => ({
  protocolMajor: 1, roomEpoch: epoch, serverTick: tick, players,
  echoes: [], plates: [], doors: [], actions: [], sessions: [],
  ...(guards === undefined ? {} : { guards }),
});
const pose = (playerId, xMm, zMm = 0) => ({ playerId, xMm, zMm, sourceTick: 0, echo: false });
const guard = (overrides = {}) => ({
  id: 51,
  xMm: 17200,
  zMm: 4000,
  facingX: 1000,
  facingZ: 0,
  state: 1,
  waypointId: 511,
  investigationTarget: undefined,
  stateEnteredTick: 600,
  searchExpiresTick: 0,
  ...overrides,
});

const timeline = new Timeline(3);
timeline.add(snapshot('a', 603, [pose(1, 30)]));
timeline.add(snapshot('a', 600, [pose(1, 0), pose(2, 0)]));
timeline.add(snapshot('a', 606, [pose(1, 60), pose(2, 60)]));
timeline.add(snapshot('a', 603, [pose(1, 33)]));
assert.deepEqual(timeline.inspect(), { epoch: 'a', length: 3, firstTick: 600, latestTick: 606 });
assert.deepEqual(timeline.presentation(1203).echoes, [{ playerId: 1, xMm: 33, zMm: 0, sourceTick: 603 }]);
assert.deepEqual(timeline.presentation(1204.5).echoes, [{ playerId: 1, xMm: 46.5, zMm: 0, sourceTick: 604.5 }]);
assert.deepEqual(timeline.presentation(1201.5).echoes.map((item) => item.playerId), [1]);
assert.deepEqual(timeline.presentation(1199).echoes, []);
assert.deepEqual(timeline.presentation(1207).echoes, []);

timeline.add(snapshot('b', 1, [pose(1, 1)]));
assert.deepEqual(timeline.inspect(), { epoch: 'b', length: 1, firstTick: 1, latestTick: 1 });
assert.equal(timeline.add(snapshot('a', 999, [pose(1, 999)])), false);
assert.equal(timeline.epoch, 'b');

const guardTimeline = new Timeline();
guardTimeline.add(snapshot('guards', 100, [], [guard()]));
guardTimeline.add(snapshot('guards', 110, [], [
  guard({
    xMm: 17400,
    zMm: 4100,
    facingX: 0,
    facingZ: -1000,
    state: 2,
    waypointId: 512,
    investigationTarget: { xMm: 0, zMm: 4200 },
    stateEnteredTick: 108,
    searchExpiresTick: 288,
  }),
]));
assert.deepEqual(guardTimeline.presentation(105).guards, [
  guard({
    xMm: 17300,
    zMm: 4050,
    facingX: 0,
    facingZ: -1000,
    state: 2,
    waypointId: 512,
    investigationTarget: { xMm: 0, zMm: 4200 },
    stateEnteredTick: 108,
    searchExpiresTick: 288,
  }),
]);

const reorderedGuardTimeline = new Timeline();
reorderedGuardTimeline.add(snapshot('reordered-guards', 100, [], [
  guard({ id: 51, xMm: 100, zMm: 0 }),
  guard({ id: 52, xMm: 1000, zMm: 1000 }),
]));
reorderedGuardTimeline.add(snapshot('reordered-guards', 110, [], [
  guard({ id: 52, xMm: 1200, zMm: 1200 }),
  guard({ id: 51, xMm: 300, zMm: 100 }),
]));
assert.deepEqual(
  reorderedGuardTimeline.presentation(105).guards.map(({ id, xMm, zMm }) => ({ id, xMm, zMm })),
  [
    { id: 52, xMm: 1100, zMm: 1100 },
    { id: 51, xMm: 200, zMm: 50 },
  ],
);

const legacyTimeline = new Timeline();
legacyTimeline.add(snapshot('legacy', 1, []));
assert.deepEqual(legacyTimeline.presentation().guards, []);
console.log('timeline tests passed');
