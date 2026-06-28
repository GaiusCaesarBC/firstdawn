import type { World } from "@prisma/client";

export const DEFAULT_WORLD_TIME_CONFIG = {
  tickDurationSeconds: 60,
  dayLengthSeconds: 86_400,
  yearLengthDays: 365,
  axialTiltDegrees: 23.44,
  orbitalEccentricity: 0.0167,
  initialEpochName: "First Dawn",
  initialYear: 0,
  initialDay: 0,
  initialHour: 6,
} as const;

export type TimePhaseLabel =
  | "pre-dawn"
  | "sunrise"
  | "morning"
  | "noon"
  | "afternoon"
  | "sunset"
  | "evening"
  | "midnight";

export type TimeState = {
  tick: string;
  tickDurationSeconds: number;
  elapsedSeconds: number;
  elapsedMinutes: number;
  elapsedHours: number;
  elapsedDays: number;
  year: number;
  dayOfYear: number;
  hour: number;
  minute: number;
  second: number;
  normalizedDayProgress: number;
  normalizedYearProgress: number;
  epochName: string;
  isDaytime: boolean;
  isNight: boolean;
  phaseLabel: TimePhaseLabel;
};

type WorldTimeConfigSource = Pick<
  World,
  | "currentTick"
  | "tickDurationSeconds"
  | "dayLengthSeconds"
  | "yearLengthDays"
  | "initialEpochName"
  | "initialYear"
  | "initialDay"
  | "initialHour"
>;

type TickInput = bigint | number | string;

function finiteOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function positiveOrDefault(value: number | null | undefined, fallback: number): number {
  const normalized = finiteOrDefault(value, fallback);
  return normalized > 0 ? normalized : fallback;
}

function integerOrDefault(value: number | null | undefined, fallback: number): number {
  const normalized = finiteOrDefault(value, fallback);
  return Number.isInteger(normalized) ? normalized : fallback;
}

function normalizeTick(tick: TickInput): bigint {
  return typeof tick === "bigint" ? tick : BigInt(tick);
}

function modulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function phaseForHour(hourOfDay: number): TimePhaseLabel {
  if (hourOfDay >= 3 && hourOfDay < 5) {
    return "pre-dawn";
  }

  if (hourOfDay >= 5 && hourOfDay < 7) {
    return "sunrise";
  }

  if (hourOfDay >= 7 && hourOfDay < 11) {
    return "morning";
  }

  if (hourOfDay >= 11 && hourOfDay < 13) {
    return "noon";
  }

  if (hourOfDay >= 13 && hourOfDay < 17) {
    return "afternoon";
  }

  if (hourOfDay >= 17 && hourOfDay < 19) {
    return "sunset";
  }

  if (hourOfDay >= 19 && hourOfDay < 22) {
    return "evening";
  }

  return "midnight";
}

function readConfig(world: WorldTimeConfigSource) {
  return {
    tickDurationSeconds: positiveOrDefault(
      world.tickDurationSeconds,
      DEFAULT_WORLD_TIME_CONFIG.tickDurationSeconds,
    ),
    dayLengthSeconds: positiveOrDefault(
      world.dayLengthSeconds,
      DEFAULT_WORLD_TIME_CONFIG.dayLengthSeconds,
    ),
    yearLengthDays: Math.max(
      1,
      integerOrDefault(world.yearLengthDays, DEFAULT_WORLD_TIME_CONFIG.yearLengthDays),
    ),
    epochName: world.initialEpochName?.trim() || DEFAULT_WORLD_TIME_CONFIG.initialEpochName,
    initialYear: integerOrDefault(world.initialYear, DEFAULT_WORLD_TIME_CONFIG.initialYear),
    initialDay: Math.max(0, integerOrDefault(world.initialDay, DEFAULT_WORLD_TIME_CONFIG.initialDay)),
    initialHour: Math.max(
      0,
      Math.min(23.999999, finiteOrDefault(world.initialHour, DEFAULT_WORLD_TIME_CONFIG.initialHour)),
    ),
  };
}

export function getTimeState(world: WorldTimeConfigSource): TimeState {
  return getTimeStateAtTick(world, world.currentTick);
}

export function getTimeStateAtTick(world: WorldTimeConfigSource, tick: TickInput): TimeState {
  const config = readConfig(world);
  const normalizedTick = normalizeTick(tick);
  const tickNumber = Number(normalizedTick);
  const elapsedSeconds = tickNumber * config.tickDurationSeconds;
  const secondsPerYear = config.dayLengthSeconds * config.yearLengthDays;
  const initialDaySeconds = config.initialDay * config.dayLengthSeconds;
  const initialHourSeconds = (config.initialHour / 24) * config.dayLengthSeconds;
  const absoluteSeconds = initialDaySeconds + initialHourSeconds + elapsedSeconds;
  const secondsWithinYear = modulo(absoluteSeconds, secondsPerYear);
  const secondsWithinDay = modulo(secondsWithinYear, config.dayLengthSeconds);
  const normalizedDayProgress = secondsWithinDay / config.dayLengthSeconds;
  const normalizedYearProgress = secondsWithinYear / secondsPerYear;
  const clockSeconds = normalizedDayProgress * 86_400;
  const hour = Math.floor(clockSeconds / 3_600) % 24;
  const minute = Math.floor((clockSeconds % 3_600) / 60);
  const second = Math.floor(clockSeconds % 60);
  const hourOfDay = hour + minute / 60 + second / 3_600;
  const isDaytime = normalizedDayProgress >= 0.25 && normalizedDayProgress < 0.75;

  return {
    tick: normalizedTick.toString(),
    tickDurationSeconds: config.tickDurationSeconds,
    elapsedSeconds: round(elapsedSeconds),
    elapsedMinutes: round(elapsedSeconds / 60),
    elapsedHours: round(elapsedSeconds / 3_600),
    elapsedDays: round(elapsedSeconds / config.dayLengthSeconds),
    year: config.initialYear + Math.floor(absoluteSeconds / secondsPerYear),
    dayOfYear: Math.floor(secondsWithinYear / config.dayLengthSeconds),
    hour,
    minute,
    second,
    normalizedDayProgress: round(normalizedDayProgress),
    normalizedYearProgress: round(normalizedYearProgress),
    epochName: config.epochName,
    isDaytime,
    isNight: !isDaytime,
    phaseLabel: phaseForHour(hourOfDay),
  };
}