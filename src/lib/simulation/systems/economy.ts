import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "economy";
const SYSTEM_LABEL = "Economy";
const SYSTEM_ORDER = 140;

export function run(_context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess();
}

export const economySystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
