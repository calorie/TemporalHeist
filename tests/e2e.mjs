import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const artifacts = `/artifacts/e2e-${process.env.TH_AGENT_ID}`;
await mkdir(artifacts, { recursive: true });
const viewport = { width: 1280, height: 720 };
const stateTimeout = 30_000;
const moveTimeout = Number(process.env.TH_E2E_MOVE_TIMEOUT_MS ?? 45_000);
const startDelay = Number(process.env.TH_E2E_START_DELAY_MS ?? 0);
assert(Number.isSafeInteger(moveTimeout) && moveTimeout >= 45_000);
assert(Number.isSafeInteger(startDelay) && startDelay >= 0);
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
const evidence = {
  agent: process.env.TH_AGENT_ID,
  viewport: { ...viewport, deviceScaleFactor: 1 },
  events: [],
  screenshots: [],
};
const RoomPhase = Object.freeze({ LOBBY: 1, ACTIVE: 2, WON: 3, FAILED: 4 });
const FailureReason = Object.freeze({ UNSPECIFIED: 0, TIMEOUT: 1, SURVEILLANCE: 2 });
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

async function capture(page, player, label) {
  const file = `player-${player}-${label}.png`;
  await page.screenshot({ path: `${artifacts}/${file}` });
  evidence.screenshots.push({ file, player, label, ui: await uiState(page) });
}

