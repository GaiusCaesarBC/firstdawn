const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    select: {
      id: true,
      slug: true,
      currentTick: true,
      status: true,
    },
  });

  console.log("WORLD:");
  console.dir({
    ...world,
    currentTick: world?.currentTick?.toString(),
  }, { depth: 4 });

  if (!world) return;

  const rows = await prisma.$queryRaw`
    SELECT
      st."tick"::text AS "tick",
      st."success",
      st."completedAt",
      jsonb_exists(st."metadata", 'atlasSnapshot') AS "hasAtlasSnapshot",
      st."metadata"->'atlasSnapshot'->>'tick' AS "atlasTick",
      st."metadata"->'atlasSnapshot'->>'worldId' AS "atlasWorldId",
      st."metadata"->'atlasSnapshot'->>'worldSlug' AS "atlasWorldSlug",
      octet_length((st."metadata"->'atlasSnapshot')::text) AS "atlasBytes"
    FROM "SimulationTick" st
    WHERE st."worldId" = ${world.id}
    ORDER BY st."tick" DESC, st."completedAt" DESC
    LIMIT 25
  `;

  console.log("LATEST 25 TICKS BY NUMERIC TICK:");
  console.dir(rows.map((row) => ({
    ...row,
    completedAt: row.completedAt?.toISOString?.() ?? row.completedAt,
  })), { depth: 5 });

  const atlasRows = await prisma.$queryRaw`
    SELECT
      st."tick"::text AS "tick",
      st."success",
      st."completedAt",
      st."metadata"->'atlasSnapshot'->>'tick' AS "atlasTick",
      octet_length((st."metadata"->'atlasSnapshot')::text) AS "atlasBytes"
    FROM "SimulationTick" st
    WHERE st."worldId" = ${world.id}
      AND jsonb_exists(st."metadata", 'atlasSnapshot')
    ORDER BY st."tick" DESC, st."completedAt" DESC
    LIMIT 10
  `;

  console.log("LATEST TICKS WITH ATLAS SNAPSHOT:");
  console.dir(atlasRows.map((row) => ({
    ...row,
    completedAt: row.completedAt?.toISOString?.() ?? row.completedAt,
  })), { depth: 5 });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
