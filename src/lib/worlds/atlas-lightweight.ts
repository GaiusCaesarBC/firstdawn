import type { AtlasCell, AtlasSnapshot } from "./map-atlas";

function stripHeavyCellData(cell: AtlasCell): AtlasCell {
  return {
    ...cell,

    // These nested arrays are useful for deep inspectors,
    // but they make the map payload huge and can crash/freeze the browser.
    animalPopulations: [],
    movementVectors: [],
    ecosystemHistory: [],

    // Keep these safe even if older snapshots do not contain them.
    plantPopulations: [],
    adaptationSignals: [],
    resourceDeposits: [],
    civilizationMarkers: [],
  } as AtlasCell;
}

export function toLightweightAtlasSnapshot(snapshot: AtlasSnapshot): AtlasSnapshot {
  return {
    ...snapshot,
    cells: snapshot.cells.map(stripHeavyCellData),
  };
}
