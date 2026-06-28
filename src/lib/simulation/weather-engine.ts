import type { World } from "@prisma/client";

import { getAtmosphereStateAtTick, type AtmosphericGridCell } from "./atmosphere-engine";
import { getAstronomyStateAtTick } from "./astronomy-engine";
import { getClimateGridAtTick, type ClimateGridCell } from "./climate-engine";
import { getCachedDeterministic } from "./deterministic-cache";
import type { GridCell } from "./grid/cell";
import { createGrid, type SpatialGrid } from "./grid/grid";
import { getHydrologyState, type HydrologyGridCell } from "./hydrology-engine";
import { getTerrainState, type TerrainGridCell, type TerrainType } from "./terrain-engine";

export const WEATHER_TYPES = [
  "CLEAR",
  "PARTLY_CLOUDY",
  "CLOUDY",
  "OVERCAST",
  "DRY",
  "WET",
  "FOG_PRONE",
  "SNOW_PRONE",
  "STORM_PRONE",
] as const;

export type WeatherType = (typeof WEATHER_TYPES)[number];

export type WeatherGridCell = GridCell & {
  readonly cloudCover: number;
  readonly relativeHumidity: number;
  readonly precipitationPotential: number;
  readonly weatherType: WeatherType;
  readonly snowPotential: number;
  readonly fogPotential: number;
  readonly stormPotential: number;
  readonly evaporationPotential: number;
  readonly drynessIndex: number;
  readonly weatherStability: number;
};

export type WeatherTypeDistribution = Record<WeatherType, number>;

export type WeatherSummary = {
  readonly tick: string;
  readonly cellCount: number;
  readonly averageHumidity: number;
  readonly averageCloudCover: number;
  readonly averagePrecipitationPotential: number;
  readonly averageStormPotential: number;
  readonly averageFogPotential: number;
  readonly averageSnowPotential: number;
  readonly averageEvaporation: number;
  readonly averageDryness: number;
  readonly averageWeatherStability: number;
  readonly dominantWeatherType: WeatherType;
  readonly weatherTypeDistribution: WeatherTypeDistribution;
  readonly seasonalWeatherState: string;
};

export type WeatherState = {
  readonly tick: string;
  readonly cells: readonly WeatherGridCell[];
  readonly summary: WeatherSummary;
};

type WeatherWorldSource = Pick<
  World,
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
  name?: string | null;
  planet?: {
    name?: string | null;
    radiusKm?: number | null;
    gravityMS2?: number | null;
    massKg?: number | null;
    rotationPeriodHours?: number | null;
    orbitalPeriodDays?: number | null;
    axialTiltDegrees?: number | null;
    orbitalEccentricity?: number | null;
    atmospherePressureKPa?: number | null;
    atmosphereComposition?: unknown;
    oceanCoveragePercent?: number | null;
  } | null;
};

type TickInput = bigint | number | string;

type WeatherInputs = {
  readonly climate: ClimateGridCell;
  readonly terrain: TerrainGridCell;
  readonly hydrology: HydrologyGridCell;
  readonly atmosphere: AtmosphericGridCell;
  readonly valleyRetention: number;
};

const OCEAN_TERRAIN_TYPES = new Set<TerrainType>(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);
const WATER_BODY_TYPES = new Set(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA", "COASTAL_WATER", "LAKE_CANDIDATE"]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function buildWeatherTypeDistribution(): WeatherTypeDistribution {
  return Object.fromEntries(WEATHER_TYPES.map((weatherType) => [weatherType, 0])) as WeatherTypeDistribution;
}

function isWaterCell(terrain: TerrainGridCell, hydrology: HydrologyGridCell): boolean {
  return OCEAN_TERRAIN_TYPES.has(terrain.terrainType) || WATER_BODY_TYPES.has(hydrology.waterBodyType);
}

