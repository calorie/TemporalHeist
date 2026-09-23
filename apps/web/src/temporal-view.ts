import type { CanonicalSegment, Timeline } from './timeline.ts';

export const ECHO_DELAY_TICKS = 600;
export const SPAWN_PULSE_TICKS = 60;
export const MAX_TEMPORAL_SEGMENTS = 512;

export interface TemporalPulse {
  playerId: number;
  xMm: number;
  zMm: number;
  ageTicks: number;
}

export interface TemporalView {
  epoch: string;
  renderTick: number;
  owners: number[];
  segments: CanonicalSegment[];
  pulses: TemporalPulse[];
}

export function temporalView(timeline: Timeline, renderTick: number): TemporalView {
  const room = timeline.latest?.room;
  if (room?.phase !== 2)
    return { epoch: timeline.epoch, renderTick, owners: [], segments: [], pulses: [] };
  const startTick = renderTick - ECHO_DELAY_TICKS;
  const segments = timeline.canonicalSegments(startTick, renderTick, room.attempt);
  if (segments.length > MAX_TEMPORAL_SEGMENTS)
    throw new Error(
      `Temporal segment capacity exceeded: ${segments.length} > ${MAX_TEMPORAL_SEGMENTS}`,
    );
  const owners = [...new Set(segments.map(({ playerId }) => playerId))].sort((a, b) => a - b);
  const pulses = timeline
    .echoTransitions(room.attempt, renderTick)
    .map((transition) => ({ ...transition, ageTicks: renderTick - transition.tick }))
    .filter(({ ageTicks }) => ageTicks >= 0 && ageTicks < SPAWN_PULSE_TICKS)
    .map(({ playerId, xMm, zMm, ageTicks }) => ({ playerId, xMm, zMm, ageTicks }))
    .sort((a, b) => a.playerId - b.playerId);
  return { epoch: timeline.epoch, renderTick, owners, segments, pulses };
}
