import { PrismaClient } from "@prisma/client";

import { createGrid } from "../src/lib/simulation/grid/grid";
import { buildTimedAtlasSnapshot, normalizeAtlasSelectedDay } from "../src/lib/worlds/map-atlas";

const prisma = new PrismaClient();

function show(label: string, snapshot: any) {
  console.log(label, {
    tick: snapshot.tick?.toString?.() ?? snapshot.tick,
    selectedDay: snapshot.selectedDay,
    shortHash: snapshot.fingerprint.shortHash,
    hash: snapshot.fingerprint.hash,
    canonical: snapshot.fingerprint.canonical,
    environmentMatch: snapshot.integrity.environmentMatch,
  });
}

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

  const normalizedDay = normalizeAtlasSelectedDay(world as never, null);

  console.log("NORMALIZED DAY:", normalizedDay);

  const nullDay = buildTimedAtlasSnapshot(world as never, null as never, grid).value;
  show("NULL DAY INPUT:", nullDay);

  const normalizedDayInput = buildTimedAtlasSnapshot(world as never, normalizedDay, grid).value;
  show("NORMALIZED DAY INPUT:", normalizedDayInput);

  const day12Input = buildTimedAtlasSnapshot(world as never, 12, grid).value;
  show("DAY 12 INPUT:", day12Input);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
