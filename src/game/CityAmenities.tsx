// Renders Linefield Phase 3 amenities as InstancedMeshes (one draw call per part) — visual only, no collision.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { onAmenities, type Amenities, type Anchor } from "./amenities";
import { LF_X0, LF_Z0, LF_SIZE } from "./linefield";
import { ui } from "./state";

type Place = (a: Anchor, o: THREE.Object3D) => void;
interface Part { geo: THREE.BufferGeometry; mat: THREE.Material; place: Place }

const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6, ...o });
const glow = (color: string, i = 2.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.3 });

function base(a: Anchor, o: THREE.Object3D) {
  o.position.set(a.x, a.y, a.z); o.rotation.set(0, a.r, 0); o.scale.set(1, 1, 1);
}
const at = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Place => (a, o) => {
  base(a, o); o.translateX(x); o.translateY(y); o.translateZ(z); o.scale.set(sx, sy, sz);
};

function useParts() {
  return useMemo(() => {
    const graphite = std("#2a2f36"), steel = std("#8a93a0", { metalness: 0.8, roughness: 0.35 });
    const yellow = std("#e6b422", { metalness: 0.1 }), white = std("#e8edf2", { metalness: 0.1 });
    const deck = std("#3a3f47", { metalness: 0.2, roughness: 0.8 });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#5fc8e6", transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const led = glow("#fff4dc", 3), cyan = glow("#33f0ff", 3), amber = glow("#ffb02e", 2.5);
    const red = glow("#ff2a2a", 4);
    const concrete = std("#9a9890", { metalness: 0.05, roughness: 0.9 });
    const add = (color: string, opacity: number, map?: THREE.Texture) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, map: map ?? null, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const holo = add("#4ff6ff", 0.55);
    const beam = add("#fff1cf", 0.07);
    const pool = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const g = c.getContext("2d")!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return add("#ffe9bf", 0.35, new THREE.CanvasTexture(c));
    })();
    const cone = (r: number, hgt: number) => { const g = new THREE.ConeGeometry(r, hgt, 16, 1, true); g.translate(0, -hgt / 2, 0); return g; };
    const disc = (r: number) => new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2);
    const drum = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14).rotateX(Math.PI / 2);
    const wire = new THREE.CylinderGeometry(0.018, 0.018, 1, 4); wire.translate(0, 0.5, 0);
    const GUY_R = 4.5;
    const cyl = (rt: number, rb: number, hgt = 1, s = 8, open = false) => {
      const g = new THREE.CylinderGeometry(rt, rb, hgt, s, 1, open); g.translate(0, hgt / 2, 0); return g;
    };
    const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
    const tubeShell = new THREE.CylinderGeometry(1, 1, 3, 14, 1, true); tubeShell.rotateX(Math.PI / 2);
    const dishGeo = new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, 0.9); dishGeo.rotateX(Math.PI * 0.75);
    const flatRing = new THREE.TorusGeometry(3.4, 0.14, 4, 32); flatRing.rotateX(Math.PI / 2);

    const P: Record<keyof Amenities, Part[]> = {
      lights: [
        { geo: cyl(0.07, 0.11, 5.6), mat: graphite, place: at(0, 0, 0) },
        { geo: box(0.09, 0.09, 1.7), mat: graphite, place: at(0, 5.55, 0.8) },
        { geo: box(0.32, 0.06, 0.6), mat: led, place: at(0, 5.47, 1.45) },
        { geo: cone(2.2, 5.4), mat: beam, place: at(0, 5.44, 1.45) },
        { geo: disc(2.6), mat: pool, place: at(0, 0.04, 1.45) },
      ],
      bollards: [
        { geo: cyl(0.12, 0.14, 0.9), mat: graphite, place: at(0, 0, 0) },
        { geo: new THREE.TorusGeometry(0.14, 0.03, 4, 12).rotateX(Math.PI / 2), mat: cyan, place: at(0, 0.72, 0) },
      ],
      rails: [
        { geo: box(0.07, 0.09, 1), mat: steel, place: at(0, 0.95, 0) },
        { geo: box(0.07, 0.09, 1), mat: steel, place: at(0, 0.55, 0) },
        { geo: cyl(0.04, 0.04, 1), mat: steel, place: at(0, 0, 0) },
      ],
      ribs: [
        { geo: new THREE.TorusGeometry(1, 0.06, 5, 20), mat: steel, place: (a, o) => { base(a, o); o.scale.set(a.s, a.s, a.s); } },
        { geo: tubeShell, mat: glass, place: (a, o) => { base(a, o); o.scale.set(a.s, a.s, 1); } },
        // under-bridge Warren truss: bottom chords + diagonals + lateral bracket
        ...[-1, 1].map((sd): Part => ({ geo: box(0.1, 0.1, 3), mat: steel, place: (a, o) => { base(a, o); o.translateY(-a.s - 0.9); o.translateX(sd * a.s * 0.6); } })),
        ...[-1, 1].flatMap((sd) => [-1, 1].map((d): Part => ({ geo: box(0.08, 1.75, 0.08), mat: steel,
          place: (a, o) => { base(a, o); o.translateX(sd * a.s * 0.6); o.translateY(-a.s - 0.45); o.translateZ(d * 0.75); o.rotateX(d * 0.98); } }))),
        { geo: box(1, 0.1, 0.1), mat: steel, place: (a, o) => { base(a, o); o.translateY(-a.s - 0.9); o.scale.set(a.s * 1.2, 1, 1); } },
      ],
      conduits: [-0.25, 0, 0.25].map((x, k): Part => ({
        geo: cyl(0.07 + k * 0.02, 0.07 + k * 0.02, 1, 6), mat: k === 1 ? graphite : steel,
        place: (a: Anchor, o: THREE.Object3D) => { base(a, o); o.translateX(x); o.scale.set(1, a.s, 1); },
      })).concat([{ geo: box(0.9, 0.6, 0.4), mat: graphite, place: (a, o) => { base(a, o); o.translateY(a.s - 0.4); } },
        // horizontal sheet-metal duct run + 90deg elbow riser + bracket clamps
        { geo: box(5, 0.6, 0.6), mat: steel, place: (a, o) => { base(a, o); o.translateY(Math.min(a.s * 0.3, 24)); o.translateX(3); o.translateZ(0.05); } },
        { geo: box(0.6, 0.6, 0.6), mat: graphite, place: (a, o) => { base(a, o); o.translateY(Math.min(a.s * 0.3, 24)); o.translateX(5.8); o.translateZ(0.05); } },
        { geo: box(0.6, 1, 0.6), mat: steel, place: (a, o) => { base(a, o); o.translateY(Math.min(a.s * 0.3, 24) + 0.3); o.translateX(5.8); o.translateZ(0.05); o.scale.set(1, Math.min(a.s * 0.5, 30), 1); o.translateY(0.5); } },
        ...[1.2, 3, 4.8].map((x): Part => ({ geo: box(0.12, 0.85, 0.75), mat: graphite, place: (a, o) => { base(a, o); o.translateY(Math.min(a.s * 0.3, 24)); o.translateX(x); o.translateZ(0.05); } })),
      ]),
      helipads: [
        { geo: cyl(4, 4, 0.06, 32), mat: deck, place: at(0, -0.02, 0) },
        { geo: flatRing, mat: yellow, place: at(0, 0.06, 0) },
        { geo: box(0.35, 0.03, 2.6), mat: white, place: at(-0.8, 0.06, 0) },
        { geo: box(0.35, 0.03, 2.6), mat: white, place: at(0.8, 0.06, 0) },
        { geo: box(1.3, 0.03, 0.35), mat: white, place: at(0, 0.06, 0) },
        ...Array.from({ length: 8 }, (_, k) => ({
          geo: new THREE.SphereGeometry(0.12, 6, 4), mat: amber,
          place: at(Math.cos((k / 8) * Math.PI * 2) * 3.9, 0.12, Math.sin((k / 8) * Math.PI * 2) * 3.9),
        })),
        ...[0, 1, 2, 3].flatMap((k): Part[] => {
          const go = (o: THREE.Object3D, a: Anchor) => { base(a, o); o.rotateY(k * Math.PI / 2 + Math.PI / 4); o.translateZ(4.4); };
          return [
            { geo: cyl(0.05, 0.06, 0.55), mat: graphite, place: (a, o) => go(o, a) },
            { geo: box(0.55, 0.32, 0.3), mat: graphite, place: (a, o) => { go(o, a); o.translateY(0.6); o.rotateX(-0.45); } },
            { geo: box(0.45, 0.22, 0.02), mat: led, place: (a, o) => { go(o, a); o.translateY(0.6); o.rotateX(-0.45); o.translateZ(-0.16); } },
            { geo: cone(1.6, 4.6), mat: beam, place: (a, o) => { go(o, a); o.translateY(0.6); o.rotateX(-Math.PI / 2 + 0.45); o.rotateX(Math.PI); } },
          ];
        }),
      ],
      masts: [
        { geo: cyl(0.6, 0.6, 0.8, 8), mat: graphite, place: at(0, 0, 0) },
        { geo: cyl(0.04, 0.22, 1, 6), mat: steel, place: (a, o) => { base(a, o); o.scale.set(1, a.s, 1); } },
        { geo: new THREE.SphereGeometry(0.18, 8, 6), mat: red, place: (a, o) => { base(a, o); o.translateY(a.s); } },
        { geo: new THREE.SphereGeometry(0.12, 6, 4), mat: red, place: (a, o) => { base(a, o); o.translateY(a.s * 0.55); } },
        ...[0, 1, 2].flatMap((k): Part[] => [0.7, 0.42].map((hf, tier): Part => ({ geo: drum, mat: white,
          place: (a, o) => { base(a, o); o.rotateY(k * 2.094 + tier * 1.047); o.translateY(a.s * hf); o.translateZ(0.42); } }))),
        ...[0, 1, 2].map((k): Part => ({ geo: wire, mat: steel, place: (a, o) => {
          const hh = a.s * 0.8; base(a, o); o.rotateY(k * 2.094 + 1.047); o.translateZ(GUY_R);
          o.rotateX(-Math.atan2(GUY_R, hh)); o.scale.set(1, Math.hypot(GUY_R, hh), 1);
        } })),
      ],
      kiosks: [
        { geo: cyl(0.45, 0.55, 0.5, 12), mat: graphite, place: at(0, 0, 0) },
        { geo: cyl(0.08, 0.08, 1.4), mat: steel, place: at(0, 0.5, 0) },
        { geo: new THREE.PlaneGeometry(1.2, 1.6), mat: holo, place: at(0, 2.2, 0) },
        { geo: new THREE.PlaneGeometry(1.2, 1.6), mat: holo, place: (a, o) => { base(a, o); o.translateY(2.2); o.rotateY(Math.PI / 2); } },
        { geo: new THREE.TorusGeometry(0.5, 0.03, 4, 20).rotateX(Math.PI / 2), mat: cyan, place: at(0, 1.9, 0) },
        { geo: disc(1.4), mat: holo, place: at(0, 0.03, 0, 1, 1, 1) },
      ],
      shelters: [
        { geo: box(3.2, 0.08, 1.5), mat: steel, place: at(0, 2.5, -0.3) },
        { geo: box(3.1, 0.06, 1.4), mat: glass, place: at(0, 2.57, -0.3) },
        { geo: box(3.1, 2.3, 0.04), mat: glass, place: at(0, 0.1, -1.0) },
        ...[-1.5, 1.5].flatMap((x) => [-1, 0.35].map((z): Part => ({ geo: box(0.07, 2.5, 0.07), mat: steel, place: at(x, 0, z) }))),
        { geo: box(2.2, 0.08, 0.45), mat: steel, place: at(0, 0.45, -0.7) },
        ...[-0.9, 0.9].map((x): Part => ({ geo: box(0.06, 0.45, 0.4), mat: graphite, place: at(x, 0, -0.7) })),
        { geo: box(0.7, 1.1, 0.05), mat: glow("#bfe8ff", 1.8), place: at(1.2, 0.9, -0.97) },
      ],
      dividers: [
        { geo: box(0.55, 0.25, 1.02), mat: concrete, place: at(0, 0, 0) },
        { geo: box(0.22, 0.6, 1.02), mat: concrete, place: at(0, 0.25, 0) },
        { geo: box(0.24, 0.05, 1.02), mat: yellow, place: at(0, 0.85, 0) },
      ],
      dishes: [
        { geo: cyl(0.06, 0.08, 0.9), mat: steel, place: at(0, 0, 0) },
        { geo: dishGeo, mat: white, place: at(0, 1.1, 0) },
      ],
      vents: [
        { geo: cyl(0.6, 0.65, 0.8, 12), mat: steel, place: at(0, 0, 0) },
        { geo: cyl(0.75, 0.6, 0.15, 12), mat: graphite, place: at(0, 0.8, 0) },
        { geo: box(1.1, 0.04, 0.12), mat: graphite, place: at(0, 0.97, 0) },
      ],
    };
    return { P, red, cyan };
  }, []);
}

