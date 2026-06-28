import { getAstronomyStateAtTick } from "../astronomy-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "astronomy";
const SYSTEM_LABEL = "Astronomy";
const SYSTEM_ORDER = 20;

export function run(context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess(getAstronomyStateAtTick(context.world, context.tick));
}

export const astronomySystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);