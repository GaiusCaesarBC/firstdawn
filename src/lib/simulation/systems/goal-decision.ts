import { getHumanMvaStateAtTick } from "../human-engine";
import {
  HUMAN_GOAL_DECISION_SYSTEM_ID,
  HUMAN_TICK_RESULT_CACHE_KEY,
  isHumanGoalEvent,
} from "../human-goals";
import type { HumanCausalEvent, HumanTickResult } from "../human-types";
import type {
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemResult,
} from "./types";

const SYSTEM_NAME = HUMAN_GOAL_DECISION_SYSTEM_ID;
const SYSTEM_LABEL = "Goal Decision Engine";
const SYSTEM_ORDER = 121;

function cachedHumanResult(context: SimulationSystemContext): HumanTickResult {
  const cached = context.cache.get(HUMAN_TICK_RESULT_CACHE_KEY);

  if (cached && typeof cached === "object" && "state" in cached && "newEvents" in cached) {
    return cached as HumanTickResult;
  }

  const result = getHumanMvaStateAtTick(context.world, context.tick);
  context.cache.set(HUMAN_TICK_RESULT_CACHE_KEY, result);

  return result;
}

function goalEventToSimulationEvent(event: HumanCausalEvent): SimulationSystemEvent {
  return {
    type: event.type,
    title: event.title,
    description: event.summary,
    historicalWeight: 0.45,
    metadata: {
      eventId: event.id,
      tick: event.tick,
      agentIds: event.agentIds,
      cellId: event.cellId,
      causes: event.causes,
      effects: event.effects,
      memoryIds: event.memoryIds,
      chroniclerVisible: event.chroniclerVisible,
      agentVisible: event.agentVisible,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const result = cachedHumanResult(context);
  const goalEvents = result.newEvents.filter(isHumanGoalEvent);
  const agentsAlive = result.state.agents.filter((agent) => agent.isAlive).length;
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedEvents = turboMode ? [] : fastMode ? goalEvents.slice(-2) : goalEvents;

  context.metrics.addEntities(result.state.agents.length);

  return {
    success: true,
    events: emittedEvents.map(goalEventToSimulationEvent),
    health: {
      status: agentsAlive > 0 ? "Healthy" : "Warning",
      diagnostics: agentsAlive > 0 ? undefined : ["No living humans were available for goal evaluation."],
      metadata: {
        agentsAlive,
        evaluatedAgents: result.state.agents.length,
        activeGoals: result.state.agents.filter((agent) => agent.currentGoal?.status === "Active").length,
      },
    },
    metadata: {
      deterministic: true,
      implementationLayer: "goal-based decision architecture",
      schedulerOrder: "after Human Needs update and before future civilization systems",
      evaluatedAgents: result.state.agents.length,
      activeGoals: result.state.agents.map((agent) => ({
        agentId: agent.id,
        goal: agent.currentGoal,
        goalHistory: agent.goalHistory.slice(-8),
      })),
      emittedGoalEvents: emittedEvents.length,
      suppressedGoalEvents: goalEvents.length - emittedEvents.length,
    },
  };
}

export const goalDecisionSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: ["humans"],
  update: run,
  run,
};
