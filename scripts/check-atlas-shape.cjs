const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function getArray(value, paths) {
  for (const path of paths) {
    let current = value;
    for (const part of path) {
      current = current?.[part];
    }
    if (Array.isArray(current)) return { path: path.join("."), value: current };
  }
  return { path: null, value: null };
}

async function main() {
  const world = await prisma.world.findFirst({
    where: { slug: "local-sandbox" },
    select: { id: true, slug: true, currentTick: true, status: true },
  });

  if (!world) {
    console.log("No local-sandbox world found.");
    return;
  }

  const rows = await prisma.$queryRaw`
    SELECT
      st."tick"::text AS "tick",
      st."completedAt",
      st."metadata"->'atlasSnapshot' AS "atlasSnapshot"
    FROM "SimulationTick" st
    WHERE st."worldId" = ${world.id}
      AND jsonb_exists(st."metadata", 'atlasSnapshot')
    ORDER BY st."tick" DESC, st."completedAt" DESC
    LIMIT 1
  `;

  const row = rows[0];
  const snapshot = row?.atlasSnapshot;

  console.log("WORLD:");
  console.dir({
    ...world,
    currentTick: world.currentTick?.toString(),
  }, { depth: 3 });

  console.log("LATEST SNAPSHOT ROW:");
  console.dir({
    tick: row?.tick,
    completedAt: row?.completedAt?.toISOString?.() ?? row?.completedAt,
    snapshotBytes: snapshot ? Buffer.byteLength(JSON.stringify(snapshot), "utf8") : 0,
  });

  if (!snapshot) {
    console.log("No atlas snapshot found.");
    return;
  }

  console.log("TOP LEVEL SNAPSHOT KEYS:");
  console.dir(Object.keys(snapshot).sort(), { depth: 3 });

  console.log("GRID SUMMARY:");
  console.dir(snapshot.grid ?? snapshot.gridSummary ?? snapshot.summary ?? null, { depth: 5 });

  const cellSearch = getArray(snapshot, [
    ["cells"],
    ["atlasCells"],
    ["grid", "cells"],
    ["map", "cells"],
    ["snapshot", "cells"],
  ]);

  console.log("CELL ARRAY PATH:");
  console.log(cellSearch.path);

  const cells = cellSearch.value;
  console.log("CELL COUNT:");
  console.log(Array.isArray(cells) ? cells.length : "No cell array found");

  const sampleCells = Array.isArray(cells) ? cells.slice(0, 5) : [];

  console.log("SAMPLE CELL KEYS:");
  console.dir(sampleCells.map((cell) => Object.keys(cell).sort()), { depth: 5 });

  console.log("SAMPLE CELLS IMPORTANT FIELDS:");
  console.dir(sampleCells.map((cell) => ({
    id: cell.id,
    x: cell.x,
    y: cell.y,
    row: cell.row,
    col: cell.col,
    biome: cell.biome,
    biomeType: cell.biomeType,
    terrain: cell.terrain,
    terrainType: cell.terrainType,
    elevation: cell.elevation,
    moisture: cell.moisture,
    temperature: cell.temperature,
    climate: cell.climate,
    hydrology: cell.hydrology,
    atmosphere: cell.atmosphere,
    plantPopulationsLength: Array.isArray(cell.plantPopulations) ? cell.plantPopulations.length : null,
    animalPopulationsLength: Array.isArray(cell.animalPopulations) ? cell.animalPopulations.length : null,
    adaptationSignalsLength: Array.isArray(cell.adaptationSignals) ? cell.adaptationSignals.length : null,
    resourceDepositsLength: Array.isArray(cell.resourceDeposits) ? cell.resourceDeposits.length : null,
    civilizationMarkersLength: Array.isArray(cell.civilizationMarkers) ? cell.civilizationMarkers.length : null,
    ecosystemHistoryLength: Array.isArray(cell.ecosystemHistory) ? cell.ecosystemHistory.length : null,
  })), { depth: 8 });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
