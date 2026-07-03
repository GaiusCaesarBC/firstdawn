import { Prisma, WorldEnvironment, WorldStatus, type World } from "@prisma/client";

import { getAtmosphereSummary, type AtmosphericSummary } from "./atmosphere-engine";
import { getBiomeSummary, type BiomeSummary } from "./biome-engine";

import {
  DeterministicSystemEventBus,
  simulationEventBus,
  type CollectedSimulationEvent,
  type TickEventBus,
} from "./event-bus";
import { getHydrologySummary, type HydrologySummary } from "./hydrology-engine";
import { getSimulationMetrics, type SimulationMetrics } from "./metrics";
import { createDeterministicRandom } from "./random";
import { assertValidSystems } from "./registry";
import { getPlantEcologySummary, type PlantSummary } from "./plant-engine";
import { getPlanetResourceSummary, type PlanetResourceSummary } from "./resources-engine";
import { getTerrainSummary, type TerrainSummary } from "./terrain-engine";
import { getWeatherSummary, type WeatherSummary } from "./weather-engine";
import {
  getConfiguredAccurateMaxUnconfirmedTicks,
  getConfiguredSimulationTransactionTimeoutMs,
  getMaxSimulationTicks,
  getSimulationFidelityPlan,
  normalizeSimulationFidelityMode,
  type SimulationFidelityMode,
  type SimulationFidelityPlan,
  type SimulationTimeConfig,
} from "./simulation-limits";
import {
  DEFAULT_SIMULATION_SYSTEMS,
  type SimulationMetricsCollector,
  type SimulationSystem,
  type SimulationSystemContext,
  type SimulationSystemHealth,
  type SimulationSystemMetrics,
  type SimulationSystemResult,
} from "./systems";
import { prisma } from "../worlds/world-lifecycle";
import { createHrTimer } from "../utils/timing";
import { createGrid, type SpatialGrid } from "./grid/grid";
import {
  getSnapshotWorldKey,
  memoizeSnapshotValueAsync,
  type SnapshotTiming,
} from "./snapshot-performance";
export type TickExecutionResult = {
  worldId: string;
  tick: bigint;
  success: boolean;
  durationMs: number;
  systemCount: number;
  failedSystems: string[];
};

export type SimulationRunSummary = {
  worldId: string;
  runId: string;
  requestedTicks: number;
  completedTicks: number;
  firstTick: bigint | null;
  lastTick: bigint | null;
  success: boolean;
  durationMs: number;
  checkpointCount: number;
  failedSystems: string[];
};

export type SimulationRunOptions = {
  fidelityMode?: SimulationFidelityMode | string | null;
  confirmAccurateLongRun?: boolean;
};

type TickExecutionOptions = SimulationRunOptions & {
  targetTick?: bigint;
  persistEvents?: boolean;
  persistSimulationTick?: boolean;
  runPlan?: SimulationFidelityPlan;
  checkpoint?: boolean;
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
  summaryTimings: Record<string, SnapshotTiming>;
};

export type SimulationSchedulerErrorCode =
  | "INVALID_TICK_COUNT"
  | "INVALID_TIME_SCALE"
  | "ACCURATE_RUN_CONFIRMATION_REQUIRED"
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

function getWorldTimeConfig(world: SimulationTimeConfig): SimulationTimeConfig {
  return {
    tickDurationSeconds: world.tickDurationSeconds,
    dayLengthSeconds: world.dayLengthSeconds,
    yearLengthDays: world.yearLengthDays,
  };
}

function validateTickCount(count: number, maxTicks: number): void {
  if (!Number.isInteger(count) || count < 1 || count > maxTicks) {
    throw new SimulationSchedulerError(
      `advanceTicks count must be an integer between 1 and ${maxTicks.toLocaleString("en-US")}.`,
      "INVALID_TICK_COUNT",
    );
  }
}

