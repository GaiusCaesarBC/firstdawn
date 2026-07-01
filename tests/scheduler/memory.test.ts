import { describe, expect, it } from "vitest";

import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";
import { evaluateGoalDecision } from "../../src/lib/simulation/human-goals";
import {
  advanceHumanTick,
  spawnFirstTwoHumans,
} from "../../src/lib/simulation/human-engine";
import { createHumanMemoryIndex, updateEpisodicMemories } from "../../src/lib/simulation/human-memory";
import type { HumanAgent, HumanCausalEvent, HumanMemory, HumanMvaState, HumanNeeds } from "../../src/lib/simulation/human-types";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { run as runMemorySystem } from "../../src/lib/simulation/systems/memory";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "episodic-memory-test-world",
  name: "Episodic Memory Test World",
  slug: "episodic-memory-test-world",
  currentTick: 0n,
  seed: "episodic-memory-seed",
  timeScale: 1,
  environment: "DEVELOPMENT",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...DEFAULT_WORLD_TIME_CONFIG,
} as any;

function needs(partial: Partial<HumanNeeds>): HumanNeeds {
  return {
    hunger: 0.08,
    thirst: 0.08,
    fatigue: 0.08,
    safety: 0.08,
    social: 0.08,
    ...partial,
  };
}

function withAgent(state: HumanMvaState, update: (agent: HumanAgent) => HumanAgent): { state: HumanMvaState; agent: HumanAgent } {
  const [first] = state.agents;
  const agent = update(first);

  return {
    state: {
      ...state,
      agents: state.agents.map((entry) => entry.id === first.id ? agent : entry),
    },
    agent,
  };
}

function memoryFor(agent: HumanAgent, overrides: Partial<HumanMemory>): HumanMemory {
  return {
    id: `${agent.id}:memory:test:${overrides.type ?? "Food Source"}`,
    worldId: agent.worldId,
    agentId: agent.id,
    type: "Food Source",
    category: "Survival Memory",
    subjectId: "resource:edible-plants",
    locationCellId: agent.currentCellId,
    createdTick: "1",
    lastRecalledTick: "1",
    importance: 0.82,
    emotionalWeight: 0.42,
    source: "test",
    relatedEntityId: null,
    relatedHumanId: null,
    tags: ["food", "resource", "survival"],
    notes: "test memory",
    recallCount: 1,
    exposureCount: 1,
    tick: "1",
    cellId: agent.currentCellId,
    participants: [agent.id],
    eventType: "Human Need Fulfilled",
    summary: "test memory summary",
    emotionAtEncoding: { ...agent.emotions },
    needContext: { ...agent.needs },
    salience: 0.82,
    confidence: 0.86,
    valence: 0.7,
    sourceEventId: "test-event",
    causalLinks: [],
    ...overrides,
  };
}

function eventFor(agent: HumanAgent, tick: bigint, overrides: Partial<HumanCausalEvent> = {}): HumanCausalEvent {
  return {
    id: `${agent.worldId}:test-event:${tick.toString()}`,
    worldId: agent.worldId,
    tick: tick.toString(),
    type: "Human Need Fulfilled",
    title: "Human Ate Food",
    summary: "human reduced hunger by gathering edible food.",
    agentIds: [agent.id],
    cellId: agent.currentCellId,
    causes: { hunger: 0.9 },
    effects: { hungerAfter: 0.4 },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: false,
    ...overrides,
  };
}

function metricsCollector() {
  return {
    addCells: () => undefined,
    addEntities: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    snapshot: () => ({ cellsProcessed: 0, entitiesProcessed: 0, warnings: [], errors: [] }),
  };
}

