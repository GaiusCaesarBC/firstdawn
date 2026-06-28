import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "memory";
const SYSTEM_LABEL = "Memory";
const SYSTEM_ORDER = 160;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const memorySystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
