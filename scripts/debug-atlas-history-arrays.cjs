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

  console.log("WORLD:");
  console.dir({
    ...world,
    currentTick: world.currentTick?.toString?.() ?? world.currentTick,
  }, { depth: 5 });

  const rows = await prisma.$queryRaw`
    WITH latest AS (
      SELECT
        st."tick" AS "dbTick",
        st."completedAt",
        st."metadata"->'atlasSnapshot' AS envelope
      FROM "SimulationTick" st
      WHERE st."worldId" = ${world.id}
        AND jsonb_exists(st."metadata", 'atlasSnapshot')
      ORDER BY st."tick" DESC, st."completedAt" DESC
      LIMIT 1
    )
    SELECT
      latest."dbTick"::text AS "dbTick",
      latest."completedAt" AS "completedAt",
      latest.envelope->>'tick' AS "envelopeTick",
      latest.envelope->>'generatedAt' AS "generatedAt",
      latest.envelope->>'selectedDay' AS "selectedDay",

      jsonb_array_length(COALESCE(latest.envelope->'snapshot'->'humans'->'chroniclerEntries', '[]'::jsonb)) AS "chroniclerCount",
      (
        SELECT MAX((entry.value->>'tick')::numeric)::text
        FROM jsonb_array_elements(COALESCE(latest.envelope->'snapshot'->'humans'->'chroniclerEntries', '[]'::jsonb)) entry
        WHERE entry.value ? 'tick' AND entry.value->>'tick' ~ '^[0-9]+$'
      ) AS "chroniclerMaxTick",

      jsonb_array_length(COALESCE(latest.envelope->'snapshot'->'humans'->'causalEvents', '[]'::jsonb)) AS "causalEventCount",
      (
        SELECT MAX((event.value->>'tick')::numeric)::text
        FROM jsonb_array_elements(COALESCE(latest.envelope->'snapshot'->'humans'->'causalEvents', '[]'::jsonb)) event
        WHERE event.value ? 'tick' AND event.value->>'tick' ~ '^[0-9]+$'
      ) AS "causalEventMaxTick",

      jsonb_array_length(COALESCE(latest.envelope->'snapshot'->'settlements'->'recentEvents', '[]'::jsonb)) AS "settlementEventCount",
      (
        SELECT MAX((event.value->>'tick')::numeric)::text
        FROM jsonb_array_elements(COALESCE(latest.envelope->'snapshot'->'settlements'->'recentEvents', '[]'::jsonb)) event
        WHERE event.value ? 'tick' AND event.value->>'tick' ~ '^[0-9]+$'
      ) AS "settlementEventMaxTick",

      jsonb_array_length(COALESCE(latest.envelope->'snapshot'->'families'->'events', '[]'::jsonb)) AS "familyEventCount",
      (
        SELECT MAX((event.value->>'tick')::numeric)::text
        FROM jsonb_array_elements(COALESCE(latest.envelope->'snapshot'->'families'->'events', '[]'::jsonb)) event
        WHERE event.value ? 'tick' AND event.value->>'tick' ~ '^[0-9]+$'
      ) AS "familyEventMaxTick"
    FROM latest
  `;

  console.log("\nLATEST ATLAS SNAPSHOT HISTORY ARRAYS:");
  console.dir(rows[0], { depth: 10 });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
