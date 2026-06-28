import { Prisma, WorldEnvironment, WorldStatus, type World } from "@prisma/client";

import { getAtmosphereSummary, type AtmosphericSummary } from "./atmosphere-engine";
import { getBiomeSummary, type BiomeSummary } from "./biome-engine";

import { simulationEventBus, type TickEventBus } from "./event-bus";
import { getHydrologySummary, type HydrologySummary } from "./hydrology-engine";
import { getSimulationMetrics, type SimulationMetrics } from "./metrics";
import { createDeterministicRandom } from "./random";
import { getPlantEcologySummary, type PlantSummary } from "./plant-engine";
import { getPlanetResourceSummary, type PlanetResourceSummary } from "./resources-engine";
import { getTerrainSummary, type TerrainSummary } from "./terrain-engine";
import { getWeatherSummary, type WeatherSummary } from "./weather-engine";
import { DEFAULT_SIMULATION_SYSTEMS, type SimulationSystem, type SimulationSystemResult } from "./systems";
import { prisma } from "../worlds/world-lifecycle";
import { createHrTimer } from "../utils/timing";
import { createGrid, type SpatialGrid } from "./grid/grid";

export type TickExecutionResult = {
  worldId: string;
  tick: bigint;
  success: boolean;
  durationMs: number;
  systemCount: number;
  failedSystems: string[];
};

export type SimulationState = {
  worldId: string;
  worldName: string;
  worldSlug: string;
  environment: WorldEnvironment;
  status: WorldStatus;
  currentTick: bigint;
  timeScale: number;
  simulationRunning: boolean;
  canAdvance: boolean;
  metrics: SimulationMetrics;
  terrainSummary: TerrainSummary | null;
  hydrologySummary: HydrologySummary | null;
  atmosphereSummary: AtmosphericSummary | null;
  weatherSummary: WeatherSummary | null;
  resourceSummary: PlanetResourceSummary | null;
  biomeSummary: BiomeSummary | null;
  plantSummary: PlantSummary | null;
};

export type SimulationSchedulerErrorCode =
  | "INVALID_TICK_COUNT"
  | "INVALID_TIME_SCALE"
  | "PRODUCTION_ADVANCE_BLOCKED"
  | "SIMULATION_NOT_ACTIVE"
  | "WORLD_NOT_FOUND"
  | "WORLD_NOT_SEEDED";

export class SimulationSchedulerError extends Error {
  public readonly code: SimulationSchedulerErrorCode;

  constructor(message: string, code: SimulationSchedulerErrorCode) {
    super(message);
    this.name = "SimulationSchedulerError";
    this.code = code;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown simulation system failure.";
}

function assertRunnableWorld(world: World): void {
  if (world.environment === WorldEnvironment.PRODUCTION) {
    throw new SimulationSchedulerError(
      "Production worlds cannot be advanced by the developer simulation scheduler.",
      "PRODUCTION_ADVANCE_BLOCKED",
    );
  }

  if (world.status !== WorldStatus.ACTIVE) {
    throw new SimulationSchedulerError(
      `World must be ACTIVE before simulation can advance. Current status: ${world.status}.`,
      "SIMULATION_NOT_ACTIVE",
    );
  }

  if (!world.seed?.trim()) {
    throw new SimulationSchedulerError(
      "World must have a seed before deterministic simulation can advance.",
      "WORLD_NOT_SEEDED",
    );
  }

  if (!Number.isFinite(world.timeScale) || world.timeScale <= 0) {
    throw new SimulationSchedulerError(
      "World timeScale must be a positive finite number before simulation can advance.",
      "INVALID_TIME_SCALE",
    );
  }
}

function validateTickCount(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > 10_000) {
    throw new SimulationSchedulerError(
      "advanceTicks count must be an integer between 1 and 10000.",
      "INVALID_TICK_COUNT",
    );
  }
}

function normalizeSystemResult(result: SimulationSystemResult | undefined): SimulationSystemResult {
  return result ?? { success: true };
}

