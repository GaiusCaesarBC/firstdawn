import { afterAll, afterEach, describe, expect, it } from "vitest";

import { createPlaceholderSystem } from "../../src/lib/simulation/systems/types";
import { SimulationScheduler } from "../../src/lib/simulation/scheduler";
import {
  getSimulationWorkerStatus,
  runOneSimulationTick,
} from "../../src/lib/simulation/simulation-worker";
import {
  getLatestPersistedAtlasSnapshot,
  persistAtlasSnapshotForTick,
} from "../../src/lib/simulation/snapshot-store";
import { prisma } from "../../src/lib/worlds/world-lifecycle";
import {
  cleanupTestWorld,
  createActiveSandboxTestWorld,
} from "../helpers/test-worlds";

const createdSlugs = new Set<string>();

async function track<T extends { slug: string }>(worldPromise: Promise<T>): Promise<T> {
  const world = await worldPromise;
  createdSlugs.add(world.slug);
  return world;
}

async function loadWorldWithPlanet(worldId: string) {
  return prisma.world.findUniqueOrThrow({
    where: { id: worldId },
    include: { planet: true },
  });
}

afterEach(async () => {
  for (const slug of [...createdSlugs]) {
    await cleanupTestWorld(slug);
    createdSlugs.delete(slug);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("simulation worker", () => {
  it("runs one tick without browser or React globals", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const scheduler = new SimulationScheduler([
      createPlaceholderSystem("worker-test-system", "Worker Test System", 10, () => ({ success: true })),
    ]);

    expect(globalThis.window).toBeUndefined();

    const result = await runOneSimulationTick(await loadWorldWithPlanet(world.id), {
      persistSnapshots: false,
      scheduler,
      logger: {
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
      },
    });
    const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });

    expect(result.tick).toBe(1n);
    expect(result.success).toBe(true);
    expect(updatedWorld.currentTick).toBe(1n);
  });

  it("persists and reads the latest Atlas snapshot from SimulationTick metadata", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const timestamp = new Date();

    await prisma.simulationTick.create({
      data: {
        worldId: world.id,
        tick: 1n,
        durationMs: 1,
        success: true,
        systemCount: 1,
        failedSystemCount: 0,
        startedAt: timestamp,
        completedAt: timestamp,
        metadata: { source: "snapshot-store-test" },
      },
    });

    await persistAtlasSnapshotForTick(await loadWorldWithPlanet(world.id), 1n, {
      selectedDay: 1,
      buildSnapshot: () => ({
        durationMs: 1,
        value: {
          worldId: world.id,
          worldSlug: world.slug,
          worldName: world.name,
          selectedDay: 1,
          tick: "1",
          cells: [],
        } as never,
      }),
    });

    const persisted = await getLatestPersistedAtlasSnapshot(world.id);

    expect(persisted?.tick).toBe("1");
    expect(persisted?.snapshot.worldId).toBe(world.id);
    expect(persisted?.snapshot.worldSlug).toBe(world.slug);
  });

  it("keeps worker-driven ticks deterministic for the same seed and system", async () => {
    const seed = "worker-determinism-seed";
    const firstWorld = await track(createActiveSandboxTestWorld({ seed }));
    const secondWorld = await track(createActiveSandboxTestWorld({ seed }));
    const deterministicSystem = createPlaceholderSystem("worker-determinism", "Worker Determinism", 10, (context) => ({
      success: true,
      metadata: {
        sample: context.random.integer(1, 1_000_000),
        tick: context.tick.toString(),
      },
    }));
    const scheduler = new SimulationScheduler([deterministicSystem]);

    await runOneSimulationTick(await loadWorldWithPlanet(firstWorld.id), { persistSnapshots: false, scheduler });
    await runOneSimulationTick(await loadWorldWithPlanet(secondWorld.id), { persistSnapshots: false, scheduler });

    async function sampleFor(worldId: string) {
      const tick = await prisma.simulationTick.findFirstOrThrow({
        where: { worldId },
        orderBy: { tick: "desc" },
      });
      const metadata = tick.metadata as { pipeline?: Array<{ id: string; metadata?: unknown }> };

      return metadata.pipeline?.find((entry) => entry.id === "worker-determinism")?.metadata;
    }

    expect(await sampleFor(firstWorld.id)).toEqual(await sampleFor(secondWorld.id));
  });

  it("exposes status from persisted database state", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const scheduler = new SimulationScheduler([
      createPlaceholderSystem("worker-status-system", "Worker Status System", 10, () => ({ success: true })),
    ]);

    await runOneSimulationTick(await loadWorldWithPlanet(world.id), { persistSnapshots: false, scheduler });

    const status = await getSimulationWorkerStatus(world.id);

    expect(status.activeWorld?.id).toBe(world.id);
    expect(status.latestTick?.tick).toBe("1");
    expect(status.health?.latestSimulationTickNumber).toBe("1");
  });
});
