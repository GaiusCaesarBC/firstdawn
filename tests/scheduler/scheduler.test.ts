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
import {
  durationToTicks,
  getMaxSimulationTicks,
} from "../../src/lib/simulation/simulation-limits";
import { prisma } from "../../src/lib/worlds/world-lifecycle";
import {
  cleanupTestWorld,
  createActiveSandboxTestWorld,
  createTestWorld,
} from "../helpers/test-worlds";

const createdSlugs = new Set<string>();
const compressedYearConfig = {
  tickDurationSeconds: 60,
  dayLengthSeconds: 60,
  yearLengthDays: 1,
  planet: {
    rotationPeriodHours: 1 / 60,
    orbitalPeriodDays: 1,
  },
};

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

  it("rejects tick counts above the configured world maximum", async () => {
    const previousMaxYears = process.env.ATLAS_MAX_SIMULATION_YEARS;
    process.env.ATLAS_MAX_SIMULATION_YEARS = "1";
    const world = await track(createActiveSandboxTestWorld(compressedYearConfig));

    try {
      await expectSchedulerError(
        () => SimulationScheduler.advanceTicks(world.id, 2),
        "INVALID_TICK_COUNT",
      );
    } finally {
      if (previousMaxYears === undefined) {
        delete process.env.ATLAS_MAX_SIMULATION_YEARS;
      } else {
        process.env.ATLAS_MAX_SIMULATION_YEARS = previousMaxYears;
      }
    }
  });
});

describe("simulation scheduler long-run limits", () => {


  it("converts the default 10000-year limit without integer overflow", () => {
    const defaultConfig = {
      tickDurationSeconds: 60,
      dayLengthSeconds: 86_400,
      yearLengthDays: 365,
    };

    expect(durationToTicks({ value: 10_000, unit: "years" }, defaultConfig)).toBe(5_256_000_000);
    expect(getMaxSimulationTicks(defaultConfig, 10_000)).toBe(5_256_000_000);
  });

  it.each([10, 100, 1_000])("executes a %i-year compressed run with checkpoints", async (years) => {
    const previousCheckpointTicks = process.env.ATLAS_SIMULATION_CHECKPOINT_TICKS;
    process.env.ATLAS_SIMULATION_CHECKPOINT_TICKS = "100";
    const world = await track(createActiveSandboxTestWorld(compressedYearConfig));
    const scheduler = new SimulationScheduler([
      createPlaceholderSystem("fast-long-run-system", "Fast Long Run System", 10, () => ({ success: true })),
    ]);
    const ticks = durationToTicks({ value: years, unit: "years" }, compressedYearConfig);

    try {
      const summary = await scheduler.advanceTicksWithCheckpoints(world.id, ticks);
      const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });
      const checkpoints = await prisma.worldActionLog.count({
        where: { worldId: world.id, action: "SIMULATION_RUN_CHECKPOINT" },
      });

      expect(summary.success).toBe(true);
      expect(summary.completedTicks).toBe(ticks);
      expect(summary.lastTick).toBe(BigInt(ticks));
      expect(updatedWorld.currentTick).toBe(BigInt(ticks));
      expect(checkpoints).toBe(Math.ceil(ticks / 100));
    } finally {
      if (previousCheckpointTicks === undefined) {
        delete process.env.ATLAS_SIMULATION_CHECKPOINT_TICKS;
      } else {
        process.env.ATLAS_SIMULATION_CHECKPOINT_TICKS = previousCheckpointTicks;
      }
    }
  }, 120_000);
});

