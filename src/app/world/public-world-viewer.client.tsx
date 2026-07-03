"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { AtlasCell, AtlasSnapshot } from "../../lib/worlds/map-atlas";
import {
  PlanetGlobeRenderer,
  type PlanetGlobeLayerId,
  type PlanetGlobeLayerSetting,
} from "../worlds/map/planet-globe-renderer";

type PublicWorldViewerProps = {
  snapshot: AtlasSnapshot;
};

type PublicWorldEvent = {
  id: string;
  tick: string;
  category: string;
  title: string;
  summary: string;
  cellId: string | null;
  humanId: string | null;
  settlementId: string | null;
};

const PUBLIC_GLOBE_LAYERS: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting> = {
  terrain: { visible: true, opacity: 1 },
  ocean: { visible: true, opacity: 1 },
  lighting: { visible: true, opacity: 0.76 },
  biomes: { visible: true, opacity: 0.18 },
  vegetation: { visible: true, opacity: 0.22 },
  snow: { visible: true, opacity: 0.18 },
  clouds: { visible: true, opacity: 0.12 },
  atmosphere: { visible: true, opacity: 0.3 },
  weather: { visible: true, opacity: 0.18 },
  temperature: { visible: false, opacity: 0 },
  resources: { visible: false, opacity: 0 },
  animals: { visible: false, opacity: 0 },
  humans: { visible: true, opacity: 0.72 },
  movement: { visible: false, opacity: 0 },
  knowledge: { visible: false, opacity: 0 },
  communication: { visible: false, opacity: 0 },
  families: { visible: false, opacity: 0 },
  settlements: { visible: true, opacity: 0.72 },
  trade: { visible: false, opacity: 0 },
  debug: { visible: false, opacity: 0 },
};

function tickNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleize(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number, digits = 0): string {
  return `${formatNumber(value, digits)}%`;
}

function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

function getPublicWorldName(snapshot: AtlasSnapshot): string {
  const name = snapshot.worldName.trim();

  if (!name || /sandbox|test-world|debug|atlas/i.test(name)) {
    return "First Dawn World";
  }

  return name;
}

function getCurrentYear(snapshot: AtlasSnapshot): number {
  return Math.floor((snapshot.selectedDay - 1) / snapshot.yearLengthDays);
}

function getDayOfYear(snapshot: AtlasSnapshot): number {
  return ((snapshot.selectedDay - 1) % snapshot.yearLengthDays) + 1;
}

function getLiveTick(snapshot: AtlasSnapshot, events: readonly PublicWorldEvent[]): string {
  const eventTick = events
    .map((event) => tickNumber(event.tick))
    .filter((tick) => tick > 0)
    .sort((left, right) => right - left)[0];

  if (eventTick) {
    return eventTick.toString();
  }

  const humanTick = tickNumber(snapshot.humans.tick);

  if (humanTick > 0) {
    return humanTick.toString();
  }

  return snapshot.tick;
}

function getSimulationDayFromTick(tick: string): number {
  const parsed = tickNumber(tick);
  return Math.max(1, Math.floor(parsed / 24) + 1);
}

function getSimulationYearFromDay(day: number, yearLengthDays: number): number {
  return Math.floor((day - 1) / Math.max(1, yearLengthDays));
}

function getSimulationDayOfYear(day: number, yearLengthDays: number): number {
  return ((day - 1) % Math.max(1, yearLengthDays)) + 1;
}

function publicCategory(value: string | null | undefined): string {
  const normalized = (value ?? "").toLowerCase();

  if (normalized.includes("birth") || normalized.includes("child")) return "Family Signal";
  if (normalized.includes("knowledge") || normalized.includes("learn") || normalized.includes("teach")) return "Knowledge Signal";
  if (normalized.includes("settlement") || normalized.includes("founded")) return "Settlement Signal";
  if (normalized.includes("memory") || normalized.includes("chronicler")) return "Memory Signal";
  if (normalized.includes("death") || normalized.includes("grief")) return "Life Signal";
  if (normalized.includes("family") || normalized.includes("lineage")) return "Family Signal";
  if (normalized.includes("weather") || normalized.includes("storm")) return "Planet Signal";

  return "World Signal";
}

