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
const RoomPhase = Object.freeze({ LOBBY: 1, ACTIVE: 2, WON: 3, FAILED: 4 });
const FailureReason = Object.freeze({ UNSPECIFIED: 0, TIMEOUT: 1, SURVEILLANCE: 2 });

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
    if (!pose) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }
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

async function waitForPhase(page, phase, description, timeout = 20000) {
  return waitFor(page, (state) => state.room?.phase === phase, description, timeout);
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
  // Record six seconds of plate occupancy, leaving enough delayed Echo window
  // for two live players to traverse an authority-controlled door in sequence.
  await waitFor(pageA, (state) => state.serverTick >= entered.serverTick + 360,
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
  assert(echo.sourceTick >= entered.serverTick,
    `Echo source ${echo.sourceTick} predates observed live occupancy ${entered.serverTick}`);
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
      channel: 'chromium', headless: true, args: flags,
    });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(`http://web:5173/?player=${player}&room=${process.env.TH_ROOM_ID}`);
    await page.waitForFunction(() => window.th?.joined(), { timeout: 30000 });
  }
  const [pageA, pageB] = contexts.map((context) => context.pages().at(-1));

  const lobby = await waitFor(pageA, (state) =>
    state.room?.phase === RoomPhase.LOBBY &&
    state.sessions.filter((session) => session.connected).length === 2,
  'two connected players in the lobby');
  assert.equal(lobby.room.readyPlayers, 0);
  assert(lobby.sessions.every((session) => !session.ready));

  await pageA.evaluate(() => window.th.ready());
  const playerAReady = await waitFor(pageB, (state) =>
    state.room?.phase === RoomPhase.LOBBY &&
    state.room.readyPlayers === 1 &&
    state.sessions.find((session) => session.playerId === 1)?.ready,
  'client B observing player A ready');
  assert.equal(playerAReady.sessions.find((session) => session.playerId === 2)?.ready, false);

  await pageB.evaluate(() => window.th.ready());
  const activeA = await waitForPhase(pageA, RoomPhase.ACTIVE, 'first attempt on client A');
  const activeB = await waitForPhase(pageB, RoomPhase.ACTIVE, 'first attempt on client B');
  assert.equal(activeA.room.attempt, 1);
  assert.equal(activeB.room.attempt, 1);
  assert.equal(activeA.room.startedTick, activeB.room.startedTick);
  assert.equal(activeA.room.deadlineTick - activeA.room.startedTick, 18_000);
  assert.equal(activeA.room.readyPlayers, 2);
  assert(activeA.sessions.every((session) => session.ready));
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
  await moveTo(pageA, 1, beforePose.xMm + 500, beforePose.zMm);
  await waitFor(pageB,
    (state) => (state.players.find((player) => player.playerId === 1)?.xMm ?? 0) >= beforePose.xMm + 320,
    'client B observing player A after MoQ reconnect');
  evidence.events.push({ event: 'input-reconnected', playerId: 1 });

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

  // Both live players must enter extraction after Echo Presence has opened the
  // final door. The authority, rather than either renderer, decides the result.
  // Winning freezes authoritative movement as soon as A crosses x=22800, so
  // target the extraction threshold instead of a point beyond the frozen pose.
  await moveTo(pageA, 1, 22850, 4000);
  const wonA = await waitForPhase(pageA, RoomPhase.WON, 'won result on client A');
  const wonB = await waitForPhase(pageB, RoomPhase.WON, 'won result on client B');
  assert.equal(wonA.room.attempt, 1);
  assert.equal(wonA.room.extractionPlayers, 2);
  assert.equal(wonB.room.extractionPlayers, 2);
  assert.equal(wonA.room.echoOpenedFinalDoor, true);
  assert.equal(wonB.room.echoOpenedFinalDoor, true);
  assert.equal(wonA.room.endedTick, wonB.room.endedTick);
  assert(wonA.room.endedTick >= wonA.room.startedTick);
  evidence.events.push({
    event: 'attempt-won', attempt: wonA.room.attempt, endedTick: wonA.room.endedTick,
    extractionPlayers: wonA.room.extractionPlayers,
  });

  await Promise.all([pageA, pageB].map((page, index) =>
    page.screenshot({ path: `${artifacts}/client-${index + 1}-won.png` })));

  // One player may restart a terminal attempt. Restart clears transient attempt
  // state and readiness, so the next attempt cannot begin until both ready again.
  await pageA.evaluate(() => window.th.restart());
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

  await pageA.evaluate(() => window.th.ready());
  const waitingForB = await waitFor(pageA, (state) =>
    state.room?.phase === RoomPhase.LOBBY && state.room.readyPlayers === 1,
  'second attempt waiting for player B');
  assert.equal(waitingForB.room.attempt, 2);
  await pageB.evaluate(() => window.th.ready());
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
    'second-attempt Echo without surveillance detection', 15000);
  const quietCamera = secondEcho.hazards.find((hazard) => hazard.id === 41);
  assert(quietCamera, 'camera 41 missing from authoritative snapshot');
  assert.equal(quietCamera.active, false);
  assert.equal(quietCamera.detectedPlayerId, 0);
  evidence.events.push({
    event: 'echo-ignored-by-surveillance', hazardId: 41,
    tick: secondEcho.serverTick, echoCount: secondEcho.echoes.length,
  });

  // Approach the camera from immediately outside its south-facing cone, then
  // let the authority detect player 1 while moving toward (4500, 6000).
  await moveTo(pageA, 1, 4500, 5000);
  await pageA.evaluate(() => window.th.move(0, 1));
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
  const detectedPose = failedA.players.find((player) => player.playerId === 1);
  assert(detectedPose, 'detected player missing from failed snapshot');
  assert(Math.abs(detectedPose.xMm - 4500) <= 180);
  assert(detectedPose.zMm > 5000 && detectedPose.zMm <= 6200,
    `surveillance detected player outside expected approach: z=${detectedPose.zMm}`);

  // Terminal attempts keep publishing canonical ticks, but authoritative poses
  // remain frozen on both clients.
  const frozenA = await waitFor(pageA,
    (state) => state.serverTick >= failedA.serverTick + 12,
    'post-failure frozen snapshot on client A');
  const frozenB = await waitFor(pageB,
    (state) => state.serverTick >= failedB.serverTick + 12,
    'post-failure frozen snapshot on client B');
  assert.deepEqual(frozenA.players, failedA.players);
  assert.deepEqual(frozenB.players, failedB.players);
  assert.deepEqual(frozenA.players, frozenB.players);
  evidence.events.push({
    event: 'surveillance-failed', attempt: failedA.room.attempt,
    hazardId: 41, detectedPlayerId: 1, endedTick: failedA.room.endedTick,
    detectedPose,
  });

  await pageB.evaluate(() => window.th.restart());
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
  assert(evidence.renderers.every((renderer) => renderer?.backend === 'webgpu'));
  assert(evidence.renderers.every((renderer) => renderer?.adapter?.vendor));
  assert(wonA.echoes.some((echo) => echo.playerId === 1));
  assert(wonB.echoes.some((echo) => echo.playerId === 1));
  assert(evidence.errors.every((errors) => errors.length === 0));
  await Promise.all([pageA, pageB].map((page, index) => page.screenshot({ path: `${artifacts}/client-${index + 1}.png` })));
  await writeFile(`${artifacts}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ event: 'p1-game-loop-passed', ...evidence }));
} finally {
  await Promise.all(contexts.map((context) => context.close()));
}
