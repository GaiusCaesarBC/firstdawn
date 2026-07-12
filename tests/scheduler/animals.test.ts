import { describe, expect, it } from "vitest";

import {
  getAnimalEcologyState,
  getAnimalPopulationDefinitions,
  persistAnimalEcologyState,
  scoreAnimalSpeciesHabitat,
  type AnimalGridCell,
} from "../../src/lib/simulation/animal-engine";
import { createGrid } from "../../src/lib/simulation/grid/grid";
import { getPlantEcologyState } from "../../src/lib/simulation/plant-engine";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { run as runAnimalsSystem } from "../../src/lib/simulation/systems/animals";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";
import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";

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
  it("defines representative species for deterministic population simulation", () => {
    const definitions = getAnimalPopulationDefinitions();
    const ids = new Set(definitions.map((definition) => definition.id));

    expect(definitions.length).toBeGreaterThanOrEqual(20);
    expect(definitions.length).toBeLessThanOrEqual(30);
    for (const id of ["rabbit", "deer", "bison", "elephant", "antelope", "goat", "yak", "wolf", "lion", "tiger", "bear", "fox", "eagle", "pig", "boar", "raccoon", "crow", "salmon", "tuna", "shark", "seal", "polar-bear", "camel"]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(definitions.every((definition) => definition.preferredBiomes.length > 0 && definition.bodyMass > 0)).toBe(true);
  });

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
    expect(labels.indexOf("Animals")).toBeLessThan(labels.indexOf("Population Adaptation"));
    expect(labels.indexOf("Population Adaptation")).toBeLessThan(labels.indexOf("Humans"));
    expect(labels.indexOf("Population Adaptation")).toBeLessThan(labels.indexOf("Civilization"));

    const grid = createGrid();
    const plantState = getPlantEcologyState(baseWorld, grid);
    const now = new Date("2026-01-01T00:00:00.000Z");
    const updates: unknown[] = [];
    const client = {
      planet: {
        findUnique: async () => ({ id: "planet-with-plants" }),
      },
      animalPopulation: {
        deleteMany: async () => ({}),
        createMany: async (input: unknown) => {
          updates.push(input);
          return input;
        },
      },
      planetCell: {
        findMany: async () => plantState.cells.map((cell) => ({
          id: `planet-cell-${cell.id}`,
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
          dominantSpeciesId: "none",
          dominantSpeciesName: "No Established Wildlife",
          animalSpeciesCount: 0,
          totalWildlifePopulation: 0,
          averageAnimalHealth: 0,
          averageHabitatSuitability: 0,
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
    expect(updates.length).toBeGreaterThan(648);
  });

  it("scores species habitat by biome suitability rather than latitude", () => {
    const animals = getAnimalEcologyState(baseWorld);
    const grassland = animals.cells.find((cell) => cell.biomeKey === "temperate-grassland" || cell.biomeKey === "savanna");
    const ocean = animals.cells.find((cell) => cell.biomeKey === "ocean");
    const camel = getAnimalPopulationDefinitions().find((definition) => definition.id === "camel");
    const tuna = getAnimalPopulationDefinitions().find((definition) => definition.id === "tuna");

    expect(grassland && ocean && camel && tuna).toBeTruthy();
    expect(scoreAnimalSpeciesHabitat(camel!, grassland!, { herbivores: grassland!.herbivoreCapacity, prey: grassland!.preyAvailability })).toBeGreaterThan(scoreAnimalSpeciesHabitat(camel!, ocean!, { herbivores: ocean!.herbivoreCapacity, prey: ocean!.preyAvailability }));
    expect(scoreAnimalSpeciesHabitat(tuna!, ocean!, { herbivores: ocean!.herbivoreCapacity, prey: ocean!.preyAvailability })).toBeGreaterThan(scoreAnimalSpeciesHabitat(tuna!, grassland!, { herbivores: grassland!.herbivoreCapacity, prey: grassland!.preyAvailability }));
  });

  it("generates deterministic population, health, food, and migration records", () => {
    const animals = getAnimalEcologyState(baseWorld);
    const populated = animals.cells.filter((cell) => cell.totalWildlifePopulation > 0);

    expect(populated.length).toBeGreaterThan(0);
    expect(animals.summary.animalSpeciesCount).toBeGreaterThan(8);
    expect(animals.summary.totalWildlifePopulation).toBeGreaterThan(0);
    expect(animals.summary.averageHabitatSuitability).toBeGreaterThan(0);
    expect(animals.summary.averageHealth).toBeGreaterThan(0);
    expect(populated.every((cell) => cell.animalPopulations.every((population) => population.population >= 0 && population.population <= population.carryingCapacity))).toBe(true);
  });

  it("applies deterministic logistic growth without exceeding carrying capacity", () => {
    const early = getAnimalEcologyState({ ...baseWorld, currentTick: 1n });
    const later = getAnimalEcologyState({ ...baseWorld, currentTick: 180n });

    expect(later.summary.totalWildlifePopulation).toBeGreaterThanOrEqual(early.summary.totalWildlifePopulation);
    expect(later.cells.every((cell) => cell.animalPopulations.every((population) => population.population <= population.carryingCapacity))).toBe(true);
  });

  it("reduces health under starvation pressure", () => {
    const animals = getAnimalEcologyState(hotDryWorld);
    const hungry = animals.cells.flatMap((cell) => cell.animalPopulations).filter((population) => population.population > 0 && population.foodAvailability <= 0.24);
    const fed = animals.cells.flatMap((cell) => cell.animalPopulations).filter((population) => population.population > 0 && population.foodAvailability >= 0.52);

    expect(hungry.length).toBeGreaterThan(0);
    expect(fed.length).toBeGreaterThan(0);
    expect(average(hungry.map((population) => population.health))).toBeLessThan(average(fed.map((population) => population.health)));
  });

  it("changes reproduction and population pressure across seasons deterministically", () => {
    const winter = getAnimalEcologyState({ ...baseWorld, currentTick: 0n });
    const spring = getAnimalEcologyState({ ...baseWorld, currentTick: 1400n });

    expect(animalSignature(winter.cells)).not.toEqual(animalSignature(spring.cells));
    expect(spring.summary.totalWildlifePopulation).toBeGreaterThan(0);
  });



  it("moves populations gradually between neighboring cells while conserving migration deltas", () => {
    const grid = createGrid();
    const animals = getAnimalEcologyState({ ...baseWorld, currentTick: 720n });
    const outboundVectors = animals.cells.flatMap((cell) => cell.movementVectors.filter((vector) => vector.fromCellId === cell.id));
    const netMigrationBySpecies = new Map<string, number>();

    expect(outboundVectors.length).toBeGreaterThan(0);
    expect(outboundVectors.reduce((total, vector) => total + vector.population, 0) / animals.summary.totalWildlifePopulation).toBeLessThan(0.02);

    for (const vector of outboundVectors) {
      const neighborIds = new Set(grid.getNeighbors(vector.fromCellId).map((neighbor) => neighbor.id));
      expect(neighborIds.has(vector.toCellId)).toBe(true);
      expect(vector.population).toBeGreaterThan(0);
    }

    for (const population of animals.cells.flatMap((cell) => cell.animalPopulations)) {
      netMigrationBySpecies.set(population.speciesId, (netMigrationBySpecies.get(population.speciesId) ?? 0) + population.netMigration);
    }

    expect([...netMigrationBySpecies.values()].every((netMigration) => netMigration === 0)).toBe(true);
  });

  it("links plant consumption to food stability and records vegetation recovery events", () => {
    const animals = getAnimalEcologyState({ ...baseWorld, currentTick: 720n });
    const heavyConsumption = animals.cells.filter((cell) => cell.plantConsumptionRate >= 0.58);
    const lightConsumption = animals.cells.filter((cell) => cell.plantConsumptionRate < 0.32);
    const plantConsumers = (cells: readonly AnimalGridCell[]) => cells.flatMap((cell) =>
      cell.animalPopulations.filter((population) =>
        population.population > 0 && (population.trophicLevel === "Herbivore" || population.trophicLevel === "Omnivore"),
      ),
    );
    const stressedConsumers = plantConsumers(heavyConsumption);
    const lightConsumers = plantConsumers(lightConsumption);
    const recoveryEvents = animals.cells.flatMap((cell) => cell.ecosystemEvents).filter((event) => event.type === "Vegetation Recovery" || event.type === "Flood Recovery");

    expect(heavyConsumption.length).toBeGreaterThan(0);
    expect(lightConsumption.length).toBeGreaterThan(0);
    expect(stressedConsumers.length).toBeGreaterThan(0);
    expect(lightConsumers.length).toBeGreaterThan(0);
    expect(recoveryEvents.length).toBeGreaterThan(0);
    expect(heavyConsumption.every((cell) => cell.effectivePlantBiomass <= cell.biomassScore + cell.regrowthRate * 0.16)).toBe(true);
    expect(average(heavyConsumption.map((cell) => cell.effectivePlantBiomass))).toBeLessThan(average(heavyConsumption.map((cell) => cell.biomassScore)));
    expect(average(stressedConsumers.map((population) => population.foodAvailability))).toBeLessThan(average(lightConsumers.map((population) => population.foodAvailability)));
    expect(average(stressedConsumers.map((population) => population.populationTrend))).toBeLessThan(average(lightConsumers.map((population) => population.populationTrend)));
    expect(average(heavyConsumption.map((cell) => cell.foodStability))).toBeLessThan(average(animals.cells.map((cell) => Math.max(cell.foodStability, 0.001))));
    expect(animals.summary.plantConsumptionRate).toBeGreaterThan(0);
    expect(animals.summary.foodStability).toBeGreaterThan(0);
  });

  it("applies predator pressure as a population trend cost for herbivores", () => {
    const animals = getAnimalEcologyState({ ...baseWorld, currentTick: 720n });
    const herbivores = animals.cells.flatMap((cell) => cell.animalPopulations).filter((population) => population.trophicLevel === "Herbivore" && population.population > 0);
    const highPredation = herbivores.filter((population) => population.predationPressure >= 0.4);
    const lowPredation = herbivores.filter((population) => population.predationPressure <= 0.12);

    expect(highPredation.length).toBeGreaterThan(0);
    expect(lowPredation.length).toBeGreaterThan(0);
    expect(average(highPredation.map((population) => population.populationTrend))).toBeLessThan(average(lowPredation.map((population) => population.populationTrend)));
    expect(animals.summary.predatorBalance).toBeGreaterThanOrEqual(0);
    expect(animals.summary.predatorBalance).toBeLessThanOrEqual(1);
  });

  it("changes migration activity across seasons deterministically", () => {
    const spring = getAnimalEcologyState({ ...baseWorld, currentTick: 90n });
    const lateSeason = getAnimalEcologyState({ ...baseWorld, currentTick: 720n });
    const springVectors = spring.cells.flatMap((cell) => cell.movementVectors.filter((vector) => vector.fromCellId === cell.id));
    const lateSeasonVectors = lateSeason.cells.flatMap((cell) => cell.movementVectors.filter((vector) => vector.fromCellId === cell.id));

    expect(springVectors.length).toBeGreaterThan(0);
    expect(lateSeasonVectors.length).toBeGreaterThan(springVectors.length);
    expect(lateSeason.summary.migrationActivity).toBeGreaterThan(0);
  });

  it("records deterministic ecosystem health statuses, events, and history", () => {
    const first = getAnimalEcologyState({ ...baseWorld, currentTick: 720n });
    const second = getAnimalEcologyState({ ...baseWorld, currentTick: 720n });
    const statuses = new Set(first.cells.map((cell) => cell.ecosystemHealthStatus));
    const eventTypes = new Set(first.cells.flatMap((cell) => cell.ecosystemEvents.map((event) => event.type)));

    expect(statuses.size).toBeGreaterThan(1);
    expect(eventTypes.has("Migration Wave")).toBe(true);
    expect(eventTypes.has("Predator Expansion")).toBe(true);
    expect(first.cells.every((cell) => cell.ecosystemHistory.length >= 4)).toBe(true);
    expect(first.cells.map((cell) => cell.ecosystemHistory.map((event) => event.id))).toEqual(second.cells.map((cell) => cell.ecosystemHistory.map((event) => event.id)));
  });

  it("serializes animal populations into atlas snapshots", () => {
    const snapshot = buildAtlasSnapshot(baseWorld as never, 2);
    const populated = snapshot.cells.find((cell) => cell.totalWildlifePopulation > 0);

    expect(populated).toBeTruthy();
    expect(populated?.animalPopulations.length).toBeGreaterThan(0);
    expect(populated?.dominantSpeciesId).not.toBe("none");
    expect(populated?.ecosystemHealthScore).toBeGreaterThan(0);
    expect(populated?.ecosystemHistory.length).toBeGreaterThanOrEqual(4);
    expect(snapshot.cells.some((cell) => cell.movementVectors.length > 0)).toBe(true);
  });

  it("adapts populations slowly toward matching environmental pressures", () => {
    const early = getAnimalEcologyState({ ...baseWorld, currentTick: 1n });
    const mature = getAnimalEcologyState({ ...baseWorld, currentTick: 12_000n });
    const coldCell = mature.cells.find((cell) => cell.adjustedTemperatureC <= 5 && cell.animalPopulations.some((population) => population.population > 0));

    expect(coldCell).toBeTruthy();
    const maturePopulation = coldCell!.animalPopulations.find((population) => population.population > 0)!;
    const earlyPopulation = early.cells.find((cell) => cell.id === coldCell!.id)?.animalPopulations.find((population) => population.speciesId === maturePopulation.speciesId);

    expect(earlyPopulation).toBeTruthy();
    expect(maturePopulation.adaptationProfile.coldTolerance).toBeGreaterThanOrEqual(earlyPopulation!.adaptationProfile.coldTolerance);
    expect(maturePopulation.adaptationTrends.some((trend) => trend.trait === "coldTolerance")).toBe(true);
    expect(Object.values(maturePopulation.adaptationProfile).every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("keeps opposite-environment adaptation pressure distinct", () => {
    const cold = getAnimalEcologyState({ ...baseWorld, currentTick: 12_000n });
    const dry = getAnimalEcologyState({ ...hotDryWorld, currentTick: 12_000n });
    const coldPopulation = cold.cells.flatMap((cell) => cell.animalPopulations).find((population) => population.population > 0 && population.adaptationProfile.coldTolerance >= 0.58);
    const dryPopulation = dry.cells.flatMap((cell) => cell.animalPopulations).find((population) => population.population > 0 && population.adaptationProfile.droughtTolerance >= 0.58);

    expect(coldPopulation).toBeTruthy();
    expect(dryPopulation).toBeTruthy();
    expect(dryPopulation!.adaptationProfile.droughtTolerance).toBeGreaterThan(dryPopulation!.adaptationProfile.coldTolerance);
    expect(coldPopulation!.adaptationProfile.coldTolerance).toBeGreaterThan(coldPopulation!.adaptationProfile.heatTolerance);
  });

  it("calculates fitness and lets adaptation improve population outcomes", () => {
    const early = getAnimalEcologyState({ ...baseWorld, currentTick: 1n });
    const mature = getAnimalEcologyState({ ...baseWorld, currentTick: 10_000n });
    const cell = mature.cells.find((candidate) => candidate.totalWildlifePopulation > 0 && candidate.averageFitness > 0.4);
    const maturePopulation = cell?.animalPopulations.find((population) => population.population > 0);
    const earlyPopulation = cell ? early.cells.find((candidate) => candidate.id === cell.id)?.animalPopulations.find((population) => population.speciesId === maturePopulation?.speciesId) : null;

    expect(cell).toBeTruthy();
    expect(maturePopulation).toBeTruthy();
    expect(earlyPopulation).toBeTruthy();
    expect(maturePopulation!.fitnessScore).toBeGreaterThan(0);
    expect(maturePopulation!.fitnessScore).toBeLessThanOrEqual(1);
    expect(maturePopulation!.population).toBeGreaterThanOrEqual(earlyPopulation!.population);
  });

  it("uses migration instinct in migration pressure and records adaptation milestones", () => {
    const mature = getAnimalEcologyState({ ...baseWorld, currentTick: 12_000n });
    const populations = mature.cells.flatMap((cell) => cell.animalPopulations).filter((population) => population.population > 0);
    const highMigration = populations.filter((population) => population.adaptationProfile.migrationInstinct >= 0.56);
    const lowMigration = populations.filter((population) => population.adaptationProfile.migrationInstinct <= 0.44);
    const adaptationEvents = mature.cells.flatMap((cell) => cell.ecosystemHistory).filter((event) => event.type === "Adaptation Milestone");

    expect(highMigration.length).toBeGreaterThan(0);
    expect(lowMigration.length).toBeGreaterThan(0);
    expect(average(highMigration.map((population) => population.migrationPressure))).toBeGreaterThanOrEqual(average(lowMigration.map((population) => population.migrationPressure)));
    expect(adaptationEvents.length).toBeGreaterThan(0);
  });

  it("serializes adaptation into atlas snapshots for overlays and inspectors", () => {
    const snapshot = buildAtlasSnapshot({ ...baseWorld, currentTick: 10_000n } as never, 2);
    const adapted = snapshot.cells.find((cell) => cell.averageFitness > 0 && cell.animalPopulations.some((population) => population.population > 0));

    expect(adapted).toBeTruthy();
    expect(adapted?.averageClimateAdaptation).toBeGreaterThan(0);
    expect(adapted?.animalPopulations[0]?.adaptationProfile.coldTolerance).toBeGreaterThanOrEqual(0);
    expect(adapted?.animalPopulations[0]?.adaptationTrends.length).toBeGreaterThan(0);
  });
});