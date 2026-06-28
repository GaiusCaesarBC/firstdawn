import { Prisma, type World } from "@prisma/client";

import { getAtmosphereStateAtTick, type AtmosphericGridCell } from "./atmosphere-engine";
import { getClimateGridAtTick, type ClimateGridCell } from "./climate-engine";
import { getCachedDeterministic } from "./deterministic-cache";
import type { GridCell } from "./grid/cell";
import { createGrid, type SpatialGrid } from "./grid/grid";
import { getHydrologyState, type HydrologyGridCell } from "./hydrology-engine";
import { getPlanetResourcesStateAtTick, type PlanetResourceGridCell } from "./resources-engine";
import { getTerrainState, type TerrainGridCell, type TerrainType } from "./terrain-engine";
import { getWeatherStateAtTick, type WeatherGridCell } from "./weather-engine";
import {
  BIOME_DEFINITIONS,
  BIOME_KEYS,
  getBiomeDefinition,
  type BiomeCategory,
  type BiomeDefinition,
  type BiomeKey,
} from "./biome-definitions";

export type BiomeGridCell = GridCell & {
  readonly biomeKey: BiomeKey;
  readonly biomeName: string;
  readonly biomeCategory: BiomeCategory;
  readonly biomeColor: string;
  readonly biomeTags: readonly string[];
  readonly habitabilityScore: number;
  readonly fertilityScore: number;
  readonly waterAvailabilityScore: number;
  readonly vegetationDensity: number;
  readonly adjustedTemperatureC: number;
  readonly precipitationScore: number;
  readonly humidityScore: number;
  readonly soilMoistureScore: number;
  readonly seasonalityScore: number;
  readonly elevation: number;
  readonly terrainType: TerrainType;
  readonly waterBodyType: HydrologyGridCell["waterBodyType"];
  readonly distanceToOcean: number;
  readonly distanceToCoast: number;
  readonly transitionScore: number;
};

export type BiomeDistribution = Record<BiomeKey, number>;

export type BiomeRegion = {
  readonly cellId: string;
  readonly biomeKey: BiomeKey;
  readonly biomeName: string;
  readonly cellCount: number;
  readonly averageScore: number;
  readonly peakScore: number;
  readonly midpointLatitude: number;
  readonly midpointLongitude: number;
};

export type CivilizationStartingZoneCandidate = BiomeRegion & {
  readonly waterAccessScore: number;
  readonly climateComfortScore: number;
  readonly terrainEaseScore: number;
};

export type BiomeSummary = {
  readonly cellCount: number;
  readonly biomeDistribution: BiomeDistribution;
  readonly biomePercentCoverage: Record<BiomeKey, number>;
  readonly landBiomeCoverage: Record<BiomeKey, number>;
  readonly oceanCoveragePercent: number;
  readonly mostHabitableRegions: readonly BiomeRegion[];
  readonly mostFertileRegions: readonly BiomeRegion[];
  readonly harshestRegions: readonly BiomeRegion[];
  readonly biodiversityPotentialScore: number;
  readonly civilizationStartingZoneCandidates: readonly CivilizationStartingZoneCandidate[];
};

export type BiomeState = {
  readonly seed: string;
  readonly tick: string;
  readonly cells: readonly BiomeGridCell[];
  readonly summary: BiomeSummary;
};

export type PersistBiomesResult = {
  readonly planetId: string;
  readonly generatedCells: number;
  readonly createdCells: number;
  readonly updatedCells: number;
  readonly unchangedCells: number;
  readonly summary: BiomeSummary;
};

type TickInput = bigint | number | string;

type BiomeWorldSource = Pick<
  World,
  | "id"
  | "seed"
  | "currentTick"
  | "tickDurationSeconds"
  | "dayLengthSeconds"
  | "yearLengthDays"
  | "axialTiltDegrees"
  | "orbitalEccentricity"
  | "initialEpochName"
  | "initialYear"
  | "initialDay"
  | "initialHour"
> & {
  planet?: {
    id?: string | null;
    oceanCoveragePercent?: number | null;
    atmospherePressureKPa?: number | null;
  } | null;
};

