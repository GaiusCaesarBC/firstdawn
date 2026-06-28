import { createHash } from "node:crypto";

import { WorldEnvironment, WorldStatus } from "@prisma/client";

import { getAtmosphereState } from "../simulation/atmosphere-engine";
import { getClimateGrid, getClimateState } from "../simulation/climate-engine";
import { createGrid, type SpatialGrid } from "../simulation/grid/grid";
import { getHydrologyState } from "../simulation/hydrology-engine";
import { getPlanetState } from "../simulation/planet-engine";
import { getTerrainState } from "../simulation/terrain-engine";
import { DEFAULT_WORLD_TIME_CONFIG } from "../simulation/time-engine";
import { getWeatherState } from "../simulation/weather-engine";
import canonicalWorldConfig from "./canonical-world-config.json";

export const FIRST_DAWN_CANONICAL_SEED = canonicalWorldConfig.seed;

export const FIRST_DAWN_CANONICAL_WORLD = {
  name: canonicalWorldConfig.world.name,
  slug: canonicalWorldConfig.world.slug,
  seed: FIRST_DAWN_CANONICAL_SEED,
  description: canonicalWorldConfig.world.description,
} as const;

export const CANONICAL_PLANET_CONFIG = { ...canonicalWorldConfig.planet } as const;

type CanonicalPlanetSource = {
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
};
export type CanonicalWorldSource = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  environment?: string | null;
  status?: string | null;
  currentTick: bigint;
  timeScale?: number | null;
  tickDurationSeconds: number;
  dayLengthSeconds: number;
  yearLengthDays: number;
  axialTiltDegrees: number;
  orbitalEccentricity: number;
  initialEpochName: string;
  initialYear: number;
  initialDay: number;
  initialHour: number;
  currentGeneration?: number | null;
  seed?: string | null;
  protected?: boolean | null;
  description?: string | null;
  planet?: CanonicalPlanetSource | null;
};

export type WorldFingerprint = {
  readonly seed: string;
  readonly hash: string;
  readonly shortHash: string;
  readonly canonical: boolean;
  readonly payload: Record<string, unknown>;
};

export type EnvironmentVerification = {
  readonly environment: string;
  readonly worldName: string;
  readonly expectedHash: string;
  readonly actualHash: string;
  readonly matches: boolean;
  readonly canonical: boolean;
};

const fingerprintCache = new Map<string, WorldFingerprint>();

type CanonicalWorldRecordOptions = {
  name?: string;
  slug?: string;
  environment?: WorldEnvironment;
  status?: WorldStatus;
  protected?: boolean;
  description?: string | null;
};

function normalizeSeed(seed: string | null | undefined): string {
  return seed?.trim() || FIRST_DAWN_CANONICAL_SEED;
}

function canonicalSlugFromDisplayName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || FIRST_DAWN_CANONICAL_WORLD.slug;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(typeof value === "bigint" ? value.toString() : value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").toUpperCase();
}

function formatHash(hash: string): string {
  return hash.match(/.{1,4}/g)?.slice(0, 6).join("-") ?? hash;
}

function buildClimateDistribution(world: CanonicalWorldSource, grid: SpatialGrid): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const cell of getClimateGrid(world, grid)) {
    distribution[cell.climateBand] = (distribution[cell.climateBand] ?? 0) + 1;
  }

  return Object.fromEntries(Object.entries(distribution).sort(([left], [right]) => left.localeCompare(right)));
}

export function buildCanonicalWorldRecord({
  name = FIRST_DAWN_CANONICAL_WORLD.name,
  slug,
  environment = WorldEnvironment.SANDBOX,
  status = WorldStatus.ACTIVE,
  protected: protectedWorld = environment === WorldEnvironment.PRODUCTION,
  description = FIRST_DAWN_CANONICAL_WORLD.description,
}: CanonicalWorldRecordOptions = {}): CanonicalWorldSource {
  return {
    name,
    slug: slug ?? (environment === WorldEnvironment.SANDBOX
      ? FIRST_DAWN_CANONICAL_WORLD.slug
      : `${FIRST_DAWN_CANONICAL_WORLD.slug}-${environment.toLowerCase()}`),
    environment,
    status,
    currentTick: 0n,
    timeScale: 1,
    ...DEFAULT_WORLD_TIME_CONFIG,
    currentGeneration: 0,
    seed: FIRST_DAWN_CANONICAL_SEED,
    description,
    protected: protectedWorld,
    planet: CANONICAL_PLANET_CONFIG,
  };
}

