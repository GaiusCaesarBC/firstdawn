import { cache } from "react";
import Link from "next/link";

import { getLatestPersistedLightweightAtlasSnapshot } from "../../../lib/simulation/persisted-lightweight-atlas";
import { createHrTimer } from "../../../lib/utils/timing";
import { toAtlasWorldOption } from "../../../lib/worlds/map-atlas";
import {
  listAtlasWorldOptions,
} from "../../../lib/worlds/world-lifecycle";
import { PublicWorldViewerClient } from "./public-world-viewer-client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type WorldsMapPageProps = {
  searchParams?: Promise<SearchParams>;
};

const loadAtlasWorlds = cache(async () =>
  listAtlasWorldOptions({ includeArchived: true })
);

function wantsTestWorlds(params: SearchParams): boolean {
  return readSearchParam(params, "includeTestWorlds") === "1" || readSearchParam(params, "includeArchived") === "1";
}

function isDefaultAtlasWorld(
  world: Awaited<ReturnType<typeof listAtlasWorldOptions>>[number],
): boolean {
  return world.status !== "ARCHIVED" && !world.slug.startsWith("test-world-");
}

function readSearchParam(params: SearchParams, key: string): string | null {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function EmptyAtlasState({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#060708] px-6 py-16 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(217,163,84,0.16),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.01))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">Developer Atlas</p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl text-stone-50">Planet Visualization Engine</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-300">{message}</p>
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

export default async function WorldsMapPage({ searchParams }: WorldsMapPageProps) {
  const timer = createHrTimer();
  const params = (await searchParams) ?? {};
  const includeTestWorlds = wantsTestWorlds(params);

  const allWorlds = await timer.time("db:worlds", loadAtlasWorlds);
  const defaultWorlds = includeTestWorlds ? allWorlds : allWorlds.filter(isDefaultAtlasWorld);
  const worlds = defaultWorlds;

  const requestedWorld = readSearchParam(params, "world");
  const selectedFromVisibleWorlds = requestedWorld
    ? worlds.find((world) => world.id === requestedWorld || world.slug === requestedWorld) ?? null
    : null;

  const defaultSelectedWorld = worlds[0] ?? allWorlds[0];
  timer.record("atlas:worlds:visible", worlds.length);
  timer.record("atlas:snapshot:default-skipped", Math.max(0, allWorlds.length - 1));

  if (worlds.length === 0) {
    return <EmptyAtlasState message="No worlds are available yet. Create or seed a world first, then return here to inspect persisted worker snapshots." />;
  }

  const selectedWorld = selectedFromVisibleWorlds ?? defaultSelectedWorld;
  const persistedSnapshot = await timer.time(`atlas:persisted-snapshot:selected:${selectedWorld.slug}`, async () =>
    getLatestPersistedLightweightAtlasSnapshot(selectedWorld.id),
  );

  timer.logDevBreakdown("/worlds/map timing");

  if (!persistedSnapshot) {
    return <EmptyAtlasState message="No persisted Atlas snapshot exists yet. Start the simulation worker with npm run sim:worker, or create one deterministic snapshot with npm run sim:step." />;
  }

  return (
    <PublicWorldViewerClient
      worlds={worlds.map(toAtlasWorldOption)}
      selectedWorld={toAtlasWorldOption(selectedWorld)}
      initialSnapshot={persistedSnapshot.snapshot}
    />
  );
}


