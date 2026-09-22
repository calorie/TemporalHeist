import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const artifacts = `/artifacts/e2e-${process.env.TH_AGENT_ID}`;
await mkdir(artifacts, { recursive: true });
const flags = [
  '--no-sandbox',
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--use-vulkan=swiftshader',
  '--enable-features=Vulkan',
  '--disable-vulkan-surface',
  '--enable-unsafe-swiftshader',
  '--unsafely-treat-insecure-origin-as-secure=http://web:5173',
];

const contexts = [];
const evidence = { agent: process.env.TH_AGENT_ID, events: [] };

async function snapshot(page) {
  return page.evaluate(() => window.th.snapshot());
}

async function moveTo(page, playerId, x, z, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    const pose = state?.players.find((candidate) => candidate.playerId === playerId);
    if (pose && Math.abs(pose.xMm - x) <= 180 && Math.abs(pose.zMm - z) <= 180) {
      await page.evaluate(() => window.th.move(0, 0));
      return state;
    }
    assert(pose, `player ${playerId} missing from authoritative snapshot`);
    const dx = Math.abs(pose.xMm - x) <= 120 ? 0 : Math.sign(x - pose.xMm);
    const dz = Math.abs(pose.zMm - z) <= 120 ? 0 : Math.sign(z - pose.zMm);
    await page.evaluate(([mx, mz]) => window.th.move(mx, mz), [dx, dz]);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`player ${playerId} did not reach (${x}, ${z})`);
}

async function waitFor(page, predicate, description, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    if (state && predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`timed out waiting for ${description}`);
}

async function recordEchoPlate(pageA, plateId, doorId, x, z) {
  const outside = await moveTo(pageA, 1, x - 1000, z);
  assert.equal(outside.plates.find((plate) => plate.id === plateId)?.active, false);
  await pageA.evaluate(() => window.th.move(1, 0));
  const entered = await waitFor(pageA,
    (state) => state.plates.find((plate) => plate.id === plateId)?.livePresence > 0,
    `live presence on plate ${plateId}`);
  evidence.events.push({ event: 'live-plate', plateId, tick: entered.serverTick });
  await moveTo(pageA, 1, x, z);
  // Record four seconds of plate occupancy, leaving enough delayed Echo window
  // for two live players to traverse an authority-controlled door in sequence.
  await waitFor(pageA, (state) => state.serverTick >= entered.serverTick + 240,
    `recording window on plate ${plateId}`, 6000);
  await moveTo(pageA, 1, x - 1200, z);
  const left = await waitFor(pageA,
    (state) => !state.plates.find((plate) => plate.id === plateId)?.active,
    `plate ${plateId} release`);
  assert(left.serverTick > entered.serverTick);
  const echoed = await waitFor(pageA, (state) => {
    const plate = state.plates.find((candidate) => candidate.id === plateId);
    const door = state.doors.find((candidate) => candidate.id === doorId);
    return plate?.echoPresence > 0 && door?.active;
  }, `Echo presence on plate ${plateId}`, 15000);
  const observedDelay = echoed.serverTick - entered.serverTick;
  const echo = echoed.echoes.find((candidate) => candidate.playerId === 1);
  assert.equal(echo?.sourceTick, echoed.serverTick - 600);
  assert(Math.abs(echo.sourceTick - entered.serverTick) <= 6,
    `replicated transition differs from Echo source by ${echo.sourceTick - entered.serverTick} ticks`);
  evidence.events.push({
    event: 'echo-door-open', plateId, doorId, enteredTick: entered.serverTick,
    openedTick: echoed.serverTick, observedDelayTicks: observedDelay,
    echoSourceTick: echo.sourceTick, canonicalDelayTicks: echoed.serverTick - echo.sourceTick,
  });
  return echoed;
}

try {
  for (const player of [1, 2]) {
    const context = await chromium.launchPersistentContext(`${artifacts}/client-${player}`, {
      channel: 'chromium', headless: true, args: flags,
    });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(`http://web:5173/?player=${player}&room=${process.env.TH_ROOM_ID}`);
    await page.waitForFunction(() => window.th?.joined(), { timeout: 30000 });
  }
  const [pageA, pageB] = contexts.map((context) => context.pages().at(-1));

  // Zone 1: A records the tutorial plate; B crosses, then A's Echo frees A.
  await recordEchoPlate(pageA, 21, 11, 4500, 2500);
  await moveTo(pageA, 1, 8000, 4000);
  await moveTo(pageB, 2, 8000, 4000);

  // Zone 2: repeat the delayed-presence lesson so both players reach the proof room.
  await recordEchoPlate(pageA, 22, 12, 12500, 2500);
  await moveTo(pageB, 2, 16000, 4000);
  await moveTo(pageA, 1, 16000, 4000);

  // Zone 3 acceptance: A leaves its plate; exactly 600 authority ticks later its
  // Echo opens the current door, and B crosses while A remains elsewhere.
  await moveTo(pageB, 2, 21500, 4000);
  const finalOpen = await recordEchoPlate(pageA, 23, 13, 19500, 2500);
  await moveTo(pageB, 2, 23000, 4000);
  const finalA = await waitFor(pageA,
    (state) => state.players.find((player) => player.playerId === 2)?.xMm > 22400,
    'client A observing player B beyond the co-op door');
  const finalB = await waitFor(pageB,
    (state) => state.players.find((player) => player.playerId === 2)?.xMm > 22400,
    'client B observing its authoritative crossing');
  assert.equal(finalA.roomEpoch, finalB.roomEpoch);
  assert(finalA.doors.find((door) => door.id === 13)?.active);
  assert(finalB.doors.find((door) => door.id === 13)?.active);
  assert(finalOpen.doors.find((door) => door.id === 13)?.active);

  evidence.finalTick = finalA.serverTick;
  evidence.finalSnapshot = finalA;
  evidence.renderers = await Promise.all([pageA, pageB].map((page) => page.evaluate(() => window.th.rendererInfo())));
  evidence.errors = await Promise.all([pageA, pageB].map((page) => page.evaluate(() => window.th.errors())));
  assert(evidence.renderers.every((renderer) => renderer?.backend === 'webgpu'));
  assert(evidence.renderers.every((renderer) => renderer?.adapter?.vendor));
  assert(finalA.echoes.some((echo) => echo.playerId === 1));
  assert(finalB.echoes.some((echo) => echo.playerId === 1));
  assert(evidence.errors.every((errors) => errors.length === 0));
  await Promise.all([pageA, pageB].map((page, index) => page.screenshot({ path: `${artifacts}/client-${index + 1}.png` })));
  await writeFile(`${artifacts}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ event: 'vertical-slice-passed', ...evidence }));
} finally {
  await Promise.all(contexts.map((context) => context.close()));
}
