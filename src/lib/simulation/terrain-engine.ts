import type { World } from "@prisma/client";

import { getCachedDeterministic } from "./deterministic-cache";
import type { GridCell } from "./grid/cell";
import { createGrid, type SpatialGrid } from "./grid/grid";

export const TERRAIN_TYPES = [
  "OCEAN",
  "DEEP_OCEAN",
  "SHALLOW_SEA",
  "BEACH",
  "PLAINS",
  "HILLS",
  "MOUNTAINS",
  "HIGH_MOUNTAINS",
  "PLATEAU",
] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

export type TerrainGridCell = GridCell & {
  readonly elevation: number;
  readonly terrainType: TerrainType;
  readonly continentalness: number;
  readonly ruggedness: number;
  readonly tectonicActivity: number;
  readonly isCoast: boolean;
};

export type TerrainDistribution = Record<TerrainType, number>;

export type TerrainSummary = {
  readonly cellCount: number;
  readonly highestElevation: number;
  readonly lowestElevation: number;
  readonly averageElevation: number;
  readonly landPercent: number;
  readonly oceanPercent: number;
  readonly polarLandPercent: number;
  readonly temperateLandPercent: number;
  readonly tropicalLandPercent: number;
  readonly subtropicalLandPercent: number;
  readonly habitableLandPercent: number;
  readonly mountainPercent: number;
  readonly coastlineCells: number;
  readonly terrainDistribution: TerrainDistribution;
  readonly largestContinentEstimate: number;
  readonly largestOceanEstimate: number;
};

export type TerrainValidation = {
  readonly valid: boolean;
  readonly attempt: number;
  readonly violations: readonly string[];
};

export type TerrainState = {
  readonly seed: string;
  readonly terrainSeed: string;
  readonly cells: readonly TerrainGridCell[];
  readonly summary: TerrainSummary;
  readonly validation: TerrainValidation;
};

type TerrainWorldSource = Pick<World, "seed"> & {
  planet?: {
    oceanCoveragePercent?: number | null;
  } | null;
};

type RawTerrainCell = GridCell & {
  elevation: number;
  terrainType: TerrainType;
  continentalness: number;
  ruggedness: number;
  tectonicActivity: number;
  isCoast: boolean;
};

type ContinentalCenter = {
  latitude: number;
  longitude: number;
  radiusRadians: number;
};

const UINT32_RANGE = 4_294_967_296;
const SEA_LEVEL = 0.42;
const MAX_TERRAIN_VALIDATION_ATTEMPTS = 64;
const MOUNTAIN_TYPES = new Set<TerrainType>(["MOUNTAINS", "HIGH_MOUNTAINS"]);
const OCEAN_TYPES = new Set<TerrainType>(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
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
  return hashStringToUint32(`${seed}:terrain:${key}`) / UINT32_RANGE;
}

function latticeNoise(seed: string, layer: string, x: number, y: number): number {
  return hashUnit(seed, `${layer}:${x}:${y}`) * 2 - 1;
}

function valueNoise(seed: string, layer: string, x: number, y: number, frequency: number): number {
  const scaledX = x * frequency;
  const scaledY = y * frequency;
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const tx = smoothstep(0, 1, scaledX - x0);
  const ty = smoothstep(0, 1, scaledY - y0);
  const wrappedX0 = ((x0 % frequency) + frequency) % frequency;
  const wrappedX1 = (wrappedX0 + 1) % frequency;
  const clampedY0 = clamp(y0, 0, frequency);
  const clampedY1 = clamp(y0 + 1, 0, frequency);
  const bottomLeft = latticeNoise(seed, layer, wrappedX0, clampedY0);
  const bottomRight = latticeNoise(seed, layer, wrappedX1, clampedY0);
  const topLeft = latticeNoise(seed, layer, wrappedX0, clampedY1);
  const topRight = latticeNoise(seed, layer, wrappedX1, clampedY1);
  const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
  const top = topLeft + (topRight - topLeft) * tx;

  return bottom + (top - bottom) * ty;
}

function fractalNoise(seed: string, layer: string, x: number, y: number, frequencies: number[]): number {
  let amplitude = 1;
  let totalAmplitude = 0;
  let total = 0;

  for (const frequency of frequencies) {
    total += valueNoise(seed, layer, x, y, frequency) * amplitude;
    totalAmplitude += amplitude;
    amplitude *= 0.5;
  }

  return total / totalAmplitude;
}

