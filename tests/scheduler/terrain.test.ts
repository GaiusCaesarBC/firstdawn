import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createGrid } from "../../src/lib/simulation/grid/grid";
import {
  getTerrainGrid,
  getTerrainState,
  getTerrainSummary,
  type TerrainGridCell,
} from "../../src/lib/simulation/terrain-engine";
import { run as runGeologySystem } from "../../src/lib/simulation/systems/geology";

const baseWorld = {
  id: "terrain-test-world",
  name: "Terrain Test World",
  slug: "terrain-test-world",
  seed: "terrain-foundation-seed",
  planet: {
    oceanCoveragePercent: 71,
  },
};

function terrainSignature(cells: readonly TerrainGridCell[]): string[] {
  return cells.map((cell) => [
    cell.id,
    cell.elevation,
    cell.terrainType,
    cell.continentalness,
    cell.ruggedness,
    cell.tectonicActivity,
    cell.isCoast,
  ].join(":"));
}

describe("terrain foundation", () => {
  it("produces identical terrain for the same seed", () => {
    const first = getTerrainState(baseWorld);
    const second = getTerrainState(baseWorld);

    expect(first.summary).toEqual(second.summary);
    expect(terrainSignature(first.cells)).toEqual(terrainSignature(second.cells));
  });

  it("produces different terrain for different seeds", () => {
    const first = getTerrainState(baseWorld);
    const second = getTerrainState({ ...baseWorld, seed: "different-terrain-seed" });

    expect(terrainSignature(first.cells)).not.toEqual(terrainSignature(second.cells));
  });

  it("keeps terrain classifications deterministic", () => {
    const first = getTerrainGrid(baseWorld).map((cell) => [cell.id, cell.terrainType]);
    const second = getTerrainGrid(baseWorld).map((cell) => [cell.id, cell.terrainType]);

    expect(first).toEqual(second);
  });

  it("keeps land percentage within realistic bounds", () => {
    const summary = getTerrainSummary(baseWorld);

    expect(summary.landPercent).toBeGreaterThanOrEqual(20);
    expect(summary.landPercent).toBeLessThanOrEqual(45);
    expect(summary.oceanPercent).toBeGreaterThanOrEqual(55);
    expect(summary.oceanPercent).toBeLessThanOrEqual(80);
  });

  it("generates oceans, continents, mountains, and coastlines", () => {
    const summary = getTerrainSummary(baseWorld);

    expect(summary.terrainDistribution.DEEP_OCEAN + summary.terrainDistribution.OCEAN + summary.terrainDistribution.SHALLOW_SEA).toBeGreaterThan(0);
    expect(summary.terrainDistribution.BEACH + summary.terrainDistribution.PLAINS + summary.terrainDistribution.HILLS + summary.terrainDistribution.PLATEAU + summary.terrainDistribution.MOUNTAINS + summary.terrainDistribution.HIGH_MOUNTAINS).toBeGreaterThan(0);
    expect(summary.terrainDistribution.MOUNTAINS + summary.terrainDistribution.HIGH_MOUNTAINS).toBeGreaterThan(0);
    expect(summary.coastlineCells).toBeGreaterThan(0);
    expect(summary.largestContinentEstimate).toBeGreaterThan(1);
    expect(summary.largestOceanEstimate).toBeGreaterThan(1);
  });

  it("assigns terrain data to every grid cell", () => {
    const grid = createGrid();
    const cells = getTerrainGrid(baseWorld, grid);

    expect(cells).toHaveLength(grid.getGridSummary().totalCells);

    for (const cell of cells) {
      expect(cell.elevation).toBeGreaterThanOrEqual(0);
      expect(cell.elevation).toBeLessThanOrEqual(1);
      expect(cell.continentalness).toBeGreaterThanOrEqual(0);
      expect(cell.continentalness).toBeLessThanOrEqual(1);
      expect(cell.ruggedness).toBeGreaterThanOrEqual(0);
      expect(cell.ruggedness).toBeLessThanOrEqual(1);
      expect(cell.tectonicActivity).toBeGreaterThanOrEqual(0);
      expect(cell.tectonicActivity).toBeLessThanOrEqual(1);
      expect(typeof cell.isCoast).toBe("boolean");
      expect(typeof cell.terrainType).toBe("string");
    }
  });

  it("exposes static terrain metadata through the geology scheduler system", () => {
    const result = runGeologySystem({
      world: baseWorld as never,
      tick: 1n,
      timeScale: 1,
      random: {} as never,
      client: {} as never,
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toMatchObject({
      static: true,
      erosion: "unmodeled",
      plateMovement: "unmodeled",
      earthquakes: "unmodeled",
    });
  });

  it("keeps terrain generation free of Math.random", () => {
    const file = join(process.cwd(), "src", "lib", "simulation", "terrain-engine.ts");
    const contents = readFileSync(file, "utf8");

    expect(contents.includes("Math.random")).toBe(false);
  });
});