function createRunPlan(
  world: SimulationTimeConfig,
  count: number,
  options: SimulationRunOptions = {},
): SimulationFidelityPlan {
  const timeConfig = getWorldTimeConfig(world);

  validateTickCount(count, getMaxSimulationTicks(timeConfig));

  const mode = normalizeSimulationFidelityMode(options.fidelityMode);
  const plan = getSimulationFidelityPlan(mode, count, timeConfig);

  if (
    plan.mode === "accurate" &&
    count > getConfiguredAccurateMaxUnconfirmedTicks() &&
    !options.confirmAccurateLongRun
  ) {
    throw new SimulationSchedulerError(
      `Accurate Mode run requests above ${getConfiguredAccurateMaxUnconfirmedTicks().toLocaleString("en-US")} ticks require explicit confirmation. Choose Fast or Turbo Test for approximate long-range testing.`,
      "ACCURATE_RUN_CONFIRMATION_REQUIRED",
    );
  }

  return plan;
}

function isCadenceTick(completedTicks: number, totalTicks: number, everyTicks: number): boolean {
  return completedTicks >= totalTicks || completedTicks % Math.max(1, everyTicks) === 0;
}

function shouldPersistEvents(plan: SimulationFidelityPlan, checkpoint: boolean): boolean {
  return plan.eventLogging === "full" || checkpoint;
}

