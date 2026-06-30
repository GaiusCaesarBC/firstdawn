import { analyzeDiscoveryState } from "../discovery-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystem, SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "discovery";
const SYSTEM_LABEL = "Discovery";
const SYSTEM_ORDER = 165; // After Memory, before Event Generation

export async function run(context: SimulationSystemContext): Promise<SimulationSystemResult> {
  const { snapshot, events } = await analyzeDiscoveryState(context);

  return {
    success: true,
    events,
    metadata: { snapshot },
    health: {
      status: "Healthy",
      metadata: {
        observationCount: snapshot.observations.length,
        hypothesisCount: snapshot.hypotheses.length,
        discoveryCount: snapshot.discoveries.length,
        latestEvent: snapshot.latestEvent ?? null,
      },
    },
  };
}

export const discoverySystem: SimulationSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
