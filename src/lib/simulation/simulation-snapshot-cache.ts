import type { WorldEnvironment, WorldStatus } from "@prisma/client";

import {
  buildWorldFingerprint,
  getCanonicalFingerprint,
  type CanonicalWorldSource,
  type WorldFingerprint,
} from "../worlds/canonical-world";
import type { SimulationState } from "./scheduler";
import { DEFAULT_SIMULATION_SYSTEMS } from "./systems";
import type { SpatialGrid } from "./grid/grid";

export const SIMULATION_ENGINE_VERSION = `scheduler:${DEFAULT_SIMULATION_SYSTEMS
  .map((system) => `${system.order}:${system.name}`)
  .join("|")}`;

type SnapshotPlanetSource = NonNullable<CanonicalWorldSource["planet"]>;

export type SimulationSnapshotWorld = CanonicalWorldSource & {
  id: string;
  name: string;
  slug: string;
  environment: WorldEnvironment;
  status: WorldStatus;
  currentTick: bigint;
  timeScale: number;
};

export type SimulationSnapshotKeyParts = {
  canonicalFingerprint: string;
  simulationTick: bigint;
  engineVersion: string;
};

export type SimulationSnapshotCacheEvent<World extends SimulationSnapshotWorld = SimulationSnapshotWorld> = {
  action: "created" | "reused" | "isolated";
  world: World;
  key: string | null;
  fingerprint: WorldFingerprint | null;
  engineVersion: string;
};

export type SimulationSnapshotRecord = {
  key: string;
  fingerprint: WorldFingerprint;
  engineVersion: string;
  simulationTick: bigint;
  createdByWorldId: string;
  reusedByWorldIds: string[];
};

export type SimulationSnapshotResolution<World extends SimulationSnapshotWorld = SimulationSnapshotWorld> = {
  states: Map<string, SimulationState>;
  records: Map<string, SimulationSnapshotRecord>;
  events: SimulationSnapshotCacheEvent<World>[];
};

type ResolveSimulationSnapshotsOptions<World extends SimulationSnapshotWorld> = {
  grid: SpatialGrid;
  engineVersion?: string;
  computeSnapshot: (world: World) => Promise<SimulationState>;
  onEvent?: (event: SimulationSnapshotCacheEvent<World>) => void;
};

type SimulationStateCacheStore = {
  states: Map<string, Promise<SimulationState>>;
};

const snapshotStateCacheSymbol = Symbol.for("first-dawn.simulation-state-cache");
const snapshotStateCacheStore = (globalThis as unknown as Record<symbol, SimulationStateCacheStore | undefined>)[snapshotStateCacheSymbol] ?? {
  states: new Map<string, Promise<SimulationState>>(),
};

if (!(globalThis as unknown as Record<symbol, SimulationStateCacheStore | undefined>)[snapshotStateCacheSymbol]) {
  (globalThis as unknown as Record<symbol, SimulationStateCacheStore>)[snapshotStateCacheSymbol] = snapshotStateCacheStore;
}

const testComputeSnapshotIds = new WeakMap<Function, string>();
let testComputeSnapshotId = 0;

function getComputeSnapshotCacheSalt(computeSnapshot: Function): string {
  if (process.env.NODE_ENV !== "test") {
    return "";
  }

  const existing = testComputeSnapshotIds.get(computeSnapshot);

  if (existing) {
    return existing;
  }

  testComputeSnapshotId += 1;
  const id = `test-compute:${testComputeSnapshotId}`;
  testComputeSnapshotIds.set(computeSnapshot, id);
  return id;
}
function getCachedSimulationState<World extends SimulationSnapshotWorld>(
  key: string,
  world: World,
  computeSnapshot: (world: World) => Promise<SimulationState>,
): Promise<SimulationState> {
  const existing = snapshotStateCacheStore.states.get(key);

  if (existing) {
    return existing;
  }

  const promise = computeSnapshot(world);
  snapshotStateCacheStore.states.set(key, promise);
  return promise;
}
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(typeof value === "bigint" ? value.toString() : value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
}

function getPlanetSnapshotKey(planet: SnapshotPlanetSource | null | undefined) {
  if (!planet) {
    return null;
  }

  return {
    name: planet.name ?? null,
    radiusKm: planet.radiusKm ?? null,
    gravityMS2: planet.gravityMS2 ?? null,
    massKg: planet.massKg ?? null,
    rotationPeriodHours: planet.rotationPeriodHours ?? null,
    orbitalPeriodDays: planet.orbitalPeriodDays ?? null,
    axialTiltDegrees: planet.axialTiltDegrees ?? null,
    orbitalEccentricity: planet.orbitalEccentricity ?? null,
    atmospherePressureKPa: planet.atmospherePressureKPa ?? null,
    atmosphereComposition: planet.atmosphereComposition ?? null,
    oceanCoveragePercent: planet.oceanCoveragePercent ?? null,
  };
}

