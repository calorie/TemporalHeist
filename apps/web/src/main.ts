import './style.css';
import { AudioCues } from './audio.ts';
import { type Input, InputKind, type Snapshot } from './generated/temporal_heist.ts';
import { isInteractiveTarget, keyboardDecision } from './input-contract.ts';
import { interactionDecision } from './interaction-decision.ts';
import { map } from './map.ts';
import { MoqTransport } from './net/moq/transport.ts';
import { WebGpuRenderer } from './render/webgpu.ts';
import { renderIfChanged } from './render-cache.ts';
import { roomHud } from './room-hud.ts';
import { Timeline } from './timeline.ts';

const params = new URLSearchParams(location.search);
const playerId = Math.min(2, Math.max(1, Number(params.get('player') ?? 1)));
const room = params.get('room') ?? 'dev';
const relay = new URL(params.get('relay') ?? 'http://relay:4443/anon');
const sessionId = params.get('session') ?? crypto.randomUUID();
const timeline = new Timeline();
const audio = new AudioCues();
const errors: string[] = [];
let renderer: WebGpuRenderer | undefined;
let transport: MoqTransport | undefined;
let state = 'starting';
let joined = false;
let joiningEpoch = '';
let joinAttemptTick = -60;
let desired = { x: 0, z: 0 };
let joinSequence = 0;
let motionSequence = 0;
let presentationPaused = false;
let presentationFrame: number | undefined;
let actionSequence = 0;
let reconnecting = false;
let transportGeneration = 0;
let reconnectTimer: number | undefined;
function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}
const status = element<HTMLElement>('#status');
const hudElement = element<HTMLElement>('#hud');
const details = element<HTMLElement>('#details');
const unsupported = element<HTMLElement>('#unsupported');
const phase = element<HTMLElement>('#phase');
const objective = element<HTMLElement>('#objective');
const timer = element<HTMLElement>('#timer');
const echoStatus = element<HTMLElement>('#echo-status');
const guardStatus = element<HTMLElement>('#guard-status');
const readiness = element<HTMLElement>('#readiness');
const result = element<HTMLElement>('#result');
const identity = element<HTMLElement>('#identity');
const missionSteps = element<HTMLOListElement>('#mission-steps');
const interaction = element<HTMLElement>('#interaction');
const readyButton = element<HTMLButtonElement>('#ready');
const restartButton = element<HTMLButtonElement>('#restart');
const muteButton = element<HTMLButtonElement>('#mute');
const hudCache = new Map<string, string>();

