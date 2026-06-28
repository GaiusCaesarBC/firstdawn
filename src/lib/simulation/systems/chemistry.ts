import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "chemistry";
const SYSTEM_LABEL = "Chemistry";
const SYSTEM_ORDER = 86;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const chemistrySystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
