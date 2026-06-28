import type { World } from "@prisma/client";

import { getClimateGrid, type ClimateGridCell } from "./climate-engine";
import { getCachedDeterministic } from "./deterministic-cache";
import type { GridCell } from "./grid/cell";
import { createGrid, type SpatialGrid } from "./grid/grid";
import {
  getTerrainState,
  type TerrainGridCell,
  type TerrainType,
} from "./terrain-engine";

export const WATER_BODY_TYPES = [
  "DEEP_OCEAN",
  "OCEAN",
  "SHALLOW_SEA",
  "COASTAL_WATER",
  "INLAND_BASIN",
  "LAKE_CANDIDATE",
  "RIVER_SOURCE_CANDIDATE",
  "RIVER_CHANNEL_CANDIDATE",
  "DRY_LAND",
] as const;

export type WaterBodyType = (typeof WATER_BODY_TYPES)[number];

export type DrainageDirection =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW"
  | "OCEAN"
  | "INLAND_BASIN";

export type HydrologyGridCell = GridCell & {
  readonly isOcean: boolean;
  readonly isSea: boolean;
  readonly isLakeCandidate: boolean;
  readonly isRiverCandidate: boolean;
  readonly waterBodyType: WaterBodyType;
  readonly drainageDirection: DrainageDirection;
  readonly drainageTargetId: string | null;
  readonly basinId: string | null;
  readonly watershedId: string;
  readonly flowAccumulation: number;
  readonly moisturePotential: number;
  readonly distanceToOcean: number;
  readonly distanceToCoast: number;
};

export type HydrologySummary = {
  readonly cellCount: number;
  readonly oceanCells: number;
  readonly landCells: number;
  readonly coastalWaterCells: number;
  readonly inlandBasinCount: number;
  readonly lakeCandidateCount: number;
  readonly riverSourceCandidateCount: number;
  readonly riverChannelCandidateCount: number;
  readonly averageMoisturePotential: number;
  readonly largestWatershedEstimate: number;
  readonly largestBasinEstimate: number;
};

export type HydrologyState = {
  readonly seed: string;
  readonly cells: readonly HydrologyGridCell[];
  readonly summary: HydrologySummary;
};

type HydrologyWorldSource = Pick<
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

type MutableHydrologyField =
  | "waterBodyType"
  | "isLakeCandidate"
  | "isRiverCandidate"
  | "basinId"
  | "watershedId"
  | "flowAccumulation";

type DraftHydrologyCell = Omit<HydrologyGridCell, MutableHydrologyField> & {
  elevation: number;
  waterBodyType: WaterBodyType;
  isLakeCandidate: boolean;
  isRiverCandidate: boolean;
  basinId: string | null;
  watershedId: string;
  flowAccumulation: number;
};

type Outlet =
  | { kind: "ocean"; id: string }
  | { kind: "basin"; id: string };

const OCEAN_TERRAIN_TYPES = new Set<TerrainType>(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);
const EPSILON = 0.000001;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function quantile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const index = clamp(Math.floor((sortedValues.length - 1) * percentile), 0, sortedValues.length - 1);

  return sortedValues[index] ?? 0;
}

function isOceanTerrain(terrainType: TerrainType): boolean {
  return OCEAN_TERRAIN_TYPES.has(terrainType);
}

function isLandTerrain(terrainType: TerrainType): boolean {
  return !isOceanTerrain(terrainType);
}

function hasLandNeighbor(cell: TerrainGridCell, terrainById: Map<string, TerrainGridCell>, grid: SpatialGrid): boolean {
  return grid.getNeighbors(cell.id).some((neighbor) => {
    const terrainNeighbor = terrainById.get(neighbor.id);
    return terrainNeighbor ? isLandTerrain(terrainNeighbor.terrainType) : false;
  });
}

function classifyMarineWater(
  cell: TerrainGridCell,
  terrainById: Map<string, TerrainGridCell>,
  grid: SpatialGrid,
): WaterBodyType {
  if (cell.terrainType === "DEEP_OCEAN") {
    return "DEEP_OCEAN";
  }

  if (hasLandNeighbor(cell, terrainById, grid)) {
    return "COASTAL_WATER";
  }

  if (cell.terrainType === "SHALLOW_SEA") {
    return "SHALLOW_SEA";
  }

  return "OCEAN";
}

