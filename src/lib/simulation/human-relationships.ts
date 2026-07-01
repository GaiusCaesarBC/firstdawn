import {
  HUMAN_ADULT_AGE_YEARS,
  type HumanAgent,
  type HumanCausalEvent,
  type HumanMemory,
  type HumanRelationship,
  type HumanRelationshipHistoryEntry,
  type HumanRelationshipStatus,
  type HumanRelationshipSystemEvent,
  type HumanReproductionEligibility,
} from "./human-types";

export const HUMAN_RELATIONSHIP_SYSTEM_ID = "relationships";

const RELATIONSHIP_HISTORY_LIMIT = 16;
const LOCAL_RELATIONSHIP_TARGET_LIMIT = 8;

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

function relationshipKey(humanId: string, targetHumanId: string): string {
  return `${humanId}|${targetHumanId}`;
}

function appendHistory(
  relationship: HumanRelationship,
  tick: bigint,
  event: string,
  summary: string,
  deltas: HumanRelationshipHistoryEntry["deltas"],
  sourceEventId: string | null,
): HumanRelationshipHistoryEntry[] {
  return [
    ...relationship.history,
    {
      tick: tick.toString(),
      event,
      summary,
      deltas,
      sourceEventId,
    },
  ].slice(-RELATIONSHIP_HISTORY_LIMIT);
}

