// Solid boxes for city props (poles, bollards, dividers, shelters, kiosks), bucketed in a 2D hash
// so the player physics can test them cheaply. Fed once by amenities.ts; no world.ts import.
import { onAmenities, type Anchor } from "./amenities";

type Box = [number, number, number, number, number, number]; // minX,minY,minZ,maxX,maxY,maxZ
const CELL = 4;
const grid = new Map<number, Box[]>();
const key = (cx: number, cz: number) => cx * 73856093 ^ cz * 19349663;

function add(b: Box) {
  for (let cx = Math.floor(b[0] / CELL); cx <= Math.floor(b[3] / CELL); cx++)
    for (let cz = Math.floor(b[2] / CELL); cz <= Math.floor(b[5] / CELL); cz++) {
      const k = key(cx, cz);
      const l = grid.get(k);
      if (l) l.push(b); else grid.set(k, [b]);
    }
}
/** local box (centre lx,lz in anchor space, half sizes) rotated by the anchor yaw into world AABB */
function local(a: Anchor, lx: number, lz: number, hx: number, hz: number, y0: number, y1: number) {
  const c = Math.cos(a.r), s = Math.sin(a.r);
  const wx = a.x + lx * c + lz * s, wz = a.z - lx * s + lz * c;
  const ex = Math.abs(hx * c) + Math.abs(hz * s), ez = Math.abs(hx * s) + Math.abs(hz * c);
  add([wx - ex, a.y + y0, wz - ez, wx + ex, a.y + y1, wz + ez]);
}

if (typeof window !== "undefined") onAmenities((A) => {
  for (const a of A.lights) local(a, 0, 0, 0.12, 0.12, 0, 5.6);
  for (const a of A.bollards) local(a, 0, 0, 0.15, 0.15, 0, 0.9);
  for (const a of A.dividers) local(a, 0, 0, 0.28, 0.51, 0, 0.9);
  for (const a of A.kiosks) local(a, 0, 0, 0.55, 0.55, 0, 1.9);
  for (const a of A.rails) local(a, 0, 0, a.r ? 0.5 : 0.06, a.r ? 0.06 : 0.5, 0, 1.0);
  for (const a of A.shelters) {
    local(a, 0, -1.0, 1.55, 0.05, 0, 2.5); // back glass wall
    for (const x of [-1.5, 1.5]) for (const z of [-1, 0.35]) local(a, x, z, 0.05, 0.05, 0, 2.5);
    local(a, 0, -0.7, 1.1, 0.23, 0, 0.5); // bench (step-up-able)
    local(a, 0, -0.3, 1.6, 0.75, 2.45, 2.6); // roof
  }
});

/** true when the player AABB overlaps any prop box */
export function propHit(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  if (!grid.size) return false;
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      const l = grid.get(key(cx, cz));
      if (l) for (const b of l)
        if (x0 < b[3] && x1 > b[0] && y0 < b[4] && y1 > b[1] && z0 < b[5] && z1 > b[2]) return true;
    }
  return false;
}