function getValleyRetention(
  cell: TerrainGridCell,
  terrainById: Map<string, TerrainGridCell>,
  grid: SpatialGrid,
): number {
  const neighbors = grid.getNeighbors(cell.id)
    .map((neighbor) => terrainById.get(neighbor.id))
    .filter((neighbor): neighbor is TerrainGridCell => Boolean(neighbor));

  if (neighbors.length === 0) {
    return 0;
  }

  const averageNeighborElevation = neighbors.reduce((total, neighbor) => total + neighbor.elevation, 0) / neighbors.length;
  const enclosedByHigherGround = neighbors.filter((neighbor) => neighbor.elevation > cell.elevation + 0.025).length / neighbors.length;
  const localLow = clamp((averageNeighborElevation - cell.elevation) * 3.2, 0, 1);

  return round(clamp(localLow * 0.72 + enclosedByHigherGround * 0.28, 0, 1));
}

function seasonWarmthModifier(season: string): number {
  switch (season) {
    case "summer":
      return 1;
    case "spring":
      return 0.58;
    case "autumn":
      return 0.38;
    case "winter":
      return 0;
    default:
      return 0.5;
  }
}

function seasonColdModifier(season: string): number {
  switch (season) {
    case "winter":
      return 1;
    case "autumn":
      return 0.58;
    case "spring":
      return 0.42;
    case "summer":
      return 0;
    default:
      return 0.5;
  }
}

function getAdjustedTemperature(climate: ClimateGridCell, terrain: TerrainGridCell): number {
  const elevationCooling = clamp(terrain.elevation - 0.42, 0, 1) * 24;
  return climate.averageTemperatureC - elevationCooling;
}

function getRelativeHumidity(inputs: WeatherInputs): number {
  const { climate, terrain, hydrology, atmosphere, valleyRetention } = inputs;
  const oceanInfluence = Math.exp(-hydrology.distanceToOcean / 5);
  const coastalInfluence = Math.exp(-hydrology.distanceToCoast / 2.75);
  const waterBonus = isWaterCell(terrain, hydrology) ? 0.16 : 0;
  const coolAirRetention = clamp((18 - getAdjustedTemperature(climate, terrain)) / 34, 0, 0.24);
  const rainShadowDrying = atmosphere.rainShadowPotential * 0.22;
  const interiorDrying = clamp(hydrology.distanceToCoast / 16, 0, 0.28);

  return round(clamp(
    hydrology.moisturePotential * 0.34
      + atmosphere.moistureTransportPotential * 0.24
      + oceanInfluence * 0.16
      + coastalInfluence * 0.1
      + valleyRetention * 0.12
      + waterBonus
      + coolAirRetention
      - rainShadowDrying
      - interiorDrying,
    0,
    1,
  ));
}

function getCloudCover(inputs: WeatherInputs, humidity: number): number {
  const { atmosphere } = inputs;
  const instability = 1 - atmosphere.atmosphericStability;
  const temperatureGradient = clamp(atmosphere.temperatureGradient / 16, 0, 1);
  const lifting = clamp(atmosphere.orographicLiftPotential * 0.72 + inputs.valleyRetention * 0.08, 0, 1);

  return round(clamp(
    humidity * 0.28
      + atmosphere.moistureTransportPotential * 0.24
      + lifting * 0.22
      + temperatureGradient * 0.14
      + instability * 0.1
      - atmosphere.rainShadowPotential * 0.14,
    0,
    1,
  ));
}

function getPrecipitationPotential(inputs: WeatherInputs, humidity: number, cloudCover: number): number {
  const { atmosphere } = inputs;
  const lift = atmosphere.orographicLiftPotential;
  const instability = 1 - atmosphere.atmosphericStability;

  return round(clamp(
    humidity * 0.3
      + cloudCover * 0.28
      + lift * 0.2
      + atmosphere.moistureTransportPotential * 0.16
      + instability * 0.1
      - atmosphere.rainShadowPotential * 0.22,
    0,
    1,
  ));
}

function getSnowPotential(inputs: WeatherInputs, precipitationPotential: number, cloudCover: number): number {
  const { climate, terrain } = inputs;
  const adjustedTemperature = getAdjustedTemperature(climate, terrain);
  const coldPotential = clamp((4 - adjustedTemperature) / 20, 0, 1);

  if (coldPotential <= 0) {
    return 0;
  }

  const elevationSupport = clamp((terrain.elevation - 0.5) / 0.5, 0, 1);
  const seasonalSupport = seasonColdModifier(climate.season);

  return round(clamp(
    coldPotential * 0.58
      + precipitationPotential * 0.16
      + cloudCover * 0.1
      + elevationSupport * 0.1
      + seasonalSupport * 0.06,
    0,
    1,
  ));
}

