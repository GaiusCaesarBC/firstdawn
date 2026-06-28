import { createCell, type GridCell } from "./cell";
import {
  getHemisphere,
  getLatitudeBand,
  normalizeLatitude,
  normalizeLongitude,
  type LatitudeBand,
} from "./coordinates";

export type GridOptions = {
  latitudeDivisions: number;
  longitudeDivisions: number;
};

export const DEFAULT_GRID_OPTIONS: GridOptions = {
  latitudeDivisions: 18,
  longitudeDivisions: 36,
};

export type GridSummary = {
  totalCells: number;
  latitudeDivisions: number;
  longitudeDivisions: number;
  latitudeBands: LatitudeBand[];
};

export type SpatialGrid = {
  cells: Map<string, GridCell>;
  summary: GridSummary;
  getCell: (id: string) => GridCell | undefined;
  getCellAt: (latitude: number, longitude: number) => GridCell | undefined;
  getNeighbors: (id: string) => GridCell[];
  iterateCells: () => IterableIterator<GridCell>;
  getGridSummary: () => GridSummary;
};

export type GridIndex = SpatialGrid;

function buildCellId(row: number, column: number): string {
  return `cell-${row.toString().padStart(2, "0")}-${column.toString().padStart(2, "0")}`;
}

function resolveOptions(options: Partial<GridOptions> = {}): GridOptions {
  return {
    latitudeDivisions: options.latitudeDivisions ?? DEFAULT_GRID_OPTIONS.latitudeDivisions,
    longitudeDivisions: options.longitudeDivisions ?? DEFAULT_GRID_OPTIONS.longitudeDivisions,
  };
}

export function createGrid(options: Partial<GridOptions> = {}): SpatialGrid {
  const { latitudeDivisions, longitudeDivisions } = resolveOptions(options);

  if (!Number.isInteger(latitudeDivisions) || latitudeDivisions < 1) {
    throw new Error("latitudeDivisions must be a positive integer.");
  }

  if (!Number.isInteger(longitudeDivisions) || longitudeDivisions < 1) {
    throw new Error("longitudeDivisions must be a positive integer.");
  }

  const cells = new Map<string, GridCell>();

  const latitudeStep = 180 / latitudeDivisions;
  const longitudeStep = 360 / longitudeDivisions;
  const latitudeBands: LatitudeBand[] = [];

  for (let row = 0; row < latitudeDivisions; row += 1) {
    const latitudeRange = {
      minimum: -90 + latitudeStep * row,
      maximum: -90 + latitudeStep * (row + 1),
    };
    const latitudeBand = getLatitudeBand(latitudeRange, row);
    latitudeBands.push(latitudeBand);
    const midpointLatitude = normalizeLatitude(latitudeBand.midpoint);

    for (let column = 0; column < longitudeDivisions; column += 1) {
      const longitudeRange = {
        minimum: -180 + longitudeStep * column,
        maximum: -180 + longitudeStep * (column + 1),
      };
      const midpointLongitude = normalizeLongitude(
        longitudeRange.minimum + longitudeStep / 2,
      );
      const id = buildCellId(row, column);
      const hemisphere = getHemisphere(midpointLatitude, midpointLongitude);
      const neighbors = getNeighborIds(row, column, latitudeDivisions, longitudeDivisions);

      const cell = createCell(
        id,
        row,
        column,
        latitudeRange,
        longitudeRange,
        {
          latitude: midpointLatitude,
          longitude: midpointLongitude,
        },
        hemisphere,
        latitudeBand,
        neighbors,
      );
      cells.set(id, cell);
    }
  }

  const summary: GridSummary = {
    totalCells: latitudeDivisions * longitudeDivisions,
    latitudeBands,
    latitudeDivisions,
    longitudeDivisions,
  };

  const grid: SpatialGrid = {
    cells,
    summary,
    getCell: (id: string) => cells.get(id),
    getCellAt: (latitude: number, longitude: number) => {
      const normalizedLatitude = normalizeLatitude(latitude);
      const normalizedLongitude = normalizeLongitude(longitude);
      const rawRow = Math.floor((normalizedLatitude + 90) / latitudeStep);
      const rawColumn = Math.floor((normalizedLongitude + 180) / longitudeStep);
      const row = Math.min(Math.max(rawRow, 0), latitudeDivisions - 1);
      const column =
        ((rawColumn % longitudeDivisions) + longitudeDivisions) % longitudeDivisions;

      return cells.get(buildCellId(row, column));
    },
    getNeighbors: (id: string) => {
      const cell = cells.get(id);

      if (!cell) {
        return [];
      }

      return cell.neighbors
        .map((neighborId) => cells.get(neighborId))
        .filter((neighbor): neighbor is GridCell => Boolean(neighbor));
    },
    iterateCells: function* iterateCells(): IterableIterator<GridCell> {
      yield* cells.values();
    },
    getGridSummary: () => summary,
  };

  return grid;
}

function getNeighborIds(
  latIndex: number,
  lonIndex: number,
  latitudeDivisions: number,
  longitudeDivisions: number,
): string[] {
  const neighborOffsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const;

  const neighbors: string[] = [];

  for (const [dLat, dLon] of neighborOffsets) {
    const neighborLat = latIndex + dLat;
    const neighborLon = (lonIndex + dLon + longitudeDivisions) % longitudeDivisions;

    if (neighborLat < 0 || neighborLat >= latitudeDivisions) {
      continue;
    }

    neighbors.push(buildCellId(neighborLat, neighborLon));
  }

  return neighbors;
}

export function getCell(index: SpatialGrid, id: string): GridCell | undefined {
  return index.getCell(id);
}

export function getCellAt(
  index: SpatialGrid,
  latitude: number,
  longitude: number,
): GridCell | undefined {
  return index.getCellAt(latitude, longitude);
}

export function getNeighbors(index: SpatialGrid, id: string): GridCell[] {
  return index.getNeighbors(id);
}

export function iterateCells(index: SpatialGrid): IterableIterator<GridCell> {
  return index.iterateCells();
}

export function getGridSummary(index: SpatialGrid): GridSummary {
  return index.getGridSummary();
}
