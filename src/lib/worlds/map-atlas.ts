import type { AnimalGridCell } from "../simulation/animal-engine";
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
  animalPopulations: AnimalGridCell["animalPopulations"];
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

export function buildAtlasSnapshot(
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

