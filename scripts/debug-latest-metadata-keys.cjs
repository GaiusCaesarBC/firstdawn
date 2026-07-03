const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    select: { id: true, slug: true, currentTick: true },
  });

  if (!world) {
    console.log("No local-sandbox world found.");
    return;
  }

  const rows = await prisma.$queryRaw`
    WITH latest AS (
      SELECT
        st."tick",
        st."completedAt",
        st."metadata"::jsonb AS metadata
      FROM "SimulationTick" st
      WHERE st."worldId" = ${world.id}
      ORDER BY st."tick" DESC, st."completedAt" DESC
      LIMIT 1
    )
    SELECT
      latest."tick"::text AS "tick",
      latest."completedAt" AS "completedAt",
      jsonb_object_keys(latest.metadata) AS "topLevelKey"
    FROM latest
  `;

  console.log("LATEST METADATA TOP-LEVEL KEYS:");
  console.dir(rows, { depth: 10 });

  const possibleEventPaths = await prisma.$queryRaw`
    WITH latest AS (
      SELECT st."metadata"::jsonb AS metadata
      FROM "SimulationTick" st
      WHERE st."worldId" = ${world.id}
      ORDER BY st."tick" DESC, st."completedAt" DESC
      LIMIT 1
    )
    SELECT
      path,
      jsonb_typeof(value) AS type,
      CASE
        WHEN jsonb_typeof(value) = 'array' THEN jsonb_array_length(value)
        ELSE NULL
      END AS length
    FROM latest,
    LATERAL jsonb_each(latest.metadata) AS root(path, value)
    WHERE lower(path) LIKE '%event%'
       OR lower(path) LIKE '%signal%'
       OR lower(path) LIKE '%story%'
       OR lower(path) LIKE '%chronic%'
       OR lower(path) LIKE '%human%'
       OR lower(path) LIKE '%system%'
    ORDER BY path
  `;

  console.log("\nPOSSIBLE EVENT/SIGNAL METADATA PATHS:");
  console.dir(possibleEventPaths, { depth: 10 });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
