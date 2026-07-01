import type {
  HumanAgent,
  HumanCausalEvent,
  HumanGoalType,
  HumanMemory,
  HumanMemorySystemEvent,
} from "./human-types";

export type HumanMemoryTypeDefinition = {
  type: string;
  category: string;
  defaultTags: readonly string[];
  retentionTicks: number;
  baseImportance: number;
};

export type HumanMemoryIndex = ReadonlyMap<string, readonly HumanMemory[]>;

export type MemoryRecallTrigger = {
  goalType?: HumanGoalType | null;
  cellId?: string | null;
  relatedHumanId?: string | null;
  tags?: readonly string[];
};

export type RecalledHumanMemory = HumanMemory & {
  relevance: number;
};

export type MemoryUpdateResult = {
  memories: HumanMemory[];
  memoryEvents: HumanMemorySystemEvent[];
  eventMemoryIds: Map<string, string[]>;
};

type MemoryEncoding = {
  type: string;
  subjectId: string;
  source: string;
  relatedEntityId: string | null;
  relatedHumanId: string | null;
  tags: string[];
  notes: string;
  importance: number;
  confidence: number;
  emotionalWeight: number;
  valence: number;
};

const MEMORY_SIGNIFICANCE_THRESHOLD = 0.34;
const MAJOR_MEMORY_THRESHOLD = 0.68;
const MAJOR_REINFORCEMENT_THRESHOLD = 0.72;
const FADED_CONFIDENCE_THRESHOLD = 0.28;
const MAX_RECALLED_MEMORIES = 8;

const INITIAL_MEMORY_TYPES: readonly HumanMemoryTypeDefinition[] = Object.freeze([
  { type: "Food Source", category: "Survival Memory", defaultTags: ["food", "resource", "survival"], retentionTicks: 720, baseImportance: 0.58 },
  { type: "Water Source", category: "Survival Memory", defaultTags: ["water", "resource", "survival"], retentionTicks: 840, baseImportance: 0.64 },
  { type: "Shelter", category: "Spatial Memory", defaultTags: ["shelter", "safety"], retentionTicks: 720, baseImportance: 0.56 },
  { type: "Danger", category: "Survival Memory", defaultTags: ["danger", "risk", "survival"], retentionTicks: 1_200, baseImportance: 0.82 },
  { type: "Predator", category: "Survival Memory", defaultTags: ["predator", "danger"], retentionTicks: 1_200, baseImportance: 0.86 },
  { type: "Storm", category: "Environmental Memory", defaultTags: ["weather", "danger"], retentionTicks: 840, baseImportance: 0.72 },
  { type: "Fire", category: "Environmental Memory", defaultTags: ["fire", "danger"], retentionTicks: 1_200, baseImportance: 0.84 },
  { type: "Flood", category: "Environmental Memory", defaultTags: ["flood", "water", "danger"], retentionTicks: 1_200, baseImportance: 0.82 },
  { type: "Death", category: "Personal Experience", defaultTags: ["death", "social", "danger"], retentionTicks: 2_400, baseImportance: 0.92 },
  { type: "Birth", category: "Social Memory", defaultTags: ["birth", "kinship"], retentionTicks: 2_400, baseImportance: 0.88 },
  { type: "Discovery", category: "Knowledge", defaultTags: ["discovery", "novelty"], retentionTicks: 720, baseImportance: 0.6 },
  { type: "Friendship", category: "Social Memory", defaultTags: ["friendship", "relationship"], retentionTicks: 1_600, baseImportance: 0.7 },
  { type: "Conflict", category: "Social Memory", defaultTags: ["conflict", "relationship"], retentionTicks: 1_600, baseImportance: 0.76 },
  { type: "Conversation", category: "Social Memory", defaultTags: ["conversation", "relationship"], retentionTicks: 640, baseImportance: 0.48 },
  { type: "Travel", category: "Spatial Memory", defaultTags: ["travel", "spatial"], retentionTicks: 520, baseImportance: 0.44 },
  { type: "Observation", category: "Environmental Memory", defaultTags: ["observation", "environment"], retentionTicks: 520, baseImportance: 0.42 },
  { type: "Unknown Object", category: "Knowledge", defaultTags: ["unknown", "object"], retentionTicks: 720, baseImportance: 0.54 },
  { type: "Lost Resource", category: "Survival Memory", defaultTags: ["loss", "resource"], retentionTicks: 720, baseImportance: 0.58 },
  { type: "Safe Area", category: "Spatial Memory", defaultTags: ["safe", "shelter", "spatial"], retentionTicks: 920, baseImportance: 0.62 },
  { type: "Goal Completed", category: "Personal Experience", defaultTags: ["goal", "success"], retentionTicks: 640, baseImportance: 0.52 },
  { type: "Goal Failed", category: "Personal Experience", defaultTags: ["goal", "failure"], retentionTicks: 840, baseImportance: 0.66 },
]);

