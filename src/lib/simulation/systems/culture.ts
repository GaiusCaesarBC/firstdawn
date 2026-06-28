import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "culture";
const SYSTEM_LABEL = "Culture";
const SYSTEM_ORDER = 150;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const cultureSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
