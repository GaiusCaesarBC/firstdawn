import type { World } from "@prisma/client";

import type { AtmosphericGridCell } from "./atmosphere-engine";
import { getAtmosphereStateAtTick } from "./atmosphere-engine";
import type { ClimateGridCell } from "./climate-engine";
import { getClimateGridAtTick } from "./climate-engine";
import { getCachedDeterministic } from "./deterministic-cache";
import type { GridCell } from "./grid/cell";
import { createGrid, type SpatialGrid } from "./grid/grid";
import type { HydrologyGridCell } from "./hydrology-engine";
import { getHydrologyState } from "./hydrology-engine";
import type { TerrainGridCell, TerrainType } from "./terrain-engine";
import { getTerrainState } from "./terrain-engine";
import type { WeatherGridCell } from "./weather-engine";
import { getWeatherStateAtTick } from "./weather-engine";

export const BEDROCK_TYPES = [
  "OCEANIC_BASALT",
  "CONTINENTAL_GRANITE",
  "SEDIMENTARY_BASIN",
  "LIMESTONE_PLATFORM",
  "VOLCANIC_ROCK",
  "METAMORPHIC_BELT",
  "ALLUVIAL_DEPOSIT",
] as const;

export type BedrockType = (typeof BEDROCK_TYPES)[number];

export type MetalRichness = {
  readonly iron: number;
  readonly copper: number;
  readonly gold: number;
  readonly silver: number;
  readonly tin: number;
  readonly nickel: number;
};

export type IndustrialMaterialRichness = {
  readonly coal: number;
  readonly limestone: number;
  readonly granite: number;
  readonly clay: number;
  readonly sand: number;
  readonly salt: number;
};

export type RareMaterialRichness = {
  readonly rareEarthElements: number;
  readonly uranium: number;
  readonly sulfur: number;
  readonly quartz: number;
};

export type WaterResourcePotential = {
  readonly groundwaterPotential: number;
  readonly aquiferDepthMeters: number;
  readonly freshwaterAvailability: number;
  readonly springProbability: number;
};

export type BuildingResourceAvailability = {
  readonly timberPotential: number;
  readonly stone: number;
  readonly gravel: number;
  readonly clay: number;
};

export type PlanetResourceGridCell = GridCell & {
  readonly bedrockType: BedrockType;
  readonly sedimentDepth: number;
  readonly volcanicInfluence: number;
  readonly tectonicActivity: number;
  readonly erosionPotential: number;
  readonly metals: MetalRichness;
  readonly industrialMaterials: IndustrialMaterialRichness;
  readonly rareMaterials: RareMaterialRichness;
  readonly waterResources: WaterResourcePotential;
  readonly buildingResources: BuildingResourceAvailability;
  readonly resourceRichness: number;
  readonly metalRichness: number;
  readonly industrialRichness: number;
  readonly rareMaterialRichness: number;
  readonly waterRichness: number;
  readonly buildingMaterialAvailability: number;
  readonly resourceDiversity: number;
};

export type ResourceRegion = {
  readonly cellId: string;
  readonly cellCount: number;
  readonly averageScore: number;
  readonly peakScore: number;
  readonly midpointLatitude: number;
  readonly midpointLongitude: number;
};

export type PlanetResourceSummary = {
  readonly cellCount: number;
  readonly richestIronRegion: ResourceRegion | null;
  readonly largestCoalBasin: ResourceRegion | null;
  readonly largestAquifer: ResourceRegion | null;
  readonly strongestMiningRegion: ResourceRegion | null;
  readonly volcanicRegions: readonly ResourceRegion[];
  readonly rareEarthHotspots: readonly ResourceRegion[];
  readonly majorSedimentaryBasins: readonly ResourceRegion[];
  readonly averageMineralRichness: number;
  readonly averageResourceRichness: number;
  readonly resourceDiversity: number;
};

export type PlanetResourcesState = {
  readonly seed: string;
  readonly tick: string;
  readonly cells: readonly PlanetResourceGridCell[];
  readonly summary: PlanetResourceSummary;
};

type ResourcesWorldSource = Pick<
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
  planet?: {
    oceanCoveragePercent?: number | null;
  } | null;
};

type ResourceInputs = {
  readonly cell: GridCell;
  readonly terrain: TerrainGridCell;
  readonly hydrology: HydrologyGridCell;
  readonly climate: ClimateGridCell;
  readonly atmosphere: AtmosphericGridCell;
  readonly weather: WeatherGridCell;
};

