import type { AnimalGridCell } from "../simulation/animal-engine";
import { getHumanMvaStateAtTick } from "../simulation/human-engine";
import type { ChroniclerEntry, HumanAgent, HumanCausalEvent, HumanEmotionState, HumanNeeds, HumanRelationship } from "../simulation/human-types";
import { HUMAN_MVA_DAY_TICKS } from "../simulation/human-types";
import { getAnimalEcologyStateAtTick } from "../simulation/animal-engine";
import type {
  AstronomyState,
} from "../simulation/astronomy-engine";
import { getAstronomyStateAtTick } from "../simulation/astronomy-engine";
import type {
  AtmosphericGridCell,
  AtmosphericSummary,
} from "../simulation/atmosphere-engine";
import { getAtmosphereStateAtTick } from "../simulation/atmosphere-engine";
import type { BiomeGridCell } from "../simulation/biome-engine";
import { getBiomeStateAtTick } from "../simulation/biome-engine";
import type {
  ClimateGridCell,
  ClimateState,
} from "../simulation/climate-engine";
import { getClimateGridAtTick, getClimateStateAtTick } from "../simulation/climate-engine";
import { createGrid, getGridSummary, type SpatialGrid } from "../simulation/grid/grid";
import { getSnapshotWorldKey, memoizeSnapshotValue, type TimedSnapshotValue } from "../simulation/snapshot-performance";
import type {
  HydrologyGridCell,
  HydrologySummary,
} from "../simulation/hydrology-engine";
import { getHydrologyState } from "../simulation/hydrology-engine";
import type { PlanetState } from "../simulation/planet-engine";
import { getPlanetState } from "../simulation/planet-engine";
import type {
  PlanetResourceGridCell,
  PlanetResourceSummary,
} from "../simulation/resources-engine";
import { getPlanetResourcesStateAtTick } from "../simulation/resources-engine";
import type { PlantGridCell } from "../simulation/plant-engine";
import { getPlantEcologyStateAtTick } from "../simulation/plant-engine";
import type {
  TerrainGridCell,
  TerrainSummary,
} from "../simulation/terrain-engine";
import { getTerrainState } from "../simulation/terrain-engine";
import {
  DEFAULT_WORLD_TIME_CONFIG,
  getTimeState,
  getTimeStateAtTick,
  type TimeState,
} from "../simulation/time-engine";
import type {
  WeatherGridCell,
  WeatherSummary,
} from "../simulation/weather-engine";
import { getWeatherStateAtTick } from "../simulation/weather-engine";
import { buildWorldFingerprint, verifyWorldAgainstCanonical, type WorldFingerprint } from "./canonical-world";
import type { WorldWithPlanet } from "./world-lifecycle";

export type AtlasWorldOption = {
  id: string;
  slug: string;
  name: string;
  environment: string;
  status: string;
  yearLengthDays: number;
  currentDay: number;
  hasSeed: boolean;
};

export type AtlasCell = ClimateGridCell & Pick<
  TerrainGridCell,
  | "elevation"
  | "terrainType"
  | "continentalness"
  | "ruggedness"
  | "tectonicActivity"
  | "isCoast"
> & Pick<
  HydrologyGridCell,
  | "isOcean"
  | "isSea"
  | "isLakeCandidate"
  | "isRiverCandidate"
  | "waterBodyType"
  | "drainageDirection"
  | "drainageTargetId"
  | "basinId"
  | "watershedId"
  | "flowAccumulation"
  | "moisturePotential"
  | "distanceToOcean"
  | "distanceToCoast"
> & Pick<
  AtmosphericGridCell,
  | "pressureZone"
  | "pressureValue"
  | "windDirection"
  | "windStrength"
  | "temperatureGradient"
  | "moistureTransportPotential"
  | "orographicLiftPotential"
  | "rainShadowPotential"
  | "atmosphericStability"
  | "seasonalShift"
> & Pick<
  WeatherGridCell,
  | "cloudCover"
  | "relativeHumidity"
  | "precipitationPotential"
  | "weatherType"
  | "snowPotential"
  | "fogPotential"
  | "stormPotential"
  | "evaporationPotential"
  | "drynessIndex"
  | "weatherStability"
> & Pick<
  PlanetResourceGridCell,
  | "bedrockType"
  | "sedimentDepth"
  | "volcanicInfluence"
  | "erosionPotential"
  | "metals"
  | "industrialMaterials"
  | "rareMaterials"
  | "waterResources"
  | "buildingResources"
  | "resourceRichness"
  | "metalRichness"
  | "industrialRichness"
  | "rareMaterialRichness"
  | "waterRichness"
  | "buildingMaterialAvailability"
  | "resourceDiversity"