export const CANONICAL_DEFAULT_WORLD_ALIASES = canonicalWorldConfig.defaultWorldAliases.map((alias) => ({
  ...alias,
  environment: alias.environment as WorldEnvironment,
  status: alias.status as WorldStatus,
}));

export type CanonicalDefaultWorldAlias = (typeof CANONICAL_DEFAULT_WORLD_ALIASES)[number];

export function getCanonicalWorldSeed(): string {
  return FIRST_DAWN_CANONICAL_SEED;
}

export function getCanonicalWorldConfig(
  options: CanonicalWorldRecordOptions = {},
): CanonicalWorldSource {
  return buildCanonicalWorldRecord(options);
}

export function createCanonicalWorldInput(
  displayName: string,
  options: CanonicalWorldRecordOptions = {},
) {
  const config = getCanonicalWorldConfig({
    ...options,
    name: displayName,
    slug: options.slug ?? canonicalSlugFromDisplayName(displayName),
  });

  return {
    name: config.name ?? displayName,
    slug: config.slug ?? canonicalSlugFromDisplayName(displayName),
    environment: config.environment as WorldEnvironment,
    status: config.status as WorldStatus,
    currentTick: config.currentTick,
    timeScale: config.timeScale ?? 1,
    tickDurationSeconds: config.tickDurationSeconds,
    dayLengthSeconds: config.dayLengthSeconds,
    yearLengthDays: config.yearLengthDays,
    axialTiltDegrees: config.axialTiltDegrees,
    orbitalEccentricity: config.orbitalEccentricity,
    initialEpochName: config.initialEpochName,
    initialYear: config.initialYear,
    initialDay: config.initialDay,
    initialHour: config.initialHour,
    currentGeneration: config.currentGeneration ?? 0,
    seed: FIRST_DAWN_CANONICAL_SEED,
    description: config.description ?? FIRST_DAWN_CANONICAL_WORLD.description,
    protected: Boolean(config.protected),
    planet: { ...CANONICAL_PLANET_CONFIG },
  };
}

export function createCanonicalDefaultWorldInput(alias: CanonicalDefaultWorldAlias) {
  return createCanonicalWorldInput(alias.name, {
    slug: alias.slug,
    environment: alias.environment,
    status: alias.status,
    protected: alias.protected,
  });
}

export function isCanonicalWorld(world: Pick<CanonicalWorldSource, "seed">): boolean {
  return normalizeSeed(world.seed) === FIRST_DAWN_CANONICAL_WORLD.seed;
}

function getFingerprintCacheKey(world: CanonicalWorldSource, seed: string, grid: SpatialGrid): string {
  const gridSummary = grid.getGridSummary();

  return stableStringify({
    seed,
    currentTick: world.currentTick,
    tickDurationSeconds: world.tickDurationSeconds,
    dayLengthSeconds: world.dayLengthSeconds,
    yearLengthDays: world.yearLengthDays,
    axialTiltDegrees: world.axialTiltDegrees,
    orbitalEccentricity: world.orbitalEccentricity,
    initialEpochName: world.initialEpochName,
    initialYear: world.initialYear,
    initialDay: world.initialDay,
    initialHour: world.initialHour,
    planet: world.planet ?? null,
    grid: {
      latitudeDivisions: gridSummary.latitudeDivisions,
      longitudeDivisions: gridSummary.longitudeDivisions,
    },
  });
}

