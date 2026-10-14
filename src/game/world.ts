// Hot numeric voxel loops: index-signature strictness is disabled here for readability.
// @ts-nocheck
import * as THREE from "three";
import { CASTLE_DATA, CASTLE_SIZE } from "./castleData";
import { buildTown, townAt, T_R, T_Y, AIRV } from "./town";
import { buildCity, cityAt, C_R, C_Y, CAIR } from "./city";
import { B, BLOCKS, ATLAS_COLS, isTransparent, isPassable, isNatural, isPlant, isEmissive, remapId } from "./blocks";
import { lfColumn, onLinefieldTile, LF_X0, LF_Z0, LF_SIZE, LF_TS, LF_GROUND, LF_CX, LF_CZ } from "./linefield";
import { propHit } from "./propCollide";

export const CH = 16;
export const H = 400; // tall enough for Linefield's tallest towers (build limit at y=395)
export const WATER_LEVEL = 15;
// kingdom: centred on the citadel, 200x200 inside a 3-thick wall
export const K_CX = 24 + 14, K_CZ = 0, K_HALF = 100, WALL_T = 3;
const K_OUT = K_HALF + 12; // flat apron outside the wall
const K_FADE = 28; // blend back into natural terrain
// modern metropolis, far east of the kingdom
export const M_CX = K_CX + 360, M_CZ = 40;
const M_OUT = 114, M_FADE = 36; // city radius (C_R=110) + apron
const LF_HALF = LF_SIZE / 2, LF_OUT = LF_HALF + 6, LF_FADE = 40;

export function hash2(x: number, z: number, seed: number) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise(x: number, z: number, seed: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number, seed: number, oct: number) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += noise(x * f, z * f, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / norm;
}

const idx = (x: number, y: number, z: number) => (y * CH + z) * CH + x;
export const chunkKey = (cx: number, cz: number) => `${cx},${cz}`;

export type Edits = Record<string, Record<number, number>>;

export class World {
  chunks = new Map<string, Uint8Array>();
  versions = new Map<string, number>();
  tops = new Map<string, number>();
  constructor(public seed: number, public edits: Edits = {}) {
    onLinefieldTile((tx, tz) => {
      const c0x = Math.floor((LF_X0 + tx * LF_TS) / CH), c0z = Math.floor((LF_Z0 + tz * LF_TS) / CH);
      for (let cz = c0z; cz < c0z + LF_TS / CH; cz++) for (let cx = c0x; cx < c0x + LF_TS / CH; cx++) {
        const k = chunkKey(cx, cz), c = this.chunks.get(k);
        if (!c) continue;
        this.stampLinefield(cx, cz, c);
        const e = this.edits[k];
        if (e) for (const i in e) c[+i] = e[i];
        this.tops.set(k, topOf(c));
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.bump(cx + dx, cz + dz);
      }
    });
  }

  // ---- Linefield cyberpunk downtown (1:1 import, streamed tiles) ----
  lfDist(x: number, z: number) { return Math.max(Math.abs(x - LF_CX + 0.5), Math.abs(z - LF_CZ + 0.5)); }
  private stampLinefield(cx: number, cz: number, c: Uint8Array) {
    const x0 = cx * CH, z0 = cz * CH;
    if (x0 + CH <= LF_X0 || x0 >= LF_X0 + LF_SIZE || z0 + CH <= LF_Z0 || z0 >= LF_Z0 + LF_SIZE) return;
    for (let lz = 0; lz < CH; lz++)
      for (let lx = 0; lx < CH; lx++) {
        const u = x0 + lx - LF_X0, v = z0 + lz - LF_Z0;
        if (u < 0 || v < 0 || u >= LF_SIZE || v >= LF_SIZE) continue;
        c[idx(lx, 0, lz)] = B.BEDROCK;
        for (let y = 1; y < H; y++) c[idx(lx, y, lz)] = y < LF_GROUND - 4 ? B.CONCRETE : 0;
        const ok = lfColumn(u, v, (y, id) => { if (y < H) c[idx(lx, y, lz)] = remapId(id); });
        if (!ok) for (let y = LF_GROUND - 4; y <= LF_GROUND; y++) c[idx(lx, y, lz)] = B.PANEL_DARK; // placeholder street until the tile streams in
      }
  }


