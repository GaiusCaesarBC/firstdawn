import type { Prisma } from "@prisma/client";

import type {
  HumanAgent,
  HumanCausalEvent,
  HumanHomeProfile,
  HumanKnowledge,
  HumanMemory,
  HumanMvaState,
  HumanRelationship,
  HumanTickResult,
} from "./human-types";

export const SETTLEMENT_SYSTEM_ID = "settlements";
export const SETTLEMENT_TICK_RESULT_CACHE_KEY = "settlements:tick-result";

export type SettlementStatus = "forming" | "active" | "seasonal" | "permanent" | "abandoned";

export type SettlementStoredResources = {
  foodCache: number;
  waterStorage: number;
  fire: number;
  sharedSupplies: number;
  simpleShelter: number;
};

export type SettlementHistoryEntry = {
  tick: string;
  type: string;
  summary: string;
  importance: number;
};

export type SettlementDiscoveryHistoryEntry = {
  tick: string;
  humanId: string;
  topic: string;
  category: string;
  importance: number;
};

export type SettlementRelationshipEdge = {
  fromHumanId: string;
  toHumanId: string;
  trust: number;
  affection: number;
  fear: number;
  rivalry: number;
  status: string;
};

export type SettlementKnowledgeSummary = {
  category: string;
  topicCount: number;
  averageConfidence: number;
  averageMastery: number;
  importantTopics: string[];
};

export type Settlement = {
  id: string;
  name: string;
  foundedTick: string;
  founderIds: string[];
  currentPopulation: number;
  peakPopulation: number;
  homeCellId: string;
  occupiedCells: string[];
  type: string;
  status: SettlementStatus;
  importance: number;
  permanence: number;
  storedResources: SettlementStoredResources;
  structures: string[];
  culturalTraits: string[];
  discoveryHistory: SettlementDiscoveryHistoryEntry[];
  relationshipGraph: SettlementRelationshipEdge[];
  knowledgeSummary: SettlementKnowledgeSummary[];
  lastActivityTick: string;
  tags: string[];
  history: SettlementHistoryEntry[];
};

export type SettlementSystemEventKind =
  | "First Camp"
  | "Camp Founded"
  | "Camp Expanded"
  | "Camp Abandoned"
  | "Family Established"
  | "Population Milestone"
  | "First Shared Fire"
  | "First Stored Food"
  | "Settlement Merged"
  | "Settlement Split";

export type SettlementSystemEvent = {
  id: string;
  worldId: string;
  tick: string;
  settlementId: string;
  kind: SettlementSystemEventKind;
  title: string;
  summary: string;
  importance: number;
  cellId: string;
  humanIds: string[];
};

export type SettlementTypeDefinition = {
  id: string;
  label: string;
  minimumPermanence: number;
  minimumImportance: number;
  minimumPopulation: number;
  tags: readonly string[];
};

export type CampFormationScoringWeights = typeof DEFAULT_CAMP_FORMATION_SCORING;

export type SettlementTickResult = {
  worldId: string;
  tick: string;
  settlements: Settlement[];
  events: SettlementSystemEvent[];
  scoring: Array<{
    cellId: string;
    score: number;
    permanence: number;
    population: number;
    reasons: Record<string, number>;
  }>;
};

type CellSignals = {
  cellId: string;
  residents: HumanAgent[];
  memories: HumanMemory[];
  knowledge: HumanKnowledge[];
  events: HumanCausalEvent[];
  relationships: HumanRelationship[];
};

const SETTLEMENT_HISTORY_LIMIT = 24;
const DISCOVERY_HISTORY_LIMIT = 12;
const RELATIONSHIP_EDGE_LIMIT = 24;
const TYPE_REGISTRY = new Map<string, SettlementTypeDefinition>();

