// @ts-nocheck
// Phase 3 Linefield amenities: one-time scan of the city columns that finds anchor spots for
// streetlights, bollards, guardrails, skybridge ribs, facade conduits, helipads, masts, dishes and vents.
// Reads linefield.ts directly (no world.ts import) and runs in small slices so it never freezes a frame.
import { LF_SIZE, LF_X0, LF_Z0, LF_GROUND, lfColumn, onLinefieldReady } from "./linefield";

export interface Anchor { x: number; y: number; z: number; r: number; s: number }
export interface Amenities {
  lights: Anchor[]; bollards: Anchor[]; rails: Anchor[]; ribs: Anchor[]; conduits: Anchor[];
  helipads: Anchor[]; masts: Anchor[]; dishes: Anchor[]; vents: Anchor[];
  kiosks: Anchor[]; shelters: Anchor[]; dividers: Anchor[];
}

const ASPHALT = 27, ROAD_LINE = 31;
const N = LF_SIZE;
let result: Amenities | null = null;
const subs: ((a: Amenities) => void)[] = [];
export const onAmenities = (f: (a: Amenities) => void) => (result ? f(result) : subs.push(f));

function h(x: number, z: number) {
  let n = (x * 374761393 + z * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

if (typeof window !== "undefined") onLinefieldReady(() => scan());

function scan() {
  const top = new Int16Array(N * N);
  const topId = new Uint8Array(N * N);
  // floating slab per column: lowest run start that sits on >= 6 air above street level, within y 45..160
  const fl = new Int16Array(N * N).fill(-1);
  const flT = new Uint8Array(N * N);
  let v = 0;
  const step = () => {
    const end = Math.min(N, v + 24);
    for (; v < end; v++) for (let u = 0; u < N; u++) {
      const i = v * N + u;
      let t = -1, tid = 0, prev = -1, found = -1, thick = 0;
      lfColumn(u, v, (y, id) => {
        if (found >= 0 && y === found + thick && thick < 8) thick++;
        if (found < 0 && y >= 45 && y <= 160 && prev >= 0 && y - prev > 6 && prev >= LF_GROUND - 1) { found = y; thick = 1; }
        prev = y; t = y; tid = id;
      });
      top[i] = t; topId[i] = tid;
      if (found >= 0) { fl[i] = found; flT[i] = thick; }
    }
    if (v < N) setTimeout(step, 0);
    else finish(top, topId, fl, flT);
  };
  step();
}

function finish(top: Int16Array, topId: Uint8Array, fl: Int16Array, flT: Uint8Array) {
  const A: Amenities = { lights: [], bollards: [], rails: [], ribs: [], conduits: [], helipads: [], masts: [], dishes: [], vents: [], kiosks: [], shelters: [], dividers: [] };
  const T = (u: number, v: number) => (u < 0 || v < 0 || u >= N || v >= N ? -1 : top[v * N + u]);
  const isStreet = (u: number, v: number) => {
    if (u < 0 || v < 0 || u >= N || v >= N) return false;
    const i = v * N + u, id = topId[i];
    return (id === ASPHALT || id === ROAD_LINE) && Math.abs(top[i] - LF_GROUND) <= 2;
  };
  const used = new Uint8Array(N * N);
  const free = (u: number, v: number, r: number) => {
    for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
      const uu = u + x, vv = v + z;
      if (uu >= 0 && vv >= 0 && uu < N && vv < N && used[vv * N + uu]) return false;
    }
    return true;
  };
  const mark = (u: number, v: number, r: number) => {
    for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
      const uu = u + x, vv = v + z;
      if (uu >= 0 && vv >= 0 && uu < N && vv < N) used[vv * N + uu] = 1;
    }
  };
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const wx = (u: number) => LF_X0 + u + 0.5, wz = (v: number) => LF_Z0 + v + 0.5;

  for (let v = 2; v < N - 2; v++) for (let u = 2; u < N - 2; u++) {
    const i = v * N + u, t = top[i];
    if (t < 0) continue;
    // --- street level: curb columns (raised sidewalk next to asphalt)
    if (!isStreet(u, v) && t >= LF_GROUND - 1 && t <= LF_GROUND + 2) {
      for (const [dx, dz] of dirs) {
        if (!isStreet(u + dx, v + dz)) continue;
        const rot = Math.atan2(dx, dz); // arm faces the road
        const crossing = topId[(v + dz) * N + u + dx] === ROAD_LINE;
        if (!crossing && free(u, v, 6) && h(u, v) < 0.5) {
          A.lights.push({ x: wx(u), y: t + 1, z: wz(v), r: rot, s: 1 }); mark(u, v, 6);
        } else if (!crossing && free(u, v, 9) && h(u + 3, v + 9) < 0.05) {
          A.shelters.push({ x: wx(u), y: t + 1, z: wz(v), r: rot, s: 1 }); mark(u, v, 9);
        } else if (crossing && free(u, v, 1) && (u + v) % 2 === 0) {
          A.bollards.push({ x: wx(u) + dx * 0.3, y: t + 1, z: wz(v) + dz * 0.3, r: 0, s: 1 }); mark(u, v, 1);
        }
        break;
      }
    }
    // --- plaza kiosks: wide flat pedestrian area away from streets
    if (!isStreet(u, v) && t >= LF_GROUND - 1 && t <= LF_GROUND + 2 && h(u + 7, v + 1) < 0.012 && free(u, v, 8)) {
      let ok = true;
      for (let z = -3; z <= 3 && ok; z++) for (let x = -3; x <= 3; x++) if (T(u + x, v + z) !== t || isStreet(u + x, v + z)) { ok = false; break; }
      if (ok) { A.kiosks.push({ x: wx(u), y: t + 1, z: wz(v), r: h(u, v + 2) * 6.28, s: 1 }); mark(u, v, 8); }
    }
    // --- elevated road edges: street-like top above y 25 dropping off sharply
    const id = topId[i];
    if (id === ROAD_LINE && t > 25 && t < 60) {
      // centre median: orient along the longer street run through this cell
      let rx = 0, rz = 0;
      for (let k = 1; k <= 5; k++) { if (T(u + k, v) === t) rx++; if (T(u - k, v) === t) rx++; if (T(u, v + k) === t) rz++; if (T(u, v - k) === t) rz++; }
      A.dividers.push({ x: wx(u), y: t + 1, z: wz(v), r: rx > rz ? Math.PI / 2 : 0, s: 1 });
    }
    if ((id === ASPHALT || id === ROAD_LINE) && t > 25 && t < 60) {
      for (const [dx, dz] of dirs) {
        if (T(u + dx, v + dz) < t - 4) {
          A.rails.push({ x: wx(u) + dx * 0.42, y: t + 1, z: wz(v) + dz * 0.42, r: dx ? Math.PI / 2 : 0, s: 1 });
          break;
        }
      }
    }
    // --- skybridges: floating slab whose span continues along one axis
    const f = fl[i];
    if (f >= 0) {
      const ax = fl[i - 1] >= 0 && fl[i + 1] >= 0 && fl[i - N] < 0;
      const az = fl[i - N] >= 0 && fl[i + N] >= 0 && fl[i - 1] < 0;
      if ((ax && u % 3 === 0) || (az && v % 3 === 0)) {
        // find the span centre across its width
        let w0 = 0, w1 = 0;
        if (ax) { while (w0 < 6 && fl[i - (w0 + 1) * N] >= 0) w0++; while (w1 < 6 && fl[i + (w1 + 1) * N] >= 0) w1++; }
        else { while (w0 < 6 && fl[i - w0 - 1] >= 0) w0++; while (w1 < 6 && fl[i + w1 + 1] >= 0) w1++; }
        if (w0 === 0 || (ax ? fl[i - N] < 0 : fl[i - 1] < 0)) {
          const width = w0 + w1 + 1, c = (w1 - w0) / 2;
          if (width >= 2 && width <= 7) A.ribs.push({
            x: wx(u) + (az ? c : 0), y: f + flT[i] / 2 + 1.2, z: wz(v) + (ax ? c : 0),
            r: ax ? Math.PI / 2 : 0, s: width / 2 + 0.6,
          });
        }
      }
    }
    // --- facade conduits: tall wall face looking onto low ground
    if (t > 80 && h(u * 3, v * 7) < 0.02) {
      for (const [dx, dz] of dirs) {
        if (T(u + dx, v + dz) <= LF_GROUND + 2 && T(u - dx, v - dz) > 60 && free(u, v, 10)) {
          const g = Math.max(LF_GROUND + 1, T(u + dx, v + dz) + 1);
          A.conduits.push({ x: wx(u) + dx * 0.62, y: g, z: wz(v) + dz * 0.62, r: Math.atan2(dx, dz), s: t + 1 - g });
          mark(u, v, 10); break;
        }
      }
    }
  }

  // --- rooftops: flat plateaus above y 120
  const flat = (u: number, v: number, r: number, t: number) => {
    for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (T(u + x, v + z) !== t) return false;
    return true;
  };
  const roof = new Uint8Array(N * N);
  for (let v = 6; v < N - 6; v += 2) for (let u = 6; u < N - 6; u += 2) {
    const t = T(u, v);
    if (t < 120) continue;
    let peak = true;
    for (let z = -6; z <= 6 && peak; z++) for (let x = -6; x <= 6; x++) if (T(u + x, v + z) > t) { peak = false; break; }
    if (!roof[v * N + u] && t > 150 && flat(u, v, 4, t)) {
      A.helipads.push({ x: wx(u), y: t + 1.02, z: wz(v), r: 0, s: 4 });
      for (let z = -9; z <= 9; z++) for (let x = -9; x <= 9; x++) roof[(v + z) * N + u + x] = 1;
      continue;
    }
    if (peak && !roof[v * N + u] && flat(u, v, 1, t)) {
      A.masts.push({ x: wx(u), y: t + 1, z: wz(v), r: 0, s: 8 + h(u, v) * 14 });
      for (let z = -6; z <= 6; z++) for (let x = -6; x <= 6; x++) roof[(v + z) * N + u + x] = 1;
      continue;
    }
    if (!roof[v * N + u] && flat(u, v, 1, t)) {
      const r = h(u + 11, v + 5);
      if (r < 0.06) A.dishes.push({ x: wx(u), y: t + 1, z: wz(v), r: r * 100, s: 1 });
      else if (r < 0.14) A.vents.push({ x: wx(u), y: t + 1, z: wz(v), r: r * 40, s: 1 });
      else continue;
      for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) roof[(v + z) * N + u + x] = 1;
    }
  }
  result = A;
  for (const f of subs) f(A);
  subs.length = 0;
}
