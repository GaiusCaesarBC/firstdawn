import { getClimateStateAtTick } from "../climate-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "climate";
const SYSTEM_LABEL = "Climate";
const SYSTEM_ORDER = 40;

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const climate = getClimateStateAtTick(context.world, context.tick);

  return systemSuccess({
    passive: true,
    weather: "unmodeled",
    life: "unmodeled",
    northernSeason: climate.seasonNorthernHemisphere,
    southernSeason: climate.seasonSouthernHemisphere,
    averageDaylightHours: climate.summary.averageDaylightHours,
    averageSolarEnergy: climate.summary.averageSolarEnergy,
    averageTemperatureC: climate.summary.averageTemperatureC,
    climateBandsPresent: climate.summary.climateBandsPresent,
  });
}

export const climateSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
