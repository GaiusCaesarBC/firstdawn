import { getHumanMvaStateAtTick } from "../human-engine";
import { HUMAN_GOAL_DECISION_SYSTEM_ID, HUMAN_TICK_RESULT_CACHE_KEY } from "../human-goals";
import { HUMAN_KNOWLEDGE_SYSTEM_ID } from "../human-knowledge";
import { HUMAN_RELATIONSHIP_SYSTEM_ID } from "../human-relationships";
import type { HumanKnowledge, HumanKnowledgeSystemEvent, HumanTickResult } from "../human-types";
import type {
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemResult,
} from "./types";

const SYSTEM_NAME = HUMAN_KNOWLEDGE_SYSTEM_ID;
const SYSTEM_LABEL = "Knowledge & Learning Engine";
const SYSTEM_ORDER = 124;

function cachedHumanResult(context: SimulationSystemContext): HumanTickResult {
  const cached = context.cache.get(HUMAN_TICK_RESULT_CACHE_KEY);

  if (cached && typeof cached === "object" && "state" in cached && "newEvents" in cached) {
    return cached as HumanTickResult;
  }

  const result = getHumanMvaStateAtTick(context.world, context.tick);
  context.cache.set(HUMAN_TICK_RESULT_CACHE_KEY, result);

  return result;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 1_000_000) / 1_000_000;
}

function byAgent(knowledge: readonly HumanKnowledge[]): Record<string, number> {
  return knowledge.reduce<Record<string, number>>((counts, entry) => ({
    ...counts,
    [entry.agentId]: (counts[entry.agentId] ?? 0) + 1,
  }), {});
}

function knowledgeEventToSimulationEvent(event: HumanKnowledgeSystemEvent): SimulationSystemEvent {
  return {
    type: `Human Knowledge ${event.kind}`,
    title: event.kind,
    description: event.summary,
    historicalWeight: Math.max(0.34, event.importance),
    metadata: {
      eventId: event.id,
      tick: event.tick,
      humanId: event.humanId,
      targetHumanId: event.targetHumanId,
      knowledgeId: event.knowledgeId,
      topic: event.topic,
      category: event.category,
      kind: event.kind,
      confidence: event.confidence,
      mastery: event.mastery,
      sourceEventId: event.sourceEventId,
      chroniclerVisible: true,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const result = cachedHumanResult(context);
  const livingAgents = result.state.agents.filter((agent) => agent.isAlive);
  const activeKnowledge = result.state.knowledge.filter((entry) => !entry.isForgotten);
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedKnowledgeEvents = turboMode ? [] : fastMode ? result.knowledgeEvents.slice(-2) : result.knowledgeEvents;

  context.metrics.addEntities(livingAgents.length + activeKnowledge.length);

  return {
    success: true,
    events: emittedKnowledgeEvents.map(knowledgeEventToSimulationEvent),
    health: {
      status: livingAgents.length > 0 ? "Healthy" : "Warning",
      diagnostics: livingAgents.length > 0 ? undefined : ["No living humans were available for knowledge updates."],
      metadata: {
        livingAgents: livingAgents.length,
        knowledgeCount: result.state.knowledge.length,
        activeKnowledgeCount: activeKnowledge.length,
        averageConfidence: average(activeKnowledge.map((entry) => entry.confidence)),
        averageMastery: average(activeKnowledge.map((entry) => entry.mastery)),
      },
    },
    metadata: {
      deterministic: true,
      schedulerOrder: "after Relationship Engine and before Civilization",
      implementationLayer: "knowledge and learning architecture",
      pluginBasedCategories: true,
      globalUnlocks: false,
      localTeachingTargetLimit: 6,
      knowledgeCount: result.state.knowledge.length,
      knowledgeCountByAgent: byAgent(activeKnowledge),
      recentlyLearned: activeKnowledge
        .filter((entry) => entry.learnedTick === context.tick.toString())
        .slice(-8)
        .map((entry) => ({ id: entry.id, agentId: entry.agentId, topic: entry.topic, category: entry.category, confidence: entry.confidence, mastery: entry.mastery })),
      recentKnowledgeEvents: result.knowledgeEvents.slice(-8),
      emittedKnowledgeEvents: emittedKnowledgeEvents.length,
      suppressedKnowledgeEvents: result.knowledgeEvents.length - emittedKnowledgeEvents.length,
      forbiddenSystemsImplemented: [],
    },
  };
}

export const knowledgeSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: [HUMAN_GOAL_DECISION_SYSTEM_ID, "memory", HUMAN_RELATIONSHIP_SYSTEM_ID],
  update: run,
  run,
};