  // ---- Classic Stone Castle (CastleShift mod pieces) ----
  private castleGrid: Uint8Array | null = null;
  private castleAt: [number, number, number] | null = null;
  /** world-space min corner of the castle grid */
  castleOrigin(): [number, number, number] {
    if (this.castleAt) return this.castleAt;
    const [sx, , sz] = CASTLE_SIZE;
    const ox = 24, oz = -sz / 2 | 0;
    let sum = 0, n = 0;
    for (let z = 0; z < sz; z += 3) for (let x = 0; x < sx; x += 3) { sum += this.height(ox + x, oz + z); n++; }
    const base = Math.max(WATER_LEVEL + 2, Math.min(H - CASTLE_SIZE[1] - 2, Math.round(sum / n) + 1));
    return (this.castleAt = [ox, base, oz]);
  }
  private castle() {
    if (!this.castleGrid) {
      const bin = atob(CASTLE_DATA);
      const g = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) g[i] = bin.charCodeAt(i);
      this.castleGrid = g;
    }
    return this.castleGrid;
  }
  private stampCastle(cx: number, cz: number, c: Uint8Array) {
    const [ox, oy, oz] = this.castleOrigin();
    const [sx, sy, sz] = CASTLE_SIZE;
    const x0 = Math.max(0, ox - cx * CH), x1 = Math.min(CH, ox + sx - cx * CH);
    const z0 = Math.max(0, oz - cz * CH), z1 = Math.min(CH, oz + sz - cz * CH);
    if (x0 >= x1 || z0 >= z1) return;
    const g = this.castle();
    const MAP = [0, B.STONE_BRICK, B.MOSSY_BRICK, B.TIMBER, B.LOG, B.PLANKS, B.BRICK, B.GRASS, B.DIRT, B.WATER, B.GLASS, B.COBBLE];
    for (let lz = z0; lz < z1; lz++)
      for (let lx = x0; lx < x1; lx++) {
        const gx = cx * CH + lx - ox, gz = cz * CH + lz - oz;
        let footprint = false;
        for (let y = 0; y < sy; y++) {
          const v = g[(y * sz + gz) * sx + gx];
          if (v === 255) continue;
          const wy = oy + y;
          if (wy >= H) break;
          c[idx(lx, wy, lz)] = MAP[v] ?? 0;
          if (y < 2 && v !== 0) footprint = true;
        }
        // clear terrain poking above the ground floor, and build a foundation down to the ground
        if (footprint || g[gz * sx + gx] !== 255) {
          for (let y = oy; y < H; y++) if (g[((y - oy) * sz + gz) * sx + gx] === 255 && (y - oy) < 3) c[idx(lx, y, lz)] = 0;
          for (let y = oy - 1; y > 0; y--) {
            const cur = c[idx(lx, y, lz)];
            if (cur !== 0 && cur !== B.WATER && !isPlant(cur) && cur !== B.LEAVES && y < oy - 1) break;
            c[idx(lx, y, lz)] = y === oy - 1 ? B.STONE_BRICK : B.COBBLE;
          }
        }
      }
  }
  /** a dry spot just outside the castle's south gate */
  castleSpawn(): [number, number, number] {
    const [ox, , oz] = this.castleOrigin();
    return this.findDry(ox + (CASTLE_SIZE[0] >> 1), oz + CASTLE_SIZE[2] + 6);
  }

  // ---- Kingdom: flattened 200x200 interior ringed by a fortified wall ----
  private kBase: number | null = null;
  /** ground level of the flattened kingdom */
  kingdomGround() {
    if (this.kBase !== null) return this.kBase;
    let sum = 0, n = 0;
    for (let z = -K_HALF; z <= K_HALF; z += 8) for (let x = -K_HALF; x <= K_HALF; x += 8) { sum += this.computeHeight(K_CX + x, K_CZ + z); n++; }
    return (this.kBase = Math.max(WATER_LEVEL + 3, Math.min(26, Math.round(sum / n))));
  }
  /** Chebyshev distance from kingdom centre */
  kingdomDist(x: number, z: number) { return Math.max(Math.abs(x - K_CX), Math.abs(z - K_CZ)); }
  private stampKingdomWall(cx: number, cz: number, c: Uint8Array) {
    const G = this.kingdomGround();
    const x0 = cx * CH, z0 = cz * CH;
    if (x0 + CH < K_CX - K_OUT || x0 > K_CX + K_OUT || z0 + CH < K_CZ - K_OUT || z0 > K_CZ + K_OUT) return;
    const WALL_H = 11, TOWER_H = 17;
    for (let lz = 0; lz < CH; lz++)
      for (let lx = 0; lx < CH; lx++) {
        const dx = x0 + lx - K_CX, dz = z0 + lz - K_CZ;
        const ax = Math.abs(dx), az = Math.abs(dz), d = Math.max(ax, az);
        // towers: corners + every 50 blocks along each side (7x7, centred on wall)
        const along = ax >= az ? dz : dx; // coordinate running along the side
        const mid = K_HALF + 2;
        const onSideBand = d >= mid - 3 && d <= mid + 3;
        const tPos = Math.round(along / 50) * 50;
        const isCornerT = ax >= mid - 3 && ax <= mid + 3 && az >= mid - 3 && az <= mid + 3;
        const isTower = onSideBand && (isCornerT || (Math.abs(along - tPos) <= 3 && tPos !== 0));
        const inWall = d > K_HALF && d <= K_HALF + WALL_T;
        if (!isTower && !inWall) continue;
        // gatehouse in the middle of each side
        const gate = Math.abs(along) <= 2 && !isCornerT;
        const top = isTower ? TOWER_H : WALL_H;
        const hollowTower = isTower && Math.max(Math.abs(ax - mid), 0) <= 2 && (isCornerT ? Math.max(Math.abs(ax - mid), Math.abs(az - mid)) <= 2 : Math.abs(along - tPos) <= 2 && Math.abs(d - mid) <= 2);
        for (let y = 1; y <= G - 1; y++) if (c[idx(lx, y, lz)] === 0 || c[idx(lx, y, lz)] === B.WATER) c[idx(lx, y, lz)] = B.COBBLE;
        for (let h = 0; h <= top + 1; h++) {
          const y = G + h;
          if (y >= H) break;
          let id: number = h === 0 ? B.COBBLE : hash2(x0 + lx, y * 31 + z0 + lz, this.seed + 7) < 0.12 ? B.MOSSY_BRICK : B.STONE_BRICK;
          if (gate && h >= 1 && h <= 7 && !(h === 7 && Math.abs(along) === 2)) id = 0; // arched opening
          if (hollowTower && h >= 1 && h < top && !(gate && h <= 7)) id = h % 6 === 0 ? B.PLANKS : 0;
          if (isTower && !hollowTower && h >= 4 && h < top && h % 5 === 0 && ((ax >= az ? Math.abs(along - tPos) : 9) === 0 || d === mid + 3)) id = B.GLASS; // arrow slits
          if (h === top + 1) {
            // crenellations: merlons on the outer/inner edge, alternating
            const edge = isTower ? d === mid + 3 || d === mid - 3 || (!isCornerT && Math.abs(along - tPos) === 3) || (isCornerT && (ax === mid + 3 || az === mid + 3 || ax === mid - 3 || az === mid - 3))
              : d === K_HALF + WALL_T || d === K_HALF + 1;
            id = edge && ((x0 + lx + z0 + lz) & 1) === 0 ? B.STONE_BRICK : 0;
          }
          if (h === top && !isTower) id = B.COBBLE; // walkway
          if (inWall && !isTower && !gate && h === 6 && (d === K_HALF + 1 || d === K_HALF + WALL_T) && ((along % 10) + 10) % 10 === 5) id = B.LANTERN;
          c[idx(lx, y, lz)] = id;
        }
      }
  }

  private town: Uint8Array | null = null;
  private stampTown(cx: number, cz: number, c: Uint8Array) {
    const x0 = cx * CH, z0 = cz * CH;
    if (x0 + CH < K_CX - T_R || x0 > K_CX + T_R || z0 + CH < K_CZ - T_R || z0 > K_CZ + T_R) return;
    if (!this.town) this.town = buildTown(this.seed);
    const G = this.kingdomGround();
    for (let lz = 0; lz < CH; lz++)
      for (let lx = 0; lx < CH; lx++) {
        const u = x0 + lx - K_CX, v = z0 + lz - K_CZ;
        if (u < -T_R || u > T_R || v < -T_R || v > T_R) continue;
        for (let h = 0; h < T_Y && G + h < H; h++) {
          const t = townAt(this.town, u, h, v);
          if (t) c[idx(lx, G + h, lz)] = t === AIRV ? 0 : t;
        }
      }
  }

  private hcache = new Map<number, number>();
  height(x: number, z: number) {
    const key = x * 100003 + z;
    let v = this.hcache.get(key);
    if (v === undefined) {
      v = this.computeHeight(x, z);
      const d = this.kingdomDist(x, z);
      if (d < K_OUT + K_FADE) {
        const G = this.kingdomGround();
        const t = d <= K_OUT ? 1 : 1 - (d - K_OUT) / K_FADE;
        const s = t * t * (3 - 2 * t);
        v = Math.round(v + (G - v) * s);
      }
      const md = this.cityDist(x, z);
      if (md < M_OUT + M_FADE) {
        const G = this.cityGround();
        const t = md <= M_OUT ? 1 : 1 - (md - M_OUT) / M_FADE;
        const s = t * t * (3 - 2 * t);
        v = Math.round(v + (G - v) * s);
      }
      const ld = this.lfDist(x, z);
      if (ld < LF_OUT + LF_FADE) {
        const t = ld <= LF_OUT ? 1 : 1 - (ld - LF_OUT) / LF_FADE;
        const s = t * t * (3 - 2 * t);
        v = Math.round(v + (LF_GROUND - v) * s);
      }
      if (this.hcache.size > 400000) this.hcache.clear();
      this.hcache.set(key, v);
    }
    return v;
  }

  // ---- Modern metropolis ----
  cityDist(x: number, z: number) { return Math.max(Math.abs(x - M_CX), Math.abs(z - M_CZ)); }
  private mBase: number | null = null;
  cityGround() {
    if (this.mBase !== null) return this.mBase;
    let sum = 0, n = 0;
    for (let z = -C_R; z <= C_R; z += 10) for (let x = -C_R; x <= C_R; x += 10) { sum += this.computeHeight(M_CX + x, M_CZ + z); n++; }
    return (this.mBase = Math.max(WATER_LEVEL + 3, Math.min(H - C_Y - 3, Math.round(sum / n))));
  }
  private city: Uint8Array | null = null;
  private stampCity(cx: number, cz: number, c: Uint8Array) {
    const x0 = cx * CH, z0 = cz * CH;
    if (x0 + CH < M_CX - C_R || x0 > M_CX + C_R || z0 + CH < M_CZ - C_R || z0 > M_CZ + C_R) return;
    if (!this.city) this.city = buildCity(this.seed);
    const G = this.cityGround();
    for (let lz = 0; lz < CH; lz++)
      for (let lx = 0; lx < CH; lx++) {
        const u = x0 + lx - M_CX, v = z0 + lz - M_CZ;
        if (u < -C_R || u > C_R || v < -C_R || v > C_R) continue;
        for (let y = 1; y < G; y++) if (c[idx(lx, y, lz)] === 0 || c[idx(lx, y, lz)] === B.WATER) c[idx(lx, y, lz)] = B.STONE;
        for (let h = 0; h < C_Y && G + h < H; h++) {
          const t = cityAt(this.city, u, h, v);
          if (t) c[idx(lx, G + h, lz)] = t === CAIR ? 0 : t;
        }
      }
  }
  /** 0 = desert, 1 = rainforest, in between = savanna (smooth weights) */
  biome(x: number, z: number) {
    const t = fbm(x / 420, z / 420, this.seed + 91, 3);
    const desert = Math.max(0, Math.min(1, (0.42 - t) / 0.07));
    const jungle = Math.max(0, Math.min(1, (t - 0.58) / 0.07));
    return { desert, jungle };
  }
  private computeHeight(x: number, z: number) {
    const { desert, jungle } = this.biome(x, z);
    // rolling savanna hills: domain-warped broad swells
    const wx = x + (fbm(x / 90, z / 90, this.seed + 21, 2) - 0.5) * 40;
    const wz = z + (fbm(x / 90, z / 90, this.seed + 23, 2) - 0.5) * 40;
    const n = fbm(wx / 70, wz / 70, this.seed, 4);
    const m = fbm(wx / 220, wz / 220, this.seed + 7, 2);
    let h = 15 + n * 6 + m * 9;
    // sinuous desert dunes (sharp crest ridges)
    if (desert > 0) {
      const dn = noise(wx / 26 + m * 3, wz / 60, this.seed + 95);
      const dune = 16 + Math.pow(1 - Math.abs(dn * 2 - 1), 2) * 11 + n * 3;
      h += (dune - h) * desert;
    }
    // rainforest: lower, lumpier valleys
    if (jungle > 0) h += (13 + n * 9 + fbm(wx / 30, wz / 30, this.seed + 97, 3) * 5 - h) * jungle;
    // mountain ranges: a continental mask gates ridged noise -> sharp crests & cliffs
    const mask = fbm(x / 340, z / 340, this.seed + 41, 2);
    const mt = Math.max(0, Math.min(1, (mask - 0.52) / 0.14)) * (1 - desert);
    if (mt > 0) {
      let rid = 0, amp = 0.5, f = 1 / 60, w = 1;
      for (let o = 0; o < 4; o++) {
        const r = 1 - Math.abs(noise(wx * f, wz * f, this.seed + 51 + o * 7) * 2 - 1);
        const s = r * r * w;
        rid += s * amp; w = Math.min(1, s * 1.6); amp *= 0.5; f *= 2.1;
      }
      h += mt * mt * (3 - 2 * mt) * rid * 46;
    }
    // rivers (deep & wet in the rainforest, dry wadis elsewhere)
    const r = Math.abs(fbm(wx / 120, wz / 120, this.seed + 31, 2) - 0.5);
    const rw = 0.04 + jungle * 0.02;
    if (r < rw && mt < 0.3) h -= (1 - r / rw) ** 2 * (3 + jungle * 5);
    // watering holes & oases
    const p = fbm(x / 55, z / 55, this.seed + 101, 3);
    if (p > 0.66 && mt < 0.2) { const t = Math.min(1, (p - 0.66) / 0.08); h -= t * t * (3 - 2 * t) * (6 + desert * 6); }
    // granite kopjes on the savanna plains
    const k = fbm(x / 22, z / 22, this.seed + 11, 3);
    const sav = 1 - Math.max(desert, jungle);
    if (k > 0.6 && mt < 0.2) { const t = Math.min(1, (k - 0.6) / 0.12); h += t * t * (3 - 2 * t) * 10 * sav; }
    return Math.max(4, Math.min(H - 6, Math.floor(h)));
  }
  isKopje(x: number, z: number) {
    return fbm(x / 22, z / 22, this.seed + 11, 3) > 0.64;
  }
  isMountain(x: number, z: number) {
    return fbm(x / 340, z / 340, this.seed + 41, 2) > 0.56;
  }

  getChunk(cx: number, cz: number) {
    const k = chunkKey(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = this.generate(cx, cz);
      this.chunks.set(k, c);
      this.tops.set(k, topOf(c));
    }
    return c;
  }

  private generate(cx: number, cz: number) {
    const c = new Uint8Array(CH * H * CH);
    // Linefield is the whole world: chunks outside its 512x512 footprint stay empty.
    this.stampLinefield(cx, cz, c);
    const le = this.edits[chunkKey(cx, cz)];
    if (le) for (const i in le) c[+i] = le[i];
    return c;
  }
  private generateLegacy(cx: number, cz: number) {
    const c = new Uint8Array(CH * H * CH);
    const heights: number[] = [];
    const biomes: number[] = []; // 0 savanna, 1 desert, 2 jungle
    for (let z = 0; z < CH; z++)
      for (let x = 0; x < CH; x++) {
        const wx = cx * CH + x, wz = cz * CH + z;
        const h = this.height(wx, wz);
        heights[z * CH + x] = h;
        const bm = this.biome(wx, wz);
        const kind = bm.desert > 0.5 ? 1 : bm.jungle > 0.5 ? 2 : 0;
        biomes[z * CH + x] = kind;
        const beach = h <= WATER_LEVEL + 1;
        const slope = Math.max(
          Math.abs(this.height(wx + 1, wz) - h), Math.abs(this.height(wx - 1, wz) - h),
          Math.abs(this.height(wx, wz + 1) - h), Math.abs(this.height(wx, wz - 1) - h),
        );
        const rock = this.kingdomDist(wx, wz) >= K_OUT && kind !== 1 && ((kind === 0 && this.isKopje(wx, wz) && !this.isMountain(wx, wz)) || slope >= 3 || h > 38 + hash2(wx, wz, this.seed + 61) * 4);
        const soil = kind === 1 ? 6 : h > 28 ? 2 : 4;
        const topId = kind === 1 || beach ? B.SAND : kind === 2 ? B.JUNGLE_GRASS : B.GRASS;
        for (let y = 0; y <= h; y++) {
          let id: number = B.STONE;
          if (y === 0) id = B.BEDROCK;
          else if (!rock && y >= h - soil) id = y === h ? topId : kind === 1 || beach ? B.SAND : B.DIRT;
          c[idx(x, y, z)] = id;
        }
        for (let y = h + 1; y <= WATER_LEVEL; y++) c[idx(x, y, z)] = B.WATER;
      }
    const put = (x: number, y: number, z: number, id: number, force = false) => {
      if (x < 0 || z < 0 || x >= CH || z >= CH || y < 1 || y >= H) return;
      const i = idx(x, y, z);
      if (force || c[i] === 0 || isPlant(c[i])) c[i] = id;
    };
    // ground cover
    for (let z = 0; z < CH; z++)
      for (let x = 0; x < CH; x++) {
        const wx = cx * CH + x, wz = cz * CH + z;
        const h = heights[z * CH + x], kind = biomes[z * CH + x];
        if (h + 3 >= H) continue;
        const top = c[idx(x, h, z)], above = c[idx(x, h + 1, z)];
        const rr = hash2(wx, wz, this.seed + 71), r2 = hash2(wx, wz, this.seed + 73);
        if (above === B.WATER) {
          // papyrus in shallow water
          if (h === WATER_LEVEL - 1 && rr < 0.45) c[idx(x, h + 1, z)] = B.REED;
          continue;
        }
        if (top === B.SAND && h <= WATER_LEVEL + 2) {
          // reeds only on banks that actually touch water
          const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => this.height(wx + dx, wz + dz) < WATER_LEVEL);
          if (wet && rr < 0.4) { c[idx(x, h + 1, z)] = B.REED; continue; }
        }
        if (top === B.GRASS && this.kingdomDist(wx, wz) <= K_HALF) {
          // inside the walls: tidy lawns, no wild grass/flowers (farms are stamped by the town)
        } else if (top === B.GRASS) {
          const meadow = fbm(wx / 28, wz / 28, this.seed + 81, 3);
          const dens = meadow > 0.55 ? 0.8 : meadow > 0.45 ? 0.25 : 0.04;
          if (rr < dens) c[idx(x, h + 1, z)] = B.TALLGRASS;
          else if (r2 < 0.05 && meadow > 0.4) c[idx(x, h + 1, z)] = B.FLOWER;
          else if (rr > 0.997 && this.kingdomDist(wx, wz) >= K_OUT) c[idx(x, h + 1, z)] = B.BOULDER;
          else if (this.kingdomDist(wx, wz) >= K_OUT && rr > 0.9955 && x > 0 && z > 0 && x < CH - 1 && z < CH - 1) {
            // termite mound: tapered red-clay spire (smoothing rounds it off)
            const mh = 2 + Math.floor(r2 * 3);
            for (let y = 1; y <= mh; y++) put(x, h + y, z, B.DIRT, true);
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, h + 1, z + dz, B.DIRT, true);
          }
        } else if (top === B.JUNGLE_GRASS) {
          if (rr < 0.35) c[idx(x, h + 1, z)] = B.FERN;
          else if (rr < 0.6) c[idx(x, h + 1, z)] = B.TALLGRASS;
          else if (rr < 0.63) c[idx(x, h + 1, z)] = B.FLOWER;
        } else if (top === B.SAND && kind === 1) {
          if (rr < 0.004) c[idx(x, h + 1, z)] = B.ALOE;
          else if (rr > 0.9985) c[idx(x, h + 1, z)] = B.BOULDER;
        } else if (top === B.STONE) {
          if (rr < 0.035) c[idx(x, h + 1, z)] = B.BOULDER;
          else if (rr < 0.07 && kind === 0) c[idx(x, h + 1, z)] = B.ALOE;
        }
      }

    const blob = (tx: number, ty: number, tz: number, rx: number, ry: number) => {
      for (let dy = -ry; dy <= ry; dy++)
        for (let dz = -rx; dz <= rx; dz++)
          for (let dx = -rx; dx <= rx; dx++)
            if ((dx * dx + dz * dz) / (rx * rx + 0.5) + (dy * dy) / (ry * ry + 0.5) <= 1) put(tx + dx, ty + dy, tz + dz, B.LEAVES);
    };
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // flora (kept inside the chunk)
    for (let z = 4; z < CH - 4; z++)
      for (let x = 4; x < CH - 4; x++) {
        const wx = cx * CH + x, wz = cz * CH + z;
        const h = heights[z * CH + x], kind = biomes[z * CH + x];
        const top = c[idx(x, h, z)];
        if (h + 14 >= H || c[idx(x, h + 1, z)] === B.WATER) continue;
        if (this.kingdomDist(wx, wz) < K_OUT + 4) continue;
        const r = hash2(wx, wz, this.seed + 3);
        const hr = hash2(wx, wz, this.seed + 5);
        // date palms around oases and shores
        const shore = h <= WATER_LEVEL + 3 && top === B.SAND;
        if ((shore && r < 0.03) || (kind === 2 && top === B.JUNGLE_GRASS && r > 0.992)) {
          const th = 5 + Math.floor(hr * 3);
          const [ldx, ldz] = DIRS[Math.floor(hash2(wx, wz, this.seed + 9) * 4)];
          let px = x, pz = z;
          for (let y = 1; y <= th; y++) {
            if (y === Math.floor(th * 0.6)) { px += ldx; pz += ldz; } // gentle lean
            put(px, h + y, pz, B.LOG, true);
          }
          const ty = h + th;
          put(px, ty + 1, pz, B.LEAVES);
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            put(px + dx, ty + 1, pz + dz, B.LEAVES);
            put(px + dx * 2, ty, pz + dz * 2, B.LEAVES);
            if (!dx || !dz) put(px + dx * 3, ty - 1, pz + dz * 3, B.LEAVES);
          }
          c[idx(x, h, z)] = top === B.SAND ? B.SAND : B.DIRT;
          continue;
        }
        if (top === B.JUNGLE_GRASS && r < 0.045) {
          // rainforest giant: tall straight trunk, buttress roots, layered round canopy
          const th = 7 + Math.floor(hr * 5);
          for (let y = 1; y <= th; y++) put(x, h + y, z, B.LOG, true);
          for (const [dx, dz] of DIRS) put(x + dx, h + 1, z + dz, B.LOG, true);
          blob(x, h + th + 1, z, 3, 2);
          const [bx, bz] = DIRS[Math.floor(hash2(wx, wz, this.seed + 9) * 4)];
          blob(x + bx * 2, h + th - 2, z + bz * 2, 2, 1);
          c[idx(x, h, z)] = B.DIRT;
          continue;
        }
        if (top !== B.GRASS) continue;
        if (r < 0.0025) {
          // Baobab: fat swollen bottle trunk, stubby branches, small tufted crowns
          const th = 7 + Math.floor(hr * 4);
          for (let y = h + 1; y <= h + th; y++) {
            const k = (y - h) / th, rad = k < 0.75 ? 1.6 : 0.9;
            for (let dz = -2; dz <= 2; dz++)
              for (let dx = -2; dx <= 2; dx++) if (dx * dx + dz * dz <= rad * rad) put(x + dx, y, z + dz, B.LOG, true);
          }
          const top2 = h + th;
          for (const [bx, bz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
            for (let s2 = 1; s2 <= 2; s2++) put(x + bx * (1 + s2), top2 + s2 - 1, z + bz * (1 + s2), B.LOG, true);
            blob(x + bx * 3, top2 + 2, z + bz * 3, 1, 1);
          }
          c[idx(x, h, z)] = B.DIRT;
        } else if (r < 0.014) {
          // Umbrella acacia: trunk forks into rising limbs, each carrying a wide flat canopy
          const th = 3 + Math.floor(hr * 2);
          for (let y = h + 1; y <= h + th; y++) put(x, y, z, B.LOG, true);
          const d0 = Math.floor(hash2(wx, wz, this.seed + 9) * 4);
          const limbs = [DIRS[d0], DIRS[d0 ^ 1]];
          if (hash2(wx, wz, this.seed + 13) > 0.6) limbs.push(DIRS[(d0 + 2) % 4]);
          const tips: number[][] = [];
          for (const [ldx, ldz] of limbs) {
            let bx = x, by = h + th, bz = z;
            for (let s2 = 0; s2 < 2; s2++) {
              bx += ldx; bz += ldz; put(bx, by, bz, B.LOG, true);
              by++; put(bx, by, bz, B.LOG, true);
            }
            tips.push([bx, by, bz]);
          }
          for (const [tx, ty, tz] of tips)
            for (let dz = -3; dz <= 3; dz++)
              for (let dx = -3; dx <= 3; dx++) {
                const d = dx * dx + dz * dz;
                if (d <= 8) put(tx + dx, ty + 1, tz + dz, B.LEAVES);
                if (d <= 3) put(tx + dx, ty + 2, tz + dz, B.LEAVES);
              }
          c[idx(x, h, z)] = B.DIRT;
        }
      }
    this.stampCity(cx, cz, c);
    this.stampLinefield(cx, cz, c);
    const e = this.edits[chunkKey(cx, cz)];
    if (e) for (const k in e) c[+k] = e[k];
    return c;
  }

  get(x: number, y: number, z: number) {
    if (y < 0) return B.BEDROCK;
    if (y >= H) return 0;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    return this.getChunk(cx, cz)[idx(x - cx * CH, y, z - cz * CH)];
  }

  set(x: number, y: number, z: number, id: number) {
    if (y < 1 || y >= H) return;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    const lx = x - cx * CH, lz = z - cz * CH;
    const k = chunkKey(cx, cz);
    const i = idx(lx, y, lz);
    this.getChunk(cx, cz)[i] = id;
    if (id && y >= (this.tops.get(k) ?? 0)) this.tops.set(k, y + 1);
    (this.edits[k] ??= {})[i] = id;
    this.bump(cx, cz);
    if (lx === 0) this.bump(cx - 1, cz);
    if (lx === CH - 1) this.bump(cx + 1, cz);
    if (lz === 0) this.bump(cx, cz - 1);
    if (lz === CH - 1) this.bump(cx, cz + 1);
  }

  /** one above the highest non-air block in a chunk */
  top(cx: number, cz: number) { this.getChunk(cx, cz); return this.tops.get(chunkKey(cx, cz)) ?? H; }
  bump(cx: number, cz: number) {
    const k = chunkKey(cx, cz);
    this.versions.set(k, (this.versions.get(k) ?? 0) + 1);
  }
  version(cx: number, cz: number) {
    return this.versions.get(chunkKey(cx, cz)) ?? 0;
  }

  surface(x: number, z: number) {
    for (let y = H - 1; y > 0; y--) { const id = this.get(x, y, z); if (id !== 0 && !isPlant(id)) return y + 1; }
    return H;
  }
  /** nearest dry, walkable column to (x,z), spiralling outward */
  findDry(x: number, z: number): [number, number, number] {
    for (let r = 0; r < 200; r += 2)
      for (let a = 0; a < Math.max(1, r * 3); a++) {
        const t = (a / Math.max(1, r * 3)) * Math.PI * 2;
        const px = Math.round(x + Math.cos(t) * r), pz = Math.round(z + Math.sin(t) * r);
        const y = this.surface(px, pz);
        const below = this.get(px, y - 1, pz);
        if (below === B.WATER || below === B.LEAVES || below === B.LOG || y <= WATER_LEVEL + 1) continue;
        if (!isPassable(this.get(px, y, pz)) || !isPassable(this.get(px, y + 1, pz))) continue;
        return [px, y, pz];
      }
    return [x, this.surface(x, z), z];
  }
}