function shouldPersistSimulationTick(plan: SimulationFidelityPlan, completedTicks: number, checkpoint: boolean): boolean {
  return plan.mode === "accurate" || checkpoint || isCadenceTick(completedTicks, plan.totalTicks, plan.persistTickEveryTicks);
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

function createMetricsCollector(): SimulationMetricsCollector {
  let cellsProcessed = 0;
  let entitiesProcessed = 0;
  const warnings: string[] = [];
  const errors: string[] = [];

  return {
    addCells(count) {
      if (Number.isFinite(count) && count > 0) {
        cellsProcessed += count;
      }
    },
    addEntities(count) {
      if (Number.isFinite(count) && count > 0) {
        entitiesProcessed += count;
      }
    },
    warn(message) {
      warnings.push(message);
    },
    error(message) {
      errors.push(message);
    },
    snapshot() {
      return {
        cellsProcessed,
        entitiesProcessed,
        warnings: [...warnings],
        errors: [...errors],
      };
    },
  };
}

function createSystemLogger(system: SimulationSystem) {
  const prefix = `[simulation:${system.id}]`;

  return {
    debug(message: string, metadata?: Record<string, unknown>) {
      if (process.env.NODE_ENV === "development") {
        console.debug(prefix, message, metadata ?? "");
      }
    },
    info(message: string, metadata?: Record<string, unknown>) {
      if (process.env.NODE_ENV === "development") {
        console.info(prefix, message, metadata ?? "");
      }
    },
    warn(message: string, metadata?: Record<string, unknown>) {
      console.warn(prefix, message, metadata ?? "");
    },
    error(message: string, metadata?: Record<string, unknown>) {
      console.error(prefix, message, metadata ?? "");
    },
  };
}

function countFromMetadata(metadata: Prisma.InputJsonValue | undefined, keys: string[]): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return 0;
  }

  return keys.reduce((sum, key) => {
    const value = metadata[key as keyof typeof metadata];
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

function estimateMemoryDelta(before: number | null, after: number | null): number | null {
  if (before === null || after === null) {
    return null;
  }

  return Math.max(0, after - before);
}

function getHeapUsed(): number | null {
  return typeof process.memoryUsage === "function" ? process.memoryUsage().heapUsed : null;
}

function completeMetrics(input: {
  result: SimulationSystemResult;
  collected: ReturnType<SimulationMetricsCollector["snapshot"]>;
  durationMs: number;
  eventCount: number;
  memoryEstimateBytes: number | null;
}): SimulationSystemMetrics {
  const resultMetrics = input.result.metrics ?? {};
  const inferredCellsProcessed = input.collected.cellsProcessed || countFromMetadata(input.result.metadata, [
    "generatedCells",
    "createdCells",
    "updatedCells",
    "unchangedCells",
  ]);
  const inferredEntitiesProcessed = input.collected.entitiesProcessed || countFromMetadata(input.result.metadata, [
    "animalSpeciesCount",
    "totalWildlifePopulation",
  ]);
  const cellsProcessed = resultMetrics.cellsProcessed ?? inferredCellsProcessed;
  const entitiesProcessed = resultMetrics.entitiesProcessed ?? inferredEntitiesProcessed;
  const seconds = input.durationMs / 1000;

  return {
    executionTimeMs: resultMetrics.executionTimeMs ?? input.durationMs,
    cellsProcessed,
    entitiesProcessed,
    eventsEmitted: resultMetrics.eventsEmitted ?? input.eventCount,
    warnings: resultMetrics.warnings ?? input.collected.warnings,
    errors: resultMetrics.errors ?? input.collected.errors,
    memoryEstimateBytes: resultMetrics.memoryEstimateBytes ?? input.memoryEstimateBytes,
    cellsPerSecond: resultMetrics.cellsPerSecond ?? (seconds > 0 ? cellsProcessed / seconds : null),
    entitiesPerSecond: resultMetrics.entitiesPerSecond ?? (seconds > 0 ? entitiesProcessed / seconds : null),
  };
}

function defaultHealth(result: SimulationSystemResult): SimulationSystemHealth {
  if (!result.success) {
    return {
      status: "Error",
      diagnostics: result.error ? [result.error] : ["System update failed."],
    };
  }

  const warningCount = result.metrics?.warnings?.length ?? 0;

  return {
    status: warningCount > 0 ? "Warning" : "Healthy",
    diagnostics: warningCount > 0 ? result.metrics?.warnings : undefined,
  };
}

async function persistCollectedEvents(
  client: Prisma.TransactionClient,
  events: CollectedSimulationEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await client.event.createMany({
    data: events.map((event) => ({
      worldId: event.worldId,
      tick: event.tick,
      type: event.type,
      title: event.title,
      description: event.description ?? null,
      historicalWeight: event.historicalWeight ?? 0,
      metadata: {
        systemId: event.systemId,
        ...(event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? event.metadata
          : { payload: event.metadata ?? null }),
      },
    })),
  });
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

    assertValidSystems(this.systems);
  }

  static register(system: SimulationSystem): void {
    this.defaultScheduler.register(system);
    assertValidSystems(this.defaultScheduler.systems);
  }

  static listSystems(): SimulationSystem[] {
    return this.defaultScheduler.listSystems();
  }

  static advanceTick(worldId: string, options: SimulationRunOptions = {}): Promise<TickExecutionResult> {
    return this.defaultScheduler.advanceTick(worldId, options);
  }

  static advanceTicks(worldId: string, count: number, options: SimulationRunOptions = {}): Promise<TickExecutionResult[]> {
    return this.defaultScheduler.advanceTicks(worldId, count, options);
  }

  static advanceTicksWithCheckpoints(worldId: string, count: number, options: SimulationRunOptions = {}): Promise<SimulationRunSummary> {
    return this.defaultScheduler.advanceTicksWithCheckpoints(worldId, count, options);
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
    if (!system.id.trim()) {
      throw new Error("Simulation systems require a stable id.");
    }

    if (!system.name.trim()) {
      throw new Error("Simulation systems require a stable name.");
    }

    if (this.systems.some((existingSystem) => existingSystem.id === system.id)) {
      throw new Error(`Duplicate simulation system id: ${system.id}.`);
    }

    this.systems = [...this.systems, system]
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  }

  listSystems(): SimulationSystem[] {
    return [...this.systems];
  }

  async advanceTick(worldId: string, options: TickExecutionOptions = {}): Promise<TickExecutionResult> {
    assertValidSystems(this.systems);

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

        const plan = options.runPlan ?? getSimulationFidelityPlan(
          normalizeSimulationFidelityMode(options.fidelityMode),
          1,
          getWorldTimeConfig(world),
        );

        const latestTick = await client.simulationTick.aggregate({
          _max: { tick: true },
          where: { worldId: world.id },
        });
        const fromTick = latestKnownTick(world, latestTick._max.tick);
        const requestedTargetTick = options.targetTick && options.targetTick > fromTick ? options.targetTick : fromTick + 1n;
        const tick = requestedTargetTick;
        const tickWorld = fromTick === world.currentTick ? world : { ...world, currentTick: fromTick };
        const eventBus = new DeterministicSystemEventBus();
        const cache = new Map<string, unknown>();
        const systemResults: Array<SimulationSystemResult & {
          systemId: string;
          systemName: string;
          systemLabel: string;
          systemVersion: number;
          dependencies: string[];
          metrics: SimulationSystemMetrics;
          health: SimulationSystemHealth;
        }> = [];

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
          const metricsCollector = createMetricsCollector();
          const context: SimulationSystemContext = {
            world: tickWorld,
            tick,
            seed: world.seed ?? "",
            timeScale: world.timeScale,
            random,
            client,
            repositories: { client },
            cache,
            eventBus,
            metrics: metricsCollector,
            logger: createSystemLogger(system),
            fidelityMode: plan.mode,
            fidelity: plan,
          };
          const beforeMemory = getHeapUsed();
          const systemStartedMs = Date.now();
          const beforeEventCount = eventBus.countForSystem(system.id);
          let result: SimulationSystemResult;
          let health: SimulationSystemHealth | undefined;
          let serialized: Prisma.InputJsonValue | undefined;

          try {
            await system.initialize?.(context);
            const profileStartedAt = Date.now();

result = normalizeSystemResult(await (system.run ?? system.update)(context));

console.log("[sim-profile] system run", {
  id: system.id,
  name: system.name,
  durationMs: Date.now() - profileStartedAt,
});

            for (const event of result.events ?? []) {
              eventBus.emit(system.id, world.id, tick, event);
            }

            const emittedEvents = await system.emitEvents?.(context) ?? [];

            for (const event of emittedEvents) {
              eventBus.emit(system.id, world.id, tick, event);
            }

            health = result.health ?? await system.health?.(context);

           if (result.success) {
  const persistStartedAt = Date.now();

  await system.persist?.(context);

  if (system.persist) {
    console.log("[sim-profile] system persist", {
      id: system.id,
      name: system.name,
      durationMs: Date.now() - persistStartedAt,
    });
  }
}
            serialized = await system.serialize?.(context);
          } catch (error) {
            const message = formatError(error);
            metricsCollector.error(message);
            result = {
              success: false,
              error: message,
            };
            health = defaultHealth(result);
          }

          const systemDurationMs = Math.max(0, Date.now() - systemStartedMs);
          const afterMemory = getHeapUsed();
          const eventCount = eventBus.countForSystem(system.id) - beforeEventCount;
          const collectedMetrics = metricsCollector.snapshot();
          const metrics = completeMetrics({
            result,
            collected: collectedMetrics,
            durationMs: systemDurationMs,
            eventCount,
            memoryEstimateBytes: estimateMemoryDelta(beforeMemory, afterMemory),
          });
          const resolvedHealth = health ?? defaultHealth({ ...result, metrics });

          result = {
            ...result,
            metrics,
            health: resolvedHealth,
            ...(serialized !== undefined
              ? { metadata: { result: result.metadata ?? null, serialized } }
              : {}),
          };

          systemResults.push({
            ...result,
            systemId: system.id,
            systemName: system.name,
            systemLabel: system.label,
            systemVersion: system.version,
            dependencies: system.dependencies,
            metrics,
            health: resolvedHealth,
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
        const collectedEvents = eventBus.collect();
        const persistEvents = options.persistEvents ?? true;
        const persistSimulationTick = options.persistSimulationTick ?? true;

        await client.world.update({
          where: { id: world.id },
          data: { currentTick: tick },
        });

        if (persistSimulationTick) {
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
                fidelityMode: plan.mode,
                fidelityLabel: plan.label,
                approximate: plan.approximate,
                tickStride: plan.tickStride,
                eventLogging: plan.eventLogging,
                chronicler: plan.chronicler,
                atlasSnapshots: plan.atlasSnapshots,
                checkpoint: Boolean(options.checkpoint),
                eventsEmitted: collectedEvents.length,
                eventsPersisted: persistEvents ? collectedEvents.length : 0,
                profiling: {
                  totalDurationMs: durationMs,
                  totalCellsProcessed: systemResults.reduce((sum, result) => sum + result.metrics.cellsProcessed, 0),
                  totalEntitiesProcessed: systemResults.reduce((sum, result) => sum + result.metrics.entitiesProcessed, 0),
                },
                pipeline: systemResults.map((result) => ({
                  id: result.systemId,
                  name: result.systemName,
                  label: result.systemLabel,
                  version: result.systemVersion,
                  dependencies: result.dependencies,
                  success: result.success,
                  error: result.error ?? null,
                  metadata: result.metadata ?? null,
                  metrics: result.metrics,
                  health: result.health,
                })),
                failedSystems: failedSystems.map((result) => result.systemName),
                health: aggregateHealth(systemResults.map((result) => result.health)),
              },
            },
          });
        }

        if (persistEvents) {
          await persistCollectedEvents(client, collectedEvents);
        }

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
          metadata: { systemCount: systemResults.length, eventsEmitted: collectedEvents.length },
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
        timeout: getConfiguredSimulationTransactionTimeoutMs(),
      },
    );
  }

  async advanceTicks(
    worldId: string,
    count: number,
    options: SimulationRunOptions = {},
  ): Promise<TickExecutionResult[]> {
    const world = await prisma.world.findUnique({ where: { id: worldId } });

    if (!world) {
      throw new SimulationSchedulerError(`World not found: ${worldId}`, "WORLD_NOT_FOUND");
    }

    const plan = createRunPlan(world, count, options);
    const latestTick = await prisma.simulationTick.aggregate({
      _max: { tick: true },
      where: { worldId: world.id },
    });
    const baseTick = latestKnownTick(world, latestTick._max.tick);
    const results: TickExecutionResult[] = [];

    for (let completedTicks = 0; completedTicks < count;) {
      const nextCompletedTicks = Math.min(count, completedTicks + plan.tickStride);
      const checkpoint = isCadenceTick(nextCompletedTicks, count, plan.checkpointEveryTicks);
      const result = await this.advanceTick(worldId, {
        ...options,
        targetTick: baseTick + BigInt(nextCompletedTicks),
        runPlan: plan,
        checkpoint,
        persistEvents: shouldPersistEvents(plan, checkpoint),
        persistSimulationTick: shouldPersistSimulationTick(plan, nextCompletedTicks, checkpoint),
      });

      results.push(result);
      completedTicks = nextCompletedTicks;

      if (!result.success) {
        break;
      }
    }

    return results;
  }

  async advanceTicksWithCheckpoints(
    worldId: string,
    count: number,
    options: SimulationRunOptions = {},
  ): Promise<SimulationRunSummary> {
    const world = await prisma.world.findUnique({ where: { id: worldId } });

    if (!world) {
      throw new SimulationSchedulerError(`World not found: ${worldId}`, "WORLD_NOT_FOUND");
    }

    const plan = createRunPlan(world, count, options);
    const latestTick = await prisma.simulationTick.aggregate({
      _max: { tick: true },
      where: { worldId: world.id },
    });
    const baseTick = latestKnownTick(world, latestTick._max.tick);
    const runId = `${worldId}-${Date.now().toString(36)}`;
    const startedMs = Date.now();
    const checkpointEvery = plan.checkpointEveryTicks;
    const failedSystems = new Set<string>();
    let completedTicks = 0;
    let checkpointCount = 0;
    let firstTick: bigint | null = null;
    let lastTick: bigint | null = null;
    let success = true;

    while (completedTicks < count) {
      const nextCompletedTicks = Math.min(count, completedTicks + plan.tickStride);
      const checkpoint = isCadenceTick(nextCompletedTicks, count, checkpointEvery);
      const result = await this.advanceTick(worldId, {
        ...options,
        targetTick: baseTick + BigInt(nextCompletedTicks),
        runPlan: plan,
        checkpoint,
        persistEvents: shouldPersistEvents(plan, checkpoint),
        persistSimulationTick: shouldPersistSimulationTick(plan, nextCompletedTicks, checkpoint),
      });

      completedTicks = nextCompletedTicks;
      firstTick ??= result.tick;
      lastTick = result.tick;

      for (const failedSystem of result.failedSystems) {
        failedSystems.add(failedSystem);
      }

      if (!result.success) {
        success = false;
      }

      if (checkpoint || !result.success) {
        checkpointCount += 1;

        await prisma.worldActionLog.create({
          data: {
            worldId,
            action: result.success ? "SIMULATION_RUN_CHECKPOINT" : "SIMULATION_RUN_STOPPED",
            actor: "simulation-scheduler",
            reason: result.success ? null : "Simulation run stopped after a failed tick.",
            metadata: {
              runId,
              requestedTicks: count,
              completedTicks,
              checkpointEvery,
              fidelityMode: plan.mode,
              fidelityLabel: plan.label,
              approximate: plan.approximate,
              tickStride: plan.tickStride,
              effectiveSystemTicks: plan.effectiveSystemTicks,
              eventLogging: plan.eventLogging,
              chronicler: plan.chronicler,
              atlasSnapshots: plan.atlasSnapshots,
              firstTick: firstTick?.toString() ?? null,
              lastTick: lastTick?.toString() ?? null,
              progressPercent: Math.round((completedTicks / count) * 10_000) / 100,
              failedSystems: [...failedSystems],
            },
          },
        });
      }

      if (!result.success) {
        break;
      }
    }

    return {
      worldId,
      runId,
      requestedTicks: count,
      completedTicks,
      firstTick,
      lastTick,
      success,
      durationMs: Math.max(0, Date.now() - startedMs),
      checkpointCount,
      failedSystems: [...failedSystems],
    };
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

    const [metrics, grid] = await Promise.all([
      timer.time("metrics", async () => getSimulationMetrics(worldId)),
      world.seed?.trim()
        ? timer.time("grid", async () => createGrid())
        : Promise.resolve(null as SpatialGrid | null),
    ]);

    let terrainSummary: TerrainSummary | null = null;
    let hydrologySummary: HydrologySummary | null = null;
    let atmosphereSummary: AtmosphericSummary | null = null;
    let weatherSummary: WeatherSummary | null = null;
    let resourceSummary: PlanetResourceSummary | null = null;
    let biomeSummary: BiomeSummary | null = null;
    let plantSummary: PlantSummary | null = null;
    const summaryTimings: Record<string, SnapshotTiming> = {};

    if (world.seed?.trim() && grid) {
      const summaryKey = getSnapshotWorldKey(world, grid, "simulation-state");
      const totalCells = grid.getGridSummary().totalCells;
      const [
        terrainResult,
        hydrologyResult,
        atmosphereResult,
        weatherResult,
        resourceResult,
        biomeResult,
        plantResult,
      ] = await timer.time("summaries:cached-parallel", async () => Promise.all([
        memoizeSnapshotValueAsync("summary:terrain", summaryKey, async () => getTerrainSummary(world, grid), totalCells),
        memoizeSnapshotValueAsync("summary:hydrology", summaryKey, async () => getHydrologySummary(world, grid), totalCells),
        memoizeSnapshotValueAsync("summary:atmosphere", summaryKey, async () => getAtmosphereSummary(world, grid), totalCells),
        memoizeSnapshotValueAsync("summary:weather", summaryKey, async () => getWeatherSummary(world, grid), totalCells),
        memoizeSnapshotValueAsync("summary:resources", summaryKey, async () => getPlanetResourceSummary(world, grid), totalCells),
        memoizeSnapshotValueAsync("summary:biomes", summaryKey, async () => getBiomeSummary(world, grid), totalCells),
        memoizeSnapshotValueAsync("summary:plants", summaryKey, async () => getPlantEcologySummary(world, grid), totalCells),
      ]));

      terrainSummary = terrainResult.value;
      hydrologySummary = hydrologyResult.value;
      atmosphereSummary = atmosphereResult.value;
      weatherSummary = weatherResult.value;
      resourceSummary = resourceResult.value;
      biomeSummary = biomeResult.value;
      plantSummary = plantResult.value;

      summaryTimings.terrain = terrainResult.timing;
      summaryTimings.hydrology = hydrologyResult.timing;
      summaryTimings.atmosphere = atmosphereResult.timing;
      summaryTimings.weather = weatherResult.timing;
      summaryTimings.resources = resourceResult.timing;
      summaryTimings.biomes = biomeResult.timing;
      summaryTimings.plants = plantResult.timing;

      for (const [name, timing] of Object.entries(summaryTimings)) {
        timer.record(`summary:${name}:${timing.cacheHit ? "cache-hit" : "cache-miss"}`, timing.executionTimeMs);
      }
    }

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
      summaryTimings,
    }));

    timer.logDevBreakdown(`scheduler.getSimulationState(${world.slug})`);

    return response;
  }
}

