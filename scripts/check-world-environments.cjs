const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const worlds = await prisma.world.findMany({
    where: {
      OR: [
        { slug: "local-sandbox" },
        { status: "ACTIVE" },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      environment: true,
      status: true,
      seed: true,
      currentTick: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 10,
  });

  console.dir(worlds.map((world) => ({
    ...world,
    currentTick: world.currentTick?.toString?.() ?? world.currentTick,
  })), { depth: 5 });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    prisma.$disconnect();
  });
