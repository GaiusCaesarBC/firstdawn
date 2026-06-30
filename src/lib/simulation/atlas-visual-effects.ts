import type { AtlasCell, AtlasSnapshot } from "../worlds/map-atlas";
import { fbmNoise, ridgeNoise } from "./procedural-noise";

export type AtlasBeautyQuality = "off" | "balanced" | "high" | "ultra";

export type AtlasTextureDescriptor = {
  worldId: string;
  selectedDay: number;
  width: number;
  height: number;
  cellSize: number;
  latitudeDivisions: number;
  longitudeDivisions: number;
  fingerprint: string;
};

export type AtlasBeautyEffectsOptions = {
  x: number;
  y: number;
  cellSize: number;
  scale: number;
  quality: AtlasBeautyQuality;
  cloudsEnabled: boolean;
  cloudOpacity: number;
  atmosphereEnabled: boolean;
  dayNightEnabled: boolean;
};

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

function getDisplayRow(snapshot: AtlasSnapshot, cell: AtlasCell): number {
  return snapshot.grid.latitudeDivisions - 1 - cell.row;
}

function cellRect(snapshot: AtlasSnapshot, cell: AtlasCell, options: AtlasBeautyEffectsOptions) {
  const size = options.cellSize * options.scale;

  return {
    x: options.x + cell.column * size,
    y: options.y + getDisplayRow(snapshot, cell) * size,
    width: size,
    height: size,
  };
}

function getSunlight(snapshot: AtlasSnapshot, cell: AtlasCell): number {
  const latitude = toRadians(cell.midpointLatitude);
  const solarDeclination = toRadians(snapshot.astronomy.solarDeclinationDegrees);
  const subsolarLongitude = 180 - snapshot.time.normalizedDayProgress * 360;
  const longitudeDelta = toRadians(cell.midpointLongitude - subsolarLongitude);
  const solarDot =
    Math.sin(latitude) * Math.sin(solarDeclination)
    + Math.cos(latitude) * Math.cos(solarDeclination) * Math.cos(longitudeDelta);

  return smoothstep(-0.2, 0.24, solarDot);
}

