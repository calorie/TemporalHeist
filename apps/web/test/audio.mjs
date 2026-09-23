import assert from 'node:assert/strict';
import { audioFrame, audioTransitions } from '../src/audio.ts';

const RoomPhase = { LOBBY: 1, ACTIVE: 2, WON: 3, FAILED: 4 };

const snapshot = (phase, serverTick, overrides = {}) => ({
  protocolMajor: 1,
  roomEpoch: 'epoch-a',
  serverTick,
  players: [],
  echoes: [],
  plates: [],
  doors: [],
  actions: [],
  sessions: [],
  hazards: [],
  guards: [],
  room: {
    phase,
    attempt: 1,
    startedTick: 100,
    endedTick: 0,
    deadlineTick: 3700,
    readyPlayers: 2,
    extractionPlayers: 0,
    echoOpenedFinalDoor: false,
    failureReason: 0,
    failureHazardId: 0,
    ...overrides,
  },
});

const active = audioFrame(snapshot(RoomPhase.ACTIVE, 699));
assert.deepEqual(audioTransitions(undefined, active), [], 'first snapshot is silent');
assert.deepEqual(
  audioTransitions(active, audioFrame(snapshot(RoomPhase.ACTIVE, 700))),
  ['echo'],
  'Echo cue fires at the authority-tick boundary',
);

const afterEcho = audioFrame(snapshot(RoomPhase.ACTIVE, 701));
assert.deepEqual(
  audioTransitions(audioFrame(snapshot(RoomPhase.ACTIVE, 700)), afterEcho),
  [],
  'Echo cue fires once',
);
assert.deepEqual(
  audioTransitions(afterEcho, audioFrame(snapshot(RoomPhase.ACTIVE, 900, { attempt: 2 }))),
  [],
  'attempt changes do not replay old transitions',
);
assert.deepEqual(
  audioTransitions(
    afterEcho,
    audioFrame({ ...snapshot(RoomPhase.ACTIVE, 900), roomEpoch: 'epoch-b' }),
  ),
  [],
  'reconnect to another epoch does not replay old transitions',
);

assert.deepEqual(
  audioTransitions(
    afterEcho,
    audioFrame(snapshot(RoomPhase.ACTIVE, 702, { echoOpenedFinalDoor: true })),
  ),
  ['door'],
);
const won = audioFrame(snapshot(RoomPhase.WON, 703, { echoOpenedFinalDoor: true }));
assert.deepEqual(
  audioTransitions(
    audioFrame(snapshot(RoomPhase.ACTIVE, 702, { echoOpenedFinalDoor: true })),
    won,
  ),
  ['success'],
);
assert.deepEqual(audioTransitions(won, won), [], 'success cue fires once');

const failed = audioFrame(snapshot(RoomPhase.FAILED, 703));
assert.deepEqual(audioTransitions(afterEcho, failed), ['failure']);
assert.deepEqual(audioTransitions(failed, failed), [], 'failure cue fires once');

const patrolling = audioFrame({ ...snapshot(RoomPhase.ACTIVE, 710), guards: [{ id: 51, state: 1 }] });
const investigating = audioFrame({ ...snapshot(RoomPhase.ACTIVE, 711), guards: [{ id: 51, state: 2 }] });
assert.deepEqual(audioTransitions(patrolling, investigating), ['guard'], 'Investigate alerts once');
assert.deepEqual(audioTransitions(investigating, investigating), [], 'continued investigation is silent');
assert.deepEqual(audioTransitions(undefined, investigating), [], 'first guard snapshot is silent');
assert.deepEqual(
  audioTransitions(
    audioFrame({ ...snapshot(RoomPhase.ACTIVE, 710), guards: [{ id: 51, state: -1 }] }),
    investigating,
  ),
  [],
  'unknown guard state is silent',
);

console.log('audio transition tests passed');
