import { WorldStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildWorldHealthSummary, type WorldHealthInput } from "../../src/lib/simulation/world-health";

const completedAt = "2026-06-28T12:00:00.000Z";

function weatherMetadata(success = true) {
  return {
    pipeline: [
      {
        name: "weather",
        label: "Weather",
        success,
        error: success ? null : "Weather summary failed.",
        metadata: success ? { dominantWeatherType: "clear", averageHumidity: 0.52 } : null,
      },
    ],
    failedSystems: success ? [] : ["weather"],
  };
}

function healthInput(overrides: Partial<WorldHealthInput> = {}): WorldHealthInput {
  return {
    world: {
      id: "world-health-test",
      name: "Health Test World",
      status: WorldStatus.ACTIVE,
      currentTick: 3n,
    },
    latestTick: {
      tick: 3n,
      success: true,
      metadata: weatherMetadata(),
    },
    lastSuccessfulTickCompletedAt: completedAt,
    expectedCellCount: 10,
    biomeCellCount: 10,
    plantCellCount: 10,
    animalCellCount: 8,
    animalSpeciesCount: 12,
    totalWildlifePopulation: 1234,
    averageAnimalHabitatSuitability: 0.62,
    averageAnimalHealth: 0.74,
    averageEcosystemHealth: 0.68,
    averageBiodiversity: 0.57,
    migrationActivity: 0.16,
    foodStability: 0.71,
    predatorBalance: 0.64,
    collapsedHabitats: 2,
    populationGrowthRate: 0.0123,
    plantConsumptionRate: 0.29,
    averageFitness: 0.66,
    averageAdaptationDiversity: 0.12,
    highestAdaptedPopulation: "Yak (0.82)",
    lowestFitnessPopulation: "Camel (0.31)",
    averageMigrationInstinct: 0.44,
    averageDiseaseResistance: 0.52,
    averageReproductiveEfficiency: 0.58,
    averageClimateAdaptation: 0.61,
    ...overrides,
  };
}

describe("world health summary", () => {
  it("marks a complete successful world as healthy", () => {
    const health = buildWorldHealthSummary(healthInput());

    expect(health.badge).toBe("Healthy");
    expect(health.worldName).toBe("Health Test World");
    expect(health.currentTick).toBe("3");
    expect(health.latestSimulationTickNumber).toBe("3");
    expect(health.lastTickStatus).toBe("success");
    expect(health.lastSuccessfulTickTime).toBe(completedAt);
    expect(health.biomeCoveragePercent).toBe(100);
    expect(health.plantCoveragePercent).toBe(100);
    expect(health.weatherSnapshotAvailable).toBe(true);
    expect(health.animalSpeciesCount).toBe(12);
    expect(health.occupiedAnimalHabitatPercent).toBe(80);
    expect(health.totalWildlifePopulation).toBe(1234);
    expect(health.averageAnimalHabitatSuitability).toBe(0.62);
    expect(health.averageAnimalHealth).toBe(0.74);
    expect(health.averageEcosystemHealth).toBe(0.68);
    expect(health.averageBiodiversity).toBe(0.57);
    expect(health.migrationActivity).toBe(0.16);
    expect(health.foodStability).toBe(0.71);
    expect(health.predatorBalance).toBe(0.64);
    expect(health.collapsedHabitats).toBe(2);
    expect(health.populationGrowthRate).toBe(0.0123);
    expect(health.plantConsumptionRate).toBe(0.29);
    expect(health.averageFitness).toBe(0.66);
    expect(health.averageAdaptationDiversity).toBe(0.12);
    expect(health.highestAdaptedPopulation).toBe("Yak (0.82)");
    expect(health.lowestFitnessPopulation).toBe("Camel (0.31)");
    expect(health.averageMigrationInstinct).toBe(0.44);
    expect(health.averageDiseaseResistance).toBe(0.52);
    expect(health.averageReproductiveEfficiency).toBe(0.58);
    expect(health.averageClimateAdaptation).toBe(0.61);
  });

  it("warns when World.currentTick is stale versus the latest SimulationTick", () => {
    const health = buildWorldHealthSummary(healthInput({
      world: {
        id: "world-health-test",
        name: "Health Test World",
        status: WorldStatus.ACTIVE,
        currentTick: 2n,
      },
      latestTick: {
        tick: 3n,
        success: true,
        metadata: weatherMetadata(),
      },
    }));

    expect(health.badge).toBe("Warning");
    expect(health.currentTick).toBe("2");
    expect(health.latestSimulationTickNumber).toBe("3");
  });

  it("marks a failed latest tick with failed systems and an error as error", () => {
    const health = buildWorldHealthSummary(healthInput({
      latestTick: {
        tick: 4n,
        success: false,
        metadata: weatherMetadata(false),
      },
    }));

    expect(health.badge).toBe("Error");
    expect(health.lastTickStatus).toBe("failed");
    expect(health.failedSystems).toEqual(["weather"]);
    expect(health.lastErrorMessage).toBe("Weather summary failed.");
    expect(health.weatherSnapshotAvailable).toBe(false);
  });

  it("warns when biome or plant coverage is missing", () => {
    const health = buildWorldHealthSummary(healthInput({
      biomeCellCount: 5,
      plantCellCount: 0,
    }));

    expect(health.badge).toBe("Warning");
    expect(health.biomeCoveragePercent).toBe(50);
    expect(health.plantCoveragePercent).toBe(0);
  });
  it("aggregates scheduler system health metadata", () => {
    const health = buildWorldHealthSummary(healthInput({
      latestTick: {
        tick: 3n,
        success: true,
        metadata: {
          ...weatherMetadata(),
          health: {
            status: "Warning",
            diagnostics: ["Atmosphere drift approaching warning threshold."],
          },
        },
      },
    }));

    expect(health.badge).toBe("Warning");
    expect(health.systemHealthStatus).toBe("Warning");
    expect(health.systemHealthDiagnostics).toEqual(["Atmosphere drift approaching warning threshold."]);
  });
});