function renderDayNightPass(
  context: CanvasRenderingContext2D,
  snapshot: AtlasSnapshot,
  options: AtlasBeautyEffectsOptions,
) {
  const nightStrength = options.quality === "ultra" ? 0.48 : options.quality === "high" ? 0.44 : 0.34;
  const duskStrength = options.quality === "ultra" ? 0.11 : options.quality === "high" ? 0.09 : 0.06;

  for (const cell of snapshot.cells) {
    const light = getSunlight(snapshot, cell);
    const rect = cellRect(snapshot, cell, options);
    const nightAlpha = (1 - light) * nightStrength;

    if (nightAlpha > 0.015) {
      context.fillStyle = `rgba(3, 9, 24, ${nightAlpha.toFixed(3)})`;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    const terminator = 1 - Math.abs(light - 0.5) * 2;
    if (terminator > 0.05) {
      context.fillStyle = `rgba(117, 184, 217, ${(terminator * duskStrength).toFixed(3)})`;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }
}

function getCloudPresence(snapshot: AtlasSnapshot, cell: AtlasCell, subX: number, subY: number, octaves: number): number {
  const seed = snapshot.fingerprint.seed || snapshot.worldId;
  const latitudeBand = Math.cos(toRadians(cell.midpointLatitude));
  const broadWeather =
    cell.cloudCover * 0.5
    + cell.relativeHumidity * 0.2
    + cell.precipitationPotential * 0.18
    + cell.stormPotential * 0.12;
  const waterFeed = cell.isOcean || cell.isSea ? 0.12 : cell.isCoast ? 0.08 : 0;
  const mountainLift = cell.orographicLiftPotential * 0.1;
  const dryPenalty = cell.drynessIndex * 0.28;
  const latitudeMoisture = smoothstep(0.08, 0.92, latitudeBand) * 0.08;
  const band =
    fbmNoise(seed, cell.column / 3 + subX * 0.8, cell.row / 3 + subY * 0.8, "cloud-band", octaves) * 0.5
    + fbmNoise(seed, cell.column + subX * 2, cell.row + subY * 2, "cloud-detail", Math.max(2, octaves - 1)) * 0.26
    + ridgeNoise(seed, cell.midpointLongitude / 18 + subX, cell.midpointLatitude / 18 + subY, "cloud-whorl", Math.max(2, octaves - 1)) * 0.24;

  return smoothstep(0.52, 0.92, broadWeather + waterFeed + mountainLift + latitudeMoisture - dryPenalty + band * 0.36);
}

function renderCloudPass(
  context: CanvasRenderingContext2D,
  snapshot: AtlasSnapshot,
  options: AtlasBeautyEffectsOptions,
) {
  const samples = options.quality === "ultra" ? 4 : options.quality === "high" ? 3 : 2;
  const octaves = options.quality === "ultra" ? 5 : options.quality === "high" ? 4 : 3;
  const cloudOpacity = clamp(options.cloudOpacity, 0, options.quality === "ultra" ? 0.78 : 0.72);

  if (cloudOpacity <= 0) {
    return;
  }

  for (const cell of snapshot.cells) {
    const rect = cellRect(snapshot, cell, options);
    const sampleWidth = rect.width / samples;
    const sampleHeight = rect.height / samples;

    for (let row = 0; row < samples; row += 1) {
      for (let column = 0; column < samples; column += 1) {
        const presence = getCloudPresence(snapshot, cell, column / samples, row / samples, octaves);

        if (presence <= 0.08) {
          continue;
        }

        const wispyEdge = smoothstep(0.1, 0.82, presence);
        const stormTint = cell.stormPotential > 0.62 ? 18 : 0;
        const alpha = wispyEdge * cloudOpacity * (cell.isOcean || cell.isSea ? 0.84 : 0.72);
        context.fillStyle = `rgba(${232 - stormTint}, ${239 - stormTint}, ${241 - stormTint}, ${alpha.toFixed(3)})`;
        context.fillRect(
          rect.x + column * sampleWidth,
          rect.y + row * sampleHeight,
          sampleWidth + 0.75 * options.scale,
          sampleHeight + 0.75 * options.scale,
        );
      }
    }
  }
}

function renderAtmosphereRim(
  context: CanvasRenderingContext2D,
  snapshot: AtlasSnapshot,
  options: AtlasBeautyEffectsOptions,
) {
  const width = snapshot.grid.longitudeDivisions * options.cellSize * options.scale;
  const height = snapshot.grid.latitudeDivisions * options.cellSize * options.scale;
  const passes = options.quality === "ultra" ? 9 : options.quality === "high" ? 7 : 5;

  for (let pass = passes; pass >= 1; pass -= 1) {
    const spread = pass * (options.quality === "ultra" ? 3.2 : 2.8) * options.scale;
    const alpha = (passes - pass + 1) / passes * (options.quality === "ultra" ? 0.095 : 0.08);
    context.strokeStyle = `rgba(104, 214, 244, ${alpha.toFixed(3)})`;
    context.lineWidth = Math.max(1, spread);
    context.strokeRect(
      options.x - spread / 2,
      options.y - spread / 2,
      width + spread,
      height + spread,
    );
  }

  context.strokeStyle = options.quality === "ultra" ? "rgba(190, 245, 255, 0.32)" : "rgba(180, 241, 255, 0.26)";
  context.lineWidth = Math.max(1, 1.2 * options.scale);
  context.strokeRect(options.x, options.y, width, height);
}

export function renderAtlasBeautyEffects(
  context: CanvasRenderingContext2D,
  snapshot: AtlasSnapshot,
  options: AtlasBeautyEffectsOptions,
) {
  if (options.quality === "off") {
    return;
  }

  if (options.dayNightEnabled) {
    renderDayNightPass(context, snapshot, options);
  }

  if (options.cloudsEnabled) {
    renderCloudPass(context, snapshot, options);
  }

  if (options.atmosphereEnabled) {
    renderAtmosphereRim(context, snapshot, options);
  }
}

export function prepareAtlasTextureDescriptor(
  snapshot: AtlasSnapshot,
  cellSize: number,
): AtlasTextureDescriptor {
  return {
    worldId: snapshot.worldId,
    selectedDay: snapshot.selectedDay,
    width: snapshot.grid.longitudeDivisions * cellSize,
    height: snapshot.grid.latitudeDivisions * cellSize,
    cellSize,
    latitudeDivisions: snapshot.grid.latitudeDivisions,
    longitudeDivisions: snapshot.grid.longitudeDivisions,
    fingerprint: snapshot.fingerprint.hash,
  };
}