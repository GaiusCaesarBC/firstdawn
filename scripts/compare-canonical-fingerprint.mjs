const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const mod = await import("../src/lib/worlds/canonical-world.ts");
  const gridMod = await import("../src/lib/simulation/grid/grid.ts");

  const grid = gridMod.createGrid();

  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    include: { planet: true },
  });

  if (!world) {
    console.log("No local-sandbox world found.");
    return;
  }

  const actual = mod.buildWorldFingerprint(world, grid);
  const expected = mod.getCanonicalFingerprint(grid);
  const verification = mod.verifyWorldAgainstCanonical(world, grid);

  console.log("ACTUAL:");
  console.dir(actual, { depth: 10 });

  console.log("EXPECTED CANONICAL:");
  console.dir(expected, { depth: 10 });

  console.log("VERIFICATION:");
  console.dir(verification, { depth: 10 });

  console.log("HASH MATCH:", actual.hash === expected.hash);
  console.log("SEED MATCH:", actual.seed === expected.seed);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