export const DEFAULT_CAMP_FORMATION_SCORING = Object.freeze({
  activationScore: 0.56,
  abandonmentDanger: 0.78,
  population: 0.18,
  repeatedPresence: 0.2,
  sleeping: 0.12,
  foodStorage: 0.12,
  waterStorage: 0.11,
  safetyMemory: 0.16,
  socialTrust: 0.13,
  familyCluster: 0.12,
  teaching: 0.08,
  knowledge: 0.08,
  fire: 0.08,
  shelter: 0.12,
  dangerPenalty: 0.36,
  overcrowdingPenalty: 0.04,
});

const INITIAL_SETTLEMENT_TYPES: readonly SettlementTypeDefinition[] = Object.freeze([
  { id: "temporary-camp", label: "Temporary Camp", minimumPermanence: 0, minimumImportance: 0, minimumPopulation: 1, tags: ["camp", "temporary"] },
  { id: "family-camp", label: "Family Camp", minimumPermanence: 0.26, minimumImportance: 0.28, minimumPopulation: 2, tags: ["camp", "family"] },
  { id: "shared-camp", label: "Shared Camp", minimumPermanence: 0.34, minimumImportance: 0.34, minimumPopulation: 2, tags: ["camp", "shared"] },
  { id: "seasonal-camp", label: "Seasonal Camp", minimumPermanence: 0.52, minimumImportance: 0.44, minimumPopulation: 2, tags: ["camp", "seasonal"] },
  { id: "permanent-settlement", label: "Permanent Settlement", minimumPermanence: 0.74, minimumImportance: 0.62, minimumPopulation: 2, tags: ["settlement", "permanent"] },
]);

for (const definition of INITIAL_SETTLEMENT_TYPES) {
  TYPE_REGISTRY.set(definition.id, definition);
}

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

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeTypeDefinition(definition: SettlementTypeDefinition): SettlementTypeDefinition {
  return {
    ...definition,
    minimumPermanence: clamp01(definition.minimumPermanence),
    minimumImportance: clamp01(definition.minimumImportance),
    minimumPopulation: Math.max(1, Math.round(definition.minimumPopulation)),
    tags: unique(definition.tags),
  };
}

export function registerSettlementType(definition: SettlementTypeDefinition): void {
  TYPE_REGISTRY.set(definition.id, normalizeTypeDefinition(definition));
}

export function getSettlementTypes(): SettlementTypeDefinition[] {
  return [...TYPE_REGISTRY.values()].sort((left, right) =>
    left.minimumPermanence - right.minimumPermanence || left.id.localeCompare(right.id)
  );
}

export function createHomeProfile(cellId: string, tick: bigint): HumanHomeProfile {
  return {
    primaryHomeCellId: cellId,
    secondaryHomeCellIds: [],
    preferredSleepingCellId: cellId,
    knownSafeCellIds: [cellId],
    favoriteGatheringCellIds: [cellId],
    birthplaceCellId: cellId,
    cellAffinities: { [cellId]: 0.48 },
    lastUpdatedTick: tick.toString(),
  };
}

function eventWeightForHome(event: HumanCausalEvent): number {
  if (event.type === "Human Need Fulfilled") {
    return 0.05;
  }

  if (event.type === "Human Safety Secured") {
    return 0.08;
  }

  if (event.type === "Human Communication" || event.type === "Human Communication Event") {
    return 0.04;
  }

  if (event.type === "Human Teaching") {
    return 0.035;
  }

  if (event.type === "Human Safety Check Failed") {
    return -0.12;
  }

  return 0.018;
}

function topCells(affinities: Record<string, number>, count: number, exclude: readonly string[] = []): string[] {
  const excluded = new Set(exclude);

  return Object.entries(affinities)
    .filter(([cellId]) => !excluded.has(cellId))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, count)
    .map(([cellId]) => cellId);
}

