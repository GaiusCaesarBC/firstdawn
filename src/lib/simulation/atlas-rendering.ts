import type { AtlasCell, AtlasSnapshot } from "../worlds/map-atlas";
import { renderProceduralTerrainAtlas, type AtlasTerrainRenderQuality } from "./terrain-renderer";

export type AtlasVisualMode = "simulationGrid" | "smoothAtlas" | "scientificOverlay" | "hybrid";

type RenderAtlasBaseLayerOptions = {
  visualMode: AtlasVisualMode;
  selectedLayerId: string;
  cellSize: number;
  quality: AtlasTerrainRenderQuality;
  getLayerColor: (cell: AtlasCell) => string;
};

function getDisplayRow(snapshot: AtlasSnapshot, cell: AtlasCell): number {
  return snapshot.grid.latitudeDivisions - 1 - cell.row;
}

function renderRawGrid(context: CanvasRenderingContext2D, snapshot: AtlasSnapshot, options: RenderAtlasBaseLayerOptions) {
  for (const cell of snapshot.cells) {
    context.fillStyle = options.getLayerColor(cell);
    context.fillRect(
      cell.column * options.cellSize,
      getDisplayRow(snapshot, cell) * options.cellSize,
      options.cellSize,
      options.cellSize,
    );
  }
}

export function renderAtlasBaseLayer(
  context: CanvasRenderingContext2D,
  snapshot: AtlasSnapshot,
  options: RenderAtlasBaseLayerOptions,
) {
  if (options.visualMode === "simulationGrid") {
    renderRawGrid(context, snapshot, options);
    return;
  }

  renderProceduralTerrainAtlas(context, snapshot, {
    visualMode: options.visualMode,
    selectedLayerId: options.selectedLayerId,
    cellSize: options.cellSize,
    quality: options.quality,
    getLayerColor: options.getLayerColor,
  });
}