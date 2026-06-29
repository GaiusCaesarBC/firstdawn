import { describe, expect, it } from "vitest";

import { getPopulationAdaptationStateAtTick } from "../../src/lib/simulation/adaptation-engine";
import { run as runAdaptationSystem } from "../../src/lib/simulation/systems/adaptation";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const baseWorld = {
  id: "adaptation-test-world",
  name: "Adaptation Test World",
  slug: "adaptation-test-world",
  currentTick: 12_000n,
  seed: "plant-ecology-foundation-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
  planet: {
    oceanCoveragePercent: 65,
    atmospherePressureKPa: 101.3,
  },
};

function metricsCollector() {
  let cellsProcessed = 0;
  let entitiesProcessed = 0;
  const warnings: string[] = [];
  const errors: string[] = [];

  return {
    addCells: (count: number) => { cellsProcessed += count; },
    addEntities: (count: number) => { entitiesProcessed += count; },
    warn: (message: string) => warnings.push(message),
    error: (message: string) => errors.push(message),
    snapshot: () => ({ cellsProcessed, entitiesProcessed, warnings, errors }),
  };
}

describe("population adaptation plugin", () => {
  it("registers after animals and before human-facing systems", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Animals")).toBeLessThan(labels.indexOf("Population Adaptation"));
    expect(labels.indexOf("Population Adaptation")).toBeLessThan(labels.indexOf("Humans"));
    expect(labels.indexOf("Population Adaptation")).toBeLessThan(labels.indexOf("Civilization"));
  });

  it("summarizes deterministic population adaptation state", () => {
    const first = getPopulationAdaptationStateAtTick(baseWorld, 12_000n);
    const second = getPopulationAdaptationStateAtTick(baseWorld, 12_000n);

    expect(first).toEqual(second);
    expect(first.summary.cellCount).toBe(648);
    expect(first.summary.populationCount).toBeGreaterThan(0);
    expect(first.summary.averageFitness).toBeGreaterThan(0);
    expect(first.summary.averageFitness).toBeLessThanOrEqual(1);
    expect(first.summary.averageClimateAdaptation).toBeGreaterThan(0);
  });

  it("emits deterministic adaptation events and health metadata", () => {
    const metrics = metricsCollector();
    const result = runAdaptationSystem({
      world: baseWorld as never,
      tick: 12_000n,
      seed: baseWorld.seed,
      timeScale: 1,
      random: {} as never,
      client: {} as never,
      repositories: {} as never,
      cache: new Map(),
      eventBus: {} as never,
      metrics,
      logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    expect(result.success).toBe(true);
    expect(result.health?.status).toBe("Healthy");
    expect(result.metadata).toMatchObject({ deterministic: true, persistent: true });
    expect(result.events?.every((event) => event.type === "Population Adaptation")).toBe(true);
    expect(metrics.snapshot().cellsProcessed).toBe(648);
    expect(metrics.snapshot().entitiesProcessed).toBeGreaterThan(0);
  });
});
