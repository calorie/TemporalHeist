import type { Snapshot } from './generated/temporal_heist.ts';

const LOBBY = 1;
const ACTIVE = 2;
const WON = 3;
const FAILED = 4;
const FAILURE_TIMEOUT = 1;
const FAILURE_SURVEILLANCE = 2;

function phaseName(phase: number) {
  switch (phase) {
    case LOBBY:
      return 'LOBBY';
    case ACTIVE:
      return 'ACTIVE';
    case WON:
      return 'WON';
    case FAILED:
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}

export interface RoomHud {
  phase: string;
  phaseState: 'connecting' | 'lobby' | 'active' | 'won' | 'failed';
  objective: string;
  timer: string;
  echoStatus: string;
  readiness: string;
  result: string;
  resultState: 'none' | 'success' | 'failure';
  canReady: boolean;
  canRestart: boolean;
}

function clock(ticks: number) {
  const seconds = Math.max(0, Math.ceil(ticks / 60));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function roomHud(snapshot: Snapshot | undefined, playerId: number): RoomHud {
  const room = snapshot?.room;
  if (!snapshot || !room) {
    return {
      phase: 'CONNECTING',
      phaseState: 'connecting',
      objective: 'Waiting for authority',
      timer: '--:--',
      echoStatus: 'ECHO · WAITING FOR ATTEMPT',
      readiness: 'Players ready: 0/2',
      result: '',
      resultState: 'none',
      canReady: false,
      canRestart: false,
    };
  }

  const ownSession = snapshot.sessions.find((session) => session.playerId === playerId);
  const phase = phaseName(room.phase);
  const active = room.phase === ACTIVE;
  const terminal = room.phase === WON || room.phase === FAILED;
  const echoTicks = room.startedTick + 600 - snapshot.serverTick;
  let objective = 'Ready up with your partner';
  if (active && !room.echoOpenedFinalDoor) objective = 'Open the final door with Echo Presence';
  if (active && room.echoOpenedFinalDoor)
    objective = `Reach extraction together (${room.extractionPlayers}/2)`;
  if (room.phase === WON) objective = 'Heist complete';
  if (room.phase === FAILED) objective = 'Attempt failed';

  let failure = 'ATTEMPT FAILED — press R or Restart to retry';
  if (room.failureReason === FAILURE_TIMEOUT)
    failure = 'TIME EXPIRED — press R or Restart to retry';
  if (room.failureReason === FAILURE_SURVEILLANCE)
    failure = `SURVEILLANCE DETECTED — CAMERA ${room.failureHazardId} — press R or Restart to retry`;

  return {
    phase: `${phase} · ATTEMPT ${room.attempt}`,
    phaseState: phase.toLowerCase() as RoomHud['phaseState'],
    objective,
    timer: active ? clock(room.deadlineTick - snapshot.serverTick) : '--:--',
    echoStatus: active
      ? echoTicks > 0
        ? `ECHO IN ${clock(echoTicks)}`
        : 'ECHO REPLAYING · 10 SECONDS BEHIND'
      : 'ECHO · STARTS 10 SECONDS AFTER LAUNCH',
    readiness: `Players ready: ${room.readyPlayers}/2${ownSession?.ready ? ' · YOU ARE READY' : ''}`,
    result:
      room.phase === WON
        ? 'SUCCESS — press R or Restart to play again'
        : room.phase === FAILED
          ? failure
          : '',
    resultState: room.phase === WON ? 'success' : room.phase === FAILED ? 'failure' : 'none',
    canReady: room.phase === LOBBY && Boolean(ownSession?.connected && !ownSession.ready),
    canRestart: terminal,
  };
}
