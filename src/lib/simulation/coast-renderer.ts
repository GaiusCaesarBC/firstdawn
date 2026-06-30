import type { AtlasCell, AtlasSnapshot } from "../worlds/map-atlas";
import { clamp, fbmNoise, mixColor, ridgeNoise, shadeColor, smoothstep } from "./procedural-noise";

export type CoastSampleInput = {
  snapshot: AtlasSnapshot;
  cell: AtlasCell;
  seed: string;
  baseColor: string;
  worldX: number;
  worldY: number;
  xRatio: number;
  yRatio: number;
  nearestWaterInfluence: number;
  nearestLandInfluence: number;
  qualityOctaves: number;
};

export function renderCoastSample(input: CoastSampleInput): string {
  const {
    cell,
    seed,
    baseColor,
    worldX,
    worldY,
    xRatio,
    yRatio,
    nearestWaterInfluence,
    nearestLandInfluence,
    qualityOctaves,
  } = input;
  const warpedShoreline =
    nearestWaterInfluence
    + (fbmNoise(seed, worldX * 2.1, worldY * 2.1, "shoreline-warp", qualityOctaves) - 0.5) * 0.42
    + (ridgeNoise(seed, worldX * 3.2, worldY * 2.7, "shoreline-crinkle", qualityOctaves) - 0.5) * 0.24;
  const beach = smoothstep(0.22, 0.74, warpedShoreline) * smoothstep(0.98, 0.28, cell.ruggedness);
  const marsh = smoothstep(0.48, 1.1, nearestWaterInfluence + cell.moisturePotential + cell.relativeHumidity - cell.ruggedness * 0.5);
  const rocky = smoothstep(0.36, 0.92, cell.ruggedness + cell.tectonicActivity * 0.4 + cell.volcanicInfluence * 0.2);
  const shelf = smoothstep(0.12, 0.86, nearestLandInfluence);
  const sandStreak = ridgeNoise(seed, worldX * 5.2 + xRatio, worldY * 2.4 + yRatio, "sand-streak", Math.max(2, qualityOctaves - 1));
  const wetNoise = fbmNoise(seed, worldX * 4.6, worldY * 4.6, "wet-coast", qualityOctaves);

  let color = baseColor;

  if (cell.isOcean || cell.isSea || cell.waterBodyType === "COASTAL_WATER") {
    color = mixColor(color, "#53beb8", clamp(shelf * 0.4, 0, 0.5));
    color = mixColor(color, "#d8c489", clamp(beach * 0.22, 0, 0.28));
  } else {
    color = mixColor(color, "#d9c486", clamp(beach * 0.42, 0, 0.55));
    color = mixColor(color, "#426f5f", clamp(marsh * 0.28, 0, 0.38));
    color = mixColor(color, "#6f6a62", clamp(rocky * nearestWaterInfluence * 0.34, 0, 0.36));
  }

  color = shadeColor(color, (sandStreak - 0.5) * beach * 0.08 - wetNoise * marsh * 0.05);

  return color;
}
