import type { World } from "@prisma/client";

import { getAstronomyStateAtTick, type AstronomyState } from "./astronomy-engine";
import { getClimateGridAtTick, type ClimateGridCell } from "./climate-engine";
import { getCachedDeterministic } from "./deterministic-cache";
import type { GridCell } from "./grid/cell";
import { createGrid, type SpatialGrid } from "./grid/grid";
import { getHydrologyState, type HydrologyGridCell } from "./hydrology-engine";
import { getPlanetState } from "./planet-engine";
import { getTerrainState, type TerrainGridCell, type TerrainType } from "./terrain-engine";

export const PRESSURE_ZONES = [
  "EQUATORIAL_LOW",
  "SUBTROPICAL_HIGH",
  "TEMPERATE_LOW",
  "POLAR_HIGH",
  "TRANSITION",
] as const;

export type PressureZone = (typeof PRESSURE_ZONES)[number];

export const WIND_DIRECTIONS = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
  "CALM",
] as const;

export type WindDirection = (typeof WIND_DIRECTIONS)[number];

export type AtmosphericGridCell = GridCell & {
  readonly pressureZone: PressureZone;
  readonly pressureValue: number;
  readonly windDirection: WindDirection;
  readonly windStrength: number;
  readonly temperatureGradient: number;
  readonly moistureTransportPotential: number;
  readonly orographicLiftPotential: number;
  readonly rainShadowPotential: number;
  readonly atmosphericStability: number;
  readonly seasonalShift: number;
};

export type PressureBandDistribution = Record<PressureZone, number>;

export type StrongestWindCell = {
  readonly cellId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly windDirection: WindDirection;
  readonly windStrength: number;
};

export type AtmosphericSummary = {
  readonly cellCount: number;
  readonly pressureBandDistribution: PressureBandDistribution;
  readonly averageWindSpeed: number;
  readonly averageMoistureTransport: number;
  readonly strongestWinds: readonly StrongestWindCell[];
  readonly largestRainShadowRegion: number;
  readonly averageAtmosphericStability: number;
  readonly dominantCirculationPattern: string;
  readonly seasonalCirculationPhase: string;
  readonly seasonalShiftDegrees: number;
};

export type AtmosphereState = {
  readonly tick: string;
  readonly cells: readonly AtmosphericGridCell[];
  readonly summary: AtmosphericSummary;
};

type AtmosphereWorldSource = Pick<
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

type DraftAtmosphericCell = AtmosphericGridCell & {
  elevation: number;
  terrainType: TerrainType;
  isCoast: boolean;
  ruggedness: number;
  moisturePotential: number;
  distanceToOcean: number;
  distanceToCoast: number;
  averageTemperatureC: number;
};

type DirectionOffset = {
  readonly row: number;
  readonly column: number;
};

const PRESSURE_ZONE_BASE_VALUES: Record<PressureZone, number> = {
  EQUATORIAL_LOW: 0.24,
  SUBTROPICAL_HIGH: 0.78,
  TEMPERATE_LOW: 0.38,
  POLAR_HIGH: 0.72,
  TRANSITION: 0.52,
};

const OCEAN_TERRAIN_TYPES = new Set<TerrainType>(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);
const MOUNTAIN_TERRAIN_TYPES = new Set<TerrainType>(["MOUNTAINS", "HIGH_MOUNTAINS", "PLATEAU"]);

const WIND_DIRECTION_OFFSETS: Record<Exclude<WindDirection, "CALM">, DirectionOffset> = {
  N: { row: 1, column: 0 },
  NE: { row: 1, column: 1 },
  E: { row: 0, column: 1 },
  SE: { row: -1, column: 1 },
  S: { row: -1, column: 0 },
  SW: { row: -1, column: -1 },
  W: { row: 0, column: -1 },
  NW: { row: 1, column: -1 },
};