function getDrainageDirection(cell: GridCell, target: GridCell, longitudeDivisions: number): DrainageDirection {
  const rowDelta = target.row - cell.row;
  const eastDelta = (target.column - cell.column + longitudeDivisions) % longitudeDivisions;
  const columnDelta = eastDelta > longitudeDivisions / 2 ? eastDelta - longitudeDivisions : eastDelta;
  const northSouth = rowDelta > 0 ? "N" : rowDelta < 0 ? "S" : "";
  const eastWest = columnDelta > 0 ? "E" : columnDelta < 0 ? "W" : "";

  return `${northSouth}${eastWest}` as DrainageDirection;
}

function findLowestDownhillNeighbor(
  cell: TerrainGridCell,
  terrainById: Map<string, TerrainGridCell>,
  grid: SpatialGrid,
): TerrainGridCell | null {
  const lowerNeighbors = grid.getNeighbors(cell.id)
    .map((neighbor) => terrainById.get(neighbor.id))
    .filter((neighbor): neighbor is TerrainGridCell => Boolean(neighbor))
    .filter((neighbor) => neighbor.elevation < cell.elevation - EPSILON)
    .sort((left, right) => left.elevation - right.elevation || left.id.localeCompare(right.id));

  return lowerNeighbors[0] ?? null;
}

