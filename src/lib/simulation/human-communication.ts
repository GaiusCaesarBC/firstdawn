import { createDeterministicRandom } from "./random";
import type {
  HumanAgent,
  HumanCommunicationReception,
  HumanCommunicationRecord,
  HumanCommunicationSystemEvent,
  HumanGoal,
  HumanGoalHistoryEntry,
  HumanGoalReason,
  HumanGoalType,
  HumanRelationship,
  HumanRelationshipHistoryEntry,
  HumanTeachingRecord,
} from "./human-types";

export const HUMAN_COMMUNICATION_SYSTEM_ID = "communication";

export type HumanCommunicationTypeDefinition = {
  id: string;
  label: string;
  defaultUrgency: number;
  defaultClarity: number;
  defaultConfidence: number;
  defaultEmotionalWeight: number;
  defaultTags: readonly string[];
};

export type HumanCommunicationMethodDefinition = {
  id: string;
  label: string;
  clarityModifier: number;
  distanceFalloff: number;
  defaultTags: readonly string[];
};

export type HumanCommunicationTargetMode =
  | "one-citizen"
  | "nearby-group"
  | "family"
  | "trusted-individuals"
  | "settlement";

export type CreateHumanCommunicationInput = {
  worldId: string;
  seed: string;
  tick: bigint;
  sender: HumanAgent;
  receivers: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  type: string;
  topic: string;
  communicationMethod: string;
  targetMode?: HumanCommunicationTargetMode;
  urgency?: number;
  clarity?: number;
  confidence?: number;
  emotionalWeight?: number;
  tags?: readonly string[];
};

export type CommunicationUpdateResult = {
  agents: HumanAgent[];
  relationships: HumanRelationship[];
  communications: HumanCommunicationRecord[];
  teachingAttempts: HumanTeachingRecord[];
  communicationEvents: HumanCommunicationSystemEvent[];
};

const RELATIONSHIP_HISTORY_LIMIT = 16;
const GOAL_HISTORY_LIMIT = 24;

const INITIAL_COMMUNICATION_TYPES: readonly HumanCommunicationTypeDefinition[] = Object.freeze([
  { id: "Warning", label: "Warning", defaultUrgency: 0.86, defaultClarity: 0.62, defaultConfidence: 0.78, defaultEmotionalWeight: 0.82, defaultTags: ["danger", "warning"] },
  { id: "Teaching", label: "Teaching", defaultUrgency: 0.34, defaultClarity: 0.66, defaultConfidence: 0.7, defaultEmotionalWeight: 0.42, defaultTags: ["teaching", "knowledge"] },
  { id: "Request", label: "Request", defaultUrgency: 0.5, defaultClarity: 0.58, defaultConfidence: 0.62, defaultEmotionalWeight: 0.48, defaultTags: ["request"] },
  { id: "Help", label: "Help", defaultUrgency: 0.84, defaultClarity: 0.56, defaultConfidence: 0.68, defaultEmotionalWeight: 0.86, defaultTags: ["help", "distress"] },
  { id: "Greeting", label: "Greeting", defaultUrgency: 0.18, defaultClarity: 0.72, defaultConfidence: 0.72, defaultEmotionalWeight: 0.3, defaultTags: ["social", "greeting"] },
  { id: "Observation", label: "Observation", defaultUrgency: 0.32, defaultClarity: 0.58, defaultConfidence: 0.58, defaultEmotionalWeight: 0.36, defaultTags: ["observation"] },
  { id: "Discovery", label: "Discovery", defaultUrgency: 0.48, defaultClarity: 0.56, defaultConfidence: 0.62, defaultEmotionalWeight: 0.52, defaultTags: ["discovery"] },
  { id: "Emotion", label: "Emotion", defaultUrgency: 0.44, defaultClarity: 0.5, defaultConfidence: 0.58, defaultEmotionalWeight: 0.7, defaultTags: ["emotion"] },
  { id: "Danger", label: "Danger", defaultUrgency: 0.92, defaultClarity: 0.58, defaultConfidence: 0.76, defaultEmotionalWeight: 0.9, defaultTags: ["danger", "warning"] },
  { id: "Food Found", label: "Food Found", defaultUrgency: 0.58, defaultClarity: 0.64, defaultConfidence: 0.7, defaultEmotionalWeight: 0.54, defaultTags: ["food", "resource"] },
  { id: "Water Found", label: "Water Found", defaultUrgency: 0.66, defaultClarity: 0.66, defaultConfidence: 0.72, defaultEmotionalWeight: 0.6, defaultTags: ["water", "resource"] },
  { id: "Follow Me", label: "Follow Me", defaultUrgency: 0.56, defaultClarity: 0.6, defaultConfidence: 0.66, defaultEmotionalWeight: 0.46, defaultTags: ["movement", "coordination"] },
  { id: "Stay Away", label: "Stay Away", defaultUrgency: 0.78, defaultClarity: 0.58, defaultConfidence: 0.68, defaultEmotionalWeight: 0.72, defaultTags: ["danger", "boundary"] },
  { id: "Comfort", label: "Comfort", defaultUrgency: 0.3, defaultClarity: 0.54, defaultConfidence: 0.66, defaultEmotionalWeight: 0.62, defaultTags: ["comfort", "social"] },
  { id: "Celebration", label: "Celebration", defaultUrgency: 0.24, defaultClarity: 0.62, defaultConfidence: 0.7, defaultEmotionalWeight: 0.72, defaultTags: ["celebration", "social"] },
  { id: "Mourning", label: "Mourning", defaultUrgency: 0.38, defaultClarity: 0.52, defaultConfidence: 0.66, defaultEmotionalWeight: 0.86, defaultTags: ["mourning", "grief", "social"] },
]);

