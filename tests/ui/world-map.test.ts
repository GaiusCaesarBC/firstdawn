// @vitest-environment jsdom

import { WorldEnvironment, WorldStatus } from "@prisma/client";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAtlasCoordinateTransform, FutureLayersPanel, WorldMapAtlasClient } from "../../src/app/worlds/map/world-map-atlas-client";
import { buildAtlasSnapshot, toAtlasWorldOption } from "../../src/lib/worlds/map-atlas";
import type { WorldWithPlanet } from "../../src/lib/worlds/world-lifecycle";

type RecordingContext = CanvasRenderingContext2D & {
  operations: string[];
};

const baseWorld = {
  id: "world-atlas-test",
  slug: "world-atlas-test",
  name: "Atlas Test World",
  environment: WorldEnvironment.SANDBOX,
  status: WorldStatus.ACTIVE,
  seed: "atlas-seed",
  currentTick: 0n,
  timeScale: 1,
  tickDurationSeconds: 60,
  dayLengthSeconds: 86_400,
  yearLengthDays: 365,
  axialTiltDegrees: 23.44,
  orbitalEccentricity: 0.0167,
  initialEpochName: "First Dawn",
  initialYear: 0,
  initialDay: 0,
  initialHour: 6,
  currentGeneration: 0,
  description: "Atlas fixture",
  protected: false,
  createdAt: new Date("2026-06-26T00:00:00.000Z"),
  updatedAt: new Date("2026-06-26T00:00:00.000Z"),
  planet: {
    id: "planet-atlas-test",
    worldId: "world-atlas-test",
    name: "Atlas Planet",
    radiusKm: 6371,
    gravityMS2: 9.81,
    massKg: 5.972e24,
    rotationPeriodHours: 24,
    orbitalPeriodDays: 365,
    axialTiltDegrees: 23.44,
    orbitalEccentricity: 0.0167,
    atmospherePressureKPa: 101.3,
    atmosphereComposition: {
      nitrogen: 78,
      oxygen: 21,
      argon: 0.93,
      carbonDioxide: 0.04,
    },
    oceanCoveragePercent: 71,
    createdAt: new Date("2026-06-26T00:00:00.000Z"),
    updatedAt: new Date("2026-06-26T00:00:00.000Z"),
  },
} as unknown as WorldWithPlanet;

function createRecordingContext(): RecordingContext {
  const operations: string[] = [];
  const context = {
    operations,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    font: "10px sans-serif",
    save: vi.fn(() => operations.push("save")),
    restore: vi.fn(() => operations.push("restore")),
    translate: vi.fn((x: number, y: number) => operations.push(`translate:${x}:${y}`)),
    scale: vi.fn((x: number, y: number) => operations.push(`scale:${x}:${y}`)),
    clearRect: vi.fn((x: number, y: number, width: number, height: number) => operations.push(`clearRect:${x}:${y}:${width}:${height}`)),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) => operations.push(`fillRect:${String(context.fillStyle)}:${x}:${y}:${width}:${height}`)),
    strokeRect: vi.fn((x: number, y: number, width: number, height: number) => operations.push(`strokeRect:${String(context.strokeStyle)}:${x}:${y}:${width}:${height}`)),
    beginPath: vi.fn(() => operations.push("beginPath")),
    moveTo: vi.fn((x: number, y: number) => operations.push(`moveTo:${x}:${y}`)),
    lineTo: vi.fn((x: number, y: number) => operations.push(`lineTo:${x}:${y}`)),
    stroke: vi.fn(() => operations.push(`stroke:${String(context.strokeStyle)}`)),
    fill: vi.fn(() => operations.push(`fill:${String(context.fillStyle)}`)),
    closePath: vi.fn(() => operations.push("closePath")),
    fillText: vi.fn((text: string, x: number, y: number) => operations.push(`fillText:${text}:${x}:${y}`)),
  };

  return context as unknown as RecordingContext;
}

function renderAtlas(options: Partial<ComponentProps<typeof WorldMapAtlasClient>> = {}) {
  const initialSnapshot = buildAtlasSnapshot(baseWorld, 1);
  const result = render(createElement(WorldMapAtlasClient, {
    worlds: [toAtlasWorldOption(baseWorld)],
    initialSnapshot,
    ...options,
  }));

  return { ...result, initialSnapshot };
}

