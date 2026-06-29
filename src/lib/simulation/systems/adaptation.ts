import { getPopulationAdaptationStateAtTick } from "../adaptation-engine";
import type { PopulationAdaptationSummary } from "../adaptation-engine";
import type { SimulationSystem, SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "adaptation";
const SYSTEM_LABEL = "Population Adaptation";
const SYSTEM_ORDER = 115;

function adaptationHealth(summary: PopulationAdaptationSummary) {
  if (summary.populationCount === 0) {
    return {
      status: "Warning" as const,
      diagnostics: ["Population adaptation has no active animal populations to process."],
      metadata: { populationCount: 0 },
    };
  }

  return {
    status: "Healthy" as const,
    metadata: {
      populationCount: summary.populationCount,
      averageFitness: summary.averageFitness,
      adaptationDiversity: summary.adaptationDiversity,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const state = getPopulationAdaptationStateAtTick(context.world, context.tick);

  context.metrics.addCells(state.summary.cellCount);
  context.metrics.addEntities(state.summary.populationCount);

  return {
    success: true,
    events: [...state.events],
    health: adaptationHealth(state.summary),
    metadata: {
      deterministic: true,
      persistent: true,
      consumes: ["climate", "weather", "biomes", "plants", "animals", "migration", "ecosystem-health"],
      stores: ["AnimalPopulation.adaptationProfile", "AnimalPopulation.adaptationTrends", "AnimalPopulation.fitnessScore"],
      cellCount: state.summary.cellCount,
      populationCount: state.summary.populationCount,
      averageFitness: state.summary.averageFitness,
      adaptationDiversity: state.summary.adaptationDiversity,
      averageClimateAdaptation: state.summary.averageClimateAdaptation,
      averageDiseaseResistance: state.summary.averageDiseaseResistance,
      averageReproductiveEfficiency: state.summary.averageReproductiveEfficiency,
      highestFitnessPopulation: state.summary.highestFitnessPopulation,
      lowestFitnessPopulation: state.summary.lowestFitnessPopulation,
      milestoneCount: state.summary.milestoneCount,
      emittedEvents: state.events.length,
    },
  };
}

export const adaptationSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: ["animals"],
  update: run,
  run,
};
