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
  averageEcosystemHealth: number;
  averageBiodiversity: number;
  migrationActivity: number;
  foodStability: number;
  predatorBalance: number;
  collapsedHabitats: number;
  populationGrowthRate: number;
  plantConsumptionRate: number;
  averageFitness: number;
  averageAdaptationDiversity: number;
  highestAdaptedPopulation: string | null;
  lowestFitnessPopulation: string | null;
  averageMigrationInstinct: number;
  averageDiseaseResistance: number;
  averageReproductiveEfficiency: number;
  averageClimateAdaptation: number;
  weatherSnapshotAvailable: boolean;
  systemHealthStatus: WorldHealthBadge | null;
  systemHealthDiagnostics: string[];
  badge: WorldHealthBadge;
  // Availability flags
  animalDataAvailable?: boolean;
  ecosystemDataAvailable?: boolean;
  adaptationDataAvailable?: boolean;
  humanDataAvailable?: boolean;
  // Human MVA cards
  humanPopulation?: number | null;
  maleHumans?: number | null;
  femaleHumans?: number | null;
  adultHumans?: number | null;
  childrenHumans?: number | null;
  latestHumanAction?: string | null;
  latestHumanCausalEvent?: string | null;
  averageHumanFear?: number | null;
  averageHumanCuriosity?: number | null;
  averageHumanRelationshipStability?: number | null;
  humanSystemStatus?: "Active" | "Unavailable";
};

