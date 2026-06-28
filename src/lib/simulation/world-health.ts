import type { Prisma, WorldStatus } from "@prisma/client";

import { createGrid, getGridSummary } from "./grid/grid";
import { prisma } from "../worlds/world-lifecycle";

export type WorldHealthBadge = "Healthy" | "Warning" | "Error";
export type LastTickStatus = "success" | "failed" | "missing";

export type WorldHealthSummary = {
  worldId: string;
  worldName: string;
  status: WorldStatus | string;
  currentTick: string;
  latestSimulationTickNumber: string | null;
  lastTickStatus: LastTickStatus;
  lastSuccessfulTickTime: string | null;
  failedSystems: string[];
  lastErrorMessage: string | null;
  biomeCoveragePercent: number;
  plantCoveragePercent: number;
  animalSpeciesCount: number;
  occupiedAnimalHabitatPercent: number;
  totalWildlifePopulation: number;
  averageAnimalHabitatSuitability: number;
  averageAnimalHealth: number;
  weatherSnapshotAvailable: boolean;
  badge: WorldHealthBadge;
};

type PipelineEntry = {
  name?: unknown;
  label?: unknown;
  success?: unknown;
  error?: unknown;
  metadata?: unknown;
};

export type WorldHealthInput = {
  world: {
    id: string;
    name: string;
    status: WorldStatus | string;
    currentTick: bigint | number | string;
  };
  latestTick: {
    tick: bigint | number | string;
    success: boolean;
    metadata: Prisma.JsonValue | null;
  } | null;
  lastSuccessfulTickCompletedAt: Date | string | null;
  expectedCellCount: number;
  biomeCellCount: number;
  plantCellCount: number;
  animalCellCount: number;
  animalSpeciesCount: number;
  totalWildlifePopulation: number;
  averageAnimalHabitatSuitability: number;
  averageAnimalHealth: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toTickString(value: bigint | number | string): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function roundPercent(count: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.round((Math.max(0, count) / total) * 10_000) / 100;
}

function getPipeline(metadata: Prisma.JsonValue | null): PipelineEntry[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.pipeline)) {
    return [];
  }

  return metadata.pipeline.flatMap((entry) => isRecord(entry) ? [entry as PipelineEntry] : []);
}

function getFailedSystems(metadata: Prisma.JsonValue | null): string[] {
  if (isRecord(metadata) && Array.isArray(metadata.failedSystems)) {
    return metadata.failedSystems.filter((entry): entry is string => typeof entry === "string");
  }

  return getPipeline(metadata)
    .filter((entry) => entry.success === false)
    .map((entry) => String(entry.name ?? entry.label ?? "unknown"));
}

function getLastErrorMessage(metadata: Prisma.JsonValue | null): string | null {
  const failedEntry = getPipeline(metadata).find((entry) => entry.success === false && typeof entry.error === "string");

  return typeof failedEntry?.error === "string" ? failedEntry.error : null;
}

function hasWeatherSnapshot(metadata: Prisma.JsonValue | null): boolean {
  const weather = getPipeline(metadata).find((entry) => entry.name === "weather");

  return Boolean(weather?.success === true && isRecord(weather.metadata));
}

function deriveBadge(input: {
  currentTick: string;
  latestTick: string | null;
  lastTickStatus: LastTickStatus;
  failedSystems: string[];
  lastErrorMessage: string | null;
  biomeCoveragePercent: number;
  plantCoveragePercent: number;
  weatherSnapshotAvailable: boolean;
}): WorldHealthBadge {
  if (input.lastTickStatus === "failed" || input.failedSystems.length > 0 || input.lastErrorMessage) {
    return "Error";
  }

  if (
    input.lastTickStatus === "missing" ||
    (input.latestTick !== null && input.currentTick !== input.latestTick) ||
    input.biomeCoveragePercent < 100 ||
    input.plantCoveragePercent < 100 ||
    !input.weatherSnapshotAvailable
  ) {
    return "Warning";
  }

  return "Healthy";
}

