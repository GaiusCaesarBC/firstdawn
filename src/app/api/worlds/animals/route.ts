import { NextResponse } from "next/server";

import {
  getAnimalEcologyDefinitions,
  getAnimalEcologyState,
} from "../../../../lib/simulation/animal-engine";
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

  const animalState = getAnimalEcologyState(world);
  const selectedCell = cellQuery
    ? animalState.cells.find((cell) => cell.id === cellQuery) ?? null
    : null;

  if (cellQuery && !selectedCell) {
    return NextResponse.json({ error: "Requested cell was not found." }, { status: 404 });
  }

  return NextResponse.json({
    worldId: world.id,
    worldSlug: world.slug,
    worldName: world.name,
    planetId: world.planet?.id ?? null,
    tick: animalState.tick,
    definitions: getAnimalEcologyDefinitions(),
    summary: animalState.summary,
    cell: selectedCell,
    cells: cellQuery ? [] : animalState.cells,
    bestHuntingZones: animalState.summary.huntingValueRegions,
    highestDangerZones: animalState.summary.highestDangerZones,
    bestDomesticationZones: animalState.summary.domesticationCandidateRegions,
    highestBiodiversityZones: animalState.summary.biodiversityHotspots,
    migrationCorridorCandidates: animalState.summary.migrationCorridorCandidates,
    herbivoreRichRegions: animalState.summary.herbivoreRichRegions,
    predatorHotspots: animalState.summary.predatorHotspots,
  });
}