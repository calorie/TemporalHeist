import './style.css';
import { type Input, InputKind, type Snapshot } from './generated/temporal_heist.ts';
import { map } from './map.ts';
import { MoqTransport } from './net/moq/transport.ts';
import { WebGpuRenderer } from './render/webgpu.ts';
import { Timeline } from './timeline.ts';

const params = new URLSearchParams(location.search);
const playerId = Math.min(2, Math.max(1, Number(params.get('player') ?? 1)));
const room = params.get('room') ?? 'dev';
const relay = new URL(params.get('relay') ?? 'http://relay:4443/anon');
const sessionId = params.get('session') ?? crypto.randomUUID();
const timeline = new Timeline();
const errors: string[] = [];
let renderer: WebGpuRenderer | undefined;
let transport: MoqTransport | undefined;
let state = 'starting';
let joined = false;
let joiningEpoch = '';
let desired = { x: 0, z: 0 };
let joinSequence = 0;
let motionSequence = 0;
let actionSequence = 0;
let reconnecting = false;
function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}
const status = element<HTMLElement>('#status');
const details = element<HTMLElement>('#details');
const unsupported = element<HTMLElement>('#unsupported');

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
  }
  joined = snapshot.sessions.some(
    (session) =>
      session.playerId === playerId && session.sessionId === sessionId && session.connected,
  );
  if (!joined && joiningEpoch !== snapshot.roomEpoch) {
    joiningEpoch = snapshot.roomEpoch;
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
function handlers() {
  return {
    snapshot: onSnapshot,
    history: (chunk: { roomEpoch: string; samples: Snapshot[] }) => {
      if (chunk.roomEpoch === timeline.epoch || !timeline.epoch) timeline.addMany(chunk.samples);
    },
    state: setState,
    error: (error: unknown) => {
      recordError(error);
      if (!reconnecting) window.setTimeout(() => void reconnect(), 750);
    },
  };
}
async function reconnect() {
  if (reconnecting) return;
  reconnecting = true;
  joined = false;
  joiningEpoch = '';
  transport?.close();
  setState('reconnecting');
  try {
    transport = new MoqTransport(handlers());
    await transport.connect(relay, room, playerId);
  } catch (error) {
    recordError(error);
    window.setTimeout(() => {
      reconnecting = false;
      void reconnect();
    }, 1000);
    return;
  }
  reconnecting = false;
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
  const target = targetId ?? nearestTarget();
  transport?.sendAction(input(InputKind.ACTION, ++actionSequence, 0, 0, target));
}
function nearestTarget() {
  const pose = timeline.latest?.players.find((item) => item.playerId === playerId);
  if (!pose) return 31;
  return map.terminals.reduce((best, item) =>
    Math.hypot(item.x - pose.xMm, item.z - pose.zMm) <
    Math.hypot(best.x - pose.xMm, best.z - pose.zMm)
      ? item
      : best,
  ).id;
}

const keys = new Set<string>();
addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === 'e' && !event.repeat) action();
  updateKeys();
});
addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
  updateKeys();
});
function updateKeys() {
  move(
    (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0),
    (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0),
  );
}

export interface TemporalHeistTestApi {
  status(): string;
  joined(): boolean;
  snapshot(): Snapshot | undefined;
  move(x: number, z: number): void;
  action(targetId?: number): void;
  timeline(): ReturnType<Timeline['inspect']>;
  rendererInfo(): ReturnType<WebGpuRenderer['info']> | undefined;
  errors(): string[];
  reconnect(): Promise<void>;
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
  timeline: () => timeline.inspect(),
  rendererInfo: () => renderer?.info(),
  errors: () => [...errors, ...(renderer?.errors() ?? [])],
  reconnect,
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
  const frame = () => {
    const presentation = timeline.presentation();
    renderer?.render(map, presentation);
    const snap = presentation.snapshot;
    details.textContent = snap
      ? `tick ${snap.serverTick} · epoch ${snap.roomEpoch.slice(0, 8)} · ${timeline.length} samples · ${presentation.echoes.length} echoes`
      : `room ${room} · waiting for authority`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  await reconnect();
}
void start();
