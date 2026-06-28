import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "biology";
const SYSTEM_LABEL = "Biology";
const SYSTEM_ORDER = 90;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const biologySystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
