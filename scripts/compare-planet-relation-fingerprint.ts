import { PrismaClient } from "@prisma/client";

import { createGrid } from "../src/lib/simulation/grid/grid";
import {
  buildWorldFingerprint,
  getCanonicalFingerprint,
  verifyWorldAgainstCanonical,
} from "../src/lib/worlds/canonical-world";
import { buildAtlasSnapshot } from "../src/lib/worlds/map-atlas";

const prisma = new PrismaClient();

function summarize(label: string, result: {
  shortHash: string;
  hash: string;
  canonical: boolean;
}) {
  console.log(label, {
    shortHash: result.shortHash,
    hash: result.hash,
    canonical: result.canonical,
  });
}

async function main() {
  const grid = createGrid();
  const expected = getCanonicalFingerprint(grid);

  const worldWithPlanet = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    include: { planet: true },
  });

  const worldWithoutPlanet = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
  });

  if (!worldWithPlanet || !worldWithoutPlanet) {
    console.log("No local-sandbox world found.");
    return;
  }

  console.log("EXPECTED:", {
    shortHash: expected.shortHash,
    hash: expected.hash,
  });

  const withPlanetFingerprint = buildWorldFingerprint(worldWithPlanet, grid);
  const withoutPlanetFingerprint = buildWorldFingerprint(worldWithoutPlanet, grid);

  summarize("WITH PLANET FINGERPRINT:", withPlanetFingerprint);
  summarize("WITHOUT PLANET FINGERPRINT:", withoutPlanetFingerprint);

  console.log("WITH PLANET VERIFY:", verifyWorldAgainstCanonical(worldWithPlanet, grid));
  console.log("WITHOUT PLANET VERIFY:", verifyWorldAgainstCanonical(worldWithoutPlanet, grid));

  console.log("BUILDING ATLAS WITH PLANET...");
  const atlasWithPlanet = buildAtlasSnapshot(worldWithPlanet as never, null as never, grid);
  console.log({
    shortHash: atlasWithPlanet.fingerprint.shortHash,
    environmentMatch: atlasWithPlanet.integrity.environmentMatch,
    tick: atlasWithPlanet.tick?.toString?.() ?? atlasWithPlanet.tick,
  });

  console.log("BUILDING ATLAS WITHOUT PLANET...");
  const atlasWithoutPlanet = buildAtlasSnapshot(worldWithoutPlanet as never, null as never, grid);
  console.log({
    shortHash: atlasWithoutPlanet.fingerprint.shortHash,
    environmentMatch: atlasWithoutPlanet.integrity.environmentMatch,
    tick: atlasWithoutPlanet.tick?.toString?.() ?? atlasWithoutPlanet.tick,
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
