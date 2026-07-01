
import type { Prisma } from "@prisma/client";

import { createNeutralRelationship } from "./human-relationships";
import {
  HUMAN_ADULT_AGE_YEARS,
  type HumanAgeStage,
  type HumanAgent,
  type HumanCausalEvent,
  type HumanFamilyHistoryEntry,
  type HumanKnowledge,
  type HumanMemory,
  type HumanMvaState,
  type HumanRelationship,
} from "./human-types";
import type { Settlement, SettlementTickResult } from "./settlement-engine";

export const FAMILY_GENERATIONS_SYSTEM_ID = "family-generations";
export const FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY = "family-generations:tick-result";

export const DEFAULT_FAMILY_GENERATIONS_SCORING = Object.freeze({
  birthThreshold: 0.78,
  minBirthTick: 4,
  minBirthSpacingTicks: 48,
  stableHome: 0.18,
  settlementStability: 0.18,
  safety: 0.17,
  foodAvailability: 0.14,
  relationshipStrength: 0.2,
  health: 0.16,
  populationPressurePenalty: 0.14,
  adultAge: 0.08,
});

export type FamilyGenerationsScoringWeights = typeof DEFAULT_FAMILY_GENERATIONS_SCORING;

export type FamilyRecord = {
  id: string;
  lineageId: string;
  memberIds: string[];
  livingMemberIds: string[];
  parentIds: string[];
  childIds: string[];
  homeCellId: string;
  settlementId: string | null;
  ancestryTags: string[];
  history: HumanFamilyHistoryEntry[];
};

export type LineageRecord = {
  id: string;
  founderIds: string[];
  livingDescendantIds: string[];
  knownAncestorIds: string[];
  familyIds: string[];
  settlementIds: string[];
  knowledgeTopics: string[];
  establishedTick: string;
};

export type FamilySettlementSummary = {
  settlementId: string;
  familiesPresent: string[];
  largestLineageId: string | null;
  births: number;
  deaths: number;
  children: number;
  elders: number;
  foundingFamilies: string[];
};

export type FamilySystemEventKind = "first birth" | "family formed" | "child learned from parent" | "lineage established" | "elder died" | "family death" | "settlement birth milestone" | "founding family recognized" | "family migrated";

export type FamilySystemEvent = {
  id: string;
  worldId: string;
  tick: string;
  kind: FamilySystemEventKind;
  title: string;
  summary: string;
  importance: number;
  familyId: string | null;
  lineageId: string | null;
  settlementId: string | null;
  cellId: string;
  humanIds: string[];
};

export type BirthScoringEntry = {
  pairIds: [string, string];
  score: number;
  allowed: boolean;
  reasons: Record<string, number>;
};

export type FamilyGenerationsResult = {
  worldId: string;
  tick: string;
  state: HumanMvaState;
  families: FamilyRecord[];
  lineages: LineageRecord[];
  settlementSummaries: FamilySettlementSummary[];
  events: FamilySystemEvent[];
  scoring: BirthScoringEntry[];
};

const FAMILY_HISTORY_LIMIT = 24;
const MEMORY_LIMIT = 300;
const KNOWLEDGE_LIMIT = 300;

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

function ageStageForYears(years: number): HumanAgeStage {
  if (years < 2) return "Infant";
  if (years < 12) return "Child";
  if (years < HUMAN_ADULT_AGE_YEARS) return "Adolescent";
  if (years >= 60) return "Elder";
  return "Adult";
}

function normalizeAgent(agent: HumanAgent, tick: bigint): HumanAgent {
  const birthplaceCellId = agent.birthplaceCellId ?? agent.homeProfile?.birthplaceCellId ?? agent.homeCellId ?? agent.currentCellId;
  const familyId = agent.familyId ?? `${agent.worldId}:family:${agent.generation}:${birthplaceCellId}`;
  const lineageId = agent.lineageId ?? `${agent.worldId}:lineage:${agent.generation === 0 ? "first-humans" : familyId.replace(`${agent.worldId}:family:`, "")}`;

  return {
    ...agent,
    biologicalParentIds: unique(agent.biologicalParentIds ?? [agent.motherId ?? "", agent.fatherId ?? ""]),
    guardianIds: unique(agent.guardianIds ?? []),
    childIds: unique(agent.childIds ?? []),
    siblingIds: unique(agent.siblingIds ?? []),
    mateId: agent.mateId ?? null,
    familyId,
    lineageId,
    ageStage: agent.ageStage ?? ageStageForYears(agent.approxAgeYears),
    birthplaceCellId,
    birthplaceSettlementId: agent.birthplaceSettlementId ?? null,
    inheritedHomeCellId: agent.inheritedHomeCellId ?? agent.homeCellId ?? birthplaceCellId,
    inheritedSettlementId: agent.inheritedSettlementId ?? null,
    ancestryTags: unique(agent.ancestryTags ?? [agent.generation === 0 ? "founding-generation" : "descendant", `birthplace:${birthplaceCellId}`]),
    familyHistory: (agent.familyHistory ?? [{ tick: tick.toString(), type: "Lineage Established", summary: "A citizen entered the family continuity record.", relatedHumanIds: [], settlementId: null }]).slice(-FAMILY_HISTORY_LIMIT),
  };
}
function relationshipBetween(relationships: readonly HumanRelationship[], fromId: string, toId: string): HumanRelationship | null {
  return relationships.find((relationship) => relationship.fromAgentId === fromId && relationship.toAgentId === toId) ?? null;
}