function getFogPotential(inputs: WeatherInputs, humidity: number): number {
  const { climate, terrain, hydrology, atmosphere, valleyRetention } = inputs;
  const waterProximity = Math.max(
    Math.exp(-hydrology.distanceToCoast / 1.8),
    isWaterCell(terrain, hydrology) ? 1 : 0,
  );
  const stableAir = atmosphere.atmosphericStability;
  const lightWind = 1 - atmosphere.windStrength;

  return round(clamp(
    humidity * 0.36
      + waterProximity * 0.2
      + valleyRetention * 0.2
      + stableAir * 0.14
      + lightWind * 0.1
      - climate.solarEnergy * 0.08,
    0,
    1,
  ));
}

function getStormPotential(inputs: WeatherInputs, humidity: number): number {
  const { climate, atmosphere } = inputs;
  const instability = 1 - atmosphere.atmosphericStability;
  const temperatureGradient = clamp(atmosphere.temperatureGradient / 15, 0, 1);
  const seasonalWarmth = seasonWarmthModifier(climate.season);
  const moistureGate = 0.35 + humidity * 0.65;

  return round(clamp((
    instability * 0.34
      + temperatureGradient * 0.22
      + atmosphere.orographicLiftPotential * 0.16
      + atmosphere.moistureTransportPotential * 0.14
      + seasonalWarmth * 0.14
  ) * moistureGate, 0, 1));
}

function getEvaporationPotential(inputs: WeatherInputs, humidity: number): number {
  const { climate, terrain, hydrology, atmosphere } = inputs;
  const adjustedTemperature = getAdjustedTemperature(climate, terrain);
  const warmAir = clamp((adjustedTemperature + 8) / 42, 0, 1);
  const waterAvailability = isWaterCell(terrain, hydrology) ? 0.12 : hydrology.moisturePotential * 0.08;

  return round(clamp(
    warmAir * 0.34
      + climate.solarEnergy * 0.3
      + atmosphere.windStrength * 0.18
      + waterAvailability
      - humidity * 0.12,
    0,
    1,
  ));
}

function getDrynessIndex(
  inputs: WeatherInputs,
  humidity: number,
  precipitationPotential: number,
  evaporationPotential: number,
): number {
  const { hydrology, atmosphere } = inputs;
  const interiorExposure = clamp(hydrology.distanceToCoast / 14, 0, 1);

  return round(clamp(
    (1 - humidity) * 0.26
      + interiorExposure * 0.2
      + atmosphere.rainShadowPotential * 0.22
      + evaporationPotential * 0.22
      - precipitationPotential * 0.2
      - hydrology.moisturePotential * 0.08,
    0,
    1,
  ));
}

function getWeatherStability(inputs: WeatherInputs, stormPotential: number, cloudCover: number): number {
  const { atmosphere } = inputs;
  const pressureSettling = Math.abs(atmosphere.pressureValue - 0.5) * 0.34;
  const lowGradient = 1 - clamp(atmosphere.temperatureGradient / 16, 0, 1);
  const lowLift = 1 - atmosphere.orographicLiftPotential;

  return round(clamp(
    atmosphere.atmosphericStability * 0.38
      + pressureSettling
      + lowGradient * 0.16
      + lowLift * 0.08
      + (1 - stormPotential) * 0.08
      + (1 - cloudCover) * 0.04,
    0,
    1,
  ));
}

