import { useEffect, useRef, useState } from "react";
import { getGame, emit, saveGame, useUI } from "./state";
import { WATER_LEVEL } from "./world";
import { getLandmarks, LANDMARK_GLYPH, mapView } from "./landmarks";
import { touch } from "./touch";

// Parchment palette (map-only artwork colours, rendered into a canvas)
const INK = [58, 38, 22];
function terrainColor(world: any, x: number, z: number): [number, number, number] {
  const h = world.height(x, z);
  const { desert, jungle } = world.biome(x, z);
  if (h < WATER_LEVEL) {
    const d = Math.min(1, (WATER_LEVEL - h) / 8);
    return [120 - d * 40, 150 - d * 35, 150 - d * 20];
  }
  let c: [number, number, number] = [196, 178, 120]; // savanna ochre
  const mix = (t: number, r: number, g: number, b: number) => { c = [c[0] + (r - c[0]) * t, c[1] + (g - c[1]) * t, c[2] + (b - c[2]) * t]; };
  mix(desert, 226, 200, 140);
  mix(jungle, 112, 132, 78);
  if (world.isMountain(x, z) && h > 30) mix(Math.min(1, (h - 30) / 14), 140, 128, 112);
  if (h > 44) mix(Math.min(1, (h - 44) / 6), 236, 230, 214);
  const shade = 0.82 + Math.min(0.3, (h - WATER_LEVEL) / 80);
  return [c[0] * shade, c[1] * shade, c[2] * shade];
}

function draw(cv: HTMLCanvasElement, cx: number, cz: number, scale: number, full: boolean) {
  const g = getGame();
  const w = cv.width, h = cv.height;
  const ctx = cv.getContext("2d")!;
  const step = full ? 3 : 2; // pixels per sample
  const img = ctx.createImageData(w, h);
  const cols = Math.ceil(w / step), rows = Math.ceil(h / step);
  const hs: number[] = new Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const wx = Math.floor(cx + (i * step - w / 2) * scale), wz = Math.floor(cz + (j * step - h / 2) * scale);
      hs[j * cols + i] = g.world.height(wx, wz);
      const [r, gg, b] = terrainColor(g.world, wx, wz);
      for (let py = 0; py < step; py++)
        for (let px = 0; px < step; px++) {
          const X = i * step + px, Y = j * step + py;
          if (X >= w || Y >= h) continue;
          const o = (Y * w + X) * 4;
          const grain = ((X * 7 + Y * 13) % 5) - 2;
          img.data[o] = r + grain; img.data[o + 1] = gg + grain; img.data[o + 2] = b + grain; img.data[o + 3] = 255;
        }
    }
  ctx.putImageData(img, 0, 0);
  // ink contour lines every 6 blocks + coastline
  ctx.fillStyle = `rgba(${INK.join(",")},0.55)`;
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const a = hs[j * cols + i]!, b = hs[j * cols + i + 1]!, c = hs[(j + 1) * cols + i]!;
      const band = (v: number) => (v < WATER_LEVEL ? -1 : Math.floor(v / 6));
      if (band(a) !== band(b) || band(a) !== band(c)) ctx.fillRect(i * step, j * step, full ? 1.5 : 1, full ? 1.5 : 1);
    }
  // vignette / aged edges
  const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  gr.addColorStop(0, "rgba(90,60,30,0)");
  gr.addColorStop(1, "rgba(90,60,30,0.45)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
}

function Markers({ cx, cz, scale, w, h, labels }: { cx: number; cz: number; scale: number; w: number; h: number; labels: boolean }) {
  const g = getGame();
  const toPx = (x: number, z: number) => ({ left: (x - cx) / scale + w / 2, top: (z - cz) / scale + h / 2 });
  const p = toPx(g.pos.x, g.pos.z);
  return (
    <>
      {getLandmarks(g.world).map((l) => {
        const q = toPx(l.x, l.z);
        if (q.left < -10 || q.top < -10 || q.left > w + 10 || q.top > h + 10) return null;
        return (
          <div key={l.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center leading-none" style={{ ...q, color: "#3a2616" }}>
            <div className={labels ? "text-3xl" : "text-lg"} style={{ textShadow: "0 0 3px #f1e3bf" }}>{LANDMARK_GLYPH[l.kind]}</div>
            {labels && <div className="mt-0.5 whitespace-nowrap text-base italic" style={{ textShadow: "0 0 3px #f1e3bf" }}>{l.name}</div>}
          </div>
        );
      })}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ ...p, transform: `translate(-50%,-50%) rotate(${mapView.heading}rad)` }}>
        <svg width={labels ? 22 : 16} height={labels ? 22 : 16} viewBox="0 0 20 20"><path d="M10 1 L17 18 L10 13 L3 18 Z" fill="#9b1c1c" stroke="#3a2616" strokeWidth="1.5" /></svg>
      </div>
    </>
  );
}

const frame = { background: "#e9d9ae", border: "4px double #5a3d22", boxShadow: "0 4px 18px rgba(30,15,5,.55), inset 0 0 30px rgba(110,70,30,.5)" };

