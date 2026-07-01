import type {
  HumanAgent,
  HumanCausalEvent,
  HumanKnowledge,
  HumanKnowledgeHistoryEntry,
  HumanKnowledgeSourceType,
  HumanKnowledgeSystemEvent,
  HumanMemory,
  HumanRelationship,
  HumanTeachingRecord,
} from "./human-types";

export const HUMAN_KNOWLEDGE_SYSTEM_ID = "knowledge";

export type HumanKnowledgeCategoryDefinition = {
  id: string;
  label: string;
  decayResistance: number;
  defaultImportance: number;
  tags: readonly string[];
};

export type KnowledgeUpdateResult = {
  knowledge: HumanKnowledge[];
  knowledgeEvents: HumanKnowledgeSystemEvent[];
};

type KnowledgeEncoding = {
  topic: string;
  category: string;
  sourceType: HumanKnowledgeSourceType;
  sourceHumanId: string | null;
  originatingHumanId: string;
  confidence: number;
  mastery: number;
  reliability: number;
  importance: number;
  tags: string[];
  contradicts?: string[];
  summary: string;
};

const KNOWLEDGE_HISTORY_LIMIT = 18;
const KNOWLEDGE_FORGET_THRESHOLD = 0.18;
const TEACHING_LOCAL_TARGET_LIMIT = 6;

const INITIAL_KNOWLEDGE_CATEGORIES: readonly HumanKnowledgeCategoryDefinition[] = Object.freeze([
  { id: "food", label: "Food", decayResistance: 0.72, defaultImportance: 0.64, tags: ["survival", "resource"] },
  { id: "water", label: "Water", decayResistance: 0.82, defaultImportance: 0.72, tags: ["survival", "resource"] },
  { id: "shelter", label: "Shelter", decayResistance: 0.76, defaultImportance: 0.66, tags: ["survival", "safety"] },
  { id: "fire", label: "Fire", decayResistance: 0.84, defaultImportance: 0.86, tags: ["survival", "danger"] },
  { id: "animals", label: "Animals", decayResistance: 0.7, defaultImportance: 0.62, tags: ["ecology"] },
  { id: "plants", label: "Plants", decayResistance: 0.68, defaultImportance: 0.6, tags: ["ecology"] },
  { id: "terrain", label: "Terrain", decayResistance: 0.66, defaultImportance: 0.54, tags: ["navigation"] },
  { id: "weather", label: "Weather", decayResistance: 0.72, defaultImportance: 0.62, tags: ["environment"] },
  { id: "navigation", label: "Navigation", decayResistance: 0.66, defaultImportance: 0.56, tags: ["spatial"] },
  { id: "construction", label: "Construction", decayResistance: 0.64, defaultImportance: 0.58, tags: ["technical"] },
  { id: "tool-use", label: "Tool Use", decayResistance: 0.64, defaultImportance: 0.6, tags: ["technical"] },
  { id: "social", label: "Social", decayResistance: 0.62, defaultImportance: 0.5, tags: ["relationship"] },
  { id: "danger", label: "Danger", decayResistance: 0.88, defaultImportance: 0.82, tags: ["survival", "risk"] },
  { id: "observation", label: "Observation", decayResistance: 0.58, defaultImportance: 0.46, tags: ["learning"] },
  { id: "discovery", label: "Discovery", decayResistance: 0.58, defaultImportance: 0.52, tags: ["learning"] },
]);

const categoryRegistry = new Map(INITIAL_KNOWLEDGE_CATEGORIES.map((definition) => [definition.id, definition]));

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

