import { NextResponse } from "next/server";

import { getLatestPersistedAtlasSnapshot } from "../../../../lib/simulation/snapshot-store";
import { prisma } from "../../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const worldQuery = searchParams.get("world");

  if (!worldQuery) {
    return NextResponse.json({ error: "world query parameter is required." }, { status: 400 });
  }

  const world = await prisma.world.findFirst({
    where: { OR: [{ id: worldQuery }, { slug: worldQuery }] },
    select: { id: true },
  });

  if (!world) {
    return NextResponse.json({ error: "Requested world was not found." }, { status: 404 });
  }

  const snapshot = await getLatestPersistedAtlasSnapshot(world.id);

  if (!snapshot) {
    return NextResponse.json(
      { error: "No persisted simulation snapshot is available yet. Start the simulation worker or run npm run sim:step." },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot.snapshot);
}
