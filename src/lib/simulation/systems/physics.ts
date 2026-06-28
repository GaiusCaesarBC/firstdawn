import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "physics";
const SYSTEM_LABEL = "Physics";
const SYSTEM_ORDER = 30;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const physicsSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
