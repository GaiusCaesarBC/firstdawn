import { describe, expect, it } from "vitest";

import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";
import { advanceHumanTick, spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import {
  createHumanMovementCell,
  createHumanMovementEnvironment,
  evaluateHumanMovement,
} from "../../src/lib/simulation/human-movement";
import type { HumanAgent, HumanGoal, HumanMemory, HumanMvaState, HumanRelationship } from "../../src/lib/simulation/human-types";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "human-movement-test-world",
  name: "Human Movement Test World",
  slug: "human-movement-test-world",
  currentTick: 0n,
  seed: "human-movement-seed",
  timeScale: 1,
  environment: "DEVELOPMENT",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...DEFAULT_WORLD_TIME_CONFIG,
} as any;

function activeGoal(agent: HumanAgent, type: HumanGoal["type"], targetCellId = agent.currentCellId, priority = 1): HumanGoal {
  return {
    id: `${agent.id}:test-goal:${type}:${targetCellId}`,
    type,
    priority,
    createdTick: "0",
    targetId: null,
    targetCellId,
    progress: 0,
    confidence: 0.8,
    reason: type === "Find Food" ? "Hungry" : type === "Find Water" ? "Thirst" : type === "Rest" ? "Tired" : type === "Seek Shelter" ? "Searching For Shelter" : type === "Stay Near Family" ? "Following Parent" : type === "Escape" ? "Danger Nearby" : "Curiosity",
    status: "Active",
  };
}

function needs(agent: HumanAgent, update: Partial<HumanAgent["needs"]>): HumanAgent {
  return {
    ...agent,
    needs: { ...agent.needs, hunger: 0.08, thirst: 0.08, fatigue: 0.08, safety: 0.08, social: 0.08, ...update },
  };
}

function relation(state: HumanMvaState, from: HumanAgent, to: HumanAgent, update: Partial<HumanRelationship> = {}): HumanRelationship[] {
  return state.relationships.map((entry) => entry.fromAgentId === from.id && entry.toAgentId === to.id ? { ...entry, ...update } : entry);
}

function memoryFor(agent: HumanAgent, tags: string[], cellId: string): HumanMemory {
  return {
    id: `${agent.id}:memory:${tags.join("-")}:${cellId}`,
    worldId: agent.worldId,
    agentId: agent.id,
    type: tags.includes("food") ? "Food Source" : tags.includes("water") ? "Water Source" : tags.includes("danger") ? "Danger" : "Safe Area",
    category: "Spatial Memory",
    subjectId: `place:${cellId}`,
    locationCellId: cellId,
    createdTick: "0",
    lastRecalledTick: "0",
    importance: 0.86,
    emotionalWeight: tags.includes("danger") ? 0.82 : 0.42,
    source: "test",
    relatedEntityId: cellId,
    relatedHumanId: null,
    tags,
    notes: "test memory",
    recallCount: 1,
    exposureCount: 1,
    tick: "0",
    cellId,
    participants: [agent.id],
    eventType: "Test",
    summary: "test memory",
    emotionAtEncoding: { ...agent.emotions },
    needContext: { ...agent.needs },
    salience: 0.86,
    confidence: 0.9,
    valence: tags.includes("danger") ? 0.1 : 0.75,
    sourceEventId: "test-event",
    causalLinks: [],
  };
}

function testEnvironment() {
  return createHumanMovementEnvironment([
    createHumanMovementCell({ id: "cell-09-18", neighborIds: ["cell-09-19", "cell-09-17", "cell-08-18", "cell-10-18"], foodAvailability: 0.05, waterAvailability: 0.05, shelterAvailability: 0.2 }),
    createHumanMovementCell({ id: "cell-09-19", neighborIds: ["cell-09-18"], foodAvailability: 0.92, waterAvailability: 0.08, shelterAvailability: 0.2 }),
    createHumanMovementCell({ id: "cell-09-17", neighborIds: ["cell-09-18"], foodAvailability: 0.08, waterAvailability: 0.94, shelterAvailability: 0.2 }),
    createHumanMovementCell({ id: "cell-08-18", neighborIds: ["cell-09-18"], foodAvailability: 0.04, waterAvailability: 0.04, shelterAvailability: 0.82 }),
    createHumanMovementCell({ id: "cell-10-18", neighborIds: ["cell-09-18"], foodAvailability: 0.04, waterAvailability: 0.04, shelterAvailability: 0.1, dangerScore: 0.03 }),
  ]);
}

function decide(agent: HumanAgent, state = spawnFirstTwoHumans(world, 0n), environment = testEnvironment()) {
  return evaluateHumanMovement({
    agent,
    agents: state.agents.map((entry) => entry.id === agent.id ? agent : entry),
    relationships: state.relationships,
    memories: state.memories,
    knowledge: state.knowledge,
    environment,
    tick: 1n,
    seed: world.seed,
  });
}

describe("Human Movement & Mobility Engine", () => {
  it("moves a hungry citizen toward nearby food", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const agent = { ...needs(state.agents[0], { hunger: 0.92 }), currentGoal: activeGoal(state.agents[0], "Find Food", "cell-09-19") };
    const result = decide(agent, { ...state, memories: [memoryFor(agent, ["food"], "cell-09-19")] });

    expect(result.agent.currentCellId).toBe("cell-09-19");
    expect(result.agent.movementIntent).toBe("seek-food");
    expect(result.event?.title).toBe("First Movement");
  });

  it("moves a thirsty citizen toward nearby water", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const agent = { ...needs(state.agents[0], { thirst: 0.94 }), currentGoal: activeGoal(state.agents[0], "Find Water", "cell-09-17") };
    const result = decide(agent, { ...state, memories: [memoryFor(agent, ["water"], "cell-09-17")] });

    expect(result.agent.currentCellId).toBe("cell-09-17");
    expect(result.agent.movementIntent).toBe("seek-water");
  });

  it("moves an explorer into an unknown neighboring cell", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const agent = {
      ...needs(state.agents[0], {}),
      currentGoal: activeGoal(state.agents[0], "Explore", "cell-09-18"),
      familiarityByCell: { "cell-09-18": 0.72, "cell-09-19": 0.4, "cell-09-17": 0.3 },
      curiosityProfile: { ...state.agents[0].curiosityProfile, noveltySeeking: 0.95, riskTolerance: 0.8 },
    };
    const result = decide(agent);

    expect(result.agent.currentCellId).toBe("cell-08-18");
    expect(result.agent.explorationCount).toBe(agent.explorationCount + 1);
  });

  it("moves away from danger", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const environment = createHumanMovementEnvironment([
      createHumanMovementCell({ id: "cell-09-18", neighborIds: ["cell-10-18", "cell-09-19"], dangerScore: 0.86, foodAvailability: 0.2 }),
      createHumanMovementCell({ id: "cell-10-18", neighborIds: ["cell-09-18"], dangerScore: 0.04, shelterAvailability: 0.6 }),
      createHumanMovementCell({ id: "cell-09-19", neighborIds: ["cell-09-18"], dangerScore: 0.7, foodAvailability: 0.8 }),
    ]);
    const agent = { ...needs(state.agents[0], { safety: 0.92 }), currentGoal: activeGoal(state.agents[0], "Escape", "cell-10-18") };
    const result = decide(agent, state, environment);

    expect(result.agent.currentCellId).toBe("cell-10-18");
    expect(result.event?.type).toBe("Human Dangerous Escape");
  });

  it("keeps a family-focused citizen near trusted family", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent, family] = state.agents;
    const familyAgent = { ...family, currentCellId: agent.currentCellId };
    const focused = { ...needs(agent, { social: 0.74 }), currentGoal: { ...activeGoal(agent, "Stay Near Family", agent.currentCellId), targetId: family.id } };
    const result = evaluateHumanMovement({
      agent: focused,
      agents: [focused, familyAgent],
      relationships: relation(state, focused, familyAgent, { kinship: "partner", status: "Family", trust: 0.9, affection: 0.9 }),
      memories: [],
      knowledge: [],
      environment: testEnvironment(),
      tick: 1n,
      seed: world.seed,
    });

    expect(result.agent.currentCellId).toBe(agent.currentCellId);
    expect(result.agent.movementIntent).toBe("stay");
    expect(result.event).toBeNull();
  });

  it("lets a stuck citizen eventually explore", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const agent = {
      ...needs(state.agents[0], {}),
      currentGoal: activeGoal(state.agents[0], "Wander", "cell-09-18", 0.4),
      stuckTicks: 7,
      familiarityByCell: { "cell-09-18": 0.8 },
    };
    const result = decide(agent);

    expect(result.agent.currentCellId).not.toBe("cell-09-18");
    expect(result.agent.stuckTicks).toBe(0);
    expect(result.agent.movementReason).toMatch(/anti-stuck|wandering|unknown/);
  });

  it("allows a resting citizen to stay put", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const agent = { ...needs(state.agents[0], { fatigue: 0.92 }), currentGoal: activeGoal(state.agents[0], "Rest", "cell-09-18") };
    const result = decide(agent);

    expect(result.agent.currentCellId).toBe("cell-09-18");
    expect(result.agent.movementIntent).toBe("rest");
  });

  it("produces the same movement path for the same seed", () => {
    const runPath = () => {
      let state = spawnFirstTwoHumans(world, 0n);
      let agent = { ...state.agents[0], currentGoal: activeGoal(state.agents[0], "Explore", "cell-09-18"), familiarityByCell: { "cell-09-18": 0.7 }, stuckTicks: 4 };
      const path: string[] = [];

      for (let tick = 1n; tick <= 4n; tick += 1n) {
        const result = evaluateHumanMovement({ agent, agents: [agent, state.agents[1]], relationships: state.relationships, memories: [], knowledge: [], environment: testEnvironment(), tick, seed: world.seed });
        agent = result.agent;
        path.push(agent.currentCellId);
      }

      return path;
    };

    expect(runPath()).toEqual(runPath());
  });

  it("exposes movement state in the Atlas", () => {
    const snapshot = buildAtlasSnapshot(world, 1);
    const [agent] = snapshot.humans.agents;

    expect(agent).toMatchObject({
      currentCellId: expect.any(String),
      movementIntent: expect.any(String),
      movementReason: expect.any(String),
      recentPath: expect.any(Array),
      stuckTicks: expect.any(Number),
      distanceTraveled: expect.any(Number),
      explorationCount: expect.any(Number),
    });
    expect("previousCellId" in agent).toBe(true);
    expect("destinationCellId" in agent).toBe(true);
  });

  it("runs movement after goals and before action resolution", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [first] = initial.agents;
    const movingState: HumanMvaState = {
      ...initial,
      agents: initial.agents.map((agent) => agent.id === first.id
        ? { ...agent, needs: { hunger: 0.92, thirst: 0.08, fatigue: 0.08, safety: 0.08, social: 0.08 }, currentGoal: activeGoal(agent, "Find Food", "cell-09-19") }
        : agent),
      memories: [memoryFor(first, ["food"], "cell-09-19")],
    };
    const result = advanceHumanTick(movingState, world.seed, 1n);
    const eventTypes = result.newEvents.map((event) => event.type);
    const movementIndex = eventTypes.findIndex((type) => type.startsWith("Human Movement") || type.startsWith("Human Migration") || type.startsWith("Human Dangerous"));
    const needIndex = eventTypes.findIndex((type) => type === "Human Need Fulfilled");

    expect(movementIndex).toBeGreaterThanOrEqual(0);
    expect(needIndex).toBeGreaterThanOrEqual(0);
    expect(movementIndex).toBeLessThan(needIndex);
    expect(DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label).indexOf("Humans")).toBeLessThan(DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label).indexOf("Goal Decision Engine"));
  });
});