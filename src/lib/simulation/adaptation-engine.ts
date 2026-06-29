import type { Prisma } from "@prisma/client";

import {
  type AdaptationTrait,
  type AnimalGridCell,
  type AnimalPopulationState,
  type AnimalWorldSource,
  getAnimalEcologyStateAtTick,
} from "./animal-engine";
import { createGrid, type SpatialGrid } from "./grid/grid";
import type { SimulationSystemEvent } from "./systems/types";

export type PopulationAdaptationEvent = SimulationSystemEvent & {
  metadata: Prisma.InputJsonObject;
};

export type PopulationSummary = {
  readonly cellId: string;
  readonly speciesId: string;
  readonly speciesName: string;
  readonly score: number;
};

export type PopulationAdaptationSummary = {
  readonly cellCount: number;
  readonly populationCount: number;
  readonly averageFitness: number;
  readonly adaptationDiversity: number;
  readonly averageClimateAdaptation: number;
  readonly averageDiseaseResistance: number;
  readonly averageReproductiveEfficiency: number;
  readonly highestFitnessPopulation: PopulationSummary | null;
  readonly lowestFitnessPopulation: PopulationSummary | null;
  readonly milestoneCount: number;
};

export type PopulationAdaptationState = {
  readonly seed: string;
  readonly tick: string;
  readonly summary: PopulationAdaptationSummary;
  readonly events: readonly PopulationAdaptationEvent[];
};

const EVENT_LIMIT = 24;
const FITNESS_MILESTONE_BAND = 0.12;

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function presentPopulations(cells: readonly AnimalGridCell[]): Array<{ cell: AnimalGridCell; population: AnimalPopulationState }> {
  return cells.flatMap((cell) =>
    cell.animalPopulations
      .filter((population) => population.population > 0)
      .map((population) => ({ cell, population })),
  );
}

function populationSummary(cell: AnimalGridCell, population: AnimalPopulationState, score: number): PopulationSummary {
  return Object.freeze({
    cellId: cell.id,
    speciesId: population.speciesId,
    speciesName: population.speciesName,
    score: round(score),
  });
}

function highestFitness(cells: readonly AnimalGridCell[]): PopulationSummary | null {
  const ranked = presentPopulations(cells)
    .sort((left, right) =>
      right.population.fitnessScore - left.population.fitnessScore
        || left.cell.id.localeCompare(right.cell.id)
        || left.population.speciesId.localeCompare(right.population.speciesId),
    );
  const best = ranked[0];

  return best ? populationSummary(best.cell, best.population, best.population.fitnessScore) : null;
}

function lowestFitness(cells: readonly AnimalGridCell[]): PopulationSummary | null {
  const ranked = presentPopulations(cells)
    .sort((left, right) =>
      left.population.fitnessScore - right.population.fitnessScore
        || left.cell.id.localeCompare(right.cell.id)
        || left.population.speciesId.localeCompare(right.population.speciesId),
    );
  const weakest = ranked[0];

  return weakest ? populationSummary(weakest.cell, weakest.population, weakest.population.fitnessScore) : null;
}

function traitLabel(trait: AdaptationTrait): string {
  return trait.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function findTrendFromDescription(population: AnimalPopulationState | undefined, description: string) {
  if (!population) {
    return null;
  }

  const normalized = description.toLowerCase();

  return population.adaptationTrends.find((entry) => normalized.includes(traitLabel(entry.trait))) ?? null;
}

function buildFitnessEvents(cells: readonly AnimalGridCell[], tick: bigint): PopulationAdaptationEvent[] {
  return presentPopulations(cells)
    .flatMap(({ cell, population }) => {
      const trend = population.adaptationTrends.find((entry) => entry.direction === "Increasing");
      const trendSupport = trend ? Math.max(0, trend.value - trend.previousValue) : 0;
      const currentBand = Math.floor(population.fitnessScore / FITNESS_MILESTONE_BAND);
      const previousBand = Math.floor((population.fitnessScore - trendSupport) / FITNESS_MILESTONE_BAND);

      if (population.fitnessScore < 0.58 || currentBand === previousBand) {
        return [];
      }

      return [{
        type: "Population Adaptation",
        title: "Population Fitness Improved",
        description: `${population.speciesName} fitness improved in ${cell.id}.`,
        historicalWeight: round(0.2 + population.fitnessScore * 0.3),
        metadata: {
          cellId: cell.id,
          tick: tick.toString(),
          speciesId: population.speciesId,
          speciesName: population.speciesName,
          fitnessScore: population.fitnessScore,
          triggerTrait: trend?.trait ?? null,
        },
      }];
    });
}

function buildMilestoneEvents(cells: readonly AnimalGridCell[], tick: bigint): PopulationAdaptationEvent[] {
  return cells.flatMap((cell) =>
    cell.ecosystemEvents
      .filter((event) => event.type === "Adaptation Milestone")
      .map((event) => {
        const population = cell.animalPopulations.find((entry) => entry.speciesId === event.speciesId);
        const trend = findTrendFromDescription(population, event.description);

        return {
          type: "Population Adaptation",
          title: event.description.split(".")[0] || "Adaptation Milestone",
          description: event.description,
          historicalWeight: round(0.25 + event.severity * 0.35),
          metadata: {
            cellId: cell.id,
            eventId: event.id,
            tick: tick.toString(),
            speciesId: event.speciesId ?? null,
            speciesName: population?.speciesName ?? null,
            trait: trend?.trait ?? null,
            severity: event.severity,
          },
        };
      }),
  );
}

function buildSummary(cells: readonly AnimalGridCell[]): PopulationAdaptationSummary {
  const populations = presentPopulations(cells);

  return Object.freeze({
    cellCount: cells.length,
    populationCount: populations.length,
    averageFitness: round(average(populations.map(({ population }) => population.fitnessScore))),
    adaptationDiversity: round(average(cells.map((cell) => cell.adaptationDiversity))),
    averageClimateAdaptation: round(average(cells.map((cell) => cell.averageClimateAdaptation))),
    averageDiseaseResistance: round(average(cells.map((cell) => cell.averageDiseaseResistance))),
    averageReproductiveEfficiency: round(average(cells.map((cell) => cell.averageReproductiveEfficiency))),
    highestFitnessPopulation: highestFitness(cells),
    lowestFitnessPopulation: lowestFitness(cells),
    milestoneCount: cells.reduce((total, cell) => total + cell.ecosystemHistory.filter((event) => event.type === "Adaptation Milestone").length, 0),
  });
}

export function getPopulationAdaptationStateAtTick(
  world: AnimalWorldSource,
  tick: bigint,
  grid: SpatialGrid = createGrid(),
): PopulationAdaptationState {
  const animalState = getAnimalEcologyStateAtTick(world, tick, grid);
  const events = [...buildMilestoneEvents(animalState.cells, tick), ...buildFitnessEvents(animalState.cells, tick)]
    .sort((left, right) =>
      (right.historicalWeight ?? 0) - (left.historicalWeight ?? 0)
        || left.title.localeCompare(right.title)
        || JSON.stringify(left.metadata).localeCompare(JSON.stringify(right.metadata)),
    )
    .slice(0, EVENT_LIMIT);

  return Object.freeze({
    seed: animalState.seed,
    tick: animalState.tick,
    summary: buildSummary(animalState.cells),
    events: Object.freeze(events),
  });
}
