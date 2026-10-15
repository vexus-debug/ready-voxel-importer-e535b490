// @ts-nocheck
// Modelled architecture for the Utopia city. The voxel map is only the layout/collision outline:
// every tile is re-surfaced as smooth, contour-interpolated walls (marching squares on a softened
// occupancy field, merged vertically into tall facades with gradient normals) plus flat cut caps
// for roofs, floors, roads and undersides. Must not import world.ts (it imports linefield only).
import * as THREE from "three";
import { LF_SIZE, LF_TS, LF_YN, LF_X0, LF_Z0, lfColumn } from "./linefield";

const P = 2; // padding cells around a tile
const W = LF_TS + P * 2;

// material class: 0 concrete/panel, 1 glass, 2 metal, 3 emissive, 4 water, 5 greenery
const PAL: Record<number, [string, number]> = {
  1: ["#5f9a4e", 5], 2: ["#7b6a58", 0], 3: ["#9aa1aa", 0], 4: ["#6e5a44", 0], 5: ["#4f8a46", 5], 6: ["#d8cfb0", 0],
  7: ["#a88a64", 0], 8: ["#8d939b", 0], 9: ["#a8665a", 0], 10: ["#9fd4ff", 1], 11: ["#3a3d44", 0], 14: ["#3d8fd6", 4],
  20: ["#a3a9b2", 0], 25: ["#e9e6df", 0], 27: ["#2f3238", 0], 28: ["#c9ccd2", 0], 29: ["#7fb6e6", 1], 30: ["#8e98a6", 2],
  31: ["#f1f1f1", 0], 32: ["#2b3038", 0], 33: ["#8a919c", 0], 34: ["#eef0f3", 0], 35: ["#4fb9c9", 0], 36: ["#2f6670", 0],
  37: ["#3f7f86", 0], 38: ["#b8483f", 0], 39: ["#d9853b", 0], 40: ["#e6c24a", 0], 41: ["#6e9a4a", 5], 42: ["#3f63b0", 0],
  43: ["#7b4fa8", 0], 44: ["#3c4652", 1], 45: ["#6fe0f0", 1], 46: ["#e070d0", 1], 47: ["#a7b0bb", 2], 48: ["#d9fbff", 3],
  49: ["#ffd98a", 3], 50: ["#7ff6ff", 3], 51: ["#ff6fd8", 3], 52: ["#b5bec9", 2], 53: ["#7fe0a0", 1], 54: ["#7a5a42", 0],
};
const COL = new Float32Array(256 * 3), CLS = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const [hex, c] = PAL[i] || ["#b9bec6", 0];
  const k = new THREE.Color(hex); // sRGB hex -> linear working space
  COL[i * 3] = k.r; COL[i * 3 + 1] = k.g; COL[i * 3 + 2] = k.b; CLS[i] = c;
}

