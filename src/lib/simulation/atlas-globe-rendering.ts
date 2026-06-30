import type { AtlasCell, AtlasSnapshot } from "../worlds/map-atlas";
import type { AtlasBeautyQuality, AtlasTextureDescriptor } from "./atlas-visual-effects";
import { fbmNoise, ridgeNoise } from "./procedural-noise";

export type AtlasGlobeRenderOptions = {
  width: number;
  height: number;
  rotationLongitudeDegrees: number;
  tiltDegrees: number;
  showClouds: boolean;
  showAtmosphere: boolean;
  showDayNight: boolean;
  quality: AtlasBeautyQuality;
  selectedCellId: string | null;
  hoveredCellId: string | null;
};

export type AtlasGlobePickResult = {
  cellId: string;
  latitude: number;
  longitude: number;
} | null;

type Rgb = [number, number, number];

type GlobeGeometry = {
  centerX: number;
  centerY: number;
  radius: number;
};

const textureDataCache = new WeakMap<HTMLCanvasElement, { key: string; data: ImageData }>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function normalizeLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}


function mixChannel(left: number, right: number, weight: number): number {
  return Math.round(left + (right - left) * clamp(weight, 0, 1));
}

function mixRgb(left: Rgb, right: Rgb, weight: number): Rgb {
  return [
    mixChannel(left[0], right[0], weight),
    mixChannel(left[1], right[1], weight),
    mixChannel(left[2], right[2], weight),
  ];
}

function shadeRgb(color: Rgb, amount: number): Rgb {
  return [
    Math.round(clamp(color[0] + amount * 255, 0, 255)),
    Math.round(clamp(color[1] + amount * 255, 0, 255)),
    Math.round(clamp(color[2] + amount * 255, 0, 255)),
  ];
}

function resolveGeometry(width: number, height: number): GlobeGeometry {
  const radius = Math.max(120, Math.min(width, height) * 0.37);

  return {
    centerX: width / 2,
    centerY: height / 2,
    radius,
  };
}

function cellForLatitudeLongitude(snapshot: AtlasSnapshot, latitude: number, longitude: number): AtlasCell | null {
  const row = clamp(Math.floor((latitude + 90) / snapshot.grid.cellHeightDegrees), 0, snapshot.grid.latitudeDivisions - 1);
  const column = clamp(Math.floor((normalizeLongitude(longitude) + 180) / snapshot.grid.cellWidthDegrees), 0, snapshot.grid.longitudeDivisions - 1);

  return snapshot.cells.find((cell) => cell.row === row && cell.column === column) ?? null;
}

function sampleAtlasTexture(
  textureData: ImageData,
  descriptor: AtlasTextureDescriptor,
  latitude: number,
  longitude: number,
): Rgb {
  const x = clamp(Math.floor(((normalizeLongitude(longitude) + 180) / 360) * descriptor.width), 0, descriptor.width - 1);
  const y = clamp(Math.floor(((90 - latitude) / 180) * descriptor.height), 0, descriptor.height - 1);
  const offset = (y * textureData.width + x) * 4;

  return [
    textureData.data[offset] ?? 0,
    textureData.data[offset + 1] ?? 0,
    textureData.data[offset + 2] ?? 0,
  ];
}

function sunlightAt(snapshot: AtlasSnapshot, latitude: number, longitude: number): number {
  const latitudeRadians = toRadians(latitude);
  const declination = toRadians(snapshot.astronomy.solarDeclinationDegrees);
  const subsolarLongitude = 180 - snapshot.time.normalizedDayProgress * 360;
  const longitudeDelta = toRadians(longitude - subsolarLongitude);
  const solarDot =
    Math.sin(latitudeRadians) * Math.sin(declination)
    + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(longitudeDelta);

  return smoothstep(-0.18, 0.28, solarDot);
}

