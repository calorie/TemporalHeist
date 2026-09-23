import assert from 'node:assert/strict';
import { map } from '../src/map.ts';
import { playerExperience } from '../src/player-experience.ts';

const snapshot = (room = {}) => ({
  serverTick: 720,
  players: [
    { playerId: 1, xMm: 21000, zMm: 4000 },
    { playerId: 2, xMm: 18000, zMm: 4000 },
  ],
  echoes: [{ playerId: 1, xMm: 4500, zMm: 2500 }],
  room: {
    phase: 2,
    objectiveSecured: false,
    echoOpenedFinalDoor: false,
    extractionPlayers: 0,
    ...room,
  },
});

const atVault = playerExperience(map, snapshot(), 1);
assert.deepEqual(atVault.identity, {
  self: 'YOU · P1',
  partner: 'PARTNER · P2',
  echoes: ['YOUR ECHO · P1'],
});
assert.deepEqual(
  atVault.steps.map(({ label, state }) => [label, state]),
  [
    ['Steal the vault data', 'current'],
    ['Open the final door with Echo Presence', 'upcoming'],
    ['Reach extraction together', 'upcoming'],
  ],
);
assert.deepEqual(atVault.interaction, { targetId: 61, label: 'STEAL VAULT DATA', key: 'E' });

const playerTwo = playerExperience(map, snapshot(), 2);
assert.equal(playerTwo.identity.self, 'YOU · P2');
assert.equal(playerTwo.identity.partner, 'PARTNER · P1');
assert.deepEqual(playerTwo.identity.echoes, ['PARTNER ECHO · P1']);

const outOfRange = structuredClone(snapshot());
outOfRange.players[0].xMm = 19000;
assert.equal(playerExperience(map, outOfRange, 1).interaction, undefined);

const atActionTerminal = structuredClone(snapshot());
atActionTerminal.players[0] = { playerId: 1, xMm: 2500, zMm: 6000 };
assert.deepEqual(playerExperience(map, atActionTerminal, 1).interaction, {
  targetId: 31,
  label: 'ACTIVATE TERMINAL',
  key: 'E',
});

const boundary = structuredClone(snapshot());
boundary.players[0].xMm = map.objective.x + map.objective.radius;
assert.equal(playerExperience(map, boundary, 1).interaction?.targetId, 61);
boundary.room.phase = 1;
assert.equal(playerExperience(map, boundary, 1).interaction, undefined, 'lobby cannot act');
boundary.room.phase = 3;
assert.equal(playerExperience(map, boundary, 1).interaction, undefined, 'terminal phase cannot act');
boundary.players = boundary.players.filter(({ playerId }) => playerId !== 1);
boundary.room.phase = 2;
assert.equal(playerExperience(map, boundary, 1).interaction, undefined, 'missing live player cannot act');

const secured = playerExperience(map, snapshot({ objectiveSecured: true }), 2);
assert.deepEqual(
  secured.steps.map(({ state }) => state),
  ['complete', 'current', 'upcoming'],
);
assert.equal(secured.interaction, undefined, 'secured vault is not actionable');

const extraction = playerExperience(
  map,
  snapshot({ objectiveSecured: true, echoOpenedFinalDoor: true, extractionPlayers: 1 }),
  1,
);
assert.deepEqual(extraction.steps.map(({ state }) => state), ['complete', 'complete', 'current']);
assert.match(extraction.steps[2].label, /1\/2/);

assert.deepEqual(playerExperience(map, undefined, 1).identity.echoes, []);
console.log('player experience tests passed');
