// Hot numeric voxel loops: index-signature strictness is disabled here for readability.
// @ts-nocheck
export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  LOG: 4,
  LEAVES: 5,
  SAND: 6,
  PLANKS: 7,
  COBBLE: 8,
  BRICK: 9,
  GLASS: 10,
  BEDROCK: 11,
  TALLGRASS: 12,
  BOULDER: 13,
  WATER: 14,
  FLOWER: 15,
  REED: 16,
  ALOE: 17,
  JUNGLE_GRASS: 18,
  FERN: 19,
  STONE_BRICK: 20,
  MOSSY_BRICK: 21,
  TIMBER: 22,
  LANTERN: 23,
  DOOR: 24,
  PLASTER: 25,
  THATCH: 26,
  ASPHALT: 27,
  CONCRETE: 28,
  OFFICE_WINDOW: 29,
  STEEL: 30,
  ROAD_LINE: 31,
  // ---- Linefield cyberpunk palette ----
  PANEL_DARK: 32,
  PANEL_GRAY: 33,
  PANEL_WHITE: 34,
  PANEL_CYAN: 35,
  PRISMARINE_DARK: 36,
  TERRA_TEAL: 37,
  TERRA_RED: 38,
  TERRA_ORANGE: 39,
  TERRA_YELLOW: 40,
  TERRA_GREEN: 41,
  TERRA_BLUE: 42,
  TERRA_PURPLE: 43,
  TINT_GLASS: 44,
  GLASS_CYAN: 45,
  GLASS_MAGENTA: 46,
  IRON_BARS: 47,
  SEA_LANTERN: 48,
  GLOWSTONE: 49,
  NEON_ROD: 50,
  NEON_MAGENTA: 51,
  METAL: 52,
  GLASS_GREEN: 53,
  TERRA_BROWN: 54,
} as const;

export type Tool = "pickaxe" | "axe" | "shovel";

export interface BlockDef {
  name: string;
  hardness: number; // seconds by hand
  tool: Tool | null;
  tiles: [number, number, number]; // top, side, bottom
  drop: number;
  transparent?: boolean;
}

