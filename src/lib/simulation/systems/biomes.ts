import { persistBiomeState } from "../biome-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "biomes";
const SYSTEM_LABEL = "Biomes";
const SYSTEM_ORDER = 80;

export async function run(context: SimulationSystemContext): Promise<SimulationSystemResult> {
  const result = await persistBiomeState(context.world, context.client, context.tick);

  return systemSuccess({
    deterministic: true,
    persistent: true,
    generatedCells: result.generatedCells,
    createdCells: result.createdCells,
    updatedCells: result.updatedCells,
    unchangedCells: result.unchangedCells,
    oceanCoveragePercent: result.summary.oceanCoveragePercent,
    biodiversityPotentialScore: result.summary.biodiversityPotentialScore,
    civilizationStartingZoneCandidateCount: result.summary.civilizationStartingZoneCandidates.length,
    biomeDistribution: result.summary.biomeDistribution,
  });
}

export const biomesSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);