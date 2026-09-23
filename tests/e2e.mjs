import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { captureScreenshot } from './screenshot.mjs';
import { guardAgreement } from './guard-agreement.mjs';
import { assertGuardLure } from './guard-lure.mjs';
import facility from '../map/facility.json' with { type: 'json' };

const artifacts = `/artifacts/e2e-${process.env.TH_AGENT_ID}`;
await mkdir(artifacts, { recursive: true });
const viewport = { width: 1280, height: 720 };
const stateTimeout = 30_000;
const moveTimeout = Number(process.env.TH_E2E_MOVE_TIMEOUT_MS ?? 45_000);
const startDelay = Number(process.env.TH_E2E_START_DELAY_MS ?? 0);
const movementAxis = 0.25;
assert(Number.isSafeInteger(moveTimeout) && moveTimeout >= 45_000);
assert(Number.isSafeInteger(startDelay) && startDelay >= 0);
const flags = [
  '--no-sandbox',
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--use-vulkan=swiftshader',
  '--enable-features=Vulkan',
  '--enable-unsafe-swiftshader',
  '--unsafely-treat-insecure-origin-as-secure=http://web:5173',
];

const contexts = [];
const evidence = {
  agent: process.env.TH_AGENT_ID,
  viewport: { ...viewport, deviceScaleFactor: 1 },
  events: [],
  screenshots: [],
};
const RoomPhase = Object.freeze({ LOBBY: 1, ACTIVE: 2, WON: 3, FAILED: 4 });
const FailureReason = Object.freeze({ UNSPECIFIED: 0, TIMEOUT: 1, SURVEILLANCE: 2, GUARD: 3 });
const GuardState = Object.freeze({ PATROL: 1, INVESTIGATE: 2, RETURN: 3 });
const browserErrors = [[], []];
const camera41 = Object.freeze({ x: 4500, z: 7500, directionX: 0, directionZ: -1000,
  range: 2200, halfWidth: 1200 });

function cameraContains(camera, pose) {
  const dx = pose.xMm - camera.x;
  const dz = pose.zMm - camera.z;
  const forward = dx * camera.directionX + dz * camera.directionZ;
  if (forward < 0 || forward > camera.range * 1000) return false;
  const lateral = Math.abs(dx * camera.directionZ - dz * camera.directionX);
  return lateral * camera.range <= camera.halfWidth * forward;
}

async function snapshot(page) {
  return page.evaluate(() => window.th.snapshot());
}

async function uiState(page) {
  return page.evaluate(() => ({
    briefing: document.querySelector('#briefing')?.textContent?.trim(),
    echoStatus: document.querySelector('#echo-status')?.textContent?.trim(),
    guardStatus: document.querySelector('#guard-status')?.textContent?.trim(),
    hudPhase: document.querySelector('#hud')?.getAttribute('data-phase'),
    mutePressed: document.querySelector('#mute')?.getAttribute('aria-pressed'),
    objective: document.querySelector('#objective')?.textContent?.trim(),
    phase: document.querySelector('#phase')?.textContent?.trim(),
    readiness: document.querySelector('#readiness')?.textContent?.trim(),
    result: document.querySelector('#result')?.textContent?.trim(),
    resultState: document.querySelector('#result')?.getAttribute('data-state'),
    timer: document.querySelector('#timer')?.textContent?.trim(),
  }));
}

