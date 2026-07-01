import { HUMAN_COMMUNICATION_SYSTEM_ID } from "../human-communication";
import { HUMAN_TICK_RESULT_CACHE_KEY } from "../human-goals";
import { getHumanMvaStateAtTick } from "../human-engine";
import type { HumanCommunicationRecord, HumanCommunicationSystemEvent, HumanTickResult } from "../human-types";
import type {
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemResult,
} from "./types";

const SYSTEM_NAME = HUMAN_COMMUNICATION_SYSTEM_ID;
const SYSTEM_LABEL = "Communication Engine";
const SYSTEM_ORDER = 125;

function cachedHumanResult(context: SimulationSystemContext): HumanTickResult {
  const cached = context.cache.get(HUMAN_TICK_RESULT_CACHE_KEY);

  if (cached && typeof cached === "object" && "state" in cached && "newEvents" in cached) {
    return cached as HumanTickResult;
  }

  const result = getHumanMvaStateAtTick(context.world, context.tick);
  context.cache.set(HUMAN_TICK_RESULT_CACHE_KEY, result);

  return result;
}

function communicationEventToSimulationEvent(event: HumanCommunicationSystemEvent): SimulationSystemEvent {
  return {
    type: `Human Communication ${event.kind}`,
    title: event.kind,
    description: event.summary,
    historicalWeight: Math.max(0.34, event.importance),
    metadata: {
      eventId: event.id,
      tick: event.tick,
      communicationId: event.communicationId,
      senderHumanId: event.senderHumanId,
      receiverHumanIds: event.receiverHumanIds,
      communicationType: event.type,
      topic: event.topic,
      successRate: event.successRate,
      chroniclerVisible: true,
    },
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 1_000_000) / 1_000_000;
}

function communicationSuccessRate(communications: readonly HumanCommunicationRecord[]): number {
  const receptions = communications.flatMap((communication) => communication.receptions);

  return receptions.length === 0
    ? 0
    : average(receptions.map((reception) => reception.accepted ? 1 : 0));
}

function byType(communications: readonly HumanCommunicationRecord[]): Record<string, number> {
  return communications.reduce<Record<string, number>>((counts, communication) => ({
    ...counts,
    [communication.type]: (counts[communication.type] ?? 0) + 1,
  }), {});
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const result = cachedHumanResult(context);
  const livingAgents = result.state.agents.filter((agent) => agent.isAlive);
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedCommunicationEvents = turboMode ? [] : fastMode ? result.communicationEvents.slice(-2) : result.communicationEvents;
  const communications = result.state.communications;
  const ignoredMessages = communications.filter((communication) => communication.receptions.some((reception) => reception.ignored));
  const teachingMessages = communications.filter((communication) => communication.type === "Teaching");
  const warningMessages = communications.filter((communication) => communication.type === "Warning" || communication.type === "Danger");

  context.metrics.addEntities(livingAgents.length + communications.length);

  return {
    success: true,
    events: emittedCommunicationEvents.map(communicationEventToSimulationEvent),
    health: {
      status: livingAgents.length > 0 ? "Healthy" : "Warning",
      diagnostics: livingAgents.length > 0 ? undefined : ["No living humans were available for communication updates."],
      metadata: {
        livingAgents: livingAgents.length,
        communicationCount: communications.length,
        successRate: communicationSuccessRate(communications),
      },
    },
    metadata: {
      deterministic: true,
      schedulerOrder: "after Knowledge & Learning Engine and before Civilization",
      implementationLayer: "primitive communication architecture",
      pluginBasedTypes: true,
      pluginBasedMethods: true,
      globalBroadcasts: false,
      localTargetLimit: 8,
      communicationCount: communications.length,
      communicationCountByType: byType(communications),
      successRate: communicationSuccessRate(communications),
      averageClarity: average(communications.map((communication) => communication.clarity)),
      averageConfidence: average(communications.map((communication) => communication.confidence)),
      ignoredMessages: ignoredMessages.slice(-8),
      teachingHistory: teachingMessages.slice(-8),
      warningHistory: warningMessages.slice(-8),
      recentCommunications: communications.slice(-8),
      emittedCommunicationEvents: emittedCommunicationEvents.length,
      suppressedCommunicationEvents: result.communicationEvents.length - emittedCommunicationEvents.length,
      forbiddenSystemsImplemented: [],
    },
  };
}

export const communicationSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: ["knowledge"],
  update: run,
  run,
};