const OCEAN_TERRAIN_TYPES = new Set<TerrainType>(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);
const MOUNTAIN_TERRAIN_TYPES = new Set<TerrainType>(["MOUNTAINS", "HIGH_MOUNTAINS", "PLATEAU"]);

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

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / Math.max(edge1 - edge0, 0.000001));
  return x * x * (3 - 2 * x);
}

function isMarine(terrain: TerrainGridCell, hydrology: HydrologyGridCell): boolean {
  return OCEAN_TERRAIN_TYPES.has(terrain.terrainType) || hydrology.isOcean || hydrology.isSea;
}

function getSedimentDepth(inputs: ResourceInputs): number {
  const { terrain, hydrology, weather } = inputs;
  const marine = isMarine(terrain, hydrology);
  const basin = hydrology.basinId ? 0.28 : 0;
  const riverValley = hydrology.isRiverCandidate
    ? 0.2
    : clamp(Math.log1p(hydrology.flowAccumulation) / 7) * 0.18;
  const lowRelief = (1 - terrain.ruggedness) * (1 - terrain.tectonicActivity);
  const coastalShelf = terrain.isCoast || hydrology.distanceToCoast <= 1 ? 0.16 : 0;
  const marineSediment = marine ? (terrain.terrainType === "SHALLOW_SEA" ? 0.44 : 0.32) : 0;
  const weathering = weather.precipitationPotential * 0.1 + weather.stormPotential * 0.06;

  return round(clamp(
    lowRelief * 0.28
      + basin
      + riverValley
      + coastalShelf
      + marineSediment
      + weathering
      - terrain.ruggedness * 0.12,
  ));
}

function getVolcanicInfluence(inputs: ResourceInputs, sedimentDepth: number): number {
  const { terrain, hydrology, atmosphere } = inputs;
  const marineArc = isMarine(terrain, hydrology) && terrain.tectonicActivity >= 0.62 ? 0.12 : 0;
  const mountainArc = MOUNTAIN_TERRAIN_TYPES.has(terrain.terrainType) ? 0.16 : 0;

  return round(clamp(
    terrain.tectonicActivity * 0.48
      + terrain.ruggedness * 0.18
      + smoothstep(0.58, 0.9, terrain.elevation) * 0.12
      + atmosphere.orographicLiftPotential * 0.08
      + marineArc
      + mountainArc
      - sedimentDepth * 0.16,
  ));
}

function getErosionPotential(inputs: ResourceInputs): number {
  const { terrain, hydrology, weather, atmosphere } = inputs;
  const flow = clamp(Math.log1p(hydrology.flowAccumulation) / 6);

  return round(clamp(
    terrain.ruggedness * 0.24
      + smoothstep(0.48, 0.9, terrain.elevation) * 0.18
      + weather.precipitationPotential * 0.22
      + weather.stormPotential * 0.13
      + flow * 0.16
      + atmosphere.orographicLiftPotential * 0.07,
  ));
}

function classifyBedrock(
  inputs: ResourceInputs,
  sedimentDepth: number,
  volcanicInfluence: number,
): BedrockType {
  const { terrain, hydrology } = inputs;
  const marine = isMarine(terrain, hydrology);

  if (volcanicInfluence >= 0.72) {
    return "VOLCANIC_ROCK";
  }

  if (terrain.tectonicActivity >= 0.68 && terrain.ruggedness >= 0.46) {
    return "METAMORPHIC_BELT";
  }

  if (hydrology.isRiverCandidate || (sedimentDepth >= 0.62 && !marine && terrain.elevation <= 0.58)) {
    return "ALLUVIAL_DEPOSIT";
  }

  if (marine && terrain.terrainType === "SHALLOW_SEA" && sedimentDepth >= 0.52) {
    return "LIMESTONE_PLATFORM";
  }

  if (sedimentDepth >= 0.56 || hydrology.basinId) {
    return "SEDIMENTARY_BASIN";
  }

  if (marine) {
    return "OCEANIC_BASALT";
  }

  return "CONTINENTAL_GRANITE";
}

