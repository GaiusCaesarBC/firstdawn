"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";

import type { AtlasCell, AtlasSnapshot, AtlasWorldOption } from "../../../lib/worlds/map-atlas";
import { renderAtlasBaseLayer, type AtlasVisualMode } from "../../../lib/simulation/atlas-rendering";
import { pickAtlasGlobeCell, renderAtlasGlobe } from "../../../lib/simulation/atlas-globe-rendering";
import {
  prepareAtlasTextureDescriptor,
  renderAtlasBeautyEffects,
  type AtlasBeautyQuality,
  type AtlasTextureDescriptor,
} from "../../../lib/simulation/atlas-visual-effects";
import type { WorldHealthBadge, WorldHealthSummary } from "../../../lib/simulation/world-health";

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
  | "resourceRichness"
  | "metals"
  | "industrial"
  | "waterResources"
  | "buildingMaterials"
  | "rareMaterials"
  | "biomes"
  | "vegetation"
  | "animals"
  | "ecosystemMigration"
  | "foodAvailability"
  | "predationPressure"
  | "ecosystemHealth"
  | "carryingCapacity"
  | "plantConsumption"
  | "adaptationFitness"
  | "adaptationCold"
  | "adaptationHeat"
  | "adaptationDrought"
  | "adaptationDisease"
  | "adaptationMigration"
  | "adaptationForaging"
  | "adaptationPredator"
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
  | "animalMovementVectors"
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

type AtlasViewMode = "developerAtlas" | "globePreview";

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
  initialHealth?: WorldHealthSummary | null;
  fetchSnapshot?: (worldId: string, day: number) => Promise<AtlasSnapshot>;
  fetchHealth?: (worldId: string) => Promise<WorldHealthSummary>;
};

const MAP_CELL_SIZE = 28;
const MAP_PADDING = 24;
const MIN_SCALE = 0.4;
const MAX_SCALE = 10;
const DEFAULT_CELL_FOCUS_SCALE = 1.4;
const SELECTED_CELL_STORAGE_KEY = "first-dawn.atlas.selected-cell";
const TIMELINE_COMMIT_KEYS = new Set(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Enter", "Home", "PageDown", "PageUp"]);
const VISUAL_MODE_OPTIONS: Array<{ id: AtlasVisualMode; label: string; description: string }> = [
  { id: "hybrid", label: "Hybrid", description: "Smooth visual planet with subtle cell inspection." },
  { id: "smoothAtlas", label: "Smooth Atlas", description: "Organic render from logical cell data." },
  { id: "scientificOverlay", label: "Scientific Overlay", description: "Analytical layer clarity for exact comparisons." },
  { id: "simulationGrid", label: "Simulation Grid", description: "Raw logical grid debug view." },
];
const VIEW_MODE_OPTIONS: Array<{ id: AtlasViewMode; label: string; description: string }> = [
  { id: "developerAtlas", label: "2D Developer Atlas", description: "Primary cell inspection and debugging surface." },
  { id: "globePreview", label: "Globe Mode", description: "Rotating visual globe using the same atlas texture source." },
];
const BEAUTY_QUALITY_OPTIONS: Array<{ id: AtlasBeautyQuality; label: string }> = [
  { id: "off", label: "Off" },
  { id: "balanced", label: "Balanced" },
  { id: "high", label: "High" },
  { id: "ultra", label: "Ultra" },
];
const OVERLAY_TOGGLE_LABELS: Record<OverlayId, string> = {
  latitudeBands: "Latitude bands",
  windArrows: "Wind arrows",
  watershedBoundaries: "Watershed boundaries",
  coastlines: "Coastlines",
  gridLines: "Grid lines",
  cellIds: "Cell IDs",
  neighborLinks: "Neighbor links",
  drainageArrows: "Drainage arrows",
  animalMovementVectors: "Animal movement",
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
  { id: "resourceRichness", label: "Resource Richness", group: "Resources", description: "Composite natural resource potential." },
  { id: "metals", label: "Metals", group: "Resources", description: "Iron, copper, gold, silver, tin, and nickel potential." },
  { id: "industrial", label: "Industrial", group: "Resources", description: "Coal, limestone, granite, clay, sand, and salt potential." },
  { id: "waterResources", label: "Water", group: "Resources", description: "Groundwater, aquifer, freshwater, and spring potential." },
  { id: "buildingMaterials", label: "Building Materials", group: "Resources", description: "Stone, gravel, clay, and natural building material availability." },
  { id: "rareMaterials", label: "Rare Materials", group: "Resources", description: "Rare earth, uranium, sulfur, and quartz potential." },
  { id: "biomes", label: "Biomes", group: "Future Layers", description: "Live deterministic biome classifications." },
  { id: "vegetation", label: "Vegetation", group: "Future Layers", description: "Live dominant plant ecology and biomass." },
  { id: "animals", label: "Animals", group: "Ecosystem", description: "Animal ecology status for the selected cell or planet." },
  { id: "ecosystemMigration", label: "Migration", group: "Ecosystem", description: "Population movement pressure and realized neighbor migration." },
  { id: "foodAvailability", label: "Food Availability", group: "Ecosystem", description: "Food stability after plant consumption and seasonal stress." },
  { id: "predationPressure", label: "Predation", group: "Ecosystem", description: "Predator pressure on herbivore populations." },
  { id: "ecosystemHealth", label: "Ecosystem Health", group: "Ecosystem", description: "Composite cell health from biodiversity, food, balance, migration, water, and climate stress." },
  { id: "carryingCapacity", label: "Carrying Capacity", group: "Ecosystem", description: "Wildlife usage of available carrying capacity." },
  { id: "plantConsumption", label: "Plant Consumption", group: "Ecosystem", description: "Edible biomass consumed by herbivores and omnivores." },
  { id: "adaptationFitness", label: "Overall Fitness", group: "Adaptation", description: "Population fitness after habitat, food, climate, movement, predation, and adaptation multipliers." },
  { id: "adaptationCold", label: "Cold Adaptation", group: "Adaptation", description: "Average cold tolerance among present populations." },
  { id: "adaptationHeat", label: "Heat Adaptation", group: "Adaptation", description: "Average heat tolerance among present populations." },
  { id: "adaptationDrought", label: "Drought Adaptation", group: "Adaptation", description: "Average drought tolerance among present populations." },
  { id: "adaptationDisease", label: "Disease Resistance", group: "Adaptation", description: "Average disease resistance among present populations." },
  { id: "adaptationMigration", label: "Migration Instinct", group: "Adaptation", description: "Average migration instinct among present populations." },
  { id: "adaptationForaging", label: "Foraging Efficiency", group: "Adaptation", description: "Average foraging efficiency among present populations." },
  { id: "adaptationPredator", label: "Predator Awareness", group: "Adaptation", description: "Average predator awareness among present populations." },
  { id: "civilizations", label: "Civilizations", group: "Future Layers", description: "Civilization status for the selected cell or planet." },
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
  animalMovementVectors: false,
  pressureBands: false,
  mountainOutlines: false,
};

function createAutoOverlayMask(totalCells: number, scale: number): Record<OverlayId, boolean> {
  const far = scale < 0.6;
  const medium = scale >= 0.6 && scale <= 1.2;
  const close = scale > 1.2;

  const mask: Record<OverlayId, boolean> = {
    gridLines: close,
    cellIds: close && totalCells <= 64 * 128,
    neighborLinks: close && totalCells <= 64 * 128,
    drainageArrows: close && totalCells <= 256 * 512,
    animalMovementVectors: close && totalCells <= 64 * 128,
    windArrows: medium || close,
    pressureBands: medium || close,
    watershedBoundaries: medium || close,
    coastlines: medium || close,
    latitudeBands: !close,
    mountainOutlines: medium || close,
  };

  if (totalCells >= 256 * 512) {
    mask.cellIds = false;
    mask.neighborLinks = false;
  }

  if (totalCells >= 1024 * 2048) {
    mask.gridLines = false;
    mask.drainageArrows = false;
    mask.animalMovementVectors = false;
    mask.windArrows = medium || close;
  }

  if (far) {
    mask.windArrows = false;
    mask.watershedBoundaries = false;
    mask.pressureBands = false;
    mask.coastlines = true;
    mask.mountainOutlines = false;
    mask.gridLines = false;
    mask.cellIds = false;
    mask.neighborLinks = false;
    mask.drainageArrows = false;
    mask.animalMovementVectors = false;
  }

  return mask;
}

function readInitialSelectedCellId(snapshot: AtlasSnapshot): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const query = new URLSearchParams(window.location.search);
  const queryCellId = query.get("cell");

  if (queryCellId) {
    return queryCellId;
  }

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SELECTED_CELL_STORAGE_KEY) ?? "null") as {
      worldId?: string;
      day?: number;
      cellId?: string;
    } | null;

    if (stored?.worldId === snapshot.worldId && stored.day === snapshot.selectedDay) {
      return stored.cellId ?? null;
    }
  } catch {
    window.sessionStorage.removeItem(SELECTED_CELL_STORAGE_KEY);
  }

  return null;
}

