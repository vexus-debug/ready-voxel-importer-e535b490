// @ts-nocheck
// Utopia above the sky megacity, imported 1:1 from the Minecraft map (640x640, y 0..255, world coords == MC coords).
// Stored as 64 gzip tiles (64x64 columns each) of per-column runs: [u16 runCount][(u8 id, u8 len)...] bottom-up.
// Tiles stream in on demand when nearby chunks generate; world.ts restamps chunks once a tile arrives.
// Must not import values from world.ts at module scope (world.ts imports this module).
// Tiles are bundled as static files in public/linefield/lf_X_Z.bin.

export const LF_SIZE = 640;
export const LF_TS = 64; // tile size in columns
export const LF_YN = 256; // stored layers
export const LF_BASE = 0; // world y of the lowest stored layer
export const LF_GROUND = 118; // sky-dock / central plaza level
export const LF_X0 = -304; // world min corner == Minecraft coords
export const LF_Z0 = -304;
export const LF_CX = LF_X0 + LF_SIZE / 2, LF_CZ = LF_Z0 + LF_SIZE / 2;

interface Tile { data: Uint8Array; off: Uint32Array }
import { setLoading } from "./loading";

const tiles = new Map<string, Tile>();
if (typeof window !== "undefined") queueMicrotask(() => lfTile(0, 0)); // start the master download immediately
const listeners: ((tx: number, tz: number) => void)[] = [];
const ready: (() => void)[] = [];
/** fires once the whole bundle is in memory */
export const onLinefieldReady = (f: () => void) => (tiles.size >= NT * NT ? f() : ready.push(f));
export const onLinefieldTile = (f: (tx: number, tz: number) => void) => listeners.push(f);

const NT = LF_SIZE / LF_TS;
let started = false;
/** One request for the whole city: gzip(header of 64 x [u32 offset, u32 length], tile bodies). */
async function loadAll() {
  try {
    const res = await fetch(`/linefield/utopia_all.bin`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = +(res.headers.get("content-length") || 0);
    let buf: Uint8Array;
    if (res.body && total) {
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); got += value.length;
        setLoading({ progress: Math.min(0.99, got / total) });
      }
      buf = new Uint8Array(got);
      let o = 0;
      for (const p of parts) { buf.set(p, o); o += p.length; }
    } else buf = new Uint8Array(await res.arrayBuffer());
    setLoading({ progress: 1, stage: "Building spawn area" });
    // tolerate servers that already stripped the gzip layer
    const all = buf[0] === 0x1f && buf[1] === 0x8b
      ? new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer())
      : buf;
    const dv = new DataView(all.buffer, all.byteOffset, all.byteLength);
    const hdr = NT * NT * 8;
    for (let i = 0; i < NT * NT; i++) {
      const o = dv.getUint32(i * 8, true), len = dv.getUint32(i * 8 + 4, true);
      const data = all.subarray(hdr + o, hdr + o + len);
      const off = new Uint32Array(LF_TS * LF_TS);
      let p = 0;
      for (let j = 0; j < off.length; j++) { off[j] = p; p += 2 + (data[p] | (data[p + 1] << 8)) * 2; }
      tiles.set(`${i % NT}_${(i / NT) | 0}`, { data, off });
    }
    for (let i = 0; i < NT * NT; i++) for (const f of listeners) f(i % NT, (i / NT) | 0);
    for (const f of ready) f();
    setLoading({ lfReady: true });
  } catch (e) {
    console.warn("Linefield bundle failed", e);
    started = false;
    setLoading({ lfReady: true, progress: 1, stage: "Building spawn area" });
  }
}

/** Tile (tx,tz) or null; the first call starts the single master download. */
export function lfTile(tx: number, tz: number): Tile | null {
  const t = tiles.get(`${tx}_${tz}`);
  if (t) return t;
  if (!started) { started = true; loadAll(); }
  return null;
}

/** Writes column runs into `out(y, id)`; returns false if the tile is not loaded yet. */
export function lfColumn(u: number, v: number, out: (y: number, id: number) => void) {
  const t = lfTile((u / LF_TS) | 0, (v / LF_TS) | 0);
  if (!t) return false;
  const { data } = t;
  let p = t.off[(v % LF_TS) * LF_TS + (u % LF_TS)];
  const n = data[p] | (data[p + 1] << 8);
  p += 2;
  let y = LF_BASE;
  for (let r = 0; r < n; r++, p += 2) {
    const id = data[p], len = data[p + 1];
    if (id) for (let k = 0; k < len; k++) out(y + k, id);
    y += len;
  }
  return true;
}

/** Top solid y of a column (LF_BASE - 1 if empty). Bundle must be loaded. */
function colTop(u: number, v: number) {
  let top = LF_BASE - 1;
  lfColumn(u, v, (y) => { if (y > top) top = y; });
  return top;
}
export const SPAWN_X = -166, SPAWN_Y = 118, SPAWN_Z = 172;
/** Nearest standable spot (solid floor + 2 air) to the Minecraft spawn, preferring y close to SPAWN_Y. */
export function lfFindStreet(): [number, number, number] | null {
  for (let r = 0; r < 24; r++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const u = SPAWN_X + dx - LF_X0, v = SPAWN_Z + dz - LF_Z0;
        const col = new Uint8Array(LF_YN + 3);
        lfColumn(u, v, (y, id) => { if (y < col.length) col[y] = id; });
        for (let d = 0; d < 40; d++)
          for (const y of [SPAWN_Y - 1 - d, SPAWN_Y - 1 + d])
            if (y > 0 && col[y] && !col[y + 1] && !col[y + 2]) return [LF_X0 + u, y + 1, LF_Z0 + v];
      }
  return null;
}