function input(kind: InputKind, sequence: number, x = 0, z = 0, targetId = 0): Input {
  return {
    protocolMajor: 1,
    roomEpoch: timeline.epoch,
    playerId,
    sessionId,
    sequence,
    moveX: Math.round(x * 1000),
    moveZ: Math.round(z * 1000),
    kind,
    targetId,
  };
}
function setState(next: string) {
  state = next;
  status.textContent = `P${playerId} · ${next}`;
}
function onSnapshot(snapshot: Snapshot) {
  if (snapshot.protocolMajor !== 1) {
    recordError(`Unsupported protocol ${snapshot.protocolMajor}`);
    return;
  }
  const changedEpoch = timeline.epoch !== '' && timeline.epoch !== snapshot.roomEpoch;
  timeline.add(snapshot);
  if (changedEpoch) {
    joined = false;
    joiningEpoch = '';
    joinAttemptTick = -60;
  }
  joined = snapshot.sessions.some(
    (session) =>
      session.playerId === playerId && session.sessionId === sessionId && session.connected,
  );
  if (
    !joined &&
    (joiningEpoch !== snapshot.roomEpoch || snapshot.serverTick >= joinAttemptTick + 60)
  ) {
    joiningEpoch = snapshot.roomEpoch;
    joinAttemptTick = snapshot.serverTick;
    transport?.sendAction(input(InputKind.JOIN, ++joinSequence));
    setState('joining');
  }
  if (joined) setState('joined');
}
function recordError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  errors.push(message);
  setState(`error: ${message}`);
}
function scheduleReconnect(delay = 750) {
  if (reconnectTimer !== undefined) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined;
    if (reconnecting) {
      scheduleReconnect(250);
      return;
    }
    void reconnect();
  }, delay);
}
function handlers(generation: number) {
  return {
    snapshot: (snapshot: Snapshot) => {
      if (generation === transportGeneration) onSnapshot(snapshot);
    },
    history: (chunk: { roomEpoch: string; samples: Snapshot[] }) => {
      if (
        generation === transportGeneration &&
        (chunk.roomEpoch === timeline.epoch || !timeline.epoch)
      )
        timeline.addMany(chunk.samples);
    },
    state: (next: string) => {
      if (generation === transportGeneration) setState(next);
    },
    error: (error: unknown) => {
      if (generation !== transportGeneration) return;
      recordError(error);
      scheduleReconnect();
    },
  };
}
async function reconnect() {
  if (reconnecting) return;
  if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  reconnecting = true;
  const generation = ++transportGeneration;
  joined = false;
  joiningEpoch = '';
  joinAttemptTick = -60;
  transport?.close();
  setState('reconnecting');
  const next = new MoqTransport(handlers(generation));
  transport = next;
  try {
    await next.connect(relay, room, playerId);
  } catch (error) {
    if (generation === transportGeneration) {
      recordError(error);
      scheduleReconnect(1000);
    }
  } finally {
    if (generation === transportGeneration) reconnecting = false;
  }
}
function move(x: number, z: number) {
  const length = Math.hypot(x, z);
  desired = length > 1 ? { x: x / length, z: z / length } : { x, z };
  sendMotion();
}
function sendMotion() {
  if (joined)
    transport?.sendMotion(input(InputKind.MOTION, ++motionSequence, desired.x, desired.z));
}
function action(targetId?: number) {
  if (!joined) return;
  const target = targetId ?? interactionDecision(timeline.latest, playerId, map)?.targetId ?? 0;
  transport?.sendAction(input(InputKind.ACTION, ++actionSequence, 0, 0, target));
}
function roomCommand(kind: InputKind) {
  if (!joined) return;
  transport?.sendAction(input(kind, ++actionSequence));
}
function ready() {
  roomCommand(InputKind.READY);
}
function restart() {
  roomCommand(InputKind.RESTART);
}
const keys = new Set<string>();
addEventListener('keydown', (event) => {
  void audio.unlock().catch(() => {});
  const decision = keyboardDecision(
    event.key,
    timeline.latest?.room?.phase,
    isInteractiveTarget(event.target),
    event.repeat,
  );
  if (decision.consume) event.preventDefault();
  if (decision.command === 'movement') keys.add(event.key.toLowerCase());
  if (decision.command === 'action') action();
  if (decision.command === 'ready') ready();
  if (decision.command === 'restart') restart();
  updateKeys();
});
addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
  const decision = keyboardDecision(event.key, timeline.latest?.room?.phase, false, false);
  if (decision.command === 'movement') event.preventDefault();
  updateKeys();
});
addEventListener('pointerdown', () => void audio.unlock().catch(() => {}), { once: true });
function releaseKeys() {
  keys.clear();
  move(0, 0);
}
addEventListener('blur', releaseKeys);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseKeys();
});
function updateKeys() {
  move(
    (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0),
    (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0),
  );
}
readyButton.addEventListener('click', ready);
restartButton.addEventListener('click', restart);
muteButton.addEventListener('click', () => {
  const muted = audio.toggle();
  muteButton.ariaPressed = String(muted);
  muteButton.ariaLabel = muted ? 'Unmute sound' : 'Mute sound';
  muteButton.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
});