function readSearchHistory(): Array<{ q: string; pinned?: boolean; at: number }> {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem("atlasSearchHistory");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function syncAtlasLocation(snapshot: AtlasSnapshot, cellId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const query = new URLSearchParams(window.location.search);
  query.set("world", snapshot.worldId);
  query.set("day", String(snapshot.selectedDay));

  if (cellId) {
    query.set("cell", cellId);
  } else {
    query.delete("cell");
  }

  const queryString = query.toString();
  const syncedUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

  if (`${window.location.pathname}${window.location.search}` !== syncedUrl) {
    window.history.replaceState(window.history.state, "", syncedUrl);
  }
}

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

function formatAtlasLabel(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function formatTagList(tags: readonly string[], fallback = "-" ): string {
  return tags.length > 0 ? tags.join(", ") : fallback;
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
    case "resourceRichness":
    case "metals":
    case "industrial":
    case "waterResources":
    case "buildingMaterials":
    case "rareMaterials":
    case "adaptationFitness":
    case "adaptationCold":
    case "adaptationHeat":
    case "adaptationDrought":
    case "adaptationDisease":
    case "adaptationMigration":
    case "adaptationForaging":
    case "adaptationPredator":
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
    case "resourceRichness":
      return sampleGradient(normalizeValue(cell.resourceRichness, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#17202a" },
        { at: 0.35, color: "#4d6f5f" },
        { at: 0.7, color: "#c2a85b" },
        { at: 1, color: "#f2e8c8" },
      ]);
    case "metals":
      return sampleGradient(normalizeValue(cell.metalRichness, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#18212b" },
        { at: 0.35, color: "#51606c" },
        { at: 0.7, color: "#b4864a" },
        { at: 1, color: "#f0d789" },
      ]);
    case "industrial":
      return sampleGradient(normalizeValue(cell.industrialRichness, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#1e2422" },
        { at: 0.38, color: "#5d665d" },
        { at: 0.72, color: "#b89f73" },
        { at: 1, color: "#eee3c8" },
      ]);
    case "waterResources":
      return sampleGradient(normalizeValue(cell.waterRichness, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#34271f" },
        { at: 0.35, color: "#5e7a78" },
        { at: 0.7, color: "#4aa3b7" },
        { at: 1, color: "#bfefff" },
      ]);
    case "buildingMaterials":
      return sampleGradient(normalizeValue(cell.buildingMaterialAvailability, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#202222" },
        { at: 0.4, color: "#6d6d62" },
        { at: 0.75, color: "#b6ad92" },
        { at: 1, color: "#f1ead8" },
      ]);
    case "rareMaterials":
      return sampleGradient(normalizeValue(cell.rareMaterialRichness, range ?? { minimum: 0, maximum: 1 }), [
        { at: 0, color: "#171c2a" },
        { at: 0.36, color: "#365876" },
        { at: 0.72, color: "#55a987" },
        { at: 1, color: "#d6f3bb" },
      ]);
    case "biomes":
      return cell.biomeColor || "#4b5563";
    case "vegetation":
      return interpolateColor("#20251d", cell.dominantPlantColor || "#5f7d3a", clamp(cell.plantDensity * 0.72 + cell.biomassScore * 0.28, 0, 1));
    case "animals":
      return interpolateColor("#20252a", cell.dominantAnimalGuildColor || "#7d8f4b", clamp(cell.animalDensity * 0.56 + cell.averageHabitatSuitability * 0.24 + cell.averagePopulationHealth * 0.2, 0, 1));
    case "ecosystemMigration":
      return sampleGradient(cell.migrationActivity, [
        { at: 0, color: "#20272d" },
        { at: 0.35, color: "#3b5b69" },
        { at: 0.7, color: "#a57945" },
        { at: 1, color: "#d15b45" },
      ]);
    case "foodAvailability":
      return sampleGradient(cell.foodStability, [
        { at: 0, color: "#3a2428" },
        { at: 0.35, color: "#7d5c43" },
        { at: 0.7, color: "#7f9b58" },
        { at: 1, color: "#c7d979" },
      ]);
    case "predationPressure":
      return sampleGradient(cell.predationPressure, [
        { at: 0, color: "#242b31" },
        { at: 0.35, color: "#5b5147" },
        { at: 0.72, color: "#945044" },
        { at: 1, color: "#6f2632" },
      ]);
    case "ecosystemHealth":
      return sampleGradient(cell.ecosystemHealthScore, [
        { at: 0, color: "#3b2025" },
        { at: 0.32, color: "#8a573f" },
        { at: 0.62, color: "#8e9d5b" },
        { at: 0.82, color: "#5fa873" },
        { at: 1, color: "#bce28a" },
      ]);
    case "carryingCapacity":
      return sampleGradient(cell.carryingCapacityUsage, [
        { at: 0, color: "#20272d" },
        { at: 0.45, color: "#516f65" },
        { at: 0.72, color: "#a59a54" },
        { at: 1, color: "#be5d46" },
      ]);
    case "plantConsumption":
      return sampleGradient(cell.plantConsumptionRate, [
        { at: 0, color: "#202b24" },
        { at: 0.4, color: "#607d50" },
        { at: 0.72, color: "#b18a4d" },
        { at: 1, color: "#b8463e" },
      ]);
    case "adaptationFitness":
    case "adaptationCold":
    case "adaptationHeat":
    case "adaptationDrought":
    case "adaptationDisease":
    case "adaptationMigration":
    case "adaptationForaging":
    case "adaptationPredator":
      return sampleGradient(getAdaptationLayerValue(cell, layerId), [
        { at: 0, color: "#252832" },
        { at: 0.32, color: "#4f5d6c" },
        { at: 0.58, color: "#6d8f75" },
        { at: 0.78, color: "#b6ad67" },
        { at: 1, color: "#f1d98d" },
      ]);
    case "civilizations":
      return "#303238";
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
    case "biomes":
      return getTopCellEntries(snapshot.cells, (cell) => cell.biomeKey, (cell) => ({ label: formatAtlasLabel(cell.biomeName, "Unclassified"), color: cell.biomeColor || "#4b5563" }), 8);
    case "vegetation":
      return getTopCellEntries(snapshot.cells, (cell) => cell.dominantPlantKey, (cell) => ({ label: formatAtlasLabel(cell.dominantPlantName, "No Established Plant Life"), color: cell.dominantPlantColor || "#5f7d3a" }), 8);
    case "animals":
      return getTopCellEntries(snapshot.cells.filter((cell) => cell.dominantSpeciesId !== "none"), (cell) => cell.dominantSpeciesId, (cell) => ({ label: cell.dominantSpeciesName, color: cell.dominantAnimalGuildColor || "#7d8f4b" }), 8);
    case "ecosystemHealth":
      return [
        { label: "Collapsed", color: "#3b2025" },
        { label: "Collapsing", color: "#8a573f" },
        { label: "Stressed", color: "#8e9d5b" },
        { label: "Healthy", color: "#5fa873" },
        { label: "Excellent", color: "#bce28a" },
      ];
    case "ecosystemMigration":
    case "foodAvailability":
    case "predationPressure":
    case "carryingCapacity":
    case "plantConsumption":
      return [0, 0.25, 0.5, 0.75, 1].map((value) => ({ label: formatNumber(value, 2), color: getLayerColor(snapshot, { ...snapshot.cells[0], migrationActivity: value, foodStability: value, predationPressure: value, carryingCapacityUsage: value, plantConsumptionRate: value, averageFitness: value } as AtlasCell, layerId) }));
    case "adaptationFitness":
    case "adaptationCold":
    case "adaptationHeat":
    case "adaptationDrought":
    case "adaptationDisease":
    case "adaptationMigration":
    case "adaptationForaging":
    case "adaptationPredator":
      return [0, 0.25, 0.5, 0.75, 1].map((value) => ({ label: formatNumber(value, 2), color: sampleGradient(value, [
        { at: 0, color: "#252832" },
        { at: 0.32, color: "#4f5d6c" },
        { at: 0.58, color: "#6d8f75" },
        { at: 0.78, color: "#b6ad67" },
        { at: 1, color: "#f1d98d" },
      ]) }));
    case "civilizations":
      return [{ label: "Not Generated Yet", color: "#303238" }];
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
          color: getLayerColor(snapshot, { ...cell, averageTemperatureC: value, solarEnergy: value, daylightHours: value, windStrength: value, distanceToOcean: value, atmosphericStability: value, moistureTransportPotential: value, rainShadowPotential: value, relativeHumidity: value, cloudCover: value, stormPotential: value, snowPotential: value, fogPotential: value, drynessIndex: value, elevation: value, resourceRichness: value, metalRichness: value, industrialRichness: value, waterRichness: value, buildingMaterialAvailability: value, rareMaterialRichness: value } as AtlasCell, layerId),
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


type AtlasHumanAgentView = AtlasSnapshot["humans"]["agents"][number];

type HumanMarkerPoint = {
  human: AtlasHumanAgentView;
  x: number;
  y: number;
  radius: number;
};

function getHumansByCell(humans: readonly AtlasHumanAgentView[]): Map<string, AtlasHumanAgentView[]> {
  const map = new Map<string, AtlasHumanAgentView[]>();

  for (const human of humans) {
    const current = map.get(human.currentCellId) ?? [];
    current.push(human);
    map.set(human.currentCellId, current);
  }

  return map;
}

function getHumanMarkerPoints(
  snapshot: AtlasSnapshot,
  transform: ReturnType<typeof createAtlasCoordinateTransform>,
  cellById: Map<string, AtlasCell>,
): HumanMarkerPoint[] {
  const humansByCell = getHumansByCell(snapshot.humans.agents);
  const points: HumanMarkerPoint[] = [];

  for (const [cellId, humans] of humansByCell) {
    const cell = cellById.get(cellId);

    if (!cell) {
      continue;
    }

    const rect = transform.cellRect(cell);
    const radius = clamp(Math.min(rect.width, rect.height) * 0.22, 5, 13);
    const gap = Math.max(radius * 1.15, rect.width * 0.14);

    humans.forEach((human, index) => {
      const centeredIndex = index - (humans.length - 1) / 2;
      points.push({
        human,
        x: rect.x + rect.width / 2 + centeredIndex * gap * 2,
        y: rect.y + rect.height / 2,
        radius,
      });
    });
  }

  return points;
}

function drawHumanMarker(context: CanvasRenderingContext2D, point: HumanMarkerPoint, selected: boolean): void {
  const { human, x, y, radius } = point;
  const fill = human.sex === "male" ? "#7dd3fc" : "#f0abfc";

  context.save();
  context.fillStyle = fill;
  context.strokeStyle = selected ? "#fff7cc" : "rgba(10, 12, 20, 0.85)";
  context.lineWidth = selected ? 2.4 : 1.4;
  context.beginPath();
  context.moveTo(x, y - radius);
  context.lineTo(x + radius, y);
  context.lineTo(x, y + radius);
  context.lineTo(x - radius, y);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = "rgba(5, 8, 12, 0.82)";
  context.font = `${Math.max(8, radius * 0.95)}px var(--font-sans)`;
  context.fillText(human.sex === "male" ? "M" : "F", x - radius * 0.38, y + radius * 0.34);
  context.restore();
}

function findHumanMarkerAt(
  snapshot: AtlasSnapshot,
  transform: ReturnType<typeof createAtlasCoordinateTransform>,
  cellById: Map<string, AtlasCell>,
  x: number,
  y: number,
): AtlasHumanAgentView | null {
  const points = getHumanMarkerPoints(snapshot, transform, cellById);

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    const distance = Math.hypot(point.x - x, point.y - y);

    if (distance <= point.radius * 1.65) {
      return point.human;
    }
  }

  return null;
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


type TopCellEntry<T> = {
  key: string;
  cell: AtlasCell;
  count: number;
  meta: T;
};

function getTopCellEntry<T>(
  cells: readonly AtlasCell[],
  keyForCell: (cell: AtlasCell) => string,
  metaForCell: (cell: AtlasCell) => T,
  filterCell: (cell: AtlasCell) => boolean = () => true,
): TopCellEntry<T> | null {
  const counts = new Map<string, TopCellEntry<T>>();

  for (const cell of cells) {
    if (!filterCell(cell)) {
      continue;
    }

    const key = keyForCell(cell) || "unknown";
    const current = counts.get(key);

    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { key, cell, count: 1, meta: metaForCell(cell) });
    }
  }

  return [...counts.values()].sort((left, right) => right.count - left.count)[0] ?? null;
}

function getTopCellEntries<T extends LegendItem>(
  cells: readonly AtlasCell[],
  keyForCell: (cell: AtlasCell) => string,
  metaForCell: (cell: AtlasCell) => T,
  limit: number,
): T[] {
  const counts = new Map<string, TopCellEntry<T>>();

  for (const cell of cells) {
    const key = keyForCell(cell) || "unknown";
    const current = counts.get(key);

    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { key, cell, count: 1, meta: metaForCell(cell) });
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
    .map((entry) => entry.meta);
}

type AdaptationProfileKey = keyof AtlasCell["animalPopulations"][number]["adaptationProfile"];

function averagePopulationAdaptation(cell: AtlasCell, trait: AdaptationProfileKey): number {
  const populations = cell.animalPopulations.filter((population) => population.population > 0);

  if (populations.length === 0) {
    return 0;
  }

  return populations.reduce((sum, population) => sum + (population.adaptationProfile?.[trait] ?? 0), 0) / populations.length;
}

function getAdaptationLayerValue(cell: AtlasCell, layerId: LayerId): number {
  switch (layerId) {
    case "adaptationFitness":
      return cell.averageFitness;
    case "adaptationCold":
      return averagePopulationAdaptation(cell, "coldTolerance");
    case "adaptationHeat":
      return averagePopulationAdaptation(cell, "heatTolerance");
    case "adaptationDrought":
      return averagePopulationAdaptation(cell, "droughtTolerance");
    case "adaptationDisease":
      return averagePopulationAdaptation(cell, "diseaseResistance");
    case "adaptationMigration":
      return averagePopulationAdaptation(cell, "migrationInstinct");
    case "adaptationForaging":
      return averagePopulationAdaptation(cell, "foragingEfficiency");
    case "adaptationPredator":
      return averagePopulationAdaptation(cell, "predatorAwareness");
    default:
      return 0;
  }
}

function averageCellMetric(cells: readonly AtlasCell[], metric: (cell: AtlasCell) => number): number {
  if (cells.length === 0) {
    return 0;
  }

  return cells.reduce((sum, cell) => sum + metric(cell), 0) / cells.length;
}

type FutureLayerMetrics = {
  scopeLabel: string;
  scopeDescription: string;
  isCellScope: boolean;
  biomeName: string;
  biomeCategory: string;
  biomeColor: string;
  biomeCoverage: string | null;
  biomeTags: readonly string[];
  habitabilityScore: number;
  fertilityScore: number;
  waterAvailabilityScore: number;
  vegetationDensity: number;
  dominantPlantName: string;
  dominantPlantCategory: string;
  dominantPlantColor: string;
  plantCoverage: string | null;
  plantSuitabilityScore: number;
  plantDensity: number;
  biomassScore: number;
  biodiversityScore: number;
  ediblePlantScore: number;
  woodMaterialScore: number;
  medicinalPotentialScore: number;
  regrowthRate: number;
  seasonalStressScore: number;
  plantTags: readonly string[];
  dominantSpeciesName: string;
  dominantAnimalGuildName: string;
  dominantAnimalGuildColor: string;
  animalCoverage: string | null;
  animalSuitabilityScore: number;
  animalDensity: number;
  totalWildlifePopulation: number;
  speciesCount: number;
  averagePopulationHealth: number;
  averageHabitatSuitability: number;
  foodAvailability: number;
  migrationPressure: number;
  plantConsumptionRate: number;
  effectivePlantBiomass: number;
  predationPressure: number;
  predatorPreyBalance: number;
  foodStability: number;
  carryingCapacityUsage: number;
  migrationActivity: number;
  populationGrowthRate: number;
  ecosystemHealthScore: number;
  ecosystemHealthStatus: AtlasCell["ecosystemHealthStatus"];
  ecosystemEvents: AtlasCell["ecosystemEvents"];
  ecosystemHistory: AtlasCell["ecosystemHistory"];
  movementVectors: AtlasCell["movementVectors"];
  animalPopulations: AtlasCell["animalPopulations"];
  animalTags: readonly string[];
};

function getFutureLayerMetrics(snapshot: AtlasSnapshot, selectedCell: AtlasCell | null): FutureLayerMetrics {
  if (selectedCell) {
    return {
      scopeLabel: "Selected Cell",
      scopeDescription: selectedCell.id,
      isCellScope: true,
      biomeName: formatAtlasLabel(selectedCell.biomeName, "Unclassified"),
      biomeCategory: titleize(formatAtlasLabel(selectedCell.biomeCategory, "unclassified")),
      biomeColor: selectedCell.biomeColor || "#4b5563",
      biomeCoverage: null,
      biomeTags: selectedCell.biomeTags,
      habitabilityScore: selectedCell.habitabilityScore,
      fertilityScore: selectedCell.fertilityScore,
      waterAvailabilityScore: selectedCell.waterAvailabilityScore,
      vegetationDensity: selectedCell.vegetationDensity,
      dominantPlantName: formatAtlasLabel(selectedCell.dominantPlantName, "No Established Plant Life"),
      dominantPlantCategory: titleize(formatAtlasLabel(selectedCell.dominantPlantCategory, "none")),
      dominantPlantColor: selectedCell.dominantPlantColor || "#5f7d3a",
      plantCoverage: null,
      plantSuitabilityScore: selectedCell.plantSuitabilityScore,
      plantDensity: selectedCell.plantDensity,
      biomassScore: selectedCell.biomassScore,
      biodiversityScore: selectedCell.biodiversityScore,
      ediblePlantScore: selectedCell.ediblePlantScore,
      woodMaterialScore: selectedCell.woodMaterialScore,
      medicinalPotentialScore: selectedCell.medicinalPotentialScore,
      regrowthRate: selectedCell.regrowthRate,
      seasonalStressScore: selectedCell.seasonalStressScore,
      plantTags: selectedCell.plantTags,
      dominantSpeciesName: selectedCell.dominantSpeciesName,
      dominantAnimalGuildName: selectedCell.dominantAnimalGuildName,
      dominantAnimalGuildColor: selectedCell.dominantAnimalGuildColor,
      animalCoverage: null,
      animalSuitabilityScore: selectedCell.animalSuitabilityScore,
      animalDensity: selectedCell.animalDensity,
      totalWildlifePopulation: selectedCell.totalWildlifePopulation,
      speciesCount: selectedCell.speciesCount,
      averagePopulationHealth: selectedCell.averagePopulationHealth,
      averageHabitatSuitability: selectedCell.averageHabitatSuitability,
      foodAvailability: selectedCell.animalPopulations[0]?.foodAvailability ?? selectedCell.preyAvailability,
      migrationPressure: selectedCell.migrationPressure,
      plantConsumptionRate: selectedCell.plantConsumptionRate,
      effectivePlantBiomass: selectedCell.effectivePlantBiomass,
      predationPressure: selectedCell.predationPressure,
      predatorPreyBalance: selectedCell.predatorPreyBalance,
      foodStability: selectedCell.foodStability,
      carryingCapacityUsage: selectedCell.carryingCapacityUsage,
      migrationActivity: selectedCell.migrationActivity,
      populationGrowthRate: selectedCell.populationGrowthRate,
      ecosystemHealthScore: selectedCell.ecosystemHealthScore,
      ecosystemHealthStatus: selectedCell.ecosystemHealthStatus,
      ecosystemEvents: selectedCell.ecosystemEvents,
      ecosystemHistory: selectedCell.ecosystemHistory,
      movementVectors: selectedCell.movementVectors,
      animalPopulations: selectedCell.animalPopulations,
      animalTags: selectedCell.animalTags,
    };
  }

  const cells = snapshot.cells;
  const dominantBiome = getTopCellEntry(cells, (cell) => cell.biomeKey, (cell) => ({
    name: formatAtlasLabel(cell.biomeName, "Unclassified"),
    category: titleize(formatAtlasLabel(cell.biomeCategory, "unclassified")),
    color: cell.biomeColor || "#4b5563",
    tags: cell.biomeTags,
  }));
  const plantCells = cells.some((cell) => cell.dominantPlantKey !== "none")
    ? cells.filter((cell) => cell.dominantPlantKey !== "none")
    : cells;
  const dominantPlant = getTopCellEntry(plantCells, (cell) => cell.dominantPlantKey, (cell) => ({
    name: formatAtlasLabel(cell.dominantPlantName, "No Established Plant Life"),
    category: titleize(formatAtlasLabel(cell.dominantPlantCategory, "none")),
    color: cell.dominantPlantColor || "#5f7d3a",
    tags: cell.plantTags,
  }));
  const animalCells = cells.some((cell) => cell.totalWildlifePopulation > 0)
    ? cells.filter((cell) => cell.totalWildlifePopulation > 0)
    : cells;
  const dominantAnimal = getTopCellEntry(animalCells, (cell) => cell.dominantSpeciesId, (cell) => ({
    name: formatAtlasLabel(cell.dominantSpeciesName, "No Established Wildlife"),
    guildName: formatAtlasLabel(cell.dominantAnimalGuildName, "No Established Animal Guild"),
    color: cell.dominantAnimalGuildColor || "#7d8f4b",
    tags: cell.animalTags,
  }));
  const totalCells = Math.max(cells.length, 1);

  return {
    scopeLabel: "Planet Summary",
    scopeDescription: `${formatNumber(snapshot.grid.totalCells, 0)} cells`,
    isCellScope: false,
    biomeName: dominantBiome?.meta.name ?? "Unclassified",
    biomeCategory: dominantBiome?.meta.category ?? "Unclassified",
    biomeColor: dominantBiome?.meta.color ?? "#4b5563",
    biomeCoverage: dominantBiome ? formatPercent(dominantBiome.count / totalCells) : null,
    biomeTags: dominantBiome?.meta.tags ?? [],
    habitabilityScore: averageCellMetric(cells, (cell) => cell.habitabilityScore),
    fertilityScore: averageCellMetric(cells, (cell) => cell.fertilityScore),
    waterAvailabilityScore: averageCellMetric(cells, (cell) => cell.waterAvailabilityScore),
    vegetationDensity: averageCellMetric(cells, (cell) => cell.vegetationDensity),
    dominantPlantName: dominantPlant?.meta.name ?? "No Established Plant Life",
    dominantPlantCategory: dominantPlant?.meta.category ?? "None",
    dominantPlantColor: dominantPlant?.meta.color ?? "#5f7d3a",
    plantCoverage: dominantPlant ? formatPercent(dominantPlant.count / totalCells) : null,
    plantSuitabilityScore: averageCellMetric(cells, (cell) => cell.plantSuitabilityScore),
    plantDensity: averageCellMetric(cells, (cell) => cell.plantDensity),
    biomassScore: averageCellMetric(cells, (cell) => cell.biomassScore),
    biodiversityScore: averageCellMetric(cells, (cell) => cell.biodiversityScore),
    ediblePlantScore: averageCellMetric(cells, (cell) => cell.ediblePlantScore),
    woodMaterialScore: averageCellMetric(cells, (cell) => cell.woodMaterialScore),
    medicinalPotentialScore: averageCellMetric(cells, (cell) => cell.medicinalPotentialScore),
    regrowthRate: averageCellMetric(cells, (cell) => cell.regrowthRate),
    seasonalStressScore: averageCellMetric(cells, (cell) => cell.seasonalStressScore),
    plantTags: dominantPlant?.meta.tags ?? [],
    dominantSpeciesName: dominantAnimal?.meta.name ?? "No Established Wildlife",
    dominantAnimalGuildName: dominantAnimal?.meta.guildName ?? "No Established Animal Guild",
    dominantAnimalGuildColor: dominantAnimal?.meta.color ?? "#7d8f4b",
    animalCoverage: dominantAnimal ? formatPercent(dominantAnimal.count / totalCells) : null,
    animalSuitabilityScore: averageCellMetric(cells, (cell) => cell.animalSuitabilityScore),
    animalDensity: averageCellMetric(cells, (cell) => cell.animalDensity),
    totalWildlifePopulation: cells.reduce((sum, cell) => sum + cell.totalWildlifePopulation, 0),
    speciesCount: Math.max(...cells.map((cell) => cell.speciesCount), 0),
    averagePopulationHealth: averageCellMetric(cells, (cell) => cell.averagePopulationHealth),
    averageHabitatSuitability: averageCellMetric(cells, (cell) => cell.averageHabitatSuitability),
    foodAvailability: averageCellMetric(cells, (cell) => cell.animalPopulations[0]?.foodAvailability ?? cell.preyAvailability),
    migrationPressure: averageCellMetric(cells, (cell) => cell.migrationPressure),
    plantConsumptionRate: averageCellMetric(cells, (cell) => cell.plantConsumptionRate),
    effectivePlantBiomass: averageCellMetric(cells, (cell) => cell.effectivePlantBiomass),
    predationPressure: averageCellMetric(cells, (cell) => cell.predationPressure),
    predatorPreyBalance: averageCellMetric(cells, (cell) => cell.predatorPreyBalance),
    foodStability: averageCellMetric(cells, (cell) => cell.foodStability),
    carryingCapacityUsage: averageCellMetric(cells, (cell) => cell.carryingCapacityUsage),
    migrationActivity: averageCellMetric(cells, (cell) => cell.migrationActivity),
    populationGrowthRate: averageCellMetric(cells, (cell) => cell.populationGrowthRate),
    ecosystemHealthScore: averageCellMetric(cells, (cell) => cell.ecosystemHealthScore),
    ecosystemHealthStatus: cells.filter((cell) => cell.ecosystemHealthStatus === "Collapsed" || cell.ecosystemHealthStatus === "Collapsing").length > cells.length * 0.1 ? "Stressed" : "Healthy",
    ecosystemEvents: cells.flatMap((cell) => cell.ecosystemEvents).slice(0, 6),
    ecosystemHistory: cells.flatMap((cell) => cell.ecosystemHistory).slice(0, 6),
    movementVectors: cells.flatMap((cell) => cell.movementVectors).slice(0, 8),
    animalPopulations: dominantAnimal ? cells.find((cell) => cell.dominantSpeciesName === dominantAnimal.meta.name)?.animalPopulations ?? [] : [],
    animalTags: dominantAnimal?.meta.tags ?? [],
  };
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
    case "resourceRichness":
    case "metals":
    case "industrial":
    case "waterResources":
    case "buildingMaterials":
    case "rareMaterials":
      return [
        { label: "Strongest mining", value: snapshot.statistics.strongestMiningRegion ? `${snapshot.statistics.strongestMiningRegion.cellId} (${formatNumber(snapshot.statistics.strongestMiningRegion.peakScore, 3)})` : "-" },
        { label: "Resource diversity", value: formatPercent(snapshot.statistics.resourceDiversity) },
        { label: "Richest aquifer", value: snapshot.statistics.richestAquifer ? `${snapshot.statistics.richestAquifer.cellId} (${snapshot.statistics.richestAquifer.cellCount} cells)` : "-" },
        { label: "Average minerals", value: formatNumber(snapshot.statistics.averageMineralRichness, 3) },
      ];
    case "biomes": {
      const metrics = getFutureLayerMetrics(snapshot, null);
      return [
        { label: "Dominant biome", value: metrics.biomeName },
        { label: "Category", value: metrics.biomeCategory },
        { label: "Coverage", value: metrics.biomeCoverage ?? "-" },
        { label: "Average habitability", value: formatNumber(metrics.habitabilityScore, 3) },
        { label: "Average fertility", value: formatNumber(metrics.fertilityScore, 3) },
        { label: "Average water", value: formatNumber(metrics.waterAvailabilityScore, 3) },
        { label: "Average vegetation", value: formatNumber(metrics.vegetationDensity, 3) },
      ];
    }
    case "vegetation": {
      const metrics = getFutureLayerMetrics(snapshot, null);
      return [
        { label: "Dominant plant", value: metrics.dominantPlantName },
        { label: "Plant type", value: metrics.dominantPlantCategory },
        { label: "Coverage", value: metrics.plantCoverage ?? "-" },
        { label: "Average biomass", value: formatNumber(metrics.biomassScore, 3) },
        { label: "Average biodiversity", value: formatNumber(metrics.biodiversityScore, 3) },
        { label: "Average regrowth", value: formatNumber(metrics.regrowthRate, 3) },
      ];
    }
    case "animals": {
      const metrics = getFutureLayerMetrics(snapshot, null);
      return [
        { label: "Dominant species", value: metrics.dominantSpeciesName },
        { label: "Dominant guild", value: metrics.dominantAnimalGuildName },
        { label: "Coverage", value: metrics.animalCoverage ?? "-" },
        { label: "Total population", value: formatNumber(metrics.totalWildlifePopulation, 0) },
        { label: "Average health", value: formatNumber(metrics.averagePopulationHealth, 3) },
        { label: "Migration pressure", value: formatNumber(metrics.migrationPressure, 3) },
      ];
    }
    case "ecosystemMigration":
      return [{ label: "Migration activity", value: formatNumber(averageCellMetric(cells, (cell) => cell.migrationActivity), 3) }, { label: "Movement vectors", value: formatNumber(cells.reduce((sum, cell) => sum + cell.movementVectors.length, 0), 0) }, ...overall];
    case "foodAvailability":
      return [{ label: "Food stability", value: formatNumber(averageCellMetric(cells, (cell) => cell.foodStability), 3) }, { label: "Effective biomass", value: formatNumber(averageCellMetric(cells, (cell) => cell.effectivePlantBiomass), 3) }, ...overall];
    case "predationPressure":
      return [{ label: "Predation pressure", value: formatNumber(averageCellMetric(cells, (cell) => cell.predationPressure), 3) }, { label: "Predator balance", value: formatNumber(averageCellMetric(cells, (cell) => cell.predatorPreyBalance), 3) }, ...overall];
    case "ecosystemHealth":
      return [{ label: "Ecosystem health", value: formatNumber(averageCellMetric(cells, (cell) => cell.ecosystemHealthScore), 3) }, { label: "Collapsed habitats", value: formatNumber(cells.filter((cell) => cell.ecosystemHealthStatus === "Collapsed" || cell.ecosystemHealthStatus === "Collapsing").length, 0) }, ...overall];
    case "carryingCapacity":
      return [{ label: "Capacity usage", value: formatNumber(averageCellMetric(cells, (cell) => cell.carryingCapacityUsage), 3) }, { label: "Population growth", value: formatNumber(averageCellMetric(cells, (cell) => cell.populationGrowthRate), 4) }, ...overall];
    case "plantConsumption":
      return [{ label: "Plant consumption", value: formatNumber(averageCellMetric(cells, (cell) => cell.plantConsumptionRate), 3) }, { label: "Food stability", value: formatNumber(averageCellMetric(cells, (cell) => cell.foodStability), 3) }, ...overall];
    case "adaptationFitness":
    case "adaptationCold":
    case "adaptationHeat":
    case "adaptationDrought":
    case "adaptationDisease":
    case "adaptationMigration":
    case "adaptationForaging":
    case "adaptationPredator":
      return [
        { label: getLayerDefinition(layerId).label, value: formatNumber(averageCellMetric(cells, (cell) => getAdaptationLayerValue(cell, layerId)), 3) },
        { label: "Average fitness", value: formatNumber(averageCellMetric(cells, (cell) => cell.averageFitness), 3) },
        { label: "Adaptation diversity", value: formatNumber(averageCellMetric(cells, (cell) => cell.adaptationDiversity), 3) },
        { label: "Climate adaptation", value: formatNumber(averageCellMetric(cells, (cell) => cell.averageClimateAdaptation), 3) },
      ];
    case "civilizations":
      return [{ label: "Civilization layer", value: "Not Generated Yet" }];
    case "watersheds": {
      const overallWithoutDuplicate = overall.filter((s) => s.label !== "Largest watershed");
      return [
        { label: "Largest watershed", value: `${snapshot.hydrologySummary.largestWatershedEstimate} cells` },
        { label: "Largest basin", value: `${snapshot.hydrologySummary.largestBasinEstimate} cells` },
        { label: "Ocean cells", value: String(snapshot.hydrologySummary.oceanCells) },
        ...overallWithoutDuplicate,
      ];
    }
    default:
      return overall;
  }
}

