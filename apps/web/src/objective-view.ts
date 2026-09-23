import type { Facility, Point } from './map.ts';
import type { Primitive } from './presentation-view.ts';
import type { Presentation } from './timeline.ts';

export function nearestActionTarget(
  map: Facility,
  presentation: Presentation,
  playerId: number,
): number | undefined {
  const player = presentation.live.find((pose) => pose.playerId === playerId);
  if (!player) return undefined;
  const targets: (Point & { radius: number })[] = map.terminals.map((terminal) => ({
    ...terminal,
    radius: 1000,
  }));
  if (!presentation.snapshot?.room?.objectiveSecured) targets.push(map.objective);
  let nearest: number | undefined;
  let nearestDistance = Infinity;
  for (const target of targets) {
    const distance = Math.hypot(target.x - player.xMm, target.z - player.zMm);
    if (distance <= target.radius && distance < nearestDistance) {
      nearest = target.id;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function objectivePrimitives(map: Facility, presentation: Presentation): Primitive[] {
  const { x, z } = map.objective;
  return [
    {
      x,
      y: 220,
      z,
      sx: 230,
      sy: 220,
      sz: 230,
      color: presentation.snapshot?.room?.objectiveSecured
        ? [0.1, 0.3, 0.34, 1]
        : [0.08, 0.9, 1, 1],
    },
  ];
}
