import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "metrics";
const SYSTEM_LABEL = "Metrics";
const SYSTEM_ORDER = 180;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const metricsSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