function publicEventTitle(title: string, type?: string | null): string {
  const normalized = `${title} ${type ?? ""}`.toLowerCase();

  if (normalized.includes("survival knowledge") || normalized.includes("knowledge")) return "Knowledge Passed On";
  if (normalized.includes("birth") || normalized.includes("child")) return "A New Generation Begins";
  if (normalized.includes("settlement") || normalized.includes("founded")) return "An Early Settlement Takes Shape";
  if (normalized.includes("family") || normalized.includes("lineage")) return "Family Memory Deepens";
  if (normalized.includes("death") || normalized.includes("grief")) return "A Life Enters Memory";
  if (normalized.includes("weather") || normalized.includes("storm")) return "Planetary Weather Shifts";

  return cleanPublicText(title) || "World Signal Recorded";
}

function publicEventSummary(summary: string, title: string, type?: string | null): string {
  const source = `${summary} ${title} ${type ?? ""}`;
  const normalized = source.toLowerCase();

  if (normalized.includes("survival knowledge") && (normalized.includes("guardian") || normalized.includes("inherited"))) {
    return "Human children are beginning to inherit survival knowledge from their guardians.";
  }

  if (normalized.includes("child") && normalized.includes("knowledge")) {
    return "The first family has passed early survival knowledge to the next generation.";
  }

  if (normalized.includes("settlement") && (normalized.includes("founded") || normalized.includes("formed"))) {
    return "An early settlement has begun to take shape on the living world.";
  }

  if (normalized.includes("birth") || normalized.includes("new child")) {
    return "A new generation has entered the first family.";
  }

  const cleaned = cleanPublicText(summary || title);
  return cleaned || "A quiet world signal was recorded.";
}

function cleanPublicText(value: string): string {
  return value
    .replace(/\b(?:child|human|agent|family|lineage|settlement|event):[a-z0-9:_-]+\b/gi, "a living person")
    .replace(/\bfirst-humans?:\d+\b/gi, "the first family")
    .replace(/\bcell-\d{2}-\d{2}\b/gi, "an observed region")
    .replace(/\b[a-z]+:[a-z0-9:_-]+\b/gi, "a living signal")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPublicEvents(snapshot: AtlasSnapshot): PublicWorldEvent[] {
  const events: PublicWorldEvent[] = [];

  for (const entry of snapshot.humans.chroniclerEntries) {
    const matchingEvent = snapshot.humans.causalEvents.find((event) => event.id === entry.eventId);
    events.push({
      id: entry.eventId,
      tick: entry.tick,
      category: publicCategory(matchingEvent?.type ?? "World Story"),
      title: publicEventTitle(entry.title, matchingEvent?.type),
      summary: publicEventSummary(entry.summary || entry.causalSummary, entry.title, matchingEvent?.type),
      cellId: matchingEvent?.cellId ?? null,
      humanId: matchingEvent?.agentIds[0] ?? null,
      settlementId: null,
    });
  }

  for (const event of snapshot.humans.causalEvents) {
    if (events.some((entry) => entry.id === event.id)) {
      continue;
    }

    events.push({
      id: event.id,
      tick: event.tick,
      category: publicCategory(event.type),
      title: publicEventTitle(event.title, event.type),
      summary: publicEventSummary(event.summary, event.title, event.type),
      cellId: event.cellId,
      humanId: event.agentIds[0] ?? null,
      settlementId: null,
    });
  }

  for (const event of snapshot.settlements.recentEvents) {
    events.push({
      id: event.id,
      tick: event.tick,
      category: "Settlement Signal",
      title: publicEventTitle(event.title, event.kind),
      summary: publicEventSummary(event.summary, event.title, event.kind),
      cellId: event.cellId,
      humanId: null,
      settlementId: event.settlementId,
    });
  }

  for (const event of snapshot.families.events.slice(-10)) {
    events.push({
      id: event.id,
      tick: event.tick,
      category: publicCategory(event.kind),
      title: publicEventTitle(event.title, event.kind),
      summary: publicEventSummary(event.summary, event.title, event.kind),
      cellId: event.cellId,
      humanId: event.humanIds[0] ?? null,
      settlementId: event.settlementId,
    });
  }

  return events.sort((left, right) => tickNumber(right.tick) - tickNumber(left.tick) || left.title.localeCompare(right.title));
}

function getLivingWorldStatus(snapshot: AtlasSnapshot, events: readonly PublicWorldEvent[]): string {
  if (snapshot.humans.agents.length === 0 && snapshot.settlements.activeCount === 0) {
    return "The planet is still quiet.";
  }

  if (snapshot.settlements.activeCount === 0) {
    return "The first histories are still forming.";
  }

  if (events.length === 0) {
    return "No major transmission has been recorded.";
  }

  return "A living population is producing memory, movement, and history.";
}

function getLatestStory(events: readonly PublicWorldEvent[]): string {
  const story = events.find((event) => event.summary.trim().length > 0);

  return story?.summary ?? "No major transmission has been recorded.";
}

function getSeason(snapshot: AtlasSnapshot): string {
  const north = titleize(snapshot.climate.seasonNorthernHemisphere);
  const south = titleize(snapshot.climate.seasonSouthernHemisphere);
  return north === south ? north : `${north} north / ${south} south`;
}

function getPlantedCellPercent(snapshot: AtlasSnapshot): number | null {
  if (!snapshot.plantSummary) {
    return null;
  }

  return snapshot.plantSummary.plantedCellCount / Math.max(1, snapshot.plantSummary.cellCount);
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="mt-3 font-display text-3xl leading-none text-white">{value}</p>
      <p className="mt-3 text-sm leading-6 text-stone-400">{detail}</p>
    </article>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="text-right text-sm text-stone-100">{value}</p>
    </div>
  );
}

