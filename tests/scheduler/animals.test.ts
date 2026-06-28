import { describe, expect, it } from "vitest";

import {
  getAnimalEcologyState,
  persistAnimalEcologyState,
  type AnimalGridCell,
} from "../../src/lib/simulation/animal-engine";
import { createGrid } from "../../src/lib/simulation/grid/grid";
import { getPlantEcologyState } from "../../src/lib/simulation/plant-engine";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { run as runAnimalsSystem } from "../../src/lib/simulation/systems/animals";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const baseWorld = {
  id: "animal-test-world",
  name: "Animal Test World",
  slug: "animal-test-world",
  currentTick: 0n,
  seed: "plant-ecology-foundation-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
  planet: {
    oceanCoveragePercent: 65,
    atmospherePressureKPa: 101.3,
  },
};

const hotDryWorld = { ...baseWorld, id: "animal-hot-dry-test-world", slug: "animal-hot-dry-test-world", seed: "planet-biome-dry" };
const hotWetWorld = { ...baseWorld, id: "animal-hot-wet-test-world", slug: "animal-hot-wet-test-world", seed: "mountain-world" };
const aquaticGuilds = new Set(["aquatic-microfauna", "fish"]);

function animalSignature(cells: readonly AnimalGridCell[]): string[] {
  return cells.map((cell) => [
    cell.id,
    cell.biomeKey,
    cell.dominantAnimalGuildKey,
    cell.animalSuitabilityScore,
    cell.herbivoreCapacity,
    cell.predatorCapacity,
    cell.preyAvailability,
    cell.animalDensity,
    cell.migrationPressure,
    cell.dangerScore,
    cell.huntingValue,
    cell.domesticationPotential,
    cell.animalBiodiversityScore,
    cell.carryingCapacityScore,
  ].join(":"));
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function cellsForBiomes(cells: readonly AnimalGridCell[], keys: readonly string[]): AnimalGridCell[] {
  return cells.filter((cell) => keys.includes(cell.biomeKey));
}

describe("animal ecology foundation", () => {
  it("generates animal ecology data for all valid cells", () => {
    const animals = getAnimalEcologyState(baseWorld);

    expect(animals.cells).toHaveLength(648);
    expect(animals.cells.every((cell) => cell.dominantAnimalGuildKey && cell.dominantAnimalGuildName && cell.animalTags.length > 0)).toBe(true);
    expect(animals.cells.every((cell) => cell.animalSuitabilityScore >= 0 && cell.animalSuitabilityScore <= 1)).toBe(true);
    expect(animals.cells.every((cell) => cell.carryingCapacityScore >= 0 && cell.carryingCapacityScore <= 1)).toBe(true);
  });

  it("is deterministic across repeated runs", () => {
    const first = getAnimalEcologyState(baseWorld);
    const second = getAnimalEcologyState(baseWorld);

    expect(first.summary).toEqual(second.summary);
    expect(animalSignature(first.cells)).toEqual(animalSignature(second.cells));
  });

  it("keeps ocean cells aquatic", () => {
    const animals = getAnimalEcologyState(baseWorld);
    const oceanCells = cellsForBiomes(animals.cells, ["ocean"]);

    expect(oceanCells.length).toBeGreaterThan(0);
    expect(oceanCells.every((cell) => aquaticGuilds.has(cell.dominantAnimalGuildKey))).toBe(true);
    expect(average(oceanCells.map((cell) => cell.herbivoreCapacity))).toBeLessThan(0.28);
  });

  it("keeps ice and barren cells low density", () => {
    const animals = getAnimalEcologyState(baseWorld);
    const harshCells = cellsForBiomes(animals.cells, ["ice-sheet", "volcanic-barren"]);

    if (harshCells.length > 0) {
      expect(average(harshCells.map((cell) => cell.animalDensity))).toBeLessThan(0.16);
      expect(Math.max(...harshCells.map((cell) => cell.carryingCapacityScore))).toBeLessThanOrEqual(0.28);
    }
  });

  it("makes rainforest and wetland cells biodiverse", () => {
    const animals = getAnimalEcologyState(hotWetWorld);
    const biodiverseCells = cellsForBiomes(animals.cells, ["tropical-rainforest", "river-wetland", "swamp-marsh"]);

    expect(biodiverseCells.length).toBeGreaterThan(0);
    expect(average(biodiverseCells.map((cell) => cell.animalBiodiversityScore))).toBeGreaterThan(0.56);
    expect(biodiverseCells.filter((cell) => ["insects", "birds", "amphibians", "wetland-animals", "apex-predators"].includes(cell.dominantAnimalGuildKey)).length / biodiverseCells.length).toBeGreaterThan(0.45);
  });

  it("makes grasslands and savannas support herbivores and grazers", () => {
    const animals = getAnimalEcologyState(baseWorld);
    const grasslands = cellsForBiomes(animals.cells, ["temperate-grassland", "savanna"]);

    expect(grasslands.length).toBeGreaterThan(0);
    expect(average(grasslands.map((cell) => cell.herbivoreCapacity))).toBeGreaterThan(0.38);
    expect(grasslands.filter((cell) => ["grazers", "large-herbivores", "small-herbivores"].includes(cell.dominantAnimalGuildKey)).length / grasslands.length).toBeGreaterThan(0.35);
  });

  it("makes predator capacity depend on prey and herbivore capacity", () => {
    const animals = getAnimalEcologyState(baseWorld);
    const highPrey = animals.cells.filter((cell) => cell.preyAvailability >= 0.48 || cell.herbivoreCapacity >= 0.48);
    const lowPrey = animals.cells.filter((cell) => cell.preyAvailability <= 0.18 && cell.herbivoreCapacity <= 0.18);

    expect(highPrey.length).toBeGreaterThan(0);
    expect(lowPrey.length).toBeGreaterThan(0);
    expect(average(highPrey.map((cell) => cell.predatorCapacity))).toBeGreaterThan(average(lowPrey.map((cell) => cell.predatorCapacity)));
  });

  it("keeps deserts sparse while allowing desert-adapted guilds", () => {
    const animals = getAnimalEcologyState(hotDryWorld);
    const dryCells = animals.cells.filter((cell) =>
      ["desert", "badlands-rocky", "mediterranean-shrubland"].includes(cell.biomeKey)
      || (cell.precipitationScore <= 0.24 && !["ocean", "coast", "lake"].includes(cell.biomeKey)),
    );

    expect(dryCells.length).toBeGreaterThan(0);
    expect(average(dryCells.map((cell) => cell.animalDensity))).toBeLessThan(0.28);
    expect(dryCells.filter((cell) => ["desert-adapted-animals", "burrowers", "reptiles", "scavengers"].includes(cell.dominantAnimalGuildKey)).length / dryCells.length).toBeGreaterThan(0.42);
  });

  it("does not make domestication potential high everywhere", () => {
    const animals = getAnimalEcologyState(baseWorld);
    const highDomesticationCells = animals.cells.filter((cell) => cell.domesticationPotential >= 0.58);

    expect(highDomesticationCells.length / animals.cells.length).toBeLessThan(0.22);
    expect(Math.max(...animals.cells.map((cell) => cell.domesticationPotential))).toBeGreaterThan(0.45);
  });

  it("does not use Math.random in the animal ecology implementation", async () => {
    const fs = await import("node:fs/promises");
    const files = [
      "src/lib/simulation/animal-definitions.ts",
      "src/lib/simulation/animal-engine.ts",
      "src/lib/simulation/systems/animals.ts",
    ];
    const contents = await Promise.all(files.map((file) => fs.readFile(file, "utf8")));

    expect(contents.join("\n")).not.toContain("Math.random");
  });

  it("requires persisted plant ecology before animal persistence", async () => {
    const client = {
      planet: {
        findUnique: async () => ({ id: "planet-without-plants" }),
      },
      planetCell: {
        findMany: async () => [],
        update: async () => ({}),
      },
    };

    await expect(persistAnimalEcologyState(baseWorld, client as never)).rejects.toThrow(/requires persisted plant ecology/i);
  });

  it("wires animals after plant ecology and before humans and civilization", async () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Plant Ecology")).toBeLessThan(labels.indexOf("Animals"));
    expect(labels.indexOf("Animals")).toBeLessThan(labels.indexOf("Humans"));
    expect(labels.indexOf("Animals")).toBeLessThan(labels.indexOf("Civilization"));

    const grid = createGrid();
    const plantState = getPlantEcologyState(baseWorld, grid);
    const now = new Date("2026-01-01T00:00:00.000Z");
    const updates: unknown[] = [];
    const client = {
      planet: {
        findUnique: async () => ({ id: "planet-with-plants" }),
      },
      planetCell: {
        findMany: async () => plantState.cells.map((cell) => ({
          planetId: "planet-with-plants",
          cellId: cell.id,
          plantGeneratedAt: now,
          plantUpdatedAt: now,
          animalGeneratedAt: null,
          animalUpdatedAt: null,
          dominantAnimalGuildKey: "aquatic-microfauna",
          dominantAnimalGuildName: "Aquatic Microfauna",
          animalSuitabilityScore: 0,
          herbivoreCapacity: 0,
          predatorCapacity: 0,
          preyAvailability: 0,
          animalDensity: 0,
          migrationPressure: 0,
          dangerScore: 0,
          huntingValue: 0,
          domesticationPotential: 0,
          animalBiodiversityScore: 0,
          carryingCapacityScore: 0,
          animalTags: [],
        })),
        update: async (input: unknown) => {
          updates.push(input);
          return input;
        },
      },
    };

    const result = await runAnimalsSystem({
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