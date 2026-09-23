import assert from 'node:assert/strict';

export function guardAgreement(clientA, clientB) {
  assert.equal(clientA.roomEpoch, clientB.roomEpoch, 'guard comparison requires the same room epoch');
  assert.equal(clientA.serverTick, clientB.serverTick, 'guard comparison requires the same authority tick');
  const guardA = clientA.guards.find((guard) => guard.id === 51);
  const guardB = clientB.guards.find((guard) => guard.id === 51);
  assert(guardA && guardB, 'guard 51 must be present on both clients');
  assert.equal(guardA.state, 2, 'guard agreement must be observed during INVESTIGATE');
  assert.deepEqual(guardB, guardA, 'canonical guard snapshots diverged');
  return { roomEpoch: clientA.roomEpoch, serverTick: clientA.serverTick,
    clientA: guardA, clientB: guardB };
}
