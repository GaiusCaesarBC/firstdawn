"use client";

import { useMemo, useState } from "react";

import type { AnimalGuildDefinition } from "../../../lib/simulation/animal-definitions";
import type { AnimalGridCell, AnimalSummary, DominantAnimalGuildKey } from "../../../lib/simulation/animal-engine";

type AnimalMapClientProps = {
  worldName: string;
  worldSlug: string;
  planetName: string;
  seed: string;
  gridLabel: string;
  cells: readonly AnimalGridCell[];
  summary: AnimalSummary;
  definitions: readonly AnimalGuildDefinition[];
};

type MapMode = "density" | "danger" | "hunting" | "domestication" | "dominant";

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function scaleColor(value: number, palette: readonly string[]): string {
  if (value <= 0.04) {
    return palette[0];
  }

  if (value < 0.25) {
    return palette[1];
  }

  if (value < 0.5) {
    return palette[2];
  }

  if (value < 0.72) {
    return palette[3];
  }

  return palette[4];
}

function modeColor(cell: AnimalGridCell, mode: MapMode, definition?: AnimalGuildDefinition): string {
  switch (mode) {
    case "danger":
      return scaleColor(cell.dangerScore, ["#25313a", "#5f5040", "#8d6040", "#a4473f", "#7f2f37"]);
    case "hunting":
      return scaleColor(cell.huntingValue, ["#273233", "#4f674e", "#7d8f4b", "#b09b4a", "#d1b15c"]);
    case "domestication":
      return scaleColor(cell.domesticationPotential, ["#293038", "#3e5f63", "#5f8571", "#91a65f", "#c7b75d"]);
    case "dominant":
      return definition?.color ?? "#303238";
    case "density":
    default:
      return scaleColor(cell.animalDensity, ["#293038", "#3d5860", "#5f8368", "#88a458", "#c2ad54"]);
  }
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm text-stone-100">{value}</p>
    </div>
  );
}