export function buildWorldHealthSummary(input: WorldHealthInput): WorldHealthSummary {
  const currentTick = toTickString(input.world.currentTick);
  const latestSimulationTickNumber = input.latestTick ? toTickString(input.latestTick.tick) : null;
  const lastTickStatus: LastTickStatus = input.latestTick
    ? input.latestTick.success ? "success" : "failed"
    : "missing";
  const failedSystems = input.latestTick ? getFailedSystems(input.latestTick.metadata) : [];
  const lastErrorMessage = input.latestTick ? getLastErrorMessage(input.latestTick.metadata) : null;
  const biomeCoveragePercent = roundPercent(input.biomeCellCount, input.expectedCellCount);
  const plantCoveragePercent = roundPercent(input.plantCellCount, input.expectedCellCount);
  const weatherSnapshotAvailable = input.latestTick ? hasWeatherSnapshot(input.latestTick.metadata) : false;
  const occupiedAnimalHabitatPercent = roundPercent(input.animalCellCount, input.expectedCellCount);
  const badge = deriveBadge({
    currentTick,
    latestTick: latestSimulationTickNumber,
    lastTickStatus,
    failedSystems,
    lastErrorMessage,
    biomeCoveragePercent,
    plantCoveragePercent,
    weatherSnapshotAvailable,
  });

  return {
    worldId: input.world.id,
    worldName: input.world.name,
    status: input.world.status,
    currentTick,
    latestSimulationTickNumber,
    lastTickStatus,
    lastSuccessfulTickTime: toIsoString(input.lastSuccessfulTickCompletedAt),
    failedSystems,
    lastErrorMessage,
    biomeCoveragePercent,
    plantCoveragePercent,
    animalSpeciesCount: input.animalSpeciesCount,
    occupiedAnimalHabitatPercent,
    totalWildlifePopulation: input.totalWildlifePopulation,
    averageAnimalHabitatSuitability: input.averageAnimalHabitatSuitability,
    averageAnimalHealth: input.averageAnimalHealth,
    weatherSnapshotAvailable,
    badge,
  };
}


type PersistedAnimalHealthRow = {
  animal_species_count: bigint | number | null;
  occupied_cells: bigint | number | null;
  total_population: number | null;
  average_suitability: number | null;
  average_health: number | null;
};

async function getPersistedAnimalHealth(planetId: string): Promise<{
  animalCellCount: number;
  animalSpeciesCount: number;
  totalWildlifePopulation: number;
  averageAnimalHabitatSuitability: number;
  averageAnimalHealth: number;
}> {
  const rows = await prisma.$queryRaw<PersistedAnimalHealthRow[]>`
    SELECT
      COUNT(DISTINCT NULLIF("dominantSpeciesId", 'none')) AS animal_species_count,
      COUNT(*) FILTER (WHERE "totalWildlifePopulation" > 0) AS occupied_cells,
      COALESCE(SUM("totalWildlifePopulation"), 0) AS total_population,
      COALESCE(AVG(NULLIF("averageHabitatSuitability", 0)), 0) AS average_suitability,
      COALESCE(AVG(NULLIF("averageAnimalHealth", 0)), 0) AS average_health
    FROM "PlanetCell"
    WHERE "planetId" = ${planetId}
  `;
  const row = rows[0];

  return {
    animalCellCount: Number(row?.occupied_cells ?? 0),
    animalSpeciesCount: Number(row?.animal_species_count ?? 0),
    totalWildlifePopulation: Number(row?.total_population ?? 0),
    averageAnimalHabitatSuitability: Number(row?.average_suitability ?? 0),
    averageAnimalHealth: Number(row?.average_health ?? 0),
  };
}

export async function getWorldHealthSummary(worldId: string): Promise<WorldHealthSummary> {
  const expectedCellCount = getGridSummary(createGrid()).totalCells;
  const world = await prisma.world.findUniqueOrThrow({
    where: { id: worldId },
    select: {
      id: true,
      name: true,
      status: true,
      currentTick: true,
      planet: {
        select: { id: true },
      },
    },
  });

  const [latestTick, lastSuccessfulTick, biomeCellCount, plantCellCount, animalHealth] = await Promise.all([
    prisma.simulationTick.findFirst({
      where: { worldId },
      orderBy: { tick: "desc" },
      select: { tick: true, success: true, metadata: true },
    }),
    prisma.simulationTick.findFirst({
      where: { worldId, success: true },
      orderBy: { tick: "desc" },
      select: { completedAt: true },
    }),
    world.planet
      ? prisma.planetCell.count({ where: { planetId: world.planet.id } })
      : Promise.resolve(0),
    world.planet
      ? prisma.planetCell.count({
        where: {
          planetId: world.planet.id,
          plantGeneratedAt: { not: null },
        },
      })
      : Promise.resolve(0),
    world.planet
      ? getPersistedAnimalHealth(world.planet.id)
      : Promise.resolve({
        animalCellCount: 0,
        animalSpeciesCount: 0,
        totalWildlifePopulation: 0,
        averageAnimalHabitatSuitability: 0,
        averageAnimalHealth: 0,
      }),
  ]);

  return buildWorldHealthSummary({
    world,
    latestTick,
    lastSuccessfulTickCompletedAt: lastSuccessfulTick?.completedAt ?? null,
    expectedCellCount,
    biomeCellCount,
    plantCellCount,
    animalCellCount: animalHealth.animalCellCount,
    animalSpeciesCount: animalHealth.animalSpeciesCount,
    totalWildlifePopulation: animalHealth.totalWildlifePopulation,
    averageAnimalHabitatSuitability: animalHealth.averageAnimalHabitatSuitability,
    averageAnimalHealth: animalHealth.averageAnimalHealth,
  });
}

export async function listWorldHealthSummaries(worldIds: readonly string[]): Promise<Map<string, WorldHealthSummary>> {
  const entries = await Promise.all(worldIds.map(async (worldId) => [worldId, await getWorldHealthSummary(worldId)] as const));

  return new Map(entries);
}
