import type { World } from "@prisma/client";

import { DEFAULT_WORLD_TIME_CONFIG, getTimeStateAtTick } from "./time-engine";

export type SeasonLabel = "spring" | "summer" | "autumn" | "winter";
export type SkyLabel = "deep night" | "pre-dawn" | "sunrise" | "day" | "sunset" | "twilight";

export type AstronomyState = {
  tick: string;
  dayOfYear: number;
  yearProgress: number;
  solarDeclinationDegrees: number;
  axialTiltDegrees: number;
  orbitalProgress: number;
  seasonNorthernHemisphere: SeasonLabel;
  seasonSouthernHemisphere: SeasonLabel;
  daylightFactor: number;
  solarIntensityFactor: number;
  moonPhase: string;
  skyLabel: SkyLabel;
};

type AstronomyWorldSource = Pick<
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
>;

type TickInput = bigint | number | string;

function finiteOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function normalizeProgress(progress: number): number {
  return ((progress % 1) + 1) % 1;
}

function seasonForProgress(progress: number): SeasonLabel {
  const normalized = normalizeProgress(progress);

  if (normalized < 0.25) {
    return "spring";
  }

  if (normalized < 0.5) {
    return "summer";
  }

  if (normalized < 0.75) {
    return "autumn";
  }

  return "winter";
}

function oppositeSeason(season: SeasonLabel): SeasonLabel {
  switch (season) {
    case "spring":
      return "autumn";
    case "summer":
      return "winter";
    case "autumn":
      return "spring";
    case "winter":
      return "summer";
  }
}

function skyLabelForHour(hour: number, minute: number): SkyLabel {
  const hourOfDay = hour + minute / 60;

  if (hourOfDay >= 4 && hourOfDay < 5.5) {
    return "pre-dawn";
  }

  if (hourOfDay >= 5.5 && hourOfDay < 7) {
    return "sunrise";
  }

  if (hourOfDay >= 7 && hourOfDay < 17) {
    return "day";
  }

  if (hourOfDay >= 17 && hourOfDay < 18.5) {
    return "sunset";
  }

  if (hourOfDay >= 18.5 && hourOfDay < 20) {
    return "twilight";
  }

  return "deep night";
}

export function getAstronomyState(world: AstronomyWorldSource): AstronomyState {
  return getAstronomyStateAtTick(world, world.currentTick);
}

export function getAstronomyStateAtTick(
  world: AstronomyWorldSource,
  tick: TickInput,
): AstronomyState {
  const timeState = getTimeStateAtTick(world, tick);
  const yearProgress = timeState.normalizedYearProgress;
  const axialTiltDegrees = Math.abs(
    finiteOrDefault(world.axialTiltDegrees, DEFAULT_WORLD_TIME_CONFIG.axialTiltDegrees),
  );
  const orbitalEccentricity = clamp(
    Math.abs(finiteOrDefault(world.orbitalEccentricity, DEFAULT_WORLD_TIME_CONFIG.orbitalEccentricity)),
    0,
    0.99,
  );
  const orbitalProgress = yearProgress;
  const solarDeclinationDegrees =
    axialTiltDegrees * Math.sin(2 * Math.PI * (yearProgress - 0.25));
  const northernSeason = seasonForProgress(yearProgress);
  const daylightFactor = clamp(
    Math.cos((timeState.normalizedDayProgress - 0.5) * 2 * Math.PI),
    0,
    1,
  );
  const seasonalIntensity = axialTiltDegrees > 0
    ? 0.9 + 0.1 * (solarDeclinationDegrees / axialTiltDegrees)
    : 1;
  const orbitalIntensity = 1 + orbitalEccentricity * Math.cos(2 * Math.PI * orbitalProgress);
  const solarIntensityFactor = clamp(daylightFactor * seasonalIntensity * orbitalIntensity, 0, 1.2);

  return {
    tick: timeState.tick,
    dayOfYear: timeState.dayOfYear,
    yearProgress: round(yearProgress),
    solarDeclinationDegrees: round(solarDeclinationDegrees),
    axialTiltDegrees: round(axialTiltDegrees),
    orbitalProgress: round(orbitalProgress),
    seasonNorthernHemisphere: northernSeason,
    seasonSouthernHemisphere: oppositeSeason(northernSeason),
    daylightFactor: round(daylightFactor),
    solarIntensityFactor: round(solarIntensityFactor),
    moonPhase: "unmodeled",
    skyLabel: skyLabelForHour(timeState.hour, timeState.minute),
  };
}