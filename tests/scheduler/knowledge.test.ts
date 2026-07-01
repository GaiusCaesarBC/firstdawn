import { describe, expect, it } from "vitest";

import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";
import { advanceHumanTick, spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import { evaluateGoalDecision } from "../../src/lib/simulation/human-goals";
import {
  getHumanKnowledgeCategories,
  registerHumanKnowledgeCategory,
  updateKnowledgeEngine,
} from "../../src/lib/simulation/human-knowledge";
import type {
  HumanAgent,
  HumanCausalEvent,
  HumanKnowledge,
  HumanMemory,
  HumanRelationship,
  HumanTeachingRecord,
} from "../../src/lib/simulation/human-types";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { run as runKnowledgeSystem } from "../../src/lib/simulation/systems/knowledge";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "knowledge-engine-test-world",
  name: "Knowledge Engine Test World",
  slug: "knowledge-engine-test-world",
  currentTick: 0n,
  seed: "knowledge-engine-seed",
  timeScale: 1,
  environment: "DEVELOPMENT",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...DEFAULT_WORLD_TIME_CONFIG,
} as any;

function eventFor(agent: HumanAgent, tick: bigint, overrides: Partial<HumanCausalEvent> = {}): HumanCausalEvent {
  return {
    id: `${agent.worldId}:knowledge-test-event:${tick.toString()}:${overrides.type ?? "Human Need Fulfilled"}`,
    worldId: agent.worldId,
    tick: tick.toString(),
    type: "Human Need Fulfilled",
    title: "Human Drank Water",
    summary: "human reduced thirst by finding water.",
    agentIds: [agent.id],
    cellId: agent.currentCellId,
    causes: { thirst: 0.9 },
    effects: { thirstAfter: 0.38 },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: false,
    ...overrides,
  };
}

function teachingFor(teacher: HumanAgent, learner: HumanAgent, tick: bigint, overrides: Partial<HumanTeachingRecord> = {}): HumanTeachingRecord {
  return {
    id: `${teacher.worldId}:knowledge-test-teaching:${tick.toString()}:${teacher.id}:${learner.id}`,
    worldId: teacher.worldId,
    tick: tick.toString(),
    teacherAgentId: teacher.id,
    learnerAgentId: learner.id,
    topic: "nearby water",
    targetBelief: "nearby:water",
    method: "spoken",
    learnerAttention: 0.82,
    successScore: 0.8,
    ...overrides,
  };
}

function relation(state: ReturnType<typeof spawnFirstTwoHumans>, from: HumanAgent, to: HumanAgent, overrides: Partial<HumanRelationship> = {}): HumanRelationship {
  const relationship = state.relationships.find((entry) => entry.fromAgentId === from.id && entry.toAgentId === to.id);

  if (!relationship) {
    throw new Error(`missing relationship ${from.id} -> ${to.id}`);
  }

  return {
    ...relationship,
    ...overrides,
  };
}

function knowledgeFor(agent: HumanAgent, overrides: Partial<HumanKnowledge> = {}): HumanKnowledge {
  return {
    id: `${agent.id}:knowledge:safe-drinking-water-at-${agent.currentCellId}`,
    worldId: agent.worldId,
    agentId: agent.id,
    topic: `Safe drinking water at ${agent.currentCellId}`,
    category: "water",
    discoveredTick: "1",
    learnedTick: "1",
    sourceType: "personal-discovery",
    sourceHumanId: null,
    originatingHumanId: agent.id,
    confidence: 0.72,
    mastery: 0.34,
    reliability: 0.7,
    practiceCount: 1,
    teachingCount: 0,
    learnerHumanIds: [],
    lastUsedTick: "1",
    lastTaughtTick: null,
    importance: 0.82,
    isForgotten: false,
    contradicts: [],
    tags: ["survival", "water", agent.currentCellId],
    history: [{
      tick: "1",
      event: "discovered",
      summary: "test knowledge",
      confidence: 0.72,
      mastery: 0.34,
      sourceHumanId: null,
      sourceEventId: "test-event",
    }],
    ...overrides,
  };
}

