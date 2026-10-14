// @ts-nocheck
// Procedural kingdom town: streets, districts and buildings inside the wall.
// Built once into a local grid (u,v in -R..R, h = height above ground) then stamped per chunk.
import { B } from "./blocks";
import { hash2 } from "./world";

export const T_R = 99; // local radius inside the wall
export const T_Y = 32;
const N = T_R * 2 + 1;
export const AIRV = 255;

export function buildTown(seed: number): Uint8Array {
  const g = new Uint8Array(N * N * T_Y);
  const set = (u: number, h: number, v: number, id: number) => {
    if (u < -T_R || u > T_R || v < -T_R || v > T_R || h < 0 || h >= T_Y) return;
    g[((h * N) + (v + T_R)) * N + (u + T_R)] = id === 0 ? AIRV : id;
  };
  const rnd = (a: number, b: number) => hash2(a, b, seed + 991);
  const box = (u0, u1, h0, h1, v0, v1, id) => { for (let h = h0; h <= h1; h++) for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) set(u, h, v, id); };
  const inCastle = (u, v) => u >= -17 && u <= 18 && v >= -24 && v <= 24;

  // ---------- streets: 5-wide on every multiple of 18, plus inner ring road ----------
  for (let v = -T_R; v <= T_R; v++)
    for (let u = -T_R; u <= T_R; u++) {
      if (inCastle(u, v)) continue;
      const mu = ((u % 18) + 18) % 18, mv = ((v % 18) + 18) % 18;
      const su = mu <= 2 || mu >= 16, sv = mv <= 2 || mv >= 16;
      const edge = Math.max(Math.abs(u), Math.abs(v)) >= 90; // ring lane along the wall
      const main = Math.abs(u) <= 2 || Math.abs(v) <= 2;
      const plaza = Math.abs(u) <= 34 && Math.abs(v) <= 34;
      if (main) set(u, 0, v, (u + v) & 1 ? B.STONE_BRICK : B.COBBLE);
      else if (plaza) set(u, 0, v, rnd(u, v) < 0.15 ? B.COBBLE : B.STONE_BRICK);
      else if (su || sv || edge) set(u, 0, v, rnd(u, v) < 0.3 ? B.DIRT : B.COBBLE);
    }
  // street lamps along main avenues
  for (let t = 36; t <= 88; t += 8)
    for (const s of [-1, 1]) for (const side of [-3, 3]) {
      box(side, side, 1, 3, s * t, s * t, B.LOG); set(side, 4, s * t, B.LANTERN);
      box(s * t, s * t, 1, 3, side, side, B.LOG); set(s * t, 4, side, B.LANTERN);
    }

  // ---------- building primitives ----------
  // four vernacular styles: jettied Tudor, stone cottage, brick townhouse, plaster longhouse
  const house = (u0, v0, w, d, doorSouth, k) => {
    const style = Math.floor(rnd(u0 * 7 + k, v0 * 13) * 4);
    const floors = [2, 1, 3, 2][style];
    const wallH = floors * 4 - 1;
    const ground = [B.COBBLE, B.COBBLE, B.BRICK, B.PLANKS][style];
    const upper = [B.PLASTER, B.COBBLE, B.BRICK, B.PLASTER][style];
    const frame = [B.LOG, B.LOG, B.STONE_BRICK, B.TIMBER][style];
    const roof = [B.TIMBER, B.THATCH, B.STONE_BRICK, B.BRICK][style];
    const jetty = style === 0 || style === 3 ? 1 : 0;
    box(u0, u0 + w - 1, 0, 0, v0, v0 + d - 1, B.PLANKS);
    let vs = v0, ve = v0 + d - 1;
    for (let h = 1; h <= wallH; h++) {
      const fl = (h - 1) >> 2, jet = fl > 0 ? jetty : 0;
      vs = v0 - (doorSouth ? 0 : jet); ve = v0 + d - 1 + (doorSouth ? jet : 0);
      const mat = fl === 0 ? ground : upper;
      for (let v = vs; v <= ve; v++)
        for (let u = u0; u < u0 + w; u++) {
          const eu = u === u0 || u === u0 + w - 1, ev = v === vs || v === ve;
          if (!eu && !ev) { set(u, h, v, h % 4 === 0 ? B.PLANKS : 0); continue; }
          const t = ev ? u - u0 : v - vs;
          let id = eu && ev ? frame : h % 4 === 0 ? frame : mat;
          if (mat === B.PLASTER && t % 3 === 0) id = frame; // half-timber studs
          if (h % 4 === 2 && !(eu && ev) && t % 2 === 1) id = B.GLASS;
          set(u, h, v, id);
        }
    }
    const du = u0 + (w >> 1), dv = doorSouth ? v0 + d - 1 : v0;
    set(du, 1, dv, B.DOOR); set(du, 2, dv, B.DOOR);
    set(du + 1, 2, dv, B.LANTERN); // porch lantern
    for (let f = 0; f < floors; f++) set(u0 + 1, f * 4 + 3, doorSouth ? v0 + 1 : v0 + d - 2, B.LANTERN); // ceiling lamp per floor
    // gable roof along u over the top floor
    const RV0 = vs, RD = ve - vs + 1;
    for (let r = 0; r <= (RD >> 1); r++) {
      const h = wallH + 1 + r;
      for (let u = u0 - 1; u <= u0 + w; u++) {
        set(u, h, RV0 - 1 + r, roof); set(u, h, RV0 + RD - r, roof);
        if (r > 0) for (let v = RV0 + r; v < RV0 + RD - r; v++) if (u === u0 || u === u0 + w - 1) set(u, h, v, upper);
      }
    }
    if (RD & 1) for (let u = u0 - 1; u <= u0 + w; u++) set(u, wallH + 1 + ((RD + 1) >> 1), RV0 + (RD >> 1), roof);
    if (style === 1 || style === 2) box(u0 + 1, u0 + 1, wallH + 1, wallH + (RD >> 1) + 3, RV0 + 1, RV0 + 1, B.COBBLE); // chimney
  };
  const hall = (u0, v0, w, d, hgt, mat, roofMat, doors = true) => {
    box(u0, u0 + w - 1, 0, 0, v0, v0 + d - 1, B.PLANKS);
    for (let h = 1; h <= hgt; h++)
      for (let v = v0; v < v0 + d; v++)
        for (let u = u0; u < u0 + w; u++) {
          const eu = u === u0 || u === u0 + w - 1, ev = v === v0 || v === v0 + d - 1;
          if (!eu && !ev) { set(u, h, v, h === 5 && hgt > 6 ? B.PLANKS : 0); continue; }
          let id = eu && ev ? B.LOG : mat;
          if ((h === 2 || h === 7) && !(eu && ev) && ((u + v) % 3 === 0)) id = B.GLASS;
          set(u, h, v, id);
        }
    if (doors) for (const dv of [v0, v0 + d - 1]) {
      const du = u0 + (w >> 1); box(du - 1, du + 1, 1, 3, dv, dv, B.DOOR);
      set(du - 2, 3, dv, B.LANTERN); set(du + 2, 3, dv, B.LANTERN);
    }
    set(u0 + (w >> 1), hgt > 6 ? 4 : hgt, v0 + (d >> 1), B.LANTERN);
    if (hgt > 6) set(u0 + (w >> 1), hgt, v0 + (d >> 1), B.LANTERN);
    for (let r = 0; r <= (d >> 1); r++) for (let u = u0 - 1; u <= u0 + w; u++) { set(u, hgt + 1 + r, v0 - 1 + r, roofMat); set(u, hgt + 1 + r, v0 + d - r, roofMat); }
    for (let r = 1; r <= (d >> 1); r++) for (const u of [u0, u0 + w - 1]) for (let v = v0 + r; v < v0 + d - r; v++) set(u, hgt + r, v, mat);
  };
  const well = (u, v) => {
    box(u - 1, u + 1, 0, 1, v - 1, v + 1, B.COBBLE); set(u, 0, v, B.WATER); set(u, 1, v, 0); set(u, 3, v, B.LANTERN);
    for (const [a, b] of [[-1, -1], [1, 1]]) box(u + a, u + a, 2, 3, v + b, v + b, B.LOG);
    box(u - 1, u + 1, 4, 4, v - 1, v + 1, B.PLANKS);
  };
  const fence = (u0, u1, v0, v1) => {
    for (let u = u0; u <= u1; u++) for (const v of [v0, v1]) set(u, 1, v, B.LOG);
    for (let v = v0; v <= v1; v++) for (const u of [u0, u1]) set(u, 1, v, B.LOG);
  };
  const farm = (cu, cv) => {
    fence(cu - 6, cu + 6, cv - 6, cv + 6); set(cu, 1, cv + 6, 0);
    for (let v = cv - 5; v <= cv + 5; v++) for (let u = cu - 5; u <= cu + 5; u++) {
      if ((u - cu + 5) % 4 === 2) set(u, 0, v, B.WATER);
      else { set(u, 0, v, B.DIRT); set(u, 1, v, rnd(u, v) < 0.15 ? B.FLOWER : B.TALLGRASS); }
    }
    // scarecrow
    box(cu, cu, 1, 3, cv, cv, B.LOG); set(cu - 1, 3, cv, B.PLANKS); set(cu + 1, 3, cv, B.PLANKS); set(cu, 4, cv, B.LEAVES);
    set(cu, 0, cv, B.DIRT);
  };
  const pasture = (cu, cv) => {
    fence(cu - 6, cu + 6, cv - 6, cv + 6); set(cu, 1, cv + 6, 0);
    hall(cu - 6, cv - 6, 5, 4, 3, B.PLANKS, B.PLANKS, false);
    box(cu + 2, cu + 4, 0, 0, cv + 2, cv + 2, B.WATER); // trough
    for (let v = cv - 5; v <= cv + 5; v++) for (let u = cu - 5; u <= cu + 5; u++) if (rnd(u * 3, v) < 0.08) set(u, 1, v, B.TALLGRASS);
  };
  const windmill = (cu, cv) => {
    for (let h = 0; h <= 14; h++) for (let v = cv - 3; v <= cv + 3; v++) for (let u = cu - 3; u <= cu + 3; u++) {
      const r = Math.max(Math.abs(u - cu), Math.abs(v - cv)); const lim = h < 8 ? 3 : 2;
      if (r > lim) continue;
      set(u, h, v, r === lim ? (h === 0 ? B.COBBLE : h < 8 ? B.COBBLE : B.PLANKS) : h === 0 || h === 7 ? B.PLANKS : 0);
    }
    set(cu, 1, cv + 3, B.DOOR); set(cu, 2, cv + 3, B.DOOR); set(cu + 1, 3, cv + 3, B.LANTERN);
    box(cu - 2, cu + 2, 15, 15, cv - 2, cv + 2, B.BRICK); box(cu - 1, cu + 1, 16, 16, cv - 1, cv + 1, B.BRICK); set(cu, 17, cv, B.BRICK);
    // sails on the south face
    const hy = 12, sv = cv + 3;
    set(cu, hy, sv, B.LOG);
    for (let t = 1; t <= 7; t++) { set(cu + t, hy, sv, B.PLANKS); set(cu - t, hy, sv, B.PLANKS); set(cu, hy + t, sv, B.PLANKS); if (hy - t > 1) set(cu, hy - t, sv, B.PLANKS); }
    for (let t = 3; t <= 7; t++) { set(cu + t, hy + 1, sv, B.GLASS); set(cu - t, hy - 1, sv, B.GLASS); set(cu - 1, hy + t, sv, B.GLASS); set(cu + 1, hy - t, sv, B.GLASS); }
    // grinding stone
    set(cu, 1, cv, B.STONE_BRICK);
  };
  const granary = (cu, cv) => {
    for (const [ou, ov] of [[-3, -3], [3, -3], [-3, 3], [3, 3]])
      for (let h = 0; h <= 9; h++) for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
        const r = u * u + v * v; if (r > 5) continue;
        set(cu + ou + u, h, cv + ov + v, h === 9 ? B.BRICK : r >= 4 ? (h % 3 === 0 ? B.LOG : B.BRICK) : h === 0 ? B.PLANKS : 0);
      }
  };
  const stall = (u, v, k) => {
    for (const [a, b] of [[0, 0], [3, 0], [0, 3], [3, 3]]) box(u + a, u + a, 1, 3, v + b, v + b, B.LOG);
    box(u, u + 3, 4, 4, v, v + 3, k % 2 ? B.BRICK : B.TIMBER);
    box(u + 1, u + 2, 1, 1, v, v, B.PLANKS); // counter
    set(u + 2, 3, v + 2, B.LANTERN); set(u + 1, 2, v + 1, k % 3 === 0 ? B.FLOWER : k % 3 === 1 ? B.LEAVES : B.SAND);
  };
  const market = (cu, cv) => {
    for (let v = cv - 6; v <= cv + 6; v++) for (let u = cu - 6; u <= cu + 6; u++) set(u, 0, v, (u + v) & 1 ? B.COBBLE : B.STONE_BRICK);
    let k = 0;
    for (const a of [-6, -1, 3]) for (const b of [-6, 3]) stall(cu + a, cv + b, k++);
    well(cu, cv);
  };
  const smithy = (cu, cv) => {
    hall(cu - 6, cv - 6, 9, 9, 4, B.COBBLE, B.BRICK);
    box(cu + 4, cu + 6, 0, 0, cv - 6, cv + 6, B.COBBLE);
    box(cu - 5, cu - 4, 1, 1, cv - 5, cv - 4, B.BRICK); // forge
    box(cu - 6, cu - 4, 1, 12, cv - 6, cv - 4, B.COBBLE); box(cu - 5, cu - 5, 2, 12, cv - 5, cv - 5, 0); // chimney
    set(cu + 5, 1, cv, B.STONE); set(cu + 5, 1, cv + 3, B.STONE); // anvils
    box(cu + 4, cu + 6, 0, 0, cv + 5, cv + 6, B.WATER);
  };
  const warehouse = (cu, cv) => {
    hall(cu - 6, cv - 6, 13, 13, 6, B.PLANKS, B.TIMBER);
    for (let i = 0; i < 6; i++) { const a = -5 + (i % 3) * 4, b = -4 + ((i / 3) | 0) * 8; box(cu + a, cu + a + 1, 1, 1 + (i % 2), cv + b, cv + b + 1, i % 2 ? B.LOG : B.PLANKS); }
  };
  const workshop = (cu, cv, k) => {
    hall(cu - 6, cv - 6, 7, 13, 4, k % 2 ? B.TIMBER : B.PLANKS, B.PLANKS);
    for (let v = cv - 5; v <= cv + 5; v += 2) box(cu + 2, cu + 5, 1, 1 + (v & 1), v, v, B.LOG); // lumber/hide racks
  };
  const lumberYard = (cu, cv) => {
    fence(cu - 6, cu + 6, cv - 6, cv + 6); set(cu, 1, cv + 6, 0);
    for (let p = 0; p < 4; p++) { const v = cv - 5 + p * 3; box(cu - 5, cu + 1, 1, 2, v, v + 1, B.LOG); }
    for (const [a, b] of [[4, -4], [4, 0], [4, 4]]) set(cu + a, 1, cv + b, B.LOG); // stumps
    box(cu + 3, cu + 5, 0, 0, cv + 2, cv + 2, B.DIRT); // saw pit
  };
  const barracks = (cu, cv) => {
    hall(cu - 6, cv - 6, 13, 13, 9, B.STONE_BRICK, B.COBBLE);
    for (let v = cv - 4; v <= cv + 4; v += 2) { set(cu - 5, 1, v, B.PLANKS); set(cu + 5, 1, v, B.PLANKS); set(cu - 5, 6, v, B.PLANKS); set(cu + 5, 6, v, B.PLANKS); } // bunks
    box(cu - 1, cu + 1, 1, 1, cv - 3, cv + 3, B.PLANKS); // mess table
  };
  const armory = (cu, cv) => {
    hall(cu - 6, cv - 6, 13, 13, 7, B.STONE_BRICK, B.STONE_BRICK);
    for (let u = cu - 4; u <= cu + 4; u += 2) { set(u, 1, cv - 5, B.STONE); set(u, 2, cv - 5, B.LOG); } // racks
    box(cu - 1, cu + 1, 1, 1, cv - 1, cv + 1, B.STONE); // anvils
  };
  const stables = (cu, cv) => {
    hall(cu - 6, cv - 6, 13, 13, 5, B.PLANKS, B.TIMBER);
    for (let u = cu - 5; u <= cu + 5; u++) for (const v of [cv - 2, cv + 2]) if ((u - cu) % 3 !== 0) set(u, 1, v, B.LOG); // stall dividers
    for (let u = cu - 4; u <= cu + 4; u += 3) { set(u, 1, cv - 5, B.WATER); set(u, 1, cv + 5, B.TALLGRASS); }
    box(cu - 5, cu + 5, 5, 5, cv - 5, cv + 5, B.PLANKS); for (let u = cu - 4; u <= cu + 4; u += 2) set(u, 6, cv - 3, B.SAND); // hayloft
  };
  const training = (cu, cv) => {
    for (let v = cv - 6; v <= cv + 6; v++) for (let u = cu - 6; u <= cu + 6; u++) set(u, 0, v, B.SAND);
    fence(cu - 6, cu + 6, cv - 6, cv + 6); box(cu - 1, cu + 1, 1, 1, cv + 6, cv + 6, 0);
    for (let u = cu - 4; u <= cu + 4; u += 4) { set(u, 1, cv - 5, B.LOG); set(u, 2, cv - 5, B.PLANKS); set(u, 3, cv - 5, B.BRICK); } // targets
    for (let u = cu - 3; u <= cu + 3; u += 3) box(u, u, 1, 2, cv + 2, cv + 2, B.LOG); // dummies
  };
  const church = (cu, cv) => {
    // nave 11 wide x 13 deep, tall, door south
    const u0 = cu - 5, v0 = cv - 6;
    box(u0, u0 + 10, 0, 0, v0, v0 + 12, B.STONE_BRICK);
    for (let h = 1; h <= 10; h++) for (let v = v0; v <= v0 + 12; v++) for (let u = u0; u <= u0 + 10; u++) {
      const eu = u === u0 || u === u0 + 10, ev = v === v0 || v === v0 + 12;
      if (!eu && !ev) { set(u, h, v, 0); continue; }
      let id = (u + v + h) % 7 === 0 ? B.MOSSY_BRICK : B.STONE_BRICK;
      if (eu && h >= 3 && h <= 8 && (v - v0) % 3 === 1) id = B.GLASS; // tall stained windows
      if (ev && v === v0 && h >= 4 && h <= 8 && Math.abs(u - cu) <= 1 + (h === 8 ? -1 : 0)) id = B.GLASS; // rose window
      set(u, h, v, id);
    }
    box(cu - 1, cu + 1, 1, 4, v0 + 12, v0 + 12, B.DOOR); set(cu, 5, v0 + 12, B.GLASS); set(cu - 2, 3, v0 + 12, B.LANTERN); set(cu + 2, 3, v0 + 12, B.LANTERN); set(cu - 3, 3, v0 + 3, B.LANTERN); set(cu + 3, 3, v0 + 3, B.LANTERN);
    for (let r = 0; r <= 6; r++) for (let v = v0 - 1; v <= v0 + 13; v++) { set(u0 - 1 + r, 11 + r, v, B.BRICK); set(u0 + 11 - r, 11 + r, v, B.BRICK); }
    for (let r = 1; r <= 5; r++) for (const v of [v0, v0 + 12]) for (let u = u0 + r; u <= u0 + 10 - r; u++) set(u, 10 + r, v, B.STONE_BRICK);
    for (let v = v0 + 3; v <= v0 + 10; v += 2) { set(cu - 3, 1, v, B.PLANKS); set(cu - 2, 1, v, B.PLANKS); set(cu + 2, 1, v, B.PLANKS); set(cu + 3, 1, v, B.PLANKS); } // pews
    box(cu - 1, cu + 1, 1, 1, v0 + 1, v0 + 1, B.STONE_BRICK); set(cu, 2, v0 + 1, B.GLASS); // altar
    // bell tower at the front corner
    const tu = cu + 6;
    for (let h = 0; h <= 24; h++) for (let v = v0 + 9; v <= v0 + 13; v++) for (let u = tu; u <= tu + 4; u++) {
      const e = u === tu || u === tu + 4 || v === v0 + 9 || v === v0 + 13;
      let id = e ? B.STONE_BRICK : h % 6 === 0 ? B.PLANKS : 0;
      if (e && h >= 18 && h <= 20 && (u === tu + 2 || v === v0 + 11)) id = 0; // belfry openings
      set(u, h, v, id);
    }
    set(tu + 2, 20, v0 + 11, B.BRICK); // bell
    for (let r = 0; r < 3; r++) box(tu + r, tu + 4 - r, 25 + r, 25 + r, v0 + 9 + r, v0 + 13 - r, B.BRICK);
    set(tu + 2, 28, v0 + 11, B.GLASS);
  };
  const cemetery = (cu, cv) => {
    fence(cu - 6, cu + 6, cv - 6, cv + 6); set(cu, 1, cv - 6, 0);
    for (let v = cv - 4; v <= cv + 4; v += 3) for (let u = cu - 4; u <= cu + 4; u += 2) { set(u, 1, v, B.COBBLE); if (rnd(u, v) < 0.4) set(u, 1, v + 1, B.FLOWER); }
    box(cu + 5, cu + 5, 1, 4, cv + 5, cv + 5, B.LOG); box(cu + 3, cu + 6, 5, 6, cv + 3, cv + 6, B.LEAVES); // weeping tree
  };
  const apothecary = (cu, cv) => {
    hall(cu - 6, cv - 6, 7, 9, 4, B.TIMBER, B.BRICK);
    // greenhouse
    for (let h = 0; h <= 4; h++) for (let v = cv - 2; v <= cv + 6; v++) for (let u = cu + 2; u <= cu + 6; u++) {
      const e = u === cu + 2 || u === cu + 6 || v === cv - 2 || v === cv + 6 || h === 4;
      set(u, h, v, h === 0 ? B.DIRT : e ? B.GLASS : h === 1 ? (rnd(u, v) < 0.5 ? B.FERN : B.ALOE) : 0);
    }
    set(cu + 4, 1, cv - 2, B.DOOR); set(cu + 4, 2, cv - 2, B.DOOR);
    for (let u = cu - 5; u <= cu + 6; u++) if (rnd(u, cv + 7) < 0.6) set(u, 1, cv + 6, B.FLOWER);
  };
  const tavern = (cu, cv, name) => {
    hall(cu - 6, cv - 6, 13, 11, 8, name === "brothel" ? B.BRICK : B.TIMBER, name === "brothel" ? B.STONE_BRICK : B.BRICK);
    box(cu - 6, cu + 6, 4, 4, cv + 5, cv + 6, B.PLANKS); // balcony
    for (let u = cu - 6; u <= cu + 6; u += 2) set(u, 5, cv + 6, B.LOG);
    box(cu - 4, cu - 2, 1, 1, cv - 3, cv - 1, B.PLANKS); box(cu + 2, cu + 4, 1, 1, cv - 3, cv - 1, B.PLANKS); // tables
    box(cu + 4, cu + 5, 1, 2, cv - 5, cv - 5, B.COBBLE); // hearth
    if (name === "brothel") for (let u = cu - 5; u <= cu + 5; u++) if (u % 2) set(u, 1, cv + 6, B.FLOWER);
  };
  const bakery = (cu, cv) => {
    hall(cu - 6, cv - 6, 9, 9, 4, B.BRICK, B.PLANKS);
    box(cu - 5, cu - 3, 1, 2, cv - 5, cv - 4, B.COBBLE); box(cu - 4, cu - 4, 3, 10, cv - 5, cv - 5, B.COBBLE); // oven + chimney
    well(cu + 4, cv + 4);
  };
  const treasury = (cu, cv) => {
    hall(cu - 6, cv - 6, 13, 13, 8, B.STONE_BRICK, B.BRICK);
    for (const [a, b] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) box(cu + a, cu + a, 1, 12, cv + b, cv + b, B.STONE_BRICK);
    box(cu - 2, cu + 2, 1, 1, cv - 2, cv + 2, B.SAND); // gold store
  };
  const housesCell = (cu, cv) => {
    let k = 0;
    for (const a of [-6, 1]) for (const b of [-6, 1]) house(cu + a, cv + b, 6, 6, b > 0, k++);
  };
  const garden = (cu, cv) => {
    for (let v = cv - 6; v <= cv + 6; v++) for (let u = cu - 6; u <= cu + 6; u++) if (rnd(u, v) < 0.25) set(u, 1, v, rnd(v, u) < 0.5 ? B.FLOWER : B.TALLGRASS);
    for (const [a, b] of [[-4, -4], [4, 4], [-4, 4], [4, -4]]) { box(cu + a, cu + a, 1, 3, cv + b, cv + b, B.LOG); box(cu + a - 1, cu + a + 1, 4, 4, cv + b - 1, cv + b + 1, B.LEAVES); }
    box(cu - 1, cu + 1, 0, 0, cv - 1, cv + 1, B.WATER); // pond
  };

  // ---------- district plan: 13x13 lots centred at 18k+9 ----------
  const special: Record<string, (u, v) => void> = {
    // Military (north)
    "-9,-45": barracks, "9,-45": barracks, "-27,-45": armory, "27,-45": stables, "-9,-63": training, "9,-63": training,
    "-27,-63": stables, "27,-63": barracks, "-45,-45": smithy, "45,-45": armory,
    // Clergy & upper (south-east)
    "9,45": church, "27,45": cemetery, "9,63": apothecary, "27,63": housesCell, "45,45": garden,
    // Village (south / south-west)
    "-9,45": tavern, "-27,63": (u, v) => tavern(u, v, "brothel"), "-27,45": bakery, "-9,81": bakery, "-45,63": garden,
    // Trade (west)
    "-45,-9": market, "-45,9": market, "-45,-27": market, "-45,27": treasury, "-63,-9": smithy, "-63,9": workshop, "-63,-27": workshop,
    "-63,27": workshop, "-81,-9": warehouse, "-81,9": warehouse, "-81,-27": warehouse, "-81,27": smithy,
    // Agriculture (east)
    "45,-9": granary, "45,9": bakery, "45,-27": windmill, "45,27": windmill, "81,-9": lumberYard, "81,9": lumberYard,
    "63,-9": farm, "63,9": farm, "63,-27": farm, "63,27": farm, "81,-27": farm, "81,27": farm,
    "63,-45": pasture, "81,-45": pasture, "63,-63": pasture, "81,-63": farm, "63,-81": farm, "81,-81": granary,
    "63,45": farm, "81,45": pasture, "63,63": farm, "81,63": windmill, "63,81": farm, "81,81": granary,
  };
  for (let cv = -81; cv <= 81; cv += 18)
    for (let cu = -81; cu <= 81; cu += 18) {
      if (Math.abs(cu) <= 27 && Math.abs(cv) <= 27) continue; // citadel plaza
      const f = special[cu + "," + cv];
      if (f) f(cu, cv, 0); else housesCell(cu, cv);
    }
  // lamp posts on every street crossing
  const post = (u, v) => { box(u, u, 1, 3, v, v, B.LOG); set(u, 4, v, B.LANTERN); };
  for (let a = -90; a <= 90; a += 18) for (let b = -90; b <= 90; b += 18) {
    if (Math.abs(a) <= 27 && Math.abs(b) <= 27) continue;
    post(a + 2, b + 2);
  }
  // plaza lamps ringing the inner bailey
  for (let t = -32; t <= 32; t += 8) { if (Math.abs(t) === 24 || t === 0) continue; post(-27, t); post(27, t); }
  for (let t = -16; t <= 16; t += 8) if (t) { post(t, -34); post(t, 34); }

  // ---------- inner curtain wall around the citadel ----------
  const IW = 22, IV = 30;
  for (let v = -IV - 1; v <= IV + 1; v++) for (let u = -IW - 1; u <= IW + 1; u++) {
    const au = Math.abs(u), av = Math.abs(v);
    const onU = au >= IW, onV = av >= IV;
    if (!onU && !onV) continue;
    const along = onU && !onV ? v : u;
    const gate = Math.abs(along) <= 2 && !(onU && onV);
    const outer = au === IW + 1 || av === IV + 1;
    for (let h = 0; h <= 8; h++) {
      let id = h === 0 ? B.COBBLE : rnd(u * 5 + h, v * 3) < 0.12 ? B.MOSSY_BRICK : B.STONE_BRICK;
      if (gate && h >= 1 && h <= 5) id = 0;
      if (h === 7 && !outer) id = B.COBBLE; // wall walk
      if (h === 8) id = outer && ((u + v) & 1) === 0 ? B.STONE_BRICK : 0; // crenels
      if (h === 4 && !gate && (Math.abs(along) === 3 || (((along % 8) + 8) % 8 === 4))) id = B.LANTERN;
      set(u, h, v, id);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const ua = sx > 0 ? IW - 2 : -IW - 3, va = sz > 0 ? IV - 2 : -IV - 3;
    for (let h = 0; h <= 12; h++) for (let v = va; v <= va + 5; v++) for (let u = ua; u <= ua + 5; u++) {
      const e = u === ua || u === ua + 5 || v === va || v === va + 5;
      let id = h === 12 ? (e && ((u + v) & 1) === 0 ? B.STONE_BRICK : 0) : B.STONE_BRICK;
      if (h === 8 && e && (u === ua + 2 || v === va + 2)) id = B.GLASS;
      set(u, h, v, id);
    }
    set(ua + 2, 12, va + 2, B.LANTERN); // beacon
  }

  // plaza wells & fountains
  for (const [u, v] of [[-28, -28], [28, -28], [-28, 28], [28, 28], [-24, 0], [24, 0]]) well(u, v);
  return g;
}

export function townAt(g: Uint8Array, u: number, h: number, v: number) {
  return g[((h * N) + (v + T_R)) * N + (u + T_R)];
}