function getMetals(inputs: ResourceInputs, bedrockType: BedrockType, volcanicInfluence: number): MetalRichness {
  const { terrain, hydrology } = inputs;
  const mountainBelt = clamp(
    smoothstep(0.58, 0.88, terrain.elevation) * 0.38
      + terrain.tectonicActivity * 0.34
      + terrain.ruggedness * 0.28,
  );
  const ancientCrust = clamp(terrain.continentalness * (1 - terrain.tectonicActivity * 0.45));
  const faulting = clamp(terrain.tectonicActivity * 0.6 + terrain.ruggedness * 0.4);
  const oceanicBasalt = bedrockType === "OCEANIC_BASALT" ? 1 : 0;
  const granite = bedrockType === "CONTINENTAL_GRANITE" ? 1 : 0;
  const metamorphic = bedrockType === "METAMORPHIC_BELT" ? 1 : 0;

  return Object.freeze({
    iron: round(clamp(mountainBelt * 0.42 + ancientCrust * 0.34 + metamorphic * 0.18 + terrain.continentalness * 0.08)),
    copper: round(clamp(volcanicInfluence * 0.44 + faulting * 0.3 + mountainBelt * 0.16 + oceanicBasalt * 0.08)),
    gold: round(clamp(faulting * 0.34 + volcanicInfluence * 0.34 + mountainBelt * 0.2 + (hydrology.isRiverCandidate ? 0.06 : 0))),
    silver: round(clamp(volcanicInfluence * 0.32 + faulting * 0.28 + mountainBelt * 0.16 + sedimentarySignal(bedrockType) * 0.1)),
    tin: round(clamp(granite * 0.34 + ancientCrust * 0.26 + mountainBelt * 0.18 + terrain.continentalness * 0.1)),
    nickel: round(clamp(oceanicBasalt * 0.36 + volcanicInfluence * 0.26 + terrain.tectonicActivity * 0.22 + metamorphic * 0.1)),
  });
}

function sedimentarySignal(bedrockType: BedrockType): number {
  return bedrockType === "SEDIMENTARY_BASIN" || bedrockType === "LIMESTONE_PLATFORM" ? 1 : 0;
}

function getIndustrialMaterials(
  inputs: ResourceInputs,
  bedrockType: BedrockType,
  sedimentDepth: number,
): IndustrialMaterialRichness {
  const { terrain, hydrology, climate, weather } = inputs;
  const moderateClimate = 1 - clamp(Math.abs(climate.averageTemperatureC - 16) / 32);
  const basin = hydrology.basinId ? 1 : 0;
  const lowTectonic = 1 - terrain.tectonicActivity;
  const floodplain = hydrology.isRiverCandidate ? 1 : clamp(Math.log1p(hydrology.flowAccumulation) / 6);
  const evaporation = clamp(weather.evaporationPotential * 0.72 + weather.drynessIndex * 0.28);
  const coastal = terrain.isCoast || hydrology.distanceToCoast <= 1 ? 1 : 0;

  return Object.freeze({
    coal: round(clamp(sedimentDepth * 0.38 + basin * 0.24 + moderateClimate * 0.2 + lowTectonic * 0.14 + hydrology.moisturePotential * 0.08)),
    limestone: round(clamp(
      (bedrockType === "LIMESTONE_PLATFORM" ? 0.52 : 0)
        + (isMarine(terrain, hydrology) ? 0.18 : 0)
        + sedimentDepth * 0.24
        + coastal * 0.08,
    )),
    granite: round(clamp((bedrockType === "CONTINENTAL_GRANITE" ? 0.62 : 0) + terrain.continentalness * 0.18 + (1 - sedimentDepth) * 0.1)),
    clay: round(clamp(sedimentDepth * 0.34 + floodplain * 0.34 + weather.precipitationPotential * 0.14 + lowTectonic * 0.08)),
    sand: round(clamp(coastal * 0.34 + sedimentDepth * 0.2 + weather.drynessIndex * 0.18 + (terrain.terrainType === "BEACH" ? 0.28 : 0))),
    salt: round(clamp((basin * evaporation * 0.44) + coastal * 0.16 + sedimentDepth * 0.12 + weather.drynessIndex * 0.18)),
  });
}

