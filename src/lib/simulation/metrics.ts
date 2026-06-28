import { prisma } from "../worlds/world-lifecycle";

export type SimulationMetrics = {
  totalTicks: number;
  averageTickTimeMs: number;
  slowestTickMs: number;
  fastestTickMs: number;
  totalSystemsExecuted: number;
  failedSystems: number;
  uptimeMs: number;
  ticksPerSecond: number;
  lastTickDurationMs: number | null;
  lastTickCompletedAt: Date | null;
};

export async function getSimulationMetrics(worldId: string): Promise<SimulationMetrics> {
  const [aggregate, firstTick, lastTick] = await Promise.all([
    prisma.simulationTick.aggregate({
      where: { worldId },
      _count: { _all: true },
      _avg: { durationMs: true },
      _max: { durationMs: true },
      _min: { durationMs: true },
      _sum: { systemCount: true, failedSystemCount: true },
    }),
    prisma.simulationTick.findFirst({
      where: { worldId },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    }),
    prisma.simulationTick.findFirst({
      where: { worldId },
      orderBy: { tick: "desc" },
      select: { durationMs: true, completedAt: true },
    }),
  ]);

  const totalTicks = aggregate._count._all;
  const uptimeMs = firstTick && lastTick
    ? Math.max(0, lastTick.completedAt.getTime() - firstTick.startedAt.getTime())
    : 0;

  return {
    totalTicks,
    averageTickTimeMs: aggregate._avg.durationMs ?? 0,
    slowestTickMs: aggregate._max.durationMs ?? 0,
    fastestTickMs: aggregate._min.durationMs ?? 0,
    totalSystemsExecuted: aggregate._sum.systemCount ?? 0,
    failedSystems: aggregate._sum.failedSystemCount ?? 0,
    uptimeMs,
    ticksPerSecond: uptimeMs > 0 ? totalTicks / (uptimeMs / 1000) : 0,
    lastTickDurationMs: lastTick?.durationMs ?? null,
    lastTickCompletedAt: lastTick?.completedAt ?? null,
  };
}

export async function listRecentSimulationTicks(limit = 20) {
  return prisma.simulationTick.findMany({
    take: limit,
    orderBy: [{ completedAt: "desc" }, { tick: "desc" }],
    include: {
      world: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });
}
