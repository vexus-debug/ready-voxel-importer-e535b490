// @ts-nocheck
// Linefield cyberpunk downtown, imported 1:1 from the Minecraft map (512x512 core, 378 layers).
// Stored as 64 gzip tiles (64x64 columns each) of per-column runs: [u16 runCount][(u8 id, u8 len)...] bottom-up.
// Tiles stream in on demand when nearby chunks generate; world.ts restamps chunks once a tile arrives.
// Must not import values from world.ts at module scope (world.ts imports this module).
// Tiles are bundled as static files in public/linefield/lf_X_Z.bin.

export const LF_SIZE = 512;
export const LF_TS = 64; // tile size in columns
export const LF_YN = 378; // stored layers
export const LF_BASE = 17; // world y of the lowest stored layer
export const LF_GROUND = LF_BASE + 5; // street level
export const LF_X0 = 38 - 256; // world min corner (north of the kingdom)
export const LF_Z0 = -1000;
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
    const res = await fetch(`/linefield/linefield_all.bin`);
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
/** Nearest open street spot to the city centre: a 5x5 patch at street level with open sky above. */
export function lfFindStreet(): [number, number, number] | null {
  const c = LF_SIZE / 2, R = 2, M = R + 2;
  for (let r = 0; r < LF_SIZE / 2 - M; r++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const u = c + dx, v = c + dz;
        if (u < M || v < M || u >= LF_SIZE - M || v >= LF_SIZE - M) continue;
        const g = colTop(u, v);
        if (g < LF_GROUND - 2 || g > LF_GROUND + 1) continue;
        let ok = true;
        for (let z = -R; z <= R && ok; z++) for (let x = -R; x <= R && ok; x++) if (colTop(u + x, v + z) !== g) ok = false;
        if (ok) return [LF_X0 + u, g + 1, LF_Z0 + v];
      }
  return null;
}
