import { cache } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { WorldsDashboardClient } from "./worlds-dashboard.client";
import { createHrTimer } from "../../lib/utils/timing";
import { getConfiguredMaxSimulationYears } from "../../lib/simulation/simulation-limits";
import { getLatestPersistedAtlasSnapshots } from "../../lib/simulation/snapshot-store";
import { getSimulationMetrics, listRecentSimulationTicks, type SimulationMetrics } from "../../lib/simulation/metrics";
import {
  isDefaultUiHealthWorld,
  listWorldHealthSummariesLightweight,
  type WorldHealthBadge,
  type WorldHealthSummary,
} from "../../lib/simulation/world-health";
import { type TimeState } from "../../lib/simulation/time-engine";
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

const loadWorldsPageData = cache(async () =>
  Promise.all([
    listWorlds({ includeArchived: false }),
    listWorldActionLogs(12),
    listRecentSimulationTicks(12),
  ]),
);

function chooseDefaultActiveWorld(worlds: WorldRow[]): WorldRow | null {
  const defaultWorlds = worlds.filter(isDefaultUiHealthWorld);

  return (
    defaultWorlds.find((world) => world.environment === "SANDBOX" && world.status === "ACTIVE") ??
    defaultWorlds.find((world) => world.status === "ACTIVE") ??
    worlds.find((world) => world.environment === "SANDBOX" && world.status === "ACTIVE") ??
    worlds.find((world) => world.status === "ACTIVE") ??
    defaultWorlds[0] ??
    worlds[0] ??
    null
  );
}
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
    | "From worker snapshot"
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

function toNullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMs(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(value < 10 ? 2 : 0)} ms`;
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value, 2)} %`;
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

function ActionMessage({ message, tone }: { message: string; tone: "notice" | "error" }) {
  const className =
    tone === "notice"
      ? "border-emerald-300/30 bg-emerald-950/20 text-emerald-100"
      : "border-red-400/30 bg-red-950/20 text-red-100";

  return (
    <section className={`mt-6 border p-4 text-sm ${className}`}>
      {message}
    </section>
  );
}
function StatusPill({ children }: { children: string }) {
  return (
    <span className="inline-flex min-w-20 justify-center border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold uppercase tracking-normal text-stone-100">
      {children}
    </span>
  );
}