function relationshipScore(relationship: HumanRelationship | null): number {
  if (!relationship) return 0.35;
  const mateBonus = relationship.kinship === "partner" || relationship.status === "Mate" ? 0.12 : 0;
  return clamp01(relationship.trust * 0.34 + relationship.affection * 0.3 + relationship.attraction * 0.18 + relationship.companionship * 0.12 + mateBonus - relationship.fear * 0.12 - relationship.rivalry * 0.1);
}

function nearestSettlement(first: HumanAgent, second: HumanAgent, settlements: readonly Settlement[]): Settlement | null {
  const cellIds = new Set([first.currentCellId, second.currentCellId, first.homeCellId, second.homeCellId, first.homeProfile?.primaryHomeCellId, second.homeProfile?.primaryHomeCellId].filter(Boolean) as string[]);
  return settlements
    .filter((settlement) => settlement.status !== "abandoned")
    .filter((settlement) => cellIds.has(settlement.homeCellId) || settlement.occupiedCells.some((cellId) => cellIds.has(cellId)))
    .sort((left, right) => right.permanence - left.permanence || right.importance - left.importance || left.id.localeCompare(right.id))[0] ?? null;
}

function homeScore(first: HumanAgent, second: HumanAgent): number {
  const firstHome = first.homeProfile?.primaryHomeCellId ?? first.homeCellId;
  const secondHome = second.homeProfile?.primaryHomeCellId ?? second.homeCellId;
  const sharedHome = firstHome === secondHome ? 0.64 : 0;
  const sameCell = first.currentCellId === second.currentCellId ? 0.24 : 0;
  const familiarity = Math.max(first.homeProfile?.cellAffinities[firstHome] ?? 0, second.homeProfile?.cellAffinities[secondHome] ?? 0);
  return clamp01(sharedHome + sameCell + familiarity * 0.24);
}

function settlementScore(settlement: Settlement | null): number {
  if (!settlement) return 0;
  const resources = clamp01((settlement.storedResources.foodCache + settlement.storedResources.waterStorage) / 6);
  return clamp01(settlement.permanence * 0.42 + settlement.importance * 0.28 + resources * 0.3);
}

function safetyScore(first: HumanAgent, second: HumanAgent, settlement: Settlement | null): number {
  const personalSafety = 1 - Math.max(first.needs.safety, second.needs.safety, first.emotions.fear * 0.75, second.emotions.fear * 0.75);
  const settlementSafety = settlement ? (settlement.status === "permanent" ? 1 : settlement.status === "seasonal" ? 0.78 : 0.62) : 0.45;
  return clamp01(personalSafety * 0.72 + settlementSafety * 0.28);
}

function foodScore(first: HumanAgent, second: HumanAgent, settlement: Settlement | null): number {
  const personal = 1 - Math.max(first.needs.hunger, second.needs.hunger, first.needs.thirst * 0.8, second.needs.thirst * 0.8);
  const stored = settlement ? clamp01((settlement.storedResources.foodCache + settlement.storedResources.waterStorage) / 5) : 0.35;
  return clamp01(personal * 0.62 + stored * 0.38);
}

function healthScore(first: HumanAgent, second: HumanAgent): number {
  const worstNeed = Math.max(first.needs.hunger, first.needs.thirst, first.needs.fatigue, first.needs.safety, second.needs.hunger, second.needs.thirst, second.needs.fatigue, second.needs.safety);
  const distress = Math.max(first.emotions.distress, second.emotions.distress);
  return clamp01(1 - worstNeed * 0.72 - distress * 0.24);
}

function populationPressure(settlement: Settlement | null, livingAgents: readonly HumanAgent[]): number {
  const localPopulation = settlement ? livingAgents.filter((agent) => settlement.occupiedCells.includes(agent.currentCellId) || settlement.occupiedCells.includes(agent.homeCellId)).length : livingAgents.length;
  return clamp01(Math.max(0, localPopulation - 8) / 10);
}

function isAdultForBirth(agent: HumanAgent): boolean {
  return agent.isAlive && agent.approxAgeYears >= HUMAN_ADULT_AGE_YEARS && agent.ageStage !== "Infant" && agent.ageStage !== "Child" && agent.ageStage !== "Adolescent";
}

function childBornRecently(first: HumanAgent, second: HumanAgent, agents: readonly HumanAgent[], tick: bigint, minSpacingTicks: number): boolean {
  const parentIds = new Set([first.id, second.id]);
  return agents.some((agent) => agent.biologicalParentIds?.some((parentId) => parentIds.has(parentId)) && tick - BigInt(agent.birthTick) < BigInt(minSpacingTicks));
}

