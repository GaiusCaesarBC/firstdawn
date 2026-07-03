const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    select: { id: true, slug: true, currentTick: true },
  });

  console.log("WORLD:");
  console.dir({
    ...world,
    currentTick: world?.currentTick?.toString?.() ?? world?.currentTick,
  }, { depth: 5 });

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  console.log("\nPOSSIBLE EVENT / SIGNAL / MEMORY TABLES:");
  console.dir(
    tables
      .map(t => t.table_name)
      .filter(name => /event|signal|memory|chronicle|story|history|tick/i.test(name)),
    { depth: 10 }
  );

  const ticks = await prisma.simulationTick.findMany({
    where: { worldId: world?.id },
    orderBy: [{ tick: "desc" }, { completedAt: "desc" }],
    take: 10,
    select: {
      tick: true,
      success: true,
      completedAt: true,
      metadata: true,
    },
  });

  console.log("\nLATEST 10 SIMULATION TICKS:");
  console.dir(
    ticks.map(t => ({
      tick: t.tick?.toString?.() ?? t.tick,
      success: t.success,
      completedAt: t.completedAt,
      metadataKeys: t.metadata && typeof t.metadata === "object" && !Array.isArray(t.metadata)
        ? Object.keys(t.metadata)
        : null,
    })),
    { depth: 10 }
  );
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
