import { useSyncExternalStore } from "react";
import * as THREE from "three";
import { B, isPassable } from "./blocks";
import { World, type Edits } from "./world";
import { LF_CX, LF_CZ, LF_GROUND, onLinefieldReady, lfFindStreet } from "./linefield";

const SAVE_KEY = "voxelcraft-save-v1";
export const MAX_HEALTH = 20;

export const ui = {
  health: MAX_HEALTH,
  selected: 0,
  counts: { [B.DIRT]: 0, [B.COBBLE]: 0, [B.LOG]: 0, [B.PLANKS]: 32, [B.SAND]: 0, [B.BRICK]: 32 } as Record<number, number>,
  time: 0.05,
  breakProgress: 0,
  locked: false,
  dead: false,
  hurt: 0,
  atlasUrl: "",
  lastSaved: 0,
  underwater: false,
  photo: false,
  fly: false,
  hideHud: false,
  kioskNear: false,
  kioskOpen: false,
};

/** shared shader uniforms for drifting cloud shadows on the terrain */
export const cloudU = { cloudT: { value: 0 }, cloudDay: { value: 1 } };

let version = 0;
const listeners = new Set<() => void>();
export function emit() {
  version++;
  listeners.forEach((l) => l());
}
// For per-frame updates: re-render the HUD at most ~12 times a second.
let lastEmit = 0;
export function emitThrottled() {
  const now = performance.now();
  if (now - lastEmit < 80) return;
  lastEmit = now;
  emit();
}
export function useUI() {
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => version,
    () => version,
  );
  return ui;
}

export interface Zombie {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hp: number;
  cool: number;
  hurt: number;
}

export interface Game {
  world: World;
  spawn: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  zombies: Zombie[];
  lastHurt: number;
  controls: { lock: () => void; unlock?: () => void } | null;
}

let game: Game | null = null;

export function getGame(): Game {
  if (game) return game;
  let saved: any = null;
  try {
    saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
  } catch {
    saved = null;
  }
  const seed = saved?.seed ?? Math.floor(Math.random() * 1e9);
  const world = new World(seed, (saved?.edits as Edits) ?? {});
  const spawn = new THREE.Vector3(LF_CX + 0.5, LF_GROUND + 1.5, LF_CZ + 0.5);
  let pos = saved?.pos && saved?.lf ? new THREE.Vector3(...saved.pos) : spawn.clone();
  // never resume inside water or terrain
  const here = world.get(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)) ?? 0;
  if (here === B.WATER || (here !== 0 && !isPassable(here))) pos = spawn.clone();
  if (saved) {
    ui.health = saved.health ?? MAX_HEALTH;
    ui.counts = { ...ui.counts, ...saved.counts };
    ui.time = saved.time ?? ui.time;
    ui.selected = saved.selected ?? 0;
    if (ui.health <= 0) ui.health = MAX_HEALTH;
  }
  const resumed = !pos.equals(spawn);
  // once the city data is in, move the spawn onto a clear street with open sky
  onLinefieldReady(() => {
    const s = lfFindStreet();
    if (!s || !game) return;
    game.spawn.set(s[0] + 0.5, s[1] + 0.05, s[2] + 0.5);
    if (!resumed) { game.pos.copy(game.spawn); game.vel.set(0, 0, 0); }
  });
  game = { world, spawn, pos, vel: new THREE.Vector3(), zombies: [], lastHurt: 0, controls: null };
  return game;
}

export function saveGame() {
  if (!game) return;
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        seed: game.world.seed,
        edits: game.world.edits,
        pos: game.pos.toArray(),
        health: ui.health,
        counts: ui.counts,
        time: ui.time,
        selected: ui.selected,
        lf: 1,
      }),
    );
    ui.lastSaved = Date.now();
  } catch (e) {
    console.warn("Save failed", e);
  }
  emit();
}

export function newWorld() {
  localStorage.removeItem(SAVE_KEY);
  window.location.reload();
}

export function damage(n: number, now: number) {
  if (ui.dead) return;
  ui.health = Math.max(0, ui.health - n);
  ui.hurt = 1;
  if (game) game.lastHurt = now;
  if (ui.health <= 0) {
    ui.dead = true;
    document.exitPointerLock?.();
  }
  emit();
}

export function respawn() {
  if (!game) return;
  game.pos.copy(game.spawn);
  game.vel.set(0, 0, 0);
  game.zombies = [];
  ui.health = MAX_HEALTH;
  ui.dead = false;
  emit();
  saveGame();
}
