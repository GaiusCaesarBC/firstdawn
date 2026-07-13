import { describe, expect, it } from "vitest";

import { getFamilyGenerationsStateFromHumanState } from "../../src/lib/simulation/family-generations-engine";
import { spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import { HUMAN_TICK_RESULT_CACHE_KEY } from "../../src/lib/simulation/human-goals";
import type { HumanAgent, HumanKnowledge, HumanMvaState, HumanRelationship } from "../../src/lib/simulation/human-types";
import { createHomeProfile } from "../../src/lib/simulation/settlement-engine";
import type { Settlement, SettlementTickResult } from "../../src/lib/simulation/settlement-engine";
import { run as runFamilyGenerationsSystem } from "../../src/lib/simulation/systems/family-generations";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "family-engine-test-world",
  name: "Family Engine Test World",
  slug: "family-engine-test-world",
  currentTick: 0n,
  seed: "family-engine-seed",
  timeScale: 1,
  environment: "DEVELOPMENT",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...DEFAULT_WORLD_TIME_CONFIG,
} as any;

function stableSettlement(state: HumanMvaState, overrides: Partial<Settlement> = {}): SettlementTickResult {
  const cellId = state.agents[0].homeCellId;
  const settlement: Settlement = {
    id: `${state.worldId}:settlement:${cellId}`,
    name: "Stable Family Camp",
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
    culturalTraits: ["family-cluster"],
    discoveryHistory: [],
    relationshipGraph: [],
    knowledgeSummary: [],
    lastActivityTick: "4",
    tags: ["settlement", "permanent"],
    history: [],
    ...overrides,
  };
  return { worldId: state.worldId, tick: "4", settlements: [settlement], events: [], scoring: [] };
}

function stableFamilyState(): HumanMvaState {
  const base = spawnFirstTwoHumans(world, 0n);
  const home = createHomeProfile(base.agents[0].currentCellId, 4n);
  const agents = base.agents.map((agent) => ({
    ...agent,
    currentCellId: home.primaryHomeCellId,
    homeCellId: home.primaryHomeCellId,
    homeProfile: { ...home, cellAffinities: { [home.primaryHomeCellId]: 0.98 } },
    needs: { hunger: 0.05, thirst: 0.05, fatigue: 0.08, safety: 0.04, social: 0.08 },
    emotions: { ...agent.emotions, fear: 0.04, distress: 0.06, comfort: 0.8, trust: 0.75, attachment: 0.72 },
    ageStage: "Adult" as const,
    approxAgeYears: 22,
    ageDays: 22 * 365,
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
      affection: 0.9,
      attraction: 0.92,
      companionship: 0.86,
      fear: 0.02,
      rivalry: 0,
    } satisfies HumanRelationship)),
  };
}

function survivalKnowledge(agent: HumanAgent): HumanKnowledge {
  return {
    id: `${agent.id}:knowledge:water`,
    worldId: agent.worldId,
    agentId: agent.id,
    topic: `Safe drinking water at ${agent.currentCellId}`,
    category: "water",
    discoveredTick: "1",
    learnedTick: "1",
    sourceType: "personal-discovery",
    sourceHumanId: null,
    originatingHumanId: agent.id,
    confidence: 0.9,
    mastery: 0.7,
    reliability: 0.88,
    practiceCount: 3,
    teachingCount: 0,
    learnerHumanIds: [],
    lastUsedTick: "3",
    lastTaughtTick: null,
    importance: 0.86,
    isForgotten: false,
    contradicts: [],
    tags: ["water", "survival", agent.currentCellId],
    history: [],
  };
}