function scoreBirthPair(input: { first: HumanAgent; second: HumanAgent; relationship: HumanRelationship | null; settlement: Settlement | null; livingAgents: readonly HumanAgent[]; tick: bigint; weights: FamilyGenerationsScoringWeights }): BirthScoringEntry {
  const adultAge = isAdultForBirth(input.first) && isAdultForBirth(input.second) && input.first.sex !== input.second.sex ? 1 : 0;
  const reasons = {
    adultAge,
    stableHome: homeScore(input.first, input.second),
    stableSettlement: settlementScore(input.settlement),
    safety: safetyScore(input.first, input.second, input.settlement),
    foodAvailability: foodScore(input.first, input.second, input.settlement),
    relationshipStrength: relationshipScore(input.relationship),
    health: healthScore(input.first, input.second),
    populationPressure: populationPressure(input.settlement, input.livingAgents),
    recentlyBorn: childBornRecently(input.first, input.second, input.livingAgents, input.tick, input.weights.minBirthSpacingTicks) ? 1 : 0,
  };
  const score = clamp01(reasons.adultAge * input.weights.adultAge + reasons.stableHome * input.weights.stableHome + reasons.stableSettlement * input.weights.settlementStability + reasons.safety * input.weights.safety + reasons.foodAvailability * input.weights.foodAvailability + reasons.relationshipStrength * input.weights.relationshipStrength + reasons.health * input.weights.health - reasons.populationPressure * input.weights.populationPressurePenalty);
  return {
    pairIds: [input.first.id, input.second.id].sort() as [string, string],
    score,
    allowed: input.tick >= BigInt(input.weights.minBirthTick) && reasons.recentlyBorn === 0 && score >= input.weights.birthThreshold,
    reasons,
  };
}

function familyIdForParents(worldId: string, parentIds: readonly string[], settlement: Settlement | null): string {
  return `${worldId}:family:${parentIds.map((id) => id.split(":").at(-1) ?? id).sort().join("-")}:${settlement?.homeCellId ?? "unsettled"}`;
}

function lineageIdForParents(worldId: string, parents: readonly HumanAgent[], familyId: string): string {
  return parents.map((parent) => parent.lineageId).filter((value): value is string => Boolean(value)).sort()[0] ?? `${worldId}:lineage:${familyId.replace(`${worldId}:family:`, "")}`;
}

function birthOrdinal(agents: readonly HumanAgent[], parentIds: readonly string[]): number {
  const parentSet = new Set(parentIds);
  return agents.filter((agent) => agent.biologicalParentIds?.some((id) => parentSet.has(id))).length + 1;
}

