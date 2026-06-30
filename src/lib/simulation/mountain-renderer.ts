import type { AtlasCell, AtlasSnapshot } from "../worlds/map-atlas";
import { clamp, fbmNoise, mixColor, ridgeNoise, shadeColor, smoothstep } from "./procedural-noise";

export type MountainSampleInput = {
  snapshot: AtlasSnapshot;
  cell: AtlasCell;
  seed: string;
  baseColor: string;
  worldX: number;
  worldY: number;
  slope: number;
  light: number;
  qualityOctaves: number;
};

export function renderMountainSample(input: MountainSampleInput): string {
  const { cell, seed, baseColor, worldX, worldY, slope, light, qualityOctaves } = input;
  const elevationSignal = smoothstep(0.5, 0.94, cell.elevation);
  const mountainSignal = clamp(
    elevationSignal * 0.58
    + cell.ruggedness * 0.42
    + cell.tectonicActivity * 0.24
    + slope * 0.75,
    0,
    1,
  );
  const ridges = ridgeNoise(seed, worldX * 2.6, worldY * 2.9, "mountain-ridges", qualityOctaves);
  const fracture = ridgeNoise(seed, worldX * 6.1 + cell.tectonicActivity, worldY * 5.4, "cliff-fracture", Math.max(2, qualityOctaves - 1));
  const scree = fbmNoise(seed, worldX * 7.2, worldY * 6.5, "scree", qualityOctaves);
  const valley = 1 - ridgeNoise(seed, worldX * 1.2, worldY * 1.5, "mountain-valleys", Math.max(2, qualityOctaves - 1));
  const snow = clamp(
    cell.snowPotential * 0.56
    + smoothstep(0.72, 0.96, cell.elevation) * 0.36
    + smoothstep(4, -18, cell.averageTemperatureC) * 0.28
    + ridges * 0.12,
    0,
    0.9,
  );

  let color = mixColor(baseColor, "#776f66", mountainSignal * 0.46);
  color = mixColor(color, "#4f4b46", clamp(fracture * mountainSignal * 0.36, 0, 0.42));
  color = mixColor(color, "#9b9387", clamp((ridges * 0.35 + scree * 0.2) * mountainSignal, 0, 0.38));
  color = mixColor(color, "#59614f", clamp(valley * cell.moisturePotential * (1 - snow) * 0.18, 0, 0.22));
  color = mixColor(color, "#e7eeee", snow);

  const cliffShadow = clamp((fracture - 0.44) * mountainSignal * 0.15, 0, 0.12);

  return shadeColor(color, light * 0.1 - cliffShadow + (ridges - 0.5) * mountainSignal * 0.08);
}