> & {
  biomeKey: string;
  biomeName: string;
  biomeCategory: string;
  biomeColor: string;
  biomeTags: readonly string[];
  habitabilityScore: number;
  fertilityScore: number;
  waterAvailabilityScore: number;
  vegetationDensity: number;
  dominantPlantKey: string;
  dominantPlantName: string;
  dominantPlantCategory: string;
  dominantPlantColor: string;
  plantSuitabilityScore: number;
  plantDensity: number;
  biomassScore: number;
  ediblePlantScore: number;
  woodMaterialScore: number;
  medicinalPotentialScore: number;
  biodiversityScore: number;
  regrowthRate: number;
  seasonalStressScore: number;
  plantTags: readonly string[];
  dominantAnimalGuildKey: string;
  dominantAnimalGuildName: string;
  dominantAnimalGuildCategory: string;
  dominantAnimalGuildColor: string;
  animalSuitabilityScore: number;
  herbivoreCapacity: number;
  predatorCapacity: number;
  preyAvailability: number;
  animalDensity: number;
  migrationPressure: number;
  dangerScore: number;
  huntingValue: number;
  domesticationPotential: number;
  animalBiodiversityScore: number;
  carryingCapacityScore: number;
  animalTags: readonly string[];
  dominantSpeciesId: string;
  dominantSpeciesName: string;
  speciesCount: number;
  totalWildlifePopulation: number;
  averagePopulationHealth: number;
  averageHabitatSuitability: number;
  plantConsumptionRate: number;
  effectivePlantBiomass: number;
  predationPressure: number;
  predatorPreyBalance: number;
  foodStability: number;
  carryingCapacityUsage: number;
  migrationActivity: number;
  populationGrowthRate: number;
  ecosystemHealthScore: number;
  ecosystemHealthStatus: AnimalGridCell["ecosystemHealthStatus"];
  averageFitness: number;
  adaptationDiversity: number;
  averageMigrationInstinct: number;
  averageDiseaseResistance: number;
  averageReproductiveEfficiency: number;
  averageClimateAdaptation: number;
  highestAdaptedPopulation: AnimalGridCell["highestAdaptedPopulation"];
  lowestFitnessPopulation: AnimalGridCell["lowestFitnessPopulation"];
  ecosystemEvents: AnimalGridCell["ecosystemEvents"];
  ecosystemHistory: AnimalGridCell["ecosystemHistory"];
  movementVectors: AnimalGridCell["movementVectors"];
  animalPopulations: AnimalGridCell["animalPopulations"];
};

export type AtlasHumanAgent = {
  id: string;
  label: string;
  sex: "male" | "female";
  approxAgeYears: number;
  currentCellId: string;
  currentAction: string | null;
  needs: HumanNeeds;
  emotions: HumanEmotionState;
  currentMotivation?: string | null;
  motivationScores?: Record<string, number>;
  confidence?: number;
  familiarity?: number;
  curiosityProfile?: {
    environmental: number;
    social: number;
    technical: number;
    noveltySeeking: number;
    riskTolerance: number;
  };
  relationshipDrivers?: {
    trust: number;
    affection: number;
    attraction: number;
    companionship: number;
  } | null;
  decisionExplanation?: string | null;
  currentGoal?: string | null;
  relationshipToOther: HumanRelationship | null;
  latestMemory: {
    tick: string;
    eventType: string;
    summary: string;
  } | null;
  latestCausalEvent: {
    tick: string;
    type: string;
    title: string;
    summary: string;
  } | null;
  latestEmotionChangeSummary: string;
  emotionReasons: AtlasHumanEmotionReason[];
};

export type AtlasHumanMva = {
  tick: string;
  agents: AtlasHumanAgent[];
  causalEvents: Array<{
    id: string;
    tick: string;
    type: string;
    title: string;
    summary: string;
    agentIds: string[];
    cellId: string;
  }>;
  chroniclerEntries: ChroniclerEntry[];
  canSimulateOneHumanDay: boolean;
  forbiddenSystemsImplemented: [];
};

type AtlasHumanEmotionKey = "fear" | "distress" | "relief" | "curiosity" | "trust" | "attachment";

export type AtlasHumanEmotionReason = {
  emotion: AtlasHumanEmotionKey;
  before: number;
  after: number;
  delta: number;
  direction: "increased" | "decreased" | "steady" | "viable";
  summary: string;
  reasons: string[];
  causalEventLinks: Array<{
    id: string;
    tick: string;
    type: string;
    title: string;
    summary: string;
  }>;
};

export type AtlasStatistics = {
  averageTemperatureC: number;
  averageSolarEnergy: number;
  averageDaylightHours: number;
  averageHumidity: number;
  highestElevation: number;
  oceanPercent: number;
  largestWatershedEstimate: number;
  strongestWind: AtmosphericSummary["strongestWinds"][number] | null;
  dominantWeatherType: WeatherSummary["dominantWeatherType"];
  largestContinentEstimate: number;
  largestOceanEstimate: number;
  strongestMiningRegion: PlanetResourceSummary["strongestMiningRegion"];
  richestAquifer: PlanetResourceSummary["largestAquifer"];
  averageMineralRichness: number;
  resourceDiversity: number;
};

export type AtlasSnapshot = {
  worldId: string;
  worldSlug: string;
  worldName: string;
  selectedDay: number;
  tick: string;
  yearLengthDays: number;
  grid: ReturnType<typeof getGridSummary> & {
    cellWidthDegrees: number;
    cellHeightDegrees: number;
  };
  time: TimeState;
  astronomy: AstronomyState;
  planet: PlanetState;
  climate: ClimateState;
  terrainSummary: TerrainSummary;
  hydrologySummary: HydrologySummary;
  atmosphereSummary: AtmosphericSummary;
  weatherSummary: WeatherSummary;
  resourceSummary: PlanetResourceSummary;
  statistics: AtlasStatistics;
  humans: AtlasHumanMva;
  fingerprint: Pick<WorldFingerprint, "seed" | "hash" | "shortHash" | "canonical">;
  integrity: {
    canonical: boolean;
    environmentMatch: boolean;
    terrainValidated: boolean;
    climateValidated: boolean;
    hydrologyValidated: boolean;
    atmosphereValidated: boolean;
    weatherValidated: boolean;
  };
  cells: AtlasCell[];
};

function positiveOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function integerOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isInteger(value) ? Number(value) : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function getConfiguredYearLengthDays(world: WorldWithPlanet): number {
  return Math.max(
    1,
    integerOrDefault(world.yearLengthDays, DEFAULT_WORLD_TIME_CONFIG.yearLengthDays),
  );
}

function getConfiguredCurrentDay(world: WorldWithPlanet): number {
  return getTimeState(world).dayOfYear + 1;
}

