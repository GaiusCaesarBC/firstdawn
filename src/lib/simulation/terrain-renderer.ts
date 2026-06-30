import type { AtlasCell, AtlasSnapshot } from "../worlds/map-atlas";
import { renderCoastSample } from "./coast-renderer";
import { renderMountainSample } from "./mountain-renderer";
import { renderOceanSample } from "./ocean-renderer";
import {
  clamp,
  fbmNoise,
  hashNoise,
  mixColor,
  ridgeNoise,
  shadeColor,
  smoothstep,
} from "./procedural-noise";

export type AtlasTerrainRenderQuality = "off" | "balanced" | "high" | "ultra";

export type ProceduralTerrainRenderOptions = {
  cellSize: number;
  selectedLayerId: string;
  visualMode: "smoothAtlas" | "scientificOverlay" | "hybrid";
  quality: AtlasTerrainRenderQuality;
  getLayerColor: (cell: AtlasCell) => string;
};

type TerrainSampleInput = {
  snapshot: AtlasSnapshot;
  cellMap: Map<string, AtlasCell>;
  cell: AtlasCell;
  xRatio: number;
  yRatio: number;
  quality: AtlasTerrainRenderQuality;
};

type NeighborDirection = "west" | "east" | "north" | "south";

const BIOME_COLOR_HINTS: Array<{ pattern: RegExp; color: string }> = [
  { pattern: /ice|glacier|polar/i, color: "#d8e9eb" },
  { pattern: /tundra|alpine/i, color: "#a5ad9b" },
  { pattern: /taiga|boreal/i, color: "#345f4c" },
  { pattern: /rain.?forest|jungle/i, color: "#1b7145" },
  { pattern: /forest|woodland/i, color: "#326d45" },
  { pattern: /wetland|marsh|swamp|mangrove/i, color: "#3e7564" },
  { pattern: /grass|savanna|steppe|prairie/i, color: "#88a95d" },
  { pattern: /desert|arid|dune/i, color: "#c5a666" },
  { pattern: /scrub|chaparral|shrub/i, color: "#89885e" },
  { pattern: /mountain|highland/i, color: "#85796c" },
];

const TERRAIN_COLOR_HINTS: Record<string, string> = {
  DEEP_OCEAN: "#061944",
  OCEAN: "#0c447f",
  SHALLOW_SEA: "#358dae",
  BEACH: "#d5c18d",
  PLAINS: "#789c58",
  HILLS: "#768b55",
  MOUNTAINS: "#786b60",
  HIGH_MOUNTAINS: "#c4cecf",
  PLATEAU: "#8a765e",
};

const QUALITY_SETTINGS: Record<AtlasTerrainRenderQuality, { samples: number; octaves: number; blend: number }> = {
  off: { samples: 3, octaves: 2, blend: 0.26 },
  balanced: { samples: 6, octaves: 3, blend: 0.36 },
  high: { samples: 8, octaves: 4, blend: 0.43 },
  ultra: { samples: 10, octaves: 5, blend: 0.5 },
};

function getCellKey(column: number, row: number): string {
  return `${column}:${row}`;
}

function getCellAt(snapshot: AtlasSnapshot, cellMap: Map<string, AtlasCell>, column: number, row: number): AtlasCell | null {
  if (row < 0 || row >= snapshot.grid.latitudeDivisions) {
    return null;
  }

  const wrappedColumn = (column + snapshot.grid.longitudeDivisions) % snapshot.grid.longitudeDivisions;
  return cellMap.get(getCellKey(wrappedColumn, row)) ?? null;
}

function getDisplayRow(snapshot: AtlasSnapshot, cell: AtlasCell): number {
  return snapshot.grid.latitudeDivisions - 1 - cell.row;
}

function getSeed(snapshot: AtlasSnapshot): string {
  return snapshot.fingerprint.seed || snapshot.worldId;
}

function getBiomeBaseColor(cell: AtlasCell): string {
  if (cell.isOcean || cell.isSea) {
    return TERRAIN_COLOR_HINTS[cell.terrainType] ?? "#0c447f";
  }

  if (cell.isCoast || cell.waterBodyType === "COASTAL_WATER") {
    return mixColor("#d7c58e", "#73a565", cell.moisturePotential * 0.24);
  }

  const biomeText = `${cell.biomeKey} ${cell.biomeName} ${cell.biomeCategory} ${cell.dominantPlantKey} ${cell.dominantPlantCategory}`;
  const biomeHint = BIOME_COLOR_HINTS.find((hint) => hint.pattern.test(biomeText));

  if (biomeHint) {
    return biomeHint.color;
  }

  return TERRAIN_COLOR_HINTS[cell.terrainType] ?? cell.biomeColor ?? "#728f5c";
}

