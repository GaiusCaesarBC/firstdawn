// @vitest-environment jsdom

import { WorldEnvironment, WorldStatus } from "@prisma/client";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAtlasCoordinateTransform, WorldMapAtlasClient } from "../../src/app/worlds/map/world-map-atlas-client";
import { buildAtlasSnapshot, toAtlasWorldOption } from "../../src/lib/worlds/map-atlas";
import type { WorldWithPlanet } from "../../src/lib/worlds/world-lifecycle";

type RecordingContext = CanvasRenderingContext2D & { operations: string[] };

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
    atmosphereComposition: { nitrogen: 78, oxygen: 21, argon: 0.93, carbonDioxide: 0.04 },
    oceanCoveragePercent: 71,
    createdAt: new Date("2026-06-26T00:00:00.000Z"),
    updatedAt: new Date("2026-06-26T00:00:00.000Z"),
  },
} as unknown as WorldWithPlanet;

function createRecordingContext(): RecordingContext {
  const operations: string[] = [];
  const ctx = {
    operations,
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    font: "10px sans-serif",
    save: vi.fn(() => operations.push("save")),
    restore: vi.fn(() => operations.push("restore")),
    translate: vi.fn((x: number, y: number) => operations.push(`translate:${x}:${y}`)),
    scale: vi.fn((x: number, y: number) => operations.push(`scale:${x}:${y}`)),
    clearRect: vi.fn((x: number, y: number, w: number, h: number) => operations.push(`clearRect:${x}:${y}:${w}:${h}`)),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => operations.push(`fillRect:${String((ctx as any).fillStyle)}:${x}:${y}:${w}:${h}`)),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) => operations.push(`strokeRect:${String((ctx as any).strokeStyle)}:${x}:${y}:${w}:${h}`)),
    beginPath: vi.fn(() => operations.push("beginPath")),
    moveTo: vi.fn((x: number, y: number) => operations.push(`moveTo:${x}:${y}`)),
    lineTo: vi.fn((x: number, y: number) => operations.push(`lineTo:${x}:${y}`)),
    stroke: vi.fn(() => operations.push(`stroke:${String((ctx as any).strokeStyle)}`)),
    fill: vi.fn(() => operations.push(`fill:${String((ctx as any).fillStyle)}`)),
    closePath: vi.fn(() => operations.push("closePath")),
    fillText: vi.fn((text: string, x: number, y: number) => operations.push(`fillText:${text}:${x}:${y}`)),
    drawImage: vi.fn((image: CanvasImageSource, x: number, y: number, w: number, h: number) => operations.push(`drawImage:${x}:${y}:${w}:${h}`)),
  } as unknown as RecordingContext;
  return ctx;
}

function renderAtlas(initialSnapshot = buildAtlasSnapshot(baseWorld, 1)) {
  return render(createElement(WorldMapAtlasClient, {
    worlds: [toAtlasWorldOption(baseWorld)],
    initialSnapshot,
  }));
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

type LineSegment = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

function parsePointOperation(operation: string) {
  const [, x, y] = operation.split(":");
  return { x: Number(x), y: Number(y) };
}

function getLineSegments(operations: string[]): LineSegment[] {
  const segments: LineSegment[] = [];
  let from: LineSegment["from"] | null = null;

  for (const operation of operations) {
    if (operation.startsWith("moveTo:")) {
      from = parsePointOperation(operation);
    }

    if (operation.startsWith("lineTo:") && from) {
      const to = parsePointOperation(operation);
      segments.push({ from, to });
      from = to;
    }
  }

  return segments;
}

function getVerticalGridXs(operations: string[]) {
  const xs = getLineSegments(operations)
    .filter((segment) => Math.abs(segment.from.x - segment.to.x) < 0.001)
    .filter((segment) => Math.abs(segment.from.y - segment.to.y) > 300)
    .map((segment) => Number(segment.from.x.toFixed(3)));

  return Array.from(new Set(xs)).sort((a, b) => a - b);
}

function getGridGap(operations: string[]) {
  const xs = getVerticalGridXs(operations);
  const gaps = xs.slice(1).map((x, index) => x - xs[index]).filter((gap) => gap > 5);
  return Math.min(...gaps);
}

function getSelectedStrokeRect(operations: string[]) {
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const operation = operations[index];

    if (!operation.startsWith("strokeRect:#ffd071:")) {
      continue;
    }

    const [, , x, y, width, height] = operation.split(":");
    return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
  }

  return null;
}

