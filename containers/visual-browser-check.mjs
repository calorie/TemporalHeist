import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const player = process.env.TH_PLAYER_ID;
assert(['1', '2'].includes(player), 'TH_PLAYER_ID must be 1 or 2');
const artifacts = `/artifacts/visual-${process.env.TH_AGENT_ID}`;
const screenshotFile = `${artifacts}/player-${player}-lobby.png`;
const metadataFile = `${artifacts}/player-${player}-metadata.json`;

const deadline = Date.now() + 30_000;
let targets;
let metadata;
while (Date.now() < deadline) {
  try {
    const response = await fetch('http://127.0.0.1:9222/json/list');
    if (response.ok) targets = await response.json();
  } catch {}
  const readyTarget = targets?.some(
    (target) => target.type === 'page'
      && target.url.startsWith('http://web:5173/')
      && new URL(target.url).searchParams.get('player') === player,
  );
  try {
    if (readyTarget) {
      await access(screenshotFile);
      metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const gameTargets = targets?.filter(
  (target) => target.type === 'page' && target.url.startsWith('http://web:5173/'),
) ?? [];
const target = gameTargets.find(
  (candidate) => new URL(candidate.url).searchParams.get('player') === player,
);
assert(target, `container Chromium did not expose player ${player} over CDP`);
assert(target.webSocketDebuggerUrl, `player ${player} CDP target has no debugger URL`);
assert(metadata, `player ${player} visual evidence was not ready before timeout`);
assert.equal(String(metadata.capture.player), player);
assert.equal(metadata.capture.renderer?.backend, 'webgpu');
assert(metadata.capture.renderer?.adapter?.vendor, 'WebGPU adapter vendor is missing');
assert.deepEqual(metadata.capture.errors, [], `player ${player} reported renderer/page errors`);
console.log(JSON.stringify({
  event: 'container-chromium-ready',
  player,
  target: { id: target.id, title: target.title, url: target.url },
  renderer: metadata.capture.renderer,
  evidence: [metadataFile, screenshotFile],
}));
