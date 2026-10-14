// Startup gate: the player stays frozen behind an overlay until the city bundle is in memory
// and the chunks around the spawn point are meshed at their current version.
type L = { progress: number; lfReady: boolean; ready: boolean; stage: string };
export const loading: L = { progress: 0, lfReady: false, ready: false, stage: "Downloading city data" };
const subs = new Set<() => void>();
export const subscribeLoading = (f: () => void) => {
  subs.add(f);
  return () => { subs.delete(f); };
};
export function setLoading(p: Partial<L>) {
  Object.assign(loading, p);
  subs.forEach((f) => f());
}
/** chunk key -> version last meshed */
export const meshed = new Map<string, number>();
