import { NextResponse } from "next/server";

import { getCachedWorldHealthSummaryWithHumans } from "../../../../lib/simulation/world-health";
import { createHrTimer } from "../../../../lib/utils/timing";
import { listWorlds } from "../../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const worldQuery = searchParams.get("world");

  if (!worldQuery) {
    return NextResponse.json({ error: "world query parameter is required." }, { status: 400 });
  }

  const timer = createHrTimer();
  const worlds = await timer.time("db:worlds", async () => listWorlds({ includeArchived: true }));
  const world = worlds.find((entry) => entry.id === worldQuery || entry.slug === worldQuery);

  if (!world) {
    return NextResponse.json({ error: "Requested world was not found." }, { status: 404 });
  }

  const health = await timer.time(`health:summary:${world.slug}`, async () => getCachedWorldHealthSummaryWithHumans(world.id));
  timer.logDevBreakdown("/api/worlds/health timing");
  return NextResponse.json(health);
}
