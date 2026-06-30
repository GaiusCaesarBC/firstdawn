import { describe, expect, it } from "vitest";

import { createChroniclerReport } from "../../src/lib/simulation/chronicler";
import { createActionCandidates, selectHumanDecision } from "../../src/lib/simulation/human-decisions";
import {
  advanceHumanTick,
  simulateHumanDay,
  spawnFirstTwoHumans,
} from "../../src/lib/simulation/human-engine";
import { evaluateReproductionEligibility } from "../../src/lib/simulation/human-relationships";
import type { HumanAgent, HumanMvaState } from "../../src/lib/simulation/human-types";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { run as runHumansSystem } from "../../src/lib/simulation/systems/humans";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "human-mva-test-world",
  name: "Human MVA Test World",
  slug: "human-mva-test-world",
  currentTick: 0n,
  seed: "human-mva-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
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

function relationshipFrom(state: HumanMvaState, fromAgentId: string, toAgentId: string) {
  const relationship = state.relationships.find((entry) =>
    entry.fromAgentId === fromAgentId && entry.toAgentId === toAgentId,
  );

  if (!relationship) {
    throw new Error("Expected relationship to exist.");
  }

  return relationship;
}

function underage(agent: HumanAgent): HumanAgent {
  return {
    ...agent,
    ageDays: 17 * 365,
    approxAgeYears: 17,
  };
}

