"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";

import type { AtlasCell, AtlasSnapshot, AtlasWorldOption } from "../../../lib/worlds/map-atlas";

type LayerId =
  | "planet"
  | "elevation"
  | "terrain"
  | "climate"
  | "averageTemperature"
  | "solarEnergy"
  | "daylightHours"
  | "hydrology"
  | "ocean"
  | "watersheds"
  | "riverCandidates"
  | "lakeCandidates"
  | "distanceToOcean"
  | "atmosphere"
  | "pressureZones"
  | "windDirection"
  | "windStrength"
  | "moistureTransport"
  | "rainShadow"
  | "weather"
  | "humidity"
  | "cloudCover"
  | "stormPotential"
  | "snowPotential"
  | "fogPotential"
  | "dryness"
  | "weatherType"
  | "biomes"
  | "vegetation"
  | "animals"
  | "civilizations";

type OverlayId =
  | "latitudeBands"
  | "windArrows"
  | "watershedBoundaries"
  | "coastlines"
  | "gridLines"
  | "cellIds"
  | "neighborLinks"
  | "drainageArrows"
  | "pressureBands"
  | "mountainOutlines";

type LayerDefinition = {
  id: LayerId;
  label: string;
  group: string;
  description: string;
  disabled?: boolean;
};

type LegendItem = {
  label: string;
  color: string;
};

type NumericRange = {
  minimum: number;
  maximum: number;
};

type AtlasView = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type ScreenPoint = {
  x: number;
  y: number;
};

type ScreenCellRect = ScreenPoint & {
  width: number;
  height: number;
};

type HoverState = {
  cellId: string;
  x: number;
  y: number;
};

type WorldMapAtlasClientProps = {
  worlds: AtlasWorldOption[];
  initialSnapshot: AtlasSnapshot;
  fetchSnapshot?: (worldId: string, day: number) => Promise<AtlasSnapshot>;
};

const MAP_CELL_SIZE = 28;
const MAP_PADDING = 24;
const MIN_SCALE = 0.4;
const MAX_SCALE = 10;
const DEFAULT_CELL_FOCUS_SCALE = 1.4;
const OVERLAY_TOGGLE_LABELS: Record<OverlayId, string> = {
  latitudeBands: "Latitude bands",
  windArrows: "Wind arrows",
  watershedBoundaries: "Watershed boundaries",
  coastlines: "Coastlines",
  gridLines: "Grid lines",
  cellIds: "Cell IDs",
  neighborLinks: "Neighbor links",
  drainageArrows: "Drainage arrows",
  pressureBands: "Pressure bands",
  mountainOutlines: "Mountain outlines",
};

const LAYERS: LayerDefinition[] = [
  { id: "planet", label: "Planet", group: "Planet", description: "Composite terrain and shoreline view." },
  { id: "elevation", label: "Elevation", group: "Planet", description: "Raw elevation scale across ocean, coast, and mountains." },
  { id: "terrain", label: "Terrain", group: "Planet", description: "Categorical terrain types." },
  { id: "climate", label: "Climate", group: "Climate", description: "Climate band classification by latitude and season." },
  { id: "averageTemperature", label: "Average Temperature", group: "Climate", description: "Temperature heatmap in degrees Celsius." },
  { id: "solarEnergy", label: "Solar Energy", group: "Climate", description: "Normalized daily solar input." },
  { id: "daylightHours", label: "Daylight Hours", group: "Climate", description: "Seasonal daylight duration by cell latitude." },
  { id: "hydrology", label: "Hydrology", group: "Hydrology", description: "Water body classifications and drainage basins." },
  { id: "ocean", label: "Ocean", group: "Hydrology", description: "Ocean and sea mask." },
  { id: "watersheds", label: "Watersheds", group: "Hydrology", description: "Watershed IDs rendered with hashed categorical colors." },
  { id: "riverCandidates", label: "River Candidates", group: "Hydrology", description: "Potential river source and channel cells." },
  { id: "lakeCandidates", label: "Lake Candidates", group: "Hydrology", description: "Potential inland lake cells." },
  { id: "distanceToOcean", label: "Distance to Ocean", group: "Hydrology", description: "Distance field from marine cells." },
  { id: "atmosphere", label: "Atmosphere", group: "Atmosphere", description: "Atmospheric stability field." },
  { id: "pressureZones", label: "Pressure Zones", group: "Atmosphere", description: "Global pressure band classification." },
  { id: "windDirection", label: "Wind Direction", group: "Atmosphere", description: "Dominant wind direction with vector overlay." },
  { id: "windStrength", label: "Wind Strength", group: "Atmosphere", description: "Wind strength heatmap." },
  { id: "moistureTransport", label: "Moisture Transport", group: "Atmosphere", description: "Moisture transport potential." },
  { id: "rainShadow", label: "Rain Shadow", group: "Atmosphere", description: "Rain shadow intensity." },
  { id: "weather", label: "Weather", group: "Weather", description: "Current categorical weather field." },
  { id: "humidity", label: "Humidity", group: "Weather", description: "Relative humidity heatmap." },
  { id: "cloudCover", label: "Cloud Cover", group: "Weather", description: "Cloud cover heatmap." },
  { id: "stormPotential", label: "Storm Potential", group: "Weather", description: "Storm risk heatmap." },
  { id: "snowPotential", label: "Snow Potential", group: "Weather", description: "Snow probability field." },
  { id: "fogPotential", label: "Fog Potential", group: "Weather", description: "Fog potential field." },
  { id: "dryness", label: "Dryness", group: "Weather", description: "Dryness index heatmap." },
  { id: "weatherType", label: "Weather Type", group: "Weather", description: "Explicit weather class map." },
  { id: "biomes", label: "Biomes", group: "Future Layers", description: "Reserved atlas slot for biome rendering.", disabled: true },
  { id: "vegetation", label: "Vegetation", group: "Future Layers", description: "Reserved atlas slot for vegetation rendering.", disabled: true },
  { id: "animals", label: "Animals", group: "Future Layers", description: "Reserved atlas slot for fauna layers.", disabled: true },
  { id: "civilizations", label: "Civilizations", group: "Future Layers", description: "Reserved atlas slot for civilization systems.", disabled: true },
];

const DEFAULT_OVERLAYS: Record<OverlayId, boolean> = {
  latitudeBands: false,
  windArrows: false,
  watershedBoundaries: true,
  coastlines: true,
  gridLines: false,
  cellIds: false,
  neighborLinks: false,
  drainageArrows: false,
  pressureBands: false,
  mountainOutlines: false,
};

const TERRAIN_COLORS: Record<string, string> = {
  DEEP_OCEAN: "#0d2a6d",
  OCEAN: "#1f5eb6",
  SHALLOW_SEA: "#48a4de",
  BEACH: "#e9d7a5",
  PLAINS: "#6aa05c",
  HILLS: "#769354",
  MOUNTAINS: "#7a5f49",
  HIGH_MOUNTAINS: "#a0a7b3",
  PLATEAU: "#8d7457",
};

const CLIMATE_COLORS: Record<string, string> = {
  Polar: "#d9f0ff",
  Subpolar: "#8bbde8",
  Boreal: "#5f8cb4",
  "Cool Temperate": "#6f9f71",
  "Warm Temperate": "#9dbc5b",
  Subtropical: "#d4ba48",
  Tropical: "#cf7c3d",
};

const PRESSURE_ZONE_COLORS: Record<string, string> = {
  EQUATORIAL_LOW: "#4c7cf0",
  SUBTROPICAL_HIGH: "#d96262",
  TEMPERATE_LOW: "#6aa7f4",
  POLAR_HIGH: "#bd4552",
  TRANSITION: "#f4f1e8",
};

const WEATHER_COLORS: Record<string, string> = {
  CLEAR: "#8bd8ff",
  PARTLY_CLOUDY: "#75b7d9",
  CLOUDY: "#8e9faf",
  OVERCAST: "#637383",
  DRY: "#c28a48",
  WET: "#4f9d76",
  FOG_PRONE: "#cad0d5",
  SNOW_PRONE: "#edf6ff",
  STORM_PRONE: "#7146c4",
};