function EmptySignalState() {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-5">
      <p className="font-display text-2xl text-white">The first histories are still forming.</p>
      <p className="mt-3 text-sm leading-6 text-stone-400">No major transmission has been recorded.</p>
    </div>
  );
}

export function PublicWorldViewer({ snapshot }: PublicWorldViewerProps) {
  const [globeZoom, setGlobeZoom] = useState(1);
  const events = useMemo(() => buildPublicEvents(snapshot), [snapshot]);
  const latestStory = getLatestStory(events);
  const noOpCellFocus = useCallback((_cell: AtlasCell) => {}, []);
  const seasonalDay = getDayOfYear(snapshot);
  const seasonalYear = getCurrentYear(snapshot);
  const liveTick = getLiveTick(snapshot, events);
  const simulationDay = getSimulationDayFromTick(liveTick);
  const simulationYear = getSimulationYearFromDay(simulationDay, snapshot.yearLengthDays);
  const simulationDayOfYear = getSimulationDayOfYear(simulationDay, snapshot.yearLengthDays);
  const activeHumans = snapshot.humans.agents.length;
  const activeSettlements = snapshot.settlements.activeCount;
  const recentSignals = events.slice(0, 5);
  const plantedCellPercent = getPlantedCellPercent(snapshot);
  const publicWorldName = getPublicWorldName(snapshot);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050608] text-stone-100">
      <section className="relative border-b border-white/10 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link className="w-fit text-sm uppercase tracking-[0.24em] text-dawn-gold transition hover:text-white" href="/">
            First Dawn
          </Link>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-stone-400">
            <span className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">Public Broadcast</span>
            <span className="rounded border border-dawn-gold/30 bg-dawn-gold/10 px-3 py-2 text-dawn-amber">Read Only</span>
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(216,173,95,0.14),transparent_38%),linear-gradient(180deg,#08090b_0%,#050608_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1.28fr_0.72fr] lg:items-start lg:py-14">
          <div className="space-y-4">
            <div className="relative min-h-[560px] overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_28px_100px_rgba(0,0,0,0.48)] sm:min-h-[660px]">
              <PlanetGlobeRenderer
                chronicleMode
                events={[]}
                layers={PUBLIC_GLOBE_LAYERS}
                onCellFocus={noOpCellFocus}
                onZoomChange={setGlobeZoom}
                selectedCellId={null}
                selectedHumanId={null}
                snapshot={snapshot}
              />
              <div className="pointer-events-none absolute left-5 top-5 max-w-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-dawn-gold">Living Planet</p>
                <h1 className="mt-3 font-display text-5xl leading-none text-white sm:text-7xl">{publicWorldName}</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
                  A documentary view of the current active world, rendered as a quiet public observatory broadcast.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile detail={`Day ${simulationDayOfYear} of ${snapshot.yearLengthDays}`} label="World Date" value={`Year ${simulationYear}`} />
              <MetricTile detail={`${getSeason(snapshot)} · seasonal frame Year ${seasonalYear}, Day ${seasonalDay}`} label="Current Tick" value={`Tick ${liveTick}`} />
              <MetricTile detail={`Signal depth ${globeZoom.toFixed(2)}x`} label="Status" value="Live View" />
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-dawn-gold">World Signal</p>
              <h2 className="mt-3 font-display text-4xl text-white">{publicWorldName}</h2>
              <div className="mt-5">
                <StatusRow label="Seed" value={snapshot.fingerprint.seed || "Unrecorded"} />
                <StatusRow label="Fingerprint" value={snapshot.fingerprint.shortHash} />
                <StatusRow label="Active Humans" value={activeHumans > 0 ? formatCount(activeHumans, "living human") : "The planet is still quiet."} />
                <StatusRow label="Settlements" value={activeSettlements > 0 ? formatCount(activeSettlements, "early settlement") : "No settlements have emerged yet."} />
                <StatusRow label="Regions" value={formatCount(snapshot.grid.totalCells, "observed region")} />
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#0b0d10] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-dawn-gold">Latest Transmission</p>
              <p className="mt-4 font-display text-2xl leading-8 text-white">{latestStory}</p>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-dawn-gold">Planetary Vital Signs</p>
              <p className="mt-4 text-base leading-7 text-stone-200">{getLivingWorldStatus(snapshot, events)}</p>
              <div className="mt-5 grid gap-3">
                <MetricTile
                  detail={plantedCellPercent != null ? `${formatPercent(plantedCellPercent * 100, 1)} of regions seeded` : "Plant ecology is still initializing."}
                  label="Plants"
                  value={snapshot.plantSummary ? formatCount(snapshot.plantSummary.plantedCellCount, "planted region") : "Forming"}
                />
                <MetricTile
                  detail={snapshot.animalSummary ? `${formatNumber(snapshot.animalSummary.totalWildlifePopulation)} animals observed` : "Animal records have not emerged yet."}
                  label="Animals"
                  value={snapshot.animalSummary ? formatCount(snapshot.animalSummary.animalSpeciesCount, "wild species", "wild species") : "Forming"}
                />
              </div>
            </section>
          </aside>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#08090b] px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">Recent Signals</p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">History as it appears.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-stone-300">
              Public transmissions summarize what the world is beginning to remember. The internal controls remain in the Atlas.
            </p>
          </div>

          <div className="grid gap-3">
            {recentSignals.length > 0 ? (
              recentSignals.map((event) => (
                <article className="rounded-lg border border-white/10 bg-black/25 p-5" key={`${event.id}-${event.tick}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-dawn-gold">{event.category}</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{event.title}</h3>
                    </div>
                    <p className="font-mono text-xs text-stone-500">Tick {event.tick} / Simulation Day {getSimulationDayFromTick(event.tick)}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-300">{event.summary}</p>
                </article>
              ))
            ) : (
              <EmptySignalState />
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#050608] px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">World Broadcast</p>
            <h2 className="mt-3 font-display text-4xl text-white">The planet is observable, not editable.</h2>
          </div>
          <Link
            className="w-fit rounded border border-dawn-gold/50 bg-dawn-gold/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-dawn-amber shadow-ember transition hover:border-dawn-gold hover:bg-dawn-gold/20 hover:text-white"
            href="/"
          >
            Back to First Dawn
          </Link>
        </div>
      </section>
    </main>
  );
}
