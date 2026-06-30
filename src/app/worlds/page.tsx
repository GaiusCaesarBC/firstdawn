import Link from "next/link";
import type { ReactNode } from "react";
import { WorldsDashboardClient } from "./worlds-dashboard.client";
import { createHrTimer } from "../../lib/utils/timing";
import { getCachedDeterministic } from "../../lib/simulation/deterministic-cache";
import { resolveSimulationSnapshots } from "../../lib/simulation/simulation-snapshot-cache";
import { getConfiguredMaxSimulationYears } from "../../lib/simulation/simulation-limits";

import {
  getAstronomyState,
  type AstronomyState,
} from "../../lib/simulation/astronomy-engine";
import { getAtmosphereState, type AtmosphericSummary } from "../../lib/simulation/atmosphere-engine";
import { getClimateState } from "../../lib/simulation/climate-engine";
import { getPlanetState, type PlanetState } from "../../lib/simulation/planet-engine";
import { createGrid, type SpatialGrid } from "../../lib/simulation/grid/grid";
import { getHydrologyState, type HydrologySummary } from "../../lib/simulation/hydrology-engine";
import { listRecentSimulationTicks } from "../../lib/simulation/metrics";
import { getPlanetResourcesState, type PlanetResourceSummary } from "../../lib/simulation/resources-engine";
import { getTerrainState, type TerrainSummary } from "../../lib/simulation/terrain-engine";
import { getWeatherState, type WeatherSummary } from "../../lib/simulation/weather-engine";
import {
  listWorldHealthSummaries,
  type WorldHealthBadge,
  type WorldHealthSummary,
} from "../../lib/simulation/world-health";
import {
  buildWorldFingerprint,
  CANONICAL_DEFAULT_WORLD_ALIASES,
  FIRST_DAWN_CANONICAL_WORLD,
  getCanonicalFingerprint,
  verifyWorldAgainstCanonical,
  type EnvironmentVerification,
  type WorldFingerprint,
} from "../../lib/worlds/canonical-world";
import { getTimeState, type TimeState } from "../../lib/simulation/time-engine";
import {
  getSimulationState,
  type SimulationState,
} from "../../lib/simulation/scheduler";
import {
  listWorldActionLogs,
  listWorlds,
  PRODUCTION_CONFIRMATION_PHRASE,
} from "../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type WorldRow = Awaited<ReturnType<typeof listWorlds>>[number];
type ActionLogRow = Awaited<ReturnType<typeof listWorldActionLogs>>[number];
type TickHistoryRow = Awaited<ReturnType<typeof listRecentSimulationTicks>>[number];

type WorldsPageProps = {
  searchParams?: Promise<SearchParams>;
};

// WorldControls is a client component imported directly; it renders nothing on the server and mounts on the client.

type DetailItemProps = {
  label: string;
  value: ReactNode;
  source?:
    | "From DB"
    | "From Human MVA snapshot"
    | "From deterministic simulation"
    | "Not tracked yet"
    | "Placeholder unavailable";
};

function formatTick(tick: bigint): string {
  return tick.toString();
}

function padClockPart(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatClock(time: Pick<TimeState, "hour" | "minute">): string {
  return `${padClockPart(time.hour)}:${padClockPart(time.minute)}`;
}

function formatWorldTime(time: TimeState): string {
  return `Y${time.year} D${time.dayOfYear} ${formatClock(time)} ${time.phaseLabel}`;
}

function formatDate(date: Date): string {
  return date.toISOString();
}

function formatOptionalDate(date: Date | null): string {
  return date ? formatDate(date) : "-";
}

function toNullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMs(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(value < 10 ? 2 : 0)} ms`;
}

function formatRate(value: number): string {
  return value > 0 ? value.toFixed(2) : "0.00";
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value, 2)} %`;
}

function formatElevation(value: number): string {
  return value.toFixed(3);
}