export function updateHumanHomeProfile(input: {
  agent: HumanAgent;
  tick: bigint;
  events: readonly HumanCausalEvent[];
}): HumanHomeProfile {
  const previous = input.agent.homeProfile ?? createHomeProfile(input.agent.homeCellId || input.agent.currentCellId, 0n);
  const affinities: Record<string, number> = Object.fromEntries(
    Object.entries(previous.cellAffinities).map(([cellId, value]) => [cellId, clamp01(value * 0.994)]),
  );
  const currentCellId = input.agent.currentCellId;
  const familiarity = input.agent.familiarityByCell[currentCellId] ?? 0.3;
  const localEvents = input.events.filter((event) => event.cellId === currentCellId && event.agentIds.includes(input.agent.id));
  const eventScore = localEvents.reduce((sum, event) => sum + eventWeightForHome(event), 0);
  const calmSafety = input.agent.needs.safety < 0.45 ? 0.025 : -0.018;
  const socialComfort = input.agent.emotions.attachment * 0.018 + input.agent.emotions.trust * 0.012;

  affinities[currentCellId] = clamp01((affinities[currentCellId] ?? 0.18) + 0.034 + familiarity * 0.025 + eventScore + calmSafety + socialComfort);

  const primaryHomeCellId = topCells(affinities, 1)[0] ?? currentCellId;
  const safeCells = topCells(affinities, 5).filter((cellId) => affinities[cellId] >= 0.34);
  const gatheringCells = topCells(affinities, 5).filter((cellId) => affinities[cellId] >= 0.28);
  const sleepingCell = localEvents.some((event) => event.type.includes("Rest") || event.causes.goalType === "Rest")
    ? currentCellId
    : previous.preferredSleepingCellId;

  return {
    primaryHomeCellId,
    secondaryHomeCellIds: topCells(affinities, 3, [primaryHomeCellId]),
    preferredSleepingCellId: sleepingCell || primaryHomeCellId,
    knownSafeCellIds: safeCells.length > 0 ? safeCells : [primaryHomeCellId],
    favoriteGatheringCellIds: gatheringCells.length > 0 ? gatheringCells : [primaryHomeCellId],
    birthplaceCellId: previous.birthplaceCellId || input.agent.homeCellId || currentCellId,
    cellAffinities: affinities,
    lastUpdatedTick: input.tick.toString(),
  };
}

export function applyHomeProfilesToAgents(
  agents: readonly HumanAgent[],
  events: readonly HumanCausalEvent[],
  tick: bigint,
): HumanAgent[] {
  return agents.map((agent) => {
    const homeProfile = updateHumanHomeProfile({ agent, events, tick });

    return {
      ...agent,
      homeCellId: homeProfile.primaryHomeCellId,
      homeProfile,
    };
  });
}

function cellSignals(state: HumanMvaState): CellSignals[] {
  const cellIds = unique([
    ...state.agents.map((agent) => agent.currentCellId),
    ...state.agents.map((agent) => agent.homeProfile?.primaryHomeCellId ?? agent.homeCellId),
    ...state.memories.map((memory) => memory.locationCellId),
    ...state.knowledge.flatMap((knowledge) => knowledge.tags.filter((tag) => tag.startsWith("cell-"))),
    ...state.causalEvents.map((event) => event.cellId),
  ]);

  return cellIds.map((cellId) => {
    const residents = state.agents.filter((agent) =>
      agent.isAlive && (agent.currentCellId === cellId || agent.homeProfile?.primaryHomeCellId === cellId || agent.homeCellId === cellId)
    );
    const residentIds = new Set(residents.map((agent) => agent.id));

    return {
      cellId,
      residents,
      memories: state.memories.filter((memory) => memory.locationCellId === cellId),
      knowledge: state.knowledge.filter((knowledge) => knowledge.tags.includes(cellId)),
      events: state.causalEvents.filter((event) => event.cellId === cellId),
      relationships: state.relationships.filter((relationship) =>
        residentIds.has(relationship.humanId ?? relationship.fromAgentId) &&
        residentIds.has(relationship.targetHumanId ?? relationship.toAgentId)
      ),
    };
  });
}