function getAtlasTickForDay(world: WorldWithPlanet, selectedDay: number): bigint {
  const clampedDay = clamp(selectedDay, 1, getConfiguredYearLengthDays(world));
  const targetDayIndex = clampedDay - 1;
  const initialDay = integerOrDefault(world.initialDay, DEFAULT_WORLD_TIME_CONFIG.initialDay);
  const dayLengthSeconds = positiveOrDefault(
    world.dayLengthSeconds,
    DEFAULT_WORLD_TIME_CONFIG.dayLengthSeconds,
  );
  const tickDurationSeconds = positiveOrDefault(
    world.tickDurationSeconds,
    DEFAULT_WORLD_TIME_CONFIG.tickDurationSeconds,
  );
  const secondsOffset = (targetDayIndex - initialDay) * dayLengthSeconds;

  return BigInt(Math.round(secondsOffset / tickDurationSeconds));
}

function combineAtlasCells(
  climateCells: readonly ClimateGridCell[],
  terrainCells: readonly TerrainGridCell[],
  hydrologyCells: readonly HydrologyGridCell[],
  atmosphereCells: readonly AtmosphericGridCell[],
  weatherCells: readonly WeatherGridCell[],
  resourceCells: readonly PlanetResourceGridCell[],
  biomeCells: readonly BiomeGridCell[] = [],
  plantCells: readonly PlantGridCell[] = [],
  animalCells: readonly AnimalGridCell[] = [],
): AtlasCell[] {
  const terrainById = new Map(terrainCells.map((cell) => [cell.id, cell]));
  const hydrologyById = new Map(hydrologyCells.map((cell) => [cell.id, cell]));
  const atmosphereById = new Map(atmosphereCells.map((cell) => [cell.id, cell]));
  const weatherById = new Map(weatherCells.map((cell) => [cell.id, cell]));
  const resourcesById = new Map(resourceCells.map((cell) => [cell.id, cell]));
  const biomeById = new Map(biomeCells.map((cell) => [cell.id, cell]));
  const plantById = new Map(plantCells.map((cell) => [cell.id, cell]));
  const animalById = new Map(animalCells.map((cell) => [cell.id, cell]));

  return climateCells.flatMap((cell) => {
    const terrainCell = terrainById.get(cell.id);
    const hydrologyCell = hydrologyById.get(cell.id);
    const atmosphereCell = atmosphereById.get(cell.id);
    const weatherCell = weatherById.get(cell.id);
    const resourceCell = resourcesById.get(cell.id);
    const biomeCell = biomeById.get(cell.id);
    const plantCell = plantById.get(cell.id);
    const animalCell = animalById.get(cell.id);

    if (!terrainCell || !hydrologyCell || !atmosphereCell || !weatherCell || !resourceCell) {
      return [];
    }

    const biomeKey = plantCell?.biomeKey ?? biomeCell?.biomeKey ?? "unclassified";
    const biomeName = plantCell?.biomeName ?? biomeCell?.biomeName ?? "Unclassified";
    const biomeCategory = plantCell?.biomeCategory ?? biomeCell?.biomeCategory ?? "unclassified";
    const biomeColor = plantCell?.biomeColor ?? biomeCell?.biomeColor ?? "#4b5563";
    const biomeTags = plantCell?.biomeTags ?? biomeCell?.biomeTags ?? [];
    const habitabilityScore = plantCell?.habitabilityScore ?? biomeCell?.habitabilityScore ?? 0;
    const fertilityScore = plantCell?.fertilityScore ?? biomeCell?.fertilityScore ?? 0;
    const waterAvailabilityScore = plantCell?.waterAvailabilityScore ?? biomeCell?.waterAvailabilityScore ?? 0;
    const vegetationDensity = plantCell?.vegetationDensity ?? biomeCell?.vegetationDensity ?? 0;

    return [{
      ...cell,
      elevation: terrainCell.elevation,
      terrainType: terrainCell.terrainType,
      continentalness: terrainCell.continentalness,
      ruggedness: terrainCell.ruggedness,
      tectonicActivity: terrainCell.tectonicActivity,
      isCoast: terrainCell.isCoast,
      isOcean: hydrologyCell.isOcean,
      isSea: hydrologyCell.isSea,
      isLakeCandidate: hydrologyCell.isLakeCandidate,
      isRiverCandidate: hydrologyCell.isRiverCandidate,
      waterBodyType: hydrologyCell.waterBodyType,
      drainageDirection: hydrologyCell.drainageDirection,
      drainageTargetId: hydrologyCell.drainageTargetId,
      basinId: hydrologyCell.basinId,
      watershedId: hydrologyCell.watershedId,
      flowAccumulation: hydrologyCell.flowAccumulation,
      moisturePotential: hydrologyCell.moisturePotential,
      distanceToOcean: hydrologyCell.distanceToOcean,
      distanceToCoast: hydrologyCell.distanceToCoast,
      pressureZone: atmosphereCell.pressureZone,
      pressureValue: atmosphereCell.pressureValue,
      windDirection: atmosphereCell.windDirection,
      windStrength: atmosphereCell.windStrength,
      temperatureGradient: atmosphereCell.temperatureGradient,
      moistureTransportPotential: atmosphereCell.moistureTransportPotential,
      orographicLiftPotential: atmosphereCell.orographicLiftPotential,
      rainShadowPotential: atmosphereCell.rainShadowPotential,
      atmosphericStability: atmosphereCell.atmosphericStability,
      seasonalShift: atmosphereCell.seasonalShift,
      cloudCover: weatherCell.cloudCover,
      relativeHumidity: weatherCell.relativeHumidity,
      precipitationPotential: weatherCell.precipitationPotential,
      weatherType: weatherCell.weatherType,
      snowPotential: weatherCell.snowPotential,
      fogPotential: weatherCell.fogPotential,
      stormPotential: weatherCell.stormPotential,
      evaporationPotential: weatherCell.evaporationPotential,
      drynessIndex: weatherCell.drynessIndex,
      weatherStability: weatherCell.weatherStability,
      bedrockType: resourceCell.bedrockType,
      sedimentDepth: resourceCell.sedimentDepth,
      volcanicInfluence: resourceCell.volcanicInfluence,
      erosionPotential: resourceCell.erosionPotential,
      metals: resourceCell.metals,
      industrialMaterials: resourceCell.industrialMaterials,
      rareMaterials: resourceCell.rareMaterials,
      waterResources: resourceCell.waterResources,
      buildingResources: resourceCell.buildingResources,
      resourceRichness: resourceCell.resourceRichness,
      metalRichness: resourceCell.metalRichness,
      industrialRichness: resourceCell.industrialRichness,
      rareMaterialRichness: resourceCell.rareMaterialRichness,
      waterRichness: resourceCell.waterRichness,
      buildingMaterialAvailability: resourceCell.buildingMaterialAvailability,
      resourceDiversity: resourceCell.resourceDiversity,
      biomeKey,
      biomeName,
      biomeCategory,
      biomeColor,
      biomeTags: [...biomeTags],
      habitabilityScore,
      fertilityScore,
      waterAvailabilityScore,
      vegetationDensity,
      dominantPlantKey: plantCell?.dominantPlantKey ?? "none",
      dominantPlantName: plantCell?.dominantPlantName ?? "No Established Plant Life",
      dominantPlantCategory: plantCell?.dominantPlantCategory ?? "none",
      dominantPlantColor: plantCell?.dominantPlantColor ?? "#2f302c",
      plantSuitabilityScore: plantCell?.plantSuitabilityScore ?? 0,
      plantDensity: plantCell?.plantDensity ?? 0,
      biomassScore: plantCell?.biomassScore ?? 0,
      ediblePlantScore: plantCell?.ediblePlantScore ?? 0,
      woodMaterialScore: plantCell?.woodMaterialScore ?? 0,
      medicinalPotentialScore: plantCell?.medicinalPotentialScore ?? 0,
      biodiversityScore: plantCell?.biodiversityScore ?? 0,
      regrowthRate: plantCell?.regrowthRate ?? 0,
      seasonalStressScore: plantCell?.seasonalStressScore ?? 0,
      plantTags: [...(plantCell?.plantTags ?? [])],
      dominantAnimalGuildKey: animalCell?.dominantAnimalGuildKey ?? "none",
      dominantAnimalGuildName: animalCell?.dominantAnimalGuildName ?? "No Established Animal Guild",
      dominantAnimalGuildCategory: animalCell?.dominantAnimalGuildCategory ?? "specialist",
      dominantAnimalGuildColor: animalCell?.dominantAnimalGuildColor ?? "#2d3238",
      animalSuitabilityScore: animalCell?.animalSuitabilityScore ?? 0,
      herbivoreCapacity: animalCell?.herbivoreCapacity ?? 0,
      predatorCapacity: animalCell?.predatorCapacity ?? 0,
      preyAvailability: animalCell?.preyAvailability ?? 0,
      animalDensity: animalCell?.animalDensity ?? 0,
      migrationPressure: animalCell?.migrationPressure ?? 0,
      dangerScore: animalCell?.dangerScore ?? 0,
      huntingValue: animalCell?.huntingValue ?? 0,
      domesticationPotential: animalCell?.domesticationPotential ?? 0,
      animalBiodiversityScore: animalCell?.animalBiodiversityScore ?? 0,
      carryingCapacityScore: animalCell?.carryingCapacityScore ?? 0,
      animalTags: [...(animalCell?.animalTags ?? [])],
      dominantSpeciesId: animalCell?.dominantSpeciesId ?? "none",
      dominantSpeciesName: animalCell?.dominantSpeciesName ?? "No Established Wildlife",
      speciesCount: animalCell?.speciesCount ?? 0,
      totalWildlifePopulation: animalCell?.totalWildlifePopulation ?? 0,
      averagePopulationHealth: animalCell?.averagePopulationHealth ?? 0,
      averageHabitatSuitability: animalCell?.averageHabitatSuitability ?? 0,
      plantConsumptionRate: animalCell?.plantConsumptionRate ?? 0,
      effectivePlantBiomass: animalCell?.effectivePlantBiomass ?? 0,
      predationPressure: animalCell?.predationPressure ?? 0,
      predatorPreyBalance: animalCell?.predatorPreyBalance ?? 0,
      foodStability: animalCell?.foodStability ?? 0,
      carryingCapacityUsage: animalCell?.carryingCapacityUsage ?? 0,
      migrationActivity: animalCell?.migrationActivity ?? 0,
      populationGrowthRate: animalCell?.populationGrowthRate ?? 0,
      ecosystemHealthScore: animalCell?.ecosystemHealthScore ?? 0,
      ecosystemHealthStatus: animalCell?.ecosystemHealthStatus ?? "Collapsed",
      averageFitness: animalCell?.averageFitness ?? 0,
      adaptationDiversity: animalCell?.adaptationDiversity ?? 0,
      averageMigrationInstinct: animalCell?.averageMigrationInstinct ?? 0,
      averageDiseaseResistance: animalCell?.averageDiseaseResistance ?? 0,
      averageReproductiveEfficiency: animalCell?.averageReproductiveEfficiency ?? 0,
      averageClimateAdaptation: animalCell?.averageClimateAdaptation ?? 0,
      highestAdaptedPopulation: animalCell?.highestAdaptedPopulation ?? null,
      lowestFitnessPopulation: animalCell?.lowestFitnessPopulation ?? null,
      ecosystemEvents: [...(animalCell?.ecosystemEvents ?? [])],
      ecosystemHistory: [...(animalCell?.ecosystemHistory ?? [])],
      movementVectors: [...(animalCell?.movementVectors ?? [])],
      animalPopulations: [...(animalCell?.animalPopulations ?? [])],
    }];
  });
}

