import { afterAll, afterEach, describe, expect, it } from "vitest";
import { WorldEnvironment, WorldStatus } from "@prisma/client";

import {
  DEFAULT_SIMULATION_SYSTEMS,
  type SimulationSystem,
} from "../../src/lib/simulation/systems";
import { createPlaceholderSystem } from "../../src/lib/simulation/systems/types";
import {
  SimulationScheduler,
  SimulationSchedulerError,
} from "../../src/lib/simulation/scheduler";
import { prisma } from "../../src/lib/worlds/world-lifecycle";
import {
  cleanupTestWorld,
  createActiveSandboxTestWorld,
  createTestWorld,
} from "../helpers/test-worlds";

const createdSlugs = new Set<string>();

async function track<T extends { slug: string }>(worldPromise: Promise<T>): Promise<T> {
  const world = await worldPromise;
  createdSlugs.add(world.slug);
  return world;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function expectSchedulerError(task: () => Promise<unknown>, code: string): Promise<void> {
  await expect(task()).rejects.toMatchObject({
    code,
    name: SimulationSchedulerError.name,
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

describe("simulation scheduler guardrails", () => {
  it("does not advance a paused world", async () => {
    const world = await track(createTestWorld({ status: WorldStatus.PAUSED }));

    await expectSchedulerError(
      () => SimulationScheduler.advanceTick(world.id),
      "SIMULATION_NOT_ACTIVE",
    );
  });

  it("does not advance an archived world", async () => {
    const world = await track(createTestWorld({ status: WorldStatus.ARCHIVED }));

    await expectSchedulerError(
      () => SimulationScheduler.advanceTick(world.id),
      "SIMULATION_NOT_ACTIVE",
    );
  });

  it("does not advance a production world by default", async () => {
    const world = await track(
      createTestWorld({
        description: "Temporary isolated production guardrail test world.",
        environment: WorldEnvironment.PRODUCTION,
        protected: true,
        status: WorldStatus.PAUSED,
      }),
    );

    await expectSchedulerError(
      () => SimulationScheduler.advanceTick(world.id),
      "PRODUCTION_ADVANCE_BLOCKED",
    );
  });

  it("does not advance a protected production world", async () => {
    const world = await track(
      createTestWorld({
        description: "Temporary isolated protected production guardrail test world.",
        environment: WorldEnvironment.PRODUCTION,
        protected: true,
        status: WorldStatus.ACTIVE,
      }),
    );

    await expectSchedulerError(
      () => SimulationScheduler.advanceTick(world.id),
      "PRODUCTION_ADVANCE_BLOCKED",
    );
  });

  it("rejects invalid tick counts", async () => {
    const world = await track(createActiveSandboxTestWorld());

    await expectSchedulerError(
      () => SimulationScheduler.advanceTicks(world.id, 0),
      "INVALID_TICK_COUNT",
    );
    await expectSchedulerError(
      () => SimulationScheduler.advanceTicks(world.id, 1.5),
      "INVALID_TICK_COUNT",
    );
  });

  it("rejects tick counts above the safe maximum", async () => {
    const world = await track(createActiveSandboxTestWorld());

    await expectSchedulerError(
      () => SimulationScheduler.advanceTicks(world.id, 10_001),
      "INVALID_TICK_COUNT",
    );
  });
});

describe("simulation scheduler tick persistence", () => {
  it("increments World.currentTick and creates a successful SimulationTick for one tick", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const result = await SimulationScheduler.advanceTick(world.id);
    const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });
    const tick = await prisma.simulationTick.findUniqueOrThrow({
      where: { worldId_tick: { tick: 1n, worldId: world.id } },
    });

    expect(result.tick).toBe(1n);
    expect(updatedWorld.currentTick).toBe(1n);
    expect(tick.success).toBe(true);
    expect(tick.systemCount).toBe(DEFAULT_SIMULATION_SYSTEMS.length);
    expect(result.systemCount).toBe(DEFAULT_SIMULATION_SYSTEMS.length);
  });

  it("records time and astronomy metadata in SimulationTick metadata", async () => {
    const world = await track(createActiveSandboxTestWorld());

    await SimulationScheduler.advanceTick(world.id);

    const tick = await prisma.simulationTick.findUniqueOrThrow({
      where: { worldId_tick: { tick: 1n, worldId: world.id } },
    });
    const metadata = tick.metadata as {
      pipeline?: Array<{ metadata?: Record<string, unknown> | null; name: string }>;
    };
    const time = metadata.pipeline?.find((entry) => entry.name === "time")?.metadata;
    const astronomy = metadata.pipeline?.find((entry) => entry.name === "astronomy")?.metadata;

    expect(time).toMatchObject({
      tick: "1",
      epochName: "First Dawn",
      phaseLabel: "sunrise",
    });
    expect(astronomy).toMatchObject({
      tick: "1",
      moonPhase: "unmodeled",
      skyLabel: "sunrise",
    });
  });

  it("increments correctly and records every successful tick when advancing multiple ticks", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const results = await SimulationScheduler.advanceTicks(world.id, 3);
    const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });
    const ticks = await prisma.simulationTick.findMany({
      orderBy: { tick: "asc" },
      where: { worldId: world.id },
    });

    expect(results.map((result) => result.tick)).toEqual([1n, 2n, 3n]);
    expect(updatedWorld.currentTick).toBe(3n);
    expect(ticks).toHaveLength(3);
    expect(ticks.every((tick) => tick.success)).toBe(true);
    expect(ticks.every((tick) => tick.systemCount === DEFAULT_SIMULATION_SYSTEMS.length)).toBe(true);
  });

  it("advances from the latest SimulationTick when World.currentTick is stale", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const timestamp = new Date();

    await prisma.simulationTick.create({
      data: {
        worldId: world.id,
        tick: 1n,
        durationMs: 0,
        success: true,
        systemCount: 0,
        failedSystemCount: 0,
        startedAt: timestamp,
        completedAt: timestamp,
        metadata: { source: "stale-current-tick-regression" },
      },
    });

    const result = await SimulationScheduler.advanceTick(world.id);
    const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });
    const ticks = await prisma.simulationTick.findMany({
      orderBy: { tick: "asc" },
      where: { worldId: world.id },
    });
    const metadata = ticks[1]?.metadata as { fromTick?: string } | null;

    expect(result.tick).toBe(2n);
    expect(updatedWorld.currentTick).toBe(2n);
    expect(ticks.map((tick) => tick.tick)).toEqual([1n, 2n]);
    expect(metadata?.fromTick).toBe("1");
  });

  it("serializes concurrent advances for the same world", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const scheduler = new SimulationScheduler([
      createPlaceholderSystem("slow-test-system", "Slow Test System", 10, async () => {
        await delay(50);
        return { success: true };
      }),
    ]);

    const results = await Promise.all([
      scheduler.advanceTick(world.id),
      scheduler.advanceTick(world.id),
    ]);
    const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });
    const ticks = await prisma.simulationTick.findMany({
      orderBy: { tick: "asc" },
      where: { worldId: world.id },
    });

    expect(results.map((result) => result.tick).sort()).toEqual([1n, 2n]);
    expect(updatedWorld.currentTick).toBe(2n);
    expect(ticks.map((tick) => tick.tick)).toEqual([1n, 2n]);
  });
});

