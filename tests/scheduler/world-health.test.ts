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
});
