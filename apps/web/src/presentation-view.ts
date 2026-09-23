import type { Snapshot } from './generated/temporal_heist.ts';
import type { Facility } from './map.ts';

export type Color = [number, number, number, number];

const WON = 3;
const FAILED = 4;
const DEFAULT_CLEAR: Color = [0.015, 0.035, 0.055, 1];
export const WORLD_CENTER_X = 12000;
export const WORLD_HALF_WIDTH = 13000;
export const WORLD_CENTER_Z = 4000;
export const WORLD_HALF_DEPTH = 5200;

export interface Primitive {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: Color;
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

export function worldPixel(x: number, z: number, width: number, height: number): [number, number] {
  const aspect = width / height;
  return [
    ((x - WORLD_CENTER_X) / WORLD_HALF_WIDTH + 1) * (width / 2),
    (1 - ((WORLD_CENTER_Z - z) / WORLD_HALF_DEPTH) * aspect) * (height / 2),
  ];
}
