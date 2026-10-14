// @ts-nocheck
// Kingdom population: townsfolk with roles, livestock, horse-drawn carts. Instanced for performance.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices, mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import maleAsset from "@/assets/male.glb.asset.json";
import femaleAsset from "@/assets/female.glb.asset.json";
import * as THREE from "three";
import { getGame } from "./state";
import { K_CX, K_CZ, hash2 } from "./world";

const N_PEOPLE = 360, N_CARTS = 18;
// role: [shirt, legs, hat|null, speed, label]
const ROLES = [
  ["#7a3b22", "#3a2a1c", null, 0.0], // blacksmith (apron)
  ["#c9b48a", "#5a4632", "#e8e2d0", 0.0], // baker (white cap)
  ["#2f4f7f", "#3b3b3b", "#8a1c1c", 0.0], // merchant
  ["#9a1f1f", "#4a4a4a", "#9aa0a6", 0.9], // guard (red tabard, steel helm)
  ["#1d1d1d", "#1d1d1d", null, 0.5], // priest
  ["#6f7d3a", "#5a4a2a", "#c8a25a", 0.0], // farmer (straw hat)
  ["#8e5a7a", "#6a3e58", null, 1.1], // townswoman
  ["#5d6b4c", "#4b3a28", "#5a4632", 1.2], // townsman
  ["#b0563a", "#47603a", null, 1.6], // child
  ["#4a3a6a", "#2b2b3b", "#2b2b3b", 0.9], // noble
];
const SKIN = ["#e8c4a0", "#c99872", "#8d5a3b", "#f1d3b6"];
const PASTURES = [[63, -45], [81, -45], [63, -63], [81, 45]];
const FARMS = [[63, -9], [63, 9], [63, -27], [63, 27], [81, -27], [81, 27], [63, 45], [63, 63], [81, -63]];
const STALLS = [[-45, -9], [-45, 9], [-45, -27]];
const SMITHS = [[-45, -45], [-63, -9], [-81, 27]];
const BAKERS = [[-27, 45], [-9, 81], [45, 9]];
// animal: [body, head, sx, sy, sz, legH, speed]
const ANIMALS = [
  ["#6b4a2e", "#5a3c24", 0.5, 0.55, 1.3, 0.7, 0.8], // horse
  ["#efe9de", "#2a2420", 0.55, 0.55, 1.1, 0.5, 0.4], // cow
  ["#eae4d4", "#3a3430", 0.5, 0.45, 0.75, 0.35, 0.4], // sheep
  ["#d8c8a8", "#c43a2a", 0.22, 0.22, 0.28, 0.12, 0.6], // chicken
  ["#c27a3a", "#a86630", 0.18, 0.18, 0.42, 0.14, 0.9], // cat
];

type Agent = { x: number; z: number; tx: number; tz: number; yaw: number; sp: number; kind: number; mode: number; ax: number; az: number; r: number; wait: number; phase: number; s: number; col: number };

// Load a Blender-exported half body (mirror modifier unapplied), mirror it, convert Z-up to Y-up, normalize to 1.8 tall with feet at y=0.
function loadBody(url): Promise<THREE.BufferGeometry> {
  return new GLTFLoader().loadAsync(url).then((gl) => {
    let geo: THREE.BufferGeometry = null;
    gl.scene.updateMatrixWorld(true);
    gl.scene.traverse((o: any) => { if (o.isMesh && !geo) { geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); } });
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.deleteAttribute("normal");
    const pos = geo.getAttribute("position").array as Float32Array, n = pos.length;
    const out = new Float32Array(n * 2); out.set(pos);
    for (let i = 0; i < n; i += 9) for (let v = 0; v < 3; v++) { const src = i + (2 - v) * 3, dst = n + i + v * 3; out[dst] = -pos[src]; out[dst + 1] = pos[src + 1]; out[dst + 2] = pos[src + 2]; }
    let g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.BufferAttribute(out, 3));
    g2 = mergeVertices(g2, 1e-4);
    g2.computeBoundingBox(); const b = g2.boundingBox, h = b.max.y - b.min.y, k = 1.8 / h;
    g2.translate(-(b.max.x + b.min.x) / 2, -b.min.y, -(b.max.z + b.min.z) / 2); g2.scale(k, k, k);
    g2.computeVertexNormals();
    return g2;
  });
}