const INITIAL_COMMUNICATION_METHODS: readonly HumanCommunicationMethodDefinition[] = Object.freeze([
  { id: "Visual", label: "Visual", clarityModifier: 0.04, distanceFalloff: 0.24, defaultTags: ["visual"] },
  { id: "Gesture", label: "Gesture", clarityModifier: 0.02, distanceFalloff: 0.18, defaultTags: ["gesture"] },
  { id: "Facial Expression", label: "Facial Expression", clarityModifier: -0.02, distanceFalloff: 0.3, defaultTags: ["face"] },
  { id: "Body Language", label: "Body Language", clarityModifier: -0.01, distanceFalloff: 0.22, defaultTags: ["body-language"] },
  { id: "Pointing", label: "Pointing", clarityModifier: 0.08, distanceFalloff: 0.16, defaultTags: ["pointing"] },
  { id: "Vocal Sound", label: "Vocal Sound", clarityModifier: 0.02, distanceFalloff: 0.12, defaultTags: ["vocal"] },
  { id: "Call", label: "Call", clarityModifier: 0.04, distanceFalloff: 0.08, defaultTags: ["call"] },
  { id: "Cry", label: "Cry", clarityModifier: -0.04, distanceFalloff: 0.1, defaultTags: ["cry", "emotion"] },
]);

const typeRegistry = new Map(INITIAL_COMMUNICATION_TYPES.map((definition) => [definition.id, definition]));
const methodRegistry = new Map(INITIAL_COMMUNICATION_METHODS.map((definition) => [definition.id, definition]));

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

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function communicationType(type: string): HumanCommunicationTypeDefinition {
  return typeRegistry.get(type) ?? {
    id: type,
    label: type,
    defaultUrgency: 0.42,
    defaultClarity: 0.54,
    defaultConfidence: 0.58,
    defaultEmotionalWeight: 0.44,
    defaultTags: [],
  };
}

function communicationMethod(method: string): HumanCommunicationMethodDefinition {
  return methodRegistry.get(method) ?? {
    id: method,
    label: method,
    clarityModifier: 0,
    distanceFalloff: 0.2,
    defaultTags: [],
  };
}

export function registerHumanCommunicationType(definition: HumanCommunicationTypeDefinition): void {
  typeRegistry.set(definition.id, {
    ...definition,
    defaultUrgency: clamp01(definition.defaultUrgency),
    defaultClarity: clamp01(definition.defaultClarity),
    defaultConfidence: clamp01(definition.defaultConfidence),
    defaultEmotionalWeight: clamp01(definition.defaultEmotionalWeight),
    defaultTags: unique(definition.defaultTags),
  });
}