const memoryTypeRegistry = new Map(INITIAL_MEMORY_TYPES.map((definition) => [definition.type, definition]));

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, round(value)));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function memoryTypeDefinition(type: string): HumanMemoryTypeDefinition {
  return memoryTypeRegistry.get(type) ?? {
    type,
    category: "Personal Experience",
    defaultTags: [],
    retentionTicks: 640,
    baseImportance: 0.5,
  };
}

export function registerHumanMemoryType(definition: HumanMemoryTypeDefinition): void {
  memoryTypeRegistry.set(definition.type, {
    ...definition,
    defaultTags: unique(definition.defaultTags),
    retentionTicks: Math.max(1, Math.round(definition.retentionTicks)),
    baseImportance: clamp01(definition.baseImportance),
  });
}

function valenceForEvent(event: HumanCausalEvent, fallback = 0.5): number {
  if (event.type.includes("Failed") || event.type.includes("Danger") || event.type.includes("Conflict")) {
    return 0.18;
  }

  if (event.type.includes("Need") || event.type.includes("Communication") || event.type.includes("Teaching") || event.type.includes("Secured")) {
    return 0.68;
  }

  return fallback;
}

function relatedHumanFor(agent: HumanAgent, event: HumanCausalEvent): string | null {
  return event.agentIds.find((agentId) => agentId !== agent.id) ?? null;
}

function goalTypeFromEvent(event: HumanCausalEvent): string {
  const goalType = event.causes.goalType;

  return typeof goalType === "string" ? goalType : "unknown-goal";
}

