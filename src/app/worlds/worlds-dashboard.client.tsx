"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { WorldControlsClient } from "./world-controls.client";

type WorldHealthBadge = "Healthy" | "Warning" | "Error";

type SummaryTiming = {
  executionTimeMs: number;
  cellsProcessed: number;
  cacheHitRate: number;
  cacheHit: boolean;
};

export type MissionControlWorld = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  seed: string | null;
  environment: string;
  status: string;
  canonical: boolean;
  protected: boolean;
  planetName: string | null;
  fingerprintShortHash: string | null;
  currentTick: string;
  timeLabel: string;
  phaseLabel: string;
  seasonNorth: string;
  seasonSouth: string;
  skyLabel: string;
  currentYear: number;
  yearsSimulated: number;
  eraLabel: string;
  currentGeneration: number;
  timeScale: number;
  tickDurationSeconds: number;
  dayLengthSeconds: number;
  yearLengthDays: number;
  createdAt: string;
  updatedAt: string;
  simulation: {
    running: boolean;
    canAdvance: boolean;
    averageTickTimeMs: number | null;
    lastTickDurationMs: number | null;
    ticksPerSecond: number | null;
    totalTicks: number | null;
    failedSystems: number | null;
    summaryTimings: Record<string, SummaryTiming>;
  };
  health: {
    badge: WorldHealthBadge | null;
    lastTickStatus: string;
    lastSuccessfulTickTime: string | null;
    weatherSnapshotAvailable: boolean;
    systemHealthDiagnostics: string[];
    biomeCoveragePercent: number | null;
    plantCoveragePercent: number | null;
    animalSpeciesCount: number | null;
    occupiedAnimalHabitatPercent: number | null;
    totalWildlifePopulation: number | null;
    averageAnimalHealth: number | null;
    averageEcosystemHealth: number | null;
    averageBiodiversity: number | null;
    populationGrowthRate: number | null;
    averageFitness: number | null;
    averageAdaptationDiversity: number | null;
    averageClimateAdaptation: number | null;
    averageDiseaseResistance: number | null;
    averageReproductiveEfficiency: number | null;
    highestAdaptedPopulation: string | null;
    lowestFitnessPopulation: string | null;
    humanPopulation: number | null;
    adultHumans: number | null;
    childrenHumans: number | null;
    maleHumans: number | null;
    femaleHumans: number | null;
    latestHumanAction: string | null;
    latestHumanCausalEvent: string | null;
    averageHumanFear: number | null;
    averageHumanCuriosity: number | null;
    averageHumanRelationshipStability: number | null;
    humanSystemStatus: string | null;
  };
  planet: {
    landPercent: number | null;
    oceanPercent: number | null;
    habitableLandPercent: number | null;
    atmosphereStability: number | null;
    averageHumidity: number | null;
    averageStormPotential: number | null;
    resourceDiversity: number | null;
    plantedCellCount: number | null;
    civilizationSupportScore: number | null;
    foodSupportScore: number | null;
  };
};

export type MissionControlActionLog = {
  id: string;
  worldSlug: string;
  worldName: string;
  action: string;
  actor: string;
  reason: string | null;
  createdAt: string;
};

export type MissionControlTickHistory = {
  id: string;
  worldSlug: string;
  worldName: string;
  tick: string;
  success: boolean;
  durationMs: number;
  systemCount: number;
  failedSystemCount: number;
  completedAt: string;
};

type WorldsDashboardClientProps = {
  worlds: MissionControlWorld[];
  actionLogs: MissionControlActionLog[];
  tickHistory: MissionControlTickHistory[];
  productionPhrase: string;
  maxSimulationYears: number;
};

type FilterMode = "All" | "Running" | "Paused" | "Archived" | "Canonical" | "Development" | "Production";
type SortMode = "Newest" | "Oldest" | "Highest Population" | "Most Recent Tick" | "Alphabetical";
type InspectorTab =
  | "Overview"
  | "Simulation"
  | "Planet"
  | "Civilizations"
  | "Population"
  | "Biology"
  | "Discovery"
  | "Adaptation"
  | "Atlas"
  | "Events"
  | "Scheduler"
  | "Performance"
  | "Logs"
  | "Developer"
  | "Danger Zone";

const FILTERS: readonly FilterMode[] = [
  "All",
  "Running",
  "Paused",
  "Archived",
  "Canonical",
  "Development",
  "Production",
];

const SORTS: readonly SortMode[] = [
  "Newest",
  "Oldest",
  "Highest Population",
  "Most Recent Tick",
  "Alphabetical",
];

const INSPECTOR_TABS: readonly InspectorTab[] = [
  "Overview",
  "Simulation",
  "Planet",
  "Civilizations",
  "Population",
  "Biology",
  "Discovery",
  "Adaptation",
  "Atlas",
  "Events",
  "Scheduler",
  "Performance",
  "Logs",
  "Developer",
  "Danger Zone",
];

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (valid.length === 0) {
    return null;
  }

  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Untracked";
  }

  return numberFormatter.format(value);
}

function formatCompactNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Untracked";
  }

  return compactNumberFormatter.format(value);
}

function formatDecimal(value: number | null | undefined, digits = 2, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Untracked";
  }

  return `${value.toFixed(digits)}${suffix}`;
}

