import type { CoordinateRange, GridCoordinate, Hemisphere, LatitudeBand } from "./coordinates";

export type GridCellId = string;

export type GridCell = {
  id: GridCellId;
  row: number;
  column: number;
  latitudeRange: CoordinateRange;
  longitudeRange: CoordinateRange;
  midpoint: GridCoordinate;
  midpointLatitude: number;
  midpointLongitude: number;
  hemisphere: Hemisphere;
  latitudeBand: LatitudeBand;
  neighbors: GridCellId[];
};

export function createCell(
  id: GridCellId,
  row: number,
  column: number,
  latitudeRange: CoordinateRange,
  longitudeRange: CoordinateRange,
  midpoint: GridCoordinate,
  hemisphere: Hemisphere,
  latitudeBand: LatitudeBand,
  neighbors: GridCellId[],
): GridCell {
  return {
    id,
    row,
    column,
    latitudeRange,
    longitudeRange,
    midpoint,
    midpointLatitude: midpoint.latitude,
    midpointLongitude: midpoint.longitude,
    hemisphere,
    latitudeBand,
    neighbors,
  };
}
