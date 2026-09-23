import type { Snapshot } from './generated/temporal_heist.ts';
import type { Facility } from './map.ts';
import type { Presentation } from './timeline.ts';

export type Color = [number, number, number, number];

const ACTIVE = 2;
const WON = 3;
const FAILED = 4;
const DEFAULT_CLEAR: Color = [0.015, 0.035, 0.055, 1];
const CAMERA_PADDING = 1000;

export interface AspectFitCamera {
  centerX: number;
  centerZ: number;
  width: number;
  height: number;
  pixelsPerWorldUnit: number;
  scaleX: number;
  scaleZ: number;
}

export interface Primitive {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: Color;
}

export function aspectFitCamera(
  bounds: Facility['bounds'],
  width: number,
  height: number,
): AspectFitCamera {
  const paddedWidth = bounds.maxX - bounds.minX + CAMERA_PADDING * 2;
  const paddedDepth = bounds.maxZ - bounds.minZ + CAMERA_PADDING * 2;
  const pixelsPerWorldUnit = Math.min(width / paddedWidth, height / paddedDepth);
  return {
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerZ: (bounds.minZ + bounds.maxZ) / 2,
    width,
    height,
    pixelsPerWorldUnit,
    scaleX: (2 * pixelsPerWorldUnit) / width,
    scaleZ: (2 * pixelsPerWorldUnit) / height,
  };
}

export function guidancePrimitives(
  map: Facility,
  presentation: Presentation,
  playerId: number,
): Primitive[] {
  const self = presentation.live.find((pose) => pose.playerId === playerId);
  if (!self) return [];
  const room = presentation.snapshot?.room;
  const goal = !room?.objectiveSecured
    ? map.objective
    : !room.echoOpenedFinalDoor
      ? map.plates.find((plate) => plate.doorId === 13)
      : {
          x: (map.extraction.minX + map.extraction.maxX) / 2,
          z: (map.extraction.minZ + map.extraction.maxZ) / 2,
        };
  if (!goal) return [];
  const actionable =
    room?.phase === ACTIVE &&
    !room.objectiveSecured &&
    Math.hypot(goal.x - self.xMm, goal.z - self.zMm) <= map.objective.radius;
  return [
    {
      x: self.xMm,
      y: 590,
      z: self.zMm,
      sx: 330,
      sy: 30,
      sz: 330,
      color: [1, 1, 1, 0.92],
    },
    {
      x: goal.x,
      y: 620,
      z: goal.z,
      sx: actionable ? 420 : 320,
      sy: 34,
      sz: actionable ? 420 : 320,
      color: actionable ? [1, 0.9, 0.12, 0.95] : [0.55, 0.95, 1, 0.82],
    },
  ];
}

export function extractionVisual(
  map: Pick<Facility, 'extraction'>,
  snapshot: Pick<Snapshot, 'room'> | undefined,
): Primitive {
  const area = map.extraction;
  const room = snapshot?.room;
  const color: Color =
    room?.phase === WON
      ? [0.2, 1, 0.42, 1]
      : room?.phase === FAILED
        ? [0.95, 0.12, 0.1, 0.9]
        : room?.echoOpenedFinalDoor
          ? [0.1, 0.9, 0.5, 0.85]
          : [0.08, 0.32, 0.38, 0.65];
  return {
    x: (area.minX + area.maxX) / 2,
    y: 20,
    z: (area.minZ + area.maxZ) / 2,
    sx: (area.maxX - area.minX) / 2,
    sy: 20,
    sz: (area.maxZ - area.minZ) / 2,
    color,
  };
}

export function sceneClearColor(snapshot: Pick<Snapshot, 'room'> | undefined): Color {
  if (snapshot?.room?.phase === WON) return [0.015, 0.09, 0.045, 1];
  if (snapshot?.room?.phase === FAILED) return [0.11, 0.018, 0.025, 1];
  return DEFAULT_CLEAR;
}

export function worldPixel(
  x: number,
  z: number,
  width: number,
  height: number,
  bounds: Facility['bounds'],
): [number, number] {
  const camera = aspectFitCamera(bounds, width, height);
  return [
    width / 2 + (x - camera.centerX) * camera.pixelsPerWorldUnit,
    height / 2 + (z - camera.centerZ) * camera.pixelsPerWorldUnit,
  ];
}
