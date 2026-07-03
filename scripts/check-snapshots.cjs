const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const keys = Object.keys(prisma).filter((key) =>
    key.toLowerCase().includes("snapshot") ||
    key.toLowerCase().includes("atlas")
  );

  console.log("Possible snapshot delegates:", keys);

  for (const key of keys) {
    const delegate = prisma[key];
    if (delegate && typeof delegate.count === "function") {
      try {
        const count = await delegate.count();
        console.log(`${key}: ${count}`);
      } catch (error) {
        console.log(`${key}: count failed`, error.message);
      }
    }
  }

  const activeWorld = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    select: { id: true, slug: true, currentTick: true, status: true },
  });

  console.log("Active world:", {
    ...activeWorld,
    currentTick: activeWorld?.currentTick?.toString(),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
