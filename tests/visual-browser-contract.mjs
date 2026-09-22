import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const compose = await readFile('compose.yaml', 'utf8');
const wrapper = await readFile('container', 'utf8');
const browser = await readFile('containers/visual-browser.mjs', 'utf8');

assert.match(compose, /^  visual-browser-a: &visual-browser\n/m);
assert.match(compose, /^  visual-browser-b:\n/m);
assert.match(compose, /profiles: \["visual"\]/);
assert.equal(compose.match(/127\.0\.0\.1::9222/g)?.length, 1);
assert.match(compose, /visual-profile-a:\/browser-profile/);
assert.match(compose, /visual-profile-b:\/browser-profile/);
assert.match(compose, /TH_PLAYER_ID: "1"/);
assert.match(compose, /TH_PLAYER_ID: "2"/);
assert.doesNotMatch(compose, /container_name:/);

assert.match(wrapper, /visual\)/);
assert.match(wrapper, /compose exec -T visual-browser-a node containers\/visual-browser-check\.mjs/);
assert.match(wrapper, /compose exec -T visual-browser-b node containers\/visual-browser-check\.mjs/);
assert.match(wrapper, /compose port visual-browser-a 9222/);
assert.match(wrapper, /compose port visual-browser-b 9222/);
assert.match(wrapper, /--profile test --profile visual down/);
assert.match(wrapper, /Cleanup: sh container \$agent_id down/);
assert.match(browser, /setPresentationPaused\(true\)/);

console.log('Manual browser container contract passed');