function getTooltipSummary(cell: AtlasCell) {
  return {
    biome: formatAtlasLabel(cell.biomeName, "Unclassified"),
    hydrology: `${titleize(cell.waterBodyType)} / ws ${cell.watershedId}`,
    atmosphere: `${titleize(cell.pressureZone)} / ${cell.windDirection} ${formatNumber(cell.windStrength, 2)}`,
    weather: `${titleize(cell.weatherType)} / humidity ${formatPercent(cell.relativeHumidity)}`,
    resources: `richness ${formatNumber(cell.resourceRichness, 3)} / bedrock ${titleize(cell.bedrockType)}`,
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
async function fetchWorldHealthFromApi(worldId: string): Promise<WorldHealthSummary> {
  const response = await fetch(`/api/worlds/health?world=${encodeURIComponent(worldId)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`World health request failed: ${response.status}`);
  }

  return response.json() as Promise<WorldHealthSummary>;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm text-stone-100">{value}</p>
    </div>
  );
}


function HumanMetricRows({ values }: { values: Record<string, number> }) {
  return (
    <div className="grid gap-1.5">
      {Object.entries(values).map(([key, value]) => (
        <div key={key} className="grid grid-cols-[88px_minmax(0,1fr)_42px] items-center gap-2 text-xs text-stone-300">
          <span className="text-stone-500">{titleize(key)}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-amber-200/80" style={{ width: `${clamp(value, 0, 1) * 100}%` }} />
          </span>
          <span className="text-right text-stone-100">{formatNumber(value, 2)}</span>
        </div>
      ))}
    </div>
  );
}

function formatEmotionDelta(delta: number): string {
  if (Math.abs(delta) < 0.005) {
    return "0.00";
  }

  return `${delta > 0 ? "+" : ""}${formatNumber(delta, 2)}`;
}

function HumanEmotionExplainability({ human }: { human: AtlasHumanAgentView }) {
  return (
    <div data-testid="human-emotion-explainability" className="mt-4 border-t border-white/10 pt-4">
      <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/80">Latest Emotion Change</p>
      <p className="mt-2 text-xs leading-5 text-stone-100">{human.latestEmotionChangeSummary}</p>
      <div className="mt-3 grid gap-3">
        {human.emotionReasons.map((entry) => (
          <div key={entry.emotion} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-start justify-between gap-3 text-xs">
              <p className="font-medium text-stone-100">{titleize(entry.emotion)}</p>
              <p className="shrink-0 text-stone-400">
                {formatNumber(entry.before, 2)} -&gt; {formatNumber(entry.after, 2)} ({formatEmotionDelta(entry.delta)})
              </p>
            </div>
            <p className="mt-1 text-xs leading-5 text-stone-300">{entry.summary}</p>
            <p className="mt-1 text-xs text-stone-500">Reasons: {entry.reasons.join("; ")}</p>
            {entry.causalEventLinks.length > 0 ? (
              <div className="mt-2 grid gap-1 text-xs text-stone-400">
                <p className="uppercase tracking-[0.2em] text-stone-500">Causal Event Links</p>
                {entry.causalEventLinks.map((event) => (
                  <p key={`${entry.emotion}-${event.id}`} className="break-words">
                    Tick {event.tick}: {event.title} <span className="text-stone-600">{event.id}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function HumanInspectorPanel({
  human,
  humans,
  onSelectHuman,
  onFocusHuman,
  onSimulateOneDay,
}: {
  human: AtlasHumanAgentView | null;
  humans: readonly AtlasHumanAgentView[];
  onSelectHuman: (human: AtlasHumanAgentView) => void;
  onFocusHuman: (human: AtlasHumanAgentView) => void;
  onSimulateOneDay: () => void;
}) {
  return (
    <section data-testid="human-inspector" className="rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(180deg,_rgba(125,211,252,0.09),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/80">Human MVA</p>
          <p className="mt-2 text-base text-stone-50">First Humans</p>
        </div>
        <button type="button" data-testid="simulate-human-day" onClick={onSimulateOneDay} className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100">Simulate One Human Day</button>
      </div>

      <div data-testid="human-list" className="mt-4 grid gap-2">
        {humans.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-testid={`human-list-${entry.sex}`}
            onClick={() => onSelectHuman(entry)}
            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${human?.id === entry.id ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.07]"}`}
          >
            <span className="block">{entry.label}</span>
            <span className="mt-1 block text-xs text-stone-500">{entry.sex} / age {formatNumber(entry.approxAgeYears, 1)} / {entry.currentCellId}</span>
          </button>
        ))}
      </div>

      {human ? (
        <div className="mt-4 space-y-3 text-sm text-stone-200">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Selected Human</p>
                <p className="mt-2 break-words text-stone-50">{human.label}</p>
                <p className="mt-1 break-words text-xs text-stone-400">{human.id}</p>
              </div>
              <button type="button" onClick={() => onFocusHuman(human)} className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Focus</button>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-stone-200">
              <p>Sex {human.sex}</p>
              <p>Age {formatNumber(human.approxAgeYears, 1)}</p>
              <p>Current cell {human.currentCellId}</p>
              <p>Current action {human.currentAction ? titleize(human.currentAction) : "None"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Needs</p>
            <div className="mt-3"><HumanMetricRows values={human.needs} /></div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Emotions</p>
            <div className="mt-3"><HumanMetricRows values={human.emotions} /></div>
            <HumanEmotionExplainability human={human} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Relationship To Other</p>
            <div className="mt-3 grid gap-2 text-xs text-stone-200">
              <p>Trust {formatNumber(human.relationshipToOther?.trust ?? 0, 2)}</p>
              <p>Attraction {formatNumber(human.relationshipToOther?.attraction ?? 0, 2)}</p>
              <p>Affection {formatNumber(human.relationshipToOther?.affection ?? 0, 2)}</p>
              <p>Companionship {formatNumber(human.relationshipToOther?.companionship ?? 0, 2)}</p>
            </div>
          </div>

          <DetailCard label="Latest Memory" value={human.latestMemory ? `${human.latestMemory.eventType}: ${human.latestMemory.summary}` : "None"} />
          <DetailCard label="Latest Causal Event" value={human.latestCausalEvent ? `${human.latestCausalEvent.title}: ${human.latestCausalEvent.summary}` : "None"} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-400">No human selected.</p>
      )}
    </section>
  );
}
function getHealthBadgeClass(badge: WorldHealthBadge): string {
  if (badge === "Healthy") {
    return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  }

  if (badge === "Warning") {
    return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  }

  return "border-red-400/40 bg-red-950/30 text-red-100";
}

