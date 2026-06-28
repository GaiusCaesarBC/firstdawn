type AtmosphereComposition = Record<string, number | string>;

type PlanetLikeSource = {
  name?: string | null;
  radiusKm?: number | null;
  gravityMS2?: number | null;
  massKg?: number | null;
  rotationPeriodHours?: number | null;
  orbitalPeriodDays?: number | null;
  axialTiltDegrees?: number | null;
  orbitalEccentricity?: number | null;
  atmospherePressureKPa?: number | null;
  atmosphereComposition?: AtmosphereComposition | null;
  oceanCoveragePercent?: number | null;
};

type WorldLikeSource = {
  name?: string | null;
  planet?: PlanetLikeSource | null;
};

export type PlanetState = {
  name: string;
  radiusKm: number;
  diameterKm: number;
  circumferenceKm: number;
  surfaceAreaKm2: number;
  gravityMS2: number;
  massKg: number;
  rotationPeriodHours: number;
  orbitalPeriodDays: number;
  axialTiltDegrees: number;
  orbitalEccentricity: number;
  atmospherePressureKPa: number;
  atmosphereComposition: AtmosphereComposition;
  oceanCoveragePercent: number;
};

export type PlanetSource = PlanetLikeSource | WorldLikeSource;

const EARTH_LIKE_DEFAULTS = {
  name: "Earth-like Planet",
  radiusKm: 6371,
  gravityMS2: 9.81,
  massKg: 5.972e24,
  rotationPeriodHours: 24,
  orbitalPeriodDays: 365,
  axialTiltDegrees: 23.44,
  orbitalEccentricity: 0.0167,
  atmospherePressureKPa: 101.3,
  atmosphereComposition: {
    nitrogen: 78,
    oxygen: 21,
    argon: 0.93,
    carbonDioxide: 0.04,
  },
  oceanCoveragePercent: 71,
} as const;

function finiteOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function atmosphereOrDefault(
  value: unknown,
  fallback: AtmosphereComposition,
): AtmosphereComposition {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const normalizedEntries = Object.entries(value).filter(([, entryValue]) => {
    return typeof entryValue === "number" || typeof entryValue === "string";
  });

  if (normalizedEntries.length === 0) {
    return { ...fallback };
  }

  return Object.fromEntries(normalizedEntries) as AtmosphereComposition;
}

function computeSurfaceArea(radiusKm: number): number {
  return 4 * Math.PI * radiusKm * radiusKm;
}

function hasPlanetRelation(source: PlanetSource): source is WorldLikeSource {
  return isRecord(source) && "planet" in source;
}

function getWorldName(source: PlanetSource): string {
  return source.name?.trim() || EARTH_LIKE_DEFAULTS.name;
}

function resolvePlanetInput(source: PlanetSource): {
  planet: PlanetLikeSource | null;
  fallbackName: string;
} {
  if (hasPlanetRelation(source)) {
    const worldName = getWorldName(source);

    return {
      planet: source.planet ?? null,
      fallbackName: `${worldName} Planet (fallback)`,
    };
  }

  return {
    planet: source,
    fallbackName: getWorldName(source),
  };
}

export function getPlanet(world: PlanetSource) {
  if (!world || typeof world !== "object") {
    throw new Error("Planet engine expected a world or planet object but received nothing usable.");
  }

  const { planet, fallbackName } = resolvePlanetInput(world);

  // Developer decision: when a World exists but its Planet relation is missing,
  // we expose an explicit Earth-like fallback instead of crashing dashboard/debug pages.
  // Null/undefined inputs still throw because that is always a programmer error.
  return {
    name: planet?.name?.trim() || fallbackName,
    radiusKm: finiteOrDefault(planet?.radiusKm, EARTH_LIKE_DEFAULTS.radiusKm),
    gravityMS2: finiteOrDefault(planet?.gravityMS2, EARTH_LIKE_DEFAULTS.gravityMS2),
    massKg: finiteOrDefault(planet?.massKg, EARTH_LIKE_DEFAULTS.massKg),
    rotationPeriodHours: finiteOrDefault(
      planet?.rotationPeriodHours,
      EARTH_LIKE_DEFAULTS.rotationPeriodHours,
    ),
    orbitalPeriodDays: finiteOrDefault(
      planet?.orbitalPeriodDays,
      EARTH_LIKE_DEFAULTS.orbitalPeriodDays,
    ),
    axialTiltDegrees: finiteOrDefault(
      planet?.axialTiltDegrees,
      EARTH_LIKE_DEFAULTS.axialTiltDegrees,
    ),
    orbitalEccentricity: finiteOrDefault(
      planet?.orbitalEccentricity,
      EARTH_LIKE_DEFAULTS.orbitalEccentricity,
    ),
    atmospherePressureKPa: finiteOrDefault(
      planet?.atmospherePressureKPa,
      EARTH_LIKE_DEFAULTS.atmospherePressureKPa,
    ),
    atmosphereComposition: atmosphereOrDefault(
      planet?.atmosphereComposition,
      EARTH_LIKE_DEFAULTS.atmosphereComposition,
    ),
    oceanCoveragePercent: finiteOrDefault(
      planet?.oceanCoveragePercent,
      EARTH_LIKE_DEFAULTS.oceanCoveragePercent,
    ),
  };
}

export function getPlanetState(world: PlanetSource): PlanetState {
  const planet = getPlanet(world);

  return {
    name: planet.name,
    radiusKm: planet.radiusKm,
    diameterKm: planet.radiusKm * 2,
    circumferenceKm: 2 * Math.PI * planet.radiusKm,
    surfaceAreaKm2: computeSurfaceArea(planet.radiusKm),
    gravityMS2: planet.gravityMS2,
    massKg: planet.massKg,
    rotationPeriodHours: planet.rotationPeriodHours,
    orbitalPeriodDays: planet.orbitalPeriodDays,
    axialTiltDegrees: planet.axialTiltDegrees,
    orbitalEccentricity: planet.orbitalEccentricity,
    atmospherePressureKPa: planet.atmospherePressureKPa,
    oceanCoveragePercent: planet.oceanCoveragePercent,
    atmosphereComposition: planet.atmosphereComposition,
  };
}