function sexForChild(worldId: string, tick: bigint, ordinal: number, parentIds: readonly string[]): "male" | "female" {
  const text = `${worldId}:${tick.toString()}:${ordinal}:${parentIds.join(":")}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619);
  return (hash >>> 0) % 2 === 0 ? "female" : "male";
}

function historyEntry(tick: bigint, type: string, summary: string, relatedHumanIds: readonly string[], settlementId: string | null): HumanFamilyHistoryEntry {
  return { tick: tick.toString(), type, summary, relatedHumanIds: unique(relatedHumanIds), settlementId };
}
function createChild(input: { worldId: string; tick: bigint; parents: readonly HumanAgent[]; agents: readonly HumanAgent[]; settlement: Settlement | null; familyId: string; lineageId: string }): HumanAgent {
  const parentIds = input.parents.map((parent) => parent.id).sort();
  const mother = input.parents.find((parent) => parent.sex === "female") ?? input.parents[0];
  const father = input.parents.find((parent) => parent.sex === "male") ?? input.parents[1] ?? input.parents[0];
  const ordinal = birthOrdinal(input.agents, parentIds);
  const birthplaceCellId = input.settlement?.homeCellId ?? mother.homeProfile?.primaryHomeCellId ?? mother.homeCellId ?? mother.currentCellId;
  const settlementId = input.settlement?.id ?? null;
  const childId = `${input.worldId}:child:${input.lineageId.split(":").at(-1) ?? "lineage"}:${ordinal}`;
  const homeCellId = input.settlement?.homeCellId ?? mother.homeProfile?.primaryHomeCellId ?? mother.homeCellId;
  return {
    ...mother,
    id: childId,
    sex: sexForChild(input.worldId, input.tick, ordinal, parentIds),
    birthTick: input.tick.toString(),
    ageDays: 0,
    approxAgeYears: 0,
    currentCellId: birthplaceCellId,
    previousCellId: null,
    destinationCellId: birthplaceCellId,
    movementIntent: "stay",
    movementReason: "infant dependency",
    lastMovedTick: null,
    recentPath: [birthplaceCellId],
    stuckTicks: 0,
    distanceTraveled: 0,
    explorationCount: 0,
    homeCellId,
    homeProfile: { ...mother.homeProfile, primaryHomeCellId: homeCellId, preferredSleepingCellId: homeCellId, birthplaceCellId, knownSafeCellIds: unique([homeCellId, ...(mother.homeProfile?.knownSafeCellIds ?? [])]), favoriteGatheringCellIds: unique([homeCellId, ...(mother.homeProfile?.favoriteGatheringCellIds ?? [])]), cellAffinities: { ...(mother.homeProfile?.cellAffinities ?? {}), [homeCellId]: 0.92 }, lastUpdatedTick: input.tick.toString() },
    motherId: mother.id,
    fatherId: father.id,
    generation: Math.max(...input.parents.map((parent) => parent.generation)) + 1,
    biologicalParentIds: parentIds,
    guardianIds: parentIds,
    childIds: [],
    siblingIds: unique(input.agents.filter((agent) => agent.biologicalParentIds?.some((parentId) => parentIds.includes(parentId))).map((agent) => agent.id)),
    mateId: null,
    familyId: input.familyId,
    lineageId: input.lineageId,
    ageStage: "Infant",
    birthplaceCellId,
    birthplaceSettlementId: settlementId,
    inheritedHomeCellId: homeCellId,
    inheritedSettlementId: settlementId,
    ancestryTags: unique(["born-in-simulation", `birthplace:${birthplaceCellId}`, ...(settlementId ? [`settlement:${settlementId}`] : []), ...input.parents.flatMap((parent) => parent.ancestryTags ?? [])]),
    familyHistory: [historyEntry(input.tick, "Birth", `Born into ${input.familyId} at ${birthplaceCellId}.`, parentIds, settlementId)],
    needs: { hunger: 0.22, thirst: 0.24, fatigue: 0.42, safety: 0.08, social: 0.16 },
    emotions: { ...mother.emotions, fear: 0.08, distress: 0.12, comfort: 0.62, trust: 0.72, attachment: 0.78, loneliness: 0.04, relief: 0.4 },
    motivations: { ...mother.motivations, explore: 0.02, learn: 0.18, socialize: 0.28, restVoluntary: 0.3, teach: 0 },
    confidence: 0.08,
    familiarityByCell: { [birthplaceCellId]: 0.88, [homeCellId]: 0.9 },
    safetyStreak: 0,
    currentGoal: { id: `${childId}:goal:${input.tick.toString()}:stay-near-family:${mother.id}`, type: "Stay Near Family", priority: 1, createdTick: input.tick.toString(), targetId: mother.id, targetCellId: mother.currentCellId, progress: 0, confidence: 0.92, reason: "Following Parent", status: "Active" },
    goalHistory: [],
    beliefs: { "family:guardians": { claim: "My guardians are safety and home.", confidence: 0.92, valence: 0.84, lastUpdatedTick: input.tick.toString() }, "home:birthplace": { claim: `Home begins at ${birthplaceCellId}.`, confidence: 0.9, valence: 0.82, lastUpdatedTick: input.tick.toString() } },
    theoryOfMind: {},
    lastDecision: null,
  };
}

function relationshipWithKinship(worldId: string, fromId: string, toId: string, kinship: HumanRelationship["kinship"], tick: bigint, dependency = 0.2): HumanRelationship {
  const base = createNeutralRelationship(worldId, fromId, toId, tick);
  const parentChild = kinship === "parent" || kinship === "child";
  const partner = kinship === "partner";
  return {
    ...base,
    kinship,
    familiarity: parentChild ? 0.9 : partner ? 0.82 : 0.72,
    trust: parentChild ? 0.88 : partner ? 0.82 : 0.72,
    affection: parentChild ? 0.92 : partner ? 0.84 : 0.78,
    dependency,
    attraction: partner ? 0.82 : 0,
    companionship: parentChild ? 0.74 : partner ? 0.82 : 0.64,
    status: partner ? "Mate" : "Family",
    tags: unique([kinship, "family", parentChild ? "care" : "kinship"]),
    lastInteractionTick: tick.toString(),
    history: [{ tick: tick.toString(), event: "family bond formed", summary: `Kinship ${kinship} established by the Family & Generations Engine.`, deltas: { familiarity: 0.72, trust: 0.72, affection: 0.72, dependency }, sourceEventId: null }],
  };
}

function upsertRelationship(relationships: HumanRelationship[], relationship: HumanRelationship): HumanRelationship[] {
  const index = relationships.findIndex((entry) => entry.fromAgentId === relationship.fromAgentId && entry.toAgentId === relationship.toAgentId);
  return index < 0 ? [...relationships, relationship] : relationships.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...relationship } : entry);
}

function familyMemory(input: { agent: HumanAgent; tick: bigint; type: string; subjectId: string; summary: string; tags: readonly string[]; relatedHumanId: string | null; cellId: string; sourceEventId: string; importance: number; valence: number }): HumanMemory {
  return {
    id: `${input.agent.id}:family-memory:${input.type.toLowerCase().replaceAll(" ", "-")}:${input.subjectId}:${input.tick.toString()}`,
    worldId: input.agent.worldId,
    agentId: input.agent.id,
    type: input.type,
    category: "Family Memory",
    subjectId: input.subjectId,
    locationCellId: input.cellId,
    createdTick: input.tick.toString(),
    lastRecalledTick: input.tick.toString(),
    importance: clamp01(input.importance),
    emotionalWeight: clamp01(input.importance),
    source: "family-generations-engine",
    relatedEntityId: null,
    relatedHumanId: input.relatedHumanId,
    tags: unique(input.tags),
    notes: input.summary,
    recallCount: 1,
    exposureCount: 1,
    tick: input.tick.toString(),
    cellId: input.cellId,
    participants: unique([input.agent.id, input.relatedHumanId ?? ""]),
    eventType: input.type,
    summary: input.summary,
    emotionAtEncoding: { ...input.agent.emotions },
    needContext: { ...input.agent.needs },
    salience: clamp01(input.importance),
    confidence: 0.92,
    valence: clamp01(input.valence),
    sourceEventId: input.sourceEventId,
    causalLinks: ["family", "lineage"],
  };
}

function inheritedKnowledge(child: HumanAgent, parent: HumanAgent, knowledge: HumanKnowledge, tick: bigint, eventId: string): HumanKnowledge {
  const topicKey = knowledge.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "family-knowledge";
  return {
    ...knowledge,
    id: `${child.id}:knowledge:${topicKey}`,
    agentId: child.id,
    sourceType: "inherited-family-teaching",
    sourceHumanId: parent.id,
    confidence: clamp01(knowledge.confidence * 0.62),
    mastery: clamp01(knowledge.mastery * 0.28),
    learnedTick: tick.toString(),
    practiceCount: 0,
    teachingCount: 0,
    learnerHumanIds: [],
    lastUsedTick: null,
    lastTaughtTick: null,
    tags: unique([...knowledge.tags, "family-knowledge", `lineage:${child.lineageId ?? "unknown"}`]),
    history: [{ tick: tick.toString(), event: "learned", summary: `Inherited early survival knowledge from ${parent.id}.`, confidence: clamp01(knowledge.confidence * 0.62), mastery: clamp01(knowledge.mastery * 0.28), sourceHumanId: parent.id, sourceEventId: eventId }],
  };
}
function chooseBirths(input: { worldId: string; tick: bigint; agents: readonly HumanAgent[]; relationships: readonly HumanRelationship[]; settlements: readonly Settlement[]; weights: FamilyGenerationsScoringWeights }) {
  const adults = input.agents.filter(isAdultForBirth).sort((left, right) => left.id.localeCompare(right.id));
  const births: Array<{ parents: HumanAgent[]; child: HumanAgent; settlement: Settlement | null; familyId: string; lineageId: string; score: BirthScoringEntry }> = [];
  const scoring: BirthScoringEntry[] = [];
  const usedParents = new Set<string>();
  for (let leftIndex = 0; leftIndex < adults.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < adults.length; rightIndex += 1) {
      const first = adults[leftIndex];
      const second = adults[rightIndex];
      if (first.sex === second.sex) continue;
      const relationship = relationshipBetween(input.relationships, first.id, second.id);
      const settlement = nearestSettlement(first, second, input.settlements);
      const score = scoreBirthPair({ first, second, relationship, settlement, livingAgents: input.agents, tick: input.tick, weights: input.weights });
      scoring.push(score);
      if (!score.allowed || usedParents.has(first.id) || usedParents.has(second.id)) continue;
      const parents = [first, second].sort((left, right) => left.id.localeCompare(right.id));
      const parentIds = parents.map((parent) => parent.id);
      const familyId = familyIdForParents(input.worldId, parentIds, settlement);
      const lineageId = lineageIdForParents(input.worldId, parents, familyId);
      const child = createChild({ worldId: input.worldId, tick: input.tick, parents, agents: [...input.agents, ...births.map((birth) => birth.child)], settlement, familyId, lineageId });
      births.push({ parents, child, settlement, familyId, lineageId, score });
      usedParents.add(first.id);
      usedParents.add(second.id);
    }
  }
  return { births, scoring: scoring.sort((left, right) => right.score - left.score || left.pairIds.join(":").localeCompare(right.pairIds.join(":"))) };
}

function birthEvent(worldId: string, tick: bigint, child: HumanAgent, parents: readonly HumanAgent[], familyId: string, lineageId: string, settlement: Settlement | null, firstBirth: boolean): FamilySystemEvent {
  return { id: `${worldId}:family-event:${tick.toString()}:birth:${child.id}`, worldId, tick: tick.toString(), kind: firstBirth ? "first birth" : "settlement birth milestone", title: firstBirth ? "First Birth" : "Settlement Birth Milestone", summary: `${child.id} was born to ${parents.map((parent) => parent.id).sort().join(" and ")}.`, importance: firstBirth ? 0.92 : 0.72, familyId, lineageId, settlementId: settlement?.id ?? null, cellId: child.currentCellId, humanIds: [child.id, ...parents.map((parent) => parent.id)].sort() };
}

function applyBirths(input: { worldId: string; tick: bigint; state: HumanMvaState; births: Array<{ parents: HumanAgent[]; child: HumanAgent; settlement: Settlement | null; familyId: string; lineageId: string; score: BirthScoringEntry }> }) {
  let agents = [...input.state.agents];
  let relationships = [...input.state.relationships];
  let memories = [...input.state.memories];
  let knowledge = [...input.state.knowledge];
  const events: FamilySystemEvent[] = [];
  const hadBirth = input.state.causalEvents.some((event) => event.type === "Human Birth");
  for (const birth of input.births) {
    const event = birthEvent(input.worldId, input.tick, birth.child, birth.parents, birth.familyId, birth.lineageId, birth.settlement, !hadBirth && events.every((entry) => entry.kind !== "first birth"));
    const entry = historyEntry(input.tick, "Birth", `${birth.child.id} was born into the family.`, [birth.child.id, ...birth.parents.map((parent) => parent.id)], birth.settlement?.id ?? null);
    agents = agents.map((agent) => birth.parents.some((parent) => parent.id === agent.id) ? { ...agent, childIds: unique([...(agent.childIds ?? []), birth.child.id]), mateId: birth.parents.find((parent) => parent.id !== agent.id)?.id ?? agent.mateId, familyId: birth.familyId, lineageId: birth.lineageId, ancestryTags: unique([...(agent.ancestryTags ?? []), "parent", ...(birth.settlement ? [`settlement:${birth.settlement.id}`] : [])]), familyHistory: [...agent.familyHistory, entry].slice(-FAMILY_HISTORY_LIMIT), emotions: { ...agent.emotions, attachment: clamp01(agent.emotions.attachment + 0.16), comfort: clamp01(agent.emotions.comfort + 0.08), trust: clamp01(agent.emotions.trust + 0.08) } } : agent);
    const siblings = agents.filter((agent) => birth.child.siblingIds.includes(agent.id));
    const child = { ...birth.child, siblingIds: unique(siblings.map((sibling) => sibling.id)) };
    agents = agents.map((agent) => child.siblingIds.includes(agent.id) ? { ...agent, siblingIds: unique([...(agent.siblingIds ?? []), child.id]) } : agent);
    agents.push(child);
    for (const parent of birth.parents) {
      relationships = upsertRelationship(relationships, relationshipWithKinship(input.worldId, parent.id, child.id, "parent", input.tick, 0.28));
      relationships = upsertRelationship(relationships, relationshipWithKinship(input.worldId, child.id, parent.id, "child", input.tick, 0.92));
    }
    if (birth.parents.length === 2) {
      relationships = upsertRelationship(relationships, relationshipWithKinship(input.worldId, birth.parents[0].id, birth.parents[1].id, "partner", input.tick, 0.2));
      relationships = upsertRelationship(relationships, relationshipWithKinship(input.worldId, birth.parents[1].id, birth.parents[0].id, "partner", input.tick, 0.2));
    }
    for (const sibling of siblings) {
      relationships = upsertRelationship(relationships, relationshipWithKinship(input.worldId, sibling.id, child.id, "sibling", input.tick, 0.18));
      relationships = upsertRelationship(relationships, relationshipWithKinship(input.worldId, child.id, sibling.id, "sibling", input.tick, 0.34));
    }
    memories.push(...birth.parents.map((parent) => familyMemory({ agent: parent, tick: input.tick, type: "Birth", subjectId: child.id, summary: `${child.id} was born at ${child.birthplaceCellId}.`, tags: ["birth", "family", "parent-care", "kinship"], relatedHumanId: child.id, cellId: child.birthplaceCellId, sourceEventId: event.id, importance: 0.92, valence: 0.86 })));
    memories.push(familyMemory({ agent: child, tick: input.tick, type: "Childhood Home", subjectId: child.birthplaceCellId, summary: `${child.birthplaceCellId} became the child's first inherited home.`, tags: ["childhood-home", "family", "home", "birth"], relatedHumanId: birth.parents[0]?.id ?? null, cellId: child.birthplaceCellId, sourceEventId: event.id, importance: 0.84, valence: 0.82 }));
    const inherited = birth.parents.flatMap((parent) => input.state.knowledge.filter((entry) => entry.agentId === parent.id && !entry.isForgotten && (entry.tags.includes("survival") || ["water", "food", "shelter", "danger", "navigation"].includes(entry.category))).sort((left, right) => right.importance - left.importance || right.confidence - left.confidence || left.id.localeCompare(right.id)).slice(0, 2).map((entry) => inheritedKnowledge(child, parent, entry, input.tick, event.id))).filter((entry, index, entries) => entries.findIndex((candidate) => candidate.topic === entry.topic) === index);
    knowledge.push(...inherited);
    if (inherited.length > 0) events.push({ id: `${input.worldId}:family-event:${input.tick.toString()}:child-learned:${child.id}`, worldId: input.worldId, tick: input.tick.toString(), kind: "child learned from parent", title: "Child Learned From Parent", summary: `${child.id} inherited early survival knowledge from guardians.`, importance: 0.62, familyId: birth.familyId, lineageId: birth.lineageId, settlementId: birth.settlement?.id ?? null, cellId: child.currentCellId, humanIds: [child.id, ...birth.parents.map((parent) => parent.id)].sort() });
    events.push(event);
  }
  return { state: { ...input.state, agents: agents.sort((left, right) => left.id.localeCompare(right.id)), relationships: relationships.sort((left, right) => left.fromAgentId.localeCompare(right.fromAgentId) || left.toAgentId.localeCompare(right.toAgentId)), memories: memories.slice(-MEMORY_LIMIT), knowledge: knowledge.slice(-KNOWLEDGE_LIMIT), causalEvents: [...input.state.causalEvents, ...events.map(familyEventToCausalEvent)] }, events: events.sort((left, right) => left.id.localeCompare(right.id)) };
}

