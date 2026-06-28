import { NextResponse } from "next/server";

import { getBiomeDefinitions, getBiomeState } from "../../../../lib/simulation/biome-engine";
import { listWorlds } from "../../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const worldQuery = searchParams.get("world");
  const cellQuery = searchParams.get("cell");

  if (!worldQuery) {
    return NextResponse.json({ error: "world query parameter is required." }, { status: 400 });
  }

  const worlds = await listWorlds({ includeArchived: true });
  const world = worlds.find((entry) => entry.id === worldQuery || entry.slug === worldQuery);

  if (!world) {
    return NextResponse.json({ error: "Requested world was not found." }, { status: 404 });
  }

  if (!world.seed?.trim()) {
    return NextResponse.json({ error: "Requested world does not have a deterministic seed." }, { status: 409 });
  }

  const biomeState = getBiomeState(world);
  const selectedCell = cellQuery
    ? biomeState.cells.find((cell) => cell.id === cellQuery) ?? null
    : null;

  if (cellQuery && !selectedCell) {
    return NextResponse.json({ error: "Requested cell was not found." }, { status: 404 });
  }

  return NextResponse.json({
    worldId: world.id,
    worldSlug: world.slug,
    worldName: world.name,
    planetId: world.planet?.id ?? null,
    tick: biomeState.tick,
    definitions: getBiomeDefinitions(),
    summary: biomeState.summary,
    cell: selectedCell,
    cells: cellQuery ? [] : biomeState.cells,
    startingZones: biomeState.summary.civilizationStartingZoneCandidates,
  });
}