export function getHumanCommunicationTypes(): HumanCommunicationTypeDefinition[] {
  return [...typeRegistry.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function registerHumanCommunicationMethod(definition: HumanCommunicationMethodDefinition): void {
  methodRegistry.set(definition.id, {
    ...definition,
    clarityModifier: round(definition.clarityModifier),
    distanceFalloff: clamp01(definition.distanceFalloff),
    defaultTags: unique(definition.defaultTags),
  });
}

export function getHumanCommunicationMethods(): HumanCommunicationMethodDefinition[] {
  return [...methodRegistry.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function relationshipFrom(
  relationships: readonly HumanRelationship[],
  humanId: string,
  targetHumanId: string,
): HumanRelationship | null {
  return relationships.find((relationship) =>
    (relationship.humanId ?? relationship.fromAgentId) === humanId &&
    (relationship.targetHumanId ?? relationship.toAgentId) === targetHumanId
  ) ?? null;
}

function sameCellDistance(sender: HumanAgent, receiver: HumanAgent, method: HumanCommunicationMethodDefinition): number {
  return sender.currentCellId === receiver.currentCellId ? 1 : clamp01(0.46 - method.distanceFalloff);
}

function attentionScore(receiver: HumanAgent, type: string): number {
  const goalFocusPenalty = receiver.currentGoal?.type === "Escape" ? 0.18 : receiver.currentGoal?.type === "Seek Safety" ? 0.12 : 0;
  const dangerAlertBoost = type === "Warning" || type === "Danger" || type === "Stay Away" ? receiver.emotions.fear * 0.12 : 0;

  return clamp01(
    0.48 +
    receiver.personality.curiosity * 0.14 +
    receiver.personality.sociability * 0.1 +
    receiver.emotions.curiosity * 0.08 +
    dangerAlertBoost -
    receiver.needs.fatigue * 0.18 -
    receiver.emotions.distress * 0.08 -
    goalFocusPenalty,
  );
}

function stressPenalty(receiver: HumanAgent): number {
  return clamp01(
    Math.max(receiver.emotions.fear, receiver.emotions.distress, receiver.needs.safety) * 0.42 +
    receiver.needs.thirst * 0.08 +
    receiver.needs.hunger * 0.06,
  );
}

function goalAlignment(receiver: HumanAgent, type: string): number {
  const goalType = receiver.currentGoal?.type;

  if (!goalType) {
    return 0.42;
  }

  if ((type === "Warning" || type === "Danger" || type === "Stay Away") && (goalType === "Seek Safety" || goalType === "Escape")) {
    return 0.86;
  }

  if (type === "Food Found" && goalType === "Find Food") {
    return 0.82;
  }

  if (type === "Water Found" && goalType === "Find Water") {
    return 0.82;
  }

  if (type === "Teaching" && (goalType === "Learn" || goalType === "Observe")) {
    return 0.78;
  }

  if (type === "Follow Me" && (goalType === "Follow" || goalType === "Stay Near Family")) {
    return 0.76;
  }

  return 0.38;
}

function scoreReception(input: {
  seed: string;
  tick: bigint;
  communicationId: string;
  sender: HumanAgent;
  receiver: HumanAgent;
  relationship: HumanRelationship | null;
  type: string;
  clarity: number;
  confidence: number;
  urgency: number;
  emotionalWeight: number;
  method: HumanCommunicationMethodDefinition;
}): HumanCommunicationReception {
  const distanceScore = sameCellDistance(input.sender, input.receiver, input.method);
  const trust = input.relationship?.trust ?? 0.34;
  const familiarity = input.relationship?.familiarity ?? 0.12;
  const fearPenalty = input.relationship?.fear ?? 0;
  const rivalryPenalty = input.relationship?.rivalry ?? 0;
  const attention = attentionScore(input.receiver, input.type);
  const stress = stressPenalty(input.receiver);
  const alignment = goalAlignment(input.receiver, input.type);
  const random = createDeterministicRandom({
    worldSeed: input.seed,
    tick: input.tick,
    systemName: `communication:${input.communicationId}:${input.receiver.id}`,
  });
  const deterministicJitter = random.float(-0.018, 0.018);
  const clarity = clamp01(input.clarity + input.method.clarityModifier);
  const understandingScore = clamp01(
    clarity * 0.28 +
    input.confidence * 0.14 +
    attention * 0.18 +
    distanceScore * 0.14 +
    trust * 0.1 +
    familiarity * 0.08 +
    input.urgency * 0.04 -
    stress * 0.08 +
    deterministicJitter,
  );
  const acceptanceScore = clamp01(
    understandingScore * 0.34 +
    trust * 0.26 +
    input.confidence * 0.16 +
    alignment * 0.12 +
    input.emotionalWeight * 0.06 -
    fearPenalty * 0.12 -
    rivalryPenalty * 0.08,
  );
  const ignored = understandingScore < 0.24;
  const misunderstood = !ignored && understandingScore < 0.42;
  const understood = !ignored && !misunderstood;
  const accepted = understood && acceptanceScore >= 0.52;
  const storedForLater = understood && !accepted && acceptanceScore >= 0.44 && input.confidence >= 0.68;
  const rejected = understood && !accepted && !storedForLater;
  const outcome = accepted
    ? "accepted"
    : ignored
      ? "ignored"
      : misunderstood
        ? "misunderstood"
        : storedForLater
          ? "stored-for-later"
          : "rejected";

  return {
    receiverHumanId: input.receiver.id,
    understood,
    accepted,
    misunderstood,
    ignored,
    rejected,
    storedForLater,
    understandingScore,
    acceptanceScore,
    relationshipTrust: trust,
    distanceScore,
    attentionScore: attention,
    stressPenalty: stress,
    goalAlignment: alignment,
    outcome,
  };
}

function intentForType(type: string): HumanCommunicationRecord["intent"] {
  if (type === "Warning" || type === "Danger" || type === "Stay Away") {
    return "warn";
  }

  if (type === "Teaching") {
    return "teach";
  }

  if (type === "Help") {
    return "requestHelp";
  }

  if (type === "Comfort") {
    return "offerHelp";
  }

  return "greet";
}

function toneFor(type: string, urgency: number, emotionalWeight: number): HumanCommunicationRecord["emotionalTone"] {
  if (type === "Help" || emotionalWeight >= 0.78) {
    return "distressed";
  }

  if (urgency >= 0.68) {
    return "urgent";
  }

  if (type === "Greeting" || type === "Comfort" || type === "Celebration") {
    return "warm";
  }

  return "calm";
}

function meaningFor(type: string, topic: string): string {
  switch (type) {
    case "Warning":
    case "Danger":
      return `Danger near ${topic}.`;
    case "Food Found":
      return `Food found near ${topic}.`;
    case "Water Found":
      return `Water found near ${topic}.`;
    case "Follow Me":
      return `Follow toward ${topic}.`;
    case "Stay Away":
      return `Stay away from ${topic}.`;
    case "Teaching":
      return `Demonstrating ${topic}.`;
    case "Help":
      return `Help needed with ${topic}.`;
    case "Comfort":
      return `You are not alone with ${topic}.`;
    default:
      return topic;
  }
}

export function createHumanCommunication(input: CreateHumanCommunicationInput): HumanCommunicationRecord {
  const typeDefinition = communicationType(input.type);
  const methodDefinition = communicationMethod(input.communicationMethod);
  const urgency = clamp01(input.urgency ?? typeDefinition.defaultUrgency);
  const clarity = clamp01(input.clarity ?? typeDefinition.defaultClarity);
  const confidence = clamp01(input.confidence ?? typeDefinition.defaultConfidence);
  const emotionalWeight = clamp01(input.emotionalWeight ?? typeDefinition.defaultEmotionalWeight);
  const receiverHumanIds = input.receivers.map((receiver) => receiver.id).sort();
  const id = [
    input.worldId,
    "communication",
    input.tick.toString(),
    slug(input.type),
    input.sender.id,
    receiverHumanIds.join("-") || "none",
    slug(input.topic),
  ].join(":");
  const receptions = input.receivers
    .map((receiver) => scoreReception({
      seed: input.seed,
      tick: input.tick,
      communicationId: id,
      sender: input.sender,
      receiver,
      relationship: relationshipFrom(input.relationships, receiver.id, input.sender.id),
      type: input.type,
      clarity,
      confidence,
      urgency,
      emotionalWeight,
      method: methodDefinition,
    }))
    .sort((left, right) => left.receiverHumanId.localeCompare(right.receiverHumanId));
  const accepted = receptions.some((reception) => reception.accepted);
  const understood = receptions.some((reception) => reception.understood);
  const averageUnderstanding = receptions.length === 0
    ? 0
    : round(receptions.reduce((sum, reception) => sum + reception.understandingScore, 0) / receptions.length);

  return {
    id,
    worldId: input.worldId,
    tick: input.tick.toString(),
    senderHumanId: input.sender.id,
    receiverHumanIds,
    type: input.type,
    topic: input.topic,
    createdTick: input.tick.toString(),
    locationCellId: input.sender.currentCellId,
    urgency,
    clarity,
    confidence,
    emotionalWeight,
    communicationMethod: input.communicationMethod,
    understood,
    accepted,
    tags: unique([...typeDefinition.defaultTags, ...methodDefinition.defaultTags, ...(input.tags ?? []), input.targetMode ?? "one-citizen"]),
    history: receptions.map((reception) => ({
      tick: input.tick.toString(),
      event: reception.outcome,
      summary: `${input.type} was ${reception.outcome} by ${reception.receiverHumanId}.`,
      receiverHumanId: reception.receiverHumanId,
      understandingScore: reception.understandingScore,
      acceptanceScore: reception.acceptanceScore,
    })),
    receptions,
    speakerAgentId: input.sender.id,
    listenerAgentIds: receiverHumanIds,
    cellId: input.sender.currentCellId,
    intent: intentForType(input.type),
    utteranceMeaning: meaningFor(input.type, input.topic),
    emotionalTone: toneFor(input.type, urgency, emotionalWeight),
    understandingScore: averageUnderstanding,
  };
}

function relationshipKey(humanId: string, targetHumanId: string): string {
  return `${humanId}|${targetHumanId}`;
}

function relationshipStatus(relationship: HumanRelationship): HumanRelationship["status"] {
  if (relationship.kinship !== "none") {
    return relationship.kinship === "partner" ? "Mate" : "Family";
  }

  if (relationship.fear >= 0.72) {
    return "Threat";
  }

  if (relationship.rivalry >= 0.58 && relationship.affection < 0.56) {
    return "Rival";
  }

  if (relationship.respect >= 0.7 && relationship.trust >= 0.55) {
    return "Mentor";
  }

  if (relationship.dependency >= 0.7) {
    return "Dependent";
  }

  if (relationship.trust >= 0.65 && relationship.affection >= 0.62 && relationship.fear < 0.45) {
    return "Friend";
  }

  if (relationship.familiarity >= 0.28) {
    return "Familiar";
  }

  return "Unknown";
}

function relationshipWithCommunication(
  relationship: HumanRelationship,
  communication: HumanCommunicationRecord,
  reception: HumanCommunicationReception,
  humanId: string,
): HumanRelationship {
  const positive = reception.accepted;
  const rejected = reception.rejected || reception.ignored;
  const warningPenalty = (communication.type === "Warning" || communication.type === "Danger") && rejected ? 0.018 : 0;
  const teachingRespect = communication.type === "Teaching" && positive ? 0.035 : 0;
  const comfortAffection = communication.type === "Comfort" && positive ? 0.038 : 0;
  const helpTrust = communication.type === "Help" && positive ? 0.028 : 0;
  const deltas: HumanRelationshipHistoryEntry["deltas"] = {
    familiarity: positive ? 0.035 : reception.misunderstood ? 0.012 : 0.006,
    trust: positive ? 0.026 + helpTrust : rejected ? -0.022 - warningPenalty : 0.004,
    affection: positive ? 0.016 + comfortAffection : rejected ? -0.008 : 0,
    respect: teachingRespect,
    fear: communication.tags.includes("danger") ? 0.012 : -0.006,
    rivalry: rejected ? 0.01 : -0.002,
    socialMemoryScore: positive ? 0.035 : 0.012,
  };
  const history = [
    ...relationship.history,
    {
      tick: communication.tick,
      event: `communication ${reception.outcome}`,
      summary: `${communication.type} communication was ${reception.outcome}.`,
      deltas,
      sourceEventId: communication.id,
    },
  ].slice(-RELATIONSHIP_HISTORY_LIMIT);
  const next = {
    ...relationship,
    familiarity: clamp01(relationship.familiarity + (deltas.familiarity ?? 0)),
    trust: clamp01(relationship.trust + (deltas.trust ?? 0)),
    affection: clamp01(relationship.affection + (deltas.affection ?? 0)),
    respect: clamp01(relationship.respect + (deltas.respect ?? 0)),
    fear: clamp01(relationship.fear + (deltas.fear ?? 0)),
    rivalry: clamp01(relationship.rivalry + (deltas.rivalry ?? 0)),
    resentment: clamp01(relationship.resentment + (rejected ? 0.01 : -0.002)),
    socialMemoryScore: clamp01(relationship.socialMemoryScore + (deltas.socialMemoryScore ?? 0)),
    companionship: clamp01(relationship.companionship + (positive ? 0.018 : -0.004)),
    tags: unique([...relationship.tags, "communication", slug(communication.type)]),
    history,
    lastInteractionTick: communication.tick,
  } satisfies HumanRelationship;

  return {
    ...next,
    humanId,
    fromAgentId: humanId,
    status: relationshipStatus(next),
  };
}

function goalForCommunication(agent: HumanAgent, communication: HumanCommunicationRecord): HumanGoal | null {
  let type: HumanGoalType | null = null;
  let reason: HumanGoalReason = "Low Pressure";
  let priority = 0;

  if (communication.type === "Warning" || communication.type === "Danger" || communication.type === "Stay Away") {
    type = "Seek Safety";
    reason = "Danger Nearby";
    priority = 2.6 + communication.urgency * 0.8 + communication.emotionalWeight * 0.4;
  } else if (communication.type === "Help") {
    type = "Help Other";
    reason = "Asked For Help";
    priority = 1.4 + communication.urgency;
  } else if (communication.type === "Follow Me") {
    type = "Follow";
    reason = "Asked To Follow";
    priority = 1.1 + communication.confidence;
  } else if (communication.type === "Teaching") {
    type = "Learn";
    reason = "Asked To Learn";
    priority = 0.95 + communication.confidence;
  } else if (communication.type === "Food Found") {
    type = "Find Food";
    reason = "Hungry";
    priority = 1.1 + communication.confidence;
  } else if (communication.type === "Water Found") {
    type = "Find Water";
    reason = "Thirst";
    priority = 1.2 + communication.confidence;
  }

  if (!type) {
    return null;
  }

  return {
    id: `${agent.id}:communication-goal:${communication.tick}:${slug(type)}:${slug(communication.topic)}`,
    type,
    priority: round(priority),
    createdTick: communication.tick,
    targetId: communication.senderHumanId,
    targetCellId: communication.locationCellId,
    progress: 0,
    confidence: clamp01(communication.confidence),
    reason,
    status: "Active",
  };
}

function appendGoalHistory(history: readonly HumanGoalHistoryEntry[], entry: HumanGoalHistoryEntry): HumanGoalHistoryEntry[] {
  return [...history, entry].slice(-GOAL_HISTORY_LIMIT);
}

function agentWithCommunicationInfluence(agent: HumanAgent, communication: HumanCommunicationRecord): HumanAgent {
  const nextGoal = goalForCommunication(agent, communication);
  const previousGoal = agent.currentGoal;
  let goalHistory = [...agent.goalHistory];

  if (nextGoal && (!previousGoal || nextGoal.priority > previousGoal.priority + 0.08)) {
    if (previousGoal) {
      goalHistory = appendGoalHistory(goalHistory, {
        goal: { ...previousGoal, status: "Interrupted" },
        tick: communication.tick,
        event: "Interrupted",
        reason: nextGoal.reason,
        previousGoalId: previousGoal.id,
      });
    }

    goalHistory = appendGoalHistory(goalHistory, {
      goal: nextGoal,
      tick: communication.tick,
      event: "Started",
      reason: nextGoal.reason,
      previousGoalId: previousGoal?.id ?? null,
    });
  }

  const danger = communication.type === "Warning" || communication.type === "Danger" || communication.type === "Stay Away";
  const help = communication.type === "Help";
  const comfort = communication.type === "Comfort";
  const food = communication.type === "Food Found";
  const water = communication.type === "Water Found";

  return {
    ...agent,
    currentGoal: nextGoal && (!previousGoal || nextGoal.priority > previousGoal.priority + 0.08) ? nextGoal : agent.currentGoal,
    goalHistory,
    needs: {
      ...agent.needs,
      safety: danger ? clamp01(agent.needs.safety + 0.18 + communication.urgency * 0.16) : agent.needs.safety,
      social: comfort ? clamp01(agent.needs.social - 0.12) : agent.needs.social,
    },
    emotions: {
      ...agent.emotions,
      fear: danger ? clamp01(agent.emotions.fear + 0.18 + communication.emotionalWeight * 0.16) : agent.emotions.fear,
      distress: help ? clamp01(agent.emotions.distress + 0.08) : comfort ? clamp01(agent.emotions.distress - 0.1) : agent.emotions.distress,
      trust: communication.accepted ? clamp01(agent.emotions.trust + 0.018) : agent.emotions.trust,
      attachment: comfort ? clamp01(agent.emotions.attachment + 0.034) : agent.emotions.attachment,
      relief: comfort ? clamp01(agent.emotions.relief + 0.08) : agent.emotions.relief,
    },
    beliefs: {
      ...agent.beliefs,
      ...(danger ? {
        [`communication:danger:${communication.locationCellId}`]: {
          claim: `Danger was communicated near ${communication.locationCellId}.`,
          confidence: communication.confidence,
          valence: 0.12,
          lastUpdatedTick: communication.tick,
        },
      } : {}),
      ...(food ? {
        "nearby:food": {
          claim: `Food may be found near ${communication.topic}.`,
          confidence: clamp01(Math.max(agent.beliefs["nearby:food"]?.confidence ?? 0, communication.confidence)),
          valence: 0.72,
          lastUpdatedTick: communication.tick,
        },
      } : {}),
      ...(water ? {
        "nearby:water": {
          claim: `Water may be found near ${communication.topic}.`,
          confidence: clamp01(Math.max(agent.beliefs["nearby:water"]?.confidence ?? 0, communication.confidence)),
          valence: 0.74,
          lastUpdatedTick: communication.tick,
        },
      } : {}),
    },
  };
}

function teachingAttemptFor(communication: HumanCommunicationRecord, reception: HumanCommunicationReception): HumanTeachingRecord | null {
  if (communication.type !== "Teaching" || !reception.accepted) {
    return null;
  }

  return {
    id: `${communication.worldId}:teaching:${communication.tick}:${communication.senderHumanId}:${reception.receiverHumanId}:${slug(communication.topic)}`,
    worldId: communication.worldId,
    tick: communication.tick,
    teacherAgentId: communication.senderHumanId,
    learnerAgentId: reception.receiverHumanId,
    topic: communication.topic,
    targetBelief: communication.topic === "nearby water" ? "nearby:water" : slug(communication.topic),
    method: communication.communicationMethod === "Gesture" || communication.communicationMethod === "Pointing" ? "demonstration" : "spoken",
    learnerAttention: reception.attentionScore,
    successScore: reception.acceptanceScore,
  };
}

function communicationSystemEvents(communication: HumanCommunicationRecord): HumanCommunicationSystemEvent[] {
  const acceptedCount = communication.receptions.filter((reception) => reception.accepted).length;
  const rejectedCount = communication.receptions.filter((reception) => reception.rejected).length;
  const ignoredCount = communication.receptions.filter((reception) => reception.ignored).length;
  const misunderstoodCount = communication.receptions.filter((reception) => reception.misunderstood).length;
  const successRate = communication.receptions.length === 0 ? 0 : round(acceptedCount / communication.receptions.length);
  const base = {
    worldId: communication.worldId,
    tick: communication.tick,
    communicationId: communication.id,
    senderHumanId: communication.senderHumanId,
    receiverHumanIds: communication.receiverHumanIds,
    type: communication.type,
    topic: communication.topic,
    successRate,
    importance: clamp01(communication.urgency * 0.34 + communication.emotionalWeight * 0.34 + communication.confidence * 0.2 + successRate * 0.12),
  };
  const events: HumanCommunicationSystemEvent[] = [{
    ...base,
    id: `${communication.id}:communication-created`,
    kind: "communication created",
    summary: `${communication.senderHumanId} communicated ${communication.type} about ${communication.topic}.`,
  }];

  if (acceptedCount > 0) {
    events.push({
      ...base,
      id: `${communication.id}:communication-accepted`,
      kind: communication.type === "Warning" || communication.type === "Danger" ? "first warning" : communication.type === "Teaching" ? "first teaching event" : communication.type === "Help" ? "first help request" : "communication accepted",
      summary: `${acceptedCount} receiver(s) accepted ${communication.type}.`,
    });
  }

  if (communication.type === "Teaching" && acceptedCount > 0) {
    events.push({
      ...base,
      id: `${communication.id}:knowledge-transmission`,
      kind: "knowledge transmission event",
      summary: `Teaching communication carried ${communication.topic}.`,
    });
  }

  if (communication.type === "Follow Me" && acceptedCount > 0) {
    events.push({
      ...base,
      id: `${communication.id}:group-coordination`,
      kind: "first successful group coordination",
      summary: `A follow request coordinated ${acceptedCount} receiver(s).`,
    });
  }

  if (rejectedCount > 0) {
    events.push({ ...base, id: `${communication.id}:communication-rejected`, kind: "communication rejected", summary: `${rejectedCount} receiver(s) rejected ${communication.type}.` });
  }

  if (ignoredCount > 0) {
    events.push({ ...base, id: `${communication.id}:communication-ignored`, kind: "communication ignored", summary: `${ignoredCount} receiver(s) ignored ${communication.type}.` });
  }

  if (misunderstoodCount > 0) {
    events.push({ ...base, id: `${communication.id}:communication-misunderstood`, kind: "communication misunderstood", summary: `${misunderstoodCount} receiver(s) misunderstood ${communication.type}.` });
  }

  return events.sort((left, right) => left.id.localeCompare(right.id));
}

export function updateCommunicationEngine(input: {
  worldId: string;
  tick: bigint;
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  communications: readonly HumanCommunicationRecord[];
}): CommunicationUpdateResult {
  const agentMap = new Map(input.agents.map((agent) => [agent.id, agent]));
  const relationshipMap = new Map(input.relationships.map((relationship) => [
    relationshipKey(relationship.humanId ?? relationship.fromAgentId, relationship.targetHumanId ?? relationship.toAgentId),
    relationship,
  ]));
  const teachingAttempts: HumanTeachingRecord[] = [];
  const events: HumanCommunicationSystemEvent[] = [];

  for (const communication of input.communications) {
    events.push(...communicationSystemEvents(communication));

    for (const reception of communication.receptions) {
      const receiver = agentMap.get(reception.receiverHumanId);

      if (receiver && (reception.accepted || reception.storedForLater)) {
        agentMap.set(receiver.id, agentWithCommunicationInfluence(receiver, communication));
      }

      const fromReceiver = relationshipMap.get(relationshipKey(reception.receiverHumanId, communication.senderHumanId));
      if (fromReceiver) {
        relationshipMap.set(
          relationshipKey(reception.receiverHumanId, communication.senderHumanId),
          relationshipWithCommunication(fromReceiver, communication, reception, reception.receiverHumanId),
        );
      }

      const fromSender = relationshipMap.get(relationshipKey(communication.senderHumanId, reception.receiverHumanId));
      if (fromSender) {
        relationshipMap.set(
          relationshipKey(communication.senderHumanId, reception.receiverHumanId),
          relationshipWithCommunication(fromSender, communication, reception, communication.senderHumanId),
        );
      }

      const teachingAttempt = teachingAttemptFor(communication, reception);
      if (teachingAttempt) {
        teachingAttempts.push(teachingAttempt);
      }
    }
  }

  return {
    agents: [...agentMap.values()].sort((left, right) => left.id.localeCompare(right.id)),
    relationships: [...relationshipMap.values()].sort((left, right) =>
      (left.humanId ?? left.fromAgentId).localeCompare(right.humanId ?? right.fromAgentId) ||
      (left.targetHumanId ?? left.toAgentId).localeCompare(right.targetHumanId ?? right.toAgentId)
    ),
    communications: [...input.communications].sort((left, right) => left.id.localeCompare(right.id)),
    teachingAttempts: teachingAttempts.sort((left, right) => left.id.localeCompare(right.id)),
    communicationEvents: events.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