function protectChildren(state: HumanMvaState): HumanMvaState {
  const byId = new Map(state.agents.map((agent) => [agent.id, agent]));
  return { ...state, agents: state.agents.map((agent) => {
    if (agent.ageStage !== "Infant" && agent.ageStage !== "Child") return agent;
    const guardian = agent.guardianIds.map((id) => byId.get(id)).find((entry): entry is HumanAgent => Boolean(entry?.isAlive));
    if (!guardian) return agent;
    return { ...agent, currentCellId: guardian.currentCellId, destinationCellId: guardian.currentCellId, movementIntent: "follow-trusted", movementReason: "childhood dependency near guardian", currentGoal: { id: `${agent.id}:goal:${state.tick}:stay-near-family:${guardian.id}`, type: "Stay Near Family", priority: 1, createdTick: state.tick, targetId: guardian.id, targetCellId: guardian.currentCellId, progress: 0, confidence: 0.94, reason: "Following Parent", status: "Active" } };
  }) };
}
function applyDeaths(previousState: HumanMvaState | null, state: HumanMvaState, tick: bigint) {
  if (!previousState) return { state, events: [] as FamilySystemEvent[] };
  const previousById = new Map(previousState.agents.map((agent) => [agent.id, agent]));
  const newlyDead = state.agents.filter((agent) => previousById.get(agent.id)?.isAlive && !agent.isAlive);
  let relationships = [...state.relationships];
  let memories = [...state.memories];
  const events: FamilySystemEvent[] = [];
  for (const dead of newlyDead) {
    const relatives = state.agents.filter((agent) => agent.isAlive && (agent.biologicalParentIds.includes(dead.id) || dead.biologicalParentIds.includes(agent.id) || agent.siblingIds.includes(dead.id) || agent.mateId === dead.id || dead.mateId === agent.id || agent.guardianIds.includes(dead.id)));
    const event: FamilySystemEvent = { id: `${dead.worldId}:family-event:${tick.toString()}:death:${dead.id}`, worldId: dead.worldId, tick: tick.toString(), kind: dead.ageStage === "Elder" ? "elder died" : "family death", title: dead.ageStage === "Elder" ? "Elder Died" : "Family Death", summary: `${dead.id} died, leaving grief in family bonds.`, importance: dead.ageStage === "Elder" ? 0.76 : 0.82, familyId: dead.familyId, lineageId: dead.lineageId, settlementId: dead.inheritedSettlementId, cellId: dead.currentCellId, humanIds: [dead.id, ...relatives.map((relative) => relative.id)].sort() };
    events.push(event);
    for (const relative of relatives) {
      memories.push(familyMemory({ agent: relative, tick, type: "Family Death", subjectId: dead.id, summary: `${dead.id} died and became part of family grief.`, tags: ["death", "family", "grief", "kinship"], relatedHumanId: dead.id, cellId: relative.currentCellId, sourceEventId: event.id, importance: 0.9, valence: 0.08 }));
      relationships = relationships.map((relationship) => relationship.fromAgentId === relative.id && relationship.toAgentId === dead.id ? { ...relationship, grief: clamp01(relationship.grief + 0.42), fear: clamp01(relationship.fear + 0.08), tags: unique([...relationship.tags, "grief", "family-death"]) } : relationship);
    }
  }
  return { state: { ...state, relationships, memories: memories.slice(-MEMORY_LIMIT) }, events };
}

