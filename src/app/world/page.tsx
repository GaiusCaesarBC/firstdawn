import { cache } from "react";
import Link from "next/link";

import {
  buildTimedAtlasSnapshot,
  normalizeAtlasSelectedDay,
  type AtlasSnapshot,
} from "../../lib/worlds/map-atlas";
import { listAtlasWorldOptions, type WorldWithPlanet } from "../../lib/worlds/world-lifecycle";
import { PublicWorldViewer } from "./public-world-viewer.client";

export const dynamic = "force-dynamic";

const loadPublicWorlds = cache(async () =>
  listAtlasWorldOptions({ includeArchived: false, excludeTestWorlds: true })
);

type PublicWorldLoadResult =
  | { snapshot: AtlasSnapshot; message?: never }
  | { snapshot?: never; message?: string };

function choosePublicWorld(worlds: WorldWithPlanet[]): WorldWithPlanet | null {
  return (
    worlds.find((world) => world.status === "ACTIVE" && world.environment === "SANDBOX") ??
    worlds.find((world) => world.status === "ACTIVE") ??
    worlds.find((world) => world.environment === "SANDBOX") ??
    worlds[0] ??
    null
  );
}

async function loadPublicWorldSnapshot(): Promise<PublicWorldLoadResult> {
  try {
    const worlds = await loadPublicWorlds();
    const selectedWorld = choosePublicWorld(worlds);

    if (!selectedWorld) {
      return {};
    }

    const selectedDay = normalizeAtlasSelectedDay(selectedWorld, null);
    const timedSnapshot = buildTimedAtlasSnapshot(selectedWorld, selectedDay);

    return { snapshot: timedSnapshot.value };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The public world broadcast is unavailable.";
    return { message: `The living world broadcast could not be loaded. ${message}` };
  }
}

function PublicWorldEmptyState({ message }: { message?: string }) {
  return (
    <main className="min-h-screen bg-[#050608] px-6 py-16 text-stone-100 sm:px-10 lg:px-12">
      <div className="mx-auto max-w-4xl rounded-lg border border-white/10 bg-white/[0.035] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-dawn-gold">Living World</p>
        <h1 className="mt-4 font-display text-5xl leading-tight text-white">The first histories are still forming.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-stone-300">
          {message ?? "No public world is available yet. The planet is still in its early age."}
        </p>
        <Link
          className="mt-8 inline-flex rounded border border-dawn-gold/50 bg-dawn-gold/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-dawn-amber transition hover:border-dawn-gold hover:bg-dawn-gold/20 hover:text-white"
          href="/"
        >
          Back to First Dawn
        </Link>
      </div>
    </main>
  );
}

export default async function PublicWorldPage() {
  const result = await loadPublicWorldSnapshot();

  if (!result.snapshot) {
    return <PublicWorldEmptyState message={result.message} />;
  }

  return <PublicWorldViewer snapshot={result.snapshot} />;
}
