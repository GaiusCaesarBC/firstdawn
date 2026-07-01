import { describe, expect, it } from "vitest";

import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";
import { advanceHumanTick, spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import { evaluateGoalDecision } from "../../src/lib/simulation/human-goals";
import { updateRelationshipEngine } from "../../src/lib/simulation/human-relationships";
import type { HumanAgent, HumanCausalEvent, HumanMemory, HumanRelationship } from "../../src/lib/simulation/human-types";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "relationship-engine-test-world",
  name: "Relationship Engine Test World",
  slug: "relationship-engine-test-world",
  currentTick: 0n,
  seed: "relationship-engine-seed",
  timeScale: 1,
  environment: "DEVELOPMENT",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...DEFAULT_WORLD_TIME_CONFIG,
} as any;

function eventFor(agents: readonly HumanAgent[], tick: bigint, overrides: Partial<HumanCausalEvent> = {}): HumanCausalEvent {
  return {
    id: `${world.id}:relationship-test-event:${tick.toString()}:${overrides.type ?? "Human Communication"}`,
    worldId: world.id,
    tick: tick.toString(),
    type: "Human Communication",
    title: "Humans Communicated",
    summary: "Two humans shared a meaningful event.",
    agentIds: agents.map((agent) => agent.id),
    cellId: agents[0].currentCellId,
    causes: {},
    effects: {},
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: false,
    ...overrides,
  };
}

function socialMemory(agent: HumanAgent, target: HumanAgent, overrides: Partial<HumanMemory> = {}): HumanMemory {
  return {
    id: `${agent.id}:memory:relationship-test:${target.id}:1`,
    worldId: agent.worldId,
    agentId: agent.id,
    type: "Conflict",
    category: "Social Memory",
    subjectId: `human:${target.id}:conflict`,
    locationCellId: agent.currentCellId,
    createdTick: "1",
    lastRecalledTick: "1",
    importance: 0.96,
    emotionalWeight: 0.92,
    source: "test",
    relatedEntityId: target.id,
    relatedHumanId: target.id,
    tags: ["danger", "conflict", "relationship"],
    notes: "test social memory",
    recallCount: 1,
    exposureCount: 1,
    tick: "1",
    cellId: agent.currentCellId,
    participants: [agent.id, target.id],
    eventType: "Human Conflict",
    summary: "A frightening social memory involved another human.",
    emotionAtEncoding: { ...agent.emotions },
    needContext: { ...agent.needs },
    salience: 0.96,
    confidence: 0.98,
    valence: 0.08,
    sourceEventId: "relationship-memory-test-event",
    causalLinks: [],
    ...overrides,
  };
}

function relationFrom(state: ReturnType<typeof spawnFirstTwoHumans>, humanId: string, targetHumanId: string): HumanRelationship {
  const relationship = state.relationships.find((entry) => entry.humanId === humanId && entry.targetHumanId === targetHumanId);

  if (!relationship) {
    throw new Error(`missing relationship ${humanId} -> ${targetHumanId}`);
  }

  return relationship;
}

