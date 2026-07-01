import { describe, expect, it } from "vitest";

import { buildAtlasSnapshot } from "../../src/lib/worlds/map-atlas";
import {
  createHumanCommunication,
  getHumanCommunicationTypes,
  registerHumanCommunicationType,
  updateCommunicationEngine,
} from "../../src/lib/simulation/human-communication";
import { advanceHumanTick, spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import { updateKnowledgeEngine } from "../../src/lib/simulation/human-knowledge";
import { updateEpisodicMemories } from "../../src/lib/simulation/human-memory";
import type {
  HumanAgent,
  HumanCausalEvent,
  HumanGoal,
  HumanKnowledge,
  HumanRelationship,
} from "../../src/lib/simulation/human-types";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "communication-engine-test-world",
  name: "Communication Engine Test World",
  slug: "communication-engine-test-world",
  currentTick: 0n,
  seed: "communication-engine-seed",
  timeScale: 1,
  environment: "DEVELOPMENT",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...DEFAULT_WORLD_TIME_CONFIG,
} as any;

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

function activeGoal(agent: HumanAgent, type: HumanGoal["type"], priority = 0.6): HumanGoal {
  return {
    id: `${agent.id}:test-goal:${type}`,
    type,
    priority,
    createdTick: "0",
    targetId: null,
    targetCellId: agent.currentCellId,
    progress: 0,
    confidence: 0.7,
    reason: type === "Explore" ? "Curiosity" : "Low Pressure",
    status: "Active",
  };
}

function knowledgeFor(agent: HumanAgent): HumanKnowledge {
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
    confidence: 0.92,
    mastery: 0.78,
    reliability: 0.82,
    practiceCount: 1,
    teachingCount: 0,
    learnerHumanIds: [],
    lastUsedTick: "1",
    lastTaughtTick: null,
    importance: 0.9,
    isForgotten: false,
    contradicts: [],
    tags: ["survival", "water", agent.currentCellId],
    history: [{
      tick: "1",
      event: "discovered",
      summary: "test knowledge",
      confidence: 0.92,
      mastery: 0.78,
      sourceHumanId: null,
      sourceEventId: "test-event",
    }],
  };
}

function communicationCausalEvent(event: ReturnType<typeof updateCommunicationEngine>["communicationEvents"][number], cellId: string): HumanCausalEvent {
  return {
    id: `${event.id}:causal`,
    worldId: event.worldId,
    tick: event.tick,
    type: "Human Communication Event",
    title: event.kind,
    summary: event.summary,
    agentIds: [event.senderHumanId, ...event.receiverHumanIds],
    cellId,
    causes: { communicationId: event.communicationId, communicationType: event.type },
    effects: { successRate: event.successRate },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: true,
  };
}

