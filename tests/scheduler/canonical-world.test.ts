import { readFileSync } from "node:fs";

import { WorldEnvironment, WorldStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createGrid } from "../../src/lib/simulation/grid/grid";
import type { SimulationState } from "../../src/lib/simulation/scheduler";
import { resolveSimulationSnapshots } from "../../src/lib/simulation/simulation-snapshot-cache";
import { getTerrainState } from "../../src/lib/simulation/terrain-engine";
import {
  buildAtlasSnapshot,
  type AtlasSnapshot,
} from "../../src/lib/worlds/map-atlas";
import {
  buildCanonicalWorldRecord,
  buildWorldFingerprint,
  CANONICAL_DEFAULT_WORLD_ALIASES,
  createCanonicalDefaultWorldInput,
  createCanonicalWorldInput,
  CANONICAL_PLANET_CONFIG,
  FIRST_DAWN_CANONICAL_SEED,
  FIRST_DAWN_CANONICAL_WORLD,
  getCanonicalWorldSeed,
  verifyEnvironmentWorlds,
  verifyWorldAgainstCanonical,
} from "../../src/lib/worlds/canonical-world";

function canonicalWorld(environment = WorldEnvironment.SANDBOX) {
  return buildCanonicalWorldRecord({
    environment,
    status: environment === WorldEnvironment.SANDBOX ? WorldStatus.ACTIVE : WorldStatus.PAUSED,
  });
}

function atlasWorld(displayName: string, environment = WorldEnvironment.SANDBOX) {
  const input = createCanonicalWorldInput(displayName, {
    environment,
    status: environment === WorldEnvironment.SANDBOX ? WorldStatus.ACTIVE : WorldStatus.PAUSED,
    protected: environment === WorldEnvironment.PRODUCTION,
  });

  return {
    id: `canonical-${displayName.toLowerCase()}`,
    ...input,
  } as any;
}

function stripSnapshotLabels(snapshot: AtlasSnapshot) {
  const { worldId, worldSlug, worldName, ...rest } = snapshot;
  return rest;
}


function simulationStateFor(world: ReturnType<typeof atlasWorld>, grid = createGrid()): SimulationState {
  return {
    worldId: world.id,
    worldName: world.name,
    worldSlug: world.slug,
    environment: world.environment,
    status: world.status,
    currentTick: world.currentTick,
    timeScale: world.timeScale,
    simulationRunning: world.status === WorldStatus.ACTIVE,
    canAdvance: world.status === WorldStatus.ACTIVE && world.environment !== WorldEnvironment.PRODUCTION,
    metrics: {
      totalTicks: Number(world.currentTick),
      averageTickTimeMs: 12,
      slowestTickMs: 18,
      fastestTickMs: 8,
      totalSystemsExecuted: 20,
      failedSystems: 0,
      uptimeMs: 1000,
      ticksPerSecond: 1,
      lastTickDurationMs: 12,
      lastTickCompletedAt: null,
    },
    terrainSummary: getTerrainState(world, grid).summary,
    hydrologySummary: null,
    atmosphereSummary: null,
    weatherSummary: null,
  };
}
function terrainDistribution(world: ReturnType<typeof canonicalWorld>) {
  const terrain = getTerrainState(world);

  return {
    terrainSeed: terrain.terrainSeed,
    terrainDistribution: terrain.summary.terrainDistribution,
    oceanPercent: terrain.summary.oceanPercent,
    landPercent: terrain.summary.landPercent,
    coastlineCells: terrain.summary.coastlineCells,
    largestContinentEstimate: terrain.summary.largestContinentEstimate,
    largestOceanEstimate: terrain.summary.largestOceanEstimate,
  };
}

