import { NextResponse } from "next/server";

import { getCachedWorldHealthSummaryWithHumans } from "../../../../lib/simulation/world-health";
import { listWorlds } from "../../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const worldQuery = searchParams.get("world");

  if (!worldQuery) {
    return NextResponse.json({ error: "world query parameter is required." }, { status: 400 });
  }

  const worlds = await listWorlds({ includeArchived: true });
  const world = worlds.find((entry) => entry.id === worldQuery || entry.slug === worldQuery);

  if (!world) {
    return NextResponse.json({ error: "Requested world was not found." }, { status: 404 });
  }

  return NextResponse.json(await getCachedWorldHealthSummaryWithHumans(world.id));
}