function getTestFitView(snapshot: ReturnType<typeof buildAtlasSnapshot>) {
  const worldWidth = snapshot.grid.longitudeDivisions * 28;
  const worldHeight = snapshot.grid.latitudeDivisions * 28;
  const scale = Math.min((1120 - 48) / worldWidth, (680 - 48) / worldHeight);

  return {
    scale,
    offsetX: (1120 - worldWidth * scale) / 2,
    offsetY: (680 - worldHeight * scale) / 2,
  };
}

function clickCell(snapshot: ReturnType<typeof buildAtlasSnapshot>, cellId: string) {
  const cell = snapshot.cells.find((candidate) => candidate.id === cellId);
  expect(cell).toBeTruthy();

  const rect = createAtlasCoordinateTransform(snapshot, getTestFitView(snapshot)).cellRect(cell!);
  fireEvent.click(screen.getByTestId("world-map-canvas"), {
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + rect.height / 2,
  });
}

describe("world map atlas ui", () => {
  let currentContext: RecordingContext;

  beforeEach(() => {
    currentContext = createRecordingContext();

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => currentContext),
    });

    Object.defineProperty(HTMLCanvasElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 1120,
        height: 680,
        right: 1120,
        bottom: 680,
        toJSON: () => undefined,
      }),
    });

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 1120,
    });

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 680,
    });

    Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(HTMLCanvasElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders deterministically, switches layers, shows tooltip, and opens the inspector", async () => {
    const firstContext = createRecordingContext();
    currentContext = firstContext;
    const firstRender = renderAtlas();

    await waitFor(() => {
      expect(firstContext.operations.some((operation) => operation.startsWith("fillRect:"))).toBe(true);
    });

    const firstOperations = [...firstContext.operations];
    firstRender.unmount();
    cleanup();

    const secondContext = createRecordingContext();
    currentContext = secondContext;
    renderAtlas();

    await waitFor(() => {
      expect(secondContext.operations.some((operation) => operation.startsWith("fillRect:"))).toBe(true);
    });

    expect(secondContext.operations).toEqual(firstOperations);

    const canvas = screen.getByTestId("world-map-canvas");
    expect(canvas).toBeTruthy();
    expect(screen.getByTestId("time-slider")).toBeTruthy();

    fireEvent.click(screen.getByTestId("layer-averageTemperature"));

    await waitFor(() => {
      expect(screen.getByText("Average temperature")).toBeTruthy();
    });

    fireEvent.pointerMove(canvas, { clientX: 180, clientY: 180, buttons: 0 });

    await waitFor(() => {
      expect(screen.getByTestId("atlas-tooltip")).toBeTruthy();
    });

    fireEvent.click(canvas, { clientX: 180, clientY: 180 });

    await waitFor(() => {
      expect(screen.getByText("Selected Cell")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("layer-watersheds"));

    await waitFor(() => {
      expect(screen.getByText("Largest basin")).toBeTruthy();
    });
  });

  it("keeps timeline slider changes local until pointer release or keyboard commit", async () => {
    const fetchSnapshot = vi.fn(async (_worldId: string, day: number) => buildAtlasSnapshot(baseWorld, day));
    renderAtlas({ fetchSnapshot });

    const slider = screen.getByTestId("time-slider") as HTMLInputElement;

    fireEvent.change(slider, { target: { value: "42" } });

    expect(slider.value).toBe("42");
    expect(screen.getByText("Selected Day 42")).toBeTruthy();
    expect(fetchSnapshot).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);

    await waitFor(() => {
      expect(fetchSnapshot).toHaveBeenCalledTimes(1);
      expect(fetchSnapshot).toHaveBeenLastCalledWith(baseWorld.id, 42);
    });

    fireEvent.change(slider, { target: { value: "120" } });
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Selected Day 120")).toBeTruthy();

    fireEvent.keyUp(slider, { key: "ArrowRight" });

    await waitFor(() => {
      expect(fetchSnapshot).toHaveBeenCalledTimes(2);
      expect(fetchSnapshot).toHaveBeenLastCalledWith(baseWorld.id, 120);
    });
  });
  it("renders live future layer cards and updates them for different selected cells", async () => {
    window.history.replaceState(null, "", "/worlds/map");
    window.sessionStorage.clear();
    const { initialSnapshot } = renderAtlas();

    const panel = screen.getByTestId("future-layers-panel");
    expect(panel.textContent).toContain("Planet Summary");
    expect(panel.textContent).toContain("Biome");
    expect(panel.textContent).toContain("Vegetation");
    expect(panel.textContent).toContain("Average suitability");
    expect(panel.textContent).toContain("Average seasonal stress");
    expect(panel.textContent).toContain("Animals");
    expect(panel.textContent).toContain("Total population");
    expect(panel.textContent).toContain("Civilization Systems Not Generated Yet");
    expect(panel.textContent).not.toContain("Reserved atlas slot");

    fireEvent.click(screen.getByTestId("layer-biomes"));
    await waitFor(() => {
      expect(screen.getByText("Dominant biome")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("layer-vegetation"));
    await waitFor(() => {
      expect(screen.getByText("Dominant plant")).toBeTruthy();
    });

    const firstCell = initialSnapshot.cells.find((cell) => cell.dominantPlantKey !== "none") ?? initialSnapshot.cells[0];
    const secondCell = initialSnapshot.cells.find((cell) =>
      cell.id !== firstCell.id
      && (cell.biomeName !== firstCell.biomeName || cell.dominantPlantName !== firstCell.dominantPlantName)
    ) ?? initialSnapshot.cells.find((cell) => cell.id !== firstCell.id) ?? initialSnapshot.cells[0];

    clickCell(initialSnapshot, firstCell.id);
    await waitFor(() => {
      expect(panel.textContent).toContain("Selected Cell");
      expect(panel.textContent).toContain(firstCell.id);
      expect(panel.textContent).toContain(firstCell.biomeName);
      expect(panel.textContent).toContain(firstCell.dominantPlantName);
      expect(panel.textContent).toContain("Suitability");
      expect(panel.textContent).toContain("Seasonal stress");
    });

    clickCell(initialSnapshot, secondCell.id);
    await waitFor(() => {
      expect(panel.textContent).toContain(secondCell.id);
      expect(panel.textContent).toContain(secondCell.biomeName);
      expect(panel.textContent).toContain(secondCell.dominantPlantName);
    });
  });

  it("shows future layer loading, empty, and error states", () => {
    const initialSnapshot = buildAtlasSnapshot(baseWorld, 1);

    const loadingRender = render(createElement(FutureLayersPanel, {
      snapshot: initialSnapshot,
      selectedCell: null,
      loading: true,
      error: null,
    }));
    expect(screen.getByTestId("future-layers-panel").textContent).toContain("Loading selected world ecology");
    loadingRender.unmount();

    const emptyRender = render(createElement(FutureLayersPanel, {
      snapshot: { ...initialSnapshot, cells: [] },
      selectedCell: null,
      loading: false,
      error: null,
    }));
    expect(screen.getByTestId("future-layers-panel").textContent).toContain("No atlas cells are available");
    emptyRender.unmount();

    render(createElement(FutureLayersPanel, {
      snapshot: initialSnapshot,
      selectedCell: null,
      loading: false,
      error: "snapshot failed",
    }));
    expect(screen.getByTestId("future-layers-panel").textContent).toContain("snapshot failed");
  });
  it("builds deterministic seasonal atlas snapshots for different days", () => {
    const firstDay = buildAtlasSnapshot(baseWorld, 1);
    const midYear = buildAtlasSnapshot(baseWorld, 220);
    const firstDayRepeat = buildAtlasSnapshot(baseWorld, 1);

    expect(firstDay).toEqual(firstDayRepeat);
    expect(firstDay.selectedDay).toBe(1);
    expect(midYear.selectedDay).toBe(220);
    expect(firstDay.climate.seasonNorthernHemisphere).not.toBe(midYear.climate.seasonNorthernHemisphere);
    expect(firstDay.astronomy.solarDeclinationDegrees).not.toBe(midYear.astronomy.solarDeclinationDegrees);
    expect(firstDay.statistics.averageTemperatureC).not.toBe(midYear.statistics.averageTemperatureC);
  });
});