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
assert.match(wrapper, /mkdir -p "\$evidence_dir"/,
  'the host runner must create the evidence directory');
assert.match(wrapper, /-e TH_EVIDENCE_DIR="\/workspace\/\$evidence_dir"[\s\S]*find "\$TH_EVIDENCE_DIR" -mindepth 1 -delete/,
  'reruns must clear stale host evidence contents before work starts');
assert.doesNotMatch(wrapper, /rm -rf "\/workspace\/\.release\/\$TH_AGENT_ID"/,
  'a root container must not replace the host-owned evidence directory');
assert.match(wrapper, /release-evidence-permissions-probe\)/,
  'a practical host-write permissions probe is required');
assert.match(wrapper, /find \/artifacts -mindepth 1 -delete/,
  'reruns must clear the private artifact volume');
assert.match(wrapper, /evidence_complete=0/);
assert.match(wrapper, /rm -f "\/workspace\/\$evidence_dir\/index\.json"/,
  'a failed rerun must not retain a passed index');
assert.match(wrapper, /cp -R \/artifacts\/\. \/evidence\//,
  'successful export must copy every artifact');
assert.doesNotMatch(wrapper.match(/strict_release_export\(\)[\s\S]*?\n    \}/)?.[0] ?? '', /\|\| true/,
  'successful artifact export must not swallow copy failures');
const outerCleanup = wrapper.match(/cleanup_worktrees\(\)[\s\S]*?\n    \}/)?.[0] ?? '';
assert.match(outerCleanup, /"\$agent_id-a" down --volumes --remove-orphans/);
assert.match(outerCleanup, /"\$agent_id-b" down --volumes --remove-orphans/);
assert.ok(outerCleanup.indexOf('$agent_id-a') < outerCleanup.indexOf('git worktree remove'),
  'child stacks must be removed before child worktrees');

assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /schedule:/);
assert.match(workflow, /release-evidence:/);
assert.match(workflow, /two-stack-isolation:/);
assert.match(workflow, /if: always\(\)/);
assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40} # v/);
assert.match(workflow, /sh container ci-release release-evidence/);
assert.match(workflow, /sh container ci-isolation two-stack-isolation/);
assert.match(workflow, /group: vertical-slice-\$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name \}\}-\$\{\{ github\.ref \}\}/);
assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \|\| github\.event_name == 'push' \}\}/);

assert.match(isolation, /for service in relay authority web visual-browser-a visual-browser-b/);
assert.match(isolation, /published_ports_a/);
assert.match(isolation, /stack_b_display_after_a_removal/);
assert.match(isolation, /manifest\.json/);
assert.match(isolation, /export_visual_artifacts compose_a/);
assert.match(isolation, /export_visual_artifacts compose_b/);
assert.match(isolation, /for player in 1 2/);
assert.match(isolation, /player-\$player-lobby\.png/);
assert.match(isolation, /player-\$player-metadata\.json/);
assert.match(runtimeImage, /ARG TH_CARGO_BUILD_JOBS=2/);
assert.match(runtimeImage, /CARGO_BUILD_JOBS="\$TH_CARGO_BUILD_JOBS" cargo build/);

console.log('Release evidence contract passed');