function encodeMemory(agent: HumanAgent, event: HumanCausalEvent): MemoryEncoding | null {
  const emotionalPressure = Math.max(agent.emotions.fear, agent.emotions.relief, agent.emotions.attachment, agent.emotions.distress);
  const survivalPressure = Math.max(agent.needs.hunger, agent.needs.thirst, agent.needs.safety);

  if (event.type === "Human Need Fulfilled" && event.title.includes("Water")) {
    return {
      type: "Water Source",
      subjectId: "resource:clean-water",
      source: "direct-experience",
      relatedEntityId: null,
      relatedHumanId: null,
      tags: ["water", "need-fulfilled", "survival"],
      notes: "Thirst was reduced here.",
      importance: 0.58 + survivalPressure * 0.16 + agent.emotions.relief * 0.12,
      confidence: 0.86,
      emotionalWeight: 0.36 + agent.emotions.relief * 0.32,
      valence: 0.72,
    };
  }

  if (event.type === "Human Need Fulfilled" && event.title.includes("Food")) {
    return {
      type: "Food Source",
      subjectId: "resource:edible-plants",
      source: "direct-experience",
      relatedEntityId: null,
      relatedHumanId: null,
      tags: ["food", "need-fulfilled", "survival"],
      notes: "Hunger was reduced here.",
      importance: 0.54 + survivalPressure * 0.15 + agent.emotions.relief * 0.12,
      confidence: 0.84,
      emotionalWeight: 0.32 + agent.emotions.relief * 0.3,
      valence: 0.7,
    };
  }

  if (event.type === "Human Safety Check Failed") {
    return {
      type: "Danger",
      subjectId: "danger:local-threat",
      source: "direct-experience",
      relatedEntityId: null,
      relatedHumanId: null,
      tags: ["danger", "failed-safety", "survival"],
      notes: "A serious local threat could not be resolved safely.",
      importance: 0.78 + agent.emotions.fear * 0.18,
      confidence: 0.88,
      emotionalWeight: 0.66 + agent.emotions.fear * 0.28,
      valence: 0.12,
    };
  }

  if (event.type === "Human Safety Secured") {
    return {
      type: "Safe Area",
      subjectId: "place:safer-ground",
      source: "direct-experience",
      relatedEntityId: null,
      relatedHumanId: null,
      tags: ["safe", "shelter", "survival"],
      notes: "The surroundings felt safer after checking the area.",
      importance: 0.52 + agent.emotions.relief * 0.18,
      confidence: 0.78,
      emotionalWeight: 0.34 + agent.emotions.relief * 0.22,
      valence: 0.74,
    };
  }

  if (event.type === "Human Communication" || event.type === "Human Communication Event") {
    const relatedHumanId = relatedHumanFor(agent, event);

    return {
      type: "Conversation",
      subjectId: relatedHumanId ? `human:${relatedHumanId}:conversation` : "social:conversation",
      source: "direct-social-experience",
      relatedEntityId: relatedHumanId,
      relatedHumanId,
      tags: ["conversation", "social", "relationship"],
      notes: "A companion communicated nearby.",
      importance: 0.42 + agent.emotions.attachment * 0.16 + agent.emotions.trust * 0.08,
      confidence: 0.82,
      emotionalWeight: 0.3 + agent.emotions.attachment * 0.28,
      valence: 0.66,
    };
  }

  if (event.type === "Human Teaching") {
    const relatedHumanId = relatedHumanFor(agent, event);

    return {
      type: "Conversation",
      subjectId: relatedHumanId ? `human:${relatedHumanId}:teaching` : "social:teaching",
      source: "direct-social-experience",
      relatedEntityId: relatedHumanId,
      relatedHumanId,
      tags: ["conversation", "teaching", "knowledge", "relationship"],
      notes: "Teaching connected a person to practical knowledge.",
      importance: 0.48 + agent.personality.teachAffinity * 0.16,
      confidence: 0.76,
      emotionalWeight: 0.28 + agent.emotions.trust * 0.18,
      valence: 0.64,
    };
  }

  if (event.type === "Human Dangerous Movement") {
    return {
      type: "Danger",
      subjectId: `danger:${event.cellId}:movement`,
      source: "direct-travel-experience",
      relatedEntityId: event.cellId,
      relatedHumanId: null,
      tags: ["danger", "travel", "survival"],
      notes: "Movement through dangerous terrain made this place feel risky.",
      importance: 0.7 + agent.emotions.fear * 0.16,
      confidence: 0.8,
      emotionalWeight: 0.58 + agent.emotions.fear * 0.24,
      valence: 0.16,
    };
  }

  if (event.type === "Human Movement" || event.type === "Human Migration Started" || event.type === "Human Long-Distance Travel" || event.type === "Human Returned To Remembered Location" || event.type === "Human Dangerous Escape") {
    return {
      type: "Travel",
      subjectId: `route:${event.causes.fromCellId ?? "unknown"}:${event.cellId}`,
      source: "direct-travel-experience",
      relatedEntityId: event.cellId,
      relatedHumanId: null,
      tags: ["travel", "spatial", "observation"],
      notes: "Movement connected neighboring places into a personal route.",
      importance: 0.42 + agent.curiosityProfile.noveltySeeking * 0.1 + (event.type === "Human Dangerous Escape" ? 0.18 : 0),
      confidence: 0.72,
      emotionalWeight: 0.24 + Math.max(agent.emotions.curiosity, agent.emotions.fear) * 0.14,
      valence: event.type === "Human Dangerous Escape" ? 0.46 : 0.58,
    };
  }
  if (event.type === "Human Observation") {
    return {
      type: "Observation",
      subjectId: `place:${event.cellId}:surroundings`,
      source: "direct-observation",
      relatedEntityId: event.cellId,
      relatedHumanId: null,
      tags: ["observation", "environment", "spatial"],
      notes: "Local surroundings and landmarks became more familiar.",
      importance: 0.38 + agent.curiosityProfile.environmental * 0.12,
      confidence: 0.72,
      emotionalWeight: 0.22 + agent.emotions.curiosity * 0.16,
      valence: 0.56,
    };
  }

  if (event.type === "Human Exploration") {
    return {
      type: "Travel",
      subjectId: `place:${event.cellId}:route`,
      source: "direct-exploration",
      relatedEntityId: event.cellId,
      relatedHumanId: null,
      tags: ["travel", "discovery", "spatial"],
      notes: "Exploration made this area part of the personal map.",
      importance: 0.4 + agent.curiosityProfile.noveltySeeking * 0.14,
      confidence: 0.7,
      emotionalWeight: 0.2 + agent.emotions.curiosity * 0.18,
      valence: 0.58,
    };
  }

  if (event.type === "Human Goal Completed") {
    return {
      type: "Goal Completed",
      subjectId: `goal:${goalTypeFromEvent(event)}`,
      source: "goal-outcome",
      relatedEntityId: null,
      relatedHumanId: relatedHumanFor(agent, event),
      tags: ["goal", "success", goalTypeFromEvent(event).toLowerCase().replaceAll(" ", "-")],
      notes: "A personal goal was completed.",
      importance: 0.46 + agent.emotions.relief * 0.18,
      confidence: 0.82,
      emotionalWeight: 0.3 + agent.emotions.relief * 0.22,
      valence: 0.68,
    };
  }

  if (event.type === "Human Goal Failed" || event.type === "Human Goal Interrupted") {
    return {
      type: "Goal Failed",
      subjectId: `goal:${goalTypeFromEvent(event)}`,
      source: "goal-outcome",
      relatedEntityId: null,
      relatedHumanId: relatedHumanFor(agent, event),
      tags: ["goal", "failure", goalTypeFromEvent(event).toLowerCase().replaceAll(" ", "-")],
      notes: "A personal goal failed or was interrupted.",
      importance: 0.54 + agent.emotions.fear * 0.18 + agent.emotions.distress * 0.12,
      confidence: 0.8,
      emotionalWeight: 0.38 + emotionalPressure * 0.24,
      valence: 0.24,
    };
  }

  return null;
}

