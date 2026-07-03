const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function maskUrl(url) {
  if (!url) return "missing";
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

async function main() {
  console.log("DATABASE_URL:", maskUrl(process.env.DATABASE_URL));

  const worlds = await prisma.world.findMany({
    where: { slug: "local-sandbox" },
    select: {
      id: true,
      slug: true,
      name: true,
      environment: true,
      status: true,
      seed: true,
      currentTick: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  console.log("WORLDS:");
  console.dir(worlds.map((world) => ({
    ...world,
    currentTick: world.currentTick?.toString?.() ?? world.currentTick,
  })), { depth: 5 });

  for (const world of worlds) {
    console.log(`\nSNAPSHOT HISTORY FOR ${world.slug} / ${world.id}`);

    const rows = await prisma.$queryRaw`
      SELECT
        st."tick"::text AS "dbTick",
        st."completedAt",
        st."success",
        st."metadata"->'atlasSnapshot'->>'tick' AS "envelopeTick",
        st."metadata"->'atlasSnapshot'->'snapshot'->>'tick' AS "snapshotTick",
        st."metadata"->'atlasSnapshot'->'snapshot'->>'worldSlug' AS "snapshotWorldSlug",
        st."metadata"->'atlasSnapshot'->'snapshot'->'fingerprint'->>'shortHash' AS "shortHash",
        st."metadata"->'atlasSnapshot'->'snapshot'->'fingerprint'->>'hash' AS "hash",
        st."metadata"->'atlasSnapshot'->'snapshot'->'integrity'->>'environmentMatch' AS "environmentMatch",
        octet_length((st."metadata"->'atlasSnapshot')::text)::text AS "atlasBytes"
      FROM "SimulationTick" st
      WHERE st."worldId" = ${world.id}
        AND jsonb_exists(st."metadata", 'atlasSnapshot')
      ORDER BY st."tick" DESC, st."completedAt" DESC
      LIMIT 20
    `;

    console.dir(rows.map((row) => ({
      ...row,
      completedAt: row.completedAt?.toISOString?.() ?? row.completedAt,
    })), { depth: 10 });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    prisma.$disconnect();
  });