function knowledgeTopicKey(topic: string): string {
  return topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function categoryDefinition(category: string): HumanKnowledgeCategoryDefinition {
  return categoryRegistry.get(category) ?? {
    id: category,
    label: category,
    decayResistance: 0.58,
    defaultImportance: 0.5,
    tags: [],
  };
}

export function registerHumanKnowledgeCategory(definition: HumanKnowledgeCategoryDefinition): void {
  categoryRegistry.set(definition.id, {
    ...definition,
    decayResistance: clamp01(definition.decayResistance),
    defaultImportance: clamp01(definition.defaultImportance),
    tags: unique(definition.tags),
  });
}

export function getHumanKnowledgeCategories(): HumanKnowledgeCategoryDefinition[] {
  return [...categoryRegistry.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function knowledgeKey(agentId: string, topic: string): string {
  return `${agentId}|${knowledgeTopicKey(topic)}`;
}

function historyEntry(input: {
  tick: bigint;
  event: HumanKnowledgeHistoryEntry["event"];
  summary: string;
  confidence: number;
  mastery: number;
  sourceHumanId: string | null;
  sourceEventId: string | null;
}): HumanKnowledgeHistoryEntry {
  return {
    tick: input.tick.toString(),
    event: input.event,
    summary: input.summary,
    confidence: clamp01(input.confidence),
    mastery: clamp01(input.mastery),
    sourceHumanId: input.sourceHumanId,
    sourceEventId: input.sourceEventId,
  };
}

function appendHistory(knowledge: HumanKnowledge, entry: HumanKnowledgeHistoryEntry): HumanKnowledgeHistoryEntry[] {
  return [...knowledge.history, entry].slice(-KNOWLEDGE_HISTORY_LIMIT);
}

function knowledgeEvent(input: {
  tick: bigint;
  knowledge: HumanKnowledge;
  kind: HumanKnowledgeSystemEvent["kind"];
  targetHumanId: string | null;
  summary: string;
  sourceEventId: string | null;
}): HumanKnowledgeSystemEvent {
  return {
    id: `${input.knowledge.worldId}:knowledge-event:${input.tick.toString()}:${input.kind.replaceAll(" ", "-")}:${input.knowledge.id}:${input.targetHumanId ?? "none"}:${input.sourceEventId ?? "local"}`,
    worldId: input.knowledge.worldId,
    tick: input.tick.toString(),
    humanId: input.knowledge.agentId,
    targetHumanId: input.targetHumanId,
    knowledgeId: input.knowledge.id,
    topic: input.knowledge.topic,
    category: input.knowledge.category,
    kind: input.kind,
    summary: input.summary,
    confidence: input.knowledge.confidence,
    mastery: input.knowledge.mastery,
    importance: input.knowledge.importance,
    sourceEventId: input.sourceEventId,
  };
}

function createKnowledge(agent: HumanAgent, event: HumanCausalEvent, encoding: KnowledgeEncoding): HumanKnowledge {
  const category = categoryDefinition(encoding.category);
  const topicKey = knowledgeTopicKey(encoding.topic);
  const importance = clamp01((encoding.importance + category.defaultImportance) / 2);

  return {
    id: `${agent.id}:knowledge:${topicKey}`,
    worldId: agent.worldId,
    agentId: agent.id,
    topic: encoding.topic,
    category: encoding.category,
    discoveredTick: event.tick,
    learnedTick: event.tick,
    sourceType: encoding.sourceType,
    sourceHumanId: encoding.sourceHumanId,
    originatingHumanId: encoding.originatingHumanId,
    confidence: clamp01(encoding.confidence),
    mastery: clamp01(encoding.mastery),
    reliability: clamp01(encoding.reliability),
    practiceCount: encoding.sourceType === "personal-discovery" ? 1 : 0,
    teachingCount: 0,
    learnerHumanIds: [],
    lastUsedTick: encoding.sourceType === "personal-discovery" ? event.tick : null,
    lastTaughtTick: null,
    importance,
    isForgotten: false,
    contradicts: unique(encoding.contradicts ?? []),
    tags: unique([...category.tags, ...encoding.tags]),
    history: [historyEntry({
      tick: BigInt(event.tick),
      event: encoding.sourceType === "teaching" ? "learned" : "discovered",
      summary: encoding.summary,
      confidence: encoding.confidence,
      mastery: encoding.mastery,
      sourceHumanId: encoding.sourceHumanId,
      sourceEventId: event.id,
    })],
  };
}

function reinforceKnowledge(existing: HumanKnowledge, event: HumanCausalEvent, encoding: KnowledgeEncoding, tick: bigint): HumanKnowledge {
  const confidenceGain = (1 - existing.confidence) * (0.07 + encoding.confidence * 0.08);
  const masteryGain = (1 - existing.mastery) * (0.025 + encoding.mastery * 0.055);
  const reliabilityGain = (1 - existing.reliability) * (0.035 + encoding.reliability * 0.055);

  return {
    ...existing,
    confidence: clamp01(existing.confidence + confidenceGain),
    mastery: clamp01(existing.mastery + masteryGain),
    reliability: clamp01(existing.reliability + reliabilityGain),
    practiceCount: existing.practiceCount + (encoding.sourceType === "personal-discovery" || encoding.sourceType === "repeated-experience" ? 1 : 0),
    lastUsedTick: tick.toString(),
    importance: clamp01(Math.max(existing.importance, encoding.importance) + 0.015),
    isForgotten: false,
    contradicts: unique([...existing.contradicts, ...(encoding.contradicts ?? [])]),
    tags: unique([...existing.tags, ...encoding.tags]),
    history: appendHistory(existing, historyEntry({
      tick,
      event: encoding.contradicts?.length ? "conflict-shifted" : "reinforced",
      summary: encoding.summary,
      confidence: existing.confidence + confidenceGain,
      mastery: existing.mastery + masteryGain,
      sourceHumanId: encoding.sourceHumanId,
      sourceEventId: event.id,
    })),
  };
}

function encodeKnowledge(agent: HumanAgent, event: HumanCausalEvent): KnowledgeEncoding | null {
  if (!event.agentIds.includes(agent.id)) {
    return null;
  }

  if (event.type === "Human Need Fulfilled" && event.title.includes("Water")) {
    return {
      topic: `Safe drinking water at ${event.cellId}`,
      category: "water",
      sourceType: "personal-discovery",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: 0.78 + agent.emotions.relief * 0.1,
      mastery: 0.22 + agent.confidence * 0.16,
      reliability: 0.74,
      importance: 0.82,
      tags: ["water", "survival", event.cellId],
      summary: "A direct thirst-reducing experience became transferable water knowledge.",
    };
  }

  if (event.type === "Human Need Fulfilled" && event.title.includes("Food")) {
    return {
      topic: `Edible food at ${event.cellId}`,
      category: "food",
      sourceType: "personal-discovery",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: 0.74 + agent.emotions.relief * 0.1,
      mastery: 0.2 + agent.confidence * 0.14,
      reliability: 0.7,
      importance: 0.76,
      tags: ["food", "plants", "survival", event.cellId],
      summary: "A direct hunger-reducing experience became transferable food knowledge.",
    };
  }

  if (event.type === "Human Safety Secured") {
    return {
      topic: `Safer ground at ${event.cellId}`,
      category: "shelter",
      sourceType: "trial-and-error",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: 0.68 + agent.confidence * 0.14,
      mastery: 0.18 + agent.safetyStreak * 0.006,
      reliability: 0.64,
      importance: 0.7,
      tags: ["shelter", "safe", "terrain", event.cellId],
      summary: "A successful safety check became practical shelter knowledge.",
    };
  }

  if (event.type === "Human Safety Check Failed") {
    return {
      topic: `Local danger at ${event.cellId}`,
      category: "danger",
      sourceType: "trial-and-error",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: 0.76 + agent.emotions.fear * 0.12,
      mastery: 0.16,
      reliability: 0.72,
      importance: 0.86,
      tags: ["danger", "survival", event.cellId],
      summary: "A failed safety check became transferable danger knowledge.",
    };
  }

  if (event.type === "Human Movement" || event.type === "Human Migration Started" || event.type === "Human Long-Distance Travel" || event.type === "Human Returned To Remembered Location" || event.type === "Human Dangerous Escape") {
    return {
      topic: `Route to ${event.cellId}`,
      category: "navigation",
      sourceType: "personal-discovery",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: 0.56 + agent.confidence * 0.12,
      mastery: 0.12 + Math.min(0.18, agent.distanceTraveled * 0.006),
      reliability: 0.52,
      importance: event.type === "Human Dangerous Escape" ? 0.68 : 0.52,
      tags: ["navigation", "terrain", "travel", event.cellId],
      summary: "Travel through nearby terrain became route knowledge.",
    };
  }

  if (event.type === "Human Dangerous Movement") {
    return {
      topic: `Dangerous passage at ${event.cellId}`,
      category: "danger",
      sourceType: "personal-discovery",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: 0.72 + agent.emotions.fear * 0.12,
      mastery: 0.14,
      reliability: 0.66,
      importance: 0.8,
      tags: ["danger", "survival", "travel", event.cellId],
      summary: "Difficult movement through danger became practical risk knowledge.",
    };
  }
  if (event.type === "Human Observation") {
    return {
      topic: `Landmarks around ${event.cellId}`,
      category: "observation",
      sourceType: "observation",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: 0.58 + agent.curiosityProfile.environmental * 0.12,
      mastery: 0.12,
      reliability: 0.52,
      importance: 0.48,
      tags: ["observation", "terrain", "navigation", event.cellId],
      summary: "Observation of surroundings became simple spatial knowledge.",
    };
  }

  if (event.type === "Human Exploration") {
    return {
      topic: `Route through ${event.cellId}`,
      category: "navigation",
      sourceType: "personal-discovery",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: 0.56 + agent.confidence * 0.14,
      mastery: 0.14,
      reliability: 0.5,
      importance: 0.52,
      tags: ["navigation", "terrain", "discovery", event.cellId],
      summary: "Exploration became transferable route knowledge.",
    };
  }

  return null;
}

function decayKnowledge(knowledge: HumanKnowledge, tick: bigint): HumanKnowledge {
  if (knowledge.isForgotten) {
    return knowledge;
  }

  const category = categoryDefinition(knowledge.category);
  const lastReinforcedTick = BigInt(knowledge.lastUsedTick ?? knowledge.lastTaughtTick ?? knowledge.learnedTick);
  const elapsed = Number(tick > lastReinforcedTick ? tick - lastReinforcedTick : 0n);
  const survivalProtection = knowledge.tags.includes("survival") || knowledge.tags.includes("danger") ? 0.45 : 0;
  const resistance = clamp01(category.decayResistance + survivalProtection + knowledge.importance * 0.18);
  const decay = Math.min(0.025, (elapsed / 720) * 0.012 * (1 - resistance));
  const nextConfidence = clamp01(knowledge.confidence - decay);
  const nextMastery = clamp01(knowledge.mastery - decay * 0.65);
  const forgotten = nextConfidence < KNOWLEDGE_FORGET_THRESHOLD && knowledge.importance < 0.42;

  return {
    ...knowledge,
    confidence: nextConfidence,
    mastery: nextMastery,
    reliability: clamp01(knowledge.reliability - decay * 0.45),
    isForgotten: forgotten,
    history: forgotten
      ? appendHistory(knowledge, historyEntry({
        tick,
        event: "forgotten",
        summary: "Unused low-confidence knowledge faded below recall threshold.",
        confidence: nextConfidence,
        mastery: nextMastery,
        sourceHumanId: null,
        sourceEventId: null,
      }))
      : knowledge.history,
  };
}

function practiceKnowledge(knowledge: HumanKnowledge, event: HumanCausalEvent, tick: bigint): HumanKnowledge {
  const actionTags = event.type === "Human Need Fulfilled" && event.title.includes("Water")
    ? ["water"]
    : event.type === "Human Need Fulfilled" && event.title.includes("Food")
      ? ["food"]
      : event.type.includes("Safety")
        ? ["shelter", "danger", "safe"]
        : event.type === "Human Observation"
          ? ["observation", "terrain"]
          : event.type === "Human Exploration"
            ? ["navigation", "terrain"]
            : [];

  if (!event.agentIds.includes(knowledge.agentId) || !actionTags.some((tag) => knowledge.tags.includes(tag) || knowledge.category === tag)) {
    return knowledge;
  }

  const confidenceGain = (1 - knowledge.confidence) * 0.035;
  const masteryGain = (1 - knowledge.mastery) * 0.055;

  return {
    ...knowledge,
    confidence: clamp01(knowledge.confidence + confidenceGain),
    mastery: clamp01(knowledge.mastery + masteryGain),
    reliability: clamp01(knowledge.reliability + (1 - knowledge.reliability) * 0.04),
    practiceCount: knowledge.practiceCount + 1,
    lastUsedTick: tick.toString(),
    isForgotten: false,
    history: appendHistory(knowledge, historyEntry({
      tick,
      event: "practiced",
      summary: `Knowledge was strengthened by use during ${event.type}.`,
      confidence: knowledge.confidence + confidenceGain,
      mastery: knowledge.mastery + masteryGain,
      sourceHumanId: null,
      sourceEventId: event.id,
    })),
  };
}

function relationBetween(relationships: readonly HumanRelationship[], teacherId: string, learnerId: string): HumanRelationship | null {
  return relationships.find((relationship) =>
    (relationship.humanId ?? relationship.fromAgentId) === learnerId &&
    (relationship.targetHumanId ?? relationship.toAgentId) === teacherId
  ) ?? null;
}

function teachingScore(input: {
  teacherKnowledge: HumanKnowledge;
  learner: HumanAgent;
  relationship: HumanRelationship | null;
  teaching: HumanTeachingRecord;
}): number {
  const relationship = input.relationship;
  const trust = relationship?.trust ?? 0.35;
  const respect = relationship?.respect ?? 0.18;
  const familiarity = relationship?.familiarity ?? 0.12;
  const fearPenalty = relationship?.fear ?? 0;
  const rivalryPenalty = relationship?.rivalry ?? 0;

  return clamp01(
    trust * 0.24 +
    respect * 0.18 +
    familiarity * 0.12 +
    input.teacherKnowledge.mastery * 0.18 +
    input.teaching.learnerAttention * 0.14 +
    input.teacherKnowledge.importance * 0.12 +
    input.learner.personality.curiosity * 0.08 -
    fearPenalty * 0.16 -
    rivalryPenalty * 0.1,
  );
}

function strongestTeachCandidate(knowledge: readonly HumanKnowledge[], teacherId: string, topicHint: string): HumanKnowledge | null {
  const normalizedHint = topicHint.toLowerCase();

  return knowledge
    .filter((entry) => entry.agentId === teacherId && !entry.isForgotten)
    .filter((entry) => normalizedHint === "nearby water" ? entry.category === "water" || entry.tags.includes("water") : true)
    .sort((left, right) =>
      right.importance - left.importance || right.mastery - left.mastery || right.confidence - left.confidence || left.id.localeCompare(right.id)
    )[0] ?? null;
}

function teachKnowledge(input: {
  currentKnowledge: HumanKnowledge[];
  teaching: HumanTeachingRecord;
  agentsById: ReadonlyMap<string, HumanAgent>;
  relationships: readonly HumanRelationship[];
  tick: bigint;
  events: HumanKnowledgeSystemEvent[];
}): void {
  const teacherKnowledge = strongestTeachCandidate(input.currentKnowledge, input.teaching.teacherAgentId, input.teaching.topic);
  const learner = input.agentsById.get(input.teaching.learnerAgentId);

  if (!teacherKnowledge || !learner) {
    return;
  }

  const learnerRelationship = relationBetween(input.relationships, input.teaching.teacherAgentId, input.teaching.learnerAgentId);
  const score = teachingScore({ teacherKnowledge, learner, relationship: learnerRelationship, teaching: input.teaching });
  const existingLearnerKnowledge = input.currentKnowledge.find((entry) => knowledgeKey(entry.agentId, entry.topic) === knowledgeKey(learner.id, teacherKnowledge.topic));
  const repeatedTeachingBoost = existingLearnerKnowledge ? Math.min(0.12, existingLearnerKnowledge.history.filter((entry) => entry.event === "learned" || entry.event === "reinforced").length * 0.02) : 0;
  const acceptanceScore = clamp01(score + repeatedTeachingBoost + (existingLearnerKnowledge?.confidence ?? 0) * 0.08);

  const teacherIndex = input.currentKnowledge.findIndex((entry) => entry.id === teacherKnowledge.id);
  if (teacherIndex >= 0) {
    const taught = {
      ...teacherKnowledge,
      teachingCount: teacherKnowledge.teachingCount + 1,
      learnerHumanIds: unique([...teacherKnowledge.learnerHumanIds, learner.id]),
      lastTaughtTick: input.tick.toString(),
      mastery: clamp01(teacherKnowledge.mastery + (1 - teacherKnowledge.mastery) * 0.025),
      history: appendHistory(teacherKnowledge, historyEntry({
        tick: input.tick,
        event: "taught",
        summary: `Knowledge was taught to ${learner.id}.`,
        confidence: teacherKnowledge.confidence,
        mastery: teacherKnowledge.mastery,
        sourceHumanId: learner.id,
        sourceEventId: input.teaching.id,
      })),
    };
    input.currentKnowledge[teacherIndex] = taught;
    input.events.push(knowledgeEvent({
      tick: input.tick,
      knowledge: taught,
      kind: taught.teachingCount === 1 ? "first teacher" : "knowledge taught",
      targetHumanId: learner.id,
      summary: `${input.teaching.teacherAgentId} taught ${teacherKnowledge.topic} to ${learner.id}.`,
      sourceEventId: input.teaching.id,
    }));
  }

  if (acceptanceScore < 0.52) {
    return;
  }

  const sourceEvent: HumanCausalEvent = {
    id: input.teaching.id,
    worldId: input.teaching.worldId,
    tick: input.teaching.tick,
    type: "Human Teaching",
    title: "Human Knowledge Teaching",
    summary: `Teaching attempted about ${input.teaching.topic}.`,
    agentIds: [input.teaching.teacherAgentId, learner.id],
    cellId: learner.currentCellId,
    causes: { successScore: input.teaching.successScore, acceptanceScore },
    effects: { topic: teacherKnowledge.topic },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: true,
  };
  const encoding: KnowledgeEncoding = {
    topic: teacherKnowledge.topic,
    category: teacherKnowledge.category,
    sourceType: learnerRelationship?.kinship !== "none" ? "inherited-family-teaching" : "teaching",
    sourceHumanId: input.teaching.teacherAgentId,
    originatingHumanId: teacherKnowledge.originatingHumanId,
    confidence: clamp01(teacherKnowledge.confidence * 0.62 + acceptanceScore * 0.28),
    mastery: clamp01(teacherKnowledge.mastery * 0.28 + acceptanceScore * 0.12),
    reliability: teacherKnowledge.reliability,
    importance: teacherKnowledge.importance,
    tags: teacherKnowledge.tags,
    contradicts: teacherKnowledge.contradicts,
    summary: `Knowledge was accepted through teaching from ${input.teaching.teacherAgentId}.`,
  };

  if (existingLearnerKnowledge) {
    const reinforced = reinforceKnowledge(existingLearnerKnowledge, sourceEvent, encoding, input.tick);
    const index = input.currentKnowledge.findIndex((entry) => entry.id === existingLearnerKnowledge.id);
    if (index >= 0) {
      input.currentKnowledge[index] = reinforced;
    }
  } else {
    const learned = createKnowledge(learner, sourceEvent, encoding);
    input.currentKnowledge.push(learned);
    input.events.push(knowledgeEvent({
      tick: input.tick,
      knowledge: learned,
      kind: "first student",
      targetHumanId: input.teaching.teacherAgentId,
      summary: `${learner.id} learned ${teacherKnowledge.topic} from ${input.teaching.teacherAgentId}.`,
      sourceEventId: input.teaching.id,
    }));
  }
}

function knowledgeFromMemory(memory: HumanMemory, agent: HumanAgent): KnowledgeEncoding | null {
  if (memory.confidence < 0.74 || memory.exposureCount < 3 || memory.recallCount < 3) {
    return null;
  }

  if (memory.tags.includes("water")) {
    return {
      topic: `Safe drinking water at ${memory.locationCellId}`,
      category: "water",
      sourceType: "repeated-experience",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: memory.confidence,
      mastery: clamp01(0.2 + memory.exposureCount * 0.025),
      reliability: clamp01(0.62 + memory.recallCount * 0.025),
      importance: memory.importance,
      tags: ["water", "survival", memory.locationCellId],
      summary: "Repeated water memories became transferable knowledge.",
    };
  }

  if (memory.tags.includes("food")) {
    return {
      topic: `Edible food at ${memory.locationCellId}`,
      category: "food",
      sourceType: "repeated-experience",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: memory.confidence,
      mastery: clamp01(0.18 + memory.exposureCount * 0.024),
      reliability: clamp01(0.58 + memory.recallCount * 0.024),
      importance: memory.importance,
      tags: ["food", "plants", "survival", memory.locationCellId],
      summary: "Repeated food memories became transferable knowledge.",
    };
  }

  if (memory.tags.includes("danger")) {
    return {
      topic: `Local danger at ${memory.locationCellId}`,
      category: "danger",
      sourceType: "repeated-experience",
      sourceHumanId: null,
      originatingHumanId: agent.id,
      confidence: memory.confidence,
      mastery: clamp01(0.16 + memory.exposureCount * 0.02),
      reliability: clamp01(0.66 + memory.recallCount * 0.02),
      importance: memory.importance,
      tags: ["danger", "survival", memory.locationCellId],
      summary: "Repeated danger memories became transferable knowledge.",
    };
  }

  return null;
}

export function updateKnowledgeEngine(input: {
  knowledge: readonly HumanKnowledge[];
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  memories: readonly HumanMemory[];
  events: readonly HumanCausalEvent[];
  teachingAttempts: readonly HumanTeachingRecord[];
  tick: bigint;
}): KnowledgeUpdateResult {
  const agentsById = new Map(input.agents.filter((agent) => agent.isAlive).map((agent) => [agent.id, agent]));
  const knowledgeEvents: HumanKnowledgeSystemEvent[] = [];
  const knowledge = input.knowledge.map((entry) => decayKnowledge(entry, input.tick));
  const byKey = new Map(knowledge.map((entry) => [knowledgeKey(entry.agentId, entry.topic), entry]));

  for (const entry of knowledge) {
    if (input.knowledge.find((previous) => previous.id === entry.id)?.isForgotten === false && entry.isForgotten) {
      knowledgeEvents.push(knowledgeEvent({ tick: input.tick, knowledge: entry, kind: "knowledge forgotten", targetHumanId: null, summary: `${entry.topic} faded below usable confidence.`, sourceEventId: null }));
    }
  }

  for (const event of input.events) {
    for (const agentId of event.agentIds) {
      const agent = agentsById.get(agentId);

      if (!agent) {
        continue;
      }

      const encoding = encodeKnowledge(agent, event);

      if (!encoding || encoding.importance < 0.42) {
        continue;
      }

      const key = knowledgeKey(agent.id, encoding.topic);
      const existing = byKey.get(key);

      if (existing) {
        const reinforced = reinforceKnowledge(existing, event, encoding, input.tick);
        const index = knowledge.findIndex((entry) => entry.id === existing.id);

        if (index >= 0) {
          knowledge[index] = reinforced;
          byKey.set(key, reinforced);
        }
      } else {
        const discovered = createKnowledge(agent, event, encoding);
        knowledge.push(discovered);
        byKey.set(key, discovered);
        knowledgeEvents.push(knowledgeEvent({
          tick: input.tick,
          knowledge: discovered,
          kind: discovered.importance >= 0.86 ? "major invention" : "new discovery",
          targetHumanId: null,
          summary: `${agent.id} discovered ${discovered.topic}.`,
          sourceEventId: event.id,
        }));
      }
    }
  }

  for (const memory of input.memories) {
    const agent = agentsById.get(memory.agentId);
    const encoding = agent ? knowledgeFromMemory(memory, agent) : null;

    if (!agent || !encoding) {
      continue;
    }

    const key = knowledgeKey(agent.id, encoding.topic);
    if (byKey.has(key)) {
      continue;
    }

    const sourceEvent: HumanCausalEvent = {
      id: `${memory.id}:knowledge-from-memory`,
      worldId: memory.worldId,
      tick: input.tick.toString(),
      type: "Human Memory Became Knowledge",
      title: "Memory Became Knowledge",
      summary: encoding.summary,
      agentIds: [agent.id],
      cellId: memory.locationCellId,
      causes: { memoryId: memory.id, recallCount: memory.recallCount, exposureCount: memory.exposureCount },
      effects: { topic: encoding.topic },
      memoryIds: [memory.id],
      chroniclerVisible: true,
      agentVisible: true,
    };
    const learned = createKnowledge(agent, sourceEvent, encoding);
    knowledge.push(learned);
    byKey.set(key, learned);
    knowledgeEvents.push(knowledgeEvent({
      tick: input.tick,
      knowledge: learned,
      kind: "knowledge learned",
      targetHumanId: null,
      summary: `${agent.id} transformed repeated memory into knowledge: ${learned.topic}.`,
      sourceEventId: memory.id,
    }));
  }

  for (const event of input.events) {
    for (const entry of [...knowledge]) {
      const index = knowledge.findIndex((candidate) => candidate.id === entry.id);
      if (index >= 0) {
        knowledge[index] = practiceKnowledge(knowledge[index], event, input.tick);
      }
    }
  }

  for (const teaching of input.teachingAttempts.slice(-TEACHING_LOCAL_TARGET_LIMIT)) {
    teachKnowledge({ currentKnowledge: knowledge, teaching, agentsById, relationships: input.relationships, tick: input.tick, events: knowledgeEvents });
  }

  const spreadMilestones = knowledge
    .filter((entry) => entry.learnerHumanIds.length > 0 && entry.learnerHumanIds.length % 5 === 0 && entry.lastTaughtTick === input.tick.toString())
    .map((entry) => knowledgeEvent({
      tick: input.tick,
      knowledge: entry,
      kind: "knowledge spread milestone",
      targetHumanId: null,
      summary: `${entry.topic} reached ${entry.learnerHumanIds.length} learners from one origin line.`,
      sourceEventId: null,
    }));

  return {
    knowledge: knowledge.sort((left, right) =>
      left.agentId.localeCompare(right.agentId) || left.topic.localeCompare(right.topic) || left.id.localeCompare(right.id)
    ),
    knowledgeEvents: [...knowledgeEvents, ...spreadMilestones].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function strongestKnowledgeByTag(knowledge: readonly HumanKnowledge[], agentId: string, tag: string): HumanKnowledge | null {
  return knowledge
    .filter((entry) => entry.agentId === agentId && !entry.isForgotten && (entry.tags.includes(tag) || entry.category === tag))
    .sort((left, right) =>
      right.confidence * right.mastery - left.confidence * left.mastery || right.importance - left.importance || left.id.localeCompare(right.id)
    )[0] ?? null;
}