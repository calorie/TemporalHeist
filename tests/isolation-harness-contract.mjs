import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const harnessPath = 'containers/verify-two-stack-isolation.sh';

await access(harnessPath);
const harness = await readFile(harnessPath, 'utf8');

execFileSync('sh', ['-n', harnessPath]);
assert.match(harness, /compose_a visual/);
assert.match(harness, /compose_b visual/);
assert.match(harness, /visual-browser-a visual-browser-b/);
assert.match(harness, /published_ports_a/);
assert.match(harness, /docker network ls/);
assert.match(harness, /docker volume ls/);
assert.match(harness, /down --volumes --remove-orphans/);
assert.match(harness, /wget -qO- http:\/\/web:5173\/healthz/);
assert.match(harness, /manifest\.json/);
assert.match(harness, /git -C "\$worktree_a" rev-parse HEAD/);
assert.match(harness, /"\$head_a" = "\$head_b"/);
assert.equal(harness.match(/status --porcelain/g)?.length, 2);
assert.match(harness, /"worktrees": \[/);
assert.match(harness, /stackBDisplayAfterARemoval/);
assert.match(harness, /visual-a\.log/);
assert.match(harness, /visual-b\.log/);
assert.match(harness, /artifactsA/);
assert.match(harness, /artifactsB/);
assert.match(harness, /export_visual_artifacts compose_a/);
assert.match(harness, /export_visual_artifacts compose_b/);

console.log('Two-stack isolation harness contract passed');