type PipelineEntry = {
  name?: unknown;
  label?: unknown;
  success?: unknown;
  error?: unknown;
  metadata?: unknown;
  health?: unknown;
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
  averageEcosystemHealth: number;
  averageBiodiversity: number;
  migrationActivity: number;
  foodStability: number;
  predatorBalance: number;
  collapsedHabitats: number;
  populationGrowthRate: number;
  plantConsumptionRate: number;
  averageFitness: number;
  averageAdaptationDiversity: number;
  highestAdaptedPopulation: string | null;
  lowestFitnessPopulation: string | null;
  averageMigrationInstinct: number;
  averageDiseaseResistance: number;
  averageReproductiveEfficiency: number;
  averageClimateAdaptation: number;
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

function normalizeHealthStatus(value: unknown): WorldHealthBadge | null {
  return value === "Healthy" || value === "Warning" || value === "Error" ? value : null;
}

function getSystemHealth(metadata: Prisma.JsonValue | null): {
  status: WorldHealthBadge | null;
  diagnostics: string[];
} {
  if (isRecord(metadata) && isRecord(metadata.health)) {
    const status = normalizeHealthStatus(metadata.health.status);
    const diagnostics = Array.isArray(metadata.health.diagnostics)
      ? metadata.health.diagnostics.filter((entry): entry is string => typeof entry === "string")
      : [];

    return { status, diagnostics };
  }

  const pipelineHealth = getPipeline(metadata)
    .map((entry) => isRecord(entry.health) ? entry.health : null)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const diagnostics = pipelineHealth.flatMap((entry) => Array.isArray(entry.diagnostics)
    ? entry.diagnostics.filter((diagnostic): diagnostic is string => typeof diagnostic === "string")
    : []);

  if (pipelineHealth.some((entry) => entry.status === "Error")) {
    return { status: "Error", diagnostics };
  }

  if (pipelineHealth.some((entry) => entry.status === "Warning")) {
    return { status: "Warning", diagnostics };
  }

  if (pipelineHealth.some((entry) => entry.status === "Healthy")) {
    return { status: "Healthy", diagnostics };
  }

  return { status: null, diagnostics };
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getPersistedHumanMetrics(metadata: Prisma.JsonValue | null): Pick<
  WorldHealthSummary,
  | "humanDataAvailable"
  | "humanPopulation"
  | "maleHumans"
  | "femaleHumans"
  | "adultHumans"
  | "childrenHumans"
  | "latestHumanAction"
  | "latestHumanCausalEvent"
  | "averageHumanFear"
  | "averageHumanCuriosity"
  | "averageHumanRelationshipStability"
  | "humanSystemStatus"
> {
  const pipeline = getPipeline(metadata);
  const familyEntry = pipeline.find((entry) => entry.name === "family-generations");
  const humanEntry = pipeline.find((entry) => entry.name === "humans" || entry.label === "Humans");
  const familyMetadata = isRecord(familyEntry?.metadata) ? familyEntry.metadata : null;
  const entryMetadata = isRecord(humanEntry?.metadata) ? humanEntry.metadata : null;
  const humanPayload = entryMetadata && isRecord(entryMetadata.result) ? entryMetadata.result : entryMetadata;
  const payload = familyMetadata && Array.isArray(familyMetadata.agents) ? familyMetadata : humanPayload;
  const agents = Array.isArray(payload?.agents)
    ? payload.agents.filter((agent): agent is Record<string, unknown> => isRecord(agent))
    : [];

  if (!payload || agents.length === 0) {
    return {
      humanDataAvailable: false,
      humanPopulation: null,
      maleHumans: null,
      femaleHumans: null,
      adultHumans: null,
      childrenHumans: null,
      latestHumanAction: null,
      latestHumanCausalEvent: null,
      averageHumanFear: null,
      averageHumanCuriosity: null,
      averageHumanRelationshipStability: null,
      humanSystemStatus: "Unavailable",
    };
  }

  const latestActions = agents.flatMap((agent) => {
    const sex = getStringValue(agent.sex) ?? "human";
    const lastDecision = isRecord(agent.lastDecision) ? agent.lastDecision : null;
    const action = getStringValue(lastDecision?.action);

    return action ? [`${sex}: ${action}`] : [];
  });
  const chroniclerReport = isRecord(payload.chroniclerReport) ? payload.chroniclerReport : null;
  const chroniclerEntries = Array.isArray(chroniclerReport?.entries)
    ? chroniclerReport.entries.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
  const latestChroniclerEntry = chroniclerEntries.at(-1);
  const relationships = Array.isArray(payload.relationships)
    ? payload.relationships.filter((relationship): relationship is Record<string, unknown> => isRecord(relationship))
    : [];
  const relationshipStabilityScores = relationships.flatMap((relationship) => {
    const trust = toFiniteNumber(relationship.trust);
    const affection = toFiniteNumber(relationship.affection);
    const companionship = toFiniteNumber(relationship.companionship);

    return trust === null || affection === null || companionship === null
      ? []
      : [(trust + affection + companionship) / 3];
  });
  const averageHumanRelationshipStability = relationshipStabilityScores.length
    ? relationshipStabilityScores.reduce((sum, value) => sum + value, 0) / relationshipStabilityScores.length
    : null;

  return {
    humanDataAvailable: true,
    humanPopulation: agents.length,
    maleHumans: agents.filter((agent) => agent.sex === "male").length,
    femaleHumans: agents.filter((agent) => agent.sex === "female").length,
    adultHumans: agents.filter((agent) => (toFiniteNumber(agent.approxAgeYears) ?? 0) >= 18).length,
    childrenHumans: agents.filter((agent) => (toFiniteNumber(agent.approxAgeYears) ?? 0) < 18).length,
    latestHumanAction: latestActions.length > 0 ? latestActions.join(", ") : null,
    latestHumanCausalEvent: getStringValue(latestChroniclerEntry?.title),
    averageHumanFear: null,
    averageHumanCuriosity: null,
    averageHumanRelationshipStability,
    humanSystemStatus: "Active",
  };
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
  systemHealthStatus: WorldHealthBadge | null;
}): WorldHealthBadge {
  if (
    input.lastTickStatus === "failed" ||
    input.failedSystems.length > 0 ||
    input.lastErrorMessage ||
    input.systemHealthStatus === "Error"
  ) {
    return "Error";
  }

  if (
    input.lastTickStatus === "missing" ||
    (input.latestTick !== null && input.currentTick !== input.latestTick) ||
    input.biomeCoveragePercent < 100 ||
    input.plantCoveragePercent < 100 ||
    !input.weatherSnapshotAvailable ||
    input.systemHealthStatus === "Warning"
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
  const systemHealth = input.latestTick ? getSystemHealth(input.latestTick.metadata) : { status: null, diagnostics: [] };
  const occupiedAnimalHabitatPercent = roundPercent(input.animalCellCount, input.expectedCellCount);
  const humanMetrics = getPersistedHumanMetrics(input.latestTick?.metadata ?? null);
  const badge = deriveBadge({
    currentTick,
    latestTick: latestSimulationTickNumber,
    lastTickStatus,
    failedSystems,
    lastErrorMessage,
    biomeCoveragePercent,
    plantCoveragePercent,
    weatherSnapshotAvailable,
    systemHealthStatus: systemHealth.status,
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
    averageEcosystemHealth: input.averageEcosystemHealth,
    averageBiodiversity: input.averageBiodiversity,
    migrationActivity: input.migrationActivity,
    foodStability: input.foodStability,
    predatorBalance: input.predatorBalance,
    collapsedHabitats: input.collapsedHabitats,
    populationGrowthRate: input.populationGrowthRate,
    plantConsumptionRate: input.plantConsumptionRate,
    averageFitness: input.averageFitness,
    averageAdaptationDiversity: input.averageAdaptationDiversity,
    highestAdaptedPopulation: input.highestAdaptedPopulation,
    lowestFitnessPopulation: input.lowestFitnessPopulation,
    averageMigrationInstinct: input.averageMigrationInstinct,
    averageDiseaseResistance: input.averageDiseaseResistance,
    averageReproductiveEfficiency: input.averageReproductiveEfficiency,
    averageClimateAdaptation: input.averageClimateAdaptation,
    weatherSnapshotAvailable,
    systemHealthStatus: systemHealth.status,
    systemHealthDiagnostics: systemHealth.diagnostics,
    badge,
    humanDataAvailable: humanMetrics.humanDataAvailable,
    humanPopulation: humanMetrics.humanPopulation,
    maleHumans: humanMetrics.maleHumans,
    femaleHumans: humanMetrics.femaleHumans,
    adultHumans: humanMetrics.adultHumans,
    childrenHumans: humanMetrics.childrenHumans,
    latestHumanAction: humanMetrics.latestHumanAction,
    latestHumanCausalEvent: humanMetrics.latestHumanCausalEvent,
    averageHumanFear: humanMetrics.averageHumanFear,
    averageHumanCuriosity: humanMetrics.averageHumanCuriosity,
    averageHumanRelationshipStability: humanMetrics.averageHumanRelationshipStability,
    humanSystemStatus: humanMetrics.humanSystemStatus,
  };
}


type PersistedAnimalHealthRow = {
  animal_species_count: bigint | number | null;
  occupied_cells: bigint | number | null;
  total_population: number | null;
  average_suitability: number | null;
  average_health: number | null;
  average_ecosystem_health?: number | null;
  average_biodiversity?: number | null;
  migration_activity?: number | null;
  food_stability?: number | null;
  predator_balance?: number | null;
  collapsed_habitats?: bigint | number | null;
  population_growth_rate?: number | null;
  plant_consumption_rate?: number | null;
  average_fitness?: number | null;
  average_adaptation_diversity?: number | null;
  highest_adapted_population?: unknown;
  lowest_fitness_population?: unknown;
  average_migration_instinct?: number | null;
  average_disease_resistance?: number | null;
  average_reproductive_efficiency?: number | null;
  average_climate_adaptation?: number | null;
};

type SchemaColumnProbe = {
  has_animal_columns: boolean;
};

const EMPTY_ANIMAL_HEALTH = Object.freeze({
  animalCellCount: 0,
  animalSpeciesCount: 0,
  totalWildlifePopulation: 0,
  averageAnimalHabitatSuitability: 0,
  averageAnimalHealth: 0,
  averageEcosystemHealth: 0,
  averageBiodiversity: 0,
  migrationActivity: 0,
  foodStability: 0,
  predatorBalance: 0,
  collapsedHabitats: 0,
  populationGrowthRate: 0,
  plantConsumptionRate: 0,
  averageFitness: 0,
  averageAdaptationDiversity: 0,
  highestAdaptedPopulation: null,
  lowestFitnessPopulation: null,
  averageMigrationInstinct: 0,
  averageDiseaseResistance: 0,
  averageReproductiveEfficiency: 0,
  averageClimateAdaptation: 0,
});

async function hasPersistedAnimalHealthColumns(): Promise<boolean> {
  const rows = await prisma.$queryRaw<SchemaColumnProbe[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlanetCell'
        AND column_name = 'dominantSpeciesId'
    ) AS has_animal_columns
  `;

  return Boolean(rows[0]?.has_animal_columns);
}

async function hasPersistedEcosystemHealthColumns(): Promise<boolean> {
  const rows = await prisma.$queryRaw<SchemaColumnProbe[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlanetCell'
        AND column_name = 'ecosystemHealthScore'
    ) AS has_animal_columns
  `;

  return Boolean(rows[0]?.has_animal_columns);
}

function formatPopulationSummary(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const speciesName = typeof value.speciesName === "string" ? value.speciesName : null;
  const score = typeof value.score === "number" ? value.score : null;

  if (!speciesName || score === null) {
    return null;
  }

  return `${speciesName} (${Math.round(score * 100) / 100})`;
}

async function hasPersistedPopulationAdaptationColumns(): Promise<boolean> {
  const rows = await prisma.$queryRaw<SchemaColumnProbe[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlanetCell'
        AND column_name = 'averageFitness'
    ) AS has_animal_columns
  `;

  return Boolean(rows[0]?.has_animal_columns);
}

async function getPersistedAnimalHealth(planetId: string): Promise<{
  animalCellCount: number;
  animalSpeciesCount: number;
  totalWildlifePopulation: number;
  averageAnimalHabitatSuitability: number;
  averageAnimalHealth: number;
  averageEcosystemHealth: number;
  averageBiodiversity: number;
  migrationActivity: number;
  foodStability: number;
  predatorBalance: number;
  collapsedHabitats: number;
  populationGrowthRate: number;
  plantConsumptionRate: number;
  averageFitness: number;
  averageAdaptationDiversity: number;
  highestAdaptedPopulation: string | null;
  lowestFitnessPopulation: string | null;
  averageMigrationInstinct: number;
  averageDiseaseResistance: number;
  averageReproductiveEfficiency: number;
  averageClimateAdaptation: number;
}> {
  if (!await hasPersistedAnimalHealthColumns()) {
    return EMPTY_ANIMAL_HEALTH;
  }

  const hasEcosystemColumns = await hasPersistedEcosystemHealthColumns();
  const hasAdaptationColumns = await hasPersistedPopulationAdaptationColumns();
  const rows = hasEcosystemColumns && hasAdaptationColumns
    ? await prisma.$queryRaw<PersistedAnimalHealthRow[]>`
    SELECT
      COUNT(DISTINCT NULLIF("dominantSpeciesId", 'none')) AS animal_species_count,
      COUNT(*) FILTER (WHERE "totalWildlifePopulation" > 0) AS occupied_cells,
      COALESCE(SUM("totalWildlifePopulation"), 0) AS total_population,
      COALESCE(AVG(NULLIF("averageHabitatSuitability", 0)), 0) AS average_suitability,
      COALESCE(AVG(NULLIF("averageAnimalHealth", 0)), 0) AS average_health,
      COALESCE(AVG(NULLIF("ecosystemHealthScore", 0)), 0) AS average_ecosystem_health,
      COALESCE(AVG(GREATEST("biodiversityScore", "animalBiodiversityScore")), 0) AS average_biodiversity,
      COALESCE(AVG("migrationActivity"), 0) AS migration_activity,
      COALESCE(AVG("foodStability"), 0) AS food_stability,
      COALESCE(AVG("predatorPreyBalance"), 0) AS predator_balance,
      COUNT(*) FILTER (WHERE "ecosystemHealthStatus" IN ('Collapsed', 'Collapsing')) AS collapsed_habitats,
      COALESCE(AVG("populationGrowthRate"), 0) AS population_growth_rate,
      COALESCE(AVG("plantConsumptionRate"), 0) AS plant_consumption_rate,
      COALESCE(AVG("averageFitness"), 0) AS average_fitness,
      COALESCE(AVG("adaptationDiversity"), 0) AS average_adaptation_diversity,
      (ARRAY_AGG("highestAdaptedPopulation" ORDER BY "averageFitness" DESC))[1] AS highest_adapted_population,
      (ARRAY_AGG("lowestFitnessPopulation" ORDER BY "averageFitness" ASC))[1] AS lowest_fitness_population,
      COALESCE(AVG("averageMigrationInstinct"), 0) AS average_migration_instinct,
      COALESCE(AVG("averageDiseaseResistance"), 0) AS average_disease_resistance,
      COALESCE(AVG("averageReproductiveEfficiency"), 0) AS average_reproductive_efficiency,
      COALESCE(AVG("averageClimateAdaptation"), 0) AS average_climate_adaptation
    FROM "PlanetCell"
    WHERE "planetId" = ${planetId}
  `
    : hasEcosystemColumns
      ? await prisma.$queryRaw<PersistedAnimalHealthRow[]>`
    SELECT
      COUNT(DISTINCT NULLIF("dominantSpeciesId", 'none')) AS animal_species_count,
      COUNT(*) FILTER (WHERE "totalWildlifePopulation" > 0) AS occupied_cells,
      COALESCE(SUM("totalWildlifePopulation"), 0) AS total_population,
      COALESCE(AVG(NULLIF("averageHabitatSuitability", 0)), 0) AS average_suitability,
      COALESCE(AVG(NULLIF("averageAnimalHealth", 0)), 0) AS average_health,
      COALESCE(AVG(NULLIF("ecosystemHealthScore", 0)), 0) AS average_ecosystem_health,
      COALESCE(AVG(GREATEST("biodiversityScore", "animalBiodiversityScore")), 0) AS average_biodiversity,
      COALESCE(AVG("migrationActivity"), 0) AS migration_activity,
      COALESCE(AVG("foodStability"), 0) AS food_stability,
      COALESCE(AVG("predatorPreyBalance"), 0) AS predator_balance,
      COUNT(*) FILTER (WHERE "ecosystemHealthStatus" IN ('Collapsed', 'Collapsing')) AS collapsed_habitats,
      COALESCE(AVG("populationGrowthRate"), 0) AS population_growth_rate,
      COALESCE(AVG("plantConsumptionRate"), 0) AS plant_consumption_rate
    FROM "PlanetCell"
    WHERE "planetId" = ${planetId}
  `
      : await prisma.$queryRaw<PersistedAnimalHealthRow[]>`
    SELECT
      COUNT(DISTINCT NULLIF("dominantSpeciesId", 'none')) AS animal_species_count,
      COUNT(*) FILTER (WHERE "totalWildlifePopulation" > 0) AS occupied_cells,
      COALESCE(SUM("totalWildlifePopulation"), 0) AS total_population,
      COALESCE(AVG(NULLIF("averageHabitatSuitability", 0)), 0) AS average_suitability,
      COALESCE(AVG(NULLIF("averageAnimalHealth", 0)), 0) AS average_health
    FROM "PlanetCell"
    WHERE "planetId" = ${planetId}
  `;  const row = rows[0];

  return {
    animalCellCount: Number(row?.occupied_cells ?? 0),
    animalSpeciesCount: Number(row?.animal_species_count ?? 0),
    totalWildlifePopulation: Number(row?.total_population ?? 0),
    averageAnimalHabitatSuitability: Number(row?.average_suitability ?? 0),
    averageAnimalHealth: Number(row?.average_health ?? 0),
    averageEcosystemHealth: Number(row?.average_ecosystem_health ?? 0),
    averageBiodiversity: Number(row?.average_biodiversity ?? 0),
    migrationActivity: Number(row?.migration_activity ?? 0),
    foodStability: Number(row?.food_stability ?? 0),
    predatorBalance: Number(row?.predator_balance ?? 0),
    collapsedHabitats: Number(row?.collapsed_habitats ?? 0),
    populationGrowthRate: Number(row?.population_growth_rate ?? 0),
    plantConsumptionRate: Number(row?.plant_consumption_rate ?? 0),
    averageFitness: Number(row?.average_fitness ?? 0),
    averageAdaptationDiversity: Number(row?.average_adaptation_diversity ?? 0),
    highestAdaptedPopulation: formatPopulationSummary(row?.highest_adapted_population),
    lowestFitnessPopulation: formatPopulationSummary(row?.lowest_fitness_population),
    averageMigrationInstinct: Number(row?.average_migration_instinct ?? 0),
    averageDiseaseResistance: Number(row?.average_disease_resistance ?? 0),
    averageReproductiveEfficiency: Number(row?.average_reproductive_efficiency ?? 0),
    averageClimateAdaptation: Number(row?.average_climate_adaptation ?? 0),
  };
}


type LightweightHealthWorld = {
  id: string;
  name: string;
  slug?: string | null;
  status: WorldStatus | string;
  currentTick: bigint | number | string;
};

type LightweightTick = {
  tick: bigint;
  success: boolean;
  metadata: Prisma.JsonValue | null;
  completedAt: Date;
};

type TimedPromiseCache<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const HEALTH_PROMISE_CACHE_TTL_MS = 5_000;
const lightweightHealthCache = new Map<string, TimedPromiseCache<WorldHealthSummary>>();
const fullHealthCache = new Map<string, TimedPromiseCache<WorldHealthSummary>>();

function memoizeHealthPromise<T>(
  cache: Map<string, TimedPromiseCache<T>>,
  key: string,
  compute: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);

  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const promise = compute().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { promise, expiresAt: now + HEALTH_PROMISE_CACHE_TTL_MS });
  return promise;
}

export function isDefaultUiHealthWorld(world: { slug?: string | null; status?: string | null }): boolean {
  return world.status !== "ARCHIVED" && !world.slug?.startsWith("test-world-");
}

function buildLightweightWorldHealthSummary(
  world: LightweightHealthWorld,
  latestTick: LightweightTick | null,
): WorldHealthSummary {
  const currentTick = toTickString(world.currentTick);
  const latestSimulationTickNumber = latestTick ? toTickString(latestTick.tick) : null;
  const lastTickStatus: LastTickStatus = latestTick
    ? latestTick.success ? "success" : "failed"
    : "missing";
  const failedSystems = latestTick ? getFailedSystems(latestTick.metadata) : [];
  const lastErrorMessage = latestTick ? getLastErrorMessage(latestTick.metadata) : null;
  const weatherSnapshotAvailable = latestTick ? hasWeatherSnapshot(latestTick.metadata) : false;
  const systemHealth = latestTick ? getSystemHealth(latestTick.metadata) : { status: null, diagnostics: [] };
  const humanMetrics = getPersistedHumanMetrics(latestTick?.metadata ?? null);
  const badge = deriveBadge({
    currentTick,
    latestTick: latestSimulationTickNumber,
    lastTickStatus,
    failedSystems,
    lastErrorMessage,
    biomeCoveragePercent: 100,
    plantCoveragePercent: 100,
    weatherSnapshotAvailable,
    systemHealthStatus: systemHealth.status,
  });

  return {
    worldId: world.id,
    worldName: world.name,
    status: world.status,
    currentTick,
    latestSimulationTickNumber,
    lastTickStatus,
    lastSuccessfulTickTime: latestTick?.success ? latestTick.completedAt.toISOString() : null,
    failedSystems,
    lastErrorMessage,
    biomeCoveragePercent: 100,
    plantCoveragePercent: 100,
    animalSpeciesCount: 0,
    occupiedAnimalHabitatPercent: 0,
    totalWildlifePopulation: 0,
    averageAnimalHabitatSuitability: 0,
    averageAnimalHealth: 0,
    averageEcosystemHealth: 0,
    averageBiodiversity: 0,
    migrationActivity: 0,
    foodStability: 0,
    predatorBalance: 0,
    collapsedHabitats: 0,
    populationGrowthRate: 0,
    plantConsumptionRate: 0,
    averageFitness: 0,
    averageAdaptationDiversity: 0,
    highestAdaptedPopulation: null,
    lowestFitnessPopulation: null,
    averageMigrationInstinct: 0,
    averageDiseaseResistance: 0,
    averageReproductiveEfficiency: 0,
    averageClimateAdaptation: 0,
    weatherSnapshotAvailable,
    systemHealthStatus: systemHealth.status,
    systemHealthDiagnostics: systemHealth.diagnostics,
    badge,
    animalDataAvailable: false,
    ecosystemDataAvailable: false,
    adaptationDataAvailable: false,
    humanDataAvailable: humanMetrics.humanDataAvailable,
    humanPopulation: humanMetrics.humanPopulation,
    maleHumans: humanMetrics.maleHumans,
    femaleHumans: humanMetrics.femaleHumans,
    adultHumans: humanMetrics.adultHumans,
    childrenHumans: humanMetrics.childrenHumans,
    latestHumanAction: humanMetrics.latestHumanAction,
    latestHumanCausalEvent: humanMetrics.latestHumanCausalEvent,
    averageHumanFear: humanMetrics.averageHumanFear,
    averageHumanCuriosity: humanMetrics.averageHumanCuriosity,
    averageHumanRelationshipStability: humanMetrics.averageHumanRelationshipStability,
    humanSystemStatus: humanMetrics.humanSystemStatus,
  };
}

export async function getLightweightWorldHealthSummary(world: LightweightHealthWorld): Promise<WorldHealthSummary> {
  const cacheKey = `${world.id}:${world.status}:${toTickString(world.currentTick)}`;

  return memoizeHealthPromise(lightweightHealthCache, cacheKey, async () => {
    const latestTick = await prisma.simulationTick.findFirst({
      where: { worldId: world.id },
      orderBy: { tick: "desc" },
      select: { tick: true, success: true, metadata: true, completedAt: true },
    });

    return buildLightweightWorldHealthSummary(world, latestTick);
  });
}

export async function listWorldHealthSummariesLightweight(
  worlds: readonly LightweightHealthWorld[],
): Promise<Map<string, WorldHealthSummary>> {
  const entries = await Promise.all(
    worlds.map(async (world) => [world.id, await getLightweightWorldHealthSummary(world)] as const),
  );

  return new Map(entries);
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
      seed: true,
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
        averageEcosystemHealth: 0,
        averageBiodiversity: 0,
        migrationActivity: 0,
        foodStability: 0,
        predatorBalance: 0,
        collapsedHabitats: 0,
        populationGrowthRate: 0,
        plantConsumptionRate: 0,
        averageFitness: 0,
        averageAdaptationDiversity: 0,
        highestAdaptedPopulation: null,
        lowestFitnessPopulation: null,
        averageMigrationInstinct: 0,
        averageDiseaseResistance: 0,
        averageReproductiveEfficiency: 0,
        averageClimateAdaptation: 0,
      }),
    hasPersistedAnimalHealthColumns(),
    hasPersistedEcosystemHealthColumns(),
    hasPersistedPopulationAdaptationColumns(),
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
    averageEcosystemHealth: animalHealth.averageEcosystemHealth,
    averageBiodiversity: animalHealth.averageBiodiversity,
    migrationActivity: animalHealth.migrationActivity,
    foodStability: animalHealth.foodStability,
    predatorBalance: animalHealth.predatorBalance,
    collapsedHabitats: animalHealth.collapsedHabitats,
    populationGrowthRate: animalHealth.populationGrowthRate,
    plantConsumptionRate: animalHealth.plantConsumptionRate,
    averageFitness: animalHealth.averageFitness,
    averageAdaptationDiversity: animalHealth.averageAdaptationDiversity,
    highestAdaptedPopulation: animalHealth.highestAdaptedPopulation,
    lowestFitnessPopulation: animalHealth.lowestFitnessPopulation,
    averageMigrationInstinct: animalHealth.averageMigrationInstinct,
    averageDiseaseResistance: animalHealth.averageDiseaseResistance,
    averageReproductiveEfficiency: animalHealth.averageReproductiveEfficiency,
    averageClimateAdaptation: animalHealth.averageClimateAdaptation,
  }) as WorldHealthSummary & {
    animalDataAvailable?: boolean;
    ecosystemDataAvailable?: boolean;
    adaptationDataAvailable?: boolean;
    humanDataAvailable?: boolean;
  };
}

// Augment the summary with availability flags and human metrics
export async function getWorldHealthSummaryWithHumans(worldId: string): Promise<WorldHealthSummary> {
  const base = await getWorldHealthSummary(worldId);

  // We detect availability by checking if columns exist; reuse probes
  const [hasAnimalCols, hasEcoCols, hasAdaptCols] = await Promise.all([
    hasPersistedAnimalHealthColumns(),
    hasPersistedEcosystemHealthColumns(),
    hasPersistedPopulationAdaptationColumns(),
  ]);

  // Compute human metrics again here to attach (keeps buildWorldHealthSummary pure)
  const world = await prisma.world.findUniqueOrThrow({ where: { id: worldId }, select: { id: true, seed: true, currentTick: true } });
  let humanPopulation: number | null = null;
  let maleHumans: number | null = null;
  let femaleHumans: number | null = null;
  let adultHumans: number | null = null;
  let childrenHumans: number | null = null;
  let latestHumanAction: string | null = null;
  let latestHumanCausalEvent: string | null = null;
  let averageHumanFear: number | null = null;
  let averageHumanCuriosity: number | null = null;
  let averageHumanRelationshipStability: number | null = null;
  let humanSystemStatus: "Active" | "Unavailable" = "Unavailable";

  try {
    const { getHumanMvaStateAtTick } = await import("./human-engine");
    const tick = BigInt(world.currentTick ?? 0);
    const humanResult = getHumanMvaStateAtTick({ id: world.id, seed: world.seed }, tick);
    const agents = humanResult.state.agents;
    humanPopulation = agents.length;
    maleHumans = agents.filter((a) => a.sex === "male").length;
    femaleHumans = agents.filter((a) => a.sex === "female").length;
    adultHumans = agents.filter((a) => a.approxAgeYears >= 18).length;
    childrenHumans = agents.filter((a) => a.approxAgeYears < 18).length;
    latestHumanAction = agents.length > 0 ? agents.map((a) => `${a.sex}: ${a.lastDecision?.action ?? "-"}`).join(", ") : null;
    const lastEvent = humanResult.state.causalEvents.at(-1);
    latestHumanCausalEvent = lastEvent ? `${lastEvent.title}` : null;
    averageHumanFear = agents.length ? agents.reduce((s, a) => s + a.emotions.fear, 0) / agents.length : null;
    averageHumanCuriosity = agents.length ? agents.reduce((s, a) => s + a.emotions.curiosity, 0) / agents.length : null;
    const relationships = humanResult.state.relationships;
    if (relationships.length) {
      const stabilityScores = relationships.map((r) => (r.trust + r.affection + r.companionship) / 3);
      averageHumanRelationshipStability = stabilityScores.reduce((s, v) => s + v, 0) / stabilityScores.length;
    } else {
      averageHumanRelationshipStability = null;
    }
    humanSystemStatus = "Active";
  } catch {
    humanSystemStatus = "Unavailable";
  }

  return {
    ...base,
    animalDataAvailable: hasAnimalCols,
    ecosystemDataAvailable: hasEcoCols,
    adaptationDataAvailable: hasAdaptCols,
    humanDataAvailable: humanSystemStatus === "Active",
    humanPopulation,
    maleHumans,
    femaleHumans,
    adultHumans,
    childrenHumans,
    latestHumanAction,
    latestHumanCausalEvent,
    averageHumanFear,
    averageHumanCuriosity,
    averageHumanRelationshipStability,
    humanSystemStatus,
  };
}

export async function getCachedWorldHealthSummaryWithHumans(worldId: string): Promise<WorldHealthSummary> {
  return memoizeHealthPromise(fullHealthCache, worldId, () => getWorldHealthSummaryWithHumans(worldId));
}
export async function listWorldHealthSummaries(worldIds: readonly string[]): Promise<Map<string, WorldHealthSummary>> {
  const entries = await Promise.all(worldIds.map(async (worldId) => [worldId, await getCachedWorldHealthSummaryWithHumans(worldId)] as const));

  return new Map(entries);
}
