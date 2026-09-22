import assert from 'node:assert/strict';
import { roomHud } from '../src/room-hud.ts';

const RoomPhase = { LOBBY: 1, ACTIVE: 2, WON: 3, FAILED: 4 };

const snapshot = (phase, overrides = {}) => ({
  protocolMajor: 1,
  roomEpoch: 'test',
  serverTick: 120,
  players: [],
  echoes: [],
  plates: [],
  doors: [],
  actions: [],
  sessions: [
    { playerId: 1, sessionId: 'a', connected: true, ready: false },
    { playerId: 2, sessionId: 'b', connected: true, ready: false },
  ],
  room: {
    phase,
    attempt: 2,
    startedTick: 60,
    endedTick: 0,
    deadlineTick: 3720,
    readyPlayers: 0,
    extractionPlayers: 0,
    echoOpenedFinalDoor: false,
    ...overrides,
  },
});

assert.deepEqual(roomHud(undefined, 1), {
  phase: 'CONNECTING',
  phaseState: 'connecting',
  objective: 'Waiting for authority',
  timer: '--:--',
  echoStatus: 'ECHO · WAITING FOR ATTEMPT',
  readiness: 'Players ready: 0/2',
  result: '',
  resultState: 'none',
  canReady: false,
  canRestart: false,
});

const lobby = roomHud(snapshot(RoomPhase.LOBBY), 1);
assert.equal(lobby.phase, 'LOBBY · ATTEMPT 2');
assert.equal(lobby.phaseState, 'lobby');
assert.equal(lobby.objective, 'Ready up with your partner');
assert.equal(lobby.echoStatus, 'ECHO · STARTS 10 SECONDS AFTER LAUNCH');
assert.equal(lobby.canReady, true);
assert.equal(lobby.canRestart, false);

const active = roomHud(snapshot(RoomPhase.ACTIVE, { startedTick: 120 }), 1);
assert.equal(active.timer, '01:00');
assert.equal(active.objective, 'Open the final door with Echo Presence');
assert.equal(active.echoStatus, 'ECHO IN 00:10');
assert.equal(active.phaseState, 'active');
assert.equal(active.canReady, false);

const echoBoundary = roomHud(
  { ...snapshot(RoomPhase.ACTIVE, { startedTick: 120 }), serverTick: 719 },
  1,
);
assert.equal(echoBoundary.echoStatus, 'ECHO IN 00:01');
const echoLive = roomHud(
  { ...snapshot(RoomPhase.ACTIVE, { startedTick: 120 }), serverTick: 720 },
  1,
);
assert.equal(echoLive.echoStatus, 'ECHO REPLAYING · 10 SECONDS BEHIND');

const extraction = roomHud(
  snapshot(RoomPhase.ACTIVE, { echoOpenedFinalDoor: true, extractionPlayers: 1 }),
  1,
);
assert.equal(extraction.objective, 'Reach extraction together (1/2)');

const won = roomHud(snapshot(RoomPhase.WON, { readyPlayers: 2 }), 1);
assert.match(won.result, /SUCCESS/);
assert.equal(won.resultState, 'success');
assert.equal(won.canRestart, true);

const failed = roomHud(snapshot(RoomPhase.FAILED, { failureReason: 1 }), 1);
assert.match(failed.result, /TIME EXPIRED/);
assert.equal(failed.resultState, 'failure');
assert.equal(failed.canRestart, true);

const surveillance = roomHud(
  snapshot(RoomPhase.FAILED, { failureReason: 2, failureHazardId: 41 }),
  1,
);
assert.match(surveillance.result, /SURVEILLANCE/);
assert.match(surveillance.result, /CAMERA 41/);
assert.doesNotMatch(surveillance.result, /TIME EXPIRED/);

console.log('room HUD tests passed');
