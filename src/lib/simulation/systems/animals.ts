import { persistAnimalEcologyState } from "../animal-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "animals";
const SYSTEM_LABEL = "Animals";
const SYSTEM_ORDER = 110;

export async function run(context: SimulationSystemContext): Promise<SimulationSystemResult> {
  const result = await persistAnimalEcologyState(context.world, context.client, context.tick);

  return systemSuccess({
    deterministic: true,
    persistent: true,
    requires: ["plant-ecology", "biomes", "terrain", "climate", "hydrology", "atmosphere", "weather", "resources"],
    generatedCells: result.generatedCells,
    updatedCells: result.updatedCells,
    unchangedCells: result.unchangedCells,
    totalAnimalBiomassCapacity: result.summary.totalAnimalBiomassCapacity,
    averageAnimalDensity: result.summary.averageAnimalDensity,
    averageHerbivoreCapacity: result.summary.averageHerbivoreCapacity,
    averagePredatorCapacity: result.summary.averagePredatorCapacity,
    averagePreyAvailability: result.summary.averagePreyAvailability,
    averageMigrationPressure: result.summary.averageMigrationPressure,
    averageDangerScore: result.summary.averageDangerScore,
    huntingValueScore: result.summary.huntingValueScore,
    domesticationCandidateScore: result.summary.domesticationCandidateScore,
    biodiversityScore: result.summary.biodiversityScore,
    civilizationFoodSupportScore: result.summary.civilizationFoodSupportScore,
    dangerMapScore: result.summary.dangerMapScore,
    animalSpeciesCount: result.summary.animalSpeciesCount,
    occupiedHabitatPercent: result.summary.occupiedHabitatPercent,
    totalWildlifePopulation: result.summary.totalWildlifePopulation,
    averageHabitatSuitability: result.summary.averageHabitatSuitability,
    averageHealth: result.summary.averageHealth,
    dominantAnimalDistribution: result.summary.dominantAnimalDistribution,
  });
}

export const animalsSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);