describe("Communication Engine", () => {
  it("keeps communication types extensible through a registry", () => {
    registerHumanCommunicationType({
      id: "Test Signal",
      label: "Test Signal",
      defaultUrgency: 0.5,
      defaultClarity: 0.5,
      defaultConfidence: 0.5,
      defaultEmotionalWeight: 0.5,
      defaultTags: ["test"],
    });

    expect(getHumanCommunicationTypes().map((type) => type.id)).toEqual(expect.arrayContaining(["Warning", "Teaching", "Test Signal"]));
  });

  it("warning communication succeeds for a trusted nearby receiver and interrupts exploration", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [sender, receiver] = state.agents;
    const receiverWithGoal = { ...receiver, currentGoal: activeGoal(receiver, "Explore", 0.4) };
    const relationships = [
      relation(state, receiver, sender, { trust: 0.94, familiarity: 0.9, fear: 0.02, rivalry: 0 }),
      relation(state, sender, receiver, { trust: 0.82, familiarity: 0.82 }),
    ];
    const communication = createHumanCommunication({
      worldId: world.id,
      seed: world.seed,
      tick: 2n,
      sender,
      receivers: [receiverWithGoal],
      relationships,
      type: "Warning",
      topic: "wolves near the trees",
      communicationMethod: "Call",
      clarity: 0.94,
      confidence: 0.92,
      urgency: 0.96,
    });
    const update = updateCommunicationEngine({
      worldId: world.id,
      tick: 2n,
      agents: [sender, receiverWithGoal],
      relationships,
      communications: [communication],
    });
    const updatedReceiver = update.agents.find((agent) => agent.id === receiver.id);

    expect(communication.accepted).toBe(true);
    expect(updatedReceiver?.currentGoal?.type).toBe("Seek Safety");
    expect(updatedReceiver?.goalHistory.some((entry) => entry.event === "Interrupted")).toBe(true);
    expect(update.communicationEvents.some((event) => event.kind === "first warning")).toBe(true);
  });

  it("low trust rejects communication deterministically", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [sender, receiver] = state.agents;
    const relationships = [
      relation(state, receiver, sender, { trust: 0.02, familiarity: 0.02, fear: 0.8, rivalry: 0.7 }),
      relation(state, sender, receiver, { trust: 0.1, fear: 0.4 }),
    ];
    const first = createHumanCommunication({
      worldId: world.id,
      seed: world.seed,
      tick: 3n,
      sender,
      receivers: [receiver],
      relationships,
      type: "Warning",
      topic: "uncertain danger",
      communicationMethod: "Gesture",
      clarity: 0.62,
      confidence: 0.62,
    });
    const second = createHumanCommunication({
      worldId: world.id,
      seed: world.seed,
      tick: 3n,
      sender,
      receivers: [receiver],
      relationships,
      type: "Warning",
      topic: "uncertain danger",
      communicationMethod: "Gesture",
      clarity: 0.62,
      confidence: 0.62,
    });

    expect(first).toEqual(second);
    expect(first.accepted).toBe(false);
    expect(["rejected", "ignored", "misunderstood", "stored-for-later"]).toContain(first.receptions[0].outcome);
  });

  it("accepted teaching communication creates teaching attempts that transfer knowledge", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [teacher, learner] = state.agents;
    const relationships = [
      relation(state, learner, teacher, { trust: 0.95, respect: 0.9, familiarity: 0.9, fear: 0.01, rivalry: 0 }),
      relation(state, teacher, learner, { trust: 0.82, familiarity: 0.84 }),
    ];
    const communication = createHumanCommunication({
      worldId: world.id,
      seed: world.seed,
      tick: 4n,
      sender: teacher,
      receivers: [learner],
      relationships,
      type: "Teaching",
      topic: "nearby water",
      communicationMethod: "Gesture",
      clarity: 0.9,
      confidence: 0.92,
    });
    const communicationUpdate = updateCommunicationEngine({
      worldId: world.id,
      tick: 4n,
      agents: state.agents,
      relationships,
      communications: [communication],
    });
    const knowledgeUpdate = updateKnowledgeEngine({
      knowledge: [knowledgeFor(teacher)],
      agents: communicationUpdate.agents,
      relationships: communicationUpdate.relationships,
      memories: [],
      events: [],
      teachingAttempts: communicationUpdate.teachingAttempts,
      tick: 4n,
    });

    expect(communicationUpdate.teachingAttempts).toHaveLength(1);
    expect(knowledgeUpdate.knowledge.some((entry) => entry.agentId === learner.id && entry.sourceHumanId === teacher.id)).toBe(true);
  });

  it("accepted communication strengthens relationships", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [sender, receiver] = state.agents;
    const before = relation(state, receiver, sender, { trust: 0.56, familiarity: 0.5 });
    const communication = createHumanCommunication({
      worldId: world.id,
      seed: world.seed,
      tick: 5n,
      sender,
      receivers: [receiver],
      relationships: [before, relation(state, sender, receiver)],
      type: "Greeting",
      topic: "companionship",
      communicationMethod: "Vocal Sound",
      clarity: 0.88,
      confidence: 0.86,
    });
    const update = updateCommunicationEngine({
      worldId: world.id,
      tick: 5n,
      agents: state.agents,
      relationships: [before, relation(state, sender, receiver)],
      communications: [communication],
    });
    const after = update.relationships.find((entry) => entry.humanId === receiver.id && entry.targetHumanId === sender.id);

    expect(communication.accepted).toBe(true);
    expect(after?.trust).toBeGreaterThan(before.trust);
    expect(after?.history.at(-1)?.event).toContain("communication");
  });

  it("important communication creates memories", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [sender, receiver] = state.agents;
    const communication = createHumanCommunication({
      worldId: world.id,
      seed: world.seed,
      tick: 6n,
      sender,
      receivers: [receiver],
      relationships: state.relationships,
      type: "Warning",
      topic: "danger near camp",
      communicationMethod: "Call",
      urgency: 0.94,
      clarity: 0.9,
      confidence: 0.88,
    });
    const communicationUpdate = updateCommunicationEngine({
      worldId: world.id,
      tick: 6n,
      agents: state.agents,
      relationships: state.relationships,
      communications: [communication],
    });
    const memoryUpdate = updateEpisodicMemories({
      memories: [],
      agents: communicationUpdate.agents,
      events: communicationUpdate.communicationEvents.map((event) => communicationCausalEvent(event, sender.currentCellId)),
      tick: 6n,
    });

    expect(memoryUpdate.memories.some((memory) => memory.tags.includes("conversation"))).toBe(true);
  });

  it("Atlas exposes communication history", () => {
    const snapshot = buildAtlasSnapshot(world, 1);
    const [agent] = snapshot.humans.agents;

    expect(agent.messagesSent + agent.messagesReceived).toBeGreaterThan(0);
    expect(agent.recentCommunications[0]).toMatchObject({ type: expect.any(String), successRate: expect.any(Number) });
    expect(agent.communicationTimeline.length).toBeGreaterThan(0);
  }, 60_000);

  it("identical seeds produce identical communication", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const first = advanceHumanTick(state, world.seed, 1n);
    const second = advanceHumanTick(state, world.seed, 1n);

    expect(first.state.communications).toEqual(second.state.communications);
    expect(first.communicationEvents).toEqual(second.communicationEvents);
  });

  it("registers after knowledge and before civilization", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Knowledge & Learning Engine")).toBeLessThan(labels.indexOf("Communication Engine"));
    expect(labels.indexOf("Communication Engine")).toBeLessThan(labels.indexOf("Civilization"));
  });
});

