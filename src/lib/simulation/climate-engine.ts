import type { World } from "@prisma/client";

import { getCachedDeterministic } from "./deterministic-cache";
import {
  getAstronomyState,
  getAstronomyStateAtTick,
  type AstronomyState,
  type SeasonLabel,
} from "./astronomy-engine";
import type { GridCell } from "./grid/cell";
import { createGrid, type SpatialGrid } from "./grid/grid";
import { normalizeLatitude } from "./grid/coordinates";
import { getPlanetState } from "./planet-engine";

export type ClimateBand =
  | "Polar"
  | "Subpolar"
  | "Boreal"
  | "Cool Temperate"
  | "Warm Temperate"
  | "Subtropical"
  | "Tropical";

export type ClimateHemisphere = "northern" | "southern" | "equatorial";

export type ClimateAtLatitude = {
  latitude: number;
  hemisphere: ClimateHemisphere;
  season: SeasonLabel;
  solarEnergy: number;
  daylightHours: number;
  averageTemperatureC: number;
  seasonalModifier: number;
  climateBand: ClimateBand;
};

export type ClimateSummary = {
  averageTemperatureC: number;
  averageDaylightHours: number;
  averageSolarEnergy: number;
  equatorAverageTemperatureC: number;
  northPoleAverageTemperatureC: number;
  southPoleAverageTemperatureC: number;
  averagePoleTemperatureC: number;
  climateBandsPresent: ClimateBand[];
};

export type ClimateState = {
  tick: string;
  orbitalProgress: number;
  solarDeclinationDegrees: number;
  axialTiltDegrees: number;
  seasonNorthernHemisphere: SeasonLabel;
  seasonSouthernHemisphere: SeasonLabel;
  latitudes: ClimateAtLatitude[];
  summary: ClimateSummary;
};

export type ClimateGridCell = GridCell & {
  latitude: number;
  season: SeasonLabel;
  climateBand: ClimateBand;
  averageTemperature: number;
  averageTemperatureC: number;
  daylightHours: number;
  solarEnergy: number;
  seasonalModifier: number;
};

type ClimateComputationBasis = {
  astronomy: AstronomyState;
  greenhouseOffset: number;
  orbitalIntensity: number;
};

type TickInput = bigint | number | string;

type ClimateWorldSource = Pick<
  World,
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

const LATITUDE_SAMPLES = Array.from({ length: 181 }, (_, index) => index - 90);
const EARTHLIKE_AXIAL_TILT = 23.44;
const MAX_DAILY_INSOLATION_FACTOR = 0.45;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function hemisphereForLatitude(latitude: number): ClimateHemisphere {
  if (latitude > 0) {
    return "northern";
  }

  if (latitude < 0) {
    return "southern";
  }

  return "equatorial";
}

function seasonForLatitude(astronomy: AstronomyState, hemisphere: ClimateHemisphere): SeasonLabel {
  if (hemisphere === "southern") {
    return astronomy.seasonSouthernHemisphere;
  }

  return astronomy.seasonNorthernHemisphere;
}

function getHourAngle(latitudeRadians: number, declinationRadians: number): number {
  const cosineHourAngle = -Math.tan(latitudeRadians) * Math.tan(declinationRadians);

  if (cosineHourAngle >= 1) {
    return 0;
  }

  if (cosineHourAngle <= -1) {
    return Math.PI;
  }

  return Math.acos(cosineHourAngle);
}

function getDaylightHours(latitude: number, solarDeclinationDegrees: number): number {
  const latitudeRadians = toRadians(normalizeLatitude(latitude));
  const declinationRadians = toRadians(solarDeclinationDegrees);
  const hourAngle = getHourAngle(latitudeRadians, declinationRadians);

  return round((24 * hourAngle) / Math.PI);
}

function getRawDailyInsolation(latitude: number, solarDeclinationDegrees: number): number {
  const latitudeRadians = toRadians(normalizeLatitude(latitude));
  const declinationRadians = toRadians(solarDeclinationDegrees);
  const hourAngle = getHourAngle(latitudeRadians, declinationRadians);

  if (hourAngle === 0) {
    return 0;
  }

  const rawInsolation = (
    hourAngle * Math.sin(latitudeRadians) * Math.sin(declinationRadians)
    + Math.cos(latitudeRadians) * Math.cos(declinationRadians) * Math.sin(hourAngle)
  ) / Math.PI;

  return Math.max(0, rawInsolation);
}

