// @ts-nocheck
// Modern metropolis (inspired by CityMod): skyscraper core, offices, apartment blocks,
// historical shopfronts, parks, asphalt avenues with lane markings and crosswalks.
// Built once into a local grid (u,v in -R..R, h = height above ground) then stamped per chunk.
import { B } from "./blocks";
import { hash2 } from "./world";

export const C_R = 110; // local radius of the city footprint
export const C_Y = 44; // max build height above ground
const N = C_R * 2 + 1;
export const CAIR = 255;
const BLK = 24, ROAD = 6; // grid pitch and road width

export function buildCity(seed: number): Uint8Array {
  const g = new Uint8Array(N * N * C_Y);
  // Futuristic material remap: no medieval/rustic blocks above street level.
  const FUTURE = {
    [B.LANTERN]: B.NEON_ROD, [B.DOOR]: B.GLASS_CYAN, [B.LOG]: B.METAL, [B.PLANKS]: B.PANEL_DARK,
    [B.STONE_BRICK]: B.PANEL_WHITE, [B.MOSSY_BRICK]: B.PANEL_GRAY, [B.BRICK]: B.TERRA_TEAL,
    [B.TIMBER]: B.PANEL_GRAY, [B.LEAVES]: B.GLASS_GREEN, [B.GRASS]: B.PRISMARINE_DARK,
    [B.STEEL]: B.METAL, [B.OFFICE_WINDOW]: B.TINT_GLASS, [B.PLASTER]: B.PANEL_WHITE,
    [B.COBBLE]: B.PANEL_GRAY, [B.STONE]: B.PANEL_GRAY, [B.GLASS]: B.TINT_GLASS,
  };
  const set = (u, h, v, id) => {
    if (u < -C_R || u > C_R || v < -C_R || v > C_R || h < 0 || h >= C_Y) return;
    if (FUTURE[id] !== undefined && (h > 0 || id === B.GRASS || id === B.DIRT || id === B.STONE || id === B.COBBLE)) id = FUTURE[id];
    g[((h * N) + (v + C_R)) * N + (u + C_R)] = id === 0 ? CAIR : id;
  };
  const rnd = (a, b) => hash2(a, b, seed + 4421);
  const box = (u0, u1, h0, h1, v0, v1, id) => { for (let h = h0; h <= h1; h++) for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) set(u, h, v, id); };
  const mod = (a) => (((a + 12) % BLK) + BLK) % BLK; // 0..ROAD-1 = road

  // ---------- ground: asphalt roads, concrete sidewalks, markings ----------
  for (let v = -C_R; v <= C_R; v++)
    for (let u = -C_R; u <= C_R; u++) {
      const mu = mod(u), mv = mod(v);
      const ru = mu < ROAD, rv = mv < ROAD;
      let id = B.CONCRETE;
      if (ru || rv) {
        id = B.ASPHALT;
        const inter = ru && rv;
        if (!inter) {
          // dashed centre line
          if (ru && (mu === 2 || mu === 3) && ((v & 7) < 4)) id = B.ROAD_LINE;
          if (rv && (mv === 2 || mv === 3) && ((u & 7) < 4)) id = B.ROAD_LINE;
          // zebra crosswalks next to each intersection
          if (ru && (mv === ROAD || mv === BLK - 1) && (u & 1)) id = B.ROAD_LINE;
          if (rv && (mu === ROAD || mu === BLK - 1) && (v & 1)) id = B.ROAD_LINE;
        }
      }
      set(u, 0, v, id);
      // clear everything above so terrain/trees never poke through
      for (let h = 1; h < C_Y; h++) set(u, h, v, 0);
    }
  // street lights on sidewalk corners
  for (let a = -C_R; a <= C_R; a++) for (let b = -C_R; b <= C_R; b++) {
    if (mod(a) === ROAD && mod(b) === ROAD) { box(a, a, 1, 4, b, b, B.STEEL); set(a, 5, b, B.LANTERN); }
  }

  // ---------- building primitives ----------
  // facade with window grid; interiors solid except a hollow ground-floor lobby
  const tower = (u0, v0, w, d, hgt, wall, win, opts = {}) => {
    const { glass = false, band = B.STEEL, lobby = true, setback = 0 } = opts;
    for (let h = 1; h <= hgt; h++) {
      const sb = setback && h > hgt * 0.65 ? setback : 0;
      const a0 = u0 + sb, a1 = u0 + w - 1 - sb, b0 = v0 + sb, b1 = v0 + d - 1 - sb;
      for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) {
        const eu = u === a0 || u === a1, ev = v === b0 || v === b1;
        if (!eu && !ev) { set(u, h, v, lobby && h <= 3 ? 0 : wall); continue; }
        const t = ev ? u - a0 : v - b0;
        let id = wall;
        if (eu && ev) id = band;
        else if (glass) id = h % 4 === 0 || t % 4 === 0 ? band : win;
        else if (h % 4 !== 0 && h % 4 !== 1 && t % 3 !== 0) id = win;
        if (h === 1 && t > 0 && (glass || t % 2)) id = win; // shop windows
        set(u, h, v, id);
      }
      if (h === hgt) box(a0, a1, h + 1, h + 1, b0, b1, B.CONCRETE); // roof slab
    }
    // entrance doors on both street sides
    const du = u0 + (w >> 1);
    for (const dv of [v0, v0 + d - 1]) { set(du, 1, dv, B.DOOR); set(du, 2, dv, B.DOOR); set(du - 1, 3, dv, B.LANTERN); }
    return hgt + 1;
  };
  const helipad = (cu, cv, top) => {
    box(cu - 3, cu + 3, top + 1, top + 1, cv - 3, cv + 3, B.ASPHALT);
    for (const [a, b] of [[-1, -2], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [1, -2], [1, -1], [1, 0], [1, 1], [1, 2], [0, 0]]) set(cu + a, top + 1, cv + b, B.ROAD_LINE);
  };
  const antenna = (cu, cv, top, len) => { box(cu, cu, top + 1, top + len, cv, cv, B.STEEL); set(cu, top + len + 1, cv, B.LANTERN); };
  const tree = (u, v) => {
    const th = 3 + Math.floor(rnd(u, v) * 2);
    box(u, u, 1, th, v, v, B.LOG);
    for (let dh = -1; dh <= 1; dh++) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++)
      if (a * a + b * b + dh * dh * 2 <= 5) set(u + a, th + 1 + dh, v + b, B.LEAVES);
  };

  // ---------- extra architectural primitives ----------
  // generic shaped floor: mask(u,v) -> inside footprint; facade style picks window pattern
  const shaped = (u0, v0, w, d, h0, h1, inside, style) => {
    const { wall, win, band, rib = 3, floor = 4 } = style;
    for (let h = h0; h <= h1; h++) for (let v = v0 - 1; v <= v0 + d; v++) for (let u = u0 - 1; u <= u0 + w; u++) {
      if (!inside(u, v, h)) continue;
      const edge = !inside(u + 1, v, h) || !inside(u - 1, v, h) || !inside(u, v + 1, h) || !inside(u, v - 1, h);
      if (!edge) { set(u, h, v, h - h0 < 3 && h0 === 1 ? 0 : wall); continue; }
      const t = u + v;
      let id = win;
      if (h % floor === 0) id = band;
      else if (rib && ((t % rib) + rib) % rib === 0) id = wall;
      set(u, h, v, id);
    }
  };
  const roofKit = (u0, v0, w, d, top, r) => {
    // HVAC units, water tank, maintenance hut
    box(u0 + 1, u0 + 2, top + 1, top + 1, v0 + 1, v0 + 2, B.STEEL);
    if (r > 0.3) { box(u0 + w - 4, u0 + w - 2, top + 1, top + 2, v0 + d - 4, v0 + d - 2, B.CONCRETE); set(u0 + w - 3, top + 1, v0 + d - 4, B.DOOR); }
    if (r > 0.6) { box(u0 + 2, u0 + 2, top + 1, top + 2, v0 + d - 3, v0 + d - 3, B.LOG); box(u0 + 1, u0 + 3, top + 3, top + 4, v0 + d - 4, v0 + d - 2, B.PLANKS); }
  };
  const slab = (u0, v0, w, d, h) => box(u0, u0 + w - 1, h, h, v0, v0 + d - 1, B.CONCRETE);
  const doors = (u0, v0, w, d) => { const du = u0 + (w >> 1); set(du, 1, v0, B.DOOR); set(du, 2, v0, B.DOOR); set(du, 1, v0 + d - 1, B.DOOR); set(du, 2, v0 + d - 1, B.DOOR); };
  const MAXH = C_Y - 4;

  // 1. supertall crystalline spire: chamfered corners, tapering in 3 tiers, needle mast
  const spire = (u0, v0, S, hgt, r) => {
    const c = (S - 1) / 2;
    const tiers = [[1, Math.floor(hgt * 0.45), 0], [Math.floor(hgt * 0.45) + 1, Math.floor(hgt * 0.75), 2], [Math.floor(hgt * 0.75) + 1, hgt, 4]];
    for (const [a, b, inset] of tiers) {
      const half = c - inset, ch = Math.max(2, Math.floor(half * 0.55));
      shaped(u0, v0, S, S, a, b, (u, v) => { const x = Math.abs(u - u0 - c), y = Math.abs(v - v0 - c); return x <= half && y <= half && x + y <= half * 2 - ch; },
        { wall: B.STEEL, win: B.GLASS, band: B.OFFICE_WINDOW, rib: 0, floor: 5 });
      slab(u0 + inset + 2, v0 + inset + 2, S - inset * 2 - 4, S - inset * 2 - 4, b + 1);
    }
    const cu = u0 + Math.round(c), cv = v0 + Math.round(c);
    box(cu, cu, hgt + 2, Math.min(C_Y - 2, hgt + 6), cv, cv, B.STEEL); set(cu, Math.min(C_Y - 1, hgt + 7), cv, B.LANTERN);
    doors(u0 + 2, v0, S - 4, S);
  };
  // 2. art-deco setback: stone pilasters, 4 receding tiers, crown
  const deco = (u0, v0, S, hgt) => {
    let a = 1, inset = 0;
    const steps = [0.4, 0.62, 0.8, 1];
    for (const f of steps) {
      const b = Math.floor(hgt * f);
      shaped(u0 + inset, v0 + inset, S - inset * 2, S - inset * 2, a, b,
        (u, v) => u >= u0 + inset && u < u0 + S - inset && v >= v0 + inset && v < v0 + S - inset,
        { wall: B.STONE_BRICK, win: B.OFFICE_WINDOW, band: B.STONE_BRICK, rib: 2, floor: 3 });
      a = b + 1; inset += 2;
    }
    const cu = u0 + (S >> 1), cv = v0 + (S >> 1);
    for (let i = 0; i < 3; i++) set(cu, hgt + 1 + i, cv, i === 2 ? B.LANTERN : B.STONE_BRICK);
    doors(u0, v0, S, S);
  };
  // 3. residential tower: L-shaped, wraparound balconies, rooftop pool
  const residential = (u0, v0, S, hgt, r) => {
    const arm = Math.floor(S * 0.5), flip = r > 0.5;
    const inL = (u, v) => { const x = u - u0, y = v - v0; if (x < 0 || y < 0 || x >= S || y >= S) return false; return flip ? (x < arm || y >= S - arm) : (x >= S - arm || y < arm); };
    shaped(u0, v0, S, S, 1, hgt, inL, { wall: B.PLASTER, win: B.GLASS, band: B.PLASTER, rib: 4, floor: 3 });
    for (let h = 3; h <= hgt; h += 3) for (let v = v0 - 1; v <= v0 + S; v++) for (let u = u0 - 1; u <= u0 + S; u++) {
      if (inL(u, v)) continue;
      if (inL(u + 1, v) || inL(u - 1, v) || inL(u, v + 1) || inL(u, v - 1)) set(u, h, v, B.CONCRETE);
    }
    for (let v = v0; v < v0 + S; v++) for (let u = u0; u < u0 + S; u++) if (inL(u, v)) set(u, hgt + 1, v, B.CONCRETE);
    const pu = flip ? u0 + 1 : u0 + S - arm + 1, pv = flip ? v0 + 1 : v0 + 1;
    box(pu, pu + arm - 3, hgt + 1, hgt + 1, pv, pv + 4, B.WATER);
    doors(u0, v0, S, S);
  };
  // 4. department store / plaza: wide 3-storey glass atrium, awnings, billboard
  const plaza = (u0, v0, W, D, r) => {
    const hgt = 7 + Math.floor(r * 4);
    shaped(u0, v0, W, D, 1, hgt, (u, v) => u >= u0 && u < u0 + W && v >= v0 && v < v0 + D,
      { wall: B.CONCRETE, win: B.GLASS, band: B.STEEL, rib: 5, floor: 4 });
    for (let h = 1; h <= 3; h++) for (let u = u0 + 2; u < u0 + W - 2; u++) { set(u, h, v0, B.GLASS); set(u, h, v0 + D - 1, B.GLASS); }
    box(u0, u0 + W - 1, 4, 4, v0 - 1, v0 - 1, B.TIMBER); box(u0, u0 + W - 1, 4, 4, v0 + D, v0 + D, B.TIMBER);
    slab(u0, v0, W, D, hgt + 1);
    box(u0 + 3, u0 + W - 4, hgt + 2, hgt + 5, v0 + 1, v0 + 1, B.OFFICE_WINDOW); // rooftop billboard
    box(u0 + 3, u0 + W - 4, hgt + 2, hgt + 5, v0 + 2, v0 + 2, B.STEEL);
    roofKit(u0, v0 + 3, W, D - 3, hgt + 1, r);
    doors(u0, v0, W, D);
    return hgt;
  };
  // 5. modernist office: pilotis ground floor, ribbon windows, T-plan
  const modernist = (u0, v0, S, hgt, r) => {
    const t = Math.floor(S / 3);
    const inT = (u, v) => { const x = u - u0, y = v - v0; if (x < 0 || y < 0 || x >= S || y >= S) return false; return y < S - t * 1.2 || (x >= t && x < S - t); };
    // pilotis
    for (let v = v0; v < v0 + S; v += 4) for (let u = u0; u < u0 + S; u += 4) if (inT(u, v)) box(u, u, 1, 3, v, v, B.CONCRETE);
    box(u0 + t, u0 + S - t - 1, 1, 3, v0 + 3, v0 + 6, B.GLASS);
    shaped(u0, v0, S, S, 4, hgt, inT, { wall: B.STEEL, win: B.OFFICE_WINDOW, band: B.CONCRETE, rib: 0, floor: 2 });
    for (let v = v0; v < v0 + S; v++) for (let u = u0; u < u0 + S; u++) if (inT(u, v)) set(u, 4, v, B.CONCRETE), set(u, hgt + 1, v, B.CONCRETE);
    roofKit(u0 + 2, v0 + 2, S - 4, S - t - 4, hgt + 1, r);
  };
  // 6. townhouse row: varied widths/heights, fire escapes, water tanks, cafe awnings
  const townhouse = (a, b, w, d, hh, mat, facing) => {
    shaped(a, b, w, d, 1, hh, (u, v) => u >= a && u < a + w && v >= b && v < b + d,
      { wall: mat, win: B.OFFICE_WINDOW, band: mat, rib: 2, floor: 3 });
    for (let u = a; u < a + w; u++) set(u, 1, facing, B.GLASS);
    set(a + 1, 1, facing, B.DOOR); set(a + 1, 2, facing, B.DOOR);
    slab(a, b, w, d, hh + 1);
    box(a - 0, a + w - 1, hh + 2, hh + 2, b, b, mat); box(a, a + w - 1, hh + 2, hh + 2, b + d - 1, b + d - 1, mat); // parapet
    const out = facing === b ? b - 1 : b + d;
    box(a, a + w - 1, 3, 3, out, out, B.TIMBER); // awning
    for (let h = 4; h <= hh; h += 3) { set(a + w - 2, h, out, B.STEEL); set(a + w - 3, h, out, B.STEEL); } // fire escape
    if (hh > 8) { box(a + 1, a + 1, hh + 2, hh + 3, b + 2, b + 2, B.LOG); box(a, a + 2, hh + 4, hh + 5, b + 1, b + 3, B.PLANKS); }
  };
  const skybridge = (u0, u1, h, v) => { box(u0, u1, h, h, v - 1, v + 1, B.CONCRETE); box(u0, u1, h + 1, h + 2, v - 1, v - 1, B.GLASS); box(u0, u1, h + 1, h + 2, v + 1, v + 1, B.GLASS); box(u0, u1, h + 3, h + 3, v - 1, v + 1, B.STEEL); };
  const busStop = (u, v) => { box(u, u + 3, 1, 3, v, v, B.GLASS); box(u, u + 3, 4, 4, v - 1, v, B.STEEL); };

  // ---------- lots ----------
  const LOT0 = ROAD + 1, LOTW = BLK - ROAD - 2; // 1-block sidewalk margin each side
  const coreTops = new Map();
  for (let gv = -5; gv <= 4; gv++) for (let gu = -5; gu <= 4; gu++) {
    const u0 = gu * BLK - 12 + LOT0, v0 = gv * BLK - 12 + LOT0;
    if (u0 < -C_R + 2 || v0 < -C_R + 2 || u0 + LOTW > C_R - 1 || v0 + LOTW > C_R - 1) continue;
    const dist = Math.max(Math.abs(gu + 0.5), Math.abs(gv + 0.5));
    const r = rnd(gu * 31, gv * 17), r2 = rnd(gu * 7 + 3, gv * 11 + 5);
    if ((gu === 0 && gv === 0) || r < 0.08) {
      box(u0, u0 + LOTW - 1, 0, 0, v0, v0 + LOTW - 1, B.GRASS);
      box(u0, u0 + LOTW - 1, 0, 0, v0 + (LOTW >> 1) - 1, v0 + (LOTW >> 1), B.CONCRETE);
      box(u0 + (LOTW >> 1) - 1, u0 + (LOTW >> 1), 0, 0, v0, v0 + LOTW - 1, B.CONCRETE);
      const c = LOTW >> 1;
      box(u0 + c - 3, u0 + c + 2, 1, 1, v0 + c - 3, v0 + c + 2, B.CONCRETE);
      box(u0 + c - 2, u0 + c + 1, 1, 1, v0 + c - 2, v0 + c + 1, B.WATER);
      box(u0 + c - 1, u0 + c, 2, 3, v0 + c - 1, v0 + c, B.STONE_BRICK);
      for (const [a, b] of [[3, 3], [LOTW - 4, 3], [3, LOTW - 4], [LOTW - 4, LOTW - 4], [c, 2], [2, c]]) tree(u0 + a, v0 + b);
      continue;
    }
    const S = LOTW - 2, a0 = u0 + 1, b0 = v0 + 1;
    let top = 0;
    if (dist <= 1.5) {
      const hgt = Math.min(MAXH - 8, Math.round(28 + r2 * 8 - dist * 3));
      const kind = Math.floor(r * 3);
      if (kind === 0) { spire(a0, b0, S, hgt, r2); top = hgt; }
      else if (kind === 1) { deco(a0, b0, S, hgt); top = hgt; }
      else { modernist(a0, b0, S, hgt - 4, r2); top = hgt - 4; helipad(a0 + (S >> 1), b0 + 4, top + 1); }
      coreTops.set(gu + "," + gv, { top, a0, b0, S });
    } else if (dist <= 3) {
      const kind = Math.floor(r2 * 4);
      if (kind === 0) residential(a0, b0, S, 14 + Math.floor(r * 10), r);
      else if (kind === 1) plaza(a0, b0, S, S, r);
      else if (kind === 2) modernist(a0, b0, S, 12 + Math.floor(r * 8), r);
      else deco(a0, b0, S, 16 + Math.floor(r * 8));
    } else {
      // townhouse rows of varied widths along both streets
      for (const side of [0, 1]) {
        let a = u0;
        while (a < u0 + LOTW - 3) {
          const w = Math.min(u0 + LOTW - a, 4 + Math.floor(rnd(a, v0 + side) * 3));
          const b = side ? v0 + LOTW - 6 : v0;
          const hh = 6 + Math.floor(rnd(a, b) * 8);
          const mat = [B.BRICK, B.PLASTER, B.STONE_BRICK, B.MOSSY_BRICK][Math.floor(rnd(b, a) * 4)];
          townhouse(a, b, w - 1, 6, hh, mat, side ? b + 5 : b);
          a += w;
        }
      }
      tree(u0 + (LOTW >> 1), v0 + (LOTW >> 1));
      if (r2 > 0.5) busStop(u0 + 2, v0 - 1);
    }
  }
  // skybridges between neighbouring core towers
  for (const [k, A] of coreTops) {
    const [gu, gv] = k.split(",").map(Number);
    const Bn = coreTops.get((gu + 1) + "," + gv);
    if (Bn && rnd(gu, gv * 3) > 0.4) { const h = Math.min(A.top, Bn.top) - 6; if (h > 6) skybridge(A.a0 + A.S - 1, Bn.a0, h, A.b0 + (A.S >> 1)); }
  }
  return g;
}

export function cityAt(g: Uint8Array, u: number, h: number, v: number) {
  if (u < -C_R || u > C_R || v < -C_R || v > C_R || h < 0 || h >= C_Y) return 0;
  return g[((h * N) + (v + C_R)) * N + (u + C_R)];
}
