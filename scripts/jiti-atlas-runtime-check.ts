import { PrismaClient } from "@prisma/client";

import { createGrid } from "../src/lib/simulation/grid/grid";
import {
  buildWorldFingerprint,
  getCanonicalFingerprint,
  verifyWorldAgainstCanonical,
} from "../src/lib/worlds/canonical-world";
import { buildTimedAtlasSnapshot } from "../src/lib/worlds/map-atlas";

const prisma = new PrismaClient();

async function main() {
  const grid = createGrid();
  const expected = getCanonicalFingerprint(grid);

  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    include: { planet: true },
  });

  if (!world) {
    console.log("No local-sandbox world found.");
    return;
  }

  const direct = buildWorldFingerprint(world, grid);
  const verify = verifyWorldAgainstCanonical(world, grid);
  const atlas = buildTimedAtlasSnapshot(world as never, null as never, grid).value;

  console.log("EXPECTED:", {
    shortHash: expected.shortHash,
    hash: expected.hash,
  });

  console.log("DIRECT:", {
    shortHash: direct.shortHash,
    hash: direct.hash,
    canonical: direct.canonical,
    hashMatch: direct.hash === expected.hash,
    verificationMatches: verify.matches,
  });

  console.log("ATLAS:", {
    tick: atlas.tick?.toString?.() ?? atlas.tick,
    selectedDay: atlas.selectedDay,
    shortHash: atlas.fingerprint.shortHash,
    hash: atlas.fingerprint.hash,
    canonical: atlas.fingerprint.canonical,
    environmentMatch: atlas.integrity.environmentMatch,
    hashMatch: atlas.fingerprint.hash === expected.hash,
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