function getRareMaterials(
  inputs: ResourceInputs,
  bedrockType: BedrockType,
  volcanicInfluence: number,
  sedimentDepth: number,
): RareMaterialRichness {
  const { terrain, weather } = inputs;
  const granite = bedrockType === "CONTINENTAL_GRANITE" ? 1 : 0;
  const ancientCrust = clamp(terrain.continentalness * (1 - terrain.tectonicActivity * 0.35));

  return Object.freeze({
    rareEarthElements: round(clamp(granite * 0.28 + ancientCrust * 0.28 + terrain.tectonicActivity * 0.16 + sedimentDepth * 0.08)),
    uranium: round(clamp(ancientCrust * 0.3 + granite * 0.22 + sedimentDepth * 0.16 + weather.drynessIndex * 0.1)),
    sulfur: round(clamp(volcanicInfluence * 0.46 + sedimentDepth * weather.drynessIndex * 0.18 + sedimentarySignal(bedrockType) * 0.1)),
    quartz: round(clamp(granite * 0.3 + terrain.ruggedness * 0.2 + terrain.continentalness * 0.18 + (1 - sedimentDepth) * 0.1)),
  });
}

function getWaterResources(
  inputs: ResourceInputs,
  sedimentDepth: number,
  volcanicInfluence: number,
): WaterResourcePotential {
  const { terrain, hydrology, weather } = inputs;
  const marine = isMarine(terrain, hydrology);
  const recharge = clamp(weather.precipitationPotential * 0.5 + hydrology.moisturePotential * 0.34 + weather.relativeHumidity * 0.16);
  const storage = clamp(sedimentDepth * 0.58 + (1 - terrain.ruggedness) * 0.22 + (hydrology.basinId ? 0.12 : 0));
  const groundwaterPotential = round(clamp(storage * 0.58 + recharge * 0.42 - (marine ? 0.2 : 0)));
  const freshwaterAvailability = round(clamp(recharge * 0.42 + hydrology.moisturePotential * 0.28 + groundwaterPotential * 0.22 - weather.drynessIndex * 0.12));
  const springProbability = round(clamp(groundwaterPotential * 0.34 + terrain.ruggedness * 0.22 + terrain.tectonicActivity * 0.16 + volcanicInfluence * 0.08 - (marine ? 0.18 : 0)));
  const aquiferDepthMeters = round(25 + (1 - groundwaterPotential) * 420 + sedimentDepth * 260 + terrain.elevation * 140, 1);

  return Object.freeze({
    groundwaterPotential,
    aquiferDepthMeters,
    freshwaterAvailability,
    springProbability,
  });
}

function getBuildingResources(
  inputs: ResourceInputs,
  industrial: IndustrialMaterialRichness,
  bedrockType: BedrockType,
): BuildingResourceAvailability {
  const { terrain, hydrology } = inputs;
  const hardRock = bedrockType === "CONTINENTAL_GRANITE" || bedrockType === "METAMORPHIC_BELT" || bedrockType === "VOLCANIC_ROCK";

  return Object.freeze({
    timberPotential: 0,
    stone: round(clamp((hardRock ? 0.48 : 0.12) + terrain.ruggedness * 0.24 + smoothstep(0.5, 0.82, terrain.elevation) * 0.18)),
    gravel: round(clamp(terrain.ruggedness * 0.28 + (hydrology.isRiverCandidate ? 0.26 : 0) + industrial.sand * 0.18)),
    clay: industrial.clay,
  });
}

function getResourceDiversity(values: readonly number[]): number {
  const present = values.filter((value) => value >= 0.36).length;
  return round(present / Math.max(values.length, 1));
}

function flattenCellResources(cell: PlanetResourceGridCell): number[] {
  return [
    ...Object.values(cell.metals),
    ...Object.values(cell.industrialMaterials),
    ...Object.values(cell.rareMaterials),
    cell.waterResources.groundwaterPotential,
    cell.waterResources.freshwaterAvailability,
    cell.waterResources.springProbability,
    cell.buildingResources.stone,
    cell.buildingResources.gravel,
    cell.buildingResources.clay,
  ];
}