function signalCounts(signals: CellSignals) {
  const foodEvents = signals.events.filter((event) => event.type === "Human Need Fulfilled" && event.title.includes("Food")).length;
  const waterEvents = signals.events.filter((event) => event.type === "Human Need Fulfilled" && event.title.includes("Water")).length;
  const safetyEvents = signals.events.filter((event) => event.type === "Human Safety Secured").length;
  const dangerEvents = signals.events.filter((event) => event.type === "Human Safety Check Failed").length;
  const communicationEvents = signals.events.filter((event) => event.type.includes("Communication")).length;
  const teachingEvents = signals.events.filter((event) => event.type.includes("Teaching")).length;
  const restGoals = signals.events.filter((event) => event.causes.goalType === "Rest" || event.causes.goalType === "Return Home").length;
  const trustedRelationships = signals.relationships.filter((relationship) => relationship.trust >= 0.56 && relationship.fear < 0.48 && relationship.rivalry < 0.5).length;
  const familyRelationships = signals.relationships.filter((relationship) => relationship.kinship !== "none" || relationship.status === "Family" || relationship.status === "Mate").length;
  const safeMemories = signals.memories.filter((memory) => memory.tags.includes("safe") || memory.tags.includes("shelter"));
  const dangerMemories = signals.memories.filter((memory) => memory.tags.includes("danger"));

  return {
    foodEvents,
    waterEvents,
    safetyEvents,
    dangerEvents,
    communicationEvents,
    teachingEvents,
    restGoals,
    trustedRelationships,
    familyRelationships,
    safeMemories,
    dangerMemories,
  };
}

function scoreCell(signals: CellSignals, weights: CampFormationScoringWeights) {
  const counts = signalCounts(signals);
  const population = signals.residents.length;
  const repeatedPresence = average(signals.residents.map((agent) => agent.homeProfile?.cellAffinities[signals.cellId] ?? agent.familiarityByCell[signals.cellId] ?? 0));
  const foodStorage = clamp01(counts.foodEvents / 4 + signals.memories.filter((memory) => memory.tags.includes("food")).length / 8);
  const waterStorage = clamp01(counts.waterEvents / 4 + signals.memories.filter((memory) => memory.tags.includes("water")).length / 8);
  const safetyMemory = clamp01(counts.safetyEvents / 4 + average(counts.safeMemories.map((memory) => memory.confidence)) * 0.5);
  const danger = clamp01(counts.dangerEvents / 3 + average(counts.dangerMemories.map((memory) => memory.confidence)) * 0.65);
  const socialTrust = clamp01(counts.trustedRelationships / Math.max(1, population * 2));
  const familyCluster = clamp01(counts.familyRelationships / Math.max(1, population * 2));
  const teaching = clamp01(counts.teachingEvents / 4);
  const knowledge = clamp01(signals.knowledge.length / 6);
  const fire = clamp01(counts.communicationEvents / 5 + counts.safetyEvents / 8);
  const shelter = clamp01(counts.safetyEvents / 4 + counts.restGoals / 5);
  const overcrowding = Math.max(0, population - 18) / 18;
  const reasons = {
    population: clamp01(population / 8),
    repeatedPresence,
    sleeping: clamp01(counts.restGoals / 4),
    foodStorage,
    waterStorage,
    safetyMemory,
    socialTrust,
    familyCluster,
    teaching,
    knowledge,
    fire,
    shelter,
    danger,
    overcrowding: clamp01(overcrowding),
  };
  const positive =
    reasons.population * weights.population +
    reasons.repeatedPresence * weights.repeatedPresence +
    reasons.sleeping * weights.sleeping +
    reasons.foodStorage * weights.foodStorage +
    reasons.waterStorage * weights.waterStorage +
    reasons.safetyMemory * weights.safetyMemory +
    reasons.socialTrust * weights.socialTrust +
    reasons.familyCluster * weights.familyCluster +
    reasons.teaching * weights.teaching +
    reasons.knowledge * weights.knowledge +
    reasons.fire * weights.fire +
    reasons.shelter * weights.shelter;
  const penalty = reasons.danger * weights.dangerPenalty + reasons.overcrowding * weights.overcrowdingPenalty;
  const score = clamp01(positive - penalty);
  const permanence = clamp01(repeatedPresence * 0.36 + safetyMemory * 0.16 + socialTrust * 0.12 + foodStorage * 0.1 + waterStorage * 0.1 + shelter * 0.1 + knowledge * 0.06 - danger * 0.24);

  return { score, permanence, reasons };
}