function buildAtlasStatistics(
  climate: ClimateState,
  terrainSummary: TerrainSummary,
  hydrologySummary: HydrologySummary,
  atmosphereSummary: AtmosphericSummary,
  weatherSummary: WeatherSummary,
  resourceSummary: PlanetResourceSummary,
): AtlasStatistics {
  return {
    averageTemperatureC: round(climate.summary.averageTemperatureC),
    averageSolarEnergy: round(climate.summary.averageSolarEnergy),
    averageDaylightHours: round(climate.summary.averageDaylightHours),
    averageHumidity: round(weatherSummary.averageHumidity),
    highestElevation: round(terrainSummary.highestElevation),
    oceanPercent: round(terrainSummary.oceanPercent),
    largestWatershedEstimate: hydrologySummary.largestWatershedEstimate,
    strongestWind: atmosphereSummary.strongestWinds[0] ?? null,
    dominantWeatherType: weatherSummary.dominantWeatherType,
    largestContinentEstimate: terrainSummary.largestContinentEstimate,
    largestOceanEstimate: terrainSummary.largestOceanEstimate,
    strongestMiningRegion: resourceSummary.strongestMiningRegion,
    richestAquifer: resourceSummary.largestAquifer,
    averageMineralRichness: round(resourceSummary.averageMineralRichness),
    resourceDiversity: round(resourceSummary.resourceDiversity),
  };
}

