import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getClimateGrid } from "../../src/lib/simulation/climate-engine";
import { createGrid } from "../../src/lib/simulation/grid/grid";
import {
  getHydrologyState,
  type HydrologyGridCell,
} from "../../src/lib/simulation/hydrology-engine";
import { getTerrainState } from "../../src/lib/simulation/terrain-engine";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";
import { run as runOceansSystem } from "../../src/lib/simulation/systems/oceans";

const baseWorld = {
  id: "hydrology-test-world",
  name: "Hydrology Test World",
  slug: "hydrology-test-world",
  currentTick: 0n,
  seed: "hydrology-foundation-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
  planet: {
    oceanCoveragePercent: 71,
  },
};

const oceanTerrainTypes = new Set(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);

function hydrologySignature(cells: readonly HydrologyGridCell[]): string[] {
  return cells.map((cell) => [
    cell.id,
    cell.waterBodyType,
    cell.drainageDirection,
    cell.drainageTargetId ?? "-",
    cell.basinId ?? "-",
    cell.watershedId,
    cell.flowAccumulation,
    cell.moisturePotential,
    cell.distanceToOcean,
    cell.distanceToCoast,
  ].join(":"));
}

describe("hydrology foundation", () => {
  it("produces identical hydrology for the same seed and terrain", () => {
    const first = getHydrologyState(baseWorld);
    const second = getHydrologyState(baseWorld);

    expect(first.summary).toEqual(second.summary);
    expect(hydrologySignature(first.cells)).toEqual(hydrologySignature(second.cells));
  });

  it("recognizes ocean cells from terrain", () => {
    const grid = createGrid();
    const terrain = getTerrainState(baseWorld, grid);
    const hydrology = getHydrologyState(baseWorld, grid);
    const hydrologyById = new Map(hydrology.cells.map((cell) => [cell.id, cell]));

    for (const terrainCell of terrain.cells) {
      const hydrologyCell = hydrologyById.get(terrainCell.id);
      const expectedMarine = oceanTerrainTypes.has(terrainCell.terrainType);

      expect(hydrologyCell).toBeDefined();
      expect(Boolean(hydrologyCell?.isOcean || hydrologyCell?.isSea)).toBe(expectedMarine);
    }
  });

  it("gives land cells drainage directions or inland basin status", () => {
    const hydrology = getHydrologyState(baseWorld);
    const landCells = hydrology.cells.filter((cell) => !cell.isOcean && !cell.isSea);

    expect(landCells.length).toBeGreaterThan(0);

    for (const cell of landCells) {
      if (cell.drainageDirection === "INLAND_BASIN") {
        expect(cell.drainageTargetId).toBeNull();
        expect(cell.basinId).toBeTruthy();
      } else {
        expect(cell.drainageTargetId).toBeTruthy();
      }
    }
  });

  it("keeps flow accumulation deterministic", () => {
    const first = getHydrologyState(baseWorld).cells.map((cell) => [cell.id, cell.flowAccumulation]);
    const second = getHydrologyState(baseWorld).cells.map((cell) => [cell.id, cell.flowAccumulation]);

    expect(first).toEqual(second);
    expect(Math.max(...first.map(([, flow]) => Number(flow)))).toBeGreaterThan(1);
  });

  it("marks river candidates on suitable worlds", () => {
    const hydrology = getHydrologyState(baseWorld);

    expect(hydrology.summary.riverSourceCandidateCount).toBeGreaterThan(0);
    expect(hydrology.summary.riverChannelCandidateCount).toBeGreaterThan(0);
    expect(hydrology.cells.some((cell) => cell.isRiverCandidate)).toBe(true);
  });

  it("marks lake candidates when inland basins exist", () => {
    const hydrology = getHydrologyState(baseWorld);

    if (hydrology.summary.inlandBasinCount > 0) {
      expect(hydrology.summary.lakeCandidateCount).toBeGreaterThan(0);
      expect(hydrology.cells.some((cell) => cell.isLakeCandidate)).toBe(true);
    }
  });

  it("projects distance fields onto every cell", () => {
    const hydrology = getHydrologyState(baseWorld);

    for (const cell of hydrology.cells) {
      expect(Number.isFinite(cell.distanceToOcean)).toBe(true);
      expect(Number.isFinite(cell.distanceToCoast)).toBe(true);
      expect(cell.distanceToOcean).toBeGreaterThanOrEqual(0);
      expect(cell.distanceToCoast).toBeGreaterThanOrEqual(0);
    }
  });

  it("assigns deterministic watershed and basin ids", () => {
    const first = getHydrologyState(baseWorld).cells.map((cell) => [cell.id, cell.watershedId, cell.basinId]);
    const second = getHydrologyState(baseWorld).cells.map((cell) => [cell.id, cell.watershedId, cell.basinId]);

    expect(first).toEqual(second);
    expect(first.every(([, watershedId]) => typeof watershedId === "string")).toBe(true);
  });

  it("lets climate, terrain, and hydrology coexist on the same grid cell", () => {
    const grid = createGrid();
    const climateCell = getClimateGrid(baseWorld, grid)[0];
    const terrainCell = getTerrainState(baseWorld, grid).cells.find((cell) => cell.id === climateCell.id);
    const hydrologyCell = getHydrologyState(baseWorld, grid).cells.find((cell) => cell.id === climateCell.id);

    expect(terrainCell).toBeDefined();
    expect(hydrologyCell).toBeDefined();
    expect(climateCell.climateBand).toBeTruthy();
    expect(terrainCell?.terrainType).toBeTruthy();
    expect(hydrologyCell?.waterBodyType).toBeTruthy();
  });

  it("wires static hydrology metadata through the oceans scheduler system", () => {
    const result = runOceansSystem({
      world: baseWorld as never,
      tick: 1n,
      timeScale: 1,
      random: {} as never,
      client: {} as never,
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toMatchObject({
      static: true,
      activeWaterSimulation: "unmodeled",
      flowingRivers: "unmodeled",
      erosion: "unmodeled",
    });
  });

  it("does not introduce weather, life, civilization, or random behavior into hydrology", () => {
    const file = join(process.cwd(), "src", "lib", "simulation", "hydrology-engine.ts");
    const contents = readFileSync(file, "utf8");

    expect(contents.includes("Math.random")).toBe(false);
    expect(contents.includes("weather")).toBe(false);
    expect(contents.includes("civilization")).toBe(false);
    expect(contents.includes("plants")).toBe(false);
    expect(contents.includes("animals")).toBe(false);
  });
});