function aggregateHealth(health: SimulationSystemHealth[]): SimulationSystemHealth {
  if (health.some((entry) => entry.status === "Error")) {
    return {
      status: "Error",
      diagnostics: health.flatMap((entry) => entry.diagnostics ?? []),
    };
  }

  if (health.some((entry) => entry.status === "Warning")) {
    return {
      status: "Warning",
      diagnostics: health.flatMap((entry) => entry.diagnostics ?? []),
    };
  }

  return { status: "Healthy" };
}

export function advanceTick(worldId: string, options: SimulationRunOptions = {}): Promise<TickExecutionResult> {
  return SimulationScheduler.advanceTick(worldId, options);
}

export function advanceTicks(
  worldId: string,
  count: number,
  options: SimulationRunOptions = {},
): Promise<TickExecutionResult[]> {
  return SimulationScheduler.advanceTicks(worldId, count, options);
}

export function advanceTicksWithCheckpoints(
  worldId: string,
  count: number,
  options: SimulationRunOptions = {},
): Promise<SimulationRunSummary> {
  return SimulationScheduler.advanceTicksWithCheckpoints(worldId, count, options);
}

export function pauseWorldSimulation(worldId: string): Promise<SimulationState> {
  return SimulationScheduler.pauseWorldSimulation(worldId);
}

