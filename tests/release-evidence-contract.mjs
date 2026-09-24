import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const wrapper = await readFile('container', 'utf8');
const workflow = await readFile('.github/workflows/vertical-slice.yml', 'utf8');
const isolation = await readFile('containers/verify-two-stack-isolation.sh', 'utf8');
const runtimeImage = await readFile('containers/Runtime.Dockerfile', 'utf8');

for (const command of ['release-evidence', 'release-soak', 'two-stack-isolation']) {
  assert.match(wrapper, new RegExp(`\\n  ${command}\\)`), `${command} wrapper entry point is required`);
}
assert.match(wrapper, /evidence-index\.mjs/);
assert.match(wrapper, /compose config --format json/);
assert.match(wrapper, /runtime-browser-recovery/);
assert.match(wrapper, /runtime-reliability/);

assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /schedule:/);
assert.match(workflow, /release-evidence:/);
assert.match(workflow, /two-stack-isolation:/);
assert.match(workflow, /if: always\(\)/);
assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40} # v/);
assert.match(workflow, /sh container ci-release release-evidence/);
assert.match(workflow, /sh container ci-isolation two-stack-isolation/);

assert.match(isolation, /for service in relay authority web visual-browser-a visual-browser-b/);
assert.match(isolation, /published_ports_a/);
assert.match(isolation, /stack_b_display_after_a_removal/);
assert.match(isolation, /manifest\.json/);
assert.match(runtimeImage, /ARG TH_CARGO_BUILD_JOBS=2/);
assert.match(runtimeImage, /CARGO_BUILD_JOBS="\$TH_CARGO_BUILD_JOBS" cargo build/);

console.log('Release evidence contract passed');