function cellSlope(snapshot: AtlasSnapshot, cellMap: Map<string, AtlasCell>, cell: AtlasCell): number {
  const west = getCellAt(snapshot, cellMap, cell.column - 1, cell.row)?.elevation ?? cell.elevation;
  const east = getCellAt(snapshot, cellMap, cell.column + 1, cell.row)?.elevation ?? cell.elevation;
  const north = getCellAt(snapshot, cellMap, cell.column, cell.row + 1)?.elevation ?? cell.elevation;
  const south = getCellAt(snapshot, cellMap, cell.column, cell.row - 1)?.elevation ?? cell.elevation;

  return Math.abs(west - east) + Math.abs(north - south);
}

function localLight(snapshot: AtlasSnapshot, cellMap: Map<string, AtlasCell>, cell: AtlasCell): number {
  const west = getCellAt(snapshot, cellMap, cell.column - 1, cell.row)?.elevation ?? cell.elevation;
  const east = getCellAt(snapshot, cellMap, cell.column + 1, cell.row)?.elevation ?? cell.elevation;
  const north = getCellAt(snapshot, cellMap, cell.column, cell.row + 1)?.elevation ?? cell.elevation;
  const south = getCellAt(snapshot, cellMap, cell.column, cell.row - 1)?.elevation ?? cell.elevation;

  return clamp((west - east) * 0.42 + (north - south) * 0.28 + (cell.elevation - 0.5) * 0.08, -0.2, 0.24);
}

function isWater(cell: AtlasCell): boolean {
  return cell.isOcean || cell.isSea || cell.waterBodyType === "COASTAL_WATER";
}

function biomeAffinity(left: AtlasCell, right: AtlasCell): number {
  if (isWater(left) !== isWater(right)) {
    return 0.42;
  }

  if (left.biomeKey && left.biomeKey === right.biomeKey) {
    return 1;
  }

  if (left.biomeCategory && left.biomeCategory === right.biomeCategory) {
    return 0.78;
  }

  const elevationGap = Math.abs(left.elevation - right.elevation);
  const moistureGap = Math.abs(left.moisturePotential - right.moisturePotential);
  const heatGap = Math.abs(left.averageTemperatureC - right.averageTemperatureC) / 50;

  return clamp(0.78 - elevationGap * 0.6 - moistureGap * 0.24 - heatGap * 0.18, 0.24, 0.82);
}

function edgeWeight(direction: NeighborDirection, xRatio: number, yRatio: number): number {
  switch (direction) {
    case "west":
      return smoothstep(0.44, 0, xRatio);
    case "east":
      return smoothstep(0.56, 1, xRatio);
    case "north":
      return smoothstep(0.44, 0, yRatio);
    case "south":
      return smoothstep(0.56, 1, yRatio);
  }
}

function nearestWaterInfluence(snapshot: AtlasSnapshot, cellMap: Map<string, AtlasCell>, cell: AtlasCell, xRatio: number, yRatio: number): number {
  let influence = isWater(cell) || cell.isCoast ? 0.56 : 0;
  const neighbors: Array<[NeighborDirection, AtlasCell | null]> = [
    ["west", getCellAt(snapshot, cellMap, cell.column - 1, cell.row)],
    ["east", getCellAt(snapshot, cellMap, cell.column + 1, cell.row)],
    ["north", getCellAt(snapshot, cellMap, cell.column, cell.row + 1)],
    ["south", getCellAt(snapshot, cellMap, cell.column, cell.row - 1)],
  ];

  for (const [direction, neighbor] of neighbors) {
    if (neighbor && isWater(neighbor)) {
      influence = Math.max(influence, edgeWeight(direction, xRatio, yRatio));
    }
  }

  return clamp(influence, 0, 1);
}

function nearestLandInfluence(snapshot: AtlasSnapshot, cellMap: Map<string, AtlasCell>, cell: AtlasCell, xRatio: number, yRatio: number): number {
  let influence = !isWater(cell) ? 0.48 : 0;
  const neighbors: Array<[NeighborDirection, AtlasCell | null]> = [
    ["west", getCellAt(snapshot, cellMap, cell.column - 1, cell.row)],
    ["east", getCellAt(snapshot, cellMap, cell.column + 1, cell.row)],
    ["north", getCellAt(snapshot, cellMap, cell.column, cell.row + 1)],
    ["south", getCellAt(snapshot, cellMap, cell.column, cell.row - 1)],
  ];

  for (const [direction, neighbor] of neighbors) {
    if (neighbor && !isWater(neighbor)) {
      influence = Math.max(influence, edgeWeight(direction, xRatio, yRatio));
    }
  }

  return clamp(influence, 0, 1);
}

function renderLandFamilyColor(
  snapshot: AtlasSnapshot,
  cellMap: Map<string, AtlasCell>,
  cell: AtlasCell,
  baseColor: string,
  worldX: number,
  worldY: number,
  seed: string,
  octaves: number,
): string {
  const moisture = clamp((cell.relativeHumidity + cell.moisturePotential + cell.waterAvailabilityScore) / 3, 0, 1);
  const heat = clamp((cell.averageTemperatureC + 30) / 70, 0, 1);
  const vegetation = clamp((cell.vegetationDensity + cell.plantDensity + cell.biomassScore) / 3, 0, 1);
  const canopy = fbmNoise(seed, worldX * 4.2, worldY * 4.2, "canopy-clusters", octaves);
  const grass = fbmNoise(seed, worldX * 5.3, worldY * 4.7, "grass-patches", octaves);
  const dryStreak = ridgeNoise(seed, worldX * 3.7 + cell.windStrength, worldY * 1.4, "dune-streak", octaves);
  const frost = ridgeNoise(seed, worldX * 4.8, worldY * 4.8, "frost-cracks", Math.max(2, octaves - 1));
  const marsh = fbmNoise(seed, worldX * 6.4, worldY * 5.1, "marsh-texture", octaves);
  const rock = ridgeNoise(seed, worldX * 5.6, worldY * 5.9, "exposed-rock", octaves);
  let color = baseColor;

  const forestSignal = clamp(vegetation * moisture + canopy * 0.22, 0, 1);
  const desertSignal = clamp(cell.drynessIndex * 0.72 + (1 - moisture) * 0.35 + heat * 0.12, 0, 1);
  const tundraSignal = clamp((1 - heat) * 0.62 + cell.snowPotential * 0.24 - vegetation * 0.12, 0, 1);
  const wetlandSignal = clamp(cell.moisturePotential * 0.5 + cell.relativeHumidity * 0.34 + cell.waterAvailabilityScore * 0.3 - cell.ruggedness * 0.24, 0, 1);

  color = mixColor(color, "#17492f", clamp(forestSignal * canopy * 0.38, 0, 0.44));
  color = mixColor(color, "#a9bf67", clamp((1 - forestSignal) * grass * vegetation * 0.22, 0, 0.28));
  color = mixColor(color, "#caa76b", clamp(desertSignal * (0.34 + dryStreak * 0.22), 0, 0.48));
  color = mixColor(color, "#445f54", clamp(wetlandSignal * marsh * 0.34, 0, 0.38));
  color = mixColor(color, "#cfd8d6", clamp(tundraSignal * frost * 0.24, 0, 0.34));
  color = mixColor(color, "#726a61", clamp((cell.ruggedness + rock) * 0.16, 0, 0.24));

  const slope = cellSlope(snapshot, cellMap, cell);
  color = shadeColor(color, localLight(snapshot, cellMap, cell) + (grass - 0.5) * 0.05 + slope * cell.ruggedness * 0.035);

  return color;
}

function sampleOwnCell(input: TerrainSampleInput): string {
  const { snapshot, cellMap, cell, xRatio, yRatio, quality } = input;
  const seed = getSeed(snapshot);
  const settings = QUALITY_SETTINGS[quality];
  const worldX = cell.column + xRatio;
  const worldY = cell.row + yRatio;
  const baseColor = getBiomeBaseColor(cell);
  const slope = cellSlope(snapshot, cellMap, cell);
  const light = localLight(snapshot, cellMap, cell);

  if (isWater(cell)) {
    return renderOceanSample({
      snapshot,
      cell,
      seed,
      worldX,
      worldY,
      xRatio,
      yRatio,
      qualityOctaves: settings.octaves,
    });
  }

  let color = renderLandFamilyColor(snapshot, cellMap, cell, baseColor, worldX, worldY, seed, settings.octaves);

  if (cell.terrainType === "MOUNTAINS" || cell.terrainType === "HIGH_MOUNTAINS" || cell.terrainType === "PLATEAU" || cell.ruggedness > 0.52 || cell.elevation > 0.68) {
    color = renderMountainSample({
      snapshot,
      cell,
      seed,
      baseColor: color,
      worldX,
      worldY,
      slope,
      light,
      qualityOctaves: settings.octaves,
    });
  }

  return color;
}

