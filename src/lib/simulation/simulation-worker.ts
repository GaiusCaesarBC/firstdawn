import { Prisma, WorldEnvironment, WorldStatus } from "@prisma/client";

import {
  SimulationScheduler,
  type SimulationRunOptions,
  type SimulationRunSummary,
  type TickExecutionResult,
} from "./scheduler";
import { getLightweightWorldHealthSummary } from "./world-health";
import { persistAtlasSnapshotForTick } from "./snapshot-store";
import { prisma, type WorldWithPlanet } from "../worlds/world-lifecycle";

export type SimulationWorkerLogger = Pick<typeof console, "error" | "info" | "warn">;

export type SimulationRunRequest = {
  worldId: string;
  tickCount: number;
  fidelityMode?: string | null;
  confirmAccurateLongRun?: boolean;
  requestedBy?: string;
  reason?: string | null;
  source?: string;
};

export type SimulationWorkerOptions = {
  intervalMs?: number;
  logger?: SimulationWorkerLogger;
  maxTicks?: number;
  once?: boolean;
  persistSnapshots?: boolean;
  scheduler?: Pick<SimulationScheduler, "advanceTick" | "advanceTicksWithCheckpoints">;
  signal?: AbortSignal;
};

export type SimulationWorkerTickResult = {
  worldId: string;
  worldSlug: string;
  tick: bigint;
  success: boolean;
  durationMs: number;
  snapshotDurationMs: number | null;
  failedSystems: string[];
};

export type SimulationWorkerRunResult = {
  completedTicks: number;
  failedSystems: string[];
  lastTick: bigint | null;
  requestLogId: string | null;
  success: boolean;
  worldId: string;
};

export type SimulationWorkerStatus = {
  activeWorld: {
    id: string;
    slug: string;
    name: string;
    environment: WorldEnvironment;
    status: WorldStatus;
    currentTick: string;
  } | null;
  latestTick: {
    tick: string;
    success: boolean;
    durationMs: number;
    completedAt: string;
    failedSystemCount: number;
  } | null;
  health: Awaited<ReturnType<typeof getLightweightWorldHealthSummary>> | null;
  pendingRequests: number;
  runningRequests: number;
  lastWorkerEvent: {
    action: string;
    createdAt: string;
    metadata: Prisma.JsonValue | null;
  } | null;
};

type QueuedSimulationRequest = {
  id: string;
  worldId: string;
  tickCount: number;
  options: SimulationRunOptions;
  actor: string;
  reason: string | null;
};

const DEFAULT_WORKER_INTERVAL_MS = 1_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveIntegerOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function parseRequest(log: {
  id: string;
  actor: string;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
}): QueuedSimulationRequest | null {
  if (!isRecord(log.metadata) || typeof log.metadata.worldId !== "string") {
    return null;
  }

  return {
    id: log.id,
    worldId: log.metadata.worldId,
    tickCount: positiveIntegerOrDefault(log.metadata.tickCount, 1),
    options: {
      fidelityMode: typeof log.metadata.fidelityMode === "string" ? log.metadata.fidelityMode : undefined,
      confirmAccurateLongRun: log.metadata.confirmAccurateLongRun === true,
    },
    actor: log.actor,
    reason: log.reason,
  };
}

async function getWorldForWorker(worldId: string): Promise<WorldWithPlanet> {
  return prisma.world.findUniqueOrThrow({
    where: { id: worldId },
    include: { planet: true },
  });
}

