import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getClimateGrid,
  getClimateForLatitude,
  getClimateStateAtTick,
} from "../../src/lib/simulation/climate-engine";
import { createGrid } from "../../src/lib/simulation/grid/grid";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const baseWorld = {
  currentTick: 0n,
  ...DEFAULT_WORLD_TIME_CONFIG,
};

function findLatitude(state: ReturnType<typeof getClimateStateAtTick>, latitude: number) {
  const result = state.latitudes.find((entry) => entry.latitude === latitude);

  if (!result) {
    throw new Error(`Expected latitude sample ${latitude} to exist.`);
  }

  return result;
}

describe("climate engine", () => {
  it("returns the same climate state for the same inputs", () => {
    const first = getClimateStateAtTick(baseWorld, 12_345n);
    const second = getClimateStateAtTick(baseWorld, 12_345n);

    expect(first).toEqual(second);
  });

  it("returns different climate profiles at different latitudes", () => {
    const equator = getClimateForLatitude(baseWorld, 0);
    const highLatitude = getClimateForLatitude(baseWorld, 70);

    expect(highLatitude.averageTemperatureC).toBeLessThan(equator.averageTemperatureC);
    expect(highLatitude.daylightHours).not.toBe(equator.daylightHours);
    expect(highLatitude.climateBand).not.toBe(equator.climateBand);
  });

  it("keeps opposite hemispheres in opposite seasons", () => {
    const state = getClimateStateAtTick(baseWorld, 100n * 1_440n);
    const north = findLatitude(state, 60);
    const south = findLatitude(state, -60);

    expect(north.season).toBe("summer");
    expect(south.season).toBe("winter");
  });

  it("keeps the equator near 12 daylight hours", () => {
    const state = getClimateStateAtTick(baseWorld, 91n * 1_440n);
    const equator = findLatitude(state, 0);

    expect(equator.daylightHours).toBeGreaterThan(11.5);
    expect(equator.daylightHours).toBeLessThan(12.5);
  });

  it("gives poles extreme daylight variation across the year", () => {
    const northSummer = findLatitude(getClimateStateAtTick(baseWorld, 136n * 1_440n), 90);
    const northWinter = findLatitude(getClimateStateAtTick(baseWorld, 319n * 1_440n), 90);

    expect(northSummer.daylightHours).toBeGreaterThan(20);
    expect(northWinter.daylightHours).toBeLessThan(4);
  });

  it("projects passive climate fields onto grid cells", () => {
    const cells = getClimateGrid(baseWorld, createGrid());
    const equatorialCell = cells.find((cell) => cell.midpointLatitude === 5);

    expect(cells).toHaveLength(648);
    expect(equatorialCell).toBeDefined();
    expect(equatorialCell?.latitude).toBe(5);
    expect(typeof equatorialCell?.averageTemperature).toBe("number");
    expect(typeof equatorialCell?.daylightHours).toBe("number");
    expect(typeof equatorialCell?.solarEnergy).toBe("number");
    expect(typeof equatorialCell?.climateBand).toBe("string");
  });

  it("keeps climate calculations free of Math.random", () => {
    const file = join(process.cwd(), "src", "lib", "simulation", "climate-engine.ts");
    const contents = readFileSync(file, "utf8");

    expect(contents.includes("Math.random")).toBe(false);
  });
});