import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "humans";
const SYSTEM_LABEL = "Humans";
const SYSTEM_ORDER = 120;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const humansSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
