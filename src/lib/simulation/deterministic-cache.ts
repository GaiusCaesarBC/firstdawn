// Deterministic in-memory cache for canonical world simulation layers
// Persists across hot reloads via globalThis in dev.

import type { SpatialGrid } from "./grid/grid";
import { isCanonicalWorld } from "../../lib/worlds/canonical-world";

type WorldKeySource = {
  seed?: string | null;
  tickDurationSeconds?: number;
  dayLengthSeconds?: number;
  yearLengthDays?: number;
  axialTiltDegrees?: number;
  orbitalEccentricity?: number;
  initialEpochName?: string;
  initialYear?: number;
  initialDay?: number;
  initialHour?: number;
  planet?: Record<string, unknown> | null;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(typeof value === "bigint" ? value.toString() : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

function makeKey(layer: string, world: WorldKeySource, grid: SpatialGrid, variant?: string): string {
  const g = grid.getGridSummary();
  const base = {
    layer,
    variant: variant ?? null,
    grid: { latitudeDivisions: g.latitudeDivisions, longitudeDivisions: g.longitudeDivisions },
    world: {
      seed: world.seed ?? null,
      tickDurationSeconds: world.tickDurationSeconds,
      dayLengthSeconds: world.dayLengthSeconds,
      yearLengthDays: world.yearLengthDays,
      axialTiltDegrees: world.axialTiltDegrees,
      orbitalEccentricity: world.orbitalEccentricity,
      initialEpochName: world.initialEpochName,
      initialYear: world.initialYear,
      initialDay: world.initialDay,
      initialHour: world.initialHour,
      planet: world.planet ?? null,
    },
  };
  return stableStringify(base);
}

type CacheMaps = {
  map: Map<string, unknown>;
};

const globalSymbol = Symbol.for("first-dawn.deterministic-cache");
const globalStore = (globalThis as any)[globalSymbol] as CacheMaps | undefined;

const store: CacheMaps = globalStore ?? { map: new Map() };
if (!globalStore) {
  (globalThis as any)[globalSymbol] = store;
}

export function getCachedDeterministic<T>(
  layer: string,
  world: WorldKeySource,
  grid: SpatialGrid,
  compute: () => T,
  variant?: string,
): T {
  // Only cache canonical worlds (deterministic configuration)
  if (!isCanonicalWorld({ seed: world.seed ?? null })) {
    return compute();
  }

  const key = makeKey(layer, world, grid, variant);
  if (store.map.has(key)) {
    return store.map.get(key) as T;
  }
  const value = compute();
  store.map.set(key, value as unknown);
  return value;
}