function formatPercent(value: number | null | undefined, digits = 0): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Untracked";
  }

  return `${value.toFixed(digits)}%`;
}

function formatMs(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Untracked";
  }

  return `${value.toFixed(value < 10 ? 2 : 0)} ms`;
}

function formatIso(value: string | null | undefined): string {
  if (!value) {
    return "Untracked";
  }

  return new Date(value).toLocaleString();
}

function toTickValue(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function computeSimulationHealth(world: MissionControlWorld): number {
  const badgeBase =
    world.health.badge === "Healthy"
      ? 88
      : world.health.badge === "Warning"
        ? 62
        : world.health.badge === "Error"
          ? 28
          : 52;
  const lastTickPenalty = world.health.lastTickStatus === "failed" ? 18 : 0;
  const failedSystemsPenalty = Math.min(28, (world.simulation.failedSystems ?? 0) * 8);

  return clamp(badgeBase - lastTickPenalty - failedSystemsPenalty);
}

function computePlanetStability(world: MissionControlWorld): number | null {
  return average([
    world.health.biomeCoveragePercent,
    world.health.plantCoveragePercent,
    world.health.averageEcosystemHealth != null ? world.health.averageEcosystemHealth * 100 : null,
    world.planet.habitableLandPercent,
  ]);
}

function computeClimateStability(world: MissionControlWorld): number | null {
  const stormStability =
    world.planet.averageStormPotential != null ? clamp(100 - world.planet.averageStormPotential * 100) : null;
  const humidityBalance =
    world.planet.averageHumidity != null ? clamp(100 - Math.abs(world.planet.averageHumidity - 0.55) * 160) : null;

  return average([
    world.planet.atmosphereStability != null ? world.planet.atmosphereStability * 100 : null,
    stormStability,
    humidityBalance,
  ]);
}

function computeSchedulerHealth(world: MissionControlWorld): number {
  let score = world.simulation.canAdvance ? 84 : world.status === "ACTIVE" ? 62 : 56;

  if (world.simulation.lastTickDurationMs != null && world.simulation.lastTickDurationMs > 300) {
    score -= 12;
  }

  if ((world.simulation.failedSystems ?? 0) > 0) {
    score -= Math.min(20, (world.simulation.failedSystems ?? 0) * 6);
  }

  return clamp(score);
}

function computeOverallHealth(world: MissionControlWorld): number {
  const values = [
    computeSimulationHealth(world),
    computePlanetStability(world),
    computeClimateStability(world),
    computeSchedulerHealth(world),
  ];

  return Math.round(average(values) ?? 52);
}

function getScoreTone(score: number | null | undefined): string {
  if (typeof score !== "number") {
    return "from-stone-500 to-stone-400";
  }

  if (score >= 75) {
    return "from-emerald-400 to-lime-300";
  }

  if (score >= 55) {
    return "from-amber-300 to-yellow-200";
  }

  if (score >= 35) {
    return "from-orange-400 to-amber-300";
  }

  return "from-red-500 to-orange-400";
}

function getStatusTone(world: MissionControlWorld): string {
  if (world.simulation.running) {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  }

  if (world.status === "PAUSED") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }

  if (world.status === "ARCHIVED") {
    return "border-stone-400/20 bg-stone-500/10 text-stone-300";
  }

  return "border-sky-300/30 bg-sky-300/10 text-sky-100";
}

function metricDelta(value: number, baseline: number): string {
  const delta = value - baseline;

  if (delta > 0) {
    return `+${delta}`;
  }

  if (delta < 0) {
    return `${delta}`;
  }

  return "steady";
}

function DashboardGlyph({ name, className }: { name: string; className?: string }) {
  const classes = className ?? "h-5 w-5";

  switch (name) {
    case "worlds":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "active":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "running":
      return (
        <svg className={classes} fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6.5v11l9-5.5-9-5.5Z" />
        </svg>
      );
    case "paused":
      return (
        <svg className={classes} fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 5h3v14H7zm7 0h3v14h-3z" />
        </svg>
      );
    case "archived":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M4 7h16v12H4zM9 11h6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 7l2-3h14l2 3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "canonical":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="m12 3 2.7 5.46 6.03.88-4.36 4.25 1.03 6.01L12 16.77 6.6 19.6l1.03-6.01-4.36-4.25 6.03-.88L12 3Z" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "tick":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "population":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M6.5 18a4.5 4.5 0 0 1 9 0M9.5 9.5a2.5 2.5 0 1 0 5 0M4 17a3.5 3.5 0 0 1 2-3.16M20 17a3.5 3.5 0 0 0-2-3.16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "civilization":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M4 20h16M6 20V9l6-4 6 4v11M10 13h4M10 16h4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "animals":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M7 13c0-2.76 2.24-5 5-5s5 2.24 5 5v1a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4v-1Z" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="7" r="1.5" fill="currentColor" />
          <circle cx="16" cy="7" r="1.5" fill="currentColor" />
        </svg>
      );
    case "plants":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M12 20V9M12 13c-4 0-6-2-6-6 4 0 6 2 6 6Zm0 2c4 0 6-2 6-6-4 0-6 2-6 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "search":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "diagnostics":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M4 17h4l2-5 3 3 2-7 3 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "atlas":
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <path d="M5 6.5 12 4l7 2.5v11L12 20l-7-2.5v-11Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 4v16" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    default:
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-dawn-gold/30 hover:bg-white/[0.06]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(216,173,95,0.16),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_38%)] opacity-80 transition group-hover:opacity-100" />
      <div className="absolute -left-8 top-0 h-24 w-24 rounded-full bg-dawn-gold/10 blur-3xl transition group-hover:bg-dawn-gold/20" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-stone-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-dawn-gold">
          <DashboardGlyph className="h-5 w-5" name={icon} />
        </div>
      </div>
      <p className="relative mt-4 text-sm text-stone-300">{detail}</p>
    </article>
  );
}

