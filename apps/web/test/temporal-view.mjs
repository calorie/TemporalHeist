import assert from 'node:assert/strict';
import { temporalView } from '../src/temporal-view.ts';
import { Timeline } from '../src/timeline.ts';

const pose = (playerId, xMm, zMm = 0) => ({ playerId, xMm, zMm, sourceTick: 0, echo: false });
const snapshot = (epoch, tick, players, startedTick = 0, overrides = {}) => ({
  protocolMajor: 1,
  roomEpoch: epoch,
  serverTick: tick,
  players,
  echoes: overrides.echoes ?? [],
  plates: [],
  doors: [],
  actions: [],
  sessions: [],
  hazards: [],
  guards: [],
  room: {
    phase: overrides.phase ?? 2,
    attempt: overrides.attempt ?? 1,
    startedTick,
    endedTick: 0,
    deadlineTick: 10_000,
    readyPlayers: 2,
    extractionPlayers: 0,
    echoOpenedFinalDoor: false,
    failureReason: 0,
    failureHazardId: 0,
    failureGuardId: 0,
    objectiveSecured: false,
  },
});

const regular = new Timeline();
for (let tick = 0; tick <= 603; tick += 3)
  regular.add(snapshot('regular', tick, [pose(1, tick * 10), pose(2, tick * -10)], 0));
const view = temporalView(regular, 601.5);
assert.equal(view.epoch, 'regular');
assert.equal(view.renderTick, 601.5);
assert.equal(view.segments.length, 402);
assert.deepEqual(view.owners, [1, 2]);
for (const playerId of [1, 2]) {
  const owner = view.segments.filter((segment) => segment.playerId === playerId);
  assert.equal(owner.length, 201);
  assert.equal(owner[0].startTick, 1.5);
  assert.equal(owner.at(-1).endTick, 601.5);
  assert.equal(owner.at(-1).endTick - owner[0].startTick, 600);
  assert.equal(owner[0].startXmm, playerId === 1 ? 15 : -15);
  assert.equal(owner.at(-1).endXmm, playerId === 1 ? 6015 : -6015);
}

const incomplete = new Timeline();
for (let tick = 6; tick <= 603; tick += 3)
  incomplete.add(snapshot('late', tick, [pose(1, tick)], 0));
assert.deepEqual(temporalView(incomplete, 603).segments, [], 'late history omits an incomplete bridge');

const gaps = new Timeline();
for (let tick = 0; tick <= 603; tick += 3) {
  if (tick === 300) continue;
  const players = tick === 303 ? [pose(2, tick)] : [pose(1, tick), pose(2, tick)];
  gaps.add(snapshot('gaps', tick, players, 0));
}
const gapView = temporalView(gaps, 600);
const player1 = gapView.segments.filter(({ playerId }) => playerId === 1);
const player2 = gapView.segments.filter(({ playerId }) => playerId === 2);
assert(!player1.some(({ startTick, endTick }) => startTick < 303 && endTick >= 303));
assert(!player2.some(({ startTick, endTick }) => startTick < 303 && endTick > 303));
assert(player1.some(({ startTick }) => startTick === 306), 'identity resumes without a false connection');
assert(player2.some(({ startTick }) => startTick === 303), 'sampling gap resumes without a false connection');

const pulses = new Timeline();
for (let tick = 0; tick <= 660; tick += 3)
  pulses.add(snapshot('pulses', tick, [pose(1, tick), pose(2, -tick)], 0, {
    echoes: tick >= 600 ? [pose(2, -600), pose(1, 600)] : [],
  }));
assert.deepEqual(temporalView(pulses, 599).pulses, []);
assert.deepEqual(
  temporalView(pulses, 600).pulses.map(({ playerId, ageTicks }) => ({ playerId, ageTicks })),
  [{ playerId: 1, ageTicks: 0 }, { playerId: 2, ageTicks: 0 }],
);
assert.deepEqual(temporalView(pulses, 659).pulses.map(({ ageTicks }) => ageTicks), [59, 59]);
assert.deepEqual(temporalView(pulses, 660).pulses, []);

const latePulse = new Timeline();
latePulse.add(snapshot('late-pulse', 630, [pose(1, 630)], 0, { echoes: [pose(1, 0)] }));
assert.deepEqual(temporalView(latePulse, 630).pulses, [], 'late join does not invent a spawn pulse');

const reorderedPulse = new Timeline();
reorderedPulse.add(snapshot('reordered', 603, [pose(1, 603)], 0, { echoes: [pose(1, 0)] }));
reorderedPulse.add(snapshot('reordered', 597, [pose(1, 597)], 0));
reorderedPulse.add(snapshot('reordered', 600, [pose(1, 600)], 0, { echoes: [pose(1, 0)] }));
assert.deepEqual(temporalView(reorderedPulse, 603).pulses.map(({ ageTicks }) => ageTicks), [3]);
assert.deepEqual(temporalView(reorderedPulse, 660).pulses, [], 'pulse does not repeat');

const lobby = new Timeline();
lobby.add(snapshot('lobby', 600, [pose(1, 600)], 0, { phase: 1 }));
assert.deepEqual(temporalView(lobby, 600).segments, []);
assert.deepEqual(temporalView(lobby, 600).pulses, []);

const overflow = new Timeline();
for (let tick = 0; tick <= 600; tick += 2)
  overflow.add(snapshot('overflow', tick, [pose(1, tick), pose(2, -tick)], 0));
assert.throws(() => temporalView(overflow, 600), /capacity exceeded: 600 > 512/);

const restarted = new Timeline();
for (let tick = 0; tick <= 600; tick += 3)
  restarted.add(snapshot('same-epoch', tick, [pose(1, tick)], 0));
restarted.add(snapshot('same-epoch', 603, [pose(1, 9000)], 603, { attempt: 2, phase: 1 }));
restarted.add(snapshot('same-epoch', 606, [pose(1, 9000)], 606, { attempt: 2 }));
assert.deepEqual(temporalView(restarted, 606).segments, [], 'restart in one epoch clears attempt continuity');
assert.deepEqual(temporalView(restarted, 606).pulses, []);

pulses.add(snapshot('reset', 0, [pose(1, 9000)], 0));
assert.equal(temporalView(pulses, 600).epoch, 'reset');
assert.deepEqual(temporalView(pulses, 600).segments, []);
assert.deepEqual(temporalView(pulses, 600).pulses, []);

console.log('temporal view tests passed');
