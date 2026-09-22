import { Input, InputKind } from './compiled/temporal_heist.js';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const expected = {protocolMajor: 1, roomEpoch: 'spike-epoch', playerId: 1, sessionId: 'session-a', sequence: 9007199254740991, moveX: -1000, moveZ: 1000, kind: InputKind.MOTION, targetId: 0};
if (process.argv[2] === 'encode') {
  writeFileSync('/artifacts/ts-input.bin', Input.encode(expected).finish());
} else {
  const actual = Input.decode(readFileSync('/artifacts/rust-input.bin'));
  assert.deepEqual(actual, expected);
  console.log('TypeScript-compatible protobuf runtime decoded Rust reply; signed axes and safe integer boundary passed');
}
