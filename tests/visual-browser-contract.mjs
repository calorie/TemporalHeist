import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const compose = await readFile('compose.yaml', 'utf8');
const wrapper = await readFile('container', 'utf8');

assert.match(compose, /^  visual-browser:\n/m);
assert.match(compose, /profiles: \["visual"\]/);
assert.match(compose, /127\.0\.0\.1::9222/);
assert.match(compose, /visual-profile:\/browser-profile/);
assert.doesNotMatch(compose, /container_name:/);

assert.match(wrapper, /visual\)/);
assert.match(wrapper, /compose port visual-browser 9222/);
assert.match(wrapper, /--profile test --profile visual down/);

console.log('Manual browser container contract passed');