export const BLOCKS: Record<number, BlockDef> = {
  [B.GRASS]: { name: "Savanna Grass", hardness: 0.9, tool: "shovel", tiles: [0, 1, 2], drop: B.DIRT },
  [B.DIRT]: { name: "Red Laterite", hardness: 0.75, tool: "shovel", tiles: [2, 2, 2], drop: B.DIRT },
  [B.STONE]: { name: "Kopje Granite", hardness: 4, tool: "pickaxe", tiles: [3, 3, 3], drop: B.COBBLE },
  [B.LOG]: { name: "Acacia Log", hardness: 2.5, tool: "axe", tiles: [5, 4, 5], drop: B.LOG },
  [B.LEAVES]: { name: "Acacia Leaves", hardness: 0.3, tool: null, tiles: [6, 6, 6], drop: 0, transparent: true },
  [B.SAND]: { name: "Sand", hardness: 0.75, tool: "shovel", tiles: [7, 7, 7], drop: B.SAND },
  [B.PLANKS]: { name: "Iroko Planks", hardness: 2, tool: "axe", tiles: [8, 8, 8], drop: B.PLANKS },
  [B.COBBLE]: { name: "Granite Rubble", hardness: 4.5, tool: "pickaxe", tiles: [9, 9, 9], drop: B.COBBLE },
  [B.BRICK]: { name: "Terracotta Brick", hardness: 5, tool: "pickaxe", tiles: [10, 10, 10], drop: B.BRICK },
  [B.GLASS]: { name: "Glass", hardness: 0.4, tool: null, tiles: [11, 11, 11], drop: 0, transparent: true },
  [B.BEDROCK]: { name: "Bedrock", hardness: Infinity, tool: null, tiles: [12, 12, 12], drop: 0 },
  [B.TALLGRASS]: { name: "Tall Grass", hardness: 0.05, tool: null, tiles: [16, 16, 16], drop: 0, transparent: true },
  [B.BOULDER]: { name: "Boulder", hardness: 3, tool: "pickaxe", tiles: [3, 3, 3], drop: B.COBBLE, transparent: true },
  [B.WATER]: { name: "Water", hardness: Infinity, tool: null, tiles: [20, 20, 20], drop: 0, transparent: true },
  [B.FLOWER]: { name: "Wildflowers", hardness: 0.05, tool: null, tiles: [17, 17, 17], drop: 0, transparent: true },
  [B.REED]: { name: "Papyrus Reeds", hardness: 0.05, tool: null, tiles: [18, 18, 18], drop: 0, transparent: true },
  [B.ALOE]: { name: "Aloe", hardness: 0.1, tool: null, tiles: [19, 19, 19], drop: 0, transparent: true },
  [B.JUNGLE_GRASS]: { name: "Rainforest Grass", hardness: 0.9, tool: "shovel", tiles: [21, 22, 2], drop: B.DIRT },
  [B.STONE_BRICK]: { name: "Castle Stone Brick", hardness: 5, tool: "pickaxe", tiles: [24, 24, 24], drop: B.STONE_BRICK },
  [B.MOSSY_BRICK]: { name: "Mossy Stone Brick", hardness: 5, tool: "pickaxe", tiles: [25, 25, 25], drop: B.STONE_BRICK },
  [B.TIMBER]: { name: "Spruce Roof Timber", hardness: 2, tool: "axe", tiles: [26, 26, 26], drop: B.TIMBER },
  [B.LANTERN]: { name: "Lumiline", hardness: 0.5, tool: null, tiles: [27, 27, 27], drop: B.LANTERN },
  [B.DOOR]: { name: "Oak Door", hardness: 2, tool: "axe", tiles: [8, 28, 8], drop: B.DOOR, transparent: true },
  [B.PLASTER]: { name: "Lime Plaster", hardness: 1.5, tool: "pickaxe", tiles: [29, 29, 29], drop: B.PLASTER },
  [B.THATCH]: { name: "Straw Thatch", hardness: 0.6, tool: null, tiles: [30, 30, 30], drop: B.THATCH },
  [B.FERN]: { name: "Fern", hardness: 0.05, tool: null, tiles: [23, 23, 23], drop: 0, transparent: true },
  [B.ASPHALT]: { name: "Asphalt", hardness: 3, tool: "pickaxe", tiles: [31, 31, 31], drop: B.ASPHALT },
  [B.CONCRETE]: { name: "Concrete", hardness: 4, tool: "pickaxe", tiles: [32, 32, 32], drop: B.CONCRETE },
  [B.OFFICE_WINDOW]: { name: "Office Window", hardness: 0.6, tool: null, tiles: [33, 33, 33], drop: 0 },
  [B.STEEL]: { name: "Steel Panel", hardness: 6, tool: "pickaxe", tiles: [34, 34, 34], drop: B.STEEL },
  [B.ROAD_LINE]: { name: "Road Marking", hardness: 3, tool: "pickaxe", tiles: [35, 35, 35], drop: B.ASPHALT },
};
// Linefield cyberpunk blocks: tile index = id + 4 (tiles 36..58)
const CYBER: [number, string, number, Tool | null, boolean?][] = [
  [B.PANEL_DARK, "Dark Panel", 4, "pickaxe"], [B.PANEL_GRAY, "Grey Panel", 4, "pickaxe"], [B.PANEL_WHITE, "White Panel", 4, "pickaxe"],
  [B.PANEL_CYAN, "Cyan Panel", 4, "pickaxe"], [B.PRISMARINE_DARK, "Dark Prismarine", 4, "pickaxe"], [B.TERRA_TEAL, "Teal Cladding", 3, "pickaxe"],
  [B.TERRA_RED, "Red Cladding", 3, "pickaxe"], [B.TERRA_ORANGE, "Orange Cladding", 3, "pickaxe"], [B.TERRA_YELLOW, "Yellow Cladding", 3, "pickaxe"],
  [B.TERRA_GREEN, "Green Cladding", 3, "pickaxe"], [B.TERRA_BLUE, "Blue Cladding", 3, "pickaxe"], [B.TERRA_PURPLE, "Violet Cladding", 3, "pickaxe"],
  [B.TINT_GLASS, "Tinted Glass", 0.4, null], [B.GLASS_CYAN, "Cyan Neon Glass", 0.4, null], [B.GLASS_MAGENTA, "Magenta Neon Glass", 0.4, null],
  [B.IRON_BARS, "Iron Bars", 3, "pickaxe", true], [B.SEA_LANTERN, "Lumiline", 0.5, null], [B.GLOWSTONE, "Lumiline", 0.5, null],
  [B.NEON_ROD, "Neon Strip", 0.3, null], [B.NEON_MAGENTA, "Magenta Neon", 0.3, null], [B.METAL, "Metal Plate", 5, "pickaxe"],
  [B.GLASS_GREEN, "Amber Neon Glass", 0.4, null], [B.TERRA_BROWN, "Brown Cladding", 3, "pickaxe"],
];
for (const [id, name, hardness, tool, transparent] of CYBER)
  BLOCKS[id] = { name, hardness, tool, tiles: [id + 4, id + 4, id + 4], drop: id, transparent };