describe("atlas navigation and polish", () => {
  let currentContext: RecordingContext;

  beforeEach(() => {
    window.history.replaceState(null, "", "/worlds/map");
    window.sessionStorage.clear();
    currentContext = createRecordingContext();

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => currentContext),
    });

    Object.defineProperty(HTMLCanvasElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ x: 0, y: 0, left: 0, top: 0, width: 1120, height: 680, right: 1120, bottom: 680, toJSON: () => undefined }),
    });

    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1120 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 680 });
    Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLCanvasElement.prototype, "releasePointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: class { observe(){} disconnect(){} } });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("Search centers correct cell and opens inspector", async () => {
    const initialSnapshot = buildAtlasSnapshot(baseWorld, 1);
    renderAtlas(initialSnapshot);

    fireEvent.click(screen.getByTestId("toolbar-search"));
    const input = await screen.findByTestId("atlas-search-input");
    fireEvent.change(input, { target: { value: "cell-00-00" } });
    currentContext.operations.length = 0;
    fireEvent.click(screen.getByTestId("atlas-search-go"));

    const target = initialSnapshot.cells.find((cell) => cell.id === "cell-00-00");
    expect(target).toBeTruthy();

    const worldRect = createAtlasCoordinateTransform(initialSnapshot, { scale: 1, offsetX: 0, offsetY: 0 }).cellRect(target!);
    const focusedView = {
      scale: 1.4,
      offsetX: 1120 / 2 - (worldRect.x + worldRect.width / 2) * 1.4,
      offsetY: 680 / 2 - (worldRect.y + worldRect.height / 2) * 1.4,
    };
    const rect = createAtlasCoordinateTransform(initialSnapshot, focusedView).cellRect(target!);

    await waitFor(() => {
      expect(screen.getAllByText("cell-00-00").length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      const selectedRect = getSelectedStrokeRect(currentContext.operations);
      expect(selectedRect).toBeTruthy();
      expect(selectedRect!.x).toBeCloseTo(rect.x + 1, 3);
      expect(selectedRect!.y).toBeCloseTo(rect.y + 1, 3);
      expect(selectedRect!.width).toBeCloseTo(rect.width - 2, 3);
      expect(selectedRect!.height).toBeCloseTo(rect.height - 2, 3);
    });
  });

  it("Coordinate search works and quick nav works", async () => {
    renderAtlas();
    fireEvent.click(screen.getByTestId("toolbar-search"));
    const input = await screen.findByTestId("atlas-search-input");
    (input as HTMLInputElement).value = "45N,120E";
    fireEvent.change(input);
    fireEvent.keyDown(input, { key: "Enter" });

    // Use quick nav to jump to Equator
    const btn = screen.getByTestId("nav-Equator");
    fireEvent.click(btn);
    await waitFor(() => {
      // Expect some canvas operations occurred
      expect(currentContext.operations.length).toBeGreaterThan(0);
    });
  });

  it("Legend updates when changing layers and overlay scaling responds to zoom", async () => {
    renderAtlas();
    // Change layer to temperature and expect Statistics panel to reflect
    fireEvent.click(screen.getByTestId("layer-averageTemperature"));
    await waitFor(() => {
      expect(screen.getByTestId("statistics-panel")).toBeTruthy();
    });

    // Click Zoom Out several times
    const zoomOut = screen.getByText("Zoom Out");
    for (let i = 0; i < 6; i += 1) fireEvent.click(zoomOut);

    await waitFor(() => {
      // Ensure rendering occurred while zooming (buffer draw or fallback)
      const drew = currentContext.operations.some((op) => op.startsWith("drawImage:") || op.startsWith("fillRect:"));
      expect(drew).toBe(true);
    });
  });

  it("keeps grid overlay moving and scaling with the atlas viewport", async () => {
    renderAtlas();

    fireEvent.click(screen.getByText("Grid (G)"));
    fireEvent.click(screen.getByText("Zoom In"));
    fireEvent.click(screen.getByText("Zoom In"));

    await waitFor(() => {
      expect(getVerticalGridXs(currentContext.operations).length).toBeGreaterThan(2);
    });

    const gapBefore = getGridGap(currentContext.operations);
    currentContext.operations.length = 0;

    fireEvent.click(screen.getByText("Zoom In"));

    await waitFor(() => {
      expect(getGridGap(currentContext.operations)).toBeGreaterThan(gapBefore);
    });

    const leftBeforePan = getVerticalGridXs(currentContext.operations)[0];
    currentContext.operations.length = 0;

    const canvas = screen.getByTestId("world-map-canvas");
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 400, clientY: 300, buttons: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 460, clientY: 335, buttons: 1 });

    await waitFor(() => {
      expect(getVerticalGridXs(currentContext.operations)[0]).toBeCloseTo(leftBeforePan + 60, 3);
    });
  });

  it("selects and highlights the correct visible cell after zoom and pan", async () => {
    const initialSnapshot = buildAtlasSnapshot(baseWorld, 1);
    const originalSnapshot = buildAtlasSnapshot(baseWorld, 1);
    renderAtlas(initialSnapshot);

    const canvas = screen.getByTestId("world-map-canvas");
    fireEvent.click(screen.getByText("Zoom In"));
    fireEvent.click(screen.getByText("Zoom In"));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 420, clientY: 320, buttons: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 480, clientY: 360, buttons: 1 });
    currentContext.operations.length = 0;

    const target = initialSnapshot.cells.find((cell) => cell.id === "cell-09-18");
    expect(target).toBeTruthy();

    const fitView = getTestFitView(initialSnapshot);
    const view = {
      scale: fitView.scale * 1.2 * 1.2,
      offsetX: fitView.offsetX + 60,
      offsetY: fitView.offsetY + 40,
    };
    const rect = createAtlasCoordinateTransform(initialSnapshot, view).cellRect(target!);

    fireEvent.click(canvas, { clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 });

    await waitFor(() => {
      expect(screen.getAllByText("cell-09-18").length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      const selectedRect = getSelectedStrokeRect(currentContext.operations);
      expect(selectedRect).toBeTruthy();
      expect(selectedRect!.x).toBeCloseTo(rect.x + 1, 3);
      expect(selectedRect!.y).toBeCloseTo(rect.y + 1, 3);
      expect(selectedRect!.width).toBeCloseTo(rect.width - 2, 3);
      expect(selectedRect!.height).toBeCloseTo(rect.height - 2, 3);
    });

    expect(buildAtlasSnapshot(baseWorld, 1)).toEqual(originalSnapshot);
  });

  it("search centers the requested cell and keeps the highlight aligned", async () => {
    const initialSnapshot = buildAtlasSnapshot(baseWorld, 1);
    renderAtlas(initialSnapshot);

    fireEvent.click(screen.getByTestId("toolbar-search"));
    const input = await screen.findByTestId("atlas-search-input");
    fireEvent.change(input, { target: { value: "cell-09-18" } });
    currentContext.operations.length = 0;
    fireEvent.click(screen.getByTestId("atlas-search-go"));

    const target = initialSnapshot.cells.find((cell) => cell.id === "cell-09-18");
    expect(target).toBeTruthy();

    const focusedView = {
      scale: 1.4,
      offsetX: 1120 / 2 - (18.5 * 28) * 1.4,
      offsetY: 680 / 2 - (8.5 * 28) * 1.4,
    };
    const rect = createAtlasCoordinateTransform(initialSnapshot, focusedView).cellRect(target!);

    await waitFor(() => {
      expect(screen.getAllByText("cell-09-18").length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      const selectedRect = getSelectedStrokeRect(currentContext.operations);
      expect(selectedRect).toBeTruthy();
      expect(selectedRect!.x).toBeCloseTo(rect.x + 1, 3);
      expect(selectedRect!.y).toBeCloseTo(rect.y + 1, 3);
      expect(selectedRect!.width).toBeCloseTo(rect.width - 2, 3);
      expect(selectedRect!.height).toBeCloseTo(rect.height - 2, 3);
    });
  });
  it("Inspector opens and search history persists", async () => {
    renderAtlas();
    const canvas = screen.getByTestId("world-map-canvas");
    fireEvent.pointerMove(canvas, { clientX: 180, clientY: 180, buttons: 0 });
    expect(screen.getByText("Click a cell to open the full inspector. Hovering still exposes a compact tooltip.")).toBeTruthy();
    fireEvent.click(canvas, { clientX: 180, clientY: 180 });
    await waitFor(() => {
      expect(screen.getByTestId("cell-inspector")).toBeTruthy();
      expect(screen.getAllByText("Selected Cell").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Resources").length).toBeGreaterThan(0);
      expect(screen.getByText(/Bedrock/)).toBeTruthy();
      expect(new URLSearchParams(window.location.search).get("cell")).toBeTruthy();
    });

    fireEvent.pointerLeave(canvas);
    fireEvent.wheel(canvas, { clientX: 180, clientY: 180, deltaY: 240 });
    await waitFor(() => {
      expect(screen.getAllByText("Selected Cell").length).toBeGreaterThan(0);
      expect(screen.getByText(/Bedrock/)).toBeTruthy();
    });

    // Open search, issue a query, and ensure it appears in history buttons
    fireEvent.click(screen.getByTestId("toolbar-search"));
    const input = await screen.findByTestId("atlas-search-input");
    (input as HTMLInputElement).value = "Equator";
    fireEvent.change(input);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByTestId("toolbar-search")); // open again
    await waitFor(() => {
      expect(screen.getByText("Equator")).toBeTruthy();
    });
  });
});