const EXPLAINED_HUMAN_EMOTIONS: AtlasHumanEmotionKey[] = ["fear", "distress", "relief", "curiosity", "trust", "attachment"];
const EMOTION_CHANGE_EPSILON = 0.005;

function emotionLabel(emotion: AtlasHumanEmotionKey): string {
  return `${emotion.charAt(0).toUpperCase()}${emotion.slice(1)}`;
}

function joinReasonPhrases(reasons: readonly string[]): string {
  if (reasons.length <= 1) {
    return reasons[0] ?? "no direct affect driver changed enough to move it";
  }

  if (reasons.length === 2) {
    return `${reasons[0]} and ${reasons[1]}`;
  }

  return `${reasons.slice(0, -1).join(", ")}, and ${reasons[reasons.length - 1]}`;
}

function addUniqueReason(reasons: string[], reason: string) {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function emotionDirection(emotion: AtlasHumanEmotionKey, before: number, after: number): AtlasHumanEmotionReason["direction"] {
  const delta = after - before;

  if (Math.abs(delta) >= EMOTION_CHANGE_EPSILON) {
    return delta > 0 ? "increased" : "decreased";
  }

  return emotion === "curiosity" && after >= 0.35 ? "viable" : "steady";
}

function hasHumanEvent(events: readonly HumanCausalEvent[], typePart: string): boolean {
  return events.some((event) => event.type.includes(typePart));
}

function linkedEventsForEmotion(
  emotion: AtlasHumanEmotionKey,
  events: readonly HumanCausalEvent[],
  normalizeHumanTextIds: (value: string) => string,
): AtlasHumanEmotionReason["causalEventLinks"] {
  const relevantEvents = events.filter((event) => {
    if (emotion === "fear") {
      return event.type.includes("Safety") || event.type.includes("Need");
    }

    if (emotion === "distress" || emotion === "relief") {
      return event.type.includes("Need") || event.type.includes("Safety");
    }

    if (emotion === "trust" || emotion === "attachment") {
      return event.type.includes("Communication") || event.type.includes("Teaching");
    }

    return event.type.includes("Safety");
  });

  return relevantEvents.slice(-3).map((event) => ({
    id: normalizeHumanTextIds(event.id),
    tick: event.tick,
    type: event.type,
    title: event.title,
    summary: normalizeHumanTextIds(event.summary),
  }));
}

function buildEmotionReasonPhrases(
  emotion: AtlasHumanEmotionKey,
  beforeAgent: HumanAgent,
  afterAgent: HumanAgent,
  dayEvents: readonly HumanCausalEvent[],
): string[] {
  const reasons: string[] = [];
  const needReduced = (key: keyof HumanNeeds) => beforeAgent.needs[key] > afterAgent.needs[key] + EMOTION_CHANGE_EPSILON;
  const needRose = (key: keyof HumanNeeds) => afterAgent.needs[key] > beforeAgent.needs[key] + EMOTION_CHANGE_EPSILON;
  const direction = emotionDirection(emotion, beforeAgent.emotions[emotion], afterAgent.emotions[emotion]);

  if (emotion === "fear") {
    if (direction === "increased") {
      if (hasHumanEvent(dayEvents, "Safety Check Failed")) addUniqueReason(reasons, "a safety check failed under a serious threat");
      if (needRose("safety") || afterAgent.needs.safety > 0.52) addUniqueReason(reasons, "safety pressure stayed high");
      if (afterAgent.needs.thirst > 0.64) addUniqueReason(reasons, "thirst kept danger salient");
      if (afterAgent.needs.hunger > 0.68) addUniqueReason(reasons, "hunger kept danger salient");
    } else if (direction === "decreased") {
      if (afterAgent.needs.safety < 0.42 || needReduced("safety")) addUniqueReason(reasons, "surroundings were safe");
      if (needReduced("hunger")) addUniqueReason(reasons, "hunger was reduced");
      if (needReduced("thirst")) addUniqueReason(reasons, "thirst was reduced");
      if (hasHumanEvent(dayEvents, "Safety Secured")) addUniqueReason(reasons, "safer ground was found");
    } else if (afterAgent.needs.safety < 0.42) {
      addUniqueReason(reasons, "no serious safety threat was present");
    }
  }

  if (emotion === "distress") {
    if (direction === "increased") {
      if (needRose("hunger") || afterAgent.needs.hunger > 0.68) addUniqueReason(reasons, "hunger pressure rose");
      if (needRose("thirst") || afterAgent.needs.thirst > 0.64) addUniqueReason(reasons, "thirst pressure rose");
      if (needRose("fatigue") || afterAgent.needs.fatigue > 0.78) addUniqueReason(reasons, "fatigue added strain");
      if (needRose("safety") || afterAgent.needs.safety > 0.68) addUniqueReason(reasons, "safety pressure added strain");
    } else if (direction === "decreased") {
      if (needReduced("hunger")) addUniqueReason(reasons, "hunger was reduced");
      if (needReduced("thirst")) addUniqueReason(reasons, "thirst was reduced");
      if (needReduced("fatigue")) addUniqueReason(reasons, "fatigue was reduced");
      if (afterAgent.emotions.relief > beforeAgent.emotions.relief) addUniqueReason(reasons, "relief rose after a successful action");
    } else if (afterAgent.needs.safety < 0.42) {
      addUniqueReason(reasons, "basic strain stayed manageable");
    }
  }

  if (emotion === "relief") {
    if (direction === "increased") {
      if (hasHumanEvent(dayEvents, "Need Fulfilled")) addUniqueReason(reasons, "food or water was successfully gathered");
      if (hasHumanEvent(dayEvents, "Safety Secured")) addUniqueReason(reasons, "safer ground was found");
      if (needReduced("fatigue")) addUniqueReason(reasons, "rest reduced fatigue");
    } else if (direction === "decreased") {
      addUniqueReason(reasons, "earlier relief faded without a new major success");
    } else {
      addUniqueReason(reasons, "no major relief-producing event changed it");
    }
  }

  if (emotion === "curiosity") {
    if (direction === "increased") {
      if (afterAgent.emotions.fear < 0.45 && afterAgent.emotions.distress < 0.65) addUniqueReason(reasons, "no serious threat was present");
      if (afterAgent.emotions.comfort >= beforeAgent.emotions.comfort) addUniqueReason(reasons, "comfort supported attention");
      addUniqueReason(reasons, "innate curiosity kept pulling attention outward");
    } else if (direction === "decreased") {
      if (afterAgent.emotions.fear > beforeAgent.emotions.fear) addUniqueReason(reasons, "fear narrowed attention");
      if (afterAgent.emotions.distress > beforeAgent.emotions.distress) addUniqueReason(reasons, "distress narrowed attention");
      if (afterAgent.needs.fatigue > beforeAgent.needs.fatigue) addUniqueReason(reasons, "fatigue reduced exploratory energy");
    } else if (direction === "viable") {
      addUniqueReason(reasons, "no serious threat was present");
    } else {
      addUniqueReason(reasons, "attention stayed constrained by current pressure");
    }
  }

  if (emotion === "trust") {
    if (direction === "increased") {
      if (hasHumanEvent(dayEvents, "Communication")) addUniqueReason(reasons, "companionship was communicated successfully");
      if (hasHumanEvent(dayEvents, "Teaching")) addUniqueReason(reasons, "teaching reinforced reliability");
    } else if (direction === "decreased") {
      addUniqueReason(reasons, "trust was reduced by the day outcome");
    } else {
      addUniqueReason(reasons, "no trust-changing interaction occurred");
    }
  }

  if (emotion === "attachment") {
    if (direction === "increased") {
      if (hasHumanEvent(dayEvents, "Communication")) addUniqueReason(reasons, "companionship was communicated successfully");
      addUniqueReason(reasons, "repeated proximity strengthened bonding");
    } else if (direction === "decreased") {
      addUniqueReason(reasons, "attachment weakened during the day");
    } else {
      addUniqueReason(reasons, "no attachment-changing interaction occurred");
    }
  }

  return reasons.length > 0 ? reasons : ["the background affect update kept it near its prior level"];
}

function buildHumanEmotionReasons(
  beforeAgent: HumanAgent,
  afterAgent: HumanAgent,
  dayEvents: readonly HumanCausalEvent[],
  normalizeHumanTextIds: (value: string) => string,
): AtlasHumanEmotionReason[] {
  return EXPLAINED_HUMAN_EMOTIONS.map((emotion) => {
    const before = round(beforeAgent.emotions[emotion]);
    const after = round(afterAgent.emotions[emotion]);
    const delta = round(after - before);
    const direction = emotionDirection(emotion, before, after);
    const reasons = buildEmotionReasonPhrases(emotion, beforeAgent, afterAgent, dayEvents);
    const directionText = direction === "viable" ? "stayed viable" : direction === "steady" ? "remained steady" : direction;

    return {
      emotion,
      before,
      after,
      delta,
      direction,
      summary: `${emotionLabel(emotion)} ${directionText} because ${joinReasonPhrases(reasons)}.`,
      reasons,
      causalEventLinks: linkedEventsForEmotion(emotion, dayEvents, normalizeHumanTextIds),
    };
  });
}

function latestEmotionChangeSummary(reasons: readonly AtlasHumanEmotionReason[]): string {
  const [latestChange] = [...reasons].sort((left, right) => {
    const rightChanged = Math.abs(right.delta) >= EMOTION_CHANGE_EPSILON ? 1 : 0;
    const leftChanged = Math.abs(left.delta) >= EMOTION_CHANGE_EPSILON ? 1 : 0;

    return rightChanged - leftChanged || Math.abs(right.delta) - Math.abs(left.delta);
  });

  return latestChange?.summary ?? "No tracked emotion changed during the latest day.";
}

function buildAtlasHumans(world: WorldWithPlanet, selectedDay: number): AtlasHumanMva {
  const dayEndTick = BigInt(Math.max(1, selectedDay) * HUMAN_MVA_DAY_TICKS);
  const dayStartTick = BigInt(Math.max(0, selectedDay - 1) * HUMAN_MVA_DAY_TICKS);
  const result = getHumanMvaStateAtTick(world, dayEndTick);
  const dayStartResult = getHumanMvaStateAtTick(world, dayStartTick);
  const dayStartAgentById = new Map(dayStartResult.state.agents.map((agent) => [agent.id, agent]));
  const displayIdBySourceId = new Map(result.state.agents.map((agent) => [agent.id, `first-human-${agent.sex}`]));
  const displayId = (sourceId: string) => displayIdBySourceId.get(sourceId) ?? sourceId.replace(`${world.id}:`, "");
  const normalizeHumanTextIds = (value: string) => result.state.agents.reduce(
    (text, agent) => text.split(agent.id).join(displayId(agent.id)),
    value,
  ).replaceAll(`${world.id}:`, "").replaceAll(world.id, "atlas-world");
  const latestDayEvents = result.state.causalEvents.filter((event) => {
    const eventTick = BigInt(event.tick);

    return eventTick > dayStartTick && eventTick <= dayEndTick;
  });

  return {
    tick: result.state.tick,
    agents: result.state.agents.map((agent) => {
      const otherAgent = result.state.agents.find((candidate) => candidate.id !== agent.id) ?? null;
      const relationshipToOther = otherAgent
        ? result.state.relationships.find((relationship) =>
          relationship.fromAgentId === agent.id && relationship.toAgentId === otherAgent.id,
        ) ?? null
        : null;
      const latestMemory = [...result.state.memories]
        .reverse()
        .find((memory) => memory.agentId === agent.id) ?? null;
      const latestCausalEvent = [...result.state.causalEvents]
        .reverse()
        .find((event) => event.agentIds.includes(agent.id)) ?? null;
      const agentDayEvents = latestDayEvents.filter((event) => event.agentIds.includes(agent.id));
      const emotionReasons = buildHumanEmotionReasons(
        dayStartAgentById.get(agent.id) ?? agent,
        agent,
        agentDayEvents,
        normalizeHumanTextIds,
      );

      return {
        id: displayId(agent.id),
        label: agent.sex === "male" ? "First Male Human" : "First Female Human",
        sex: agent.sex,
        approxAgeYears: agent.approxAgeYears,
        currentCellId: agent.currentCellId,
        currentAction: agent.lastDecision?.action ?? null,
        needs: agent.needs,
        emotions: agent.emotions,
        currentMotivation: agent.motivations ? (Object.entries(agent.motivations).sort((a,b)=> b[1]-a[1])[0]?.[0] ?? null) : null,
        motivationScores: agent.motivations ?? undefined,
        confidence: (agent as any).confidence ?? undefined,
        familiarity: (agent as any).familiarityByCell?.[agent.currentCellId] ?? undefined,
        curiosityProfile: (agent as any).curiosityProfile ?? undefined,
        relationshipDrivers: relationshipToOther ? {
          trust: relationshipToOther.trust,
          affection: relationshipToOther.affection,
          attraction: relationshipToOther.attraction,
          companionship: relationshipToOther.companionship,
        } : null,
        decisionExplanation: (() => {
          const causes = agent.lastDecision?.causes ?? {} as Record<string, unknown>;
          const parts: string[] = [];
          if ((agent.needs.hunger) < 0.45 && (agent.needs.thirst) < 0.45 && (agent.needs.fatigue) < 0.5) {
            parts.push("Hunger and thirst were satisfied.");
          }
          const topMotivation = (causes as any).topMotivation as string | undefined;
          if (topMotivation) {
            parts.push(`Current motivation shifted to ${topMotivation}.`);
          }
          if ((agent as any).curiosityProfile) {
            const cp = (agent as any).curiosityProfile;
            if (cp.environmental >= (cp.social ?? 0)) {
              parts.push("Environmental curiosity exceeded social motivation.");
            }
          }
          if (agent.lastDecision?.action) {
            const label = agent.lastDecision.action === "explore" ? "Explore Nearby" : agent.lastDecision.action;
            parts.push(`Selected ${label}.`);
          }
          return parts.length ? parts.join(" ") : null;
        })(),
        currentGoal: (agent as any).currentGoal?.text ?? null,
        relationshipToOther: relationshipToOther ? {
          ...relationshipToOther,
          worldId: "atlas-human-mva",
          fromAgentId: displayId(relationshipToOther.fromAgentId),
          toAgentId: displayId(relationshipToOther.toAgentId),
        } : null,
        latestMemory: latestMemory
          ? {
            tick: latestMemory.tick,
            eventType: latestMemory.eventType,
            summary: normalizeHumanTextIds(latestMemory.summary),
          }
          : null,
        latestCausalEvent: latestCausalEvent
          ? {
            tick: latestCausalEvent.tick,
            type: latestCausalEvent.type,
            title: latestCausalEvent.title,
            summary: normalizeHumanTextIds(latestCausalEvent.summary),
          }
          : null,
        latestEmotionChangeSummary: latestEmotionChangeSummary(emotionReasons),
        emotionReasons,
      };
    }),
    causalEvents: result.state.causalEvents.slice(-8).map((event) => ({
      id: normalizeHumanTextIds(event.id),
      tick: event.tick,
      type: event.type,
      title: event.title,
      summary: normalizeHumanTextIds(event.summary),
      agentIds: event.agentIds.map(displayId),
      cellId: event.cellId,
    })),
    chroniclerEntries: result.chroniclerReport.entries.slice(-8).map((entry) => ({
      ...entry,
      eventId: normalizeHumanTextIds(entry.eventId),
    })),
    canSimulateOneHumanDay: true,
    forbiddenSystemsImplemented: [],
  };
}
export function toAtlasWorldOption(world: WorldWithPlanet): AtlasWorldOption {
  return {
    id: world.id,
    slug: world.slug,
    name: world.name,
    environment: world.environment,
    status: world.status,
    yearLengthDays: getConfiguredYearLengthDays(world),
    currentDay: getConfiguredCurrentDay(world),
    hasSeed: Boolean(world.seed?.trim()),
  };
}

export function normalizeAtlasSelectedDay(world: WorldWithPlanet, requestedDay?: number | null): number {
  const yearLengthDays = getConfiguredYearLengthDays(world);

  if (!requestedDay || !Number.isFinite(requestedDay)) {
    return clamp(getConfiguredCurrentDay(world), 1, yearLengthDays);
  }

  return clamp(Math.round(requestedDay), 1, yearLengthDays);
}

function buildAtlasSnapshotUncached(
  world: WorldWithPlanet,
  selectedDay = getConfiguredCurrentDay(world),
  grid: SpatialGrid = createGrid(),
): AtlasSnapshot {
  const normalizedDay = normalizeAtlasSelectedDay(world, selectedDay);
  const tick = getAtlasTickForDay(world, normalizedDay);
  const gridSummary = getGridSummary(grid);
  const time = getTimeStateAtTick(world, tick);
  const astronomy = getAstronomyStateAtTick(world, tick);
  const planet = getPlanetState(world);
  const climate = getClimateStateAtTick(world, tick);
  const climateCells = getClimateGridAtTick(world, tick, grid);
  const terrainState = getTerrainState(world, grid);
  const hydrologyState = getHydrologyState(world, grid);
  const atmosphereState = getAtmosphereStateAtTick(world, tick, grid);
  const weatherState = getWeatherStateAtTick(world, tick, grid);
  const resourceState = getPlanetResourcesStateAtTick(world, tick, grid);
  const biomeState = world.seed?.trim() ? getBiomeStateAtTick(world, tick, grid) : null;
  const plantState = world.seed?.trim() ? getPlantEcologyStateAtTick(world, tick, grid) : null;
  const animalState = world.seed?.trim() ? getAnimalEcologyStateAtTick(world, tick, grid) : null;
  const fingerprint = buildWorldFingerprint(world, grid);
  const environmentVerification = verifyWorldAgainstCanonical(world, grid);

  return {
    worldId: world.id,
    worldSlug: world.slug,
    worldName: world.name,
    selectedDay: normalizedDay,
    tick: tick.toString(),
    yearLengthDays: getConfiguredYearLengthDays(world),
    grid: {
      ...gridSummary,
      cellWidthDegrees: round(360 / gridSummary.longitudeDivisions),
      cellHeightDegrees: round(180 / gridSummary.latitudeDivisions),
    },
    time,
    astronomy,
    planet,
    climate,
    terrainSummary: terrainState.summary,
    hydrologySummary: hydrologyState.summary,
    atmosphereSummary: atmosphereState.summary,
    weatherSummary: weatherState.summary,
    resourceSummary: resourceState.summary,
    statistics: buildAtlasStatistics(
      climate,
      terrainState.summary,
      hydrologyState.summary,
      atmosphereState.summary,
      weatherState.summary,
      resourceState.summary,
    ),
    humans: buildAtlasHumans(world, normalizedDay),
    fingerprint: {
      seed: fingerprint.seed,
      hash: fingerprint.hash,
      shortHash: fingerprint.shortHash,
      canonical: fingerprint.canonical,
    },
    integrity: {
      canonical: fingerprint.canonical,
      environmentMatch: environmentVerification.matches,
      terrainValidated: terrainState.validation.valid,
      climateValidated: climate.summary.climateBandsPresent.length > 0,
      hydrologyValidated: hydrologyState.summary.cellCount === terrainState.summary.cellCount,
      atmosphereValidated: atmosphereState.summary.cellCount === terrainState.summary.cellCount,
      weatherValidated: weatherState.summary.cellCount === terrainState.summary.cellCount,
    },
    cells: combineAtlasCells(
      climateCells,
      terrainState.cells,
      hydrologyState.cells,
      atmosphereState.cells,
      weatherState.cells,
      resourceState.cells,
      biomeState?.cells ?? [],
      plantState?.cells ?? [],
      animalState?.cells ?? [],
    ),
  };
}

export function buildAtlasSnapshot(
  world: WorldWithPlanet,
  selectedDay = getConfiguredCurrentDay(world),
  grid: SpatialGrid = createGrid(),
): AtlasSnapshot {
  return buildTimedAtlasSnapshot(world, selectedDay, grid).value;
}

export function buildTimedAtlasSnapshot(
  world: WorldWithPlanet,
  selectedDay = getConfiguredCurrentDay(world),
  grid: SpatialGrid = createGrid(),
): TimedSnapshotValue<AtlasSnapshot> {
  const normalizedDay = normalizeAtlasSelectedDay(world, selectedDay);
  const key = getSnapshotWorldKey(world, grid, `atlas:${normalizedDay}`);
  return memoizeSnapshotValue(
    "atlas:snapshot",
    key,
    () => buildAtlasSnapshotUncached(world, normalizedDay, grid),
    grid.getGridSummary().totalCells,
  );
}