async function waitForText(page, selector, pattern, description, timeout = stateTimeout) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible', timeout });
  const deadline = Date.now() + timeout;
  let text = '';
  while (Date.now() < deadline) {
    text = (await locator.innerText()).trim();
    if (pattern.test(text)) return text;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${description}; ${selector}=${JSON.stringify(text)}`);
}

async function waitForPresentation(page, phase, resultState, resultPattern) {
  await page.waitForFunction(
    ({ phase, resultState }) =>
      document.querySelector('#hud')?.getAttribute('data-phase') === phase &&
      document.querySelector('#result')?.getAttribute('data-state') === resultState,
    { phase, resultState },
    { timeout: stateTimeout },
  );
  const ui = await uiState(page);
  if (resultPattern) assert.match(ui.result ?? '', resultPattern);
  return ui;
}

async function assertOnboarding(page) {
  const briefing = await waitForText(page, '#briefing', /ECHO/i, 'Echo onboarding');
  for (const expected of [
    /WASD|ARROW/i,
    /INTERACT|\bE\b/i,
    /READY|ENTER/i,
    /PLATE/i,
    /LEAVE/i,
    /10.SECONDS|00:10/i,
    /DOOR/i,
    /SURVEILLANCE|CAMERA/i,
    /GUARD.*HUMAN.*ECHO/i,
    /EXTRACTION/i,
    /RESTART|RETRY/i,
  ]) assert.match(briefing, expected);
  const mute = page.locator('#mute');
  await mute.waitFor({ state: 'visible', timeout: stateTimeout });
  assert.equal(await mute.getAttribute('aria-pressed'), 'false');
}

async function useVisibleControl(page, selector, key) {
  const control = page.locator(selector);
  await control.waitFor({ state: 'visible', timeout: stateTimeout });
  assert.equal(await control.isEnabled(), true, `${selector} is disabled`);
  if (key) await page.keyboard.press(key);
  else await control.click();
}

async function capture(page, player, label, objectiveSecured) {
  const file = `player-${player}-${label}.png`;
  const sceneSamples = await captureScreenshot(page, `${artifacts}/${file}`, objectiveSecured);
  evidence.screenshots.push({ file, player, label, sceneSamples, ui: await uiState(page) });
  console.log(JSON.stringify({ event: 'screenshot-captured', player, label }));
}

async function moveTo(page, playerId, x, z, timeout = moveTimeout, axis = movementAxis) {
  const deadline = Date.now() + timeout;
  let lastState;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    lastState = state;
    assert.notEqual(state?.room?.phase, RoomPhase.FAILED,
      `movement failed: ${JSON.stringify(state?.room)}`);
    const pose = state?.players.find((candidate) => candidate.playerId === playerId);
    if (
      state?.room?.phase === RoomPhase.WON &&
      x >= 22_800 &&
      pose?.xMm >= 22_800 &&
      pose.zMm >= 3_000 &&
      pose.zMm <= 5_000
    ) {
      await page.evaluate(() => window.th.move(0, 0));
      return state;
    }
    if (pose && Math.abs(pose.xMm - x) <= 180 && Math.abs(pose.zMm - z) <= 180) {
      await page.evaluate(() => window.th.move(0, 0));
      return state;
    }
    if (!pose) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }
    const dx = Math.abs(pose.xMm - x) <= 120 ? 0 : Math.sign(x - pose.xMm) * Math.min(axis, Math.abs(x - pose.xMm) / 600);
    const dz = Math.abs(pose.zMm - z) <= 120 ? 0 : Math.sign(z - pose.zMm) * Math.min(axis, Math.abs(z - pose.zMm) / 600);
    await page.evaluate(([mx, mz]) => window.th.move(mx, mz), [dx, dz]);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const pose = lastState?.players.find((candidate) => candidate.playerId === playerId);
  throw new Error(`player ${playerId} did not reach (${x}, ${z}); ${JSON.stringify({
    pose,
    tick: lastState?.serverTick,
    phase: lastState?.room?.phase,
    failureReason: lastState?.room?.failureReason,
    failureHazardId: lastState?.room?.failureHazardId,
  })}`);
}

async function occupyPlate(page, playerId, plateId, x, z, timeout = moveTimeout) {
  const deadline = Date.now() + timeout;
  let consecutivePresence = 0;
  let lastState;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    lastState = state;
    const pose = state?.players.find((candidate) => candidate.playerId === playerId);
    const present = state?.plates.find((plate) => plate.id === plateId)?.livePresence > 0;
    if (present) {
      await page.evaluate(() => window.th.move(0, 0));
      consecutivePresence += 1;
      if (consecutivePresence >= 10) return state;
    } else if (pose) {
      consecutivePresence = 0;
      const dx = Math.abs(pose.xMm - x) <= 120 ? 0 : Math.sign(x - pose.xMm) * movementAxis;
      const dz = Math.abs(pose.zMm - z) <= 120 ? 0 : Math.sign(z - pose.zMm) * movementAxis;
      await page.evaluate(([mx, mz]) => window.th.move(mx, mz), [dx, dz]);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`player ${playerId} did not settle on plate ${plateId}; ${JSON.stringify({
    tick: lastState?.serverTick,
    pose: lastState?.players.find((candidate) => candidate.playerId === playerId),
    plate: lastState?.plates.find((candidate) => candidate.id === plateId),
  })}`);
}

async function moveRightPast(page, playerId, x, z, timeout = moveTimeout) {
  const deadline = Date.now() + timeout;
  let lastState;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    lastState = state;
    const pose = state?.players.find((candidate) => candidate.playerId === playerId);
    if (
      state?.room?.phase === RoomPhase.WON &&
      x >= 22_800 &&
      pose?.xMm >= 22_800 &&
      pose.zMm >= 3_000 &&
      pose.zMm <= 5_000
    ) {
      await page.evaluate(() => window.th.move(0, 0));
      return state;
    }
    if (pose?.xMm >= x && Math.abs(pose.zMm - z) <= 180) {
      await page.evaluate(() => window.th.move(0, 0));
      return state;
    }
    if (pose) {
      const dx = pose.xMm >= x ? 0 : movementAxis;
      const dz = Math.abs(pose.zMm - z) <= 120 ? 0 : Math.sign(z - pose.zMm) * movementAxis;
      await page.evaluate(([mx, mz]) => window.th.move(mx, mz), [dx, dz]);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`player ${playerId} did not pass x=${x}; ${JSON.stringify({
    tick: lastState?.serverTick,
    pose: lastState?.players.find((candidate) => candidate.playerId === playerId),
  })}`);
}

async function enterSurveillance(page, playerId, x, z, timeout = moveTimeout) {
  const deadline = Date.now() + timeout;
  let lastState;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    lastState = state;
    if (state?.room?.phase === RoomPhase.FAILED) return state;
    const pose = state?.players.find((candidate) => candidate.playerId === playerId);
    if (pose) {
      const dx = Math.abs(pose.xMm - x) <= 120 ? 0 : Math.sign(x - pose.xMm) * movementAxis;
      const dz = Math.abs(pose.zMm - z) <= 120 ? 0 : Math.sign(z - pose.zMm) * movementAxis;
      await page.evaluate(([mx, mz]) => window.th.move(mx, mz), [dx, dz]);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`player ${playerId} did not trigger surveillance; ${JSON.stringify({
    tick: lastState?.serverTick,
    pose: lastState?.players.find((candidate) => candidate.playerId === playerId),
    room: lastState?.room,
    guards: lastState?.guards,
  })}`);
}

async function waitFor(page, predicate, description, timeout = stateTimeout) {
  const deadline = Date.now() + timeout;
  let lastState;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    lastState = state;
    if (state && predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`timed out waiting for ${description}; ${JSON.stringify({
    tick: lastState?.serverTick,
    players: lastState?.players,
    doors: lastState?.doors,
    plates: lastState?.plates,
    room: lastState?.room,
  })}`);
}

async function waitForPhase(page, phase, description, timeout = stateTimeout) {
  return waitFor(page, (state) => state.room?.phase === phase, description, timeout);
}

async function recordEchoPlate(pageA, plateId, doorId, x, z, whileLive, north = false) {
  const outside = await moveTo(pageA, 1, north ? x : x - 2000, north ? z - 1500 : z);
  assert.equal(outside.plates.find((plate) => plate.id === plateId)?.active, false);
  const entered = await occupyPlate(pageA, 1, plateId, x, z);
  evidence.events.push({ event: 'live-plate', plateId, tick: entered.serverTick });
  // Record twenty seconds so a cold CI runner still observes a useful replay window.
  await waitFor(pageA, (state) => state.serverTick >= entered.serverTick + 1_200,
    `recording window on plate ${plateId}`, 25_000);
  if (whileLive) await whileLive();
  await pageA.evaluate(([axis, north]) => window.th.move(north ? 0 : -axis, north ? -axis : 0), [movementAxis, north]);
  const left = await waitFor(pageA,
    (state) => state.plates.find((plate) => plate.id === plateId)?.livePresence === 0,
    `live player release of plate ${plateId}`);
  await pageA.evaluate(() => window.th.move(0, 0));
  assert(left.serverTick > entered.serverTick);
  const echoed = await waitFor(pageA, (state) => {
    const plate = state.plates.find((candidate) => candidate.id === plateId);
    const door = state.doors.find((candidate) => candidate.id === doorId);
    return plate?.echoPresence > 0 && door?.active;
  }, `Echo presence on plate ${plateId}`, 25_000);
  const observedDelay = echoed.serverTick - entered.serverTick;
  const echo = echoed.echoes.find((candidate) => candidate.playerId === 1);
  assert.equal(echo?.sourceTick, echoed.serverTick - 600);
  // Browser observations and input delivery can lag authority processing, so
  // neither `outside` nor `entered` is a stable lower bound for the source tick.
  // Echo Presence in this same snapshot proves the source pose is on the plate;
  // the equality above proves its exact canonical delay.
  assert(echo.sourceTick <= left.serverTick,
    `Echo source ${echo.sourceTick} follows observed live occupancy ${left.serverTick}`);
  evidence.events.push({
    event: 'echo-door-open', plateId, doorId, enteredTick: entered.serverTick,
    openedTick: echoed.serverTick, observedDelayTicks: observedDelay,
    echoSourceTick: echo.sourceTick, canonicalDelayTicks: echoed.serverTick - echo.sourceTick,
  });
  return echoed;
}

const guardOf = (state) => state.guards.find((guard) => guard.id === 51);
const positions = (state) => state.players.map(({ playerId, xMm, zMm }) => ({ playerId, xMm, zMm }));
const dash = (page, player, x, z) => moveTo(page, player, x, z, moveTimeout, 1);

async function sharedGuardSnapshot(pageA, pageB, investigating) {
  const samples = [new Map([[investigating.serverTick, investigating]]), new Map()];
  const enteredTick = guardOf(investigating).stateEnteredTick;
  const deadline = Date.now() + stateTimeout;
  while (Date.now() < deadline) {
    const latest = await Promise.all([snapshot(pageA), snapshot(pageB)]);
    for (const [index, state] of latest.entries())
      if (state) samples[index].set(state.serverTick, state);
    for (const [tick, clientA] of samples[0]) {
      const clientB = samples[1].get(tick);
      const guard = guardOf(clientA);
      if (clientB && guard?.state === GuardState.INVESTIGATE && guard.stateEnteredTick === enteredTick)
        return guardAgreement(clientA, clientB);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('No shared canonical tick observed during the guard investigation');
}

async function sharedObjectiveSnapshot(pageA, pageB) {
  const samples = [new Map(), new Map()];
  const deadline = Date.now() + stateTimeout;
  while (Date.now() < deadline) {
    const latest = await Promise.all([snapshot(pageA), snapshot(pageB)]);
    for (const [index, state] of latest.entries()) {
      assert.equal(state.room.phase, RoomPhase.ACTIVE);
      if (state.room.objectiveSecured) samples[index].set(state.serverTick, state);
    }
    for (const [tick, clientA] of samples[0]) {
      const clientB = samples[1].get(tick);
      if (!clientB) continue;
      assert.equal(clientA.roomEpoch, clientB.roomEpoch);
      assert.deepEqual(clientA.room, clientB.room);
      return clientA;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('No shared canonical tick observed with the vault data secured');
}

async function guardPixel(page, expectedState) {
  if (expectedState === GuardState.INVESTIGATE) {
    // Until the source's 30-tick observation window closes, a moving Echo
    // can rotate the cone between choosing a pixel and GPU readback. Wait on
    // authority ticks for a retained target; the live crossing runs in parallel.
    await waitFor(page, (state) => guardOf(state).state === expectedState &&
      state.serverTick >= guardOf(state).stateEnteredTick + 30,
    'stable investigation target before cone readback');
  }
  // Sample well inside the radial cone, offset from its route/body centerline.
  const guard = guardOf(await snapshot(page));
  assert.equal(guard.state, expectedState);
  const length = Math.hypot(guard.facingX, guard.facingZ);
  const fx = guard.facingX / length, fz = guard.facingZ / length;
  const x = guard.xMm + fx * 1000 - fz * 250;
  const z = guard.zMm + fz * 1000 + fx * 250;
  const pixelsPerWorldUnit = 1280 / 26000;
  const pixel = [640 + (x - 12000) * pixelsPerWorldUnit,
    360 + (z - 4000) * pixelsPerWorldUnit];
  const rgba = await page.evaluate(([x, y]) => window.th.rendererPixel(x, y), pixel);
  if (expectedState === GuardState.PATROL)
    assert(rgba[1] > rgba[0] + 15, `patrol cone must be teal: ${rgba}`);
  else assert(rgba[0] > rgba[1] + 30, `investigation cone must be red: ${rgba}`);
  evidence.events.push({ event: 'guard-cone-pixel', state: expectedState, pixel, rgba });
}

async function safeGuardEntry(page, player) {
  // Keep the waiting position beyond the guard's maximum range. Aim through
  // the doorway center so input/observation lag cannot clip its lower wall.
  await dash(page, player, 14200, 4000);
  await dash(page, player, 15800, 4000);
  await dash(page, player, 15800, 6000);
}

async function guardDiversion(pageA, pageB) {
  await dash(pageB, 2, 17800, 6000);
  await dash(pageA, 1, 15800, 2200);
  await dash(pageA, 1, 17700, 2200);
  // Reject both former side-lane bypasses before recording the decoy. Neither
  // live player may reach the far side before the authority starts Investigate.
  await Promise.all([[pageA, 1, 'north'], [pageB, 2, 'south']].map(async ([page, playerId, lane]) => {
    const start = await snapshot(page);
    await page.evaluate(() => window.th.move(1, 0));
    let stopped;
    try {
      stopped = await waitFor(page, (state) => {
        assert.equal(state.room.phase, RoomPhase.ACTIVE);
        assert.equal(guardOf(state).state, GuardState.PATROL);
        const pose = state.players.find((pose) => pose.playerId === playerId);
        assert(pose.xMm < facility.guardedPassage.minX, `${lane} bypass reached the passage's far side`);
        return state.serverTick >= start.serverTick + 90;
      }, `${lane} live bypass blocked by the authored wall`);
    } finally {
      await page.evaluate(() => window.th.move(0, 0));
    }
    evidence.events.push({ event: 'guard-bypass-rejected', lane, playerId,
      startTick: start.serverTick, tick: stopped.serverTick,
      pose: stopped.players.find((pose) => pose.playerId === playerId), guard: guardOf(stopped) });
  }));
  await dash(pageA, 1, 17200, 2200);
  await waitFor(pageA, (state) => {
    const guard = guardOf(state);
    return guard.state === GuardState.PATROL && guard.xMm >= 20000 && guard.xMm <= 20200 && guard.waypointId === 512;
  }, 'guard moving out of range before recording the decoy');
  const sourceStart = await snapshot(pageA);
  // Stop on the first crossing of the decoy depth. A delayed observation must
  // not make the human oscillate around a narrow target while the guard returns.
  await pageA.evaluate(() => window.th.move(0, 1));
  const lure = await waitFor(pageA, (state) => {
    assert.equal(state.room.phase, RoomPhase.ACTIVE);
    return state.players.find((pose) => pose.playerId === 1).zMm >= 3620;
  }, 'live player reaches the decoy depth');
  await pageA.evaluate(() => window.th.move(0, 0));
  evidence.events.push({ event: 'guard-decoy-recorded', sourceStartTick: sourceStart.serverTick,
    tick: lure.serverTick, pose: lure.players.find((pose) => pose.playerId === 1), guard: guardOf(lure) });
  await dash(pageA, 1, 17200, 2000);
  // The replay turns the investigating cone northwest. Reposition around the
  // out-of-range west edge so both live players wait behind it to the south.
  await dash(pageA, 1, 15800, 2000);
  await dash(pageA, 1, 15800, 6000);
  await dash(pageA, 1, 17800, 6000);
  const investigating = await waitFor(pageA, (state) => {
    assert.equal(state.room.phase, RoomPhase.ACTIVE);
    const guard = guardOf(state);
    if (state.serverTick < sourceStart.serverTick + 600)
      assert.equal(guard.state, GuardState.PATROL, 'guard investigated before the recorded Echo');
    return guard.state === GuardState.INVESTIGATE;
  }, 'the exact-600-tick Echo diversion', 20000);
  const guard = guardOf(investigating);
  const echo = investigating.echoes.find((pose) => pose.playerId === 1);
  assert.equal(investigating.serverTick - echo.sourceTick, 600);
  assert(guard.stateEnteredTick >= sourceStart.serverTick + 600);
  assert(guard.stateEnteredTick <= lure.serverTick + 600 + 60);
  assertGuardLure(investigating, guard, echo);
  const agreement = await sharedGuardSnapshot(pageA, pageB, investigating);
  await Promise.all([pageA, pageB].map((page) => waitForText(page, '#guard-status', /INVESTIGATING.*CROSS WHEN CLEAR/, 'visible crossing cue')));
  evidence.events.push({ event: 'guard-echo-investigating', sourceStartTick: sourceStart.serverTick,
    lureTick: lure.serverTick, tick: investigating.serverTick, echo, guard, agreement,
    canonicalDelayTicks: investigating.serverTick - echo.sourceTick });
  const diverted = await waitFor(pageA, (state) => {
    assert.equal(state.room.phase, RoomPhase.ACTIVE);
    return guardOf(state).state === GuardState.INVESTIGATE && guardOf(state).searchExpiresTick > 0;
  }, 'Echo draws the west-facing guard clear of the choke');
  evidence.events.push({ event: 'guard-drawn-clear', tick: diverted.serverTick, guard: guardOf(diverted) });
  // SwiftShader screenshots can take longer than the search window. Freeze
  // only presentation after readback, while real MoQ input and authority ticks
  // continue and both players cross. No gameplay state or clock is paused.
  const visuals = (async () => {
    await guardPixel(pageA, GuardState.INVESTIGATE);
    await Promise.all([pageA, pageB].map((page) => page.evaluate(() => window.th.setPresentationPaused(true))));
    try {
      for (const page of [pageA, pageB])
        assert.match((await uiState(page)).guardStatus, /INVESTIGATING.*CROSS WHEN CLEAR/);
      await Promise.all([capture(pageA, 1, 'guard-investigation'), capture(pageB, 2, 'guard-investigation')]);
    } finally {
      await Promise.all([pageA, pageB].map((page) => page.evaluate(() => window.th.setPresentationPaused(false))));
    }
  })();
  const crossing = Promise.all([[pageA, 1, 17800], [pageB, 2, 17800]].map(async ([page, playerId, x]) => {
    await dash(page, playerId, x, 4200);
    const entered = await dash(page, playerId, 18300, 4200);
    const crossed = await dash(page, playerId, 19100, 4200);
    for (const state of [entered, crossed]) {
      assert.equal(state.room.phase, RoomPhase.ACTIVE);
      assert.equal(guardOf(state).state, GuardState.INVESTIGATE);
    }
    const pose = entered.players.find((pose) => pose.playerId === playerId);
    const passage = facility.guardedPassage;
    assert(pose.xMm >= passage.minX && pose.xMm <= passage.maxX &&
      pose.zMm >= passage.minZ && pose.zMm <= passage.maxZ);
    evidence.events.push({ event: 'guard-crossed', playerId, tick: crossed.serverTick, passagePose: pose,
      exitPose: crossed.players.find((pose) => pose.playerId === playerId), guard: guardOf(crossed) });
    // Move clear before waiting for software-rendered evidence to finish.
    await dash(page, playerId, 19500, playerId === 1 ? 1500 : 6000);
    if (playerId === 2) await dash(page, playerId, 21500, 6000);
  }));
  await Promise.all([visuals, crossing]);
}

