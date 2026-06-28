import { describe, expect, it } from "vitest";

import { createGrid } from "../../src/lib/simulation/grid/grid";
import { getHydrologyState } from "../../src/lib/simulation/hydrology-engine";
import {
  getPlanetResourcesState,
  type PlanetResourceGridCell,
} from "../../src/lib/simulation/resources-engine";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { run as runResourcesSystem } from "../../src/lib/simulation/systems/resources";
import { getTerrainState } from "../../src/lib/simulation/terrain-engine";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const baseWorld = {
  id: "resources-test-world",
  name: "Resources Test World",
  slug: "resources-test-world",
  currentTick: 0n,
  seed: "planet-resources-foundation-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
  planet: {
    oceanCoveragePercent: 71,
  },
};

const mountainTerrainTypes = new Set(["MOUNTAINS", "HIGH_MOUNTAINS", "PLATEAU"]);

function resourceSignature(cells: readonly PlanetResourceGridCell[]): string[] {
  return cells.map((cell) => [
    cell.id,
    cell.bedrockType,
    cell.sedimentDepth,
    cell.volcanicInfluence,
    cell.erosionPotential,
    cell.metals.iron,
    cell.metals.copper,
    cell.metals.gold,
    cell.industrialMaterials.coal,
    cell.industrialMaterials.clay,
    cell.rareMaterials.rareEarthElements,
    cell.waterResources.groundwaterPotential,
    cell.buildingResources.stone,
    cell.resourceRichness,
  ].join(":"));
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function allPotentials(cell: PlanetResourceGridCell): number[] {
  return [
    ...Object.values(cell.metals),
    ...Object.values(cell.industrialMaterials),
    ...Object.values(cell.rareMaterials),
    cell.waterResources.groundwaterPotential,
    cell.waterResources.freshwaterAvailability,
    cell.waterResources.springProbability,
    cell.buildingResources.timberPotential,
    cell.buildingResources.stone,
    cell.buildingResources.gravel,
    cell.buildingResources.clay,
    cell.sedimentDepth,
    cell.volcanicInfluence,
    cell.erosionPotential,
    cell.resourceRichness,
    cell.metalRichness,
    cell.industrialRichness,
    cell.rareMaterialRichness,
    cell.waterRichness,
    cell.buildingMaterialAvailability,
    cell.resourceDiversity,
  ];
}

describe("planet resources foundation", () => {
  it("produces deterministic resources for the same world", () => {
    const first = getPlanetResourcesState(baseWorld);
    const second = getPlanetResourcesState(baseWorld);

    expect(first.summary).toEqual(second.summary);
    expect(resourceSignature(first.cells)).toEqual(resourceSignature(second.cells));
  });

  it("keeps canonical-equivalent worlds identical", () => {
    const first = getPlanetResourcesState(baseWorld);
    const second = getPlanetResourcesState({ ...baseWorld, id: "same-resource-seed-world" });

    expect(resourceSignature(first.cells)).toEqual(resourceSignature(second.cells));
    expect(first.summary.averageMineralRichness).toBe(second.summary.averageMineralRichness);
  });

  it("keeps richness values between zero and one", () => {
    const resources = getPlanetResourcesState(baseWorld);

    for (const cell of resources.cells) {
      for (const value of allPotentials(cell)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }

      expect(cell.waterResources.aquiferDepthMeters).toBeGreaterThan(0);
    }
  });

  it("makes mountain cells richer in metals than low-relief cells", () => {
    const grid = createGrid();
    const terrain = getTerrainState(baseWorld, grid);
    const resources = getPlanetResourcesState(baseWorld, grid);
    const resourceById = new Map(resources.cells.map((cell) => [cell.id, cell]));
    const mountainMetals = terrain.cells
      .filter((cell) => mountainTerrainTypes.has(cell.terrainType))
      .map((cell) => resourceById.get(cell.id)?.metalRichness ?? 0);
    const lowReliefMetals = terrain.cells
      .filter((cell) => cell.terrainType === "PLAINS" && cell.ruggedness < 0.35 && cell.tectonicActivity < 0.55)
      .map((cell) => resourceById.get(cell.id)?.metalRichness ?? 0);

    expect(mountainMetals.length).toBeGreaterThan(0);
    expect(lowReliefMetals.length).toBeGreaterThan(0);
    expect(average(mountainMetals)).toBeGreaterThan(average(lowReliefMetals));
  });

  it("makes river valleys richer in clay than dry non-river land", () => {
    const grid = createGrid();
    const hydrology = getHydrologyState(baseWorld, grid);
    const resources = getPlanetResourcesState(baseWorld, grid);
    const resourceById = new Map(resources.cells.map((cell) => [cell.id, cell]));
    const riverClay = hydrology.cells
      .filter((cell) => cell.isRiverCandidate)
      .map((cell) => resourceById.get(cell.id)?.industrialMaterials.clay ?? 0);
    const dryLandClay = hydrology.cells
      .filter((cell) => !cell.isOcean && !cell.isSea && !cell.isRiverCandidate)
      .map((cell) => resourceById.get(cell.id)?.industrialMaterials.clay ?? 0);

    expect(riverClay.length).toBeGreaterThan(0);
    expect(dryLandClay.length).toBeGreaterThan(0);
    expect(average(riverClay)).toBeGreaterThan(average(dryLandClay));
  });

  it("correlates groundwater with hydrology moisture", () => {
    const grid = createGrid();
    const hydrology = getHydrologyState(baseWorld, grid);
    const resources = getPlanetResourcesState(baseWorld, grid);
    const resourceById = new Map(resources.cells.map((cell) => [cell.id, cell]));
    const ranked = hydrology.cells
      .filter((cell) => !cell.isOcean && !cell.isSea)
      .map((cell) => ({
        moisture: cell.moisturePotential,
        groundwater: resourceById.get(cell.id)?.waterResources.groundwaterPotential ?? 0,
      }))
      .sort((left, right) => left.moisture - right.moisture);
    const sampleSize = Math.max(8, Math.floor(ranked.length * 0.2));
    const dryGroundwater = average(ranked.slice(0, sampleSize).map((entry) => entry.groundwater));
    const wetGroundwater = average(ranked.slice(-sampleSize).map((entry) => entry.groundwater));

    expect(ranked.length).toBeGreaterThan(sampleSize);
    expect(wetGroundwater).toBeGreaterThan(dryGroundwater);
  });

  it("uses the same seed for identical output every time", () => {
    const worlds = Array.from({ length: 3 }, (_, index) => ({
      ...baseWorld,
      id: `resources-repeat-${index}`,
      slug: `resources-repeat-${index}`,
    }));

    const signatures = worlds.map((world) => resourceSignature(getPlanetResourcesState(world).cells));

    expect(signatures[1]).toEqual(signatures[0]);
    expect(signatures[2]).toEqual(signatures[0]);
  });

  it("wires resource metadata through the scheduler", () => {
    const result = runResourcesSystem({
      world: baseWorld as never,
      tick: 1n,
      timeScale: 1,
      random: {} as never,
      client: {} as never,
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toMatchObject({
      deterministic: true,
      extraction: "unmodeled",
      mining: "unmodeled",
      economy: "unmodeled",
    });
    expect(DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label)).toContain("Planet Resources");
  });
});