function ToolbarAction({
  label,
  href,
  icon,
  disabled = false,
  subtitle,
}: {
  label: string;
  href?: string;
  icon: string;
  disabled?: boolean;
  subtitle?: string;
}) {
  const content = (
    <>
      <DashboardGlyph className="h-4 w-4" name={icon} />
      <span>{label}</span>
      {subtitle ? <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{subtitle}</span> : null}
    </>
  );

  if (disabled || !href) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.08]"
      href={href}
    >
      {content}
    </Link>
  );
}

function StatusBadge({ children, tone }: { children: string; tone?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${tone ?? "border-white/10 bg-white/5 text-stone-200"}`}>
      {children}
    </span>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-stone-100">{value}</p>
    </div>
  );
}

function LiveStatus({ label, active, detail }: { label: string; active: boolean; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" : "bg-stone-500"}`} />
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">{label}</p>
      </div>
      <p className="mt-2 text-xs text-stone-200">{detail}</p>
    </div>
  );
}

function ProgressBar({ label, value, note }: { label: string; value: number | null; note?: string }) {
  const clamped = value == null ? null : clamp(value);
  const tone = getScoreTone(clamped);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">{label}</p>
        <p className="text-xs font-semibold text-stone-200">{clamped == null ? "Untracked" : `${Math.round(clamped)}%`}</p>
      </div>
      {clamped == null ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-stone-500 to-stone-400 opacity-60" />
        </div>
      ) : (
        <progress className={`mt-3 h-2 w-full overflow-hidden rounded-full ${tone}`} max={100} value={clamped} />
      )}
      {note ? <p className="mt-2 text-xs text-stone-500">{note}</p> : null}
    </div>
  );
}

function InspectorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm text-stone-100">{value}</p>
    </div>
  );
}

function sectionState(description: string, value?: string) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/25 p-4">
      <p className="text-sm text-stone-200">{description}</p>
      {value ? <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">{value}</p> : null}
    </div>
  );
}

function formatSummaryTiming(entry: SummaryTiming | undefined): string {
  if (!entry) {
    return "Untracked";
  }

  return `${entry.executionTimeMs.toFixed(entry.executionTimeMs < 10 ? 2 : 0)} ms / ${formatNumber(entry.cellsProcessed)} cells / ${(entry.cacheHitRate * 100).toFixed(0)}% hit`;
}