function formatTerrainType(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatTerrainDistribution(summary: TerrainSummary): string {
  return Object.entries(summary.terrainDistribution)
    .filter(([, count]) => count > 0)
    .map(([terrainType, count]) => `${formatTerrainType(terrainType)}: ${count}`)
    .join(" / ");
}

function formatPlanetNumber(value: number, unit: string, digits = 2): string {
  return `${formatNumber(value, digits)} ${unit}`;
}

function formatAtmosphereComposition(atmosphere: PlanetState["atmosphereComposition"]): string {
  return Object.entries(atmosphere)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}: ${value}`)
    .join(", ");
}

function formatPressureZone(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatPressureBandDistribution(summary: AtmosphericSummary): string {
  return Object.entries(summary.pressureBandDistribution)
    .filter(([, count]) => count > 0)
    .map(([zone, count]) => `${formatPressureZone(zone)}: ${count}`)
    .join(" / ");
}

function formatLatitudeBands(names: string[]): string {
  return names.join(" • ");
}

function formatSeasonLabel(season: string): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

function formatTemperature(value: number): string {
  return `${formatNumber(value, 1)} °C`;
}

function formatDaylightHours(value: number): string {
  return `${formatNumber(value, 1)} hours`;
}

function formatSolarEnergy(value: number): string {
  return value.toFixed(2);
}

function readSearchParam(params: SearchParams, key: string): string | null {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getSystemMetadata(metadata: unknown, systemName: string): Record<string, unknown> | null {
  if (!isRecord(metadata) || !Array.isArray(metadata.pipeline)) {
    return null;
  }

  const entry = metadata.pipeline.find((item) => isRecord(item) && item.name === systemName);

  if (!isRecord(entry) || !isRecord(entry.metadata)) {
    return null;
  }

  return entry.metadata;
}

function MetadataPreview({ metadata }: { metadata: unknown }) {
  const time = getSystemMetadata(metadata, "time");
  const astronomy = getSystemMetadata(metadata, "astronomy");

  if (!time && !astronomy) {
    return <span className="text-stone-500">-</span>;
  }

  return (
    <div className="space-y-1 text-xs text-stone-300">
      {time ? (
        <p>
          <span className="text-stone-500">Time</span> {String(time.phaseLabel ?? "-")} {String(time.hour ?? "--")}:{padClockPart(Number(time.minute ?? 0))}
        </p>
      ) : null}
      {astronomy ? (
        <p>
          <span className="text-stone-500">Sky</span> {String(astronomy.skyLabel ?? "-")} / daylight {Number(astronomy.daylightFactor ?? 0).toFixed(2)}
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="inline-flex min-w-20 justify-center border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold uppercase tracking-normal text-stone-100">
      {children}
    </span>
  );
}

function ProtectionState({ world }: { world: WorldRow }) {
  return world.protected ? (
    <span className="text-dawn-amber">Protected</span>
  ) : (
    <span className="text-stone-400">Unprotected</span>
  );
}

function SourcePill({ source }: { source: NonNullable<DetailItemProps["source"]> }) {
  const base = "inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";
  const cls =
    source === "From DB"
      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
      : source === "From Human MVA snapshot"
        ? "border-sky-300/40 bg-sky-300/10 text-sky-100"
        : source === "From deterministic simulation"
          ? "border-dawn-gold/40 bg-dawn-gold/10 text-dawn-amber"
          : source === "Not tracked yet"
            ? "border-stone-400/40 bg-stone-400/10 text-stone-200"
            : "border-stone-500/40 bg-stone-500/10 text-stone-200";

  return <span className={`${base} ${cls}`}>{source}</span>;
}

function DetailItem({ label, value, source }: DetailItemProps) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{label}</p>
        {source ? <SourcePill source={source} /> : null}
      </div>
      <p className="mt-1 text-sm text-stone-100">{value}</p>
    </div>
  );
}

function getHealthBadgeClass(badge: WorldHealthBadge): string {
  if (badge === "Healthy") {
    return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  }

  if (badge === "Warning") {
    return "border-dawn-gold/40 bg-dawn-gold/10 text-dawn-amber";
  }

  return "border-red-400/40 bg-red-950/30 text-red-100";
}

function formatHealthList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}

function WorldHealthPanel({ health }: { health: WorldHealthSummary | null }) {
  if (!health) {
    return (
      <section className="mt-8 rounded border border-white/10 bg-black/20 p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">World Health</p>
        <p className="mt-2 text-sm text-stone-300">Health data is unavailable for the selected world.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">World Health</p>
          <h2 className="mt-1 font-display text-2xl text-white">{health.worldName}</h2>
        </div>
        <span className={`inline-flex justify-center border px-3 py-1 text-xs font-semibold uppercase tracking-normal ${getHealthBadgeClass(health.badge)}`}>
          {health.badge}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="World Status" value={health.status} source="From DB" />
        <DetailItem label="World.currentTick" value={health.currentTick} source="From DB" />
        <DetailItem label="Latest SimulationTick.tickNumber" value={health.latestSimulationTickNumber ?? "-"} source={health.latestSimulationTickNumber == null ? "Placeholder unavailable" : "From DB"} />
        <DetailItem label="Last Tick Status" value={health.lastTickStatus} source="From DB" />
        <DetailItem label="Last Successful Tick Time" value={health.lastSuccessfulTickTime ?? "-"} source={health.lastSuccessfulTickTime == null ? "Placeholder unavailable" : "From DB"} />
        <DetailItem label="Failed Systems" value={formatHealthList(health.failedSystems)} source="From DB" />
        <DetailItem label="Last Error" value={health.lastErrorMessage ?? "-"} source={health.lastErrorMessage ? "From DB" : "Placeholder unavailable"} />
        <DetailItem label="Biome Coverage" value={formatPercent(health.biomeCoveragePercent)} source="From DB" />
        <DetailItem label="Plant Coverage" value={formatPercent(health.plantCoveragePercent)} source="From DB" />
        <DetailItem label="Animal Species" value={formatNumber(health.animalSpeciesCount, 0)} source={health.animalDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Occupied Habitat" value={formatPercent(health.occupiedAnimalHabitatPercent)} source={health.animalDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Wildlife Population" value={formatNumber(health.totalWildlifePopulation, 0)} source={health.animalDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Animal Suitability" value={formatNumber(health.averageAnimalHabitatSuitability, 3)} source={health.animalDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Animal Health" value={formatNumber(health.averageAnimalHealth, 3)} source={health.animalDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Ecosystem Health" value={formatNumber(health.averageEcosystemHealth, 3)} source={health.ecosystemDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Biodiversity" value={formatNumber(health.averageBiodiversity, 3)} source={health.ecosystemDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Migration Activity" value={formatNumber(health.migrationActivity, 3)} source={health.ecosystemDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Food Stability" value={formatNumber(health.foodStability, 3)} source={health.ecosystemDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Predator Balance" value={formatNumber(health.predatorBalance, 3)} source={health.ecosystemDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Collapsed Habitats" value={formatNumber(health.collapsedHabitats, 0)} source={health.ecosystemDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Population Growth" value={formatNumber(health.populationGrowthRate, 4)} source={health.ecosystemDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Plant Consumption" value={formatNumber(health.plantConsumptionRate, 3)} source={health.ecosystemDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Average Population Fitness" value={formatNumber(health.averageFitness, 3)} source={health.adaptationDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Adaptation Diversity" value={formatNumber(health.averageAdaptationDiversity, 3)} source={health.adaptationDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Average Climate Adaptation" value={formatNumber(health.averageClimateAdaptation, 3)} source={health.adaptationDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Average Disease Resistance" value={formatNumber(health.averageDiseaseResistance, 3)} source={health.adaptationDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Average Reproductive Efficiency" value={formatNumber(health.averageReproductiveEfficiency, 3)} source={health.adaptationDataAvailable ? "From DB" : "Not tracked yet"} />
        <DetailItem label="Highest Fitness Population" value={health.highestAdaptedPopulation ?? "-"} source={health.adaptationDataAvailable ? (health.highestAdaptedPopulation ? "From DB" : "Placeholder unavailable") : "Not tracked yet"} />
        <DetailItem label="Lowest Fitness Population" value={health.lowestFitnessPopulation ?? "-"} source={health.adaptationDataAvailable ? (health.lowestFitnessPopulation ? "From DB" : "Placeholder unavailable") : "Not tracked yet"} />
        <DetailItem label="Weather Snapshot" value={health.weatherSnapshotAvailable ? "Available" : "Missing"} source="From DB" />
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Humans MVA</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="Human System Status" value={health.humanSystemStatus ?? "-"} source="From Human MVA snapshot" />
          <DetailItem label="Human Population" value={health.humanPopulation != null ? formatNumber(health.humanPopulation, 0) : "-"} source="From Human MVA snapshot" />
          <DetailItem label="Male Humans" value={health.maleHumans != null ? formatNumber(health.maleHumans, 0) : "-"} source="From Human MVA snapshot" />
          <DetailItem label="Female Humans" value={health.femaleHumans != null ? formatNumber(health.femaleHumans, 0) : "-"} source="From Human MVA snapshot" />
          <DetailItem label="Adult Humans" value={health.adultHumans != null ? formatNumber(health.adultHumans, 0) : "-"} source="From Human MVA snapshot" />
          <DetailItem label="Children" value={health.childrenHumans != null ? formatNumber(health.childrenHumans, 0) : "-"} source="From Human MVA snapshot" />
          <DetailItem label="Latest Human Action" value={health.latestHumanAction ?? "-"} source="From Human MVA snapshot" />
          <DetailItem label="Latest Human Causal Event" value={health.latestHumanCausalEvent ?? "-"} source="From Human MVA snapshot" />
          <DetailItem label="Average Human Fear" value={health.averageHumanFear != null ? formatNumber(health.averageHumanFear, 3) : "-"} source="From Human MVA snapshot" />
          <DetailItem label="Average Human Curiosity" value={health.averageHumanCuriosity != null ? formatNumber(health.averageHumanCuriosity, 3) : "-"} source="From Human MVA snapshot" />
          <DetailItem label="Average Human Relationship Stability" value={health.averageHumanRelationshipStability != null ? formatNumber(health.averageHumanRelationshipStability, 3) : "-"} source="From Human MVA snapshot" />
        </div>
      </div>
    </section>
  );
}

function CanonicalWorldStatusPanel({
  fingerprint,
  terrainSummary,
  verification,
  world,
}: {
  fingerprint: WorldFingerprint | null;
  terrainSummary: TerrainSummary | null;
  verification: EnvironmentVerification | null;
  world: WorldRow;
}) {
  const matches = verification?.matches ?? false;

  return (
    <div className={`rounded border p-3 md:col-span-2 xl:col-span-3 ${matches ? "border-dawn-gold/30 bg-dawn-gold/5" : "border-red-400/30 bg-red-950/20"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Canonical World Status</p>
          <p className="mt-1 font-display text-xl text-white">{FIRST_DAWN_CANONICAL_WORLD.name}</p>
        </div>
        <span className={`inline-flex border px-2.5 py-1 text-xs font-semibold uppercase tracking-normal ${matches ? "border-dawn-gold/40 text-dawn-amber" : "border-red-400/40 text-red-100"}`}>
          {matches ? "Match" : "World Mismatch"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Fingerprint" value={fingerprint?.shortHash ?? "-"} />
        <DetailItem
          label="Seed"
          value={
            <span
              className="block max-w-full truncate font-mono text-xs text-stone-200"
              title={(fingerprint?.seed ?? world.seed ?? "-") || undefined}
            >
              {fingerprint?.seed ?? world.seed ?? "-"}
            </span>
          }
        />
        <DetailItem label="Environment" value={world.environment} />
        <DetailItem label="Canonical" value={fingerprint?.canonical ? "Yes" : "No"} />
        <DetailItem label="Ocean" value={terrainSummary ? formatPercent(terrainSummary.oceanPercent) : "-"} />
        <DetailItem label="Land" value={terrainSummary ? formatPercent(terrainSummary.landPercent) : "-"} />
        <DetailItem label="Habitable Land" value={terrainSummary ? formatPercent(terrainSummary.habitableLandPercent) : "-"} />
        <DetailItem label="Polar Land" value={terrainSummary ? formatPercent(terrainSummary.polarLandPercent) : "-"} />
        <DetailItem label="Largest Continent" value={terrainSummary ? `${terrainSummary.largestContinentEstimate} cells` : "-"} />
        <DetailItem label="Largest Ocean" value={terrainSummary ? `${terrainSummary.largestOceanEstimate} cells` : "-"} />
      </div>
      {!matches && verification ? (
        <div className="mt-3 grid gap-2 font-mono text-xs text-red-100 md:grid-cols-2">
          <p>Expected: {verification.expectedHash.slice(0, 24)}</p>
          <p>Actual: {verification.actualHash.slice(0, 24)}</p>
        </div>
      ) : null}
    </div>
  );
}
function CanonicalWorldMatrix({ worlds, grid }: { worlds: WorldRow[]; grid: SpatialGrid }) {
  const canonicalFingerprint = getCanonicalFingerprint(grid);
  const rows = CANONICAL_DEFAULT_WORLD_ALIASES.map((alias) => {
    const world = worlds.find((entry) => entry.slug === alias.slug);
    const fingerprint = world?.seed?.trim() ? buildWorldFingerprint(world, grid) : null;
    const verification = world?.seed?.trim() ? verifyWorldAgainstCanonical(world, grid) : null;

    return {
      label: alias.label,
      world,
      fingerprint,
      verification,
      matches: Boolean(world && verification?.matches),
    };
  });
  const mismatches = rows.filter((row) => !row.matches);
  const allMatch = mismatches.length === 0;

  return (
    <section className={`mt-8 rounded border p-4 sm:p-6 ${allMatch ? "border-dawn-gold/30 bg-dawn-gold/5" : "border-red-400/30 bg-red-950/20"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Canonical Planet</p>
          <h2 className="mt-1 font-display text-2xl text-white">
            {allMatch ? "Canonical World: Match" : "Canonical World Mismatch"}
          </h2>
        </div>
        <span className={`inline-flex border px-2.5 py-1 text-xs font-semibold uppercase tracking-normal ${allMatch ? "border-dawn-gold/40 text-dawn-amber" : "border-red-400/40 text-red-100"}`}>
          {canonicalFingerprint.shortHash}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {rows.map((row) => (
          <div className="rounded border border-white/10 bg-black/20 p-3" key={row.label}>
            <p className="text-sm font-semibold text-white">{row.label}: {row.matches ? "Match" : "Mismatch"}</p>
            <p className="mt-1 font-mono text-xs text-stone-400">{row.fingerprint?.shortHash ?? "missing"}</p>
            <p className="mt-1 text-xs text-stone-500">{row.world?.name ?? `${row.label} default world missing`}</p>
          </div>
        ))}
      </div>
      {!allMatch ? (
        <div className="mt-4 space-y-2 font-mono text-xs text-red-100">
          {mismatches.map((row) => (
            <p key={row.label}>
              {row.label}: expected {canonicalFingerprint.hash.slice(0, 24)} actual {row.verification?.actualHash.slice(0, 24) ?? "missing"}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TerrainSummaryPanel({ summary }: { summary: TerrainSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Terrain Summary</p>
        <p className="mt-1 text-sm text-stone-300">Terrain requires a world seed.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Terrain Summary</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Highest Elevation" value={formatElevation(summary.highestElevation)} />
        <DetailItem label="Lowest Elevation" value={formatElevation(summary.lowestElevation)} />
        <DetailItem label="Average Elevation" value={formatElevation(summary.averageElevation)} />
        <DetailItem label="Land" value={formatPercent(summary.landPercent)} />
        <DetailItem label="Ocean" value={formatPercent(summary.oceanPercent)} />
        <DetailItem label="Habitable Land" value={formatPercent(summary.habitableLandPercent)} />
        <DetailItem label="Polar Land" value={formatPercent(summary.polarLandPercent)} />
        <DetailItem label="Temperate Land" value={formatPercent(summary.temperateLandPercent)} />
        <DetailItem label="Subtropical Land" value={formatPercent(summary.subtropicalLandPercent)} />
        <DetailItem label="Tropical Land" value={formatPercent(summary.tropicalLandPercent)} />
        <DetailItem label="Mountain" value={formatPercent(summary.mountainPercent)} />
        <DetailItem label="Coastline Cells" value={String(summary.coastlineCells)} />
        <DetailItem label="Largest Continent" value={`${summary.largestContinentEstimate} cells`} />
        <DetailItem label="Largest Ocean" value={`${summary.largestOceanEstimate} cells`} />
        <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Terrain Distribution</p>
          <p className="mt-1 text-sm text-stone-100">{formatTerrainDistribution(summary)}</p>
        </div>
      </div>
    </div>
  );
}

function HydrologySummaryPanel({ summary }: { summary: HydrologySummary | null }) {
  if (!summary) {
    return (
      <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Water & Hydrology Summary</p>
        <p className="mt-1 text-sm text-stone-300">Hydrology requires terrain and a world seed.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Water & Hydrology Summary</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Ocean Cells" value={String(summary.oceanCells)} />
        <DetailItem label="Land Cells" value={String(summary.landCells)} />
        <DetailItem label="Coastal Water" value={String(summary.coastalWaterCells)} />
        <DetailItem label="Inland Basins" value={String(summary.inlandBasinCount)} />
        <DetailItem label="Lake Candidates" value={String(summary.lakeCandidateCount)} />
        <DetailItem label="River Sources" value={String(summary.riverSourceCandidateCount)} />
        <DetailItem label="River Channels" value={String(summary.riverChannelCandidateCount)} />
        <DetailItem label="Avg Moisture" value={summary.averageMoisturePotential.toFixed(3)} />
        <DetailItem label="Largest Watershed" value={`${summary.largestWatershedEstimate} cells`} />
        <DetailItem label="Largest Basin" value={`${summary.largestBasinEstimate} cells`} />
      </div>
    </div>
  );
}
function AtmosphericSummaryPanel({ summary }: { summary: AtmosphericSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Atmospheric Summary</p>
        <p className="mt-1 text-sm text-stone-300">Atmospheric circulation requires terrain, hydrology, and a world seed.</p>
      </div>
    );
  }

  const strongest = summary.strongestWinds[0];

  return (
    <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Atmospheric Summary</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Avg Wind Speed" value={summary.averageWindSpeed.toFixed(3)} />
        <DetailItem label="Avg Moisture Transport" value={summary.averageMoistureTransport.toFixed(3)} />
        <DetailItem label="Strongest Winds" value={strongest ? `${strongest.windDirection} ${strongest.windStrength.toFixed(3)} at ${strongest.cellId}` : "-"} />
        <DetailItem label="Largest Rain Shadow" value={`${summary.largestRainShadowRegion} cells`} />
        <DetailItem label="Avg Stability" value={summary.averageAtmosphericStability.toFixed(3)} />
        <DetailItem label="Circulation Pattern" value={summary.dominantCirculationPattern} />
        <DetailItem label="Seasonal Phase" value={summary.seasonalCirculationPhase} />
        <DetailItem label="Seasonal Shift" value={`${summary.seasonalShiftDegrees.toFixed(2)} deg`} />
        <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Pressure Band Distribution</p>
          <p className="mt-1 text-sm text-stone-100">{formatPressureBandDistribution(summary)}</p>
        </div>
      </div>
    </div>
  );
}
function WeatherSummaryPanel({ summary }: { summary: WeatherSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Weather Summary</p>
        <p className="mt-1 text-sm text-stone-300">Weather requires climate, terrain, hydrology, atmosphere, and a world seed.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Weather Summary</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Avg Humidity" value={summary.averageHumidity.toFixed(3)} />
        <DetailItem label="Avg Cloud Cover" value={summary.averageCloudCover.toFixed(3)} />
        <DetailItem label="Avg Precip Potential" value={summary.averagePrecipitationPotential.toFixed(3)} />
        <DetailItem label="Avg Storm Potential" value={summary.averageStormPotential.toFixed(3)} />
        <DetailItem label="Avg Fog Potential" value={summary.averageFogPotential.toFixed(3)} />
        <DetailItem label="Avg Snow Potential" value={summary.averageSnowPotential.toFixed(3)} />
        <DetailItem label="Avg Evaporation" value={summary.averageEvaporation.toFixed(3)} />
        <DetailItem label="Avg Dryness" value={summary.averageDryness.toFixed(3)} />
        <DetailItem label="Dominant Weather" value={formatTerrainType(summary.dominantWeatherType)} />
        <DetailItem label="Seasonal State" value={summary.seasonalWeatherState} />
      </div>
    </div>
  );
}

function ResourceSummaryPanel({ summary }: { summary: PlanetResourceSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Resource Summary</p>
        <p className="mt-1 text-sm text-stone-300">Planet resources require terrain, hydrology, climate, atmosphere, weather, and a world seed.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Resource Summary</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Strongest Mining Region" value={summary.strongestMiningRegion ? `${summary.strongestMiningRegion.cellId} / ${summary.strongestMiningRegion.cellCount} cells` : "-"} />
        <DetailItem label="Total Resource Diversity" value={summary.resourceDiversity.toFixed(3)} />
        <DetailItem label="Richest Aquifer" value={summary.largestAquifer ? `${summary.largestAquifer.cellId} / ${summary.largestAquifer.cellCount} cells` : "-"} />
        <DetailItem label="Volcanic Zones" value={String(summary.volcanicRegions.length)} />
        <DetailItem label="Major Sedimentary Basins" value={String(summary.majorSedimentaryBasins.length)} />
        <DetailItem label="Largest Coal Basin" value={summary.largestCoalBasin ? `${summary.largestCoalBasin.cellId} / ${summary.largestCoalBasin.cellCount} cells` : "-"} />
        <DetailItem label="Rare Earth Hotspots" value={String(summary.rareEarthHotspots.length)} />
        <DetailItem label="Avg Mineral Richness" value={summary.averageMineralRichness.toFixed(3)} />
      </div>
    </div>
  );
}
function ActionMessage({ message, tone }: { message: string; tone: "error" | "notice" }) {
  const styles =
    tone === "error"
      ? "border-red-400/30 text-red-100"
      : "border-dawn-gold/30 text-stone-100";

  return <p className={`mt-5 border ${styles} bg-black/20 p-3 text-sm`}>{message}</p>;
}

function ActiveWorldOverview({
  world,
  timeState,
  astronomyState,
  state,
}: {
  world: WorldRow;
  timeState: TimeState;
  astronomyState: AstronomyState;
  state: SimulationState | undefined;
}) {
  return (
    <section className="mt-8 rounded border border-white/10 bg-gradient-to-br from-black/40 to-black/20 p-6 shadow-[0_0_80px_rgba(0,0,0,0.2)]">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Active Sandbox Overview</p>
          <h2 className="mt-2 font-display text-2xl text-white">{world.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill>{world.status}</StatusPill>
          <span className="inline-flex min-w-20 justify-center border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold uppercase tracking-normal text-stone-200">
            {world.environment}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Tick" value={formatTick(state?.currentTick ?? world.currentTick)} />
        <DetailItem label="Time" value={formatWorldTime(timeState)} />
        <DetailItem label="Phase" value={timeState.phaseLabel} />
        <DetailItem label="Season" value={`${astronomyState.seasonNorthernHemisphere} / ${astronomyState.seasonSouthernHemisphere}`} />
        <DetailItem label="Sky" value={astronomyState.skyLabel} />
        <DetailItem label="Daylight" value={`${astronomyState.daylightFactor.toFixed(2)}x`} />
        <DetailItem label="Solar" value={`${astronomyState.solarIntensityFactor.toFixed(2)}x`} />
        <DetailItem label="Avg Tick" value={formatMs(state?.metrics.averageTickTimeMs ?? null)} />
        <DetailItem label="Total Ticks" value={String(state?.metrics.totalTicks ?? 0)} />
        <DetailItem label="Failed Systems" value={String(state?.metrics.failedSystems ?? 0)} />
      </div>
    </section>
  );
}

function ActiveWorldPlanetSection({
  world,
  grid,
  precomputed,
}: {
  world: WorldRow;
  grid: SpatialGrid;
  precomputed?: {
    climate?: ReturnType<typeof getClimateState> | null;
    terrain?: ReturnType<typeof getTerrainState> | null;
    hydrology?: ReturnType<typeof getHydrologyState> | null;
    atmosphere?: ReturnType<typeof getAtmosphereState> | null;
    weather?: ReturnType<typeof getWeatherState> | null;
    resources?: ReturnType<typeof getPlanetResourcesState> | null;
  };
}) {
  const planetState = getPlanetState(world);
  const climateState = precomputed?.climate ?? getClimateState(world);
  const gridSummary = grid.getGridSummary();
  const terrainState = world.seed?.trim() ? precomputed?.terrain ?? getTerrainState(world, grid) : null;
  const hydrologyState = world.seed?.trim() ? precomputed?.hydrology ?? getHydrologyState(world, grid) : null;
  const atmosphereState = world.seed?.trim() ? precomputed?.atmosphere ?? getAtmosphereState(world, grid) : null;
  const weatherState = world.seed?.trim() ? precomputed?.weather ?? getWeatherState(world, grid) : null;
  const resourceState = world.seed?.trim() ? precomputed?.resources ?? getPlanetResourcesState(world, grid) : null;
  const fingerprint = world.seed?.trim() ? buildWorldFingerprint(world, grid) : null;
  const verification = world.seed?.trim() ? verifyWorldAgainstCanonical(world, grid) : null;

  return (
    <section className="mt-8 rounded border border-white/10 bg-black/20 p-6">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Planet + Spatial Grid + Terrain + Climate + Atmosphere + Weather + Resources</p>
          <h2 className="mt-1 font-display text-2xl text-white">Active World Planet Model</h2>
        </div>
        <Link
          className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-100 transition hover:border-dawn-gold/40 hover:bg-white/10"
          href="/worlds/map"
        >
          Open Developer Atlas
        </Link>
        <Link
          className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-100 transition hover:border-dawn-gold/40 hover:bg-white/10"
          href="/worlds/grid"
        >
          Open Grid Debug
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="Planet Name" value={planetState.name} />
        <DetailItem label="Radius" value={formatPlanetNumber(planetState.radiusKm, "km", 0)} />
        <DetailItem label="Gravity" value={formatPlanetNumber(planetState.gravityMS2, "m/s²")} />
        <DetailItem
          label="Rotation Period"
          value={formatPlanetNumber(planetState.rotationPeriodHours, "hours")}
        />
        <DetailItem
          label="Orbital Period"
          value={formatPlanetNumber(planetState.orbitalPeriodDays, "days")}
        />
        <DetailItem
          label="Axial Tilt"
          value={formatPlanetNumber(planetState.axialTiltDegrees, "°")}
        />
        <DetailItem
          label="Atmospheric Pressure"
          value={formatPlanetNumber(planetState.atmospherePressureKPa, "kPa")}
        />
        <DetailItem
          label="Ocean Coverage"
          value={formatPlanetNumber(planetState.oceanCoveragePercent, "%")}
        />
        <DetailItem
          label="Grid Resolution"
          value={`${gridSummary.latitudeDivisions} × ${gridSummary.longitudeDivisions}`}
        />
        <DetailItem label="Estimated Cell Count" value={String(gridSummary.totalCells)} />
        <DetailItem
          label="Latitude Bands"
          value={`${gridSummary.latitudeBands.length} bands`}
        />
        <CanonicalWorldStatusPanel
          fingerprint={fingerprint}
          terrainSummary={terrainState?.summary ?? null}
          verification={verification}
          world={world}
        />
        <TerrainSummaryPanel summary={terrainState?.summary ?? null} />
        <HydrologySummaryPanel summary={hydrologyState?.summary ?? null} />
        <AtmosphericSummaryPanel summary={atmosphereState?.summary ?? null} />
        <WeatherSummaryPanel summary={weatherState?.summary ?? null} />
        <ResourceSummaryPanel summary={resourceState?.summary ?? null} />
        <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Climate Summary</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailItem
              label="Average Equator Temperature"
              value={formatTemperature(climateState.summary.equatorAverageTemperatureC)}
            />
            <DetailItem
              label="Average Pole Temperature"
              value={formatTemperature(climateState.summary.averagePoleTemperatureC)}
            />
            <DetailItem
              label="Current Northern Season"
              value={formatSeasonLabel(climateState.seasonNorthernHemisphere)}
            />
            <DetailItem
              label="Current Southern Season"
              value={formatSeasonLabel(climateState.seasonSouthernHemisphere)}
            />
            <DetailItem
              label="Average Daylight"
              value={formatDaylightHours(climateState.summary.averageDaylightHours)}
            />
            <DetailItem
              label="Average Solar Energy"
              value={formatSolarEnergy(climateState.summary.averageSolarEnergy)}
            />
            <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Climate Bands Present</p>
              <p className="mt-1 text-sm text-stone-100">
                {formatLatitudeBands(climateState.summary.climateBandsPresent)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-stone-300">
            Terrain, passive climate, hydrology, atmospheric circulation, and weather are deterministic derived layers. Flowing rivers, erosion, and life are still unmodeled.
          </p>
        </div>
        <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Atmospheric Composition</p>
          <p className="mt-1 text-sm text-stone-100">
            {formatAtmosphereComposition(planetState.atmosphereComposition)}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-black/20 p-3 md:col-span-2 xl:col-span-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Latitude Bands</p>
          <p className="mt-1 text-sm text-stone-100">
            {formatLatitudeBands(gridSummary.latitudeBands.map((band) => band.name))}
          </p>
        </div>
      </div>
    </section>
  );
}

function SimulationHeartbeat({
  states,
  worlds,
}: {
  states: Map<string, SimulationState>;
  worlds: WorldRow[];
}) {
  return (
    <section className="mt-8 border-t border-white/10 pt-6" id="simulation-heartbeat">
      <h2 className="font-display text-2xl text-white">Simulation Heartbeat</h2>
      <div className="mt-4 overflow-hidden border border-white/10 bg-black/20">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-stone-400">
            <tr>
              <th className="px-4 py-3 font-semibold">World</th>
              <th className="px-4 py-3 font-semibold">Current Tick</th>
              <th className="px-4 py-3 font-semibold">Running</th>
              <th className="px-4 py-3 font-semibold">Last Duration</th>
              <th className="px-4 py-3 font-semibold">Average Tick</th>
              <th className="px-4 py-3 font-semibold">Ticks / Sec</th>
              <th className="px-4 py-3 font-semibold">Total Ticks</th>
              <th className="px-4 py-3 font-semibold">Failed Systems</th>
            </tr>
          </thead>
          <tbody>
            {worlds.map((world) => {
              const state = states.get(world.id);

              return (
                <tr className="border-t border-white/10" key={world.id}>
                  <td className="px-4 py-4 font-semibold text-white">{world.name}</td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {formatTick(state?.currentTick ?? world.currentTick)}
                  </td>
                  <td className="px-4 py-4 text-stone-200">
                    {state?.simulationRunning ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {formatMs(state?.metrics.lastTickDurationMs ?? null)}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {formatMs(state?.metrics.averageTickTimeMs ?? null)}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {formatRate(state?.metrics.ticksPerSecond ?? 0)}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {state?.metrics.totalTicks ?? 0}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {state?.metrics.failedSystems ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecentTickHistory({ tickHistory }: { tickHistory: TickHistoryRow[] }) {
  return (
    <section className="mt-8 border-t border-white/10 pt-6" id="recent-tick-history">
      <h2 className="font-display text-2xl text-white">Recent Tick History</h2>
      <div className="mt-4 overflow-hidden border border-white/10 bg-black/20">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-stone-400">
            <tr>
              <th className="px-4 py-3 font-semibold">World</th>
              <th className="px-4 py-3 font-semibold">Tick</th>
              <th className="px-4 py-3 font-semibold">Success</th>
              <th className="px-4 py-3 font-semibold">Duration</th>
              <th className="px-4 py-3 font-semibold">Systems</th>
              <th className="px-4 py-3 font-semibold">Metadata</th>
              <th className="px-4 py-3 font-semibold">Completed</th>
            </tr>
          </thead>
          <tbody>
            {tickHistory.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-stone-300" colSpan={7}>
                  No simulation ticks have been recorded yet.
                </td>
              </tr>
            ) : (
              tickHistory.map((tick) => (
                <tr className="border-t border-white/10" key={tick.id}>
                  <td className="px-4 py-4 text-stone-100">{tick.world.name}</td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {formatTick(tick.tick)}
                  </td>
                  <td className="px-4 py-4 text-stone-200">{tick.success ? "Yes" : "No"}</td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {formatMs(tick.durationMs)}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-300">
                    {tick.systemCount}
                  </td>
                  <td className="px-4 py-4">
                    <MetadataPreview metadata={tick.metadata} />
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-400">
                    {formatDate(tick.completedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecentActionLogs({ actionLogs }: { actionLogs: ActionLogRow[] }) {
  return (
    <section className="mt-8 border-t border-white/10 pt-6" id="recent-action-logs">
      <h2 className="font-display text-2xl text-white">Recent Action History</h2>
      <div className="mt-4 overflow-hidden border border-white/10 bg-black/20">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-stone-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">World</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {actionLogs.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-stone-300" colSpan={5}>
                  No lifecycle actions have been logged yet.
                </td>
              </tr>
            ) : (
              actionLogs.map((log) => (
                <tr className="border-t border-white/10" key={log.id}>
                  <td className="px-4 py-4 font-mono text-xs text-stone-200">{log.action}</td>
                  <td className="px-4 py-4 text-stone-100">{log.world.name}</td>
                  <td className="px-4 py-4 text-stone-300">{log.actor}</td>
                  <td className="px-4 py-4 text-stone-300">{log.reason ?? "-"}</td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-400">
                    {formatDate(log.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function WorldsPage({ searchParams }: WorldsPageProps) {
  const timer = createHrTimer();
  const params = searchParams ? await searchParams : {};
  const notice = readSearchParam(params, "notice");
  const actionError = readSearchParam(params, "error");
  let worlds: WorldRow[] = [];
  let actionLogs: ActionLogRow[] = [];
  let tickHistory: TickHistoryRow[] = [];
  let simulationStates = new Map<string, SimulationState>();
  let healthSummaries = new Map<string, WorldHealthSummary>();
  let grid: SpatialGrid | null = null;
  let loadError: string | null = null;

  try {
    [worlds, actionLogs, tickHistory] = await timer.time("db:load", async () =>
      Promise.all([
        listWorlds(),
        listWorldActionLogs(12),
        listRecentSimulationTicks(12),
      ]),
    );

    if (worlds.length > 0) {
      grid = await timer.time("grid", async () => createGrid());
    }

    simulationStates = await timer.time("states:simulation", async () => {
      if (!grid) {
        return new Map<string, SimulationState>();
      }

      const snapshots = await resolveSimulationSnapshots(worlds, {
        grid,
        computeSnapshot: (world) => timer.time(
          `simulation snapshot compute:${world.slug}`,
          () => getSimulationState(world.id),
        ),
        onEvent: (event) => {
          const fingerprint = event.fingerprint?.shortHash ?? "noncanonical";
          timer.record(`simulation snapshot ${event.action}:${event.world.slug}:${fingerprint}`);
        },
      });

      return snapshots.states;
    });

    healthSummaries = await timer.time("states:health", async () =>
      listWorldHealthSummaries(worlds.map((world) => world.id)),
    );
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load worlds.";
  }

  const activeSandboxWorld =
    worlds.find((world) => world.environment === "SANDBOX" && world.status === "ACTIVE") ??
    worlds.find((world) => world.status === "ACTIVE") ??
    worlds[0] ??
    null;

  // Compute deterministic layers for the active sandbox world with caching (canonical only)
  let precomputedTerrain: ReturnType<typeof getTerrainState> | null = null;
  let precomputedHydrology: ReturnType<typeof getHydrologyState> | null = null;
  let precomputedAtmosphere: ReturnType<typeof getAtmosphereState> | null = null;
  let precomputedWeather: ReturnType<typeof getWeatherState> | null = null;
  let precomputedResources: ReturnType<typeof getPlanetResourcesState> | null = null;
  let precomputedClimate: ReturnType<typeof getClimateState> | null = null;

  if (activeSandboxWorld && grid) {
    const currentTickVariant = `tick:${activeSandboxWorld.currentTick.toString()}`;
    precomputedClimate = await timer.time("climate", async () =>
      getCachedDeterministic("climate", activeSandboxWorld, grid!, () => getClimateState(activeSandboxWorld!), currentTickVariant),
    );
    precomputedTerrain = await timer.time("terrain", async () =>
      getCachedDeterministic("terrain", activeSandboxWorld, grid!, () => getTerrainState(activeSandboxWorld!, grid!)),
    );
    precomputedHydrology = await timer.time("hydrology", async () =>
      getCachedDeterministic("hydrology", activeSandboxWorld, grid!, () => getHydrologyState(activeSandboxWorld!, grid!)),
    );
    precomputedAtmosphere = await timer.time("atmosphere", async () =>
      getCachedDeterministic("atmosphere", activeSandboxWorld, grid!, () => getAtmosphereState(activeSandboxWorld!, grid!), currentTickVariant),
    );
    precomputedWeather = await timer.time("weather", async () =>
      getCachedDeterministic("weather", activeSandboxWorld, grid!, () => getWeatherState(activeSandboxWorld!, grid!), currentTickVariant),
    );
    precomputedResources = await timer.time("resources", async () =>
      getCachedDeterministic("resources", activeSandboxWorld, grid!, () => getPlanetResourcesState(activeSandboxWorld!, grid!), currentTickVariant),
    );
  }

  const maxSimulationYears = getConfiguredMaxSimulationYears();

  const dashboardWorlds = worlds.map((world) => {
    const timeState = getTimeState(world);
    const astronomyState = getAstronomyState(world);
    const state = simulationStates.get(world.id);
    const health = healthSummaries.get(world.id) ?? null;
    const fingerprint = grid && world.seed?.trim() ? buildWorldFingerprint(world, grid) : null;

    return {
      id: world.id,
      slug: world.slug,
      name: world.name,
      description: world.description ?? null,
      seed: world.seed ?? null,
      environment: world.environment,
      status: world.status,
      canonical: fingerprint?.canonical ?? false,
      protected: world.protected,
      planetName: world.planet?.name ?? null,
      fingerprintShortHash: fingerprint?.shortHash ?? null,
      currentTick: formatTick(world.currentTick),
      timeLabel: formatWorldTime(timeState),
      phaseLabel: timeState.phaseLabel,
      seasonNorth: astronomyState.seasonNorthernHemisphere,
      seasonSouth: astronomyState.seasonSouthernHemisphere,
      skyLabel: astronomyState.skyLabel,
      currentYear: timeState.year,
      yearsSimulated: Math.max(0, timeState.year - world.initialYear),
      eraLabel: world.initialEpochName,
      currentGeneration: world.currentGeneration,
      timeScale: world.timeScale,
      tickDurationSeconds: world.tickDurationSeconds,
      dayLengthSeconds: world.dayLengthSeconds,
      yearLengthDays: world.yearLengthDays,
      createdAt: world.createdAt.toISOString(),
      updatedAt: world.updatedAt.toISOString(),
      simulation: {
        running: state?.simulationRunning ?? false,
        canAdvance: state?.canAdvance ?? false,
        averageTickTimeMs: toNullableNumber(state?.metrics.averageTickTimeMs),
        lastTickDurationMs: toNullableNumber(state?.metrics.lastTickDurationMs ?? null),
        ticksPerSecond: toNullableNumber(state?.metrics.ticksPerSecond),
        totalTicks: state?.metrics.totalTicks ?? null,
        failedSystems: state?.metrics.failedSystems ?? null,
        summaryTimings: state?.summaryTimings ?? {},
      },
      health: {
        badge: health?.badge ?? null,
        lastTickStatus: health?.lastTickStatus ?? "missing",
        lastSuccessfulTickTime: health?.lastSuccessfulTickTime ?? null,
        weatherSnapshotAvailable: health?.weatherSnapshotAvailable ?? false,
        systemHealthDiagnostics: health?.systemHealthDiagnostics ?? [],
        biomeCoveragePercent: toNullableNumber(health?.biomeCoveragePercent),
        plantCoveragePercent: toNullableNumber(health?.plantCoveragePercent),
        animalSpeciesCount: health?.animalSpeciesCount ?? null,
        occupiedAnimalHabitatPercent: toNullableNumber(health?.occupiedAnimalHabitatPercent),
        totalWildlifePopulation: toNullableNumber(health?.totalWildlifePopulation),
        averageAnimalHealth: toNullableNumber(health?.averageAnimalHealth),
        averageEcosystemHealth: toNullableNumber(health?.averageEcosystemHealth),
        averageBiodiversity: toNullableNumber(health?.averageBiodiversity),
        populationGrowthRate: toNullableNumber(health?.populationGrowthRate),
        averageFitness: toNullableNumber(health?.averageFitness),
        averageAdaptationDiversity: toNullableNumber(health?.averageAdaptationDiversity),
        averageClimateAdaptation: toNullableNumber(health?.averageClimateAdaptation),
        averageDiseaseResistance: toNullableNumber(health?.averageDiseaseResistance),
        averageReproductiveEfficiency: toNullableNumber(health?.averageReproductiveEfficiency),
        highestAdaptedPopulation: health?.highestAdaptedPopulation ?? null,
        lowestFitnessPopulation: health?.lowestFitnessPopulation ?? null,
        humanPopulation: health?.humanPopulation ?? null,
        adultHumans: health?.adultHumans ?? null,
        childrenHumans: health?.childrenHumans ?? null,
        maleHumans: health?.maleHumans ?? null,
        femaleHumans: health?.femaleHumans ?? null,
        latestHumanAction: health?.latestHumanAction ?? null,
        latestHumanCausalEvent: health?.latestHumanCausalEvent ?? null,
        averageHumanFear: toNullableNumber(health?.averageHumanFear),
        averageHumanCuriosity: toNullableNumber(health?.averageHumanCuriosity),
        averageHumanRelationshipStability: toNullableNumber(health?.averageHumanRelationshipStability),
        humanSystemStatus: health?.humanSystemStatus ?? null,
      },
      planet: {
        landPercent: toNullableNumber(state?.terrainSummary?.landPercent),
        oceanPercent: toNullableNumber(state?.terrainSummary?.oceanPercent),
        habitableLandPercent: toNullableNumber(state?.terrainSummary?.habitableLandPercent),
        atmosphereStability: toNullableNumber(state?.atmosphereSummary?.averageAtmosphericStability),
        averageHumidity: toNullableNumber(state?.weatherSummary?.averageHumidity),
        averageStormPotential: toNullableNumber(state?.weatherSummary?.averageStormPotential),
        resourceDiversity: toNullableNumber(state?.resourceSummary?.resourceDiversity),
        plantedCellCount: state?.plantSummary?.plantedCellCount ?? null,
        civilizationSupportScore: toNullableNumber(state?.plantSummary?.civilizationStartingZoneSupportScore),
        foodSupportScore: null,
      },
    };
  });

  const dashboardActionLogs = actionLogs.map((log) => ({
    id: log.id,
    worldSlug: log.world.slug,
    worldName: log.world.name,
    action: log.action,
    actor: log.actor,
    reason: log.reason ?? null,
    createdAt: log.createdAt.toISOString(),
  }));

  const dashboardTickHistory = tickHistory.map((tick) => ({
    id: tick.id,
    worldSlug: tick.world.slug,
    worldName: tick.world.name,
    tick: tick.tick.toString(),
    success: tick.success,
    durationMs: tick.durationMs,
    systemCount: tick.systemCount,
    failedSystemCount: tick.failedSystemCount,
    completedAt: tick.completedAt.toISOString(),
  }));

  // Final dev timing log
  timer.logDevBreakdown("/worlds timing");

  return (
    <main className="min-h-screen bg-dawn-coal px-6 py-10 text-stone-100 sm:px-10 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-dawn-gold">
            Developer Control Room
          </p>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">Worlds</h1>
        </header>

        {notice ? <ActionMessage message={notice} tone="notice" /> : null}
        {actionError ? <ActionMessage message={actionError} tone="error" /> : null}

        {loadError ? (
          <section className="mt-8 border border-dawn-gold/30 bg-black/20 p-5 text-sm leading-6 text-stone-200">
            <p className="font-semibold text-dawn-amber">Worlds could not be loaded.</p>
            <p className="mt-2 text-stone-300">{loadError}</p>
          </section>
        ) : (
          <>
            <WorldsDashboardClient
              actionLogs={dashboardActionLogs}
              productionPhrase={PRODUCTION_CONFIRMATION_PHRASE}
              maxSimulationYears={maxSimulationYears}
              tickHistory={dashboardTickHistory}
              worlds={dashboardWorlds}
            />

            <CanonicalWorldMatrix worlds={worlds} grid={grid ?? createGrid()} />

            {activeSandboxWorld && grid ? (
              <ActiveWorldOverview
                astronomyState={getAstronomyState(activeSandboxWorld)}
                state={simulationStates.get(activeSandboxWorld.id)}
                timeState={getTimeState(activeSandboxWorld)}
                world={activeSandboxWorld}
              />
            ) : null}

            {activeSandboxWorld ? (
              <WorldHealthPanel health={healthSummaries.get(activeSandboxWorld.id) ?? null} />
            ) : null}

            {activeSandboxWorld && grid ? (
              <ActiveWorldPlanetSection
                world={activeSandboxWorld}
                grid={grid}
                precomputed={{
                  climate: precomputedClimate,
                  terrain: precomputedTerrain,
                  hydrology: precomputedHydrology,
                  atmosphere: precomputedAtmosphere,
                  weather: precomputedWeather,
                  resources: precomputedResources,
                }}
              />
            ) : null}

            <section className="mt-8 rounded border border-white/10 bg-black/20 p-4 sm:p-6">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Astronomy / Time</p>
                  <h2 className="mt-1 font-display text-2xl text-white">Details</h2>
                </div>
                <p className="text-sm text-stone-400">Each world now exposes its orbital state independently.</p>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {worlds.map((world) => {
                  const timeState = getTimeState(world);
                  const astronomyState = getAstronomyState(world);

                  return (
                    <article className="rounded border border-white/10 bg-black/30 p-4" key={world.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-white">{world.name}</h3>
                          <p className="mt-1 text-sm text-stone-400">{world.environment}</p>
                        </div>
                        <StatusPill>{world.status}</StatusPill>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <DetailItem label="Planet" value={world.planet?.name ?? "-"} />
                        <DetailItem label="Phase" value={timeState.phaseLabel} />
                        <DetailItem label="Season (N)" value={astronomyState.seasonNorthernHemisphere} />
                        <DetailItem label="Season (S)" value={astronomyState.seasonSouthernHemisphere} />
                        <DetailItem label="Sky" value={astronomyState.skyLabel} />
                        <DetailItem label="Solar" value={`${astronomyState.solarIntensityFactor.toFixed(2)}x`} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <SimulationHeartbeat worlds={worlds} states={simulationStates} />
            <RecentTickHistory tickHistory={tickHistory} />
            <RecentActionLogs actionLogs={actionLogs} />
          </>
        )}
      </div>
    </main>
  );
}







