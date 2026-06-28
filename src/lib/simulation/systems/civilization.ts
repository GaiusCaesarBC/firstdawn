import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "civilization";
const SYSTEM_LABEL = "Civilization";
const SYSTEM_ORDER = 130;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const civilizationSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
