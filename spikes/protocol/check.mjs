import { FailureReason, GuardState, Input, InputKind, RoomPhase, RoomState, Snapshot } from './compiled/temporal_heist.js';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const expected = {protocolMajor: 1, roomEpoch: 'spike-epoch', playerId: 1, sessionId: 'session-a', sequence: 9007199254740991, moveX: -1000, moveZ: 1000, kind: InputKind.READY, targetId: 0};
if (process.argv[2] === 'encode') {
  writeFileSync('/artifacts/ts-input.bin', Input.encode(expected).finish());
  const legacyRoom = RoomState.encode(RoomState.fromPartial({phase: RoomPhase.ACTIVE})).finish();
  assert.deepEqual([...legacyRoom], [0x08, 0x02]);
  writeFileSync('/artifacts/ts-legacy-room.bin', legacyRoom);
} else {
  const actual = Input.decode(readFileSync('/artifacts/rust-input.bin'));
  assert.deepEqual(actual, expected);
  const snapshot = Snapshot.decode(readFileSync('/artifacts/rust-snapshot.bin'));
  assert.deepEqual(snapshot.sessions, [{playerId: 1, sessionId: 'session-a', connected: true, ready: true}]);
  assert.equal(snapshot.room?.phase, RoomPhase.ACTIVE);
  assert.equal(snapshot.room?.attempt, 2);
  assert.equal(snapshot.room?.deadlineTick, 18123);
  assert.equal(snapshot.room?.echoOpenedFinalDoor, true);
  assert.equal(snapshot.room?.failureReason, FailureReason.GUARD);
  assert.equal(snapshot.room?.failureHazardId, 0);
  assert.equal(snapshot.room?.failureGuardId, 51);
  assert.equal(snapshot.room?.objectiveSecured, true);
  assert.deepEqual(snapshot.hazards, [{id: 41, active: true, detectedPlayerId: 2}]);
  assert.equal(snapshot.guards[0]?.id, 51);
  assert.equal(snapshot.guards[0]?.state, GuardState.INVESTIGATE);
  assert.equal(snapshot.guards[0]?.investigationTarget?.xMm, 18750);
  assert.deepEqual(snapshot.guards.map(({state}) => state), [
    GuardState.INVESTIGATE,
    GuardState.PATROL,
    GuardState.RETURN,
  ]);
  const legacySnapshot = Snapshot.decode(Uint8Array.from([0x08, 0x01]));
  assert.deepEqual(legacySnapshot.guards, []);
  console.log('TypeScript decoded Rust P3 objective state; absent fields remain compatible');
}
