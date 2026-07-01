import { describe, expect, it } from "vitest";

import {
  evaluateGoalDecision,
  HUMAN_GOAL_EVENT_TYPES,
} from "../../src/lib/simulation/human-goals";
import { spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import type { HumanAgent, HumanGoal, HumanMvaState, HumanNeeds } from "../../src/lib/simulation/human-types";
import { DEFAULT_SIMULATION_SYSTEMS } from "../../src/lib/simulation/systems";
import { DEFAULT_WORLD_TIME_CONFIG } from "../../src/lib/simulation/time-engine";

const world = {
  id: "goal-engine-test-world",
  name: "Goal Engine Test World",
  slug: "goal-engine-test-world",
  currentTick: 0n,
  seed: "goal-engine-seed",
  ...DEFAULT_WORLD_TIME_CONFIG,
};

function stateWithAgent(agentUpdate: (agent: HumanAgent) => HumanAgent): { state: HumanMvaState; agent: HumanAgent } {
  const state = spawnFirstTwoHumans(world, 0n);
  const [first] = state.agents;
  const updated = agentUpdate(first);

  return {
    state: {
      ...state,
      agents: state.agents.map((agent) => agent.id === first.id ? updated : agent),
    },
    agent: updated,
  };
}

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

function activeGoal(agent: HumanAgent, type: HumanGoal["type"], priority: number, tick = "0"): HumanGoal {
  return {
    id: `${agent.id}:test-goal:${type}`,
    type,
    priority,
    createdTick: tick,
    targetId: null,
    targetCellId: agent.currentCellId,
    progress: 0,
    confidence: 0.8,
    reason: type === "Find Food" ? "Hungry" : type === "Find Water" ? "Thirst" : "Curiosity",
    status: "Active",
  };
}

function decide(state: HumanMvaState, agent: HumanAgent, tick = 1n) {
  return evaluateGoalDecision({
    worldId: state.worldId,
    tick,
    seed: world.seed,
    agent,
    agents: state.agents,
    relationships: state.relationships,
    memories: state.memories,
  });
}

describe("Goal Decision Engine", () => {
  it("chooses Find Food for a hungry citizen", () => {
    const { state, agent } = stateWithAgent((entry) => ({
      ...entry,
      needs: needs({ hunger: 0.92, thirst: 0.12 }),
    }));
    const result = decide(state, agent);

    expect(result.agent.currentGoal).toMatchObject({
      type: "Find Food",
      reason: "Hungry",
      status: "Active",
    });
    expect(result.events.some((event) => event.type === HUMAN_GOAL_EVENT_TYPES.started)).toBe(true);
  });

  it("lets thirst override exploration pressure", () => {
    const { state, agent } = stateWithAgent((entry) => ({
      ...entry,
      needs: needs({ thirst: 0.9 }),
      motivations: { ...entry.motivations, explore: 1, observeSurroundings: 1 },
      curiosityProfile: { ...entry.curiosityProfile, noveltySeeking: 1, environmental: 1 },
    }));
    const result = decide(state, agent);

    expect(result.agent.currentGoal?.type).toBe("Find Water");
    expect(result.agent.currentGoal?.priority ?? 0).toBeGreaterThan(
      result.candidates.find((candidate) => candidate.type === "Explore")?.priority ?? 0,
    );
  });

  it("interrupts gathering when danger becomes urgent", () => {
    const { state, agent } = stateWithAgent((entry) => ({
      ...entry,
      needs: needs({ hunger: 0.72, safety: 0.96 }),
      emotions: { ...entry.emotions, fear: 0.72 },
      currentGoal: activeGoal(entry, "Find Food", 0.75),
    }));
    const result = decide(state, agent, 2n);

    expect(["Escape", "Seek Safety"]).toContain(result.agent.currentGoal?.type);
    expect(result.agent.goalHistory.some((entry) => entry.event === "Interrupted" && entry.goal.type === "Find Food")).toBe(true);
    expect(result.events.some((event) => event.type === HUMAN_GOAL_EVENT_TYPES.interrupted)).toBe(true);
  });

  it("persists a valid current goal across ticks", () => {
    const { state, agent } = stateWithAgent((entry) => ({
      ...entry,
      needs: needs({ hunger: 0.64 }),
      currentGoal: activeGoal(entry, "Find Food", 2.5),
    }));
    const result = decide(state, agent, 2n);

    expect(result.agent.currentGoal?.id).toBe(agent.currentGoal?.id);
    expect(result.events).toEqual([]);
  });

  it("records completion before selecting the next goal", () => {
    const { state, agent } = stateWithAgent((entry) => ({
      ...entry,
      needs: needs({ thirst: 0.01 }),
      currentGoal: activeGoal(entry, "Find Water", 1.8),
    }));
    const result = decide(state, agent, 3n);

    expect(result.agent.goalHistory.some((entry) => entry.event === "Completed" && entry.goal.type === "Find Water")).toBe(true);
    expect(result.events.some((event) => event.type === HUMAN_GOAL_EVENT_TYPES.completed)).toBe(true);
    expect(result.agent.currentGoal?.status).toBe("Active");
  });

  it("produces identical selections for identical world seed and state", () => {
    const { state, agent } = stateWithAgent((entry) => ({
      ...entry,
      needs: needs({ hunger: 0.42, thirst: 0.46, social: 0.5 }),
    }));
    const first = decide(state, agent, 12n);
    const second = decide(state, agent, 12n);

    expect(first.agent.currentGoal).toEqual(second.agent.currentGoal);
    expect(first.events).toEqual(second.events);
  });

  it("registers after humans and before civilization", () => {
    const labels = DEFAULT_SIMULATION_SYSTEMS.map((system) => system.label);

    expect(labels.indexOf("Humans")).toBeLessThan(labels.indexOf("Goal Decision Engine"));
    expect(labels.indexOf("Goal Decision Engine")).toBeLessThan(labels.indexOf("Civilization"));
  });
});