describe("simulation scheduler system order", () => {
  const intendedPipeline = [
    "Time",
    "Astronomy",
    "Physics",
    "Climate",
    "Geology",
    "Oceans",
    "Atmosphere",
    "Weather",
    "Planet Resources",
      "Biomes",
    "Plant Ecology",
    "Chemistry",
    "Biology",
    "Animals",
    "Humans",
    "Civilization",
    "Economy",
    "Culture",
    "Memory",
    "Event Generation",
    "Metrics",
    "Save State",
  ];

  it("registers the intended default pipeline order", () => {
    expect(SimulationScheduler.listSystems().map((system) => system.label)).toEqual(intendedPipeline);
  });

  it("executes systems in the intended pipeline order", async () => {
    const executed: string[] = [];
    const systems: SimulationSystem[] = DEFAULT_SIMULATION_SYSTEMS.map((system) => ({
      ...system,
      run: () => {
        executed.push(system.label);
        return { success: true };
      },
    }));
    const scheduler = new SimulationScheduler(systems);
    const world = await track(createActiveSandboxTestWorld());

    await scheduler.advanceTick(world.id);

    expect(executed).toEqual(intendedPipeline);
  });
});

describe("simulation scheduler failure behavior", () => {
  it("records failed ticks clearly and stops the pipeline at the failing system", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const executed: string[] = [];
    const scheduler = new SimulationScheduler([
      createPlaceholderSystem("test-first-system", "Test First System", 10, () => {
        executed.push("test-first-system");
        return { success: true };
      }),
      createPlaceholderSystem("test-failing-system", "Test Failing System", 20, () => {
        executed.push("test-failing-system");
        throw new Error("Intentional scheduler failure test.");
      }),
      createPlaceholderSystem("test-late-system", "Test Late System", 30, () => {
        executed.push("test-late-system");
        return { success: true };
      }),
    ]);

    const result = await scheduler.advanceTick(world.id);
    const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });
    const tick = await prisma.simulationTick.findUniqueOrThrow({
      where: { worldId_tick: { tick: 1n, worldId: world.id } },
    });
    const metadata = tick.metadata as {
      failedSystems?: string[];
      pipeline?: Array<{ error: string | null; name: string; success: boolean }>;
    };

    expect(result.success).toBe(false);
    expect(result.failedSystems).toEqual(["test-failing-system"]);
    expect(result.systemCount).toBe(2);
    expect(executed).toEqual(["test-first-system", "test-failing-system"]);
    expect(updatedWorld.currentTick).toBe(1n);
    expect(tick.success).toBe(false);
    expect(tick.systemCount).toBe(2);
    expect(metadata.failedSystems).toEqual(["test-failing-system"]);
    expect(metadata.pipeline?.[1]).toMatchObject({
      error: "Intentional scheduler failure test.",
      name: "test-failing-system",
      success: false,
    });
  });
});



