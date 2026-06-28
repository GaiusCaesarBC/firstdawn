import type { Prisma, World } from "@prisma/client";

import type { DeterministicRandom } from "../random";

type SimulationClient = Prisma.TransactionClient | PrismaClientLike;

type PrismaClientLike = {
  world: Prisma.TransactionClient["world"];
  planet: Prisma.TransactionClient["planet"];
  planetCell: Prisma.TransactionClient["planetCell"];
  simulationTick: Prisma.TransactionClient["simulationTick"];
  worldActionLog: Prisma.TransactionClient["worldActionLog"];
};

export type SimulationSystemResult = {
  success: boolean;
  metadata?: Prisma.InputJsonValue;
  error?: string;
};

export type SimulationSystemContext = {
  world: World;
  tick: bigint;
  timeScale: number;
  random: DeterministicRandom;
  client: SimulationClient;
};

export type SimulationSystem = {
  name: string;
  label: string;
  order: number;
  run: (context: SimulationSystemContext) => Promise<SimulationSystemResult> | SimulationSystemResult;
};

export function createPlaceholderSystem(
  name: string,
  label: string,
  order: number,
  run: SimulationSystem["run"],
): SimulationSystem {
  return {
    name,
    label,
    order,
    run,
  };
}

export function systemSuccess(metadata?: Prisma.InputJsonValue): SimulationSystemResult {
  return {
    success: true,
    metadata,
  };
}
