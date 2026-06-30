import type { SpatialGrid } from "./grid/grid";

export type SnapshotTiming = {
  executionTimeMs: number;
  cellsProcessed: number;
  cacheHitRate: number;
  cacheHit: boolean;
};

export type TimedSnapshotValue<T> = {
  value: T;
  timing: SnapshotTiming;
};

type CacheEntry<T> = {
  value: T;
  createdAt: number;
};

type CacheStats = {
  hits: number;
  misses: number;
};

type SnapshotCacheStore = {
  values: Map<string, CacheEntry<unknown>>;
  stats: Map<string, CacheStats>;
};

export type SnapshotWorldKeySource = {
  id?: string | null;
  seed?: string | null;
  currentTick?: bigint | number | string | null;
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

const globalSymbol = Symbol.for("first-dawn.snapshot-performance-cache");
const globalStore = (globalThis as unknown as Record<symbol, SnapshotCacheStore | undefined>)[globalSymbol];
const store: SnapshotCacheStore = globalStore ?? {
  values: new Map(),
  stats: new Map(),
};

if (!globalStore) {
  (globalThis as unknown as Record<symbol, SnapshotCacheStore>)[globalSymbol] = store;
}

function nowMs(): number {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

export function stableSnapshotStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(typeof value === "bigint" ? value.toString() : value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSnapshotStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSnapshotStringify(entryValue)}`).join(",")}}`;
}

export function getSnapshotWorldKey(world: SnapshotWorldKeySource, grid: SpatialGrid, variant?: string): string {
  const gridSummary = grid.getGridSummary();

  return stableSnapshotStringify({
    variant: variant ?? null,
    world: {
      id: world.id ?? null,
      seed: world.seed ?? null,
      currentTick: world.currentTick ?? null,
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
    grid: {
      latitudeDivisions: gridSummary.latitudeDivisions,
      longitudeDivisions: gridSummary.longitudeDivisions,
      totalCells: gridSummary.totalCells,
    },
  });
}

function statsFor(scope: string): CacheStats {
  const existing = store.stats.get(scope);

  if (existing) {
    return existing;
  }

  const stats = { hits: 0, misses: 0 };
  store.stats.set(scope, stats);
  return stats;
}

function cacheHitRate(stats: CacheStats): number {
  const total = stats.hits + stats.misses;
  return total > 0 ? stats.hits / total : 0;
}

export function memoizeSnapshotValue<T>(
  scope: string,
  key: string,
  compute: () => T,
  cellsProcessedOnMiss: number,
): TimedSnapshotValue<T> {
  const cacheKey = `${scope}:${key}`;
  const stats = statsFor(scope);
  const start = nowMs();
  const existing = store.values.get(cacheKey) as CacheEntry<T> | undefined;

  if (existing) {
    stats.hits += 1;
    return {
      value: existing.value,
      timing: {
        executionTimeMs: Math.max(0, nowMs() - start),
        cellsProcessed: 0,
        cacheHitRate: cacheHitRate(stats),
        cacheHit: true,
      },
    };
  }

  const value = compute();
  stats.misses += 1;
  store.values.set(cacheKey, { value, createdAt: Date.now() });

  return {
    value,
    timing: {
      executionTimeMs: Math.max(0, nowMs() - start),
      cellsProcessed: cellsProcessedOnMiss,
      cacheHitRate: cacheHitRate(stats),
      cacheHit: false,
    },
  };
}

export async function memoizeSnapshotValueAsync<T>(
  scope: string,
  key: string,
  compute: () => Promise<T>,
  cellsProcessedOnMiss: number,
): Promise<TimedSnapshotValue<T>> {
  const cacheKey = `${scope}:${key}`;
  const stats = statsFor(scope);
  const start = nowMs();
  const existing = store.values.get(cacheKey) as CacheEntry<T> | undefined;

  if (existing) {
    stats.hits += 1;
    return {
      value: existing.value,
      timing: {
        executionTimeMs: Math.max(0, nowMs() - start),
        cellsProcessed: 0,
        cacheHitRate: cacheHitRate(stats),
        cacheHit: true,
      },
    };
  }

  const value = await compute();
  stats.misses += 1;
  store.values.set(cacheKey, { value, createdAt: Date.now() });

  return {
    value,
    timing: {
      executionTimeMs: Math.max(0, nowMs() - start),
      cellsProcessed: cellsProcessedOnMiss,
      cacheHitRate: cacheHitRate(stats),
      cacheHit: false,
    },
  };
}

export function clearSnapshotPerformanceCache(): void {
  store.values.clear();
  store.stats.clear();
}