const OPPOSITE_DIRECTION: Record<Exclude<WindDirection, "CALM">, Exclude<WindDirection, "CALM">> = {
  N: "S",
  NE: "SW",
  E: "W",
  SE: "NW",
  S: "N",
  SW: "NE",
  W: "E",
  NW: "SE",
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function normalizeSeasonalShift(astronomy: AstronomyState): number {
  const tiltScale = astronomy.axialTiltDegrees > 0 ? clamp(astronomy.axialTiltDegrees / 23.44, 0, 2) : 0;
  return round(astronomy.solarDeclinationDegrees * 0.42 * tiltScale, 4);
}

function relativeLatitude(latitude: number, seasonalShift: number): number {
  return clamp(latitude - seasonalShift, -90, 90);
}

function pressureZoneForLatitude(latitude: number, seasonalShift: number): PressureZone {
  const absoluteLatitude = Math.abs(relativeLatitude(latitude, seasonalShift));

  if (absoluteLatitude <= 8) {
    return "EQUATORIAL_LOW";
  }

  if (absoluteLatitude >= 76) {
    return "POLAR_HIGH";
  }

  if (absoluteLatitude >= 24 && absoluteLatitude <= 38) {
    return "SUBTROPICAL_HIGH";
  }

  if (absoluteLatitude >= 52 && absoluteLatitude <= 68) {
    return "TEMPERATE_LOW";
  }

  return "TRANSITION";
}

function distanceToBandCenter(latitude: number, seasonalShift: number, zone: PressureZone): number {
  const shiftedLatitude = relativeLatitude(latitude, seasonalShift);
  const absoluteLatitude = Math.abs(shiftedLatitude);

  switch (zone) {
    case "EQUATORIAL_LOW":
      return absoluteLatitude / 8;
    case "SUBTROPICAL_HIGH":
      return Math.abs(absoluteLatitude - 31) / 7;
    case "TEMPERATE_LOW":
      return Math.abs(absoluteLatitude - 60) / 8;
    case "POLAR_HIGH":
      return Math.max(0, 90 - absoluteLatitude) / 14;
    case "TRANSITION":
      return 0.85;
  }
}

function getPressureValue(
  cell: GridCell,
  zone: PressureZone,
  terrainCell: TerrainGridCell,
  climateCell: ClimateGridCell,
  seasonalShift: number,
): number {
  const bandCenterInfluence = 1 - clamp(distanceToBandCenter(cell.midpointLatitude, seasonalShift, zone), 0, 1);
  const basePressure = PRESSURE_ZONE_BASE_VALUES[zone];
  const highMountainCooling = MOUNTAIN_TERRAIN_TYPES.has(terrainCell.terrainType) ? 0.03 : 0;
  const temperaturePerturbation = clamp((15 - climateCell.averageTemperatureC) / 100, -0.06, 0.06);
  const elevationPerturbation = terrainCell.elevation >= 0.42 ? -terrainCell.elevation * 0.05 : 0.02;
  const centerPerturbation = zone === "TRANSITION"
    ? 0
    : (basePressure >= 0.5 ? 0.08 : -0.08) * bandCenterInfluence;

  return round(clamp(
    basePressure
      + centerPerturbation
      + temperaturePerturbation
      + elevationPerturbation
      + highMountainCooling,
    0,
    1,
  ));
}

function isNorthern(latitude: number): boolean {
  return latitude >= 0;
}

function baseWindDirection(latitude: number, seasonalShift: number, zone: PressureZone): WindDirection {
  const shiftedLatitude = relativeLatitude(latitude, seasonalShift);
  const absoluteLatitude = Math.abs(shiftedLatitude);
  const northern = isNorthern(shiftedLatitude);

  if (absoluteLatitude < 4) {
    return "CALM";
  }

  if (absoluteLatitude < 30 || zone === "EQUATORIAL_LOW") {
    return northern ? "SW" : "NW";
  }

  if (absoluteLatitude < 60 || zone === "SUBTROPICAL_HIGH" || zone === "TEMPERATE_LOW") {
    return northern ? "NE" : "SE";
  }

  return northern ? "SW" : "NW";
}

function rotateWindForTerrain(
  direction: WindDirection,
  terrainCell: TerrainGridCell,
  hydrologyCell: HydrologyGridCell,
  latitude: number,
): WindDirection {
  if (direction === "CALM") {
    return direction;
  }

  if (MOUNTAIN_TERRAIN_TYPES.has(terrainCell.terrainType) && terrainCell.ruggedness >= 0.55) {
    if (direction === "NE") {
      return "E";
    }

    if (direction === "SE") {
      return "E";
    }

    if (direction === "NW") {
      return "W";
    }

    if (direction === "SW") {
      return "W";
    }
  }

  if (terrainCell.isCoast || hydrologyCell.distanceToCoast <= 1) {
    if (Math.abs(latitude) <= 35) {
      return isNorthern(latitude) ? "W" : "W";
    }

    if (Math.abs(latitude) >= 55) {
      return isNorthern(latitude) ? "SW" : "NW";
    }
  }

  return direction;
}

function getNeighborInDirection(
  grid: SpatialGrid,
  cell: GridCell,
  direction: Exclude<WindDirection, "CALM">,
): GridCell | null {
  const offset = WIND_DIRECTION_OFFSETS[direction];
  const targetRow = cell.row + offset.row;

  if (targetRow < 0 || targetRow >= grid.summary.latitudeDivisions) {
    return null;
  }

  const targetColumn = (
    cell.column + offset.column + grid.summary.longitudeDivisions
  ) % grid.summary.longitudeDivisions;

  return grid.getCell(`cell-${targetRow.toString().padStart(2, "0")}-${targetColumn.toString().padStart(2, "0")}`) ?? null;
}

function getTemperatureGradient(
  climateCell: ClimateGridCell,
  climateById: Map<string, ClimateGridCell>,
  grid: SpatialGrid,
): number {
  const neighborTemperatures = grid.getNeighbors(climateCell.id)
    .map((neighbor) => climateById.get(neighbor.id)?.averageTemperatureC)
    .filter((value): value is number => Number.isFinite(value));

  if (neighborTemperatures.length === 0) {
    return 0;
  }

  const averageDelta = neighborTemperatures.reduce(
    (total, temperature) => total + Math.abs(climateCell.averageTemperatureC - temperature),
    0,
  ) / neighborTemperatures.length;

  return round(averageDelta, 3);
}

function getWindStrength(
  cell: GridCell,
  zone: PressureZone,
  pressureValue: number,
  temperatureGradient: number,
  terrainCell: TerrainGridCell,
  hydrologyCell: HydrologyGridCell,
): number {
  const latitude = Math.abs(cell.midpointLatitude);
  const bandEnergy = zone === "TRANSITION" ? 0.24 : 0.42;
  const pressureEnergy = Math.abs(pressureValue - 0.5) * 0.82;
  const thermalEnergy = clamp(temperatureGradient / 18, 0, 0.28);
  const latitudeEnergy = Math.sin((latitude / 90) * Math.PI) * 0.12;
  const coastalChanneling = terrainCell.isCoast || hydrologyCell.distanceToCoast <= 1 ? 0.08 : 0;
  const terrainDrag = terrainCell.ruggedness * 0.16 + terrainCell.elevation * 0.08;

  return round(clamp(
    bandEnergy + pressureEnergy + thermalEnergy + latitudeEnergy + coastalChanneling - terrainDrag,
    0,
    1,
  ));
}

function getMoistureTransportPotential(
  climateCell: ClimateGridCell,
  terrainCell: TerrainGridCell,
  hydrologyCell: HydrologyGridCell,
  windStrength: number,
): number {
  const marine = OCEAN_TERRAIN_TYPES.has(terrainCell.terrainType);
  const oceanInfluence = Math.exp(-hydrologyCell.distanceToOcean / 5.5);
  const coastalInfluence = Math.exp(-hydrologyCell.distanceToCoast / 3);
  const thermalCapacity = clamp((climateCell.averageTemperatureC + 15) / 45, 0, 1);
  const marineBonus = marine ? 0.22 : 0;
  const inlandDrying = clamp(hydrologyCell.distanceToCoast / 16, 0, 0.3);

  return round(clamp(
    hydrologyCell.moisturePotential * 0.36
      + oceanInfluence * 0.24
      + coastalInfluence * 0.16
      + thermalCapacity * 0.12
      + windStrength * 0.12
      + marineBonus
      - inlandDrying,
    0,
    1,
  ));
}

function getAverageElevation(cells: Array<TerrainGridCell | undefined>): number {
  const terrainCells = cells.filter((cell): cell is TerrainGridCell => Boolean(cell));

  if (terrainCells.length === 0) {
    return 0;
  }

  return terrainCells.reduce((total, cell) => total + cell.elevation, 0) / terrainCells.length;
}

function getOrographicLiftPotential(
  cell: GridCell,
  windDirection: WindDirection,
  windStrength: number,
  terrainById: Map<string, TerrainGridCell>,
  grid: SpatialGrid,
): number {
  if (windDirection === "CALM") {
    return 0;
  }

  const terrainCell = terrainById.get(cell.id);
  const upwindCell = getNeighborInDirection(grid, cell, OPPOSITE_DIRECTION[windDirection]);

  if (!terrainCell || !upwindCell) {
    return 0;
  }

  const upwindTerrain = terrainById.get(upwindCell.id);
  const localAscent = terrainCell.elevation - (upwindTerrain?.elevation ?? terrainCell.elevation);
  const mountainBarrier = MOUNTAIN_TERRAIN_TYPES.has(terrainCell.terrainType) ? 0.28 : 0;
  const slopeLift = clamp(localAscent * 2.4, 0, 1);
  const ruggedLift = terrainCell.ruggedness * 0.34;

  return round(clamp((slopeLift + mountainBarrier + ruggedLift) * windStrength, 0, 1));
}

function getRainShadowPotential(
  cell: GridCell,
  windDirection: WindDirection,
  windStrength: number,
  terrainById: Map<string, TerrainGridCell>,
  grid: SpatialGrid,
): number {
  if (windDirection === "CALM") {
    return 0;
  }

  const terrainCell = terrainById.get(cell.id);
  const upwindCell = getNeighborInDirection(grid, cell, OPPOSITE_DIRECTION[windDirection]);
  const farUpwindCell = upwindCell
    ? getNeighborInDirection(grid, upwindCell, OPPOSITE_DIRECTION[windDirection])
    : null;

  if (!terrainCell || !upwindCell) {
    return 0;
  }

  const upwindTerrain = terrainById.get(upwindCell.id);
  const farUpwindTerrain = farUpwindCell ? terrainById.get(farUpwindCell.id) : undefined;
  const barrierElevation = Math.max(
    upwindTerrain?.elevation ?? 0,
    farUpwindTerrain?.elevation ?? 0,
  );
  const barrierRuggedness = Math.max(
    upwindTerrain?.ruggedness ?? 0,
    farUpwindTerrain?.ruggedness ?? 0,
  );
  const behindBarrier = barrierElevation > terrainCell.elevation + 0.06;
  const barrierMountain = [upwindTerrain, farUpwindTerrain]
    .filter((entry): entry is TerrainGridCell => Boolean(entry))
    .some((entry) => MOUNTAIN_TERRAIN_TYPES.has(entry.terrainType));

  if (!behindBarrier && !barrierMountain) {
    return 0;
  }

  const descent = clamp((barrierElevation - terrainCell.elevation) * 2.2, 0, 1);
  const barrierEffect = barrierMountain ? 0.26 : 0;

  return round(clamp((descent + barrierRuggedness * 0.28 + barrierEffect) * windStrength, 0, 1));
}

function getAtmosphericStability(
  zone: PressureZone,
  pressureValue: number,
  temperatureGradient: number,
  terrainCell: TerrainGridCell,
  moistureTransportPotential: number,
): number {
  const pressureStability = pressureValue >= 0.5 ? pressureValue : 1 - pressureValue;
  const bandStability = zone === "SUBTROPICAL_HIGH" || zone === "POLAR_HIGH" ? 0.24 : -0.14;
  const gradientInstability = clamp(temperatureGradient / 22, 0, 0.34);
  const terrainMixing = terrainCell.ruggedness * 0.12;
  const moistureMixing = moistureTransportPotential * 0.12;

  return round(clamp(
    0.46 + pressureStability * 0.32 + bandStability - gradientInstability - terrainMixing - moistureMixing,
    0,
    1,
  ));
}

function buildPressureBandDistribution(): PressureBandDistribution {
  return Object.fromEntries(PRESSURE_ZONES.map((zone) => [zone, 0])) as PressureBandDistribution;
}

function countLargestRainShadowRegion(cells: readonly AtmosphericGridCell[], grid: SpatialGrid): number {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const visited = new Set<string>();
  let largest = 0;

  for (const cell of cells) {
    if (visited.has(cell.id) || cell.rainShadowPotential < 0.35) {
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
        const atmosphericNeighbor = byId.get(neighbor.id);

        if (
          !atmosphericNeighbor
          || visited.has(atmosphericNeighbor.id)
          || atmosphericNeighbor.rainShadowPotential < 0.35
        ) {
          continue;
        }

        visited.add(atmosphericNeighbor.id);
        queue.push(atmosphericNeighbor.id);
      }
    }

    largest = Math.max(largest, size);
  }

  return largest;
}