function buildResourceCell(inputs: ResourceInputs): PlanetResourceGridCell {
  const sedimentDepth = getSedimentDepth(inputs);
  const volcanicInfluence = getVolcanicInfluence(inputs, sedimentDepth);
  const erosionPotential = getErosionPotential(inputs);
  const bedrockType = classifyBedrock(inputs, sedimentDepth, volcanicInfluence);
  const metals = getMetals(inputs, bedrockType, volcanicInfluence);
  const industrialMaterials = getIndustrialMaterials(inputs, bedrockType, sedimentDepth);
  const rareMaterials = getRareMaterials(inputs, bedrockType, volcanicInfluence, sedimentDepth);
  const waterResources = getWaterResources(inputs, sedimentDepth, volcanicInfluence);
  const buildingResources = getBuildingResources(inputs, industrialMaterials, bedrockType);
  const metalRichness = round(average(Object.values(metals)));
  const industrialRichness = round(average(Object.values(industrialMaterials)));
  const rareMaterialRichness = round(average(Object.values(rareMaterials)));
  const waterRichness = round(average([
    waterResources.groundwaterPotential,
    waterResources.freshwaterAvailability,
    waterResources.springProbability,
  ]));
  const buildingMaterialAvailability = round(average(Object.values(buildingResources)));
  const resourceRichness = round(average([
    metalRichness,
    industrialRichness,
    rareMaterialRichness,
    waterRichness,
    buildingMaterialAvailability,
  ]));

  const cell = Object.freeze({
    ...inputs.cell,
    bedrockType,
    sedimentDepth,
    volcanicInfluence,
    tectonicActivity: round(inputs.terrain.tectonicActivity),
    erosionPotential,
    metals,
    industrialMaterials,
    rareMaterials,
    waterResources,
    buildingResources,
    resourceRichness,
    metalRichness,
    industrialRichness,
    rareMaterialRichness,
    waterRichness,
    buildingMaterialAvailability,
    resourceDiversity: 0,
  });

  return Object.freeze({
    ...cell,
    resourceDiversity: getResourceDiversity(flattenCellResources(cell)),
  });
}

function makeRegion(
  component: readonly PlanetResourceGridCell[],
  score: (cell: PlanetResourceGridCell) => number,
): ResourceRegion {
  const sorted = [...component].sort((left, right) => score(right) - score(left) || left.id.localeCompare(right.id));
  const peak = sorted[0];

  return Object.freeze({
    cellId: peak.id,
    cellCount: component.length,
    averageScore: round(average(component.map(score))),
    peakScore: round(score(peak)),
    midpointLatitude: round(average(component.map((cell) => cell.midpointLatitude)), 3),
    midpointLongitude: round(average(component.map((cell) => cell.midpointLongitude)), 3),
  });
}

function findRegions(
  cells: readonly PlanetResourceGridCell[],
  grid: SpatialGrid,
  score: (cell: PlanetResourceGridCell) => number,
  threshold: number,
): ResourceRegion[] {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const eligible = new Set(cells.filter((cell) => score(cell) >= threshold).map((cell) => cell.id));
  const visited = new Set<string>();
  const regions: ResourceRegion[] = [];

  for (const cell of cells) {
    if (!eligible.has(cell.id) || visited.has(cell.id)) {
      continue;
    }

    const queue = [cell.id];
    const component: PlanetResourceGridCell[] = [];
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

    regions.push(makeRegion(component, score));
  }

  return regions.sort((left, right) =>
    right.cellCount - left.cellCount
      || right.peakScore - left.peakScore
      || left.cellId.localeCompare(right.cellId),
  );
}

function findRichestRegion(
  cells: readonly PlanetResourceGridCell[],
  grid: SpatialGrid,
  score: (cell: PlanetResourceGridCell) => number,
  threshold: number,
): ResourceRegion | null {
  const regions = findRegions(cells, grid, score, threshold)
    .sort((left, right) =>
      right.peakScore - left.peakScore
        || right.averageScore - left.averageScore
        || right.cellCount - left.cellCount
        || left.cellId.localeCompare(right.cellId),
    );

  if (regions.length > 0) {
    return regions[0];
  }

  const richest = [...cells].sort((left, right) => score(right) - score(left) || left.id.localeCompare(right.id))[0];
  return richest ? makeRegion([richest], score) : null;
}