function SourcePill({ source }: { source: NonNullable<DetailItemProps["source"]> }) {
  const base = "inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";
  const cls =
    source === "From DB"
      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
      : source === "From Human MVA snapshot"
        ? "border-sky-300/40 bg-sky-300/10 text-sky-100"
        : source === "From worker snapshot"
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
  let healthSummaries = new Map<string, WorldHealthSummary>();
  let snapshots = new Map<string, Awaited<ReturnType<typeof getLatestPersistedAtlasSnapshots>> extends Map<string, infer Snapshot> ? Snapshot : never>();
  let metricsByWorld = new Map<string, SimulationMetrics>();
  let loadError: string | null = null;

  try {
    [worlds, actionLogs, tickHistory] = await timer.time("db:load", loadWorldsPageData);

    const [nextHealthSummaries, nextSnapshots, metricEntries] = await Promise.all([
      timer.time("states:health:lightweight", async () =>
        listWorldHealthSummariesLightweight(worlds),
      ),
      timer.time("snapshots:persisted", async () =>
        getLatestPersistedAtlasSnapshots(worlds.map((world) => world.id)),
      ),
      timer.time("metrics:db", async () =>
        Promise.all(worlds.map(async (world) => [world.id, await getSimulationMetrics(world.id)] as const)),
      ),
    ]);

    healthSummaries = nextHealthSummaries;
    snapshots = nextSnapshots;
    metricsByWorld = new Map(metricEntries);
    timer.record("states:health:default-skipped", worlds.filter((world) => !isDefaultUiHealthWorld(world)).length);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load worlds.";
  }

  const activeSandboxWorld = chooseDefaultActiveWorld(worlds);
  const activeSnapshot = activeSandboxWorld ? snapshots.get(activeSandboxWorld.id)?.snapshot ?? null : null;

  const maxSimulationYears = getConfiguredMaxSimulationYears();

  const dashboardWorlds = worlds.map((world) => {
    const persistedSnapshot = snapshots.get(world.id)?.snapshot ?? null;
    const timeState = persistedSnapshot?.time ?? null;
    const astronomyState = persistedSnapshot?.astronomy ?? null;
    const metrics = metricsByWorld.get(world.id) ?? null;
    const health = healthSummaries.get(world.id) ?? null;

    return {
      id: world.id,
      slug: world.slug,
      name: world.name,
      description: world.description ?? null,
      seed: world.seed ?? null,
      environment: world.environment,
      status: world.status,
      canonical: persistedSnapshot?.fingerprint.canonical ?? false,
      protected: world.protected,
      planetName: persistedSnapshot?.planet.name ?? world.planet?.name ?? null,
      fingerprintShortHash: persistedSnapshot?.fingerprint.shortHash ?? null,
      currentTick: formatTick(world.currentTick),
      timeLabel: timeState ? formatWorldTime(timeState) : "Snapshot unavailable",
      phaseLabel: timeState?.phaseLabel ?? "unavailable",
      seasonNorth: astronomyState?.seasonNorthernHemisphere ?? "unavailable",
      seasonSouth: astronomyState?.seasonSouthernHemisphere ?? "unavailable",
      skyLabel: astronomyState?.skyLabel ?? "unavailable",
      currentYear: timeState?.year ?? world.initialYear,
      yearsSimulated: Math.max(0, (timeState?.year ?? world.initialYear) - world.initialYear),
      eraLabel: world.initialEpochName,
      currentGeneration: world.currentGeneration,
      timeScale: world.timeScale,
      tickDurationSeconds: world.tickDurationSeconds,
      dayLengthSeconds: world.dayLengthSeconds,
      yearLengthDays: world.yearLengthDays,
      createdAt: world.createdAt.toISOString(),
      updatedAt: world.updatedAt.toISOString(),
      simulation: {
        running: world.status === "ACTIVE",
        canAdvance: world.status === "ACTIVE" && world.environment !== "PRODUCTION",
        averageTickTimeMs: toNullableNumber(metrics?.averageTickTimeMs),
        lastTickDurationMs: toNullableNumber(metrics?.lastTickDurationMs ?? null),
        ticksPerSecond: toNullableNumber(metrics?.ticksPerSecond),
        totalTicks: metrics?.totalTicks ?? null,
        failedSystems: metrics?.failedSystems ?? null,
        summaryTimings: {},
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
      social: {
        activeSettlements: persistedSnapshot?.social.activeSettlements ?? null,
        abandonedSettlements: persistedSnapshot?.social.abandonedSettlements ?? null,
        familyCount: persistedSnapshot?.social.familyCount ?? null,
        lineageCount: persistedSnapshot?.social.lineageCount ?? null,
        recentSettlementEvents: persistedSnapshot?.social.recentSettlementEvents ?? null,
      },
      planet: {
        landPercent: toNullableNumber(persistedSnapshot?.terrainSummary.landPercent),
        oceanPercent: toNullableNumber(persistedSnapshot?.terrainSummary.oceanPercent),
        habitableLandPercent: toNullableNumber(persistedSnapshot?.terrainSummary.habitableLandPercent),
        atmosphereStability: toNullableNumber(persistedSnapshot?.atmosphereSummary.averageAtmosphericStability),
        averageHumidity: toNullableNumber(persistedSnapshot?.weatherSummary.averageHumidity),
        averageStormPotential: toNullableNumber(persistedSnapshot?.weatherSummary.averageStormPotential),
        resourceDiversity: toNullableNumber(persistedSnapshot?.resourceSummary.resourceDiversity),
        plantedCellCount: persistedSnapshot?.plantSummary?.plantedCellCount ?? null,
        civilizationSupportScore: toNullableNumber(persistedSnapshot?.plantSummary?.civilizationStartingZoneSupportScore),
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

            <section className="mt-8 rounded border border-white/10 bg-black/20 p-4 sm:p-6">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Worker Snapshots</p>
                  <h2 className="mt-1 font-display text-2xl text-white">Persisted Viewer Data</h2>
                </div>
                <p className="text-sm text-stone-400">This page reads database health, tick history, and worker snapshots only.</p>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {worlds.map((world) => {
                  const persistedSnapshot = snapshots.get(world.id)?.snapshot ?? null;

                  return (
                    <article className="rounded border border-white/10 bg-black/30 p-4" key={world.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-white">{world.name}</h3>
                          <p className="mt-1 text-sm text-stone-400">{world.environment}</p>
                        </div>
                        <StatusPill>{persistedSnapshot ? "SNAPSHOT" : "MISSING"}</StatusPill>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <DetailItem label="Planet" value={persistedSnapshot?.planet.name ?? world.planet?.name ?? "-"} source={persistedSnapshot ? "From DB" : "Placeholder unavailable"} />
                        <DetailItem label="Tick" value={persistedSnapshot?.tick ?? world.currentTick.toString()} source="From DB" />
                        <DetailItem label="Phase" value={persistedSnapshot?.time.phaseLabel ?? "Snapshot unavailable"} source={persistedSnapshot ? "From DB" : "Placeholder unavailable"} />
                        <DetailItem label="Season (N)" value={persistedSnapshot?.astronomy.seasonNorthernHemisphere ?? "Snapshot unavailable"} source={persistedSnapshot ? "From DB" : "Placeholder unavailable"} />
                        <DetailItem label="Season (S)" value={persistedSnapshot?.astronomy.seasonSouthernHemisphere ?? "Snapshot unavailable"} source={persistedSnapshot ? "From DB" : "Placeholder unavailable"} />
                        <DetailItem label="Sky" value={persistedSnapshot?.astronomy.skyLabel ?? "Snapshot unavailable"} source={persistedSnapshot ? "From DB" : "Placeholder unavailable"} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {activeSandboxWorld ? (
              <WorldHealthPanel health={healthSummaries.get(activeSandboxWorld.id) ?? null} />
            ) : null}

            {activeSandboxWorld && !activeSnapshot ? (
              <section className="mt-8 rounded border border-white/10 bg-black/20 p-5 text-sm text-stone-300">
                The active world has no persisted worker snapshot yet. Start the simulation worker or run npm run sim:step to publish viewer data.
              </section>
            ) : null}

            <RecentTickHistory tickHistory={tickHistory} />
            <RecentActionLogs actionLogs={actionLogs} />
          </>
        )}
      </div>
    </main>
  );
}
