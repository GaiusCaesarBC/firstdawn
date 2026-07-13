import { Prisma } from "@prisma/client";
import { prisma } from "../worlds/world-lifecycle";
import { createGrid } from "./grid/grid";
import {
  buildTimedAtlasSnapshot,
  normalizeAtlasSelectedDay,
  type AtlasSnapshot,
} from "../worlds/map-atlas";
import { type WorldWithPlanet } from "../worlds/world-lifecycle";

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
  return jsonSafe({ ...base, atlasSnapshot: persistedSnapshot });
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
  const grid = createGrid();

  const timedSnapshot = options.buildSnapshot
    ? options.buildSnapshot(world, selectedDay)
    : (() => {
        const result = buildTimedAtlasSnapshot(world, selectedDay, grid);
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
    select: { metadata: true },
  });

  if (!existingTick) {
    throw new Error(`Cannot persist Atlas snapshot for tick ${tick.toString()}.`);
  }

  await prisma.simulationTick.update({
    where: { worldId_tick: { worldId: world.id, tick } },
    data: { metadata: mergeMetadata(existingTick.metadata, envelope) },
  });

  return envelope;
}

export function readPersistedAtlasSnapshot(
  metadata: Prisma.JsonValue | null,
): PersistedAtlasSnapshotEnvelope | null {
  if (!isRecord(metadata) || !isRecord(metadata.atlasSnapshot)) {
    return null;
  }

  return readPersistedAtlasSnapshotValue(metadata.atlasSnapshot as Prisma.JsonValue);
}

function normalizePersistedAtlasSnapshot(
  snapshot: PersistedAtlasSnapshotEnvelope,
): PersistedAtlasSnapshotEnvelope {
  return {
    ...snapshot,
    snapshot: {
      ...snapshot.snapshot,
      cells: snapshot.snapshot.cells.map((cell) => ({
        ...cell,
        animalPopulations: cell.animalPopulations ?? [],
        ecosystemHistory: cell.ecosystemHistory ?? [],
        movementVectors: cell.movementVectors ?? [],
      })),
    },
  };
}

function readPersistedAtlasSnapshotValue(
  value: Prisma.JsonValue | null,
): PersistedAtlasSnapshotEnvelope | null {
  if (
    !isRecord(value) ||
    value.kind !== "atlas" ||
    typeof value.tick !== "string" ||
    typeof value.worldId !== "string" ||
    typeof value.worldSlug !== "string" ||
    typeof value.selectedDay !== "number" ||
    !isRecord(value.snapshot)
  ) {
    return null;
  }

  return value as unknown as PersistedAtlasSnapshotEnvelope;
}

type PersistedAtlasSnapshotRow = {
  atlasSnapshot: Prisma.JsonValue | null;
};

export async function getLatestPersistedAtlasSnapshot(
  worldId: string,
): Promise<PersistedAtlasSnapshotEnvelope | null> {
  const rows = await prisma.$queryRaw<PersistedAtlasSnapshotRow[]>`
    SELECT metadata::jsonb -> 'atlasSnapshot' AS "atlasSnapshot"
    FROM "SimulationTick"
    WHERE "worldId" = ${worldId}
      AND metadata IS NOT NULL
      AND metadata::jsonb ? 'atlasSnapshot'
    ORDER BY tick DESC, "completedAt" DESC
    LIMIT 20
  `;

  for (const row of rows) {
    const snapshot = readPersistedAtlasSnapshotValue(row.atlasSnapshot);

    if (snapshot) {
      return normalizePersistedAtlasSnapshot(snapshot);
    }
  }

  return null;
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

export type LightweightDashboardSnapshot = {
  tick: string;
  worldId: string;
  snapshot: {
    tick: string;
    fingerprint: Pick<AtlasSnapshot["fingerprint"], "canonical" | "shortHash">;
    planet: Pick<AtlasSnapshot["planet"], "name">;
    time: AtlasSnapshot["time"];
    astronomy: AtlasSnapshot["astronomy"];
    terrainSummary: AtlasSnapshot["terrainSummary"];
    atmosphereSummary: AtlasSnapshot["atmosphereSummary"];
    weatherSummary: AtlasSnapshot["weatherSummary"];
    resourceSummary: AtlasSnapshot["resourceSummary"];
    plantSummary: AtlasSnapshot["plantSummary"];
    social: {
      activeSettlements: number | null;
      abandonedSettlements: number | null;
      familyCount: number | null;
      lineageCount: number | null;
      recentSettlementEvents: number | null;
    };
  };
};

type LightweightDashboardSnapshotRow = {
  worldId: string;
  tick: string | null;
  fingerprint: string | null;
  planet: string | null;
  time: string | null;
  astronomy: string | null;
  terrainSummary: string | null;
  atmosphereSummary: string | null;
  weatherSummary: string | null;
  resourceSummary: string | null;
  plantSummary: string | null;
  activeSettlements: number | null;
  abandonedSettlements: number | null;
  familyCount: number | null;
  lineageCount: number | null;
  recentSettlementEvents: number | null;
};

function parseJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value) as unknown;
  return isRecord(parsed) ? parsed : {};
}