describe("simulation scheduler fidelity modes", () => {
  const compactFidelityConfig = {
    tickDurationSeconds: 1,
    dayLengthSeconds: 2,
    yearLengthDays: 4,
    planet: {
      rotationPeriodHours: 2 / 3600,
      orbitalPeriodDays: 4,
    },
  };

  it.each([10, 100, 1_000])("accepts a %i-year Turbo Test run", async (years) => {
    const world = await track(createActiveSandboxTestWorld(compactFidelityConfig));
    const scheduler = new SimulationScheduler([
      createPlaceholderSystem("turbo-acceptance-system", "Turbo Acceptance System", 10, () => ({ success: true })),
    ]);
    const ticks = durationToTicks({ value: years, unit: "years" }, compactFidelityConfig);

    const summary = await scheduler.advanceTicksWithCheckpoints(world.id, ticks, { fidelityMode: "turbo" });
    const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });

    expect(summary.success).toBe(true);
    expect(summary.completedTicks).toBe(ticks);
    expect(summary.lastTick).toBe(BigInt(ticks));
    expect(updatedWorld.currentTick).toBe(BigInt(ticks));
  });

  it("keeps Accurate Mode on the existing per-tick persistence path", async () => {
    const world = await track(createActiveSandboxTestWorld(compressedYearConfig));
    const scheduler = new SimulationScheduler([
      createPlaceholderSystem("accurate-mode-system", "Accurate Mode System", 10, () => ({ success: true })),
    ]);

    const summary = await scheduler.advanceTicksWithCheckpoints(world.id, 3, { fidelityMode: "accurate" });
    const ticks = await prisma.simulationTick.findMany({ where: { worldId: world.id } });

    expect(summary.completedTicks).toBe(3);
    expect(summary.lastTick).toBe(3n);
    expect(ticks).toHaveLength(3);
    expect(ticks.map((tick) => tick.tick).sort()).toEqual([1n, 2n, 3n]);
  });

  it("reduces tick, event, and checkpoint writes in Fast and Turbo modes", async () => {
    const previousAccurateCheckpoint = process.env.ATLAS_SIMULATION_CHECKPOINT_TICKS;
    const previousFastCheckpoint = process.env.ATLAS_FAST_SIMULATION_CHECKPOINT_TICKS;
    const previousTurboCheckpoint = process.env.ATLAS_TURBO_SIMULATION_CHECKPOINT_TICKS;
    process.env.ATLAS_SIMULATION_CHECKPOINT_TICKS = "1";
    process.env.ATLAS_FAST_SIMULATION_CHECKPOINT_TICKS = "2";
    process.env.ATLAS_TURBO_SIMULATION_CHECKPOINT_TICKS = "8";

    const eventSystem = createPlaceholderSystem("fidelity-event-system", "Fidelity Event System", 10, () => ({
      success: true,
      events: [{ type: "FIDELITY_TEST_EVENT", title: "Fidelity Test Event" }],
    }));

    try {
      const accurateWorld = await track(createActiveSandboxTestWorld(compactFidelityConfig));
      const fastWorld = await track(createActiveSandboxTestWorld(compactFidelityConfig));
      const turboWorld = await track(createActiveSandboxTestWorld(compactFidelityConfig));
      const accurateScheduler = new SimulationScheduler([eventSystem]);
      const fastScheduler = new SimulationScheduler([eventSystem]);
      const turboScheduler = new SimulationScheduler([eventSystem]);
      const ticks = durationToTicks({ value: 1, unit: "years" }, compactFidelityConfig);

      await accurateScheduler.advanceTicksWithCheckpoints(accurateWorld.id, ticks, { fidelityMode: "accurate" });
      await fastScheduler.advanceTicksWithCheckpoints(fastWorld.id, ticks, { fidelityMode: "fast" });
      await turboScheduler.advanceTicksWithCheckpoints(turboWorld.id, ticks, { fidelityMode: "turbo" });

      const [accurateTickRows, fastTickRows, turboTickRows] = await Promise.all([
        prisma.simulationTick.count({ where: { worldId: accurateWorld.id } }),
        prisma.simulationTick.count({ where: { worldId: fastWorld.id } }),
        prisma.simulationTick.count({ where: { worldId: turboWorld.id } }),
      ]);
      const [accurateEvents, fastEvents, turboEvents] = await Promise.all([
        prisma.event.count({ where: { worldId: accurateWorld.id } }),
        prisma.event.count({ where: { worldId: fastWorld.id } }),
        prisma.event.count({ where: { worldId: turboWorld.id } }),
      ]);
      const [accurateCheckpoints, fastCheckpoints, turboCheckpoints] = await Promise.all([
        prisma.worldActionLog.count({ where: { worldId: accurateWorld.id, action: "SIMULATION_RUN_CHECKPOINT" } }),
        prisma.worldActionLog.count({ where: { worldId: fastWorld.id, action: "SIMULATION_RUN_CHECKPOINT" } }),
        prisma.worldActionLog.count({ where: { worldId: turboWorld.id, action: "SIMULATION_RUN_CHECKPOINT" } }),
      ]);

      expect(fastTickRows).toBeLessThan(accurateTickRows);
      expect(turboTickRows).toBeLessThan(fastTickRows);
      expect(fastEvents).toBeLessThan(accurateEvents);
      expect(turboEvents).toBeLessThan(fastEvents);
      expect(fastCheckpoints).toBeLessThan(accurateCheckpoints);
      expect(turboCheckpoints).toBeLessThan(fastCheckpoints);
    } finally {
      if (previousAccurateCheckpoint === undefined) {
        delete process.env.ATLAS_SIMULATION_CHECKPOINT_TICKS;
      } else {
        process.env.ATLAS_SIMULATION_CHECKPOINT_TICKS = previousAccurateCheckpoint;
      }

      if (previousFastCheckpoint === undefined) {
        delete process.env.ATLAS_FAST_SIMULATION_CHECKPOINT_TICKS;
      } else {
        process.env.ATLAS_FAST_SIMULATION_CHECKPOINT_TICKS = previousFastCheckpoint;
      }

      if (previousTurboCheckpoint === undefined) {
        delete process.env.ATLAS_TURBO_SIMULATION_CHECKPOINT_TICKS;
      } else {
        process.env.ATLAS_TURBO_SIMULATION_CHECKPOINT_TICKS = previousTurboCheckpoint;
      }
    }
  });

  it("keeps same-seed output deterministic for the same fidelity mode", async () => {
    const seed = "fidelity-determinism-seed";
    const firstWorld = await track(createActiveSandboxTestWorld({ ...compactFidelityConfig, seed }));
    const secondWorld = await track(createActiveSandboxTestWorld({ ...compactFidelityConfig, seed }));
    const deterministicSystem = createPlaceholderSystem("mode-determinism-system", "Mode Determinism System", 10, (context) => ({
      success: true,
      metadata: {
        mode: context.fidelityMode,
        sample: context.random.integer(1, 1_000_000),
        tick: context.tick.toString(),
      },
    }));
    const scheduler = new SimulationScheduler([deterministicSystem]);
    const ticks = durationToTicks({ value: 3, unit: "years" }, compactFidelityConfig);

    await scheduler.advanceTicksWithCheckpoints(firstWorld.id, ticks, { fidelityMode: "turbo" });
    await scheduler.advanceTicksWithCheckpoints(secondWorld.id, ticks, { fidelityMode: "turbo" });

    async function samples(worldId: string) {
      const rows = await prisma.simulationTick.findMany({
        orderBy: { tick: "asc" },
        where: { worldId },
      });

      return rows.map((row) => {
        const metadata = row.metadata as { pipeline?: Array<{ id: string; metadata?: unknown }> };
        return metadata.pipeline?.find((entry) => entry.id === "mode-determinism-system")?.metadata;
      });
    }

    expect(await samples(firstWorld.id)).toEqual(await samples(secondWorld.id));
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
  }, 120_000);

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
    "Population Adaptation",
    "Humans",
    "Goal Decision Engine",
    "Episodic Memory Engine",
    "Relationship Engine",
    "Knowledge & Learning Engine",
    "Communication Engine",
    "Emergent Camps & Settlements Engine",
    "Family & Generations Engine",
    "Resource Storage & Shared Supplies Engine",
    "Civilization",
    "Economy",
    "Culture",
    "Discovery",
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