describe("canonical world", () => {
  it("uses one immutable canonical seed by default", () => {
    expect(getCanonicalWorldSeed()).toBe(FIRST_DAWN_CANONICAL_SEED);
    expect(canonicalWorld().seed).toBe(FIRST_DAWN_CANONICAL_WORLD.seed);
  });

  it("default aliases all use the canonical seed", () => {
    const defaults = CANONICAL_DEFAULT_WORLD_ALIASES.map(createCanonicalDefaultWorldInput);

    expect(defaults.find((world) => world.name === "Sandbox World")?.seed).toBe(FIRST_DAWN_CANONICAL_SEED);
    expect(defaults.find((world) => world.name === "Placeholder World")?.seed).toBe(FIRST_DAWN_CANONICAL_SEED);
    expect(defaults.find((world) => world.name === "Production World")?.seed).toBe(FIRST_DAWN_CANONICAL_SEED);
    expect(new Set(defaults.map((world) => world.seed)).size).toBe(1);
  });

  it("same seed produces identical worlds", () => {
    const first = buildWorldFingerprint(canonicalWorld());
    const second = buildWorldFingerprint({ ...canonicalWorld(), name: "Renamed Local Copy" });

    expect(first.hash).toBe(second.hash);
    expect(first.payload).toEqual(second.payload);
  });

  it("fingerprint is deterministic", () => {
    const world = canonicalWorld();

    expect(buildWorldFingerprint(world).hash).toBe(buildWorldFingerprint(world).hash);
  });

  it("environment worlds match the canonical fingerprint", () => {
    const results = verifyEnvironmentWorlds([
      canonicalWorld(WorldEnvironment.SANDBOX),
      canonicalWorld(WorldEnvironment.STAGING),
      canonicalWorld(WorldEnvironment.PRODUCTION),
    ]);

    expect(results.every((result) => result.matches)).toBe(true);
    expect(new Set(results.map((result) => result.actualHash)).size).toBe(1);
  });

  it("terrain validation succeeds for the canonical world", () => {
    const terrain = getTerrainState(canonicalWorld());

    expect(terrain.validation.valid).toBe(true);
    expect(terrain.validation.violations).toEqual([]);
  });

  it("keeps polar land below threshold", () => {
    expect(getTerrainState(canonicalWorld()).summary.polarLandPercent).toBeLessThan(15);
  });

  it("keeps habitable land above threshold", () => {
    expect(getTerrainState(canonicalWorld()).summary.habitableLandPercent).toBeGreaterThan(60);
  });

  it("keeps ocean percentage within limits", () => {
    const terrain = getTerrainState(canonicalWorld());

    expect(terrain.summary.oceanPercent).toBeGreaterThanOrEqual(60);
    expect(terrain.summary.oceanPercent).toBeLessThanOrEqual(75);
  });

  it("generates identical fingerprints for sandbox, placeholder, and production", () => {
    const sandbox = atlasWorld("Sandbox", WorldEnvironment.SANDBOX);
    const placeholder = atlasWorld("Placeholder", WorldEnvironment.STAGING);
    const production = atlasWorld("Production", WorldEnvironment.PRODUCTION);

    expect(buildWorldFingerprint(sandbox).hash).toBe(buildWorldFingerprint(placeholder).hash);
    expect(buildWorldFingerprint(placeholder).hash).toBe(buildWorldFingerprint(production).hash);
  });

  it("generates identical terrain grids cell by cell", () => {
    const grid = createGrid();
    const sandbox = getTerrainState(atlasWorld("Sandbox", WorldEnvironment.SANDBOX), grid);
    const placeholder = getTerrainState(atlasWorld("Placeholder", WorldEnvironment.STAGING), grid);
    const production = getTerrainState(atlasWorld("Production", WorldEnvironment.PRODUCTION), grid);

    expect(sandbox.seed).toBe(FIRST_DAWN_CANONICAL_SEED);
    expect(sandbox.terrainSeed).toBe(placeholder.terrainSeed);
    expect(placeholder.terrainSeed).toBe(production.terrainSeed);
    expect(sandbox.terrainSeed.startsWith(FIRST_DAWN_CANONICAL_SEED)).toBe(true);
    expect(sandbox.cells).toEqual(placeholder.cells);
    expect(placeholder.cells).toEqual(production.cells);
  });

  it("keeps ocean, land, and coastline distribution identical", () => {
    const sandbox = terrainDistribution(canonicalWorld(WorldEnvironment.SANDBOX));
    const placeholder = terrainDistribution(canonicalWorld(WorldEnvironment.STAGING));
    const production = terrainDistribution(canonicalWorld(WorldEnvironment.PRODUCTION));

    expect(sandbox).toEqual(placeholder);
    expect(placeholder).toEqual(production);
  });

  it("changing display name does not change terrain", () => {
    const first = getTerrainState(atlasWorld("Sandbox"));
    const second = getTerrainState(atlasWorld("Production"));

    expect(first.cells).toEqual(second.cells);
    expect(buildWorldFingerprint(atlasWorld("Sandbox")).hash).toBe(
      buildWorldFingerprint(atlasWorld("Production")).hash,
    );
  });

  it("changing environment name does not change terrain", () => {
    const sandbox = atlasWorld("Same Planet", WorldEnvironment.SANDBOX);
    const production = atlasWorld("Same Planet", WorldEnvironment.PRODUCTION);

    expect(getTerrainState(sandbox).cells).toEqual(getTerrainState(production).cells);
    expect(buildWorldFingerprint(sandbox).hash).toBe(buildWorldFingerprint(production).hash);
  });

  it("changing database id does not change terrain or fingerprint", () => {
    const first = { ...atlasWorld("Sandbox"), id: "database-id-one" };
    const second = { ...atlasWorld("Sandbox"), id: "database-id-two" };

    expect(getTerrainState(first).cells).toEqual(getTerrainState(second).cells);
    expect(buildWorldFingerprint(first).hash).toBe(buildWorldFingerprint(second).hash);
  });

  it("changing current tick does not change canonical fingerprint", () => {
    const baseline = atlasWorld("Sandbox", WorldEnvironment.SANDBOX);
    const advanced = { ...baseline, currentTick: 2315n };

    expect(buildWorldFingerprint(advanced).hash).toBe(buildWorldFingerprint(baseline).hash);
    expect(verifyWorldAgainstCanonical(advanced).matches).toBe(true);
  });
  it("regresses full atlas snapshots for canonical display aliases", () => {
    const sandbox = atlasWorld("Sandbox");
    const placeholder = atlasWorld("Placeholder");
    const production = atlasWorld("Production");
    const sandboxSnapshot = buildAtlasSnapshot(sandbox, 1);
    const placeholderSnapshot = buildAtlasSnapshot(placeholder, 1);
    const productionSnapshot = buildAtlasSnapshot(production, 1);

    expect(sandboxSnapshot.cells).toEqual(placeholderSnapshot.cells);
    expect(placeholderSnapshot.cells).toEqual(productionSnapshot.cells);
    expect(stripSnapshotLabels(sandboxSnapshot)).toEqual(stripSnapshotLabels(placeholderSnapshot));
    expect(stripSnapshotLabels(placeholderSnapshot)).toEqual(stripSnapshotLabels(productionSnapshot));
  });

  it("computes one reusable simulation snapshot for canonical aliases", async () => {
    const grid = createGrid();
    const sandbox = atlasWorld("Sandbox", WorldEnvironment.SANDBOX);
    const placeholder = atlasWorld("Placeholder", WorldEnvironment.STAGING);
    const production = atlasWorld("Production", WorldEnvironment.PRODUCTION);
    const computeSnapshot = vi.fn(async (world: typeof sandbox) => simulationStateFor(world, grid));

    const result = await resolveSimulationSnapshots([sandbox, placeholder, production], {
      grid,
      computeSnapshot,
    });

    expect(computeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.events.map((event) => event.action)).toEqual(["created", "reused", "reused"]);
    expect(result.records.size).toBe(1);
  });

  it("reuses the identical snapshot object for canonical aliases", async () => {
    const grid = createGrid();
    const sandbox = atlasWorld("Sandbox", WorldEnvironment.SANDBOX);
    const placeholder = atlasWorld("Placeholder", WorldEnvironment.STAGING);
    const production = atlasWorld("Production", WorldEnvironment.PRODUCTION);

    const result = await resolveSimulationSnapshots([sandbox, placeholder, production], {
      grid,
      computeSnapshot: async (world) => simulationStateFor(world, grid),
    });

    expect(result.states.get(sandbox.id)).toBe(result.states.get(placeholder.id));
    expect(result.states.get(placeholder.id)).toBe(result.states.get(production.id));
    expect(result.states.get(sandbox.id)).toEqual(result.states.get(production.id));
  });

  it("does not reuse snapshots for different fingerprints", async () => {
    const grid = createGrid();
    const sandbox = atlasWorld("Sandbox", WorldEnvironment.SANDBOX);
    const altered = {
      ...atlasWorld("Altered", WorldEnvironment.STAGING),
      id: "altered-fingerprint",
      planet: {
        ...CANONICAL_PLANET_CONFIG,
        name: "Altered Canonical Planet",
        radiusKm: CANONICAL_PLANET_CONFIG.radiusKm + 10,
      },
    };
    const computeSnapshot = vi.fn(async (world: typeof sandbox) => simulationStateFor(world, grid));

    const result = await resolveSimulationSnapshots([sandbox, altered], {
      grid,
      computeSnapshot,
    });

    expect(buildWorldFingerprint(sandbox, grid).hash).not.toBe(buildWorldFingerprint(altered, grid).hash);
    expect(computeSnapshot).toHaveBeenCalledTimes(2);
    expect(result.states.get(sandbox.id)).not.toBe(result.states.get(altered.id));
  });

  it("keeps canonical simulation values identical while preserving dashboard labels", async () => {
    const grid = createGrid();
    const sandbox = atlasWorld("Sandbox", WorldEnvironment.SANDBOX);
    const placeholder = atlasWorld("Placeholder", WorldEnvironment.STAGING);
    const production = atlasWorld("Production", WorldEnvironment.PRODUCTION);
    const worlds = [sandbox, placeholder, production];

    const result = await resolveSimulationSnapshots(worlds, {
      grid,
      computeSnapshot: async (world) => simulationStateFor(world, grid),
    });
    const rows = worlds.map((world) => ({
      label: world.name,
      tick: result.states.get(world.id)?.currentTick.toString(),
      terrain: result.states.get(world.id)?.terrainSummary,
    }));

    expect(rows.map((row) => row.label)).toEqual(["Sandbox", "Placeholder", "Production"]);
    expect(rows.map((row) => row.tick)).toEqual(["0", "0", "0"]);
    expect(rows[0].terrain).toEqual(getTerrainState(production, grid).summary);
    expect(rows[1].terrain).toBe(rows[0].terrain);
    expect(rows[2].terrain).toBe(rows[0].terrain);
  });

  it("keys canonical snapshots by fingerprint, tick, and engine version only", async () => {
    const grid = createGrid();
    const sandbox = atlasWorld("Sandbox", WorldEnvironment.SANDBOX);
    const placeholder = atlasWorld("Placeholder", WorldEnvironment.STAGING);
    const engineVersion = "test-engine-version";

    const result = await resolveSimulationSnapshots([sandbox, placeholder], {
      grid,
      engineVersion,
      computeSnapshot: async (world) => simulationStateFor(world, grid),
    });
    const [record] = [...result.records.values()];

    expect(record.key).toContain(buildWorldFingerprint(sandbox, grid).hash);
    expect(record.key).toContain(sandbox.currentTick.toString());
    expect(record.key).toContain(engineVersion);
    expect(record.key).not.toContain(sandbox.id);
    expect(record.key).not.toContain(sandbox.slug);
    expect(record.key).not.toContain(sandbox.name);
    expect(record.key).not.toContain(sandbox.environment);
  });
  it("keeps default world creation paths free of runtime entropy terrain inputs", () => {
    const files = [
      "src/lib/worlds/canonical-world.ts",
      "src/lib/worlds/world-lifecycle.ts",
      "prisma/seed.js",
    ];
    const bannedPatterns = ["Math.random", "Date.now", "randomUUID"];
    const offenders = files.flatMap((file) => {
      const contents = readFileSync(file, "utf8");
      return bannedPatterns
        .filter((pattern) => contents.includes(pattern))
        .map((pattern) => `${file}: ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });

  it("changing environment variables never changes the world", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const before = buildWorldFingerprint(canonicalWorld()).hash;

    try {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgresql://different.example/first_dawn";

      expect(buildWorldFingerprint(canonicalWorld()).hash).toBe(before);
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }

      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });
});
