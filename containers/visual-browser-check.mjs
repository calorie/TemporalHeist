import assert from 'node:assert/strict';

const deadline = Date.now() + 30_000;
let targets;
while (Date.now() < deadline) {
  try {
    const response = await fetch('http://127.0.0.1:9222/json/list');
    if (response.ok) targets = await response.json();
  } catch {}
  const players = new Set(
    targets
      ?.filter((target) => target.type === 'page' && target.url.startsWith('http://web:5173/'))
      .map((target) => new URL(target.url).searchParams.get('player')),
  );
  if (players?.has('1') && players.has('2')) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const gameTargets = targets?.filter(
  (target) => target.type === 'page' && target.url.startsWith('http://web:5173/'),
) ?? [];
for (const player of ['1', '2']) {
  const target = gameTargets.find(
    (candidate) => new URL(candidate.url).searchParams.get('player') === player,
  );
  assert(target, `container Chromium did not expose player ${player} over CDP`);
  assert(target.webSocketDebuggerUrl, `player ${player} CDP target has no debugger URL`);
}
console.log(JSON.stringify({
  event: 'container-chromium-ready',
  targets: gameTargets.map(({ id, title, url }) => ({ id, title, url })),
}));
