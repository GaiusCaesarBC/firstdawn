import { NextResponse } from "next/server";

import { getLatestPersistedAtlasSnapshot } from "../../../../lib/simulation/snapshot-store";
import { createHrTimer } from "../../../../lib/utils/timing";
import { listWorlds } from "../../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

function parseDay(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
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

  const persistedSnapshot = await timer.time(`atlas:persisted-snapshot:${world.slug}`, async () =>
    getLatestPersistedAtlasSnapshot(world.id),
  );
  const requestedDay = parseDay(searchParams.get("day"));
  timer.logDevBreakdown("/api/worlds/map timing");

  if (!persistedSnapshot) {
    return NextResponse.json(
      { error: "No persisted Atlas snapshot is available yet. Start the simulation worker or run npm run sim:step." },
      { status: 404 },
    );
  }

  if (requestedDay !== null && requestedDay !== persistedSnapshot.selectedDay) {
    return NextResponse.json(
      {
        error: "Requested day is not available as a persisted worker snapshot yet.",
        availableDay: persistedSnapshot.selectedDay,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(persistedSnapshot.snapshot);
}
