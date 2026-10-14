// Holographic plaza kiosks: proximity lookup + city directory destinations.
import { onAmenities, type Amenities } from "./amenities";

let A: Amenities | null = null;
if (typeof window !== "undefined") onAmenities((a) => (A = a));

export const KIOSK_RANGE = 2.6;
export function nearKiosk(x: number, y: number, z: number) {
  if (!A) return -1;
  for (let i = 0; i < A.kiosks.length; i++) {
    const k = A.kiosks[i]!;
    if (Math.abs(k.y - y) < 3 && Math.hypot(k.x - x, k.z - z) < KIOSK_RANGE) return i;
  }
  return -1;
}

export interface Dest { name: string; x: number; y: number; z: number; d: number }
/** directory list sorted by distance from the player */
export function destinations(x: number, z: number): Dest[] {
  if (!A) return [];
  const out: Dest[] = [];
  const pick = (name: string, list: { x: number; y: number; z: number }[], n: number, dy = 0) => {
    [...list].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, n)
      .forEach((p, i) => out.push({ name: `${name} ${String.fromCharCode(65 + i)}`, x: p.x, y: p.y + dy, z: p.z, d: Math.hypot(p.x - x, p.z - z) }));
  };
  pick("Rooftop Helipad", A.helipads, 3, 0.2);
  pick("Transit Shelter", A.shelters.map((s) => ({ ...s, x: s.x + Math.sin(s.r) * 1.2, z: s.z + Math.cos(s.r) * 1.2 })), 2);
  pick("Skybridge", A.ribs.map((r) => ({ ...r, y: r.y - r.s + 0.2 })), 2);
  pick("Plaza Kiosk", A.kiosks.map((k) => ({ ...k, x: k.x + 2 })), 3);
  return out.filter((d) => d.d > 4);
}
