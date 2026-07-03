import Link from "next/link";

import { getLatestPersistedAtlasSnapshot } from "../../../lib/simulation/snapshot-store";
import type { AtlasCell, AtlasSnapshot } from "../../../lib/worlds/map-atlas";
import { listWorlds } from "../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

type TerrainSummary = AtlasSnapshot["terrainSummary"];
type AtmosphericSummary = AtlasSnapshot["atmosphereSummary"];
type HydrologySummary = AtlasSnapshot["hydrologySummary"];
type WeatherSummary = AtlasSnapshot["weatherSummary"];

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

function formatHemisphere(hemisphere: AtlasCell["hemisphere"]["latitude"]): string {
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
    return <DetailCard label="Terrain" value="Snapshot unavailable" />;
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
    return <DetailCard label="Atmosphere" value="Snapshot unavailable" />;
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
    return <DetailCard label="Hydrology" value="Snapshot unavailable" />;
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
    return <DetailCard label="Weather" value="Snapshot unavailable" />;
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

function buildSampleCells(cells: readonly AtlasCell[]): AtlasCell[] {
  const preferredLatitudes = [-85, -55, -25, 5, 35, 65, 85];

  return preferredLatitudes
    .map((latitude) => cells.find((cell) => cell.midpointLatitude === latitude))
    .filter((cell): cell is AtlasCell => Boolean(cell));
}

function UnavailableGridSnapshot() {
  return (
    <section className="mt-8 rounded border border-white/10 bg-black/20 p-6 text-sm text-stone-300">
      No persisted grid snapshot is available yet. Start the simulation worker or run npm run sim:step.
    </section>
  );
}

export default async function WorldsGridPage() {
  const worlds = await listWorlds();
  const activeWorld =
    worlds.find((world) => world.environment === "SANDBOX" && world.status === "ACTIVE") ??
    worlds.find((world) => world.status === "ACTIVE") ??
    worlds[0] ??
    null;
  const persistedSnapshot = activeWorld ? await getLatestPersistedAtlasSnapshot(activeWorld.id) : null;
  const snapshot = persistedSnapshot?.snapshot ?? null;
  const gridSummary = snapshot?.grid ?? null;
  const planetState = snapshot?.planet ?? null;
  const climateState = snapshot?.climate ?? null;
  const cells = snapshot?.cells ?? [];
  const combinedById = new Map(cells.map((cell) => [cell.id, cell]));
  const sampleCells = buildSampleCells(cells);
  const neighborAnchor = cells.find((cell) => cell.row === 5 && cell.column === 5) ?? cells[0] ?? null;
  const neighborCells = neighborAnchor
    ? neighborAnchor.neighbors
        .map((cellId) => combinedById.get(cellId))
        .filter((cell): cell is AtlasCell => Boolean(cell))
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

        {!activeWorld || !planetState || !gridSummary || !snapshot ? (
          <UnavailableGridSnapshot />
        ) : (
          <>
            <section className="mt-8 rounded border border-white/10 bg-black/20 p-6">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Active World</p>
                  <h2 className="mt-1 font-display text-2xl text-white">{snapshot.worldName}</h2>
                </div>
                <p className="text-sm text-stone-400">
                  Read-only terrain, climate, hydrology, atmosphere, and weather debug view from the latest persisted worker snapshot.
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
                <TerrainSummaryCards summary={snapshot.terrainSummary} />
                <HydrologySummaryCards summary={snapshot.hydrologySummary} />
                <AtmosphericSummaryCards summary={snapshot.atmosphereSummary} />
                <WeatherSummaryCards summary={snapshot.weatherSummary} />
                <DetailCard label="Northern Season" value={formatSeasonLabel(climateState?.seasonNorthernHemisphere ?? "unavailable")} />
                <DetailCard label="Southern Season" value={formatSeasonLabel(climateState?.seasonSouthernHemisphere ?? "unavailable")} />
                <DetailCard label="Average Solar Energy" value={climateState ? climateState.summary.averageSolarEnergy.toFixed(2) : "-"} />
                <DetailCard label="Average Daylight" value={climateState ? formatDaylightHours(climateState.summary.averageDaylightHours) : "-"} />
              </div>

              <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Terrain Distribution</p>
                <p className="mt-1 text-sm text-stone-100">{formatTerrainDistribution(snapshot.terrainSummary)}</p>
              </div>

              <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Atmospheric Composition</p>
                <p className="mt-1 text-sm text-stone-100">
                  {formatAtmosphere(planetState.atmosphereComposition as Record<string, number | string>)}
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
                <p className="mt-4 text-sm text-stone-300">No persisted sample cells are available.</p>
              ) : (
                <div className="mt-4 overflow-x-auto border border-white/10 bg-black/20">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-stone-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Cell ID</th>
                        <th className="px-4 py-3 font-semibold">Latitude</th>
                        <th className="px-4 py-3 font-semibold">Terrain</th>
                        <th className="px-4 py-3 font-semibold">Elevation</th>
                        <th className="px-4 py-3 font-semibold">Climate Band</th>
                        <th className="px-4 py-3 font-semibold">Avg Temp</th>
                        <th className="px-4 py-3 font-semibold">Water Type</th>
                        <th className="px-4 py-3 font-semibold">Pressure Zone</th>
                        <th className="px-4 py-3 font-semibold">Wind</th>
                        <th className="px-4 py-3 font-semibold">Cloud Cover</th>
                        <th className="px-4 py-3 font-semibold">Humidity</th>
                        <th className="px-4 py-3 font-semibold">Weather Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleCells.map((cell) => (
                        <tr className="border-t border-white/10" key={cell.id}>
                          <td className="px-4 py-3 font-mono text-xs text-stone-100">{cell.id}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatLatitude(cell.latitude)}</td>
                          <td className="px-4 py-3 text-stone-200">{formatTerrainType(cell.terrainType)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatElevation(cell.elevation)}</td>
                          <td className="px-4 py-3 text-stone-200">{cell.climateBand}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{formatTemperature(cell.averageTemperature)}</td>
                          <td className="px-4 py-3 text-stone-200">{formatTerrainType(cell.waterBodyType)}</td>
                          <td className="px-4 py-3 text-stone-200">{formatPressureZone(cell.pressureZone)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.windStrength.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.cloudCover.toFixed(3)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-300">{cell.relativeHumidity.toFixed(3)}</td>
                          <td className="px-4 py-3 text-stone-200">{formatTerrainType(cell.weatherType)}</td>
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