export function buildWorldFingerprint(
  world: CanonicalWorldSource,
  grid: SpatialGrid = createGrid(),
): WorldFingerprint {
  const seed = normalizeSeed(world.seed);
  const cacheKey = getFingerprintCacheKey(world, seed, grid);
  const cached = fingerprintCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const worldWithSeed = { ...world, seed };
  const planet = getPlanetState(worldWithSeed);
  const terrain = getTerrainState(worldWithSeed, grid);
  const climate = getClimateState(worldWithSeed);
  const hydrology = getHydrologyState(worldWithSeed, grid);
  const atmosphere = getAtmosphereState(worldWithSeed, grid);
  const weather = getWeatherState(worldWithSeed, grid);
  const gridSummary = grid.getGridSummary();
  const payload = {
    seed,
    grid: {
      latitudeDivisions: gridSummary.latitudeDivisions,
      longitudeDivisions: gridSummary.longitudeDivisions,
      totalCells: gridSummary.totalCells,
    },
    orbital: {
      axialTiltDegrees: round(planet.axialTiltDegrees),
      orbitalEccentricity: round(planet.orbitalEccentricity),
      orbitalPeriodDays: round(planet.orbitalPeriodDays),
      rotationPeriodHours: round(planet.rotationPeriodHours),
    },
    planet: {
      radiusKm: round(planet.radiusKm),
      gravityMS2: round(planet.gravityMS2),
      massKg: planet.massKg,
      atmospherePressureKPa: round(planet.atmospherePressureKPa),
      atmosphereComposition: planet.atmosphereComposition,
      configuredOceanCoveragePercent: round(planet.oceanCoveragePercent, 2),
    },
    terrain: {
      terrainSeed: terrain.terrainSeed,
      validation: terrain.validation,
      oceanPercent: round(terrain.summary.oceanPercent, 2),
      landPercent: round(terrain.summary.landPercent, 2),
      averageElevation: round(terrain.summary.averageElevation),
      highestElevation: round(terrain.summary.highestElevation),
      largestContinent: terrain.summary.largestContinentEstimate,
      largestOcean: terrain.summary.largestOceanEstimate,
      polarLandPercent: round(terrain.summary.polarLandPercent, 2),
      temperateLandPercent: round(terrain.summary.temperateLandPercent, 2),
      subtropicalLandPercent: round(terrain.summary.subtropicalLandPercent, 2),
      tropicalLandPercent: round(terrain.summary.tropicalLandPercent, 2),
      habitableLandPercent: round(terrain.summary.habitableLandPercent, 2),
      terrainDistribution: terrain.summary.terrainDistribution,
    },
    climate: {
      summary: climate.summary,
      distribution: buildClimateDistribution(worldWithSeed, grid),
    },
    hydrology: hydrology.summary,
    atmosphere: atmosphere.summary,
    weather: weather.summary,
  };
  const hash = sha256(payload);

  const fingerprint = Object.freeze({
    seed,
    hash,
    shortHash: formatHash(hash),
    canonical: isCanonicalWorld(worldWithSeed),
    payload: Object.freeze(payload),
  });

  fingerprintCache.set(cacheKey, fingerprint);

  return fingerprint;
}

export function getCanonicalFingerprint(grid: SpatialGrid = createGrid()): WorldFingerprint {
  return buildWorldFingerprint(buildCanonicalWorldRecord(), grid);
}

export function verifyWorldAgainstCanonical(
  world: CanonicalWorldSource,
  grid: SpatialGrid = createGrid(),
): EnvironmentVerification {
  const expected = getCanonicalFingerprint(grid);
  const actual = buildWorldFingerprint(world, grid);

  return Object.freeze({
    environment: world.environment ?? "DEVELOPMENT",
    worldName: world.name ?? "Unnamed World",
    expectedHash: expected.hash,
    actualHash: actual.hash,
    matches: expected.hash === actual.hash,
    canonical: actual.canonical,
  });
}

export function verifyEnvironmentWorlds(
  worlds: readonly CanonicalWorldSource[],
  grid: SpatialGrid = createGrid(),
): readonly EnvironmentVerification[] {
  return Object.freeze(worlds.map((world) => verifyWorldAgainstCanonical(world, grid)));
}