class Buf {
  p: number[] = []; n: number[] = []; c: number[] = []; m: number[] = [];
  v(x, y, z, nx, ny, nz, id) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz);
    this.c.push(COL[id * 3], COL[id * 3 + 1], COL[id * 3 + 2]); this.m.push(CLS[id]);
  }
  geo() {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute("cls", new THREE.Float32BufferAttribute(this.m, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Builds the smooth architecture of tile (tx,tz) in world space; null if empty. */
export function buildArchTile(tx: number, tz: number): THREE.BufferGeometry | null {
  const u0 = tx * LF_TS - P, v0 = tz * LF_TS - P;
  const S = new Uint8Array(W * W * LF_YN); // solid ids, idx = (y*W + j)*W + i
  let ymin = LF_YN, ymax = -1;
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const u = u0 + i, v = v0 + j;
      if (u < 0 || v < 0 || u >= LF_SIZE || v >= LF_SIZE) continue;
      lfColumn(u, v, (y, id) => {
        if (y < 0 || y >= LF_YN) return;
        S[(y * W + j) * W + i] = id;
        if (i >= P && i < W - P && j >= P && j < W - P) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
      });
    }
  if (ymax < 0) return null;
  const y0 = Math.max(0, ymin - 1), y1 = Math.min(LF_YN - 1, ymax + 1);
  // softened occupancy: 0.6 * raw + 0.4 * 3x3 mean -> rounded corners, 1-wide features survive
  const F = new Float32Array(W * W * LF_YN);
  for (let y = y0; y <= y1; y++)
    for (let j = 1; j < W - 1; j++)
      for (let i = 1; i < W - 1; i++) {
        const b = y * W * W;
        let s = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (S[b + (j + dj) * W + i + di]) s++;
        F[b + j * W + i] = (S[b + j * W + i] ? 0.6 : 0) + 0.4 * (s / 9);
      }
  const f = (i, j, y) => (y < 0 || y >= LF_YN ? 0 : F[(y * W + j) * W + i]);
  const sid = (i, j, y) => (y < 0 || y >= LF_YN ? 0 : S[(y * W + j) * W + i]);
  const out = new Buf();
  const wx = (i) => LF_X0 + u0 + i + 0.5, wz = (j) => LF_Z0 + v0 + j + 0.5;
  const ISO = 0.5;
  // corner order: 0(i,j) 1(i+1,j) 2(i+1,j+1) 3(i,j+1)
  const CI = [0, 1, 1, 0], CJ = [0, 0, 1, 1];
  const val = [0, 0, 0, 0];
  const pickId = (i, j, y) => {
    for (let k = 0; k < 4; k++) { const id = sid(i + CI[k], j + CJ[k], y); if (id) return id; }
    return 3;
  };
  const grad = (i, j, y) => [f(i + 1, j, y) - f(i - 1, j, y), f(i, j + 1, y) - f(i, j - 1, y)];

  // ---------- walls: per square, run-length merged along y ----------
  for (let j = P - 1; j < P - 1 + LF_TS + 1 && j < W - 2; j++)
    for (let i = P - 1; i < P - 1 + LF_TS + 1 && i < W - 2; i++) {
      // only squares whose lower-left centre belongs to this tile -> seamless partition
      if (i < P || j < P || i >= P + LF_TS || j >= P + LF_TS) continue;
      let runKey = "", runY = 0, runSegs = null, runId = 0;
      const flush = (yEnd) => {
        if (!runSegs) return;
        for (const s of runSegs) {
          const [ax, az, bx, bz, anx, anz, bnx, bnz] = s;
          out.v(ax, runY, az, anx, 0, anz, runId); out.v(bx, runY, bz, bnx, 0, bnz, runId); out.v(bx, yEnd, bz, bnx, 0, bnz, runId);
          out.v(ax, runY, az, anx, 0, anz, runId); out.v(bx, yEnd, bz, bnx, 0, bnz, runId); out.v(ax, yEnd, az, anx, 0, anz, runId);
        }
        runSegs = null; runKey = "";
      };
      for (let y = y0; y <= y1 + 1; y++) {
        let cs = 0;
        for (let k = 0; k < 4; k++) { val[k] = f(i + CI[k], j + CJ[k], y); if (val[k] >= ISO) cs |= 1 << k; }
        if (cs === 0 || cs === 15 || y > y1) { flush(y); continue; }
        const id = pickId(i, j, y);
        const key = cs + ":" + val.map((x) => (x * 20) | 0).join(",") + ":" + CLS[id];
        if (key === runKey) continue;
        flush(y);
        // edge crossings between consecutive corners
        const pts = [];
        for (let k = 0; k < 4; k++) {
          const a = k, b = (k + 1) & 3;
          if ((val[a] >= ISO) === (val[b] >= ISO)) continue;
          const t = (ISO - val[a]) / (val[b] - val[a]);
          const ii = i + CI[a] + (CI[b] - CI[a]) * t, jj = j + CJ[a] + (CJ[b] - CJ[a]) * t;
          const ga = grad(i + CI[a], j + CJ[a], y), gb = grad(i + CI[b], j + CJ[b], y);
          let nx = -(ga[0] + (gb[0] - ga[0]) * t), nz = -(ga[1] + (gb[1] - ga[1]) * t);
          const l = Math.hypot(nx, nz) || 1;
          pts.push([ii, jj, nx / l, nz / l, a]);
        }
        const segs = [];
        const mk = (p, q) => {
          // orient so (b - a) x up gives outward normal: outward = -grad
          let A = p, Bp = q;
          const dx = q[0] - p[0], dz = q[1] - p[1];
          const mnx = (p[2] + q[2]) / 2, mnz = (p[3] + q[3]) / 2;
          if (dz * mnx - dx * mnz > 0) { A = q; Bp = p; }
          segs.push([wx(A[0]), wz(A[1]), wx(Bp[0]), wz(Bp[1]), A[2], A[3], Bp[2], Bp[3]]);
        };
        if (pts.length === 2) mk(pts[0], pts[1]);
        else if (pts.length === 4) {
          const c = (val[0] + val[1] + val[2] + val[3]) / 4 >= ISO;
          // pts ordered by edge 0..3; pair so the centre decides the saddle
          const inside0 = val[0] >= ISO;
          if (inside0 === c) { mk(pts[0], pts[1]); mk(pts[2], pts[3]); } else { mk(pts[3], pts[0]); mk(pts[1], pts[2]); }
        }
        runKey = key; runY = y; runSegs = segs; runId = id;
      }
    }

  // ---------- caps: roofs (up) and soffits (down) ----------
  const poly = [];
  for (let y = y0; y <= y1 + 1; y++) {
    for (const up of [true, false]) {
      const ya = up ? y - 1 : y, yb = up ? y : y - 1; // cap between band ya (solid) and yb (empty)
      if (ya < y0 || ya > y1) continue;
      const g = (i, j) => Math.min(f(i, j, ya), 1 - f(i, j, yb));
      const ny = up ? 1 : -1;
      for (let j = P; j < P + LF_TS; j++) {
        let runStart = -1, runId = 0;
        const flushRow = (iEnd) => {
          if (runStart < 0) return;
          const xa = wx(runStart), xb = wx(iEnd), za = wz(j), zb = wz(j + 1);
          if (up) { out.v(xa, y, za, 0, 1, 0, runId); out.v(xa, y, zb, 0, 1, 0, runId); out.v(xb, y, zb, 0, 1, 0, runId); out.v(xa, y, za, 0, 1, 0, runId); out.v(xb, y, zb, 0, 1, 0, runId); out.v(xb, y, za, 0, 1, 0, runId); }
          else { out.v(xa, y, za, 0, -1, 0, runId); out.v(xb, y, zb, 0, -1, 0, runId); out.v(xa, y, zb, 0, -1, 0, runId); out.v(xa, y, za, 0, -1, 0, runId); out.v(xb, y, za, 0, -1, 0, runId); out.v(xb, y, zb, 0, -1, 0, runId); }
          runStart = -1;
        };
        for (let i = P; i < P + LF_TS; i++) {
          let cs = 0;
          for (let k = 0; k < 4; k++) { val[k] = g(i + CI[k], j + CJ[k]); if (val[k] >= ISO) cs |= 1 << k; }
          if (cs === 15) {
            const id = pickId(i, j, ya);
            if (runStart >= 0 && id !== runId) flushRow(i);
            if (runStart < 0) { runStart = i; runId = id; }
            continue;
          }
          flushRow(i);
          if (cs === 0) continue;
          poly.length = 0;
          for (let k = 0; k < 4; k++) {
            const a = k, b = (k + 1) & 3;
            if (val[a] >= ISO) poly.push(i + CI[a], j + CJ[a]);
            if ((val[a] >= ISO) !== (val[b] >= ISO)) {
              const t = (ISO - val[a]) / (val[b] - val[a]);
              poly.push(i + CI[a] + (CI[b] - CI[a]) * t, j + CJ[a] + (CJ[b] - CJ[a]) * t);
            }
          }
          const id = pickId(i, j, ya);
          for (let k = 1, n = poly.length / 2; k < n - 1; k++) {
            const a = [poly[0], poly[1]], b = [poly[2 * k], poly[2 * k + 1]], c = [poly[2 * k + 2], poly[2 * k + 3]];
            if (up) { out.v(wx(a[0]), y, wz(a[1]), 0, ny, 0, id); out.v(wx(c[0]), y, wz(c[1]), 0, ny, 0, id); out.v(wx(b[0]), y, wz(b[1]), 0, ny, 0, id); }
            else { out.v(wx(a[0]), y, wz(a[1]), 0, ny, 0, id); out.v(wx(b[0]), y, wz(b[1]), 0, ny, 0, id); out.v(wx(c[0]), y, wz(c[1]), 0, ny, 0, id); }
          }
        }
        flushRow(P + LF_TS);
      }
    }
  }
  return out.geo();
}

/** Architectural surface material: smooth PBR body, glazing with mullions + lit windows, brushed metal, emissive trims. */
export function makeArchMaterial(uDay: { value: number }) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uDay = uDay;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float cls; varying float vCls; varying vec3 vW; varying vec3 vN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCls = cls; vW = (modelMatrix * vec4(position,1.0)).xyz; vN = normal;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uDay;
#define uNight (1.0 - uDay) varying float vCls; varying vec3 vW; varying vec3 vN;
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
float cls = floor(vCls + 0.5);
bool wall = abs(vN.y) < 0.5;
float along = abs(vN.x) > abs(vN.z) ? vW.z : vW.x;
vec3 emis = vec3(0.0);
float rough = 0.6, metal = 0.1;
if (cls == 1.0) { // glazing
  float fl = fract(vW.y / 3.0), mu = fract(along / 2.0);
  float frame = step(fl, 0.06) + step(mu, 0.04);
  diffuseColor.rgb = mix(diffuseColor.rgb * 0.55, vec3(0.08,0.1,0.13), clamp(frame,0.0,1.0));
  vec2 cell = floor(vec2(along / 2.0, vW.y / 3.0));
  float lit = step(0.55, h21(cell)) * (1.0 - clamp(frame,0.0,1.0));
  emis += vec3(1.0,0.82,0.55) * lit * uNight * 0.9;
  rough = 0.08; metal = 0.6;
} else if (cls == 2.0) { rough = 0.28; metal = 0.85; }
else if (cls == 3.0) { emis += diffuseColor.rgb * (0.7 + 0.6 * uNight); rough = 0.4; }
else if (cls == 4.0) { rough = 0.05; metal = 0.3; }
else if (cls == 5.0) { rough = 0.9; diffuseColor.rgb *= 0.9 + 0.2 * h21(floor(vW.xz)); }
else {
  // architectural panels: large 4m modules with thin recessed joints, floor bands on facades
  vec2 q = wall ? vec2(along / 4.0, vW.y / 3.0) : vW.xz / 4.0;
  vec2 e = abs(fract(q) - 0.5);
  float joint = smoothstep(0.485, 0.5, max(e.x, e.y));
  diffuseColor.rgb *= 1.0 - 0.18 * joint;
  if (wall) { float band = step(fract(vW.y / 3.0), 0.05); emis += vec3(0.5,0.9,1.0) * band * uNight * 0.15 * step(0.7, h21(floor(vec2(along/12.0, vW.y/3.0)))); }
  rough = 0.5; metal = 0.12;
}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = rough;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = metal;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += emis;");
  };
  return m;
}

export const ARCH_TILES = LF_SIZE / LF_TS;
