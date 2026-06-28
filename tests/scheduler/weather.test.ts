import { describe, expect, it } from "vitest";

import { getAtmosphereState } from "../../src/lib/simulation/atmosphere-engine";
import { getClimateGrid } from "../../src/lib/simulation/climate-engine";
import { createGrid } from "../../src/lib/simulation/grid/grid";
import { getHydrologyState } from "../../src/lib/simulation/hydrology-engine";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { run as runWeatherSystem } from "../../src/lib/simulation/systems/weather";
import { getTerrainState, type TerrainGridCell } from "../../src/lib/simulation/terrain-engine";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";
import {
  getWeatherState,
  getWeatherStateAtTick,
  type WeatherGridCell,
} from "../../src/lib/simulation/weather-engine";

const baseWorld = {
  id: "weather-test-world",
  name: "Weather Test World",
  slug: "weather-test-world",
  currentTick: 0n,
  seed: "weather-foundation-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
  planet: {
    oceanCoveragePercent: 71,
  },
};

const oceanTerrainTypes = new Set(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);
const mountainTerrainTypes = new Set(["MOUNTAINS", "HIGH_MOUNTAINS", "PLATEAU"]);

function weatherSignature(cells: readonly WeatherGridCell[]): string[] {
  return cells.map((cell) => [
    cell.id,
    cell.cloudCover,
    cell.relativeHumidity,
    cell.weatherType,
    cell.precipitationPotential,
    cell.stormPotential,
    cell.snowPotential,
    cell.fogPotential,
    cell.evaporationPotential,
    cell.drynessIndex,
    cell.weatherStability,
  ].join(":"));
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function adjustedTemperature(temperatureC: number, elevation: number): number {
  return temperatureC - Math.max(0, elevation - 0.42) * 24;
}

describe("weather foundation", () => {
  it("produces deterministic weather for the same world", () => {
    const first = getWeatherState(baseWorld);
    const second = getWeatherState(baseWorld);

    expect(first.summary).toEqual(second.summary);
    expect(weatherSignature(first.cells)).toEqual(weatherSignature(second.cells));
  });

  it("keeps identical worlds identical", () => {
    const first = getWeatherState(baseWorld);
    const second = getWeatherState({ ...baseWorld, id: "same-weather-seed-world" });

    expect(weatherSignature(first.cells)).toEqual(weatherSignature(second.cells));
  });

  it("changes weather predictably by season", () => {
    const spring = getWeatherStateAtTick(baseWorld, 0n);
    const summer = getWeatherStateAtTick(baseWorld, 136n * 1_440n);
    const winter = getWeatherStateAtTick(baseWorld, 273n * 1_440n);

    const northernSummerEvaporation = average(summer.cells
      .filter((cell) => cell.midpointLatitude > 0)
      .map((cell) => cell.evaporationPotential));
    const northernWinterEvaporation = average(winter.cells
      .filter((cell) => cell.midpointLatitude > 0)
      .map((cell) => cell.evaporationPotential));
    const northernSummerSnow = average(summer.cells
      .filter((cell) => cell.midpointLatitude > 0)
      .map((cell) => cell.snowPotential));
    const northernWinterSnow = average(winter.cells
      .filter((cell) => cell.midpointLatitude > 0)
      .map((cell) => cell.snowPotential));

    expect(weatherSignature(spring.cells)).not.toEqual(weatherSignature(summer.cells));
    expect(northernSummerEvaporation).toBeGreaterThan(northernWinterEvaporation);
    expect(northernWinterSnow).toBeGreaterThanOrEqual(northernSummerSnow);
  });

  it("mountains influence precipitation potential through lift and rain shadow", () => {
    const grid = createGrid();
    const terrain = getTerrainState(baseWorld, grid);
    const atmosphere = getAtmosphereState(baseWorld, grid);
    const weather = getWeatherState(baseWorld, grid);
    const terrainById = new Map(terrain.cells.map((cell) => [cell.id, cell]));
    const atmosphereById = new Map(atmosphere.cells.map((cell) => [cell.id, cell]));
    const mountainWeather = weather.cells.filter((cell) => mountainTerrainTypes.has(terrainById.get(cell.id)?.terrainType ?? "PLAINS"));
    const liftedMountainWeather = mountainWeather.filter((cell) => (atmosphereById.get(cell.id)?.orographicLiftPotential ?? 0) > 0);
    const rainShadowWeather = weather.cells.filter((cell) => (atmosphereById.get(cell.id)?.rainShadowPotential ?? 0) >= 0.2);

    expect(mountainWeather.length).toBeGreaterThan(0);
    expect(liftedMountainWeather.length).toBeGreaterThan(0);
    expect(Math.max(...liftedMountainWeather.map((cell) => cell.precipitationPotential))).toBeGreaterThan(0);
    expect(Math.max(...rainShadowWeather.map((cell) => cell.drynessIndex))).toBeGreaterThan(0);
  });

  it("coastlines and oceans raise humidity over interiors", () => {
    const grid = createGrid();
    const terrain = getTerrainState(baseWorld, grid);
    const hydrology = getHydrologyState(baseWorld, grid);
    const weather = getWeatherState(baseWorld, grid);
    const terrainById = new Map(terrain.cells.map((cell) => [cell.id, cell]));
    const hydrologyById = new Map(hydrology.cells.map((cell) => [cell.id, cell]));
    const marineHumidity = weather.cells
      .filter((cell) => {
        const terrainCell = terrainById.get(cell.id);
        const hydrologyCell = hydrologyById.get(cell.id);
        return Boolean(terrainCell && hydrologyCell)
          && (oceanTerrainTypes.has(terrainCell?.terrainType ?? "PLAINS") || (hydrologyCell?.distanceToCoast ?? 99) <= 1);
      })
      .map((cell) => cell.relativeHumidity);
    const interiorHumidity = weather.cells
      .filter((cell) => (hydrologyById.get(cell.id)?.distanceToCoast ?? 0) >= 4)
      .map((cell) => cell.relativeHumidity);

    expect(marineHumidity.length).toBeGreaterThan(0);
    expect(interiorHumidity.length).toBeGreaterThan(0);
    expect(average(marineHumidity)).toBeGreaterThan(average(interiorHumidity));
  });

  it("limits snow to cold or elevated climates", () => {
    const grid = createGrid();
    const climate = getClimateGrid(baseWorld, grid);
    const terrain = getTerrainState(baseWorld, grid);
    const weather = getWeatherState(baseWorld, grid);
    const climateById = new Map(climate.map((cell) => [cell.id, cell]));
    const terrainById = new Map(terrain.cells.map((cell) => [cell.id, cell]));

    for (const cell of weather.cells) {
      const climateCell = climateById.get(cell.id);
      const terrainCell = terrainById.get(cell.id);

      if (!climateCell || !terrainCell) {
        continue;
      }

      if (adjustedTemperature(climateCell.averageTemperatureC, terrainCell.elevation) > 4) {
        expect(cell.snowPotential).toBe(0);
      }
    }

    expect(Math.max(...weather.cells.map((cell) => cell.snowPotential))).toBeGreaterThan(0);
  });

  it("favors fog near water and in valley-like cells", () => {
    const grid = createGrid();
    const terrain = getTerrainState(baseWorld, grid);
    const hydrology = getHydrologyState(baseWorld, grid);
    const weather = getWeatherState(baseWorld, grid);
    const terrainById = new Map(terrain.cells.map((cell) => [cell.id, cell]));
    const hydrologyById = new Map(hydrology.cells.map((cell) => [cell.id, cell]));
    const weatherById = new Map(weather.cells.map((cell) => [cell.id, cell]));
    const waterFog = weather.cells
      .filter((cell) => (hydrologyById.get(cell.id)?.distanceToCoast ?? 99) <= 1)
      .map((cell) => cell.fogPotential);
    const dryInteriorFog = weather.cells
      .filter((cell) => (hydrologyById.get(cell.id)?.distanceToCoast ?? 0) >= 4)
      .map((cell) => cell.fogPotential);
    const valleyCells = terrain.cells.filter((cell) => {
      const neighbors = grid.getNeighbors(cell.id)
        .map((neighbor) => terrainById.get(neighbor.id))
        .filter((neighbor): neighbor is TerrainGridCell => Boolean(neighbor));
      const higherNeighbors = neighbors.filter((neighbor) => neighbor.elevation > cell.elevation + 0.025).length;
      return higherNeighbors >= Math.ceil(neighbors.length / 2);
    });
    const valleyFog = valleyCells
      .map((cell) => weatherById.get(cell.id)?.fogPotential ?? 0)
      .sort((left, right) => right - left);

    expect(waterFog.length).toBeGreaterThan(0);
    expect(dryInteriorFog.length).toBeGreaterThan(0);
    expect(average(waterFog)).toBeGreaterThan(average(dryInteriorFog));
    expect(valleyFog[0] ?? 0).toBeGreaterThan(0);
  });

  it("makes storm potential follow instability and moisture", () => {
    const grid = createGrid();
    const atmosphere = getAtmosphereState(baseWorld, grid);
    const weather = getWeatherState(baseWorld, grid);
    const atmosphereById = new Map(atmosphere.cells.map((cell) => [cell.id, cell]));
    const ranked = weather.cells
      .map((cell) => {
        const atmosphereCell = atmosphereById.get(cell.id);
        const stormFuel = atmosphereCell
          ? (1 - atmosphereCell.atmosphericStability) * atmosphereCell.moistureTransportPotential
          : 0;
        return { stormFuel, stormPotential: cell.stormPotential };
      })
      .sort((left, right) => left.stormFuel - right.stormFuel);
    const sampleSize = Math.max(5, Math.floor(ranked.length * 0.15));
    const lowFuel = ranked.slice(0, sampleSize).map((entry) => entry.stormPotential);
    const highFuel = ranked.slice(-sampleSize).map((entry) => entry.stormPotential);

    expect(average(highFuel)).toBeGreaterThan(average(lowFuel));
  });

  it("integrates with the scheduler weather system", () => {
    const spring = runWeatherSystem({
      world: baseWorld as never,
      tick: 1n,
      timeScale: 1,
      random: {} as never,
      client: {} as never,
    });
    const summer = runWeatherSystem({
      world: baseWorld as never,
      tick: 136n * 1_440n,
      timeScale: 1,
      random: {} as never,
      client: {} as never,
    });

    expect(spring.success).toBe(true);
    expect(spring.metadata).toMatchObject({
      deterministic: true,
      dynamicWeather: "unmodeled",
      movingStorms: "unmodeled",
      rainfall: "unmodeled",
    });
    expect(spring.metadata?.seasonalWeatherState).not.toBe(summer.metadata?.seasonalWeatherState);
    expect(DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label)).toContain("Weather");
  });

  it("does not mutate previous environmental systems", () => {
    const grid = createGrid();
    const terrainBefore = getTerrainState(baseWorld, grid).summary;
    const hydrologyBefore = getHydrologyState(baseWorld, grid).summary;
    const atmosphereBefore = getAtmosphereState(baseWorld, grid).summary;

    getWeatherState(baseWorld, grid);

    expect(getTerrainState(baseWorld, grid).summary).toEqual(terrainBefore);
    expect(getHydrologyState(baseWorld, grid).summary).toEqual(hydrologyBefore);
    expect(getAtmosphereState(baseWorld, grid).summary).toEqual(atmosphereBefore);
  });
});