function titleize(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100, 1)} %`;
}

function formatTemperature(value: number): string {
  return `${formatNumber(value, 1)} C`;
}

function formatLatitude(value: number): string {
  if (value === 0) {
    return "0 deg";
  }

  return `${formatNumber(Math.abs(value), 0)} deg ${value > 0 ? "N" : "S"}`;
}

function formatLongitude(value: number): string {
  if (value === 0) {
    return "0 deg";
  }

  return `${formatNumber(Math.abs(value), 0)} deg ${value > 0 ? "E" : "W"}`;
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const offset = normalized.length === 3 ? normalized.split("").map((part) => `${part}${part}`).join("") : normalized;

  return [
    Number.parseInt(offset.slice(0, 2), 16),
    Number.parseInt(offset.slice(2, 4), 16),
    Number.parseInt(offset.slice(4, 6), 16),
  ];
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function interpolateColor(left: string, right: string, weight: number): string {
  const [leftRed, leftGreen, leftBlue] = hexToRgb(left);
  const [rightRed, rightGreen, rightBlue] = hexToRgb(right);
  const clampedWeight = clamp(weight, 0, 1);

  return rgbToHex(
    leftRed + (rightRed - leftRed) * clampedWeight,
    leftGreen + (rightGreen - leftGreen) * clampedWeight,
    leftBlue + (rightBlue - leftBlue) * clampedWeight,
  );
}

function sampleGradient(value: number, stops: Array<{ at: number; color: string }>): string {
  const clampedValue = clamp(value, 0, 1);

  for (let index = 1; index < stops.length; index += 1) {
    const left = stops[index - 1];
    const right = stops[index];

    if (clampedValue <= right.at) {
      const span = right.at - left.at || 1;
      return interpolateColor(left.color, right.color, (clampedValue - left.at) / span);
    }
  }

  return stops[stops.length - 1]?.color ?? "#ffffff";
}

function normalizeValue(value: number, range: NumericRange): number {
  if (range.maximum <= range.minimum) {
    return 0;
  }

  return clamp((value - range.minimum) / (range.maximum - range.minimum), 0, 1);
}

function categoricalHashColor(seed: string): string {
  const hue = hashString(seed) % 360;
  return `hsl(${hue} 62% 58%)`;
}

function getLayerDefinition(layerId: LayerId): LayerDefinition {
  return LAYERS.find((layer) => layer.id === layerId) ?? LAYERS[0];
}

function getLayerRange(snapshot: AtlasSnapshot, layerId: LayerId): NumericRange | null {
  switch (layerId) {
    case "averageTemperature":
      return { minimum: -25, maximum: 40 };
    case "solarEnergy":
    case "humidity":
    case "cloudCover":
    case "stormPotential":
    case "snowPotential":
    case "fogPotential":
    case "dryness":
    case "rainShadow":
    case "moistureTransport":
    case "atmosphere":
    case "pressureZones":
    case "ocean":
      return { minimum: 0, maximum: 1 };
    case "daylightHours":
      return { minimum: 0, maximum: 24 };
    case "elevation":
      return { minimum: 0, maximum: 1 };
    case "windStrength": {
      let maximum = 0;

      for (const cell of snapshot.cells) {
        maximum = Math.max(maximum, cell.windStrength);
      }

      return { minimum: 0, maximum: Math.max(1, maximum) };
    }
    case "distanceToOcean": {
      let maximum = 0;

      for (const cell of snapshot.cells) {
        maximum = Math.max(maximum, cell.distanceToOcean);
      }

      return { minimum: 0, maximum: Math.max(1, maximum) };
    }
    default:
      return null;
  }
}

function getLayerColor(snapshot: AtlasSnapshot, cell: AtlasCell, layerId: LayerId): string {
  const range = getLayerRange(snapshot, layerId);

  switch (layerId) {
    case "planet":
    case "terrain":
      return TERRAIN_COLORS[cell.terrainType] ?? "#9ba0a8";
    case "elevation":
      return sampleGradient(normalizeValue(cell.elevation, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#0c2c74" },
        { at: 0.2, color: "#1f69d0" },
        { at: 0.42, color: "#ead7a5" },
        { at: 0.58, color: "#5e9e56" },
        { at: 0.74, color: "#7a5b3b" },
        { at: 0.88, color: "#8e95a2" },
        { at: 1, color: "#ffffff" },
      ]);
    case "climate":
      return CLIMATE_COLORS[cell.climateBand] ?? "#d7d8db";
    case "averageTemperature":
      return sampleGradient(normalizeValue(cell.averageTemperatureC, range ?? { minimum: -25, maximum: 40 }), [
        { at: 0, color: "#17356a" },
        { at: 0.18, color: "#2e70cb" },
        { at: 0.42, color: "#55a86d" },
        { at: 0.62, color: "#d2bf48" },
        { at: 0.8, color: "#e6843d" },
        { at: 1, color: "#c74635" },
      ]);
    case "solarEnergy":
      return sampleGradient(normalizeValue(cell.solarEnergy, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#16244f" },
        { at: 0.35, color: "#255cc9" },
        { at: 0.7, color: "#d2a746" },
        { at: 1, color: "#fff3b0" },
      ]);
    case "daylightHours":
      return sampleGradient(normalizeValue(cell.daylightHours, range ?? { minimum: 0, maximum: 24 }), [
        { at: 0, color: "#091227" },
        { at: 0.25, color: "#244f9c" },
        { at: 0.55, color: "#6da05a" },
        { at: 0.8, color: "#d1a94a" },
        { at: 1, color: "#fff0b4" },
      ]);
    case "hydrology":
      return TERRAIN_COLORS[cell.waterBodyType] ?? (
        cell.waterBodyType === "COASTAL_WATER" ? "#5aa9d6"
          : cell.waterBodyType === "LAKE_CANDIDATE" ? "#74c2f3"
            : cell.waterBodyType === "RIVER_SOURCE_CANDIDATE" ? "#a8def9"
              : cell.waterBodyType === "RIVER_CHANNEL_CANDIDATE" ? "#58baf2"
                : cell.waterBodyType === "INLAND_BASIN" ? "#7bc7c8"
                  : cell.waterBodyType === "DRY_LAND" ? "#7f8b62"
                    : "#b3c7db"
      );
    case "ocean":
      return cell.isOcean || cell.isSea ? "#2d79d0" : "#364730";
    case "watersheds":
      return categoricalHashColor(cell.watershedId);
    case "riverCandidates":
      return cell.isRiverCandidate ? "#55b4ef" : "#1b2028";
    case "lakeCandidates":
      return cell.isLakeCandidate ? "#8fd4ff" : "#1b2028";
    case "distanceToOcean":
      return sampleGradient(normalizeValue(cell.distanceToOcean, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#2d79d0" },
        { at: 0.3, color: "#78b5e8" },
        { at: 0.6, color: "#c5c98a" },
        { at: 1, color: "#9a7a48" },
      ]);
    case "atmosphere":
      return sampleGradient(normalizeValue(cell.atmosphericStability, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#3651c9" },
        { at: 0.5, color: "#f5efe5" },
        { at: 1, color: "#ce5e49" },
      ]);
    case "pressureZones":
      return PRESSURE_ZONE_COLORS[cell.pressureZone] ?? "#f4f1e8";
    case "windDirection": {
      const directionHue: Record<string, number> = {
        N: 215,
        NE: 250,
        E: 330,
        SE: 20,
        S: 40,
        SW: 95,
        W: 155,
        NW: 185,
        CALM: 0,
      };
      const hue = directionHue[cell.windDirection] ?? 0;
      return cell.windDirection === "CALM" ? "#b8c1cb" : `hsl(${hue} 64% 58%)`;
    }
    case "windStrength":
      return sampleGradient(normalizeValue(cell.windStrength, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#1b2d57" },
        { at: 0.3, color: "#3970cb" },
        { at: 0.7, color: "#d8b555" },
        { at: 1, color: "#f6efe3" },
      ]);
    case "moistureTransport":
      return sampleGradient(normalizeValue(cell.moistureTransportPotential, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#4e382a" },
        { at: 0.3, color: "#a37b4f" },
        { at: 0.65, color: "#69a56b" },
        { at: 1, color: "#0d6d50" },
      ]);
    case "rainShadow":
      return sampleGradient(normalizeValue(cell.rainShadowPotential, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#d7e8f7" },
        { at: 0.3, color: "#b1c8d8" },
        { at: 0.65, color: "#947051" },
        { at: 1, color: "#5d341f" },
      ]);
    case "weather":
    case "weatherType":
      return WEATHER_COLORS[cell.weatherType] ?? "#cfd5db";
    case "humidity":
      return sampleGradient(normalizeValue(cell.relativeHumidity, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#7b5839" },
        { at: 0.3, color: "#b99461" },
        { at: 0.6, color: "#79a85f" },
        { at: 1, color: "#1d6a3f" },
      ]);
    case "cloudCover":
      return sampleGradient(normalizeValue(cell.cloudCover, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#13223a" },
        { at: 0.45, color: "#64768a" },
        { at: 1, color: "#f0f5f8" },
      ]);
    case "stormPotential":
      return sampleGradient(normalizeValue(cell.stormPotential, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#243060" },
        { at: 0.5, color: "#5964b2" },
        { at: 1, color: "#8d44d4" },
      ]);
    case "snowPotential":
      return sampleGradient(normalizeValue(cell.snowPotential, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#18334f" },
        { at: 0.5, color: "#7db4dc" },
        { at: 1, color: "#f6fbff" },
      ]);
    case "fogPotential":
      return sampleGradient(normalizeValue(cell.fogPotential, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#33445b" },
        { at: 0.5, color: "#a2aeb8" },
        { at: 1, color: "#e5e7ea" },
      ]);
    case "dryness":
      return sampleGradient(normalizeValue(cell.drynessIndex, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#2a6f43" },
        { at: 0.5, color: "#a2b05a" },
        { at: 1, color: "#99623c" },
      ]);
    default:
      return "#3b4550";
  }
}

function getLegendItems(snapshot: AtlasSnapshot, layerId: LayerId): LegendItem[] {
  switch (layerId) {
    case "terrain":
    case "planet":
      return [
        { label: "Deep Ocean", color: TERRAIN_COLORS.DEEP_OCEAN },
        { label: "Ocean", color: TERRAIN_COLORS.OCEAN },
        { label: "Beach", color: TERRAIN_COLORS.BEACH },
        { label: "Plains", color: TERRAIN_COLORS.PLAINS },
        { label: "Mountains", color: TERRAIN_COLORS.MOUNTAINS },
        { label: "High Mountains", color: TERRAIN_COLORS.HIGH_MOUNTAINS },
      ];
    case "climate":
      return Object.entries(CLIMATE_COLORS).map(([label, color]) => ({ label, color }));
    case "pressureZones":
      return Object.entries(PRESSURE_ZONE_COLORS).map(([label, color]) => ({ label: titleize(label), color }));
    case "weather":
    case "weatherType":
      return Object.entries(WEATHER_COLORS).map(([label, color]) => ({ label: titleize(label), color }));
    case "watersheds":
      return snapshot.cells.slice(0, 6).map((cell) => ({
        label: cell.watershedId,
        color: categoricalHashColor(cell.watershedId),
      }));
    default: {
      const definition = getLayerDefinition(layerId);
      const range = getLayerRange(snapshot, layerId);

      if (!range) {
        return [{ label: definition.label, color: getLayerColor(snapshot, snapshot.cells[0], layerId) }];
      }

      const samples = [0, 0.25, 0.5, 0.75, 1];

      return samples.map((sample) => {
        const value = range.minimum + (range.maximum - range.minimum) * sample;
        const cell = snapshot.cells[Math.floor(sample * (snapshot.cells.length - 1))] ?? snapshot.cells[0];

        return {
          label: formatNumber(value, layerId === "averageTemperature" ? 1 : 2),
          color: getLayerColor(snapshot, { ...cell, averageTemperatureC: value, solarEnergy: value, daylightHours: value, windStrength: value, distanceToOcean: value, atmosphericStability: value, moistureTransportPotential: value, rainShadowPotential: value, relativeHumidity: value, cloudCover: value, stormPotential: value, snowPotential: value, fogPotential: value, drynessIndex: value, elevation: value } as AtlasCell, layerId),
        };
      });
    }
  }
}

function getWorldPixelSize(snapshot: AtlasSnapshot) {
  return {
    width: snapshot.grid.longitudeDivisions * MAP_CELL_SIZE,
    height: snapshot.grid.latitudeDivisions * MAP_CELL_SIZE,
  };
}

function createFitView(snapshot: AtlasSnapshot, width: number, height: number): AtlasView {
  const pixelSize = getWorldPixelSize(snapshot);
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 240);
  const scale = clamp(
    Math.min(
      (safeWidth - MAP_PADDING * 2) / pixelSize.width,
      (safeHeight - MAP_PADDING * 2) / pixelSize.height,
    ),
    MIN_SCALE,
    2.8,
  );

  return {
    scale,
    offsetX: (safeWidth - pixelSize.width * scale) / 2,
    offsetY: (safeHeight - pixelSize.height * scale) / 2,
  };
}

function getDisplayRow(snapshot: AtlasSnapshot, cell: AtlasCell): number {
  return snapshot.grid.latitudeDivisions - 1 - cell.row;
}

export function createAtlasCoordinateTransform(
  snapshot: AtlasSnapshot,
  view: AtlasView,
  cellWidth = MAP_CELL_SIZE,
  cellHeight = MAP_CELL_SIZE,
) {
  const worldToScreen = (col: number, row: number): ScreenPoint => ({
    x: view.offsetX + col * cellWidth * view.scale,
    y: view.offsetY + row * cellHeight * view.scale,
  });

  const cellRect = (cell: AtlasCell): ScreenCellRect => {
    const origin = worldToScreen(cell.column, getDisplayRow(snapshot, cell));

    return {
      x: origin.x,
      y: origin.y,
      width: cellWidth * view.scale,
      height: cellHeight * view.scale,
    };
  };

  const screenToWorld = (x: number, y: number): { col: number; row: number } => ({
    col: Math.floor((x - view.offsetX) / (cellWidth * view.scale)),
    row: Math.floor((y - view.offsetY) / (cellHeight * view.scale)),
  });

  return {
    worldToScreen,
    cellRect,
    screenToWorld,
    worldWidth: snapshot.grid.longitudeDivisions * cellWidth,
    worldHeight: snapshot.grid.latitudeDivisions * cellHeight,
  };
}

function windDirectionVector(direction: string): { x: number; y: number } {
  switch (direction) {
    case "N":
      return { x: 0, y: -1 };
    case "NE":
      return { x: 0.72, y: -0.72 };
    case "E":
      return { x: 1, y: 0 };
    case "SE":
      return { x: 0.72, y: 0.72 };
    case "S":
      return { x: 0, y: 1 };
    case "SW":
      return { x: -0.72, y: 0.72 };
    case "W":
      return { x: -1, y: 0 };
    case "NW":
      return { x: -0.72, y: -0.72 };
    default:
      return { x: 0, y: 0 };
  }
}

function drawArrow(context: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) {
  const headLength = 4;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();

  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
  context.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function getLayerStatistics(snapshot: AtlasSnapshot, layerId: LayerId): Array<{ label: string; value: string }> {
  const cells = snapshot.cells;

  if (cells.length === 0) {
    return [];
  }

  const overall = [
    { label: "Highest mountain", value: formatNumber(snapshot.statistics.highestElevation, 3) },
    { label: "Ocean %", value: `${formatNumber(snapshot.statistics.oceanPercent, 2)} %` },
    { label: "Largest watershed", value: `${snapshot.statistics.largestWatershedEstimate} cells` },
    { label: "Dominant weather", value: titleize(snapshot.statistics.dominantWeatherType) },
  ];

  switch (layerId) {
    case "averageTemperature":
      return [
        { label: "Average temperature", value: formatTemperature(snapshot.statistics.averageTemperatureC) },
        { label: "Equator average", value: formatTemperature(snapshot.climate.summary.equatorAverageTemperatureC) },
        { label: "Pole average", value: formatTemperature(snapshot.climate.summary.averagePoleTemperatureC) },
        ...overall,
      ];
    case "solarEnergy":
      return [
        { label: "Average solar energy", value: formatNumber(snapshot.statistics.averageSolarEnergy, 3) },
        { label: "Season north", value: titleize(snapshot.climate.seasonNorthernHemisphere) },
        { label: "Season south", value: titleize(snapshot.climate.seasonSouthernHemisphere) },
        ...overall,
      ];
    case "daylightHours":
      return [
        { label: "Average daylight", value: `${formatNumber(snapshot.statistics.averageDaylightHours, 2)} h` },
        { label: "Solar declination", value: `${formatNumber(snapshot.astronomy.solarDeclinationDegrees, 2)} deg` },
        { label: "Day of year", value: String(snapshot.selectedDay) },
        ...overall,
      ];
    case "windStrength":
    case "windDirection":
      return [
        {
          label: "Strongest wind",
          value: snapshot.statistics.strongestWind
            ? `${snapshot.statistics.strongestWind.windDirection} ${formatNumber(snapshot.statistics.strongestWind.windStrength, 3)}`
            : "-",
        },
        { label: "Average wind", value: formatNumber(snapshot.atmosphereSummary.averageWindSpeed, 3) },
        { label: "Circulation", value: snapshot.atmosphereSummary.dominantCirculationPattern },
        ...overall,
      ];
    case "humidity":
    case "cloudCover":
    case "stormPotential":
    case "snowPotential":
    case "fogPotential":
    case "dryness":
    case "weather":
    case "weatherType":
      return [
        { label: "Average humidity", value: formatPercent(snapshot.weatherSummary.averageHumidity) },
        { label: "Average cloud cover", value: formatPercent(snapshot.weatherSummary.averageCloudCover) },
        { label: "Average dryness", value: formatPercent(snapshot.weatherSummary.averageDryness) },
        ...overall,
      ];
    case "watersheds":
      return [
        { label: "Largest watershed", value: `${snapshot.hydrologySummary.largestWatershedEstimate} cells` },
        { label: "Largest basin", value: `${snapshot.hydrologySummary.largestBasinEstimate} cells` },
        { label: "Ocean cells", value: String(snapshot.hydrologySummary.oceanCells) },
        ...overall,
      ];
    default:
      return overall;
  }
}

function getTooltipSummary(cell: AtlasCell) {
  return {
    hydrology: `${titleize(cell.waterBodyType)} / ws ${cell.watershedId}`,
    atmosphere: `${titleize(cell.pressureZone)} / ${cell.windDirection} ${formatNumber(cell.windStrength, 2)}`,
    weather: `${titleize(cell.weatherType)} / humidity ${formatPercent(cell.relativeHumidity)}`,
  };
}

async function fetchAtlasSnapshotFromApi(worldId: string, day: number): Promise<AtlasSnapshot> {
  const response = await fetch(`/api/worlds/map?world=${encodeURIComponent(worldId)}&day=${day}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Atlas request failed: ${response.status}`);
  }

  return response.json() as Promise<AtlasSnapshot>;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm text-stone-100">{value}</p>
    </div>
  );
}
function IntegrityRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
      <span className="text-stone-200">{label}</span>
      <span className={ok ? "text-amber-200" : "text-red-200"}>{ok ? "OK" : "Mismatch"}</span>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.35em] text-amber-300/75">{eyebrow}</p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-stone-50">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-stone-300">{description}</p>
    </div>
  );
}

export function WorldMapAtlasClient({
  worlds,
  initialSnapshot,
  fetchSnapshot = fetchAtlasSnapshotFromApi,
}: WorldMapAtlasClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedLayerId, setSelectedLayerId] = useState<LayerId>("planet");
  const [selectedWorldId, setSelectedWorldId] = useState(initialSnapshot.worldId);
  const [requestedDay, setRequestedDay] = useState(initialSnapshot.selectedDay);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const [autoOverlayMask, setAutoOverlayMask] = useState<Record<OverlayId, boolean>>({
    latitudeBands: true,
    windArrows: true,
    watershedBoundaries: true,
    coastlines: true,
    gridLines: true,
    cellIds: true,
    neighborLinks: true,
    drainageArrows: true,
    pressureBands: true,
    mountainOutlines: true,
  });
  const [canvasSize, setCanvasSize] = useState({ width: 1120, height: 680 });
  const [view, setView] = useState(() => createFitView(initialSnapshot, 1120, 680));
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [legendPinned, setLegendPinned] = useState(false);
  const [legendOpacity, setLegendOpacity] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<Array<{ q: string; pinned?: boolean; at: number }>>([]);
  const [isPending, startTransition] = useTransition();
  const deferredRequestedDay = useDeferredValue(requestedDay);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const cellByIdRef = useRef(new Map<string, AtlasCell>());
  const cellByGridKeyRef = useRef(new Map<string, AtlasCell>());
  const baseLayerBufferRef = useRef<HTMLCanvasElement | null>(null);
  const baseLayerCacheKeyRef = useRef<string>("");
  const continentCacheRef = useRef<{ land?: { id: number; center: { row: number; column: number }; size: number }; ocean?: { id: number; center: { row: number; column: number }; size: number } } | null>(null);

  const selectedWorld = worlds.find((world) => world.id === selectedWorldId) ?? worlds[0];
  const selectedCell = selectedCellId ? cellByIdRef.current.get(selectedCellId) ?? null : null;
  const hoveredCell = hoverState ? cellByIdRef.current.get(hoverState.cellId) ?? null : null;

  useEffect(() => {
    cellByIdRef.current = new Map(snapshot.cells.map((cell) => [cell.id, cell]));
    cellByGridKeyRef.current = new Map(snapshot.cells.map((cell) => [`${getDisplayRow(snapshot, cell)}:${cell.column}`, cell]));
    continentCacheRef.current = null;
  }, [snapshot]);

  useEffect(() => {
    if (!selectedCellId) {
      return;
    }

    if (!cellByIdRef.current.has(selectedCellId)) {
      setSelectedCellId(null);
    }
  }, [selectedCellId, snapshot]);

  useEffect(() => {
    setView(createFitView(snapshot, canvasSize.width, canvasSize.height));
  }, [canvasSize.height, canvasSize.width, snapshot.grid.latitudeDivisions, snapshot.grid.longitudeDivisions, snapshot.worldId]);

  useEffect(() => {
    const host = canvasHostRef.current;

    if (!host) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      setCanvasSize({ width: host.clientWidth || 1120, height: host.clientHeight || 680 });
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      setCanvasSize({
        width: Math.max(480, Math.floor(entry.contentRect.width)),
        height: Math.max(360, Math.floor(entry.contentRect.height)),
      });
    });

    observer.observe(host);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;

      setView((current) => {
        const worldX = (cursorX - current.offsetX) / current.scale;
        const worldY = (cursorY - current.offsetY) / current.scale;
        const scaleDelta = event.deltaY < 0 ? 1.12 : 0.89;
        const nextScale = clamp(current.scale * scaleDelta, MIN_SCALE, MAX_SCALE);

        return {
          scale: nextScale,
          offsetX: cursorX - worldX * nextScale,
          offsetY: cursorY - worldY * nextScale,
        };
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  // Auto overlay scaling based on zoom and world size
  useEffect(() => {
    const total = snapshot.grid.totalCells;
    const scale = view.scale;
    const far = scale < 0.6;
    const medium = scale >= 0.6 && scale <= 1.2;
    const close = scale > 1.2;

    const mask: Record<OverlayId, boolean> = { ...autoOverlayMask };

    // Defaults
    mask.gridLines = close;
    mask.cellIds = close && total <= 64 * 128; // hide IDs on larger worlds
    mask.neighborLinks = close && total <= 64 * 128;
    mask.drainageArrows = close && total <= 256 * 512;
    mask.windArrows = medium || close;
    mask.pressureBands = medium || close;
    mask.watershedBoundaries = medium || close;
    mask.coastlines = medium || close;
    mask.latitudeBands = !close; // helpful when zoomed out
    mask.mountainOutlines = medium || close;

    // Very large worlds
    if (total >= 256 * 512) {
      mask.cellIds = false;
      mask.neighborLinks = false;
    }
    if (total >= 1024 * 2048) {
      // keep only minimal overlays even at close zoom
      mask.gridLines = false;
      mask.drainageArrows = false;
      mask.windArrows = medium || close;
    }

    // Far zoom: reduce to essentials
    if (far) {
      mask.windArrows = false;
      mask.watershedBoundaries = false;
      mask.pressureBands = false;
      mask.coastlines = true; // coastlines are useful outline
      mask.mountainOutlines = false;
      mask.gridLines = false;
      mask.cellIds = false;
      mask.neighborLinks = false;
      mask.drainageArrows = false;
    }

    setAutoOverlayMask(mask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.grid.totalCells, view.scale]);

  const loadSnapshot = useEffectEvent(async (worldId: string, day: number) => {
    try {
      setError(null);
      const nextSnapshot = await fetchSnapshot(worldId, day);
      setSnapshot(nextSnapshot);
      setSelectedWorldId(nextSnapshot.worldId);
      setRequestedDay(nextSnapshot.selectedDay);
      setSelectedCellId(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load atlas snapshot.");
    }
  });

  useEffect(() => {
    if (selectedWorldId === snapshot.worldId && deferredRequestedDay === snapshot.selectedDay) {
      return;
    }

    startTransition(() => {
      void loadSnapshot(selectedWorldId, deferredRequestedDay);
    });
  }, [deferredRequestedDay, loadSnapshot, selectedWorldId, snapshot.selectedDay, snapshot.worldId]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    query.set("world", snapshot.worldId);
    query.set("day", String(snapshot.selectedDay));
    const nextUrl = `${window.location.pathname}?${query.toString()}`;

    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [snapshot.selectedDay, snapshot.worldId]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#071017";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const transform = createAtlasCoordinateTransform(snapshot, view);
    const mapOrigin = transform.worldToScreen(0, 0);

    // Draw base layer from cached buffer with the same viewport transform used by overlays.
    const base = baseLayerBufferRef.current;
    if (base && typeof (context as any).drawImage === "function") {
      (context as any).drawImage(base, mapOrigin.x, mapOrigin.y, base.width * view.scale, base.height * view.scale);
    } else {
      // Fallback for testing contexts without drawImage.
      for (const cell of snapshot.cells) {
        const rect = transform.cellRect(cell);
        context.fillStyle = getLayerColor(snapshot, cell, selectedLayerId);
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }

    const isOverlayVisible = (key: OverlayId) => overlays[key] && autoOverlayMask[key];

    if (isOverlayVisible("pressureBands")) {
      for (const cell of snapshot.cells) {
        const rect = transform.cellRect(cell);
        context.fillStyle = `${PRESSURE_ZONE_COLORS[cell.pressureZone] ?? "#ffffff"}33`;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }

    if (isOverlayVisible("watershedBoundaries")) {
      context.strokeStyle = "rgba(255,255,255,0.35)";
      context.lineWidth = 1;

      for (const cell of snapshot.cells) {
        const rect = transform.cellRect(cell);
        const displayRow = getDisplayRow(snapshot, cell);
        const rightNeighbor = cellByGridKeyRef.current.get(`${displayRow}:${cell.column + 1}`);
        const bottomNeighbor = cellByGridKeyRef.current.get(`${displayRow + 1}:${cell.column}`);

        if (rightNeighbor && rightNeighbor.watershedId !== cell.watershedId) {
          context.beginPath();
          context.moveTo(rect.x + rect.width, rect.y);
          context.lineTo(rect.x + rect.width, rect.y + rect.height);
          context.stroke();
        }

        if (bottomNeighbor && bottomNeighbor.watershedId !== cell.watershedId) {
          context.beginPath();
          context.moveTo(rect.x, rect.y + rect.height);
          context.lineTo(rect.x + rect.width, rect.y + rect.height);
          context.stroke();
        }
      }
    }

    if (isOverlayVisible("coastlines")) {
      context.strokeStyle = "rgba(254, 234, 189, 0.8)";
      context.lineWidth = 1.6;

      for (const cell of snapshot.cells) {
        if (!cell.isCoast) {
          continue;
        }

        const rect = transform.cellRect(cell);
        context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
      }
    }

    if (isOverlayVisible("mountainOutlines")) {
      context.strokeStyle = "rgba(255,255,255,0.5)";
      context.lineWidth = 1.2;

      for (const cell of snapshot.cells) {
        if (!["MOUNTAINS", "HIGH_MOUNTAINS", "PLATEAU"].includes(cell.terrainType)) {
          continue;
        }

        const rect = transform.cellRect(cell);
        context.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
      }
    }

    if (isOverlayVisible("gridLines")) {
      const topLeft = transform.worldToScreen(0, 0);
      const bottomRight = transform.worldToScreen(snapshot.grid.longitudeDivisions, snapshot.grid.latitudeDivisions);
      context.strokeStyle = "rgba(255,255,255,0.12)";
      context.lineWidth = 1;

      for (let column = 0; column <= snapshot.grid.longitudeDivisions; column += 1) {
        const x = transform.worldToScreen(column, 0).x;
        context.beginPath();
        context.moveTo(x, topLeft.y);
        context.lineTo(x, bottomRight.y);
        context.stroke();
      }

      for (let row = 0; row <= snapshot.grid.latitudeDivisions; row += 1) {
        const y = transform.worldToScreen(0, row).y;
        context.beginPath();
        context.moveTo(topLeft.x, y);
        context.lineTo(bottomRight.x, y);
        context.stroke();
      }
    }

    if (isOverlayVisible("latitudeBands")) {
      const left = transform.worldToScreen(0, 0).x;
      const right = transform.worldToScreen(snapshot.grid.longitudeDivisions, 0).x;
      context.strokeStyle = "rgba(255,255,255,0.18)";
      context.fillStyle = "rgba(255,255,255,0.75)";
      context.lineWidth = 1;
      context.font = "10px var(--font-sans)";

      for (let row = 0; row <= snapshot.grid.latitudeDivisions; row += 1) {
        const y = transform.worldToScreen(0, row).y;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(right, y);
        context.stroke();

        if (row < snapshot.grid.latitudeDivisions) {
          const latitude = 90 - (row + 0.5) * snapshot.grid.cellHeightDegrees;
          context.fillText(formatLatitude(latitude), left + 4, y + 12);
        }
      }
    }

    if (isOverlayVisible("windArrows") || selectedLayerId === "windDirection") {
      context.strokeStyle = "rgba(10,12,20,0.7)";
      context.fillStyle = "rgba(10,12,20,0.7)";
      context.lineWidth = 1.1;

      for (const cell of snapshot.cells) {
        if (cell.windDirection === "CALM") {
          continue;
        }

        const rect = transform.cellRect(cell);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const vector = windDirectionVector(cell.windDirection);
        const length = Math.min(rect.width, rect.height) * (0.22 + cell.windStrength * 0.36);
        drawArrow(context, centerX, centerY, centerX + vector.x * length, centerY + vector.y * length);
      }
    }

    if (isOverlayVisible("drainageArrows")) {
      context.strokeStyle = "rgba(127, 221, 255, 0.75)";
      context.fillStyle = "rgba(127, 221, 255, 0.75)";
      context.lineWidth = 0.9;

      for (const cell of snapshot.cells) {
        if (!cell.drainageTargetId) {
          continue;
        }

        const target = cellByIdRef.current.get(cell.drainageTargetId);

        if (!target) {
          continue;
        }

        const from = transform.cellRect(cell);
        const to = transform.cellRect(target);
        drawArrow(
          context,
          from.x + from.width / 2,
          from.y + from.height / 2,
          to.x + to.width / 2,
          to.y + to.height / 2,
        );
      }
    }

    if (selectedCell && isOverlayVisible("neighborLinks")) {
      const rect = transform.cellRect(selectedCell);
      context.strokeStyle = "rgba(255, 209, 112, 0.95)";
      context.lineWidth = 1.2;

      for (const neighborId of selectedCell.neighbors) {
        const neighbor = cellByIdRef.current.get(neighborId);

        if (!neighbor) {
          continue;
        }

        const neighborRect = transform.cellRect(neighbor);
        context.beginPath();
        context.moveTo(rect.x + rect.width / 2, rect.y + rect.height / 2);
        context.lineTo(neighborRect.x + neighborRect.width / 2, neighborRect.y + neighborRect.height / 2);
        context.stroke();
      }
    }

    if (isOverlayVisible("cellIds")) {
      context.fillStyle = "rgba(255,255,255,0.8)";
      context.font = `${Math.max(7, 8 * view.scale)}px var(--font-sans)`;

      for (const cell of snapshot.cells) {
        const rect = transform.cellRect(cell);
        context.fillText(cell.id.replace("cell-", ""), rect.x + 2 * view.scale, rect.y + 10 * view.scale);
      }
    }

    if (selectedCell) {
      const rect = transform.cellRect(selectedCell);
      context.strokeStyle = "#ffd071";
      context.lineWidth = 2.2;
      context.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    }

    if (hoveredCell) {
      const rect = transform.cellRect(hoveredCell);
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1.8;
      context.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    }
  }, [autoOverlayMask, canvasSize.height, canvasSize.width, hoveredCell, overlays, selectedCell, selectedLayerId, snapshot, view]);

  // Build base layer buffer when snapshot or layer changes
  useEffect(() => {
    const key = `${snapshot.worldId}:${snapshot.selectedDay}:${selectedLayerId}:${snapshot.grid.latitudeDivisions}x${snapshot.grid.longitudeDivisions}`;
    if (baseLayerCacheKeyRef.current === key && baseLayerBufferRef.current) {
      return;
    }

    const size = getWorldPixelSize(snapshot);
    const buffer = document.createElement("canvas");
    buffer.width = size.width;
    buffer.height = size.height;
    const ctx = buffer.getContext("2d");
    if (!ctx) {
      return;
    }
    const transform = createAtlasCoordinateTransform(snapshot, { scale: 1, offsetX: 0, offsetY: 0 });

    for (const cell of snapshot.cells) {
      const rect = transform.cellRect(cell);
      ctx.fillStyle = getLayerColor(snapshot, cell, selectedLayerId);
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    baseLayerBufferRef.current = buffer;
    baseLayerCacheKeyRef.current = key;
  }, [selectedLayerId, snapshot]);

  const onLayerSelect = (layerId: LayerId) => {
    if (getLayerDefinition(layerId).disabled) {
      return;
    }

    setSelectedLayerId(layerId);
  };

  const onToggleOverlay = (overlayId: OverlayId) => {
    setOverlays((current) => ({ ...current, [overlayId]: !current[overlayId] }));
  };

  // Toolbar actions and helpers
  const resetView = () => setView(createFitView(snapshot, canvasSize.width, canvasSize.height));

  const focusCell = (cell: AtlasCell, scale = DEFAULT_CELL_FOCUS_SCALE) => {
    setSelectedCellId(cell.id);
    const worldTransform = createAtlasCoordinateTransform(snapshot, { scale: 1, offsetX: 0, offsetY: 0 });
    const rect = worldTransform.cellRect(cell);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const nextScale = clamp(scale, MIN_SCALE, MAX_SCALE);
    setView({
      scale: nextScale,
      offsetX: canvasSize.width / 2 - centerX * nextScale,
      offsetY: canvasSize.height / 2 - centerY * nextScale,
    });
  };

  const centerOnLatitude = (latitude: number) => {
    const displayRow = clamp(Math.floor((90 - latitude) / snapshot.grid.cellHeightDegrees), 0, snapshot.grid.latitudeDivisions - 1);
    const worldTransform = createAtlasCoordinateTransform(snapshot, { scale: 1, offsetX: 0, offsetY: 0 });
    const y = worldTransform.worldToScreen(0, displayRow + 0.5).y;
    setView((current) => ({ ...current, offsetY: canvasSize.height / 2 - y * current.scale }));
  };

  const centerOnLongitude = (longitude: number) => {
    const column = clamp(Math.floor((longitude + 180) / snapshot.grid.cellWidthDegrees), 0, snapshot.grid.longitudeDivisions - 1);
    const worldTransform = createAtlasCoordinateTransform(snapshot, { scale: 1, offsetX: 0, offsetY: 0 });
    const x = worldTransform.worldToScreen(column + 0.5, 0).x;
    setView((current) => ({ ...current, offsetX: canvasSize.width / 2 - x * current.scale }));
  };

  const findCellByLatLon = (lat: number, lon: number): AtlasCell | null => {
    const row = clamp(Math.floor((90 - lat) / snapshot.grid.cellHeightDegrees), 0, snapshot.grid.latitudeDivisions - 1);
    const col = clamp(Math.floor((lon + 180) / snapshot.grid.cellWidthDegrees), 0, snapshot.grid.longitudeDivisions - 1);
    return cellByGridKeyRef.current.get(`${row}:${col}`) ?? null;
  };

  // Quick navigation computations (with simple caching for largest components)
  const getLargestComponentCenter = (predicate: (c: AtlasCell) => boolean) => {
    const visited = new Set<string>();
    let bestSize = 0;
    let bestCenter: { row: number; column: number } | null = null;

    for (const cell of snapshot.cells) {
      if (!predicate(cell) || visited.has(cell.id)) continue;
      // BFS
      const queue = [cell];
      visited.add(cell.id);
      let sumRow = 0;
      let sumCol = 0;
      let count = 0;
      while (queue.length) {
        const current = queue.shift()!;
        sumRow += current.row;
        sumCol += current.column;
        count += 1;
        for (const nId of current.neighbors) {
          const n = cellByIdRef.current.get(nId);
          if (!n || visited.has(n.id) || !predicate(n)) continue;
          visited.add(n.id);
          queue.push(n);
        }
      }
      if (count > bestSize) {
        bestSize = count;
        bestCenter = { row: Math.round(sumRow / count), column: Math.round(sumCol / count) };
      }
    }

    if (!bestCenter) return null;
    return cellByGridKeyRef.current.get(`${getDisplayRow(snapshot, { ...snapshot.cells[0], row: bestCenter.row, column: bestCenter.column } as AtlasCell)}:${bestCenter.column}`) ?? null;
  };

  const quickNavActions: Record<string, () => void> = {
    NorthPole: () => centerOnLatitude(89.9),
    SouthPole: () => centerOnLatitude(-89.9),
    Equator: () => centerOnLatitude(0),
    PrimeMeridian: () => centerOnLongitude(0),
    HighestMountain: () => {
      const cell = snapshot.cells.reduce((a, b) => (b.elevation > a.elevation ? b : a), snapshot.cells[0]);
      focusCell(cell, 1.8);
    },
    LowestPoint: () => {
      const cell = snapshot.cells.reduce((a, b) => (b.elevation < a.elevation ? b : a), snapshot.cells[0]);
      focusCell(cell, 1.8);
    },
    LargestWatershed: () => {
      const counts = new Map<string, number>();
      for (const c of snapshot.cells) counts.set(c.watershedId, (counts.get(c.watershedId) ?? 0) + 1);
      let bestId = ""; let best = 0;
      for (const [id, n] of counts) if (n > best) { best = n; bestId = id; }
      const cell = snapshot.cells.find((c) => c.watershedId === bestId) ?? snapshot.cells[0];
      focusCell(cell, 1.2);
    },
    LargestBasin: () => {
      const counts = new Map<string, number>();
      for (const c of snapshot.cells) if (c.basinId) counts.set(c.basinId, (counts.get(c.basinId) ?? 0) + 1);
      let bestId: string | null = null; let best = 0;
      for (const [id, n] of counts) if (n > best) { best = n; bestId = id; }
      const cell = snapshot.cells.find((c) => c.basinId === bestId) ?? snapshot.cells[0];
      focusCell(cell, 1.2);
    },
    WettestCell: () => focusCell(snapshot.cells.reduce((a, b) => (b.relativeHumidity > a.relativeHumidity ? b : a), snapshot.cells[0]), 1.6),
    DriestCell: () => focusCell(snapshot.cells.reduce((a, b) => (b.drynessIndex > a.drynessIndex ? b : a), snapshot.cells[0]), 1.6),
    WarmestCell: () => focusCell(snapshot.cells.reduce((a, b) => (b.averageTemperatureC > a.averageTemperatureC ? b : a), snapshot.cells[0]), 1.6),
    ColdestCell: () => focusCell(snapshot.cells.reduce((a, b) => (b.averageTemperatureC < a.averageTemperatureC ? b : a), snapshot.cells[0]), 1.6),
    StrongestWind: () => focusCell(snapshot.cells.reduce((a, b) => (b.windStrength > a.windStrength ? b : a), snapshot.cells[0]), 1.6),
    LargestRainShadow: () => focusCell(snapshot.cells.reduce((a, b) => (b.rainShadowPotential > a.rainShadowPotential ? b : a), snapshot.cells[0]), 1.6),
    LargestContinent: () => {
      const cell = getLargestComponentCenter((c) => !c.isOcean && !c.isSea) ?? snapshot.cells[0];
      focusCell(cell, 1.2);
    },
    LargestOcean: () => {
      const cell = getLargestComponentCenter((c) => c.isOcean || c.isSea) ?? snapshot.cells[0];
      focusCell(cell, 1.2);
    },
  };

  // Search parsing and history
  useEffect(() => {
    try {
      const raw = localStorage.getItem("atlasSearchHistory");
      if (raw) setSearchHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const saveSearch = (q: string, pinned?: boolean) => {
    setSearchHistory((current) => {
      const next = [{ q, pinned, at: Date.now() }, ...current.filter((h) => h.q !== q)].slice(0, 10);
      try { localStorage.setItem("atlasSearchHistory", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleSearch = (raw: string) => {
    const q = raw.trim();
    if (!q) return;

    // Cell ID
    const cellMatch = q.match(/^cell[-_]?(\d{1,3})[-_](\d{1,3})$/i);
    if (cellMatch) {
      const id = `cell-${cellMatch[1].padStart(2, "0")}-${cellMatch[2].padStart(2, "0")}`;
      const cell = cellByIdRef.current.get(id);
      if (cell) {
        focusCell(cell);
        saveSearch(q);
        setShowSearch(false);
        return;
      }
    }

    // Latitude keywords
    const keyword = q.toLowerCase();
    if (["equator", "0"].includes(keyword)) {
      centerOnLatitude(0);
      saveSearch(q);
      setShowSearch(false);
      return;
    }
    if (keyword === "north pole") { centerOnLatitude(89.9); saveSearch(q); setShowSearch(false); return; }
    if (keyword === "south pole") { centerOnLatitude(-89.9); saveSearch(q); setShowSearch(false); return; }

    const latOnly = q.match(/^(-?\d{1,2})(?:\s*[Â°deg])?\s*([ns])?$/i);
    if (latOnly) {
      const v = Number(latOnly[1]);
      const hemi = latOnly[2]?.toLowerCase();
      const lat = hemi === "s" ? -Math.abs(v) : Math.abs(v);
      centerOnLatitude(lat);
      saveSearch(q);
      setShowSearch(false);
      return;
    }

    // Coordinates
    const coordMatch = q.match(/^\s*([+-]?\d{1,2})(?:\s*[Â°]?)\s*([ns])?\s*,\s*([+-]?\d{1,3})(?:\s*[Â°]?)\s*([ew])?\s*$/i);
    if (coordMatch) {
      const latNum = Number(coordMatch[1]);
      const latH = coordMatch[2]?.toLowerCase();
      const lonNum = Number(coordMatch[3]);
      const lonH = coordMatch[4]?.toLowerCase();
      const lat = latH === "s" ? -Math.abs(latNum) : Math.abs(latNum);
      const lon = lonH === "w" ? -Math.abs(lonNum) : Math.abs(lonNum);
      const cell = findCellByLatLon(lat, lon);
      if (cell) {
        focusCell(cell);
        saveSearch(q);
        setShowSearch(false);
        return;
      }
    }

    // Fallback: try quick nav by name
    const quick = quickNavActions[q.replace(/\s+/g, "") as keyof typeof quickNavActions];
    if (quick) {
      quick();
      saveSearch(q);
      setShowSearch(false);
      return;
    }

    setError("No matching cell or location for search.");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (k === "f") { e.preventDefault(); setShowSearch((v) => !v); return; }
      if (k === "l") { e.preventDefault(); setShowLegend((v) => !v); return; }
      if (k === "o") { e.preventDefault(); onToggleOverlay("windArrows"); return; }
      if (k === "g") { e.preventDefault(); onToggleOverlay("gridLines"); return; }
      if (k === "w") { e.preventDefault(); onToggleOverlay("windArrows"); return; }
      if (k === "t") { e.preventDefault(); setSelectedLayerId("terrain"); return; }
      if (k === "c") { e.preventDefault(); setSelectedLayerId("climate"); return; }
      if (k === "h") { e.preventDefault(); setSelectedLayerId("hydrology"); return; }
      if (k === "a") { e.preventDefault(); setSelectedLayerId("atmosphere"); return; }
      if (k === "e") { e.preventDefault(); setSelectedLayerId("weather"); return; }
      if (e.code === "Space") { e.preventDefault(); resetView(); return; }
      if (e.key === "Escape") { setSelectedCellId(null); setShowSearch(false); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const getCellAtClientPosition = (clientX: number, clientY: number): AtlasCell | null => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const transform = createAtlasCoordinateTransform(snapshot, view);
    const { col, row } = transform.screenToWorld(clientX - rect.left, clientY - rect.top);

    if (col < 0 || col >= snapshot.grid.longitudeDivisions || row < 0 || row >= snapshot.grid.latitudeDivisions) {
      return null;
    }

    return cellByGridKeyRef.current.get(`${row}:${col}`) ?? null;
  };

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragStateRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const cell = getCellAtClientPosition(event.clientX, event.clientY);

    if (cell) {
      setHoverState({ cellId: cell.id, x: event.clientX, y: event.clientY });
    } else {
      setHoverState(null);
    }

    const drag = dragStateRef.current;

    if (!drag || drag.pointerId !== event.pointerId || event.buttons === 0) {
      return;
    }

    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragStateRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setView((current) => ({ ...current, offsetX: current.offsetX + deltaX, offsetY: current.offsetY + deltaY }));
  };

  const onCanvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    const cell = getCellAtClientPosition(event.clientX, event.clientY);

    if (drag && Math.abs(event.clientX - drag.x) < 2 && Math.abs(event.clientY - drag.y) < 2 && cell) {
      setSelectedCellId(cell.id);
    }

    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = getCellAtClientPosition(event.clientX, event.clientY);

    if (cell) {
      setSelectedCellId(cell.id);
    }
  };

  const onCanvasPointerLeave = () => {
    setHoverState(null);
    dragStateRef.current = null;
  };

  const selectedLayer = getLayerDefinition(selectedLayerId);
  const tooltipSummary = hoveredCell ? getTooltipSummary(hoveredCell) : null;
  const activeStatistics = getLayerStatistics(snapshot, selectedLayerId);
  const legendItems = getLegendItems(snapshot, selectedLayerId);
  const inspectorCell = selectedCell ?? hoveredCell;
  return (
    <main className="min-h-screen bg-[#060708] px-4 py-6 text-stone-100 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,210,113,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(78,123,183,0.22),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <SectionHeading
              eyebrow="Developer Atlas"
              title="Planet Visualization Engine"
              description="Inspect every deterministic simulation layer directly on the planetary grid. The atlas only visualizes existing simulation output and recomputes seasonal snapshots through the current engines."
            />
            <div className="flex flex-wrap gap-3">
              <Link href="/worlds" className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-200 transition hover:bg-white/10">World Dashboard</Link>
              <Link href="/worlds/grid" className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-200 transition hover:bg-white/10">Grid Inspector</Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr] xl:grid-cols-[1.8fr_1.1fr]">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailCard label="World" value={snapshot.worldName} />
              <DetailCard label="Day" value={`${snapshot.selectedDay} / ${snapshot.yearLengthDays}`} />
              <DetailCard label="Season North" value={titleize(snapshot.climate.seasonNorthernHemisphere)} />
              <DetailCard label="Season South" value={titleize(snapshot.climate.seasonSouthernHemisphere)} />
              <DetailCard label="Solar Declination" value={`${formatNumber(snapshot.astronomy.solarDeclinationDegrees, 2)} deg`} />
              <DetailCard label="Grid" value={`${snapshot.grid.totalCells} cells`} />
              <DetailCard label="Status" value={selectedWorld.status} />
              <DetailCard label="Focused Layer" value={selectedLayer.label} />
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              {/* Toolbar */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button type="button" data-testid="toolbar-search" onClick={() => setShowSearch((v) => !v)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Search (F)</button>
                <button type="button" onClick={() => setShowLegend((v) => !v)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Legend (L)</button>
                <button type="button" onClick={() => onToggleOverlay("gridLines")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Grid (G)</button>
                <button type="button" onClick={() => onToggleOverlay("windArrows")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Wind (W)</button>
                <button type="button" onClick={() => setSelectedLayerId("terrain")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Terrain (T)</button>
                <button type="button" onClick={() => setSelectedLayerId("climate")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Climate (C)</button>
                <button type="button" onClick={() => setSelectedLayerId("hydrology")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Hydrology (H)</button>
                <button type="button" onClick={() => setSelectedLayerId("atmosphere")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Atmosphere (A)</button>
                <button type="button" onClick={() => setSelectedLayerId("weather")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Weather (E)</button>
                <button type="button" onClick={resetView} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Reset (Space)</button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Timeline</p>
                  <p className="mt-2 text-sm text-stone-300">Drag through the configured year. Seasonal climate, atmosphere, and weather are recomputed from existing engines for the selected day.</p>
                </div>
                <p className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-100">{isPending ? "Updating" : "Stable"}</p>
              </div>
              <div className="mt-4">
                <input
                  data-testid="time-slider"
                  type="range"
                  aria-label="Simulation day"
                  min={1}
                  max={selectedWorld.yearLengthDays}
                  value={requestedDay}
                  onChange={(event) => setRequestedDay(Number(event.target.value))}
                  className="w-full accent-amber-300"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
                  <span>Day 1</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-stone-200">Selected Day {requestedDay}</span>
                  <span>Day {selectedWorld.yearLengthDays}</span>
                </div>
              </div>
              {/* Quick Navigation */}
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Quick Navigation</p>
                <div className="mt-2 flex flex-wrap gap-2" data-testid="quick-nav">
                  {[
                    ["North Pole","NorthPole"], ["South Pole","SouthPole"], ["Equator","Equator"], ["Prime Meridian","PrimeMeridian"],
                    ["Highest Mountain","HighestMountain"], ["Lowest Point","LowestPoint"], ["Largest Continent","LargestContinent"], ["Largest Ocean","LargestOcean"],
                    ["Largest Watershed","LargestWatershed"], ["Largest Basin","LargestBasin"], ["Wettest Cell","WettestCell"], ["Driest Cell","DriestCell"],
                    ["Warmest Cell","WarmestCell"], ["Coldest Cell","ColdestCell"], ["Strongest Wind","StrongestWind"], ["Largest Rain Shadow","LargestRainShadow"],
                  ].map(([label, key]) => (
                    <button key={String(key)} type="button" data-testid={`nav-${String(key)}`} onClick={() => quickNavActions[String(key) as keyof typeof quickNavActions]()} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200 hover:bg-white/10">{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_420px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Controls</p>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.22em] text-stone-500">World</span>
                      <select
                        value={selectedWorldId}
                        onChange={(event) => {
                          const nextWorld = worlds.find((world) => world.id === event.target.value) ?? worlds[0];
                          const clampedDay = clamp(requestedDay, 1, nextWorld.yearLengthDays);
                          setSelectedWorldId(nextWorld.id);
                          setRequestedDay(clampedDay);
                        }}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0c1218] px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-amber-300/50"
                      >
                        {worlds.map((world) => (
                          <option key={world.id} value={world.id}>{world.name}</option>
                        ))}
                      </select>
                    </label>

                    <div>
                      <span className="text-xs uppercase tracking-[0.22em] text-stone-500">Layer Selector</span>
                      <div className="mt-2 grid gap-2">
                        {Array.from(new Set(LAYERS.map((layer) => layer.group))).map((group) => (
                          <div key={group} className="rounded-2xl border border-white/10 bg-[#0c1218] p-2">
                            <p className="px-2 pt-1 text-[10px] uppercase tracking-[0.26em] text-stone-500">{group}</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                              {LAYERS.filter((layer) => layer.group === group).map((layer) => {
                                const active = selectedLayerId === layer.id;

                                return (
                                  <button
                                    key={layer.id}
                                    type="button"
                                    data-testid={`layer-${layer.id}`}
                                    disabled={layer.disabled}
                                    onClick={() => onLayerSelect(layer.id)}
                                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${layer.disabled
                                      ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-stone-600"
                                      : active
                                        ? "border-amber-300/45 bg-amber-300/12 text-amber-100"
                                        : "border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.07]"}`}
                                  >
                                    <span className="block">{layer.label}</span>
                                    <span className="mt-1 block text-xs text-stone-500">{layer.description}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs uppercase tracking-[0.22em] text-stone-500">Debug Tools</span>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        {(Object.keys(OVERLAY_TOGGLE_LABELS) as OverlayId[]).map((overlayId) => (
                          <label key={overlayId} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-200">
                            <span>{OVERLAY_TOGGLE_LABELS[overlayId]}</span>
                            <input
                              type="checkbox"
                              checked={overlays[overlayId]}
                              onChange={() => onToggleOverlay(overlayId)}
                              className="accent-amber-300"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Search overlay */}
                  {showSearch ? (
                    <div className="rounded-[1.5rem] border border-amber-300/30 bg-amber-300/10 p-4">
                      <div className="flex items-center gap-3">
                        <input
                          data-testid="atlas-search-input"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(searchQuery); }}
                          placeholder="Search cell id, latitude, or coordinates (e.g. cell-09-18, 45N, 10S, 45N,120E, -35,85)"
                          className="w-full rounded-xl border border-white/10 bg-[#0c1218] px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300/50"
                        />
                        <button type="button" data-testid="atlas-search-go" onClick={() => handleSearch(searchQuery)} className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">Go</button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                          <p className="px-2 text-[10px] uppercase tracking-[0.26em] text-stone-500">Recent</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {searchHistory.filter((h) => !h.pinned).slice(0, 5).map((h) => (
                              <button key={`${h.q}-${h.at}`} type="button" onClick={() => { setSearchQuery(h.q); handleSearch(h.q); }} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-200">{h.q}</button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                          <p className="px-2 text-[10px] uppercase tracking-[0.26em] text-stone-500">Pinned</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {searchHistory.filter((h) => h.pinned).map((h) => (
                              <button key={`${h.q}-${h.at}`} type="button" onClick={() => { setSearchQuery(h.q); handleSearch(h.q); }} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-200">{h.q}</button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                          <p className="px-2 text-[10px] uppercase tracking-[0.26em] text-stone-500">Favorites</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {["North Pole","Equator","Prime Meridian"].map((q) => (
                              <button key={q} type="button" onClick={() => handleSearch(q)} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-200">{q}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Map Layer</p>
                      <p className="mt-2 text-xl text-stone-50">{selectedLayer.label}</p>
                      <p className="mt-1 text-sm text-stone-400">{selectedLayer.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={resetView} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-200 transition hover:bg-white/10">Reset View</button>
                      <button type="button" onClick={() => setView((current) => ({ ...current, scale: clamp(current.scale * 1.2, MIN_SCALE, MAX_SCALE) }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-200 transition hover:bg-white/10">Zoom In</button>
                      <button type="button" onClick={() => setView((current) => ({ ...current, scale: clamp(current.scale * 0.85, MIN_SCALE, MAX_SCALE) }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-200 transition hover:bg-white/10">Zoom Out</button>
                    </div>
                  </div>

                  <div ref={canvasHostRef} className="relative h-[620px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#071017] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                    <canvas
                      ref={canvasRef}
                      data-testid="world-map-canvas"
                      aria-label="Planetary simulation map"
                      className="h-full w-full cursor-grab"
                      onPointerDown={onCanvasPointerDown}
                      onPointerMove={onCanvasPointerMove}
                      onPointerUp={onCanvasPointerUp}
                      onPointerLeave={onCanvasPointerLeave}
                      onClick={onCanvasClick}
                    />
                    {hoveredCell && hoverState && tooltipSummary ? (
                      <div data-testid="atlas-tooltip" className="pointer-events-none absolute right-4 top-4 z-10 w-80 rounded-2xl border border-white/10 bg-[#0b1117]/95 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">Hover Cell</p>
                            <p className="mt-1 text-sm font-medium text-stone-50">{hoveredCell.id}</p>
                          </div>
                          <div className="text-right text-xs text-stone-400">
                            <p>{formatLatitude(hoveredCell.midpointLatitude)}</p>
                            <p>{formatLongitude(hoveredCell.midpointLongitude)}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 text-xs text-stone-200">
                          <p><span className="text-stone-500">Elevation</span> {formatNumber(hoveredCell.elevation, 3)}</p>
                          <p><span className="text-stone-500">Terrain</span> {titleize(hoveredCell.terrainType)}</p>
                          <p><span className="text-stone-500">Climate</span> {hoveredCell.climateBand}</p>
                          <p><span className="text-stone-500">Temperature</span> {formatTemperature(hoveredCell.averageTemperatureC)}</p>
                          <p><span className="text-stone-500">Solar Energy</span> {formatNumber(hoveredCell.solarEnergy, 3)}</p>
                          <p><span className="text-stone-500">Hydrology</span> {tooltipSummary.hydrology}</p>
                          <p><span className="text-stone-500">Atmosphere</span> {tooltipSummary.atmosphere}</p>
                          <p><span className="text-stone-500">Weather</span> {tooltipSummary.weather}</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Scroll: zoom</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Drag: pan</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Click: inspect cell</span>
                      </div>
                      <p className="text-xs text-stone-500">{error ?? `${snapshot.grid.totalCells} cells rendered deterministically`}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4" style={{ opacity: legendOpacity }}>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Legend</p>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-stone-400"><span>Opacity</span><input aria-label="Legend Opacity" type="range" min={0.4} max={1} step={0.05} value={legendOpacity} onChange={(e) => setLegendOpacity(Number(e.target.value))} /></label>
                        <button type="button" onClick={() => setLegendPinned((v) => !v)} className={`rounded-full border px-2 py-1 text-xs ${legendPinned ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-stone-200"}`}>{legendPinned ? "Pinned" : "Pin"}</button>
                        <button type="button" data-testid="legend-toggle" onClick={() => setShowLegend((v) => !v)} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-200">{showLegend ? "Collapse" : "Expand"}</button>
                      </div>
                    </div>
                    {showLegend ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {legendItems.map((item) => (
                          <div key={`${selectedLayerId}-${item.label}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-stone-200">
                            <svg className="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true">
                              <circle cx="8" cy="8" r="6.5" fill={item.color} stroke="rgba(255,255,255,0.18)" />
                            </svg>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section data-testid="statistics-panel" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Statistics</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {activeStatistics.map((stat) => (
                  <DetailCard key={`${selectedLayerId}-${stat.label}`} label={stat.label} value={stat.value} />
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">World Snapshot</p>
              <div className="mt-4 grid gap-3">
                <DetailCard label="Average Humidity" value={formatPercent(snapshot.weatherSummary.averageHumidity)} />
                <DetailCard label="Average Temperature" value={formatTemperature(snapshot.climate.summary.averageTemperatureC)} />
                <DetailCard label="Ocean Coverage" value={`${formatNumber(snapshot.terrainSummary.oceanPercent, 2)} %`} />
                <DetailCard label="Largest Continent" value={`${snapshot.terrainSummary.largestContinentEstimate} cells`} />
                <DetailCard label="Largest Ocean" value={`${snapshot.terrainSummary.largestOceanEstimate} cells`} />
                <DetailCard label="Strongest Wind" value={snapshot.statistics.strongestWind ? `${snapshot.statistics.strongestWind.windDirection} ${formatNumber(snapshot.statistics.strongestWind.windStrength, 3)}` : "-"} />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Planet Integrity</p>
              <div className="mt-4 grid gap-2">
                <DetailCard label="Fingerprint" value={snapshot.fingerprint.shortHash} />
                <IntegrityRow label="Canonical" ok={snapshot.integrity.canonical} />
                <IntegrityRow label="Environment Match" ok={snapshot.integrity.environmentMatch} />
                <IntegrityRow label="Terrain Validated" ok={snapshot.integrity.terrainValidated} />
                <IntegrityRow label="Climate Validated" ok={snapshot.integrity.climateValidated} />
                <IntegrityRow label="Hydrology Validated" ok={snapshot.integrity.hydrologyValidated} />
                <IntegrityRow label="Atmosphere Validated" ok={snapshot.integrity.atmosphereValidated} />
                <IntegrityRow label="Weather Validated" ok={snapshot.integrity.weatherValidated} />
              </div>
            </section>
            <section data-testid="cell-inspector" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Cell Inspector</p>
              {inspectorCell ? (
                <div className="mt-4 space-y-4 text-sm text-stone-200">
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/80">Selected Cell</p>
                    <p className="mt-2 text-lg text-stone-50">{inspectorCell.id}</p>
                    <p className="mt-1 text-sm text-stone-400">{formatLatitude(inspectorCell.midpointLatitude)} / {formatLongitude(inspectorCell.midpointLongitude)}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Planet</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Row {inspectorCell.row} / Column {inspectorCell.column}</p>
                        <p>Latitude range {formatLatitude(inspectorCell.latitudeRange.minimum)} to {formatLatitude(inspectorCell.latitudeRange.maximum)}</p>
                        <p>Longitude range {formatLongitude(inspectorCell.longitudeRange.minimum)} to {formatLongitude(inspectorCell.longitudeRange.maximum)}</p>
                        <p>Hemisphere {titleize(inspectorCell.hemisphere.latitude)} / {titleize(inspectorCell.hemisphere.longitude)}</p>
                        <p>Latitude band {titleize(inspectorCell.latitudeBand.name)}</p>
                        <p>Neighbors {inspectorCell.neighbors.join(", ")}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Climate</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Season {titleize(inspectorCell.season)}</p>
                        <p>Climate band {inspectorCell.climateBand}</p>
                        <p>Average temperature {formatTemperature(inspectorCell.averageTemperatureC)}</p>
                        <p>Solar energy {formatNumber(inspectorCell.solarEnergy, 3)}</p>
                        <p>Daylight hours {formatNumber(inspectorCell.daylightHours, 2)}</p>
                        <p>Seasonal modifier {formatNumber(inspectorCell.seasonalModifier, 3)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Terrain</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Elevation {formatNumber(inspectorCell.elevation, 3)}</p>
                        <p>Terrain type {titleize(inspectorCell.terrainType)}</p>
                        <p>Continentalness {formatNumber(inspectorCell.continentalness, 3)}</p>
                        <p>Ruggedness {formatNumber(inspectorCell.ruggedness, 3)}</p>
                        <p>Tectonic activity {formatNumber(inspectorCell.tectonicActivity, 3)}</p>
                        <p>Coastline {inspectorCell.isCoast ? "Yes" : "No"}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Hydrology</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Ocean {inspectorCell.isOcean ? "Yes" : "No"}</p>
                        <p>Sea {inspectorCell.isSea ? "Yes" : "No"}</p>
                        <p>Lake candidate {inspectorCell.isLakeCandidate ? "Yes" : "No"}</p>
                        <p>River candidate {inspectorCell.isRiverCandidate ? "Yes" : "No"}</p>
                        <p>Water body {titleize(inspectorCell.waterBodyType)}</p>
                        <p>Drainage direction {titleize(inspectorCell.drainageDirection)}</p>
                        <p>Drainage target {inspectorCell.drainageTargetId ?? "-"}</p>
                        <p>Basin {inspectorCell.basinId ?? "-"}</p>
                        <p>Watershed {inspectorCell.watershedId}</p>
                        <p>Flow accumulation {formatNumber(inspectorCell.flowAccumulation, 3)}</p>
                        <p>Moisture potential {formatNumber(inspectorCell.moisturePotential, 3)}</p>
                        <p>Distance to ocean {formatNumber(inspectorCell.distanceToOcean, 2)}</p>
                        <p>Distance to coast {formatNumber(inspectorCell.distanceToCoast, 2)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Atmosphere</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Pressure zone {titleize(inspectorCell.pressureZone)}</p>
                        <p>Pressure value {formatNumber(inspectorCell.pressureValue, 3)}</p>
                        <p>Wind direction {inspectorCell.windDirection}</p>
                        <p>Wind strength {formatNumber(inspectorCell.windStrength, 3)}</p>
                        <p>Temperature gradient {formatNumber(inspectorCell.temperatureGradient, 3)}</p>
                        <p>Moisture transport {formatNumber(inspectorCell.moistureTransportPotential, 3)}</p>
                        <p>Orographic lift {formatNumber(inspectorCell.orographicLiftPotential, 3)}</p>
                        <p>Rain shadow {formatNumber(inspectorCell.rainShadowPotential, 3)}</p>
                        <p>Atmospheric stability {formatNumber(inspectorCell.atmosphericStability, 3)}</p>
                        <p>Seasonal shift {formatNumber(inspectorCell.seasonalShift, 3)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Weather</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Cloud cover {formatPercent(inspectorCell.cloudCover)}</p>
                        <p>Relative humidity {formatPercent(inspectorCell.relativeHumidity)}</p>
                        <p>Precipitation potential {formatPercent(inspectorCell.precipitationPotential)}</p>
                        <p>Weather type {titleize(inspectorCell.weatherType)}</p>
                        <p>Snow potential {formatPercent(inspectorCell.snowPotential)}</p>
                        <p>Fog potential {formatPercent(inspectorCell.fogPotential)}</p>
                        <p>Storm potential {formatPercent(inspectorCell.stormPotential)}</p>
                        <p>Evaporation potential {formatPercent(inspectorCell.evaporationPotential)}</p>
                        <p>Dryness index {formatPercent(inspectorCell.drynessIndex)}</p>
                        <p>Weather stability {formatPercent(inspectorCell.weatherStability)}</p>
                      </div>
                    </div>

                    {[
                      "Biome",
                      "Ecology",
                      "Species",
                      "Civilization",
                    ].map((placeholder) => (
                      <div key={placeholder} className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-xs text-stone-500">
                        <p className="uppercase tracking-[0.28em]">{placeholder}</p>
                        <p className="mt-2">Reserved for future simulation milestones.</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-stone-400">Click a cell to open the full inspector. Hovering still exposes a compact tooltip.</p>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}