import { NextResponse } from "next/server";

import { createHrTimer } from "../../../../lib/utils/timing";
import { buildTimedAtlasSnapshot, normalizeAtlasSelectedDay } from "../../../../lib/worlds/map-atlas";
import { listWorlds } from "../../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

function parseDay(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

  const selectedDay = normalizeAtlasSelectedDay(world, parseDay(searchParams.get("day")));

  const timedSnapshot = await timer.time(`atlas:snapshot:selected:${world.slug}`, async () =>
    buildTimedAtlasSnapshot(world, selectedDay),
  );
  timer.record(`atlas:snapshot:${timedSnapshot.timing.cacheHit ? "cache-hit" : "cache-miss"}`, timedSnapshot.timing.executionTimeMs);
  timer.logDevBreakdown("/api/worlds/map timing");

  return NextResponse.json(timedSnapshot.value);
}