export function Population() {
  const [bodies, setBodies] = useState<THREE.BufferGeometry[] | null>(null);
  const g = getGame();
  const Y = g.world.kingdomGround() + 1;
  const rand = (() => { let i = 1; return () => hash2(i++, 77, g.world.seed ?? 1); })();
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const node = () => {
    let a, b;
    do { a = (Math.floor(rand() * 11) - 5) * 18; b = (Math.floor(rand() * 11) - 5) * 18; } while (Math.max(Math.abs(a), Math.abs(b)) < 36);
    return [a, b];
  };

  const { people, animals, carts } = useMemo(() => {
    const people: Agent[] = [];
    const add = (kind, x, z, mode, r = 0) => people.push({ x, z, tx: x, tz: z, yaw: rand() * 6.28, sp: ROLES[kind][3] || 0.5, kind, mode, ax: x, az: z, r, wait: rand() * 3, phase: rand() * 6, s: kind === 8 ? 0.65 : 0.92 + rand() * 0.12, col: Math.floor(rand() * 4), fem: kind === 6 || (kind !== 3 && kind !== 0 && kind !== 4 && kind !== 7 && rand() < 0.45) });
    for (const [u, v] of SMITHS) for (let i = 0; i < 3; i++) add(0, u - 3 + i * 2, v - 3, 1, 2);
    for (const [u, v] of BAKERS) for (let i = 0; i < 2; i++) add(1, u + i * 2, v, 1, 2);
    for (const [u, v] of STALLS) for (let i = 0; i < 6; i++) add(2, u - 6 + (i % 3) * 5, v + (i < 3 ? -4 : 5), 1, 1);
    for (const [u, v] of STALLS) for (let i = 0; i < 6; i++) add(i % 2 ? 6 : 7, u, v, 1, 6);
    for (const [u, v] of FARMS) for (let i = 0; i < 2; i++) add(5, u - 3 + rand() * 6, v - 3 + rand() * 6, 1, 5);
    for (let i = 0; i < 3; i++) add(4, 9 + i, 45, 1, 3); // priest & acolytes
    for (const d of [-1, 1]) for (const s of [-1, 1]) { add(3, d * 97, s * 2.5, 2); add(3, s * 2.5, d * 97, 2); } // gate sentries
    for (const d of [-1, 1]) { add(3, d * 22 + d * 2, -4, 2); add(3, d * 22 + d * 2, 4, 2); add(3, -4, d * 24, 2); add(3, 4, d * 24, 2); } // citadel gates
    for (const d of [-1, 1]) for (let k = -3; k <= 3; k++) { add(3, d * 92, k * 26, 1, 4); add(3, k * 26, d * 92, 1, 4); } // wall watch
    for (let k = 0; k < 30; k++) { const [a, b] = node(); add(3, a, b, 0); } // street patrols
    for (const [u, v] of STALLS) for (let k = 0; k < 8; k++) add(pick([6, 7, 8, 9]), u, v, 1, 8); // market crowd
    while (people.length < N_PEOPLE) {
      const k = rand() < 0.08 ? 3 : pick([6, 7, 6, 7, 8, 9, 6, 7]);
      const [a, b] = node();
      add(k, a, b, 0);
    }
    const animals: Agent[] = [];
    const addA = (kind, x, z, r) => animals.push({ x, z, tx: x, tz: z, yaw: rand() * 6.28, sp: ANIMALS[kind][6], kind, mode: 1, ax: x, az: z, r, wait: rand() * 4, phase: rand() * 6, s: 1, col: 0 });
    for (const [u, v] of PASTURES) { for (let i = 0; i < 4; i++) addA(1, u, v, 5); for (let i = 0; i < 4; i++) addA(2, u, v, 5); }
    for (const [u, v] of [[27, -45], [-27, -63]]) for (let i = 0; i < 4; i++) addA(0, u, v, 4); // stables
    for (const [u, v] of FARMS) for (let i = 0; i < 3; i++) addA(3, u, v, 5);
    for (let i = 0; i < 10; i++) { const [a, b] = node(); addA(4, a + 4, b + 4, 6); }
    const carts: Agent[] = [];
    for (let i = 0; i < N_CARTS; i++) { const [a, b] = node(); carts.push({ x: a, z: b, tx: a, tz: b, yaw: 0, sp: 1.4, kind: i % 3, mode: 0, ax: 0, az: 0, r: 0, wait: rand() * 5, phase: 0, s: 1, col: 0 }); }
    return { people, animals, carts };
  }, []);

  const parts = useMemo(() => {
    const inst = (geo, n) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n); m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m; };
    const mk = (n, w, h, d, y = 0) => { const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, y, 0); return inst(geo, n); };
    const P = people.length, A = animals.length, C = carts.length;
    // Shaped humanoid parts (inspired by the uploaded models)
    const leg = new THREE.CapsuleGeometry(0.08, 0.6, 2, 6); leg.translate(0, -0.37, 0);
    const torso = new THREE.CylinderGeometry(0.23, 0.17, 0.64, 10); torso.scale(1, 1, 0.62);
    const shoulders = new THREE.SphereGeometry(0.23, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); shoulders.scale(1, 0.35, 0.62); shoulders.translate(0, 0.32, 0);
    const torsoG = mergeGeometries([torso.toNonIndexed(), shoulders.toNonIndexed()]);
    const arm = new THREE.CapsuleGeometry(0.06, 0.48, 2, 6); arm.translate(0, -0.3, 0);
    const hand = new THREE.SphereGeometry(0.065, 5, 4); hand.translate(0, -0.6, 0);
    const boot = new THREE.BoxGeometry(0.17, 0.12, 0.28); boot.translate(0, -0.7, 0.04);
    const head = new THREE.SphereGeometry(0.155, 10, 8); head.scale(0.95, 1.1, 1);
    const neck = new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8); neck.translate(0, -0.18, 0);
    const headG = mergeGeometries([head.toNonIndexed(), neck.toNonIndexed()]);
    const eyeL = new THREE.SphereGeometry(0.024, 4, 3); eyeL.translate(-0.055, 0.02, 0.14);
    const eyeR = new THREE.SphereGeometry(0.024, 4, 3); eyeR.translate(0.055, 0.02, 0.14);
    const browL = new THREE.BoxGeometry(0.06, 0.012, 0.02); browL.translate(-0.055, 0.065, 0.145);
    const browR = new THREE.BoxGeometry(0.06, 0.012, 0.02); browR.translate(0.055, 0.065, 0.145);
    const mouth = new THREE.BoxGeometry(0.06, 0.012, 0.02); mouth.translate(0, -0.075, 0.14);
    const face = mergeGeometries([eyeL, eyeR, browL, browR, mouth].map((x) => x.toNonIndexed()));
    const nose = new THREE.ConeGeometry(0.025, 0.06, 6); nose.rotateX(Math.PI / 2); nose.translate(0, -0.02, 0.165);
    const hair = new THREE.SphereGeometry(0.17, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5); hair.scale(0.98, 1.05, 1.05); hair.translate(0, 0.025, -0.012);
    const hairLong = new THREE.CylinderGeometry(0.15, 0.17, 0.38, 10, 1, true, Math.PI / 2, Math.PI); hairLong.translate(0, -0.12, -0.02);
    const skirt = new THREE.CylinderGeometry(0.19, 0.33, 0.6, 12); skirt.translate(0, -0.3, 0);
    const belt = new THREE.CylinderGeometry(0.18, 0.18, 0.06, 10); belt.scale(1, 1, 0.65);
    const brim = new THREE.CylinderGeometry(0.25, 0.25, 0.025, 14); const crown = new THREE.CylinderGeometry(0.15, 0.17, 0.14, 12); crown.translate(0, 0.08, 0);
    const hatG = mergeGeometries([brim.toNonIndexed(), crown.toNonIndexed()]);
    return {
      legL: inst(leg, P), legR: inst(leg, P), bootL: inst(boot, P), bootR: inst(boot, P),
      torso: inst(torsoG, P), belt: inst(belt, P), skirt: inst(skirt, P),
      armL: inst(arm, P), armR: inst(arm, P), handL: inst(hand, P), handR: inst(hand, P),
      head: inst(headG, P), face: inst(face, P), nose: inst(nose, P), hair: inst(hair, P), hairLong: inst(hairLong, P), hat: inst(hatG, P),
      aBody: mk(A + C, 1, 1, 1), aHead: mk(A + C, 1, 1, 1), aLegs: mk(A + C, 1, 1, 1, -0.5),
      bed: mk(C, 1.4, 0.5, 2.2), wheel: mk(C * 2, 0.15, 0.9, 0.9), load: mk(C, 1.1, 0.6, 1.6),
    };
  }, []);

  useMemo(() => {
    const c = new THREE.Color();
    const HAIR = ["#2a1a10", "#4a2c18", "#6b4423", "#a0703a", "#d8b46a", "#8a3a1a", "#1a1a1a", "#9a9a9a"];
    people.forEach((p, i) => {
      const r = ROLES[p.kind];
      const shirt = p.kind === 0 ? "#5a3a24" : r[0];
      parts.torso.setColorAt(i, c.set(p.kind === 1 ? "#f2eee4" : shirt));
      const sleeve = p.kind === 0 ? SKIN[p.col] : p.kind === 1 ? "#f2eee4" : r[0];
      parts.armL.setColorAt(i, c.set(sleeve)); parts.armR.setColorAt(i, c.set(sleeve));
      parts.handL.setColorAt(i, c.set(SKIN[p.col])); parts.handR.setColorAt(i, c.set(SKIN[p.col]));
      parts.legL.setColorAt(i, c.set(r[1])); parts.legR.setColorAt(i, c.set(r[1]));
      parts.bootL.setColorAt(i, c.set(p.kind === 3 ? "#55595e" : "#2a1c12")); parts.bootR.setColorAt(i, c.set(p.kind === 3 ? "#55595e" : "#2a1c12"));
      parts.skirt.setColorAt(i, c.set(p.kind === 4 ? "#1d1d1d" : r[1] === r[0] ? r[1] : r[0]));
      parts.belt.setColorAt(i, c.set(p.kind === 9 ? "#c8a040" : "#3a2414"));
      parts.head.setColorAt(i, c.set(SKIN[p.col])); parts.nose.setColorAt(i, c.set(SKIN[p.col]).multiplyScalar(0.92));
      parts.face.setColorAt(i, c.set("#1a1210"));
      const hc = HAIR[Math.floor(hash2(i, 9, 3) * HAIR.length)];
      parts.hair.setColorAt(i, c.set(hc)); parts.hairLong.setColorAt(i, c.set(hc));
      parts.hat.setColorAt(i, c.set(r[2] ?? "#3a2a1c"));
    });
    const all = [...animals.map((a) => a.kind), ...carts.map(() => 0)];
    all.forEach((k, i) => { const a = ANIMALS[k]; parts.aBody.setColorAt(i, c.set(a[0])); parts.aHead.setColorAt(i, c.set(a[1])); parts.aLegs.setColorAt(i, c.set(a[1])); });
    carts.forEach((ct, i) => { parts.bed.setColorAt(i, c.set("#7a5634")); parts.load.setColorAt(i, c.set(["#c8a25a", "#8a6a3a", "#e0d8c0"][ct.kind])); parts.wheel.setColorAt(i * 2, c.set("#3a2a1c")); parts.wheel.setColorAt(i * 2 + 1, c.set("#3a2a1c")); });
  }, []);

  const BODY_RANGE = 48;
  const bodyMeshes = useMemo(() => {
    if (!bodies) return null;
    return bodies.map((geo) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), people.length);
      m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0;
      m.setColorAt(0, new THREE.Color()); return m;
    });
  }, [bodies]);
  const tint = useMemo(() => new THREE.Color(), []);

  const o = useMemo(() => new THREE.Object3D(), []);
  const q = useMemo(() => new THREE.Object3D(), []);
  const t = useRef(0);

  const steer = (a: Agent, dt, street) => {
    const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.2) {
      a.wait -= dt;
      if (a.wait > 0) return false;
      if (street) {
        const step = rand() < 0.5 ? [18, 0] : [0, 18], s = rand() < 0.5 ? -1 : 1;
        let nx = Math.round(a.x / 18) * 18 + step[0] * s, nz = Math.round(a.z / 18) * 18 + step[1] * s;
        if (Math.abs(nx) > 90 || Math.abs(nz) > 90 || Math.max(Math.abs(nx), Math.abs(nz)) < 36) { nx = Math.round(a.x / 18) * 18; nz = Math.round(a.z / 18) * 18; }
        const lane = a.mode === 0 && street === 1 ? (rand() - 0.5) * 3 : 0;
        a.tx = nx + (step[1] ? lane : 0); a.tz = nz + (step[0] ? lane : 0);
        a.wait = street === 2 ? rand() * 4 : rand() * 1.5;
      } else if (a.r > 0) {
        a.tx = a.ax + (rand() - 0.5) * 2 * a.r; a.tz = a.az + (rand() - 0.5) * 2 * a.r; a.wait = 1 + rand() * 5;
      } else { a.wait = 2 + rand() * 4; a.yaw += (rand() - 0.5) * 1.5; }
      return false;
    }
    const v = Math.min(d, a.sp * dt);
    a.x += (dx / d) * v; a.z += (dz / d) * v;
    const ty = Math.atan2(dx, dz); let dy = ty - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 6);
    return true;
  };

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05); t.current += dt;
    const px = g.pos.x - K_CX, pz = g.pos.z - K_CZ;
    const cnt = [0, 0];
    people.forEach((p, i) => {
      if (bodyMeshes) {
        const nearB = Math.abs(p.x - px) < 70 && Math.abs(p.z - pz) < 70;
        const mv = nearB && p.mode !== 2 ? steer(p, dt, p.mode === 0 ? 1 : 0) : false;
        if (p.mode === 1 && p.sp === 0) p.sp = 0.5;
        const ph = t.current * 7 * (p.sp / 1.1 + 0.3) + p.phase;
        const bob = mv ? Math.abs(Math.sin(ph)) * 0.06 : Math.sin(t.current * 1.6 + p.phase) * 0.01;
        const sway = mv ? Math.sin(ph) * 0.06 : p.kind <= 1 ? Math.max(0, Math.sin(t.current * 4 + p.phase)) * 0.12 : 0;
        const s = p.s;
        // hat (all roles that wear one)
        if (ROLES[p.kind][2] && Math.hypot(p.x - px, p.z - pz) < BODY_RANGE) { o.position.set(K_CX + p.x, Y + (1.78 + bob) * s, K_CZ + p.z); o.rotation.set(0, p.yaw, 0); o.scale.set(s * 0.75, s, s * 0.75); }
        else o.scale.setScalar(0);
        o.updateMatrix(); parts.hat.setMatrixAt(i, o.matrix);
        if (Math.hypot(p.x - px, p.z - pz) > BODY_RANGE) return;
        const m = bodyMeshes[p.fem ? 1 : 0], j = cnt[p.fem ? 1 : 0]++;
        o.position.set(K_CX + p.x, Y + bob * s, K_CZ + p.z); o.rotation.set(sway * (p.kind <= 1 && !mv ? 1 : 0.3), p.yaw, mv ? sway : 0, "YXZ"); o.scale.setScalar(s);
        o.updateMatrix(); m.setMatrixAt(j, o.matrix);
        m.setColorAt(j, tint.set(ROLES[p.kind][0]).lerp(new THREE.Color(SKIN[p.col]), 0.25));
        return;
      }
      const near = Math.abs(p.x - px) < 70 && Math.abs(p.z - pz) < 70;
      const moving = near && p.mode !== 2 ? steer(p, dt, p.mode === 0 ? 1 : 0) : false;
      if (p.mode === 1 && p.sp === 0) p.sp = 0.5;
      const sw = moving ? Math.sin(t.current * 7 * (p.sp / 1.1 + 0.3) + p.phase) * 0.6 : p.kind <= 1 ? Math.max(0, Math.sin(t.current * 4 + p.phase)) * -1.2 : 0;
      const s = p.s, hip = 0.75 * s;
      const base = (yOff, xOff, zOff) => { o.position.set(K_CX + p.x + Math.cos(p.yaw) * xOff * s, Y + yOff * s, K_CZ + p.z - Math.sin(p.yaw) * xOff * s); o.rotation.set(0, p.yaw, 0); o.scale.setScalar(s); };
      const put = (m, yOff, xOff, rx) => { base(yOff, xOff, 0); o.rotateX(rx); o.updateMatrix(); m.setMatrixAt(i, o.matrix); };
      const sk = p.fem ? 0 : 1, sw2 = sw * (p.fem ? 0.6 : 1);
      const hide = (m) => { o.scale.setScalar(0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); };
      put(parts.legL, 0.75, -0.1, sw2); put(parts.legR, 0.75, 0.1, -sw2);
      put(parts.bootL, 0.75, -0.1, sw2); put(parts.bootR, 0.75, 0.1, -sw2);
      const bob = moving ? Math.abs(Math.cos(t.current * 7 * (p.sp / 1.1 + 0.3) + p.phase)) * 0.04 : 0;
      put(parts.torso, 1.09 + bob, 0, 0);
      put(parts.belt, 0.8 + bob, 0, 0);
      if (p.fem) put(parts.skirt, 0.85 + bob, 0, 0); else hide(parts.skirt);
      const aL = -sw * (p.kind <= 1 ? 1 : 0.8), aR = p.kind <= 1 ? sw : sw * 0.8;
      put(parts.armL, 1.38 + bob, -0.27, aL); put(parts.armR, 1.38 + bob, 0.27, aR);
      put(parts.handL, 1.38 + bob, -0.27, aL); put(parts.handR, 1.38 + bob, 0.27, aR);
      for (const m of [parts.head, parts.face, parts.nose, parts.hair]) put(m, 1.62 + bob, 0, 0);
      if (p.fem) put(parts.hairLong, 1.62 + bob, 0, 0); else hide(parts.hairLong);
      if (ROLES[p.kind][2]) put(parts.hat, 1.8 + bob, 0, 0); else hide(parts.hat);
      void sk;
      void hip;
    });
    const animalPut = (i, kind, x, z, yaw, moving, ph) => {
      const a = ANIMALS[kind], bob = moving ? Math.abs(Math.sin(t.current * 8 + ph)) * 0.05 : 0;
      const by = Y + a[5] + a[3] / 2 + bob;
      o.position.set(x, by, z); o.rotation.set(0, yaw, 0); o.scale.set(a[2], a[3], a[4]); o.updateMatrix(); parts.aBody.setMatrixAt(i, o.matrix);
      o.position.set(x, Y + a[5], z); o.scale.set(a[2] * 0.85, a[5], a[4] * 0.8); o.updateMatrix(); parts.aLegs.setMatrixAt(i, o.matrix);
      const hs = a[2] * 0.7, graze = !moving && kind <= 2 && Math.sin(t.current * 0.7 + ph) > 0.3 ? -a[3] * 0.6 : a[3] * (kind === 0 ? 0.7 : 0.35);
      o.position.set(x + Math.sin(yaw) * a[4] * 0.6, by + graze, z + Math.cos(yaw) * a[4] * 0.6); o.scale.set(hs, hs, hs * (kind === 0 ? 1.6 : 1.1)); o.updateMatrix(); parts.aHead.setMatrixAt(i, o.matrix);
    };
    animals.forEach((a, i) => {
      const near = Math.abs(a.x - px) < 70 && Math.abs(a.z - pz) < 70;
      const mv = near ? steer(a, dt, 0) : false;
      animalPut(i, a.kind, K_CX + a.x, K_CZ + a.z, a.yaw, mv, a.phase);
    });
    carts.forEach((c, j) => {
      const mv = steer(c, dt, 2);
      const i = animals.length + j, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      const cx = K_CX + c.x, cz = K_CZ + c.z;
      animalPut(i, 0, cx + fx * 1.4, cz + fz * 1.4, c.yaw, mv, j);
      q.position.set(cx - fx * 1.0, Y + 0.75, cz - fz * 1.0); q.rotation.set(0, c.yaw, 0); q.scale.setScalar(1); q.updateMatrix(); parts.bed.setMatrixAt(j, q.matrix);
      q.position.y = Y + 1.25; q.updateMatrix(); parts.load.setMatrixAt(j, q.matrix);
      for (const s of [0, 1]) {
        const sx = (s ? 1 : -1) * 0.78;
        q.position.set(cx - fx * 1.0 + fz * sx, Y + 0.45, cz - fz * 1.0 - fx * sx); q.rotation.set(0, c.yaw, 0); if (mv) q.rotateX(t.current * 3); q.updateMatrix(); parts.wheel.setMatrixAt(j * 2 + s, q.matrix);
      }
    });
    for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true;
    if (bodyMeshes) bodyMeshes.forEach((m, k) => { m.count = cnt[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  });

  const PEOPLE_BOXES: string[] = [];
  const shown = Object.entries(parts).filter(([k]) => !(bodyMeshes && PEOPLE_BOXES.includes(k))).map(([, m]) => m);
  return <>
    {shown.map((m, i) => <primitive key={i} object={m} />)}
    {bodyMeshes?.map((m, i) => <primitive key={"b" + i} object={m} />)}
  </>;
}
