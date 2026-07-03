import Link from "next/link";

import { getBiomeDefinitions, type BiomeGridCell } from "../../../lib/simulation/biome-engine";
import { getLatestPersistedAtlasSnapshot } from "../../../lib/simulation/snapshot-store";
import { listWorlds } from "../../../lib/worlds/world-lifecycle";
import { BiomeMapClient } from "./biome-map-client";

export const dynamic = "force-dynamic";

function UnavailableBiomeSnapshot() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-dawn-gold">Biome Debug Map</p>
        <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">Snapshot Unavailable</h1>
      </header>
      <section className="mt-8 border border-white/10 bg-black/20 p-6 text-sm text-stone-300">
        No persisted biome snapshot is available yet. Start the simulation worker or run npm run sim:step.
      </section>
      <Link
        className="mt-6 inline-flex items-center justify-center border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-100 transition hover:border-dawn-gold/40 hover:bg-white/10"
        href="/worlds"
      >
        Back to Worlds
      </Link>
    </div>
  );
}

export default async function WorldsBiomesPage() {
  const worlds = await listWorlds();
  const activeWorld =
    worlds.find((world) => world.environment === "SANDBOX" && world.status === "ACTIVE") ??
    worlds.find((world) => world.status === "ACTIVE") ??
    worlds[0] ??
    null;
  const persistedSnapshot = activeWorld ? await getLatestPersistedAtlasSnapshot(activeWorld.id) : null;
  const snapshot = persistedSnapshot?.snapshot ?? null;
  const biomeSummary = snapshot?.biomeSummary ?? null;

  return (
    <main className="min-h-screen bg-dawn-coal px-6 py-10 text-stone-100 sm:px-10 lg:px-12">
      {!activeWorld || !snapshot || !biomeSummary ? (
        <UnavailableBiomeSnapshot />
      ) : (
        <>
          <div className="mx-auto mb-6 max-w-7xl">
            <Link
              className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-100 transition hover:border-dawn-gold/40 hover:bg-white/10"
              href="/worlds"
            >
              Back to Worlds
            </Link>
          </div>
          <BiomeMapClient
            cells={snapshot.cells as readonly BiomeGridCell[]}
            definitions={getBiomeDefinitions()}
            gridLabel={`${snapshot.grid.latitudeDivisions} x ${snapshot.grid.longitudeDivisions}`}
            planetName={snapshot.planet.name}
            seed={snapshot.fingerprint.seed ?? activeWorld.seed ?? ""}
            summary={biomeSummary}
            worldName={snapshot.worldName}
            worldSlug={snapshot.worldSlug}
          />
        </>
      )}
    </main>
  );
}