describe("Episodic Memory Engine", () => {
  it("registers after goal decisions and before civilization", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Goal Decision Engine")).toBeLessThan(labels.indexOf("Episodic Memory Engine"));
    expect(labels.indexOf("Episodic Memory Engine")).toBeLessThan(labels.indexOf("Civilization"));
  });

  it("lets food memories influence Find Food goal scoring", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const { state, agent } = withAgent(initial, (entry) => ({
      ...entry,
      needs: needs({ hunger: 0.66 }),
      beliefs: { ...entry.beliefs, "nearby:food": { ...entry.beliefs["nearby:food"], confidence: 0.05 } },
    }));
    const foodMemory = memoryFor(agent, { confidence: 0.95, importance: 0.92 });
    const result = evaluateGoalDecision({
      worldId: state.worldId,
      tick: 4n,
      seed: world.seed,
      agent,
      agents: state.agents,
      relationships: state.relationships,
      memories: [foodMemory],
      memoryIndex: createHumanMemoryIndex([foodMemory]),
    });
    const foodCandidate = result.candidates.find((candidate) => candidate.type === "Find Food");

    expect(foodCandidate?.scoreInputs.rememberedFood).toBeGreaterThan(0.7);
    expect(foodCandidate?.targetCellId).toBe(agent.currentCellId);
  });

  it("lets danger memories override exploration pressure", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const { state, agent } = withAgent(initial, (entry) => ({
      ...entry,
      needs: needs({ safety: 0.18, hunger: 0.1, thirst: 0.1 }),
      motivations: { ...entry.motivations, explore: 1, observeSurroundings: 1 },
      curiosityProfile: { ...entry.curiosityProfile, noveltySeeking: 1, riskTolerance: 1 },
    }));
    const dangerMemory = memoryFor(agent, {
      type: "Danger",
      category: "Survival Memory",
      subjectId: "danger:local-threat",
      tags: ["danger", "survival"],
      confidence: 0.98,
      importance: 0.96,
      emotionalWeight: 0.9,
      valence: 0.1,
    });
    const result = evaluateGoalDecision({
      worldId: state.worldId,
      tick: 6n,
      seed: world.seed,
      agent,
      agents: state.agents,
      relationships: state.relationships,
      memories: [dangerMemory],
      memoryIndex: createHumanMemoryIndex([dangerMemory]),
    });

    expect(["Escape", "Seek Safety"]).toContain(result.agent.currentGoal?.type);
    expect(result.candidates.find((candidate) => candidate.type === "Explore")?.scoreInputs.rememberedDanger).toBeGreaterThan(0.7);
  });

  it("reinforces repeated visits instead of duplicating memories", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [agent] = initial.agents;
    const first = updateEpisodicMemories({ memories: [], agents: [agent], events: [eventFor(agent, 1n)], tick: 1n });
    const second = updateEpisodicMemories({ memories: first.memories, agents: [agent], events: [eventFor(agent, 2n, { id: `${agent.worldId}:test-event:2` })], tick: 2n });

    expect(second.memories).toHaveLength(1);
    expect(second.memories[0].exposureCount).toBe(2);
    expect(second.memories[0].confidence).toBeGreaterThan(first.memories[0].confidence);
  });

  it("decays confidence deterministically", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [agent] = initial.agents;
    const memory = memoryFor(agent, { confidence: 0.7, importance: 0.32, tick: "1", createdTick: "1", lastRecalledTick: "1", locationCellId: "cell-away", cellId: "cell-away" });
    const first = updateEpisodicMemories({ memories: [memory], agents: [agent], events: [], tick: 80n });
    const second = updateEpisodicMemories({ memories: [memory], agents: [agent], events: [], tick: 80n });

    expect(first.memories[0].confidence).toBeLessThan(memory.confidence);
    expect(first.memories).toEqual(second.memories);
  });

  it("produces identical memories for identical world seeds", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const first = advanceHumanTick(initial, world.seed, 1n);
    const second = advanceHumanTick(initial, world.seed, 1n);

    expect(first.state.memories).toEqual(second.state.memories);
    expect(first.memoryEvents).toEqual(second.memoryEvents);
  });

  it("exposes expected memory data in Atlas snapshots", () => {
    const snapshot = buildAtlasSnapshot(world, 1);
    const [agent] = snapshot.humans.agents;

    expect(agent.memoryCount).toBeGreaterThan(0);
    expect(agent.averageMemoryConfidence).toBeGreaterThan(0);
    expect(agent.recentMemories[0]).toMatchObject({ confidence: expect.any(Number), importance: expect.any(Number) });
  });

  it("emits deterministic memory system events for important memories", () => {
    const context = {
      world: { ...world, currentTick: 8n },
      tick: 8n,
      seed: world.seed,
      timeScale: 1,
      random: {} as any,
      client: {} as any,
      repositories: { client: {} as any },
      cache: new Map(),
      eventBus: {} as any,
      metrics: metricsCollector(),
      logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
      fidelityMode: "accurate",
    };

    const result = runMemorySystem(context as any);

    expect(result.success).toBe(true);
    expect(result.metadata).toMatchObject({ deterministic: true, pluginBasedMemoryTypes: true });
  });
});
