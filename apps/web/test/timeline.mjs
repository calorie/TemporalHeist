import assert from 'node:assert/strict';
import { Timeline } from '../src/timeline.ts';

const snapshot = (epoch, tick, players) => ({
  protocolMajor: 1, roomEpoch: epoch, serverTick: tick, players,
  echoes: [], plates: [], doors: [], actions: [], sessions: [],
});
const pose = (playerId, xMm, zMm = 0) => ({ playerId, xMm, zMm, sourceTick: 0, echo: false });

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
console.log('timeline tests passed');
