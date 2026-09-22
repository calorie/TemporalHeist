import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

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

// Exercise the capture boundary: visual artifacts must carry canonical guard
// state and its visible explanation, so a screenshot can be diagnosed later.
const captureSource = browser.slice(browser.indexOf('const capture = await page.evaluate('),
  browser.indexOf('await writeFile('));
const guards = [{ id: 51, state: 2, investigationTarget: { xMm: 19000, zMm: 2800 } }];
const capture = await vm.runInNewContext(`(async () => { ${captureSource}; return capture; })()`, {
  file: 'player-1-lobby.png', player: 1, pageErrors: [],
  page: { evaluate: (callback, args) => callback(args) },
  document: { title: 'Temporal Heist', querySelector: () => ({ textContent: 'GUARD 51 · INVESTIGATING' }) },
  location: { href: 'http://web:5173/' }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  window: { th: { snapshot: () => ({ guards }), rendererInfo: () => ({ backend: 'webgpu' }), errors: () => [] } },
});
assert.deepEqual(capture.guards, guards, 'visual metadata must include canonical guard snapshots');
assert.equal(capture.hud.guard, 'GUARD 51 · INVESTIGATING');

console.log('Manual browser container contract passed');
