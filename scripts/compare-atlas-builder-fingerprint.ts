import { PrismaClient } from "@prisma/client";

import { createGrid } from "../src/lib/simulation/grid/grid";
import {
  buildWorldFingerprint,
  getCanonicalFingerprint,
  verifyWorldAgainstCanonical,
} from "../src/lib/worlds/canonical-world";
import { buildAtlasSnapshot } from "../src/lib/worlds/map-atlas";

const prisma = new PrismaClient();

async function main() {
  const grid = createGrid();

  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    include: { planet: true },
  });

  if (!world) {
    console.log("No local-sandbox world found.");
    return;
  }

  const directFingerprint = buildWorldFingerprint(world, grid);
  const expected = getCanonicalFingerprint(grid);
  const directVerification = verifyWorldAgainstCanonical(world, grid);

  console.log("DIRECT FINGERPRINT:");
  console.dir({
    shortHash: directFingerprint.shortHash,
    hash: directFingerprint.hash,
    canonical: directFingerprint.canonical,
    expectedShortHash: expected.shortHash,
    hashMatch: directFingerprint.hash === expected.hash,
    verificationMatches: directVerification.matches,
  }, { depth: 10 });

  console.log("BUILDING ATLAS SNAPSHOT...");
  const atlas = buildAtlasSnapshot(world as never, null as never, grid);

  console.log("ATLAS SNAPSHOT FINGERPRINT:");
  console.dir({
    tick: atlas.tick?.toString?.() ?? atlas.tick,
    selectedDay: atlas.selectedDay,
    shortHash: atlas.fingerprint.shortHash,
    hash: atlas.fingerprint.hash,
    canonical: atlas.fingerprint.canonical,
    environmentMatch: atlas.integrity.environmentMatch,
    expectedShortHash: expected.shortHash,
    hashMatch: atlas.fingerprint.hash === expected.hash,
  }, { depth: 10 });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