function buildFamilies(state: HumanMvaState): FamilyRecord[] {
  const grouped = new Map<string, HumanAgent[]>();
  for (const agent of state.agents) {
    const familyId = agent.familyId ?? `${state.worldId}:family:unassigned`;
    grouped.set(familyId, [...(grouped.get(familyId) ?? []), agent]);
  }
  return [...grouped.entries()].map(([id, members]) => {
    const sorted = [...members].sort((left, right) => left.id.localeCompare(right.id));
    const lineageId = sorted.map((member) => member.lineageId).filter((value): value is string => Boolean(value)).sort()[0] ?? `${state.worldId}:lineage:unknown`;
    return { id, lineageId, memberIds: sorted.map((member) => member.id), livingMemberIds: sorted.filter((member) => member.isAlive).map((member) => member.id), parentIds: unique(sorted.filter((member) => member.childIds.length > 0).map((member) => member.id)), childIds: unique(sorted.flatMap((member) => member.childIds)), homeCellId: sorted[0]?.inheritedHomeCellId ?? sorted[0]?.homeCellId ?? "unknown-cell", settlementId: sorted.map((member) => member.inheritedSettlementId).filter((value): value is string => Boolean(value)).sort()[0] ?? null, ancestryTags: unique(sorted.flatMap((member) => member.ancestryTags)), history: sorted.flatMap((member) => member.familyHistory).sort((left, right) => Number(BigInt(left.tick) - BigInt(right.tick)) || left.type.localeCompare(right.type)).slice(-FAMILY_HISTORY_LIMIT) };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function buildLineages(state: HumanMvaState, families: readonly FamilyRecord[]): LineageRecord[] {
  const grouped = new Map<string, HumanAgent[]>();
  for (const agent of state.agents) {
    const lineageId = agent.lineageId ?? `${state.worldId}:lineage:unknown`;
    grouped.set(lineageId, [...(grouped.get(lineageId) ?? []), agent]);
  }
  return [...grouped.entries()].map(([id, members]) => ({
    id,
    founderIds: members.filter((member) => member.generation === 0).map((member) => member.id).sort(),
    livingDescendantIds: members.filter((member) => member.isAlive && member.generation > 0).map((member) => member.id).sort(),
    knownAncestorIds: unique(members.flatMap((member) => member.biologicalParentIds)),
    familyIds: families.filter((family) => family.lineageId === id).map((family) => family.id).sort(),
    settlementIds: unique(members.map((member) => member.inheritedSettlementId ?? "")),
    knowledgeTopics: unique(state.knowledge.filter((entry) => members.some((member) => member.id === entry.agentId)).map((entry) => entry.topic)).slice(0, 12),
    establishedTick: members.map((member) => BigInt(member.birthTick)).sort((left, right) => Number(left - right))[0]?.toString() ?? state.tick,
  })).sort((left, right) => left.id.localeCompare(right.id));
}

function buildSettlementSummaries(state: HumanMvaState, settlements: readonly Settlement[], families: readonly FamilyRecord[], events: readonly FamilySystemEvent[]): FamilySettlementSummary[] {
  return settlements.map((settlement) => {
    const familiesPresent = families.filter((family) => family.settlementId === settlement.id || family.homeCellId === settlement.homeCellId || family.livingMemberIds.some((id) => settlement.founderIds.includes(id))).map((family) => family.id).sort();
    const lineageCounts = new Map<string, number>();
    for (const family of families.filter((entry) => familiesPresent.includes(entry.id))) lineageCounts.set(family.lineageId, (lineageCounts.get(family.lineageId) ?? 0) + family.livingMemberIds.length);
    const largestLineageId = [...lineageCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
    const residents = state.agents.filter((agent) => settlement.occupiedCells.includes(agent.currentCellId) || settlement.occupiedCells.includes(agent.homeCellId));
    return { settlementId: settlement.id, familiesPresent, largestLineageId, births: events.filter((event) => event.settlementId === settlement.id && (event.kind === "first birth" || event.kind === "settlement birth milestone")).length, deaths: events.filter((event) => event.settlementId === settlement.id && (event.kind === "family death" || event.kind === "elder died")).length, children: residents.filter((agent) => agent.ageStage === "Infant" || agent.ageStage === "Child" || agent.ageStage === "Adolescent").length, elders: residents.filter((agent) => agent.ageStage === "Elder").length, foundingFamilies: families.filter((family) => family.memberIds.some((id) => settlement.founderIds.includes(id))).map((family) => family.id).sort() };
  }).sort((left, right) => left.settlementId.localeCompare(right.settlementId));
}

export function familyEventToCausalEvent(event: FamilySystemEvent): HumanCausalEvent {
  return { id: event.id, worldId: event.worldId, tick: event.tick, type: event.kind === "first birth" || event.kind === "settlement birth milestone" ? "Human Birth" : `Family ${event.title}`, title: event.title, summary: event.summary, agentIds: event.humanIds, cellId: event.cellId, causes: { familyId: event.familyId ?? "none", lineageId: event.lineageId ?? "none", settlementId: event.settlementId ?? "none", kind: event.kind }, effects: { importance: event.importance } as Record<string, Prisma.InputJsonValue>, memoryIds: [], chroniclerVisible: true, agentVisible: true };
}

export function getFamilyGenerationsStateFromHumanState(input: { worldId: string; tick: bigint; state: HumanMvaState; previousState?: HumanMvaState | null; settlements?: SettlementTickResult | null; weights?: FamilyGenerationsScoringWeights }): FamilyGenerationsResult {
  const weights = input.weights ?? DEFAULT_FAMILY_GENERATIONS_SCORING;
  const settlements = input.settlements?.settlements ?? [];
  const normalized: HumanMvaState = { ...input.state, tick: input.tick.toString(), agents: input.state.agents.map((agent) => normalizeAgent(agent, input.tick)) };
  const protectedState = protectChildren(normalized);
  const choices = chooseBirths({ worldId: input.worldId, tick: input.tick, agents: protectedState.agents, relationships: protectedState.relationships, settlements, weights });
  const birthApplied = applyBirths({ worldId: input.worldId, tick: input.tick, state: protectedState, births: choices.births });
  const deathApplied = applyDeaths(input.previousState ?? null, birthApplied.state, input.tick);
  const events = [...birthApplied.events, ...deathApplied.events].sort((left, right) => left.id.localeCompare(right.id));
  const families = buildFamilies(deathApplied.state);
  const lineages = buildLineages(deathApplied.state, families);
  return { worldId: input.worldId, tick: input.tick.toString(), state: deathApplied.state, families, lineages, settlementSummaries: buildSettlementSummaries(deathApplied.state, settlements, families, events), events, scoring: choices.scoring };
}