function chooseSettlementType(population: number, importance: number, permanence: number): SettlementTypeDefinition {
  return [...TYPE_REGISTRY.values()]
    .filter((definition) =>
      population >= definition.minimumPopulation &&
      importance >= definition.minimumImportance &&
      permanence >= definition.minimumPermanence
    )
    .sort((left, right) =>
      right.minimumPermanence - left.minimumPermanence || right.minimumImportance - left.minimumImportance || left.id.localeCompare(right.id)
    )[0] ?? getSettlementTypes()[0];
}

function foundedTick(events: readonly HumanCausalEvent[], fallbackTick: string): string {
  const earliest = events
    .map((event) => BigInt(event.tick))
    .sort((left, right) => Number(left - right))[0];

  return (earliest ?? BigInt(fallbackTick)).toString();
}

function settlementId(worldId: string, cellId: string): string {
  return `${worldId}:settlement:${cellId}`;
}

function settlementName(cellId: string, type: SettlementTypeDefinition): string {
  return `${type.label} ${cellId.replace("cell-", "")}`;
}

function settlementResources(signals: CellSignals): SettlementStoredResources {
  const counts = signalCounts(signals);

  return {
    foodCache: round(Math.min(99, counts.foodEvents + signals.memories.filter((memory) => memory.tags.includes("food")).length * 0.5), 3),
    waterStorage: round(Math.min(99, counts.waterEvents + signals.memories.filter((memory) => memory.tags.includes("water")).length * 0.5), 3),
    fire: round(Math.min(1, counts.communicationEvents / 5 + counts.safetyEvents / 8), 3),
    sharedSupplies: round(Math.min(99, counts.communicationEvents + counts.teachingEvents + counts.foodEvents), 3),
    simpleShelter: round(Math.min(1, counts.safetyEvents / 4 + counts.restGoals / 5), 3),
  };
}

function settlementStructures(resources: SettlementStoredResources): string[] {
  return unique([
    resources.fire > 0 ? "Shared Fire" : "",
    resources.foodCache > 0 ? "Food Cache" : "",
    resources.waterStorage > 0 ? "Water Storage" : "",
    resources.simpleShelter > 0 ? "Simple Shelter" : "",
  ]);
}

function discoveryHistory(signals: CellSignals): SettlementDiscoveryHistoryEntry[] {
  return signals.knowledge
    .sort((left, right) => Number(BigInt(right.learnedTick) - BigInt(left.learnedTick)) || right.importance - left.importance || left.id.localeCompare(right.id))
    .slice(0, DISCOVERY_HISTORY_LIMIT)
    .map((knowledge) => ({
      tick: knowledge.learnedTick,
      humanId: knowledge.agentId,
      topic: knowledge.topic,
      category: knowledge.category,
      importance: knowledge.importance,
    }));
}