function memoryKey(agentId: string, encoding: Pick<MemoryEncoding, "type" | "subjectId" | "relatedHumanId">, cellId: string): string {
  return [agentId, encoding.type, encoding.subjectId, cellId, encoding.relatedHumanId ?? "none"].join("|");
}

function memoryEvent(input: {
  tick: bigint;
  agentId: string;
  memory: HumanMemory;
  kind: HumanMemorySystemEvent["kind"];
}): HumanMemorySystemEvent {
  const kindLabel = input.kind === "formed" ? "Formed" : input.kind === "reinforced" ? "Reinforced" : "Faded";

  return {
    id: `${input.memory.id}:memory-event:${input.kind}:${input.tick.toString()}`,
    worldId: input.memory.worldId,
    tick: input.tick.toString(),
    agentId: input.agentId,
    memoryId: input.memory.id,
    memoryType: input.memory.type,
    kind: input.kind,
    title: `Memory ${kindLabel}: ${input.memory.type}`,
    summary: `${input.memory.type} memory ${input.kind} for ${input.agentId} at ${input.memory.locationCellId}.`,
    importance: input.memory.importance,
    confidence: input.memory.confidence,
    locationCellId: input.memory.locationCellId,
  };
}

function createMemory(agent: HumanAgent, event: HumanCausalEvent, encoding: MemoryEncoding): HumanMemory {
  const definition = memoryTypeDefinition(encoding.type);
  const importance = clamp01((encoding.importance + definition.baseImportance) / 2);
  const tags = unique([...definition.defaultTags, ...encoding.tags]);

  return {
    id: `${agent.id}:memory:${encoding.type.toLowerCase().replaceAll(" ", "-")}:${event.cellId}:${encoding.subjectId}:${event.tick}`,
    worldId: agent.worldId,
    agentId: agent.id,
    type: encoding.type,
    category: definition.category,
    subjectId: encoding.subjectId,
    locationCellId: event.cellId,
    createdTick: event.tick,
    lastRecalledTick: event.tick,
    importance,
    emotionalWeight: clamp01(encoding.emotionalWeight),
    source: encoding.source,
    relatedEntityId: encoding.relatedEntityId,
    relatedHumanId: encoding.relatedHumanId,
    tags,
    notes: encoding.notes,
    recallCount: 1,
    exposureCount: 1,
    tick: event.tick,
    cellId: event.cellId,
    participants: event.agentIds,
    eventType: event.type,
    summary: event.summary,
    emotionAtEncoding: { ...agent.emotions },
    needContext: { ...agent.needs },
    salience: importance,
    confidence: clamp01(encoding.confidence),
    valence: valenceForEvent(event, encoding.valence),
    sourceEventId: event.id,
    causalLinks: Object.keys(event.causes).sort(),
  };
}