export interface TemporalHeistTestApi {
  status(): string;
  joined(): boolean;
  snapshot(): Snapshot | undefined;
  move(x: number, z: number): void;
  action(targetId?: number): void;
  ready(): void;
  restart(): void;
  timeline(): ReturnType<Timeline['inspect']>;
  rendererInfo(): ReturnType<WebGpuRenderer['info']> | undefined;
  rendererPixel(x: number, y: number): Promise<number[]>;
  errors(): string[];
  reconnect(): Promise<void>;
  setPresentationPaused(paused: boolean): void;
}
declare global {
  interface Window {
    th: TemporalHeistTestApi;
  }
}
window.th = {
  status: () => state,
  joined: () => joined,
  snapshot: () => timeline.latest,
  move,
  action,
  ready,
  restart,
  timeline: () => timeline.inspect(),
  rendererInfo: () => renderer?.info(),
  rendererPixel: (x, y) =>
    renderer ? renderer.samplePixel(x, y) : Promise.reject(new Error('Renderer unavailable')),
  errors: () => [...errors, ...(renderer?.errors() ?? [])],
  reconnect,
  setPresentationPaused: (paused) => {
    presentationPaused = paused;
    if (paused && presentationFrame !== undefined) {
      cancelAnimationFrame(presentationFrame);
      presentationFrame = undefined;
    } else if (!paused && renderer && presentationFrame === undefined) {
      presentationFrame = requestAnimationFrame(frame);
    }
  },
};

const scheduleFrame = () => {
  if (!presentationPaused && presentationFrame === undefined) {
    presentationFrame = requestAnimationFrame(frame);
  }
};

const frame = () => {
  presentationFrame = undefined;
  if (presentationPaused) return;
  const presentation = timeline.presentation();
  renderer?.render(map, presentation, playerId);
  const snap = presentation.snapshot;
  const hud = roomHud(snap, playerId);
  audio.update(snap);
  renderIfChanged(hudCache, 'phase-state', hud.phaseState, () => {
    hudElement.dataset.phase = hud.phaseState;
  });
  for (const [key, target, value] of [
    ['phase', phase, hud.phase],
    ['objective', objective, hud.objective],
    ['timer', timer, hud.timer],
    ['echo', echoStatus, hud.echoStatus],
    ['readiness', readiness, hud.readiness],
  ] as const)
    renderIfChanged(hudCache, key, value, () => {
      target.textContent = value;
    });
  renderIfChanged(hudCache, 'guard', hud.guardStatus, () => {
    guardStatus.textContent = hud.guardStatus;
    guardStatus.hidden = !hud.guardStatus;
  });
  renderIfChanged(hudCache, 'result', `${hud.resultState}\0${hud.result}`, () => {
    result.textContent = hud.result;
    result.dataset.state = hud.resultState;
  });
  renderIfChanged(hudCache, 'ready-button', String(hud.canReady), () => {
    readyButton.hidden = !hud.canReady;
  });
  renderIfChanged(hudCache, 'restart-button', String(hud.canRestart), () => {
    restartButton.hidden = !hud.canRestart;
  });
  const identityText = `${hud.identity.self} · ${hud.identity.partner}${hud.identity.echoes.length ? ` · ${hud.identity.echoes.join(' · ')}` : ''}`;
  renderIfChanged(hudCache, 'identity', identityText, () => {
    identity.textContent = identityText;
  });
  const stepsKey = JSON.stringify(hud.steps);
  renderIfChanged(hudCache, 'mission-steps', stepsKey, () => {
    missionSteps.replaceChildren(
      ...hud.steps.map((step) => {
        const item = document.createElement('li');
        item.dataset.state = step.state;
        item.textContent = step.label;
        return item;
      }),
    );
  });
  renderIfChanged(hudCache, 'interaction', hud.interaction, () => {
    interaction.textContent = hud.interaction;
    interaction.hidden = !hud.interaction;
  });
  details.textContent = snap
    ? `tick ${snap.serverTick} · epoch ${snap.roomEpoch.slice(0, 8)} · ${timeline.length} samples · ${presentation.echoes.length} echoes`
    : `room ${room} · waiting for authority`;
  scheduleFrame();
};

async function start() {
  try {
    renderer = await WebGpuRenderer.create(element<HTMLCanvasElement>('#game'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    unsupported.hidden = false;
    unsupported.textContent = message;
    recordError(message);
    return;
  }
  setInterval(sendMotion, 33);
  scheduleFrame();
  await reconnect();
}
void start();
