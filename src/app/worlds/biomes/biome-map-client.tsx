"use client";

import { useMemo, useState } from "react";

import type { BiomeDefinition, BiomeKey } from "../../../lib/simulation/biome-definitions";
import type { BiomeGridCell, BiomeSummary } from "../../../lib/simulation/biome-engine";

type BiomeMapClientProps = {
  worldName: string;
  worldSlug: string;
  planetName: string;
  seed: string;
  gridLabel: string;
  cells: readonly BiomeGridCell[];
  summary: BiomeSummary;
  definitions: readonly BiomeDefinition[];
};

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value, 2)} %`;
}

function formatBiomeKey(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm text-stone-100">{value}</p>
    </div>
  );
}

export function BiomeMapClient({
  worldName,
  worldSlug,
  planetName,
  seed,
  gridLabel,
  cells,
  summary,
  definitions,
}: BiomeMapClientProps) {
  const initialCell = useMemo(
    () => cells.find((cell) => cell.biomeKey !== "ocean") ?? cells[0] ?? null,
    [cells],
  );
  const [selectedCellId, setSelectedCellId] = useState(initialCell?.id ?? "");
  const selectedCell = cells.find((cell) => cell.id === selectedCellId) ?? initialCell;
  const presentDefinitions = definitions.filter((definition) => summary.biomeDistribution[definition.key] > 0);
  const topBiomes = [...presentDefinitions]
    .sort((left, right) => summary.biomeDistribution[right.key] - summary.biomeDistribution[left.key])
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-dawn-gold">Biome Debug Map</p>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">{planetName}</h1>
        </div>
        <div className="text-sm text-stone-400 lg:text-right">
          <p className="text-stone-200">{worldName}</p>
          <p>{worldSlug}</p>
          <p>{gridLabel}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailCard label="Seed" value={seed} />
        <DetailCard label="Cells" value={String(summary.cellCount)} />
        <DetailCard label="Ocean Coverage" value={formatPercent(summary.oceanCoveragePercent)} />
        <DetailCard label="Biodiversity" value={summary.biodiversityPotentialScore.toFixed(3)} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden border border-white/10 bg-black/20 p-3">
          <div
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: "repeat(36, minmax(10px, 1fr))" }}
          >
            {cells.map((cell) => (
              <button
                aria-label={`${cell.id} ${cell.biomeName}`}
                className={`aspect-square border transition hover:scale-110 hover:border-white focus:outline-none focus:ring-2 focus:ring-dawn-gold ${selectedCell?.id === cell.id ? "border-white" : "border-black/30"}`}
                key={cell.id}
                onClick={() => setSelectedCellId(cell.id)}
                style={{ backgroundColor: cell.biomeColor }}
                title={`${cell.id}: ${cell.biomeName}`}
                type="button"
              />
            ))}
          </div>
        </div>

        <aside className="border border-white/10 bg-black/20 p-5">
          {selectedCell ? (
            <>
              <div className="flex items-start gap-3 border-b border-white/10 pb-4">
                <span
                  className="mt-1 h-5 w-5 shrink-0 border border-white/20"
                  style={{ backgroundColor: selectedCell.biomeColor }}
                />
                <div>
                  <p className="font-mono text-xs text-stone-500">{selectedCell.id}</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{selectedCell.biomeName}</h2>
                  <p className="mt-1 text-sm text-stone-400">{formatBiomeKey(selectedCell.biomeCategory)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <DetailCard label="Temperature" value={`${selectedCell.adjustedTemperatureC.toFixed(1)} C`} />
                <DetailCard label="Precipitation" value={selectedCell.precipitationScore.toFixed(3)} />
                <DetailCard label="Humidity" value={selectedCell.humidityScore.toFixed(3)} />
                <DetailCard label="Soil Moisture" value={selectedCell.soilMoistureScore.toFixed(3)} />
                <DetailCard label="Elevation" value={selectedCell.elevation.toFixed(3)} />
                <DetailCard label="Terrain" value={formatBiomeKey(selectedCell.terrainType.toLowerCase().replaceAll("_", "-"))} />
                <DetailCard label="Habitability" value={selectedCell.habitabilityScore.toFixed(3)} />
                <DetailCard label="Fertility" value={selectedCell.fertilityScore.toFixed(3)} />
                <DetailCard label="Vegetation" value={selectedCell.vegetationDensity.toFixed(3)} />
                <DetailCard label="Tags" value={selectedCell.biomeTags.join(", ")} />
              </div>
            </>
          ) : null}
        </aside>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Legend</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presentDefinitions.map((definition) => (
              <div className="flex items-center gap-3" key={definition.key}>
                <span className="h-4 w-4 border border-white/20" style={{ backgroundColor: definition.color }} />
                <div>
                  <p className="text-sm text-stone-100">{definition.displayName}</p>
                  <p className="text-xs text-stone-500">{summary.biomeDistribution[definition.key]} cells</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Coverage</p>
          <div className="mt-4 space-y-3">
            {topBiomes.map((definition) => (
              <div key={definition.key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-stone-100">{definition.displayName}</span>
                  <span className="font-mono text-xs text-stone-400">{formatPercent(summary.biomePercentCoverage[definition.key])}</span>
                </div>
                <div className="mt-1 h-2 bg-white/10">
                  <div
                    className="h-2"
                    style={{
                      backgroundColor: definition.color,
                      width: `${Math.max(2, summary.biomePercentCoverage[definition.key])}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Starting Zones</p>
          <div className="mt-4 space-y-3">
            {summary.civilizationStartingZoneCandidates.slice(0, 5).map((region) => (
              <button
                className="block w-full border border-white/10 bg-white/5 p-3 text-left transition hover:border-dawn-gold/40"
                key={`start-${region.cellId}`}
                onClick={() => setSelectedCellId(region.cellId)}
                type="button"
              >
                <p className="text-sm text-stone-100">{region.biomeName}</p>
                <p className="mt-1 font-mono text-xs text-stone-500">{region.cellId} / {region.peakScore.toFixed(3)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Fertile Regions</p>
          <div className="mt-4 space-y-3">
            {summary.mostFertileRegions.slice(0, 5).map((region) => (
              <button
                className="block w-full border border-white/10 bg-white/5 p-3 text-left transition hover:border-dawn-gold/40"
                key={`fertile-${region.cellId}`}
                onClick={() => setSelectedCellId(region.cellId)}
                type="button"
              >
                <p className="text-sm text-stone-100">{region.biomeName}</p>
                <p className="mt-1 font-mono text-xs text-stone-500">{region.cellId} / {region.peakScore.toFixed(3)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Harsh Regions</p>
          <div className="mt-4 space-y-3">
            {summary.harshestRegions.slice(0, 5).map((region) => (
              <button
                className="block w-full border border-white/10 bg-white/5 p-3 text-left transition hover:border-dawn-gold/40"
                key={`harsh-${region.cellId}`}
                onClick={() => setSelectedCellId(region.cellId)}
                type="button"
              >
                <p className="text-sm text-stone-100">{region.biomeName}</p>
                <p className="mt-1 font-mono text-xs text-stone-500">{region.cellId} / {region.peakScore.toFixed(3)}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}