function renderInspectorTab(
  world: MissionControlWorld,
  tab: InspectorTab,
  actionLogs: MissionControlActionLog[],
  tickHistory: MissionControlTickHistory[],
  productionPhrase: string,
  maxSimulationYears: number,
) {
  const worldLogs = actionLogs.filter((entry) => entry.worldSlug === world.slug).slice(0, 8);
  const worldTicks = tickHistory.filter((entry) => entry.worldSlug === world.slug).slice(0, 8);

  if (tab === "Overview") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="World Time" value={world.timeLabel} />
        <InspectorMetric label="Planet" value={world.planetName ?? "Untracked"} />
        <InspectorMetric label="Canonical Fingerprint" value={world.fingerprintShortHash ?? "Untracked"} />
        <InspectorMetric label="Epoch" value={world.eraLabel} />
        <InspectorMetric label="Generation" value={`G${world.currentGeneration}`} />
        <InspectorMetric label="Years Simulated" value={formatNumber(world.yearsSimulated)} />
        <InspectorMetric label="Current Tick" value={world.currentTick} />
        <InspectorMetric label="Environment" value={world.environment} />
        <InspectorMetric label="Protection" value={world.protected ? "Protected" : "Mutable"} />
      </div>
    );
  }

  if (tab === "Simulation") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="Running" value={world.simulation.running ? "Yes" : "No"} />
        <InspectorMetric label="Can Advance" value={world.simulation.canAdvance ? "Yes" : "No"} />
        <InspectorMetric label="Average Tick" value={formatMs(world.simulation.averageTickTimeMs)} />
        <InspectorMetric label="Last Tick Duration" value={formatMs(world.simulation.lastTickDurationMs)} />
        <InspectorMetric label="Ticks / Sec" value={formatDecimal(world.simulation.ticksPerSecond, 2)} />
        <InspectorMetric label="Failed Systems" value={formatNumber(world.simulation.failedSystems)} />
        <InspectorMetric label="Last Tick Status" value={world.health.lastTickStatus} />
        <InspectorMetric label="Last Successful Tick" value={formatIso(world.health.lastSuccessfulTickTime)} />
        <InspectorMetric label="Simulation Health" value={`${computeSimulationHealth(world)}%`} />
      </div>
    );
  }

  if (tab === "Planet") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="Planet Name" value={world.planetName ?? "Untracked"} />
        <InspectorMetric label="Land Coverage" value={formatPercent(world.planet.landPercent, 1)} />
        <InspectorMetric label="Ocean Coverage" value={formatPercent(world.planet.oceanPercent, 1)} />
        <InspectorMetric label="Habitable Land" value={formatPercent(world.planet.habitableLandPercent, 1)} />
        <InspectorMetric label="Atmosphere Stability" value={formatDecimal(world.planet.atmosphereStability, 3)} />
        <InspectorMetric label="Resource Diversity" value={formatDecimal(world.planet.resourceDiversity, 3)} />
        <InspectorMetric label="Current Year" value={`Y${world.currentYear}`} />
        <InspectorMetric label="Day Length" value={formatDecimal(world.dayLengthSeconds, 0, " s")} />
        <InspectorMetric label="Year Length" value={`${world.yearLengthDays} days`} />
      </div>
    );
  }

  if (tab === "Civilizations") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <InspectorMetric label="Civilization Count" value="0" />
        <InspectorMetric label="Settlement Count" value="Untracked" />
        <InspectorMetric label="Plant Support Score" value={formatDecimal(world.planet.civilizationSupportScore, 3)} />
        <InspectorMetric label="Food Support Score" value={formatDecimal(world.planet.foodSupportScore, 3)} />
        {sectionState("Civilization simulation remains a placeholder system in the current backend, so the dashboard exposes readiness signals but does not fabricate settlement or polity records.")}
      </div>
    );
  }

  if (tab === "Population") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="Human Population" value={formatNumber(world.health.humanPopulation)} />
        <InspectorMetric label="Adults" value={formatNumber(world.health.adultHumans)} />
        <InspectorMetric label="Children" value={formatNumber(world.health.childrenHumans)} />
        <InspectorMetric label="Male Humans" value={formatNumber(world.health.maleHumans)} />
        <InspectorMetric label="Female Humans" value={formatNumber(world.health.femaleHumans)} />
        <InspectorMetric label="Wildlife Population" value={formatCompactNumber(world.health.totalWildlifePopulation)} />
        <InspectorMetric label="Animal Species" value={formatNumber(world.health.animalSpeciesCount)} />
        <InspectorMetric label="Plant Cells" value={formatNumber(world.planet.plantedCellCount)} />
        <InspectorMetric label="Human System" value={world.health.humanSystemStatus ?? "Unavailable"} />
      </div>
    );
  }

  if (tab === "Biology") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="Biome Coverage" value={formatPercent(world.health.biomeCoveragePercent, 1)} />
        <InspectorMetric label="Plant Coverage" value={formatPercent(world.health.plantCoveragePercent, 1)} />
        <InspectorMetric label="Occupied Habitat" value={formatPercent(world.health.occupiedAnimalHabitatPercent, 1)} />
        <InspectorMetric label="Animal Health" value={formatDecimal(world.health.averageAnimalHealth, 3)} />
        <InspectorMetric label="Ecosystem Health" value={formatDecimal(world.health.averageEcosystemHealth, 3)} />
        <InspectorMetric label="Biodiversity" value={formatDecimal(world.health.averageBiodiversity, 3)} />
      </div>
    );
  }

  if (tab === "Discovery") {
    return sectionState(
      "No dedicated discovery telemetry is stored for this route today. The dashboard exposes only existing world and atlas signals.",
      "Use Atlas for spatial inspection",
    );
  }

  if (tab === "Adaptation") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="Average Fitness" value={formatDecimal(world.health.averageFitness, 3)} />
        <InspectorMetric label="Adaptation Diversity" value={formatDecimal(world.health.averageAdaptationDiversity, 3)} />
        <InspectorMetric label="Climate Adaptation" value={formatDecimal(world.health.averageClimateAdaptation, 3)} />
        <InspectorMetric label="Disease Resistance" value={formatDecimal(world.health.averageDiseaseResistance, 3)} />
        <InspectorMetric label="Reproductive Efficiency" value={formatDecimal(world.health.averageReproductiveEfficiency, 3)} />
        <InspectorMetric label="Highest Adapted Population" value={world.health.highestAdaptedPopulation ?? "Untracked"} />
        <InspectorMetric label="Lowest Fitness Population" value={world.health.lowestFitnessPopulation ?? "Untracked"} />
        <InspectorMetric label="Population Growth" value={formatDecimal(world.health.populationGrowthRate, 4)} />
      </div>
    );
  }

  if (tab === "Atlas") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Link className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.06]" href={`/worlds/map?world=${encodeURIComponent(world.id)}`}>
          <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Atlas</p>
          <p className="mt-2 text-lg font-semibold">Open Developer Atlas</p>
          <p className="mt-2 text-sm text-stone-400">Jump into planetary, climate, ecology, and world health inspection for this world.</p>
        </Link>
        <Link className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.06]" href="/worlds/grid">
          <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Grid</p>
          <p className="mt-2 text-lg font-semibold">Open Grid Debug</p>
          <p className="mt-2 text-sm text-stone-400">Inspect the shared spatial grid and deterministic world layers.</p>
        </Link>
      </div>
    );
  }

  if (tab === "Events") {
    return (
      <div className="space-y-3">
        {worldTicks.length === 0 ? (
          sectionState("No recent tick history is available for this world.")
        ) : (
          worldTicks.map((entry) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" key={entry.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Tick {entry.tick}</p>
                <StatusBadge tone={entry.success ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-red-400/30 bg-red-500/10 text-red-100"}>
                  {entry.success ? "Success" : "Failed"}
                </StatusBadge>
              </div>
              <p className="mt-2 text-xs text-stone-400">{formatIso(entry.completedAt)}</p>
              <p className="mt-2 text-sm text-stone-300">{entry.systemCount} systems, {entry.failedSystemCount} failed, {formatMs(entry.durationMs)}</p>
            </div>
          ))
        )}
      </div>
    );
  }

  if (tab === "Scheduler") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="Scheduler Status" value={world.simulation.running ? "Running" : world.simulation.canAdvance ? "Ready" : "Standby"} />
        <InspectorMetric label="Tick Duration Target" value={formatDecimal(world.tickDurationSeconds, 0, " s")} />
        <InspectorMetric label="Time Scale" value={formatDecimal(world.timeScale, 2, "x")} />
        <InspectorMetric label="Last Tick Duration" value={formatMs(world.simulation.lastTickDurationMs)} />
        <InspectorMetric label="Average Tick Duration" value={formatMs(world.simulation.averageTickTimeMs)} />
        <InspectorMetric label="Total Persisted Ticks" value={formatNumber(world.simulation.totalTicks)} />
      </div>
    );
  }

  if (tab === "Performance") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="Ticks / Sec" value={formatDecimal(world.simulation.ticksPerSecond, 2)} />
        <InspectorMetric label="Average Tick Time" value={formatMs(world.simulation.averageTickTimeMs)} />
        <InspectorMetric label="Last Tick Time" value={formatMs(world.simulation.lastTickDurationMs)} />
        <InspectorMetric label="Atmosphere Stability" value={formatDecimal(world.planet.atmosphereStability, 3)} />
        <InspectorMetric label="Average Humidity" value={formatDecimal(world.planet.averageHumidity, 3)} />
        <InspectorMetric label="Storm Potential" value={formatDecimal(world.planet.averageStormPotential, 3)} />
        <InspectorMetric label="Weather Summary" value={formatSummaryTiming(world.simulation.summaryTimings.weather)} />
        <InspectorMetric label="Resource Summary" value={formatSummaryTiming(world.simulation.summaryTimings.resources)} />
        <InspectorMetric label="Biome Summary" value={formatSummaryTiming(world.simulation.summaryTimings.biomes)} />
        <InspectorMetric label="Plant Summary" value={formatSummaryTiming(world.simulation.summaryTimings.plants)} />
      </div>
    );
  }

  if (tab === "Logs") {
    return (
      <div className="space-y-3">
        {world.health.systemHealthDiagnostics.length > 0 ? (
          <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200">Diagnostics</p>
            <div className="mt-3 space-y-2 text-sm text-stone-200">
              {world.health.systemHealthDiagnostics.map((diagnostic) => (
                <p key={diagnostic}>{diagnostic}</p>
              ))}
            </div>
          </div>
        ) : null}
        {worldLogs.length === 0 ? (
          sectionState("No recent lifecycle logs are available for this world.")
        ) : (
          worldLogs.map((entry) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" key={entry.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{entry.action}</p>
                <p className="text-xs text-stone-500">{formatIso(entry.createdAt)}</p>
              </div>
              <p className="mt-2 text-sm text-stone-300">Actor: {entry.actor}</p>
              <p className="mt-1 text-sm text-stone-400">Reason: {entry.reason ?? "-"}</p>
            </div>
          ))
        )}
      </div>
    );
  }

  if (tab === "Developer") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InspectorMetric label="Slug" value={world.slug} />
        <InspectorMetric label="Created" value={formatIso(world.createdAt)} />
        <InspectorMetric label="Updated" value={formatIso(world.updatedAt)} />
        <InspectorMetric label="Seed" value={world.seed ?? "Untracked"} />
        <InspectorMetric label="Fingerprint" value={world.fingerprintShortHash ?? "Untracked"} />
        <InspectorMetric label="Production Phrase" value={world.environment === "PRODUCTION" ? productionPhrase : "Not Required"} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sectionState("Danger-zone controls remain wired to the existing lifecycle route. Production worlds still require the original confirmation phrase.")}
      <WorldControlsClient
        isActive={world.status === "ACTIVE"}
        isArchived={world.status === "ARCHIVED"}
        isPaused={world.status === "PAUSED"}
        isProduction={world.environment === "PRODUCTION"}
        isProtected={world.protected}
        productionPhrase={productionPhrase}
        tickDurationSeconds={world.tickDurationSeconds}
        dayLengthSeconds={world.dayLengthSeconds}
        yearLengthDays={world.yearLengthDays}
        averageTickTimeMs={world.simulation.averageTickTimeMs}
        maxSimulationYears={maxSimulationYears}
        slug={world.slug}
        variant="dashboard"
      />
    </div>
  );
}

