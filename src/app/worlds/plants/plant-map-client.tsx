"use client";

import { useMemo, useState } from "react";

import type { PlantDefinition } from "../../../lib/simulation/plant-definitions";
import type { DominantPlantKey, PlantGridCell, PlantSummary } from "../../../lib/simulation/plant-engine";

type PlantMapClientProps = {
  worldName: string;
  worldSlug: string;
  planetName: string;
  seed: string;
  gridLabel: string;
  cells: readonly PlantGridCell[];
  summary: PlantSummary;
  definitions: readonly PlantDefinition[];
};

type MapMode = "density" | "dominant";

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function formatKey(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function densityColor(value: number): string {
  if (value <= 0.04) {
    return "#2f302c";
  }

  if (value < 0.2) {
    return "#716b48";
  }

  if (value < 0.45) {
    return "#8da04f";
  }

  if (value < 0.7) {
    return "#4f8f3a";
  }

  return "#176d3b";
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm text-stone-100">{value}</p>
    </div>
  );
}

export function PlantMapClient({
  worldName,
  worldSlug,
  planetName,
  seed,
  gridLabel,
  cells,
  summary,
  definitions,
}: PlantMapClientProps) {
  const initialCell = useMemo(
    () => cells.find((cell) => cell.plantDensity >= 0.35) ?? cells.find((cell) => cell.dominantPlantKey !== "none") ?? cells[0] ?? null,
    [cells],
  );
  const [selectedCellId, setSelectedCellId] = useState(initialCell?.id ?? "");
  const [mode, setMode] = useState<MapMode>("density");
  const selectedCell = cells.find((cell) => cell.id === selectedCellId) ?? initialCell;
  const definitionByKey = new Map<DominantPlantKey, PlantDefinition>(definitions.map((definition) => [definition.key, definition]));
  const presentDefinitions = definitions.filter((definition) => summary.dominantPlantDistribution[definition.key] > 0);
  const topPlants = [...presentDefinitions]
    .sort((left, right) => summary.dominantPlantDistribution[right.key] - summary.dominantPlantDistribution[left.key])
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-dawn-gold">Plant Ecology Debug Map</p>
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
        <DetailCard label="Total Biomass" value={formatNumber(summary.totalBiomass, 3)} />
        <DetailCard label="Plant Density" value={summary.averagePlantDensity.toFixed(3)} />
        <DetailCard label="Animal Carrying Base" value={summary.animalCarryingCapacityFoundationScore.toFixed(3)} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-white/10 bg-black/20 p-3">
          <div className="mb-3 inline-flex border border-white/10 bg-black/30 p-1">
            <button
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${mode === "density" ? "bg-dawn-gold text-black" : "text-stone-300 hover:bg-white/10"}`}
              onClick={() => setMode("density")}
              type="button"
            >
              Density
            </button>
            <button
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${mode === "dominant" ? "bg-dawn-gold text-black" : "text-stone-300 hover:bg-white/10"}`}
              onClick={() => setMode("dominant")}
              type="button"
            >
              Type
            </button>
          </div>
          <div
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: "repeat(36, minmax(10px, 1fr))" }}
          >
            {cells.map((cell) => {
              const plantDefinition = definitionByKey.get(cell.dominantPlantKey);
              const color = mode === "density" ? densityColor(cell.plantDensity) : plantDefinition?.color ?? "#2f302c";

              return (
                <button
                  aria-label={`${cell.id} ${cell.dominantPlantName}`}
                  className={`aspect-square border transition hover:scale-110 hover:border-white focus:outline-none focus:ring-2 focus:ring-dawn-gold ${selectedCell?.id === cell.id ? "border-white" : "border-black/30"}`}
                  key={cell.id}
                  onClick={() => setSelectedCellId(cell.id)}
                  style={{ backgroundColor: color, opacity: mode === "dominant" ? Math.max(0.28, cell.plantDensity) : 1 }}
                  title={`${cell.id}: ${cell.dominantPlantName} / ${cell.plantDensity.toFixed(3)}`}
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
                  style={{ backgroundColor: selectedCell.dominantPlantColor }}
                />
                <div>
                  <p className="font-mono text-xs text-stone-500">{selectedCell.id}</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{selectedCell.dominantPlantName}</h2>
                  <p className="mt-1 text-sm text-stone-400">{selectedCell.biomeName}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <DetailCard label="Plant Suitability" value={selectedCell.plantSuitabilityScore.toFixed(3)} />
                <DetailCard label="Plant Density" value={selectedCell.plantDensity.toFixed(3)} />
                <DetailCard label="Biomass" value={selectedCell.biomassScore.toFixed(3)} />
                <DetailCard label="Edible Plants" value={selectedCell.ediblePlantScore.toFixed(3)} />
                <DetailCard label="Wood / Material" value={selectedCell.woodMaterialScore.toFixed(3)} />
                <DetailCard label="Medicinal Potential" value={selectedCell.medicinalPotentialScore.toFixed(3)} />
                <DetailCard label="Biodiversity" value={selectedCell.biodiversityScore.toFixed(3)} />
                <DetailCard label="Regrowth" value={selectedCell.regrowthRate.toFixed(3)} />
                <DetailCard label="Seasonal Stress" value={selectedCell.seasonalStressScore.toFixed(3)} />
                <DetailCard label="Temperature" value={`${selectedCell.adjustedTemperatureC.toFixed(1)} C`} />
                <DetailCard label="Water" value={selectedCell.waterAvailabilityScore.toFixed(3)} />
                <DetailCard label="Tags" value={selectedCell.plantTags.join(", ")} />
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
                  <p className="text-xs text-stone-500">{summary.dominantPlantDistribution[definition.key]} cells</p>
                </div>
              </div>
            ))}
            {summary.dominantPlantDistribution.none > 0 ? (
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 border border-white/20" style={{ backgroundColor: "#2f302c" }} />
                <div>
                  <p className="text-sm text-stone-100">No Established Plant Life</p>
                  <p className="text-xs text-stone-500">{summary.dominantPlantDistribution.none} cells</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-dawn-gold">Dominant Coverage</p>
          <div className="mt-4 space-y-3">
            {topPlants.map((definition) => {
              const percent = (summary.dominantPlantDistribution[definition.key] / Math.max(summary.cellCount, 1)) * 100;

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

      <section className="mt-8 grid gap-6 lg:grid-cols-4">
        <ZoneList label="Foraging" regions={summary.bestForagingZones} selectCell={setSelectedCellId} />
        <ZoneList label="Timber / Materials" regions={summary.bestTimberMaterialZones} selectCell={setSelectedCellId} />
        <ZoneList label="Biodiversity" regions={summary.biodiversityHotspots} selectCell={setSelectedCellId} />
        <ZoneList label="Low Plant Zones" regions={summary.harshestLowPlantZones} selectCell={setSelectedCellId} />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailCard label="Edible Coverage" value={summary.ediblePlantCoverage.toFixed(3)} />
        <DetailCard label="Timber Coverage" value={summary.timberMaterialCoverage.toFixed(3)} />
        <DetailCard label="Biodiversity" value={summary.biodiversityScore.toFixed(3)} />
        <DetailCard label="Civilization Support" value={summary.civilizationStartingZoneSupportScore.toFixed(3)} />
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
  regions: PlantSummary["bestForagingZones"];
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
            <p className="text-sm text-stone-100">{region.dominantPlantName}</p>
            <p className="mt-1 font-mono text-xs text-stone-500">{region.cellId} / {region.peakScore.toFixed(3)}</p>
          </button>
        ))}
        {regions.length === 0 ? <p className="text-sm text-stone-500">No zones above threshold.</p> : null}
      </div>
    </div>
  );
}