try {
  for (const player of [1, 2]) {
    const context = await chromium.launchPersistentContext(`${artifacts}/client-${player}`, {
      channel: 'chromium', headless: true, viewport, deviceScaleFactor: 1, args: flags,
    });
    contexts.push(context);
    const page = context.pages()[0] ?? await context.newPage();
    page.on('pageerror', (error) => browserErrors[player - 1].push(error.message));
    await page.goto(`http://web:5173/?player=${player}&room=${process.env.TH_ROOM_ID}`);
    await page.waitForFunction(() => window.th?.joined(), undefined, { timeout: 45_000 });
  }
  const [pageA, pageB] = contexts.map((context) => context.pages().at(-1));

  if (startDelay > 0) {
    await Promise.all([pageA, pageB].map((page) =>
      page.evaluate(() => window.th.setPresentationPaused(true))));
    await new Promise((resolve) => setTimeout(resolve, startDelay));
    await Promise.all([pageA, pageB].map((page) =>
      page.evaluate(() => window.th.setPresentationPaused(false))));
  }

  const lobby = await waitFor(pageA, (state) =>
    state.room?.phase === RoomPhase.LOBBY &&
    state.sessions.filter((session) => session.connected).length === 2,
  'two connected players in the lobby');
  assert.equal(lobby.room.readyPlayers, 0);
  for (const page of [pageA, pageB])
    assert.equal((await snapshot(page)).room.objectiveSecured, false);
  assert(lobby.sessions.every((session) => !session.ready));
  await Promise.all([pageA, pageB].map(assertOnboarding));
  for (const page of [pageA, pageB]) {
    const ui = await waitForPresentation(page, 'lobby', 'none');
    assert.match(ui.phase ?? '', /LOBBY.*ATTEMPT 1/i);
    assert.match(ui.objective ?? '', /READY/i);
    assert.match(ui.readiness ?? '', /0\/2/);
    assert.match(ui.echoStatus ?? '', /STARTS 10 SECONDS AFTER LAUNCH/i);
  }
  await Promise.all([
    capture(pageA, 1, 'lobby-onboarding', false),
    capture(pageB, 2, 'lobby-onboarding', false),
  ]);

  await useVisibleControl(pageA, '#ready');
  const playerAReady = await waitFor(pageB, (state) =>
    state.room?.phase === RoomPhase.LOBBY &&
    state.room.readyPlayers === 1 &&
    state.sessions.find((session) => session.playerId === 1)?.ready,
  'client B observing player A ready');
  assert.equal(playerAReady.sessions.find((session) => session.playerId === 2)?.ready, false);

  await useVisibleControl(pageB, '#ready', 'Enter');
  const activeA = await waitForPhase(pageA, RoomPhase.ACTIVE, 'first attempt on client A');
  const activeB = await waitForPhase(pageB, RoomPhase.ACTIVE, 'first attempt on client B');
  assert.equal(activeA.room.attempt, 1);
  assert.equal(activeB.room.attempt, 1);
  assert.equal(activeA.room.startedTick, activeB.room.startedTick);
  assert.equal(activeA.room.deadlineTick - activeA.room.startedTick, 18_000);
  assert.equal(activeA.room.readyPlayers, 2);
  assert(activeA.sessions.every((session) => session.ready));
  for (const page of [pageA, pageB]) {
    const ui = await waitForPresentation(page, 'active', 'none');
    assert.match(ui.phase ?? '', /ACTIVE.*ATTEMPT 1/i);
    assert.match(ui.objective ?? '', /STEAL.*VAULT DATA/i);
    assert.match(ui.timer ?? '', /^0[0-5]:[0-5][0-9]$/);
    assert.match(ui.readiness ?? '', /2\/2/);
    await waitForText(page, '#echo-status', /^ECHO IN 00:[0-9]{2}$/,
      'first-Echo authority countdown');
  }
  evidence.events.push({
    event: 'attempt-started', attempt: activeA.room.attempt,
    startedTick: activeA.room.startedTick, deadlineTick: activeA.room.deadlineTick,
  });

  await guardPixel(pageA, GuardState.PATROL);
  // First demonstrate that a human cannot simply walk through the patrol.
  await recordEchoPlate(pageA, 21, 11, 4500, 2500,
    () => moveRightPast(pageB, 2, 8000, 4000));
  await moveRightPast(pageA, 1, 8000, 4000);
  await recordEchoPlate(pageA, 22, 12, 12500, 2500);
  const guardFailedA = await enterSurveillance(pageA, 1, 19000, 4000);
  const guardFailedB = await waitForPhase(pageB, RoomPhase.FAILED, 'guard failure on client B');
  for (const failed of [guardFailedA, guardFailedB]) {
    assert.equal(failed.room.failureReason, FailureReason.GUARD);
    assert.equal(failed.room.failureGuardId, 51);
    assert.equal(failed.room.failureHazardId, 0);
  }
  assert.deepEqual(guardFailedA.room, guardFailedB.room);
  assert.deepEqual(guardFailedA.guards, guardFailedB.guards);
  assert.deepEqual(positions(guardFailedA), positions(guardFailedB));
  await Promise.all([pageA, pageB].map((page) => waitForPresentation(page, 'failed', 'failure', /GUARD 51/i)));
  evidence.events.push({ event: 'guard-human-failed', room: guardFailedA.room, guard: guardOf(guardFailedA) });
  await Promise.all([capture(pageA, 1, 'guard-human-failed'), capture(pageB, 2, 'guard-human-failed')]);
  await useVisibleControl(pageA, '#restart');
  for (const page of [pageA, pageB]) {
    const reset = await waitForPhase(page, RoomPhase.LOBBY, 'guard reset lobby');
    assert.deepEqual(reset.guards, lobby.guards);
    assert.equal(reset.room.failureGuardId, 0);
    assert.equal(reset.room.failureReason, FailureReason.UNSPECIFIED);
    assert.equal(reset.room.readyPlayers, 0);
    assert.equal(reset.echoes.length, 0);
  }
  evidence.events.push({ event: 'guard-reset', guards: (await snapshot(pageA)).guards });
  await useVisibleControl(pageA, '#ready');
  await useVisibleControl(pageB, '#ready');
  for (const page of [pageA, pageB]) {
    const active = await waitForPhase(page, RoomPhase.ACTIVE, 'second attempt after guard reset');
    assert.equal(active.room.objectiveSecured, false);
  }

  // A new MoQ publication for the same browser session must be consumed without
  // restarting the authority or disturbing the other player.
  const beforeReconnect = await snapshot(pageA);
  const beforePose = beforeReconnect.players.find((player) => player.playerId === 1);
  assert(beforePose, 'player 1 missing before reconnect');
  await pageA.evaluate(() => window.th.reconnect());
  await pageA.waitForFunction(() => window.th?.joined(), { timeout: 30000 });
  await moveRightPast(pageA, 1, beforePose.xMm + 500, beforePose.zMm);
  await waitFor(pageB,
    (state) => (state.players.find((player) => player.playerId === 1)?.xMm ?? 0) >= beforePose.xMm + 320,
    'client B observing player A after MoQ reconnect');
  evidence.events.push({ event: 'input-reconnected', playerId: 1 });

  // Zone 1: A records the tutorial plate; B crosses, then A's Echo frees A.
  await recordEchoPlate(pageA, 21, 11, 4500, 2500,
    () => moveRightPast(pageB, 2, 8000, 4000));
  await moveRightPast(pageA, 1, 8000, 4000);

  // Zone 2: repeat the delayed-presence lesson so both players reach the proof room.
  await recordEchoPlate(pageA, 22, 12, 12500, 2500,
    () => safeGuardEntry(pageB, 2));
  await safeGuardEntry(pageA, 1);
  const westStaging = await snapshot(pageA);
  const westPose = westStaging.players.find((player) => player.playerId === 1);
  assert(Math.hypot(westPose.xMm - 21000, westPose.zMm - 4000) > 750);
  await pageA.evaluate(() => window.th.action(61));
  for (const page of [pageA, pageB]) {
    const rejected = await waitFor(page, (state) => state.serverTick >= westStaging.serverTick + 60,
      'out-of-range vault action rejected');
    assert.equal(rejected.room.objectiveSecured, false);
  }
  evidence.events.push({ event: 'objective-out-of-range-rejected', targetId: 61, playerId: 1,
    tick: westStaging.serverTick, pose: westPose });
  await guardDiversion(pageA, pageB);
  for (const page of [pageA, pageB]) {
    const crossed = await snapshot(page);
    assert.equal(crossed.room.phase, RoomPhase.ACTIVE);
    assert.equal(crossed.room.objectiveSecured, false);
  }

  // Approach the vault from the safe north lane while the patrol looks west.
  await dash(pageA, 1, 21000, 1500);
  await waitFor(pageA, (state) => {
    const guard = guardOf(state);
    return guard.state === GuardState.PATROL && guard.facingX < 0 &&
      guard.xMm >= 18800 && guard.xMm <= 19200;
  }, 'west-facing guard before the live vault theft');
  await dash(pageA, 1, 21000, 4000);
  const atVault = await waitFor(pageA, (state) => {
    const pose = state.players.find((player) => player.playerId === 1);
    return state.room.phase === RoomPhase.ACTIVE &&
      Math.hypot(pose.xMm - 21000, pose.zMm - 4000) <= 750;
  }, 'authoritative live player within the vault interaction radius');
  assert.equal(atVault.room.objectiveSecured, false);
  await pageA.evaluate(() => window.th.action(61));
  const secured = await sharedObjectiveSnapshot(pageA, pageB);
  evidence.events.push({ event: 'objective-secured', targetId: 61, playerId: 1,
    roomEpoch: secured.roomEpoch, serverTick: secured.serverTick, clientAgreement: true,
    actionPose: atVault.players.find((player) => player.playerId === 1) });
  // Leave the patrol lane before waiting for software-rendered screenshots.
  await dash(pageA, 1, 21000, 1500);
  for (const page of [pageA, pageB])
    await waitForText(page, '#objective', /DATA SECURED|FINAL DOOR.*ECHO/i, 'post-theft objective');
  await Promise.all([capture(pageA, 1, 'objective-secured', true), capture(pageB, 2, 'objective-secured', true)]);

  // The crossing and vault approach replay too. Let those Echoes and their
  // guard investigations clear before occupying the final plate's north edge.
  const finalStaging = await dash(pageA, 1, 19500, 1000);
  const settled = await waitFor(pageA, (state) => {
    assert.equal(state.room.phase, RoomPhase.ACTIVE);
    return state.serverTick >= finalStaging.serverTick + 600 &&
      guardOf(state).state === GuardState.PATROL;
  }, 'vault approach replay complete and guard back on patrol');
  evidence.events.push({ event: 'vault-echoes-cleared', sourceTick: finalStaging.serverTick,
    tick: settled.serverTick, guard: guardOf(settled) });

  // Zone 3 acceptance: A leaves its plate; exactly 600 authority ticks later its
  // Echo opens the current door while both live players remain off the plate.
  const finalOpen = await recordEchoPlate(pageA, 23, 13, 19500, 2500, undefined, true);
  assert.equal(finalOpen.plates.find((plate) => plate.id === 23)?.livePresence, 0);
  assert(finalOpen.plates.find((plate) => plate.id === 23)?.echoPresence > 0);
  await dash(pageA, 1, 21500, 2200);
  for (const page of [pageA, pageB]) {
    assert.equal(
      await waitForText(page, '#echo-status', /^ECHO REPLAYING · 10 SECONDS BEHIND$/,
        'human-facing Echo replay status'),
      'ECHO REPLAYING · 10 SECONDS BEHIND',
    );
  }
  // Use one west-watching patrol window for both players. Waiting for a second
  // cycle can outlast the final door's remaining 600-tick Echo Presence.
  const extractionWindow = await waitFor(pageA, (state) => {
    const guard = guardOf(state);
    return guard.state === GuardState.PATROL && guard.facingX < 0 &&
      guard.xMm >= 18800 && guard.xMm <= 19200 && state.doors.find((door) => door.id === 13)?.active;
  }, 'one safe patrol window for both players to extract');
  evidence.events.push({ event: 'final-door-crossing-window', tick: extractionWindow.serverTick,
    guard: guardOf(extractionWindow), plate: extractionWindow.plates.find((plate) => plate.id === 23) });
  await Promise.all([[pageA, 1], [pageB, 2]].map(async ([page, playerId]) => {
    await dash(page, playerId, 21500, 4000);
    // Aim beyond guard range if one player arrives first. The authority freezes
    // movement immediately once both live players qualify for the win.
    await dash(page, playerId, 23500, 4000);
  }));
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
  const wonA = await waitForPhase(pageA, RoomPhase.WON, 'won result on client A');
  const wonB = await waitForPhase(pageB, RoomPhase.WON, 'won result on client B');
  assert.equal(wonA.room.attempt, 2);
  assert.deepEqual(wonA.guards, wonB.guards);
  assert.deepEqual(wonA.room, wonB.room);
  assert.equal(wonA.room.extractionPlayers, 2);
  assert.equal(wonB.room.extractionPlayers, 2);
  assert.equal(wonA.room.echoOpenedFinalDoor, true);
  assert.equal(wonB.room.echoOpenedFinalDoor, true);
  assert.equal(wonA.room.objectiveSecured, true);
  assert.equal(wonB.room.objectiveSecured, true);
  assert.equal(wonA.room.endedTick, wonB.room.endedTick);
  assert(wonA.room.endedTick >= wonA.room.startedTick);
  for (const page of [pageA, pageB]) {
    const ui = await waitForPresentation(page, 'won', 'success', /SUCCESS/i);
    assert.match(ui.objective ?? '', /HEIST COMPLETE/i);
  }
  evidence.events.push({
    event: 'attempt-won', attempt: wonA.room.attempt, endedTick: wonA.room.endedTick,
    extractionPlayers: wonA.room.extractionPlayers,
  });

  await Promise.all([capture(pageA, 1, 'attempt-2-won'), capture(pageB, 2, 'attempt-2-won')]);

  // One player may restart a terminal attempt. Restart clears transient attempt
  // state and readiness, so the next attempt cannot begin until both ready again.
  await useVisibleControl(pageA, '#restart');
  const resetA = await waitForPhase(pageA, RoomPhase.LOBBY, 'reset lobby on client A');
  const resetB = await waitForPhase(pageB, RoomPhase.LOBBY, 'reset lobby on client B');
  for (const reset of [resetA, resetB]) {
    assert.equal(reset.room.attempt, 3);
    assert.equal(reset.room.readyPlayers, 0);
    assert.equal(reset.room.extractionPlayers, 0);
    assert.equal(reset.room.echoOpenedFinalDoor, false);
    assert.equal(reset.room.objectiveSecured, false);
    assert(reset.sessions.every((session) => !session.ready));
    assert.equal(reset.echoes.length, 0);
    assert(reset.doors.every((door) => !door.active));
  }
  for (const page of [pageA, pageB]) {
    await waitForPresentation(page, 'lobby', 'none');
    const terminal = await page.evaluate(() => window.th.rendererPixel(1083, 360));
    assert(terminal.every((value, channel) => Math.abs(value - [136, 242, 255, 255][channel]) <= 1),
      `restarted vault goal cue must be cyan: ${terminal}`);
  }
  evidence.events.push({ event: 'attempt-reset', requestedBy: 1, tick: resetA.serverTick });

  await useVisibleControl(pageA, '#ready', 'Enter');
  const waitingForB = await waitFor(pageA, (state) =>
    state.room?.phase === RoomPhase.LOBBY && state.room.readyPlayers === 1,
  'second attempt waiting for player B');
  assert.equal(waitingForB.room.attempt, 3);
  await useVisibleControl(pageB, '#ready');
  const secondActiveA = await waitForPhase(pageA, RoomPhase.ACTIVE, 'second attempt on client A');
  const secondActiveB = await waitForPhase(pageB, RoomPhase.ACTIVE, 'second attempt on client B');
  assert.equal(secondActiveA.room.attempt, 3);
  assert.equal(secondActiveB.room.attempt, 3);
  assert.equal(secondActiveA.room.startedTick, secondActiveB.room.startedTick);
  assert(secondActiveA.room.startedTick > wonA.room.endedTick);
  evidence.events.push({
    event: 'attempt-started', attempt: secondActiveA.room.attempt,
    startedTick: secondActiveA.room.startedTick,
  });

  // Echoes are present during an active attempt without activating surveillance.
  // Hazard detection is evaluated from live authoritative players only.
  const secondEcho = await waitFor(pageA,
    (state) => state.room?.phase === RoomPhase.ACTIVE && state.echoes.length > 0,
    'second-attempt Echo without surveillance detection', 25_000);
  const quietCamera = secondEcho.hazards.find((hazard) => hazard.id === 41);
  assert(quietCamera, 'camera 41 missing from authoritative snapshot');
  assert.equal(quietCamera.active, false);
  assert.equal(quietCamera.detectedPlayerId, 0);
  const idleConePixel = await pageA.evaluate(() => window.th.rendererPixel(246, 458));
  assert(idleConePixel[1] > idleConePixel[0], `idle cone is not teal: ${idleConePixel}`);
  evidence.events.push({
    event: 'echo-present-camera-inactive', hazardId: 41,
    tick: secondEcho.serverTick, echoCount: secondEcho.echoes.length,
  });

  // Approach from the cone's east side. Both waypoints remain outside the
  // triangle; authoritative feedback then steers through the visible edge.
  await moveTo(pageA, 1, 6750, 2500);
  await moveTo(pageA, 1, 6750, 6000);
  const failedA = await enterSurveillance(pageA, 1, 4500, 6000);
  const failedB = await waitForPhase(pageB, RoomPhase.FAILED,
    'surveillance failure on client B');
  for (const failed of [failedA, failedB]) {
    assert.equal(failed.room.attempt, 3);
    assert.equal(failed.room.failureReason, FailureReason.SURVEILLANCE);
    assert.equal(failed.room.failureHazardId, 41);
    const camera = failed.hazards.find((hazard) => hazard.id === 41);
    assert.equal(camera?.active, true);
    assert.equal(camera?.detectedPlayerId, 1);
  }
  assert.equal(failedA.room.endedTick, failedB.room.endedTick);
  const detectedConePixel = await pageA.evaluate(() => window.th.rendererPixel(246, 458));
  assert(
    detectedConePixel[0] > detectedConePixel[1],
    `detected cone is not red: ${detectedConePixel}`,
  );
  const detectedPose = failedA.players.find((player) => player.playerId === 1);
  assert(detectedPose, 'detected player missing from failed snapshot');
  assert(cameraContains(camera41, detectedPose),
    `surveillance detected player outside camera cone: ${JSON.stringify(detectedPose)}`);
  for (const page of [pageA, pageB]) {
    const ui = await waitForPresentation(page, 'failed', 'failure', /SURVEILLANCE.*CAMERA 41/i);
    assert.match(ui.objective ?? '', /ATTEMPT FAILED/i);
  }

  // Terminal attempts keep publishing canonical ticks, but authoritative poses
  // remain frozen on both clients.
  const frozenA = await waitFor(pageA,
    (state) => state.serverTick >= failedA.serverTick + 12,
    'post-failure frozen snapshot on client A');
  const frozenB = await waitFor(pageB,
    (state) => state.serverTick >= failedB.serverTick + 12,
    'post-failure frozen snapshot on client B');
  assert.deepEqual(positions(frozenA), positions(failedA));
  assert.deepEqual(positions(frozenB), positions(failedB));
  assert.deepEqual(positions(frozenA), positions(frozenB));
  evidence.events.push({
    event: 'surveillance-failed', attempt: failedA.room.attempt,
    hazardId: 41, detectedPlayerId: 1, endedTick: failedA.room.endedTick,
    detectedPose,
  });

  await Promise.all([
    capture(pageA, 1, 'attempt-3-surveillance-failed'),
    capture(pageB, 2, 'attempt-3-surveillance-failed'),
  ]);

  await useVisibleControl(pageB, '#restart', 'r');
  const cleanLobbyA = await waitForPhase(pageA, RoomPhase.LOBBY,
    'clean lobby after surveillance failure on client A');
  const cleanLobbyB = await waitForPhase(pageB, RoomPhase.LOBBY,
    'clean lobby after surveillance failure on client B');
  for (const clean of [cleanLobbyA, cleanLobbyB]) {
    assert.equal(clean.room.attempt, 4);
    assert.equal(clean.room.readyPlayers, 0);
    assert.equal(clean.room.failureReason, FailureReason.UNSPECIFIED);
    assert.equal(clean.room.failureHazardId, 0);
    assert.equal(clean.room.objectiveSecured, false);
    assert(clean.sessions.every((session) => !session.ready));
    assert.equal(clean.echoes.length, 0);
    assert(clean.hazards.every((hazard) => !hazard.active));
    assert(clean.hazards.every((hazard) => hazard.detectedPlayerId === 0));
  }
  evidence.events.push({
    event: 'surveillance-reset', requestedBy: 2, tick: cleanLobbyA.serverTick,
  });

  evidence.finalTick = cleanLobbyA.serverTick;
  evidence.wonSnapshot = wonA;
  evidence.failedSnapshot = failedA;
  evidence.finalSnapshot = cleanLobbyA;
  evidence.renderers = await Promise.all([pageA, pageB].map((page) => page.evaluate(() => window.th.rendererInfo())));
  evidence.errors = await Promise.all([pageA, pageB].map((page) => page.evaluate(() => window.th.errors())));
  evidence.browserErrors = browserErrors;
  evidence.finalUi = await Promise.all([pageA, pageB].map(uiState));
  assert(evidence.renderers.every((renderer) => renderer?.backend === 'webgpu'));
  assert(evidence.renderers.every((renderer) => renderer?.adapter?.vendor));
  assert(wonA.echoes.some((echo) => echo.playerId === 1));
  assert(wonB.echoes.some((echo) => echo.playerId === 1));
  assert(evidence.errors.every((errors) => errors.length === 0));
  assert(browserErrors.every((errors) => errors.length === 0));
  await Promise.all([capture(pageA, 1, 'attempt-4-clean-lobby', false), capture(pageB, 2, 'attempt-4-clean-lobby', false)]);
  await writeFile(`${artifacts}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ event: 'p3-game-loop-passed', ...evidence }));
} catch (error) {
  evidence.failure = String(error);
  evidence.lastSnapshots = await Promise.all(contexts.map((context) => snapshot(context.pages().at(-1))));
  await writeFile(`${artifacts}/failure.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.error(JSON.stringify({ event: 'p3-acceptance-failed', ...evidence }));
  throw error;
} finally {
  await Promise.all(contexts.map((context) => context.close()));
}