function getOrbitalIntensity(eccentricity: number, orbitalProgress: number): number {
  const normalizedEccentricity = clamp(Math.abs(eccentricity), 0, 0.99);

  if (normalizedEccentricity === 0) {
    return 1;
  }

  const rawIntensity = 1 + normalizedEccentricity * Math.cos(2 * Math.PI * orbitalProgress);
  return rawIntensity / (1 + normalizedEccentricity);
}

function getSolarEnergy(
  latitude: number,
  solarDeclinationDegrees: number,
  orbitalIntensity: number,
): number {
  const rawInsolation = getRawDailyInsolation(latitude, solarDeclinationDegrees);
  const normalizedEnergy = (rawInsolation / MAX_DAILY_INSOLATION_FACTOR) * orbitalIntensity;

  return round(clamp(normalizedEnergy, 0, 1));
}

function getSeasonalModifier(latitude: number, solarDeclinationDegrees: number, axialTiltDegrees: number): number {
  const latitudeFactor = Math.sin(toRadians(normalizeLatitude(latitude)));
  const declinationFactor = Math.sin(toRadians(solarDeclinationDegrees));
  const tiltScale = axialTiltDegrees > 0 ? axialTiltDegrees / EARTHLIKE_AXIAL_TILT : 0;

  return round(clamp(latitudeFactor * declinationFactor * tiltScale * 2.5, -1, 1));
}

function getGreenhouseOffset(world: ClimateWorldSource): number {
  const planetState = getPlanetState(world);
  const normalizedPressure = Math.max(planetState.atmospherePressureKPa, 1);
  const pressureDelta = Math.log2(normalizedPressure / 101.3);

  return round(clamp(pressureDelta * 4, -20, 20));
}

function getAverageTemperatureC(
  latitude: number,
  solarEnergy: number,
  daylightHours: number,
  seasonalModifier: number,
  greenhouseOffset: number,
): number {
  const absoluteLatitude = Math.abs(normalizeLatitude(latitude));
  const baselineTemperature = 24 - 0.12 * absoluteLatitude - 0.0065 * absoluteLatitude * absoluteLatitude;
  const solarOffset = (solarEnergy - 0.5) * 12;
  const daylightOffset = (daylightHours - 12) * 0.5;
  const seasonalAmplitude = 2 + absoluteLatitude * 0.12;

  return round(
    baselineTemperature
      + solarOffset
      + daylightOffset
      + seasonalAmplitude * seasonalModifier
      + greenhouseOffset,
  );
}

function getClimateBand(averageTemperatureC: number): ClimateBand {
  if (averageTemperatureC >= 26) {
    return "Tropical";
  }

  if (averageTemperatureC >= 20) {
    return "Subtropical";
  }

  if (averageTemperatureC >= 13) {
    return "Warm Temperate";
  }

  if (averageTemperatureC >= 5) {
    return "Cool Temperate";
  }

  if (averageTemperatureC >= -5) {
    return "Boreal";
  }

  if (averageTemperatureC >= -15) {
    return "Subpolar";
  }

  return "Polar";
}

function buildClimateComputationBasis(
  world: ClimateWorldSource,
  astronomy: AstronomyState,
): ClimateComputationBasis {
  return {
    astronomy,
    greenhouseOffset: getGreenhouseOffset(world),
    orbitalIntensity: getOrbitalIntensity(world.orbitalEccentricity ?? 0.0167, astronomy.orbitalProgress),
  };
}

function computeClimateForLatitude(
  basis: ClimateComputationBasis,
  latitude: number,
): ClimateAtLatitude {
  const normalizedLatitude = normalizeLatitude(latitude);
  const hemisphere = hemisphereForLatitude(normalizedLatitude);
  const { astronomy, greenhouseOffset, orbitalIntensity } = basis;
  const daylightHours = getDaylightHours(normalizedLatitude, astronomy.solarDeclinationDegrees);
  const solarEnergy = getSolarEnergy(
    normalizedLatitude,
    astronomy.solarDeclinationDegrees,
    orbitalIntensity,
  );
  const seasonalModifier = getSeasonalModifier(
    normalizedLatitude,
    astronomy.solarDeclinationDegrees,
    astronomy.axialTiltDegrees,
  );
  const averageTemperatureC = getAverageTemperatureC(
    normalizedLatitude,
    solarEnergy,
    daylightHours,
    seasonalModifier,
    greenhouseOffset,
  );

  return {
    latitude: normalizedLatitude,
    hemisphere,
    season: seasonForLatitude(astronomy, hemisphere),
    solarEnergy,
    daylightHours,
    averageTemperatureC,
    seasonalModifier,
    climateBand: getClimateBand(averageTemperatureC),
  };
}

