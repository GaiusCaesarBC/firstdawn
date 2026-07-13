"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { buildHumanMapSpriteModel, buildHumanSpriteModel, HUMAN_SPRITE_NATIVE_HEIGHT, HUMAN_SPRITE_NATIVE_WIDTH } from "../../../lib/simulation/human-sprite";
import type { AtlasCell, AtlasHumanAgent, AtlasSnapshot, AtlasWorldOption } from "../../../lib/worlds/map-atlas";
import { PlanetGlobeRenderer } from "./planet-globe-renderer";

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
  | "resources"
  | "animals"
  | "civilizations"
  | "populationDensity"
  | "knowledgeDensity"
  | "resourceDensity"
  | "animalDensity"
  | "weatherIntensity";

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
  | "mountainOutlines"
  | "humans"
  | "settlements"
  | "animalMovement";

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

type SignalToggleId =
  | "humans"
  | "settlements"
  | "animals"
  | "resources"
  | "weather"
  | "knowledge"
  | "communication"
  | "families"
  | "heatmaps";

type MissionEvent = {
  id: string;
  tick: string;
  category: string;
  title: string;
  summary: string;
  cellId: string | null;
  humanId: string | null;
  settlementId: string | null;
};

type GlobeLayerId =
  | "terrain"
  | "ocean"
  | "lighting"
  | "biomes"
  | "vegetation"
  | "snow"
  | "clouds"
  | "atmosphere"
  | "weather"
  | "temperature"
  | "resources"
  | "animals"
  | "humans"
  | "movement"
  | "knowledge"
  | "communication"
  | "families"
  | "settlements"
  | "trade"
  | "debug";

type GlobeLayerSetting = {
  visible: boolean;
  opacity: number;
};

type GlobeLayerPresetId = "planet" | "terrainOnly" | "clearSky" | "weather" | "ecology" | "civilization" | "developer";

type GlobeLayerDefinition = {
  id: GlobeLayerId;
  label: string;
  priority: number;
  description: string;
};
type HealthTelemetry = {
  lastTickStatus?: string | null;
  latestSimulationTickNumber?: string | null;
  failedSystems?: string[];
  systemHealthStatus?: string | null;
  systemHealthDiagnostics?: string[];
  badge?: string | null;
  currentTick?: string | null;
} | null;

type AtlasSnapshotRequest = {
  worldId: string;
  day: number;
  key: string;
};

type AtlasSnapshotFetcher = (worldId: string, day?: number | null) => Promise<AtlasSnapshot>;

type WorldMapAtlasClientProps = {
  worlds: AtlasWorldOption[];
  initialSnapshot: AtlasSnapshot | null;
  initialWorldId?: string | null;
  initialDay?: number | null;
  fetchSnapshot?: AtlasSnapshotFetcher;
};

type WorldMapAtlasLoadedClientProps = {
  worlds: AtlasWorldOption[];
  initialSnapshot: AtlasSnapshot;
  fetchSnapshot?: AtlasSnapshotFetcher;
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
  gridLines: "Grid (G)",
  cellIds: "Cell IDs",
  neighborLinks: "Neighbor links",
  drainageArrows: "Drainage arrows",
  pressureBands: "Pressure bands",
  mountainOutlines: "Mountain outlines",
  humans: "Human positions",
  settlements: "Settlements",
  animalMovement: "Animal movement",
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
  { id: "biomes", label: "Biomes", group: "Living Systems", description: "Dominant biome classification produced by the biome engine." },
  { id: "vegetation", label: "Vegetation", group: "Living Systems", description: "Dominant plant life and biomass produced by plant ecology." },
  { id: "resources", label: "Resources", group: "Living Systems", description: "Planetary resource richness and material availability." },
  { id: "animals", label: "Animals", group: "Living Systems", description: "Animal guilds, wildlife populations, and ecosystem health." },
  { id: "civilizations", label: "Civilizations", group: "Living Systems", description: "Human positions, settlements, families, resources, and social knowledge." },
  { id: "populationDensity", label: "Population Density", group: "Heatmaps", description: "Relative human density by current cell." },
  { id: "knowledgeDensity", label: "Knowledge Density", group: "Heatmaps", description: "Known topic count concentrated by current human location." },
  { id: "resourceDensity", label: "Resource Density", group: "Heatmaps", description: "Composite resource richness from existing planet resource fields." },
  { id: "animalDensity", label: "Animal Density", group: "Heatmaps", description: "Wildlife density and population pressure by cell." },
  { id: "weatherIntensity", label: "Weather Intensity", group: "Heatmaps", description: "Composite cloud, precipitation, storm, and dryness signal." },
];

const SIGNAL_TOGGLE_LABELS: Record<SignalToggleId, string> = {
  humans: "Humans",
  settlements: "Settlements",
  animals: "Animals",
  resources: "Resources",
  weather: "Weather",
  knowledge: "Knowledge",
  communication: "Communication",
  families: "Families",
  heatmaps: "Heatmaps",
};

const DEFAULT_SIGNAL_TOGGLES: Record<SignalToggleId, boolean> = {
  humans: true,
  settlements: true,
  animals: true,
  resources: false,
  weather: false,
  knowledge: false,
  communication: false,
  families: false,
  heatmaps: false,
};

const TIMELINE_SPEEDS = [1, 3, 7, 30] as const;
const MISSION_TIMELINE_SPEEDS = [1, 5, 10, 100, 1000] as const;
const PLAYBACK_MIN_DELAY_MS = 120;
const PLAYBACK_BUSY_RETRY_MS = 180;
const PLAYBACK_MAX_COOLDOWN_MS = 1200;
const HEALTH_PLAYBACK_DEBOUNCE_MS = 1200;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function logAtlasTiming(label: string, durationMs: number, details?: Record<string, string | number | boolean | null>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info(`[atlas:timing] ${label} ${durationMs.toFixed(1)} ms`, details ?? "");
}

const GLOBE_LAYER_DEFINITIONS: GlobeLayerDefinition[] = [
  { id: "terrain", label: "Terrain", priority: 10, description: "Base land and elevation color." },
  { id: "ocean", label: "Ocean", priority: 20, description: "Water depth and ocean material." },
  { id: "lighting", label: "Relief", priority: 30, description: "Directional light and height shading." },
  { id: "biomes", label: "Biomes", priority: 40, description: "Soft biome tint over terrain." },
  { id: "vegetation", label: "Vegetation", priority: 50, description: "Plant and biomass tint." },
  { id: "snow", label: "Snow", priority: 60, description: "Seasonal snow blended with terrain." },
  { id: "clouds", label: "Clouds", priority: 70, description: "Moving translucent cloud cover." },
  { id: "atmosphere", label: "Atmosphere", priority: 80, description: "Subtle limb scattering." },
  { id: "weather", label: "Weather", priority: 90, description: "Storm and precipitation overlay." },
  { id: "temperature", label: "Temperature", priority: 95, description: "Subtle thermal tint over the terrain." },
  { id: "resources", label: "Resources", priority: 100, description: "Subtle resource heat signals." },
  { id: "animals", label: "Animals", priority: 110, description: "Wildlife population indicators." },
  { id: "humans", label: "Humans", priority: 120, description: "Citizen pulses and markers." },
  { id: "movement", label: "Movement", priority: 122, description: "Recent human path traces." },
  { id: "knowledge", label: "Knowledge", priority: 124, description: "Knowledge concentration around citizens." },
  { id: "communication", label: "Communication", priority: 126, description: "Message activity around citizens." },
  { id: "families", label: "Families", priority: 128, description: "Family homes and selected kin links." },
  { id: "settlements", label: "Settlements", priority: 130, description: "Settlement glow and markers." },
  { id: "trade", label: "Trade", priority: 140, description: "Settlement exchange and movement paths." },
  { id: "debug", label: "Debug", priority: 150, description: "Inspection grid and regional guides." },
];

const BASE_GLOBE_LAYERS: Record<GlobeLayerId, GlobeLayerSetting> = {
  terrain: { visible: true, opacity: 1 },
  ocean: { visible: true, opacity: 1 },
  lighting: { visible: true, opacity: 0.72 },
  biomes: { visible: false, opacity: 0.28 },
  vegetation: { visible: false, opacity: 0.28 },
  snow: { visible: true, opacity: 0.2 },
  clouds: { visible: true, opacity: 0.08 },
  atmosphere: { visible: true, opacity: 0.34 },
  weather: { visible: false, opacity: 0.28 },
  temperature: { visible: false, opacity: 0.2 },
  resources: { visible: false, opacity: 0.22 },
  animals: { visible: false, opacity: 0.78 },
  humans: { visible: true, opacity: 1 },
  movement: { visible: false, opacity: 0.55 },
  knowledge: { visible: false, opacity: 0.5 },
  communication: { visible: false, opacity: 0.48 },
  families: { visible: false, opacity: 0.5 },
  settlements: { visible: true, opacity: 0.9 },
  trade: { visible: false, opacity: 0.55 },
  debug: { visible: false, opacity: 0.42 },
};

const GLOBE_LAYER_PRESETS: Record<GlobeLayerPresetId, Record<GlobeLayerId, GlobeLayerSetting>> = {
  planet: BASE_GLOBE_LAYERS,
  terrainOnly: {
    ...BASE_GLOBE_LAYERS,
    lighting: { visible: true, opacity: 0.68 },
    snow: { visible: false, opacity: 0.16 },
    atmosphere: { visible: false, opacity: 0.12 },
    humans: { visible: false, opacity: 1 },
    settlements: { visible: false, opacity: 0.9 },
  },
  clearSky: {
    ...BASE_GLOBE_LAYERS,
    clouds: { visible: false, opacity: 0.05 },
    weather: { visible: false, opacity: 0.18 },
    atmosphere: { visible: true, opacity: 0.16 },
    snow: { visible: true, opacity: 0.16 },
  },
  weather: {
    ...BASE_GLOBE_LAYERS,
    snow: { visible: true, opacity: 0.3 },
    clouds: { visible: true, opacity: 0.18 },
    weather: { visible: true, opacity: 0.32 },
    temperature: { visible: true, opacity: 0.16 },
  },
  ecology: {
    ...BASE_GLOBE_LAYERS,
    biomes: { visible: true, opacity: 0.24 },
    vegetation: { visible: true, opacity: 0.3 },
    resources: { visible: true, opacity: 0.18 },
    animals: { visible: true, opacity: 0.78 },
    clouds: { visible: false, opacity: 0.08 },
  },
  civilization: {
    ...BASE_GLOBE_LAYERS,
    humans: { visible: true, opacity: 1 },
    movement: { visible: true, opacity: 0.45 },
    knowledge: { visible: true, opacity: 0.42 },
    communication: { visible: true, opacity: 0.4 },
    families: { visible: true, opacity: 0.42 },
    settlements: { visible: true, opacity: 0.95 },
    trade: { visible: true, opacity: 0.48 },
    clouds: { visible: false, opacity: 0.08 },
  },
  developer: Object.fromEntries(
    GLOBE_LAYER_DEFINITIONS.map((layer) => [layer.id, { visible: true, opacity: layer.id === "terrain" || layer.id === "ocean" ? 1 : 0.55 }]),
  ) as Record<GlobeLayerId, GlobeLayerSetting>,
};

const GLOBE_LAYER_PRESET_LABELS: Record<GlobeLayerPresetId, string> = {
  planet: "Planet",
  terrainOnly: "Terrain Only",
  clearSky: "Clear Sky",
  weather: "Weather",
  ecology: "Ecology",
  civilization: "Civilization",
  developer: "Developer",
};

const GLOBE_LAYER_QUICK_PRESETS: GlobeLayerPresetId[] = ["terrainOnly", "clearSky", "civilization", "weather", "ecology", "developer"];

function cloneGlobeLayers(layers: Record<GlobeLayerId, GlobeLayerSetting>): Record<GlobeLayerId, GlobeLayerSetting> {
  return Object.fromEntries(
    GLOBE_LAYER_DEFINITIONS.map((layer) => [layer.id, { ...layers[layer.id] }]),
  ) as Record<GlobeLayerId, GlobeLayerSetting>;
}
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
  humans: true,
  settlements: true,
  animalMovement: false,
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

const MISSION_LAYER_SECTIONS: Array<{
  id: string;
  title: string;
  eyebrow: string;
  layers: LayerId[];
  overlays: OverlayId[];
}> = [
  { id: "planet", title: "Planet", eyebrow: "Surface", layers: ["planet", "elevation", "terrain"], overlays: ["coastlines"] },
  { id: "climate", title: "Climate", eyebrow: "Atmosphere", layers: ["climate", "averageTemperature", "weather", "atmosphere", "windDirection", "cloudCover", "solarEnergy", "daylightHours"], overlays: ["windArrows", "pressureBands"] },
  { id: "ecology", title: "Ecology", eyebrow: "Living systems", layers: ["biomes", "vegetation", "animals", "resources"], overlays: ["animalMovement"] },
  { id: "civilization", title: "Civilization", eyebrow: "People", layers: ["civilizations", "populationDensity", "knowledgeDensity"], overlays: ["humans", "settlements"] },
  { id: "analysis", title: "Analysis", eyebrow: "Signals", layers: ["weatherIntensity", "resourceDensity", "animalDensity", "humidity", "dryness", "stormPotential", "snowPotential"], overlays: ["latitudeBands", "mountainOutlines", "watershedBoundaries"] },
  { id: "developer", title: "Developer", eyebrow: "Debug", layers: ["hydrology", "ocean", "watersheds", "riverCandidates", "lakeCandidates", "distanceToOcean", "pressureZones", "windStrength", "moistureTransport", "rainShadow", "fogPotential", "weatherType"], overlays: ["gridLines", "cellIds", "neighborLinks", "drainageArrows"] },
];

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
    case "vegetation":
    case "resources":
    case "animals":
    case "civilizations":
    case "populationDensity":
    case "knowledgeDensity":
    case "resourceDensity":
    case "animalDensity":
    case "weatherIntensity":
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

function getHumansInCell(snapshot: AtlasSnapshot, cellId: string) {
  return snapshot.humans.agents.filter((agent) => agent.currentCellId === cellId);
}

function getSettlementsForCell(snapshot: AtlasSnapshot, cellId: string) {
  return snapshot.settlements.settlements.filter((settlement) => settlement.homeCellId === cellId || settlement.occupiedCells.includes(cellId));
}

function getSettlementScoreForCell(snapshot: AtlasSnapshot, cellId: string): number {
  return snapshot.settlements.scoring.find((entry) => entry.cellId === cellId)?.score ?? 0;
}

function getFamiliesForCell(snapshot: AtlasSnapshot, cellId: string) {
  const settlements = getSettlementsForCell(snapshot, cellId);

  return snapshot.families.families.filter((family) =>
    family.homeCellId === cellId
    || (family.settlementId ? settlements.some((settlement) => settlement.id === family.settlementId) : false),
  );
}