function latestKnownTick(world: World, latestPersistedTick: bigint | null | undefined): bigint {
  return latestPersistedTick !== null &&
    latestPersistedTick !== undefined &&
    latestPersistedTick > world.currentTick
    ? latestPersistedTick
    : world.currentTick;
}

export class SimulationScheduler {
  private static readonly defaultScheduler = new SimulationScheduler(DEFAULT_SIMULATION_SYSTEMS);

  private readonly eventBus: TickEventBus;
  private systems: SimulationSystem[];

  constructor(systems: SimulationSystem[] = [], eventBus: TickEventBus = simulationEventBus) {
    this.eventBus = eventBus;
    this.systems = [];

    for (const system of systems) {
      this.register(system);
    }
  }

  static register(system: SimulationSystem): void {
    this.defaultScheduler.register(system);
  }

  static listSystems(): SimulationSystem[] {
    return this.defaultScheduler.listSystems();
  }

  static advanceTick(worldId: string): Promise<TickExecutionResult> {
    return this.defaultScheduler.advanceTick(worldId);
  }

  static advanceTicks(worldId: string, count: number): Promise<TickExecutionResult[]> {
    return this.defaultScheduler.advanceTicks(worldId, count);
  }

  static pauseWorldSimulation(worldId: string): Promise<SimulationState> {
    return this.defaultScheduler.pauseWorldSimulation(worldId);
  }

  static resumeWorldSimulation(worldId: string): Promise<SimulationState> {
    return this.defaultScheduler.resumeWorldSimulation(worldId);
  }

  static getSimulationState(worldId: string): Promise<SimulationState> {
    return this.defaultScheduler.getSimulationState(worldId);
  }

  register(system: SimulationSystem): void {
    if (!system.name.trim()) {
      throw new Error("Simulation systems require a stable name.");
    }

    this.systems = [
      ...this.systems.filter((existingSystem) => existingSystem.name !== system.name),
      system,
    ].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }

  listSystems(): SimulationSystem[] {
    return [...this.systems];
  }