/** Legacy medieval/natural IDs -> modern equivalents (0 = remove). Applied at Linefield ingestion. */
export const REMAP: Record<number, number> = {
  [B.LOG]: B.PANEL_DARK, [B.PLANKS]: B.PANEL_DARK, [B.TIMBER]: B.METAL, [B.DOOR]: B.PANEL_DARK, [B.THATCH]: B.PANEL_DARK,
  [B.BRICK]: B.TERRA_TEAL, [B.STONE_BRICK]: B.PANEL_GRAY, [B.MOSSY_BRICK]: B.PANEL_GRAY, [B.STONE]: B.PANEL_GRAY, [B.PLASTER]: B.PANEL_GRAY,
  [B.GLASS]: B.TINT_GLASS, [B.IRON_BARS]: B.METAL,
  [B.COBBLE]: B.CONCRETE, [B.BOULDER]: B.CONCRETE, [B.DIRT]: B.ASPHALT, [B.GRASS]: B.ASPHALT, [B.JUNGLE_GRASS]: B.ASPHALT, [B.SAND]: B.CONCRETE,
  [B.LANTERN]: B.NEON_ROD, [B.SEA_LANTERN]: B.NEON_ROD, [B.GLOWSTONE]: B.NEON_ROD, [B.WATER]: B.TINT_GLASS,
  [B.LEAVES]: 0, [B.TALLGRASS]: 0, [B.FLOWER]: 0, [B.REED]: 0, [B.ALOE]: 0, [B.FERN]: 0,
};
// purge legacy textures: legacy blocks render with their modern counterpart's metal/panel/composite tiles
for (const k in REMAP) {
  const to = REMAP[+k];
  if (to && BLOCKS[+k] && BLOCKS[to]) { BLOCKS[+k].tiles = [...BLOCKS[to].tiles]; BLOCKS[+k].tool = BLOCKS[to].tool; BLOCKS[+k].transparent = BLOCKS[to].transparent; }
}
export const remapId = (id: number) => (id in REMAP ? REMAP[id] : id);
const EMISSIVE = new Set<number>([B.LANTERN, B.SEA_LANTERN, B.GLOWSTONE, B.NEON_ROD, B.NEON_MAGENTA, B.GLASS_CYAN, B.GLASS_MAGENTA, B.GLASS_GREEN]);
export const isEmissive = (id: number) => EMISSIVE.has(id);

export type Item =
  | { kind: "tool"; tool: Tool; name: string; tile: number; damage: number }
  | { kind: "block"; block: number; name: string; tile: number };

export const HOTBAR: Item[] = [
  { kind: "block", block: B.PANEL_DARK, name: "Dark Panel", tile: B.PANEL_DARK + 4 },
  { kind: "block", block: B.PANEL_GRAY, name: "Grey Panel", tile: B.PANEL_GRAY + 4 },
  { kind: "block", block: B.METAL, name: "Metal Plate", tile: B.METAL + 4 },
  { kind: "block", block: B.CONCRETE, name: "Concrete", tile: 32 },
  { kind: "block", block: B.ASPHALT, name: "Asphalt", tile: 31 },
  { kind: "block", block: B.TINT_GLASS, name: "Tinted Glass", tile: B.TINT_GLASS + 4 },
  { kind: "block", block: B.TERRA_TEAL, name: "Teal Cladding", tile: B.TERRA_TEAL + 4 },
  { kind: "block", block: B.NEON_ROD, name: "Neon Strip", tile: B.NEON_ROD + 4 },
  { kind: "block", block: B.STEEL, name: "Steel Panel", tile: 34 },
];

export const isTransparent = (id: number) => id === 0 || !!BLOCKS[id]?.transparent;
/** blocks the player walks through (air + plants) */
export const isPlant = (id: number) => id === B.TALLGRASS || id === B.FLOWER || id === B.REED || id === B.ALOE || id === B.FERN;
export const isPassable = (id: number) => id === 0 || id === B.WATER || isPlant(id) || id === B.DOOR;
/** natural terrain that gets smoothed into organic shapes */
export const isNatural = (id: number) => id === B.GRASS || id === B.DIRT || id === B.STONE || id === B.SAND || id === B.JUNGLE_GRASS;


// ---------- Procedural texture atlas (4x4 tiles, 16px each) ----------
export const ATLAS_COLS = 8;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return (s >>> 8) / 16777216;
  };
}