function buildClimateSummary(latitudes: ClimateAtLatitude[]): ClimateSummary {
  const equator = latitudes.find((entry) => entry.latitude === 0);
  const northPole = latitudes.find((entry) => entry.latitude === 90);
  const southPole = latitudes.find((entry) => entry.latitude === -90);
  const weights = latitudes.map((entry) => Math.max(0, Math.cos(toRadians(entry.latitude))));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const weightedAverage = <K extends keyof Pick<ClimateAtLatitude, "averageTemperatureC" | "daylightHours" | "solarEnergy">>(
    key: K,
  ): number => {
    const total = latitudes.reduce((sum, entry, index) => sum + entry[key] * weights[index], 0);
    return round(total / totalWeight);
  };

  const climateBandsPresent = Array.from(
    new Set(latitudes.map((entry) => entry.climateBand)),
  ) as ClimateBand[];

  return {
    averageTemperatureC: weightedAverage("averageTemperatureC"),
    averageDaylightHours: weightedAverage("daylightHours"),
    averageSolarEnergy: weightedAverage("solarEnergy"),
    equatorAverageTemperatureC: equator?.averageTemperatureC ?? 0,
    northPoleAverageTemperatureC: northPole?.averageTemperatureC ?? 0,
    southPoleAverageTemperatureC: southPole?.averageTemperatureC ?? 0,
    averagePoleTemperatureC: round(
      ((northPole?.averageTemperatureC ?? 0) + (southPole?.averageTemperatureC ?? 0)) / 2,
    ),
    climateBandsPresent,
  };
}

export function getClimateState(world: ClimateWorldSource): ClimateState {
  return getClimateStateAtTick(world, world.currentTick);
}

export function getClimateStateAtTick(world: ClimateWorldSource, tick: TickInput): ClimateState {
  const tickKey = BigInt(tick).toString();

  return getCachedDeterministic("climate-state", world, createGrid(), () => {
    const astronomy = getAstronomyStateAtTick(world, tick);
    const basis = buildClimateComputationBasis(world, astronomy);
    const latitudes = LATITUDE_SAMPLES.map((latitude) => computeClimateForLatitude(basis, latitude));

    return {
      tick: astronomy.tick,
      orbitalProgress: astronomy.orbitalProgress,
      solarDeclinationDegrees: astronomy.solarDeclinationDegrees,
      axialTiltDegrees: astronomy.axialTiltDegrees,
      seasonNorthernHemisphere: astronomy.seasonNorthernHemisphere,
      seasonSouthernHemisphere: astronomy.seasonSouthernHemisphere,
      latitudes,
      summary: buildClimateSummary(latitudes),
    };
  }, tickKey);
}

export function getClimateForLatitude(
  world: ClimateWorldSource,
  latitude: number,
): ClimateAtLatitude {
  const astronomy = getAstronomyState(world);
  return computeClimateForLatitude(buildClimateComputationBasis(world, astronomy), latitude);
}

export function getClimateGridCell(
  world: ClimateWorldSource,
  cell: GridCell,
): ClimateGridCell {
  const astronomy = getAstronomyState(world);
  const climate = computeClimateForLatitude(
    buildClimateComputationBasis(world, astronomy),
    cell.midpointLatitude,
  );

  return {
    ...cell,
    latitude: climate.latitude,
    season: climate.season,
    climateBand: climate.climateBand,
    averageTemperature: climate.averageTemperatureC,
    averageTemperatureC: climate.averageTemperatureC,
    daylightHours: climate.daylightHours,
    solarEnergy: climate.solarEnergy,
    seasonalModifier: climate.seasonalModifier,
  };
}

export function getClimateGrid(world: ClimateWorldSource, grid: SpatialGrid): ClimateGridCell[] {
  return getClimateGridAtTick(world, world.currentTick, grid);
}

export function getClimateGridAtTick(
  world: ClimateWorldSource,
  tick: TickInput,
  grid: SpatialGrid,
): ClimateGridCell[] {
  const tickKey = BigInt(tick).toString();

  return getCachedDeterministic("climate-grid", world, grid, () => {
    const astronomy = getAstronomyStateAtTick(world, tick);
    const basis = buildClimateComputationBasis(world, astronomy);

    return Array.from(grid.iterateCells(), (cell) => {
      const climate = computeClimateForLatitude(basis, cell.midpointLatitude);

      return {
        ...cell,
        latitude: climate.latitude,
        season: climate.season,
        climateBand: climate.climateBand,
        averageTemperature: climate.averageTemperatureC,
        averageTemperatureC: climate.averageTemperatureC,
        daylightHours: climate.daylightHours,
        solarEnergy: climate.solarEnergy,
        seasonalModifier: climate.seasonalModifier,
      };
    });
  }, tickKey);
}

