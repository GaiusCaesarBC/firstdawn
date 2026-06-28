import { getWeatherSummaryAtTick } from "../weather-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "weather";
const SYSTEM_LABEL = "Weather";
const SYSTEM_ORDER = 70;

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const weatherSummary = getWeatherSummaryAtTick(context.world, context.tick);

  return systemSuccess({
    deterministic: true,
    dynamicWeather: "unmodeled",
    movingStorms: "unmodeled",
    rainfall: "unmodeled",
    averageHumidity: weatherSummary.averageHumidity,
    averageCloudCover: weatherSummary.averageCloudCover,
    averagePrecipitationPotential: weatherSummary.averagePrecipitationPotential,
    averageStormPotential: weatherSummary.averageStormPotential,
    averageFogPotential: weatherSummary.averageFogPotential,
    averageSnowPotential: weatherSummary.averageSnowPotential,
    averageEvaporation: weatherSummary.averageEvaporation,
    averageDryness: weatherSummary.averageDryness,
    averageWeatherStability: weatherSummary.averageWeatherStability,
    dominantWeatherType: weatherSummary.dominantWeatherType,
    seasonalWeatherState: weatherSummary.seasonalWeatherState,
  });
}

export const weatherSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);