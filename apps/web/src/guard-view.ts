import type { GuardState } from './generated/temporal_heist.ts';
import type { Facility } from './map.ts';
import type { Color } from './presentation-view.ts';
import type { Presentation } from './timeline.ts';

const PATROL = 1;
const INVESTIGATE = 2;
const RETURN = 3;

export interface GuardVisual {
  id: number;
  x: number;
  z: number;
  forward: [number, number];
  lateral: [number, number];
  range: number;
  halfWidth: number;
  bodyColor: Color;
  coneColor: Color;
  target?: [number, number];
}

function colors(state: GuardState): { bodyColor: Color; coneColor: Color } {
  switch (state) {
    case PATROL:
      return { bodyColor: [0.95, 0.72, 0.16, 1], coneColor: [0.12, 0.75, 0.72, 0.22] };
    case INVESTIGATE:
      return { bodyColor: [1, 0.18, 0.12, 1], coneColor: [1, 0.08, 0.05, 0.4] };
    case RETURN:
      return { bodyColor: [0.35, 0.65, 1, 1], coneColor: [0.2, 0.45, 1, 0.25] };
    default:
      return { bodyColor: [0.55, 0.55, 0.6, 1], coneColor: [0.45, 0.45, 0.5, 0.18] };
  }
}

export function guardVisuals(map: Facility, presentation: Presentation): GuardVisual[] {
  return presentation.guards.flatMap((guard) => {
    const config = map.guards.find((item) => item.id === guard.id);
    if (!config) return [];
    const length = Math.hypot(guard.facingX, guard.facingZ);
    const forward: [number, number] = length
      ? [guard.facingX / length, guard.facingZ / length]
      : [1, 0];
    return [
      {
        id: guard.id,
        x: guard.xMm,
        z: guard.zMm,
        forward,
        lateral: [forward[1] === 0 ? 0 : -forward[1], forward[0]],
        range: config.range,
        halfWidth: config.halfWidth,
        ...colors(guard.state),
        ...(guard.investigationTarget
          ? {
              target: [guard.investigationTarget.xMm, guard.investigationTarget.zMm] as [
                number,
                number,
              ],
            }
          : {}),
      },
    ];
  });
}
