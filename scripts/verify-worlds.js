const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

loadLocalEnv();

const prisma = new PrismaClient();

async function main() {
  const worlds = await prisma.world.findMany({
    orderBy: [{ environment: "asc" }, { status: "asc" }, { name: "asc" }],
    select: {
      name: true,
      slug: true,
      environment: true,
      status: true,
      protected: true,
      currentTick: true,
    },
  });

  console.log(`Total worlds: ${worlds.length}`);

  for (const world of worlds) {
    console.log(
      [
        `Name: ${world.name}`,
        `Slug: ${world.slug}`,
        `Environment: ${world.environment}`,
        `Status: ${world.status}`,
        `Protected: ${world.protected}`,
        `Current tick: ${world.currentTick.toString()}`,
      ].join(" | "),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });