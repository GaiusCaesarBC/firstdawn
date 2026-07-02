"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { AtlasCell, AtlasSnapshot } from "../../../lib/worlds/map-atlas";

export type PlanetGlobeLayerId =
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

export type PlanetGlobeLayerSetting = {
  visible: boolean;
  opacity: number;
};

type PlanetGlobeEvent = {
  id: string;
  tick: string;
  category: string;
  title: string;
  summary: string;
  cellId: string | null;
  humanId: string | null;
  settlementId: string | null;
};

type CameraState = {
  yaw: number;
  targetYaw: number;
  pitch: number;
  targetPitch: number;
  zoom: number;
  targetZoom: number;
  velocity: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastAt: number;
  moved: boolean;
};

type TextureDebugMode = "final" | "mask" | "smoothed";

type WeightedCellSample = {
  cell: AtlasCell;
  weight: number;
};

type SurfaceMaskSample = {
  landMask: number;
  oceanMask: number;
  coastMask: number;
};

type PlanetGlobeRendererProps = {
  snapshot: AtlasSnapshot;
  selectedCellId: string | null;
  selectedHumanId: string | null;
  layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>;
  events: PlanetGlobeEvent[];
  chronicleMode: boolean;
  onCellFocus: (cell: AtlasCell) => void;
  onZoomChange: (zoom: number) => void;
};

const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 512;
const MIN_ZOOM = 0.86;
const MAX_ZOOM = 2.75;
const GRID_EMERGE_ZOOM = 1.62;

const TERRAIN_COLORS: Record<string, string> = {
  DEEP_OCEAN: "#08245a",
  OCEAN: "#0f4f9d",
  SHALLOW_SEA: "#38a5d4",
  BEACH: "#dbc488",
  PLAINS: "#668f4e",
  HILLS: "#738552",
  MOUNTAINS: "#806f5d",
  HIGH_MOUNTAINS: "#b6bdc6",
  PLATEAU: "#8d7659",
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeLongitude(value: number): number {
  let next = value;

  while (next < -180) next += 360;
  while (next > 180) next -= 360;
  return next;
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function noise2d(x: number, y: number): number {
  const raw = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return raw - Math.floor(raw);
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;

  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

function canBlendHexColor(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color) || /^#[0-9a-f]{3}$/i.test(color);
}

function mixRgb(left: [number, number, number], right: [number, number, number], weight: number): [number, number, number] {
  const amount = clamp(weight, 0, 1);
  return [
    left[0] + (right[0] - left[0]) * amount,
    left[1] + (right[1] - left[1]) * amount,
    left[2] + (right[2] - left[2]) * amount,
  ];
}

function adjustRgb(color: [number, number, number], amount: number): [number, number, number] {
  return [
    clamp(color[0] + amount, 0, 255),
    clamp(color[1] + amount, 0, 255),
    clamp(color[2] + amount, 0, 255),
  ];
}

function isWaterCell(cell: AtlasCell): boolean {
  return cell.isOcean || cell.isSea || ["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"].includes(cell.terrainType) || cell.waterBodyType !== "DRY_LAND";
}

function getDisplayRow(snapshot: AtlasSnapshot, cell: AtlasCell): number {
  return snapshot.grid.latitudeDivisions - 1 - cell.row;
}

function buildCellGrid(snapshot: AtlasSnapshot): Map<string, AtlasCell> {
  return new Map(snapshot.cells.map((cell) => [`${getDisplayRow(snapshot, cell)}:${cell.column}`, cell]));
}

function layerVisible(layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>, layer: PlanetGlobeLayerId): boolean {
  return layers[layer]?.visible ?? false;
}

function layerOpacity(layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>, layer: PlanetGlobeLayerId): number {
  return clamp(layers[layer]?.opacity ?? 0, 0, 1);
}

function baseCellColor(cell: AtlasCell, layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>): [number, number, number] {
  const water = isWaterCell(cell);
  const terrainColor = hexToRgb(TERRAIN_COLORS[cell.terrainType] ?? (water ? "#145aa4" : "#66744f"));

  if (water) {
    const depth = cell.terrainType === "DEEP_OCEAN" ? 1 : cell.terrainType === "SHALLOW_SEA" || cell.isCoast ? 0.16 : 0.58;
    const depthColor = mixRgb(hexToRgb("#39b6df"), hexToRgb("#061b45"), depth);
    return layerVisible(layers, "ocean") ? mixRgb(terrainColor, depthColor, 0.72 * layerOpacity(layers, "ocean")) : mixRgb(terrainColor, hexToRgb("#17202a"), 0.6);
  }

  let color = terrainColor;

  if (layerVisible(layers, "biomes") && canBlendHexColor(cell.biomeColor)) {
    color = mixRgb(color, hexToRgb(cell.biomeColor), 0.34 * layerOpacity(layers, "biomes"));
  }

  if (layerVisible(layers, "vegetation") && canBlendHexColor(cell.dominantPlantColor)) {
    color = mixRgb(color, hexToRgb(cell.dominantPlantColor), clamp(cell.biomassScore * 0.22 + cell.plantDensity * 0.22, 0, 0.32) * layerOpacity(layers, "vegetation"));
  }

  if (layerVisible(layers, "snow") && (cell.snowPotential > 0.14 || cell.averageTemperatureC < -5)) {
    color = mixRgb(color, hexToRgb("#eef6fb"), clamp(cell.snowPotential * 0.32 + (-cell.averageTemperatureC - 2) / 72, 0, 0.48) * layerOpacity(layers, "snow"));
  }

  return color;
}

function getTextureDebugMode(): TextureDebugMode {
  if (typeof window === "undefined") {
    return "final";
  }

  const queryMode = new URLSearchParams(window.location.search).get("atlasTextureDebug");
  const storedMode = window.localStorage.getItem("atlasTextureDebug");
  const mode = queryMode ?? storedMode;

  return mode === "mask" || mode === "smoothed" || mode === "final" ? mode : "final";
}

function sampleSurfaceMasks(samples: readonly WeightedCellSample[], center: AtlasCell): SurfaceMaskSample {
  let landMask = 0;
  let oceanMask = 0;
  let coastSignal = center.isCoast ? 0.42 : 0;

  for (const sample of samples) {
    if (isWaterCell(sample.cell)) {
      oceanMask += sample.weight;
    } else {
      landMask += sample.weight;
    }

    if (sample.cell.isCoast) {
      coastSignal += sample.weight * 0.58;
    }
  }

  const edgeMix = Math.min(landMask, oceanMask) * 2;

  return {
    landMask: clamp(landMask, 0, 1),
    oceanMask: clamp(oceanMask, 0, 1),
    coastMask: clamp(coastSignal + edgeMix, 0, 1),
  };
}

function sameSurfaceColor(
  samples: readonly WeightedCellSample[],
  layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>,
  surface: "land" | "ocean",
  fallback: AtlasCell,
): [number, number, number] {
  let color: [number, number, number] = [0, 0, 0];
  let totalWeight = 0;

  for (const sample of samples) {
    const water = isWaterCell(sample.cell);

    if ((surface === "ocean" && !water) || (surface === "land" && water)) {
      continue;
    }

    const sampleColor = baseCellColor(sample.cell, layers);
    color = [
      color[0] + sampleColor[0] * sample.weight,
      color[1] + sampleColor[1] * sample.weight,
      color[2] + sampleColor[2] * sample.weight,
    ];
    totalWeight += sample.weight;
  }

  return totalWeight > 0
    ? [color[0] / totalWeight, color[1] / totalWeight, color[2] / totalWeight]
    : baseCellColor(fallback, layers);
}

function compositeCoastline(
  baseColor: [number, number, number],
  center: AtlasCell,
  masks: SurfaceMaskSample,
): [number, number, number] {
  const coastStrength = clamp(masks.coastMask, 0, 1);

  if (isWaterCell(center)) {
    const shallowWater = mixRgb(hexToRgb("#46b8d8"), hexToRgb("#0f4f9d"), center.terrainType === "DEEP_OCEAN" ? 0.72 : 0.28);
    return mixRgb(baseColor, shallowWater, coastStrength * 0.34);
  }

  const shoreTint = center.terrainType === "BEACH" ? hexToRgb("#e4cf95") : hexToRgb("#c7b176");
  return mixRgb(baseColor, shoreTint, coastStrength * 0.22);
}

function debugMaskColor(masks: SurfaceMaskSample, center: AtlasCell): [number, number, number] {
  if (center.isCoast || masks.coastMask > 0.4) {
    return [246, 211, 104];
  }

  return masks.landMask >= masks.oceanMask ? [92, 170, 86] : [36, 105, 190];
}

function generateSurfaceTexture(
  snapshot: AtlasSnapshot,
  layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>,
  debugMode: TextureDebugMode,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    return canvas;
  }

  if (typeof context.createImageData !== "function" || typeof context.putImageData !== "function") {
    context.fillStyle = "#0f4f9d";
    context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    return canvas;
  }

  const image = context.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const grid = buildCellGrid(snapshot);
  const rows = snapshot.grid.latitudeDivisions;
  const columns = snapshot.grid.longitudeDivisions;
  const getCell = (row: number, column: number) => grid.get(`${clamp(row, 0, rows - 1)}:${((column % columns) + columns) % columns}`) ?? snapshot.cells[0];

  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    const v = y / TEXTURE_HEIGHT;
    const rowFloat = v * rows - 0.5;
    const row = Math.floor(rowFloat);
    const rowMix = rowFloat - row;

    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const u = x / TEXTURE_WIDTH;
      const columnFloat = u * columns - 0.5;
      const column = Math.floor(columnFloat);
      const columnMix = columnFloat - column;
      const center = getCell(Math.floor(v * rows), Math.floor(u * columns));
      const water = isWaterCell(center);
      const samples: WeightedCellSample[] = [
        { cell: getCell(row, column), weight: (1 - columnMix) * (1 - rowMix) },
        { cell: getCell(row, column + 1), weight: columnMix * (1 - rowMix) },
        { cell: getCell(row + 1, column), weight: (1 - columnMix) * rowMix },
        { cell: getCell(row + 1, column + 1), weight: columnMix * rowMix },
      ];
      const masks = sampleSurfaceMasks(samples, center);
      const surface = water ? "ocean" : "land";
      const smoothedColor = sameSurfaceColor(samples, layers, surface, center);
      const color = debugMode === "mask"
        ? debugMaskColor(masks, center)
        : debugMode === "smoothed"
          ? smoothedColor
          : compositeCoastline(smoothedColor, center, masks);

      const relief = layerVisible(layers, "lighting")
        ? (center.ruggedness * 18 + center.elevation * 16 - center.distanceToOcean * 0.035) * layerOpacity(layers, "lighting")
        : 0;
      const grain = (noise2d(x * 0.021 + hashString(center.id) * 0.001, y * 0.019) - 0.5) * (water ? 10 : 18);
      const coastalLift = masks.coastMask > 0 ? (noise2d(x * 0.07, y * 0.04) - 0.4) * 18 * masks.coastMask : 0;
      const final = debugMode === "mask" ? color : adjustRgb(color, relief + grain + coastalLift);
      const offset = (y * TEXTURE_WIDTH + x) * 4;

      image.data[offset] = final[0];
      image.data[offset + 1] = final[1];
      image.data[offset + 2] = final[2];
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}
function generateCloudTexture(snapshot: AtlasSnapshot, layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context || !layerVisible(layers, "clouds")) {
    return canvas;
  }

  if (typeof context.createImageData !== "function" || typeof context.putImageData !== "function") {
    return canvas;
  }

  const image = context.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const grid = buildCellGrid(snapshot);
  const rows = snapshot.grid.latitudeDivisions;
  const columns = snapshot.grid.longitudeDivisions;
  const getCell = (row: number, column: number) => grid.get(`${clamp(row, 0, rows - 1)}:${((column % columns) + columns) % columns}`) ?? snapshot.cells[0];

  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const cell = getCell(Math.floor((y / TEXTURE_HEIGHT) * rows), Math.floor((x / TEXTURE_WIDTH) * columns));
      const weather = clamp(cell.cloudCover * 0.72 + cell.relativeHumidity * 0.15 + cell.stormPotential * 0.36, 0, 1);
      const bandNoise = noise2d(x * 0.018 + Math.sin(y * 0.017) * 4, y * 0.034);
      const alpha = weather > 0.18 && bandNoise < weather * 0.74
        ? clamp((weather - 0.14) * 118 * layerOpacity(layers, "clouds"), 0, 42)
        : 0;
      const offset = (y * TEXTURE_WIDTH + x) * 4;

      image.data[offset] = cell.stormPotential > 0.58 ? 205 : 245;
      image.data[offset + 1] = cell.stormPotential > 0.58 ? 216 : 249;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = alpha;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

function textureKey(snapshot: AtlasSnapshot, layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>, debugMode: TextureDebugMode): string {
  const layerKey = (["terrain", "ocean", "lighting", "biomes", "vegetation", "snow", "clouds"] as PlanetGlobeLayerId[])
    .map((layer) => `${layer}:${layers[layer]?.visible ? 1 : 0}:${Math.round((layers[layer]?.opacity ?? 0) * 100)}`)
    .join("|");
  return `${snapshot.worldId}:${snapshot.selectedDay}:${snapshot.fingerprint.shortHash}:${snapshot.cells.length}:${debugMode}:${layerKey}`;
}

function makeShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);

  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function makeProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const vertex = makeShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = makeShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertex || !fragment) {
    return null;
  }

  const program = gl.createProgram();

  if (!program) {
    return null;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function buildSphereGeometry(latitudeSegments = 56, longitudeSegments = 112) {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= latitudeSegments; row += 1) {
    const v = row / latitudeSegments;
    const latitude = Math.PI / 2 - v * Math.PI;
    const cosLatitude = Math.cos(latitude);

    for (let column = 0; column <= longitudeSegments; column += 1) {
      const u = column / longitudeSegments;
      const longitude = -Math.PI + u * Math.PI * 2;
      vertices.push(cosLatitude * Math.sin(longitude), Math.sin(latitude), cosLatitude * Math.cos(longitude));
      uvs.push(u, v);
    }
  }

  for (let row = 0; row < latitudeSegments; row += 1) {
    for (let column = 0; column < longitudeSegments; column += 1) {
      const a = row * (longitudeSegments + 1) + column;
      const b = a + longitudeSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function rotationMatrix(yaw: number, pitch: number, scale = 1): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  return new Float32Array([
    cy * scale, sy * sp * scale, sy * cp * scale, 0,
    0, cp * scale, -sp * scale, 0,
    -sy * scale, cy * sp * scale, cy * cp * scale, 0,
    0, 0, 0, 1,
  ]);
}

function createWebGlTexture(gl: WebGLRenderingContext, source: HTMLCanvasElement): WebGLTexture | null {
  const texture = gl.createTexture();

  if (!texture) {
    return null;
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return texture;
}

function getEventColor(category: string): string {
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

function getEventGlyph(category: string): string {
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

function latLonToVector(latitudeDegrees: number, longitudeDegrees: number): [number, number, number] {
  const latitude = latitudeDegrees * Math.PI / 180;
  const longitude = longitudeDegrees * Math.PI / 180;
  const cosLatitude = Math.cos(latitude);
  return [cosLatitude * Math.sin(longitude), Math.sin(latitude), cosLatitude * Math.cos(longitude)];
}

function rotateVector(vector: [number, number, number], yaw: number, pitch: number): [number, number, number] {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const yawedX = vector[0] * cy + vector[2] * sy;
  const yawedZ = -vector[0] * sy + vector[2] * cy;
  return [yawedX, vector[1] * cp - yawedZ * sp, vector[1] * sp + yawedZ * cp];
}

function unrotateVector(vector: [number, number, number], yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(-pitch);
  const sp = Math.sin(-pitch);
  const pitchedY = vector[1] * cp - vector[2] * sp;
  const pitchedZ = vector[1] * sp + vector[2] * cp;
  const cy = Math.cos(-yaw);
  const sy = Math.sin(-yaw);
  return [vector[0] * cy + pitchedZ * sy, pitchedY, -vector[0] * sy + pitchedZ * cy];
}

function projectCell(
  cell: AtlasCell,
  camera: CameraState,
  width: number,
  height: number,
  shellScale = 1,
): { x: number; y: number; z: number } {
  const vector = rotateVector(latLonToVector(cell.midpointLatitude, cell.midpointLongitude), camera.yaw, camera.pitch);
  const radius = Math.min(width, height) * 0.43 * clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  return {
    x: width / 2 + vector[0] * radius * shellScale,
    y: height / 2 - vector[1] * radius * shellScale,
    z: vector[2],
  };
}

function findCellByLatLon(snapshot: AtlasSnapshot, latitude: number, longitude: number): AtlasCell | null {
  const row = clamp(Math.floor((90 - latitude) / snapshot.grid.cellHeightDegrees), 0, snapshot.grid.latitudeDivisions - 1);
  const column = clamp(Math.floor((longitude + 180) / snapshot.grid.cellWidthDegrees), 0, snapshot.grid.longitudeDivisions - 1);
  const grid = buildCellGrid(snapshot);
  return grid.get(`${row}:${column}`) ?? null;
}

function getMissionEventCell(snapshot: AtlasSnapshot, event: PlanetGlobeEvent): AtlasCell | null {
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

function drawFallbackPlanet(
  canvas: HTMLCanvasElement,
  texture: HTMLCanvasElement,
  cloudTexture: HTMLCanvasElement,
  snapshot: AtlasSnapshot,
  layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>,
  camera: CameraState,
): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(640, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(420, Math.floor(canvas.clientHeight * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(2,6,12,0.96)";
  context.fillRect(0, 0, width, height);

  if (typeof context.arc !== "function") {
    return;
  }

  const radius = Math.min(width, height) * 0.43 * clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  context.save();
  context.beginPath();
  context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  context.clip();

  if (typeof context.drawImage !== "function") {
    context.fillStyle = "#0f4f9d";
    context.beginPath();
    context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    context.fill();
    return;
  }

  const sourceX = (((-camera.yaw / (Math.PI * 2)) % 1 + 1) % 1) * texture.width;
  context.drawImage(texture, sourceX, 0, texture.width - sourceX, texture.height, width / 2 - radius, height / 2 - radius, radius * 2 * (1 - sourceX / texture.width), radius * 2);
  context.drawImage(texture, 0, 0, sourceX, texture.height, width / 2 - radius + radius * 2 * (1 - sourceX / texture.width), height / 2 - radius, radius * 2 * sourceX / texture.width, radius * 2);

  if (layerVisible(layers, "clouds")) {
    context.globalAlpha = layerOpacity(layers, "clouds");
    context.drawImage(cloudTexture, width / 2 - radius, height / 2 - radius, radius * 2, radius * 2);
    context.globalAlpha = 1;
  }

  const night = context.createRadialGradient(width / 2 - radius * 0.34, height / 2 - radius * 0.28, radius * 0.08, width / 2 + radius * 0.35, height / 2 + radius * 0.24, radius * 1.55);
  night.addColorStop(0, "rgba(255,255,255,0.05)");
  night.addColorStop(0.55, "rgba(0,0,0,0.08)");
  night.addColorStop(1, "rgba(0,3,12,0.62)");
  context.fillStyle = night;
  context.fillRect(width / 2 - radius, height / 2 - radius, radius * 2, radius * 2);
  context.restore();

  if (layerVisible(layers, "atmosphere")) {
    const atmosphere = context.createRadialGradient(width / 2, height / 2, radius * 0.86, width / 2, height / 2, radius * 1.18);
    atmosphere.addColorStop(0, "rgba(125,211,252,0)");
    atmosphere.addColorStop(0.78, "rgba(125,211,252,0.08)");
    atmosphere.addColorStop(0.96, "rgba(56,189,248,0.22)");
    atmosphere.addColorStop(1, "rgba(125,211,252,0)");
    context.globalAlpha = 0.46 * layerOpacity(layers, "atmosphere");
    context.fillStyle = atmosphere;
    context.beginPath();
    context.arc(width / 2, height / 2, radius * 1.18, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  context.stroke();

  void snapshot;
}

function drawOverlayCanvas({
  canvas,
  snapshot,
  layers,
  events,
  selectedCellId,
  selectedHumanId,
  camera,
  pulse,
}: {
  canvas: HTMLCanvasElement;
  snapshot: AtlasSnapshot;
  layers: Record<PlanetGlobeLayerId, PlanetGlobeLayerSetting>;
  events: PlanetGlobeEvent[];
  selectedCellId: string | null;
  selectedHumanId: string | null;
  camera: CameraState;
  pulse: number;
}) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(640, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(420, Math.floor(canvas.clientHeight * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.clearRect(0, 0, width, height);

  if (typeof context.arc !== "function") {
    return;
  }

  const cellById = new Map(snapshot.cells.map((cell) => [cell.id, cell]));
  const markerScale = Math.max(0.72, Math.min(width, height) / 900);
  const drawPoint = (point: { x: number; y: number; z: number }, radius: number, color: string, alpha = 1) => {
    if (point.z <= 0 || typeof context.arc !== "function") {
      return;
    }

    context.globalAlpha = alpha * clamp(point.z, 0, 1);
    context.fillStyle = color;
    context.beginPath();
    context.arc(point.x, point.y, radius * markerScale, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  };

  if (layerVisible(layers, "weather")) {
    for (const cell of snapshot.cells) {
      if (cell.stormPotential < 0.62) continue;
      const point = projectCell(cell, camera, width, height, 1.035);
      drawPoint(point, 8 + cell.stormPotential * 14, "rgba(147,197,253,0.74)", clamp(cell.stormPotential * 0.18, 0.04, 0.2) * layerOpacity(layers, "weather"));
    }
  }

  if (layerVisible(layers, "resources")) {
    for (const cell of snapshot.cells) {
      if (cell.resourceRichness < 0.48) continue;
      const point = projectCell(cell, camera, width, height, 1.038);
      drawPoint(point, 4 + cell.resourceRichness * 11, cell.metalRichness > 0.55 ? "rgba(251,191,36,0.78)" : "rgba(74,222,128,0.62)", 0.2 * layerOpacity(layers, "resources"));
    }
  }

  if (layerVisible(layers, "animals")) {
    for (const cell of snapshot.cells) {
      if (cell.totalWildlifePopulation <= 0) continue;
      const point = projectCell(cell, camera, width, height, 1.047);
      drawPoint(point, 2.5 + clamp(cell.totalWildlifePopulation / 90, 0.1, 1) * 5, "rgba(134,239,172,0.88)", 0.62 * layerOpacity(layers, "animals"));
    }
  }

  if (layerVisible(layers, "settlements")) {
    for (const settlement of snapshot.settlements.settlements) {
      const cell = cellById.get(settlement.homeCellId);
      if (!cell) continue;
      const point = projectCell(cell, camera, width, height, 1.052);
      if (point.z <= 0) continue;
      const intensity = clamp(0.3 + settlement.population / 32 + settlement.importance * 0.45, 0.3, 1.4);
      drawPoint(point, 13 + intensity * 8, "rgba(251,191,36,0.86)", 0.14 * layerOpacity(layers, "settlements"));
      drawPoint(point, 4.2 + intensity * 2.2, "rgba(251,191,36,0.98)", 0.95 * layerOpacity(layers, "settlements"));
    }
  }

  if (layerVisible(layers, "humans")) {
    for (const human of snapshot.humans.agents) {
      const visiblePath = human.recentPath
        .map((cellId) => cellById.get(cellId))
        .filter((cell): cell is AtlasCell => Boolean(cell))
        .map((cell) => projectCell(cell, camera, width, height, 1.058))
        .filter((point) => point.z > 0);

      if (layerVisible(layers, "movement") && visiblePath.length > 1) {
        context.globalAlpha = 0.48 * layerOpacity(layers, "movement");
        context.strokeStyle = human.id === selectedHumanId ? "rgba(103,232,249,0.76)" : "rgba(253,224,71,0.34)";
        context.lineWidth = human.id === selectedHumanId ? 2 : 1;
        context.beginPath();
        visiblePath.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
        context.globalAlpha = 1;
      }

      const cell = cellById.get(human.currentCellId);
      if (!cell) continue;
      const point = projectCell(cell, camera, width, height, 1.064);
      if (point.z <= 0) continue;
      const active = human.id === selectedHumanId;
      const markerPulse = 1 + Math.sin(pulse * 3.2 + hashString(human.id) * 0.01) * 0.18;
      drawPoint(point, (active ? 12 : 8) * markerPulse, active ? "rgba(103,232,249,0.95)" : "rgba(253,224,71,0.9)", (active ? 0.24 : 0.15) * layerOpacity(layers, "humans"));
      drawPoint(point, active ? 5.2 : 3.5, active ? "rgba(103,232,249,1)" : "rgba(253,224,71,0.96)", layerOpacity(layers, "humans"));

      if (active) {
        context.strokeStyle = "rgba(103,232,249,0.92)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(point.x, point.y, (14 + Math.sin(pulse * 2.4) * 2) * markerScale, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }

  if (selectedCellId) {
    const selected = cellById.get(selectedCellId);
    if (selected) {
      const point = projectCell(selected, camera, width, height, 1.068);
      if (point.z > 0) {
        context.strokeStyle = "rgba(255,208,113,0.96)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(point.x, point.y, 10 * markerScale, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }

  for (const event of events.slice(0, 18)) {
    const cell = getMissionEventCell(snapshot, event);
    if (!cell) continue;
    const point = projectCell(cell, camera, width, height, 1.075);
    if (point.z <= 0) continue;
    const eventPulse = 1 + Math.sin(pulse * 2 + hashString(event.id) * 0.01) * 0.18;
    const color = getEventColor(event.category);
    drawPoint(point, 13 * eventPulse, color, 0.2);
    drawPoint(point, 6.4, color, 1);
    context.fillStyle = "rgba(3,7,12,0.95)";
    context.font = `${Math.max(8, 9 * markerScale)}px sans-serif`;
    context.fillText(getEventGlyph(event.category), point.x - 3 * markerScale, point.y + 3 * markerScale);
  }

  if (layerVisible(layers, "debug") && camera.zoom > GRID_EMERGE_ZOOM) {
    const reveal = clamp((camera.zoom - GRID_EMERGE_ZOOM) / (MAX_ZOOM - GRID_EMERGE_ZOOM), 0, 1);
    context.globalAlpha = reveal * 0.38 * layerOpacity(layers, "debug");
    context.strokeStyle = "rgba(255,255,255,0.24)";
    context.lineWidth = 1;

    for (let latitude = -60; latitude <= 60; latitude += 30) {
      context.beginPath();
      let drawing = false;
      for (let longitude = -180; longitude <= 180; longitude += 4) {
        const vector = rotateVector(latLonToVector(latitude, longitude), camera.yaw, camera.pitch);
        if (vector[2] <= 0) {
          drawing = false;
          continue;
        }
        const radius = Math.min(width, height) * 0.43 * camera.zoom;
        const x = width / 2 + vector[0] * radius;
        const y = height / 2 - vector[1] * radius;
        if (!drawing) {
          context.moveTo(x, y);
          drawing = true;
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
    }

    context.globalAlpha = 1;
  }
}

export function PlanetGlobeRenderer(props: PlanetGlobeRendererProps) {
  if (process.env.NODE_ENV === "test") {
    return (
      <div data-testid="planet-globe-renderer" className="absolute inset-0 bg-[#02060c]">
        <canvas aria-label="Rendered 3D planet" className="absolute inset-0 h-full w-full" />
      </div>
    );
  }

  return <PlanetGlobeRendererRuntime {...props} />;
}

function PlanetGlobeRendererRuntime({
  snapshot,
  selectedCellId,
  selectedHumanId,
  layers,
  events,
  chronicleMode,
  onCellFocus,
  onZoomChange,
}: PlanetGlobeRendererProps) {
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<CameraState>({
    yaw: snapshot.selectedDay / Math.max(1, snapshot.yearLengthDays) * Math.PI * 2,
    targetYaw: snapshot.selectedDay / Math.max(1, snapshot.yearLengthDays) * Math.PI * 2,
    pitch: 0,
    targetPitch: 0,
    zoom: 1,
    targetZoom: 1,
    velocity: 0.0007,
  });
  const dragRef = useRef<DragState | null>(null);
  const clickSuppressedRef = useRef(false);
  const lastTextureKeyRef = useRef("");
  const textureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cloudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const selectedCell = useMemo(
    () => (selectedCellId ? snapshot.cells.find((cell) => cell.id === selectedCellId) ?? null : null),
    [selectedCellId, snapshot.cells],
  );

  useEffect(() => {
    const debugMode = getTextureDebugMode();
    const key = textureKey(snapshot, layers, debugMode);

    if (lastTextureKeyRef.current !== key || !textureCanvasRef.current || !cloudCanvasRef.current) {
      textureCanvasRef.current = generateSurfaceTexture(snapshot, layers, debugMode);
      cloudCanvasRef.current = generateCloudTexture(snapshot, layers);
      lastTextureKeyRef.current = key;
    }
  }, [layers, snapshot]);

  useEffect(() => {
    if (!selectedCell) {
      return;
    }

    const camera = cameraRef.current;
    camera.targetYaw = -selectedCell.midpointLongitude * Math.PI / 180;
    camera.targetPitch = clamp(selectedCell.midpointLatitude * Math.PI / 180, -1.05, 1.05);
    camera.targetZoom = clamp(Math.max(camera.targetZoom, 1.42), MIN_ZOOM, MAX_ZOOM);
    camera.velocity *= 0.32;
  }, [selectedCell]);

  useEffect(() => {
    const canvas = webglCanvasRef.current;
    const overlay = overlayCanvasRef.current;

    if (!canvas || !overlay || !textureCanvasRef.current || !cloudCanvasRef.current) {
      return;
    }

    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });

    if (!gl || typeof gl.createShader !== "function") {
      setWebglUnavailable(true);
      return;
    }

    setWebglUnavailable(false);

    const vertexSource = `
      attribute vec3 a_position;
      attribute vec2 a_uv;
      uniform mat4 u_rotation;
      uniform float u_zoom;
      uniform float u_aspect;
      varying vec2 v_uv;
      varying vec3 v_normal;

      void main() {
        vec3 rotated = (u_rotation * vec4(a_position, 1.0)).xyz;
        v_normal = normalize(rotated);
        v_uv = a_uv;
        gl_Position = vec4(rotated.x * u_zoom / u_aspect, rotated.y * u_zoom, -rotated.z * 0.5, 1.0);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform int u_mode;
      uniform float u_opacity;
      varying vec2 v_uv;
      varying vec3 v_normal;

      void main() {
        vec4 sampleColor = texture2D(u_texture, v_uv);
        float facing = clamp(v_normal.z, 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.2);

        if (u_mode == 1) {
          gl_FragColor = vec4(sampleColor.rgb, sampleColor.a * u_opacity * facing);
          return;
        }

        if (u_mode == 2) {
          gl_FragColor = vec4(0.35, 0.78, 1.0, fresnel * 0.42 * u_opacity);
          return;
        }

        vec3 light = normalize(vec3(-0.42, 0.28, 0.86));
        float day = clamp(dot(normalize(v_normal), light), 0.0, 1.0);
        vec3 color = sampleColor.rgb * (0.24 + day * 0.88);
        color += vec3(0.10, 0.18, 0.24) * fresnel * 0.22;
        color += vec3(0.84, 0.92, 1.0) * pow(max(dot(normalize(reflect(-light, normalize(v_normal))), vec3(0.0, 0.0, 1.0)), 0.0), 30.0) * 0.10;
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    const program = makeProgram(gl, vertexSource, fragmentSource);

    if (!program) {
      setWebglUnavailable(true);
      return;
    }

    const geometry = buildSphereGeometry();
    const positionBuffer = gl.createBuffer();
    const uvBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const surfaceTexture = createWebGlTexture(gl, textureCanvasRef.current);
    const cloudTexture = createWebGlTexture(gl, cloudCanvasRef.current);

    if (!positionBuffer || !uvBuffer || !indexBuffer || !surfaceTexture || !cloudTexture) {
      setWebglUnavailable(true);
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const uvLocation = gl.getAttribLocation(program, "a_uv");
    const rotationLocation = gl.getUniformLocation(program, "u_rotation");
    const zoomLocation = gl.getUniformLocation(program, "u_zoom");
    const aspectLocation = gl.getUniformLocation(program, "u_aspect");
    const modeLocation = gl.getUniformLocation(program, "u_mode");
    const opacityLocation = gl.getUniformLocation(program, "u_opacity");
    const textureLocation = gl.getUniformLocation(program, "u_texture");
    let animationFrame = 0;
    let cancelled = false;
    let lastTime = 0;
    let lastZoomPublish = cameraRef.current.zoom;

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

    const drawSphere = (mode: number, texture: WebGLTexture, scale: number, opacity: number) => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(uvLocation);
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.uniformMatrix4fv(rotationLocation, false, rotationMatrix(cameraRef.current.yaw + (mode === 1 ? performance.now() * 0.000012 : 0), cameraRef.current.pitch, scale));
      gl.uniform1f(zoomLocation, cameraRef.current.zoom * 0.86);
      gl.uniform1f(aspectLocation, Math.max(0.1, canvas.width / canvas.height));
      gl.uniform1i(modeLocation, mode);
      gl.uniform1f(opacityLocation, opacity);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(textureLocation, 0);
      gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
    };

    const render = (time: number) => {
      const camera = cameraRef.current;
      const delta = lastTime === 0 ? 16 : Math.min(48, Math.max(1, time - lastTime));
      lastTime = time;

      if (!dragRef.current && process.env.NODE_ENV !== "test") {
        camera.targetYaw += camera.velocity * delta;
        camera.velocity *= 0.987;
        if (Math.abs(camera.velocity) < 0.00008) {
          camera.velocity = 0.00008;
        }
      }

      camera.yaw += (camera.targetYaw - camera.yaw) * 0.12;
      camera.pitch += (camera.targetPitch - camera.pitch) * 0.12;
      camera.zoom += (camera.targetZoom - camera.zoom) * 0.14;

      if (Math.abs(camera.zoom - lastZoomPublish) > 0.015) {
        lastZoomPublish = camera.zoom;
        onZoomChange(camera.zoom);
      }

      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(640, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(420, Math.floor(canvas.clientHeight * ratio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.disable(gl.BLEND);
      drawSphere(0, surfaceTexture, 1, 1);

      if (layerVisible(layers, "clouds")) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        drawSphere(1, cloudTexture, 1.018, layerOpacity(layers, "clouds"));
      }

      if (layerVisible(layers, "atmosphere")) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        drawSphere(2, surfaceTexture, 1.055, layerOpacity(layers, "atmosphere"));
      }

      drawOverlayCanvas({
        canvas: overlay,
        snapshot,
        layers,
        events,
        selectedCellId,
        selectedHumanId,
        camera,
        pulse: time * 0.002,
      });

      if (!cancelled && process.env.NODE_ENV !== "test") {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    render(0);

    return () => {
      cancelled = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      gl.deleteTexture(surfaceTexture);
      gl.deleteTexture(cloudTexture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(uvBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
    };
  }, [events, layers, onZoomChange, selectedCellId, selectedHumanId, snapshot]);

  useEffect(() => {
    if (!webglUnavailable || !webglCanvasRef.current || !overlayCanvasRef.current || !textureCanvasRef.current || !cloudCanvasRef.current) {
      return;
    }

    let animationFrame = 0;
    let cancelled = false;
    let lastTime = 0;
    const render = (time: number) => {
      const camera = cameraRef.current;
      const delta = lastTime === 0 ? 16 : Math.min(48, Math.max(1, time - lastTime));
      lastTime = time;

      if (!dragRef.current && process.env.NODE_ENV !== "test") {
        camera.targetYaw += camera.velocity * delta;
        camera.velocity *= 0.987;
      }

      camera.yaw += (camera.targetYaw - camera.yaw) * 0.12;
      camera.pitch += (camera.targetPitch - camera.pitch) * 0.12;
      camera.zoom += (camera.targetZoom - camera.zoom) * 0.14;
      onZoomChange(camera.zoom);
      drawFallbackPlanet(webglCanvasRef.current!, textureCanvasRef.current!, cloudCanvasRef.current!, snapshot, layers, camera);
      drawOverlayCanvas({
        canvas: overlayCanvasRef.current!,
        snapshot,
        layers,
        events,
        selectedCellId,
        selectedHumanId,
        camera,
        pulse: time * 0.002,
      });

      if (!cancelled && process.env.NODE_ENV !== "test") {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    render(0);

    return () => {
      cancelled = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [events, layers, onZoomChange, selectedCellId, selectedHumanId, snapshot, webglUnavailable]);

  const zoomBy = (delta: number) => {
    const camera = cameraRef.current;
    camera.targetZoom = clamp(camera.targetZoom * delta, MIN_ZOOM, MAX_ZOOM);
    onZoomChange(camera.targetZoom);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const now = performance.now();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastAt: now,
      moved: false,
    };
    cameraRef.current.velocity = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId || event.buttons === 0) {
      return;
    }

    const now = performance.now();
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    const elapsed = Math.max(8, now - drag.lastAt);
    const camera = cameraRef.current;
    camera.targetYaw += deltaX * 0.0065;
    camera.targetPitch = clamp(camera.targetPitch + deltaY * 0.0042, -1.12, 1.12);
    camera.yaw = camera.targetYaw;
    camera.pitch = camera.targetPitch;
    camera.velocity = deltaX * 0.0065 / elapsed;
    dragRef.current = {
      ...drag,
      lastX: event.clientX,
      lastY: event.clientY,
      lastAt: now,
      moved: drag.moved || Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 5,
    };
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    clickSuppressedRef.current = Boolean(drag?.moved);
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (clickSuppressedRef.current) {
      clickSuppressedRef.current = false;
      return;
    }

    const canvas = overlayCanvasRef.current;

    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.43 * clamp(cameraRef.current.zoom, MIN_ZOOM, MAX_ZOOM);
    const x = (event.clientX - rect.left - rect.width / 2) / radius;
    const y = -(event.clientY - rect.top - rect.height / 2) / radius;

    if (x * x + y * y > 1) {
      return;
    }

    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    const worldVector = unrotateVector([x, y, z], cameraRef.current.yaw, cameraRef.current.pitch);
    const latitude = Math.asin(clamp(worldVector[1], -1, 1)) * 180 / Math.PI;
    const longitude = normalizeLongitude(Math.atan2(worldVector[0], worldVector[2]) * 180 / Math.PI);
    const cell = findCellByLatLon(snapshot, latitude, longitude);

    if (cell) {
      onCellFocus(cell);
    }
  };

  return (
    <div
      data-testid="planet-globe-renderer"
      className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_45%_48%,rgba(52,115,170,0.18),rgba(2,6,12,0)_44%),linear-gradient(180deg,rgba(2,6,12,0.96),rgba(1,4,9,1))]"
    >
      <canvas
        ref={webglCanvasRef}
        aria-label="Rendered 3D planet"
        className="absolute inset-0 h-full w-full"
      />
      <canvas
        ref={overlayCanvasRef}
        aria-label="Planet navigation and overlays"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { dragRef.current = null; }}
        onWheel={(event) => {
          event.preventDefault();
          zoomBy(event.deltaY < 0 ? 1.16 : 0.88);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          zoomBy(1.42);
          onClick(event);
        }}
        onClick={onClick}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
      />
      {webglUnavailable && !chronicleMode ? (
        <div className="pointer-events-none absolute right-5 top-5 rounded-full border border-amber-300/20 bg-black/35 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-amber-100">
          Canvas fallback
        </div>
      ) : null}
    </div>
  );
}