describe("Family & Generations Engine", () => {
  it("creates a birth under stable deterministic conditions", () => {
    const state = stableFamilyState();
    const result = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state) });
    const child = result.state.agents.find((agent) => agent.ageStage === "Infant");

    expect(child).toBeTruthy();
    expect(result.events.some((event) => event.kind === "first birth")).toBe(true);
    expect(result.scoring[0].allowed).toBe(true);
  });

  it("promotes a post-birth state into the canonical human result", () => {
    const state = stableFamilyState();
    const cache = new Map<string, unknown>();
    cache.set(HUMAN_TICK_RESULT_CACHE_KEY, {
      state,
      newEvents: [],
      memoryEvents: [],
      relationshipEvents: [],
      knowledgeEvents: [],
      communicationEvents: [],
      chroniclerReport: { entries: [], headline: null },
    });

    runFamilyGenerationsSystem({
      world,
      tick: 4n,
      seed: world.seed,
      timeScale: 1,
      random: {} as never,
      client: {} as never,
      repositories: { client: {} as never },
      cache,
      eventBus: {} as never,
      metrics: { addEntities: () => undefined } as never,
      logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
      fidelityMode: "accurate",
    });

    const promoted = cache.get(HUMAN_TICK_RESULT_CACHE_KEY) as { state: HumanMvaState };
    expect(promoted.state.agents).toHaveLength(3);
    expect(promoted.state.agents.filter((agent) => agent.approxAgeYears < 18)).toHaveLength(1);
  });
  it("does not create a birth under unsafe or starving conditions", () => {
    const state = {
      ...stableFamilyState(),
      agents: stableFamilyState().agents.map((agent) => ({ ...agent, needs: { hunger: 0.95, thirst: 0.9, fatigue: 0.5, safety: 0.9, social: 0.4 }, emotions: { ...agent.emotions, fear: 0.86, distress: 0.8 } })),
    };
    const result = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state, { storedResources: { foodCache: 0, waterStorage: 0, fire: 0, sharedSupplies: 0, simpleShelter: 0 }, permanence: 0.2, importance: 0.2, status: "forming" }) });

    expect(result.state.agents.every((agent) => agent.ageStage !== "Infant")).toBe(true);
    expect(result.scoring[0].allowed).toBe(false);
  });

  it("gives newborns deterministic family-resembling appearance", () => {
    const state = stableFamilyState();
    const result = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state), worldSeed: world.seed });
    const child = result.state.agents.find((agent) => agent.ageStage === "Infant")!;
    const parents = result.state.agents.filter((agent) => child.biologicalParentIds.includes(agent.id));
    const childTraits = child.appearance;
    const resemblanceCount = [
      parents.some((parent) => parent.appearance.skinTone === childTraits.skinTone),
      parents.some((parent) => parent.appearance.hairColor === childTraits.hairColor),
      parents.some((parent) => parent.appearance.eyeColor === childTraits.eyeColor),
      parents.some((parent) => parent.appearance.bodyBuild === childTraits.bodyBuild),
    ].filter(Boolean).length;

    expect(child.appearance.seed).toContain(child.id);
    expect(resemblanceCount).toBeGreaterThanOrEqual(2);
    expect(parents.map((parent) => parent.appearance)).not.toContainEqual(child.appearance);
  });
  it("links child, parents, siblings, mate, and family relationships", () => {
    const state = stableFamilyState();
    const result = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state) });
    const child = result.state.agents.find((agent) => agent.ageStage === "Infant")!;
    const parents = result.state.agents.filter((agent) => child.biologicalParentIds.includes(agent.id));

    expect(child.guardianIds).toEqual(child.biologicalParentIds);
    expect(parents.every((parent) => parent.childIds.includes(child.id))).toBe(true);
    expect(result.state.relationships.some((relationship) => relationship.fromAgentId === child.id && relationship.kinship === "child" && relationship.status === "Family")).toBe(true);
    expect(parents.every((parent) => parent.mateId)).toBe(true);
  });

  it("keeps children near guardians and gives them inherited home identity", () => {
    const state = stableFamilyState();
    const result = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state) });
    const child = result.state.agents.find((agent) => agent.ageStage === "Infant")!;
    const guardian = result.state.agents.find((agent) => agent.id === child.guardianIds[0])!;

    expect(child.currentCellId).toBe(guardian.currentCellId);
    expect(child.currentGoal?.type).toBe("Stay Near Family");
    expect(child.birthplaceSettlementId).toBe(stableSettlement(state).settlements[0].id);
    expect(child.inheritedHomeCellId).toBe(stableSettlement(state).settlements[0].homeCellId);
  });

  it("passes family survival knowledge to children", () => {
    const state = stableFamilyState();
    const teacher = state.agents[0];
    const result = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state: { ...state, knowledge: [survivalKnowledge(teacher)] }, settlements: stableSettlement(state) });
    const child = result.state.agents.find((agent) => agent.ageStage === "Infant")!;

    expect(result.state.knowledge.some((entry) => entry.agentId === child.id && entry.sourceType === "inherited-family-teaching")).toBe(true);
    expect(result.events.some((event) => event.kind === "child learned from parent")).toBe(true);
  });

  it("anchors settlement permanence with family summaries", () => {
    const state = stableFamilyState();
    const result = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state) });

    expect(result.settlementSummaries[0]).toMatchObject({ births: 1, children: 1 });
    expect(result.settlementSummaries[0].familiesPresent.length).toBeGreaterThan(0);
  });

  it("creates grief memory when family dies", () => {
    const state = stableFamilyState();
    const born = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state) });
    const child = born.state.agents.find((agent) => agent.ageStage === "Infant")!;
    const deadChildState = { ...born.state, agents: born.state.agents.map((agent) => agent.id === child.id ? { ...agent, isAlive: false } : agent) };
    const grief = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 5n, state: deadChildState, previousState: born.state, settlements: stableSettlement(born.state) });

    expect(grief.events.some((event) => event.kind === "family death")).toBe(true);
    expect(grief.state.memories.some((memory) => memory.tags.includes("grief") && memory.relatedHumanId === child.id)).toBe(true);
  });

  it("persists lineages across generations and identical seeds", () => {
    const state = stableFamilyState();
    const first = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state) });
    const second = getFamilyGenerationsStateFromHumanState({ worldId: world.id, tick: 4n, state, settlements: stableSettlement(state) });

    expect(first.lineages[0].livingDescendantIds.length).toBeGreaterThan(0);
    expect(first.families).toEqual(second.families);
    expect(first.state.agents).toEqual(second.state.agents);
  });

  it("exposes family tree through Atlas", () => {
    const snapshot = buildAtlasSnapshot(world, 2);
    expect(snapshot.families.families.length).toBeGreaterThan(0);
    expect(snapshot.families.families[0]).toMatchObject({ memberIds: expect.any(Array), lineageId: expect.any(String) });
    expect(snapshot.settlements.settlements[0]).toHaveProperty("familiesPresent");
  }, 240_000);

  it("registers after settlements and before civilization", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Emergent Camps & Settlements Engine")).toBeLessThan(labels.indexOf("Family & Generations Engine"));
    expect(labels.indexOf("Family & Generations Engine")).toBeLessThan(labels.indexOf("Civilization"));
  });
});

