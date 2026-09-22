import type { Snapshot } from './generated/temporal_heist.ts';
import type { Camera } from './map.ts';

export type Color = [number, number, number, number];
export const WORLD_DEPTH_SCALE = -1 / 2500;
export const WORLD_DEPTH_OFFSET = 0.8;

export function clipDepth(worldY: number) {
  return worldY * WORLD_DEPTH_SCALE + WORLD_DEPTH_OFFSET;
}

export interface SurveillanceVisual extends Camera {
  coneY: number;
  coneHalfHeight: number;
  forward: [number, number];
  lateral: [number, number];
  detected: boolean;
  detectedPlayerId: number;
  bodyColor: Color;
  coneColor: Color;
}

export function surveillanceVisuals(
  map: { cameras: Camera[] },
  snapshot: Pick<Snapshot, 'hazards'> | undefined,
): SurveillanceVisual[] {
  return map.cameras.map((camera) => {
    const length = Math.hypot(camera.directionX, camera.directionZ) || 1;
    const forward: [number, number] = [camera.directionX / length, camera.directionZ / length];
    const hazard = snapshot?.hazards.find((item) => item.id === camera.id);
    const detected = Boolean(hazard?.active || hazard?.detectedPlayerId);
    return {
      ...camera,
      coneY: 540,
      coneHalfHeight: 20,
      forward,
      lateral: [-forward[1], forward[0]],
      detected,
      detectedPlayerId: hazard?.detectedPlayerId ?? 0,
      bodyColor: detected ? [1, 0.18, 0.12, 1] : [0.95, 0.72, 0.16, 1],
      coneColor: detected ? [1, 0.08, 0.05, 0.4] : [0.12, 0.75, 0.72, 0.22],
    };
  });
}
