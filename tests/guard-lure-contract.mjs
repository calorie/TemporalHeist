import assert from 'node:assert/strict';
import { assertGuardLure } from './guard-lure.mjs';

// A missed publication can expose a moving Echo after its 30-tick observation
// window closed. The retained target is earlier than the observed Echo.
const guard = { stateEnteredTick: 5900, investigationTarget: { xMm: 16000, zMm: 3500 } };
assert.doesNotThrow(() => assertGuardLure({ serverTick: 5912 }, guard,
  { sourceTick: 5312, xMm: 16720, zMm: 3500 }));
assert.doesNotThrow(() => assertGuardLure({ serverTick: 5940 }, guard,
  { sourceTick: 5340, xMm: 16000, zMm: 5900 }));
assert.throws(() => assertGuardLure({ serverTick: 5912 }, guard,
  { sourceTick: 5312, xMm: 16721, zMm: 3500 }));
assert.throws(() => assertGuardLure({ serverTick: 5900 }, guard,
  { sourceTick: 5300, xMm: 16001, zMm: 3500 }));
assert.throws(() => assertGuardLure({ serverTick: 5912 }, guard,
  { sourceTick: 5311, xMm: 16000, zMm: 3500 }));
console.log('guard lure assertion accounts for elapsed authority ticks and exact Echo delay');