function memoryFor(agent: HumanAgent, overrides: Partial<HumanMemory> = {}): HumanMemory {
  return {
    id: `${agent.id}:memory:water:1`,
    worldId: agent.worldId,
    agentId: agent.id,
    type: "Water Source",
    category: "Survival Memory",
    subjectId: "resource:water",
    locationCellId: agent.currentCellId,
    createdTick: "1",
    lastRecalledTick: "4",
    importance: 0.84,
    emotionalWeight: 0.46,
    source: "test",
    relatedEntityId: null,
    relatedHumanId: null,
    tags: ["water", "resource", "survival"],
    notes: "test memory",
    recallCount: 3,
    exposureCount: 3,
    tick: "1",
    cellId: agent.currentCellId,
    participants: [agent.id],
    eventType: "Human Need Fulfilled",
    summary: "Repeated visits found water here.",
    emotionAtEncoding: { ...agent.emotions },
    needContext: { ...agent.needs },
    salience: 0.84,
    confidence: 0.82,
    valence: 0.72,
    sourceEventId: "test-memory-event",
    causalLinks: [],
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

describe("Knowledge & Learning Engine", () => {
  it("keeps categories registered through an extensible registry", () => {
    registerHumanKnowledgeCategory({
      id: "test-astral-navigation",
      label: "Test Astral Navigation",
      decayResistance: 0.61,
      defaultImportance: 0.57,
      tags: ["navigation", "test"],
    });

    expect(getHumanKnowledgeCategories().map((category) => category.id)).toContain("water");
    expect(getHumanKnowledgeCategories().map((category) => category.id)).toContain("test-astral-navigation");
  });

  it("creates personal discovery knowledge from meaningful experience", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent] = state.agents;
    const update = updateKnowledgeEngine({
      knowledge: [],
      agents: state.agents,
      relationships: state.relationships,
      memories: [],
      events: [eventFor(agent, 1n)],
      teachingAttempts: [],
      tick: 1n,
    });

    expect(update.knowledge).toHaveLength(1);
    expect(update.knowledge[0]).toMatchObject({
      agentId: agent.id,
      category: "water",
      sourceType: "personal-discovery",
      originatingHumanId: agent.id,
      practiceCount: expect.any(Number),
    });
    expect(update.knowledgeEvents.some((event) => event.kind === "new discovery")).toBe(true);
  });

  it("teaching transfers knowledge when relationship and attention are strong", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [teacher, learner] = state.agents;
    const teacherKnowledge = knowledgeFor(teacher, { confidence: 0.88, mastery: 0.72, importance: 0.9 });
    const update = updateKnowledgeEngine({
      knowledge: [teacherKnowledge],
      agents: state.agents,
      relationships: [
        relation(state, learner, teacher, { trust: 0.92, respect: 0.78, familiarity: 0.85, fear: 0.02, rivalry: 0 }),
      ],
      memories: [],
      events: [],
      teachingAttempts: [teachingFor(teacher, learner, 2n)],
      tick: 2n,
    });
    const learned = update.knowledge.find((entry) => entry.agentId === learner.id);
    const taught = update.knowledge.find((entry) => entry.agentId === teacher.id);

    expect(learned).toMatchObject({
      topic: teacherKnowledge.topic,
      sourceHumanId: teacher.id,
      originatingHumanId: teacher.id,
    });
    expect(taught?.learnerHumanIds).toContain(learner.id);
    expect(update.knowledgeEvents.map((event) => event.kind)).toEqual(expect.arrayContaining(["first teacher", "first student"]));
  });

  it("low trust reduces learning acceptance", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [teacher, learner] = state.agents;
    const update = updateKnowledgeEngine({
      knowledge: [knowledgeFor(teacher, { confidence: 0.78, mastery: 0.42, importance: 0.7 })],
      agents: state.agents,
      relationships: [
        relation(state, learner, teacher, { trust: 0.03, respect: 0.02, familiarity: 0.04, fear: 0.9, rivalry: 0.7 }),
      ],
      memories: [],
      events: [],
      teachingAttempts: [teachingFor(teacher, learner, 2n, { learnerAttention: 0.1, successScore: 0.2 })],
      tick: 2n,
    });

    expect(update.knowledge.some((entry) => entry.agentId === learner.id)).toBe(false);
    expect(update.knowledge.find((entry) => entry.agentId === teacher.id)?.teachingCount).toBe(1);
  });

  it("practice increases mastery and confidence", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent] = state.agents;
    const initial = knowledgeFor(agent, { confidence: 0.58, mastery: 0.2, practiceCount: 1 });
    const update = updateKnowledgeEngine({
      knowledge: [initial],
      agents: [agent],
      relationships: [],
      memories: [],
      events: [eventFor(agent, 3n)],
      teachingAttempts: [],
      tick: 3n,
    });
    const practiced = update.knowledge[0];

    expect(practiced.confidence).toBeGreaterThan(initial.confidence);
    expect(practiced.mastery).toBeGreaterThan(initial.mastery);
    expect(practiced.practiceCount).toBeGreaterThan(initial.practiceCount);
  });

  it("decay and forgetting are deterministic", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent] = state.agents;
    const fading = knowledgeFor(agent, {
      confidence: 0.19,
      mastery: 0.08,
      reliability: 0.16,
      importance: 0.2,
      learnedTick: "1",
      lastUsedTick: null,
      lastTaughtTick: null,
      tags: ["minor", "unused"],
    });
    const first = updateKnowledgeEngine({ knowledge: [fading], agents: [agent], relationships: [], memories: [], events: [], teachingAttempts: [], tick: 10_000n });
    const second = updateKnowledgeEngine({ knowledge: [fading], agents: [agent], relationships: [], memories: [], events: [], teachingAttempts: [], tick: 10_000n });

    expect(first.knowledge).toEqual(second.knowledge);
    expect(first.knowledgeEvents).toEqual(second.knowledgeEvents);
    expect(first.knowledge[0].isForgotten).toBe(true);
    expect(first.knowledgeEvents.some((event) => event.kind === "knowledge forgotten")).toBe(true);
  });

  it("supports conflicting knowledge and lets experience shift confidence", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent] = state.agents;
    const safe = knowledgeFor(agent, {
      id: `${agent.id}:knowledge:safer-ground-at-${agent.currentCellId}`,
      topic: `Safer ground at ${agent.currentCellId}`,
      category: "shelter",
      confidence: 0.36,
      mastery: 0.16,
      importance: 0.48,
      tags: ["shelter", "safe", agent.currentCellId],
      contradicts: [`Local danger at ${agent.currentCellId}`],
    });
    const dangerous = knowledgeFor(agent, {
      id: `${agent.id}:knowledge:local-danger-at-${agent.currentCellId}`,
      topic: `Local danger at ${agent.currentCellId}`,
      category: "danger",
      confidence: 0.44,
      mastery: 0.14,
      importance: 0.82,
      tags: ["danger", "survival", agent.currentCellId],
      contradicts: [`Safer ground at ${agent.currentCellId}`],
    });
    const update = updateKnowledgeEngine({
      knowledge: [safe, dangerous],
      agents: [agent],
      relationships: [],
      memories: [],
      events: [eventFor(agent, 6n, { type: "Human Safety Check Failed", title: "Human Failed Safety Check" })],
      teachingAttempts: [],
      tick: 6n,
    });
    const shiftedDanger = update.knowledge.find((entry) => entry.id === dangerous.id);

    expect(shiftedDanger?.confidence).toBeGreaterThan(dangerous.confidence);
    expect(shiftedDanger?.contradicts).toContain(`Safer ground at ${agent.currentCellId}`);
  });

  it("knowledge influences goal scoring", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent] = state.agents;
    const thirsty = {
      ...agent,
      needs: { ...agent.needs, thirst: 0.66, hunger: 0.04, safety: 0.04, fatigue: 0.04, social: 0.04 },
      beliefs: { ...agent.beliefs, "nearby:water": { ...agent.beliefs["nearby:water"], confidence: 0.05 } },
    };
    const result = evaluateGoalDecision({
      worldId: world.id,
      tick: 5n,
      seed: world.seed,
      agent: thirsty,
      agents: [thirsty, state.agents[1]],
      relationships: state.relationships,
      knowledge: [knowledgeFor(thirsty, { confidence: 0.92, mastery: 0.86 })],
      memories: [],
    });
    const waterCandidate = result.candidates.find((candidate) => candidate.type === "Find Water");

    expect(waterCandidate?.scoreInputs.knownWater).toBeGreaterThan(0.75);
    expect(result.agent.currentGoal?.type).toBe("Find Water");
  });

  it("repeated memories become transferable knowledge", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent] = state.agents;
    const update = updateKnowledgeEngine({
      knowledge: [],
      agents: [agent],
      relationships: [],
      memories: [memoryFor(agent)],
      events: [],
      teachingAttempts: [],
      tick: 5n,
    });

    expect(update.knowledge[0]).toMatchObject({ category: "water", sourceType: "repeated-experience" });
    expect(update.knowledgeEvents.some((event) => event.kind === "knowledge learned")).toBe(true);
  });

  it("exposes knowledge through the Atlas", () => {
    const snapshot = buildAtlasSnapshot(world, 1);
    const [agent] = snapshot.humans.agents;

    expect(agent.knowledgeCount).toBeGreaterThan(0);
    expect(agent.knownKnowledge[0]).toMatchObject({ confidence: expect.any(Number), mastery: expect.any(Number) });
    expect(agent.knowledgeCategories.length).toBeGreaterThan(0);
    expect(agent.knowledgeTimeline.length).toBeGreaterThan(0);
  });

  it("produces identical knowledge for identical world seeds", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const first = advanceHumanTick(state, world.seed, 1n);
    const second = advanceHumanTick(state, world.seed, 1n);

    expect(first.state.knowledge).toEqual(second.state.knowledge);
    expect(first.knowledgeEvents).toEqual(second.knowledgeEvents);
  });

  it("registers after relationships and before civilization", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Relationship Engine")).toBeLessThan(labels.indexOf("Knowledge & Learning Engine"));
    expect(labels.indexOf("Knowledge & Learning Engine")).toBeLessThan(labels.indexOf("Civilization"));
  });

  it("emits deterministic knowledge system metadata", () => {
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

    const result = runKnowledgeSystem(context as any);

    expect(result.success).toBe(true);
    expect(result.metadata).toMatchObject({ deterministic: true, pluginBasedCategories: true, globalUnlocks: false });
  });
});