function knowledgeSummary(signals: CellSignals): SettlementKnowledgeSummary[] {
  const byCategory = new Map<string, HumanKnowledge[]>();

  for (const knowledge of signals.knowledge.filter((entry) => !entry.isForgotten)) {
    byCategory.set(knowledge.category, [...(byCategory.get(knowledge.category) ?? []), knowledge]);
  }

  return [...byCategory.entries()]
    .map(([category, entries]) => ({
      category,
      topicCount: entries.length,
      averageConfidence: average(entries.map((entry) => entry.confidence)),
      averageMastery: average(entries.map((entry) => entry.mastery)),
      importantTopics: entries
        .sort((left, right) => right.importance - left.importance || left.topic.localeCompare(right.topic))
        .slice(0, 4)
        .map((entry) => entry.topic),
    }))
    .sort((left, right) => right.topicCount - left.topicCount || left.category.localeCompare(right.category));
}

function relationshipGraph(signals: CellSignals): SettlementRelationshipEdge[] {
  return signals.relationships
    .sort((left, right) =>
      (right.trust + right.affection - right.fear - right.rivalry) - (left.trust + left.affection - left.fear - left.rivalry) ||
      left.humanId.localeCompare(right.humanId) ||
      left.targetHumanId.localeCompare(right.targetHumanId)
    )
    .slice(0, RELATIONSHIP_EDGE_LIMIT)
    .map((relationship) => ({
      fromHumanId: relationship.humanId ?? relationship.fromAgentId,
      toHumanId: relationship.targetHumanId ?? relationship.toAgentId,
      trust: relationship.trust,
      affection: relationship.affection,
      fear: relationship.fear,
      rivalry: relationship.rivalry,
      status: relationship.status,
    }));
}

function settlementHistory(input: {
  settlement: Pick<Settlement, "id" | "foundedTick" | "currentPopulation" | "peakPopulation" | "type" | "status" | "importance" | "permanence">;
  signals: CellSignals;
  resources: SettlementStoredResources;
  tick: bigint;
}): SettlementHistoryEntry[] {
  const entries: SettlementHistoryEntry[] = [{
    tick: input.settlement.foundedTick,
    type: "Camp Founded",
    summary: `${input.settlement.type} emerged at ${input.signals.cellId} from repeated local human decisions.`,
    importance: input.settlement.importance,
  }];

  if (input.resources.fire > 0) {
    entries.push({ tick: input.settlement.foundedTick, type: "First Shared Fire", summary: "A shared fire became part of the camp pattern.", importance: 0.56 });
  }

  if (input.resources.foodCache > 0) {
    entries.push({ tick: input.settlement.foundedTick, type: "First Stored Food", summary: "Food began accumulating at the camp.", importance: 0.52 });
  }

  if (input.settlement.currentPopulation >= 2) {
    entries.push({ tick: input.tick.toString(), type: "Population Milestone", summary: `${input.settlement.currentPopulation} citizens now identify with this place.`, importance: 0.5 });
  }

  if (input.settlement.status === "abandoned") {
    entries.push({ tick: input.tick.toString(), type: "Camp Abandoned", summary: "Unsafe or empty conditions left the camp abandoned.", importance: 0.68 });
  }

  return entries.sort((left, right) => Number(BigInt(left.tick) - BigInt(right.tick)) || left.type.localeCompare(right.type)).slice(-SETTLEMENT_HISTORY_LIMIT);
}