  async advanceTick(worldId: string): Promise<TickExecutionResult> {
    const startedAt = new Date();
    const startedMs = Date.now();

    return prisma.$transaction(
      async (client) => {
        await client.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "World" WHERE "id" = ${worldId} FOR UPDATE
        `;

        const world = await client.world.findUnique({ where: { id: worldId } });

        if (!world) {
          throw new SimulationSchedulerError(`World not found: ${worldId}`, "WORLD_NOT_FOUND");
        }

        assertRunnableWorld(world);

        const latestTick = await client.simulationTick.aggregate({
          _max: { tick: true },
          where: { worldId: world.id },
        });
        const fromTick = latestKnownTick(world, latestTick._max.tick);
        const tick = fromTick + 1n;
        const tickWorld = fromTick === world.currentTick ? world : { ...world, currentTick: fromTick };
        const systemResults: Array<SimulationSystemResult & { systemName: string; systemLabel: string }> = [];

        await this.eventBus.emit("beforeTick", {
          worldId: world.id,
          tick,
          metadata: { fromTick: fromTick.toString(), timeScale: world.timeScale },
        });

        for (const system of this.systems) {
          await this.eventBus.emit("beforeSystem", {
            worldId: world.id,
            tick,
            systemName: system.name,
            systemLabel: system.label,
          });

          const random = createDeterministicRandom({
            worldSeed: world.seed ?? "",
            tick,
            systemName: system.name,
          });

          let result: SimulationSystemResult;

          try {
            result = normalizeSystemResult(await system.run({
              world: tickWorld,
              tick,
              timeScale: world.timeScale,
              random,
              client,
            }));
          } catch (error) {
            result = {
              success: false,
              error: formatError(error),
            };
          }

          systemResults.push({
            ...result,
            systemName: system.name,
            systemLabel: system.label,
          });

          await this.eventBus.emit("afterSystem", {
            worldId: world.id,
            tick,
            systemName: system.name,
            systemLabel: system.label,
            result,
          });

          if (!result.success) {
            break;
          }
        }

        const failedSystems = systemResults.filter((result) => !result.success);
        const failedSystemCount = failedSystems.length;
        const success = failedSystemCount === 0;
        const completedAt = new Date();
        const durationMs = Math.max(0, completedAt.getTime() - startedMs);

        await client.world.update({
          where: { id: world.id },
          data: { currentTick: tick },
        });

        await client.simulationTick.create({
          data: {
            worldId: world.id,
            tick,
            durationMs,
            success,
            systemCount: systemResults.length,
            failedSystemCount,
            startedAt,
            completedAt,
            metadata: {
              fromTick: fromTick.toString(),
              toTick: tick.toString(),
              timeScale: world.timeScale,
              pipeline: systemResults.map((result) => ({
                name: result.systemName,
                label: result.systemLabel,
                success: result.success,
                error: result.error ?? null,
                metadata: result.metadata ?? null,
              })),
              failedSystems: failedSystems.map((result) => result.systemName),
            },
          },
        });

        await this.eventBus.emit("afterTick", {
          worldId: world.id,
          tick,
          success,
          durationMs,
        });

        await this.eventBus.emit("tickCompleted", {
          worldId: world.id,
          tick,
          success,
          durationMs,
          metadata: { systemCount: systemResults.length },
        });

        return {
          worldId: world.id,
          tick,
          success,
          durationMs,
          systemCount: systemResults.length,
          failedSystems: failedSystems.map((result) => result.systemName),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 30_000,
      },
    );
  }

  async advanceTicks(worldId: string, count: number): Promise<TickExecutionResult[]> {
    validateTickCount(count);

    const results: TickExecutionResult[] = [];

    for (let index = 0; index < count; index += 1) {
      results.push(await this.advanceTick(worldId));
    }

    return results;
  }

  async pauseWorldSimulation(worldId: string): Promise<SimulationState> {
    await prisma.$transaction(async (client) => {
      const world = await client.world.findUnique({ where: { id: worldId } });

      if (!world) {
        throw new SimulationSchedulerError(`World not found: ${worldId}`, "WORLD_NOT_FOUND");
      }

      if (world.status === WorldStatus.ARCHIVED) {
        throw new SimulationSchedulerError(
          `Archived world cannot be paused: ${world.slug}`,
          "SIMULATION_NOT_ACTIVE",
        );
      }

      if (world.status !== WorldStatus.PAUSED) {
        await client.world.update({
          where: { id: world.id },
          data: { status: WorldStatus.PAUSED },
        });

        await client.worldActionLog.create({
          data: {
            worldId: world.id,
            action: "PAUSE_SIMULATION",
            actor: "local-developer",
            metadata: { previousStatus: world.status },
          },
        });
      }
    });

    return this.getSimulationState(worldId);
  }

  async resumeWorldSimulation(worldId: string): Promise<SimulationState> {
    await prisma.$transaction(async (client) => {
      const world = await client.world.findUnique({ where: { id: worldId } });

      if (!world) {
        throw new SimulationSchedulerError(`World not found: ${worldId}`, "WORLD_NOT_FOUND");
      }

      if (world.environment === WorldEnvironment.PRODUCTION) {
        throw new SimulationSchedulerError(
          "Production worlds cannot be resumed by developer simulation controls.",
          "PRODUCTION_ADVANCE_BLOCKED",
        );
      }

      if (world.status === WorldStatus.ARCHIVED) {
        throw new SimulationSchedulerError(
          `Archived world cannot be resumed: ${world.slug}`,
          "SIMULATION_NOT_ACTIVE",
        );
      }

      if (!world.seed?.trim()) {
        throw new SimulationSchedulerError(
          "World must have a seed before deterministic simulation can resume.",
          "WORLD_NOT_SEEDED",
        );
      }

      const activeWorlds = await client.world.findMany({
        where: {
          environment: world.environment,
          status: WorldStatus.ACTIVE,
          id: { not: world.id },
        },
        select: { id: true, status: true },
      });

      if (activeWorlds.length > 0) {
        await client.world.updateMany({
          where: { id: { in: activeWorlds.map((activeWorld) => activeWorld.id) } },
          data: { status: WorldStatus.PAUSED },
        });

        for (const activeWorld of activeWorlds) {
          await client.worldActionLog.create({
            data: {
              worldId: activeWorld.id,
              action: "AUTO_PAUSE_FOR_SIMULATION_RESUME",
              actor: "local-developer",
              metadata: { resumedWorldId: world.id },
            },
          });
        }
      }

      if (world.status !== WorldStatus.ACTIVE) {
        await client.world.update({
          where: { id: world.id },
          data: { status: WorldStatus.ACTIVE },
        });

        await client.worldActionLog.create({
          data: {
            worldId: world.id,
            action: "RESUME_SIMULATION",
            actor: "local-developer",
            metadata: { previousStatus: world.status },
          },
        });
      }
    });

    return this.getSimulationState(worldId);
  }

  async getSimulationState(worldId: string): Promise<SimulationState> {
    const timer = createHrTimer();
    const world = await timer.time("db:world", async () =>
      prisma.world.findUnique({ where: { id: worldId } }),
    );

    if (!world) {
      throw new SimulationSchedulerError(`World not found: ${worldId}`, "WORLD_NOT_FOUND");
    }

    const metrics = await timer.time("metrics", async () => getSimulationMetrics(worldId));

    let grid: SpatialGrid | null = null;
    if (world.seed?.trim()) {
      grid = await timer.time("grid", async () => createGrid());
    }

    const terrainSummary = await timer.time("summaries:terrain", async () =>
      (world.seed?.trim() ? getTerrainSummary(world, grid!) : null),
    );
    const hydrologySummary = await timer.time("summaries:hydrology", async () =>
      (world.seed?.trim() ? getHydrologySummary(world, grid!) : null),
    );
    const atmosphereSummary = await timer.time("summaries:atmosphere", async () =>
      (world.seed?.trim() ? getAtmosphereSummary(world, grid!) : null),
    );
    const weatherSummary = await timer.time("summaries:weather", async () =>
      (world.seed?.trim() ? getWeatherSummary(world, grid!) : null),
    );
    const resourceSummary = await timer.time("summaries:resources", async () =>
      (world.seed?.trim() ? getPlanetResourceSummary(world, grid!) : null),
    );
    const biomeSummary = await timer.time("summaries:biomes", async () =>
      (world.seed?.trim() ? getBiomeSummary(world, grid!) : null),
    );
    const plantSummary = await timer.time("summaries:plants", async () =>
      (world.seed?.trim() ? getPlantEcologySummary(world, grid!) : null),
    );

    const response = await timer.time("serialize:response", async () => ({
      worldId: world.id,
      worldName: world.name,
      worldSlug: world.slug,
      environment: world.environment,
      status: world.status,
      currentTick: world.currentTick,
      timeScale: world.timeScale,
      simulationRunning: world.status === WorldStatus.ACTIVE,
      canAdvance: world.status === WorldStatus.ACTIVE && world.environment !== WorldEnvironment.PRODUCTION,
      metrics,
      terrainSummary,
      hydrologySummary,
      atmosphereSummary,
      weatherSummary,
      resourceSummary,
      biomeSummary,
      plantSummary,
    }));

    timer.logDevBreakdown(`scheduler.getSimulationState(${world.slug})`);

    return response;
  }
}

export function advanceTick(worldId: string): Promise<TickExecutionResult> {
  return SimulationScheduler.advanceTick(worldId);
}

export function advanceTicks(worldId: string, count: number): Promise<TickExecutionResult[]> {
  return SimulationScheduler.advanceTicks(worldId, count);
}

export function pauseWorldSimulation(worldId: string): Promise<SimulationState> {
  return SimulationScheduler.pauseWorldSimulation(worldId);
}

export function resumeWorldSimulation(worldId: string): Promise<SimulationState> {
  return SimulationScheduler.resumeWorldSimulation(worldId);
}

export function getSimulationState(worldId: string): Promise<SimulationState> {
  return SimulationScheduler.getSimulationState(worldId);
}