export function MiniMap() {
  useUI();
  const ref = useRef<HTMLCanvasElement>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const g = getGame();
      if (ref.current) draw(ref.current, g.pos.x, g.pos.z, 1, false);
      tick((t) => t + 1);
    }, 400);
    return () => clearInterval(id);
  }, []);
  const g = getGame();
  const S = 128;
  return (
    <div className="pointer-events-auto absolute right-4 top-4 cursor-pointer" onPointerDown={() => {
      mapView.open = true;
      if (!touch.enabled) getGame().controls?.unlock?.();
      emit();
    }}>
      <div className="relative overflow-hidden rounded-full" style={{ width: S, height: S, ...frame }}>
        <canvas ref={ref} width={S} height={S} className="absolute inset-0" />
        <Markers cx={g.pos.x} cz={g.pos.z} scale={1} w={S - 8} h={S - 8} labels={false} />
        <div className="absolute left-1/2 top-0.5 -translate-x-1/2 text-sm leading-none" style={{ color: "#3a2616" }}>N</div>
      </div>
      <div className="mt-1 text-center text-sm" style={{ color: "#f1e3bf", textShadow: "0 1px 2px #000" }}>
        {Math.round(g.pos.x)}, {Math.round(g.pos.z)} · M
      </div>
    </div>
  );
}

export function RealmMap() {
  const ui = useUI();
  const ref = useRef<HTMLCanvasElement>(null);
  const g = getGame();
  const [view, setView] = useState({ cx: g.pos.x, cz: g.pos.z, scale: 3 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const W = 720, Hh = 480;
  useEffect(() => { if (mapView.open) setView((v) => ({ ...v, cx: g.pos.x, cz: g.pos.z })); }, [mapView.open]); // eslint-disable-line
  useEffect(() => { if (mapView.open && ref.current) draw(ref.current, view.cx, view.cz, view.scale, true); }, [view, ui.locked, mapView.open]); // eslint-disable-line
  if (!mapView.open) return null;
  const close = () => { mapView.open = false; emit(); };
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center" style={{ background: "rgba(20,10,5,.6)" }} onPointerDown={close}>
      <div className="relative p-3" style={frame} onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between px-1" style={{ color: "#3a2616" }}>
          <span className="text-3xl tracking-wide">⚜ Map of the Realm ⚜</span>
          <div className="flex gap-1 text-xl">
            <button className="rounded border-2 px-2" style={{ borderColor: "#5a3d22" }} onClick={() => setView((v) => ({ ...v, scale: Math.max(1, v.scale / 1.5) }))}>＋</button>
            <button className="rounded border-2 px-2" style={{ borderColor: "#5a3d22" }} onClick={() => setView((v) => ({ ...v, scale: Math.min(12, v.scale * 1.5) }))}>－</button>
            <button className="rounded border-2 px-2" style={{ borderColor: "#5a3d22" }} onClick={() => setView((v) => ({ ...v, cx: g.pos.x, cz: g.pos.z }))}>◎</button>
            <button className="rounded border-2 px-2" style={{ borderColor: "#5a3d22" }} onClick={close}>✕</button>
          </div>
        </div>
        <div
          className="relative touch-none overflow-hidden"
          style={{ width: `min(${W}px, 86vw)`, aspectRatio: `${W}/${Hh}`, border: "2px solid #5a3d22" }}
          onWheel={(e) => setView((v) => ({ ...v, scale: Math.min(12, Math.max(1, v.scale * (e.deltaY > 0 ? 1.2 : 1 / 1.2))) }))}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY };
            gestureStart.current = { x: e.clientX, y: e.clientY };
            didDrag.current = false;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const k = (W / r.width) * view.scale;
            const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
            const start = gestureStart.current;
            if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) didDrag.current = true;
            drag.current = { x: e.clientX, y: e.clientY };
            setView((v) => ({ ...v, cx: v.cx - dx * k, cz: v.cz - dy * k }));
          }}
          onPointerUp={(e) => {
            if (drag.current && !didDrag.current) {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const px = (e.clientX - r.left) * (W / r.width);
              const py = (e.clientY - r.top) * (Hh / r.height);
              const wx = Math.round(view.cx + (px - W / 2) * view.scale);
              const wz = Math.round(view.cz + (py - Hh / 2) * view.scale);
              const [x, y, z] = g.world.findDry(wx, wz);
              g.pos.set(x + 0.5, y, z + 0.5);
              g.vel.set(0, 0, 0);
              saveGame();
              if (!touch.enabled) g.controls?.unlock?.();
              close();
            }
            drag.current = null;
            gestureStart.current = null;
          }}
        >
          <canvas ref={ref} width={W} height={Hh} className="absolute inset-0 h-full w-full" />
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: Hh, transform: `scale(${1})` }}>
            <Markers cx={view.cx} cz={view.cz} scale={view.scale} w={W} h={Hh} labels />
          </div>
          <div className="pointer-events-none absolute bottom-2 right-3 text-center leading-none" style={{ color: "#3a2616" }}>
            <div className="text-4xl">✵</div><div className="text-base">N</div>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-3 text-sm italic" style={{ color: "#3a2616" }}>
            Tap to teleport · drag to pan · scroll / ＋－ to zoom · M to close
          </div>
        </div>
      </div>
    </div>
  );
}
