const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const activeWorld = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    select: {
      id: true,
      slug: true,
      currentTick: true,
      status: true,
    },
  });

  console.log("ACTIVE WORLD:");
  console.log({
    ...activeWorld,
    currentTick: activeWorld?.currentTick?.toString(),
  });

  const rows = await prisma.simulationCheckpoint.findMany({
    where: {
      systemId: "humans",
      ...(activeWorld ? { worldId: activeWorld.id } : {}),
    },
    orderBy: { tick: "desc" },
    take: 10,
    select: {
      worldId: true,
      systemId: true,
      tick: true,
      updatedAt: true,
    },
  });

  console.log("HUMAN CHECKPOINTS:");
  console.log(rows.map((row) => ({
    ...row,
    tick: row.tick.toString(),
    updatedAt: row.updatedAt.toISOString(),
  })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
