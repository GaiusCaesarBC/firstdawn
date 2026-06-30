import type {
  HumanAgent,
  HumanCausalEvent,
  HumanMemory,
} from "./human-types";

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function valenceForEvent(event: HumanCausalEvent): number {
  if (event.type.includes("Communication") || event.type.includes("Teaching") || event.type.includes("Need")) {
    return 0.65;
  }

  return 0.5;
}

export function createEpisodicMemory(
  agent: HumanAgent,
  event: HumanCausalEvent,
): HumanMemory {
  return {
    id: `${event.id}:memory:${agent.id}`,
    worldId: agent.worldId,
    agentId: agent.id,
    tick: event.tick,
    cellId: agent.currentCellId,
    participants: event.agentIds,
    eventType: event.type,
    summary: event.summary,
    emotionAtEncoding: { ...agent.emotions },
    needContext: { ...agent.needs },
    salience: round(0.55 + Math.max(agent.emotions.fear, agent.emotions.relief, agent.emotions.attachment) * 0.35),
    confidence: 0.9,
    valence: valenceForEvent(event),
    sourceEventId: event.id,
    causalLinks: Object.keys(event.causes),
  };
}

export function createMemoriesForEvent(
  agents: readonly HumanAgent[],
  event: HumanCausalEvent,
): HumanMemory[] {
  return agents
    .filter((agent) => event.agentIds.includes(agent.id))
    .map((agent) => createEpisodicMemory(agent, event));
}
