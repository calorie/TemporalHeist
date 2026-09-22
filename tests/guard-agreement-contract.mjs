import assert from 'node:assert/strict';
import { guardAgreement } from './guard-agreement.mjs';

const clientA = { roomEpoch: 'room-1', serverTick: 903, guards: [{
  id: 51, xMm: 20000, zMm: 4000, facingX: 1400, facingZ: -800,
  state: 2, waypointId: 512, stateEnteredTick: 901, searchExpiresTick: 0,
  investigationTarget: { xMm: 21400, zMm: 3200 },
}] };
const matching = structuredClone(clientA);
const evidence = guardAgreement(clientA, matching);
assert.equal(evidence.serverTick, 903);
assert.deepEqual(evidence.clientA, clientA.guards[0]);
assert.deepEqual(evidence.clientB, matching.guards[0]);

// Reject every divergent field, including those the old state/entry check missed.
for (const change of [
  { xMm: 20001 }, { zMm: 4001 }, { facingX: 1399 }, { facingZ: -799 },
  { waypointId: 511 }, { searchExpiresTick: 1080 }, { stateEnteredTick: 900 },
  { state: 3 }, { investigationTarget: { xMm: 21401, zMm: 3200 } },
  { investigationTarget: { xMm: 21400, zMm: 3201 } },
  { investigationTarget: undefined },
]) {
  const divergent = structuredClone(clientA);
  Object.assign(divergent.guards[0], change);
  assert.throws(() => guardAgreement(clientA, divergent), /canonical guard snapshots diverged/);
}
assert.throws(() => guardAgreement(clientA, { ...matching, serverTick: 906 }), /same authority tick/);
assert.throws(() => guardAgreement(clientA, { ...matching, roomEpoch: 'room-2' }), /same room epoch/);
assert.throws(() => guardAgreement(clientA, { ...matching, guards: [] }), /present on both clients/);
console.log('Canonical guard agreement contract passed');
