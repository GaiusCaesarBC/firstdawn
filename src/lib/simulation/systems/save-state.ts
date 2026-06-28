import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "save-state";
const SYSTEM_LABEL = "Save State";
const SYSTEM_ORDER = 190;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const saveStateSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);

