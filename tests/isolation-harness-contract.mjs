import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const harnessPath = 'containers/verify-two-stack-isolation.sh';

await access(harnessPath);
const harness = await readFile(harnessPath, 'utf8');

execFileSync('sh', ['-n', harnessPath]);
assert.match(harness, /compose_a acceptance/);
assert.match(harness, /compose_b acceptance/);
assert.match(harness, /TH_ISOLATION_B_START_DELAY_MS/);
assert.match(harness, /TH_E2E_START_DELAY_MS/);
assert.match(harness, /com\.docker\.compose\.service=browser/);
assert.match(harness, /\.HostConfig\.PortBindings/);
assert.match(harness, /docker network ls/);
assert.match(harness, /docker volume ls/);
assert.match(harness, /down --volumes --remove-orphans/);
assert.match(harness, /fetch\('http:\/\/web:5173\/healthz'/);
assert.match(harness, /evidence\.json/);
assert.match(harness, /git -C "\$worktree_a" rev-parse HEAD/);
assert.match(harness, /"\$head_a" = "\$head_b"/);
assert.equal(harness.match(/status --porcelain/g)?.length, 2);
assert.match(harness, /"worktrees": \[/);
assert.match(harness, /"room_id": "\$run_a"/);
assert.match(harness, /acceptance-a\.log/);
assert.match(harness, /acceptance-b\.log/);

console.log('Two-stack isolation harness contract passed');
