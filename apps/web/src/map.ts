import facility from '../../../map/facility.json' with { type: 'json' };
export interface Box {
  id: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface Point {
  id: number;
  x: number;
  z: number;
}
export interface Camera extends Point {
  directionX: number;
  directionZ: number;
  range: number;
  halfWidth: number;
}
export interface Facility {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  extraction: { minX: number; maxX: number; minZ: number; maxZ: number };
  zones: { name: string; x: number }[];
  walls: Box[];
  doors: Box[];
  plates: (Point & { doorId: number; radius: number; capability: string })[];
  terminals: (Point & { capability: string })[];
  cameras: Camera[];
}
export const map = facility as Facility;
