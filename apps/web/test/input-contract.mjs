import assert from 'node:assert/strict';
import { keyboardDecision } from '../src/input-contract.ts';

const active = 2;
const lobby = 1;
const won = 3;

assert.deepEqual(keyboardDecision('ArrowUp', active, false, false), {
  consume: true,
  command: 'movement',
});
assert.deepEqual(keyboardDecision('e', active, false, false), { consume: true, command: 'action' });
assert.deepEqual(keyboardDecision('e', active, false, true), { consume: true });
assert.deepEqual(keyboardDecision('Enter', lobby, false, false), { consume: true, command: 'ready' });
assert.deepEqual(keyboardDecision('r', won, false, false), { consume: true, command: 'restart' });
assert.deepEqual(keyboardDecision('Enter', active, false, false), { consume: false });
assert.deepEqual(keyboardDecision('r', active, false, false), { consume: false });
assert.deepEqual(keyboardDecision('w', lobby, false, false), { consume: false });

for (const key of ['Enter', 'e', 'r', 'ArrowUp']) {
  assert.deepEqual(
    keyboardDecision(key, active, true, false),
    { consume: false },
    `${key} must remain owned by a focused control`,
  );
}

console.log('input contract tests passed');
