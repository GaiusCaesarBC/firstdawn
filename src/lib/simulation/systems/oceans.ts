import { getHydrologySummary } from "../hydrology-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "oceans";
const SYSTEM_LABEL = "Oceans";
const SYSTEM_ORDER = 60;

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const hydrologySummary = getHydrologySummary(context.world);

  return systemSuccess({
    static: true,
    activeWaterSimulation: "unmodeled",
    flowingRivers: "unmodeled",
    erosion: "unmodeled",
    oceanCells: hydrologySummary.oceanCells,
    landCells: hydrologySummary.landCells,
    coastalWaterCells: hydrologySummary.coastalWaterCells,
    inlandBasinCount: hydrologySummary.inlandBasinCount,
    lakeCandidateCount: hydrologySummary.lakeCandidateCount,
    riverSourceCandidateCount: hydrologySummary.riverSourceCandidateCount,
    riverChannelCandidateCount: hydrologySummary.riverChannelCandidateCount,
    averageMoisturePotential: hydrologySummary.averageMoisturePotential,
    largestWatershedEstimate: hydrologySummary.largestWatershedEstimate,
    largestBasinEstimate: hydrologySummary.largestBasinEstimate,
  });
}

export const oceansSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
