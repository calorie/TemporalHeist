import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [entrypoint, check] = await Promise.all([
  readFile('containers/visual-entrypoint.sh', 'utf8'),
  readFile('containers/visual-display-check.mjs', 'utf8').catch(() => ''),
]);

for (const processName of ['xvfb', 'x11vnc', 'websockify']) {
  assert.match(entrypoint, new RegExp(`/tmp/${processName}\\.pid`));
  assert.match(check, new RegExp(`/tmp/${processName}\\.pid`));
}
assert.match(check, /ws:\/\/127\.0\.0\.1:6080\/websockify/);
assert.match(check, /RFB 003\.008/);
assert.match(check, /process\.kill\(pid, 0\)/);
assert.match(check, /setTimeout/);

console.log('visual display chain contract passed');
