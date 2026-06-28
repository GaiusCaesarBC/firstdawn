import { getAtmosphereSummary } from "../atmosphere-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "atmosphere";
const SYSTEM_LABEL = "Atmosphere";
const SYSTEM_ORDER = 65;

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const atmosphereSummary = getAtmosphereSummary(context.world);

  return systemSuccess({
    deterministic: true,
    dynamicWeather: "unmodeled",
    precipitation: "unmodeled",
    pressureBandDistribution: atmosphereSummary.pressureBandDistribution,
    averageWindSpeed: atmosphereSummary.averageWindSpeed,
    averageMoistureTransport: atmosphereSummary.averageMoistureTransport,
    strongestWinds: atmosphereSummary.strongestWinds,
    largestRainShadowRegion: atmosphereSummary.largestRainShadowRegion,
    averageAtmosphericStability: atmosphereSummary.averageAtmosphericStability,
    dominantCirculationPattern: atmosphereSummary.dominantCirculationPattern,
    seasonalCirculationPhase: atmosphereSummary.seasonalCirculationPhase,
    seasonalShiftDegrees: atmosphereSummary.seasonalShiftDegrees,
  });
}

export const atmosphereSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