function buildDistanceField(
  grid: SpatialGrid,
  sourceIds: readonly string[],
): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: string[] = [];

  for (const cell of grid.iterateCells()) {
    distances.set(cell.id, Number.POSITIVE_INFINITY);
  }

  for (const sourceId of [...new Set(sourceIds)].sort()) {
    if (!distances.has(sourceId)) {
      continue;
    }

    distances.set(sourceId, 0);
    queue.push(sourceId);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    const nextDistance = (distances.get(currentId) ?? 0) + 1;

    for (const neighbor of grid.getNeighbors(currentId)) {
      if (nextDistance >= (distances.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      distances.set(neighbor.id, nextDistance);
      queue.push(neighbor.id);
    }
  }

  return distances;
}

function getMoisturePotential(
  climateCell: ClimateGridCell,
  distanceToOcean: number,
  distanceToCoast: number,
  marine: boolean,
): number {
  const oceanInfluence = Math.exp(-distanceToOcean / 5);
  const coastalInfluence = Math.exp(-distanceToCoast / 3);
  const temperatureHumidity = clamp((climateCell.averageTemperatureC + 12) / 42, 0, 1);
  const daylightModeration = 1 - Math.abs(climateCell.daylightHours - 12) / 12;
  const marineBonus = marine ? 0.18 : 0;

  return round(clamp(
    oceanInfluence * 0.42
      + coastalInfluence * 0.24
      + temperatureHumidity * 0.22
      + daylightModeration * 0.12
      + marineBonus,
    0,
    1,
  ));
}

function resolveOutlet(
  cellId: string,
  cellsById: Map<string, DraftHydrologyCell>,
  outletCache: Map<string, Outlet>,
): Outlet {
  const cached = outletCache.get(cellId);

  if (cached) {
    return cached;
  }

  const visited: string[] = [];
  let current = cellsById.get(cellId);

  while (current) {
    visited.push(current.id);

    if (current.isOcean || current.isSea) {
      const outlet: Outlet = { kind: "ocean", id: current.id };
      for (const visitedId of visited) {
        outletCache.set(visitedId, outlet);
      }

      return outlet;
    }

    if (!current.drainageTargetId) {
      const outlet: Outlet = { kind: "basin", id: current.id };
      for (const visitedId of visited) {
        outletCache.set(visitedId, outlet);
      }

      return outlet;
    }

    current = cellsById.get(current.drainageTargetId);
  }

  const fallback: Outlet = { kind: "basin", id: cellId };
  outletCache.set(cellId, fallback);

  return fallback;
}

function countLargestGroup(values: Iterable<string | null>): number {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Math.max(0, ...counts.values());
}

function buildHydrologySummary(cells: readonly HydrologyGridCell[]): HydrologySummary {
  const oceanCells = cells.filter((cell) => cell.isOcean || cell.isSea).length;
  const basinIds = new Set(cells.map((cell) => cell.basinId).filter((value): value is string => Boolean(value)));
  const moistureTotal = cells.reduce((total, cell) => total + cell.moisturePotential, 0);

  return Object.freeze({
    cellCount: cells.length,
    oceanCells,
    landCells: cells.length - oceanCells,
    coastalWaterCells: cells.filter((cell) => cell.waterBodyType === "COASTAL_WATER").length,
    inlandBasinCount: basinIds.size,
    lakeCandidateCount: cells.filter((cell) => cell.isLakeCandidate).length,
    riverSourceCandidateCount: cells.filter((cell) => cell.waterBodyType === "RIVER_SOURCE_CANDIDATE").length,
    riverChannelCandidateCount: cells.filter((cell) => cell.waterBodyType === "RIVER_CHANNEL_CANDIDATE").length,
    averageMoisturePotential: round(moistureTotal / Math.max(cells.length, 1)),
    largestWatershedEstimate: countLargestGroup(cells.map((cell) => cell.watershedId)),
    largestBasinEstimate: countLargestGroup(cells.map((cell) => cell.basinId)),
  });
}

function requireHydrologySeed(world: HydrologyWorldSource): string {
  const seed = world.seed?.trim();

  if (!seed) {
    throw new Error("Hydrology generation requires a world seed.");
  }

  return seed;
}

export function getHydrologyState(
  world: HydrologyWorldSource,
  grid: SpatialGrid = createGrid(),
): HydrologyState {
  return getCachedDeterministic("hydrology-state", world, grid, () => {
    const seed = requireHydrologySeed(world);
    const terrainState = getTerrainState(world, grid);
    const terrainById = new Map(terrainState.cells.map((cell) => [cell.id, cell]));
    const climateById = new Map(getClimateGrid(world, grid).map((cell) => [cell.id, cell]));
    const oceanSourceIds = terrainState.cells
      .filter((cell) => isOceanTerrain(cell.terrainType))
      .map((cell) => cell.id);
    const coastSourceIds = terrainState.cells
      .filter((cell) => cell.isCoast || (isOceanTerrain(cell.terrainType) && hasLandNeighbor(cell, terrainById, grid)))
      .map((cell) => cell.id);
    const distanceToOceanById = buildDistanceField(grid, oceanSourceIds);
    const distanceToCoastById = buildDistanceField(grid, coastSourceIds.length > 0 ? coastSourceIds : oceanSourceIds);
    const cellsById = new Map<string, DraftHydrologyCell>();

  for (const terrainCell of terrainState.cells) {
    const climateCell = climateById.get(terrainCell.id);

    if (!climateCell) {
      throw new Error(`Climate cell not found for hydrology: ${terrainCell.id}`);
    }

    const marine = isOceanTerrain(terrainCell.terrainType);
    const waterBodyType = marine
      ? classifyMarineWater(terrainCell, terrainById, grid)
      : "DRY_LAND";
    const target = marine ? null : findLowestDownhillNeighbor(terrainCell, terrainById, grid);
    const distanceToOcean = distanceToOceanById.get(terrainCell.id) ?? Number.POSITIVE_INFINITY;
    const distanceToCoast = distanceToCoastById.get(terrainCell.id) ?? Number.POSITIVE_INFINITY;

    cellsById.set(terrainCell.id, {
      ...terrainCell,
      isOcean: waterBodyType === "DEEP_OCEAN" || waterBodyType === "OCEAN",
      isSea: waterBodyType === "SHALLOW_SEA" || waterBodyType === "COASTAL_WATER",
      isLakeCandidate: false,
      isRiverCandidate: false,
      waterBodyType,
      drainageDirection: marine
        ? "OCEAN"
        : target
          ? getDrainageDirection(terrainCell, target, grid.summary.longitudeDivisions)
          : "INLAND_BASIN",
      drainageTargetId: target?.id ?? null,
      basinId: null,
      watershedId: marine ? `watershed:ocean:${terrainCell.id}` : `watershed:pending:${terrainCell.id}`,
      flowAccumulation: marine ? 0 : 1,
      moisturePotential: getMoisturePotential(climateCell, distanceToOcean, distanceToCoast, marine),
      distanceToOcean,
      distanceToCoast,
    });
  }

  const downhillLandCells = [...cellsById.values()]
    .filter((cell) => !cell.isOcean && !cell.isSea)
    .sort((left, right) => right.elevation - left.elevation || left.id.localeCompare(right.id));

  for (const cell of downhillLandCells) {
    if (!cell.drainageTargetId) {
      continue;
    }

    const target = cellsById.get(cell.drainageTargetId);

    if (!target) {
      continue;
    }

    target.flowAccumulation += cell.flowAccumulation;
  }

  const outletCache = new Map<string, Outlet>();
  for (const cell of cellsById.values()) {
    const outlet = resolveOutlet(cell.id, cellsById, outletCache);

    if (outlet.kind === "basin") {
      cell.basinId = `basin:${outlet.id}`;
      cell.watershedId = `watershed:basin:${outlet.id}`;
    } else {
      cell.basinId = null;
      cell.watershedId = `watershed:ocean:${outlet.id}`;
    }
  }

  const landCells = [...cellsById.values()].filter((cell) => !cell.isOcean && !cell.isSea);
  const flowingLandCells = landCells.filter((cell) => Boolean(cell.drainageTargetId));
  const flowThreshold = Math.max(4, quantile(flowingLandCells.map((cell) => cell.flowAccumulation), 0.88));
  const channelIds = new Set(
    flowingLandCells
      .filter((cell) => cell.flowAccumulation >= flowThreshold)
      .map((cell) => cell.id),
  );

  if (channelIds.size === 0) {
    const fallbackChannel = flowingLandCells
      .filter((cell) => cell.flowAccumulation > 1)
      .sort((left, right) => right.flowAccumulation - left.flowAccumulation || left.id.localeCompare(right.id))[0];

    if (fallbackChannel) {
      channelIds.add(fallbackChannel.id);
    }
  }

  const basinSinkCells = landCells.filter((cell) => !cell.drainageTargetId);
  const lakeIds = new Set(
    basinSinkCells
      .filter((cell) => cell.flowAccumulation >= 3 || cell.moisturePotential >= 0.45)
      .map((cell) => cell.id),
  );

  if (lakeIds.size === 0 && basinSinkCells.length > 0) {
    const fallbackLake = basinSinkCells
      .sort((left, right) => {
        const leftScore = left.flowAccumulation + left.moisturePotential * 3;
        const rightScore = right.flowAccumulation + right.moisturePotential * 3;
        return rightScore - leftScore || left.id.localeCompare(right.id);
      })[0];

    lakeIds.add(fallbackLake.id);
  }

  const sourceIds = new Set(
    landCells
      .filter((cell) => !channelIds.has(cell.id) && !lakeIds.has(cell.id))
      .filter((cell) => (
        cell.elevation >= 0.72
        || cell.moisturePotential >= 0.68
        || (cell.elevation >= 0.62 && cell.moisturePotential >= 0.52)
      ))
      .map((cell) => cell.id),
  );

  if (sourceIds.size === 0 && landCells.length > 0) {
    const fallbackSource = landCells
      .filter((cell) => !channelIds.has(cell.id) && !lakeIds.has(cell.id))
      .sort((left, right) => {
        const leftScore = left.elevation * 0.58 + left.moisturePotential * 0.42;
        const rightScore = right.elevation * 0.58 + right.moisturePotential * 0.42;
        return rightScore - leftScore || left.id.localeCompare(right.id);
      })[0];

    if (fallbackSource) {
      sourceIds.add(fallbackSource.id);
    }
  }

  for (const cell of cellsById.values()) {
    if (lakeIds.has(cell.id)) {
      cell.isLakeCandidate = true;
      cell.waterBodyType = "LAKE_CANDIDATE";
    } else if (!cell.isOcean && !cell.isSea && !cell.drainageTargetId) {
      cell.waterBodyType = "INLAND_BASIN";
    } else if (channelIds.has(cell.id)) {
      cell.isRiverCandidate = true;
      cell.waterBodyType = "RIVER_CHANNEL_CANDIDATE";
    } else if (sourceIds.has(cell.id)) {
      cell.isRiverCandidate = true;
      cell.waterBodyType = "RIVER_SOURCE_CANDIDATE";
    }

    cell.flowAccumulation = round(cell.flowAccumulation, 0);
  }

  const cells = Object.freeze(
    [...cellsById.values()]
      .sort((left, right) => left.row - right.row || left.column - right.column)
      .map((cell) => Object.freeze({ ...cell })),
  );

    return Object.freeze({
      seed,
      cells,
      summary: buildHydrologySummary(cells),
    });
  });
}

export function getHydrologyGrid(
  world: HydrologyWorldSource,
  grid: SpatialGrid = createGrid(),
): readonly HydrologyGridCell[] {
  return getHydrologyState(world, grid).cells;
}

export function getHydrologyGridCell(
  world: HydrologyWorldSource,
  cell: GridCell,
): HydrologyGridCell {
  const grid = createGrid();
  const hydrologyCell = getHydrologyState(world, grid).cells.find((entry) => entry.id === cell.id);

  if (!hydrologyCell) {
    throw new Error(`Hydrology cell not found: ${cell.id}`);
  }

  return hydrologyCell;
}

export function getHydrologySummary(
  world: HydrologyWorldSource,
  grid: SpatialGrid = createGrid(),
): HydrologySummary {
  return getHydrologyState(world, grid).summary;
}
