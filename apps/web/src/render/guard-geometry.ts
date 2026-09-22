import { guardVisuals } from '../guard-view.ts';
import type { Facility } from '../map.ts';
import type { Color } from '../presentation-view.ts';
import type { Presentation } from '../timeline.ts';

export interface GuardPrimitive {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: Color;
  matrix?: number[];
}

export function guardPrimitives(map: Facility, presentation: Presentation) {
  const cones: GuardPrimitive[] = [];
  const objects: GuardPrimitive[] = [];
  for (const guard of guardVisuals(map, presentation)) {
    const config = map.guards.find((item) => item.id === guard.id);
    if (!config) continue;
    cones.push({
      x: guard.x,
      y: 400,
      z: guard.z,
      sx: guard.halfWidth,
      sy: 20,
      sz: guard.range,
      color: guard.coneColor,
      matrix: [
        guard.lateral[0] * guard.halfWidth,
        0,
        guard.lateral[1] * guard.halfWidth,
        0,
        0,
        20,
        0,
        0,
        guard.forward[0] * guard.range,
        0,
        guard.forward[1] * guard.range,
        0,
        guard.x,
        400,
        guard.z,
        1,
      ],
    });
    objects.push({
      x: guard.x,
      y: 350,
      z: guard.z,
      sx: 190,
      sy: 350,
      sz: 190,
      color: guard.bodyColor,
    });
    objects.push({
      x: guard.x + guard.forward[0] * 260,
      y: 620,
      z: guard.z + guard.forward[1] * 260,
      sx: 75,
      sy: 35,
      sz: 75,
      color: [1, 1, 1, 1],
    });
    const points = config.waypoints;
    const count = points.length === 2 ? 1 : points.length;
    // ponytail: authored route is axis-aligned; use a matrix if diagonal waypoints are added.
    for (let i = 0; i < count; i++) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      if (!start || !end) continue;
      objects.push({
        x: (start.x + end.x) / 2,
        y: 450,
        z: (start.z + end.z) / 2,
        sx: Math.max(30, Math.abs(start.x - end.x) / 2),
        sy: 12,
        sz: Math.max(30, Math.abs(start.z - end.z) / 2),
        color: [0.28, 0.58, 0.65, 1],
      });
    }
    if (guard.target)
      objects.push({
        x: guard.target[0],
        y: 500,
        z: guard.target[1],
        sx: 140,
        sy: 28,
        sz: 140,
        color: [1, 0.18, 0.12, 1],
      });
  }
  return { cones, objects };
}
