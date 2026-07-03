const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    include: { planet: true },
  });

  if (!world) {
    console.log("No local-sandbox world found.");
    return;
  }

  const row = await prisma.$queryRaw`
    SELECT
      st."tick"::text AS "tick",
      st."metadata"->'atlasSnapshot'->'snapshot'->'fingerprint' AS "fingerprint",
      st."metadata"->'atlasSnapshot'->'snapshot'->'integrity' AS "integrity",
      st."metadata"->'atlasSnapshot'->'snapshot'->>'worldSlug' AS "snapshotWorldSlug",
      st."metadata"->'atlasSnapshot'->'snapshot'->>'worldId' AS "snapshotWorldId"
    FROM "SimulationTick" st
    WHERE st."worldId" = ${world.id}
      AND jsonb_exists(st."metadata", 'atlasSnapshot')
    ORDER BY st."tick" DESC, st."completedAt" DESC
    LIMIT 1
  `;

  console.log("WORLD:");
  console.dir({
    id: world.id,
    slug: world.slug,
    name: world.name,
    environment: world.environment,
    status: world.status,
    seed: world.seed,
    currentTick: world.currentTick?.toString(),
    planet: world.planet ? {
      radiusKm: world.planet.radiusKm,
      gravity: world.planet.gravity,
      massEarth: world.planet.massEarth,
      axialTilt: world.planet.axialTilt,
      rotationHours: world.planet.rotationHours,
      yearLengthDays: world.planet.yearLengthDays,
      oceanCoverage: world.planet.oceanCoverage,
    } : null,
  }, { depth: 5 });

  console.log("LATEST SNAPSHOT:");
  console.dir(row[0], { depth: 10 });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
