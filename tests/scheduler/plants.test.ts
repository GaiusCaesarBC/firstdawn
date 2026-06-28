import { describe, expect, it } from "vitest";

import { getBiomeState } from "../../src/lib/simulation/biome-engine";
import { createGrid } from "../../src/lib/simulation/grid/grid";
import {
  getPlantEcologyState,
  persistPlantEcologyState,
  type PlantGridCell,
} from "../../src/lib/simulation/plant-engine";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { run as runPlantsSystem } from "../../src/lib/simulation/systems/plants";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const baseWorld = {
  id: "plant-test-world",
  name: "Plant Test World",
  slug: "plant-test-world",
  currentTick: 0n,
  seed: "plant-ecology-foundation-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
  planet: {
    oceanCoveragePercent: 65,
    atmospherePressureKPa: 101.3,
  },
};

const hotDryWorld = { ...baseWorld, id: "plant-hot-dry-test-world", slug: "plant-hot-dry-test-world", seed: "planet-biome-dry" };
const hotWetWorld = { ...baseWorld, id: "plant-hot-wet-test-world", slug: "plant-hot-wet-test-world", seed: "mountain-world" };

function plantSignature(cells: readonly PlantGridCell[]): string[] {
  return cells.map((cell) => [
    cell.id,
    cell.biomeKey,
    cell.dominantPlantKey,
    cell.plantSuitabilityScore,
    cell.plantDensity,
    cell.biomassScore,
    cell.ediblePlantScore,
    cell.woodMaterialScore,
    cell.biodiversityScore,
    cell.regrowthRate,
    cell.seasonalStressScore,
  ].join(":"));
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function cellsForBiomes(cells: readonly PlantGridCell[], keys: readonly string[]): PlantGridCell[] {
  return cells.filter((cell) => keys.includes(cell.biomeKey));
}

describe("plant ecology foundation", () => {
  it("generates plant ecology data for all valid land, wetland, freshwater, and coastal cells", () => {
    const plants = getPlantEcologyState(baseWorld);
    const validCells = plants.cells.filter((cell) => !["ocean"].includes(cell.biomeKey));

    expect(plants.cells).toHaveLength(648);
    expect(validCells.length).toBeGreaterThan(0);
    expect(validCells.every((cell) => cell.dominantPlantKey && cell.dominantPlantName && cell.plantTags.length > 0)).toBe(true);
    expect(validCells.every((cell) => cell.plantSuitabilityScore >= 0 && cell.plantSuitabilityScore <= 1)).toBe(true);
  });

  it("keeps ocean and ice cells low density", () => {
    const plants = getPlantEcologyState(baseWorld);
    const oceanCells = cellsForBiomes(plants.cells, ["ocean"]);
    const iceCells = cellsForBiomes(plants.cells, ["ice-sheet"]);

    expect(oceanCells.length).toBeGreaterThan(0);
    expect(average(oceanCells.map((cell) => cell.plantDensity))).toBeLessThanOrEqual(0.16);

    if (iceCells.length > 0) {
      expect(Math.max(...iceCells.map((cell) => cell.plantDensity))).toBeLessThanOrEqual(0.04);
    }
  });

  it("keeps deserts and dry barren cells sparse and dominated by hardy plants", () => {
    const plants = getPlantEcologyState(hotDryWorld);
    const dryCells = plants.cells.filter((cell) =>
      ["desert", "badlands-rocky", "mediterranean-shrubland"].includes(cell.biomeKey)
      || (cell.adjustedTemperatureC >= 18 && cell.precipitationScore <= 0.24 && !["ocean", "coast", "lake"].includes(cell.biomeKey)),
    );

    expect(dryCells.length).toBeGreaterThan(0);
    expect(Math.max(...dryCells.map((cell) => cell.plantDensity))).toBeLessThanOrEqual(0.5);
    expect(average(dryCells.map((cell) => cell.plantDensity))).toBeLessThan(0.22);
    expect(dryCells.filter((cell) => ["desert-plants", "shrubs", "moss-lichen", "grasses"].includes(cell.dominantPlantKey)).length / dryCells.length).toBeGreaterThan(0.75);
  });

  it("makes tropical rainforests high biomass and biodiversity", () => {
    const plants = getPlantEcologyState(hotWetWorld);
    const rainforests = cellsForBiomes(plants.cells, ["tropical-rainforest"]);

    expect(rainforests.length).toBeGreaterThan(0);
    expect(average(rainforests.map((cell) => cell.biomassScore))).toBeGreaterThan(0.58);
    expect(average(rainforests.map((cell) => cell.biodiversityScore))).toBeGreaterThan(0.68);
    expect(rainforests.filter((cell) => cell.dominantPlantKey === "tropical-trees").length / rainforests.length).toBeGreaterThan(0.6);
  });

  it("makes grasslands strong edible grass biomass with lower wood", () => {
    const plants = getPlantEcologyState(baseWorld);
    const grasslands = cellsForBiomes(plants.cells, ["temperate-grassland", "savanna"]);

    expect(grasslands.length).toBeGreaterThan(0);
    expect(average(grasslands.map((cell) => cell.ediblePlantScore))).toBeGreaterThan(average(grasslands.map((cell) => cell.woodMaterialScore)));
    expect(grasslands.filter((cell) => cell.dominantPlantKey === "grasses").length / grasslands.length).toBeGreaterThan(0.45);
  });

  it("makes wetlands favor aquatic and reed vegetation", () => {
    const plants = getPlantEcologyState(baseWorld);
    const wetlands = cellsForBiomes(plants.cells, ["river-wetland", "swamp-marsh", "lake"]);

    expect(wetlands.length).toBeGreaterThan(0);
    expect(wetlands.filter((cell) => ["reeds-wetland", "aquatic-algae"].includes(cell.dominantPlantKey)).length / wetlands.length).toBeGreaterThan(0.55);
    expect(average(wetlands.map((cell) => cell.plantDensity))).toBeGreaterThan(0.32);
  });

  it("keeps alpine and tundra cells low density", () => {
    const plants = getPlantEcologyState(baseWorld);
    const coldSparseCells = cellsForBiomes(plants.cells, ["alpine-mountain", "tundra"]);

    expect(coldSparseCells.length).toBeGreaterThan(0);
    expect(average(coldSparseCells.map((cell) => cell.plantDensity))).toBeLessThan(0.28);
    expect(coldSparseCells.filter((cell) => ["alpine-plants", "moss-lichen", "shrubs", "boreal-trees"].includes(cell.dominantPlantKey)).length / coldSparseCells.length).toBeGreaterThan(0.65);
  });

  it("is deterministic across repeated runs", () => {
    const first = getPlantEcologyState(baseWorld);
    const second = getPlantEcologyState(baseWorld);

    expect(first.summary).toEqual(second.summary);
    expect(plantSignature(first.cells)).toEqual(plantSignature(second.cells));
  });

  it("does not use Math.random in the plant ecology implementation", async () => {
    const fs = await import("node:fs/promises");
    const files = [
      "src/lib/simulation/plant-definitions.ts",
      "src/lib/simulation/plant-engine.ts",
      "src/lib/simulation/systems/plants.ts",
    ];
    const contents = await Promise.all(files.map((file) => fs.readFile(file, "utf8")));

    expect(contents.join("\n")).not.toContain("Math.random");
  });

  it("requires persisted biome cells before plant persistence", async () => {
    const client = {
      planet: {
        findUnique: async () => ({ id: "planet-without-biomes" }),
      },
      planetCell: {
        findMany: async () => [],
        update: async () => ({}),
      },
    };

    await expect(persistPlantEcologyState(baseWorld, client as never)).rejects.toThrow(/requires persisted biome cells/i);
  });

  it("wires plant ecology after biomes and before biology and animals", async () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Biomes")).toBeLessThan(labels.indexOf("Plant Ecology"));
    expect(labels.indexOf("Plant Ecology")).toBeLessThan(labels.indexOf("Biology"));
    expect(labels.indexOf("Plant Ecology")).toBeLessThan(labels.indexOf("Animals"));

    const grid = createGrid();
    const biomeState = getBiomeState(baseWorld, grid);
    const updates: unknown[] = [];
    const client = {
      planet: {
        findUnique: async () => ({ id: "planet-with-biomes" }),
      },
      planetCell: {
        findMany: async () => biomeState.cells.map((cell) => ({
          planetId: "planet-with-biomes",
          cellId: cell.id,
          plantGeneratedAt: null,
          plantUpdatedAt: null,
          dominantPlantKey: "none",
          dominantPlantName: "No Established Plant Life",
          plantSuitabilityScore: 0,
          plantDensity: 0,
          biomassScore: 0,
          ediblePlantScore: 0,
          woodMaterialScore: 0,
          medicinalPotentialScore: 0,
          biodiversityScore: 0,
          regrowthRate: 0,
          seasonalStressScore: 1,
          plantTags: [],
        })),
        update: async (input: unknown) => {
          updates.push(input);
          return input;
        },
      },
    };

    const result = await runPlantsSystem({
      world: baseWorld as never,
      tick: 1n,
      timeScale: 1,
      random: {} as never,
      client: client as never,
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toMatchObject({ deterministic: true, persistent: true });
    expect(updates.length).toBe(648);
  });
});