function buildPlanetResourceSummary(cells: readonly PlanetResourceGridCell[], grid: SpatialGrid): PlanetResourceSummary {
  const mineralRichness = cells.map((cell) => average([
    cell.metalRichness,
    cell.industrialRichness,
    cell.rareMaterialRichness,
  ]));
  const miningScore = (cell: PlanetResourceGridCell) => average([
    cell.metalRichness,
    cell.rareMaterialRichness,
    cell.buildingResources.stone,
  ]);

  return Object.freeze({
    cellCount: cells.length,
    richestIronRegion: findRichestRegion(cells, grid, (cell) => cell.metals.iron, 0.62),
    largestCoalBasin: findRegions(cells, grid, (cell) => Math.min(cell.industrialMaterials.coal, cell.sedimentDepth), 0.48)[0] ?? null,
    largestAquifer: findRegions(cells, grid, (cell) => cell.waterResources.groundwaterPotential, 0.58)[0] ?? null,
    strongestMiningRegion: findRichestRegion(cells, grid, miningScore, 0.46),
    volcanicRegions: Object.freeze(findRegions(cells, grid, (cell) => cell.volcanicInfluence, 0.62).slice(0, 6)),
    rareEarthHotspots: Object.freeze(findRegions(cells, grid, (cell) => cell.rareMaterials.rareEarthElements, 0.5).slice(0, 6)),
    majorSedimentaryBasins: Object.freeze(findRegions(cells, grid, (cell) => cell.sedimentDepth, 0.58).slice(0, 6)),
    averageMineralRichness: round(average(mineralRichness)),
    averageResourceRichness: round(average(cells.map((cell) => cell.resourceRichness))),
    resourceDiversity: round(average(cells.map((cell) => cell.resourceDiversity))),
  });
}

function requireResourcesSeed(world: ResourcesWorldSource): string {
  const seed = world.seed?.trim();

  if (!seed) {
    throw new Error("Planet resources generation requires a world seed.");
  }

  return seed;
}

export function getPlanetResourcesStateAtTick(
  world: ResourcesWorldSource,
  tick: bigint,
  grid: SpatialGrid = createGrid(),
): PlanetResourcesState {
  const tickKey = tick.toString();

  return getCachedDeterministic("resources-state", world, grid, () => {
    const seed = requireResourcesSeed(world);
    const terrainState = getTerrainState(world, grid);
    const hydrologyState = getHydrologyState(world, grid);
    const climateCells = getClimateGridAtTick(world, tick, grid);
    const atmosphereState = getAtmosphereStateAtTick(world, tick, grid);
    const weatherState = getWeatherStateAtTick(world, tick, grid);
    const terrainById = new Map(terrainState.cells.map((cell) => [cell.id, cell]));
    const hydrologyById = new Map(hydrologyState.cells.map((cell) => [cell.id, cell]));
    const climateById = new Map(climateCells.map((cell) => [cell.id, cell]));
    const atmosphereById = new Map(atmosphereState.cells.map((cell) => [cell.id, cell]));
    const weatherById = new Map(weatherState.cells.map((cell) => [cell.id, cell]));
    const cells = Object.freeze(
      [...grid.iterateCells()].map((cell) => {
        const terrain = terrainById.get(cell.id);
        const hydrology = hydrologyById.get(cell.id);
        const climate = climateById.get(cell.id);
        const atmosphere = atmosphereById.get(cell.id);
        const weather = weatherById.get(cell.id);

        if (!terrain || !hydrology || !climate || !atmosphere || !weather) {
          throw new Error(`Planet resources dependencies missing for cell: ${cell.id}`);
        }

        return buildResourceCell({ cell, terrain, hydrology, climate, atmosphere, weather });
      }),
    );

    return Object.freeze({
      seed,
      tick: tick.toString(),
      cells,
      summary: buildPlanetResourceSummary(cells, grid),
    });
  }, tickKey);
}

export function getPlanetResourcesState(
  world: ResourcesWorldSource,
  grid: SpatialGrid = createGrid(),
): PlanetResourcesState {
  return getPlanetResourcesStateAtTick(world, world.currentTick, grid);
}

export function getPlanetResourcesGrid(
  world: ResourcesWorldSource,
  grid: SpatialGrid = createGrid(),
): readonly PlanetResourceGridCell[] {
  return getPlanetResourcesState(world, grid).cells;
}

export function getPlanetResourcesGridCell(
  world: ResourcesWorldSource,
  cell: GridCell,
): PlanetResourceGridCell {
  const grid = createGrid();
  const resourceCell = getPlanetResourcesState(world, grid).cells.find((entry) => entry.id === cell.id);

  if (!resourceCell) {
    throw new Error(`Planet resources cell not found: ${cell.id}`);
  }

  return resourceCell;
}

export function getPlanetResourceSummary(
  world: ResourcesWorldSource,
  grid: SpatialGrid = createGrid(),
): PlanetResourceSummary {
  return getPlanetResourcesState(world, grid).summary;
}