function decayMemory(memory: HumanMemory, tick: bigint): HumanMemory {
  const definition = memoryTypeDefinition(memory.type);
  const currentTick = BigInt(memory.tick);
  const elapsed = Number(tick > currentTick ? tick - currentTick : 0n);
  const retentionFactor = Math.max(1, definition.retentionTicks);
  const importanceProtection = 0.35 + memory.importance * 0.65;
  const confidenceDecay = Math.min(0.04, (elapsed / retentionFactor) * 0.012 * (1.15 - importanceProtection));
  const importanceDecay = Math.min(0.025, (elapsed / retentionFactor) * 0.006 * (1.1 - importanceProtection));

  return {
    ...memory,
    tick: tick.toString(),
    confidence: clamp01(memory.confidence - confidenceDecay),
    importance: clamp01(memory.importance - importanceDecay),
    emotionalWeight: clamp01(memory.emotionalWeight - Math.min(0.018, elapsed / retentionFactor * 0.004)),
    salience: clamp01(memory.importance - importanceDecay),
  };
}

function recallBySituation(agent: HumanAgent, memory: HumanMemory, tick: bigint): HumanMemory {
  const sameCell = memory.locationCellId === agent.currentCellId;
  const activeGoal = agent.currentGoal?.type ?? null;
  const goalTag = activeGoal?.toLowerCase().replaceAll(" ", "-") ?? null;
  const goalRelevant = goalTag ? memory.tags.includes(goalTag) : false;
  const survivalRelevant = (agent.needs.hunger > 0.7 && memory.tags.includes("food")) ||
    (agent.needs.thirst > 0.7 && memory.tags.includes("water")) ||
    (agent.needs.safety > 0.62 && memory.tags.includes("danger"));

  if (!sameCell && !goalRelevant && !survivalRelevant) {
    return memory;
  }

  return {
    ...memory,
    lastRecalledTick: tick.toString(),
    recallCount: memory.recallCount + 1,
    confidence: clamp01(memory.confidence + 0.006 + memory.importance * 0.006),
  };
}

