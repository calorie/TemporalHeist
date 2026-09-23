import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workflow = await readFile('.github/workflows/vertical-slice.yml', 'utf8');
const pullRequest = workflow.match(/^  pull_request:\n((?:^ {4,}.*\n|^\n)*)/m)?.[1];
const activityTypes = pullRequest?.match(/^    types: \[([^\]]+)\]$/m)?.[1].split(/,\s*/);
assert.ok(activityTypes?.includes('labeled'), 'adding component-only must re-evaluate acceptance');
assert.ok(activityTypes.includes('unlabeled'), 'removing component-only must re-evaluate acceptance');
assert.ok(activityTypes.includes('edited'), 'retargeting a PR must trigger acceptance');
for (const activity of ['opened', 'synchronize', 'reopened']) {
  assert.ok(activityTypes.includes(activity), `${activity} must keep triggering verification`);
}

const push = workflow.match(/^  push:\n((?:^ {4,}.*\n|^\n)*)/m)?.[1];
const pushBranches = push?.match(/^    branches: \[([^\]]+)\]$/m)?.[1].split(/,\s*/);
assert.deepEqual(pushBranches, ['main'], 'push must only run on main');

const component = workflow.match(/^  component-verification:\n((?:^ {4,}.*\n|^\n)*)/m)?.[1];
assert.ok(component, 'component verification job must exist');
assert.doesNotMatch(component, /^    if:/m, 'component verification must run on every PR');

const acceptance = workflow.match(/^  acceptance:\n((?:^ {4,}.*\n|^\n)*)/m)?.[1];
assert.ok(acceptance, 'acceptance job must exist');
const condition = acceptance.match(/^    if: (.+)$/m)?.[1];
assert.ok(condition, 'acceptance job must have a condition');

const expression = condition
  .replace(/^\$\{\{\s*|\s*\}\}$/g, '')
  .replaceAll('github.event.pull_request.labels.*.name', 'labelNames');

for (const [event_name, base_ref, labelNames, expected] of [
  ['push', '', ['component-only'], true],
  ['pull_request', 'main', [], true],
  ['pull_request', 'p3/authority-mission', [], true],
  ['pull_request', 'p3/authority-mission', ['other'], true],
  ['pull_request', 'p3/authority-mission', ['full-stack'], true],
  ['pull_request', 'p3/authority-mission', ['component-only'], false],
  ['pull_request', 'main', ['component-only'], false],
]) {
  const actual = vm.runInNewContext(expression, {
    github: { event_name, base_ref },
    labelNames,
    contains: (values, value) => values.includes(value),
  });
  assert.equal(actual, expected, `${event_name} into ${base_ref} with ${labelNames.join(',')}`);
}

console.log('Stacked CI acceptance condition passed');