async function claimQueuedRequest(request: QueuedSimulationRequest): Promise<boolean> {
  return prisma.$transaction(async (client) => {
    const locks = await client.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${request.id})) AS acquired
    `;

    if (!locks[0]?.acquired) {
      return false;
    }

    const existingStart = await client.worldActionLog.findFirst({
      where: {
        action: "SIMULATION_RUN_STARTED",
        metadata: {
          path: ["requestLogId"],
          equals: request.id,
        },
      },
      select: { id: true },
    });

    if (existingStart) {
      return false;
    }

    await client.worldActionLog.create({
      data: {
        worldId: request.worldId,
        action: "SIMULATION_RUN_STARTED",
        actor: "simulation-worker",
        reason: request.reason,
        metadata: {
          requestLogId: request.id,
          tickCount: request.tickCount,
          fidelityMode: request.options.fidelityMode ?? null,
          requestedBy: request.actor,
        },
      },
    });

    return true;
  });
}

async function listQueuedRequests(limit = 10): Promise<QueuedSimulationRequest[]> {
  const requestLogs = await prisma.worldActionLog.findMany({
    where: { action: "SIMULATION_RUN_REQUESTED" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      actor: true,
      reason: true,
      metadata: true,
    },
  });
  const startedLogs = await prisma.worldActionLog.findMany({
    where: { action: "SIMULATION_RUN_STARTED" },
    select: { metadata: true },
  });
  const completedLogs = await prisma.worldActionLog.findMany({
    where: { action: { in: ["SIMULATION_RUN_COMPLETED", "SIMULATION_RUN_FAILED"] } },
    select: { metadata: true },
  });
  const handledIds = new Set(
    [...startedLogs, ...completedLogs]
      .flatMap((log) => isRecord(log.metadata) && typeof log.metadata.requestLogId === "string"
        ? [log.metadata.requestLogId]
        : []),
  );

  return requestLogs
    .flatMap((log) => {
      if (handledIds.has(log.id)) {
        return [];
      }

      const request = parseRequest(log);
      return request ? [request] : [];
    })
    .slice(0, limit);
}

export async function requestSimulationRun(
  input: SimulationRunRequest,
): Promise<{ requestLogId: string }> {
  const tickCount = positiveIntegerOrDefault(input.tickCount, 1);
  const request = await prisma.worldActionLog.create({
    data: {
      worldId: input.worldId,
      action: "SIMULATION_RUN_REQUESTED",
      actor: input.requestedBy ?? "local-developer",
      reason: input.reason ?? null,
      metadata: {
        worldId: input.worldId,
        tickCount,
        fidelityMode: input.fidelityMode ?? null,
        confirmAccurateLongRun: Boolean(input.confirmAccurateLongRun),
        source: input.source ?? "api",
      },
    },
  });

  return { requestLogId: request.id };
}

export async function getActiveSimulationWorld(): Promise<WorldWithPlanet | null> {
  return prisma.world.findFirst({
    where: {
      status: WorldStatus.ACTIVE,
      environment: { not: WorldEnvironment.PRODUCTION },
      seed: { not: null },
    },
    orderBy: [{ environment: "asc" }, { updatedAt: "desc" }],
    include: { planet: true },
  });
}

export async function runOneSimulationTick(
  world: WorldWithPlanet,
  options: SimulationWorkerOptions = {},
): Promise<SimulationWorkerTickResult> {
  const logger = options.logger ?? console;
  const scheduler = options.scheduler ?? SimulationScheduler;
  const persistSnapshots = options.persistSnapshots ?? true;
  const startedAt = Date.now();
  let result: TickExecutionResult;

  try {
    result = await scheduler.advanceTick(world.id);
  } catch (error) {
    logger.error("[sim-worker] tick failed before persistence", {
      activeWorldId: world.id,
      worldSlug: world.slug,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  let snapshotDurationMs: number | null = null;

  if (persistSnapshots) {
    const snapshotStartedAt = Date.now();
    await persistAtlasSnapshotForTick(world, result.tick);
    snapshotDurationMs = Math.max(0, Date.now() - snapshotStartedAt);
  }

  logger.info("[sim-worker] tick completed", {
    activeWorldId: world.id,
    tick: result.tick.toString(),
    durationMs: result.durationMs,
    elapsedMs: Math.max(0, Date.now() - startedAt),
    snapshotDurationMs,
    success: result.success,
    failedSystems: result.failedSystems,
  });

  return {
    worldId: world.id,
    worldSlug: world.slug,
    tick: result.tick,
    success: result.success,
    durationMs: result.durationMs,
    snapshotDurationMs,
    failedSystems: result.failedSystems,
  };
}

export async function runQueuedSimulationRequest(
  request: QueuedSimulationRequest,
  options: SimulationWorkerOptions = {},
): Promise<SimulationWorkerRunResult> {
  const logger = options.logger ?? console;
  const scheduler = options.scheduler ?? SimulationScheduler;
  const claimed = await claimQueuedRequest(request);

  if (!claimed) {
    return {
      completedTicks: 0,
      failedSystems: [],
      lastTick: null,
      requestLogId: request.id,
      success: false,
      worldId: request.worldId,
    };
  }

  let summary: SimulationRunSummary;

  try {
    summary = await scheduler.advanceTicksWithCheckpoints(request.worldId, request.tickCount, request.options);

    if (summary.lastTick !== null && (options.persistSnapshots ?? true)) {
      const world = await getWorldForWorker(request.worldId);
      await persistAtlasSnapshotForTick(world, summary.lastTick);
    }

    await prisma.worldActionLog.create({
      data: {
        worldId: request.worldId,
        action: summary.success ? "SIMULATION_RUN_COMPLETED" : "SIMULATION_RUN_FAILED",
        actor: "simulation-worker",
        reason: summary.success ? null : "Simulation request stopped after a failed tick.",
        metadata: {
          requestLogId: request.id,
          runId: summary.runId,
          requestedTicks: summary.requestedTicks,
          completedTicks: summary.completedTicks,
          firstTick: summary.firstTick?.toString() ?? null,
          lastTick: summary.lastTick?.toString() ?? null,
          durationMs: summary.durationMs,
          checkpointCount: summary.checkpointCount,
          failedSystems: summary.failedSystems,
        },
      },
    });

    logger.info("[sim-worker] queued run completed", {
      worldId: request.worldId,
      requestLogId: request.id,
      completedTicks: summary.completedTicks,
      lastTick: summary.lastTick?.toString() ?? null,
      success: summary.success,
    });

    return {
      completedTicks: summary.completedTicks,
      failedSystems: summary.failedSystems,
      lastTick: summary.lastTick,
      requestLogId: request.id,
      success: summary.success,
      worldId: request.worldId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.worldActionLog.create({
      data: {
        worldId: request.worldId,
        action: "SIMULATION_RUN_FAILED",
        actor: "simulation-worker",
        reason: message,
        metadata: {
          requestLogId: request.id,
          requestedTicks: request.tickCount,
          error: message,
        },
      },
    });

    logger.error("[sim-worker] queued run failed", {
      worldId: request.worldId,
      requestLogId: request.id,
      error: message,
    });

    throw error;
  }
}

export async function runSimulationWorkerOnce(
  options: SimulationWorkerOptions = {},
): Promise<SimulationWorkerRunResult | SimulationWorkerTickResult | null> {
  const queuedRequest = (await listQueuedRequests(1))[0];

  if (queuedRequest) {
    return runQueuedSimulationRequest(queuedRequest, options);
  }

  const activeWorld = await getActiveSimulationWorld();

  if (!activeWorld) {
    options.logger?.info("[sim-worker] no active non-production world is ready to tick");
    return null;
  }

  return runOneSimulationTick(activeWorld, options);
}

export async function runSimulationWorker(options: SimulationWorkerOptions = {}): Promise<void> {
  const logger = options.logger ?? console;
  const intervalMs = options.intervalMs ?? DEFAULT_WORKER_INTERVAL_MS;
  const maxTicks = options.maxTicks ?? (options.once ? 1 : Number.POSITIVE_INFINITY);
  let completedTicks = 0;

  logger.info("[sim-worker] starting", {
    intervalMs,
    maxTicks: Number.isFinite(maxTicks) ? maxTicks : "unbounded",
    persistSnapshots: options.persistSnapshots ?? true,
  });

  while (!options.signal?.aborted && completedTicks < maxTicks) {
    try {
      const result = await runSimulationWorkerOnce(options);

      if (result && "tick" in result) {
        completedTicks += 1;

        if (!result.success) {
          await sleep(intervalMs, options.signal);
        }
      } else if (result && "completedTicks" in result) {
        completedTicks += result.completedTicks;
      } else {
        await sleep(intervalMs, options.signal);
      }
    } catch (error) {
      logger.error("[sim-worker] loop failure", {
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(intervalMs, options.signal);
    }

    if (options.once) {
      break;
    }
  }

  logger.info("[sim-worker] stopped", { completedTicks });
}

export async function getSimulationWorkerStatus(worldQuery?: string | null): Promise<SimulationWorkerStatus> {
  const activeWorld = worldQuery
    ? await prisma.world.findFirst({
      where: { OR: [{ id: worldQuery }, { slug: worldQuery }] },
    })
    : await getActiveSimulationWorld();

  if (!activeWorld) {
    return {
      activeWorld: null,
      latestTick: null,
      health: null,
      pendingRequests: await listQueuedRequests().then((requests) => requests.length),
      runningRequests: 0,
      lastWorkerEvent: null,
    };
  }

  const [latestTick, health, pendingRequests, runningRequests, lastWorkerEvent] = await Promise.all([
    prisma.simulationTick.findFirst({
      where: { worldId: activeWorld.id },
      orderBy: [{ tick: "desc" }, { completedAt: "desc" }],
      select: {
        tick: true,
        success: true,
        durationMs: true,
        completedAt: true,
        failedSystemCount: true,
      },
    }),
    getLightweightWorldHealthSummary(activeWorld),
    listQueuedRequests().then((requests) => requests.filter((request) => request.worldId === activeWorld.id).length),
    prisma.worldActionLog.count({
      where: {
        worldId: activeWorld.id,
        action: "SIMULATION_RUN_STARTED",
      },
    }),
    prisma.worldActionLog.findFirst({
      where: {
        worldId: activeWorld.id,
        action: {
          in: [
            "SIMULATION_RUN_REQUESTED",
            "SIMULATION_RUN_STARTED",
            "SIMULATION_RUN_COMPLETED",
            "SIMULATION_RUN_FAILED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      select: { action: true, createdAt: true, metadata: true },
    }),
  ]);

  return {
    activeWorld: {
      id: activeWorld.id,
      slug: activeWorld.slug,
      name: activeWorld.name,
      environment: activeWorld.environment,
      status: activeWorld.status,
      currentTick: activeWorld.currentTick.toString(),
    },
    latestTick: latestTick
      ? {
        tick: latestTick.tick.toString(),
        success: latestTick.success,
        durationMs: latestTick.durationMs,
        completedAt: latestTick.completedAt.toISOString(),
        failedSystemCount: latestTick.failedSystemCount,
      }
      : null,
    health,
    pendingRequests,
    runningRequests,
    lastWorkerEvent: lastWorkerEvent
      ? {
        action: lastWorkerEvent.action,
        createdAt: lastWorkerEvent.createdAt.toISOString(),
        metadata: lastWorkerEvent.metadata,
      }
      : null,
  };
}

