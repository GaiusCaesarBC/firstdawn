import { getTimeStateAtTick } from "../time-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "time";
const SYSTEM_LABEL = "Time";
const SYSTEM_ORDER = 10;

export function run(context: SimulationSystemContext): SimulationSystemResult {
  return systemSuccess(getTimeStateAtTick(context.world, context.tick));
}

export const timeSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);