describe("Relationship Engine", () => {
  it("repeated proximity increases familiarity", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const before = relationFrom(state, first.id, second.id);
    const update = updateRelationshipEngine({ worldId: world.id, relationships: state.relationships, agents: state.agents, events: [], memories: [], tick: 1n });
    const after = update.relationships.find((relationship) => relationship.humanId === first.id && relationship.targetHumanId === second.id);

    expect(after?.familiarity).toBeGreaterThan(before.familiarity);
    expect(after?.history.at(-1)?.event).toBe("proximity");
  });

  it("food sharing increases trust and affection", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const before = relationFrom(state, first.id, second.id);
    const update = updateRelationshipEngine({
      worldId: world.id,
      relationships: state.relationships,
      agents: state.agents,
      events: [eventFor(state.agents, 1n, { type: "Human Need Fulfilled", title: "Human Ate Food Together" })],
      memories: [],
      tick: 1n,
    });
    const after = update.relationships.find((relationship) => relationship.humanId === first.id && relationship.targetHumanId === second.id);

    expect(after?.trust).toBeGreaterThan(before.trust);
    expect(after?.affection).toBeGreaterThan(before.affection);
    expect(after?.tags).toContain("food-sharing");
  });

  it("conflict increases fear and rivalry", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const before = relationFrom(state, first.id, second.id);
    const update = updateRelationshipEngine({
      worldId: world.id,
      relationships: state.relationships,
      agents: state.agents,
      events: [eventFor(state.agents, 1n, { type: "Human Conflict", title: "Humans Fought" })],
      memories: [],
      tick: 1n,
    });
    const after = update.relationships.find((relationship) => relationship.humanId === first.id && relationship.targetHumanId === second.id);

    expect(after?.fear).toBeGreaterThan(before.fear);
    expect(after?.rivalry).toBeGreaterThan(before.rivalry);
  });

  it("danger memory involving another human affects avoidance", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const update = updateRelationshipEngine({
      worldId: world.id,
      relationships: state.relationships,
      agents: state.agents,
      events: [],
      memories: [socialMemory(first, second)],
      tick: 1n,
    });
    const relationship = update.relationships.find((entry) => entry.humanId === first.id && entry.targetHumanId === second.id);
    const agent = {
      ...first,
      needs: { ...first.needs, safety: 0.2, hunger: 0.04, thirst: 0.04, social: 0.12 },
      emotions: { ...first.emotions, fear: 0.58 },
      motivations: { ...first.motivations, explore: 1, observeSurroundings: 1 },
    };
    const result = evaluateGoalDecision({
      worldId: world.id,
      tick: 2n,
      seed: world.seed,
      agent,
      agents: [agent, second],
      relationships: relationship ? [{ ...relationship, fear: 0.92, status: "Threat" }] : update.relationships,
      memories: [socialMemory(first, second)],
    });

    expect(relationship?.fear).toBeGreaterThan(relationFrom(state, first.id, second.id).fear);
    expect(["Escape", "Seek Safety"]).toContain(result.agent.currentGoal?.type);
    expect(result.candidates.find((candidate) => candidate.type === "Seek Safety")?.scoreInputs.relationshipThreat).toBeGreaterThan(0);
  });

  it("family relationship is preserved", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const familyRelationships = state.relationships.map((relationship) => relationship.humanId === first.id && relationship.targetHumanId === second.id
      ? { ...relationship, kinship: "sibling" as const, status: "Family" as const, affection: 0.8 }
      : relationship);
    const update = updateRelationshipEngine({ worldId: world.id, relationships: familyRelationships, agents: state.agents, events: [], memories: [], tick: 48n });
    const relationship = update.relationships.find((entry) => entry.humanId === first.id && entry.targetHumanId === second.id);

    expect(relationship?.status).toBe("Family");
    expect(relationship?.kinship).toBe("sibling");
  });

  it("relationship decay is deterministic", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const first = updateRelationshipEngine({ worldId: world.id, relationships: state.relationships, agents: state.agents, events: [], memories: [], tick: 24n });
    const second = updateRelationshipEngine({ worldId: world.id, relationships: state.relationships, agents: state.agents, events: [], memories: [], tick: 24n });

    expect(first.relationships).toEqual(second.relationships);
    expect(first.relationshipEvents).toEqual(second.relationshipEvents);
  });

  it("relationship scores influence goal selection", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const agent = {
      ...first,
      needs: { ...first.needs, safety: 0.22, hunger: 0.04, thirst: 0.04, fatigue: 0.04, social: 0.2 },
      motivations: { ...first.motivations, explore: 1, observeSurroundings: 1 },
      curiosityProfile: { ...first.curiosityProfile, noveltySeeking: 1, riskTolerance: 1 },
    };
    const threat = { ...relationFrom(state, first.id, second.id), fear: 0.95, rivalry: 0.72, status: "Threat" as const };
    const result = evaluateGoalDecision({ worldId: world.id, tick: 3n, seed: world.seed, agent, agents: [agent, second], relationships: [threat], memories: [] });

    expect(["Escape", "Seek Safety"]).toContain(result.agent.currentGoal?.type);
  });

  it("identical seed produces identical relationship outcomes", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const first = advanceHumanTick(state, world.seed, 1n);
    const second = advanceHumanTick(state, world.seed, 1n);

    expect(first.state.relationships).toEqual(second.state.relationships);
    expect(first.relationshipEvents).toEqual(second.relationshipEvents);
  });

  it("Atlas snapshot exposes relationship data", () => {
    const snapshot = buildAtlasSnapshot(world, 1);
    const [agent] = snapshot.humans.agents;

    expect(agent.relationshipCount).toBeGreaterThan(0);
    expect(agent.closestRelationships[0]).toMatchObject({ targetHumanId: expect.any(String), familiarity: expect.any(Number) });
    expect(agent.strongestBond).not.toBeNull();
    expect(agent.socialHistory.length).toBeGreaterThan(0);
  });

  it("scheduler order is correct", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Humans")).toBeLessThan(labels.indexOf("Goal Decision Engine"));
    expect(labels.indexOf("Goal Decision Engine")).toBeLessThan(labels.indexOf("Episodic Memory Engine"));
    expect(labels.indexOf("Episodic Memory Engine")).toBeLessThan(labels.indexOf("Relationship Engine"));
    expect(labels.indexOf("Relationship Engine")).toBeLessThan(labels.indexOf("Civilization"));
  });
});
