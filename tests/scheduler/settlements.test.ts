import { describe, expect, it } from "vitest";

import { createChroniclerReport } from "../../src/lib/simulation/chronicler";
import { evaluateGoalDecision } from "../../src/lib/simulation/human-goals";
import { getHumanMvaStateAtTick, spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import type { HumanAgent, HumanCausalEvent, HumanMemory, HumanMvaState, HumanRelationship } from "../../src/lib/simulation/human-types";
import {
  createHomeProfile,
  DEFAULT_CAMP_FORMATION_SCORING,
  getSettlementStateAtTick,
  getSettlementStateFromHumanState,
  registerSettlementType,
  settlementEventToCausalEvent,
} from "../../src/lib/simulation/settlement-engine";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "settlement-engine-test-world",
  name: "Settlement Engine Test World",
  slug: "settlement-engine-test-world",
  currentTick: 0n,
  seed: "settlement-engine-seed",
  timeScale: 1,
  environment: "DEVELOPMENT",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...DEFAULT_WORLD_TIME_CONFIG,
} as any;

function relationship(state: HumanMvaState, from: HumanAgent, to: HumanAgent, overrides: Partial<HumanRelationship> = {}): HumanRelationship {
  const existing = state.relationships.find((entry) => entry.fromAgentId === from.id && entry.toAgentId === to.id);

  if (!existing) {
    throw new Error(`missing relationship ${from.id} -> ${to.id}`);
  }

  return { ...existing, ...overrides };
}

function dangerMemory(agent: HumanAgent, cellId: string): HumanMemory {
  return {
    id: `${agent.id}:danger-memory:${cellId}`,
    worldId: agent.worldId,
    agentId: agent.id,
    type: "Danger",
    category: "Survival Memory",
    subjectId: "danger:local-threat",
    locationCellId: cellId,
    createdTick: "1",
    lastRecalledTick: "3",
    importance: 0.9,
    emotionalWeight: 0.9,
    source: "test",
    relatedEntityId: null,
    relatedHumanId: null,
    tags: ["danger", "survival"],
    notes: "Unsafe camp test memory.",
    recallCount: 3,
    exposureCount: 3,
    tick: "3",
    cellId,
    participants: [agent.id],
    eventType: "Human Safety Check Failed",
    summary: "A serious threat was remembered here.",
    emotionAtEncoding: agent.emotions,
    needContext: agent.needs,
    salience: 0.9,
    confidence: 0.96,
    valence: 0.08,
    sourceEventId: "danger-event",
    causalLinks: ["danger"],
  };
}

function safetyEvent(agent: HumanAgent, tick: bigint): HumanCausalEvent {
  return {
    id: `${agent.worldId}:test-safety:${tick.toString()}:${agent.id}`,
    worldId: agent.worldId,
    tick: tick.toString(),
    type: "Human Safety Secured",
    title: "Human Found Safer Ground",
    summary: "A citizen settled into safer ground.",
    agentIds: [agent.id],
    cellId: agent.currentCellId,
    causes: { test: true },
    effects: { safetyAfter: 0.2 },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: true,
  };
}

describe("Emergent Camps & Settlements Engine", () => {
  it("forms a camp naturally from repeated human behavior", () => {
    const humanResult = getHumanMvaStateAtTick(world, 6n);
    const previousHumanResult = getHumanMvaStateAtTick(world, 5n);
    const result = getSettlementStateAtTick({ world, tick: 6n, humanResult, previousHumanResult });
    const sharedHomeCellId = humanResult.state.agents[0]?.homeCellId;

    expect(result.settlements.length).toBeGreaterThan(0);
    expect(result.settlements[0]).toMatchObject({
      homeCellId: sharedHomeCellId,
      currentPopulation: 2,
    });
    expect(result.settlements[0].storedResources.foodCache + result.settlements[0].storedResources.waterStorage).toBeGreaterThan(0);
  });

  it("keeps trusted families clustered through relationship scoring", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const enriched: HumanMvaState = {
      ...state,
      relationships: [
        relationship(state, first, second, { kinship: "partner", trust: 0.92, affection: 0.88, status: "Mate" }),
        relationship(state, second, first, { kinship: "partner", trust: 0.9, affection: 0.86, status: "Mate" }),
      ],
      causalEvents: [safetyEvent(first, 1n), safetyEvent(second, 1n)],
    };
    const result = getSettlementStateFromHumanState({ worldId: world.id, tick: 2n, state: enriched, weights: { ...DEFAULT_CAMP_FORMATION_SCORING, activationScore: 0.2 } });

    expect(result.scoring[0].reasons.familyCluster).toBeGreaterThan(0);
    expect(result.settlements[0].culturalTraits).toContain("family-cluster");
  });

  it("abandons unsafe camps without deleting their history", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const oldCell = first.currentCellId;
    const movedAgents = state.agents.map((agent) => ({
      ...agent,
      currentCellId: "cell-10-18",
      homeCellId: "cell-10-18",
      homeProfile: createHomeProfile("cell-10-18", 3n),
    }));
    const previous = {
      ...state,
      causalEvents: [safetyEvent(first, 1n), safetyEvent(second, 1n)],
    };
    const current: HumanMvaState = {
      ...state,
      agents: movedAgents,
      memories: [dangerMemory(first, oldCell), dangerMemory(second, oldCell)],
      causalEvents: [{ ...safetyEvent(first, 3n), type: "Human Safety Check Failed", title: "Human Failed Safety Check", cellId: oldCell }],
    };
    const result = getSettlementStateFromHumanState({ worldId: world.id, tick: 3n, state: current, previousState: previous, weights: { ...DEFAULT_CAMP_FORMATION_SCORING, activationScore: 0.2, abandonmentDanger: 0.5 } });
    const abandoned = result.settlements.find((settlement) => settlement.homeCellId === oldCell);

    expect(abandoned?.status).toBe("abandoned");
    expect(abandoned?.history.some((entry) => entry.type === "Camp Abandoned")).toBe(true);
  });

  it("repeated visits increase permanence", () => {
    const early = getSettlementStateAtTick({ world, tick: 3n, humanResult: getHumanMvaStateAtTick(world, 3n), previousHumanResult: getHumanMvaStateAtTick(world, 2n) });
    const later = getSettlementStateAtTick({ world, tick: 4n, humanResult: getHumanMvaStateAtTick(world, 4n), previousHumanResult: getHumanMvaStateAtTick(world, 3n) });

    expect(later.scoring[0].permanence).toBeGreaterThanOrEqual(early.scoring[0].permanence);
  });

  it("home influences future goals", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent] = state.agents;
    const homeProfile = {
      ...createHomeProfile(agent.currentCellId, 0n),
      cellAffinities: { [agent.currentCellId]: 0.95, "cell-10-18": 0.12 },
    };
    const awayAgent: HumanAgent = {
      ...agent,
      currentCellId: "cell-10-18",
      homeProfile,
      homeCellId: homeProfile.primaryHomeCellId,
      needs: { hunger: 0.05, thirst: 0.05, fatigue: 0.7, safety: 0.42, social: 0.1 },
    };
    const result = evaluateGoalDecision({
      worldId: state.worldId,
      tick: 2n,
      seed: world.seed,
      agent: awayAgent,
      agents: [awayAgent, state.agents[1]],
      relationships: state.relationships,
      memories: [],
    });

    expect(result.candidates.some((candidate) => candidate.type === "Return Home")).toBe(true);
    expect(result.agent.currentGoal?.targetCellId).toBe(homeProfile.primaryHomeCellId);
  });

  it("exposes settlement data through Atlas", () => {
    const snapshot = buildAtlasSnapshot({ ...world, currentTick: 24n }, 2);

    expect(snapshot.settlements.activeCount).toBeGreaterThan(0);
    expect(snapshot.settlements.settlements[0]).toMatchObject({
      name: expect.any(String),
      population: expect.any(Number),
      storedResources: expect.any(Object),
      knownKnowledge: expect.any(Array),
      majorEvents: expect.any(Array),
    });
  }, 240_000);

  it("records settlement milestones for the Chronicler", () => {
    const humanResult = getHumanMvaStateAtTick(world, 6n);
    const result = getSettlementStateAtTick({ world, tick: 6n, humanResult, previousHumanResult: null, weights: { ...DEFAULT_CAMP_FORMATION_SCORING, activationScore: 0.2 } });
    const causalEvents = result.events.map(settlementEventToCausalEvent);
    const report = createChroniclerReport(humanResult.state, causalEvents);

    expect(report.entries.some((entry) => entry.title.includes("Camp") || entry.title.includes("Food") || entry.title.includes("Fire"))).toBe(true);
  });

  it("identical seeds produce identical settlements", () => {
    const firstWorld = { ...world, id: "settlement-determinism-a", seed: "same-seed" };
    const secondWorld = { ...world, id: "settlement-determinism-b", seed: "same-seed" };
    const first = getSettlementStateAtTick({ world: firstWorld, tick: 6n, humanResult: getHumanMvaStateAtTick(firstWorld, 6n), previousHumanResult: getHumanMvaStateAtTick(firstWorld, 5n) });
    const second = getSettlementStateAtTick({ world: secondWorld, tick: 6n, humanResult: getHumanMvaStateAtTick(secondWorld, 6n), previousHumanResult: getHumanMvaStateAtTick(secondWorld, 5n) });

    const normalize = (value: unknown, worldId: string) => JSON.parse(JSON.stringify(value).replaceAll(worldId, "world"));

    expect(normalize(first.settlements, firstWorld.id)).toEqual(normalize(second.settlements, secondWorld.id));
  });

  it("keeps settlement types extensible and scheduler order correct", () => {
    registerSettlementType({ id: "test-harbor-camp", label: "Test Harbor Camp", minimumPermanence: 0.12, minimumImportance: 0.12, minimumPopulation: 1, tags: ["test"] });
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Communication Engine")).toBeLessThan(labels.indexOf("Emergent Camps & Settlements Engine"));
    expect(labels.indexOf("Emergent Camps & Settlements Engine")).toBeLessThan(labels.indexOf("Civilization"));
  });
});
