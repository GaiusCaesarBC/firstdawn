import { describe, expect, it } from "vitest";

import { createChroniclerReport } from "../../src/lib/simulation/chronicler";
import { getResourceStorageStateFromHumanState, registerResourceType, resourceStorageEventToCausalEvent } from "../../src/lib/simulation/resource-storage-engine";
import { spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import type { HumanAgent, HumanMvaState, HumanRelationship } from "../../src/lib/simulation/human-types";
import { createHomeProfile } from "../../src/lib/simulation/settlement-engine";
import type { Settlement, SettlementTickResult } from "../../src/lib/simulation/settlement-engine";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";
import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";

const world = {
  id: "resource-storage-test-world",
  name: "Resource Storage Test World",
  slug: "resource-storage-test-world",
  currentTick: 0n,
  seed: "resource-storage-seed",
  timeScale: 1,
  environment: "DEVELOPMENT",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...DEFAULT_WORLD_TIME_CONFIG,
} as any;

function stableState(overrides: Partial<HumanAgent> = {}): HumanMvaState {
  const base = spawnFirstTwoHumans(world, 0n);
  const home = createHomeProfile(base.agents[0].currentCellId, 4n);
  const agents = base.agents.map((agent) => ({
    ...agent,
    currentCellId: home.primaryHomeCellId,
    homeCellId: home.primaryHomeCellId,
    homeProfile: { ...home, cellAffinities: { [home.primaryHomeCellId]: 0.98 } },
    needs: { hunger: 0.05, thirst: 0.05, fatigue: 0.08, safety: 0.04, social: 0.08 },
    emotions: { ...agent.emotions, fear: 0.04, distress: 0.04, comfort: 0.82, trust: 0.84, attachment: 0.78 },
    confidence: 0.72,
    ageStage: "Adult" as const,
    approxAgeYears: 24,
    ageDays: 24 * 365,
    ...overrides,
  }));

  return {
    ...base,
    tick: "4",
    agents,
    relationships: base.relationships.map((relationship) => ({
      ...relationship,
      kinship: "partner",
      status: "Mate",
      trust: 0.92,
      affection: 0.88,
      fear: 0.02,
      rivalry: 0,
    } satisfies HumanRelationship)),
  };
}

function childState(): HumanMvaState {
  const state = stableState();
  const child: HumanAgent = {
    ...state.agents[0],
    id: `${world.id}:child:test`,
    ageStage: "Child",
    approxAgeYears: 6,
    ageDays: 6 * 365,
    birthTick: "-2190",
    biologicalParentIds: state.agents.map((agent) => agent.id),
    guardianIds: state.agents.map((agent) => agent.id),
    familyId: state.agents[0].familyId,
    needs: { hunger: 0.94, thirst: 0.18, fatigue: 0.2, safety: 0.08, social: 0.18 },
  };

  return {
    ...state,
    agents: [
      ...state.agents.map((agent) => ({ ...agent, childIds: [child.id] })),
      child,
    ].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function settlementResult(state: HumanMvaState, overrides: Partial<Settlement> = {}): SettlementTickResult {
  const cellId = state.agents[0].homeCellId;
  const settlement: Settlement = {
    id: `${state.worldId}:settlement:${cellId}`,
    name: "Resource Test Camp",
    foundedTick: "1",
    founderIds: state.agents.map((agent) => agent.id).sort(),
    currentPopulation: state.agents.filter((agent) => agent.isAlive).length,
    peakPopulation: state.agents.length,
    homeCellId: cellId,
    occupiedCells: [cellId],
    type: "Permanent Settlement",
    status: "permanent",
    importance: 0.9,
    permanence: 0.92,
    storedResources: { foodCache: 5, waterStorage: 5, fire: 1, sharedSupplies: 4, simpleShelter: 1 },
    structures: ["Shared Fire", "Food Cache", "Simple Shelter"],
    culturalTraits: ["resource-sharing"],
    discoveryHistory: [],
    relationshipGraph: [],
    knowledgeSummary: [],
    lastActivityTick: "4",
    tags: ["settlement", "permanent"],
    history: [],
    ...overrides,
  };

  return { worldId: state.worldId, tick: state.tick, settlements: [settlement], events: [], scoring: [] };
}

describe("Resource Storage & Shared Supplies Engine", () => {
  it("citizens deposit excess food and firewood into settlement storage", () => {
    const state = stableState();
    const result = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: settlementResult(state) });
    const storage = result.storages[0];

    expect(storage.resources.some((resource) => resource.type === "food")).toBe(true);
    expect(storage.resources.some((resource) => resource.type === "firewood")).toBe(true);
    expect(storage.history.some((entry) => entry.type === "Deposit")).toBe(true);
    expect(result.scoring[0].depositScore).toBeGreaterThan(0.58);
  });

  it("hungry citizens withdraw food without random selection", () => {
    const state = stableState();
    const first = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: settlementResult(state) });
    const hungry = {
      ...state,
      agents: state.agents.map((agent, index) => index === 0 ? { ...agent, needs: { ...agent.needs, hunger: 0.94 } } : agent),
    };
    const second = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 5n, state: hungry, settlements: settlementResult(hungry), previousStorage: first });

    expect(second.storages[0].history.some((entry) => entry.type === "Withdrawal" && entry.resourceType === "food")).toBe(true);
    expect(second.settlementSummaries[0].dailyConsumption).toBeGreaterThan(0);
  });

  it("feeds children before adults from shared storage", () => {
    const state = childState();
    const first = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 4n, state: stableState(), settlements: settlementResult(stableState()) });
    const second = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 5n, state, settlements: settlementResult(state), previousStorage: first });
    const firstWithdrawal = second.storages[0].history.find((entry) => entry.type === "Withdrawal");

    expect(firstWithdrawal?.humanId).toBe(`${world.id}:child:test`);
  });

  it("spoils food deterministically while firewood persists", () => {
    const state = stableState();
    const first = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: settlementResult(state) });
    const later = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 30n, state, settlements: settlementResult(state), previousStorage: first });

    expect(later.settlementSummaries[0].spoilage).toBeGreaterThan(0);
    expect(later.settlementSummaries[0].firewood).toBeGreaterThan(0);
  });

  it("trust affects contribution", () => {
    const trusting = stableState();
    const wary = {
      ...stableState(),
      agents: stableState().agents.map((agent) => ({ ...agent, emotions: { ...agent.emotions, trust: 0.05, attachment: 0.05 } })),
      relationships: stableState().relationships.map((relationship) => ({ ...relationship, trust: 0.05, affection: 0.08, fear: 0.4 })),
    };
    const high = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 4n, state: trusting, settlements: settlementResult(trusting) });
    const low = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 4n, state: wary, settlements: settlementResult(wary) });

    expect(high.scoring[0].depositScore).toBeGreaterThan(low.scoring[0].depositScore);
  });

  it("storage improves settlement permanence inputs through resource summaries", () => {
    const state = stableState();
    const result = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: settlementResult(state) });

    expect(result.settlementSummaries[0].capacityUsed).toBeGreaterThan(0);
    expect(result.settlementSummaries[0].mostNeededResources).toEqual(expect.any(Array));
  });

  it("exposes storage through Atlas settlement and citizen inspectors", () => {
    const snapshot = buildAtlasSnapshot(world, 2);

    expect(snapshot.settlements.settlements[0]).toMatchObject({
      storageCapacity: expect.any(Number),
      foodSupply: expect.any(Number),
      largestContributors: expect.any(Array),
      resourceTrends: expect.any(Array),
    });
    expect(snapshot.humans.agents[0]).toMatchObject({
      personalInventory: expect.any(Array),
      recentDeposits: expect.any(Array),
      contributionHistory: expect.any(Array),
    });
  }, 60_000);

  it("records storage milestones for the Chronicler", () => {
    const state = stableState();
    const result = getResourceStorageStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: settlementResult(state) });
    const report = createChroniclerReport(state, result.events.map(resourceStorageEventToCausalEvent));

    expect(report.entries.some((entry) => entry.title === "First Shared Food Cache" || entry.title === "First Stored Firewood")).toBe(true);
  });

  it("identical seeds produce identical storage and resource types remain extensible", () => {
    registerResourceType({ id: "test-seeds", label: "Test Seeds", category: "material", baseShelfLifeTicks: 100, spoilageRate: 0.01, storageDensity: 0.2, tags: ["future-agriculture"] });
    const firstState = stableState();
    const secondState = { ...stableState(), worldId: "resource-storage-equivalent-world" };
    const first = getResourceStorageStateFromHumanState({ worldId: firstState.worldId, tick: 4n, state: firstState, settlements: settlementResult(firstState) });
    const second = getResourceStorageStateFromHumanState({ worldId: secondState.worldId, tick: 4n, state: secondState, settlements: settlementResult(secondState) });
    const normalize = (value: unknown, worldId: string) => JSON.parse(JSON.stringify(value).replaceAll(world.id, "world").replaceAll(worldId, "world"));

    expect(normalize(first.storages, firstState.worldId)).toEqual(normalize(second.storages, secondState.worldId));
  });

  it("registers after family generations and before civilization", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Family & Generations Engine")).toBeLessThan(labels.indexOf("Resource Storage & Shared Supplies Engine"));
    expect(labels.indexOf("Resource Storage & Shared Supplies Engine")).toBeLessThan(labels.indexOf("Civilization"));
  });
});