function reinforceMemory(existing: HumanMemory, incoming: HumanMemory, tick: bigint): HumanMemory {
  const confidenceGain = (1 - existing.confidence) * (0.1 + incoming.importance * 0.08);
  const importanceGain = (1 - existing.importance) * (incoming.importance * 0.09);

  return {
    ...existing,
    tick: tick.toString(),
    lastRecalledTick: tick.toString(),
    importance: clamp01(existing.importance + importanceGain),
    confidence: clamp01(existing.confidence + confidenceGain),
    emotionalWeight: clamp01(Math.max(existing.emotionalWeight, incoming.emotionalWeight) + 0.025),
    recallCount: existing.recallCount + 1,
    exposureCount: existing.exposureCount + 1,
    summary: incoming.importance > existing.importance ? incoming.summary : existing.summary,
    notes: incoming.importance > existing.importance ? incoming.notes : existing.notes,
    tags: unique([...existing.tags, ...incoming.tags]),
    causalLinks: unique([...existing.causalLinks, ...incoming.causalLinks]),
    salience: clamp01(existing.importance + importanceGain),
  };
}

export function createHumanMemoryIndex(memories: readonly HumanMemory[]): HumanMemoryIndex {
  const byAgent = new Map<string, HumanMemory[]>();

  for (const memory of memories) {
    const entries = byAgent.get(memory.agentId) ?? [];
    entries.push(memory);
    byAgent.set(memory.agentId, entries);
  }

  for (const [agentId, entries] of byAgent.entries()) {
    byAgent.set(agentId, [...entries].sort((left, right) =>
      right.importance - left.importance || right.confidence - left.confidence || left.id.localeCompare(right.id)
    ));
  }

  return byAgent;
}

function relevance(memory: HumanMemory, trigger: MemoryRecallTrigger, tick: bigint): number {
  const recencyTicks = Number(tick - BigInt(memory.lastRecalledTick));
  const recency = 1 / (1 + Math.max(0, recencyTicks) / 240);
  const locationBoost = trigger.cellId && trigger.cellId === memory.locationCellId ? 0.28 : 0;
  const humanBoost = trigger.relatedHumanId && trigger.relatedHumanId === memory.relatedHumanId ? 0.24 : 0;
  const tagBoost = (trigger.tags ?? []).some((tag) => memory.tags.includes(tag)) ? 0.2 : 0;
  const goalTag = trigger.goalType?.toLowerCase().replaceAll(" ", "-") ?? null;
  const goalBoost = goalTag && memory.tags.includes(goalTag) ? 0.18 : 0;

  return round(memory.importance * 0.42 + memory.confidence * 0.32 + memory.emotionalWeight * 0.16 + recency * 0.1 + locationBoost + humanBoost + tagBoost + goalBoost);
}

export function recallRelevantMemories(input: {
  agent: HumanAgent;
  memories?: readonly HumanMemory[];
  memoryIndex?: HumanMemoryIndex;
  tick: bigint;
  trigger?: MemoryRecallTrigger;
  limit?: number;
}): RecalledHumanMemory[] {
  const source = input.memoryIndex?.get(input.agent.id) ?? input.memories?.filter((memory) => memory.agentId === input.agent.id) ?? [];
  const trigger = {
    cellId: input.agent.currentCellId,
    goalType: input.agent.currentGoal?.type ?? null,
    ...(input.trigger ?? {}),
  } satisfies MemoryRecallTrigger;

  return source
    .map((memory) => ({ ...memory, relevance: relevance(memory, trigger, input.tick) }))
    .filter((memory) => memory.relevance >= 0.32)
    .sort((left, right) => right.relevance - left.relevance || left.id.localeCompare(right.id))
    .slice(0, input.limit ?? MAX_RECALLED_MEMORIES);
}

