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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectLifecycleError(task, expectedCode, message) {
  try {
    await task();
  } catch (error) {
    assert(
      error && error.code === expectedCode,
      `${message}: expected ${expectedCode}, received ${error?.code ?? error}`,
    );
    console.log(`PASS: ${message}`);
    return;
  }

  throw new Error(`${message}: expected an error.`);
}

loadLocalEnv();

const prisma = new PrismaClient();

async function main() {
  const lifecycle = await import("../src/lib/worlds/world-lifecycle.ts");
  const testSlug = "verify-actions-sandbox";
  const actor = "local-developer";

  await prisma.world.deleteMany({ where: { slug: testSlug } });

  const logCountBefore = await prisma.worldActionLog.count();

  await lifecycle.pauseWorld("local-sandbox", {
    actor,
    reason: "verify local sandbox pause",
  });

  let localSandbox = await prisma.world.findUniqueOrThrow({ where: { slug: "local-sandbox" } });
  assert(localSandbox.status === "PAUSED", "local sandbox should pause.");
  console.log("PASS: local sandbox can be paused");

  await lifecycle.resumeWorld("local-sandbox", {
    actor,
    reason: "verify local sandbox resume",
  });

  localSandbox = await prisma.world.findUniqueOrThrow({ where: { slug: "local-sandbox" } });
  assert(localSandbox.status === "ACTIVE", "local sandbox should resume to ACTIVE.");
  console.log("PASS: local sandbox can be resumed");

  await expectLifecycleError(
    () => lifecycle.archiveWorld("first-dawn-production", {
      actor,
      reason: "verify protected production archive block",
    }),
    "PROTECTED_WORLD",
    "protected production placeholder cannot be archived",
  );

  await expectLifecycleError(
    () => lifecycle.unprotectWorld("first-dawn-production", {
      actor,
      reason: "verify production unprotect confirmation block",
    }),
    "PRODUCTION_CONFIRMATION_REQUIRED",
    "production cannot be unprotected without confirmation",
  );

  await lifecycle.createWorld(
    {
      name: "Verify Actions Sandbox",
      slug: testSlug,
      environment: "SANDBOX",
      status: "DRAFT",
      seed: "verify-actions-sandbox-v1",
      description: "Temporary world used by scripts/verify-world-actions.js.",
      protected: false,
    },
    {
      actor,
      reason: "verify active sandbox uniqueness setup",
    },
  );

  await lifecycle.resumeWorld(testSlug, {
    actor,
    reason: "verify only one active sandbox after activation",
  });

  const activeSandboxWorlds = await prisma.world.findMany({
    where: { environment: "SANDBOX", status: "ACTIVE" },
    select: { slug: true },
    orderBy: { slug: "asc" },
  });

  assert(activeSandboxWorlds.length === 1, "only one sandbox world should be ACTIVE.");
  assert(
    activeSandboxWorlds[0].slug === testSlug,
    "temporary sandbox should be the only active sandbox after activation.",
  );
  console.log("PASS: only one active sandbox world exists after activation");

  await lifecycle.resumeWorld("local-sandbox", {
    actor,
    reason: "restore local sandbox active state",
  });

  await lifecycle.archiveWorld(testSlug, {
    actor,
    reason: "archive temporary verification sandbox",
  });

  const restoredActiveSandboxWorlds = await prisma.world.findMany({
    where: { environment: "SANDBOX", status: "ACTIVE" },
    select: { slug: true },
  });

  assert(restoredActiveSandboxWorlds.length === 1, "one sandbox world should be ACTIVE after restore.");
  assert(restoredActiveSandboxWorlds[0].slug === "local-sandbox", "local sandbox should be restored ACTIVE.");

  await prisma.world.deleteMany({ where: { slug: testSlug } });

  const production = await prisma.world.findUniqueOrThrow({
    where: { slug: "first-dawn-production" },
    select: { status: true, protected: true },
  });
  assert(production.status === "PAUSED", "production placeholder should remain PAUSED.");
  assert(production.protected === true, "production placeholder should remain protected.");

  const logCountAfter = await prisma.worldActionLog.count();
  assert(logCountAfter > logCountBefore, "lifecycle action logs should be created.");
  console.log(`PASS: action logs are created (${logCountBefore} -> ${logCountAfter})`);

  console.log("World action verification complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
