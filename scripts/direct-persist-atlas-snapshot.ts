import { PrismaClient } from "@prisma/client";

import { persistAtlasSnapshotForTick } from "../src/lib/simulation/snapshot-store";

const prisma = new PrismaClient();

async function main() {
  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    include: { planet: true },
  });

  if (!world) {
    console.log("No local-sandbox world found.");
    return;
  }

  const tick = world.currentTick ?? BigInt(0);

  console.log("PERSISTING DIRECTLY:", {
    worldId: world.id,
    slug: world.slug,
    currentTick: tick.toString(),
  });

  const envelope = await persistAtlasSnapshotForTick(world as never, tick as never);

  console.log("PERSISTED ENVELOPE:");
  console.dir({
    envelopeTick: envelope.tick?.toString?.() ?? envelope.tick,
    selectedDay: envelope.selectedDay,
    durationMs: envelope.durationMs,
    snapshotTick: envelope.snapshot.tick?.toString?.() ?? envelope.snapshot.tick,
    shortHash: envelope.snapshot.fingerprint.shortHash,
    hash: envelope.snapshot.fingerprint.hash,
    canonical: envelope.snapshot.fingerprint.canonical,
    environmentMatch: envelope.snapshot.integrity.environmentMatch,
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