export function AnimalMapClient({
  worldName,
  worldSlug,
  planetName,
  seed,
  gridLabel,
  cells,
  summary,
  definitions,
}: AnimalMapClientProps) {
  const initialCell = useMemo(
    () => cells.find((cell) => cell.animalDensity >= 0.35) ?? cells[0] ?? null,
    [cells],
  );
  const [selectedCellId, setSelectedCellId] = useState(initialCell?.id ?? "");
  const [mode, setMode] = useState<MapMode>("density");
  const selectedCell = cells.find((cell) => cell.id === selectedCellId) ?? initialCell;
  const definitionByKey = new Map<DominantAnimalGuildKey, AnimalGuildDefinition>(definitions.map((definition) => [definition.key, definition]));
  const presentDefinitions = definitions.filter((definition) => summary.dominantAnimalDistribution[definition.key] > 0);
  const topGuilds = [...presentDefinitions]
    .sort((left, right) => summary.dominantAnimalDistribution[right.key] - summary.dominantAnimalDistribution[left.key])
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-dawn-gold">Animal Ecology Debug Map</p>
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
        <DetailCard label="Animal Capacity" value={formatNumber(summary.totalAnimalBiomassCapacity, 3)} />
        <DetailCard label="Animal Density" value={summary.averageAnimalDensity.toFixed(3)} />
        <DetailCard label="Civilization Food" value={summary.civilizationFoodSupportScore.toFixed(3)} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex flex-wrap gap-1 border border-white/10 bg-black/30 p-1">
            {(["density", "danger", "hunting", "domestication", "dominant"] as const).map((entry) => (
              <button
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${mode === entry ? "bg-dawn-gold text-black" : "text-stone-300 hover:bg-white/10"}`}
                key={entry}
                onClick={() => setMode(entry)}
                type="button"
              >
                {entry === "dominant" ? "Guild" : entry}
              </button>
            ))}
          </div>
          <div
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: "repeat(36, minmax(10px, 1fr))" }}
          >
            {cells.map((cell) => {
              const definition = definitionByKey.get(cell.dominantAnimalGuildKey);
              const color = modeColor(cell, mode, definition);

              return (
                <button
                  aria-label={`${cell.id} ${cell.dominantAnimalGuildName}`}
                  className={`aspect-square border transition hover:scale-110 hover:border-white focus:outline-none focus:ring-2 focus:ring-dawn-gold ${selectedCell?.id === cell.id ? "border-white" : "border-black/30"}`}
                  key={cell.id}
                  onClick={() => setSelectedCellId(cell.id)}
                  style={{ backgroundColor: color, opacity: mode === "dominant" ? Math.max(0.3, cell.animalDensity) : 1 }}
                  title={`${cell.id}: ${cell.dominantAnimalGuildName} / ${cell.animalDensity.toFixed(3)}`}
                  type="button"
                />
              );
            })}
          </div>
        </div>

        <aside className="border border-white/10 bg-black/20 p-5">
          {selectedCell ? (
            <>
              <div className="flex items-start gap-3 border-b border-white/10 pb-4">
                <span
                  className="mt-1 h-5 w-5 shrink-0 border border-white/20"
                  style={{ backgroundColor: selectedCell.dominantAnimalGuildColor }}
                />
                <div>
                  <p className="font-mono text-xs text-stone-500">{selectedCell.id}</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{selectedCell.dominantAnimalGuildName}</h2>
                  <p className="mt-1 text-sm text-stone-400">{selectedCell.biomeName}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <DetailCard label="Suitability" value={selectedCell.animalSuitabilityScore.toFixed(3)} />
                <DetailCard label="Density" value={selectedCell.animalDensity.toFixed(3)} />
                <DetailCard label="Herbivore Capacity" value={selectedCell.herbivoreCapacity.toFixed(3)} />
                <DetailCard label="Prey Availability" value={selectedCell.preyAvailability.toFixed(3)} />
                <DetailCard label="Predator Capacity" value={selectedCell.predatorCapacity.toFixed(3)} />
                <DetailCard label="Migration Pressure" value={selectedCell.migrationPressure.toFixed(3)} />
                <DetailCard label="Danger" value={selectedCell.dangerScore.toFixed(3)} />
                <DetailCard label="Hunting Value" value={selectedCell.huntingValue.toFixed(3)} />
                <DetailCard label="Domestication" value={selectedCell.domesticationPotential.toFixed(3)} />
                <DetailCard label="Biodiversity" value={selectedCell.animalBiodiversityScore.toFixed(3)} />
                <DetailCard label="Carrying Capacity" value={selectedCell.carryingCapacityScore.toFixed(3)} />
                <DetailCard label="Tags" value={selectedCell.animalTags.join(", ")} />
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
                  <p className="text-xs text-stone-500">{summary.dominantAnimalDistribution[definition.key]} cells</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Dominant Coverage</p>
          <div className="mt-4 space-y-3">
            {topGuilds.map((definition) => {
              const percent = (summary.dominantAnimalDistribution[definition.key] / Math.max(summary.cellCount, 1)) * 100;

              return (
                <div key={definition.key}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-stone-100">{definition.displayName}</span>
                    <span className="font-mono text-xs text-stone-400">{formatNumber(percent, 2)} %</span>
                  </div>
                  <div className="mt-1 h-2 bg-white/10">
                    <div
                      className="h-2"
                      style={{
                        backgroundColor: definition.color,
                        width: `${Math.max(2, percent)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-5">
        <ZoneList label="Hunting" regions={summary.huntingValueRegions} selectCell={setSelectedCellId} />
        <ZoneList label="Danger" regions={summary.highestDangerZones} selectCell={setSelectedCellId} />
        <ZoneList label="Domestication" regions={summary.domesticationCandidateRegions} selectCell={setSelectedCellId} />
        <ZoneList label="Biodiversity" regions={summary.biodiversityHotspots} selectCell={setSelectedCellId} />
        <ZoneList label="Migration" regions={summary.migrationCorridorCandidates} selectCell={setSelectedCellId} />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailCard label="Herbivore Capacity" value={summary.averageHerbivoreCapacity.toFixed(3)} />
        <DetailCard label="Predator Capacity" value={summary.averagePredatorCapacity.toFixed(3)} />
        <DetailCard label="Prey Availability" value={summary.averagePreyAvailability.toFixed(3)} />
        <DetailCard label="Danger Map" value={summary.dangerMapScore.toFixed(3)} />
      </section>
    </div>
  );
}

function ZoneList({
  label,
  regions,
  selectCell,
}: {
  label: string;
  regions: AnimalSummary["huntingValueRegions"];
  selectCell: (cellId: string) => void;
}) {
  return (
    <div className="border border-white/10 bg-black/20 p-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">{label}</p>
      <div className="mt-4 space-y-3">
        {regions.slice(0, 5).map((region) => (
          <button
            className="block w-full border border-white/10 bg-white/5 p-3 text-left transition hover:border-dawn-gold/40"
            key={`${label}-${region.cellId}`}
            onClick={() => selectCell(region.cellId)}
            type="button"
          >
            <p className="text-sm text-stone-100">{region.dominantAnimalGuildName}</p>
            <p className="mt-1 font-mono text-xs text-stone-500">{region.cellId} / {region.peakScore.toFixed(3)}</p>
          </button>
        ))}
        {regions.length === 0 ? <p className="text-sm text-stone-500">No zones above threshold.</p> : null}
      </div>
    </div>
  );
}