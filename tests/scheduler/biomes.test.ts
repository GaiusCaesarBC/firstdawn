import { describe, expect, it } from "vitest";

import { getBiomeState, type BiomeGridCell } from "../../src/lib/simulation/biome-engine";
import { createGrid } from "../../src/lib/simulation/grid/grid";
import { getHydrologyState } from "../../src/lib/simulation/hydrology-engine";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { getTerrainState } from "../../src/lib/simulation/terrain-engine";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const baseWorld = {
  id: "biome-test-world",
  name: "Biome Test World",
  slug: "biome-test-world",
  currentTick: 0n,
  seed: "biome-foundation-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
  planet: {
    oceanCoveragePercent: 65,
    atmospherePressureKPa: 101.3,
  },
};

const marineBiomes = new Set(["ocean", "coast", "lake"]);
const tropicalBiomes = new Set(["savanna", "tropical-seasonal-forest", "tropical-rainforest"]);
const hotDryWorld = { ...baseWorld, id: "hot-dry-biome-test-world", slug: "hot-dry-biome-test-world", seed: "planet-biome-dry" };
const hotWetWorld = { ...baseWorld, id: "hot-wet-biome-test-world", slug: "hot-wet-biome-test-world", seed: "mountain-world" };
const hotDryBiomes = new Set(["desert", "savanna", "mediterranean-shrubland", "badlands-rocky"]);
const hotWetBiomes = new Set(["tropical-rainforest", "tropical-seasonal-forest", "swamp-marsh"]);
const coldDryBiomes = new Set(["tundra", "ice-sheet", "boreal-forest", "alpine-mountain"]);

function biomeSignature(cells: readonly BiomeGridCell[]): string[] {
  return cells.map((cell) => [
    cell.id,
    cell.biomeKey,
    cell.adjustedTemperatureC,
    cell.precipitationScore,
    cell.humidityScore,
    cell.soilMoistureScore,
    cell.elevation,
  ].join(":"));
}

function share(cells: readonly BiomeGridCell[], predicate: (cell: BiomeGridCell) => boolean): number {
  return cells.filter(predicate).length / Math.max(cells.length, 1);
}

describe("biome foundation", () => {
  it("assigns one biome to every fixed grid cell", () => {
    const state = getBiomeState(baseWorld);

    expect(state.cells).toHaveLength(648);
    expect(state.summary.cellCount).toBe(648);
    expect(state.cells.every((cell) => cell.biomeKey && cell.biomeName && cell.biomeColor)).toBe(true);
  });

  it("is deterministic for repeated generation with the same seed", () => {
    const first = getBiomeState(baseWorld);
    const second = getBiomeState(baseWorld);

    expect(first.summary).toEqual(second.summary);
    expect(biomeSignature(first.cells)).toEqual(biomeSignature(second.cells));
  });

  it("keeps ocean and sea cells in marine biomes", () => {
    const grid = createGrid();
    const hydrology = getHydrologyState(baseWorld, grid);
    const biomes = getBiomeState(baseWorld, grid);
    const biomeById = new Map(biomes.cells.map((cell) => [cell.id, cell]));
    const waterCells = hydrology.cells.filter((cell) => cell.isOcean || cell.isSea);

    expect(waterCells.length).toBeGreaterThan(0);

    for (const cell of waterCells) {
      expect(marineBiomes.has(biomeById.get(cell.id)?.biomeKey ?? "desert")).toBe(true);
    }
  });

  it("never assigns tropical biomes to ice-sheet cells", () => {
    const biomes = getBiomeState(baseWorld);
    const iceCells = biomes.cells.filter((cell) => cell.biomeKey === "ice-sheet");

    expect(iceCells.length).toBeGreaterThan(0);

    for (const cell of iceCells) {
      expect(tropicalBiomes.has(cell.biomeKey)).toBe(false);
      expect(cell.adjustedTemperatureC).toBeLessThanOrEqual(-2);
    }
  });

  it("trends hot dry cells toward desert, savanna, shrubland, or badlands", () => {
    const biomes = getBiomeState(hotDryWorld);
    const hotDryCells = biomes.cells.filter((cell) =>
      !marineBiomes.has(cell.biomeKey)
      && cell.biomeKey !== "river-wetland"
      && cell.adjustedTemperatureC >= 18
      && (cell.precipitationScore <= 0.45 || cell.soilMoistureScore <= 0.55),
    );

    expect(hotDryCells.length).toBeGreaterThan(0);
    expect(share(hotDryCells, (cell) => hotDryBiomes.has(cell.biomeKey))).toBeGreaterThanOrEqual(0.65);
  });

  it("trends hot wet cells toward rainforest, seasonal tropical forest, or swamp", () => {
    const biomes = getBiomeState(hotWetWorld);
    const hotWetCells = biomes.cells.filter((cell) =>
      !marineBiomes.has(cell.biomeKey)
      && cell.adjustedTemperatureC >= 20
      && cell.precipitationScore >= 0.46
      && cell.soilMoistureScore >= 0.5,
    );

    expect(hotWetCells.length).toBeGreaterThan(0);
    expect(share(hotWetCells, (cell) => hotWetBiomes.has(cell.biomeKey))).toBeGreaterThan(0.75);
  });

  it("trends cold dry cells toward tundra, ice, boreal, or alpine biomes", () => {
    const biomes = getBiomeState(baseWorld);
    const coldDryCells = biomes.cells.filter((cell) =>
      !marineBiomes.has(cell.biomeKey)
      && cell.adjustedTemperatureC <= 5
      && cell.soilMoistureScore <= 0.55,
    );

    expect(coldDryCells.length).toBeGreaterThan(0);
    expect(share(coldDryCells, (cell) => coldDryBiomes.has(cell.biomeKey))).toBeGreaterThan(0.7);
  });

  it("trends high elevation cells toward alpine or other harsh mountain outcomes", () => {
    const grid = createGrid();
    const terrain = getTerrainState(baseWorld, grid);
    const biomes = getBiomeState(baseWorld, grid);
    const biomeById = new Map(biomes.cells.map((cell) => [cell.id, cell]));
    const highElevationBiomes = terrain.cells
      .filter((cell) => cell.elevation >= 0.86 || cell.terrainType === "HIGH_MOUNTAINS")
      .map((cell) => biomeById.get(cell.id))
      .filter((cell): cell is BiomeGridCell => Boolean(cell));

    expect(highElevationBiomes.length).toBeGreaterThan(0);
    expect(share(highElevationBiomes, (cell) => ["alpine-mountain", "ice-sheet", "volcanic-barren"].includes(cell.biomeKey))).toBeGreaterThan(0.55);
  });

  it("produces a reasonable distribution instead of a single-biome planet", () => {
    const state = getBiomeState(baseWorld);
    const presentBiomes = Object.values(state.summary.biomeDistribution).filter((count) => count > 0).length;
    const largestBiomeCount = Math.max(...Object.values(state.summary.biomeDistribution));

    expect(presentBiomes).toBeGreaterThanOrEqual(8);
    expect(largestBiomeCount).toBeLessThan(648);
    expect(state.summary.civilizationStartingZoneCandidates.length).toBeGreaterThan(0);
    expect(state.summary.biodiversityPotentialScore).toBeGreaterThan(0);
    expect(DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label)).toContain("Biomes");
  });
});