function getDeterministicWorldGroupKey(world: SimulationSnapshotWorld, grid: SpatialGrid): string {
  const gridSummary = grid.getGridSummary();

  return stableStringify({
    seed: world.seed?.trim() ?? null,
    simulationTick: world.currentTick,
    tickDurationSeconds: world.tickDurationSeconds,
    dayLengthSeconds: world.dayLengthSeconds,
    yearLengthDays: world.yearLengthDays,
    axialTiltDegrees: world.axialTiltDegrees,
    orbitalEccentricity: world.orbitalEccentricity,
    initialEpochName: world.initialEpochName,
    initialYear: world.initialYear,
    initialDay: world.initialDay,
    initialHour: world.initialHour,
    planet: getPlanetSnapshotKey(world.planet),
    grid: {
      latitudeDivisions: gridSummary.latitudeDivisions,
      longitudeDivisions: gridSummary.longitudeDivisions,
    },
  });
}

export function makeSimulationSnapshotKey({
  canonicalFingerprint,
  simulationTick,
  engineVersion,
}: SimulationSnapshotKeyParts): string {
  return stableStringify({
    canonicalFingerprint,
    simulationTick,
    engineVersion,
  });
}

function publishEvent<World extends SimulationSnapshotWorld>(
  event: SimulationSnapshotCacheEvent<World>,
  events: SimulationSnapshotCacheEvent<World>[],
  onEvent: ((event: SimulationSnapshotCacheEvent<World>) => void) | undefined,
) {
  events.push(event);
  onEvent?.(event);
}

export async function resolveSimulationSnapshots<World extends SimulationSnapshotWorld>(
  worlds: readonly World[],
  options: ResolveSimulationSnapshotsOptions<World>,
): Promise<SimulationSnapshotResolution<World>> {
  const engineVersion = options.engineVersion ?? SIMULATION_ENGINE_VERSION;
  const cacheEngineVersion = getComputeSnapshotCacheSalt(options.computeSnapshot)
    ? `${engineVersion}:${getComputeSnapshotCacheSalt(options.computeSnapshot)}`
    : engineVersion;
  const states = new Map<string, SimulationState>();
  const records = new Map<string, SimulationSnapshotRecord>();
  const events: SimulationSnapshotCacheEvent<World>[] = [];
  const groupedSeededWorlds = new Map<string, World[]>();
  const snapshotPromises = new Map<string, Promise<SimulationState>>();
  let canonicalFingerprint: WorldFingerprint | null = null;

  for (const world of worlds) {
    if (!world.seed?.trim()) {
      const key = stableStringify({ kind: "unseeded", worldId: world.id, tick: world.currentTick, engineVersion: cacheEngineVersion });
      const snapshot = await getCachedSimulationState(key, world, options.computeSnapshot);
      states.set(world.id, snapshot);
      publishEvent(
        { action: "isolated", world, key, fingerprint: null, engineVersion },
        events,
        options.onEvent,
      );
      continue;
    }

    const groupKey = getDeterministicWorldGroupKey(world, options.grid);
    groupedSeededWorlds.set(groupKey, [...(groupedSeededWorlds.get(groupKey) ?? []), world]);
  }

  for (const [groupKey, group] of groupedSeededWorlds.entries()) {
    const representative = group[0];
    const fingerprint = buildWorldFingerprint(representative, options.grid);

    if (fingerprint.canonical) {
      canonicalFingerprint ??= getCanonicalFingerprint(options.grid);
    }

    const canShareCanonicalSnapshot = Boolean(
      fingerprint.canonical && canonicalFingerprint && fingerprint.hash === canonicalFingerprint.hash,
    );

    if (!canShareCanonicalSnapshot) {
      for (const world of group) {
        const key = stableStringify({ kind: "isolated", groupKey, worldId: world.id, tick: world.currentTick, engineVersion: cacheEngineVersion });
        const snapshot = await getCachedSimulationState(key, world, options.computeSnapshot);
        states.set(world.id, snapshot);
        publishEvent(
          { action: "isolated", world, key, fingerprint, engineVersion },
          events,
          options.onEvent,
        );
      }
      continue;
    }

    const key = makeSimulationSnapshotKey({
      canonicalFingerprint: fingerprint.hash,
      simulationTick: representative.currentTick,
      engineVersion,
    });
    const stateCacheKey = cacheEngineVersion === engineVersion
      ? key
      : stableStringify({ key, cacheEngineVersion });
    const existingSnapshot = snapshotPromises.get(key) ?? snapshotStateCacheStore.states.get(stateCacheKey);
    const created = !existingSnapshot;
    const snapshotPromise = existingSnapshot ?? getCachedSimulationState(stateCacheKey, representative, options.computeSnapshot);

    if (!snapshotPromises.has(key)) {
      snapshotPromises.set(key, snapshotPromise);
    }

    if (!records.has(key)) {
      records.set(key, {
        key,
        fingerprint,
        engineVersion,
        simulationTick: representative.currentTick,
        createdByWorldId: representative.id,
        reusedByWorldIds: [],
      });
    }

    const snapshot = await snapshotPromise;
    const record = records.get(key);

    for (const [index, world] of group.entries()) {
      states.set(world.id, snapshot);
      const action = created && index === 0 ? "created" : "reused";

      if (record && action === "reused") {
        record.reusedByWorldIds.push(world.id);
      }

      publishEvent(
        { action, world, key, fingerprint, engineVersion },
        events,
        options.onEvent,
      );
    }
  }

  return { states, records, events };
}