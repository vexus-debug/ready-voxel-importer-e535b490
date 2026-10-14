import type { World } from "./world";
import { LF_CX, LF_CZ, LF_X0, LF_Z0, LF_SIZE } from "./linefield";

export type LandmarkKind = "castle" | "spawn" | "village" | "tower" | "ruin" | "city";
export interface Landmark { id: string; name: string; kind: LandmarkKind; x: number; z: number }

/** Registry of map landmarks. Linefield is the entire world. */
export function getLandmarks(_world: World): Landmark[] {
  const q = LF_SIZE / 4;
  return [
    { id: "linefield", name: "Linefield Downtown", kind: "city", x: LF_CX, z: LF_CZ },
    { id: "spawn", name: "Central Plaza", kind: "spawn", x: LF_CX, z: LF_CZ + 8 },
    { id: "nw", name: "North-West District", kind: "tower", x: LF_X0 + q, z: LF_Z0 + q },
    { id: "se", name: "South-East District", kind: "tower", x: LF_X0 + 3 * q, z: LF_Z0 + 3 * q },
  ];
}

export const LANDMARK_GLYPH: Record<LandmarkKind, string> = {
  castle: "♜", spawn: "⚑", village: "⌂", tower: "♖", ruin: "☗", city: "▦",
};

/** shared map view state (mutable, HUD re-renders via emit) */
export const mapView = { open: false, heading: 0 };
