import { getHumanMvaStateAtTick } from "../human-engine";
import { HUMAN_GOAL_DECISION_SYSTEM_ID, HUMAN_TICK_RESULT_CACHE_KEY } from "../human-goals";
import { HUMAN_RELATIONSHIP_SYSTEM_ID } from "../human-relationships";
import type { HumanRelationshipSystemEvent, HumanTickResult } from "../human-types";
import type {
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemResult,
} from "./types";

const SYSTEM_NAME = HUMAN_RELATIONSHIP_SYSTEM_ID;
const SYSTEM_LABEL = "Relationship Engine";
const SYSTEM_ORDER = 123;

function cachedHumanResult(context: SimulationSystemContext): HumanTickResult {
  const cached = context.cache.get(HUMAN_TICK_RESULT_CACHE_KEY);

  if (cached && typeof cached === "object" && "state" in cached && "newEvents" in cached) {
    return cached as HumanTickResult;
  }

  const result = getHumanMvaStateAtTick(context.world, context.tick);
  context.cache.set(HUMAN_TICK_RESULT_CACHE_KEY, result);

  return result;
}

function relationshipEventToSimulationEvent(event: HumanRelationshipSystemEvent): SimulationSystemEvent {
  return {
    type: `Human Relationship ${event.kind}`,
    title: event.kind,
    description: event.summary,
    historicalWeight: Math.max(0.32, event.score),
    metadata: {
      eventId: event.id,
      tick: event.tick,
      humanId: event.humanId,
      targetHumanId: event.targetHumanId,
      kind: event.kind,
      previousStatus: event.previousStatus,
      status: event.status,
      score: event.score,
      sourceEventId: event.sourceEventId,
      chroniclerVisible: true,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const result = cachedHumanResult(context);
  const livingAgents = result.state.agents.filter((agent) => agent.isAlive);
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedRelationshipEvents = turboMode ? [] : fastMode ? result.relationshipEvents.slice(-2) : result.relationshipEvents;
  const knownRelationships = result.state.relationships.filter((relationship) => relationship.status !== "Unknown");

  context.metrics.addEntities(livingAgents.length + knownRelationships.length);

  return {
    success: true,
    events: emittedRelationshipEvents.map(relationshipEventToSimulationEvent),
    health: {
      status: livingAgents.length > 0 ? "Healthy" : "Warning",
      diagnostics: livingAgents.length > 0 ? undefined : ["No living humans were available for relationship updates."],
      metadata: {
        livingAgents: livingAgents.length,
        relationshipCount: result.state.relationships.length,
        knownRelationshipCount: knownRelationships.length,
      },
    },
    metadata: {
      deterministic: true,
      schedulerOrder: "after Episodic Memory Engine and before Civilization",
      implementationLayer: "relationship engine foundation",
      avoidsFullPopulationPairScans: true,
      localTargetLimitPerAgent: 8,
      evaluatedRelationshipCount: result.state.relationships.length,
      relationshipCountByAgent: Object.fromEntries(livingAgents.map((agent) => [
        agent.id,
        result.state.relationships.filter((relationship) => relationship.humanId === agent.id).length,
      ])),
      recentRelationshipChanges: result.relationshipEvents.slice(-8),
      emittedRelationshipEvents: emittedRelationshipEvents.length,
      suppressedRelationshipEvents: result.relationshipEvents.length - emittedRelationshipEvents.length,
      forbiddenSystemsImplemented: [],
    },
  };
}

export const relationshipSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: [HUMAN_GOAL_DECISION_SYSTEM_ID, "memory"],
  update: run,
  run,
};