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
    objectiveSecured: false,
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
  guardStatus: '',
  canReady: false,
  canRestart: false,
  identity: { self: 'YOU · P1', partner: 'PARTNER · P2', echoes: [] },
  steps: [
    { label: 'Steal the vault data', state: 'current' },
    { label: 'Open the final door with Echo Presence', state: 'upcoming' },
    { label: 'Reach extraction together', state: 'upcoming' },
  ],
  interaction: '',
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
assert.equal(active.objective, 'Steal the vault data');
assert.doesNotMatch(active.objective, /\[E\]/, 'out-of-range objective must not imply E is available');
assert.equal(active.echoStatus, 'ECHO IN 00:10');
assert.equal(active.phaseState, 'active');
assert.equal(active.canReady, false);
assert.equal(active.identity.self, 'YOU · P1');
assert.deepEqual(active.steps.map(({ state }) => state), ['current', 'upcoming', 'upcoming']);
const actionable = snapshot(RoomPhase.ACTIVE);
actionable.players = [{ playerId: 1, xMm: 21000, zMm: 4000, echo: false }];
assert.equal(roomHud(actionable, 1).interaction, '[E] STEAL VAULT DATA');

const guarded = roomHud({ ...snapshot(RoomPhase.ACTIVE), guards: [{ id: 51, state: 1 }] }, 1);
assert.equal(guarded.objective, 'Steal the vault data');
assert.equal(guarded.guardStatus, 'GUARD 51 PATROLLING · HUMANS ARE CAUGHT, ECHOES DISTRACT');
const secured = roomHud(snapshot(RoomPhase.ACTIVE, { objectiveSecured: true }), 1);
assert.equal(secured.objective, 'Open the final door with Echo Presence');
assert.equal(
  roomHud(
    { ...snapshot(RoomPhase.ACTIVE, { objectiveSecured: true }), guards: [{ id: 51, state: 1 }] },
    1,
  ).objective,
  'Open the final door with Echo Presence',
);
const investigating = roomHud(
  { ...snapshot(RoomPhase.ACTIVE), guards: [{ id: 51, state: 2 }] },
  1,
);
assert.equal(investigating.guardStatus, 'GUARD 51 INVESTIGATING — CROSS WHEN CLEAR');
assert.equal(
  roomHud({ ...snapshot(RoomPhase.ACTIVE), guards: [{ id: 51, state: 3 }] }, 1).guardStatus,
  'GUARD 51 RETURNING',
);
assert.equal(
  roomHud({ ...snapshot(RoomPhase.ACTIVE), guards: [{ id: 51, state: -1 }] }, 1).guardStatus,
  '',
);
assert.equal(roomHud(snapshot(RoomPhase.ACTIVE), 1).guardStatus, '');

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
  snapshot(RoomPhase.ACTIVE, {
    objectiveSecured: true,
    echoOpenedFinalDoor: true,
    extractionPlayers: 1,
  }),
  1,
);
assert.equal(extraction.objective, 'Reach extraction together (1/2)');
assert.deepEqual(extraction.steps.map(({ state }) => state), ['complete', 'complete', 'current']);

const won = roomHud(snapshot(RoomPhase.WON, { readyPlayers: 2 }), 1);
assert.match(won.result, /SUCCESS/);
assert.equal(won.resultState, 'success');
assert.equal(won.canRestart, true);
assert.deepEqual(won.steps.map(({ state }) => state), ['complete', 'complete', 'complete']);

const failed = roomHud(snapshot(RoomPhase.FAILED, { failureReason: 1 }), 1);
assert.match(failed.result, /TIME EXPIRED/);
assert.match(failed.result, /move through cleared doors sooner/i);
assert.equal(failed.resultState, 'failure');
assert.equal(failed.canRestart, true);

const surveillance = roomHud(
  snapshot(RoomPhase.FAILED, { failureReason: 2, failureHazardId: 41 }),
  1,
);
assert.match(surveillance.result, /SURVEILLANCE/);
assert.match(surveillance.result, /CAMERA 41/);
assert.match(surveillance.result, /avoid its cone/i);
assert.doesNotMatch(surveillance.result, /TIME EXPIRED/);

const guardFailure = roomHud(
  snapshot(RoomPhase.FAILED, { failureReason: 3, failureGuardId: 51 }),
  1,
);
assert.match(guardFailure.result, /GUARD 51/);
assert.match(guardFailure.result, /DETECTED/);
assert.match(guardFailure.result, /distract it with an Echo/i);

console.log('room HUD tests passed');
