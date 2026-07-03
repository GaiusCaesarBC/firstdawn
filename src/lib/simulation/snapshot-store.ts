import type { Prisma } from "@prisma/client";

import {
  buildTimedAtlasSnapshot,
  normalizeAtlasSelectedDay,
  type AtlasSnapshot,
} from "../worlds/map-atlas";
import { prisma, type WorldWithPlanet } from "../worlds/world-lifecycle";

export type PersistedAtlasSnapshotEnvelope = {
  kind: "atlas";
  generatedAt: string;
  durationMs: number;
  tick: string;
  selectedDay: number;
  worldId: string;
  worldSlug: string;
  snapshot: AtlasSnapshot;
};

type BuildAtlasSnapshotForPersistence = (
  world: WorldWithPlanet,
  selectedDay: number,
) => { value: AtlasSnapshot; durationMs: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonSafe<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mergeMetadata(
  metadata: Prisma.JsonValue | null,
  persistedSnapshot: PersistedAtlasSnapshotEnvelope,
): Prisma.InputJsonValue {
  const base = isRecord(metadata) ? metadata : {};

  return jsonSafe({
    ...base,
    atlasSnapshot: persistedSnapshot,
  });
}

export async function persistAtlasSnapshotForTick(
  world: WorldWithPlanet,
  tick: bigint,
  options: {
    buildSnapshot?: BuildAtlasSnapshotForPersistence;
    selectedDay?: number | null;
  } = {},
): Promise<PersistedAtlasSnapshotEnvelope> {
  const selectedDay = normalizeAtlasSelectedDay(world, options.selectedDay ?? null);
  const startedAt = Date.now();
  const timedSnapshot = options.buildSnapshot
    ? options.buildSnapshot(world, selectedDay)
    : (() => {
      const result = buildTimedAtlasSnapshot(world, selectedDay);
      return { value: result.value, durationMs: result.timing.executionTimeMs };
    })();
  const durationMs = Math.max(0, Math.round(timedSnapshot.durationMs || Date.now() - startedAt));
  const envelope: PersistedAtlasSnapshotEnvelope = {
    kind: "atlas",
    generatedAt: new Date().toISOString(),
    durationMs,
    tick: tick.toString(),
    selectedDay,
    worldId: world.id,
    worldSlug: world.slug,
    snapshot: timedSnapshot.value,
  };

  const existingTick = await prisma.simulationTick.findUnique({
    where: { worldId_tick: { worldId: world.id, tick } },
    select: {
  tick: true,
  completedAt: true,
  metadata: true,
},
  });

  if (!existingTick) {
    throw new Error(`Cannot persist Atlas snapshot for missing tick ${tick.toString()} on world ${world.slug}.`);
  }

  await prisma.simulationTick.update({
    where: { worldId_tick: { worldId: world.id, tick } },
    data: {
      metadata: mergeMetadata(existingTick.metadata, envelope),
    },
  });

  return envelope;
}

export function readPersistedAtlasSnapshot(
  metadata: Prisma.JsonValue | null,
): PersistedAtlasSnapshotEnvelope | null {
  if (!isRecord(metadata) || !isRecord(metadata.atlasSnapshot)) {
    return null;
  }

  const envelope = metadata.atlasSnapshot;

  if (
    envelope.kind !== "atlas" ||
    typeof envelope.tick !== "string" ||
    typeof envelope.worldId !== "string" ||
    typeof envelope.worldSlug !== "string" ||
    !isRecord(envelope.snapshot)
  ) {
    return null;
  }

  return envelope as unknown as PersistedAtlasSnapshotEnvelope;
}

export async function getLatestPersistedAtlasSnapshot(
  worldId: string,
): Promise<PersistedAtlasSnapshotEnvelope | null> {
  const ticks = await prisma.simulationTick.findMany({
    take: 20,
    where: { worldId },
    orderBy: [{ tick: "desc" }, { completedAt: "desc" }],
    select: { metadata: true },
  });

  for (const tick of ticks) {
    const snapshot = readPersistedAtlasSnapshot(tick.metadata);

if (snapshot) {
  return {
  ...snapshot,
  snapshot: {
    ...snapshot.snapshot,
    cells: snapshot.snapshot.cells.map((cell) => ({
      ...cell,
      animalPopulations: cell.animalPopulations ?? [],
      ecosystemHistory: cell.ecosystemHistory ?? [],
    })),
  },
};
}
  }

  return null;
}
export async function getLatestPersistedAtlasSnapshots(
  worldIds: readonly string[],
): Promise<Map<string, PersistedAtlasSnapshotEnvelope>> {
  const entries = await Promise.all(
    worldIds.map(async (worldId) => [worldId, await getLatestPersistedAtlasSnapshot(worldId)] as const),
  );

  return new Map(
    entries.flatMap(([worldId, snapshot]) => snapshot ? [[worldId, snapshot] as const] : []),
  );
}

export async function getLatestPersistedAtlasSnapshotForWorldQuery(
  worldQuery: string,
): Promise<{
  worldId: string;
  worldSlug: string;
  snapshot: PersistedAtlasSnapshotEnvelope | null;
} | null> {
  const world = await prisma.world.findFirst({
    where: { OR: [{ id: worldQuery }, { slug: worldQuery }] },
    select: { id: true, slug: true },
  });

  if (!world) {
    return null;
  }

  return {
    worldId: world.id,
    worldSlug: world.slug,
    snapshot: await getLatestPersistedAtlasSnapshot(world.id),
  };
}
