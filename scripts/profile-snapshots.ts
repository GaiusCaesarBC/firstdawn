import { WorldStatus } from "@prisma/client";
import { performance } from "node:perf_hooks";

import { getSimulationState, type SimulationState } from "../src/lib/simulation/scheduler";
import { clearSnapshotPerformanceCache, type SnapshotTiming } from "../src/lib/simulation/snapshot-performance";
import { buildTimedAtlasSnapshot, normalizeAtlasSelectedDay } from "../src/lib/worlds/map-atlas";
import { listWorlds, prisma, type WorldWithPlanet } from "../src/lib/worlds/world-lifecycle";

type TimedResult<T> = {
  value: T;
  wallMs: number;
};

type ProfileWorldResult = {
  worldId: string;
  slug: string;
  name: string;
  tick: string;
  selectedDay: number;
  simulationColdMs: number;
  simulationWarmMs: number;
  atlasColdMs: number;
  atlasWarmMs: number;
  atlasWarmCacheHit: boolean;
  atlasWarmCacheHitRate: number;
  summaryTimings: Record<string, SnapshotTiming>;
};

const warmSnapshotThresholdMs = Number(process.env.SNAPSHOT_WARM_THRESHOLD_MS ?? 500);

function formatMs(value: number): string {
  return `${value.toFixed(value < 10 ? 2 : 0)} ms`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function timeAsync<T>(task: () => Promise<T>): Promise<TimedResult<T>> {
  const start = performance.now();
  const value = await task();
  return { value, wallMs: performance.now() - start };
}

function timeSync<T>(task: () => T): TimedResult<T> {
  const start = performance.now();
  const value = task();
  return { value, wallMs: performance.now() - start };
}

function summarizeCacheHitRate(summaryTimings: Record<string, SnapshotTiming>): number {
  const entries = Object.values(summaryTimings);

  if (entries.length === 0) {
    return 0;
  }

  return entries.filter((entry) => entry.cacheHit).length / entries.length;
}

function printSummaryTimings(summaryTimings: Record<string, SnapshotTiming>) {
  for (const [name, timing] of Object.entries(summaryTimings)) {
    console.log(
      `    ${name.padEnd(10)} ${formatMs(timing.executionTimeMs).padStart(10)} | ${String(timing.cellsProcessed).padStart(5)} cells | hit=${String(timing.cacheHit).padEnd(5)} | scope hit rate=${formatPercent(timing.cacheHitRate)}`,
    );
  }
}

async function profileWorld(world: WorldWithPlanet): Promise<ProfileWorldResult> {
  clearSnapshotPerformanceCache();

  const coldState = await timeAsync(() => getSimulationState(world.id));
  const warmState = await timeAsync(() => getSimulationState(world.id));
  const selectedDay = normalizeAtlasSelectedDay(world);
  const coldAtlas = timeSync(() => buildTimedAtlasSnapshot(world, selectedDay));
  const warmAtlas = timeSync(() => buildTimedAtlasSnapshot(world, selectedDay));

  return {
    worldId: world.id,
    slug: world.slug,
    name: world.name,
    tick: world.currentTick.toString(),
    selectedDay,
    simulationColdMs: coldState.wallMs,
    simulationWarmMs: warmState.wallMs,
    atlasColdMs: coldAtlas.wallMs,
    atlasWarmMs: warmAtlas.wallMs,
    atlasWarmCacheHit: warmAtlas.value.timing.cacheHit,
    atlasWarmCacheHitRate: warmAtlas.value.timing.cacheHitRate,
    summaryTimings: warmState.value.summaryTimings,
  };
}

function assertProfileResult(result: ProfileWorldResult) {
  if (!result.atlasWarmCacheHit) {
    throw new Error(`${result.slug} warm atlas snapshot did not hit the cache.`);
  }

  if (result.atlasWarmMs > warmSnapshotThresholdMs) {
    throw new Error(
      `${result.slug} warm atlas snapshot took ${formatMs(result.atlasWarmMs)}, above threshold ${formatMs(warmSnapshotThresholdMs)}.`,
    );
  }
}

async function main() {
  if (!Number.isFinite(warmSnapshotThresholdMs) || warmSnapshotThresholdMs <= 0) {
    throw new Error("SNAPSHOT_WARM_THRESHOLD_MS must be a positive number.");
  }

  const worlds = await listWorlds({ status: WorldStatus.ACTIVE });

  if (worlds.length === 0) {
    throw new Error("No ACTIVE worlds found to profile.");
  }

  console.log(`Profiling ${worlds.length} active world(s). Warm atlas threshold: ${formatMs(warmSnapshotThresholdMs)}.`);

  const results: ProfileWorldResult[] = [];

  for (const world of worlds) {
    const result = await profileWorld(world);
    assertProfileResult(result);
    results.push(result);

    console.log(`\n${result.name} (${result.slug})`);
    console.log(`  tick=${result.tick} selectedDay=${result.selectedDay}`);
    console.log(`  getSimulationState cold ${formatMs(result.simulationColdMs)} | warm ${formatMs(result.simulationWarmMs)}`);
    console.log(`  atlas snapshot      cold ${formatMs(result.atlasColdMs)} | warm ${formatMs(result.atlasWarmMs)} | warm hit=${result.atlasWarmCacheHit} | hit rate=${formatPercent(result.atlasWarmCacheHitRate)}`);
    console.log(`  summaryTimings warm hit rate=${formatPercent(summarizeCacheHitRate(result.summaryTimings))}`);
    printSummaryTimings(result.summaryTimings);
  }

  const summaryTimingEntries = results.flatMap((result) => Object.values(result.summaryTimings));
  const summaryHits = summaryTimingEntries.filter((timing) => timing.cacheHit).length;
  const summaryTimings = {
    worldsProfiled: results.length,
    summaryTimingEntries: summaryTimingEntries.length,
    summaryCacheHitRate: summaryTimingEntries.length > 0 ? summaryHits / summaryTimingEntries.length : 0,
    atlasWarmCacheHitRate: results.filter((result) => result.atlasWarmCacheHit).length / results.length,
    maxWarmAtlasMs: Math.max(...results.map((result) => result.atlasWarmMs)),
    warmSnapshotThresholdMs,
  };

  console.log("\nsummaryTimings");
  console.log(JSON.stringify(summaryTimings, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });