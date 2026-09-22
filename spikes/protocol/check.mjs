import { Input, InputKind, RoomPhase, Snapshot } from './compiled/temporal_heist.js';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const expected = {protocolMajor: 1, roomEpoch: 'spike-epoch', playerId: 1, sessionId: 'session-a', sequence: 9007199254740991, moveX: -1000, moveZ: 1000, kind: InputKind.READY, targetId: 0};
if (process.argv[2] === 'encode') {
  writeFileSync('/artifacts/ts-input.bin', Input.encode(expected).finish());
} else {
  const actual = Input.decode(readFileSync('/artifacts/rust-input.bin'));
  assert.deepEqual(actual, expected);
  const snapshot = Snapshot.decode(readFileSync('/artifacts/rust-snapshot.bin'));
  assert.deepEqual(snapshot.sessions, [{playerId: 1, sessionId: 'session-a', connected: true, ready: true}]);
  assert.equal(snapshot.room?.phase, RoomPhase.ACTIVE);
  assert.equal(snapshot.room?.attempt, 2);
  assert.equal(snapshot.room?.deadlineTick, 18123);
  assert.equal(snapshot.room?.echoOpenedFinalDoor, true);
  console.log('TypeScript decoded Rust P1 room state; signed axes and safe integer boundary passed');
}