function buildSettlement(input: {
  worldId: string;
  tick: bigint;
  signals: CellSignals;
  score: number;
  permanence: number;
  reasons: Record<string, number>;
  weights: CampFormationScoringWeights;
  previous?: Settlement | null;
}): Settlement | null {

  if (input.score < input.weights.activationScore && input.reasons.danger < input.weights.abandonmentDanger) {
    return null;
  }

  const population = input.signals.residents.length;
  const resources = settlementResources(input.signals);
  const type = chooseSettlementType(population, input.score, input.permanence);
  const status: SettlementStatus = population === 0 || input.reasons.danger >= input.weights.abandonmentDanger
    ? "abandoned"
    : input.permanence >= 0.72
      ? "permanent"
      : input.permanence >= 0.48
        ? "seasonal"
        : input.score >= input.weights.activationScore
          ? "active"
          : "forming";
  const settlement = {
    id: settlementId(input.worldId, input.signals.cellId),
    name: settlementName(input.signals.cellId, type),
    foundedTick: input.previous?.foundedTick ?? foundedTick(input.signals.events, input.tick.toString()),
    founderIds: input.previous?.founderIds ?? input.signals.residents.map((agent) => agent.id).sort(),
    currentPopulation: population,
    peakPopulation: Math.max(input.previous?.peakPopulation ?? 0, population),
    homeCellId: input.signals.cellId,
    occupiedCells: unique([
      input.signals.cellId,
      ...input.signals.residents.flatMap((agent) => agent.homeProfile?.favoriteGatheringCellIds ?? []),
      ...input.signals.residents.flatMap((agent) => agent.homeProfile?.knownSafeCellIds ?? []),
    ]),
    type: type.label,
    status,
    importance: input.score,
    permanence: input.permanence,
    storedResources: resources,
    structures: settlementStructures(resources),
    culturalTraits: unique([
      input.reasons.familyCluster >= 0.2 ? "family-cluster" : "",
      input.reasons.teaching > 0 ? "teaching-place" : "",
      input.reasons.safetyMemory >= 0.32 ? "safe-place" : "",
      input.reasons.foodStorage > 0 || input.reasons.waterStorage > 0 ? "resource-sharing" : "",
    ]),
    discoveryHistory: discoveryHistory(input.signals),
    relationshipGraph: relationshipGraph(input.signals),
    knowledgeSummary: knowledgeSummary(input.signals),
    lastActivityTick: input.tick.toString(),
    tags: unique([...type.tags, status, ...settlementStructures(resources).map((entry) => entry.toLowerCase().replaceAll(" ", "-"))]),
    history: [],
  } satisfies Settlement;

  const freshHistory = settlementHistory({ settlement, signals: input.signals, resources, tick: input.tick });
  const historyByKey = new Map(
    [...(input.previous?.history ?? []), ...freshHistory].map((entry) => [`${entry.tick}:${entry.type}:${entry.summary}`, entry]),
  );

  return {
    ...settlement,
    history: [...historyByKey.values()]
      .sort((left, right) => Number(BigInt(left.tick) - BigInt(right.tick)) || left.type.localeCompare(right.type))
      .slice(-SETTLEMENT_HISTORY_LIMIT),
  };
}

function eventFor(input: {
  worldId: string;
  tick: bigint;
  settlement: Settlement;
  kind: SettlementSystemEventKind;
  summary: string;
  importance: number;
}): SettlementSystemEvent {
  return {
    id: `${input.settlement.id}:event:${input.kind.toLowerCase().replaceAll(" ", "-")}:${input.tick.toString()}`,
    worldId: input.worldId,
    tick: input.tick.toString(),
    settlementId: input.settlement.id,
    kind: input.kind,
    title: input.kind,
    summary: input.summary,
    importance: input.importance,
    cellId: input.settlement.homeCellId,
    humanIds: input.settlement.founderIds,
  };
}

function settlementEvents(input: {
  worldId: string;
  tick: bigint;
  previous: readonly Settlement[];
  current: readonly Settlement[];
}): SettlementSystemEvent[] {
  const previousById = new Map(input.previous.map((settlement) => [settlement.id, settlement]));
  const events: SettlementSystemEvent[] = [];

  for (const settlement of input.current) {
    const previous = previousById.get(settlement.id);

    if (!previous && settlement.status !== "abandoned") {
      events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlement, kind: input.current.length === 1 ? "First Camp" : "Camp Founded", summary: `${settlement.name} emerged without being spawned.`, importance: 0.72 }));
    }

    if (previous && previous.currentPopulation < settlement.currentPopulation) {
      events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlement, kind: "Camp Expanded", summary: `${settlement.name} grew because citizens chose to stay nearby.`, importance: 0.56 }));
    }

    if (previous && previous.status !== "abandoned" && settlement.status === "abandoned") {
      events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlement, kind: "Camp Abandoned", summary: `${settlement.name} was abandoned after local safety or population pressure changed.`, importance: 0.7 }));
    }

    if (!previous && settlement.relationshipGraph.some((edge) => edge.status === "Family" || edge.status === "Mate")) {
      events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlement, kind: "Family Established", summary: `Family bonds anchored ${settlement.name}.`, importance: 0.58 }));
    }

    if (!previous && settlement.storedResources.fire > 0) {
      events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlement, kind: "First Shared Fire", summary: `${settlement.name} gained its first shared fire pattern.`, importance: 0.5 }));
    }

    if (!previous && settlement.storedResources.foodCache > 0) {
      events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlement, kind: "First Stored Food", summary: `${settlement.name} began accumulating food.`, importance: 0.48 }));
    }
  }

  return events.sort((left, right) => left.id.localeCompare(right.id));
}