function classifyWeatherType(values: {
  readonly cloudCover: number;
  readonly precipitationPotential: number;
  readonly snowPotential: number;
  readonly fogPotential: number;
  readonly stormPotential: number;
  readonly drynessIndex: number;
}): WeatherType {
  if (values.stormPotential >= 0.62) {
    return "STORM_PRONE";
  }

  if (values.snowPotential >= 0.56) {
    return "SNOW_PRONE";
  }

  if (values.fogPotential >= 0.62) {
    return "FOG_PRONE";
  }

  if (values.precipitationPotential >= 0.62) {
    return "WET";
  }

  if (values.drynessIndex >= 0.68) {
    return "DRY";
  }

  if (values.cloudCover >= 0.82) {
    return "OVERCAST";
  }

  if (values.cloudCover >= 0.58) {
    return "CLOUDY";
  }

  if (values.cloudCover >= 0.28) {
    return "PARTLY_CLOUDY";
  }

  return "CLEAR";
}

function getDominantWeatherType(distribution: WeatherTypeDistribution): WeatherType {
  return WEATHER_TYPES.reduce((dominant, weatherType) => {
    const dominantCount = distribution[dominant];
    const nextCount = distribution[weatherType];

    return nextCount > dominantCount ? weatherType : dominant;
  }, "CLEAR" as WeatherType);
}

function buildSeasonalWeatherState(world: WeatherWorldSource, tick: TickInput, summary: Pick<WeatherSummary, "averageEvaporation" | "averageStormPotential" | "averageSnowPotential" | "averageDryness">): string {
  const astronomy = getAstronomyStateAtTick(world, tick);
  const dominantSeason = astronomy.seasonNorthernHemisphere === astronomy.seasonSouthernHemisphere
    ? astronomy.seasonNorthernHemisphere
    : `${astronomy.seasonNorthernHemisphere}/${astronomy.seasonSouthernHemisphere}`;

  if (summary.averageSnowPotential >= 0.34) {
    return `${dominantSeason} cold-season snow potential elevated`;
  }

  if (summary.averageStormPotential >= 0.34) {
    return `${dominantSeason} warm-season convective potential elevated`;
  }

  if (summary.averageEvaporation >= 0.5 || summary.averageDryness >= 0.46) {
    return `${dominantSeason} drying and evaporation favored`;
  }

  return `${dominantSeason} transitional stable weather`;
}

function buildWeatherSummary(world: WeatherWorldSource, tick: TickInput, cells: readonly WeatherGridCell[]): WeatherSummary {
  const distribution = buildWeatherTypeDistribution();
  let humidityTotal = 0;
  let cloudTotal = 0;
  let precipitationTotal = 0;
  let stormTotal = 0;
  let fogTotal = 0;
  let snowTotal = 0;
  let evaporationTotal = 0;
  let drynessTotal = 0;
  let stabilityTotal = 0;

  for (const cell of cells) {
    distribution[cell.weatherType] += 1;
    humidityTotal += cell.relativeHumidity;
    cloudTotal += cell.cloudCover;
    precipitationTotal += cell.precipitationPotential;
    stormTotal += cell.stormPotential;
    fogTotal += cell.fogPotential;
    snowTotal += cell.snowPotential;
    evaporationTotal += cell.evaporationPotential;
    drynessTotal += cell.drynessIndex;
    stabilityTotal += cell.weatherStability;
  }

  const cellCount = Math.max(cells.length, 1);
  const partialSummary = {
    averageEvaporation: round(evaporationTotal / cellCount),
    averageStormPotential: round(stormTotal / cellCount),
    averageSnowPotential: round(snowTotal / cellCount),
    averageDryness: round(drynessTotal / cellCount),
  };

  return Object.freeze({
    tick: tick.toString(),
    cellCount: cells.length,
    averageHumidity: round(humidityTotal / cellCount),
    averageCloudCover: round(cloudTotal / cellCount),
    averagePrecipitationPotential: round(precipitationTotal / cellCount),
    averageStormPotential: partialSummary.averageStormPotential,
    averageFogPotential: round(fogTotal / cellCount),
    averageSnowPotential: partialSummary.averageSnowPotential,
    averageEvaporation: partialSummary.averageEvaporation,
    averageDryness: partialSummary.averageDryness,
    averageWeatherStability: round(stabilityTotal / cellCount),
    dominantWeatherType: getDominantWeatherType(distribution),
    weatherTypeDistribution: Object.freeze(distribution),
    seasonalWeatherState: buildSeasonalWeatherState(world, tick, partialSummary),
  });
}

