import { cache } from "react";
import Link from "next/link";

import {
  buildTimedAtlasSnapshot,
  normalizeAtlasSelectedDay,
  toAtlasWorldOption,
} from "../../../lib/worlds/map-atlas";
import { createHrTimer } from "../../../lib/utils/timing";
import { listWorlds } from "../../../lib/worlds/world-lifecycle";
import { WorldMapAtlasClient } from "./world-map-atlas-client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type WorldsMapPageProps = {
  searchParams?: Promise<SearchParams>;
};

const loadAtlasWorlds = cache(async () => listWorlds({ includeArchived: true }));

function wantsTestWorlds(params: SearchParams): boolean {
  return readSearchParam(params, "includeTestWorlds") === "1" || readSearchParam(params, "includeArchived") === "1";
}

function isDefaultAtlasWorld(world: Awaited<ReturnType<typeof listWorlds>>[number]): boolean {
  return world.status !== "ARCHIVED" && !world.slug.startsWith("test-world-");
}
function readSearchParam(params: SearchParams, key: string): string | null {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parseDay(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function WorldsMapPage({ searchParams }: WorldsMapPageProps) {
  const timer = createHrTimer();
  const params = await searchParams ?? {};
  const includeTestWorlds = wantsTestWorlds(params);
  const allWorlds = await timer.time("db:worlds", loadAtlasWorlds);
  const requestedWorld = readSearchParam(params, "world");
  const selectedFromAllWorlds = requestedWorld
    ? allWorlds.find((world) => world.id === requestedWorld || world.slug === requestedWorld) ?? null
    : null;
  const defaultWorlds = includeTestWorlds ? allWorlds : allWorlds.filter(isDefaultAtlasWorld);
  const worlds = selectedFromAllWorlds && !defaultWorlds.some((world) => world.id === selectedFromAllWorlds.id)
    ? [selectedFromAllWorlds, ...defaultWorlds]
    : defaultWorlds;
  timer.record("atlas:worlds:default-skipped", allWorlds.length - worlds.length);
  if (worlds.length === 0) {
    return (
      <main className="min-h-screen bg-[#060708] px-6 py-16 text-stone-100">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(217,163,84,0.16),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.01))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">Developer Atlas</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl text-stone-50">Planet Visualization Engine</h1>
          <p className="mt-4 max-w-2xl text-base text-stone-300">
            No worlds are available yet. Create or seed a world first, then return here to inspect every simulation layer on the atlas.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/worlds"
              className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-300/15"
            >
              Back to Worlds
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const selectedWorld = selectedFromAllWorlds ?? worlds[0];
  const selectedDay = normalizeAtlasSelectedDay(selectedWorld, parseDay(readSearchParam(params, "day")));
  const timedSnapshot = await timer.time(`atlas:snapshot:selected:${selectedWorld.slug}`, async () =>
    buildTimedAtlasSnapshot(selectedWorld, selectedDay),
  );
  timer.record(`atlas:snapshot:${timedSnapshot.timing.cacheHit ? "cache-hit" : "cache-miss"}`, timedSnapshot.timing.executionTimeMs);
  timer.logDevBreakdown("/worlds/map timing");
  return (
    <WorldMapAtlasClient
      worlds={worlds.map(toAtlasWorldOption)}
      initialSnapshot={timedSnapshot.value}
    />
  );
}