function formatHealthList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}

function WorldHealthPanel({ health, loading, error }: { health: WorldHealthSummary | null; loading: boolean; error: string | null }) {
  const badge = health?.badge ?? "Warning";

  return (
    <section data-testid="world-health-panel" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">World Health</p>
          <p className="mt-2 text-base text-stone-50">{health?.worldName ?? "Unavailable"}</p>
        </div>
        <span className={`inline-flex border px-2.5 py-1 text-xs font-semibold uppercase tracking-normal ${getHealthBadgeClass(badge)}`}>
          {loading ? "Loading" : health?.badge ?? "Warning"}
        </span>
      </div>
      {error ? <p className="mt-3 text-sm text-red-100">{error}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <DetailCard label="Status" value={health?.status ?? "-"} />
        <DetailCard label="World.currentTick" value={health?.currentTick ?? "-"} />
        <DetailCard label="Latest SimulationTick.tickNumber" value={health?.latestSimulationTickNumber ?? "-"} />
        <DetailCard label="Last Tick" value={health?.lastTickStatus ?? "missing"} />
        <DetailCard label="Last Successful Tick Time" value={health?.lastSuccessfulTickTime ?? "-"} />
        <DetailCard label="Failed Systems" value={health ? formatHealthList(health.failedSystems) : "-"} />
        <DetailCard label="Last Error" value={health?.lastErrorMessage ?? "-"} />
        <DetailCard label="Biome Coverage" value={health ? formatPercent(health.biomeCoveragePercent) : "-"} />
        <DetailCard label="Plant Coverage" value={health ? formatPercent(health.plantCoveragePercent) : "-"} />
        <DetailCard label="Animal Species" value={health ? (health.animalDataAvailable ? formatNumber(health.animalSpeciesCount, 0) : "Not tracked yet") : "-"} />
        <DetailCard label="Occupied Habitat" value={health ? (health.animalDataAvailable ? `${formatNumber(health.occupiedAnimalHabitatPercent, 2)} %` : "Not tracked yet") : "-"} />
        <DetailCard label="Wildlife Population" value={health ? (health.animalDataAvailable ? formatNumber(health.totalWildlifePopulation, 0) : "Not tracked yet") : "-"} />
        <DetailCard label="Animal Suitability" value={health ? (health.animalDataAvailable ? formatNumber(health.averageAnimalHabitatSuitability, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Animal Health" value={health ? (health.animalDataAvailable ? formatNumber(health.averageAnimalHealth, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Ecosystem Health" value={health ? (health.ecosystemDataAvailable ? formatNumber(health.averageEcosystemHealth, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Biodiversity" value={health ? (health.ecosystemDataAvailable ? formatNumber(health.averageBiodiversity, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Migration Activity" value={health ? (health.ecosystemDataAvailable ? formatNumber(health.migrationActivity, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Food Stability" value={health ? (health.ecosystemDataAvailable ? formatNumber(health.foodStability, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Predator Balance" value={health ? (health.ecosystemDataAvailable ? formatNumber(health.predatorBalance, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Collapsed Habitats" value={health ? (health.ecosystemDataAvailable ? formatNumber(health.collapsedHabitats, 0) : "Not tracked yet") : "-"} />
        <DetailCard label="Population Growth" value={health ? (health.ecosystemDataAvailable ? formatNumber(health.populationGrowthRate, 4) : "Not tracked yet") : "-"} />
        <DetailCard label="Plant Consumption" value={health ? (health.ecosystemDataAvailable ? formatNumber(health.plantConsumptionRate, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Average Population Fitness" value={health ? (health.adaptationDataAvailable ? formatNumber(health.averageFitness, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Adaptation Diversity" value={health ? (health.adaptationDataAvailable ? formatNumber(health.averageAdaptationDiversity, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Average Climate Adaptation" value={health ? (health.adaptationDataAvailable ? formatNumber(health.averageClimateAdaptation, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Average Disease Resistance" value={health ? (health.adaptationDataAvailable ? formatNumber(health.averageDiseaseResistance, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Average Reproductive Efficiency" value={health ? (health.adaptationDataAvailable ? formatNumber(health.averageReproductiveEfficiency, 3) : "Not tracked yet") : "-"} />
        <DetailCard label="Highest Fitness Population" value={health ? (health.adaptationDataAvailable ? (health.highestAdaptedPopulation ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Lowest Fitness Population" value={health ? (health.adaptationDataAvailable ? (health.lowestFitnessPopulation ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Weather Snapshot" value={health?.weatherSnapshotAvailable ? "Available" : "Missing"} />

        {/* Human MVA Cards */}
        <DetailCard label="Human System Status" value={health?.humanSystemStatus ?? (health?.humanDataAvailable ? "Active" : "Unavailable")} />
        <DetailCard label="Human Population" value={health ? (health.humanDataAvailable ? String(health.humanPopulation ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Male Humans" value={health ? (health.humanDataAvailable ? String(health.maleHumans ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Female Humans" value={health ? (health.humanDataAvailable ? String(health.femaleHumans ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Adult Humans" value={health ? (health.humanDataAvailable ? String(health.adultHumans ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Children" value={health ? (health.humanDataAvailable ? String(health.childrenHumans ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Latest Human Action" value={health ? (health.humanDataAvailable ? (health.latestHumanAction ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Latest Human Causal Event" value={health ? (health.humanDataAvailable ? (health.latestHumanCausalEvent ?? "-") : "Not tracked yet") : "-"} />
        <DetailCard label="Average Human Fear" value={health ? (health.humanDataAvailable && health.averageHumanFear != null ? formatNumber(health.averageHumanFear, 3) : (health?.humanDataAvailable ? "-" : "Not tracked yet")) : "-"} />
        <DetailCard label="Average Human Curiosity" value={health ? (health.humanDataAvailable && health.averageHumanCuriosity != null ? formatNumber(health.averageHumanCuriosity, 3) : (health?.humanDataAvailable ? "-" : "Not tracked yet")) : "-"} />
        <DetailCard label="Average Human Relationship Stability" value={health ? (health.humanDataAvailable && health.averageHumanRelationshipStability != null ? formatNumber(health.averageHumanRelationshipStability, 3) : (health?.humanDataAvailable ? "-" : "Not tracked yet")) : "-"} />
      </div>
    </section>
  );
}
function FutureMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-stone-300">
      <span className="text-stone-500">{label}</span>
      <span className="text-right text-stone-100">{value}</span>
    </div>
  );
}

function LayerStatusCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "error" | "loading" }) {
  const valueColor = tone === "error" ? "text-red-100" : tone === "loading" ? "text-amber-100" : "text-stone-100";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">{label}</p>
      <p className={`mt-3 text-sm ${valueColor}`}>{value}</p>
    </div>
  );
}

function BiomeEcologyCard({ metrics }: { metrics: FutureLayerMetrics }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: metrics.biomeColor }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Biome</p>
          <p className="mt-2 text-base text-stone-50">{metrics.biomeName}</p>
          <p className="mt-1 text-xs text-stone-400">{metrics.biomeCategory}{metrics.biomeCoverage ? ` / ${metrics.biomeCoverage}` : ""}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <FutureMetricRow label={metrics.isCellScope ? "Habitability" : "Average habitability"} value={formatNumber(metrics.habitabilityScore, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Fertility" : "Average fertility"} value={formatNumber(metrics.fertilityScore, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Water availability" : "Average water availability"} value={formatNumber(metrics.waterAvailabilityScore, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Vegetation density" : "Average vegetation density"} value={formatNumber(metrics.vegetationDensity, 3)} />
        <FutureMetricRow label="Tags" value={formatTagList(metrics.biomeTags)} />
      </div>
    </div>
  );
}

function VegetationEcologyCard({ metrics }: { metrics: FutureLayerMetrics }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: metrics.dominantPlantColor }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Vegetation</p>
          <p className="mt-2 text-base text-stone-50">{metrics.dominantPlantName}</p>
          <p className="mt-1 text-xs text-stone-400">{metrics.dominantPlantCategory}{metrics.plantCoverage ? ` / ${metrics.plantCoverage}` : ""}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <FutureMetricRow label={metrics.isCellScope ? "Suitability" : "Average suitability"} value={formatNumber(metrics.plantSuitabilityScore, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Density" : "Average density"} value={formatNumber(metrics.plantDensity, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Biomass" : "Average biomass"} value={formatNumber(metrics.biomassScore, 3)} />
        <FutureMetricRow label="Edible score" value={formatNumber(metrics.ediblePlantScore, 3)} />
        <FutureMetricRow label="Wood score" value={formatNumber(metrics.woodMaterialScore, 3)} />
        <FutureMetricRow label="Medicinal score" value={formatNumber(metrics.medicinalPotentialScore, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Biodiversity" : "Average biodiversity"} value={formatNumber(metrics.biodiversityScore, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Regrowth" : "Average regrowth"} value={formatNumber(metrics.regrowthRate, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Seasonal stress" : "Average seasonal stress"} value={formatNumber(metrics.seasonalStressScore, 3)} />
        <FutureMetricRow label="Tags" value={formatTagList(metrics.plantTags)} />
      </div>
    </div>
  );
}


function HealthBar({ value }: { value: number }) {
  const segments = Array.from({ length: 10 }, (_, index) => index < Math.round(clamp(value, 0, 1) * 10));

  return <span className="font-mono text-xs text-stone-200">{segments.map((filled) => filled ? "#" : "-").join("")}</span>;
}

function statusTone(status: AtlasCell["ecosystemHealthStatus"]): string {
  if (status === "Excellent" || status === "Healthy") {
    return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  }

  if (status === "Stressed") {
    return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  }

  return "border-red-400/40 bg-red-950/30 text-red-100";
}

function ecosystemExplanation(metrics: FutureLayerMetrics): string {
  if (metrics.ecosystemHealthStatus === "Collapsed") {
    return "Food, water, or population balance can no longer support stable wildlife.";
  }

  if (metrics.foodStability < 0.38) {
    return "Food availability is the main limiting factor for current populations.";
  }

  if (metrics.migrationActivity > 0.5) {
    return "Migration pressure is actively redistributing populations into neighboring cells.";
  }

  if (metrics.plantConsumptionRate > 0.58) {
    return "Grazing pressure is drawing down edible plant biomass.";
  }

  return "Biodiversity, food, and population balance are supporting a stable ecosystem.";
}

function AnimalEcologyCard({ metrics }: { metrics: FutureLayerMetrics }) {
  const topPopulations = metrics.animalPopulations.filter((population) => population.population > 0).slice(0, 5);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: metrics.dominantAnimalGuildColor }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Animals</p>
          <p className="mt-2 text-base text-stone-50">{metrics.dominantSpeciesName}</p>
          <p className="mt-1 text-xs text-stone-400">{metrics.dominantAnimalGuildName}{metrics.animalCoverage ? ` / ${metrics.animalCoverage}` : ""}</p>
        </div>
        <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${statusTone(metrics.ecosystemHealthStatus)}`}>{metrics.ecosystemHealthStatus}</span>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="text-stone-500">Health</span><HealthBar value={metrics.ecosystemHealthScore} /></div>
        <p className="mt-2 text-xs text-stone-300">{ecosystemExplanation(metrics)}</p>
      </div>
      <div className="mt-4 grid gap-2">
        <FutureMetricRow label={metrics.isCellScope ? "Species present" : "Peak cell species"} value={formatNumber(metrics.speciesCount, 0)} />
        <FutureMetricRow label={metrics.isCellScope ? "Population" : "Total population"} value={formatNumber(metrics.totalWildlifePopulation, 0)} />
        <FutureMetricRow label={metrics.isCellScope ? "Suitability" : "Average suitability"} value={formatNumber(metrics.averageHabitatSuitability, 3)} />
        <FutureMetricRow label={metrics.isCellScope ? "Health" : "Average health"} value={formatNumber(metrics.averagePopulationHealth, 3)} />
        <FutureMetricRow label="Food availability" value={formatNumber(metrics.foodAvailability, 3)} />
        <FutureMetricRow label="Food stability" value={formatNumber(metrics.foodStability, 3)} />
        <FutureMetricRow label="Plant consumption" value={formatNumber(metrics.plantConsumptionRate, 3)} />
        <FutureMetricRow label="Predation" value={formatNumber(metrics.predationPressure, 3)} />
        <FutureMetricRow label="Carrying usage" value={formatNumber(metrics.carryingCapacityUsage, 3)} />
        <FutureMetricRow label="Migration pressure" value={formatNumber(metrics.migrationPressure, 3)} />
        <FutureMetricRow label="Migration activity" value={formatNumber(metrics.migrationActivity, 3)} />
        <FutureMetricRow label="Growth trend" value={formatNumber(metrics.populationGrowthRate, 4)} />
        <FutureMetricRow label="Tags" value={formatTagList(metrics.animalTags)} />
        <p className="pt-2 text-[10px] uppercase tracking-[0.24em] text-stone-500">Top Species</p>
        {topPopulations.map((population) => (
          <FutureMetricRow key={population.speciesId} label={population.speciesName} value={`${formatNumber(population.population, 0)} / fitness ${formatNumber(population.fitnessScore, 2)} / cold ${formatNumber(population.adaptationProfile.coldTolerance, 2)}`} />
        ))}
        <p className="pt-2 text-[10px] uppercase tracking-[0.24em] text-stone-500">Recent History</p>
        {metrics.ecosystemHistory.slice(0, 4).map((event, index) => (
          <FutureMetricRow key={`${event.id}:${event.tick}:${index}`} label={`Tick ${event.tick}`} value={event.type} />
        ))}
        <p className="pt-2 text-[10px] uppercase tracking-[0.24em] text-stone-500">Influencing Systems</p>
        <FutureMetricRow label="Climate" value={metrics.ecosystemHealthScore >= 0.62 ? "Temperature and season support growth." : "Climate stress reduced stability."} />
        <FutureMetricRow label="Plants" value={metrics.plantConsumptionRate > 0.58 ? "Grazing reduced edible biomass." : "Plant biomass supports food supply."} />
        <FutureMetricRow label="Weather" value={metrics.foodStability < 0.38 ? "Dry or seasonal stress reduced food." : "Water and regrowth remain adequate."} />
        <FutureMetricRow label="Migration" value={metrics.migrationActivity > 0.5 ? "Moderate outward movement detected." : "Movement remains locally stable."} />
      </div>
    </div>
  );
}

function FutureLayerStatePanel({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "error" | "loading" }) {
  return (
    <section data-testid="future-layers-panel" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Future Layers</p>
      <div className="mt-4 grid gap-3">
        <LayerStatusCard label={label} value={value} tone={tone} />
      </div>
    </section>
  );
}

export function FutureLayersPanel({
  snapshot,
  selectedCell,
  loading,
  error,
}: {
  snapshot: AtlasSnapshot;
  selectedCell: AtlasCell | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <FutureLayerStatePanel label="Atlas Ecology" value="Loading selected world ecology..." tone="loading" />;
  }

  if (error) {
    return <FutureLayerStatePanel label="Atlas Ecology Error" value={error} tone="error" />;
  }

  if (snapshot.cells.length === 0) {
    return <FutureLayerStatePanel label="Atlas Ecology Empty" value="No atlas cells are available for this snapshot." />;
  }

  const metrics = getFutureLayerMetrics(snapshot, selectedCell);

  return (
    <section data-testid="future-layers-panel" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Future Layers</p>
          <p className="mt-2 text-sm text-stone-300">{metrics.scopeLabel}: <span className="text-stone-100">{metrics.scopeDescription}</span></p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <BiomeEcologyCard metrics={metrics} />
        <VegetationEcologyCard metrics={metrics} />
        <AnimalEcologyCard metrics={metrics} />
        <LayerStatusCard label="Civilizations" value="Civilization Systems Not Generated Yet" />
      </div>
    </section>
  );
}

function getCellWarnings(cell: AtlasCell): string[] {
  return [
    cell.ecosystemHealthScore < 0.35 ? "Ecosystem health is unstable." : null,
    cell.foodStability < 0.35 ? "Food stability is under stress." : null,
    cell.stormPotential > 0.72 ? "Storm potential is elevated." : null,
    cell.drynessIndex > 0.78 ? "Dryness index is elevated." : null,
    cell.averageFitness < 0.32 && cell.totalWildlifePopulation > 0 ? "Population adaptation fitness is low." : null,
  ].filter((warning): warning is string => Boolean(warning));
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

type GlobePreviewPanelProps = {
  descriptor: AtlasTextureDescriptor;
  snapshot: AtlasSnapshot;
  atlasTextureRef: React.RefObject<HTMLCanvasElement | null>;
  selectedCellId: string | null;
  rotationSpeed: number;
  rotationPaused: boolean;
  showClouds: boolean;
  showAtmosphere: boolean;
  showDayNight: boolean;
  beautyQuality: AtlasBeautyQuality;
  onSelectCell: (cell: AtlasCell) => void;
  onHoverCell: (cellId: string | null, point?: { x: number; y: number }) => void;
};

function GlobePreviewPanel({
  descriptor,
  snapshot,
  atlasTextureRef,
  selectedCellId,
  rotationSpeed,
  rotationPaused,
  showClouds,
  showAtmosphere,
  showDayNight,
  beautyQuality,
  onSelectCell,
  onHoverCell,
}: GlobePreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(0);
  const dragRef = useRef<{ pointerId: number; x: number; rotation: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 920, height: 620 });
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [textureReady, setTextureReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const updateSize = () => {
      setCanvasSize({
        width: Math.max(420, Math.floor(host.clientWidth || 920)),
        height: Math.max(420, Math.floor(host.clientHeight || 620)),
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(host);

    return () => observer.disconnect();
  }, []);

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

    let animationFrame = 0;
    let previousTime = performance.now();
    const draw = (time: number) => {
      const deltaSeconds = Math.min(0.08, Math.max(0, (time - previousTime) / 1000));
      previousTime = time;

      if (!rotationPaused && !dragRef.current) {
        rotationRef.current = (rotationRef.current + rotationSpeed * deltaSeconds * 18) % 360;
      }

      const atlasTexture = atlasTextureRef.current;

      if (!atlasTexture) {
        context.clearRect(0, 0, canvasSize.width, canvasSize.height);
        setTextureReady(false);
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      setTextureReady(true);
      renderAtlasGlobe(context, snapshot, descriptor, atlasTexture, {
        width: canvasSize.width,
        height: canvasSize.height,
        rotationLongitudeDegrees: rotationRef.current,
        tiltDegrees: snapshot.astronomy.solarDeclinationDegrees * 0.28,
        showClouds,
        showAtmosphere,
        showDayNight,
        selectedCellId,
        hoveredCellId,
        quality: beautyQuality,
      });

      animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [atlasTextureRef, beautyQuality, canvasSize.height, canvasSize.width, descriptor, hoveredCellId, rotationPaused, rotationSpeed, selectedCellId, showAtmosphere, showClouds, showDayNight, snapshot]);

  const pickCell = (event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasSize.width / Math.max(1, rect.width);
    const scaleY = canvasSize.height / Math.max(1, rect.height);

    return pickAtlasGlobeCell(
      snapshot,
      {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      },
      canvasSize,
      {
        rotationLongitudeDegrees: rotationRef.current,
        tiltDegrees: snapshot.astronomy.solarDeclinationDegrees * 0.28,
      },
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;

    if (drag && drag.pointerId === event.pointerId) {
      rotationRef.current = drag.rotation - (event.clientX - drag.x) * 0.32;
      return;
    }

    const pick = pickCell(event);
    setHoveredCellId(pick?.cellId ?? null);
    onHoverCell(pick?.cellId ?? null, pick ? { x: event.clientX, y: event.clientY } : undefined);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, rotation: rotationRef.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const wasClick = drag ? Math.abs(event.clientX - drag.x) < 4 : true;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (!wasClick) {
      return;
    }

    const pick = pickCell(event);
    const cell = pick ? snapshot.cells.find((candidate) => candidate.id === pick.cellId) ?? null : null;

    if (cell) {
      onSelectCell(cell);
    }
  };

  const handlePointerLeave = () => {
    dragRef.current = null;
    setHoveredCellId(null);
    onHoverCell(null);
  };

  return (
    <div ref={hostRef} data-testid="globe-preview" className="relative h-[620px] min-h-[420px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(49,134,155,0.22),transparent_34%),linear-gradient(180deg,#071017,#030609)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <canvas
        ref={canvasRef}
        aria-label="Rotating Developer Atlas globe"
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
      {!textureReady ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-stone-400">Preparing atlas texture</div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-5 top-5 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400">
        <span className="rounded-full border border-cyan-200/15 bg-cyan-200/8 px-3 py-1 text-cyan-100">Globe Mode</span>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">Texture {descriptor.width} x {descriptor.height}</span>
      </div>
      <div className="pointer-events-none absolute bottom-5 left-5 right-5 grid gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur sm:grid-cols-3">
        <DetailCard label="Picking" value="Hover/click maps to atlas cells" />
        <DetailCard label="Grid" value={`${descriptor.latitudeDivisions} x ${descriptor.longitudeDivisions}`} />
        <DetailCard label="Hovered" value={hoveredCellId ?? "-"} />
      </div>
    </div>
  );
}
export function WorldMapAtlasClient({
  worlds,
  initialSnapshot,
  initialHealth = null,
  fetchSnapshot = fetchAtlasSnapshotFromApi,
  fetchHealth = fetchWorldHealthFromApi,
}: WorldMapAtlasClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedLayerId, setSelectedLayerId] = useState<LayerId>("planet");
  const [viewMode, setViewMode] = useState<AtlasViewMode>("developerAtlas");
  const [visualMode, setVisualMode] = useState<AtlasVisualMode>("hybrid");
  const [beautyQuality, setBeautyQuality] = useState<AtlasBeautyQuality>("balanced");
  const [cloudsEnabled, setCloudsEnabled] = useState(true);
  const [cloudOpacity, setCloudOpacity] = useState(0.26);
  const [atmosphereEnabled, setAtmosphereEnabled] = useState(true);
  const [dayNightEnabled, setDayNightEnabled] = useState(true);
  const [globeRotationSpeed, setGlobeRotationSpeed] = useState(0.28);
  const [isGlobeRotationPaused, setIsGlobeRotationPaused] = useState(false);
  const [gridOpacity, setGridOpacity] = useState(0.18);
  const [isRunning, setIsRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHumansOverlay, setShowHumansOverlay] = useState(true);
  const [selectedHumanId, setSelectedHumanId] = useState<string | null>(initialSnapshot.humans.agents[0]?.id ?? null);
  const [selectedWorldId, setSelectedWorldId] = useState(initialSnapshot.worldId);
  const [draftDay, setDraftDay] = useState(initialSnapshot.selectedDay);
  const [committedDay, setCommittedDay] = useState(initialSnapshot.selectedDay);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(() => readInitialSelectedCellId(initialSnapshot));
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const [canvasSize, setCanvasSize] = useState({ width: 1120, height: 680 });
  const [view, setView] = useState(() => createFitView(initialSnapshot, 1120, 680));
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<WorldHealthSummary | null>(initialHealth);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isAtlasLoading, setIsAtlasLoading] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [legendPinned, setLegendPinned] = useState(false);
  const [legendOpacity, setLegendOpacity] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<Array<{ q: string; pinned?: boolean; at: number }>>(() => readSearchHistory());
  const [isPending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const lastHoveredCellIdRef = useRef<string | null>(null);
  const cellByIdRef = useRef(new Map<string, AtlasCell>());
  const cellByGridKeyRef = useRef(new Map<string, AtlasCell>());
  const baseLayerBufferRef = useRef<HTMLCanvasElement | null>(null);
  const baseLayerCacheKeyRef = useRef<string>("");
  const continentCacheRef = useRef<{ land?: { id: number; center: { row: number; column: number }; size: number }; ocean?: { id: number; center: { row: number; column: number }; size: number } } | null>(null);
  const hasMountedHealthRef = useRef(false);

  const selectedWorld = worlds.find((world) => world.id === selectedWorldId) ?? worlds[0];
  const snapshotCellById = useMemo(() => new Map(snapshot.cells.map((cell) => [cell.id, cell])), [snapshot]);
  const selectedCell = selectedCellId ? snapshotCellById.get(selectedCellId) ?? null : null;
  const hoveredCell = hoverState ? snapshotCellById.get(hoverState.cellId) ?? null : null;
  const humansByCell = useMemo(() => getHumansByCell(snapshot.humans.agents), [snapshot.humans.agents]);
  const selectedHuman = selectedHumanId ? snapshot.humans.agents.find((human) => human.id === selectedHumanId) ?? null : null;
  const autoOverlayMask = useMemo(() => createAutoOverlayMask(snapshot.grid.totalCells, view.scale), [snapshot.grid.totalCells, view.scale]);
  const activeVisualMode = VISUAL_MODE_OPTIONS.find((mode) => mode.id === visualMode) ?? VISUAL_MODE_OPTIONS[0];
  const activeViewMode = VIEW_MODE_OPTIONS.find((mode) => mode.id === viewMode) ?? VIEW_MODE_OPTIONS[0];
  const atlasTextureDescriptor = useMemo(() => prepareAtlasTextureDescriptor(snapshot, MAP_CELL_SIZE), [snapshot]);
  const effectiveBeautyQuality: AtlasBeautyQuality = visualMode === "simulationGrid" ? "off" : beautyQuality;
  const commitDraftDay = (day: number) => {
    const clampedDay = clamp(Math.round(day), 1, selectedWorld.yearLengthDays);
    setDraftDay(clampedDay);
    setCommittedDay(clampedDay);
  };
  const persistSelectedCell = (cellId: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    const query = new URLSearchParams(window.location.search);

    if (cellId) {
      query.set("cell", cellId);
      window.sessionStorage.setItem(SELECTED_CELL_STORAGE_KEY, JSON.stringify({
        worldId: snapshot.worldId,
        day: snapshot.selectedDay,
        cellId,
      }));
    } else {
      query.delete("cell");
      window.sessionStorage.removeItem(SELECTED_CELL_STORAGE_KEY);
    }

    const nextUrl = `${window.location.pathname}?${query.toString()}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  };

  const selectInspectorCell = (cell: AtlasCell) => {
    setSelectedCellId(cell.id);
    persistSelectedCell(cell.id);
  };
  const clearInspectorCell = () => {
    setSelectedCellId(null);
    persistSelectedCell(null);
  };

  const selectHuman = (human: AtlasHumanAgentView) => {
    setSelectedHumanId(human.id);
    const cell = snapshotCellById.get(human.currentCellId);

    if (cell) {
      selectInspectorCell(cell);
    }
  };

  const applyCanvasSize = useEffectEvent((nextCanvasSize: { width: number; height: number }) => {
    setCanvasSize(nextCanvasSize);
    setView(createFitView(snapshot, nextCanvasSize.width, nextCanvasSize.height));
  });

  useEffect(() => {
    cellByIdRef.current = new Map(snapshot.cells.map((cell) => [cell.id, cell]));
    cellByGridKeyRef.current = new Map(snapshot.cells.map((cell) => [`${getDisplayRow(snapshot, cell)}:${cell.column}`, cell]));
    continentCacheRef.current = null;
  }, [snapshot]);

  useEffect(() => {
    syncAtlasLocation(snapshot, selectedCell?.id ?? null);

    if (selectedCellId && !selectedCell && typeof window !== "undefined") {
      window.sessionStorage.removeItem(SELECTED_CELL_STORAGE_KEY);
    }
  }, [selectedCell, selectedCellId, snapshot]);

  useEffect(() => {
    const host = canvasHostRef.current;

    if (!host) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      const timeoutId = window.setTimeout(() => {
        applyCanvasSize({ width: host.clientWidth || 1120, height: host.clientHeight || 680 });
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      applyCanvasSize({
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

  const loadSnapshot = useEffectEvent(async (worldId: string, day: number) => {
    try {
      setError(null);
      setIsAtlasLoading(true);
      const nextSnapshot = await fetchSnapshot(worldId, day);
      setSnapshot(nextSnapshot);
      setSelectedWorldId(nextSnapshot.worldId);
      setDraftDay(nextSnapshot.selectedDay);
      setCommittedDay(nextSnapshot.selectedDay);
      setView(createFitView(nextSnapshot, canvasSize.width, canvasSize.height));
      clearInspectorCell();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load atlas snapshot.");
    } finally {
      setIsAtlasLoading(false);
    }
  });
  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextDay = draftDay >= selectedWorld.yearLengthDays ? 1 : draftDay + 1;
      setDraftDay(nextDay);
      setCommittedDay(nextDay);
    }, 1600);

    return () => window.clearInterval(intervalId);
  }, [draftDay, isRunning, selectedWorld.yearLengthDays]);

  useEffect(() => {
    if (selectedWorldId === snapshot.worldId && committedDay === snapshot.selectedDay) {
      return;
    }

    startTransition(() => {
      void loadSnapshot(selectedWorldId, committedDay);
    });
  }, [committedDay, selectedWorldId, snapshot.selectedDay, snapshot.worldId]);

  useEffect(() => {
    if (!hasMountedHealthRef.current) {
      hasMountedHealthRef.current = true;
      return;
    }

    let cancelled = false;
    setHealthError(null);
    setIsHealthLoading(true);

    void fetchHealth(selectedWorldId)
      .then((nextHealth) => {
        if (!cancelled) {
          setHealth(nextHealth);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setHealthError(loadError instanceof Error ? loadError.message : "Unable to load world health.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHealthLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchHealth, selectedWorldId]);


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

    renderAtlasBeautyEffects(context, snapshot, {
      x: mapOrigin.x,
      y: mapOrigin.y,
      cellSize: MAP_CELL_SIZE,
      scale: view.scale,
      quality: effectiveBeautyQuality,
      cloudsEnabled,
      cloudOpacity,
      atmosphereEnabled,
      dayNightEnabled,
    });

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

    const shouldDrawGrid = visualMode === "simulationGrid" || (visualMode === "hybrid" && gridOpacity > 0) || isOverlayVisible("gridLines");

    if (shouldDrawGrid) {
      const topLeft = transform.worldToScreen(0, 0);
      const bottomRight = transform.worldToScreen(snapshot.grid.longitudeDivisions, snapshot.grid.latitudeDivisions);
      const resolvedGridOpacity = visualMode === "simulationGrid" ? Math.max(gridOpacity, 0.55) : visualMode === "hybrid" ? gridOpacity * 0.7 : gridOpacity;
      context.strokeStyle = `rgba(210,238,255,${clamp(resolvedGridOpacity, 0, 0.86)})`;
      context.lineWidth = visualMode === "simulationGrid" ? 1.2 : 1;

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

    if (isOverlayVisible("animalMovementVectors") || selectedLayerId === "ecosystemMigration") {
      context.strokeStyle = "rgba(255, 198, 96, 0.76)";
      context.fillStyle = "rgba(255, 198, 96, 0.76)";
      context.lineWidth = 1;

      for (const cell of snapshot.cells) {
        const from = transform.cellRect(cell);

        for (const vector of cell.movementVectors.filter((entry) => entry.fromCellId === cell.id).slice(0, 3)) {
          const target = cellByIdRef.current.get(vector.toCellId);

          if (!target) {
            continue;
          }

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

    if (isOverlayVisible("cellIds") || visualMode === "simulationGrid") {
      context.fillStyle = "rgba(255,255,255,0.8)";
      context.font = `${Math.max(7, 8 * view.scale)}px var(--font-sans)`;

      for (const cell of snapshot.cells) {
        const rect = transform.cellRect(cell);
        context.fillText(cell.id.replace("cell-", ""), rect.x + 2 * view.scale, rect.y + 10 * view.scale);
      }
    }

    if (showHumansOverlay) {
      for (const point of getHumanMarkerPoints(snapshot, transform, cellByIdRef.current)) {
        drawHumanMarker(context, point, point.human.id === selectedHumanId);
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
  }, [atmosphereEnabled, autoOverlayMask, canvasSize.height, canvasSize.width, cloudOpacity, cloudsEnabled, dayNightEnabled, effectiveBeautyQuality, gridOpacity, hoveredCell, overlays, selectedCell, selectedHumanId, selectedLayerId, showHumansOverlay, snapshot, view, visualMode]);

  // Build base layer buffer when snapshot or layer changes
  useEffect(() => {
    const key = `${snapshot.worldId}:${snapshot.selectedDay}:${selectedLayerId}:${visualMode}:${effectiveBeautyQuality}:${snapshot.grid.latitudeDivisions}x${snapshot.grid.longitudeDivisions}`;
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
    renderAtlasBaseLayer(ctx, snapshot, {
      visualMode,
      selectedLayerId,
      cellSize: MAP_CELL_SIZE,
      quality: effectiveBeautyQuality,
      getLayerColor: (cell) => getLayerColor(snapshot, cell, selectedLayerId),
    });
    baseLayerBufferRef.current = buffer;
    baseLayerCacheKeyRef.current = key;
  }, [effectiveBeautyQuality, selectedLayerId, snapshot, visualMode]);

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
    selectInspectorCell(cell);
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

  const focusHuman = (human: AtlasHumanAgentView) => {
    const cell = snapshotCellById.get(human.currentCellId);

    if (cell) {
      setSelectedHumanId(human.id);
      focusCell(cell);
    }
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

    const latOnly = q.match(/^(-?\d{1,2})(?:\s*(?:deg|degree|degrees))?\s*([ns])?$/i);
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
    const coordMatch = q.match(/^\s*([+-]?\d{1,2})(?:\s*(?:deg|degree|degrees))?\s*([ns])?\s*,\s*([+-]?\d{1,3})(?:\s*(?:deg|degree|degrees))?\s*([ew])?\s*$/i);
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
  const handleKeyboardShortcut = useEffectEvent((e: KeyboardEvent) => {
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
    if (e.key === "Escape") { clearInspectorCell(); setShowSearch(false); return; }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
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
      lastHoveredCellIdRef.current = cell.id;
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
    const cell = getCellAtClientPosition(event.clientX, event.clientY) ?? (lastHoveredCellIdRef.current ? snapshotCellById.get(lastHoveredCellIdRef.current) ?? null : null);

    if (drag && Math.abs(event.clientX - drag.x) < 2 && Math.abs(event.clientY - drag.y) < 2 && cell) {
      selectInspectorCell(cell);
    }

    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (canvas && showHumansOverlay) {
      const rect = canvas.getBoundingClientRect();
      const transform = createAtlasCoordinateTransform(snapshot, view);
      const human = findHumanMarkerAt(
        snapshot,
        transform,
        cellByIdRef.current,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );

      if (human) {
        selectHuman(human);
        return;
      }
    }

    const cell = getCellAtClientPosition(event.clientX, event.clientY) ?? (lastHoveredCellIdRef.current ? snapshotCellById.get(lastHoveredCellIdRef.current) ?? null : null);

    if (cell) {
      selectInspectorCell(cell);
    }
  };

  const onCanvasPointerLeave = () => {
    setHoverState(null);
    dragStateRef.current = null;
  };

  const selectedLayer = getLayerDefinition(selectedLayerId);
  const tooltipCell = hoveredCell ?? selectedCell;
  const tooltipSummary = tooltipCell ? getTooltipSummary(tooltipCell) : null;
  const activeStatistics = getLayerStatistics(snapshot, selectedLayerId);
  const legendItems = getLegendItems(snapshot, selectedLayerId);
  const inspectorCell = selectedCell;
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
              <DetailCard label="Active Overlay" value={selectedLayer.label} />
              <DetailCard label="Humans" value={`${snapshot.humans.agents.length} visible`} />
              <DetailCard label="Visual Mode" value={activeVisualMode.label} />
              <DetailCard label="View" value={activeViewMode.label} />
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              {/* Toolbar */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button type="button" data-testid="toolbar-search" onClick={() => setShowSearch((v) => !v)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Search (F)</button>
                <button type="button" onClick={() => setShowLegend((v) => !v)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Legend (L)</button>
                <button type="button" onClick={() => onToggleOverlay("gridLines")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Grid (G)</button>
                <button type="button" onClick={() => onToggleOverlay("windArrows")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-200">Wind (W)</button>
                <button type="button" data-testid="humans-overlay-toggle" onClick={() => setShowHumansOverlay((value) => !value)} className={`rounded-full border px-3 py-1.5 text-xs ${showHumansOverlay ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/5 text-stone-200"}`}>Humans</button>
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
                  value={draftDay}
                  onChange={(event) => setDraftDay(Number(event.target.value))}
                  onPointerUp={(event) => commitDraftDay(Number(event.currentTarget.value))}
                  onPointerCancel={(event) => commitDraftDay(Number(event.currentTarget.value))}
                  onKeyUp={(event) => {
                    if (TIMELINE_COMMIT_KEYS.has(event.key)) {
                      commitDraftDay(Number(event.currentTarget.value));
                    }
                  }}
                  onBlur={(event) => commitDraftDay(Number(event.currentTarget.value))}
                  className="w-full accent-amber-300"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
                  <span>Day 1</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-stone-200">Selected Day {draftDay}</span>
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
                          const clampedDay = clamp(draftDay, 1, nextWorld.yearLengthDays);
                          setSelectedWorldId(nextWorld.id);
                          setDraftDay(clampedDay);
                          setCommittedDay(clampedDay);
                        }}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0c1218] px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-amber-300/50"
                      >
                        {worlds.map((world) => (
                          <option key={world.id} value={world.id}>{world.name}</option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-xl border border-teal-300/15 bg-teal-300/[0.04] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Run Controls</p>
                          <p className="mt-1 text-xs text-stone-400">Snapshot day stepping</p>
                        </div>
                        <button type="button" onClick={() => setIsRunning((value) => !value)} className={`rounded-lg border px-3 py-2 text-xs uppercase tracking-[0.18em] ${isRunning ? "border-amber-300/50 bg-amber-300/15 text-amber-100" : "border-teal-300/40 bg-teal-300/10 text-teal-100"}`}>{isRunning ? "Pause" : "Run"}</button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => commitDraftDay(draftDay - 1)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-xs text-stone-200 hover:bg-white/[0.08]">Tick -</button>
                        <button type="button" onClick={() => commitDraftDay(draftDay)} className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-2 text-xs text-amber-100 hover:bg-amber-300/15">Load</button>
                        <button type="button" onClick={() => commitDraftDay(draftDay + 1)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-xs text-stone-200 hover:bg-white/[0.08]">Tick +</button>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs uppercase tracking-[0.22em] text-stone-500">View Mode</span>
                      <div className="mt-2 grid gap-2">
                        {VIEW_MODE_OPTIONS.map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setViewMode(mode.id)}
                            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${viewMode === mode.id ? "border-cyan-300/45 bg-cyan-300/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.07]"}`}
                          >
                            <span className="block">{mode.label}</span>
                            <span className="mt-1 block text-xs text-stone-500">{mode.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs uppercase tracking-[0.22em] text-stone-500">Visual Mode</span>
                      <div className="mt-2 grid gap-2">
                        {VISUAL_MODE_OPTIONS.map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setVisualMode(mode.id)}
                            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${visualMode === mode.id ? "border-teal-300/45 bg-teal-300/12 text-teal-100" : "border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.07]"}`}
                          >
                            <span className="block">{mode.label}</span>
                            <span className="mt-1 block text-xs text-stone-500">{mode.description}</span>
                          </button>
                        ))}
                      </div>
                      <label className="mt-3 block">
                        <span className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-stone-500"><span>Grid Opacity</span><span>{formatPercent(gridOpacity)}</span></span>
                        <input aria-label="Grid Opacity" type="range" min={0} max={0.9} step={0.03} value={gridOpacity} onChange={(event) => setGridOpacity(Number(event.target.value))} className="mt-2 w-full accent-teal-300" />
                      </label>
                    </div>

                    <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
                      <span className="text-xs uppercase tracking-[0.22em] text-stone-500">Beauty Effects</span>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {BEAUTY_QUALITY_OPTIONS.map((quality) => (
                          <button
                            key={quality.id}
                            type="button"
                            onClick={() => setBeautyQuality(quality.id)}
                            className={`rounded-lg border px-2 py-2 text-xs transition ${beautyQuality === quality.id ? "border-cyan-300/45 bg-cyan-300/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.07]"}`}
                          >
                            {quality.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2">
                        <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-200">
                          <span>Atmosphere</span>
                          <input type="checkbox" checked={atmosphereEnabled} onChange={() => setAtmosphereEnabled((value) => !value)} className="accent-cyan-300" />
                        </label>
                        <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-200">
                          <span>Day / Night</span>
                          <input type="checkbox" checked={dayNightEnabled} onChange={() => setDayNightEnabled((value) => !value)} className="accent-cyan-300" />
                        </label>
                        <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-200">
                          <span>Clouds</span>
                          <input type="checkbox" checked={cloudsEnabled} onChange={() => setCloudsEnabled((value) => !value)} className="accent-cyan-300" />
                        </label>
                      </div>
                      <label className="mt-3 block">
                        <span className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-stone-500"><span>Cloud Opacity</span><span>{formatPercent(cloudOpacity)}</span></span>
                        <input aria-label="Cloud Opacity" type="range" min={0} max={0.65} step={0.01} value={cloudOpacity} onChange={(event) => setCloudOpacity(Number(event.target.value))} className="mt-2 w-full accent-cyan-300" />
                      </label>
                    </div>

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
                                    onClick={() => onLayerSelect(layer.id)}
                                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${active
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
                      <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs uppercase tracking-[0.22em] text-stone-400">{showAdvanced ? "Hide Advanced / Debug" : "Advanced / Debug"}</button>
                      {showAdvanced ? (
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
                      ) : null}
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
                      <p className="mt-1 text-sm text-stone-400">{selectedLayer.description} {activeVisualMode.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={resetView} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-200 transition hover:bg-white/10">Reset View</button>
                      <button type="button" onClick={() => setView((current) => ({ ...current, scale: clamp(current.scale * 1.2, MIN_SCALE, MAX_SCALE) }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-200 transition hover:bg-white/10">Zoom In</button>
                      <button type="button" onClick={() => setView((current) => ({ ...current, scale: clamp(current.scale * 0.85, MIN_SCALE, MAX_SCALE) }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-200 transition hover:bg-white/10">Zoom Out</button>
                    </div>
                  </div>

                  {viewMode === "globePreview" ? (
                    <GlobePreviewPanel
                      descriptor={atlasTextureDescriptor}
                      snapshot={snapshot}
                      atlasTextureRef={baseLayerBufferRef}
                      selectedCellId={selectedCellId}
                      rotationSpeed={globeRotationSpeed}
                      rotationPaused={isGlobeRotationPaused}
                      showClouds={cloudsEnabled}
                      showAtmosphere={atmosphereEnabled}
                      showDayNight={dayNightEnabled}
                      beautyQuality={effectiveBeautyQuality}
                      onSelectCell={selectInspectorCell}
                      onHoverCell={(cellId, point) => setHoverState(cellId && point ? { cellId, x: point.x, y: point.y } : null)}
                    />
                  ) : null}
                  <div ref={canvasHostRef} className={viewMode === "developerAtlas" ? "relative h-[620px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#071017] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]" : "hidden"}>
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
                    {(tooltipCell && tooltipSummary) ? (
                      <div data-testid="atlas-tooltip" className="pointer-events-none absolute right-4 top-4 z-50 w-80 rounded-2xl border border-white/10 bg-[#0b1117]/95 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">{hoveredCell ? "Hover Cell" : "Selected Cell"}</p>
                            <p className="mt-1 text-sm font-medium text-stone-50">{tooltipCell.id}</p>
                          </div>
                          <div className="text-right text-xs text-stone-400">
                            <p>{formatLatitude(tooltipCell.midpointLatitude)}</p>
                            <p>{formatLongitude(tooltipCell.midpointLongitude)}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 text-xs text-stone-200">
                          <p><span className="text-stone-500">Elevation</span> {formatNumber(tooltipCell.elevation, 3)}</p>
                          <p><span className="text-stone-500">Terrain</span> {titleize(tooltipCell.terrainType)}</p>
                          <p><span className="text-stone-500">Climate</span> {tooltipCell.climateBand}</p>
                          <p><span className="text-stone-500">Temperature</span> {formatTemperature(tooltipCell.averageTemperatureC)}</p>
                          <p><span className="text-stone-500">Solar Energy</span> {formatNumber(tooltipCell.solarEnergy, 3)}</p>
                          <p><span className="text-stone-500">Hydrology</span> {tooltipSummary.hydrology}</p>
                          <p><span className="text-stone-500">Atmosphere</span> {tooltipSummary.atmosphere}</p>
                          <p><span className="text-stone-500">Weather</span> {tooltipSummary.weather}</p>
                          <p><span className="text-stone-500">Resources</span> {tooltipSummary.resources}</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Scroll: zoom</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Drag: pan</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Click: inspect cell</span>
                      </div>
                      <p className="text-xs text-stone-500">{error ?? `${snapshot.grid.totalCells} logical cells / ${activeVisualMode.label} render`}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4" style={{ opacity: legendOpacity }}>
                    <div className="flex items-center justify-between">
                      <div><p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Legend / Quick Stats</p><p className="mt-1 text-xs text-stone-400">Visual render layer is separate from the 18x36 simulation grid.</p></div>
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
            <WorldHealthPanel health={health} loading={isHealthLoading} error={healthError} />
            <HumanInspectorPanel
              human={selectedHuman}
              humans={snapshot.humans.agents}
              onSelectHuman={selectHuman}
              onFocusHuman={focusHuman}
              onSimulateOneDay={() => commitDraftDay(draftDay + 1)}
            />
            <FutureLayersPanel snapshot={snapshot} selectedCell={inspectorCell} loading={isAtlasLoading || isPending} error={error} />

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
                <DetailCard label="Resource Diversity" value={formatPercent(snapshot.resourceSummary.resourceDiversity)} />
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
            <section data-testid="cell-inspector" className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Cell Inspector</p>
              {inspectorCell ? (
                <div className="mt-4 space-y-4 text-sm text-stone-200">
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/80">Selected Cell</p>
                    <p className="mt-2 text-lg text-stone-50">{inspectorCell.id}</p>
                    <p className="mt-1 text-sm text-stone-400">{formatLatitude(inspectorCell.midpointLatitude)} / {formatLongitude(inspectorCell.midpointLongitude)}</p>
                  </div>

                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/80">Humans In Cell</p>
                    <div className="mt-3 grid gap-2 text-xs text-stone-200">
                      {(humansByCell.get(inspectorCell.id) ?? []).length > 0 ? (humansByCell.get(inspectorCell.id) ?? []).map((human) => (
                        <button key={human.id} type="button" onClick={() => selectHuman(human)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-stone-200 hover:bg-white/[0.07]">
                          <span className="block text-stone-50">{human.label}</span>
                          <span className="mt-1 block text-stone-400">{human.sex} / {human.currentAction ? titleize(human.currentAction) : "no action"}</span>
                        </button>
                      )) : <p>No humans are currently in this cell.</p>}
                    </div>
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
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Resources</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Bedrock {titleize(inspectorCell.bedrockType)}</p>
                        <p>Iron {formatPercent(inspectorCell.metals.iron)}</p>
                        <p>Copper {formatPercent(inspectorCell.metals.copper)}</p>
                        <p>Coal {formatPercent(inspectorCell.industrialMaterials.coal)}</p>
                        <p>Gold {formatPercent(inspectorCell.metals.gold)}</p>
                        <p>Groundwater {formatPercent(inspectorCell.waterResources.groundwaterPotential)}</p>
                        <p>Stone {formatPercent(inspectorCell.buildingResources.stone)}</p>
                        <p>Clay {formatPercent(inspectorCell.industrialMaterials.clay)}</p>
                        <p>Rare Earths {formatPercent(inspectorCell.rareMaterials.rareEarthElements)}</p>
                        <p>Volcanic influence {formatPercent(inspectorCell.volcanicInfluence)}</p>
                        <p>Sediment depth {formatPercent(inspectorCell.sedimentDepth)}</p>
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

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Biome</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Biome {formatAtlasLabel(inspectorCell.biomeName, "Unclassified")}</p>
                        <p>Category {titleize(formatAtlasLabel(inspectorCell.biomeCategory, "unclassified"))}</p>
                        <p>Key {formatAtlasLabel(inspectorCell.biomeKey, "unclassified")}</p>
                        <p>Habitability {formatNumber(inspectorCell.habitabilityScore, 3)}</p>
                        <p>Fertility {formatNumber(inspectorCell.fertilityScore, 3)}</p>
                        <p>Water availability {formatNumber(inspectorCell.waterAvailabilityScore, 3)}</p>
                        <p>Vegetation density {formatNumber(inspectorCell.vegetationDensity, 3)}</p>
                        <p>Tags {formatTagList(inspectorCell.biomeTags, "Unclassified")}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Ecology</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Dominant plant {formatAtlasLabel(inspectorCell.dominantPlantName, "No Established Plant Life")}</p>
                        <p>Plant category {titleize(formatAtlasLabel(inspectorCell.dominantPlantCategory, "none"))}</p>
                        <p>Plant key {formatAtlasLabel(inspectorCell.dominantPlantKey, "none")}</p>
                        <p>Plant suitability {formatNumber(inspectorCell.plantSuitabilityScore, 3)}</p>
                        <p>Plant density {formatNumber(inspectorCell.plantDensity, 3)}</p>
                        <p>Biomass {formatNumber(inspectorCell.biomassScore, 3)}</p>
                        <p>Edible plant score {formatNumber(inspectorCell.ediblePlantScore, 3)}</p>
                        <p>Wood material score {formatNumber(inspectorCell.woodMaterialScore, 3)}</p>
                        <p>Medicinal potential {formatNumber(inspectorCell.medicinalPotentialScore, 3)}</p>
                        <p>Biodiversity {formatNumber(inspectorCell.biodiversityScore, 3)}</p>
                        <p>Regrowth {formatNumber(inspectorCell.regrowthRate, 3)}</p>
                        <p>Seasonal stress {formatNumber(inspectorCell.seasonalStressScore, 3)}</p>
                        <p>Plant tags {formatTagList(inspectorCell.plantTags)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Animals</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Dominant species {formatAtlasLabel(inspectorCell.dominantSpeciesName, "No Established Wildlife")}</p>
                        <p>Dominant guild {formatAtlasLabel(inspectorCell.dominantAnimalGuildName, "No Established Animal Guild")}</p>
                        <p>Species present {formatNumber(inspectorCell.speciesCount, 0)}</p>
                        <p>Total population {formatNumber(inspectorCell.totalWildlifePopulation, 0)}</p>
                        <p>Ecosystem health {inspectorCell.ecosystemHealthStatus} / {formatNumber(inspectorCell.ecosystemHealthScore, 3)}</p>
                        <p>Habitat suitability {formatNumber(inspectorCell.averageHabitatSuitability, 3)}</p>
                        <p>Health {formatNumber(inspectorCell.averagePopulationHealth, 3)}</p>
                        <p>Food availability {formatNumber(inspectorCell.animalPopulations[0]?.foodAvailability ?? 0, 3)}</p>
                        <p>Food stability {formatNumber(inspectorCell.foodStability, 3)}</p>
                        <p>Plant consumption {formatNumber(inspectorCell.plantConsumptionRate, 3)}</p>
                        <p>Predation pressure {formatNumber(inspectorCell.predationPressure, 3)}</p>
                        <p>Carrying usage {formatNumber(inspectorCell.carryingCapacityUsage, 3)}</p>
                        <p>Migration pressure {formatNumber(inspectorCell.migrationPressure, 3)}</p>
                        <p>Migration activity {formatNumber(inspectorCell.migrationActivity, 3)}</p>
                        <p>Movement vectors {inspectorCell.movementVectors.map((vector) => `${vector.speciesId}: ${vector.fromCellId} -> ${vector.toCellId} (${formatNumber(vector.population, 0)})`).join(", ") || "None"}</p>
                        <p>History {inspectorCell.ecosystemHistory.slice(0, 4).map((event) => `Tick ${event.tick}: ${event.type}`).join(", ") || "None"}</p>
                        <p>Populations {inspectorCell.animalPopulations.filter((population) => population.population > 0).slice(0, 8).map((population) => `${population.speciesName}: ${formatNumber(population.population, 0)}`).join(", ") || "None"}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Adaptation</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        <p>Overall fitness {formatNumber(inspectorCell.averageFitness, 3)}</p>
                        <p>Adaptation diversity {formatNumber(inspectorCell.adaptationDiversity, 3)}</p>
                        <p>Highest adapted {inspectorCell.highestAdaptedPopulation ? `${inspectorCell.highestAdaptedPopulation.speciesName}: ${formatNumber(inspectorCell.highestAdaptedPopulation.score, 3)}` : "None"}</p>
                        <p>Lowest fitness {inspectorCell.lowestFitnessPopulation ? `${inspectorCell.lowestFitnessPopulation.speciesName}: ${formatNumber(inspectorCell.lowestFitnessPopulation.score, 3)}` : "None"}</p>
                        <p>Top strengths {inspectorCell.animalPopulations.filter((population) => population.population > 0).slice(0, 3).map((population) => {
                          const traits = Object.entries(population.adaptationProfile).sort((left, right) => right[1] - left[1]).slice(0, 2).map(([trait, value]) => `${titleize(trait)} ${formatNumber(value, 2)}`).join(" / ");
                          return `${population.speciesName}: ${traits}`;
                        }).join(", ") || "None"}</p>
                        <p>Biggest weaknesses {inspectorCell.animalPopulations.filter((population) => population.population > 0).slice(0, 3).map((population) => {
                          const traits = Object.entries(population.adaptationProfile).sort((left, right) => left[1] - right[1]).slice(0, 2).map(([trait, value]) => `${titleize(trait)} ${formatNumber(value, 2)}`).join(" / ");
                          return `${population.speciesName}: ${traits}`;
                        }).join(", ") || "None"}</p>
                        {inspectorCell.animalPopulations.filter((population) => population.population > 0).slice(0, 4).map((population) => {
                          const trend = population.adaptationTrends.find((entry) => entry.direction !== "Stable") ?? population.adaptationTrends[0];
                          return (
                            <div key={`${population.speciesId}-adaptation`} className="mt-2 border-t border-white/10 pt-2">
                              <p className="text-stone-100">{population.speciesName}</p>
                              <p>Cold Tolerance <HealthBar value={population.adaptationProfile.coldTolerance} /> {formatNumber(population.adaptationProfile.coldTolerance, 2)}</p>
                              <p>Heat Tolerance <HealthBar value={population.adaptationProfile.heatTolerance} /> {formatNumber(population.adaptationProfile.heatTolerance, 2)}</p>
                              <p>Drought Tolerance <HealthBar value={population.adaptationProfile.droughtTolerance} /> {formatNumber(population.adaptationProfile.droughtTolerance, 2)}</p>
                              <p>Foraging Efficiency <HealthBar value={population.adaptationProfile.foragingEfficiency} /> {formatNumber(population.adaptationProfile.foragingEfficiency, 2)}</p>
                              <p>Trend: {trend?.direction ?? "Stable"}</p>
                              <p>Reason: {trend?.reason ?? "Stable local pressure."}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Warnings</p>
                      <div className="mt-3 grid gap-2 text-xs text-stone-200">
                        {(getCellWarnings(inspectorCell).length > 0 ? getCellWarnings(inspectorCell) : ["No unstable conditions flagged for this cell."]).map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    </div>
                    <LayerStatusCard label="Civilizations" value="Civilization Systems Not Generated Yet" />
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