function getKnowledgeCountForCell(snapshot: AtlasSnapshot, cellId: string): number {
  return getHumansInCell(snapshot, cellId).reduce((total, agent) => total + agent.knowledgeCount, 0);
}

const cellScoreMaximumCache = new WeakMap<AtlasSnapshot, Map<string, number>>();

function getMaximumCellScore(snapshot: AtlasSnapshot, key: string, score: (cell: AtlasCell) => number): number {
  const cache = cellScoreMaximumCache.get(snapshot) ?? new Map<string, number>();
  const existing = cache.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const maximum = Math.max(1, ...snapshot.cells.map(score));
  cache.set(key, maximum);
  cellScoreMaximumCache.set(snapshot, cache);
  return maximum;
}

function getWeatherIntensity(cell: AtlasCell): number {
  return clamp(
    cell.cloudCover * 0.18
      + cell.precipitationPotential * 0.22
      + cell.stormPotential * 0.34
      + cell.snowPotential * 0.1
      + cell.fogPotential * 0.08
      + cell.drynessIndex * 0.08,
    0,
    1,
  );
}

function getResourceDensity(cell: AtlasCell): number {
  return clamp(
    cell.resourceRichness * 0.34
      + cell.metalRichness * 0.16
      + cell.industrialRichness * 0.14
      + cell.rareMaterialRichness * 0.14
      + cell.waterRichness * 0.12
      + cell.buildingMaterialAvailability * 0.1,
    0,
    1,
  );
}

function getCivilizationCellScore(snapshot: AtlasSnapshot, cell: AtlasCell): number {
  const humanCount = getHumansInCell(snapshot, cell.id).length;
  const settlements = getSettlementsForCell(snapshot, cell.id);
  const settlementImportance = settlements.reduce((best, settlement) => Math.max(best, settlement.importance), 0);
  const settlementPermanence = settlements.reduce((best, settlement) => Math.max(best, settlement.permanence), 0);
  const score = getSettlementScoreForCell(snapshot, cell.id);

  return clamp(humanCount / 8 + settlementImportance * 0.36 + settlementPermanence * 0.28 + score * 0.2, 0, 1);
}

function topByCount<T>(values: readonly T[], keyFor: (value: T) => string, colorFor: (value: T) => string, limit = 8): LegendItem[] {
  const byKey = new Map<string, { label: string; color: string; count: number }>();

  for (const value of values) {
    const label = keyFor(value);
    const existing = byKey.get(label);
    byKey.set(label, { label, color: colorFor(value), count: (existing?.count ?? 0) + 1 });
  }

  return [...byKey.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit)
    .map((entry) => ({ label: `${entry.label} (${entry.count})`, color: entry.color }));
}

