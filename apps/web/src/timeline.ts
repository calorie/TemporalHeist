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
