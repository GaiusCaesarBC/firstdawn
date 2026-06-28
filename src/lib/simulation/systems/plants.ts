import { persistPlantEcologyState } from "../plant-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "plants";
const SYSTEM_LABEL = "Plant Ecology";
const SYSTEM_ORDER = 85;

export async function run(context: SimulationSystemContext): Promise<SimulationSystemResult> {
  const result = await persistPlantEcologyState(context.world, context.client, context.tick);

  return systemSuccess({
    deterministic: true,
    persistent: true,
    requires: ["biomes", "terrain", "climate", "hydrology", "atmosphere", "weather", "resources"],
    generatedCells: result.generatedCells,
    updatedCells: result.updatedCells,
    unchangedCells: result.unchangedCells,
    totalBiomass: result.summary.totalBiomass,
    averagePlantDensity: result.summary.averagePlantDensity,
    ediblePlantCoverage: result.summary.ediblePlantCoverage,
    timberMaterialCoverage: result.summary.timberMaterialCoverage,
    biodiversityScore: result.summary.biodiversityScore,
    civilizationStartingZoneSupportScore: result.summary.civilizationStartingZoneSupportScore,
    animalCarryingCapacityFoundationScore: result.summary.animalCarryingCapacityFoundationScore,
    dominantPlantDistribution: result.summary.dominantPlantDistribution,
  });
}

export const plantsSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