function averageCellValue(cells: readonly AtlasCell[], score: (cell: AtlasCell) => number): number {
  return cells.length === 0 ? 0 : cells.reduce((total, cell) => total + score(cell), 0) / cells.length;
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
    case "biomes":
      return cell.biomeColor;
    case "vegetation":
      return cell.dominantPlantKey === "none"
        ? sampleGradient(cell.biomassScore, [{ at: 0, color: "#252a24" }, { at: 1, color: "#55654c" }])
        : interpolateColor("#1f241d", cell.dominantPlantColor, 0.35 + cell.plantDensity * 0.65);
    case "resources":
      return sampleGradient(getResourceDensity(cell), [
        { at: 0, color: "#151a1d" },
        { at: 0.35, color: "#3f5c5a" },
        { at: 0.68, color: "#8d8f57" },
        { at: 1, color: "#e0c878" },
      ]);
    case "animals":
      return interpolateColor("#22262a", cell.dominantAnimalGuildColor, 0.28 + cell.ecosystemHealthScore * 0.72);
    case "civilizations":
      return sampleGradient(getCivilizationCellScore(snapshot, cell), [
        { at: 0, color: "#1b2024" },
        { at: 0.35, color: "#4f694c" },
        { at: 0.7, color: "#b58b45" },
        { at: 1, color: "#f2d28a" },
      ]);
    case "populationDensity":
      return sampleGradient(getHumansInCell(snapshot, cell.id).length / getMaximumCellScore(snapshot, "population", (entry) => getHumansInCell(snapshot, entry.id).length), [
        { at: 0, color: "#10181f" },
        { at: 0.35, color: "#264f5f" },
        { at: 0.7, color: "#b07b45" },
        { at: 1, color: "#fff0a6" },
      ]);
    case "knowledgeDensity":
      return sampleGradient(getKnowledgeCountForCell(snapshot, cell.id) / getMaximumCellScore(snapshot, "knowledge", (entry) => getKnowledgeCountForCell(snapshot, entry.id)), [
        { at: 0, color: "#10151d" },
        { at: 0.35, color: "#30516c" },
        { at: 0.72, color: "#6f9da5" },
        { at: 1, color: "#d9f7ef" },
      ]);
    case "resourceDensity":
      return sampleGradient(getResourceDensity(cell), [
        { at: 0, color: "#151a1d" },
        { at: 0.35, color: "#3f5c5a" },
        { at: 0.68, color: "#8d8f57" },
        { at: 1, color: "#e0c878" },
      ]);
    case "animalDensity":
      return sampleGradient(cell.animalDensity, [
        { at: 0, color: "#11181a" },
        { at: 0.35, color: "#2e594f" },
        { at: 0.7, color: "#789c5a" },
        { at: 1, color: "#d6e38d" },
      ]);
    case "weatherIntensity":
      return sampleGradient(getWeatherIntensity(cell), [
        { at: 0, color: "#111a25" },
        { at: 0.35, color: "#315b7e" },
        { at: 0.72, color: "#7770a5" },
        { at: 1, color: "#efe5ff" },
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
    case "biomes":
      return topByCount(snapshot.cells, (cell) => cell.biomeName, (cell) => cell.biomeColor);
    case "vegetation":
      return topByCount(snapshot.cells, (cell) => cell.dominantPlantName, (cell) => cell.dominantPlantColor);
    case "resources":
      return [
        { label: "Sparse", color: "#151a1d" },
        { label: "Moderate", color: "#3f5c5a" },
        { label: "Rich", color: "#8d8f57" },
        { label: "Exceptional", color: "#e0c878" },
      ];
    case "animals":
      return topByCount(snapshot.cells, (cell) => cell.dominantAnimalGuildName, (cell) => cell.dominantAnimalGuildColor);
    case "civilizations":
      return [
        { label: "No human signal", color: "#1b2024" },
        { label: "Known activity", color: "#4f694c" },
        { label: "Camp or settlement", color: "#b58b45" },
        { label: "Dense social center", color: "#f2d28a" },
      ];
    case "populationDensity":
    case "knowledgeDensity":
    case "resourceDensity":
    case "animalDensity":
    case "weatherIntensity":
      return [
        { label: "Low", color: "#10181f" },
        { label: "Medium", color: "#6f9da5" },
        { label: "High", color: "#efe5ff" },
      ];
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
function estimateSnapshotSizeBytes(snapshot: AtlasSnapshot): number {
  const cellBytes = snapshot.grid.totalCells * 5_700;
  const humanBytes = snapshot.humans.agents.length * 28_000;
  const settlementBytes = snapshot.settlements.settlements.length * 14_000;
  const familyBytes = snapshot.families.families.length * 12_000;
  const eventBytes = (snapshot.humans.chroniclerEntries.length + snapshot.humans.causalEvents.length + snapshot.settlements.recentEvents.length + snapshot.families.events.length) * 1_800;

  return Math.max(0, Math.round(cellBytes + humanBytes + settlementBytes + familyBytes + eventBytes));
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

function drawPixelHumanSprite(
  context: CanvasRenderingContext2D,
  agent: AtlasHumanAgent,
  centerX: number,
  centerY: number,
  maxHeight: number,
  active: boolean,
  _animationClock: number,
) {
  const sprite = buildHumanMapSpriteModel(agent);
  const scale = Math.max(1, Math.floor(maxHeight / sprite.height));
  const renderedWidth = sprite.width * scale;
  const renderedHeight = sprite.height * scale;
  const left = Math.round(centerX - renderedWidth / 2);
  const top = Math.round(centerY - renderedHeight / 2);

  if ("imageSmoothingEnabled" in context) {
    context.imageSmoothingEnabled = false;
  }

  for (const pixel of sprite.pixels) {
    context.fillStyle = pixel.color;
    context.fillRect(left + pixel.x * scale, top + pixel.y * scale, scale, scale);
  }

  if (active) {
    context.strokeStyle = "rgba(103, 232, 249, 0.95)";
    context.lineWidth = 1;
    context.strokeRect(left - 1, top - 1, renderedWidth + 2, renderedHeight + 2);
  }
}

function HumanSpriteAvatar({ human }: { human: AtlasHumanAgent }) {
  const sprite = buildHumanSpriteModel(human);
  const visiblePixels = sprite.pixels.filter((pixel) => pixel.color !== "rgba(3, 7, 12, 0.5)");

  return (
    <div className="flex h-[176px] w-[124px] shrink-0 items-center justify-center rounded-xl border border-amber-200/20 bg-[radial-gradient(circle_at_48%_18%,rgba(251,191,36,0.12),transparent_35%),rgba(255,255,255,0.04)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <svg
        data-testid="human-sprite-avatar"
        className="h-[164px] w-[118px] drop-shadow-[0_10px_10px_rgba(0,0,0,0.35)] [image-rendering:crisp-edges] [image-rendering:pixelated]"
        viewBox={`6 0 ${HUMAN_SPRITE_NATIVE_WIDTH - 12} ${HUMAN_SPRITE_NATIVE_HEIGHT}`}
        role="img"
        aria-label={`${human.label} pixel portrait`}
        shapeRendering="crispEdges"
      >
        <ellipse cx="24" cy="69" rx="16" ry="2" fill="rgba(0,0,0,0.34)" />
        {visiblePixels.map((pixel) => (
          <rect
            key={`${pixel.x}:${pixel.y}`}
            x={pixel.x}
            y={pixel.y}
            width="1.05"
            height="1.05"
            fill={pixel.color}
          />
        ))}
      </svg>
    </div>
  );
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
    case "biomes":
      return [
        { label: "Dominant biome", value: topByCount(cells, (cell) => cell.biomeName, (cell) => cell.biomeColor, 1)[0]?.label ?? "-" },
        { label: "Average habitability", value: formatPercent(averageCellValue(cells, (cell) => cell.habitabilityScore)) },
        { label: "Average fertility", value: formatPercent(averageCellValue(cells, (cell) => cell.fertilityScore)) },
        { label: "Biodiversity potential", value: snapshot.biomeSummary ? formatPercent(snapshot.biomeSummary.biodiversityPotentialScore) : formatPercent(averageCellValue(cells, (cell) => cell.biodiversityScore)) },
        ...overall,
      ];
    case "vegetation":
      return [
        { label: "Dominant plant", value: topByCount(cells, (cell) => cell.dominantPlantName, (cell) => cell.dominantPlantColor, 1)[0]?.label ?? "-" },
        { label: "Average suitability", value: formatPercent(averageCellValue(cells, (cell) => cell.plantSuitabilityScore)) },
        { label: "Average biomass", value: formatPercent(averageCellValue(cells, (cell) => cell.biomassScore)) },
        { label: "Average seasonal stress", value: formatPercent(averageCellValue(cells, (cell) => cell.seasonalStressScore)) },
        ...overall,
      ];
    case "animals":
      return [
        { label: "Dominant guild", value: topByCount(cells, (cell) => cell.dominantAnimalGuildName, (cell) => cell.dominantAnimalGuildColor, 1)[0]?.label ?? "-" },
        { label: "Total population", value: formatNumber(cells.reduce((total, cell) => total + cell.totalWildlifePopulation, 0), 0) },
        { label: "Food stability", value: formatPercent(averageCellValue(cells, (cell) => cell.foodStability)) },
        { label: "Plant consumption", value: formatPercent(averageCellValue(cells, (cell) => cell.plantConsumptionRate)) },
        ...overall,
      ];
    case "resources":
      return [
        { label: "Average resource density", value: formatPercent(averageCellValue(cells, getResourceDensity)) },
        { label: "Average mineral richness", value: formatPercent(snapshot.statistics.averageMineralRichness) },
        { label: "Resource diversity", value: formatPercent(snapshot.statistics.resourceDiversity) },
        { label: "Richest aquifer", value: snapshot.statistics.richestAquifer ? snapshot.statistics.richestAquifer.cellId : "-" },
        ...overall,
      ];
    case "civilizations":
      return [
        { label: "Humans", value: String(snapshot.humans.agents.length) },
        { label: "Active settlements", value: String(snapshot.settlements.activeCount) },
        { label: "Families", value: String(snapshot.families.families.length) },
        { label: "Known topics", value: String(snapshot.humans.agents.reduce((total, agent) => total + agent.knowledgeCount, 0)) },
        ...overall,
      ];
    case "populationDensity":
      return [
        { label: "Humans", value: String(snapshot.humans.agents.length) },
        { label: "Occupied cells", value: String(new Set(snapshot.humans.agents.map((agent) => agent.currentCellId)).size) },
        { label: "Peak cell population", value: String(getMaximumCellScore(snapshot, "population", (cell) => getHumansInCell(snapshot, cell.id).length)) },
        ...overall,
      ];
    case "knowledgeDensity":
      return [
        { label: "Known topics", value: String(snapshot.humans.agents.reduce((total, agent) => total + agent.knowledgeCount, 0)) },
        { label: "Peak cell knowledge", value: String(getMaximumCellScore(snapshot, "knowledge", (cell) => getKnowledgeCountForCell(snapshot, cell.id))) },
        { label: "Teaching records", value: String(snapshot.humans.agents.reduce((total, agent) => total + agent.recentlyTaughtKnowledge.length, 0)) },
        ...overall,
      ];
    case "resourceDensity":
      return [
        { label: "Average resource density", value: formatPercent(averageCellValue(cells, getResourceDensity)) },
        { label: "Average mineral richness", value: formatPercent(snapshot.statistics.averageMineralRichness) },
        { label: "Resource diversity", value: formatPercent(snapshot.statistics.resourceDiversity) },
        ...overall,
      ];
    case "animalDensity":
      return [
        { label: "Total population", value: formatNumber(cells.reduce((total, cell) => total + cell.totalWildlifePopulation, 0), 0) },
        { label: "Average density", value: formatPercent(averageCellValue(cells, (cell) => cell.animalDensity)) },
        { label: "Occupied habitat", value: formatPercent(snapshot.animalSummary?.occupiedHabitatPercent ?? averageCellValue(cells, (cell) => cell.animalDensity > 0 ? 1 : 0)) },
        ...overall,
      ];
    case "weatherIntensity":
      return [
        { label: "Average intensity", value: formatPercent(averageCellValue(cells, getWeatherIntensity)) },
        { label: "Dominant weather", value: titleize(snapshot.statistics.dominantWeatherType) },
        { label: "Average cloud cover", value: formatPercent(snapshot.weatherSummary.averageCloudCover) },
        ...overall,
      ];
    default:
      return overall;
  }
}

function getTooltipSummary(snapshot: AtlasSnapshot, cell: AtlasCell) {
  return {
    hydrology: `${titleize(cell.waterBodyType)} / ws ${cell.watershedId}`,
    atmosphere: `${titleize(cell.pressureZone)} / ${cell.windDirection} ${formatNumber(cell.windStrength, 2)}`,
    weather: `${titleize(cell.weatherType)} / humidity ${formatPercent(cell.relativeHumidity)}`,
    biome: cell.biomeName,
    vegetation: `${cell.dominantPlantName} / biomass ${formatPercent(cell.biomassScore)}`,
    animals: `${cell.dominantAnimalGuildName} / ${formatNumber(cell.totalWildlifePopulation, 0)}`,
    civilization: `${getHumansInCell(snapshot, cell.id).length} humans / ${getSettlementsForCell(snapshot, cell.id).length} settlements`,
  };
}

async function fetchAtlasSnapshotFromApi(worldId: string, day?: number | null): Promise<AtlasSnapshot> {
  const query = new URLSearchParams({ world: worldId });
  if (typeof day === "number" && Number.isFinite(day)) {
    query.set("day", String(day));
  }

  const response = await fetch(`/api/worlds/map?${query.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Atlas request failed: ${response.status}`);
  }

  return response.json() as Promise<AtlasSnapshot>;
}


async function fetchHealthTelemetry(worldId: string): Promise<HealthTelemetry> {
  const response = await fetch("/api/worlds/health?world=" + encodeURIComponent(worldId), { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<HealthTelemetry>;
}

function tickNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTickDayYear(snapshot: AtlasSnapshot): string {
  const year = Math.floor((snapshot.selectedDay - 1) / snapshot.yearLengthDays);
  const day = ((snapshot.selectedDay - 1) % snapshot.yearLengthDays) + 1;

  return "Tick " + snapshot.tick + " / Day " + day + " / Year " + year;
}

function displayHumanName(agent: AtlasHumanAgent | null | undefined): string {
  return agent ? agent.label + " (" + agent.id + ")" : "No citizen selected";
}

function getHumanSettlement(snapshot: AtlasSnapshot, agent: AtlasHumanAgent | null): string {
  if (!agent) {
    return "-";
  }

  return snapshot.settlements.settlements.find((settlement) => settlement.currentResidents.includes(agent.id))?.name ?? "Unsettled";
}

function buildMissionEvents(snapshot: AtlasSnapshot, selectedCell: AtlasCell | null): MissionEvent[] {
  const startedAt = nowMs();
  const events: MissionEvent[] = [];
  const eventById = new Map(snapshot.humans.causalEvents.map((event) => [event.id, event]));
  const seenEventIds = new Set<string>();

  for (const entry of snapshot.humans.chroniclerEntries) {
    const matchingEvent = eventById.get(entry.eventId);
    seenEventIds.add(entry.eventId);
    events.push({
      id: entry.eventId,
      tick: entry.tick,
      category: matchingEvent?.type ?? "Chronicler",
      title: entry.title,
      summary: entry.summary || entry.causalSummary,
      cellId: matchingEvent?.cellId ?? null,
      humanId: matchingEvent?.agentIds[0] ?? null,
      settlementId: null,
    });
  }

  for (const event of snapshot.humans.causalEvents) {
    if (seenEventIds.has(event.id)) {
      continue;
    }

    seenEventIds.add(event.id);
    events.push({
      id: event.id,
      tick: event.tick,
      category: event.type,
      title: event.title,
      summary: event.summary,
      cellId: event.cellId,
      humanId: event.agentIds[0] ?? null,
      settlementId: null,
    });
  }

  for (const event of snapshot.settlements.recentEvents) {
    events.push({
      id: event.id,
      tick: event.tick,
      category: "Settlement " + event.kind,
      title: event.title,
      summary: event.summary,
      cellId: event.cellId,
      humanId: null,
      settlementId: event.settlementId,
    });
  }

  for (const event of snapshot.families.events.slice(-12)) {
    events.push({
      id: event.id,
      tick: event.tick,
      category: event.kind,
      title: event.title,
      summary: event.summary,
      cellId: event.cellId,
      humanId: event.humanIds[0] ?? null,
      settlementId: event.settlementId,
    });
  }

  if (selectedCell) {
    for (const event of selectedCell.ecosystemHistory.slice(-8)) {
      events.push({
        id: event.id,
        tick: "0",
        category: "Ecosystem " + event.type,
        title: event.type,
        summary: event.description,
        cellId: selectedCell.id,
        humanId: null,
        settlementId: null,
      });
    }
  }

  const sortedEvents = events.sort((left, right) => tickNumber(right.tick) - tickNumber(left.tick) || left.title.localeCompare(right.title));
  logAtlasTiming("mission-events", nowMs() - startedAt, { events: sortedEvents.length, selectedCell: selectedCell?.id ?? null });
  return sortedEvents;
}

function getEventCategories(events: readonly MissionEvent[]): string[] {
  return ["All", ...Array.from(new Set(events.map((event) => event.category))).sort((left, right) => left.localeCompare(right))];
}


function getMissionEventGlyph(category: string): string {
  const normalized = category.toLowerCase();

  if (normalized.includes("birth")) return "B";
  if (normalized.includes("death") || normalized.includes("grief")) return "D";
  if (normalized.includes("settlement") || normalized.includes("founded")) return "S";
  if (normalized.includes("harvest") || normalized.includes("food")) return "H";
  if (normalized.includes("conflict") || normalized.includes("rival")) return "C";
  if (normalized.includes("flood")) return "F";
  if (normalized.includes("storm") || normalized.includes("weather")) return "W";
  if (normalized.includes("fire")) return "R";
  if (normalized.includes("ecosystem")) return "E";
  return "*";
}

function getMissionEventColor(category: string): string {
  const normalized = category.toLowerCase();

  if (normalized.includes("birth")) return "rgba(134,239,172,0.95)";
  if (normalized.includes("death") || normalized.includes("grief")) return "rgba(226,232,240,0.94)";
  if (normalized.includes("settlement") || normalized.includes("founded")) return "rgba(251,191,36,0.96)";
  if (normalized.includes("harvest") || normalized.includes("food")) return "rgba(190,242,100,0.94)";
  if (normalized.includes("conflict") || normalized.includes("rival")) return "rgba(248,113,113,0.95)";
  if (normalized.includes("flood")) return "rgba(96,165,250,0.95)";
  if (normalized.includes("storm") || normalized.includes("weather")) return "rgba(196,181,253,0.95)";
  if (normalized.includes("fire")) return "rgba(251,113,133,0.95)";
  return "rgba(125,211,252,0.92)";
}

function getNavigationDepth(globeZoom: number, gridScale: number): { label: string; detail: string; gridOpacity: number } {
  const score = Math.max(globeZoom, gridScale);

  if (score >= 5) return { label: "Citizen", detail: "follow individual lives", gridOpacity: 1 };
  if (score >= 3.2) return { label: "Cell", detail: "inspect one local tile", gridOpacity: 1 };
  if (score >= 1.9) return { label: "Grid", detail: "terrain resolves into cells", gridOpacity: 0.92 };
  if (score >= 1.25) return { label: "Local Area", detail: "settlements and paths emerge", gridOpacity: 0.74 };
  if (score >= 0.82) return { label: "Region", detail: "weather, ecology, and people move", gridOpacity: 0.5 };
  return { label: "Planet", detail: "continuous world observation", gridOpacity: 0.28 };
}

function getCurrentYear(snapshot: AtlasSnapshot): number {
  return Math.floor((snapshot.selectedDay - 1) / snapshot.yearLengthDays);
}

function getHumanLifeStage(ageYears: number): string {
  if (ageYears < 3) return "infant";
  if (ageYears < 13) return "child";
  if (ageYears < 20) return "adolescent";
  if (ageYears < 45) return "adult";
  if (ageYears < 65) return "elder";
  return "ancient";
}

function getCurrentStory(event: MissionEvent | null): string {
  if (!event) {
    return "The planet is quiet, but weather and life are still moving.";
  }

  return event.summary || event.title;
}
function getMissionEventCell(snapshot: AtlasSnapshot, event: MissionEvent): AtlasCell | null {
  if (event.cellId) {
    return snapshot.cells.find((cell) => cell.id === event.cellId) ?? null;
  }

  if (event.humanId) {
    const human = snapshot.humans.agents.find((agent) => agent.id === event.humanId);
    return human ? snapshot.cells.find((cell) => cell.id === human.currentCellId) ?? null : null;
  }

  if (event.settlementId) {
    const settlement = snapshot.settlements.settlements.find((entry) => entry.id === event.settlementId);
    return settlement ? snapshot.cells.find((cell) => cell.id === settlement.homeCellId) ?? null : null;
  }

  return null;
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[9px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm text-stone-100">{value}</p>
    </div>
  );
}

function buildWorldStoryLines(snapshot: AtlasSnapshot, events: MissionEvent[]): string[] {
  const lines: string[] = [];
  const latestEvent = events[0] ?? null;
  const activeHuman = snapshot.humans.agents
    .slice()
    .sort((left, right) => right.memoryCount - left.memoryCount || right.knowledgeCount - left.knowledgeCount)[0] ?? null;
  const stormCell = snapshot.cells.reduce((best, cell) => cell.stormPotential > best.stormPotential ? cell : best, snapshot.cells[0]);
  const largestSettlement = snapshot.settlements.settlements
    .slice()
    .sort((left, right) => right.population - left.population)[0] ?? null;

  if (latestEvent) {
    lines.push(getCurrentStory(latestEvent));
  }

  if (activeHuman?.latestMemory?.summary) {
    lines.push(`${activeHuman.label} remembers ${activeHuman.latestMemory.summary.toLowerCase()}`);
  } else if (activeHuman) {
    lines.push(`${activeHuman.label} is ${activeHuman.currentAction ?? activeHuman.movementIntent}.`);
  }

  if (largestSettlement) {
    lines.push(`${largestSettlement.name} shelters ${largestSettlement.population} living humans and stores ${formatNumber(largestSettlement.foodSupply, 1)} food.`);
  } else if (snapshot.humans.agents.length > 0) {
    lines.push(`${snapshot.humans.agents.length} living humans remain mobile while no permanent settlement has formed.`);
  }

  if (stormCell.stormPotential > 0.42) {
    lines.push(`${titleize(stormCell.weatherType)} weather is gathering near ${stormCell.id} with ${formatPercent(stormCell.stormPotential)} storm potential.`);
  } else {
    lines.push(`${titleize(snapshot.statistics.dominantWeatherType)} conditions dominate the current planetary weather.`);
  }

  return lines.slice(0, 4);
}
function MissionDashboard({ snapshot, events }: { snapshot: AtlasSnapshot; events: MissionEvent[] }) {
  const largestSettlement = [...snapshot.settlements.settlements].sort((left, right) => right.population - left.population)[0] ?? null;
  const warmestCell = snapshot.cells.reduce((best, cell) => cell.averageTemperatureC > best.averageTemperatureC ? cell : best, snapshot.cells[0]);
  const coldestCell = snapshot.cells.reduce((best, cell) => cell.averageTemperatureC < best.averageTemperatureC ? cell : best, snapshot.cells[0]);
  const strongestStorm = snapshot.cells.reduce((best, cell) => cell.stormPotential > best.stormPotential ? cell : best, snapshot.cells[0]);
  const mostKnowledgeable = [...snapshot.humans.agents].sort((left, right) => right.knowledgeCount - left.knowledgeCount)[0] ?? null;
  const storyLines = buildWorldStoryLines(snapshot, events);

  return (
    <section className="grid gap-4">
      <div className="grid gap-3">
        {storyLines.map((line, index) => (
          <p key={`${line}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-stone-100 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">{line}</p>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ContextMetric label="Current Year" value={`Year ${Math.floor((snapshot.selectedDay - 1) / snapshot.yearLengthDays)} / Day ${snapshot.selectedDay}`} />
      <ContextMetric label="Living Humans" value={String(snapshot.humans.agents.length)} />
      <ContextMetric label="Wildlife Count" value={formatNumber(snapshot.cells.reduce((total, cell) => total + cell.totalWildlifePopulation, 0), 0)} />
      <ContextMetric label="Largest Settlement" value={largestSettlement ? `${largestSettlement.name} (${largestSettlement.population})` : "None formed"} />
      <ContextMetric label="Strongest Storm" value={`${strongestStorm.id} / ${formatPercent(strongestStorm.stormPotential)}`} />
      <ContextMetric label="Warmest Region" value={`${warmestCell.id} / ${formatTemperature(warmestCell.averageTemperatureC)}`} />
      <ContextMetric label="Coldest Region" value={`${coldestCell.id} / ${formatTemperature(coldestCell.averageTemperatureC)}`} />
      <ContextMetric label="Leading Mind" value={mostKnowledgeable ? `${mostKnowledgeable.label} / ${mostKnowledgeable.knowledgeCount}` : "Knowledge has not concentrated yet"} />
      </div>
    </section>
  );
}

function ContextualInspector({ snapshot, cell, human }: { snapshot: AtlasSnapshot; cell: AtlasCell | null; human: AtlasHumanAgent | null }) {
  const activeCell = cell ?? (human ? snapshot.cells.find((entry) => entry.id === human.currentCellId) ?? null : null);
  const settlement = activeCell ? getSettlementsForCell(snapshot, activeCell.id)[0] ?? null : null;

  if (human) {
    return (
      <section data-testid="cell-inspector" className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/80">Living Dossier</p>
        <div className="mt-4 flex items-start gap-4">
          <HumanSpriteAvatar human={human} />
          <div>
            <h3 className="font-display text-2xl text-white">{human.label}</h3>
            <p className="mt-1 text-sm text-stone-400">{human.id} / {getHumanLifeStage(human.approxAgeYears)} / age {formatNumber(human.approxAgeYears, 1)}</p>
            <p className="mt-2 text-sm text-stone-200">{human.currentAction ?? human.movementIntent}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ContextMetric label="Relationships" value={human.family.map((entry) => entry.targetHumanId).join(", ") || "No family link"} />
          <ContextMetric label="Current Objective" value={human.currentGoal ? `${human.currentGoal.type} / ${formatPercent(human.currentGoal.progress)}` : "None"} />
          <ContextMetric label="Needs" value={`Hunger ${formatPercent(human.needs.hunger)} / thirst ${formatPercent(human.needs.thirst)}`} />
          <ContextMetric label="Inventory" value={`${human.personalInventory.length} personal / ${human.familyInventory.length} family`} />
          <ContextMetric label="Memories" value={`${human.memoryCount} / latest ${human.latestMemory?.type ?? "none"}`} />
          <ContextMetric label="Relationships" value={`${human.relationshipCount} / strongest ${human.strongestBond?.targetHumanId ?? "none"}`} />
          <ContextMetric label="Emotions" value={human.latestEmotionChangeSummary} />
          <ContextMetric label="Knowledge" value={`${human.knowledgeCount} topics / mastery ${formatPercent(human.averageKnowledgeMastery)}`} />
          <ContextMetric label="Movement History" value={human.recentPath.join(" -> ") || human.currentCellId} />
          <ContextMetric label="Life Timeline" value={human.latestCausalEvent ? `${human.latestCausalEvent.title} at tick ${human.latestCausalEvent.tick}` : "No causal event recorded"} />
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-stone-300">
          <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Selected Cell</p>
          <p className="mt-2">{activeCell?.id ?? human.currentCellId}</p>
          <p className="mt-2">Adaptation {activeCell ? formatPercent(activeCell.averageFitness) : "Untracked"}</p>
          <p className="mt-2">Humans In Cell {activeCell ? getHumansInCell(snapshot, activeCell.id).map((agent) => agent.label).join(", ") || "None" : human.label}</p>
        </div>
      </section>
    );
  }

  if (settlement && activeCell) {
    return (
      <section data-testid="cell-inspector" className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/80">Settlement Dossier</p>
        <h3 className="mt-3 font-display text-2xl text-white">{settlement.name}</h3>
        <p className="mt-1 text-sm text-stone-400">{settlement.type} / {settlement.status} / {activeCell.id}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ContextMetric label="Population" value={String(settlement.population)} />
          <ContextMetric label="Buildings" value={settlement.structures.join(", ") || "None"} />
          <ContextMetric label="Resources" value={`Food ${formatNumber(settlement.foodSupply, 1)} / water ${formatNumber(settlement.waterSupply, 1)}`} />
          <ContextMetric label="History" value={settlement.majorEvents.slice(-1)[0]?.summary ?? "No major event"} />
          <ContextMetric label="Trade" value={settlement.resourceTrends.map((entry) => `${entry.type}: ${formatNumber(entry.quantity, 1)} (${entry.delta >= 0 ? "+" : ""}${formatNumber(entry.delta, 1)})`).join(", ") || "No trade telemetry"} />
          <ContextMetric label="Families" value={settlement.familiesPresent.join(", ") || "None"} />
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-stone-500">Selected Cell</p>
        <p className="mt-2 text-sm text-stone-200">{activeCell.id} / Adaptation {formatPercent(activeCell.averageFitness)} / Humans In Cell {getHumansInCell(snapshot, activeCell.id).length}</p>
      </section>
    );
  }

  return (
    <section data-testid="cell-inspector" className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/80">World Dossier</p>
      {activeCell ? (
        <div className="mt-4 space-y-4 text-sm text-stone-200">
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/80">Selected Cell</p>
            <p className="mt-2 text-xl text-stone-50">{activeCell.id}</p>
            <p className="mt-1 text-sm text-stone-400">{formatLatitude(activeCell.midpointLatitude)} / {formatLongitude(activeCell.midpointLongitude)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ContextMetric label="Mountain Height" value={formatNumber(activeCell.elevation, 3)} />
            <ContextMetric label="Biome" value={activeCell.biomeName} />
            <ContextMetric label="Weather" value={`${titleize(activeCell.weatherType)} / ${formatPercent(activeCell.cloudCover)} cloud`} />
            <ContextMetric label="Resources" value={`Bedrock ${titleize(activeCell.bedrockType)} / ${formatPercent(getResourceDensity(activeCell))} density`} />
            <ContextMetric label="Terrain" value={`${titleize(activeCell.terrainType)} / coast ${activeCell.isCoast ? "yes" : "no"}`} />
            <ContextMetric label="Hydrology" value={`${titleize(activeCell.waterBodyType)} / watershed ${activeCell.watershedId}`} />
            <ContextMetric label="Animals" value={`${activeCell.dominantSpeciesName} / ${formatNumber(activeCell.totalWildlifePopulation, 0)}`} />
            <ContextMetric label="Storm" value={`Wind ${formatNumber(activeCell.windStrength, 2)} / pressure ${formatNumber(activeCell.pressureValue, 2)} / risk ${formatPercent(activeCell.stormPotential)}`} />
            <ContextMetric label="Adaptation" value={`${formatPercent(activeCell.averageFitness)} fitness / ${formatPercent(activeCell.adaptationDiversity)} diversity`} />
            <ContextMetric label="Suitability" value={`Climate ${formatPercent(activeCell.habitabilityScore)} / habitat ${formatPercent(activeCell.averageHabitatSuitability)}`} />
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Humans In Cell</p>
            <div className="mt-3 grid gap-2 text-xs text-stone-200">
              {getHumansInCell(snapshot, activeCell.id).map((agent) => (
                <div key={agent.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  <p className="text-stone-50">{agent.label}</p>
                  <p>Movement {agent.movementIntent}: {agent.movementReason}</p>
                  <p>Goal {agent.currentGoal?.type ?? "none"} / {agent.goalReason ?? "-"}</p>
                  <p>Knowledge {agent.knowledgeCount} / Memories {agent.memoryCount} / Relationships {agent.relationshipCount}</p>
                </div>
              ))}
              {getHumansInCell(snapshot, activeCell.id).length === 0 ? <p>No humans occupy this cell at the selected tick.</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2 text-sm text-stone-400">
          <p>Click a cell to open the full inspector. Hovering still exposes a compact tooltip.</p>
          <p>Select a human, settlement, storm, biome, or grid cell to transform this context.</p>
        </div>
      )}
    </section>
  );
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


type FutureLayersPanelProps = {
  snapshot: AtlasSnapshot;
  selectedCell: AtlasCell | null;
  loading: boolean;
  error: string | null;
};

export function FutureLayersPanel({ snapshot, selectedCell, loading, error }: FutureLayersPanelProps) {
  const cell = selectedCell ?? snapshot.cells[0] ?? null;
  const topSpecies = cell?.animalPopulations
    .filter((population) => population.population > 0)
    .sort((left, right) => right.population - left.population || left.speciesName.localeCompare(right.speciesName))
    .slice(0, 4) ?? [];

  return (
    <section data-testid="future-layers-panel" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Living Systems Dossier</p>
      {loading ? <p className="mt-3 text-sm text-stone-400">Loading selected world ecology</p> : null}
      {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
      {!loading && !error && !cell ? <p className="mt-3 text-sm text-stone-400">No atlas cells are available</p> : null}
      {cell ? (
        <div className="mt-4 grid gap-3">
          <DetailCard label={selectedCell ? "Selected Cell Ecology" : "Planet Summary"} value={cell.id} />
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-stone-200">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Biome</p>
            <p className="mt-2 text-sm text-stone-50">{cell.biomeName}</p>
            <p className="mt-2">Habitability {formatPercent(cell.habitabilityScore)} / Fertility {formatPercent(cell.fertilityScore)}</p>
            <p className="mt-1">Water {formatPercent(cell.waterAvailabilityScore)} / Soil moisture {formatPercent(cell.soilMoistureScore)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-stone-200">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Vegetation</p>
            <p className="mt-2 text-sm text-stone-50">{cell.dominantPlantName}</p>
            <p className="mt-2">Suitability {formatPercent(cell.plantSuitabilityScore)} / Biomass {formatPercent(cell.biomassScore)}</p>
            <p className="mt-1">Average suitability {snapshot.plantSummary ? formatPercent(snapshot.plantSummary.averagePlantDensity) : formatPercent(averageCellValue(snapshot.cells, (entry) => entry.plantSuitabilityScore))}</p>
            <p className="mt-1">Seasonal stress {formatPercent(cell.seasonalStressScore)}</p>
            <p className="mt-1">Average seasonal stress {snapshot.plantSummary ? formatPercent(averageCellValue(snapshot.cells, (entry) => entry.seasonalStressScore)) : formatPercent(cell.seasonalStressScore)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-stone-200">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Animals</p>
            <p className="mt-2 text-sm text-stone-50">{cell.dominantAnimalGuildName}</p>
            <p className="mt-2">Total population {formatNumber(cell.totalWildlifePopulation, 0)} / Species {cell.speciesCount}</p>
            <p className="mt-1">Food stability {formatPercent(cell.foodStability)} / Plant consumption {formatPercent(cell.plantConsumptionRate)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-stone-200">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Top Species</p>
            <div className="mt-2 grid gap-1">
              {topSpecies.length > 0 ? topSpecies.map((population) => (
                <p key={population.speciesId}>{population.speciesName}: {formatNumber(population.population, 0)} / health {formatPercent(population.health)}</p>
              )) : <p>No established wildlife population in this cell.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-stone-200">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Recent History</p>
            <div className="mt-2 grid gap-1">
            {cell.ecosystemHistory.slice(-4).map((event, index) => (
  <p key={`${event.id}-${event.type}-${index}`}>
    {event.type}: {event.description}
  </p>
))}
              {cell.ecosystemHistory.length === 0 ? <p>No ecosystem events recorded for this cell.</p> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-stone-200">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Influencing Systems</p>
            <p className="mt-2">Climate, hydrology, resources, biomes, plants, animal dynamics, human movement, relationships, knowledge, communication, goals, settlements, families, and storage are all represented from the current Atlas snapshot.</p>
            {snapshot.settlements.activeCount === 0 ? <p className="mt-2 text-stone-400">Civilization Systems Not Generated Yet: no active settlement has crossed the existing formation threshold.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HumanObservatory({ snapshot, selectedCell, selectedHuman, followHuman, humansVisible, onToggleHumans, onSelectHuman, onToggleFollow, onSimulateDay }: {
  snapshot: AtlasSnapshot;
  selectedCell: AtlasCell | null;
  selectedHuman: AtlasHumanAgent | null;
  followHuman: boolean;
  humansVisible: boolean;
  onToggleHumans: () => void;
  onSelectHuman: (humanId: string) => void;
  onToggleFollow: () => void;
  onSimulateDay: () => void;
}) {
  const humansInCell = selectedCell ? getHumansInCell(snapshot, selectedCell.id) : [];
  const focusedHuman = selectedHuman ?? humansInCell[0] ?? snapshot.humans.agents[0] ?? null;

  return (
    <section data-testid="human-inspector" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">First Humans</p>
        <button type="button" data-testid="humans-overlay-toggle" onClick={onToggleHumans} className={`rounded-full border px-3 py-1.5 text-xs ${humansVisible ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-stone-200"}`}>Humans</button>
      </div>
      <div data-testid="human-list" className="mt-4 grid gap-2 text-xs text-stone-200">
        {snapshot.humans.agents.map((agent) => (
          <button key={agent.id} type="button" onClick={() => onSelectHuman(agent.id)} className={`rounded-2xl border p-3 text-left ${focusedHuman?.id === agent.id ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-black/20"}`}>
            <p className="text-sm text-stone-50">{agent.label}</p>
            <p className="mt-1">Cell {agent.currentCellId} / Action {agent.currentAction ?? "observing"}</p>
            <p className="mt-1">Goal {agent.currentGoal?.type ?? "none"} / {agent.movementIntent}</p>
          </button>
        ))}
      </div>
      {focusedHuman ? (
        <div className="mt-4 grid gap-3 text-xs text-stone-200">
          <DetailCard label="Focused Human" value={displayHumanName(focusedHuman)} />
          <DetailCard label="Location" value={focusedHuman.currentCellId} />
          <DetailCard label="Settlement" value={getHumanSettlement(snapshot, focusedHuman)} />
          <DetailCard label="Status" value={focusedHuman.currentAction ?? focusedHuman.movementIntent} />
          <button type="button" data-testid="citizen-follow-toggle" onClick={onToggleFollow} className={`rounded-2xl border px-3 py-2 text-sm ${followHuman ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/5 text-stone-200"}`}>{followHuman ? "Following Citizen" : "Follow Citizen"}</button>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Latest Memory</p>
            <p className="mt-2">{focusedHuman.latestMemory?.summary ?? "No memory recorded yet."}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Latest Causal Event</p>
            <p className="mt-2">{focusedHuman.latestCausalEvent?.summary ?? "No causal event recorded yet."}</p>
          </div>
          <div data-testid="human-emotion-explainability" className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Latest Emotion Change</p>
            <p className="mt-2">{focusedHuman.latestEmotionChangeSummary}</p>
            <p className="mt-2 text-stone-400">Reasons:</p>
            {focusedHuman.emotionReasons.slice(0, 3).map((reason) => <p key={reason.emotion}>{reason.summary}</p>)}
            <p className="mt-2 text-stone-400">Causal Event Links</p>
            {focusedHuman.emotionReasons.flatMap((reason) => reason.causalEventLinks).slice(0, 3).map((event) => <p key={`${event.id}-${event.tick}`}>{event.title}</p>)}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Knowledge And Communication</p>
            <p className="mt-2">Knowledge {focusedHuman.knowledgeCount} / Messages sent {focusedHuman.messagesSent} / received {focusedHuman.messagesReceived}</p>
            <p className="mt-1">Relationships {focusedHuman.relationshipCount} / Memories {focusedHuman.memoryCount}</p>
          </div>
          <button type="button" data-testid="simulate-human-day" onClick={onSimulateDay} className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">Simulate One Human Day</button>
        </div>
      ) : null}
    </section>
  );
}
function WhyPanel({ human }: { human: AtlasHumanAgent | null }) {
  const explanation = human?.decisionExplanation ?? human?.currentGoal?.reason ?? human?.goalReason ?? null;

  return (
    <section data-testid="why-panel" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Why?</p>
      <p className="mt-3 text-sm text-stone-200">{explanation ?? "No decision explanation recorded yet."}</p>
      {human?.currentGoal ? (
        <div className="mt-4 grid gap-2 text-xs text-stone-300">
          <p>Goal {human.currentGoal.type} / priority {formatNumber(human.currentGoal.priority, 2)}</p>
          <p>Progress {formatPercent(human.currentGoal.progress)} / confidence {formatPercent(human.currentGoal.confidence)}</p>
          <p>Target {human.currentGoal.targetCellId ?? human.currentGoal.targetId ?? "-"}</p>
        </div>
      ) : null}
    </section>
  );
}

function EventFeed({ events, categories, selectedCategory, onCategoryChange, onJump }: {
  events: MissionEvent[];
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onJump: (event: MissionEvent) => void;
}) {
  return (
    <section data-testid="chronicler-feed" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Current Story</p>
        <select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)} className="rounded-full border border-white/10 bg-[#0c1218] px-3 py-1.5 text-xs text-stone-200 outline-none">
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>
      <div className="mt-4 grid max-h-[28rem] gap-2 overflow-auto pr-1 text-xs text-stone-200">
        {events.slice(0, 12).map((event, index) => (
          <button key={event.id + event.tick + index} type="button" onClick={() => onJump(event)} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/[0.06]">
            <span className="text-[10px] uppercase tracking-[0.24em] text-stone-500">{event.category} / tick {event.tick}</span>
            <span className="mt-1 block text-sm text-stone-50">{event.title}</span>
            <span className="mt-1 block text-stone-300">{event.summary}</span>
            <span className="mt-2 block text-stone-500">{event.cellId ?? event.humanId ?? event.settlementId ?? "No jump target recorded"}</span>
          </button>
        ))}
        {events.length === 0 ? <p className="text-stone-400">No Chronicler or event records are available in this snapshot.</p> : null}
      </div>
    </section>
  );
}

function PerformancePanel({ snapshot, healthTelemetry, renderCostMs, snapshotSizeBytes, lastSnapshotLoadMs }: {
  snapshot: AtlasSnapshot;
  healthTelemetry: HealthTelemetry;
  renderCostMs: number;
  snapshotSizeBytes: number | null;
  lastSnapshotLoadMs: number;
}) {
  return (
    <section data-testid="performance-overlays" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Observability</p>
      <div className="mt-4 grid gap-3">
        <DetailCard label="Render Cost" value={formatNumber(renderCostMs, 2) + " ms"} />
        <DetailCard label="Snapshot Load" value={lastSnapshotLoadMs > 0 ? formatNumber(lastSnapshotLoadMs, 2) + " ms" : "Initial server render"} />
        <DetailCard label="Snapshot Size" value={snapshotSizeBytes === null ? "Not measured in this environment" : formatNumber(snapshotSizeBytes / 1024, 1) + " KB"} />
        <DetailCard label="Cells Rendered" value={formatNumber(snapshot.grid.totalCells, 0)} />
        <DetailCard label="Scheduler Health" value={healthTelemetry?.systemHealthStatus ?? healthTelemetry?.badge ?? "No health endpoint timing exposed"} />
        <DetailCard label="Latest Tick" value={healthTelemetry?.latestSimulationTickNumber ?? healthTelemetry?.currentTick ?? snapshot.tick} />
        <DetailCard label="Cache Status" value="Atlas cache timing is server-side only for this route." />
      </div>
    </section>
  );
}

function TimeTravelPanel({ snapshot, selectedCell, compareDay, compareSnapshot, compareError, onCompareDayChange, onLoadCompare }: {
  snapshot: AtlasSnapshot;
  selectedCell: AtlasCell | null;
  compareDay: number;
  compareSnapshot: AtlasSnapshot | null;
  compareError: string | null;
  onCompareDayChange: (day: number) => void;
  onLoadCompare: () => void;
}) {
  const comparisonCell = selectedCell && compareSnapshot ? compareSnapshot.cells.find((cell) => cell.id === selectedCell.id) ?? null : null;

  return (
    <section data-testid="time-travel-panel" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Time Travel Inspection</p>
      <div className="mt-4 flex items-center gap-2">
        <input type="number" min={1} max={snapshot.yearLengthDays} value={compareDay} onChange={(event) => onCompareDayChange(clamp(Number(event.target.value), 1, snapshot.yearLengthDays))} className="w-24 rounded-xl border border-white/10 bg-[#0c1218] px-3 py-2 text-sm text-stone-100 outline-none" />
        <button type="button" onClick={onLoadCompare} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-200">Load</button>
      </div>
      {compareError ? <p className="mt-3 text-sm text-red-200">{compareError}</p> : null}
      {!selectedCell ? <p className="mt-3 text-sm text-stone-400">Select a cell to compare it against another deterministic day snapshot.</p> : null}
      {selectedCell && comparisonCell ? (
        <div className="mt-4 grid gap-2 text-xs text-stone-200">
          <p>Cell {selectedCell.id}</p>
          <p>Temperature {formatTemperature(comparisonCell.averageTemperatureC)} to {formatTemperature(selectedCell.averageTemperatureC)}</p>
          <p>Humidity {formatPercent(comparisonCell.relativeHumidity)} to {formatPercent(selectedCell.relativeHumidity)}</p>
          <p>Weather {titleize(comparisonCell.weatherType)} to {titleize(selectedCell.weatherType)}</p>
          <p>Resources {formatPercent(getResourceDensity(comparisonCell))} to {formatPercent(getResourceDensity(selectedCell))}</p>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-stone-500">Persisted historical tick records are not exposed to Atlas yet; this compares existing deterministic day snapshots.</p>
    </section>
  );
}

export function WorldMapAtlasClient({
  worlds,
  initialSnapshot,
  initialWorldId = null,
  initialDay = null,
  fetchSnapshot = fetchAtlasSnapshotFromApi,
}: WorldMapAtlasClientProps) {
  const [loadedSnapshot, setLoadedSnapshot] = useState<AtlasSnapshot | null>(initialSnapshot);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectedInitialWorldId = initialWorldId ?? initialSnapshot?.worldId ?? worlds[0]?.id ?? null;

  useEffect(() => {
    if (loadedSnapshot || !selectedInitialWorldId) {
      return;
    }

    let cancelled = false;
    setLoadError(null);

    fetchSnapshot(selectedInitialWorldId, initialDay)
      .then((snapshot) => {
        if (!cancelled) {
          setLoadedSnapshot(snapshot);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unable to load atlas snapshot.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchSnapshot, initialDay, loadedSnapshot, selectedInitialWorldId]);

  if (!loadedSnapshot) {
    return (
      <main className="min-h-screen bg-[#030508] px-6 py-16 text-stone-100">
        <div className="mx-auto max-w-3xl rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <p className="text-[10px] uppercase tracking-[0.32em] text-dawn-gold">First Dawn Mission Control</p>
          <h1 className="mt-3 font-display text-4xl text-white">Loading Atlas Snapshot</h1>
          <p className="mt-3 text-sm leading-6 text-stone-300">Preparing the persisted world map.</p>
          {loadError ? <p className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-sm text-red-100">{loadError}</p> : null}
        </div>
      </main>
    );
  }

  return <WorldMapAtlasLoadedClient worlds={worlds} initialSnapshot={loadedSnapshot} fetchSnapshot={fetchSnapshot} />;
}

function WorldMapAtlasLoadedClient({
  worlds,
  initialSnapshot,
  fetchSnapshot = fetchAtlasSnapshotFromApi,
}: WorldMapAtlasLoadedClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedLayerId, setSelectedLayerId] = useState<LayerId>("planet");
  const [activeLayerSectionId, setActiveLayerSectionId] = useState("planet");
  const [selectedWorldId, setSelectedWorldId] = useState(initialSnapshot.worldId);
  const [requestedDay, setRequestedDay] = useState(initialSnapshot.selectedDay);
  const [committedDay, setCommittedDay] = useState(initialSnapshot.selectedDay);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelineSpeed, setTimelineSpeed] = useState<(typeof MISSION_TIMELINE_SPEEDS)[number]>(1);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [selectedHumanId, setSelectedHumanId] = useState<string | null>(null);
  const [followHuman, setFollowHuman] = useState(false);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const [signalToggles, setSignalToggles] = useState(DEFAULT_SIGNAL_TOGGLES);
  const [globeLayerPresetId, setGlobeLayerPresetId] = useState<GlobeLayerPresetId>("planet");
  const [globeLayerMixerExpanded, setGlobeLayerMixerExpanded] = useState(false);
  const [globeLayers, setGlobeLayers] = useState<Record<GlobeLayerId, GlobeLayerSetting>>(() => cloneGlobeLayers(GLOBE_LAYER_PRESETS.planet));
  const [canvasSize, setCanvasSize] = useState({ width: 1120, height: 680 });
  const [view, setView] = useState(() => createFitView(initialSnapshot, 1120, 680));
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [legendPinned, setLegendPinned] = useState(false);
  const [legendOpacity, setLegendOpacity] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventCategoryFilter, setEventCategoryFilter] = useState("All");
  const [healthTelemetry, setHealthTelemetry] = useState<HealthTelemetry>(null);
  const [renderCostMs, setRenderCostMs] = useState(0);
  const [lastSnapshotLoadMs, setLastSnapshotLoadMs] = useState(0);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [playbackLoopDelayMs, setPlaybackLoopDelayMs] = useState(0);
  const [snapshotSizeBytes, setSnapshotSizeBytes] = useState<number | null>(() => process.env.NODE_ENV === "test" ? null : estimateSnapshotSizeBytes(initialSnapshot));
  const [compareDay, setCompareDay] = useState(Math.max(1, initialSnapshot.selectedDay - 1));
  const [compareSnapshot, setCompareSnapshot] = useState<AtlasSnapshot | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [chronicleMode, setChronicleMode] = useState(false);
  const [globeZoom, setGlobeZoom] = useState(1);
  const animationClock = 0;

  const [searchHistory, setSearchHistory] = useState<Array<{ q: string; pinned?: boolean; at: number }>>(() => {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem("atlasSearchHistory");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const autoOverlayMask = useMemo<Record<OverlayId, boolean>>(() => {
    const total = snapshot.grid.totalCells;
    const scale = view.scale;
    const far = scale < 0.6;
    const medium = scale >= 0.6 && scale <= 1.2;
    const close = scale > 1.2;

    return {
      latitudeBands: !close,
      windArrows: !far && (medium || close),
      watershedBoundaries: !far && (medium || close),
      coastlines: true,
      gridLines: close && total < 1024 * 2048,
      cellIds: close && total <= 64 * 128,
      neighborLinks: close && total <= 64 * 128,
      drainageArrows: close && total <= 256 * 512,
      pressureBands: !far && (medium || close),
      mountainOutlines: !far && (medium || close),
      humans: true,
      settlements: true,
      animalMovement: close && !far,
    };
  }, [snapshot.grid.totalCells, view.scale]);

  const [isPending, startTransition] = useTransition();
  const deferredCommittedDay = committedDay;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const cellByIdRef = useRef(new Map<string, AtlasCell>());
  const cellByGridKeyRef = useRef(new Map<string, AtlasCell>());
  const baseLayerBufferRef = useRef<HTMLCanvasElement | null>(null);
  const baseLayerCacheKeyRef = useRef<string>("");
  const snapshotRequestKeyRef = useRef<string>("");
  const snapshotInFlightRef = useRef(false);
  const snapshotRefreshingRef = useRef(false);
  const pendingSnapshotRequestRef = useRef<AtlasSnapshotRequest | null>(null);
  const timelinePlayingRef = useRef(timelinePlaying);
  const lastSnapshotLoadMsRef = useRef(lastSnapshotLoadMs);
  const healthInFlightRef = useRef(false);
  const healthTimerRef = useRef<number | null>(null);
  const playbackLoopDelayRef = useRef(0);
  const continentCacheRef = useRef<{ land?: { id: number; center: { row: number; column: number }; size: number }; ocean?: { id: number; center: { row: number; column: number }; size: number } } | null>(null);

  const selectedWorld = worlds.find((world) => world.id === selectedWorldId) ?? worlds[0];

const cellById = useMemo(
  () => new Map(snapshot.cells.map((cell) => [cell.id, cell])),
  [snapshot.cells],
);

const selectedCell = selectedCellId ? cellById.get(selectedCellId) ?? null : null;
const hoveredCell = hoverState ? cellById.get(hoverState.cellId) ?? null : null;
const selectedHuman = selectedHumanId ? snapshot.humans.agents.find((agent) => agent.id === selectedHumanId) ?? null : null;
const followedCell = selectedHuman ? cellById.get(selectedHuman.currentCellId) ?? null : null;
const inspectorCell = selectedCell;
const observedCell = selectedCell ?? hoveredCell;
const missionEvents = useMemo(() => buildMissionEvents(snapshot, selectedCell), [selectedCell, snapshot]);
const eventCategories = useMemo(() => getEventCategories(missionEvents), [missionEvents]);
const filteredMissionEvents = eventCategoryFilter === "All"
  ? missionEvents
  : missionEvents.filter((event) => event.category === eventCategoryFilter);
const latestMissionEvent = missionEvents[0] ?? null;
const navigationDepth = getNavigationDepth(globeZoom, view.scale);
const simulationBusy = snapshotRefreshing || isPending;

  useEffect(() => {
    timelinePlayingRef.current = timelinePlaying;
  }, [timelinePlaying]);

  useEffect(() => {
    snapshotRefreshingRef.current = snapshotRefreshing;
  }, [snapshotRefreshing]);

  useEffect(() => {
    lastSnapshotLoadMsRef.current = lastSnapshotLoadMs;
  }, [lastSnapshotLoadMs]);


 useEffect(() => {
  cellByIdRef.current = cellById;
  cellByGridKeyRef.current = new Map(
    snapshot.cells.map((cell) => [`${getDisplayRow(snapshot, cell)}:${cell.column}`, cell]),
  );
  continentCacheRef.current = null;
}, [cellById, snapshot]);

  useEffect(() => {
    if (!selectedCellId) {
      return;
    }

    if (!cellByIdRef.current.has(selectedCellId)) {
      setSelectedCellId(null);
    }
  }, [selectedCellId, snapshot]);


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



  const applyLoadedSnapshot = useEffectEvent((nextSnapshot: AtlasSnapshot) => {
    startTransition(() => {
      setSnapshot(nextSnapshot);
      setSelectedWorldId(nextSnapshot.worldId);
      setRequestedDay(nextSnapshot.selectedDay);
      setCommittedDay(nextSnapshot.selectedDay);
      setSelectedCellId(null);
    });

    if (followHuman && selectedHumanId) {
      const nextHuman = nextSnapshot.humans.agents.find((agent) => agent.id === selectedHumanId);
      const nextCell = nextHuman ? nextSnapshot.cells.find((cell) => cell.id === nextHuman.currentCellId) : null;

      if (nextCell) {
        const worldTransform = createAtlasCoordinateTransform(nextSnapshot, { scale: 1, offsetX: 0, offsetY: 0 });
        const rect = worldTransform.cellRect(nextCell);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const nextScale = clamp(Math.max(view.scale, 1.6), MIN_SCALE, MAX_SCALE);
        setView({
          scale: nextScale,
          offsetX: canvasSize.width / 2 - centerX * nextScale,
          offsetY: canvasSize.height / 2 - centerY * nextScale,
        });
      }
    }
  });

  const drainSnapshotQueue = useEffectEvent(async () => {
    if (snapshotInFlightRef.current) {
      return;
    }

    const request = pendingSnapshotRequestRef.current;

    if (!request) {
      return;
    }

    pendingSnapshotRequestRef.current = null;
    snapshotInFlightRef.current = true;
    snapshotRefreshingRef.current = true;
    setSnapshotRefreshing(true);
    setError(null);

    const startedAt = nowMs();

    try {
      const nextSnapshot = await fetchSnapshot(request.worldId, request.day);
      const durationMs = Math.max(0, nowMs() - startedAt);
      lastSnapshotLoadMsRef.current = durationMs;
      setLastSnapshotLoadMs(durationMs);
      logAtlasTiming("snapshot-refresh", durationMs, { worldId: request.worldId, day: request.day });

      const pendingAfterFetch = (() => pendingSnapshotRequestRef.current as AtlasSnapshotRequest | null)();

      if (!pendingAfterFetch || pendingAfterFetch.key === request.key) {
        applyLoadedSnapshot(nextSnapshot);
      } else {
        logAtlasTiming("snapshot-refresh-stale-skip", durationMs, { worldId: request.worldId, day: request.day });
      }
    } catch (loadError) {
      if (!pendingSnapshotRequestRef.current) {
        snapshotRequestKeyRef.current = "";
        setError(loadError instanceof Error ? loadError.message : "Unable to load atlas snapshot.");
      }
    } finally {
      snapshotInFlightRef.current = false;

      if (pendingSnapshotRequestRef.current) {
        void drainSnapshotQueue();
      } else {
        snapshotRefreshingRef.current = false;
        setSnapshotRefreshing(false);
      }
    }
  });

  const scheduleSnapshotLoad = useEffectEvent((worldId: string, day: number) => {
    const requestKey = worldId + ":" + day;

    if (snapshotRequestKeyRef.current === requestKey) {
      return;
    }

    snapshotRequestKeyRef.current = requestKey;
    pendingSnapshotRequestRef.current = { worldId, day, key: requestKey };
    void drainSnapshotQueue();
  });

  useEffect(() => {
    if (selectedWorldId === snapshot.worldId && deferredCommittedDay === snapshot.selectedDay) {
      return;
    }

    scheduleSnapshotLoad(selectedWorldId, deferredCommittedDay);
  }, [deferredCommittedDay, selectedWorldId, snapshot.selectedDay, snapshot.worldId]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    query.set("world", snapshot.worldId);
    query.set("day", String(snapshot.selectedDay));

    if (selectedCellId) {
      query.set("cell", selectedCellId);
    } else {
      query.delete("cell");
    }

    if (selectedHumanId) {
      query.set("citizen", selectedHumanId);
    } else {
      query.delete("citizen");
    }

    const nextUrl = window.location.pathname + "?" + query.toString();

    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [selectedCellId, selectedHumanId, snapshot.selectedDay, snapshot.worldId]);

  const loadHealthTelemetry = useEffectEvent(async (worldId: string) => {
    if (healthInFlightRef.current) {
      return;
    }

    healthInFlightRef.current = true;
    const startedAt = nowMs();

    try {
      const telemetry = await fetchHealthTelemetry(worldId);
      logAtlasTiming("health-poll", nowMs() - startedAt, { worldId });
      setHealthTelemetry(telemetry);
    } catch {
      setHealthTelemetry(null);
    } finally {
      healthInFlightRef.current = false;
    }
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    if (healthTimerRef.current !== null) {
      window.clearTimeout(healthTimerRef.current);
      healthTimerRef.current = null;
    }

    const delayMs = timelinePlaying || snapshotRefreshing ? HEALTH_PLAYBACK_DEBOUNCE_MS : 180;
    healthTimerRef.current = window.setTimeout(() => {
      healthTimerRef.current = null;

      if (timelinePlayingRef.current || snapshotRefreshingRef.current) {
        return;
      }

      void loadHealthTelemetry(snapshot.worldId);
    }, delayMs);

    return () => {
      if (healthTimerRef.current !== null) {
        window.clearTimeout(healthTimerRef.current);
        healthTimerRef.current = null;
      }
    };
  }, [snapshot.worldId, snapshot.tick, snapshotRefreshing, timelinePlaying]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const startedAt = nowMs();
    setSnapshotSizeBytes(estimateSnapshotSizeBytes(snapshot));
    logAtlasTiming("snapshot-size-estimate", nowMs() - startedAt, { day: snapshot.selectedDay });
  }, [snapshot]);

  useEffect(() => {
    if (!timelinePlaying) {
      return;
    }

    let cancelled = false;
    let timer = 0;
    let previousLoopAt = nowMs();

    const scheduleNext = (delayMs: number) => {
      playbackLoopDelayRef.current = delayMs;
      setPlaybackLoopDelayMs(delayMs);
      timer = window.setTimeout(runLoop, delayMs);
    };

    const runLoop = () => {
      if (cancelled) {
        return;
      }

      const loopStartedAt = nowMs();
      const baseDelayMs = Math.max(PLAYBACK_MIN_DELAY_MS, 1500 / timelineSpeed);

      if (snapshotInFlightRef.current || snapshotRefreshingRef.current) {
        const cooldownMs = clamp(
          Math.max(PLAYBACK_BUSY_RETRY_MS, lastSnapshotLoadMsRef.current * 0.45),
          PLAYBACK_BUSY_RETRY_MS,
          PLAYBACK_MAX_COOLDOWN_MS,
        );
        logAtlasTiming("playback-loop-delay", loopStartedAt - previousLoopAt, { delayMs: cooldownMs, reason: "snapshot-busy" });
        previousLoopAt = loopStartedAt;
        scheduleNext(cooldownMs);
        return;
      }

      setCommittedDay((day) => {
        const nextDay = day >= selectedWorld.yearLengthDays ? 1 : day + 1;
        setRequestedDay(nextDay);
        return nextDay;
      });

      const elapsedMs = nowMs() - loopStartedAt;
      logAtlasTiming("playback-loop-delay", loopStartedAt - previousLoopAt, { delayMs: baseDelayMs, speed: timelineSpeed });
      previousLoopAt = loopStartedAt;
      scheduleNext(Math.max(baseDelayMs, elapsedMs + PLAYBACK_MIN_DELAY_MS));
    };

    scheduleNext(Math.max(PLAYBACK_MIN_DELAY_MS, 1500 / timelineSpeed));

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedWorld.yearLengthDays, timelinePlaying, timelineSpeed]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const renderStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    context.imageSmoothingEnabled = false;
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


    if (isOverlayVisible("animalMovement") || selectedLayerId === "animals") {
      context.strokeStyle = "rgba(191, 219, 254, 0.7)";
      context.fillStyle = "rgba(191, 219, 254, 0.7)";
      context.lineWidth = 0.9;

      for (const cell of snapshot.cells) {
        for (const vector of cell.movementVectors.slice(0, 2)) {
          const target = cellByIdRef.current.get(vector.toCellId);

          if (!target) {
            continue;
          }

          const from = transform.cellRect(cell);
          const to = transform.cellRect(target);
          drawArrow(context, from.x + from.width / 2, from.y + from.height / 2, to.x + to.width / 2, to.y + to.height / 2);
        }
      }
    }

    if (isOverlayVisible("settlements") || selectedLayerId === "civilizations") {
      context.strokeStyle = "rgba(251, 191, 36, 0.95)";
      context.lineWidth = 2;

      for (const settlement of snapshot.settlements.settlements) {
        const cell = cellByIdRef.current.get(settlement.homeCellId);

        if (!cell) {
          continue;
        }

        const rect = transform.cellRect(cell);
        context.strokeRect(rect.x + 3, rect.y + 3, Math.max(2, rect.width - 6), Math.max(2, rect.height - 6));
      }
    }

    if (isOverlayVisible("humans") || selectedLayerId === "civilizations") {
      const humansByCell = new Map<string, number>();
      for (const agent of snapshot.humans.agents) {
        const index = humansByCell.get(agent.currentCellId) ?? 0;
        humansByCell.set(agent.currentCellId, index + 1);
        const cell = cellByIdRef.current.get(agent.currentCellId);

        if (!cell) {
          continue;
        }

        const rect = transform.cellRect(cell);
        const humansInCurrentCell = getHumansInCell(snapshot, agent.currentCellId).length;
        const maxSpriteHeight = clamp(Math.min(rect.width, rect.height) * (humansInCurrentCell > 2 ? 0.52 : 0.68), 9, 24);
        const spacing = Math.max(maxSpriteHeight * 0.55, rect.width * 0.16);
        const groupOffset = index - (humansInCurrentCell - 1) / 2;
        const centerX = rect.x + rect.width / 2 + groupOffset * spacing;
        const centerY = rect.y + rect.height / 2 + Math.min(rect.height * 0.12, maxSpriteHeight * 0.18);
        const active = selectedHuman?.id === agent.id;
        drawPixelHumanSprite(context, agent, centerX, centerY, maxSpriteHeight, active, animationClock);

        if (active && typeof (context as any).arc === "function") {
          context.strokeStyle = "rgba(103, 232, 249, 0.9)";
          context.lineWidth = 2;
          context.beginPath();
          context.arc(centerX, centerY, Math.max(9, maxSpriteHeight * 0.82), 0, Math.PI * 2);
          context.stroke();
        }
      }
    }
    if (selectedHuman?.recentPath.length) {
      context.strokeStyle = followHuman ? "rgba(103, 232, 249, 0.85)" : "rgba(253, 224, 71, 0.75)";
      context.lineWidth = 2;
      context.beginPath();
      selectedHuman.recentPath.forEach((cellId, index) => {
        const pathCell = cellByIdRef.current.get(cellId);

        if (!pathCell) {
          return;
        }

        const rect = transform.cellRect(pathCell);
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height / 2;

        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();

      const currentCell = cellByIdRef.current.get(selectedHuman.currentCellId);
      const destinationCell = selectedHuman.destinationCellId ? cellByIdRef.current.get(selectedHuman.destinationCellId) ?? null : null;
      const homeSettlement = snapshot.settlements.settlements.find((settlement) => settlement.currentResidents.includes(selectedHuman.id));
      const homeCell = homeSettlement ? cellByIdRef.current.get(homeSettlement.homeCellId) ?? null : null;

      if (currentCell && destinationCell) {
        const from = transform.cellRect(currentCell);
        const to = transform.cellRect(destinationCell);
        context.strokeStyle = "rgba(103,232,249,0.62)";
        context.fillStyle = "rgba(103,232,249,0.62)";
        context.lineWidth = 1.6;
        drawArrow(context, from.x + from.width / 2, from.y + from.height / 2, to.x + to.width / 2, to.y + to.height / 2);
      }

      if (homeCell && typeof (context as any).arc === "function") {
        const home = transform.cellRect(homeCell);
        context.strokeStyle = "rgba(251,191,36,0.82)";
        context.lineWidth = 1.8;
        context.beginPath();
        context.arc(home.x + home.width / 2, home.y + home.height / 2, Math.max(7, Math.min(home.width, home.height) * 0.35), 0, Math.PI * 2);
        context.stroke();
      }

      if (signalToggles.families && currentCell) {
        const from = transform.cellRect(currentCell);
        context.strokeStyle = "rgba(244,114,182,0.52)";
        context.lineWidth = 1.2;
        for (const relation of selectedHuman.family.slice(0, 8)) {
          const relative = snapshot.humans.agents.find((agent) => agent.id === relation.targetHumanId);
          const relativeCell = relative ? cellByIdRef.current.get(relative.currentCellId) : null;
          if (!relativeCell) continue;
          const to = transform.cellRect(relativeCell);
          context.beginPath();
          context.moveTo(from.x + from.width / 2, from.y + from.height / 2);
          context.lineTo(to.x + to.width / 2, to.y + to.height / 2);
          context.stroke();
        }
      }
    }

    if (typeof (context as any).arc === "function") {
      for (const event of missionEvents.slice(0, 24)) {
        const cell = getMissionEventCell(snapshot, event);

        if (!cell) {
          continue;
        }

        const rect = transform.cellRect(cell);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const radius = Math.max(5, Math.min(rect.width, rect.height) * 0.22);
        const pulse = 1 + Math.sin(animationClock * 0.006 + hashString(event.id) * 0.01) * 0.18;
        context.globalAlpha = 0.24;
        context.fillStyle = getMissionEventColor(event.category);
        context.beginPath();
        context.arc(centerX, centerY, radius * 2.2 * pulse, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        context.fillStyle = getMissionEventColor(event.category);
        context.strokeStyle = "rgba(3,7,12,0.9)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.fillStyle = "rgba(3,7,12,0.95)";
        context.font = `${Math.max(7, 9 * view.scale)}px var(--font-sans)`;
        context.fillText(getMissionEventGlyph(event.category), centerX - radius * 0.38, centerY + radius * 0.34);
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

    const renderFinishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const nextRenderCostMs = Math.max(0, renderFinishedAt - renderStartedAt);
    window.setTimeout(() => setRenderCostMs(nextRenderCostMs), 0);
  }, [autoOverlayMask, canvasSize.height, canvasSize.width, followHuman, hoveredCell, missionEvents, overlays, selectedCell, selectedHuman, selectedLayerId, signalToggles.families, snapshot, view]);

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
    setActiveLayerSectionId(MISSION_LAYER_SECTIONS.find((section) => section.layers.includes(layerId))?.id ?? activeLayerSectionId);
  };

  const onToggleOverlay = (overlayId: OverlayId) => {
    setOverlays((current) => ({ ...current, [overlayId]: !current[overlayId] }));
  };

  const applyGlobeLayerPreset = (presetId: GlobeLayerPresetId) => {
    setGlobeLayerPresetId(presetId);
    setGlobeLayers(cloneGlobeLayers(GLOBE_LAYER_PRESETS[presetId]));
  };

  const updateGlobeLayer = (layerId: GlobeLayerId, updates: Partial<GlobeLayerSetting>) => {
    setGlobeLayers((current) => ({
      ...current,
      [layerId]: {
        ...current[layerId],
        ...updates,
      },
    }));
  };

  const resetGlobeLayer = (layerId: GlobeLayerId) => {
    setGlobeLayers((current) => ({
      ...current,
      [layerId]: { ...GLOBE_LAYER_PRESETS[globeLayerPresetId][layerId] },
    }));
  };

  const onToggleSignal = (signalId: SignalToggleId) => {
    const nextVisible = !signalToggles[signalId];
    setSignalToggles((current) => ({ ...current, [signalId]: !current[signalId] }));

    const globeLayerBySignal: Partial<Record<SignalToggleId, GlobeLayerId>> = {
      animals: "animals",
      resources: "resources",
      weather: "weather",
      humans: "humans",
      settlements: "settlements",
      knowledge: "knowledge",
      communication: "communication",
      families: "families",
      heatmaps: "resources",
    };
    const globeLayerId = globeLayerBySignal[signalId];

    if (globeLayerId) {
      updateGlobeLayer(globeLayerId, { visible: nextVisible });
    }

    if (signalId === "humans") {
      onToggleOverlay("humans");
    }

    if (signalId === "settlements") {
      onToggleOverlay("settlements");
    }

    const layerBySignal: Partial<Record<SignalToggleId, LayerId>> = {
      animals: "animals",
      resources: "resources",
      weather: "weatherIntensity",
      knowledge: "knowledgeDensity",
      communication: "civilizations",
      families: "civilizations",
      heatmaps: "populationDensity",
    };
    const nextLayer = layerBySignal[signalId];

    if (nextLayer) {
      setSelectedLayerId(nextLayer);
    }
  };

  // Toolbar actions and helpers
 const resetView = useCallback(() => {
  setView(createFitView(snapshot, canvasSize.width, canvasSize.height));
}, [snapshot, canvasSize.width, canvasSize.height]);

  const flyToView = useCallback((targetView: AtlasView) => {
    if (process.env.NODE_ENV === "test" || typeof window === "undefined") {
      setView(targetView);
      return;
    }

    const start = view;
    const startedAt = performance.now();
    const travel = Math.hypot(targetView.offsetX - start.offsetX, targetView.offsetY - start.offsetY) + Math.abs(targetView.scale - start.scale) * 180;
    const duration = clamp(620 + travel * 0.12, 720, 1280);
    const animate = (time: number) => {
      const progress = clamp((time - startedAt) / duration, 0, 1);
      const eased = progress < 0.5
        ? 16 * Math.pow(progress, 5)
        : 1 - Math.pow(-2 * progress + 2, 5) / 2;
      setView({
        scale: start.scale + (targetView.scale - start.scale) * eased,
        offsetX: start.offsetX + (targetView.offsetX - start.offsetX) * eased,
        offsetY: start.offsetY + (targetView.offsetY - start.offsetY) * eased,
      });
      if (progress < 1) {
        window.requestAnimationFrame(animate);
      }
    };

    window.requestAnimationFrame(animate);
  }, [view]);

  const focusCell = (cell: AtlasCell, scale = DEFAULT_CELL_FOCUS_SCALE) => {
    setSelectedCellId(cell.id);
    const worldTransform = createAtlasCoordinateTransform(snapshot, { scale: 1, offsetX: 0, offsetY: 0 });
    const rect = worldTransform.cellRect(cell);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const nextScale = clamp(scale, MIN_SCALE, MAX_SCALE);
    flyToView({
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



  const jumpToMissionEvent = (event: MissionEvent) => {
    if (event.cellId) {
      const cell = cellByIdRef.current.get(event.cellId);

      if (cell) {
        focusCell(cell, 1.8);
      }
    }

    if (event.humanId) {
      const human = snapshot.humans.agents.find((agent) => agent.id === event.humanId);

      if (human) {
        setSelectedHumanId(human.id);
        const cell = cellByIdRef.current.get(human.currentCellId);

        if (cell) {
          focusCell(cell, 1.8);
        }
      }
    }

    if (event.settlementId) {
      const settlement = snapshot.settlements.settlements.find((entry) => entry.id === event.settlementId);
      const cell = settlement ? cellByIdRef.current.get(settlement.homeCellId) : null;

      if (cell) {
        focusCell(cell, 1.8);
      }
    }
  };

  const loadCompareSnapshot = () => {
    setCompareError(null);
    startTransition(() => {
      fetchSnapshot(snapshot.worldId, compareDay)
        .then((value) => setCompareSnapshot(value))
        .catch((loadError) => setCompareError(loadError instanceof Error ? loadError.message : "Unable to load comparison snapshot."));
    });
  };

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

    const latOnly = q.match(/^(-?\d{1,2})(?:\s*(?:deg)?)\s*([ns])?$/i);
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
    const coordMatch = q.match(/^\s*([+-]?\d{1,2})(?:\s*(?:deg)?)\s*([ns])?\s*,\s*([+-]?\d{1,3})(?:\s*(?:deg)?)\s*([ew])?\s*$/i);
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

    const matchingHuman = snapshot.humans.agents.find((agent) =>
      agent.id.toLowerCase().includes(keyword)
      || agent.label.toLowerCase().includes(keyword)
      || Boolean(agent.currentGoal?.type.toLowerCase().includes(keyword)),
    );

    if (matchingHuman) {
      setSelectedHumanId(matchingHuman.id);
      const cell = cellByIdRef.current.get(matchingHuman.currentCellId);

      if (cell) {
        focusCell(cell, 1.8);
      }

      saveSearch(q);
      setShowSearch(false);
      return;
    }

    const matchingSettlement = snapshot.settlements.settlements.find((settlement) =>
      settlement.id.toLowerCase().includes(keyword)
      || settlement.name.toLowerCase().includes(keyword)
      || settlement.type.toLowerCase().includes(keyword),
    );

    if (matchingSettlement) {
      const cell = cellByIdRef.current.get(matchingSettlement.homeCellId);

      if (cell) {
        focusCell(cell, 1.8);
      }

      saveSearch(q);
      setShowSearch(false);
      return;
    }

    const matchingFamily = snapshot.families.families.find((family) =>
      family.id.toLowerCase().includes(keyword)
      || family.lineageId.toLowerCase().includes(keyword),
    );

    if (matchingFamily) {
      const cell = cellByIdRef.current.get(matchingFamily.homeCellId);

      if (cell) {
        focusCell(cell, 1.8);
      }

      saveSearch(q);
      setShowSearch(false);
      return;
    }

    const matchingEvent = missionEvents.find((event) =>
      event.title.toLowerCase().includes(keyword)
      || event.summary.toLowerCase().includes(keyword)
      || event.category.toLowerCase().includes(keyword)
      || event.id.toLowerCase().includes(keyword),
    );

    if (matchingEvent) {
      jumpToMissionEvent(matchingEvent);
      saveSearch(q);
      setShowSearch(false);
      return;
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
  }, [resetView]);

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


  const selectCellAndHumanAtPosition = (cell: AtlasCell, clientX: number) => {
    setSelectedCellId(cell.id);
    const humans = getHumansInCell(snapshot, cell.id);

    if (humans.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const bounds = canvas?.getBoundingClientRect();
    const transform = createAtlasCoordinateTransform(snapshot, view);
    const rect = transform.cellRect(cell);
    const localX = bounds ? clientX - bounds.left : rect.x + rect.width / 2;
    const pickedIndex = localX > rect.x + rect.width / 2 ? humans.length - 1 : 0;
    setSelectedHumanId(humans[clamp(pickedIndex, 0, humans.length - 1)]?.id ?? humans[0].id);
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
      selectCellAndHumanAtPosition(cell, event.clientX);
    }

    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = getCellAtClientPosition(event.clientX, event.clientY);

    if (cell) {
      selectCellAndHumanAtPosition(cell, event.clientX);
    }
  };

  const onCanvasPointerLeave = () => {
    setHoverState(null);
    dragStateRef.current = null;
  };

  const selectedLayer = getLayerDefinition(selectedLayerId);
  const tooltipSummary = hoveredCell ? getTooltipSummary(snapshot, hoveredCell) : null;
  const activeStatistics = getLayerStatistics(snapshot, selectedLayerId);
  const legendItems = getLegendItems(snapshot, selectedLayerId);
  return (
    <main className="min-h-screen overflow-hidden bg-[#030508] text-stone-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_45%_20%,rgba(56,189,248,0.12),transparent_34%),radial-gradient(circle_at_82%_8%,rgba(216,173,95,0.12),transparent_24%),linear-gradient(180deg,#030508,#080a0f_52%,#050607)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1920px] flex-col px-4 py-4 lg:px-6">
        <header className={`flex flex-col gap-4 border-b border-white/10 pb-4 transition-all duration-500 xl:flex-row xl:items-center xl:justify-between ${chronicleMode ? "pointer-events-none max-h-0 overflow-hidden border-transparent opacity-0" : "opacity-100"}`}>
          <div>
            <p className="text-[10px] uppercase tracking-[0.42em] text-dawn-gold">First Dawn Mission Control</p>
            <h1 className="mt-2 font-display text-4xl text-white md:text-6xl">{snapshot.worldName}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">A live planetary observatory rendered from the existing deterministic Atlas snapshot.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/worlds" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-stone-200 transition hover:border-dawn-gold/30 hover:bg-white/[0.08]">World Story</Link>
            <Link href="/worlds/grid" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-stone-200 transition hover:border-dawn-gold/30 hover:bg-white/[0.08]">Grid Inspector</Link>
            <button type="button" data-testid="toolbar-search" onClick={() => setShowSearch((value) => !value)} className="rounded-full border border-dawn-gold/30 bg-dawn-gold/10 px-4 py-2 text-sm text-dawn-amber transition hover:bg-dawn-gold/15">Search</button>
            <button type="button" data-testid="chronicle-mode-toggle" onClick={() => setChronicleMode((value) => !value)} className={`rounded-full border px-4 py-2 text-sm transition ${chronicleMode ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-stone-200 hover:border-cyan-300/30 hover:bg-white/[0.08]"}`}>{chronicleMode ? "Mission Control" : "Chronicle Mode"}</button>
          </div>
        </header>

        {showSearch ? (
          <section className="mt-4 rounded-[1.25rem] border border-dawn-gold/30 bg-[#151107]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                data-testid="atlas-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") handleSearch(searchQuery); }}
                placeholder="Search cells, citizens, settlements, families, events, or coordinates"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-dawn-gold/60"
              />
              <button type="button" data-testid="atlas-search-go" onClick={() => handleSearch(searchQuery)} className="rounded-xl border border-dawn-gold/40 bg-dawn-gold/10 px-4 py-3 text-sm font-semibold text-dawn-amber">Go</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...searchHistory.slice(0, 5).map((entry) => entry.q), "North Pole", "Equator", "Prime Meridian"].map((query) => (
                <button key={query} type="button" onClick={() => { setSearchQuery(query); handleSearch(query); }} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-stone-200 hover:bg-white/[0.08]">{query}</button>
              ))}
            </div>
          </section>
        ) : null}

        <section className={`mt-5 grid flex-1 gap-5 transition-all duration-500 ${chronicleMode ? "xl:grid-cols-1" : "xl:grid-cols-[300px_minmax(0,1fr)_390px] 2xl:grid-cols-[320px_minmax(0,1fr)_420px]"}`}>
          <aside className={`order-2 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-500 xl:order-1 xl:max-h-[calc(100vh-9rem)] xl:overflow-auto ${chronicleMode ? "hidden" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Layers</p>
                <p className="mt-1 text-lg text-white">{selectedLayer.label}</p>
              </div>
              <select
                value={selectedWorldId}
                onChange={(event) => {
                  const nextWorld = worlds.find((world) => world.id === event.target.value) ?? worlds[0];
                  const clampedDay = clamp(requestedDay, 1, nextWorld.yearLengthDays);
                  setSelectedWorldId(nextWorld.id);
                  setRequestedDay(clampedDay);
                  setCommittedDay(clampedDay);
                }}
                className="max-w-[9rem] rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-stone-100 outline-none"
                aria-label="World"
              >
                {worlds.map((world) => <option key={world.id} value={world.id}>{world.name}</option>)}
              </select>
            </div>

            <div className="mt-5 space-y-2">
              {MISSION_LAYER_SECTIONS.map((section) => {
                const expanded = activeLayerSectionId === section.id;

                return (
                  <div key={section.id} className="rounded-2xl border border-white/10 bg-black/20">
                    <button type="button" onClick={() => setActiveLayerSectionId(section.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <span>
                        <span className="block text-[9px] uppercase tracking-[0.28em] text-stone-500">{section.eyebrow}</span>
                        <span className="mt-1 block text-sm text-stone-100">{section.title}</span>
                      </span>
                      <span className={`h-2 w-2 rounded-full ${expanded ? "bg-dawn-gold shadow-[0_0_16px_rgba(216,173,95,0.8)]" : "bg-white/20"}`} />
                    </button>
                    <div className={`grid gap-2 overflow-hidden px-3 transition-all duration-300 ${expanded ? "max-h-[54rem] pb-3 opacity-100" : "max-h-0 opacity-0"}`}>
                      {section.layers.map((layerId) => {
                        const layer = getLayerDefinition(layerId);
                        const active = selectedLayerId === layer.id;

                        return (
                          <button
                            key={layer.id}
                            type="button"
                            data-testid={`layer-${layer.id}`}
                            disabled={layer.disabled}
                            onClick={() => onLayerSelect(layer.id)}
                            className={`rounded-xl border px-3 py-2 text-left transition ${active ? "border-dawn-gold/45 bg-dawn-gold/10 text-dawn-amber" : "border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.07]"}`}
                          >
                            <span className="block text-sm">{layer.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-stone-500">{layer.description}</span>
                          </button>
                        );
                      })}
                      {section.overlays.map((overlayId) => (
                        <label key={overlayId} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-stone-300">
                          <span>{OVERLAY_TOGGLE_LABELS[overlayId]}</span>
                          <input type="checkbox" checked={overlays[overlayId]} onChange={() => onToggleOverlay(overlayId)} className="accent-dawn-gold" />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Signals</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(Object.keys(SIGNAL_TOGGLE_LABELS) as SignalToggleId[]).map((signalId) => (
                  <button key={signalId} type="button" onClick={() => onToggleSignal(signalId)} className={`rounded-xl border px-3 py-2 text-left text-xs transition ${signalToggles[signalId] ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.07]"}`}>
                    {SIGNAL_TOGGLE_LABELS[signalId]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Layer Mixer</p>
                  <p className="mt-1 truncate text-xs text-stone-300">{GLOBE_LAYER_PRESET_LABELS[globeLayerPresetId]}</p>
                </div>
                <button type="button" onClick={() => setGlobeLayerMixerExpanded((expanded) => !expanded)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-stone-200 transition hover:bg-white/[0.08]">{globeLayerMixerExpanded ? "Hide" : "Sliders"}</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {GLOBE_LAYER_QUICK_PRESETS.map((presetId) => (
                  <button
                    key={presetId}
                    type="button"
                    onClick={() => applyGlobeLayerPreset(presetId)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${globeLayerPresetId === presetId ? "border-dawn-gold/45 bg-dawn-gold/10 text-dawn-amber" : "border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.07]"}`}
                  >
                    {GLOBE_LAYER_PRESET_LABELS[presetId]}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-stone-400">
                <span>{GLOBE_LAYER_DEFINITIONS.filter((layer) => globeLayers[layer.id].visible).length} visible layers</span>
                <button type="button" onClick={() => applyGlobeLayerPreset("planet")} className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-stone-300 transition hover:bg-white/[0.08]">Planet Reset</button>
              </div>
              {globeLayerMixerExpanded ? (
                <div className="mt-4 grid gap-2">
                  {[...GLOBE_LAYER_DEFINITIONS].sort((left, right) => left.priority - right.priority).map((layer) => {
                    const setting = globeLayers[layer.id];
                    const sliderLabel = layer.id === "humans" ? "Marker" : layer.id === "settlements" ? "Glow" : "Opacity";

                    return (
                      <div key={layer.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex min-w-0 items-center gap-2 text-xs text-stone-200">
                            <input
                              type="checkbox"
                              checked={setting.visible}
                              onChange={(event) => updateGlobeLayer(layer.id, { visible: event.target.checked })}
                              className="accent-dawn-gold"
                            />
                            <span className="truncate">{layer.label}</span>
                          </label>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-[10px] text-stone-500">{layer.priority}</span>
                            <button type="button" onClick={() => resetGlobeLayer(layer.id)} className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-stone-300 transition hover:bg-white/[0.08]">Reset</button>
                          </div>
                        </div>
                        <label className="mt-2 grid grid-cols-[3.6rem_1fr_2.3rem] items-center gap-2 text-[10px] text-stone-500">
                          <span>{sliderLabel}</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={setting.opacity}
                            onChange={(event) => updateGlobeLayer(layer.id, { opacity: Number(event.target.value) })}
                            className="w-full accent-dawn-gold"
                          />
                          <span className="text-right tabular-nums">{Math.round(setting.opacity * 100)}%</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </aside>

          <section className="order-1 min-w-0 space-y-5 xl:order-2">
            <div className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] shadow-[0_34px_110px_rgba(0,0,0,0.55)] transition-all duration-700 ${chronicleMode ? "min-h-[calc(100vh-12rem)]" : "min-h-[66vh]"}`}>
              <PlanetGlobeRenderer
                snapshot={snapshot}
                selectedCellId={selectedCellId}
                selectedHumanId={selectedHumanId}
                layers={globeLayers}
                events={missionEvents}
                chronicleMode={chronicleMode}
                onCellFocus={(cell) => focusCell(cell, Math.max(view.scale, 1.35))}
                onZoomChange={setGlobeZoom}
              />              <div className={`pointer-events-none absolute left-5 top-5 max-w-lg transition-all duration-500 ${chronicleMode ? "opacity-0" : "opacity-100"}`}>
                <p className="text-[10px] uppercase tracking-[0.36em] text-dawn-gold">Planet View</p>
                <h2 className="mt-2 font-display text-3xl text-white md:text-5xl">Living Surface Telemetry</h2>
                <p className="mt-3 text-sm leading-6 text-stone-300">Layered terrain, cloud cover, seasonal snow, day/night shading, humans, and settlements are projected from the current Atlas snapshot.</p>
              </div>
              {chronicleMode ? (
                <button type="button" onClick={() => setChronicleMode(false)} className="absolute right-5 top-5 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs text-stone-200 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-cyan-300/35 hover:bg-white/[0.08]">Mission Control</button>
              ) : null}
              <div className={`pointer-events-none absolute bottom-5 left-5 right-5 grid gap-3 transition-all duration-500 ${chronicleMode ? "md:grid-cols-4" : "md:grid-cols-5"}`}>
                {chronicleMode ? (
                  <>
                    <ContextMetric label="Current Year" value={`Year ${getCurrentYear(snapshot)}`} />
                    <ContextMetric label="Living Humans" value={String(snapshot.humans.agents.length)} />
                    <ContextMetric label="Current Story" value={getCurrentStory(latestMissionEvent)} />
                    <ContextMetric label="Simulation Speed" value={`${timelinePlaying ? "Watching" : "Paused"} / ${timelineSpeed}x`} />
                  </>
                ) : (
                  <>
                    <ContextMetric label="Navigation" value={navigationDepth.label} />
                    <ContextMetric label="Season North" value={titleize(snapshot.climate.seasonNorthernHemisphere)} />
                    <ContextMetric label="Season South" value={titleize(snapshot.climate.seasonSouthernHemisphere)} />
                    <ContextMetric label="Living Humans" value={String(snapshot.humans.agents.length)} />
                    <ContextMetric label="Current Story" value={latestMissionEvent ? latestMissionEvent.title : "Quiet world"} />
                  </>
                )}
              </div>
            </div>

            <section className={`rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-500 ${chronicleMode ? "hidden" : ""}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Grid Inspection Mode</p>
                  <h2 className="mt-1 font-display text-3xl text-white">{selectedLayer.label}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-stone-400">{selectedLayer.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={resetView} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-stone-200 transition hover:bg-white/[0.08]">Reset</button>
                  <button type="button" onClick={() => setView((current) => ({ ...current, scale: clamp(current.scale * 1.2, MIN_SCALE, MAX_SCALE) }))} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-stone-200 transition hover:bg-white/[0.08]">Zoom In</button>
                  <button type="button" onClick={() => setView((current) => ({ ...current, scale: clamp(current.scale * 0.85, MIN_SCALE, MAX_SCALE) }))} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-stone-200 transition hover:bg-white/[0.08]">Zoom Out</button>
                  <button type="button" onClick={() => setShowLegend((value) => !value)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-stone-200 transition hover:bg-white/[0.08]">Legend</button>
                </div>
              </div>

              <div ref={canvasHostRef} className="relative mt-4 h-[620px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#071017] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                <canvas
                  ref={canvasRef}
                  data-testid="world-map-canvas"
                  aria-label="Planetary simulation map"
                  className="h-full w-full cursor-grab [image-rendering:crisp-edges] [image-rendering:pixelated]"
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
                      <p><span className="text-stone-500">Hydrology</span> {tooltipSummary.hydrology}</p>
                      <p><span className="text-stone-500">Weather</span> {tooltipSummary.weather}</p>
                      <p><span className="text-stone-500">Biome</span> {tooltipSummary.biome}</p>
                      <p><span className="text-stone-500">Vegetation</span> {tooltipSummary.vegetation}</p>
                      <p><span className="text-stone-500">Animals</span> {tooltipSummary.animals}</p>
                      <p><span className="text-stone-500">Civilization</span> {tooltipSummary.civilization}</p>
                    </div>
                  </div>
                ) : null}
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Scroll zoom</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Drag pan</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Click inspect</span>
                  </div>
                  <p className="text-xs text-stone-500">{error ?? `${snapshot.grid.totalCells} deterministic cells`}</p>
                </div>
              </div>

              <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-black/20 p-4" style={{ opacity: legendOpacity }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Legend</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-stone-400"><span>Opacity</span><input aria-label="Legend Opacity" type="range" min={0.4} max={1} step={0.05} value={legendOpacity} onChange={(event) => setLegendOpacity(Number(event.target.value))} /></label>
                    <button type="button" onClick={() => setLegendPinned((value) => !value)} className={`rounded-full border px-2 py-1 text-xs ${legendPinned ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-stone-200"}`}>{legendPinned ? "Pinned" : "Pin"}</button>
                    <button type="button" data-testid="legend-toggle" onClick={() => setShowLegend((value) => !value)} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-200">{showLegend ? "Collapse" : "Expand"}</button>
                  </div>
                </div>
                {showLegend ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    {legendItems.map((item) => (
                      <div key={`${selectedLayerId}-${item.label}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-stone-200">
                        <svg className="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill={item.color} stroke="rgba(255,255,255,0.18)" /></svg>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className={`rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-500 ${chronicleMode ? "hidden" : ""}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">World Story</p>
                  <h2 className="mt-1 font-display text-3xl text-white">Planet Almanac</h2>
                </div>
                <p className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-stone-300">Fingerprint {snapshot.fingerprint.shortHash}</p>
              </div>
              <div className="mt-4"><MissionDashboard snapshot={snapshot} events={missionEvents} /></div>
              <FutureLayersPanel snapshot={snapshot} selectedCell={observedCell} loading={isPending} error={error} />
            </section>
          </section>

          <aside className={`order-3 space-y-5 transition-all duration-500 xl:max-h-[calc(100vh-9rem)] xl:overflow-auto ${chronicleMode ? "hidden" : ""}`}>
            <ContextualInspector snapshot={snapshot} cell={inspectorCell} human={selectedHuman} />
            <HumanObservatory
              snapshot={snapshot}
              selectedCell={observedCell}
              selectedHuman={selectedHuman}
              followHuman={followHuman}
              humansVisible={overlays.humans}
              onToggleHumans={() => onToggleOverlay("humans")}
              onSelectHuman={(humanId) => {
                setSelectedHumanId(humanId);
                const human = snapshot.humans.agents.find((agent) => agent.id === humanId);
                const cell = human ? cellByIdRef.current.get(human.currentCellId) : null;
                if (cell) focusCell(cell, 1.9);
              }}
              onToggleFollow={() => setFollowHuman((following) => !following)}
              onSimulateDay={() => {
                const nextDay = clamp(committedDay + 1, 1, selectedWorld.yearLengthDays);
                setRequestedDay(nextDay);
                setCommittedDay(nextDay);
              }}
            />
            <section data-testid="statistics-panel" className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Layer Analysis</p>
              <div className="mt-4 grid gap-3">
                {activeStatistics.map((stat, index) => <DetailCard key={`${selectedLayerId}-${stat.label}-${index}`} label={stat.label} value={stat.value} />)}
              </div>
            </section>
            <EventFeed events={filteredMissionEvents} categories={eventCategories} selectedCategory={eventCategoryFilter} onCategoryChange={setEventCategoryFilter} onJump={jumpToMissionEvent} />
            <WhyPanel human={selectedHuman} />
            <TimeTravelPanel snapshot={snapshot} selectedCell={selectedCell} compareDay={compareDay} compareSnapshot={compareSnapshot} compareError={compareError} onCompareDayChange={setCompareDay} onLoadCompare={loadCompareSnapshot} />
            <PerformancePanel snapshot={snapshot} healthTelemetry={healthTelemetry} renderCostMs={renderCostMs} snapshotSizeBytes={snapshotSizeBytes} lastSnapshotLoadMs={lastSnapshotLoadMs} />
            <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Planet Integrity</p>
              <div className="mt-4 grid gap-2">
                <IntegrityRow label="Canonical" ok={snapshot.integrity.canonical} />
                <IntegrityRow label="Environment Match" ok={snapshot.integrity.environmentMatch} />
                <IntegrityRow label="Terrain Validated" ok={snapshot.integrity.terrainValidated} />
                <IntegrityRow label="Climate Validated" ok={snapshot.integrity.climateValidated} />
                <IntegrityRow label="Hydrology Validated" ok={snapshot.integrity.hydrologyValidated} />
                <IntegrityRow label="Atmosphere Validated" ok={snapshot.integrity.atmosphereValidated} />
                <IntegrityRow label="Weather Validated" ok={snapshot.integrity.weatherValidated} />
              </div>
            </section>
          </aside>
        </section>

        <section className="sticky bottom-4 z-20 mt-5 rounded-[1.5rem] border border-white/10 bg-[#07090d]/90 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-dawn-gold">Cinematic Timeline</p>
              <p className="mt-1 text-sm text-stone-300">{formatTickDayYear(snapshot)} / {titleize(snapshot.climate.seasonNorthernHemisphere)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" data-testid="timeline-play-toggle" onClick={() => setTimelinePlaying((playing) => !playing)} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${timelinePlaying ? "border-dawn-gold/45 bg-dawn-gold/10 text-dawn-amber" : "border-white/10 bg-white/[0.04] text-stone-200"}`}>{timelinePlaying ? "Pause" : "Play"}</button>
              <button type="button" data-testid="timeline-step" onClick={() => { const nextDay = committedDay >= selectedWorld.yearLengthDays ? 1 : committedDay + 1; setTimelinePlaying(false); setRequestedDay(nextDay); setCommittedDay(nextDay); }} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-200">Step</button>
              <select aria-label="Timeline speed" value={timelineSpeed} onChange={(event) => setTimelineSpeed(Number(event.target.value) as (typeof MISSION_TIMELINE_SPEEDS)[number])} className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-stone-200 outline-none">
                {MISSION_TIMELINE_SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
            <input
              data-testid="time-slider"
              type="range"
              aria-label="Simulation day"
              min={1}
              max={selectedWorld.yearLengthDays}
              value={requestedDay}
              onChange={(event) => setRequestedDay(Number(event.target.value))}
              onPointerUp={() => setCommittedDay(requestedDay)}
              onKeyUp={() => setCommittedDay(requestedDay)}
              className="w-full accent-dawn-gold"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Selected Day {requestedDay}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Loaded Day {snapshot.selectedDay}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Year {Math.floor((snapshot.selectedDay - 1) / snapshot.yearLengthDays)}</span>
              <span className={`rounded-full border px-3 py-1.5 ${simulationBusy ? "border-dawn-gold/40 bg-dawn-gold/10 text-dawn-amber" : "border-white/10 bg-white/[0.04] text-stone-300"}`}>{simulationBusy ? "Simulation Busy" : timelinePlaying ? "Playback Ready" : "Simulation Idle"}</span>
              {playbackLoopDelayMs > 0 ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Loop Delay {formatNumber(playbackLoopDelayMs, 0)} ms</span> : null}
            </div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-3" data-testid="timeline-markers">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
              {missionEvents.slice(0, 10).map((event, index) => (
                <button
                  key={event.id + event.tick + index}
                  type="button"
                  onClick={() => jumpToMissionEvent(event)}
                  className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 transition hover:border-dawn-gold/35 hover:bg-white/[0.08]"
                  title={event.summary}
                >
                  <span className="h-2 w-2 rounded-full shadow-[0_0_14px_currentColor]" style={{ backgroundColor: getMissionEventColor(event.category), color: getMissionEventColor(event.category) }} />
                  <span className="text-stone-400">{event.category}</span>
                  <span className="max-w-[11rem] truncate text-stone-100">{event.title}</span>
                </button>
              ))}
              {missionEvents.length === 0 ? <span className="text-stone-500">Historical markers will appear as snapshots expose replayable events.</span> : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="quick-nav">
            {[
              ["North Pole","NorthPole"], ["South Pole","SouthPole"], ["Equator","Equator"], ["Prime Meridian","PrimeMeridian"],
              ["Highest Mountain","HighestMountain"], ["Lowest Point","LowestPoint"], ["Largest Continent","LargestContinent"], ["Largest Ocean","LargestOcean"],
              ["Largest Watershed","LargestWatershed"], ["Largest Basin","LargestBasin"], ["Wettest Cell","WettestCell"], ["Driest Cell","DriestCell"],
              ["Warmest Cell","WarmestCell"], ["Coldest Cell","ColdestCell"], ["Strongest Wind","StrongestWind"], ["Largest Rain Shadow","LargestRainShadow"],
            ].map(([label, key]) => <button key={String(key)} type="button" data-testid={`nav-${String(key)}`} onClick={() => quickNavActions[String(key) as keyof typeof quickNavActions]()} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-stone-300 transition hover:border-dawn-gold/25 hover:bg-white/[0.08]">{label}</button>)}
          </div>
        </section>
      </div>
    </main>
  );
}
