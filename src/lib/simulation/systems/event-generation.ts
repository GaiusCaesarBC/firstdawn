import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "event-generation";
const SYSTEM_LABEL = "Event Generation";
const SYSTEM_ORDER = 170;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const eventGenerationSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);