describe("Human MVA foundation", () => {
  it("spawns the first two humans together as one male and one female", () => {
    const state = spawnFirstTwoHumans(world, 0n);

    expect(state.agents).toHaveLength(2);
    expect(state.agents.map((agent) => agent.sex).sort()).toEqual(["female", "male"]);
    expect(new Set(state.agents.map((agent) => agent.currentCellId)).size).toBe(1);
    expect(state.relationships).toHaveLength(2);
  });

  it("spawns both first humans as adults around age 20 with genealogy foundation fields", () => {
    const state = spawnFirstTwoHumans(world, 0n);

    expect(state.agents.every((agent) => agent.approxAgeYears >= 19.9)).toBe(true);
    expect(state.agents.every((agent) => agent.approxAgeYears <= 20.1)).toBe(true);
    expect(state.agents.every((agent) => agent.motherId === null && agent.fatherId === null)).toBe(true);
    expect(state.agents.every((agent) => agent.generation === 0)).toBe(true);
  });

  it("blocks reproduction unless both adults are over 18 and relationship conditions are met", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [first, second] = state.agents;
    const relationship = {
      ...relationshipFrom(state, first.id, second.id),
      trust: 0.9,
      attraction: 0.9,
      affection: 0.9,
    };

    expect(evaluateReproductionEligibility(underage(first), second, relationship, true)).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["both participants must be over 18"]),
    });
    expect(evaluateReproductionEligibility(first, second, relationship, false)).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["reproduction requires an active decision"]),
    });
    expect(evaluateReproductionEligibility(first, second, relationship, true)).toEqual({
      allowed: true,
      reasons: [],
    });
  });

  it("updates needs over one simulated day while both humans survive", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const result = simulateHumanDay(initial, world.seed, 1n);

    expect(result.state.agents.every((agent) => agent.isAlive)).toBe(true);
    expect(result.state.agents[0].needs).not.toEqual(initial.agents[0].needs);
    expect(result.state.agents.every((agent) =>
      Object.values(agent.needs).every((value) => value >= 0 && value <= 1),
    )).toBe(true);
  });

  it("keeps fear low to moderate through a mostly safe first day", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const result = simulateHumanDay(initial, world.seed, 1n);

    expect(result.state.agents.every((agent) => agent.emotions.fear < 0.45)).toBe(true);
    expect(result.state.agents.every((agent) => agent.emotions.distress < 0.65)).toBe(true);
    expect(result.state.agents.every((agent) => agent.emotions.curiosity > 0.35)).toBe(true);
    expect(result.state.agents.some((agent) => agent.emotions.relief > initial.agents[0].emotions.relief)).toBe(true);
  });

  it("lowers distress after a successful food or water action", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [thirstyAgent] = initial.agents;
    const thirstyState: HumanMvaState = {
      ...initial,
      agents: initial.agents.map((agent) =>
        agent.id === thirstyAgent.id
          ? {
            ...agent,
            needs: { hunger: 0.02, thirst: 0.86, fatigue: 0.02, safety: 0.02, social: 0.02 },
            emotions: { ...agent.emotions, distress: 0.55, fear: 0.18, comfort: 0.5 },
          }
          : { ...agent, needs: { hunger: 0.02, thirst: 0.02, fatigue: 0.02, safety: 0.02, social: 0.02 } },
      ),
    };
    const result = advanceHumanTick(thirstyState, world.seed, 1n);
    const after = result.state.agents.find((agent) => agent.id === thirstyAgent.id);

    expect(after?.lastDecision?.action).toBe("drink");
    expect(after?.emotions.distress).toBeLessThan(0.55);
    expect(after?.emotions.relief).toBeGreaterThan(thirstyAgent.emotions.relief);
  });

  it("raises fear strongly when a serious safety threat causes a failed check", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [threatenedAgent] = initial.agents;
    const threatenedState: HumanMvaState = {
      ...initial,
      agents: initial.agents.map((agent) =>
        agent.id === threatenedAgent.id
          ? {
            ...agent,
            needs: { hunger: 0.02, thirst: 0.02, fatigue: 0.02, safety: 0.94, social: 0.02 },
            emotions: { ...agent.emotions, fear: 0.18, distress: 0.12, comfort: 0.2, relief: 0.05 },
          }
          : { ...agent, needs: { hunger: 0.02, thirst: 0.02, fatigue: 0.02, safety: 0.02, social: 0.02 } },
      ),
    };
    const result = advanceHumanTick(threatenedState, world.seed, 1n);
    const after = result.state.agents.find((agent) => agent.id === threatenedAgent.id);

    expect(result.newEvents.some((event) => event.type === "Human Safety Check Failed")).toBe(true);
    expect(after?.lastDecision?.action).toBe("seekSafety");
    expect(after?.emotions.fear).toBeGreaterThan(0.45);
  });

  it("decays fear over time when needs and surroundings are safe", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [recoveringAgent] = initial.agents;
    const safeState: HumanMvaState = {
      ...initial,
      agents: initial.agents.map((agent) =>
        agent.id === recoveringAgent.id
          ? {
            ...agent,
            needs: { hunger: 0.02, thirst: 0.02, fatigue: 0.02, safety: 0.02, social: 0.02 },
            emotions: { ...agent.emotions, fear: 0.72, distress: 0.12, comfort: 0.56, relief: 0.24 },
          }
          : { ...agent, needs: { hunger: 0.02, thirst: 0.02, fatigue: 0.02, safety: 0.02, social: 0.02 } },
      ),
    };
    const result = simulateHumanDay(safeState, world.seed, 1n, 4);
    const after = result.state.agents.find((agent) => agent.id === recoveringAgent.id);

    expect(after?.emotions.fear).toBeLessThan(0.72);
  });

  it("keeps curiosity available unless fear and distress are very high", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [curiousAgent] = initial.agents;
    const safeState: HumanMvaState = {
      ...initial,
      agents: initial.agents.map((agent) =>
        agent.id === curiousAgent.id
          ? {
            ...agent,
            needs: { hunger: 0.08, thirst: 0.08, fatigue: 0.08, safety: 0.04, social: 0.12 },
            emotions: { ...agent.emotions, fear: 0.1, distress: 0.12, curiosity: 0.5, comfort: 0.54 },
          }
          : { ...agent, needs: { hunger: 0.02, thirst: 0.02, fatigue: 0.02, safety: 0.02, social: 0.02 } },
      ),
    };
    const result = advanceHumanTick(safeState, world.seed, 1n);
    const after = result.state.agents.find((agent) => agent.id === curiousAgent.id);

    expect(after?.emotions.curiosity).toBeGreaterThan(0.48);
    expect(after?.lastDecision?.causes).toMatchObject(expect.any(Object));
  });
  it("selects utility actions deterministically", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const [agent] = state.agents;
    const others = state.agents.filter((entry) => entry.id !== agent.id);
    const first = selectHumanDecision(
      agent,
      createActionCandidates(agent, others, state.relationships, 1n, world.seed),
      1n,
    );
    const second = selectHumanDecision(
      agent,
      createActionCandidates(agent, others, state.relationships, 1n, world.seed),
      1n,
    );

    expect(first).toEqual(second);
    expect(first.utility).toBeGreaterThan(0);
  });

  it("creates episodic memories after meaningful events", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const result = advanceHumanTick(initial, world.seed, 1n);

    expect(result.newEvents.length).toBeGreaterThan(0);
    expect(result.state.memories.length).toBeGreaterThan(0);
    expect(result.state.memories[0]).toMatchObject({
      worldId: world.id,
      confidence: 0.9,
    });
  });

  it("changes relationship values after interaction", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [first, second] = initial.agents;
    const before = relationshipFrom(initial, first.id, second.id);
    const result = advanceHumanTick(initial, world.seed, 1n);
    const after = relationshipFrom(result.state, first.id, second.id);

    expect(after.familiarity).toBeGreaterThanOrEqual(before.familiarity);
    expect(after.trust).toBeGreaterThanOrEqual(before.trust);
  });

  it("creates communication events and relationship-aware records", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const result = advanceHumanTick(initial, world.seed, 1n);

    expect(result.newEvents.some((event) => event.type === "Human Communication")).toBe(true);
    expect(result.state.communications.length).toBeGreaterThan(0);
    expect(result.state.communications[0].utteranceMeaning).not.toMatch(/simulat|observer|chronicler/i);
  });
  it("creates teaching event foundation records when teaching has the highest utility", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const [teacher, learner] = initial.agents;
    const teachingReady: HumanMvaState = {
      ...initial,
      agents: initial.agents.map((agent) =>
        agent.id === teacher.id
          ? {
            ...agent,
            needs: { hunger: 0.02, thirst: 0.02, fatigue: 0.02, safety: 0.02, social: 0.02 },
            personality: { ...agent.personality, teachAffinity: 1 },
            beliefs: {
              ...agent.beliefs,
              [`communication:${learner.id}`]: {
                claim: "The other human can understand simple spoken intent.",
                confidence: 0.9,
                valence: 0.7,
                lastUpdatedTick: "0",
              },
            },
          }
          : agent,
      ),
      relationships: initial.relationships.map((relationship) =>
        relationship.fromAgentId === teacher.id && relationship.toAgentId === learner.id
          ? { ...relationship, trust: 0.92, affection: 0.72, attraction: 0.68 }
          : relationship,
      ),
    };
    const result = advanceHumanTick(teachingReady, world.seed, 1n);

    expect(result.newEvents.some((event) => event.type === "Human Teaching")).toBe(true);
    expect(result.state.teachingAttempts.length).toBeGreaterThan(0);
    expect(result.state.teachingAttempts[0]).toMatchObject({
      teacherAgentId: teacher.id,
      learnerAgentId: learner.id,
      targetBelief: "nearby:water",
    });
  });

  it("lets the Chronicler read causal events without mutating state", () => {
    const initial = spawnFirstTwoHumans(world, 0n);
    const result = advanceHumanTick(initial, world.seed, 1n);
    const before = JSON.stringify(result.state);
    const report = createChroniclerReport(result.state, result.newEvents);
    const after = JSON.stringify(result.state);

    expect(report.observedEventCount).toBe(result.newEvents.length);
    expect(after).toBe(before);
  });

  it("registers after adaptation and before civilization", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Population Adaptation")).toBeLessThan(labels.indexOf("Humans"));
    expect(labels.indexOf("Humans")).toBeLessThan(labels.indexOf("Civilization"));
  });

  it("emits human causal events through the simulation system boundary", () => {
    const metrics = metricsCollector();
    const result = runHumansSystem({
      world: world as never,
      tick: 1n,
      seed: world.seed,
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
    expect(result.events?.length).toBeGreaterThan(0);
    expect(result.events?.some((event) => event.type === "Human Communication")).toBe(true);
    expect(result.metadata).toMatchObject({
      deterministic: true,
      forbiddenSystemsImplemented: [],
      agentIgnorance: {
        agentsReceiveObserverState: false,
        agentsKnowTheyAreSimulated: false,
        chroniclerCanMutate: false,
      },
    });
    expect(metrics.snapshot().entitiesProcessed).toBe(2);
  });
});

