import { getHumanMvaStateAtTick } from "../human-engine";
import { HUMAN_TICK_RESULT_CACHE_KEY } from "../human-goals";
import type { HumanMemory, HumanMemorySystemEvent, HumanTickResult } from "../human-types";
import type {
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemResult,
} from "./types";

const SYSTEM_NAME = "memory";
const SYSTEM_LABEL = "Episodic Memory Engine";
const SYSTEM_ORDER = 122;

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

function byAgent(memories: readonly HumanMemory[]): Record<string, number> {
  return memories.reduce<Record<string, number>>((counts, memory) => ({
    ...counts,
    [memory.agentId]: (counts[memory.agentId] ?? 0) + 1,
  }), {});
}

function memoryEventToSimulationEvent(event: HumanMemorySystemEvent): SimulationSystemEvent {
  return {
    type: `Human Memory ${event.kind}`,
    title: event.title,
    description: event.summary,
    historicalWeight: event.kind === "faded" ? 0.28 : event.importance,
    metadata: {
      eventId: event.id,
      tick: event.tick,
      agentId: event.agentId,
      memoryId: event.memoryId,
      memoryType: event.memoryType,
      kind: event.kind,
      importance: event.importance,
      confidence: event.confidence,
      cellId: event.locationCellId,
      chroniclerVisible: true,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const result = cachedHumanResult(context);
  const livingAgents = result.state.agents.filter((agent) => agent.isAlive);
  const memories = result.state.memories;
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedMemoryEvents = turboMode ? [] : fastMode ? result.memoryEvents.slice(-2) : result.memoryEvents;
  const dangerMemories = memories.filter((memory) => memory.tags.includes("danger"));
  const foodMemories = memories.filter((memory) => memory.tags.includes("food"));
  const relationshipMemories = memories.filter((memory) => memory.tags.includes("relationship"));

  context.metrics.addEntities(livingAgents.length);

  return {
    success: true,
    events: emittedMemoryEvents.map(memoryEventToSimulationEvent),
    health: {
      status: livingAgents.length > 0 ? "Healthy" : "Warning",
      diagnostics: livingAgents.length > 0 ? undefined : ["No living humans were available for episodic memory updates."],
      metadata: {
        livingAgents: livingAgents.length,
        memoryCount: memories.length,
        averageConfidence: average(memories.map((memory) => memory.confidence)),
        averageImportance: average(memories.map((memory) => memory.importance)),
      },
    },
    metadata: {
      deterministic: true,
      schedulerOrder: "after Goal Decision Engine and before Civilization",
      implementationLayer: "episodic memory architecture",
      pluginBasedMemoryTypes: true,
      fullMemoryScansPerGoal: false,
      memoryCount: memories.length,
      memoryCountByAgent: byAgent(memories),
      averageConfidence: average(memories.map((memory) => memory.confidence)),
      averageImportance: average(memories.map((memory) => memory.importance)),
      dangerMemoryCount: dangerMemories.length,
      foodMemoryCount: foodMemories.length,
      relationshipMemoryCount: relationshipMemories.length,
      recentMemories: memories.slice(-8).map((memory) => ({
        id: memory.id,
        agentId: memory.agentId,
        type: memory.type,
        category: memory.category,
        locationCellId: memory.locationCellId,
        importance: memory.importance,
        confidence: memory.confidence,
        recallCount: memory.recallCount,
      })),
      emittedMemoryEvents: emittedMemoryEvents.length,
      suppressedMemoryEvents: result.memoryEvents.length - emittedMemoryEvents.length,
    },
  };
}

export const memorySystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: ["goal-decision"],
  update: run,
  run,
};
