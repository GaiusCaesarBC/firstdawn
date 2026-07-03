const { PrismaClient } = require("@prisma/client");
const canonicalWorldConfig = require("../src/lib/worlds/canonical-world-config.json");

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

const FIRST_DAWN_CANONICAL_SEED = canonicalWorldConfig.seed;
const CANONICAL_WORLD_DESCRIPTION = canonicalWorldConfig.world.description;

const DEFAULT_WORLD_TIME_CONFIG = {
  tickDurationSeconds: 60,
  dayLengthSeconds: 86400,
  yearLengthDays: 365,
  axialTiltDegrees: 23.44,
  orbitalEccentricity: 0.0167,
  initialEpochName: "First Dawn",
  initialYear: 0,
  initialDay: 0,
  initialHour: 6,
};

const CANONICAL_PLANET_CONFIG = canonicalWorldConfig.planet;
const CANONICAL_DEFAULT_WORLD_ALIASES = canonicalWorldConfig.defaultWorldAliases;

const LEGACY_DEFAULT_WORLD_SLUGS = [
  "first-dawn-canonical-world",
  "first-dawn-staging",
];

function createCanonicalWorldInput(alias) {
  return {
    name: alias.name,
    slug: alias.slug,
    environment: alias.environment,
    status: alias.status,
    currentTick: 0n,
    timeScale: 1,
    ...DEFAULT_WORLD_TIME_CONFIG,
    currentGeneration: 0,
    seed: FIRST_DAWN_CANONICAL_SEED,
    description: CANONICAL_WORLD_DESCRIPTION,
    protected: alias.protected,
  };
}

function buildPlanetData() {
  return { ...CANONICAL_PLANET_CONFIG };
}

function buildWorldData(alias) {
  return createCanonicalWorldInput(alias);
}

async function deleteLegacyDefaultWorlds() {
  const canonicalSlugs = new Set(CANONICAL_DEFAULT_WORLD_ALIASES.map((alias) => alias.slug));
  const legacySlugs = LEGACY_DEFAULT_WORLD_SLUGS.filter((slug) => !canonicalSlugs.has(slug));

  if (legacySlugs.length === 0) {
    return;
  }

  const result = await prisma.world.deleteMany({
    where: {
      slug: { in: legacySlugs },
    },
  });

  if (result.count > 0) {
    console.log(`Deleted ${result.count} legacy default world row(s): ${legacySlugs.join(", ")}`);
  }
}

async function upsertCanonicalWorld(alias) {
  const world = buildWorldData(alias);
  const planet = buildPlanetData();

  await prisma.world.upsert({
    where: { slug: world.slug },
    update: {
      name: world.name,
      environment: world.environment,
      tickDurationSeconds: world.tickDurationSeconds,
      dayLengthSeconds: world.dayLengthSeconds,
      yearLengthDays: world.yearLengthDays,
      axialTiltDegrees: world.axialTiltDegrees,
      orbitalEccentricity: world.orbitalEccentricity,
      initialEpochName: world.initialEpochName,
      initialYear: world.initialYear,
      initialDay: world.initialDay,
      initialHour: world.initialHour,
      seed: world.seed,
      description: world.description,
      protected: world.protected,
      planet: {
        upsert: {
          create: planet,
          update: planet,
        },
      },
    },
    create: {
      ...world,
      planet: {
        create: planet,
      },
    },
  });

  console.log(`${alias.label}: canonical ${world.slug} uses ${world.seed}`);
}

async function main() {
  await deleteLegacyDefaultWorlds();

  for (const alias of CANONICAL_DEFAULT_WORLD_ALIASES) {
    await upsertCanonicalWorld(alias);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
