import type { Guard, Pose, Snapshot } from './generated/temporal_heist.ts';
export interface VisualPose {
  playerId: number;
  xMm: number;
  zMm: number;
  sourceTick: number;
}
export interface Presentation {
  snapshot?: Snapshot;
  live: VisualPose[];
  echoes: VisualPose[];
  guards: VisualGuard[];
  renderTick: number;
}
export type VisualGuard = Guard;
export interface CanonicalSegment {
  playerId: number;
  startTick: number;
  endTick: number;
  startXmm: number;
  startZmm: number;
  endXmm: number;
  endZmm: number;
}
export interface EchoTransition {
  playerId: number;
  tick: number;
  xMm: number;
  zMm: number;
}
const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;
export class Timeline {
  readonly capacity: number;
  #epoch = '';
  #samples: Snapshot[] = [];
  #retiredEpochs = new Set<string>();
  constructor(capacity = 1400) {
    this.capacity = capacity;
  }
  get epoch() {
    return this.#epoch;
  }
  get length() {
    return this.#samples.length;
  }
  get latest() {
    return this.#samples.at(-1);
  }
  clear(epoch = '') {
    if (this.#epoch && this.#epoch !== epoch) this.#retiredEpochs.add(this.#epoch);
    this.#epoch = epoch;
    this.#samples = [];
  }
  add(snapshot: Snapshot): boolean {
    if (!snapshot.roomEpoch) return false;
    if (this.#retiredEpochs.has(snapshot.roomEpoch)) return false;
    if (this.#epoch && snapshot.roomEpoch !== this.#epoch) this.clear(snapshot.roomEpoch);
    if (!this.#epoch) this.#epoch = snapshot.roomEpoch;
    const found = this.#samples.findIndex((sample) => sample.serverTick >= snapshot.serverTick);
    if (found >= 0 && this.#samples[found]?.serverTick === snapshot.serverTick)
      this.#samples[found] = snapshot;
    else if (found >= 0) this.#samples.splice(found, 0, snapshot);
    else this.#samples.push(snapshot);
    if (this.#samples.length > this.capacity)
      this.#samples.splice(0, this.#samples.length - this.capacity);
    return true;
  }
  addMany(samples: readonly Snapshot[]) {
    for (const sample of samples) this.add(sample);
  }
  presentation(renderTick = this.latest?.serverTick ?? 0): Presentation {
    return {
      snapshot: this.latest,
      live: this.#interpolate(renderTick, false),
      echoes: this.#interpolate(renderTick - 600, true),
      guards: this.#interpolateGuards(renderTick),
      renderTick,
    };
  }
  inspect() {
    return {
      epoch: this.#epoch,
      length: this.length,
      firstTick: this.#samples[0]?.serverTick,
      latestTick: this.latest?.serverTick,
    };
  }
  canonicalSegments(
    startTick: number,
    endTick: number,
    attempt: number,
    maxGapTicks = 3,
  ): CanonicalSegment[] {
    if (startTick < 0 || endTick <= startTick || this.#samples.length < 2) return [];
    const first = this.#samples[0];
    const last = this.#samples.at(-1);
    if (!first || !last || first.serverTick > startTick || last.serverTick < endTick) return [];
    const players = new Set<number>();
    for (const sample of this.#samples)
      if (sample.room?.phase === 2 && sample.room.attempt === attempt)
        for (const pose of sample.players) players.add(pose.playerId);
    const segments: CanonicalSegment[] = [];
    for (const playerId of players) {
      const owner: CanonicalSegment[] = [];
      for (let index = 1; index < this.#samples.length; index += 1) {
        const before = this.#samples[index - 1];
        const after = this.#samples[index];
        if (!before || !after || after.serverTick <= startTick || before.serverTick >= endTick)
          continue;
        if (
          before.room?.phase !== 2 ||
          after.room?.phase !== 2 ||
          before.room.attempt !== attempt ||
          after.room.attempt !== attempt
        )
          continue;
        const span = after.serverTick - before.serverTick;
        if (span <= 0 || span > maxGapTicks) continue;
        const start = before.players.find((pose) => pose.playerId === playerId);
        const end = after.players.find((pose) => pose.playerId === playerId);
        if (!start || !end) continue;
        const clippedStart = Math.max(startTick, before.serverTick);
        const clippedEnd = Math.min(endTick, after.serverTick);
        if (clippedEnd <= clippedStart) continue;
        const at = (tick: number, a: number, b: number) =>
          lerp(a, b, (tick - before.serverTick) / span);
        owner.push({
          playerId,
          startTick: clippedStart,
          endTick: clippedEnd,
          startXmm: at(clippedStart, start.xMm, end.xMm),
          startZmm: at(clippedStart, start.zMm, end.zMm),
          endXmm: at(clippedEnd, start.xMm, end.xMm),
          endZmm: at(clippedEnd, start.zMm, end.zMm),
        });
      }
      if (owner[0]?.startTick === startTick && owner.at(-1)?.endTick === endTick)
        segments.push(...owner);
    }
    return segments;
  }
  echoTransitions(attempt: number, throughTick: number): EchoTransition[] {
    const present = new Set<number>();
    const transitions: EchoTransition[] = [];
    let sawAttemptSample = false;
    for (const sample of this.#samples) {
      if (sample.serverTick > throughTick) break;
      if (sample.room?.phase !== 2 || sample.room.attempt !== attempt) {
        present.clear();
        sawAttemptSample = false;
        continue;
      }
      const current = new Set(sample.echoes.map(({ playerId }) => playerId));
      for (const echo of sample.echoes)
        if (sawAttemptSample && !present.has(echo.playerId))
          transitions.push({
            playerId: echo.playerId,
            tick: sample.serverTick,
            xMm: echo.xMm,
            zMm: echo.zMm,
          });
      present.clear();
      for (const playerId of current) present.add(playerId);
      sawAttemptSample = true;
    }
    return transitions;
  }
  #interpolate(tick: number, requireSurrounding: boolean): VisualPose[] {
    if (tick < 0 || this.#samples.length === 0) return [];
    const first = this.#samples[0];
    const last = this.#samples.at(-1);
    if (!first || !last || tick < first.serverTick) return [];
    if (tick > last.serverTick)
      return requireSurrounding ? [] : last.players.map((pose) => this.#visual(pose, tick));
    let upper = this.#samples.findIndex((sample) => sample.serverTick >= tick);
    if (upper < 0) upper = this.#samples.length - 1;
    const after = this.#samples[upper];
    if (!after) return [];
    if (after.serverTick === tick || upper === 0)
      return after.players.map((pose) => this.#visual(pose, tick));
    const before = this.#samples[upper - 1];
    if (!before) return [];
    const span = after.serverTick - before.serverTick;
    const amount = span === 0 ? 0 : (tick - before.serverTick) / span;
    const result: VisualPose[] = [];
    for (const start of before.players) {
      const end = after.players.find((pose) => pose.playerId === start.playerId);
      if (end)
        result.push({
          playerId: start.playerId,
          xMm: lerp(start.xMm, end.xMm, amount),
          zMm: lerp(start.zMm, end.zMm, amount),
          sourceTick: tick,
        });
    }
    return result;
  }
  #visual(pose: Pose, tick: number): VisualPose {
    return { playerId: pose.playerId, xMm: pose.xMm, zMm: pose.zMm, sourceTick: tick };
  }
  #interpolateGuards(tick: number): VisualGuard[] {
    if (tick < 0 || this.#samples.length === 0) return [];
    const first = this.#samples[0];
    const last = this.#samples.at(-1);
    if (!first || !last || tick < first.serverTick) return [];
    if (tick >= last.serverTick) return last.guards ?? [];
    const upper = this.#samples.findIndex((sample) => sample.serverTick >= tick);
    const after = this.#samples[upper];
    if (!after) return [];
    if (after.serverTick === tick || upper === 0) return after.guards ?? [];
    const before = this.#samples[upper - 1];
    if (!before) return [];
    const amount = (tick - before.serverTick) / (after.serverTick - before.serverTick);
    return (after.guards ?? []).map((guard) => {
      const start = before.guards?.find((item) => item.id === guard.id);
      return start
        ? {
            ...guard,
            xMm: lerp(start.xMm, guard.xMm, amount),
            zMm: lerp(start.zMm, guard.zMm, amount),
          }
        : guard;
    });
  }
}