type BiomeInputs = {
  readonly cell: GridCell;
  readonly terrain: TerrainGridCell;
  readonly hydrology: HydrologyGridCell;
  readonly climate: ClimateGridCell;
  readonly atmosphere: AtmosphericGridCell;
  readonly weather: WeatherGridCell;
  readonly resources: PlanetResourceGridCell;
  readonly adjustedTemperatureC: number;
  readonly precipitationScore: number;
  readonly humidityScore: number;
  readonly soilMoistureScore: number;
  readonly seasonalityScore: number;
  readonly transitionScore: number;
};

type DraftBiomeCell = BiomeInputs & {
  biomeKey: BiomeKey;
};

type BiomePersistenceClient = Pick<Prisma.TransactionClient, "planet" | "planetCell">;

const UINT32_RANGE = 4_294_967_296;
const OCEAN_TERRAIN_TYPES = new Set<TerrainType>(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);
const MOUNTAIN_TERRAIN_TYPES = new Set<TerrainType>(["MOUNTAINS", "HIGH_MOUNTAINS", "PLATEAU"]);
const DRY_BIOMES = new Set<BiomeKey>(["desert", "badlands-rocky", "mediterranean-shrubland"]);
const FOREST_BIOMES = new Set<BiomeKey>([
  "boreal-forest",
  "temperate-forest",
  "tropical-seasonal-forest",
  "tropical-rainforest",
]);
const PRIORITY_LOCKED_BIOMES = new Set<BiomeKey>([
  "ocean",
  "coast",
  "lake",
  "river-wetland",
  "ice-sheet",
  "alpine-mountain",
  "volcanic-barren",
]);

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function hashStringToUint32(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function hashUnit(seed: string, key: string): number {
  return hashStringToUint32(`${seed}:biome:${key}`) / UINT32_RANGE;
}

function requireBiomeSeed(world: BiomeWorldSource): string {
  const seed = world.seed?.trim();

  if (!seed) {
    throw new Error("Biome generation requires a world seed.");
  }

  return seed;
}

function normalizeTick(tick: TickInput): bigint {
  return BigInt(tick);
}

function isMarine(terrain: TerrainGridCell, hydrology: HydrologyGridCell): boolean {
  return OCEAN_TERRAIN_TYPES.has(terrain.terrainType) || hydrology.isOcean || hydrology.isSea;
}

function getAdjustedTemperature(climate: ClimateGridCell, terrain: TerrainGridCell): number {
  const elevationCooling = clamp(terrain.elevation - 0.42) * 24;
  return round(climate.averageTemperatureC - elevationCooling, 3);
}

function getPrecipitationScore(
  hydrology: HydrologyGridCell,
  atmosphere: AtmosphericGridCell,
  weather: WeatherGridCell,
): number {
  return round(clamp(
    weather.precipitationPotential * 0.36
      + weather.relativeHumidity * 0.22
      + hydrology.moisturePotential * 0.2
      + atmosphere.moistureTransportPotential * 0.14
      + weather.cloudCover * 0.1
      + atmosphere.orographicLiftPotential * 0.08
      - weather.drynessIndex * 0.16
      - atmosphere.rainShadowPotential * 0.12,
  ));
}

function getSoilMoistureScore(
  hydrology: HydrologyGridCell,
  weather: WeatherGridCell,
  resources: PlanetResourceGridCell,
  precipitationScore: number,
): number {
  const riverBonus = hydrology.isRiverCandidate ? 0.16 : 0;
  const lakeBonus = hydrology.isLakeCandidate ? 0.18 : 0;

  return round(clamp(
    hydrology.moisturePotential * 0.34
      + precipitationScore * 0.28
      + resources.waterResources.freshwaterAvailability * 0.2
      + resources.waterResources.groundwaterPotential * 0.12
      + riverBonus
      + lakeBonus
      - weather.drynessIndex * 0.18,
  ));
}

function getSeasonalityScore(climate: ClimateGridCell, weather: WeatherGridCell, atmosphere: AtmosphericGridCell): number {
  return round(clamp(
    Math.abs(climate.seasonalModifier) * 0.36
      + weather.drynessIndex * 0.3
      + weather.evaporationPotential * 0.18
      + (1 - atmosphere.atmosphericStability) * 0.1
      + Math.abs(atmosphere.seasonalShift) / 90 * 0.06,
  ));
}

function hasPermanentIce(inputs: BiomeInputs): boolean {
  const absoluteLatitude = Math.abs(inputs.cell.midpointLatitude);

  return inputs.adjustedTemperatureC <= -10
    || (absoluteLatitude >= 66 && inputs.weather.snowPotential >= 0.48 && inputs.adjustedTemperatureC <= -4)
    || (inputs.weather.snowPotential >= 0.72 && inputs.adjustedTemperatureC <= -2 && inputs.terrain.elevation >= 0.68);
}

function classifyBaseBiome(inputs: BiomeInputs): BiomeKey {
  const { cell, terrain, hydrology, weather, resources } = inputs;
  const temperature = inputs.adjustedTemperatureC;
  const precipitation = inputs.precipitationScore;
  const moisture = inputs.soilMoistureScore;
  const humidity = inputs.humidityScore;
  const dryness = weather.drynessIndex;
  const latitude = Math.abs(cell.midpointLatitude);
  const tropical = temperature >= 22 || latitude < 22;
  const temperate = temperature >= 5 && temperature < 22;

  if (hydrology.isOcean || terrain.terrainType === "DEEP_OCEAN" || terrain.terrainType === "OCEAN") {
    return "ocean";
  }

  if (hydrology.isSea || terrain.terrainType === "SHALLOW_SEA" || terrain.terrainType === "BEACH" || terrain.isCoast) {
    return "coast";
  }

  if (hydrology.isLakeCandidate || hydrology.waterBodyType === "LAKE_CANDIDATE") {
    return "lake";
  }

  const riverCorridor = hydrology.waterBodyType === "RIVER_CHANNEL_CANDIDATE"
    || (hydrology.isRiverCandidate && hydrology.flowAccumulation >= 6 && terrain.elevation <= 0.72);

  if (riverCorridor) {
    if (temperature >= 6 && moisture >= 0.72 && precipitation >= 0.56 && terrain.elevation <= 0.58) {
      return "swamp-marsh";
    }

    return "river-wetland";
  }

  if (hasPermanentIce(inputs)) {
    return "ice-sheet";
  }

  if (terrain.elevation >= 0.86 || (terrain.terrainType === "HIGH_MOUNTAINS" && temperature <= 12)) {
    return "alpine-mountain";
  }

  if (resources.volcanicInfluence >= 0.72 && (terrain.ruggedness >= 0.42 || terrain.tectonicActivity >= 0.72)) {
    return "volcanic-barren";
  }

  if (dryness >= 0.72 || precipitation <= 0.14 || moisture <= 0.12) {
    if (terrain.ruggedness >= 0.46 || resources.erosionPotential >= 0.48 || terrain.terrainType === "PLATEAU") {
      return "badlands-rocky";
    }

    return "desert";
  }

  if (dryness >= 0.58 && precipitation <= 0.28) {
    return temperature >= 20 ? "savanna" : "mediterranean-shrubland";
  }

  if (terrain.elevation >= 0.76 || MOUNTAIN_TERRAIN_TYPES.has(terrain.terrainType) && terrain.ruggedness >= 0.68) {
    return temperature <= 14 ? "alpine-mountain" : "badlands-rocky";
  }

  if (temperature <= -4) {
    return moisture >= 0.46 && precipitation >= 0.26 ? "boreal-forest" : "tundra";
  }

  if (temperature <= 5) {
    return moisture >= 0.44 && humidity >= 0.38 ? "boreal-forest" : "tundra";
  }

  if (tropical) {
    if (moisture >= 0.72 && precipitation >= 0.68 && humidity >= 0.62 && inputs.seasonalityScore <= 0.55) {
      return "tropical-rainforest";
    }

    if (moisture >= 0.52 && precipitation >= 0.46) {
      return "tropical-seasonal-forest";
    }

    if (moisture >= 0.22 && precipitation >= 0.22) {
      return "savanna";
    }

    return "desert";
  }

  if (temperate) {
    if (moisture >= 0.72 && precipitation >= 0.62 && terrain.elevation <= 0.58) {
      return "swamp-marsh";
    }

    if (moisture >= 0.5 && precipitation >= 0.42) {
      return "temperate-forest";
    }

    if (moisture >= 0.24 && precipitation >= 0.2) {
      return inputs.seasonalityScore >= 0.58 && temperature >= 12
        ? "mediterranean-shrubland"
        : "temperate-grassland";
    }

    return terrain.ruggedness >= 0.42 ? "badlands-rocky" : "desert";
  }

  if (moisture >= 0.48 && precipitation >= 0.36) {
    return "boreal-forest";
  }

  return "tundra";
}

function getNeighborBiomeCounts(
  cell: DraftBiomeCell,
  byId: Map<string, DraftBiomeCell>,
  grid: SpatialGrid,
): Map<BiomeKey, number> {
  const counts = new Map<BiomeKey, number>();

  for (const neighbor of grid.getNeighbors(cell.cell.id)) {
    const neighborCell = byId.get(neighbor.id);

    if (!neighborCell) {
      continue;
    }

    counts.set(neighborCell.biomeKey, (counts.get(neighborCell.biomeKey) ?? 0) + 1);
  }

  return counts;
}

function neighborCount(counts: Map<BiomeKey, number>, keys: Iterable<BiomeKey>): number {
  let count = 0;

  for (const key of keys) {
    count += counts.get(key) ?? 0;
  }

  return count;
}

function transitionBiome(cell: DraftBiomeCell, byId: Map<string, DraftBiomeCell>, grid: SpatialGrid, seed: string): BiomeKey {
  if (PRIORITY_LOCKED_BIOMES.has(cell.biomeKey)) {
    return cell.biomeKey;
  }

  const counts = getNeighborBiomeCounts(cell, byId, grid);
  const edgeNoise = hashUnit(seed, `${cell.cell.id}:transition`);
  const forestNeighbors = neighborCount(counts, FOREST_BIOMES);
  const grassNeighbors = neighborCount(counts, ["temperate-grassland", "savanna"]);
  const dryNeighbors = neighborCount(counts, ["desert", "badlands-rocky", "mediterranean-shrubland"]);
  const tundraNeighbors = neighborCount(counts, ["tundra", "ice-sheet"]);
  const wetlandNeighbors = neighborCount(counts, ["swamp-marsh", "river-wetland", "lake"]);

  if (
    (cell.biomeKey === "desert" || cell.biomeKey === "temperate-grassland")
    && cell.soilMoistureScore >= 0.18
    && cell.soilMoistureScore <= 0.38
    && dryNeighbors + grassNeighbors >= 2
    && edgeNoise >= 0.28
  ) {
    return "mediterranean-shrubland";
  }

  if (
    cell.biomeKey === "temperate-grassland"
    && cell.soilMoistureScore >= 0.46
    && cell.precipitationScore >= 0.36
    && forestNeighbors >= 2
    && edgeNoise >= 0.22
  ) {
    return "temperate-forest";
  }

  if (
    cell.biomeKey === "temperate-forest"
    && cell.adjustedTemperatureC <= 8
    && tundraNeighbors >= 1
  ) {
    return "boreal-forest";
  }

  if (
    cell.biomeKey === "boreal-forest"
    && cell.adjustedTemperatureC <= 1
    && cell.soilMoistureScore <= 0.46
    && tundraNeighbors >= 2
  ) {
    return "tundra";
  }

  if (
    cell.biomeKey === "tropical-seasonal-forest"
    && cell.precipitationScore >= 0.66
    && cell.seasonalityScore <= 0.48
    && (counts.get("tropical-rainforest") ?? 0) >= 1
    && edgeNoise >= 0.16
  ) {
    return "tropical-rainforest";
  }

  if (
    cell.biomeKey === "tropical-rainforest"
    && (cell.seasonalityScore >= 0.58 || cell.weather.drynessIndex >= 0.38)
    && (counts.get("tropical-seasonal-forest") ?? 0) >= 1
  ) {
    return "tropical-seasonal-forest";
  }

  if (
    cell.biomeKey === "temperate-grassland"
    && wetlandNeighbors >= 1
    && cell.soilMoistureScore >= 0.62
    && cell.terrain.elevation <= 0.58
  ) {
    return "swamp-marsh";
  }

  return cell.biomeKey;
}

function toBiomeGridCell(draft: DraftBiomeCell, biomeKey: BiomeKey): BiomeGridCell {
  const definition = getBiomeDefinition(biomeKey);

  return Object.freeze({
    ...draft.cell,
    biomeKey,
    biomeName: definition.displayName,
    biomeCategory: definition.category,
    biomeColor: definition.color,
    biomeTags: definition.tags,
    habitabilityScore: definition.habitabilityScore,
    fertilityScore: definition.fertilityScore,
    waterAvailabilityScore: definition.waterAvailabilityScore,
    vegetationDensity: definition.vegetationDensity,
    adjustedTemperatureC: draft.adjustedTemperatureC,
    precipitationScore: draft.precipitationScore,
    humidityScore: draft.humidityScore,
    soilMoistureScore: draft.soilMoistureScore,
    seasonalityScore: draft.seasonalityScore,
    elevation: draft.terrain.elevation,
    terrainType: draft.terrain.terrainType,
    waterBodyType: draft.hydrology.waterBodyType,
    distanceToOcean: draft.hydrology.distanceToOcean,
    distanceToCoast: draft.hydrology.distanceToCoast,
    transitionScore: draft.transitionScore,
  });
}

function buildBiomeDistribution(): BiomeDistribution {
  return Object.fromEntries(BIOME_KEYS.map((key) => [key, 0])) as BiomeDistribution;
}

function makeBiomeRegion(
  component: readonly BiomeGridCell[],
  score: (cell: BiomeGridCell) => number,
): BiomeRegion {
  const sorted = [...component].sort((left, right) => score(right) - score(left) || left.id.localeCompare(right.id));
  const peak = sorted[0];

  return Object.freeze({
    cellId: peak.id,
    biomeKey: peak.biomeKey,
    biomeName: peak.biomeName,
    cellCount: component.length,
    averageScore: round(average(component.map(score))),
    peakScore: round(score(peak)),
    midpointLatitude: round(average(component.map((cell) => cell.midpointLatitude)), 3),
    midpointLongitude: round(average(component.map((cell) => cell.midpointLongitude)), 3),
  });
}

function findBiomeRegions(
  cells: readonly BiomeGridCell[],
  grid: SpatialGrid,
  score: (cell: BiomeGridCell) => number,
  threshold: number,
  predicate: (cell: BiomeGridCell) => boolean = () => true,
): BiomeRegion[] {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const eligible = new Set(cells.filter((cell) => predicate(cell) && score(cell) >= threshold).map((cell) => cell.id));
  const visited = new Set<string>();
  const regions: BiomeRegion[] = [];

  for (const cell of cells) {
    if (!eligible.has(cell.id) || visited.has(cell.id)) {
      continue;
    }

    const queue = [cell.id];
    const component: BiomeGridCell[] = [];
    visited.add(cell.id);

    for (let index = 0; index < queue.length; index += 1) {
      const current = byId.get(queue[index]);

      if (!current) {
        continue;
      }

      component.push(current);

      for (const neighbor of grid.getNeighbors(current.id)) {
        if (!eligible.has(neighbor.id) || visited.has(neighbor.id)) {
          continue;
        }

        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }

    regions.push(makeBiomeRegion(component, score));
  }

  return regions.sort((left, right) =>
    right.peakScore - left.peakScore
      || right.averageScore - left.averageScore
      || right.cellCount - left.cellCount
      || left.cellId.localeCompare(right.cellId),
  );
}

function isLandBiome(cell: BiomeGridCell): boolean {
  return cell.biomeKey !== "ocean" && cell.biomeKey !== "coast" && cell.biomeKey !== "lake";
}


function cellHarshnessScore(cell: BiomeGridCell): number {
  return round(clamp(
    (1 - cell.habitabilityScore) * 0.42
      + (1 - cell.fertilityScore) * 0.18
      + (1 - cell.waterAvailabilityScore) * 0.16
      + Math.abs(cell.adjustedTemperatureC - 16) / 48 * 0.14
      + (DRY_BIOMES.has(cell.biomeKey) ? 0.1 : 0),
  ));
}

function biodiversityScore(cell: BiomeGridCell): number {
  return round(clamp(
    cell.vegetationDensity * 0.38
      + cell.waterAvailabilityScore * 0.24
      + cell.fertilityScore * 0.22
      + (1 - Math.abs(cell.adjustedTemperatureC - 24) / 42) * 0.16,
  ));
}

function startingZoneScore(cell: BiomeGridCell): number {
  if (!isLandBiome(cell)) {
    return 0;
  }

  if (["ice-sheet", "volcanic-barren", "badlands-rocky", "desert", "alpine-mountain"].includes(cell.biomeKey)) {
    return 0;
  }

  const waterAccess = Math.max(cell.waterAvailabilityScore, Math.exp(-cell.distanceToCoast / 4));
  const climateComfort = clamp(1 - Math.abs(cell.adjustedTemperatureC - 16) / 26);
  const terrainEase = clamp(1 - Math.max(0, cell.elevation - 0.52) * 2.2);

  return round(clamp(
    cell.habitabilityScore * 0.34
      + cell.fertilityScore * 0.24
      + waterAccess * 0.2
      + climateComfort * 0.14
      + terrainEase * 0.08,
  ));
}

function toStartingCandidate(region: BiomeRegion, byId: Map<string, BiomeGridCell>): CivilizationStartingZoneCandidate {
  const peak = byId.get(region.cellId);
  const waterAccessScore = peak ? round(Math.max(peak.waterAvailabilityScore, Math.exp(-peak.distanceToCoast / 4))) : 0;
  const climateComfortScore = peak ? round(clamp(1 - Math.abs(peak.adjustedTemperatureC - 16) / 26)) : 0;
  const terrainEaseScore = peak ? round(clamp(1 - Math.max(0, peak.elevation - 0.52) * 2.2)) : 0;

  return Object.freeze({
    ...region,
    waterAccessScore,
    climateComfortScore,
    terrainEaseScore,
  });
}

function buildBiomeSummary(cells: readonly BiomeGridCell[], grid: SpatialGrid): BiomeSummary {
  const distribution = buildBiomeDistribution();
  const landDistribution = buildBiomeDistribution();
  const landCells = cells.filter(isLandBiome);
  const oceanCells = cells.filter((cell) => cell.biomeKey === "ocean" || cell.biomeKey === "coast");

  for (const cell of cells) {
    distribution[cell.biomeKey] += 1;

    if (isLandBiome(cell)) {
      landDistribution[cell.biomeKey] += 1;
    }
  }

  const cellCount = Math.max(cells.length, 1);
  const landCount = Math.max(landCells.length, 1);
  const percentCoverage = Object.fromEntries(
    BIOME_KEYS.map((key) => [key, round((distribution[key] / cellCount) * 100, 2)]),
  ) as Record<BiomeKey, number>;
  const landCoverage = Object.fromEntries(
    BIOME_KEYS.map((key) => [key, round((landDistribution[key] / landCount) * 100, 2)]),
  ) as Record<BiomeKey, number>;
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const startingRegions = findBiomeRegions(cells, grid, startingZoneScore, 0.58, isLandBiome)
    .slice(0, 8)
    .map((region) => toStartingCandidate(region, byId));

  return Object.freeze({
    cellCount: cells.length,
    biomeDistribution: Object.freeze(distribution),
    biomePercentCoverage: Object.freeze(percentCoverage),
    landBiomeCoverage: Object.freeze(landCoverage),
    oceanCoveragePercent: round((oceanCells.length / cellCount) * 100, 2),
    mostHabitableRegions: Object.freeze(findBiomeRegions(cells, grid, (cell) => cell.habitabilityScore, 0.68, isLandBiome).slice(0, 8)),
    mostFertileRegions: Object.freeze(findBiomeRegions(cells, grid, (cell) => cell.fertilityScore, 0.64, isLandBiome).slice(0, 8)),
    harshestRegions: Object.freeze(findBiomeRegions(cells, grid, cellHarshnessScore, 0.68).slice(0, 8)),
    biodiversityPotentialScore: round(average(cells.filter(isLandBiome).map(biodiversityScore))),
    civilizationStartingZoneCandidates: Object.freeze(startingRegions),
  });
}

function buildInputs(
  world: BiomeWorldSource,
  tick: bigint,
  grid: SpatialGrid,
): readonly BiomeInputs[] {
  const terrainState = getTerrainState(world, grid);
  const hydrologyState = getHydrologyState(world, grid);
  const climateCells = getClimateGridAtTick(world, tick, grid);
  const atmosphereState = getAtmosphereStateAtTick(world, tick, grid);
  const weatherState = getWeatherStateAtTick(world, tick, grid);
  const resourceState = getPlanetResourcesStateAtTick(world, tick, grid);
  const terrainById = new Map(terrainState.cells.map((cell) => [cell.id, cell]));
  const hydrologyById = new Map(hydrologyState.cells.map((cell) => [cell.id, cell]));
  const climateById = new Map(climateCells.map((cell) => [cell.id, cell]));
  const atmosphereById = new Map(atmosphereState.cells.map((cell) => [cell.id, cell]));
  const weatherById = new Map(weatherState.cells.map((cell) => [cell.id, cell]));
  const resourceById = new Map(resourceState.cells.map((cell) => [cell.id, cell]));

  return Object.freeze([...grid.iterateCells()].map((cell) => {
    const terrain = terrainById.get(cell.id);
    const hydrology = hydrologyById.get(cell.id);
    const climate = climateById.get(cell.id);
    const atmosphere = atmosphereById.get(cell.id);
    const weather = weatherById.get(cell.id);
    const resources = resourceById.get(cell.id);

    if (!terrain || !hydrology || !climate || !atmosphere || !weather || !resources) {
      throw new Error(`Biome dependencies missing for cell: ${cell.id}`);
    }

    const adjustedTemperatureC = getAdjustedTemperature(climate, terrain);
    const precipitationScore = getPrecipitationScore(hydrology, atmosphere, weather);
    const soilMoistureScore = getSoilMoistureScore(hydrology, weather, resources, precipitationScore);
    const seasonalityScore = getSeasonalityScore(climate, weather, atmosphere);

    return Object.freeze({
      cell,
      terrain,
      hydrology,
      climate,
      atmosphere,
      weather,
      resources,
      adjustedTemperatureC,
      precipitationScore,
      humidityScore: weather.relativeHumidity,
      soilMoistureScore,
      seasonalityScore,
      transitionScore: hashUnit(requireBiomeSeed(world), `${cell.id}:edge`),
    });
  }));
}

export function getBiomeStateAtTick(
  world: BiomeWorldSource,
  tickInput: TickInput,
  grid: SpatialGrid = createGrid(),
): BiomeState {
  const tick = normalizeTick(tickInput);

  return getCachedDeterministic("biome-state", world, grid, () => {
    const seed = requireBiomeSeed(world);
    const inputs = buildInputs(world, tick, grid);
    const drafts = inputs.map((input) => Object.freeze({
      ...input,
      biomeKey: classifyBaseBiome(input),
    }));
    const draftById = new Map(drafts.map((cell) => [cell.cell.id, cell]));
    const cells = Object.freeze(drafts.map((draft) => toBiomeGridCell(
      draft,
      transitionBiome(draft, draftById, grid, seed),
    )));

    return Object.freeze({
      seed,
      tick: tick.toString(),
      cells,
      summary: buildBiomeSummary(cells, grid),
    });
  }, tick.toString());
}

export function getBiomeState(world: BiomeWorldSource, grid: SpatialGrid = createGrid()): BiomeState {
  return getBiomeStateAtTick(world, world.currentTick, grid);
}

export function getBiomeGrid(world: BiomeWorldSource, grid: SpatialGrid = createGrid()): readonly BiomeGridCell[] {
  return getBiomeState(world, grid).cells;
}

export function getBiomeGridCell(world: BiomeWorldSource, cell: GridCell): BiomeGridCell {
  const grid = createGrid();
  const biomeCell = getBiomeState(world, grid).cells.find((entry) => entry.id === cell.id);

  if (!biomeCell) {
    throw new Error(`Biome cell not found: ${cell.id}`);
  }

  return biomeCell;
}

export function getBiomeSummary(world: BiomeWorldSource, grid: SpatialGrid = createGrid()): BiomeSummary {
  return getBiomeState(world, grid).summary;
}

function biomeCellPersistencePayload(cell: BiomeGridCell): {
  row: number;
  column: number;
  biomeKey: string;
  biomeName: string;
  biomeCategory: string;
  habitabilityScore: number;
  fertilityScore: number;
  waterAvailability: number;
  vegetationDensity: number;
  biomeColor: string;
  biomeTags: Prisma.InputJsonValue;
} {
  return {
    row: cell.row,
    column: cell.column,
    biomeKey: cell.biomeKey,
    biomeName: cell.biomeName,
    biomeCategory: cell.biomeCategory,
    habitabilityScore: cell.habitabilityScore,
    fertilityScore: cell.fertilityScore,
    waterAvailability: cell.waterAvailabilityScore,
    vegetationDensity: cell.vegetationDensity,
    biomeColor: cell.biomeColor,
    biomeTags: [...cell.biomeTags],
  };
}

function samePersistedBiomeCell(
  existing: Awaited<ReturnType<BiomePersistenceClient["planetCell"]["findMany"]>>[number],
  payload: ReturnType<typeof biomeCellPersistencePayload>,
): boolean {
  return existing.row === payload.row
    && existing.column === payload.column
    && existing.biomeKey === payload.biomeKey
    && existing.biomeName === payload.biomeName
    && existing.biomeCategory === payload.biomeCategory
    && existing.habitabilityScore === payload.habitabilityScore
    && existing.fertilityScore === payload.fertilityScore
    && existing.waterAvailability === payload.waterAvailability
    && existing.vegetationDensity === payload.vegetationDensity
    && existing.biomeColor === payload.biomeColor
    && JSON.stringify(existing.biomeTags) === JSON.stringify(payload.biomeTags);
}

export async function persistBiomeState(
  world: BiomeWorldSource,
  client: BiomePersistenceClient,
  tick: TickInput = world.currentTick,
  grid: SpatialGrid = createGrid(),
): Promise<PersistBiomesResult> {
  const planet = await client.planet.findUnique({
    where: { worldId: world.id },
    select: { id: true },
  });

  if (!planet) {
    throw new Error(`Biome persistence requires a planet for world: ${world.id}`);
  }

  const state = getBiomeStateAtTick(world, tick, grid);
  const existingCells = await client.planetCell.findMany({ where: { planetId: planet.id } });
  const existingByCellId = new Map(existingCells.map((cell) => [cell.cellId, cell]));
  let createdCells = 0;
  let updatedCells = 0;
  let unchangedCells = 0;

  for (const cell of state.cells) {
    const payload = biomeCellPersistencePayload(cell);
    const existing = existingByCellId.get(cell.id);

    if (!existing) {
      await client.planetCell.create({
        data: {
          planetId: planet.id,
          cellId: cell.id,
          ...payload,
        },
      });
      createdCells += 1;
      continue;
    }

    if (samePersistedBiomeCell(existing, payload)) {
      unchangedCells += 1;
      continue;
    }

    await client.planetCell.update({
      where: { planetId_cellId: { planetId: planet.id, cellId: cell.id } },
      data: payload,
    });
    updatedCells += 1;
  }

  return Object.freeze({
    planetId: planet.id,
    generatedCells: state.cells.length,
    createdCells,
    updatedCells,
    unchangedCells,
    summary: state.summary,
  });
}

export function getBiomeDefinitions(): readonly BiomeDefinition[] {
  return BIOME_KEYS.map((key) => BIOME_DEFINITIONS[key]);
}