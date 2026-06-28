import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createGrid, getCell, getCellAt, getGridSummary, getNeighbors } from "../../src/lib/simulation/grid/grid";
import { getPlanet, getPlanetState } from "../../src/lib/simulation/planet-engine";

const world = {
  name: "Local Sandbox",
  planet: {
    name: "Local Sandbox Planet",
    radiusKm: 6371,
    gravityMS2: 9.81,
    massKg: 5.972e24,
    rotationPeriodHours: 24,
    orbitalPeriodDays: 365,
    axialTiltDegrees: 23.44,
    orbitalEccentricity: 0.0167,
    atmospherePressureKPa: 101.3,
    atmosphereComposition: {
      nitrogen: 78,
      oxygen: 21,
      argon: 0.93,
      carbonDioxide: 0.04,
    },
    oceanCoveragePercent: 71,
  },
};

describe("planet engine", () => {
  it("loads persisted planet values correctly", () => {
    const planet = getPlanet(world);

    expect(planet).toEqual(world.planet);
  });

  it("returns deterministic derived planet calculations", () => {
    expect(getPlanetState(world)).toEqual(getPlanetState(world));
  });

  it("calculates circumference and surface area within tolerance", () => {
    const state = getPlanetState(world);

    expect(state.diameterKm).toBe(12_742);
    expect(state.circumferenceKm).toBeCloseTo(40_030.173592, 6);
    expect(state.surfaceAreaKm2).toBeCloseTo(510_064_471.91, 2);
  });

  it("uses an explicit fallback for worlds without a planet relation", () => {
    const fallback = getPlanetState({ name: "Legacy Sandbox", planet: null });

    expect(fallback.name).toBe("Legacy Sandbox Planet (fallback)");
    expect(fallback.radiusKm).toBe(6371);
  });
});

describe("spatial grid", () => {
  it("generates the same grid deterministically", () => {
    const first = Array.from(createGrid().iterateCells());
    const second = Array.from(createGrid().iterateCells());

    expect(first).toEqual(second);
  });

  it("builds the default 18 x 36 grid with 648 cells", () => {
    const grid = createGrid();
    const summary = getGridSummary(grid);

    expect(summary.latitudeDivisions).toBe(18);
    expect(summary.longitudeDivisions).toBe(36);
    expect(summary.totalCells).toBe(648);
    expect(Array.from(grid.iterateCells())).toHaveLength(648);
  });

  it("returns a cell by deterministic id", () => {
    const grid = createGrid();
    const cell = getCell(grid, "cell-00-00");

    expect(cell).toBeDefined();
    expect(cell?.latitudeBand.index).toBe(0);
    expect(cell?.midpointLatitude).toBe(-85);
    expect(cell?.midpointLongitude).toBe(-175);
  });

  it("returns a cell for arbitrary coordinates", () => {
    const grid = createGrid();
    const cell = getCellAt(grid, 0, 0);

    expect(cell).toBeDefined();
    expect(cell?.latitudeRange.minimum).toBe(0);
    expect(cell?.latitudeRange.maximum).toBe(10);
    expect(cell?.longitudeRange.minimum).toBe(0);
    expect(cell?.longitudeRange.maximum).toBe(10);
  });

  it("returns neighboring cells for a non-polar anchor cell", () => {
    const grid = createGrid();
    const anchor = getCellAt(grid, 0, 0);

    expect(anchor).toBeDefined();

    const neighbors = getNeighbors(grid, anchor!.id);

    expect(neighbors).toHaveLength(8);
    expect(neighbors.map((cell) => cell.id)).toContain("cell-08-17");
    expect(neighbors.map((cell) => cell.id)).toContain("cell-10-19");
  });

  it("changes total cell count when the resolution changes", () => {
    const coarse = createGrid({ latitudeDivisions: 9, longitudeDivisions: 18 });
    const fine = createGrid({ latitudeDivisions: 36, longitudeDivisions: 72 });

    expect(getGridSummary(coarse).totalCells).toBe(162);
    expect(getGridSummary(fine).totalCells).toBe(2592);
  });

  it("keeps planet and grid modules free of Math.random", () => {
    const files = [
      join(process.cwd(), "src", "lib", "simulation", "planet-engine.ts"),
      join(process.cwd(), "src", "lib", "simulation", "grid", "grid.ts"),
      join(process.cwd(), "src", "lib", "simulation", "grid", "cell.ts"),
      join(process.cwd(), "src", "lib", "simulation", "grid", "coordinates.ts"),
    ];

    const offenders = files.filter((file) => readFileSync(file, "utf8").includes("Math.random"));

    expect(offenders).toEqual([]);
  });
});