async function moveTo(page, playerId, x, z, timeout = moveTimeout) {
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
    if (pose && Math.abs(pose.xMm - x) <= 180 && Math.abs(pose.zMm - z) <= 180) {
      await page.evaluate(() => window.th.move(0, 0));
      return state;
    }
    if (!pose) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }
    const dx = Math.abs(pose.xMm - x) <= 120 ? 0 : Math.sign(x - pose.xMm);
    const dz = Math.abs(pose.zMm - z) <= 120 ? 0 : Math.sign(z - pose.zMm);
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
      const dx = Math.abs(pose.xMm - x) <= 120 ? 0 : Math.sign(x - pose.xMm);
      const dz = Math.abs(pose.zMm - z) <= 120 ? 0 : Math.sign(z - pose.zMm);
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
      const dx = pose.xMm >= x ? 0 : 1;
      const dz = Math.abs(pose.zMm - z) <= 120 ? 0 : Math.sign(z - pose.zMm);
      await page.evaluate(([mx, mz]) => window.th.move(mx, mz), [dx, dz]);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`player ${playerId} did not pass x=${x}; ${JSON.stringify({
    tick: lastState?.serverTick,
    pose: lastState?.players.find((candidate) => candidate.playerId === playerId),
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

async function recordEchoPlate(pageA, plateId, doorId, x, z, whileLive) {
  const outside = await moveTo(pageA, 1, x - 2000, z);
  assert.equal(outside.plates.find((plate) => plate.id === plateId)?.active, false);
  const entered = await occupyPlate(pageA, 1, plateId, x, z);
  evidence.events.push({ event: 'live-plate', plateId, tick: entered.serverTick });
  // Record twenty seconds so a cold CI runner still observes a useful replay window.
  await waitFor(pageA, (state) => state.serverTick >= entered.serverTick + 1_200,
    `recording window on plate ${plateId}`, 25_000);
  if (whileLive) await whileLive();
  await moveTo(pageA, 1, x - 2000, z);
  const left = await waitFor(pageA,
    (state) => state.plates.find((plate) => plate.id === plateId)?.livePresence === 0,
    `live player release of plate ${plateId}`);
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

try {
  for (const player of [1, 2]) {
    const context = await chromium.launchPersistentContext(`${artifacts}/client-${player}`, {
      channel: 'chromium', headless: true, viewport, deviceScaleFactor: 1, args: flags,
    });
    contexts.push(context);
    const page = context.pages()[0] ?? await context.newPage();
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
    capture(pageA, 1, 'lobby-onboarding'),
    capture(pageB, 2, 'lobby-onboarding'),
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
    assert.match(ui.objective ?? '', /ECHO PRESENCE/i);
    assert.match(ui.timer ?? '', /^0[0-5]:[0-5][0-9]$/);
    assert.match(ui.readiness ?? '', /2\/2/);
    await waitForText(page, '#echo-status', /^ECHO IN 00:[0-9]{2}$/,
      'first-Echo authority countdown');
  }
  evidence.events.push({
    event: 'attempt-started', attempt: activeA.room.attempt,
    startedTick: activeA.room.startedTick, deadlineTick: activeA.room.deadlineTick,
  });

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
    () => moveRightPast(pageB, 2, 16000, 4000));
  await moveRightPast(pageA, 1, 16000, 4000);

  // Zone 3 acceptance: A leaves its plate; exactly 600 authority ticks later its
  // Echo opens the current door, and B crosses while A remains elsewhere.
  await moveTo(pageB, 2, 21500, 4000);
  const finalOpen = await recordEchoPlate(pageA, 23, 13, 19500, 2500);
  await moveRightPast(pageB, 2, 23000, 4000);
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
  for (const page of [pageA, pageB]) {
    assert.equal(
      await waitForText(page, '#echo-status', /^ECHO REPLAYING · 10 SECONDS BEHIND$/,
        'human-facing Echo replay status'),
      'ECHO REPLAYING · 10 SECONDS BEHIND',
    );
  }

  // Both live players must enter extraction after Echo Presence has opened the
  // final door. The authority, rather than either renderer, decides the result.
  // Aim well inside extraction so the movement tolerance cannot accept a pose
  // before x=22800. The terminal-state branch handles authority's immediate
  // movement freeze once both players qualify.
  await moveRightPast(pageA, 1, 23000, 4000);
  const wonA = await waitForPhase(pageA, RoomPhase.WON, 'won result on client A');
  const wonB = await waitForPhase(pageB, RoomPhase.WON, 'won result on client B');
  assert.equal(wonA.room.attempt, 1);
  assert.equal(wonA.room.extractionPlayers, 2);
  assert.equal(wonB.room.extractionPlayers, 2);
  assert.equal(wonA.room.echoOpenedFinalDoor, true);
  assert.equal(wonB.room.echoOpenedFinalDoor, true);
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

  await Promise.all([capture(pageA, 1, 'attempt-1-won'), capture(pageB, 2, 'attempt-1-won')]);

  // One player may restart a terminal attempt. Restart clears transient attempt
  // state and readiness, so the next attempt cannot begin until both ready again.
  await useVisibleControl(pageA, '#restart');
  const resetA = await waitForPhase(pageA, RoomPhase.LOBBY, 'reset lobby on client A');
  const resetB = await waitForPhase(pageB, RoomPhase.LOBBY, 'reset lobby on client B');
  for (const reset of [resetA, resetB]) {
    assert.equal(reset.room.attempt, 2);
    assert.equal(reset.room.readyPlayers, 0);
    assert.equal(reset.room.extractionPlayers, 0);
    assert.equal(reset.room.echoOpenedFinalDoor, false);
    assert(reset.sessions.every((session) => !session.ready));
    assert.equal(reset.echoes.length, 0);
    assert(reset.doors.every((door) => !door.active));
  }
  evidence.events.push({ event: 'attempt-reset', requestedBy: 1, tick: resetA.serverTick });

  await useVisibleControl(pageA, '#ready', 'Enter');
  const waitingForB = await waitFor(pageA, (state) =>
    state.room?.phase === RoomPhase.LOBBY && state.room.readyPlayers === 1,
  'second attempt waiting for player B');
  assert.equal(waitingForB.room.attempt, 2);
  await useVisibleControl(pageB, '#ready');
  const secondActiveA = await waitForPhase(pageA, RoomPhase.ACTIVE, 'second attempt on client A');
  const secondActiveB = await waitForPhase(pageB, RoomPhase.ACTIVE, 'second attempt on client B');
  assert.equal(secondActiveA.room.attempt, 2);
  assert.equal(secondActiveB.room.attempt, 2);
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
  const idleConePixel = await pageA.evaluate(() => window.th.rendererPixel(246, 605));
  assert(idleConePixel[1] > idleConePixel[0], `idle cone is not teal: ${idleConePixel}`);
  evidence.events.push({
    event: 'echo-present-camera-inactive', hazardId: 41,
    tick: secondEcho.serverTick, echoCount: secondEcho.echoes.length,
  });

  // Approach from the cone's east side. Both waypoints remain outside the
  // triangle even when transport-delayed input overshoots, then one westward
  // command crosses the visible edge deterministically.
  await moveTo(pageA, 1, 6750, 2500);
  await moveTo(pageA, 1, 6750, 6000);
  await pageA.evaluate(() => window.th.move(-1, 0));
  const failedA = await waitForPhase(pageA, RoomPhase.FAILED,
    'surveillance failure on client A');
  const failedB = await waitForPhase(pageB, RoomPhase.FAILED,
    'surveillance failure on client B');
  for (const failed of [failedA, failedB]) {
    assert.equal(failed.room.attempt, 2);
    assert.equal(failed.room.failureReason, FailureReason.SURVEILLANCE);
    assert.equal(failed.room.failureHazardId, 41);
    const camera = failed.hazards.find((hazard) => hazard.id === 41);
    assert.equal(camera?.active, true);
    assert.equal(camera?.detectedPlayerId, 1);
  }
  assert.equal(failedA.room.endedTick, failedB.room.endedTick);
  const detectedConePixel = await pageA.evaluate(() => window.th.rendererPixel(246, 605));
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
  const positions = (state) => state.players.map(({playerId, xMm, zMm}) => ({playerId, xMm, zMm}));
  assert.deepEqual(positions(frozenA), positions(failedA));
  assert.deepEqual(positions(frozenB), positions(failedB));
  assert.deepEqual(positions(frozenA), positions(frozenB));
  evidence.events.push({
    event: 'surveillance-failed', attempt: failedA.room.attempt,
    hazardId: 41, detectedPlayerId: 1, endedTick: failedA.room.endedTick,
    detectedPose,
  });

  await Promise.all([
    capture(pageA, 1, 'attempt-2-surveillance-failed'),
    capture(pageB, 2, 'attempt-2-surveillance-failed'),
  ]);

  await useVisibleControl(pageB, '#restart', 'r');
  const cleanLobbyA = await waitForPhase(pageA, RoomPhase.LOBBY,
    'clean lobby after surveillance failure on client A');
  const cleanLobbyB = await waitForPhase(pageB, RoomPhase.LOBBY,
    'clean lobby after surveillance failure on client B');
  for (const clean of [cleanLobbyA, cleanLobbyB]) {
    assert.equal(clean.room.attempt, 3);
    assert.equal(clean.room.readyPlayers, 0);
    assert.equal(clean.room.failureReason, FailureReason.UNSPECIFIED);
    assert.equal(clean.room.failureHazardId, 0);
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
  evidence.finalUi = await Promise.all([pageA, pageB].map(uiState));
  assert(evidence.renderers.every((renderer) => renderer?.backend === 'webgpu'));
  assert(evidence.renderers.every((renderer) => renderer?.adapter?.vendor));
  assert(wonA.echoes.some((echo) => echo.playerId === 1));
  assert(wonB.echoes.some((echo) => echo.playerId === 1));
  assert(evidence.errors.every((errors) => errors.length === 0));
  await Promise.all([capture(pageA, 1, 'attempt-3-clean-lobby'), capture(pageB, 2, 'attempt-3-clean-lobby')]);
  await writeFile(`${artifacts}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ event: 'p1-game-loop-passed', ...evidence }));
} finally {
  await Promise.all(contexts.map((context) => context.close()));
}
