import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const flags = ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan',
  '--use-vulkan=swiftshader', '--enable-features=Vulkan', '--enable-unsafe-swiftshader',
  '--unsafely-treat-insecure-origin-as-secure=http://web:5173'];
const contexts = [];
const pages = [];
const pageErrors = [[], []];
const waitJoined = (page) => page.waitForFunction(() => window.th?.joined(), undefined, { timeout: 45_000 });
const snap = (page) => page.evaluate(() => window.th.snapshot());
const marker = (event, data = {}) => console.log(JSON.stringify({ event, ...data }));
async function waitFile(path) {
  while (!existsSync(path)) await new Promise((resolve) => setTimeout(resolve, 100));
}

try {
  for (const player of [1, 2]) {
    const context = await chromium.launchPersistentContext(`/artifacts/recovery-${player}`, {
      channel: 'chromium', headless: true, viewport: { width: 960, height: 540 }, args: flags,
    });
    contexts.push(context);
    const page = context.pages()[0] ?? await context.newPage();
    pages.push(page);
    page.on('pageerror', (error) => pageErrors[player - 1].push(error.message));
    await page.goto(`http://web:5173/?player=${player}&room=${process.env.TH_ROOM_ID}`);
    await waitJoined(page);
    await page.evaluate((id) => { window.__recoveryIdentity = id; }, `client-${player}`);
  }
  await Promise.all(pages.map((page) => page.evaluate(() => window.th.ready())));
  await Promise.all(pages.map((page) => page.waitForFunction(() =>
    window.th.snapshot()?.room?.phase === 2, undefined, { timeout: 30_000 })));
  const before = await snap(pages[0]);
  const beforeEpoch = before.roomEpoch;
  const beforeTick = before.serverTick;
  marker('baseline-ready', { epoch: beforeEpoch, tick: beforeTick });
  await waitFile('/artifacts/relay-stopped');
  await Promise.all(pages.map((page) => page.waitForFunction(() =>
    /degraded|reconnecting|connecting/.test(window.th?.status() ?? ''), undefined, { timeout: 30_000 })));
  marker('relay-outage-observed');
  await waitFile('/artifacts/relay-started');
  await pages[0].waitForFunction(({ epoch, tick }) =>
    window.th?.joined() && window.th.snapshot()?.roomEpoch === epoch &&
    window.th.snapshot()?.serverTick > tick + 30,
  { epoch: beforeEpoch, tick: beforeTick }, { timeout: 60_000 });
  await Promise.all(pages.map(waitJoined));
  const poseBefore = (await snap(pages[0])).players.find(({ playerId }) => playerId === 1);
  assert(poseBefore);
  await pages[0].evaluate(() => window.th.move(0.5, 0));
  await pages[0].waitForFunction((x) =>
    (window.th.snapshot()?.players.find(({ playerId }) => playerId === 1)?.xMm ?? 0) > x + 120,
  poseBefore.xMm, { timeout: 30_000 });
  await pages[0].evaluate(() => window.th.move(0, 0));
  for (const [index, page] of pages.entries()) {
    assert.equal(await page.evaluate(() => window.__recoveryIdentity), `client-${index + 1}`);
    assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), 1);
  }
  marker('relay-recovered', { epoch: (await snap(pages[0])).roomEpoch });
  await waitFile('/artifacts/authority-restarted');
  await Promise.all(pages.map((page) => page.waitForFunction((epoch) =>
    window.th?.joined() && window.th.snapshot()?.roomEpoch !== epoch,
  beforeEpoch, { timeout: 60_000 })));
  const after = await snap(pages[0]);
  assert.notEqual(after.roomEpoch, beforeEpoch);
  for (const [index, page] of pages.entries()) {
    const timeline = await page.evaluate(() => window.th.timeline());
    assert.equal(timeline.epoch, after.roomEpoch);
    assert(timeline.firstTick <= timeline.latestTick);
    const temporal = await page.evaluate(() => window.th.temporalPresentation());
    if (temporal) assert.equal(temporal.epoch, after.roomEpoch);
    assert.equal(await page.evaluate(() => window.__recoveryIdentity), `client-${index + 1}`);
    assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), 1);
    await page.evaluate(() => window.th.ready());
  }
  await Promise.all(pages.map((page) => page.waitForFunction(() =>
    window.th.snapshot()?.room?.phase === 2, undefined, { timeout: 30_000 })));
  assert.deepEqual(pageErrors, [[], []]);
  for (const page of pages) assert.deepEqual(await page.evaluate(() => window.th.errors()), []);
  marker('authority-recovered', { oldEpoch: beforeEpoch, newEpoch: after.roomEpoch,
    reloads: [1, 1], rejoined: true, ready: true });
} finally {
  await Promise.all(contexts.map((context) => context.close()));
}