function ridgedNoise(seed: string, layer: string, x: number, y: number, frequencies: number[]): number {
  return 1 - Math.abs(fractalNoise(seed, layer, x, y, frequencies));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function greatCircleDistanceRadians(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  const firstLat = toRadians(firstLatitude);
  const secondLat = toRadians(secondLatitude);
  const deltaLat = secondLat - firstLat;
  const deltaLon = toRadians(secondLongitude - firstLongitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLon / 2) ** 2;

  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function buildContinentalCenters(seed: string): ContinentalCenter[] {
  const majorCount = 4 + Math.floor(hashUnit(seed, "continental-center-count") * 2);
  const islandCount = 1 + Math.floor(hashUnit(seed, "continental-island-count") * 2);
  const centers: ContinentalCenter[] = [];

  for (let index = 0; index < majorCount; index += 1) {
    const hemisphere = hashUnit(seed, `continental-center-${index}:hemisphere`) >= 0.5 ? 1 : -1;
    const preferredLatitude = 20 + hashUnit(seed, `continental-center-${index}:lat`) * 30;
    const latitudeJitter = (hashUnit(seed, `continental-center-${index}:lat-jitter`) - 0.5) * 10;
    const longitude = -180 + hashUnit(seed, `continental-center-${index}:lon`) * 360;
    const radiusDegrees = 34 + hashUnit(seed, `continental-center-${index}:radius`) * 24;

    centers.push({
      latitude: hemisphere * preferredLatitude + latitudeJitter,
      longitude,
      radiusRadians: toRadians(radiusDegrees),
    });
  }

  for (let index = 0; index < islandCount; index += 1) {
    const hemisphere = hashUnit(seed, `polar-island-${index}:hemisphere`) >= 0.5 ? 1 : -1;
    const latitude = hemisphere * (54 + hashUnit(seed, `polar-island-${index}:lat`) * 22);
    const longitude = -180 + hashUnit(seed, `polar-island-${index}:lon`) * 360;
    const radiusDegrees = 12 + hashUnit(seed, `polar-island-${index}:radius`) * 12;

    centers.push({
      latitude,
      longitude,
      radiusRadians: toRadians(radiusDegrees),
    });
  }

  return centers;
}

function getContinentalness(seed: string, cell: GridCell, centers: ContinentalCenter[]): number {
  const x = (cell.midpointLongitude + 180) / 360;
  const y = (cell.midpointLatitude + 90) / 180;
  const absoluteLatitude = Math.abs(cell.midpointLatitude);
  const continentalInfluence = centers.reduce((highest, center) => {
    const distance = greatCircleDistanceRadians(
      cell.midpointLatitude,
      cell.midpointLongitude,
      center.latitude,
      center.longitude,
    );
    const influence = Math.exp(-((distance / center.radiusRadians) ** 2) * 1.65);

    return Math.max(highest, influence);
  }, 0);
  const continentalNoise = fractalNoise(seed, "continental-warp", x, y, [2, 4, 8]);
  const islandChainNoise = ridgedNoise(seed, "oceanic-chain", x, y, [3, 6, 12]);
  const islandChainInfluence = Math.max(0, islandChainNoise - 0.84) * 0.55;
  const habitableLatitudeLift = smoothstep(12, 24, absoluteLatitude)
    * (1 - smoothstep(52, 68, absoluteLatitude))
    * 0.08;
  const polarSuppression = smoothstep(58, 82, absoluteLatitude) * 0.36;

  return round(clamp(
    continentalInfluence * 0.94
      + continentalNoise * 0.13
      + islandChainInfluence
      + habitableLatitudeLift
      - polarSuppression,
    0,
    1,
  ));
}

function targetOceanCoverage(world: TerrainWorldSource): number {
  const configuredCoverage = world.planet?.oceanCoveragePercent;

  if (!Number.isFinite(configuredCoverage)) {
    return 0.71;
  }

  return clamp(Number(configuredCoverage) / 100, 0.55, 0.78);
}

function quantile(values: number[], percentile: number): number {
  const sortedValues = [...values].sort((left, right) => left - right);
  const index = clamp(Math.floor((sortedValues.length - 1) * percentile), 0, sortedValues.length - 1);

  return sortedValues[index] ?? 0;
}

function scaleElevation(rawElevation: number, seaLevel: number, minimum: number, maximum: number): number {
  if (rawElevation < seaLevel) {
    const denominator = Math.max(seaLevel - minimum, 0.000001);
    return round(clamp((rawElevation - minimum) / denominator, 0, 1) * SEA_LEVEL);
  }

  const denominator = Math.max(maximum - seaLevel, 0.000001);
  return round(SEA_LEVEL + clamp((rawElevation - seaLevel) / denominator, 0, 1) * (1 - SEA_LEVEL));
}

function getTectonicActivity(seed: string, cell: GridCell, continentalness: number): number {
  const x = (cell.midpointLongitude + 180) / 360;
  const y = (cell.midpointLatitude + 90) / 180;
  const plateBoundary = ridgedNoise(seed, "plate-boundary", x, y, [3, 6, 12]);
  const continentalMargin = 1 - Math.abs(continentalness - 0.52) / 0.52;
  const localStress = ridgedNoise(seed, "crustal-stress", x, y, [8, 16]);

  return round(clamp(plateBoundary * 0.62 + continentalMargin * 0.26 + localStress * 0.12, 0, 1));
}

function classifyTerrain(
  elevation: number,
  ruggedness: number,
  tectonicActivity: number,
): TerrainType {
  if (elevation < 0.18) {
    return "DEEP_OCEAN";
  }

  if (elevation < 0.34) {
    return "OCEAN";
  }

  if (elevation < SEA_LEVEL) {
    return "SHALLOW_SEA";
  }

  if (elevation < 0.46) {
    return "BEACH";
  }

  if (elevation >= 0.68 && ruggedness <= 0.32 && tectonicActivity <= 0.7) {
    return "PLATEAU";
  }

  if (elevation < 0.63) {
    return "PLAINS";
  }

  if (elevation < 0.75) {
    return "HILLS";
  }

  if (elevation < 0.88) {
    return "MOUNTAINS";
  }

  return "HIGH_MOUNTAINS";
}

function isOceanTerrain(terrainType: TerrainType): boolean {
  return OCEAN_TYPES.has(terrainType);
}

function isLandTerrain(terrainType: TerrainType): boolean {
  return !isOceanTerrain(terrainType);
}

function buildTerrainDistribution(): TerrainDistribution {
  return Object.fromEntries(
    TERRAIN_TYPES.map((terrainType) => [terrainType, 0]),
  ) as TerrainDistribution;
}

function estimateLargestRegion(
  cells: readonly TerrainGridCell[],
  grid: SpatialGrid,
  predicate: (cell: TerrainGridCell) => boolean,
): number {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const visited = new Set<string>();
  let largest = 0;

  for (const cell of cells) {
    if (visited.has(cell.id) || !predicate(cell)) {
      continue;
    }

    const queue = [cell.id];
    visited.add(cell.id);
    let size = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const current = byId.get(queue[index]);

      if (!current) {
        continue;
      }

      size += 1;

      for (const neighbor of grid.getNeighbors(current.id)) {
        const terrainNeighbor = byId.get(neighbor.id);

        if (!terrainNeighbor || visited.has(terrainNeighbor.id) || !predicate(terrainNeighbor)) {
          continue;
        }

        visited.add(terrainNeighbor.id);
        queue.push(terrainNeighbor.id);
      }
    }

    largest = Math.max(largest, size);
  }

  return largest;
}

function getLandLatitudeClass(latitude: number): "polar" | "temperate" | "tropical" | "subtropical" {
  const absoluteLatitude = Math.abs(latitude);

  if (absoluteLatitude >= 66.5) {
    return "polar";
  }

  if (absoluteLatitude < 20) {
    return "tropical";
  }

  if (absoluteLatitude <= 35) {
    return "subtropical";
  }

  return "temperate";
}

function buildTerrainSummary(cells: readonly TerrainGridCell[], grid: SpatialGrid): TerrainSummary {
  const distribution = buildTerrainDistribution();
  let highestElevation = 0;
  let lowestElevation = 1;
  let elevationTotal = 0;
  let landCells = 0;
  let polarLandCells = 0;
  let temperateLandCells = 0;
  let tropicalLandCells = 0;
  let subtropicalLandCells = 0;
  let mountainCells = 0;
  let coastlineCells = 0;

  for (const cell of cells) {
    distribution[cell.terrainType] += 1;
    highestElevation = Math.max(highestElevation, cell.elevation);
    lowestElevation = Math.min(lowestElevation, cell.elevation);
    elevationTotal += cell.elevation;

    if (isLandTerrain(cell.terrainType)) {
      landCells += 1;

      switch (getLandLatitudeClass(cell.midpointLatitude)) {
        case "polar":
          polarLandCells += 1;
          break;
        case "temperate":
          temperateLandCells += 1;
          break;
        case "tropical":
          tropicalLandCells += 1;
          break;
        case "subtropical":
          subtropicalLandCells += 1;
          break;
      }
    }

    if (MOUNTAIN_TYPES.has(cell.terrainType)) {
      mountainCells += 1;
    }

    if (cell.isCoast) {
      coastlineCells += 1;
    }
  }

  const cellCount = cells.length;
  const landDenominator = Math.max(landCells, 1);

  return Object.freeze({
    cellCount,
    highestElevation: round(highestElevation),
    lowestElevation: round(lowestElevation),
    averageElevation: round(elevationTotal / Math.max(cellCount, 1)),
    landPercent: round((landCells / Math.max(cellCount, 1)) * 100, 2),
    oceanPercent: round(((cellCount - landCells) / Math.max(cellCount, 1)) * 100, 2),
    polarLandPercent: round((polarLandCells / landDenominator) * 100, 2),
    temperateLandPercent: round((temperateLandCells / landDenominator) * 100, 2),
    tropicalLandPercent: round((tropicalLandCells / landDenominator) * 100, 2),
    subtropicalLandPercent: round((subtropicalLandCells / landDenominator) * 100, 2),
    habitableLandPercent: round(((temperateLandCells + subtropicalLandCells) / landDenominator) * 100, 2),
    mountainPercent: round((mountainCells / Math.max(cellCount, 1)) * 100, 2),
    coastlineCells,
    terrainDistribution: Object.freeze(distribution),
    largestContinentEstimate: estimateLargestRegion(cells, grid, (cell) => isLandTerrain(cell.terrainType)),
    largestOceanEstimate: estimateLargestRegion(cells, grid, (cell) => isOceanTerrain(cell.terrainType)),
  });
}

function requireTerrainSeed(world: TerrainWorldSource): string {
  const seed = world.seed?.trim();

  if (!seed) {
    throw new Error("Terrain generation requires a world seed.");
  }

  return seed;
}

function deriveTerrainSeed(seed: string, attempt: number): string {
  return attempt === 0 ? seed : `${seed}:terrain-validation:${attempt}`;
}

function validateTerrainSummary(summary: TerrainSummary): readonly string[] {
  const violations: string[] = [];
  const landCells = Math.round((summary.landPercent / 100) * summary.cellCount);
  const oceanCells = summary.cellCount - landCells;

  if (summary.oceanPercent < 60 || summary.oceanPercent > 75) {
    violations.push("ocean percentage outside 60-75 percent");
  }

  if (summary.landPercent < 25 || summary.landPercent > 40) {
    violations.push("land percentage outside 25-40 percent");
  }

  if (summary.polarLandPercent >= 15) {
    violations.push("polar land is 15 percent or more of total land");
  }

  if (summary.habitableLandPercent <= 60) {
    violations.push("temperate plus subtropical land is 60 percent or less of total land");
  }

  if (summary.largestContinentEstimate < Math.max(8, Math.floor(landCells * 0.08))) {
    violations.push("largest continent is too fragmented");
  }

  if (summary.largestContinentEstimate > Math.max(1, Math.floor(landCells * 0.72))) {
    violations.push("largest continent is too dominant");
  }

  if (summary.largestOceanEstimate < Math.max(24, Math.floor(oceanCells * 0.35))) {
    violations.push("largest ocean is too fragmented");
  }

  return Object.freeze(violations);
}

function buildTerrainStateForSeed(
  world: TerrainWorldSource,
  seed: string,
  terrainSeed: string,
  attempt: number,
  grid: SpatialGrid,
): TerrainState {
  const centers = buildContinentalCenters(terrainSeed);
  const baseCells = Array.from(grid.iterateCells());
  const baseValues = baseCells.map((cell) => {
    const x = (cell.midpointLongitude + 180) / 360;
    const y = (cell.midpointLatitude + 90) / 180;
    const continentalness = getContinentalness(terrainSeed, cell, centers);
    const tectonicActivity = getTectonicActivity(terrainSeed, cell, continentalness);
    const continentalNoise = fractalNoise(terrainSeed, "continental-detail", x, y, [2, 4, 8]);
    const localDetail = fractalNoise(terrainSeed, "local-detail", x, y, [8, 16, 32]);
    const mountainLift = smoothstep(0.46, 0.88, continentalness)
      * smoothstep(0.54, 0.86, tectonicActivity)
      * 0.32;
    const rawElevation = continentalness * 0.78
      + continentalNoise * 0.1
      + localDetail * 0.045
      + mountainLift;

    return {
      cell,
      continentalness,
      rawElevation,
      tectonicActivity,
    };
  });
  const rawElevations = baseValues.map((value) => value.rawElevation);
  const seaLevel = quantile(rawElevations, targetOceanCoverage(world));
  const minimumRawElevation = Math.min(...rawElevations);
  const maximumRawElevation = Math.max(...rawElevations);
  const byId = new Map<string, RawTerrainCell>();

  for (const value of baseValues) {
    const elevation = scaleElevation(
      value.rawElevation,
      seaLevel,
      minimumRawElevation,
      maximumRawElevation,
    );

    byId.set(value.cell.id, {
      ...value.cell,
      elevation,
      continentalness: value.continentalness,
      ruggedness: 0,
      tectonicActivity: value.tectonicActivity,
      terrainType: "PLAINS",
      isCoast: false,
    });
  }

  const ruggednessValues = new Map<string, number>();
  let highestRuggedness = 0;

  for (const cell of byId.values()) {
    const neighbors = grid.getNeighbors(cell.id)
      .map((neighbor) => byId.get(neighbor.id))
      .filter((neighbor): neighbor is RawTerrainCell => Boolean(neighbor));
    const localVariation = neighbors.reduce(
      (total, neighbor) => total + Math.abs(cell.elevation - neighbor.elevation),
      0,
    ) / Math.max(neighbors.length, 1);

    ruggednessValues.set(cell.id, localVariation);
    highestRuggedness = Math.max(highestRuggedness, localVariation);
  }

  for (const cell of byId.values()) {
    cell.ruggedness = round(clamp(
      (ruggednessValues.get(cell.id) ?? 0) / Math.max(highestRuggedness, 0.000001),
      0,
      1,
    ));
    cell.terrainType = classifyTerrain(cell.elevation, cell.ruggedness, cell.tectonicActivity);
  }

  for (const cell of byId.values()) {
    if (!isLandTerrain(cell.terrainType)) {
      continue;
    }

    cell.isCoast = grid.getNeighbors(cell.id).some((neighbor) => {
      const terrainNeighbor = byId.get(neighbor.id);
      return terrainNeighbor ? isOceanTerrain(terrainNeighbor.terrainType) : false;
    });
  }

  const cells = Object.freeze(
    Array.from(byId.values(), (cell) => Object.freeze({ ...cell })),
  );
  const summary = buildTerrainSummary(cells, grid);
  const violations = validateTerrainSummary(summary);

  return Object.freeze({
    seed,
    terrainSeed,
    cells,
    summary,
    validation: Object.freeze({
      valid: violations.length === 0,
      attempt,
      violations,
    }),
  });
}

export function getTerrainState(
  world: TerrainWorldSource,
  grid: SpatialGrid = createGrid(),
): TerrainState {
  return getCachedDeterministic("terrain-state", world, grid, () => {
    const seed = requireTerrainSeed(world);

    for (let attempt = 0; attempt < MAX_TERRAIN_VALIDATION_ATTEMPTS; attempt += 1) {
      const terrainSeed = deriveTerrainSeed(seed, attempt);
      const terrainState = buildTerrainStateForSeed(world, seed, terrainSeed, attempt, grid);

      if (terrainState.validation.valid) {
        return terrainState;
      }
    }

    throw new Error(`Terrain validation failed after ${MAX_TERRAIN_VALIDATION_ATTEMPTS} deterministic attempts.`);
  });
}
export function getTerrainGrid(
  world: TerrainWorldSource,
  grid: SpatialGrid = createGrid(),
): readonly TerrainGridCell[] {
  return getTerrainState(world, grid).cells;
}

export function getTerrainGridCell(
  world: TerrainWorldSource,
  cell: GridCell,
): TerrainGridCell {
  const grid = createGrid();
  const terrainCell = getTerrainState(world, grid).cells.find((entry) => entry.id === cell.id);

  if (!terrainCell) {
    throw new Error(`Terrain cell not found: ${cell.id}`);
  }

  return terrainCell;
}

export function getTerrainSummary(
  world: TerrainWorldSource,
  grid: SpatialGrid = createGrid(),
): TerrainSummary {
  return getTerrainState(world, grid).summary;
}
