const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("DATABASE_URL:");
  console.log(process.env.DATABASE_URL);

  const worlds = await prisma.world.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      environment: true,
      status: true,
      currentTick: true,
      seed: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log("\nWORLDS:");
  console.dir(
    worlds.map(w => ({
      ...w,
      currentTick: w.currentTick?.toString?.() ?? w.currentTick,
    })),
    { depth: 5 }
  );

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  console.log("\nTABLES WITH SNAPSHOT / ATLAS / TICK:");
  console.dir(
    tables
      .map(t => t.table_name)
      .filter(name =>
        /snapshot|atlas|tick|world/i.test(name)
      ),
    { depth: 5 }
  );

  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
  });

  if (!world) {
    console.log("\nNo local-sandbox world found.");
    return;
  }

  console.log("\nLOCAL SANDBOX WORLD ID:", world.id);

  const ticks = await prisma.simulationTick.findMany({
    where: { worldId: world.id },
    orderBy: [{ tick: "desc" }, { completedAt: "desc" }],
    take: 5,
    select: {
      tick: true,
      success: true,
      completedAt: true,
      metadata: true,
    },
  });

  console.log("\nLATEST SIMULATION TICKS:");
  console.dir(
    ticks.map(t => ({
      ...t,
      tick: t.tick?.toString?.() ?? t.tick,
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