function inferStatus(relationship: HumanRelationship): HumanRelationshipStatus {
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

function normalizeRelationship(relationship: HumanRelationship): HumanRelationship {
  const humanId = relationship.humanId ?? relationship.fromAgentId;
  const targetHumanId = relationship.targetHumanId ?? relationship.toAgentId;
  const normalized = {
    ...relationship,
    humanId,
    targetHumanId,
    fromAgentId: relationship.fromAgentId ?? humanId,
    toAgentId: relationship.toAgentId ?? targetHumanId,
    createdTick: relationship.createdTick ?? relationship.lastInteractionTick ?? "0",
    respect: relationship.respect ?? 0.2,
    rivalry: relationship.rivalry ?? relationship.resentment ?? 0,
    grief: relationship.grief ?? 0,
    socialMemoryScore: relationship.socialMemoryScore ?? 0,
    status: relationship.status ?? "Unknown",
    tags: unique(relationship.tags ?? []),
    history: relationship.history ?? [],
  } satisfies HumanRelationship;

  return {
    ...normalized,
    status: inferStatus(normalized),
  };
}

export function createNeutralRelationship(
  worldId: string,
  fromAgentId: string,
  toAgentId: string,
  tick: bigint = 0n,
): HumanRelationship {
  const relationship = {
    worldId,
    humanId: fromAgentId,
    targetHumanId: toAgentId,
    fromAgentId,
    toAgentId,
    createdTick: tick.toString(),
    kinship: "none",
    familiarity: 0.12,
    trust: 0.45,
    affection: 0.42,
    fear: 0.1,
    respect: 0.2,
    rivalry: 0,
    resentment: 0,
    dependency: 0.1,
    attraction: 0.5,
    companionship: 0.3,
    grief: 0,
    socialMemoryScore: 0,
    status: "Unknown",
    tags: [],
    history: [],
    lastInteractionTick: null,
  } satisfies HumanRelationship;

  return {
    ...relationship,
    status: inferStatus(relationship),
  };
}

export function createInitialRelationships(agents: readonly HumanAgent[]): HumanRelationship[] {
  return agents.flatMap((agent) =>
    agents
      .filter((other) => other.id !== agent.id)
      .map((other) => createNeutralRelationship(agent.worldId, agent.id, other.id)),
  );
}

function applyRelationshipInfluence(input: {
  relationship: HumanRelationship;
  tick: bigint;
  event: string;
  summary: string;
  sourceEventId: string | null;
  tags?: readonly string[];
  deltas: HumanRelationshipHistoryEntry["deltas"];
}): HumanRelationship {
  const relationship = normalizeRelationship(input.relationship);
  const next = {
    ...relationship,
    familiarity: clamp01(relationship.familiarity + (input.deltas.familiarity ?? 0)),
    trust: clamp01(relationship.trust + (input.deltas.trust ?? 0)),
    affection: clamp01(relationship.affection + (input.deltas.affection ?? 0)),
    fear: clamp01(relationship.fear + (input.deltas.fear ?? 0)),
    respect: clamp01(relationship.respect + (input.deltas.respect ?? 0)),
    rivalry: clamp01(relationship.rivalry + (input.deltas.rivalry ?? 0)),
    resentment: clamp01(relationship.resentment + (input.deltas.rivalry ?? 0) * 0.6 - (input.deltas.affection ?? 0) * 0.2),
    dependency: clamp01(relationship.dependency + (input.deltas.dependency ?? 0)),
    grief: clamp01(relationship.grief + (input.deltas.grief ?? 0)),
    companionship: clamp01(relationship.companionship + (input.deltas.affection ?? 0) * 0.5 + (input.deltas.familiarity ?? 0) * 0.25),
    socialMemoryScore: clamp01(relationship.socialMemoryScore + (input.deltas.socialMemoryScore ?? 0)),
    tags: unique([...relationship.tags, ...(input.tags ?? [])]),
    lastInteractionTick: input.tick.toString(),
  } satisfies HumanRelationship;

  return {
    ...next,
    status: inferStatus(next),
    history: appendHistory(relationship, input.tick, input.event, input.summary, input.deltas, input.sourceEventId),
  };
}

export function updateRelationshipForInteraction(
  relationship: HumanRelationship,
  interaction: "communication" | "teaching" | "comfort" | "sharedSurvival",
  tick: bigint,
): HumanRelationship {
  const trustDelta = interaction === "communication" ? 0.025 : interaction === "teaching" ? 0.035 : 0.02;
  const affectionDelta = interaction === "communication" ? 0.02 : interaction === "comfort" ? 0.04 : 0.015;
  const companionshipDelta = interaction === "sharedSurvival" ? 0.035 : 0.025;

  return applyRelationshipInfluence({
    relationship,
    tick,
    event: interaction,
    summary: `Relationship reinforced by ${interaction}.`,
    sourceEventId: null,
    tags: [interaction],
    deltas: {
      familiarity: 0.035,
      trust: trustDelta,
      affection: affectionDelta,
      fear: -0.01,
      dependency: 0.006,
      socialMemoryScore: companionshipDelta,
    },
  });
}

export function tickRelationshipDrift(
  relationship: HumanRelationship,
  context: {
    sameCell: boolean;
    dangerPresent: boolean;
    cooperationOccurred: boolean;
    unmetExpectation: boolean;
  },
): HumanRelationship {
  const proximity = context.sameCell ? 1 : 0;
  const trustDrift = (context.cooperationOccurred ? 0.01 : 0) - (context.unmetExpectation ? 0.012 : 0) - (context.dangerPresent ? 0.004 : 0);
  const affectionDrift = proximity * 0.008 - (context.unmetExpectation ? 0.01 : 0);
  const companionshipDrift = proximity * 0.01 - (!context.sameCell ? 0.006 : 0);
  const attractionDrift = proximity * 0.003 - (!context.sameCell ? 0.002 : 0);
  const fearDrift = context.dangerPresent ? 0.006 : -0.006;

  const next = {
    ...normalizeRelationship(relationship),
    trust: clamp01(relationship.trust + trustDrift),
    affection: clamp01(relationship.affection + affectionDrift),
    companionship: clamp01(relationship.companionship + companionshipDrift),
    attraction: clamp01(relationship.attraction + attractionDrift),
    fear: clamp01(relationship.fear + fearDrift),
    rivalry: clamp01((relationship.rivalry ?? 0) + (context.unmetExpectation ? 0.003 : -0.001)),
    resentment: clamp01(relationship.resentment + (context.unmetExpectation ? 0.004 : -0.002)),
    dependency: clamp01(relationship.dependency * 0.999 + (proximity ? 0.001 : -0.001)),
  };

  return {
    ...next,
    status: inferStatus(next),
  };
}

function relationshipEvent(input: {
  relationship: HumanRelationship;
  tick: bigint;
  kind: HumanRelationshipSystemEvent["kind"];
  previousStatus: HumanRelationshipStatus | null;
  summary: string;
  sourceEventId: string | null;
}): HumanRelationshipSystemEvent {
  return {
    id: `${input.relationship.worldId}:relationship-event:${input.tick.toString()}:${input.kind.replaceAll(" ", "-")}:${input.relationship.humanId}:${input.relationship.targetHumanId}:${input.sourceEventId ?? "local"}`,
    worldId: input.relationship.worldId,
    tick: input.tick.toString(),
    humanId: input.relationship.humanId,
    targetHumanId: input.relationship.targetHumanId,
    kind: input.kind,
    previousStatus: input.previousStatus,
    status: input.relationship.status,
    summary: input.summary,
    score: round(Math.max(input.relationship.trust, input.relationship.affection, input.relationship.fear, input.relationship.rivalry, input.relationship.socialMemoryScore)),
    sourceEventId: input.sourceEventId,
  };
}

function eventInfluence(event: HumanCausalEvent, humanId: string): { event: string; summary: string; tags: string[]; deltas: HumanRelationshipHistoryEntry["deltas"] } | null {
  const title = event.title.toLowerCase();
  const type = event.type.toLowerCase();

  if (type.includes("communication")) {
    return { event: "conversation", summary: "A remembered conversation made this person more familiar.", tags: ["conversation", "social"], deltas: { familiarity: 0.05, trust: 0.035, affection: 0.028, fear: -0.012, socialMemoryScore: 0.04 } };
  }

  if (type.includes("teaching")) {
    return { event: "teaching", summary: "Teaching reinforced respect and trust.", tags: ["teaching", "social"], deltas: { familiarity: 0.045, trust: 0.03, affection: 0.018, respect: 0.05, socialMemoryScore: 0.045 } };
  }

  if (title.includes("food") || type.includes("food")) {
    return { event: "food sharing", summary: "Food shared in the same event reinforced trust.", tags: ["food-sharing", "helping"], deltas: { familiarity: 0.035, trust: 0.06, affection: 0.045, dependency: 0.012, socialMemoryScore: 0.05 } };
  }

  if (type.includes("conflict")) {
    return { event: "conflict", summary: "Conflict made this person feel more dangerous.", tags: ["conflict"], deltas: { familiarity: 0.025, trust: -0.065, affection: -0.04, fear: 0.11, rivalry: 0.09, socialMemoryScore: 0.06 } };
  }

  if (type.includes("death")) {
    return { event: "death witnessed", summary: "A death witnessed together left grief in the bond.", tags: ["death", "grief"], deltas: { familiarity: 0.035, fear: 0.04, grief: 0.16, socialMemoryScore: 0.08 } };
  }

  if (type.includes("birth")) {
    return { event: "birth witnessed", summary: "A birth witnessed together reinforced social memory.", tags: ["birth", "kinship"], deltas: { familiarity: 0.04, trust: 0.03, affection: 0.05, socialMemoryScore: 0.07 } };
  }

  if (type.includes("safety") || type.includes("danger") || type.includes("threat") || type.includes("injury")) {
    return { event: "shared danger", summary: "Shared danger made this person more salient.", tags: ["danger", "shared-survival"], deltas: { familiarity: 0.035, trust: humanId === event.agentIds[0] ? 0.01 : 0.02, fear: 0.035, dependency: 0.018, socialMemoryScore: 0.055 } };
  }

  if (type.includes("goal completed")) {
    return { event: "shared goal success", summary: "A goal success involving another person reinforced trust.", tags: ["goal", "success"], deltas: { familiarity: 0.025, trust: 0.025, affection: 0.018, respect: 0.018, socialMemoryScore: 0.035 } };
  }

  if (type.includes("goal failed") || type.includes("goal interrupted")) {
    return { event: "shared goal failure", summary: "A goal failure involving another person strained confidence.", tags: ["goal", "failure"], deltas: { familiarity: 0.02, trust: -0.018, fear: 0.025, rivalry: 0.012, socialMemoryScore: 0.03 } };
  }

  return null;
}

function memoryInfluence(memory: HumanMemory): { event: string; summary: string; tags: string[]; deltas: HumanRelationshipHistoryEntry["deltas"] } | null {
  if (!memory.relatedHumanId || !memory.tags.some((tag) => ["relationship", "social", "conflict", "danger", "friendship"].includes(tag))) {
    return null;
  }

  const positive = memory.valence >= 0.56;
  const signal = clamp01(memory.importance * 0.42 + memory.confidence * 0.34 + memory.emotionalWeight * 0.24);

  return positive
    ? {
      event: "social memory reinforced",
      summary: "A positive social memory reinforced this relationship.",
      tags: ["memory", "social-memory"],
      deltas: { familiarity: signal * 0.025, trust: signal * 0.026, affection: signal * 0.022, socialMemoryScore: signal * 0.04 },
    }
    : {
      event: "danger memory reinforced",
      summary: "A negative social memory made this person feel less safe.",
      tags: ["memory", "danger-memory"],
      deltas: { familiarity: signal * 0.015, trust: -signal * 0.02, fear: signal * 0.04, rivalry: signal * 0.026, socialMemoryScore: signal * 0.045 },
    };
}

function createOrGetRelationship(
  relationships: Map<string, HumanRelationship>,
  worldId: string,
  humanId: string,
  targetHumanId: string,
  tick: bigint,
  events: HumanRelationshipSystemEvent[],
): HumanRelationship {
  const key = relationshipKey(humanId, targetHumanId);
  const existing = relationships.get(key);

  if (existing) {
    return existing;
  }

  const formed = createNeutralRelationship(worldId, humanId, targetHumanId, tick);
  relationships.set(key, formed);
  events.push(relationshipEvent({
    relationship: formed,
    tick,
    kind: "relationship formed",
    previousStatus: null,
    summary: "A persistent relationship record formed from lived proximity or shared events.",
    sourceEventId: null,
  }));

  return formed;
}

function recordThresholdEvents(
  previous: HumanRelationship,
  next: HumanRelationship,
  tick: bigint,
  sourceEventId: string | null,
  events: HumanRelationshipSystemEvent[],
): void {
  if (previous.trust < 0.6 && next.trust >= 0.6) {
    events.push(relationshipEvent({ relationship: next, tick, kind: "trust increased", previousStatus: previous.status, summary: "Trust crossed a meaningful threshold.", sourceEventId }));
  }

  if (previous.fear < 0.55 && next.fear >= 0.55) {
    events.push(relationshipEvent({ relationship: next, tick, kind: "fear increased", previousStatus: previous.status, summary: "Fear crossed a meaningful threshold.", sourceEventId }));
  }

  if (previous.rivalry < 0.45 && next.rivalry >= 0.45) {
    events.push(relationshipEvent({ relationship: next, tick, kind: "rivalry increased", previousStatus: previous.status, summary: "Rivalry crossed a meaningful threshold.", sourceEventId }));
  }

  if (previous.status !== "Friend" && next.status === "Friend") {
    events.push(relationshipEvent({ relationship: next, tick, kind: "friendship formed", previousStatus: previous.status, summary: "A trusted and affectionate relationship became friendship.", sourceEventId }));
  }

  if (previous.status !== "Family" && next.status === "Family") {
    events.push(relationshipEvent({ relationship: next, tick, kind: "family bond recognized", previousStatus: previous.status, summary: "A kinship relationship was recognized as family.", sourceEventId }));
  }

  if (previous.status !== next.status) {
    events.push(relationshipEvent({ relationship: next, tick, kind: "relationship status changed", previousStatus: previous.status, summary: `Relationship status changed from ${previous.status} to ${next.status}.`, sourceEventId }));
  }
}

function updatePair(input: {
  relationships: Map<string, HumanRelationship>;
  worldId: string;
  humanId: string;
  targetHumanId: string;
  tick: bigint;
  influence: { event: string; summary: string; tags: string[]; deltas: HumanRelationshipHistoryEntry["deltas"] };
  sourceEventId: string | null;
  events: HumanRelationshipSystemEvent[];
}): void {
  const current = createOrGetRelationship(input.relationships, input.worldId, input.humanId, input.targetHumanId, input.tick, input.events);
  const next = applyRelationshipInfluence({
    relationship: current,
    tick: input.tick,
    event: input.influence.event,
    summary: input.influence.summary,
    sourceEventId: input.sourceEventId,
    tags: input.influence.tags,
    deltas: input.influence.deltas,
  });

  input.relationships.set(relationshipKey(input.humanId, input.targetHumanId), next);
  recordThresholdEvents(current, next, input.tick, input.sourceEventId, input.events);
}

export function updateRelationshipEngine(input: {
  worldId: string;
  relationships: readonly HumanRelationship[];
  agents: readonly HumanAgent[];
  events: readonly HumanCausalEvent[];
  memories: readonly HumanMemory[];
  tick: bigint;
}): { relationships: HumanRelationship[]; relationshipEvents: HumanRelationshipSystemEvent[] } {
  const livingAgents = [...input.agents].filter((agent) => agent.isAlive).sort((left, right) => left.id.localeCompare(right.id));
  const livingIds = new Set(livingAgents.map((agent) => agent.id));
  const relationships = new Map(input.relationships.map((relationship) => {
    const normalized = normalizeRelationship(relationship);

    return [relationshipKey(normalized.humanId, normalized.targetHumanId), normalized];
  }));
  const relationshipEvents: HumanRelationshipSystemEvent[] = [];
  const touched = new Set<string>();

  const byCell = new Map<string, HumanAgent[]>();
  for (const agent of livingAgents) {
    byCell.set(agent.currentCellId, [...(byCell.get(agent.currentCellId) ?? []), agent]);
  }

  for (const cellAgents of byCell.values()) {
    const sorted = [...cellAgents].sort((left, right) => left.id.localeCompare(right.id));
    for (const agent of sorted) {
      const targets = sorted.filter((target) => target.id !== agent.id).slice(0, LOCAL_RELATIONSHIP_TARGET_LIMIT);
      for (const target of targets) {
        updatePair({
          relationships,
          worldId: input.worldId,
          humanId: agent.id,
          targetHumanId: target.id,
          tick: input.tick,
          sourceEventId: null,
          events: relationshipEvents,
          influence: {
            event: "proximity",
            summary: "Repeated proximity made this person more familiar.",
            tags: ["proximity", "repeated-encounter"],
            deltas: { familiarity: 0.045, affection: 0.006, socialMemoryScore: 0.012 },
          },
        });
        touched.add(relationshipKey(agent.id, target.id));
      }
    }
  }

  for (const event of input.events) {
    const participants = event.agentIds.filter((agentId) => livingIds.has(agentId)).sort();
    for (const humanId of participants) {
      const influence = eventInfluence(event, humanId);
      if (!influence) {
        continue;
      }

      for (const targetHumanId of participants.filter((agentId) => agentId !== humanId).slice(0, LOCAL_RELATIONSHIP_TARGET_LIMIT)) {
        updatePair({ relationships, worldId: input.worldId, humanId, targetHumanId, tick: input.tick, influence, sourceEventId: event.id, events: relationshipEvents });
        touched.add(relationshipKey(humanId, targetHumanId));
      }
    }
  }

  for (const memory of input.memories) {
    if (memory.tick !== input.tick.toString() || !memory.relatedHumanId || !livingIds.has(memory.agentId) || !livingIds.has(memory.relatedHumanId)) {
      continue;
    }

    const influence = memoryInfluence(memory);
    if (!influence) {
      continue;
    }

    updatePair({ relationships, worldId: input.worldId, humanId: memory.agentId, targetHumanId: memory.relatedHumanId, tick: input.tick, influence, sourceEventId: memory.sourceEventId, events: relationshipEvents });
    touched.add(relationshipKey(memory.agentId, memory.relatedHumanId));
  }

  for (const [key, relationship] of [...relationships.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    if (touched.has(key) || !livingIds.has(relationship.humanId) || !livingIds.has(relationship.targetHumanId)) {
      continue;
    }

    const decayed = tickRelationshipDrift(relationship, { sameCell: false, dangerPresent: false, cooperationOccurred: false, unmetExpectation: false });
    const next = {
      ...decayed,
      socialMemoryScore: clamp01(decayed.socialMemoryScore - 0.006),
      status: inferStatus(decayed),
    };

    if (next.status !== relationship.status || (input.tick % 24n === 0n && next.socialMemoryScore < relationship.socialMemoryScore)) {
      relationshipEvents.push(relationshipEvent({ relationship: next, tick: input.tick, kind: "relationship decayed", previousStatus: relationship.status, summary: "A known relationship drifted without fresh reinforcement.", sourceEventId: null }));
    }

    relationships.set(key, next);
  }

  return {
    relationships: [...relationships.values()].sort((left, right) =>
      left.humanId.localeCompare(right.humanId) || left.targetHumanId.localeCompare(right.targetHumanId)
    ),
    relationshipEvents: relationshipEvents.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function evaluateReproductionEligibility(
  first: HumanAgent,
  second: HumanAgent,
  firstToSecond: HumanRelationship,
  activeDecision: boolean,
): HumanReproductionEligibility {
  const reasons: string[] = [];

  if (!activeDecision) {
    reasons.push("reproduction requires an active decision");
  }

  if (!first.isAlive || !second.isAlive) {
    reasons.push("both participants must be alive");
  }

  if (first.approxAgeYears <= HUMAN_ADULT_AGE_YEARS || second.approxAgeYears <= HUMAN_ADULT_AGE_YEARS) {
    reasons.push("both participants must be over 18");
  }

  if (first.sex === second.sex) {
    reasons.push("participants must be biologically compatible");
  }

  if (firstToSecond.trust < 0.65) {
    reasons.push("trust threshold is not met");
  }

  if (firstToSecond.attraction < 0.6) {
    reasons.push("attraction threshold is not met");
  }

  if (firstToSecond.affection < 0.58) {
    reasons.push("bonding threshold is not met");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
