import type { Snapshot } from './generated/temporal_heist.ts';

const ACTIVE = 2;
const WON = 3;
const FAILED = 4;

export type AudioCue = 'echo' | 'door' | 'guard' | 'objective-secured' | 'success' | 'failure';

export interface AudioFrame {
  epoch: string;
  attempt: number;
  phase: number;
  tick: number;
  echoTick: number;
  doorOpen: boolean;
  objectiveSecured: boolean;
  guards: { id: number; state: number }[];
}

export function audioFrame(snapshot: Snapshot | undefined): AudioFrame | undefined {
  if (!snapshot?.room) return undefined;
  return {
    epoch: snapshot.roomEpoch,
    attempt: snapshot.room.attempt,
    phase: snapshot.room.phase,
    tick: snapshot.serverTick,
    echoTick: snapshot.room.startedTick + 600,
    doorOpen: snapshot.room.echoOpenedFinalDoor,
    objectiveSecured: snapshot.room.objectiveSecured,
    guards: (snapshot.guards ?? []).map(({ id, state }) => ({ id, state })),
  };
}

export function audioTransitions(
  previous: AudioFrame | undefined,
  next: AudioFrame | undefined,
): AudioCue[] {
  if (!previous || !next || previous.epoch !== next.epoch || previous.attempt !== next.attempt)
    return [];

  const cues: AudioCue[] = [];
  if (
    previous.phase === ACTIVE &&
    next.phase === ACTIVE &&
    previous.tick < next.echoTick &&
    next.tick >= next.echoTick
  )
    cues.push('echo');
  if (next.phase === ACTIVE && !previous.doorOpen && next.doorOpen) cues.push('door');
  if (!previous.objectiveSecured && next.objectiveSecured) cues.push('objective-secured');
  if (
    previous.phase === ACTIVE &&
    next.phase === ACTIVE &&
    next.guards.some(
      (guard) =>
        guard.state === 2 &&
        previous.guards.some(
          (prior) => prior.id === guard.id && (prior.state === 1 || prior.state === 3),
        ),
    )
  )
    cues.push('guard');
  if (previous.phase !== WON && next.phase === WON) cues.push('success');
  if (previous.phase !== FAILED && next.phase === FAILED) cues.push('failure');
  return cues;
}

const notes: Record<AudioCue, readonly [number, number][]> = {
  echo: [
    [220, 0.08],
    [440, 0.14],
  ],
  door: [
    [330, 0.08],
    [660, 0.18],
  ],
  guard: [
    [660, 0.08],
    [440, 0.14],
  ],
  'objective-secured': [
    [523, 0.08],
    [784, 0.16],
  ],
  success: [
    [523, 0.1],
    [659, 0.1],
    [784, 0.25],
  ],
  failure: [
    [180, 0.18],
    [120, 0.3],
  ],
};

export class AudioCues {
  #context?: AudioContext;
  #previous?: AudioFrame;
  muted = false;

  async unlock() {
    this.#context ??= new AudioContext();
    if (this.#context.state === 'suspended') await this.#context.resume();
  }

  update(snapshot: Snapshot | undefined) {
    const next = audioFrame(snapshot);
    const cues = audioTransitions(this.#previous, next);
    this.#previous = next;
    if (!this.#context || this.muted) return;
    for (const cue of cues) this.#play(cue);
  }

  toggle() {
    this.muted = !this.muted;
    return this.muted;
  }

  #play(cue: AudioCue) {
    const context = this.#context;
    if (!context) return;
    let at = context.currentTime;
    for (const [frequency, duration] of notes[cue]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.08, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration);
      at += duration;
    }
  }
}