function Inst({ part, list }: { part: Part; list: Anchor[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    list.forEach((a, i) => { part.place(a, o); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true;
  }, [part, list]);
  if (!list.length) return null;
  return <instancedMesh ref={ref} args={[part.geo, part.mat, list.length]} frustumCulled={false} />;
}

const PAD = 160;
export function CityAmenities() {
  const [data, setData] = useState<Amenities | null>(null);
  const { P, red, cyan } = useParts();
  const grp = useRef<THREE.Group>(null);
  useEffect(() => { let live = true; onAmenities((a) => live && setData(a)); return () => { live = false; }; }, []);
  useFrame(({ camera, clock }) => {
    const g = grp.current;
    if (!g) return;
    const p = camera.position;
    g.visible = p.x > LF_X0 - PAD && p.x < LF_X0 + LF_SIZE + PAD && p.z > LF_Z0 - PAD && p.z < LF_Z0 + LF_SIZE + PAD;
    const t = clock.elapsedTime;
    red.emissiveIntensity = (t * 1.2) % 1 < 0.18 ? 6 : 0.3; // ~1.2 Hz aviation strobe
    cyan.emissiveIntensity = 2.4 + Math.sin(t * 2.2) * 0.8;
  });
  if (!data) return null;
  return (
    <group ref={grp}>
      <NearLights data={data} />
      {(Object.keys(P) as (keyof Amenities)[]).flatMap((k) =>
        P[k].map((part, i) => <Inst key={`${k}${i}`} part={part} list={data[k]} />),
      )}
    </group>
  );
}

// A small pool of real lights that follows the player: the nearest streetlights / helipad
// floodlights get a true light so walls, roads and characters are lit, without hundreds of lights.
const POOL = 6;
function NearLights({ data }: { data: Amenities }) {
  const refs = useRef<(THREE.SpotLight | null)[]>([]);
  const targets = useMemo(() => Array.from({ length: POOL }, () => new THREE.Object3D()), []);
  const srcs = useMemo(() => {
    const s: { x: number; y: number; z: number; tx: number; tz: number; h: boolean }[] = [];
    for (const a of data.lights) s.push({ x: a.x + Math.sin(a.r) * 1.45, y: a.y + 5.4, z: a.z + Math.cos(a.r) * 1.45, tx: 0, tz: 0, h: false });
    for (const a of data.helipads) s.push({ x: a.x, y: a.y + 6, z: a.z, tx: 0, tz: 0, h: true });
    return s;
  }, [data]);
  const tick = useRef(0);
  useFrame(({ camera, scene }, dt) => {
    tick.current -= dt;
    const night = Math.sin(ui.time * Math.PI * 2) < 0.05;
    if (tick.current > 0 && night) return;
    tick.current = 0.25;
    const p = camera.position;
    const best = night ? srcs.map((s) => [s, (s.x - p.x) ** 2 + (s.z - p.z) ** 2 + (s.y - p.y) ** 2] as const)
      .filter((e) => e[1] < 70 * 70).sort((a, b) => a[1] - b[1]).slice(0, POOL) : [];
    refs.current.forEach((l, i) => {
      if (!l) return;
      const e = best[i];
      if (!e) { l.intensity = 0; return; }
      const s = e[0];
      l.position.set(s.x, s.y, s.z);
      targets[i]!.position.set(s.x, s.y - 10, s.z);
      if (!targets[i]!.parent) scene.add(targets[i]!);
      l.target = targets[i]!;
      l.angle = s.h ? 1.0 : 0.85;
      l.distance = s.h ? 22 : 16;
      l.intensity = s.h ? 60 : 40;
    });
  });
  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <spotLight key={i} ref={(r) => { refs.current[i] = r; }} color="#ffe2b0" penumbra={0.6} decay={1.6} intensity={0} />
      ))}
    </>
  );
}