export function WorldsDashboardClient({
  worlds,
  actionLogs,
  tickHistory,
  productionPhrase,
  maxSimulationYears,
}: WorldsDashboardClientProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<FilterMode>("All");
  const [sort, setSort] = useState<SortMode>("Newest");
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(worlds[0]?.id ?? null);
  const [selectedTab, setSelectedTab] = useState<InspectorTab>("Overview");
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const totals = useMemo(() => {
    const runningWorlds = worlds.filter((world) => world.simulation.running).length;
    const activeWorlds = worlds.filter((world) => world.status === "ACTIVE").length;
    const pausedWorlds = worlds.filter((world) => world.status === "PAUSED").length;
    const archivedWorlds = worlds.filter((world) => world.status === "ARCHIVED").length;
    const canonicalWorlds = worlds.filter((world) => world.canonical).length;
    const tickRates = worlds
      .map((world) => world.simulation.ticksPerSecond)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    return {
      totalWorlds: worlds.length,
      activeWorlds,
      runningWorlds,
      pausedWorlds,
      archivedWorlds,
      canonicalWorlds,
      averageTickRate:
        tickRates.length > 0
          ? tickRates.reduce((total, value) => total + value, 0) / tickRates.length
          : 0,
      totalPopulation: worlds.reduce((total, world) => total + (world.health.humanPopulation ?? 0), 0),
      totalCivilizations: 0,
      totalAnimals: worlds.reduce((total, world) => total + (world.health.totalWildlifePopulation ?? 0), 0),
      totalPlants: worlds.reduce((total, world) => total + (world.planet.plantedCellCount ?? 0), 0),
    };
  }, [worlds]);

  const filteredWorlds = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const matchesFilter = (world: MissionControlWorld) => {
      if (filter === "All") {
        return true;
      }

      if (filter === "Running") {
        return world.simulation.running;
      }

      if (filter === "Paused") {
        return world.status === "PAUSED";
      }

      if (filter === "Archived") {
        return world.status === "ARCHIVED";
      }

      if (filter === "Canonical") {
        return world.canonical;
      }

      if (filter === "Production") {
        return world.environment === "PRODUCTION";
      }

      return world.environment !== "PRODUCTION";
    };

    const matchesQuery = (world: MissionControlWorld) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        world.name,
        world.slug,
        world.description ?? "",
        world.environment,
        world.status,
        world.seed ?? "",
        world.planetName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    };

    const nextWorlds = worlds.filter((world) => matchesFilter(world) && matchesQuery(world));

    nextWorlds.sort((left, right) => {
      if (sort === "Newest") {
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      }

      if (sort === "Oldest") {
        return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      }

      if (sort === "Highest Population") {
        return (right.health.humanPopulation ?? 0) - (left.health.humanPopulation ?? 0);
      }

      if (sort === "Most Recent Tick") {
        const leftTick = toTickValue(left.currentTick);
        const rightTick = toTickValue(right.currentTick);

        return rightTick > leftTick ? 1 : rightTick < leftTick ? -1 : 0;
      }

      return left.name.localeCompare(right.name);
    });

    return nextWorlds;
  }, [deferredQuery, filter, sort, worlds]);

  const selectedWorld = useMemo(
    () => worlds.find((world) => world.id === selectedWorldId) ?? filteredWorlds[0] ?? worlds[0] ?? null,
    [filteredWorlds, selectedWorldId, worlds],
  );

  const openInspector = (worldId: string, tab: InspectorTab) => {
    setSelectedWorldId(worldId);
    setSelectedTab(tab);
    setInspectorOpen(true);
  };

  return (
    <section className="relative mt-8 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(10,12,16,0.98),rgba(11,14,20,0.92))] p-5 shadow-[0_35px_120px_rgba(0,0,0,0.4)] sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:40px_40px] opacity-70" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(216,173,95,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-dawn-gold">Mission Control Dashboard</p>
            <h2 className="mt-3 font-display text-3xl text-white sm:text-4xl">Living Worlds Command Surface</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-300">
              Observe deterministic planet simulations, track world health, and operate lifecycle controls from a single control room without changing the existing backend contracts.
            </p>
          </div>
          <div className="grid gap-2 text-right text-xs text-stone-400 sm:grid-cols-2 lg:text-left">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="uppercase tracking-[0.2em] text-stone-500">Visible Worlds</p>
              <p className="mt-2 text-lg font-semibold text-white">{filteredWorlds.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="uppercase tracking-[0.2em] text-stone-500">Live Simulations</p>
              <p className="mt-2 text-lg font-semibold text-white">{totals.runningWorlds}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard detail={`${metricDelta(totals.totalWorlds, totals.archivedWorlds)} vs archived inventory`} icon="worlds" label="Total Worlds" value={String(totals.totalWorlds)} />
          <MetricCard detail={`${totals.runningWorlds} running now`} icon="active" label="Active Worlds" value={String(totals.activeWorlds)} />
          <MetricCard detail={`${totals.pausedWorlds} awaiting input`} icon="running" label="Running Worlds" value={String(totals.runningWorlds)} />
          <MetricCard detail={`${totals.activeWorlds - totals.runningWorlds} active but idle`} icon="paused" label="Paused Worlds" value={String(totals.pausedWorlds)} />
          <MetricCard detail="retained for record and comparison" icon="archived" label="Archived Worlds" value={String(totals.archivedWorlds)} />
          <MetricCard detail="seed-aligned with canonical fingerprint" icon="canonical" label="Canonical Worlds" value={String(totals.canonicalWorlds)} />
          <MetricCard detail="average scheduler throughput" icon="tick" label="Average Tick Rate" value={`${totals.averageTickRate.toFixed(2)}/s`} />
          <MetricCard detail="human MVA populations only" icon="population" label="Total Population" value={formatCompactNumber(totals.totalPopulation)} />
          <MetricCard detail="placeholder system, no generated records yet" icon="civilization" label="Total Civilizations" value={String(totals.totalCivilizations)} />
          <MetricCard detail="wildlife counts across populated habitats" icon="animals" label="Total Animals" value={formatCompactNumber(totals.totalAnimals)} />
          <MetricCard detail="deterministically planted cells" icon="plants" label="Total Plants" value={formatCompactNumber(totals.totalPlants)} />
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-black/25 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex-1">
              <label className="relative block">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500">
                  <DashboardGlyph className="h-4 w-4" name="search" />
                </span>
                <input
                  className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-dawn-gold/30 focus:bg-white/[0.06]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search worlds..."
                  value={query}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((entry) => (
                <button
                  className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${filter === entry ? "border-dawn-gold/40 bg-dawn-gold/10 text-dawn-amber" : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/20 hover:bg-white/[0.05]"}`}
                  key={entry}
                  onClick={() => setFilter(entry)}
                  type="button"
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <label className="text-[11px] uppercase tracking-[0.22em] text-stone-500">Sort</label>
              <select
                aria-label="Sort worlds"
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-stone-100 outline-none transition focus:border-dawn-gold/30"
                onChange={(event) => setSort(event.target.value as SortMode)}
                title="Sort worlds"
                value={sort}
              >
                {SORTS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolbarAction disabled icon="worlds" label="Create World" subtitle="Unavailable" />
              <ToolbarAction disabled icon="atlas" label="Import" subtitle="Unavailable" />
              <ToolbarAction disabled icon="atlas" label="Export" subtitle="Unavailable" />
              <ToolbarAction disabled icon="canonical" label="Clone Canonical" subtitle="Unavailable" />
              <ToolbarAction href="#simulation-heartbeat" icon="diagnostics" label="Run Diagnostics" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredWorlds.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300 xl:col-span-2 2xl:col-span-3">
              No worlds match the current mission filter.
            </div>
          ) : (
            filteredWorlds.map((world) => {
              const simulationHealth = computeSimulationHealth(world);
              const planetStability = computePlanetStability(world);
              const climateStability = computeClimateStability(world);
              const schedulerHealth = computeSchedulerHealth(world);
              const overallHealth = computeOverallHealth(world);

              return (
                <article className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-dawn-gold/25 hover:shadow-[0_40px_120px_rgba(0,0,0,0.45)]" key={world.id}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(216,173,95,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_30%)] opacity-70" />
                  <div className="absolute -top-12 right-0 h-36 w-36 rounded-full bg-dawn-gold/10 blur-3xl transition group-hover:bg-dawn-gold/20" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">World Surface</p>
                          <StatusBadge tone={getStatusTone(world)}>{world.simulation.running ? "Running" : world.status}</StatusBadge>
                        </div>
                        <h3 className="mt-3 font-display text-3xl text-white">{world.name}</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">{world.description ?? "No operator description recorded for this world."}</p>
                      </div>
                      <button
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.08]"
                        onClick={() => openInspector(world.id, "Overview")}
                        type="button"
                      >
                        Inspect
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge>{world.environment}</StatusBadge>
                      <StatusBadge>{world.environment === "PRODUCTION" ? "Production" : "Development"}</StatusBadge>
                      {world.canonical ? <StatusBadge tone="border-dawn-gold/40 bg-dawn-gold/10 text-dawn-amber">Canonical</StatusBadge> : null}
                      {world.protected ? <StatusBadge tone="border-sky-300/30 bg-sky-300/10 text-sky-100">Protected</StatusBadge> : null}
                      {world.status === "ARCHIVED" ? <StatusBadge tone="border-stone-400/20 bg-stone-500/10 text-stone-300">Archived</StatusBadge> : null}
                      {world.status === "PAUSED" ? <StatusBadge tone="border-amber-300/30 bg-amber-300/10 text-amber-100">Paused</StatusBadge> : null}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <DetailPill label="Seed" value={world.seed ?? "Untracked"} />
                      <DetailPill label="Environment" value={world.environment} />
                      <DetailPill label="Version" value={`Gen ${world.currentGeneration}`} />
                      <DetailPill label="Current Tick" value={world.currentTick} />
                      <DetailPill label="Years Simulated" value={formatNumber(world.yearsSimulated)} />
                      <DetailPill label="Population" value={formatCompactNumber(world.health.humanPopulation)} />
                      <DetailPill label="Animals" value={formatCompactNumber(world.health.totalWildlifePopulation)} />
                      <DetailPill label="Plants" value={formatNumber(world.planet.plantedCellCount)} />
                      <DetailPill label="Settlements" value="Untracked" />
                      <DetailPill label="Civilizations" value="0" />
                      <DetailPill label="Current Era" value={world.eraLabel} />
                      <DetailPill label="Planet Age" value={`Y${world.currentYear}`} />
                      <DetailPill label="Scheduler Status" value={world.simulation.running ? "Running" : world.simulation.canAdvance ? "Ready" : "Standby"} />
                      <DetailPill label="Weather Status" value={world.health.weatherSnapshotAvailable ? "Snapshot Available" : "Pending"} />
                      <DetailPill label="Simulation Status" value={world.health.lastTickStatus} />
                      <DetailPill label="Memory Status" value="Untracked" />
                      <DetailPill label="Database Status" value="Connected" />
                    </div>

                    <div className="mt-5 rounded-[24px] border border-white/10 bg-black/25 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Live Simulation Status</p>
                          <p className="mt-2 text-sm text-stone-300">Execution timing is sourced only from existing scheduler metrics.</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-stone-200">
                          Avg {formatMs(world.simulation.averageTickTimeMs)}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <LiveStatus active={world.simulation.running || world.simulation.canAdvance} detail={world.simulation.running ? "Tick loop active" : "Ready for manual advance"} label="Scheduler" />
                        <LiveStatus active={world.health.weatherSnapshotAvailable} detail={world.health.weatherSnapshotAvailable ? "Weather snapshot persisted" : "No recent weather payload"} label="Weather" />
                        <LiveStatus active={(world.health.animalSpeciesCount ?? 0) > 0 || (world.planet.plantedCellCount ?? 0) > 0} detail={`Plants ${formatNumber(world.planet.plantedCellCount)} • Species ${formatNumber(world.health.animalSpeciesCount)}`} label="Biology" />
                        <LiveStatus active={(world.health.humanPopulation ?? 0) > 0} detail={`Population ${formatNumber(world.health.humanPopulation)}`} label="Population" />
                        <LiveStatus active={Boolean(world.health.latestHumanAction || world.health.latestHumanCausalEvent)} detail={world.health.latestHumanAction ?? world.health.latestHumanCausalEvent ?? "No discovery telemetry"} label="Discovery" />
                        <LiveStatus active={world.health.averageFitness != null} detail={`Fitness ${formatDecimal(world.health.averageFitness, 3)}`} label="Adaptation" />
                        <LiveStatus active={world.planet.atmosphereStability != null} detail={`Atmosphere ${formatDecimal(world.planet.atmosphereStability, 3)}`} label="Physics" />
                        <LiveStatus active={world.canonical} detail={world.fingerprintShortHash ?? "No fingerprint"} label="Canonical" />
                      </div>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-white/10 bg-black/25 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Health Envelope</p>
                          <p className="mt-2 text-sm text-stone-300">Dashboard bars are derived from existing health and scheduler data only.</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white">
                          Overall {overallHealth}%
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <ProgressBar label="Simulation Health" value={simulationHealth} />
                        <ProgressBar label="Planet Stability" value={planetStability} />
                        <ProgressBar label="Climate Stability" value={climateStability} />
                        <ProgressBar label="Scheduler Health" value={schedulerHealth} />
                        <ProgressBar label="Memory Usage" note="No memory telemetry is stored for this page today." value={null} />
                        <ProgressBar label="Overall Health Score" value={overallHealth} />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.08]" onClick={() => openInspector(world.id, "Overview")} type="button">
                        Inspect
                      </button>
                      <Link className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.08]" href={`/worlds/map?world=${encodeURIComponent(world.id)}`}>
                        Atlas
                      </Link>
                      <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.08]" onClick={() => openInspector(world.id, "Logs")} type="button">
                        Logs
                      </button>
                    </div>

                    <div className="mt-5">
                      <WorldControlsClient
                        isActive={world.status === "ACTIVE"}
                        isArchived={world.status === "ARCHIVED"}
                        isPaused={world.status === "PAUSED"}
                        isProduction={world.environment === "PRODUCTION"}
                        isProtected={world.protected}
                        productionPhrase={productionPhrase}
                        tickDurationSeconds={world.tickDurationSeconds}
                        dayLengthSeconds={world.dayLengthSeconds}
                        yearLengthDays={world.yearLengthDays}
                        averageTickTimeMs={world.simulation.averageTickTimeMs}
                        maxSimulationYears={maxSimulationYears}
                        slug={world.slug}
                        variant="dashboard"
                      />
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {inspectorOpen && selectedWorld ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <button aria-label="Close inspector" className="flex-1 cursor-default" onClick={() => setInspectorOpen(false)} type="button" />
          <aside className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,#090b10,#0d1017)] p-5 shadow-[-24px_0_80px_rgba(0,0,0,0.4)] sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">World Inspector</p>
                <h3 className="mt-2 font-display text-3xl text-white">{selectedWorld.name}</h3>
                <p className="mt-2 text-sm text-stone-400">{selectedWorld.timeLabel}</p>
              </div>
              <button className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.08]" onClick={() => setInspectorOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {INSPECTOR_TABS.map((tab) => (
                <button
                  className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${selectedTab === tab ? "border-dawn-gold/40 bg-dawn-gold/10 text-dawn-amber" : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/20 hover:bg-white/[0.05]"}`}
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {renderInspectorTab(selectedWorld, selectedTab, actionLogs, tickHistory, productionPhrase, maxSimulationYears)}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}