import type { AtlasCell, AtlasSnapshot } from "../worlds/map-atlas";
import { clamp, fbmNoise, mixColor, ridgeNoise, shadeColor, smoothstep } from "./procedural-noise";

export type OceanSampleInput = {
  snapshot: AtlasSnapshot;
  cell: AtlasCell;
  seed: string;
  worldX: number;
  worldY: number;
  xRatio: number;
  yRatio: number;
  qualityOctaves: number;
};

export function renderOceanSample(input: OceanSampleInput): string {
  const { cell, seed, worldX, worldY, xRatio, yRatio, qualityOctaves } = input;
  const shelf = smoothstep(3.8, 0.15, cell.distanceToCoast);
  const coastPull = cell.isSea || cell.waterBodyType === "COASTAL_WATER" ? 0.2 : 0;
  const depth = clamp((0.5 - cell.elevation) * 2.4 + cell.distanceToCoast * 0.055, 0, 1);
  const gyre = fbmNoise(seed, worldX * 0.42, worldY * 0.55, "ocean-gyre", Math.max(3, qualityOctaves - 1));
  const shelves = ridgeNoise(seed, worldX * 1.15, worldY * 0.9, "continental-shelf", qualityOctaves);
  const waves = fbmNoise(seed, worldX * 4.1 + cell.windStrength, worldY * 3.4, "wave-normal", qualityOctaves);
  const shimmer = ridgeNoise(seed, worldX * 7.3 + cell.column * 0.13, worldY * 5.8 + cell.row * 0.17, "ocean-shimmer", Math.max(2, qualityOctaves - 1));

  let color = mixColor("#5ec7c2", "#1d73a4", clamp(depth * 0.55 + coastPull, 0, 1));
  color = mixColor(color, "#051944", clamp(depth * 0.86, 0, 0.9));
  color = mixColor(color, "#7fd0c2", clamp((shelf + shelves * 0.32) * 0.32, 0, 0.42));
  color = mixColor(color, "#0b3a7e", gyre * 0.18);

  const waveNormal = (waves - 0.5) * 0.055 + shimmer * 0.03 * smoothstep(0.15, 0.9, depth);
  const specular = Math.max(0, shimmer - 0.76) * (0.12 + cell.windStrength * 0.1);

  return shadeColor(color, waveNormal + specular);
}