function getDominantCirculationPattern(world: AtmosphereWorldSource): string {
  const planet = getPlanetState(world);
  const rotationHours = planet.rotationPeriodHours;

  if (rotationHours <= 16) {
    return "compressed three-cell circulation";
  }

  if (rotationHours >= 36) {
    return "broad three-cell circulation";
  }

  return "earthlike three-cell circulation";
}

function getSeasonalCirculationPhase(astronomy: AstronomyState, seasonalShift: number): string {
  if (Math.abs(seasonalShift) < 0.5) {
    return "equinox-centered circulation";
  }

  return seasonalShift > 0
    ? "northern-shifted circulation"
    : "southern-shifted circulation";
}

function buildAtmosphericSummary(
  world: AtmosphereWorldSource,
  astronomy: AstronomyState,
  cells: readonly AtmosphericGridCell[],
  grid: SpatialGrid,
  seasonalShift: number,
): AtmosphericSummary {
  const pressureBandDistribution = buildPressureBandDistribution();
  let totalWind = 0;
  let totalMoisture = 0;
  let totalStability = 0;

  for (const cell of cells) {
    pressureBandDistribution[cell.pressureZone] += 1;
    totalWind += cell.windStrength;
    totalMoisture += cell.moistureTransportPotential;
    totalStability += cell.atmosphericStability;
  }

  const strongestWinds = [...cells]
    .sort((left, right) => right.windStrength - left.windStrength || left.id.localeCompare(right.id))
    .slice(0, 5)
    .map((cell) => Object.freeze({
      cellId: cell.id,
      latitude: cell.midpointLatitude,
      longitude: cell.midpointLongitude,
      windDirection: cell.windDirection,
      windStrength: cell.windStrength,
    }));

  return Object.freeze({
    cellCount: cells.length,
    pressureBandDistribution: Object.freeze(pressureBandDistribution),
    averageWindSpeed: round(totalWind / Math.max(cells.length, 1)),
    averageMoistureTransport: round(totalMoisture / Math.max(cells.length, 1)),
    strongestWinds: Object.freeze(strongestWinds),
    largestRainShadowRegion: countLargestRainShadowRegion(cells, grid),
    averageAtmosphericStability: round(totalStability / Math.max(cells.length, 1)),
    dominantCirculationPattern: getDominantCirculationPattern(world),
    seasonalCirculationPhase: getSeasonalCirculationPhase(astronomy, seasonalShift),
    seasonalShiftDegrees: seasonalShift,
  });
}