type PersistedAtlasSnapshotWorldRow = {
  worldId: string;
};

export async function getWorldIdsWithPersistedAtlasSnapshots(
  worldIds: readonly string[],
): Promise<Set<string>> {
  if (!worldIds.length) return new Set();

  const rows = await prisma.$queryRaw<PersistedAtlasSnapshotWorldRow[]>`
    SELECT input."worldId"
    FROM unnest(ARRAY[${Prisma.join(worldIds as string[])}]::text[]) AS input("worldId")
    JOIN LATERAL (
      SELECT 1
      FROM "SimulationTick" st
      WHERE st."worldId" = input."worldId"
        AND st.metadata IS NOT NULL
        AND st.metadata::jsonb ? 'atlasSnapshot'
      ORDER BY st.tick DESC
      LIMIT 1
    ) snapshot ON TRUE
  `;

  return new Set(rows.map((row) => row.worldId));
}

export async function getLatestPersistedAtlasSnapshots(
  worldIds: readonly string[],
): Promise<Map<string, LightweightDashboardSnapshot>> {
  const snapshotMap = new Map<string, LightweightDashboardSnapshot>();
  if (!worldIds.length) return snapshotMap;

  const rawResults = await prisma.$queryRaw<LightweightDashboardSnapshotRow[]>`
    SELECT DISTINCT ON ("worldId")
      "worldId",
      metadata::jsonb #>> '{atlasSnapshot,tick}' AS "tick",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,fingerprint}')::text AS "fingerprint",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,planet}')::text AS "planet",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,time}')::text AS "time",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,astronomy}')::text AS "astronomy",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,terrainSummary}')::text AS "terrainSummary",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,atmosphereSummary}')::text AS "atmosphereSummary",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,weatherSummary}')::text AS "weatherSummary",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,resourceSummary}')::text AS "resourceSummary",
      (metadata::jsonb #> '{atlasSnapshot,snapshot,plantSummary}')::text AS "plantSummary",
      (metadata::jsonb #>> '{atlasSnapshot,snapshot,settlements,activeCount}')::int AS "activeSettlements",
      (metadata::jsonb #>> '{atlasSnapshot,snapshot,settlements,abandonedCount}')::int AS "abandonedSettlements",
      jsonb_array_length(metadata::jsonb #> '{atlasSnapshot,snapshot,families,families}') AS "familyCount",
      jsonb_array_length(metadata::jsonb #> '{atlasSnapshot,snapshot,families,lineages}') AS "lineageCount",
      jsonb_array_length(metadata::jsonb #> '{atlasSnapshot,snapshot,settlements,recentEvents}') AS "recentSettlementEvents"
    FROM "SimulationTick"
    WHERE "worldId" IN (${Prisma.join(worldIds as string[])})
      AND metadata IS NOT NULL
      AND metadata::jsonb ? 'atlasSnapshot'
    ORDER BY "worldId", (metadata::jsonb #>> '{atlasSnapshot,tick}')::bigint DESC
  `;

  for (const row of rawResults) {
    const fingerprint = parseJsonRecord(row.fingerprint);
    const planet = parseJsonRecord(row.planet);

    snapshotMap.set(row.worldId, {
      worldId: row.worldId,
      tick: row.tick ?? "0",
      snapshot: {
        tick: row.tick ?? "0",
        fingerprint: {
          canonical: fingerprint.canonical === true,
          shortHash: typeof fingerprint.shortHash === "string" ? fingerprint.shortHash : "",
        },
        planet: {
          name: typeof planet.name === "string" ? planet.name : "Unknown",
        },
        time: parseJsonRecord(row.time) as AtlasSnapshot["time"],
        astronomy: parseJsonRecord(row.astronomy) as AtlasSnapshot["astronomy"],
        terrainSummary: parseJsonRecord(row.terrainSummary) as AtlasSnapshot["terrainSummary"],
        atmosphereSummary: parseJsonRecord(row.atmosphereSummary) as AtlasSnapshot["atmosphereSummary"],
        weatherSummary: parseJsonRecord(row.weatherSummary) as AtlasSnapshot["weatherSummary"],
        resourceSummary: parseJsonRecord(row.resourceSummary) as AtlasSnapshot["resourceSummary"],
        plantSummary: parseJsonRecord(row.plantSummary) as AtlasSnapshot["plantSummary"],
        social: {
          activeSettlements: row.activeSettlements ?? null,
          abandonedSettlements: row.abandonedSettlements ?? null,
          familyCount: row.familyCount ?? null,
          lineageCount: row.lineageCount ?? null,
          recentSettlementEvents: row.recentSettlementEvents ?? null,
        },
      },
    });
  }

  return snapshotMap;
}
