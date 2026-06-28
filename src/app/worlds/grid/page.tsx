import { getAtmosphereState, type AtmosphericGridCell, type AtmosphericSummary } from "../../../lib/simulation/atmosphere-engine";
import Link from "next/link";

import {
  getClimateGrid,
  getClimateState,
  type ClimateGridCell,
} from "../../../lib/simulation/climate-engine";
import { createGrid } from "../../../lib/simulation/grid/grid";
import { getPlanetState } from "../../../lib/simulation/planet-engine";
import { getHydrologyState, type HydrologyGridCell, type HydrologySummary } from "../../../lib/simulation/hydrology-engine";
import { getWeatherState, type WeatherGridCell, type WeatherSummary } from "../../../lib/simulation/weather-engine";
import {
  getTerrainState,
  type TerrainGridCell,
  type TerrainSummary,
} from "../../../lib/simulation/terrain-engine";
import { listWorlds } from "../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

type TerrainClimateHydrologyGridCell = ClimateGridCell & Pick<
  TerrainGridCell,
  | "elevation"
  | "terrainType"
  | "continentalness"
  | "ruggedness"
  | "tectonicActivity"
  | "isCoast"
> & Pick<
  HydrologyGridCell,
  | "waterBodyType"
  | "drainageDirection"
  | "basinId"
  | "watershedId"
  | "flowAccumulation"
  | "moisturePotential"
  | "distanceToOcean"
  | "distanceToCoast"
  | "isLakeCandidate"
  | "isRiverCandidate"
> & Pick<
  AtmosphericGridCell,
  | "pressureZone"
  | "pressureValue"
  | "windDirection"
  | "windStrength"
  | "temperatureGradient"
  | "moistureTransportPotential"
  | "orographicLiftPotential"
  | "rainShadowPotential"
  | "atmosphericStability"
  | "seasonalShift"
> & Pick<
  WeatherGridCell,
  | "cloudCover"
  | "relativeHumidity"
  | "weatherType"
  | "precipitationPotential"
  | "stormPotential"
  | "snowPotential"
  | "fogPotential"
  | "evaporationPotential"
  | "drynessIndex"
  | "weatherStability"
>;
function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value, 2)} %`;
}

function formatAtmosphere(atmosphere: Record<string, number | string>): string {
  return Object.entries(atmosphere)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}: ${value}`)
    .join(", ");
}

function formatSeasonLabel(season: string): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

