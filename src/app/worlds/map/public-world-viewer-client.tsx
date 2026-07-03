"use client";

import { useMemo, useState } from "react";

type WorldOption = {
  id: string;
  slug: string;
  name?: string;
  status?: string;
  environment?: string;
};

type PublicWorldViewerClientProps = {
  worlds: WorldOption[];
  selectedWorld?: WorldOption;
  initialSnapshot: unknown;
};

type CellLike = Record<string, unknown>;

export function PublicWorldViewerClient({
  worlds,
  selectedWorld,
  initialSnapshot,
}: PublicWorldViewerClientProps) {
  const atlas = useMemo(() => deriveAtlas(initialSnapshot), [initialSnapshot]);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  let selectedCell: CellLike | null = null;
  if (selectedCellId) {
    selectedCell = atlas.cells.find((cell) => cellKey(cell) === selectedCellId) ?? null;
  }
  if (!selectedCell) {
    selectedCell = atlas.cells[0] ?? null;
  }

  const activeWorld = selectedWorld ?? worlds[0] ?? null;

  return (
    <main className="min-h-screen bg-[#050607] px-5 py-6 text-stone-100">
      <header className="mx-auto flex max-w-7xl flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-amber-300/80">
            First Dawn Public Viewer
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl text-stone-50 md:text-6xl">
            Live Planetary Simulation
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-300 md:text-base">
            A public, read-only view of the current deterministic Atlas snapshot.
          </p>
        </div>

        {worlds.length > 1 ? (
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.25em] text-stone-500">
            World
            <select
              value={activeWorld?.slug ?? ""}
              onChange={(event) => {
                window.location.href = `/worlds/map?world=${encodeURIComponent(event.target.value)}`;
              }}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm normal-case tracking-normal text-stone-100 outline-none"
            >
              {worlds.map((world) => (
                <option key={world.id} value={world.slug} className="bg-[#111] text-stone-100">
                  {world.name ?? world.slug}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <section className="mx-auto mt-6 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="World" value={activeWorld?.name ?? activeWorld?.slug ?? "Unknown"} />
        <Metric label="Current Tick" value={atlas.tick ?? "Unknown"} />
        <Metric label="Northern Season" value={atlas.seasonNorth ?? "Unknown"} />
        <Metric label="Southern Season" value={atlas.seasonSouth ?? "Unknown"} />
        <Metric label="Living Humans" value={atlas.humans ?? "Unknown"} />
      </section>

      <section className="mx-auto mt-6 grid max-w-7xl gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(217,163,84,0.12),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300/70">
                Planet Surface
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-50">
                Atlas Grid
              </h2>
            </div>
            <p className="text-sm text-stone-400">
              {atlas.cells.length} cells · {atlas.rows} × {atlas.cols}
            </p>
          </div>

          {atlas.cells.length > 0 ? (
            <div
              className="grid gap-[2px] overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2"
              style={{
                gridTemplateColumns: `repeat(${atlas.cols}, minmax(6px, 1fr))`,
              }}
            >
              {atlas.cells.map((cell) => {
                const key = cellKey(cell);
                const isSelected = selectedCell ? cellKey(selectedCell) === key : false;

                return (
                  <button
                    key={key}
                    type="button"
                    title={cellTitle(cell)}
                    onClick={() => setSelectedCellId(key)}
                    className={[
                      "aspect-square rounded-[3px] border transition hover:scale-125 hover:border-amber-200",
                      isSelected ? "border-amber-200 ring-1 ring-amber-200" : "border-black/30",
                    ].join(" ")}
                    style={{
                      background: cellBackground(cell),
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
              Snapshot loaded, but no cell array was found in the public viewer parser.
            </div>
          )}
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300/70">
            Read-Only Cell Inspector
          </p>

          {selectedCell ? (
            <div className="mt-5 space-y-3">
              <InspectorRow label="Cell" value={cellTitle(selectedCell)} />
              <InspectorRow label="Terrain" value={firstCellValue(selectedCell, ["terrain", "terrainType", "surface", "surfaceType"])} />
              <InspectorRow label="Biome" value={firstCellValue(selectedCell, ["biome", "biomeType", "dominantBiome"])} />
              <InspectorRow label="Elevation" value={firstCellValue(selectedCell, ["elevation", "elevationMeters", "height", "altitude"])} />
              <InspectorRow label="Temperature" value={firstCellValue(selectedCell, ["temperature", "temperatureC", "avgTemperatureC"])} />
              <InspectorRow label="Moisture" value={firstCellValue(selectedCell, ["moisture", "humidity", "precipitation"])} />
              <InspectorRow label="Settlement" value={firstCellValue(selectedCell, ["settlement", "settlementName", "civilization", "civilizationMarker"])} />
              <InspectorRow label="Humans" value={firstCellValue(selectedCell, ["humans", "humanCount", "population"])} />
            </div>
          ) : (
            <p className="mt-5 text-sm text-stone-400">
              Select a cell on the grid to inspect public simulation data.
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-stone-400">
            This page exposes the simulation state only. It does not include owner controls,
            private Mission Control tools, citizen-follow actions, or admin panels.
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-stone-100">{value}</p>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm text-stone-100">{value ?? "—"}</p>
    </div>
  );
}

function deriveAtlas(snapshot: unknown) {
  const cells = findCells(snapshot);
  const sortedCells = [...cells].sort((a, b) => {
    const rowDiff = cellRow(a) - cellRow(b);
    if (rowDiff !== 0) {
      return rowDiff;
    }
    return cellCol(a) - cellCol(b);
  });

  const inferredCols = inferCols(sortedCells);
  const inferredRows = inferRows(sortedCells, inferredCols);

  return {
    cells: sortedCells,
    rows: firstSnapshotNumber(snapshot, [
      ["grid", "rows"],
      ["grid", "latitudes"],
      ["rows"],
    ]) ?? inferredRows,
    cols: firstSnapshotNumber(snapshot, [
      ["grid", "cols"],
      ["grid", "columns"],
      ["grid", "longitudes"],
      ["cols"],
      ["columns"],
    ]) ?? inferredCols,
    tick: firstSnapshotValue(snapshot, [
      ["tick"],
      ["currentTick"],
      ["world", "currentTick"],
      ["metadata", "tick"],
    ]),
    seasonNorth: firstSnapshotValue(snapshot, [
      ["seasonNorth"],
      ["seasons", "north"],
      ["planet", "seasonNorth"],
      ["summary", "seasonNorth"],
    ]),
    seasonSouth: firstSnapshotValue(snapshot, [
      ["seasonSouth"],
      ["seasons", "south"],
      ["planet", "seasonSouth"],
      ["summary", "seasonSouth"],
    ]),
    humans: firstSnapshotValue(snapshot, [
      ["livingHumans"],
      ["humanCount"],
      ["population", "humans"],
      ["humans", "living"],
      ["summary", "livingHumans"],
    ]),
  };
}

function findCells(source: unknown): CellLike[] {
  const paths = [
    ["grid", "cells"],
    ["cells"],
    ["atlas", "cells"],
    ["snapshot", "cells"],
    ["snapshot", "grid", "cells"],
    ["lightweightAtlas", "cells"],
  ];

  for (const path of paths) {
    const value = readPath(source, path);
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

function isRecord(value: unknown): value is CellLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(source: unknown, path: string[]): unknown {
  let current = source;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function firstSnapshotValue(source: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const value = displayValue(readPath(source, path));
    if (value) {
      return value;
    }
  }

  return null;
}

function firstSnapshotNumber(source: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    const value = readPath(source, path);
    const numberValue = toNumber(value);
    if (numberValue !== null) {
      return numberValue;
    }
  }

  return null;
}

function firstCellValue(cell: CellLike, keys: string[]): string | null {
  for (const key of keys) {
    const value = displayValue(cell[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function displayValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function cellKey(cell: CellLike): string {
  const id = displayValue(cell.id);
  if (id) {
    return id;
  }

  return `cell-${cellRow(cell)}-${cellCol(cell)}`;
}

function cellTitle(cell: CellLike): string {
  return displayValue(cell.id) ?? `Cell ${cellRow(cell)}, ${cellCol(cell)}`;
}

function cellRow(cell: CellLike): number {
  const direct = toNumber(cell.row) ?? toNumber(cell.gridRow) ?? toNumber(cell.y);
  if (direct !== null) {
    return direct;
  }

  const parsed = parseCellId(displayValue(cell.id));
  return parsed?.row ?? 0;
}

function cellCol(cell: CellLike): number {
  const direct = toNumber(cell.col) ?? toNumber(cell.column) ?? toNumber(cell.gridCol) ?? toNumber(cell.x);
  if (direct !== null) {
    return direct;
  }

  const parsed = parseCellId(displayValue(cell.id));
  return parsed?.col ?? 0;
}

function parseCellId(id: string | null): { row: number; col: number } | null {
  if (!id) {
    return null;
  }

  const match = id.match(/cell-(\d+)-(\d+)/i);
  if (!match) {
    return null;
  }

  return {
    row: Number(match[1]),
    col: Number(match[2]),
  };
}

function inferCols(cells: CellLike[]): number {
  const maxCol = cells.reduce((max, cell) => Math.max(max, cellCol(cell)), 0);
  if (maxCol > 0) {
    return maxCol + 1;
  }

  return Math.max(1, Math.round(Math.sqrt(cells.length || 1)));
}

function inferRows(cells: CellLike[], cols: number): number {
  const maxRow = cells.reduce((max, cell) => Math.max(max, cellRow(cell)), 0);
  if (maxRow > 0) {
    return maxRow + 1;
  }

  return Math.max(1, Math.ceil((cells.length || 1) / Math.max(1, cols)));
}

function cellBackground(cell: CellLike): string {
  const terrain = [
    firstCellValue(cell, ["terrain", "terrainType", "surface", "surfaceType"]),
    firstCellValue(cell, ["biome", "biomeType", "dominantBiome"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (terrain.includes("ocean") || terrain.includes("water") || terrain.includes("sea")) {
    return "#12384a";
  }

  if (terrain.includes("coast") || terrain.includes("shore")) {
    return "#315160";
  }

  if (terrain.includes("mountain") || terrain.includes("alpine")) {
    return "#5a5146";
  }

  if (terrain.includes("forest") || terrain.includes("jungle")) {
    return "#234f38";
  }

  if (terrain.includes("grass") || terrain.includes("plain") || terrain.includes("savanna")) {
    return "#4d6030";
  }

  if (terrain.includes("desert") || terrain.includes("arid")) {
    return "#7a5b2c";
  }

  if (terrain.includes("snow") || terrain.includes("ice") || terrain.includes("tundra")) {
    return "#b9c8c8";
  }

  const elevation = toNumber(cell.elevation) ?? toNumber(cell.elevationMeters) ?? toNumber(cell.height);
  if (elevation !== null) {
    if (elevation < 0) {
      return "#12384a";
    }

    if (elevation > 0.75) {
      return "#5a5146";
    }

    if (elevation > 0.45) {
      return "#4d6030";
    }
  }

  return "#2f4930";
}