export function updateEpisodicMemories(input: {
  memories: readonly HumanMemory[];
  agents: readonly HumanAgent[];
  events: readonly HumanCausalEvent[];
  tick: bigint;
}): MemoryUpdateResult {
  const livingAgents = new Map(input.agents.filter((agent) => agent.isAlive).map((agent) => [agent.id, agent]));
  const memoryEvents: HumanMemorySystemEvent[] = [];
  const eventMemoryIds = new Map<string, string[]>();
  const memories = input.memories.map((memory) => {
    const decayed = decayMemory(memory, input.tick);
    const agent = livingAgents.get(memory.agentId);
    const recalled = agent ? recallBySituation(agent, decayed, input.tick) : decayed;

    if (memory.confidence >= FADED_CONFIDENCE_THRESHOLD && recalled.confidence < FADED_CONFIDENCE_THRESHOLD) {
      memoryEvents.push(memoryEvent({ tick: input.tick, agentId: memory.agentId, memory: recalled, kind: "faded" }));
    }

    return recalled;
  });
  const memoryByKey = new Map(memories.map((memory) => [memoryKey(memory.agentId, memory, memory.locationCellId), memory]));

  for (const event of input.events) {
    for (const agentId of event.agentIds) {
      const agent = livingAgents.get(agentId);

      if (!agent) {
        continue;
      }

      const encoding = encodeMemory(agent, event);

      if (!encoding || encoding.importance < MEMORY_SIGNIFICANCE_THRESHOLD) {
        continue;
      }

      const incoming = createMemory(agent, event, encoding);
      const key = memoryKey(agent.id, encoding, event.cellId);
      const existing = memoryByKey.get(key);
      const eventIds = eventMemoryIds.get(event.id) ?? [];

      if (existing) {
        const reinforced = reinforceMemory(existing, incoming, input.tick);
        const index = memories.findIndex((memory) => memory.id === existing.id);

        if (index >= 0) {
          memories[index] = reinforced;
        }

        memoryByKey.set(key, reinforced);
        eventIds.push(reinforced.id);

        if (reinforced.importance >= MAJOR_REINFORCEMENT_THRESHOLD && reinforced.exposureCount > existing.exposureCount) {
          memoryEvents.push(memoryEvent({ tick: input.tick, agentId: agent.id, memory: reinforced, kind: "reinforced" }));
        }
      } else {
        memories.push(incoming);
        memoryByKey.set(key, incoming);
        eventIds.push(incoming.id);

        if (incoming.importance >= MAJOR_MEMORY_THRESHOLD) {
          memoryEvents.push(memoryEvent({ tick: input.tick, agentId: agent.id, memory: incoming, kind: "formed" }));
        }
      }

      eventMemoryIds.set(event.id, unique(eventIds));
    }
  }

  return {
    memories: memories.sort((left, right) =>
      left.agentId.localeCompare(right.agentId) || Number(BigInt(left.createdTick) - BigInt(right.createdTick)) || left.id.localeCompare(right.id)
    ),
    memoryEvents: memoryEvents.sort((left, right) => left.id.localeCompare(right.id)),
    eventMemoryIds,
  };
}

export function createEpisodicMemory(agent: HumanAgent, event: HumanCausalEvent): HumanMemory {
  const encoding = encodeMemory(agent, event) ?? {
    type: "Observation",
    subjectId: `event:${event.type}`,
    source: "direct-experience",
    relatedEntityId: event.cellId,
    relatedHumanId: relatedHumanFor(agent, event),
    tags: ["observation"],
    notes: "A meaningful event was noticed.",
    importance: 0.42,
    confidence: 0.74,
    emotionalWeight: Math.max(agent.emotions.fear, agent.emotions.relief, agent.emotions.attachment),
    valence: valenceForEvent(event),
  };

  return createMemory(agent, event, encoding);
}

export function createMemoriesForEvent(
  agents: readonly HumanAgent[],
  event: HumanCausalEvent,
): HumanMemory[] {
  return agents
    .filter((agent) => event.agentIds.includes(agent.id))
    .flatMap((agent) => {
      const encoding = encodeMemory(agent, event);

      return encoding && encoding.importance >= MEMORY_SIGNIFICANCE_THRESHOLD
        ? [createMemory(agent, event, encoding)]
        : [];
    });
}