export function sampleProceduralTerrainColor(input: TerrainSampleInput): string {
  const { snapshot, cellMap, cell, xRatio, yRatio, quality } = input;
  const seed = getSeed(snapshot);
  const settings = QUALITY_SETTINGS[quality];
  let color = sampleOwnCell(input);
  const directions: Array<[NeighborDirection, AtlasCell | null]> = [
    ["west", getCellAt(snapshot, cellMap, cell.column - 1, cell.row)],
    ["east", getCellAt(snapshot, cellMap, cell.column + 1, cell.row)],
    ["north", getCellAt(snapshot, cellMap, cell.column, cell.row + 1)],
    ["south", getCellAt(snapshot, cellMap, cell.column, cell.row - 1)],
  ];
  const boundaryNoise = fbmNoise(seed, (cell.column + xRatio) * 2.2, (cell.row + yRatio) * 2.2, "biome-edge-warp", settings.octaves);

  for (const [direction, neighbor] of directions) {
    if (!neighbor) {
      continue;
    }

    const edge = clamp(edgeWeight(direction, xRatio, yRatio) + (boundaryNoise - 0.5) * 0.22, 0, 1);

    if (edge <= 0.02) {
      continue;
    }

    const neighborColor = sampleOwnCell({
      snapshot,
      cellMap,
      cell: neighbor,
      xRatio,
      yRatio,
      quality,
    });
    color = mixColor(color, neighborColor, edge * settings.blend * biomeAffinity(cell, neighbor));
  }

  const waterInfluence = nearestWaterInfluence(snapshot, cellMap, cell, xRatio, yRatio);
  const landInfluence = nearestLandInfluence(snapshot, cellMap, cell, xRatio, yRatio);

  if (waterInfluence > 0.05 || landInfluence > 0.05 || cell.isCoast) {
    color = renderCoastSample({
      snapshot,
      cell,
      seed,
      baseColor: color,
      worldX: cell.column + xRatio,
      worldY: cell.row + yRatio,
      xRatio,
      yRatio,
      nearestWaterInfluence: waterInfluence,
      nearestLandInfluence: landInfluence,
      qualityOctaves: settings.octaves,
    });
  }

  const latitudeFade = smoothstep(1, 0.15, Math.cos((cell.midpointLatitude * Math.PI) / 180));
  const polarTexture = hashNoise(seed, cell.column + xRatio * 4, cell.row + yRatio * 4, "polar-grain") - 0.5;

  return shadeColor(color, polarTexture * latitudeFade * 0.035);
}

export function createAtlasCellMap(snapshot: AtlasSnapshot): Map<string, AtlasCell> {
  return new Map(snapshot.cells.map((cell) => [getCellKey(cell.column, cell.row), cell]));
}

export function renderProceduralTerrainAtlas(
  context: CanvasRenderingContext2D,
  snapshot: AtlasSnapshot,
  options: ProceduralTerrainRenderOptions,
) {
  const settings = QUALITY_SETTINGS[options.quality];
  const samplesPerCell = options.visualMode === "scientificOverlay" ? 2 : settings.samples;
  const sampleSize = options.cellSize / samplesPerCell;
  const cellMap = createAtlasCellMap(snapshot);

  for (const cell of snapshot.cells) {
    const x = cell.column * options.cellSize;
    const y = getDisplayRow(snapshot, cell) * options.cellSize;

    for (let subY = 0; subY < samplesPerCell; subY += 1) {
      for (let subX = 0; subX < samplesPerCell; subX += 1) {
        const xRatio = (subX + 0.5) / samplesPerCell;
        const yRatio = (subY + 0.5) / samplesPerCell;
        let color = options.visualMode === "scientificOverlay"
          ? mixColor(options.getLayerColor(cell), "#071017", 0.06)
          : sampleProceduralTerrainColor({
            snapshot,
            cellMap,
            cell,
            xRatio,
            yRatio,
            quality: options.quality,
          });

        if (options.visualMode === "hybrid" && options.selectedLayerId !== "planet") {
          color = mixColor(color, options.getLayerColor(cell), 0.24);
        }

        context.fillStyle = color;
        context.fillRect(x + subX * sampleSize, y + subY * sampleSize, sampleSize + 0.35, sampleSize + 0.35);
      }
    }
  }
}