export function getWeatherStateAtTick(
  world: WeatherWorldSource,
  tick: TickInput,
  grid: SpatialGrid = createGrid(),
): WeatherState {
  const tickKey = BigInt(tick).toString();

  return getCachedDeterministic("weather-state", world, grid, () => {
    const climateCells = getClimateGridAtTick(world, tick, grid);
    const terrainState = getTerrainState(world, grid);
    const hydrologyState = getHydrologyState(world, grid);
    const atmosphereState = getAtmosphereStateAtTick(world, tick, grid);
    const climateById = new Map(climateCells.map((cell) => [cell.id, cell]));
    const terrainById = new Map(terrainState.cells.map((cell) => [cell.id, cell]));
    const hydrologyById = new Map(hydrologyState.cells.map((cell) => [cell.id, cell]));
    const atmosphereById = new Map(atmosphereState.cells.map((cell) => [cell.id, cell]));

    const cells = Object.freeze(
      Array.from(grid.iterateCells(), (cell) => {
        const climate = climateById.get(cell.id);
        const terrain = terrainById.get(cell.id);
        const hydrology = hydrologyById.get(cell.id);
        const atmosphere = atmosphereById.get(cell.id);

        if (!climate || !terrain || !hydrology || !atmosphere) {
          throw new Error(`Weather dependencies missing for cell: ${cell.id}`);
        }

        const inputs: WeatherInputs = {
          climate,
          terrain,
          hydrology,
          atmosphere,
          valleyRetention: getValleyRetention(terrain, terrainById, grid),
        };
        const relativeHumidity = getRelativeHumidity(inputs);
        const cloudCover = getCloudCover(inputs, relativeHumidity);
        const precipitationPotential = getPrecipitationPotential(inputs, relativeHumidity, cloudCover);
        const snowPotential = getSnowPotential(inputs, precipitationPotential, cloudCover);
        const fogPotential = getFogPotential(inputs, relativeHumidity);
        const stormPotential = getStormPotential(inputs, relativeHumidity);
        const evaporationPotential = getEvaporationPotential(inputs, relativeHumidity);
        const drynessIndex = getDrynessIndex(inputs, relativeHumidity, precipitationPotential, evaporationPotential);
        const weatherStability = getWeatherStability(inputs, stormPotential, cloudCover);
        const weatherType = classifyWeatherType({
          cloudCover,
          precipitationPotential,
          snowPotential,
          fogPotential,
          stormPotential,
          drynessIndex,
        });

        return Object.freeze({
          ...cell,
          cloudCover,
          relativeHumidity,
          precipitationPotential,
          weatherType,
          snowPotential,
          fogPotential,
          stormPotential,
          evaporationPotential,
          drynessIndex,
          weatherStability,
        });
      }),
    );

    return Object.freeze({
      tick: tick.toString(),
      cells,
      summary: buildWeatherSummary(world, tick, cells),
    });
  }, tickKey);
}

export function getWeatherState(
  world: WeatherWorldSource,
  grid: SpatialGrid = createGrid(),
): WeatherState {
  return getWeatherStateAtTick(world, world.currentTick, grid);
}

export function getWeatherGrid(
  world: WeatherWorldSource,
  grid: SpatialGrid = createGrid(),
): readonly WeatherGridCell[] {
  return getWeatherState(world, grid).cells;
}

export function getWeatherGridCell(world: WeatherWorldSource, cell: GridCell): WeatherGridCell {
  const grid = createGrid();
  const weatherCell = getWeatherState(world, grid).cells.find((entry) => entry.id === cell.id);

  if (!weatherCell) {
    throw new Error(`Weather cell not found: ${cell.id}`);
  }

  return weatherCell;
}

export function getWeatherSummary(
  world: WeatherWorldSource,
  grid: SpatialGrid = createGrid(),
): WeatherSummary {
  return getWeatherState(world, grid).summary;
}

export function getWeatherSummaryAtTick(
  world: WeatherWorldSource,
  tick: TickInput,
  grid: SpatialGrid = createGrid(),
): WeatherSummary {
  return getWeatherStateAtTick(world, tick, grid).summary;
}