function formatTerrainType(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatPressureZone(value: string): string {
  return formatTerrainType(value);
}

function formatPressureBandDistribution(summary: AtmosphericSummary): string {
  return Object.entries(summary.pressureBandDistribution)
    .filter(([, count]) => count > 0)
    .map(([zone, count]) => `${formatPressureZone(zone)}: ${count}`)
    .join(" / ");
}

function formatTemperature(value: number): string {
  return `${formatNumber(value, 1)} C`;
}

function formatDaylightHours(value: number): string {
  return `${formatNumber(value, 1)} h`;
}

function formatLatitude(latitude: number): string {
  if (latitude === 0) {
    return "0 deg";
  }

  return `${formatNumber(Math.abs(latitude), 0)} deg${latitude > 0 ? "N" : "S"}`;
}

function formatHemisphere(hemisphere: ClimateGridCell["hemisphere"]["latitude"]): string {
  return hemisphere.charAt(0).toUpperCase() + hemisphere.slice(1);
}

function formatElevation(value: number): string {
  return value.toFixed(3);
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatTerrainDistribution(summary: TerrainSummary): string {
  return Object.entries(summary.terrainDistribution)
    .filter(([, count]) => count > 0)
    .map(([terrainType, count]) => `${formatTerrainType(terrainType)}: ${count}`)
    .join(" / ");
}

function combineTerrainClimateHydrologyAndAtmosphere(
  climateCells: ClimateGridCell[],
  terrainCells: readonly TerrainGridCell[],
  hydrologyCells: readonly HydrologyGridCell[],
  atmosphereCells: readonly AtmosphericGridCell[],
  weatherCells: readonly WeatherGridCell[],
): TerrainClimateHydrologyGridCell[] {
  const terrainById = new Map(terrainCells.map((cell) => [cell.id, cell]));
  const hydrologyById = new Map(hydrologyCells.map((cell) => [cell.id, cell]));
  const atmosphereById = new Map(atmosphereCells.map((cell) => [cell.id, cell]));
  const weatherById = new Map(weatherCells.map((cell) => [cell.id, cell]));

  return climateCells.flatMap((cell) => {
    const terrainCell = terrainById.get(cell.id);
    const hydrologyCell = hydrologyById.get(cell.id);
    const atmosphereCell = atmosphereById.get(cell.id);
    const weatherCell = weatherById.get(cell.id);

    if (!terrainCell || !hydrologyCell || !atmosphereCell || !weatherCell) {
      return [];
    }

    return [{
      ...cell,
      elevation: terrainCell.elevation,
      terrainType: terrainCell.terrainType,
      continentalness: terrainCell.continentalness,
      ruggedness: terrainCell.ruggedness,
      tectonicActivity: terrainCell.tectonicActivity,
      isCoast: terrainCell.isCoast,
      waterBodyType: hydrologyCell.waterBodyType,
      drainageDirection: hydrologyCell.drainageDirection,
      basinId: hydrologyCell.basinId,
      watershedId: hydrologyCell.watershedId,
      flowAccumulation: hydrologyCell.flowAccumulation,
      moisturePotential: hydrologyCell.moisturePotential,
      distanceToOcean: hydrologyCell.distanceToOcean,
      distanceToCoast: hydrologyCell.distanceToCoast,
      isLakeCandidate: hydrologyCell.isLakeCandidate,
      isRiverCandidate: hydrologyCell.isRiverCandidate,
      pressureZone: atmosphereCell.pressureZone,
      pressureValue: atmosphereCell.pressureValue,
      windDirection: atmosphereCell.windDirection,
      windStrength: atmosphereCell.windStrength,
      temperatureGradient: atmosphereCell.temperatureGradient,
      moistureTransportPotential: atmosphereCell.moistureTransportPotential,
      orographicLiftPotential: atmosphereCell.orographicLiftPotential,
      rainShadowPotential: atmosphereCell.rainShadowPotential,
      atmosphericStability: atmosphereCell.atmosphericStability,
      seasonalShift: atmosphereCell.seasonalShift,
      cloudCover: weatherCell.cloudCover,
      relativeHumidity: weatherCell.relativeHumidity,
      weatherType: weatherCell.weatherType,
      precipitationPotential: weatherCell.precipitationPotential,
      stormPotential: weatherCell.stormPotential,
      snowPotential: weatherCell.snowPotential,
      fogPotential: weatherCell.fogPotential,
      evaporationPotential: weatherCell.evaporationPotential,
      drynessIndex: weatherCell.drynessIndex,
      weatherStability: weatherCell.weatherStability,
    }];
  });
}
function buildSampleCells(cells: TerrainClimateHydrologyGridCell[]): TerrainClimateHydrologyGridCell[] {
  const preferredLatitudes = [-85, -55, -25, 5, 35, 65, 85];

  return preferredLatitudes
    .map((latitude) => cells.find((cell) => cell.midpointLatitude === latitude))
    .filter((cell): cell is TerrainClimateHydrologyGridCell => Boolean(cell));
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm text-stone-100">{value}</p>
    </div>
  );
}

function TerrainSummaryCards({ summary }: { summary: TerrainSummary | null }) {
  if (!summary) {
    return <DetailCard label="Terrain" value="Seed required" />;
  }

  return (
    <>
      <DetailCard label="Land" value={formatPercent(summary.landPercent)} />
      <DetailCard label="Ocean" value={formatPercent(summary.oceanPercent)} />
      <DetailCard label="Mountain" value={formatPercent(summary.mountainPercent)} />
      <DetailCard label="Coastline Cells" value={String(summary.coastlineCells)} />
      <DetailCard label="Highest Elevation" value={formatElevation(summary.highestElevation)} />
      <DetailCard label="Lowest Elevation" value={formatElevation(summary.lowestElevation)} />
      <DetailCard label="Largest Continent" value={`${summary.largestContinentEstimate} cells`} />
      <DetailCard label="Largest Ocean" value={`${summary.largestOceanEstimate} cells`} />
    </>
  );
}

function AtmosphericSummaryCards({ summary }: { summary: AtmosphericSummary | null }) {
  if (!summary) {
    return <DetailCard label="Atmosphere" value="Seed required" />;
  }

  const strongest = summary.strongestWinds[0];

  return (
    <>
      <DetailCard label="Avg Wind" value={summary.averageWindSpeed.toFixed(3)} />
      <DetailCard label="Avg Moisture Transport" value={summary.averageMoistureTransport.toFixed(3)} />
      <DetailCard label="Strongest Wind" value={strongest ? `${strongest.windDirection} ${strongest.windStrength.toFixed(3)}` : "-"} />
      <DetailCard label="Largest Rain Shadow" value={`${summary.largestRainShadowRegion} cells`} />
      <DetailCard label="Avg Stability" value={summary.averageAtmosphericStability.toFixed(3)} />
      <DetailCard label="Circulation" value={summary.dominantCirculationPattern} />
      <DetailCard label="Seasonal Phase" value={summary.seasonalCirculationPhase} />
      <DetailCard label="Seasonal Shift" value={`${summary.seasonalShiftDegrees.toFixed(2)} deg`} />
    </>
  );
}

function HydrologySummaryCards({ summary }: { summary: HydrologySummary | null }) {
  if (!summary) {
    return <DetailCard label="Hydrology" value="Seed required" />;
  }

  return (
    <>
      <DetailCard label="Ocean Cells" value={String(summary.oceanCells)} />
      <DetailCard label="Land Cells" value={String(summary.landCells)} />
      <DetailCard label="Coastal Water" value={String(summary.coastalWaterCells)} />
      <DetailCard label="Inland Basins" value={String(summary.inlandBasinCount)} />
      <DetailCard label="Lake Candidates" value={String(summary.lakeCandidateCount)} />
      <DetailCard label="River Sources" value={String(summary.riverSourceCandidateCount)} />
      <DetailCard label="River Channels" value={String(summary.riverChannelCandidateCount)} />
      <DetailCard label="Avg Moisture" value={summary.averageMoisturePotential.toFixed(3)} />
      <DetailCard label="Largest Watershed" value={`${summary.largestWatershedEstimate} cells`} />
      <DetailCard label="Largest Basin" value={`${summary.largestBasinEstimate} cells`} />
    </>
  );
}
function WeatherSummaryCards({ summary }: { summary: WeatherSummary | null }) {
  if (!summary) {
    return <DetailCard label="Weather" value="Seed required" />;
  }

  return (
    <>
      <DetailCard label="Avg Humidity" value={summary.averageHumidity.toFixed(3)} />
      <DetailCard label="Avg Cloud" value={summary.averageCloudCover.toFixed(3)} />
      <DetailCard label="Avg Precip" value={summary.averagePrecipitationPotential.toFixed(3)} />
      <DetailCard label="Avg Storm" value={summary.averageStormPotential.toFixed(3)} />
      <DetailCard label="Avg Fog" value={summary.averageFogPotential.toFixed(3)} />
      <DetailCard label="Avg Snow" value={summary.averageSnowPotential.toFixed(3)} />
      <DetailCard label="Avg Evaporation" value={summary.averageEvaporation.toFixed(3)} />
      <DetailCard label="Avg Dryness" value={summary.averageDryness.toFixed(3)} />
      <DetailCard label="Dominant Weather" value={formatTerrainType(summary.dominantWeatherType)} />
      <DetailCard label="Seasonal Weather" value={summary.seasonalWeatherState} />
    </>
  );
}
export default async function WorldsGridPage() {
  const worlds = await listWorlds();
  const activeWorld =
    worlds.find((world) => world.environment === "SANDBOX" && world.status === "ACTIVE") ??
    worlds.find((world) => world.status === "ACTIVE") ??
    worlds[0] ??
    null;

  const grid = createGrid();
  const gridSummary = grid.getGridSummary();
  const planetState = activeWorld ? getPlanetState(activeWorld) : null;
  const climateState = activeWorld ? getClimateState(activeWorld) : null;
  const climateCells = activeWorld ? getClimateGrid(activeWorld, grid) : [];
  const terrainState = activeWorld?.seed?.trim() ? getTerrainState(activeWorld, grid) : null;
  const hydrologyState = activeWorld?.seed?.trim() ? getHydrologyState(activeWorld, grid) : null;
  const atmosphereState = activeWorld?.seed?.trim() ? getAtmosphereState(activeWorld, grid) : null;
  const weatherState = activeWorld?.seed?.trim() ? getWeatherState(activeWorld, grid) : null;
  const combinedCells = terrainState && hydrologyState && atmosphereState && weatherState
    ? combineTerrainClimateHydrologyAndAtmosphere(climateCells, terrainState.cells, hydrologyState.cells, atmosphereState.cells, weatherState.cells)
    : [];
  const combinedById = new Map(combinedCells.map((cell) => [cell.id, cell]));
  const sampleCells = buildSampleCells(combinedCells);
  const neighborAnchorBase = activeWorld ? grid.getCellAt(5, 5) : null;
  const neighborAnchor = neighborAnchorBase ? combinedById.get(neighborAnchorBase.id) ?? null : combinedCells[0] ?? null;
  const neighborCells = neighborAnchor
    ? grid.getNeighbors(neighborAnchor.id)
        .map((cell) => combinedById.get(cell.id))
        .filter((cell): cell is TerrainClimateHydrologyGridCell => Boolean(cell))
    : [];

  return (
    <main className="min-h-screen bg-dawn-coal px-6 py-10 text-stone-100 sm:px-10 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-dawn-gold">
              Developer Grid Debug
            </p>
            <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">World Spatial Grid</h1>
          </div>
          <Link
            className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-100 transition hover:border-dawn-gold/40 hover:bg-white/10"
            href="/worlds"
          >
            Back to Worlds
          </Link>
        </header>

        {!activeWorld || !planetState ? (
          <section className="mt-8 rounded border border-white/10 bg-black/20 p-6 text-sm text-stone-300">
            No worlds are available to inspect.
          </section>
        ) : (
          <>
            <section className="mt-8 rounded border border-white/10 bg-black/20 p-6">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Active World</p>
                  <h2 className="mt-1 font-display text-2xl text-white">{activeWorld.name}</h2>
                </div>
                <p className="text-sm text-stone-400">
                  Static terrain, passive climate, hydrology, atmosphere, and weather debug view. Flowing rivers, erosion, and life are still unmodeled.
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailCard label="Planet Name" value={planetState.name} />
                <DetailCard label="Radius" value={`${formatNumber(planetState.radiusKm, 0)} km`} />
                <DetailCard label="Gravity" value={`${formatNumber(planetState.gravityMS2)} m/s2`} />
                <DetailCard label="Atmosphere" value={`${formatNumber(planetState.atmospherePressureKPa)} kPa`} />
                <DetailCard label="Grid Resolution" value={`${gridSummary.latitudeDivisions} x ${gridSummary.longitudeDivisions}`} />
                <DetailCard label="Total Cells" value={String(gridSummary.totalCells)} />
                <DetailCard label="Latitude Bands" value={String(gridSummary.latitudeBands.length)} />
                <DetailCard label="Configured Ocean" value={`${formatNumber(planetState.oceanCoveragePercent)} %`} />
                <TerrainSummaryCards summary={terrainState?.summary ?? null} />
                <HydrologySummaryCards summary={hydrologyState?.summary ?? null} />
                <AtmosphericSummaryCards summary={atmosphereState?.summary ?? null} />
                <WeatherSummaryCards summary={weatherState?.summary ?? null} />
                <DetailCard label="Northern Season" value={formatSeasonLabel(climateState?.seasonNorthernHemisphere ?? "spring")} />
                <DetailCard label="Southern Season" value={formatSeasonLabel(climateState?.seasonSouthernHemisphere ?? "autumn")} />
                <DetailCard label="Average Solar Energy" value={climateState ? climateState.summary.averageSolarEnergy.toFixed(2) : "-"} />
                <DetailCard label="Average Daylight" value={climateState ? formatDaylightHours(climateState.summary.averageDaylightHours) : "-"} />
              </div>

              {terrainState ? (
                <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Terrain Distribution</p>
                  <p className="mt-1 text-sm text-stone-100">{formatTerrainDistribution(terrainState.summary)}</p>
                </div>
              ) : null}

              <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Atmospheric Composition</p>
                <p className="mt-1 text-sm text-stone-100">
                  {formatAtmosphere(planetState.atmosphereComposition)}
                </p>
              </div>
            </section>

            <section className="mt-8 rounded border border-white/10 bg-black/20 p-6">
              <div className="border-b border-white/10 pb-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Latitude Bands</p>
                <h2 className="mt-1 font-display text-2xl text-white">Band Index</h2>
              </div>

              <div className="mt-4 overflow-hidden border border-white/10 bg-black/20">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-stone-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Band</th>
                      <th className="px-4 py-3 font-semibold">Range</th>
                      <th className="px-4 py-3 font-semibold">Midpoint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridSummary.latitudeBands.map((band) => (
                      <tr className="border-t border-white/10" key={band.id}>
                        <td className="px-4 py-3 text-stone-100">{band.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-stone-300">
                          {band.from} to {band.to}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-stone-300">{band.midpoint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 rounded border border-white/10 bg-black/20 p-6">
              <div className="border-b border-white/10 pb-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Sample Cells</p>
                <h2 className="mt-1 font-display text-2xl text-white">Terrain, Climate, Hydrology, Atmosphere, and Weather</h2>
              </div>

              {sampleCells.length === 0 ? (
                <p className="mt-4 text-sm text-stone-300">Terrain requires a seeded world before cells can be inspected.</p>
              ) : (
                <div className="mt-4 overflow-x-auto border border-white/10 bg-black/20">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-stone-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Cell ID</th>
                        <th className="px-4 py-3 font-semibold">Latitude</th>
                        <th className="px-4 py-3 font-semibold">Terrain</th>
                        <th className="px-4 py-3 font-semibold">Elevation</th>
                        <th className="px-4 py-3 font-semibold">Continentalness</th>
                        <th className="px-4 py-3 font-semibold">Ruggedness</th>
                        <th className="px-4 py-3 font-semibold">Tectonic</th>
                        <th className="px-4 py-3 font-semibold">Coast</th>
                        <th className="px-4 py-3 font-semibold">Climate Band</th>
                        <th className="px-4 py-3 font-semibold">Avg Temp</th>
                        <th className="px-4 py-3 font-semibold">Solar</th>
                        <th className="px-4 py-3 font-semibold">Daylight</th>
                        <th className="px-4 py-3 font-semibold">Water Type</th>
                        <th className="px-4 py-3 font-semibold">Drainage</th>
                        <th className="px-4 py-3 font-semibold">Basin</th>
                        <th className="px-4 py-3 font-semibold">Watershed</th>
                        <th className="px-4 py-3 font-semibold">Flow</th>
                        <th className="px-4 py-3 font-semibold">Moisture</th>
                        <th className="px-4 py-3 font-semibold">Ocean Dist</th>
                        <th className="px-4 py-3 font-semibold">Coast Dist</th>
                        <th className="px-4 py-3 font-semibold">Pressure Zone</th>
                        <th className="px-4 py-3 font-semibold">Pressure</th>
                        <th className="px-4 py-3 font-semibold">Wind Dir</th>
                        <th className="px-4 py-3 font-semibold">Wind</th>
                        <th className="px-4 py-3 font-semibold">Temp Gradient</th>
                        <th className="px-4 py-3 font-semibold">Moisture Transport</th>
                        <th className="px-4 py-3 font-semibold">Oro Lift</th>
                        <th className="px-4 py-3 font-semibold">Rain Shadow</th>
                        <th className="px-4 py-3 font-semibold">Stability</th>
                        <th className="px-4 py-3 font-semibold">Seasonal Shift</th>
                        <th className="px-4 py-3 font-semibold">Cloud Cover</th>
                        <th className="px-4 py-3 font-semibold">Humidity</th>
                        <th className="px-4 py-3 font-semibold">Weather Type</th>
                        <th className="px-4 py-3 font-semibold">Precip Potential</th>
                        <th className="px-4 py-3 font-semibold">Storm Potential</th>
                        <th className="px-4 py-3 font-semibold">Snow Potential</th>
                        <th className="px-4 py-3 font-semibold">Fog Potential</th>
                        <th className="px-4 py-3 font-semibold">Evaporation</th>
                        <th className="px-4 py-3 font-semibold">Dryness Index</th>
                        <th className="px-4 py-3 font-semibold">Weather Stability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleCells.map((cell) => (
                        <tr className="border-t border-white/10" key={cell.id}>
                          <td className="px-4 py-3 font-mono text-xs text-stone-100">{cell.id}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatLatitude(cell.latitude)}</td>
                          <td className="px-4 py-3 text-stone-200">{formatTerrainType(cell.terrainType)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatElevation(cell.elevation)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatElevation(cell.continentalness)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatElevation(cell.ruggedness)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatElevation(cell.tectonicActivity)}</td>
                          <td className="px-4 py-3 text-stone-200">{formatBoolean(cell.isCoast)}</td>
                          <td className="px-4 py-3 text-stone-200">{cell.climateBand}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatTemperature(cell.averageTemperature)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.solarEnergy.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatDaylightHours(cell.daylightHours)}</td>
                          <td className="px-4 py-3 text-stone-200">{formatTerrainType(cell.waterBodyType)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.drainageDirection}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.basinId ?? "-"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.watershedId}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.flowAccumulation}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.moisturePotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.distanceToOcean}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.distanceToCoast}</td>
                          <td className="px-4 py-3 text-stone-200">{formatPressureZone(cell.pressureZone)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.pressureValue.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.windDirection}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.windStrength.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.temperatureGradient.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.moistureTransportPotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.orographicLiftPotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.rainShadowPotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.atmosphericStability.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.seasonalShift.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.cloudCover.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.relativeHumidity.toFixed(3)}</td>
                          <td className="px-4 py-3 text-stone-200">{formatTerrainType(cell.weatherType)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.precipitationPotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.stormPotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.snowPotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.fogPotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.evaporationPotential.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.drynessIndex.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.weatherStability.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-8 rounded border border-white/10 bg-black/20 p-6">
              <div className="border-b border-white/10 pb-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Neighbor Example</p>
                <h2 className="mt-1 font-display text-2xl text-white">Adjacency Check</h2>
              </div>

              {!neighborAnchor ? (
                <p className="mt-4 text-sm text-stone-300">No sample cell was available.</p>
              ) : (
                <div className="mt-4 grid gap-4 xl:grid-cols-[320px_1fr]">
                  <div className="rounded border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Anchor Cell</p>
                    <p className="mt-2 font-mono text-xs text-stone-100">{neighborAnchor.id}</p>
                    <p className="mt-2 text-sm text-stone-300">
                      Midpoint {neighborAnchor.midpointLatitude}, {neighborAnchor.midpointLongitude}
                    </p>
                    <p className="mt-1 text-sm text-stone-300">{formatHemisphere(neighborAnchor.hemisphere.latitude)}</p>
                    <p className="mt-1 text-sm text-stone-300">
                      {formatTerrainType(neighborAnchor.terrainType)} / elevation {formatElevation(neighborAnchor.elevation)}
                    </p>
                    <p className="mt-1 text-sm text-stone-300">
                      {neighborAnchor.climateBand} / {formatTemperature(neighborAnchor.averageTemperature)}
                    </p>
                  </div>

                  <div className="overflow-x-auto border border-white/10 bg-black/20">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-stone-400">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Neighbor ID</th>
                          <th className="px-4 py-3 font-semibold">Midpoint</th>
                          <th className="px-4 py-3 font-semibold">Terrain</th>
                          <th className="px-4 py-3 font-semibold">Elevation</th>
                          <th className="px-4 py-3 font-semibold">Coast</th>
                          <th className="px-4 py-3 font-semibold">Climate Band</th>
                        </tr>
                      </thead>
                      <tbody>
                        {neighborCells.map((cell) => (
                          <tr className="border-t border-white/10" key={cell.id}>
                            <td className="px-4 py-3 font-mono text-xs text-stone-100">{cell.id}</td>
                            <td className="px-4 py-3 font-mono text-xs text-stone-300">
                              {cell.midpointLatitude}, {cell.midpointLongitude}
                            </td>
                            <td className="px-4 py-3 text-stone-200">{formatTerrainType(cell.terrainType)}</td>
                            <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatElevation(cell.elevation)}</td>
                            <td className="px-4 py-3 text-stone-200">{formatBoolean(cell.isCoast)}</td>
                            <td className="px-4 py-3 text-stone-200">{cell.climateBand}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
