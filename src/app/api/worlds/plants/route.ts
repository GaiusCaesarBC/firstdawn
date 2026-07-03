import { NextResponse } from "next/server";

import { getPlantEcologyDefinitions } from "../../../../lib/simulation/plant-engine";
import { getLatestPersistedAtlasSnapshotForWorldQuery } from "../../../../lib/simulation/snapshot-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const worldQuery = searchParams.get("world");
  const cellQuery = searchParams.get("cell");

  if (!worldQuery) {
    return NextResponse.json({ error: "world query parameter is required." }, { status: 400 });
  }

  const resolved = await getLatestPersistedAtlasSnapshotForWorldQuery(worldQuery);

  if (!resolved) {
    return NextResponse.json({ error: "Requested world was not found." }, { status: 404 });
  }

  const persisted = resolved.snapshot;

  if (!persisted) {
    return NextResponse.json(
      { error: "No persisted plant snapshot is available yet. Start the simulation worker or run npm run sim:step." },
      { status: 404 },
    );
  }

  const snapshot = persisted.snapshot;
  const summary = snapshot.plantSummary;

  if (!summary) {
    return NextResponse.json(
      { error: "No persisted plant snapshot is available yet. Start the simulation worker or run npm run sim:step." },
      { status: 404 },
    );
  }

  const selectedCell = cellQuery
    ? snapshot.cells.find((cell) => cell.id === cellQuery) ?? null
    : null;

  if (cellQuery && !selectedCell) {
    return NextResponse.json({ error: "Requested cell was not found." }, { status: 404 });
  }

  return NextResponse.json({
    worldId: snapshot.worldId,
    worldSlug: snapshot.worldSlug,
    worldName: snapshot.worldName,
    planetId: null,
    tick: snapshot.tick,
    definitions: getPlantEcologyDefinitions(),
    summary,
    cell: selectedCell,
    cells: cellQuery ? [] : snapshot.cells,
    bestForagingZones: summary.bestForagingZones,
    bestTimberMaterialZones: summary.bestTimberMaterialZones,
    biodiversityHotspots: summary.biodiversityHotspots,
    harshestLowPlantZones: summary.harshestLowPlantZones,
    lowResourceDeadZones: summary.lowResourceDeadZones,
  });
}