export function getSettlementStateFromHumanState(input: {
  worldId: string;
  tick: bigint;
  state: HumanMvaState;
  previousState?: HumanMvaState | null;
  weights?: CampFormationScoringWeights;
}): SettlementTickResult {
  const weights = input.weights ?? DEFAULT_CAMP_FORMATION_SCORING;
  const previousSettlements = input.previousState
    ? getSettlementStateFromHumanState({ worldId: input.worldId, tick: input.tick - 1n, state: input.previousState, weights }).settlements
    : [];
  const previousById = new Map(previousSettlements.map((settlement) => [settlement.id, settlement]));
  const scored = cellSignals(input.state)
    .map((signals) => ({ signals, ...scoreCell(signals, weights) }))
    .sort((left, right) => right.score - left.score || left.signals.cellId.localeCompare(right.signals.cellId));
  const settlements = scored
    .map((entry) => buildSettlement({
      worldId: input.worldId,
      tick: input.tick,
      signals: entry.signals,
      score: entry.score,
      permanence: entry.permanence,
      reasons: entry.reasons,
      weights,
      previous: previousById.get(settlementId(input.worldId, entry.signals.cellId)) ?? null,
    }))
    .filter((settlement): settlement is Settlement => Boolean(settlement))
    .sort((left, right) =>
      (right.status === "abandoned" ? 0 : 1) - (left.status === "abandoned" ? 0 : 1) ||
      right.permanence - left.permanence ||
      right.importance - left.importance ||
      left.id.localeCompare(right.id)
    );
  return {
    worldId: input.worldId,
    tick: input.tick.toString(),
    settlements,
    events: settlementEvents({ worldId: input.worldId, tick: input.tick, previous: previousSettlements, current: settlements }),
    scoring: scored.map((entry) => ({
      cellId: entry.signals.cellId,
      score: entry.score,
      permanence: entry.permanence,
      population: entry.signals.residents.length,
      reasons: entry.reasons,
    })),
  };
}

export function getSettlementStateAtTick(input: {
  world: { id: string; seed?: string | null };
  tick: bigint;
  humanResult: HumanTickResult;
  previousHumanResult?: HumanTickResult | null;
  weights?: CampFormationScoringWeights;
}): SettlementTickResult {
  return getSettlementStateFromHumanState({
    worldId: input.world.id,
    tick: input.tick,
    state: input.humanResult.state,
    previousState: input.previousHumanResult?.state ?? null,
    weights: input.weights,
  });
}

export function settlementEventToCausalEvent(event: SettlementSystemEvent): HumanCausalEvent {
  return {
    id: event.id,
    worldId: event.worldId,
    tick: event.tick,
    type: `Settlement ${event.kind}`,
    title: event.title,
    summary: event.summary,
    agentIds: event.humanIds,
    cellId: event.cellId,
    causes: { settlementId: event.settlementId, kind: event.kind },
    effects: { importance: event.importance } as Record<string, Prisma.InputJsonValue>,
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: true,
  };
}