export function resumeWorldSimulation(worldId: string): Promise<SimulationState> {
  return SimulationScheduler.resumeWorldSimulation(worldId);
}

type SimulationStatePromiseCacheEntry = {
  expiresAt: number;
  promise: Promise<SimulationState>;
};

const simulationStatePromiseCacheSymbol = Symbol.for("first-dawn.scheduler-state-promise-cache");
const simulationStatePromiseCache =
  (globalThis as unknown as Record<symbol, Map<string, SimulationStatePromiseCacheEntry> | undefined>)[simulationStatePromiseCacheSymbol] ??
  new Map<string, SimulationStatePromiseCacheEntry>();

if (!(globalThis as unknown as Record<symbol, Map<string, SimulationStatePromiseCacheEntry> | undefined>)[simulationStatePromiseCacheSymbol]) {
  (globalThis as unknown as Record<symbol, Map<string, SimulationStatePromiseCacheEntry>>)[simulationStatePromiseCacheSymbol] = simulationStatePromiseCache;
}

const SIMULATION_STATE_PROMISE_TTL_MS = 2_000;

export function getSimulationState(worldId: string): Promise<SimulationState> {
  const now = Date.now();
  const existing = simulationStatePromiseCache.get(worldId);

  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const promise = SimulationScheduler.getSimulationState(worldId).catch((error) => {
    simulationStatePromiseCache.delete(worldId);
    throw error;
  });
  simulationStatePromiseCache.set(worldId, {
    promise,
    expiresAt: now + SIMULATION_STATE_PROMISE_TTL_MS,
  });

  return promise;
}