function cloudPresence(snapshot: AtlasSnapshot, cell: AtlasCell, longitude: number, latitude: number, quality: AtlasBeautyQuality): number {
  const seed = snapshot.fingerprint.seed || snapshot.worldId;
  const octaves = quality === "ultra" ? 5 : quality === "high" ? 4 : 3;
  const latitudeBand = Math.cos(toRadians(latitude));
  const weather = cell.cloudCover * 0.5
    + cell.relativeHumidity * 0.18
    + cell.precipitationPotential * 0.18
    + cell.stormPotential * 0.12
    + (cell.isOcean || cell.isSea ? 0.08 : 0)
    + smoothstep(0.08, 0.92, latitudeBand) * 0.06;
  const drynessPenalty = cell.drynessIndex * 0.24;
  const noise = fbmNoise(seed, longitude / 18, latitude / 18, "globe-clouds", octaves) * 0.56
    + fbmNoise(seed, longitude / 5, latitude / 5, "globe-cloud-detail", Math.max(2, octaves - 1)) * 0.24
    + ridgeNoise(seed, longitude / 24, latitude / 16, "globe-cloud-whorl", Math.max(2, octaves - 1)) * 0.2;

  return smoothstep(0.55, 0.98, weather - drynessPenalty + noise * 0.34);
}

function inverseProject(
  x: number,
  y: number,
  geometry: GlobeGeometry,
  options: Pick<AtlasGlobeRenderOptions, "rotationLongitudeDegrees" | "tiltDegrees">,
): { latitude: number; longitude: number; normalZ: number; localX: number; localY: number } | null {
  const localX = (x - geometry.centerX) / geometry.radius;
  const localY = (y - geometry.centerY) / geometry.radius;
  const distanceSquared = localX * localX + localY * localY;

  if (distanceSquared > 1) {
    return null;
  }

  const normalZ = Math.sqrt(1 - distanceSquared);
  const tilt = toRadians(options.tiltDegrees);
  const untiltedY = localY * Math.cos(tilt) + normalZ * Math.sin(tilt);
  const untiltedZ = normalZ * Math.cos(tilt) - localY * Math.sin(tilt);
  const latitude = toDegrees(Math.asin(clamp(-untiltedY, -1, 1)));
  const longitude = normalizeLongitude(toDegrees(Math.atan2(localX, untiltedZ)) + options.rotationLongitudeDegrees);

  return { latitude, longitude, normalZ, localX, localY };
}

function drawGlobeHighlights(
  context: CanvasRenderingContext2D,
  snapshot: AtlasSnapshot,
  geometry: GlobeGeometry,
  options: AtlasGlobeRenderOptions,
) {
  const drawCell = (cellId: string | null, color: string, lineWidth: number) => {
    if (!cellId) {
      return;
    }

    const cell = snapshot.cells.find((candidate) => candidate.id === cellId);

    if (!cell) {
      return;
    }

    const longitude = toRadians(cell.midpointLongitude - options.rotationLongitudeDegrees);
    const latitude = toRadians(cell.midpointLatitude);
    const tilt = toRadians(options.tiltDegrees);
    const x = Math.cos(latitude) * Math.sin(longitude);
    const yBeforeTilt = -Math.sin(latitude);
    const zBeforeTilt = Math.cos(latitude) * Math.cos(longitude);
    const y = yBeforeTilt * Math.cos(tilt) - zBeforeTilt * Math.sin(tilt);
    const z = zBeforeTilt * Math.cos(tilt) + yBeforeTilt * Math.sin(tilt);

    if (z <= 0) {
      return;
    }

    const screenX = geometry.centerX + x * geometry.radius;
    const screenY = geometry.centerY + y * geometry.radius;
    const markerRadius = Math.max(5, geometry.radius * 0.026);

    context.beginPath();
    context.arc(screenX, screenY, markerRadius, 0, Math.PI * 2);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  };

  drawCell(options.selectedCellId, "rgba(255, 208, 113, 0.96)", 2.6);
  drawCell(options.hoveredCellId, "rgba(255, 255, 255, 0.9)", 1.8);
}

export function pickAtlasGlobeCell(
  snapshot: AtlasSnapshot,
  point: { x: number; y: number },
  bounds: { width: number; height: number },
  options: Pick<AtlasGlobeRenderOptions, "rotationLongitudeDegrees" | "tiltDegrees">,
): AtlasGlobePickResult {
  const geometry = resolveGeometry(bounds.width, bounds.height);
  const projected = inverseProject(point.x, point.y, geometry, options);

  if (!projected) {
    return null;
  }

  const cell = cellForLatitudeLongitude(snapshot, projected.latitude, projected.longitude);

  return cell ? {
    cellId: cell.id,
    latitude: projected.latitude,
    longitude: projected.longitude,
  } : null;
}

function getCachedTextureData(atlasTexture: HTMLCanvasElement, descriptor: AtlasTextureDescriptor): ImageData | null {
  const key = `${descriptor.worldId}:${descriptor.selectedDay}:${descriptor.fingerprint}:${descriptor.width}x${descriptor.height}`;
  const cached = textureDataCache.get(atlasTexture);

  if (cached?.key === key) {
    return cached.data;
  }

  const textureContext = atlasTexture.getContext("2d");

  if (!textureContext) {
    return null;
  }

  const data = textureContext.getImageData(0, 0, descriptor.width, descriptor.height);
  textureDataCache.set(atlasTexture, { key, data });
  return data;
}

export function renderAtlasGlobe(
  context: CanvasRenderingContext2D,
  snapshot: AtlasSnapshot,
  descriptor: AtlasTextureDescriptor,
  atlasTexture: HTMLCanvasElement,
  options: AtlasGlobeRenderOptions,
) {
  const geometry = resolveGeometry(options.width, options.height);
  const textureData = getCachedTextureData(atlasTexture, descriptor);

  if (!textureData) {
    return;
  }
  const frame = context.createImageData(options.width, options.height);
  const left = Math.max(0, Math.floor(geometry.centerX - geometry.radius - 4));
  const right = Math.min(options.width - 1, Math.ceil(geometry.centerX + geometry.radius + 4));
  const top = Math.max(0, Math.floor(geometry.centerY - geometry.radius - 4));
  const bottom = Math.min(options.height - 1, Math.ceil(geometry.centerY + geometry.radius + 4));

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const projected = inverseProject(x + 0.5, y + 0.5, geometry, options);

      if (!projected) {
        continue;
      }

      const cell = cellForLatitudeLongitude(snapshot, projected.latitude, projected.longitude);
      let color = sampleAtlasTexture(textureData, descriptor, projected.latitude, projected.longitude);
      const rim = 1 - projected.normalZ;
      const sunlight = options.showDayNight ? sunlightAt(snapshot, projected.latitude, projected.longitude) : 1;
      const limbShade = rim * (options.quality === "ultra" ? 0.3 : 0.24);
      const rimLight = smoothstep(0.58, 0.98, rim) * (options.quality === "ultra" ? 0.1 : 0.07);
      color = shadeRgb(color, -limbShade + rimLight);

      if (options.showDayNight) {
        color = mixRgb(color, [3, 9, 24], (1 - sunlight) * 0.54);
        const terminator = 1 - Math.abs(sunlight - 0.5) * 2;
        color = mixRgb(color, [104, 177, 209], terminator * 0.08);
      }

      if (options.showClouds && cell) {
        const clouds = cloudPresence(snapshot, cell, projected.longitude, projected.latitude, options.quality) * ((options.quality === "ultra" ? 0.78 : 0.72) - rim * 0.18);

        if (clouds > 0.04) {
          const cloudColor: Rgb = cell.stormPotential > 0.62 ? [208, 216, 220] : [235, 242, 244];
          color = mixRgb(color, cloudColor, clouds * 0.58);
        }
      }

      const highlight = Math.max(0, 0.24 - Math.hypot(projected.localX + 0.34, projected.localY + 0.32));
      const polarCompressionShade = Math.abs(projected.latitude) > 70 ? 0.018 : 0;
      color = shadeRgb(color, highlight * 0.28 - polarCompressionShade);

      const offset = (y * options.width + x) * 4;
      frame.data[offset] = color[0];
      frame.data[offset + 1] = color[1];
      frame.data[offset + 2] = color[2];
      frame.data[offset + 3] = 255;
    }
  }

  context.clearRect(0, 0, options.width, options.height);
  context.putImageData(frame, 0, 0);

  if (options.showAtmosphere) {
    const atmosphere = context.createRadialGradient(
      geometry.centerX,
      geometry.centerY,
      geometry.radius * 0.82,
      geometry.centerX,
      geometry.centerY,
      geometry.radius * 1.15,
    );
    atmosphere.addColorStop(0, "rgba(91, 213, 240, 0)");
    atmosphere.addColorStop(0.72, "rgba(91, 213, 240, 0.08)");
    atmosphere.addColorStop(1, "rgba(91, 213, 240, 0)");
    context.fillStyle = atmosphere;
    context.beginPath();
    context.arc(geometry.centerX, geometry.centerY, geometry.radius * 1.15, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(181, 242, 255, 0.34)";
    context.lineWidth = 1.4;
    context.beginPath();
    context.arc(geometry.centerX, geometry.centerY, geometry.radius + 0.75, 0, Math.PI * 2);
    context.stroke();
  }

  drawGlobeHighlights(context, snapshot, geometry, options);
}