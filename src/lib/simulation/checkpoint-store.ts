import type { Prisma } from "@prisma/client";

import { prisma } from "../worlds/world-lifecycle";

export async function getLatestCheckpoint<TState>(input: {
  worldId: string;
  systemId: string;
  tick: bigint;
}): Promise<{ tick: bigint; state: TState } | null> {
  const checkpoint = await prisma.simulationCheckpoint.findFirst({
    where: {
      worldId: input.worldId,
      systemId: input.systemId,
      tick: { lte: input.tick },
    },
    orderBy: { tick: "desc" },
  });

  if (!checkpoint) {
    return null;
  }

  return {
    tick: checkpoint.tick,
    state: checkpoint.state as TState,
  };
}

export async function saveCheckpoint(input: {
  worldId: string;
  systemId: string;
  tick: bigint;
  state: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.simulationCheckpoint.upsert({
    where: {
      worldId_systemId_tick: {
        worldId: input.worldId,
        systemId: input.systemId,
        tick: input.tick,
      },
    },
    update: {
      state: input.state,
      metadata: input.metadata,
    },
    create: {
      worldId: input.worldId,
      systemId: input.systemId,
      tick: input.tick,
      state: input.state,
      metadata: input.metadata,
    },
  });
}

export function shouldSaveCheckpoint(tick: bigint, interval = 100n): boolean {
  return tick === 0n || tick % interval === 0n;
}