export function getAtmosphereStateAtTick(
  world: AtmosphereWorldSource,
  tick: TickInput,
  grid: SpatialGrid = createGrid(),
): AtmosphereState {
  const tickKey = BigInt(tick).toString();

  return getCachedDeterministic("atmosphere-state", world, grid, () => {
    const astronomy = getAstronomyStateAtTick(world, tick);
    const seasonalShift = normalizeSeasonalShift(astronomy);
    const terrainState = getTerrainState(world, grid);
    const hydrologyState = getHydrologyState(world, grid);
    const climateCells = getClimateGridAtTick(world, tick, grid);
    const terrainById = new Map(terrainState.cells.map((cell) => [cell.id, cell]));
    const hydrologyById = new Map(hydrologyState.cells.map((cell) => [cell.id, cell]));
    const climateById = new Map(climateCells.map((cell) => [cell.id, cell]));
    const draftCells: DraftAtmosphericCell[] = [];

  for (const cell of grid.iterateCells()) {
    const terrainCell = terrainById.get(cell.id);
    const hydrologyCell = hydrologyById.get(cell.id);
    const climateCell = climateById.get(cell.id);

    if (!terrainCell || !hydrologyCell || !climateCell) {
      throw new Error(`Atmosphere dependencies missing for cell: ${cell.id}`);
    }

    const pressureZone = pressureZoneForLatitude(cell.midpointLatitude, seasonalShift);
    const pressureValue = getPressureValue(cell, pressureZone, terrainCell, climateCell, seasonalShift);
    const temperatureGradient = getTemperatureGradient(climateCell, climateById, grid);
    const windDirection = rotateWindForTerrain(
      baseWindDirection(cell.midpointLatitude, seasonalShift, pressureZone),
      terrainCell,
      hydrologyCell,
      cell.midpointLatitude,
    );
    const windStrength = windDirection === "CALM"
      ? 0
      : getWindStrength(cell, pressureZone, pressureValue, temperatureGradient, terrainCell, hydrologyCell);
    const moistureTransportPotential = getMoistureTransportPotential(
      climateCell,
      terrainCell,
      hydrologyCell,
      windStrength,
    );
    const orographicLiftPotential = getOrographicLiftPotential(
      cell,
      windDirection,
      windStrength,
      terrainById,
      grid,
    );
    const rainShadowPotential = getRainShadowPotential(
      cell,
      windDirection,
      windStrength,
      terrainById,
      grid,
    );
    const atmosphericStability = getAtmosphericStability(
      pressureZone,
      pressureValue,
      temperatureGradient,
      terrainCell,
      moistureTransportPotential,
    );

    draftCells.push({
      ...cell,
      pressureZone,
      pressureValue,
      windDirection,
      windStrength,
      temperatureGradient,
      moistureTransportPotential,
      orographicLiftPotential,
      rainShadowPotential,
      atmosphericStability,
      seasonalShift,
      elevation: terrainCell.elevation,
      terrainType: terrainCell.terrainType,
      isCoast: terrainCell.isCoast,
      ruggedness: terrainCell.ruggedness,
      moisturePotential: hydrologyCell.moisturePotential,
      distanceToOcean: hydrologyCell.distanceToOcean,
      distanceToCoast: hydrologyCell.distanceToCoast,
      averageTemperatureC: climateCell.averageTemperatureC,
    });
  }

  const averageLandElevation = getAverageElevation(
    draftCells
      .filter((cell) => !OCEAN_TERRAIN_TYPES.has(cell.terrainType))
      .map((cell) => terrainById.get(cell.id)),
  );

  const cells = Object.freeze(
    draftCells
      .sort((left, right) => left.row - right.row || left.column - right.column)
      .map((cell) => {
        const adjustedShadow = cell.rainShadowPotential > 0
          ? cell.rainShadowPotential
          : cell.elevation < averageLandElevation && cell.distanceToCoast > 2
            ? round(clamp(cell.ruggedness * cell.windStrength * 0.28, 0, 1))
            : 0;

        return Object.freeze({
          id: cell.id,
          row: cell.row,
          column: cell.column,
          latitudeRange: cell.latitudeRange,
          longitudeRange: cell.longitudeRange,
          midpoint: cell.midpoint,
          midpointLatitude: cell.midpointLatitude,
          midpointLongitude: cell.midpointLongitude,
          hemisphere: cell.hemisphere,
          latitudeBand: cell.latitudeBand,
          neighbors: cell.neighbors,
          pressureZone: cell.pressureZone,
          pressureValue: cell.pressureValue,
          windDirection: cell.windDirection,
          windStrength: cell.windStrength,
          temperatureGradient: cell.temperatureGradient,
          moistureTransportPotential: cell.moistureTransportPotential,
          orographicLiftPotential: cell.orographicLiftPotential,
          rainShadowPotential: adjustedShadow,
          atmosphericStability: cell.atmosphericStability,
          seasonalShift: cell.seasonalShift,
        });
      }),
  );

    return Object.freeze({
      tick: astronomy.tick,
      cells,
      summary: buildAtmosphericSummary(world, astronomy, cells, grid, seasonalShift),
    });
  }, tickKey);
}

export function getAtmosphereState(
  world: AtmosphereWorldSource,
  grid: SpatialGrid = createGrid(),
): AtmosphereState {
  return getAtmosphereStateAtTick(world, world.currentTick, grid);
}

export function getAtmosphereGrid(
  world: AtmosphereWorldSource,
  grid: SpatialGrid = createGrid(),
): readonly AtmosphericGridCell[] {
  return getAtmosphereState(world, grid).cells;
}

export function getAtmosphereGridCell(
  world: AtmosphereWorldSource,
  cell: GridCell,
): AtmosphericGridCell {
  const grid = createGrid();
  const atmosphericCell = getAtmosphereState(world, grid).cells.find((entry) => entry.id === cell.id);

  if (!atmosphericCell) {
    throw new Error(`Atmosphere cell not found: ${cell.id}`);
  }

  return atmosphericCell;
}

export function getAtmosphereSummary(
  world: AtmosphereWorldSource,
  grid: SpatialGrid = createGrid(),
): AtmosphericSummary {
  return getAtmosphereState(world, grid).summary;
}
