import type { Prisma, World } from "@prisma/client";

import type { DeterministicSystemEventBus } from "../event-bus";
import type { DeterministicRandom } from "../random";

type SimulationClient = Prisma.TransactionClient | PrismaClientLike;

type PrismaClientLike = {
  world: Prisma.TransactionClient["world"];
  planet: Prisma.TransactionClient["planet"];
  planetCell: Prisma.TransactionClient["planetCell"];
  simulationTick: Prisma.TransactionClient["simulationTick"];
  worldActionLog: Prisma.TransactionClient["worldActionLog"];
  event: Prisma.TransactionClient["event"];
};

export type SimulationSystemResult = {
  success: boolean;
  metadata?: Prisma.InputJsonValue;
  error?: string;
  metrics?: Partial<SimulationSystemMetrics>;
  events?: SimulationSystemEvent[];
  health?: SimulationSystemHealth;
};

export type SimulationSystemContext = {
  world: World;
  tick: bigint;
  seed: string;
  timeScale: number;
  random: DeterministicRandom;
  client: SimulationClient;
  repositories: SimulationRepositories;
  cache: Map<string, unknown>;
  eventBus: DeterministicSystemEventBus;
  metrics: SimulationMetricsCollector;
  logger: SimulationLogger;
};

export type SimulationRepositories = {
  client: SimulationClient;
};

export type SimulationLogger = {
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
};

export type SimulationSystemEvent = {
  type: string;
  title: string;
  description?: string | null;
  historicalWeight?: number;
  metadata?: Prisma.InputJsonValue;
};

export type SimulationHealthStatus = "Healthy" | "Warning" | "Error";

export type SimulationSystemHealth = {
  status: SimulationHealthStatus;
  diagnostics?: string[];
  metadata?: Prisma.InputJsonValue;
};

export type SimulationSystemMetrics = {
  executionTimeMs: number;
  cellsProcessed: number;
  entitiesProcessed: number;
  eventsEmitted: number;
  warnings: string[];
  errors: string[];
  memoryEstimateBytes: number | null;
  cellsPerSecond: number | null;
  entitiesPerSecond: number | null;
};

export type SimulationMetricsCollector = {
  addCells: (count: number) => void;
  addEntities: (count: number) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  snapshot: () => Pick<SimulationSystemMetrics, "cellsProcessed" | "entitiesProcessed" | "warnings" | "errors">;
};

export type SimulationSystem = {
  id: string;
  name: string;
  version: number;
  label: string;
  order: number;
  dependencies: string[];
  initialize?: (context: SimulationSystemContext) => Promise<void> | void;
  update: (context: SimulationSystemContext) => Promise<SimulationSystemResult> | SimulationSystemResult;
  persist?: (context: SimulationSystemContext) => Promise<void> | void;
  emitEvents?: (context: SimulationSystemContext) => Promise<SimulationSystemEvent[]> | SimulationSystemEvent[];
  health?: (context: SimulationSystemContext) => Promise<SimulationSystemHealth> | SimulationSystemHealth;
  serialize?: (context: SimulationSystemContext) => Promise<Prisma.InputJsonValue> | Prisma.InputJsonValue;
  run?: (context: SimulationSystemContext) => Promise<SimulationSystemResult> | SimulationSystemResult;
};

export function createPlaceholderSystem(
  name: string,
  label: string,
  order: number,
  run: NonNullable<SimulationSystem["run"]>,
  options: Partial<Pick<SimulationSystem, "dependencies" | "version">> = {},
): SimulationSystem {
  return {
    id: name,
    name,
    version: options.version ?? 1,
    label,
    order,
    dependencies: options.dependencies ?? [],
    update: run,
    run,
  };
}

export function systemSuccess(metadata?: Prisma.InputJsonValue): SimulationSystemResult {
  return {
    success: true,
    metadata,
  };
}