// Tileable value noise (period p) for realistic surface detail.
function makeNoise(seed: number) {
  const r = rng(seed);
  const g = new Float32Array(256 * 256).map(() => r());
  const at = (x: number, y: number, p: number) => g[((((y % p) + p) % p) << 8) | (((x % p) + p) % p)];
  const sm = (t: number) => t * t * (3 - 2 * t);
  const n = (x: number, y: number, p: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = at(xi, yi, p), b = at(xi + 1, yi, p), c = at(xi, yi + 1, p), d = at(xi + 1, yi + 1, p);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  // fbm over u,v in [0,1)
  return (u: number, v: number, base = 4, oct = 4) => {
    let s = 0, amp = 0.5, tot = 0, f = base;
    for (let o = 0; o < oct; o++) { s += n(u * f, v * f, f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  };
}

export function drawAtlas(): HTMLCanvasElement {
  const T = 128; // high-res procedural surfaces
  const c = document.createElement("canvas");
  c.width = c.height = T * ATLAS_COLS;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(c.width, c.height);
  const r = rng(1337);
  const N = makeNoise(7), M = makeNoise(99);
  // f receives u,v in [0,1), per-pixel random n
  const put = (tile: number, f: (u: number, v: number, n: number) => number[] | null) => {
    const ox = (tile % ATLAS_COLS) * T, oy = Math.floor(tile / ATLAS_COLS) * T;
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const col = f(x / T, y / T, r());
        if (!col) continue;
        const i = ((oy + y) * c.width + ox + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, col[0]));
        img.data[i + 1] = Math.max(0, Math.min(255, col[1]));
        img.data[i + 2] = Math.max(0, Math.min(255, col[2]));
        img.data[i + 3] = col[3] ?? 255;
      }
  };
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
  const mul = (a: number[], k: number) => a.map((v) => v * k);

  const grassCol = (u: number, v: number, n: number) => {
    const big = N(u, v, 2, 3), fine = M(u, v, 16, 2);
    let col = mix([168, 132, 52], [214, 182, 92], big);
    col = mix(col, [130, 128, 58], Math.max(0, fine - 0.6) * 2);
    return mul(col, 0.82 + fine * 0.3 + (n - 0.5) * 0.12);
  };
  const dirtCol = (u: number, v: number, n: number) => {
    const big = N(u + 0.3, v, 4, 4), peb = M(u, v, 16, 1);
    let col = mix([128, 52, 30], [176, 82, 44], big);
    if (peb > 0.72) col = mix(col, [196, 120, 70], (peb - 0.72) * 4);
    return mul(col, 0.88 + (n - 0.5) * 0.18);
  };
  const stoneCol = (u: number, v: number, n: number) => {
    const big = N(u, v + 0.5, 3, 5), cr = Math.abs(M(u, v, 4, 3) - 0.5);
    let col = mix([128, 108, 92], [184, 162, 138], big);
    if (cr < 0.025) col = mul(col, 0.6);
    return mul(col, 0.9 + (n - 0.5) * 0.12);
  };
  put(0, grassCol);
  put(1, (u, v, n) => {
    const edge = 0.14 + N(u, 0.5, 8, 2) * 0.16;
    if (v < edge) return grassCol(u, v, n);
    const d = dirtCol(u, v, n);
    return v < edge + 0.05 ? mul(d, 0.75) : d;
  });
  put(2, dirtCol);
  put(3, stoneCol);
  // bark: vertical grain
  put(4, (u, v, n) => {
    const g = N(u * 1, v * 0.15, 8, 3), ridge = Math.abs(Math.sin((u * 6 + g * 1.5) * Math.PI));
    return mul(mix([78, 68, 58], [134, 120, 102], ridge * 0.8 + g * 0.3), 0.9 + (n - 0.5) * 0.15);
  });
  // log top: rings
  put(5, (u, v, n) => {
    const dx = u - 0.5, dy = v - 0.5, d = Math.hypot(dx, dy) + N(u, v, 4, 2) * 0.04;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 0.44) return mul([96, 82, 66], 0.9 + (n - 0.5) * 0.2);
    const ring = 0.5 + 0.5 * Math.sin(d * 70);
    return mul(mix([168, 96, 60], [206, 140, 92], ring), 0.95 + (n - 0.5) * 0.1);
  });
  put(6, (u, v, n) => {
    // dense acacia foliage: small leaflet clusters, only a few tiny gaps
    const l = M(u, v, 16, 3), big = N(u, v, 4, 2);
    if (l < 0.22 && n > 0.4) return [0, 0, 0, 0];
    const base = mix([86, 112, 40], [150, 160, 70], big);
    return mul(base, 0.8 + l * 0.4 + (n - 0.5) * 0.18);
  });
  put(7, (u, v, n) => mul(mix([214, 170, 112], [236, 200, 140], N(u, v, 8, 3)), 0.94 + (n - 0.5) * 0.14));
  put(8, (u, v, n) => {
    const row = Math.floor(v * 4), fv = v * 4 - row;
    if (fv > 0.93) return [70, 34, 22];
    const seam = (row % 2 ? 0.3 : 0.8);
    if (Math.abs(u - seam) < 0.012) return [82, 40, 26];
    const grain = N(u * 0.2 + row * 0.37, v * 3, 8, 3);
    return mul(mix([132, 64, 38], [176, 96, 58], grain), 0.92 + (n - 0.5) * 0.08);
  });
  put(9, (u, v, n) => {
    // irregular cobbles via cellular-ish noise
    const a = M(u, v, 4, 1), b = N(u, v, 8, 2);
    const edge = Math.abs(a - 0.5) < 0.04;
    const col = mix([120, 98, 80], [180, 156, 128], b);
    return mul(edge ? mul(col, 0.45) : col, 0.9 + (n - 0.5) * 0.15);
  });
  put(10, (u, v, n) => {
    const row = Math.floor(v * 8), off = row % 2 ? 0.125 : 0;
    const fv = v * 8 - row, fu = ((u + off) * 4) % 1;
    if (fv > 0.84 || fu > 0.94) return mul([196, 164, 120], 0.9 + N(u, v, 16, 2) * 0.2);
    const tint = M(Math.floor((u + off) * 4) / 4, row / 8, 4, 1);
    return mul(mix([168, 82, 44], [206, 118, 66], tint), 0.85 + N(u, v, 16, 3) * 0.3);
  });
  put(11, (u, v) => {
    const b = 1 / 16;
    if (u < b || v < b || u > 1 - b || v > 1 - b) return [200, 225, 232, 255];
    if (Math.abs(u - v - 0.1) < 0.03 && u > 0.15 && u < 0.45) return [240, 250, 255, 255];
    return [0, 0, 0, 0];
  });
  put(12, (u, v, n) => mul(mix([30, 30, 32], [90, 90, 90], N(u, v, 4, 4)), 0.9 + (n - 0.5) * 0.3));
  // tools: original 16px pixel art scaled up
  const px = (f: (x: number, y: number) => number[] | null) => (u: number, v: number) => f(Math.floor(u * 16), Math.floor(v * 16));
  const handle = (x: number, y: number) => x + y === 15 && x >= 2 && x <= 11;
  put(13, px((x, y) => {
    if ((y === 2 && x >= 6 && x <= 14) || (x === 13 && y >= 2 && y <= 9) || (y === 3 && x >= 8 && x <= 13) || (x === 12 && y >= 3 && y <= 7))
      return [170, 180, 190, 255];
    if (handle(x, y)) return [120, 85, 45, 255];
    return [0, 0, 0, 0];
  }));
  put(14, px((x, y) => {
    if (x >= 8 && x <= 13 && y >= 1 && y <= 6 && x + y >= 11) return [170, 180, 190, 255];
    if (handle(x, y)) return [120, 85, 45, 255];
    return [0, 0, 0, 0];
  }));
  put(15, px((x, y) => {
    if (x >= 10 && x <= 14 && y >= 1 && y <= 5 && Math.abs(x - 12) + Math.abs(y - 3) <= 3) return [170, 180, 190, 255];
    if (handle(x, y)) return [120, 85, 45, 255];
    return [0, 0, 0, 0];
  }));
  // tall savanna grass: tapered blades with alpha cut-out
  const blades = Array.from({ length: 14 }, (_, i) => ({ x: 0.05 + (i / 14) * 0.9 + (r() - 0.5) * 0.05, h: 0.45 + r() * 0.55, w: 0.025 + r() * 0.02, lean: (r() - 0.5) * 0.25, t: r() }));
  put(16, (u, v, n) => {
    const y = 1 - v; // 0 bottom .. 1 top
    for (const b of blades) {
      if (y > b.h) continue;
      const k = y / b.h, cx = b.x + b.lean * k * k, w = b.w * (1 - k * 0.85);
      if (Math.abs(u - cx) < w) {
        const base = mix([110, 120, 40], [214, 186, 96], k * 0.7 + b.t * 0.4);
        return [...mul(base, 0.85 + (n - 0.5) * 0.15), 255];
      }
    }
    return [0, 0, 0, 0];
  });
  // plant sprite helper: tapered stems with optional heads
  const sprite = (tile: number, n0: number, stem: number[], head: ((k: number) => number[]) | null, hmin: number, hmax: number, wid: number) => {
    const st = Array.from({ length: n0 }, (_, i) => ({ x: 0.08 + (i / n0) * 0.84 + (r() - 0.5) * 0.06, h: hmin + r() * (hmax - hmin), w: wid * (0.7 + r() * 0.6), lean: (r() - 0.5) * 0.3, k: r() }));
    put(tile, (u, v, n) => {
      const y = 1 - v;
      for (const b of st) {
        if (y > b.h + 0.08) continue;
        const k = Math.min(1, y / b.h), cx = b.x + b.lean * k * k;
        if (head && y > b.h - 0.06 && Math.hypot((u - cx) * 1.2, y - b.h) < 0.075) return [...head(b.k).map((c) => c * (0.85 + (n - 0.5) * 0.2)), 255];
        if (y <= b.h && Math.abs(u - cx) < b.w * (1 - k * 0.6)) return [...mul(stem, 0.8 + k * 0.35 + (n - 0.5) * 0.15), 255];
      }
      return [0, 0, 0, 0];
    });
  };
  const petals = [[220, 50, 40], [245, 200, 40], [90, 120, 220], [240, 240, 230], [230, 110, 30]];
  sprite(17, 9, [80, 120, 40], (k) => petals[Math.floor(k * petals.length)], 0.3, 0.7, 0.018);
  sprite(18, 8, [96, 132, 50], () => [150, 160, 80], 0.75, 0.98, 0.022);
  // aloe: fleshy rosette of spiky leaves fanning from the base
  put(19, (u, v, n) => {
    const y = 1 - v, dx = u - 0.5;
    for (let i = 0; i < 7; i++) {
      const ang = -1.2 + (i / 6) * 2.4, len = 0.55 + ((i * 37) % 5) * 0.06;
      const t = (dx * Math.sin(ang) + y * Math.cos(ang)) / len, off = Math.abs(dx * Math.cos(ang) - y * Math.sin(ang));
      if (t > 0 && t < 1 && off < 0.07 * (1 - t)) return [...mul(mix([70, 110, 80], [120, 150, 100], t), 0.85 + (n - 0.5) * 0.2), 255];
    }
    if (y > 0.5 && y < 0.95 && Math.abs(dx - 0.05) < 0.012) return [120, 100, 60, 255];
    if (y > 0.85 && y < 0.98 && Math.abs(dx - 0.05) < 0.04) return [230, 90, 40, 255];
    return [0, 0, 0, 0];
  });
  put(20, (u, v, n) => {
    const w = N(u, v, 4, 3), rip = 0.5 + 0.5 * Math.sin((u + w * 0.6) * Math.PI * 8);
    return [...mul(mix([40, 110, 150], [80, 170, 200], w * 0.7 + rip * 0.3), 0.95 + (n - 0.5) * 0.06), 255];
  });
  const jgCol = (u: number, v: number, n: number) => {
    const big = N(u, v, 2, 3), fine = M(u, v, 16, 2);
    return mul(mix([46, 104, 34], [86, 150, 50], big), 0.82 + fine * 0.3 + (n - 0.5) * 0.12);
  };
  put(21, jgCol);
  put(22, (u, v, n) => {
    const edge = 0.16 + N(u, 0.5, 8, 2) * 0.18;
    return v < edge ? jgCol(u, v, n) : dirtCol(u, v, n);
  });
  // fern: arching fronds with leaflets
  put(23, (u, v, n) => {
    const y = 1 - v, dx = u - 0.5;
    for (let i = 0; i < 5; i++) {
      const ang = -1.0 + (i / 4) * 2.0;
      const t = (dx * Math.sin(ang) + y * Math.cos(ang)) / 0.8, off = dx * Math.cos(ang) - y * Math.sin(ang);
      if (t <= 0 || t >= 1) continue;
      const bend = off + t * t * 0.15 * Math.sign(ang || 1);
      if (Math.abs(bend) < 0.012) return [60, 100, 30, 255];
      if (Math.abs(bend) < 0.09 * (1 - t) && Math.sin(t * 60) > -0.2) return [...mul([60, 130, 45], 0.8 + t * 0.4 + (n - 0.5) * 0.15), 255];
    }
    return [0, 0, 0, 0];
  });
  // castle ashlar: weathered grey dressed stone in staggered courses
  const ashlar = (u: number, v: number, n: number, moss: boolean) => {
    const row = Math.floor(v * 4), off = row % 2 ? 0.25 : 0;
    const fv = v * 4 - row, fu = ((u + off) * 2) % 1;
    const big = N(u, v, 4, 4), grit = M(u, v, 16, 2);
    const blockTint = M(Math.floor((u + off) * 2) / 2 + row * 0.13, row / 4, 4, 1);
    if (fv > 0.9 || fu > 0.955) return mul([88, 86, 82], 0.85 + grit * 0.3);
    let col = mix([122, 120, 114], [168, 165, 156], big * 0.6 + blockTint * 0.5);
    if (fv < 0.07 || fu < 0.03) col = mul(col, 1.12); // chipped top edge highlight
    if (moss && N(u + 0.2, v, 3, 3) + (1 - v) * 0.15 > 0.58) col = mix(col, [74, 98, 46], 0.75 + grit * 0.25);
    return mul(col, 0.88 + grit * 0.2 + (n - 0.5) * 0.1);
  };
  put(24, (u, v, n) => ashlar(u, v, n, false));
  put(25, (u, v, n) => ashlar(u, v, n, true));
  // dark spruce roof boards
  put(26, (u, v, n) => {
    const col = Math.floor(u * 5), fu = u * 5 - col;
    if (fu > 0.94) return [36, 26, 18];
    const grain = N(u * 0.3 + col * 0.41, v * 0.25, 8, 3);
    return mul(mix([62, 44, 30], [102, 74, 50], grain), 0.9 + (n - 0.5) * 0.1);
  });
  // iron lantern: dark frame, glowing amber pane with a flame core
  put(27, (u, v, n) => {
    const e = Math.min(u, v, 1 - u, 1 - v);
    if (e < 0.1 || Math.abs(u - 0.5) < 0.03 || Math.abs(v - 0.5) < 0.03) return mul([42, 36, 32], 0.9 + n * 0.2);
    const d = Math.hypot(u - 0.5, (v - 0.55) * 0.8);
    return mix([255, 236, 170], [228, 120, 34], d * 2.4).map((c) => c * (0.95 + n * 0.08));
  });
  // oak door: vertical planks, iron bands, ring handle
  put(28, (u, v, n) => {
    if (Math.min(u, 1 - u) < 0.06 || Math.min(v, 1 - v) < 0.04) return mul([58, 38, 22], 0.9 + n * 0.15);
    if (Math.abs(v - 0.22) < 0.035 || Math.abs(v - 0.78) < 0.035) return mul([60, 60, 64], 0.85 + n * 0.3);
    if (Math.hypot(u - 0.78, v - 0.52) < 0.05) return [40, 40, 44];
    const col = Math.floor(u * 4), fu = u * 4 - col;
    if (fu < 0.06) return [48, 30, 18];
    const grain = N(u * 0.3 + col * 0.37, v * 0.2, 8, 3);
    return mul(mix([92, 58, 32], [128, 84, 48], grain), 0.92 + (n - 0.5) * 0.12);
  });
  // lime plaster daub
  put(29, (u, v, n) => {
    const big = N(u, v, 4, 3), fine = M(u, v, 16, 2);
    return mul(mix([206, 196, 172], [236, 230, 214], big), 0.92 + fine * 0.1 + (n - 0.5) * 0.06);
  });
  // straw thatch: layered golden reed bundles
  put(30, (u, v, n) => {
    const row = Math.floor(v * 4), fv = v * 4 - row;
    const streak = N(u * 1.0 + row * 0.3, v * 0.1, 16, 2);
    let col = mix([150, 116, 56], [210, 176, 98], streak);
    if (fv > 0.86) col = mul(col, 0.6);
    return mul(col, 0.9 + (n - 0.5) * 0.15);
  });
  // ---------- modern city tiles ----------
  const asphalt = (u: number, v: number, n: number) => {
    const g = M(u, v, 16, 2);
    return mul([58, 58, 62], 0.85 + g * 0.3 + (n - 0.5) * 0.25);
  };
  put(31, asphalt);
  // concrete slab with expansion joints
  put(32, (u, v, n) => {
    if (u < 0.03 || v < 0.03) return mul([140, 138, 132], 0.9 + n * 0.1);
    const big = N(u, v, 4, 3);
    return mul(mix([168, 166, 160], [196, 194, 188], big), 0.94 + (n - 0.5) * 0.1);
  });
  // office window: blue-grey reflective pane, thin frame, sky gradient highlight
  put(33, (u, v, n) => {
    if (Math.min(u, v, 1 - u, 1 - v) < 0.06) return mul([70, 76, 84], 0.95 + n * 0.1);
    let col = mix([150, 190, 220], [52, 78, 110], v);
    if (Math.abs(u - v - 0.1) < 0.08) col = mix(col, [230, 240, 250], 0.45); // reflection streak
    if (N(u, v, 2, 2) > 0.62) col = mix(col, [255, 214, 140], 0.35); // lit office
    return mul(col, 0.96 + (n - 0.5) * 0.06);
  });
  // brushed steel cladding
  put(34, (u, v, n) => {
    const streak = M(u * 0.2, v * 3, 16, 2);
    let col = mix([96, 102, 110], [140, 146, 154], streak);
    if (u < 0.04 || u > 0.96) col = mul(col, 0.7);
    return mul(col, 0.95 + (n - 0.5) * 0.08);
  });
  // asphalt with painted white marking
  put(35, (u, v, n) => {
    if (Math.abs(u - 0.5) < 0.3) return mul([232, 230, 220], 0.92 + n * 0.08);
    return asphalt(u, v, n);
  });
  // ---------- Linefield cyberpunk tiles (36..58) ----------
  // sci-fi panel: flat colour, recessed seams, bevel highlight, subtle grime
  const panel = (base: number[], seams = 2) => (u: number, v: number, n: number) => {
    const fu = (u * seams) % 1, fv = (v * seams) % 1;
    const g = N(u, v, 4, 4), brush = M(u * 0.15, v * 6, 32, 2), grime = N(u + 0.4, v, 2, 3);
    let col = mul(base, 0.88 + g * 0.14 + brush * 0.08 + (n - 0.5) * 0.03);
    col = mul(col, 1 - Math.max(0, grime - 0.6) * 0.5 - Math.max(0, v - 0.85) * 0.25); // runoff grime toward the base
    // hex bolts in each panel corner
    for (const [bu, bv] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
      const d = Math.hypot(fu - bu, fv - bv);
      if (d < 0.035) return mul(base, d < 0.018 ? 1.35 : 0.6);
    }
    // chamfered recessed seams: dark trough, lit upper/left bevel, shaded lower/right bevel
    if (fu < 0.02 || fv < 0.02) return mul(base, 0.35);
    if (fu < 0.045 || fv < 0.045) return mul(col, 1.22);
    if (fu > 0.965 || fv > 0.965) return mul(col, 0.72);
    return col;
  };
  const clad = (base: number[]) => (u: number, v: number, n: number) => {
    const rib = (u * 8) % 1, row = Math.floor(v * 2), fv = v * 2 - row;
    let col = mul(base, 0.86 + N(u, v, 8, 4) * 0.2 + M(u, v * 0.2, 32, 2) * 0.06 + (n - 0.5) * 0.04);
    // anodised ribbed siding: rounded rib profile with crisp shadow troughs
    const prof = Math.sin(rib * Math.PI);
    col = mul(col, 0.7 + prof * 0.4);
    if (rib < 0.05) col = mul(base, 0.45);
    if (fv > 0.975) col = mul(base, 0.4); // horizontal panel joint
    else if (fv > 0.955) col = mul(col, 1.15);
    return col;
  };
  // frameless polarized smart-glass: smooth tint gradient + faint data scanlines
  const glassT = (_frame: number[], pane: number[], glow: number) => (u: number, v: number, n: number) => {
    let col = mix(mul(pane, 1.1), mul(pane, 0.6), v * 0.9 + N(u, v, 2, 2) * 0.1);
    if (((v * 32) % 1) < 0.12) col = mul(col, 1.08);
    if (glow) col = mix(col, mul(pane, 1.5), glow * (1 - Math.abs(v - 0.5) * 2));
    return mul(col, 0.98 + (n - 0.5) * 0.02);
  };
  const lamp = (core: number[], rim: number[]) => (u: number, v: number, n: number) => {
    const e = Math.min(u, v, 1 - u, 1 - v);
    if (e < 0.08) return mul(rim, 0.9 + n * 0.15);
    const d = Math.hypot(u - 0.5, v - 0.5);
    return mix([255, 255, 255], core, d * 1.6 + N(u, v, 8, 2) * 0.2);
  };
  put(36, panel([34, 36, 44]));
  put(37, panel([112, 116, 124]));
  put(38, panel([214, 216, 222]));
  put(39, panel([30, 140, 150]));
  put(40, (u, v, n) => {
    const fu = (u * 4) % 1, fv = (v * 4) % 1;
    const c = mix([22, 70, 64], [44, 104, 92], N(u, v, 8, 3));
    return fu < 0.06 || fv < 0.06 ? mul(c, 0.5) : mul(c, 0.95 + (n - 0.5) * 0.1);
  });
  put(41, clad([58, 92, 96]));
  put(42, clad([150, 62, 50]));
  put(43, clad([170, 92, 44]));
  put(44, clad([190, 140, 46]));
  put(45, clad([84, 110, 52]));
  put(46, clad([60, 100, 170]));
  put(47, clad([120, 64, 130]));
  put(48, glassT([20, 22, 28], [26, 32, 48], 0));
  put(49, glassT([20, 40, 48], [40, 220, 240], 0.35));
  put(50, glassT([40, 20, 40], [240, 60, 200], 0.35));
  put(51, px((x, y) => (x % 4 === 1 || y === 0 || y === 15 ? [70, 74, 80, 255] : [0, 0, 0, 0])));
  put(52, (u, v) => mix([200, 250, 255], [90, 210, 230], Math.abs(v - 0.5) * 2)); // seamless light panel
  put(53, lamp([255, 190, 80], [160, 110, 50]));
  put(54, lamp([120, 240, 255], [60, 70, 90]));
  put(55, lamp([255, 80, 220], [70, 40, 80]));
  put(56, (u, v, n) => {
    const fu = (u * 2) % 1;
    const c = mix([82, 86, 94], [130, 136, 146], M(u * 0.3, v * 2, 16, 2));
    if (fu < 0.03) return mul(c, 0.55);
    if (Math.hypot(((u * 2) % 1) - 0.12, ((v * 2) % 1) - 0.12) < 0.05) return mul(c, 1.3);
    return mul(c, 0.95 + (n - 0.5) * 0.08);
  });
  put(57, glassT([48, 36, 16], [255, 190, 60], 0.35));
  put(58, clad([96, 66, 46]));
  ctx.putImageData(img, 0, 0);
  return c;
}