describe("simulation scheduler plugin architecture", () => {
  it("collects plugin metrics, emitted events, and health summaries", async () => {
    const world = await track(createActiveSandboxTestWorld());
    const scheduler = new SimulationScheduler([
      createPlaceholderSystem("test-plugin-system", "Test Plugin System", 10, (context) => {
        context.metrics.addCells(12);
        context.metrics.addEntities(3);

        return {
          success: true,
          metadata: { deterministic: true },
          events: [
            {
              type: "TEST_PLUGIN_EVENT",
              title: "Test Plugin Event",
              historicalWeight: 0.25,
              metadata: { source: "scheduler-plugin-test" },
            },
          ],
          health: {
            status: "Warning",
            diagnostics: ["Plugin health warning for test coverage."],
          },
        };
      }),
    ]);

    await scheduler.advanceTick(world.id);

    const tick = await prisma.simulationTick.findUniqueOrThrow({
      where: { worldId_tick: { tick: 1n, worldId: world.id } },
    });
    const event = await prisma.event.findFirstOrThrow({
      where: { worldId: world.id, type: "TEST_PLUGIN_EVENT" },
    });
    const metadata = tick.metadata as {
      eventsEmitted?: number;
      health?: { status?: string };
      pipeline?: Array<{
        id: string;
        metrics?: { cellsProcessed?: number; entitiesProcessed?: number; eventsEmitted?: number };
        health?: { status?: string; diagnostics?: string[] };
      }>;
    };
    const plugin = metadata.pipeline?.find((entry) => entry.id === "test-plugin-system");

    expect(metadata.eventsEmitted).toBe(1);
    expect(metadata.health?.status).toBe("Warning");
    expect(plugin?.metrics).toMatchObject({
      cellsProcessed: 12,
      entitiesProcessed: 3,
      eventsEmitted: 1,
    });
    expect(plugin?.health).toMatchObject({
      status: "Warning",
      diagnostics: ["Plugin health warning for test coverage."],
    });
    expect(event.title).toBe("Test Plugin Event");
    expect(event.historicalWeight).toBe(0.25);
  });
});