function topOf(c: Uint8Array) {
  const L = CH * CH;
  for (let y = H - 1; y > 0; y--) { const o = y * L; for (let i = 0; i < L; i++) if (c[o + i]) return y + 1; }
  return 1;
}

// ---------- Meshing ----------
const FACES = [
  { d: [-1, 0, 0], s: 0.8, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { d: [1, 0, 0], s: 0.8, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { d: [0, -1, 0], s: 0.5, c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { d: [0, 1, 0], s: 1, c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { d: [0, 0, -1], s: 0.65, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { d: [0, 0, 1], s: 0.65, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];

const AO = [1, 0.78, 0.6, 0.45];
const LDIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const solid = (id: number) => (id !== 0 && !isTransparent(id) ? 1 : 0);

// unit rock template: icosphere (non-indexed triangles)
const ROCK = new THREE.IcosahedronGeometry(0.5, 1).getAttribute("position").array as Float32Array;

/** Smooth natural terrain: pull convex edges in, push concave corners out (watertight: depends only on lattice point). */
function smoothOffset(world: World, X: number, Y: number, Z: number, out: number[]) {
  let cnt = 0, sx = 0, sy = 0, sz = 0;
  for (let dy = -1; dy <= 0; dy++)
    for (let dz = -1; dz <= 0; dz++)
      for (let dx = -1; dx <= 0; dx++) {
        const id = world.get(X + dx, Y + dy, Z + dz);
        if (id === 0 || isPassable(id) || id === B.BOULDER || id === B.LEAVES) continue;
        if (!isNatural(id)) { out[0] = out[1] = out[2] = 0; return; }
        cnt++; sx += dx + 0.5; sy += dy + 0.5; sz += dz + 0.5;
      }
  if (cnt === 0 || cnt === 8 || cnt === 4) { out[0] = out[1] = out[2] = 0; return; }
  const k = ((4 - cnt) / 4) / cnt * 0.85;
  out[0] = sx * k; out[1] = sy * k; out[2] = sz * k;
}

/** Organic tree shapes: round off logs and leaf clumps using only same-kind neighbours. */
function treeOffset(world: World, X: number, Y: number, Z: number, id: number, out: number[]) {
  let cnt = 0, sx = 0, sy = 0, sz = 0;
  for (let dy = -1; dy <= 0; dy++)
    for (let dz = -1; dz <= 0; dz++)
      for (let dx = -1; dx <= 0; dx++) {
        const n = world.get(X + dx, Y + dy, Z + dz);
        if (n !== id) continue;
        cnt++; sx += dx + 0.5; sy += dy + 0.5; sz += dz + 0.5;
      }
  if (cnt === 0 || cnt === 8) { out[0] = out[1] = out[2] = 0; return; }
  // logs: round horizontally only so trunks stay connected vertically
  const k = ((4 - cnt) / 4) / cnt * (id === B.LOG ? 0.6 : 0.9);
  out[0] = sx * k; out[1] = id === B.LOG ? 0 : sy * k; out[2] = sz * k;
  if (id === B.LEAVES) {
    const q = X * 73856093 ^ Y * 19349663 ^ Z * 83492791;
    out[0] += (hash2(q, 1, 3) - 0.5) * 0.35; out[1] += (hash2(q, 2, 3) - 0.5) * 0.35; out[2] += (hash2(q, 3, 3) - 0.5) * 0.35;
  }
}

/** Linefield de-voxelization: chamfer convex building corners and collapse 1-block staircases
 * into continuous diagonals/curves. Horizontal only so floors and roofs stay level; depends only
 * on the lattice point, so neighbouring faces stay watertight. */
const isCity = (id: number) => id !== 0 && id !== B.BEDROCK;
function cityOffset(world: World, X: number, Y: number, Z: number, out: number[]) {
  out[0] = out[1] = out[2] = 0;
  const inLF = X >= LF_X0 && X <= LF_X0 + LF_SIZE && Z >= LF_Z0 && Z <= LF_Z0 + LF_SIZE && Y > LF_GROUND;
  const inMetro = !inLF && Math.abs(X - M_CX) <= C_R + 1 && Math.abs(Z - M_CZ) <= C_R + 1 && Y > world.cityGround() + 1;
  if (!inLF && !inMetro) return;
  let cnt = 0, sx = 0, sy = 0, sz = 0;
  for (let dy = -1; dy <= 0; dy++)
    for (let dz = -1; dz <= 0; dz++)
      for (let dx = -1; dx <= 0; dx++) {
        const id = world.get(X + dx, Y + dy, Z + dz);
        if (id === 0 || isPassable(id)) continue;
        if (!isCity(id)) return;
        cnt++; sx += dx + 0.5; sy += dy + 0.5; sz += dz + 0.5;
      }
  if (cnt === 0 || cnt === 8 || cnt === 4) return;
  const k = ((4 - cnt) / 4) / cnt * 1.3;
  out[0] = sx * k; out[2] = sz * k;
  // beveled rooflines/sills: small vertical chamfer on exposed top/bottom edges
  if (cnt <= 2) out[1] = sy * 0.22;
}

/** Feature-preserving normals for Linefield faces: average with coincident vertices whose
 * normals are within 35deg, so chamfered/curved facades shade smoothly but real corners stay crisp. */
let scratchN = new Float32Array(0);
const nGroups = new Map<number, number[]>();
function smoothCityNormals(g: THREE.BufferGeometry, verts: number[], ox: number, oz: number) {
  if (!verts.length) return;
  const P = g.getAttribute("position").array as Float32Array;
  const N = g.getAttribute("normal").array as Float32Array;
  const groups = nGroups;
  groups.clear();
  // numeric key from chunk-local, 1/64-quantized position (x,z within ~[-4,20], y within [0,400])
  for (const v of verts) {
    const kx = Math.round((P[v * 3] - ox + 8) * 64), ky = Math.round(P[v * 3 + 1] * 64), kz = Math.round((P[v * 3 + 2] - oz + 8) * 64);
    const k = (ky * 4096 + kx) * 4096 + kz;
    const a = groups.get(k); if (a) a.push(v); else groups.set(k, [v]);
  }
  const C = Math.cos((55 * Math.PI) / 180);
  if (scratchN.length < verts.length * 3) scratchN = new Float32Array(verts.length * 3 * 2);
  const out = scratchN;
  for (const list of groups.values()) {
    const n = list.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const a = list[i] * 3;
      const ax = N[a], ay = N[a + 1], az = N[a + 2];
      let x = 0, y = 0, z = 0;
      for (let j = 0; j < n; j++) {
        const b = list[j] * 3;
        const bx = N[b], by = N[b + 1], bz = N[b + 2];
        if (ax * bx + ay * by + az * bz >= C) { x += bx; y += by; z += bz; }
      }
      const l = Math.sqrt(x * x + y * y + z * z) || 1;
      out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
    }
    for (let i = 0; i < n; i++) { const a = list[i] * 3; N[a] = out[i * 3]; N[a + 1] = out[i * 3 + 1]; N[a + 2] = out[i * 3 + 2]; }
  }
  groups.clear();
  g.getAttribute("normal").needsUpdate = true;
}

/** City PBR material class for the chunk shader: 0 none, 1 glass, 2 metal/panel, 3 asphalt, 4 neon, 5 road paint.
 * Applies only to the cyberpunk palette and to modern blocks inside the Linefield bounds. */
/** Glass/lantern/bar blocks used as railings, curbs and panes in the imported map. */
const BARRIER_IDS = new Set<number>([B.TINT_GLASS, B.GLASS_CYAN, B.GLASS_MAGENTA, B.GLASS_GREEN, B.SEA_LANTERN, B.GLOWSTONE, B.IRON_BARS, B.GLASS, B.NEON_ROD, B.NEON_MAGENTA]);
const isNeonId = (id: number) => id === B.NEON_ROD || id === B.NEON_MAGENTA;
const isBarrierId = (id: number) => BARRIER_IDS.has(id);
const BAR_T = 0.14;
const openCell = (id: number) => id === 0 || isPassable(id);
/** 1 = thin along x (run follows z), 2 = thin along z, 0 = keep full block (part of a wall/floor). */
function barrierAxis(world: World, x: number, y: number, z: number, id: number) {
  const ox = openCell(world.get(x - 1, y, z)) && openCell(world.get(x + 1, y, z));
  const oz = openCell(world.get(x, y, z - 1)) && openCell(world.get(x, y, z + 1));
  if (ox && !oz) return 1;
  if (oz && !ox) return 2;
  if (ox && oz) {
    // free-standing post: thin across the axis that has barrier neighbours above/below continuation
    const up = world.get(x, y + 1, z), dn = world.get(x, y - 1, z);
    if (isNeonId(id)) return 3; // free-standing light: slim cantilevered pylon
    if (openCell(up) || openCell(dn) || up === id || dn === id) return 1;
  }
  if (isNeonId(id)) return openCell(world.get(x, y + 1, z)) ? 4 : 3; // flush lumiline strip on surfaces
  return 0;
}
function cityMat(id: number, wx: number, wz: number) {
  if (id >= 32 && id <= 54) {
    if (id === B.TINT_GLASS || id === B.GLASS_CYAN || id === B.GLASS_MAGENTA || id === B.GLASS_GREEN) return 1;
    if (id === B.SEA_LANTERN || id === B.GLOWSTONE || id === B.NEON_ROD || id === B.NEON_MAGENTA) return 4;
    return 2;
  }
  const inMetro = Math.abs(wx - M_CX) <= C_R && Math.abs(wz - M_CZ) <= C_R;
  if (!inMetro && (wx < LF_X0 || wx >= LF_X0 + LF_SIZE || wz < LF_Z0 || wz >= LF_Z0 + LF_SIZE)) return 0;
  if (id === B.OFFICE_WINDOW || id === B.GLASS || id === B.WATER) return 1;
  if (id === B.ASPHALT) return 3;
  if (id === B.ROAD_LINE) return 5;
  if (id === B.LANTERN) return 4;
  return 2;
}

export function buildChunkGeometry(world: World, cx: number, cz: number) {
  const chunk = world.getChunk(cx, cz);
  const pos: number[] = [], uv: number[] = [], col: number[] = [], ind: number[] = [], wind: number[] = [];
  const ox = cx * CH, oz = cz * CH;
  const eps = 0.001;
  const off = [0, 0, 0];
  // block light: flood-fill from lanterns through open cells (radius LMAX)
  const R = 8, SX = CH + 2 * R, LMAX = 8;
  const nb: Uint8Array[] = [];
  let YT = 2;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { nb.push(world.getChunk(cx + dx, cz + dz)); YT = Math.max(YT, world.top(cx + dx, cz + dz) + 1); }
  YT = Math.min(H, YT);
  const cellId = (rx: number, y: number, rz: number) => {
    const lx = rx - R, lz = rz - R;
    const ax = lx < 0 ? -1 : lx >= CH ? 1 : 0, az = lz < 0 ? -1 : lz >= CH ? 1 : 0;
    return nb[(az + 1) * 3 + ax + 1][idx(lx - ax * CH, y, lz - az * CH)];
  };
  const light = new Uint8Array(SX * SX * YT);
  const q = new Int32Array(SX * SX * YT);
  let qh = 0, qt = 0;
  for (let y = 1; y < YT; y++) for (let rz = 0; rz < SX; rz++) for (let rx = 0; rx < SX; rx++)
    if (isEmissive(cellId(rx, y, rz))) { const i = (y * SX + rz) * SX + rx; light[i] = LMAX; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], l = light[i];
    if (l <= 1) continue;
    const rx = i % SX, rz = ((i / SX) | 0) % SX, y = (i / (SX * SX)) | 0;
    for (const [dx, dy, dz] of LDIRS) {
      const nx = rx + dx, ny = y + dy, nz = rz + dz;
      if (nx < 0 || nz < 0 || nx >= SX || nz >= SX || ny < 1 || ny >= YT) continue;
      const j = (ny * SX + nz) * SX + nx;
      if (light[j] >= l - 1) continue;
      const nid = cellId(nx, ny, nz);
      if (!isTransparent(nid) || isEmissive(nid)) continue;
      light[j] = l - 1; q[qt++] = j;
    }
  }
  const blkAt = (lx: number, y: number, lz: number) => {
    if (y < 0 || y >= YT) return 0;
    const v = light[(y * SX + lz + R) * SX + lx + R];
    return v ? Math.pow(v / LMAX, 1.5) : 0;
  };
  const blk: number[] = [];
  const cm: number[] = []; // per-vertex city material class + local face uv
  const cityV: number[] = [];
  const tileUV = (tile: number, u: number, v: number) => {
    const tc = tile % ATLAS_COLS, tr = Math.floor(tile / ATLAS_COLS);
    u = Math.min(1 - eps, Math.max(eps, u)); v = Math.min(1 - eps, Math.max(eps, v));
    uv.push((tc + u) / ATLAS_COLS, 1 - (tr + 1 - v) / ATLAS_COLS);
  };
  const ownTop = world.top(cx, cz);
  for (let y = 0; y < ownTop; y++)
    for (let z = 0; z < CH; z++)
      for (let x = 0; x < CH; x++) {
        const id = chunk[idx(x, y, z)];
        if (!id) continue;
        const def = BLOCKS[id];
        const wx = ox + x, wz = oz + z;
        if (isPlant(id)) {
          // two crossed double-sided blades
          const ptile = def.tiles[0];
          const j = (hash2(wx, wz, 5) - 0.5) * 0.3, j2 = (hash2(wx, wz, 9) - 0.5) * 0.3;
          const hBase = id === B.REED ? 1.4 : id === B.FLOWER ? 0.6 : id === B.ALOE ? 0.7 : id === B.FERN ? 0.85 : 0.8;
          const sc = hBase + hash2(wx, wz, 13) * (id === B.REED ? 0.6 : 0.4);
          const quads = [[[0.1, 0.1], [0.9, 0.9]], [[0.1, 0.9], [0.9, 0.1]]];
          for (const [[ax, az], [bx, bz]] of quads) {
            for (let side = 0; side < 2; side++) {
              // separate vertices per side so normals don't cancel out (dark blades)
              const base = pos.length / 3;
              pos.push(wx + ax + j, y, wz + az + j2, wx + bx + j, y, wz + bz + j2, wx + ax + j, y + sc, wz + az + j2, wx + bx + j, y + sc, wz + bz + j2);
              tileUV(ptile, 0, 0); tileUV(ptile, 1, 0); tileUV(ptile, 0, 1); tileUV(ptile, 1, 1);
              for (const l of [0.75, 0.75, 1.1, 1.1]) { col.push(l, l, l); blk.push(blkAt(x, y, z)); cm.push(0, 0, 0); }
              if (side) ind.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
              else ind.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            }
          }
          continue;
        }
        if (id === B.BOULDER) {
          const s = 0.75 + hash2(wx, wz + y, 17) * 0.4, sy = 0.6 + hash2(wx, wz, 19) * 0.3;
          const rot = hash2(wx, wz, 23) * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot);
          const base = pos.length / 3;
          for (let i = 0; i < ROCK.length; i += 3) {
            const px = ROCK[i], py = ROCK[i + 1], pz = ROCK[i + 2];
            const q = Math.round(px * 97) * 7 + Math.round(py * 97) * 131 + Math.round(pz * 97) * 977;
            const d = 0.8 + hash2(q, wx * 31 + wz, y) * 0.4;
            const rx = (px * cr - pz * sr) * d * s, rz = (px * sr + pz * cr) * d * s, ry = py * d * sy;
            pos.push(wx + 0.5 + rx, y + Math.max(-0.05, ry + sy * 0.4), wz + 0.5 + rz);
            tileUV(3, rx + 0.5, ry + rz + 0.5);
            const l = 0.75 + 0.25 * (py + 0.5);
            col.push(l, l, l); blk.push(blkAt(x, y, z)); cm.push(0, 0, 0);
            ind.push(base + i / 3);
          }
          continue;
        }
        const nat = isNatural(id);
        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          const nx = x + F.d[0], ny = y + F.d[1], nz = z + F.d[2];
          const n =
            nx >= 0 && nx < CH && nz >= 0 && nz < CH
              ? ny < 0 ? 1 : ny >= H ? 0 : chunk[idx(nx, ny, nz)]
              : world.get(ox + nx, ny, oz + nz);
          if (!(isTransparent(n) && n !== id)) continue;
          const tile = f === 3 ? def.tiles[0] : f === 2 ? def.tiles[2] : def.tiles[1];
          const tc = tile % ATLAS_COLS, tr = Math.floor(tile / ATLAS_COLS);
          const base = pos.length / 3;
          const ao: number[] = [];
          for (const c of F.c) {
            // vertex ambient occlusion: sample the 3 neighbours around this corner on the face's outer side
            const sx = c[0] * 2 - 1, sy = c[1] * 2 - 1, sz = c[2] * 2 - 1;
            const ax = F.d[0] ? 0 : sx, ay = F.d[1] ? 0 : sy, az = F.d[2] ? 0 : sz;
            const bx = ox + nx, by = ny, bz = oz + nz;
            // two tangent axes
            const t1 = F.d[0] ? [0, ay, 0] : [ax, 0, 0];
            const t2 = F.d[2] ? [0, ay, 0] : [0, 0, az];
            const s1 = solid(world.get(bx + t1[0], by + t1[1], bz + t1[2]));
            const s2 = solid(world.get(bx + t2[0], by + t2[1], bz + t2[2]));
            const sc = solid(world.get(bx + t1[0] + t2[0], by + t1[1] + t2[1], bz + t1[2] + t2[2]));
            const occ = s1 && s2 ? 3 : s1 + s2 + sc;
            ao.push(AO[occ]);
          }
          let k = 0;
          const fb = blkAt(nx, ny, nz);
          const isWater = id === B.WATER;
          const sink = isWater && (y + 1 >= H || world.get(wx, y + 1, wz) !== B.WATER) ? 0.12 : 0;
          const tree = id === B.LOG || id === B.LEAVES;
          const city = !nat && !tree && isCity(id);
          const bar = isBarrierId(id) ? barrierAxis(world, wx, y, wz, id) : 0;
          const mc = bar ? 6 : cityMat(id, wx, wz);
          for (const c of F.c) {
            const X = ox + x + c[0], Y = y + c[1], Z = oz + z + c[2];
            if (bar) {
              // hardlight barrier: collapse the cube into a thin continuous energy ribbon
              off[0] = bar === 1 || bar === 3 ? (0.5 - c[0]) * (1 - BAR_T) : 0;
              off[2] = bar === 2 || bar === 3 ? (0.5 - c[2]) * (1 - BAR_T) : 0;
              off[1] = bar === 4 ? (c[1] ? -(1 - 0.08) : 0) : 0;
            }
            else if (nat) smoothOffset(world, X, Y, Z, off);
            else if (tree) treeOffset(world, X, Y, Z, id, off);
            else if (city && !isBarrierId(id) && !isEmissive(id)) { cityOffset(world, X, Y, Z, off); cityV.push(pos.length / 3); }
            else off[0] = off[1] = off[2] = 0;
            pos.push(X + off[0], Y + off[1] - (c[1] ? sink : 0), Z + off[2]);
            const u = (tc + (c[3] ? 1 - eps : eps)) / ATLAS_COLS;
            const v = 1 - (tr + 1 - (c[4] ? 1 - eps : eps)) / ATLAS_COLS;
            uv.push(u, v);
            cm.push(mc, c[3], c[4]);
            // foliage scatters light through itself, so its undersides never go pitch black
            const l = isWater ? 1 : id === B.LEAVES ? 0.9 + 0.1 * F.s * ao[k++] + 0.25 : (0.82 + 0.18 * F.s) * ao[k++];
            col.push(l, l, l);
            blk.push(isEmissive(id) ? 1.8 : fb);
          }
          const out = isWater ? wind : ind;
          // flip quad diagonal to avoid anisotropic AO artifacts
          if (!isWater && ao[0] + ao[3] < ao[1] + ao[2]) out.push(base, base + 1, base + 3, base, base + 3, base + 2);
          else out.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("blk", new THREE.Float32BufferAttribute(blk, 1));
  g.setAttribute("cmat", new THREE.Float32BufferAttribute(cm, 3));
  g.setIndex(ind.concat(wind));
  g.addGroup(0, ind.length, 0);
  g.addGroup(ind.length, wind.length, 1);
  g.computeVertexNormals();
  smoothCityNormals(g, cityV, ox, oz);
  g.computeBoundingSphere();
  return g;
}

// ---------- Physics helpers ----------
export function collides(world: World, p: THREE.Vector3, hw: number, h: number) {
  const e = 0.001;
  for (let x = Math.floor(p.x - hw + e); x <= Math.floor(p.x + hw - e); x++)
    for (let y = Math.floor(p.y + e); y <= Math.floor(p.y + h - e); y++)
      for (let z = Math.floor(p.z - hw + e); z <= Math.floor(p.z + hw - e); z++)
      {
        const id = world.get(x, y, z);
        if (isPassable(id)) continue;
        const bar = isBarrierId(id) ? barrierAxis(world, x, y, z, id) : 0;
        if (!bar) return true;
        // thin barrier/strip: test against its real slim box
        const tx = bar === 1 || bar === 3 ? BAR_T / 2 : 0.5, tz = bar === 2 || bar === 3 ? BAR_T / 2 : 0.5;
        const ty = bar === 4 ? 0.08 : 1;
        if (p.x + hw > x + 0.5 - tx && p.x - hw < x + 0.5 + tx && p.z + hw > z + 0.5 - tz && p.z - hw < z + 0.5 + tz && p.y < y + ty && p.y + h > y) return true;
      }
  return propHit(p.x - hw, p.y, p.z - hw, p.x + hw, p.y + h, p.z + hw);
}

export function moveEntity(world: World, p: THREE.Vector3, v: THREE.Vector3, dt: number, hw: number, h: number, canStep = false) {
  let onGround = false, hitWall = false, stepped = 0;
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt) / 0.2));
  const sdt = dt / steps;
  // grounded check before moving, so step-up only happens while walking
  p.y -= 0.05;
  const grounded = collides(world, p, hw, h);
  p.y += 0.05;
  // Linefield edges are the map boundary
  const clampB = () => {
    p.x = Math.max(LF_X0 + hw, Math.min(LF_X0 + LF_SIZE - hw, p.x));
    p.z = Math.max(LF_Z0 + hw, Math.min(LF_Z0 + LF_SIZE - hw, p.z));
  };
  clampB();
  for (let s = 0; s < steps; s++, clampB())
    for (const a of ["x", "y", "z"] as const) {
      const d = v[a] * sdt;
      if (!d) continue;
      p[a] += d;
      if (collides(world, p, hw, h)) {
        if (a !== "y" && canStep && grounded) {
          // auto step-up onto a single block ledge
          const oy = p.y;
          p.y = Math.floor(p.y + 0.001) + 1.001;
          if (p.y - oy <= 1.05 && !collides(world, p, hw, h)) { stepped += p.y - oy; continue; }
          p.y = oy;
        }
        p[a] -= d;
        if (a === "y") {
          if (v.y < 0) onGround = true;
        } else hitWall = true;
        v[a] = 0;
      }
    }
  if (stepped) onGround = true;
  return { onGround, hitWall, stepped };
}

export function raycast(world: World, o: THREE.Vector3, d: THREE.Vector3, max: number) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tx = sx > 0 ? (x + 1 - o.x) * tdx : sx < 0 ? (o.x - x) * tdx : Infinity;
  let ty = sy > 0 ? (y + 1 - o.y) * tdy : sy < 0 ? (o.y - y) * tdy : Infinity;
  let tz = sz > 0 ? (z + 1 - o.z) * tdz : sz < 0 ? (o.z - z) * tdz : Infinity;
  let prev: [number, number, number] = [x, y, z];
  let t = 0;
  while (t <= max) {
    const id = world.get(x, y, z);
    if (id !== 0 && id !== B.WATER) return { pos: [x, y, z] as [number, number, number], prev, id, dist: t };
    prev = [x, y, z];
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; }
    else { z += sz; t = tz; tz += tdz; }
  }
  return null;
}
