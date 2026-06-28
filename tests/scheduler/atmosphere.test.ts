import { describe, expect, it } from "vitest";

import {
  getAtmosphereState,
  getAtmosphereStateAtTick,
  type AtmosphericGridCell,
} from "../../src/lib/simulation/atmosphere-engine";
import { createGrid } from "../../src/lib/simulation/grid/grid";
import { getHydrologyState } from "../../src/lib/simulation/hydrology-engine";
import { run as runAtmosphereSystem } from "../../src/lib/simulation/systems/atmosphere";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { getTerrainState } from "../../src/lib/simulation/terrain-engine";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const baseWorld = {
  id: "atmosphere-test-world",
  name: "Atmosphere Test World",
  slug: "atmosphere-test-world",
  currentTick: 0n,
  seed: "atmosphere-foundation-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
  planet: {
    oceanCoveragePercent: 71,
  },
};

const oceanTerrainTypes = new Set(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);
const mountainTerrainTypes = new Set(["MOUNTAINS", "HIGH_MOUNTAINS", "PLATEAU"]);

function atmosphereSignature(cells: readonly AtmosphericGridCell[]): string[] {
  return cells.map((cell) => [
    cell.id,
    cell.pressureZone,
    cell.pressureValue,
    cell.windDirection,
    cell.windStrength,
    cell.temperatureGradient,
    cell.moistureTransportPotential,
    cell.orographicLiftPotential,
    cell.rainShadowPotential,
    cell.atmosphericStability,
    cell.seasonalShift,
  ].join(":"));
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

describe("atmosphere foundation", () => {
  it("produces deterministic atmosphere for the same world", () => {
    const first = getAtmosphereState(baseWorld);
    const second = getAtmosphereState(baseWorld);

    expect(first.summary).toEqual(second.summary);
    expect(atmosphereSignature(first.cells)).toEqual(atmosphereSignature(second.cells));
  });

  it("keeps identical seeds identical", () => {
    const first = getAtmosphereState(baseWorld);
    const second = getAtmosphereState({ ...baseWorld, id: "same-seed-world" });

    expect(atmosphereSignature(first.cells)).toEqual(atmosphereSignature(second.cells));
  });

  it("produces different circulation when terrain and hydrology differ by world seed", () => {
    const first = getAtmosphereState(baseWorld);
    const second = getAtmosphereState({ ...baseWorld, seed: "different-atmosphere-world-seed" });

    expect(atmosphereSignature(first.cells)).not.toEqual(atmosphereSignature(second.cells));
  });

  it("places pressure bands by latitude", () => {
    const byLatitude = new Map(getAtmosphereStateAtTick(baseWorld, 91n * 1_440n).cells.map((cell) => [cell.midpointLatitude, cell]));

    expect(byLatitude.get(5)?.pressureZone).toBe("EQUATORIAL_LOW");
    expect(byLatitude.get(35)?.pressureZone).toBe("SUBTROPICAL_HIGH");
    expect(byLatitude.get(65)?.pressureZone).toBe("TEMPERATE_LOW");
    expect(byLatitude.get(85)?.pressureZone).toBe("POLAR_HIGH");
  });

  it("keeps prevailing winds deterministic", () => {
    const first = getAtmosphereState(baseWorld).cells.map((cell) => [cell.id, cell.windDirection, cell.windStrength]);
    const second = getAtmosphereState(baseWorld).cells.map((cell) => [cell.id, cell.windDirection, cell.windStrength]);

    expect(first).toEqual(second);
    expect(first.some(([, direction]) => direction !== "CALM")).toBe(true);
  });

  it("mountains modify orographic lift", () => {
    const grid = createGrid();
    const terrain = getTerrainState(baseWorld, grid);
    const atmosphere = getAtmosphereState(baseWorld, grid);
    const terrainById = new Map(terrain.cells.map((cell) => [cell.id, cell]));
    const mountainLift = atmosphere.cells
      .filter((cell) => mountainTerrainTypes.has(terrainById.get(cell.id)?.terrainType ?? "PLAINS"))
      .map((cell) => cell.orographicLiftPotential);

    expect(mountainLift.length).toBeGreaterThan(0);
    expect(Math.max(...mountainLift)).toBeGreaterThan(0);
  });

  it("oceans increase moisture transport potential", () => {
    const grid = createGrid();
    const terrain = getTerrainState(baseWorld, grid);
    const hydrology = getHydrologyState(baseWorld, grid);
    const atmosphere = getAtmosphereState(baseWorld, grid);
    const terrainById = new Map(terrain.cells.map((cell) => [cell.id, cell]));
    const hydrologyById = new Map(hydrology.cells.map((cell) => [cell.id, cell]));
    const oceanMoisture = atmosphere.cells
      .filter((cell) => oceanTerrainTypes.has(terrainById.get(cell.id)?.terrainType ?? "PLAINS"))
      .map((cell) => cell.moistureTransportPotential);
    const inlandMoisture = atmosphere.cells
      .filter((cell) => !oceanTerrainTypes.has(terrainById.get(cell.id)?.terrainType ?? "OCEAN"))
      .filter((cell) => (hydrologyById.get(cell.id)?.distanceToCoast ?? 0) >= 2)
      .map((cell) => cell.moistureTransportPotential);

    expect(oceanMoisture.length).toBeGreaterThan(0);
    expect(inlandMoisture.length).toBeGreaterThan(0);
    expect(average(oceanMoisture)).toBeGreaterThan(average(inlandMoisture));
  });

  it("creates rain-shadow potential behind mountain barriers without precipitation", () => {
    const atmosphere = getAtmosphereState(baseWorld);

    expect(Math.max(...atmosphere.cells.map((cell) => cell.rainShadowPotential))).toBeGreaterThan(0);
    expect(atmosphere.summary.largestRainShadowRegion).toBeGreaterThanOrEqual(1);
  });

  it("updates seasonally from astronomy", () => {
    const spring = getAtmosphereStateAtTick(baseWorld, 0n);
    const summer = getAtmosphereStateAtTick(baseWorld, 136n * 1_440n);

    expect(spring.summary.seasonalShiftDegrees).not.toBe(summer.summary.seasonalShiftDegrees);
    expect(atmosphereSignature(spring.cells)).not.toEqual(atmosphereSignature(summer.cells));
  });

  it("integrates with the scheduler pipeline", () => {
    const result = runAtmosphereSystem({
      world: baseWorld as never,
      tick: 1n,
      timeScale: 1,
      random: {} as never,
      client: {} as never,
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toMatchObject({
      deterministic: true,
      precipitation: "unmodeled",
      dominantCirculationPattern: "earthlike three-cell circulation",
    });
    expect(DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label)).toContain("Atmosphere");
  });
});
