import type { Prisma } from "@prisma/client";

import { recallRelevantMemories, type HumanMemoryIndex } from "./human-memory";
import { strongestKnowledgeByTag } from "./human-knowledge";
import type {
  HumanActionType,
  HumanAgent,
  HumanCausalEvent,
  HumanGoal,
  HumanGoalHistoryEntry,
  HumanGoalReason,
  HumanGoalType,
  HumanKnowledge,
  HumanMemory,
  HumanRelationship,
} from "./human-types";

export const HUMAN_TICK_RESULT_CACHE_KEY = "human:mva:tick-result";
export const HUMAN_GOAL_DECISION_SYSTEM_ID = "goal-decision";

export const HUMAN_GOAL_EVENT_TYPES = Object.freeze({
  started: "Human Goal Started",
  completed: "Human Goal Completed",
  failed: "Human Goal Failed",
  interrupted: "Human Goal Interrupted",
  changed: "Human Goal Changed",
} as const);

export type HumanGoalEnvironment = {
  readonly dangerScore?: number;
  readonly temperatureStress?: number;
  readonly waterAvailability?: number;
  readonly edibleFoodAvailability?: number;
  readonly shelterAvailability?: number;
  readonly weatherSeverity?: number;
  readonly timeOfDayPressure?: number;
};

export type HumanGoalDecisionContext = {
  readonly worldId: string;
  readonly tick: bigint;
  readonly seed: string;
  readonly agent: HumanAgent;
  readonly agents: readonly HumanAgent[];
  readonly relationships: readonly HumanRelationship[];
  readonly knowledge?: readonly HumanKnowledge[];
  readonly memories: readonly HumanMemory[];
  readonly memoryIndex?: HumanMemoryIndex;
  readonly environment?: HumanGoalEnvironment;
  readonly weights?: HumanGoalScoringWeights;
};

export type HumanGoalCandidate = {
  readonly type: HumanGoalType;
  readonly priority: number;
  readonly confidence: number;
  readonly reason: HumanGoalReason;
  readonly targetId: string | null;
  readonly targetCellId: string | null;
  readonly scoreInputs: Record<string, Prisma.InputJsonValue>;
};

export type HumanGoalPlugin = {
  readonly type: HumanGoalType;
  readonly createCandidate: (context: ResolvedGoalDecisionContext) => HumanGoalCandidate | null;
};

export type HumanGoalDecisionResult = {
  readonly agent: HumanAgent;
  readonly events: HumanCausalEvent[];
  readonly candidates: HumanGoalCandidate[];
};

export type HumanGoalScoringWeights = typeof DEFAULT_GOAL_SCORING_WEIGHTS;

type ResolvedGoalDecisionContext = HumanGoalDecisionContext & {
  readonly weights: typeof DEFAULT_GOAL_SCORING_WEIGHTS;
  readonly environment: Required<HumanGoalEnvironment>;
};

type GoalLifecycleEvent = "Started" | "Completed" | "Failed" | "Interrupted" | "Changed";

const GOAL_HISTORY_LIMIT = 24;

export const DEFAULT_GOAL_SCORING_WEIGHTS = Object.freeze({
  needs: Object.freeze({
    hunger: 1.55,
    thirst: 1.72,
    fatigue: 1.18,
    safety: 2.15,
    social: 0.82,
  }),
  motivations: Object.freeze({
    explore: 0.58,
    observeSurroundings: 0.46,
    socialize: 0.44,
    restVoluntary: 0.28,
  }),
  environment: Object.freeze({
    danger: 1.48,
    temperatureStress: 0.72,
    waterAvailability: 0.34,
    edibleFoodAvailability: 0.38,
    shelterAvailability: 0.3,
    weatherSeverity: 0.62,
    timeOfDayPressure: 0.18,
  }),
  knowledge: Object.freeze({
    knownWater: 0.32,
    knownFood: 0.28,
    familiarity: 0.18,
    memoryFailurePenalty: 0.18,
  }),
  memory: Object.freeze({
    foodSource: 0.44,
    waterSource: 0.48,
    shelter: 0.28,
    danger: 1.35,
    relationship: 0.16,
  }),
  relationships: Object.freeze({
    sameCellCompanion: 0.38,
    kinship: 0.5,
    trust: 0.2,
    affection: 0.18,
    familyBond: 0.48,
    threatAvoidance: 1.12,
    rivalryAvoidance: 0.54,
    dependency: 0.24,
    respectedHuman: 0.22,
    familiarGroupWhenAfraid: 0.34,
  }),
  settlement: Object.freeze({
    homeAffinity: 0.44,
    returnHomeWhenTired: 0.42,
    returnHomeWhenUnsafe: 0.5,
    campGathering: 0.28,
    campDefense: 0.58,
    overcrowdingAvoidance: 0.16,
  }),
  continuity: Object.freeze({
    persistenceMargin: 0.16,
    interruptionMargin: 0.08,
    completionProgress: 1,
  }),
  progress: Object.freeze({
    passiveIncrement: 0.16,
    observeIncrement: 0.24,
    exploreIncrement: 0.2,
    wanderIncrement: 0.14,
  }),
  completionNeeds: Object.freeze({
    hunger: 0.34,
    thirst: 0.32,
    fatigue: 0.3,
    safety: 0.34,
    social: 0.38,
  }),
  actionAlignment: Object.freeze({
    "Find Food": Object.freeze({ eat: 0.42 }),
    "Find Water": Object.freeze({ drink: 0.46 }),
    Rest: Object.freeze({ rest: 0.36 }),
    "Return Home": Object.freeze({ rest: 0.18, observeEnvironment: 0.08, seekSafety: 0.06 }),
    "Gather Near Camp": Object.freeze({ communicate: 0.08, observeEnvironment: 0.04 }),
    "Defend Camp": Object.freeze({ seekSafety: 0.42, communicate: 0.04 }),
    "Seek Shelter": Object.freeze({ seekSafety: 0.34, rest: 0.08 }),
    Wander: Object.freeze({ explore: 0.04, observeEnvironment: 0.03 }),
    Explore: Object.freeze({ explore: 0.08, observeEnvironment: 0.04 }),
    Socialize: Object.freeze({ communicate: 0.08, observeHuman: 0.04 }),
    Observe: Object.freeze({ observeEnvironment: 0.08, observeHuman: 0.04 }),
    "Stay Near Family": Object.freeze({ communicate: 0.06, observeHuman: 0.04 }),
    "Help Other": Object.freeze({ communicate: 0.1, seekSafety: 0.08 }),
    Learn: Object.freeze({ teach: 0.02, observeHuman: 0.08, observeEnvironment: 0.03 }),
    Follow: Object.freeze({ communicate: 0.04, observeHuman: 0.04, explore: 0.04 }),
    "Seek Safety": Object.freeze({ seekSafety: 0.52 }),
    Escape: Object.freeze({ seekSafety: 0.64 }),
  } satisfies Record<HumanGoalType, Partial<Record<HumanActionType, number>>>),
});

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, round(value)));
}

function pressureAbove(value: number, threshold: number): number {
  return value <= threshold ? 0 : clamp01((value - threshold) / (1 - threshold));
}

function stableOffset(seed: string, tick: bigint, label: string): number {
  let hash = 2_166_136_261;
  const input = `${seed}:${tick.toString()}:goal:${label}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return ((hash >>> 0) % 10_000) / 1_000_000;
}

function stableAgentKey(agent: HumanAgent): string {
  return `human:${agent.sex}:generation-${agent.generation}`;
}

function stableTargetKey(context: ResolvedGoalDecisionContext, candidate: { readonly targetId?: string | null; readonly targetCellId?: string | null }): string {
  return (candidate.targetId ?? candidate.targetCellId ?? context.agent.currentCellId).replaceAll(`${context.worldId}:`, "");
}
function normalizeEnvironment(agent: HumanAgent, environment?: HumanGoalEnvironment): Required<HumanGoalEnvironment> {
  return {
    dangerScore: clamp01(environment?.dangerScore ?? agent.needs.safety),
    temperatureStress: clamp01(environment?.temperatureStress ?? 0),
    waterAvailability: clamp01(environment?.waterAvailability ?? knownResourceConfidence(agent, "nearby:water")),
    edibleFoodAvailability: clamp01(environment?.edibleFoodAvailability ?? knownResourceConfidence(agent, "nearby:food")),
    shelterAvailability: clamp01(environment?.shelterAvailability ?? (agent.familiarityByCell[agent.currentCellId] ?? 0.3)),
    weatherSeverity: clamp01(environment?.weatherSeverity ?? 0),
    timeOfDayPressure: clamp01(environment?.timeOfDayPressure ?? 0),
  };
}

function resolveContext(context: HumanGoalDecisionContext): ResolvedGoalDecisionContext {
  return {
    ...context,
    weights: context.weights ?? DEFAULT_GOAL_SCORING_WEIGHTS,
    environment: normalizeEnvironment(context.agent, context.environment),
  };
}

function knownResourceConfidence(agent: HumanAgent, beliefKey: "nearby:water" | "nearby:food"): number {
  return clamp01(agent.beliefs[beliefKey]?.confidence ?? 0.2);
}

type GoalMemoryInfluence = {
  foodConfidence: number;
  foodCellId: string | null;
  waterConfidence: number;
  waterCellId: string | null;
  shelterConfidence: number;
  shelterCellId: string | null;
  dangerConfidence: number;
  dangerCellId: string | null;
  navigationConfidence: number;
  relationshipConfidence: number;
};

function emptyMemoryInfluence(): GoalMemoryInfluence {
  return {
    foodConfidence: 0,
    foodCellId: null,
    waterConfidence: 0,
    waterCellId: null,
    shelterConfidence: 0,
    shelterCellId: null,
    dangerConfidence: 0,
    dangerCellId: null,
    navigationConfidence: 0,
    relationshipConfidence: 0,
  };
}

function memorySignal(memory: HumanMemory, agent: HumanAgent): number {
  const locationWeight = memory.locationCellId === agent.currentCellId ? 1 : 0.68;

  return clamp01(memory.confidence * 0.52 + memory.importance * 0.36 + memory.emotionalWeight * 0.12) * locationWeight;
}

function strongestByTag(context: ResolvedGoalDecisionContext, tag: string): { confidence: number; cellId: string | null } {
  const [memory] = recallRelevantMemories({
    agent: context.agent,
    memories: context.memories,
    memoryIndex: context.memoryIndex,
    tick: context.tick,
    trigger: { cellId: context.agent.currentCellId, tags: [tag], goalType: context.agent.currentGoal?.type ?? null },
    limit: 4,
  }).filter((entry) => entry.tags.includes(tag));

  return memory
    ? { confidence: memorySignal(memory, context.agent), cellId: memory.locationCellId }
    : { confidence: 0, cellId: null };
}

function goalMemoryInfluence(context: ResolvedGoalDecisionContext): GoalMemoryInfluence {
  const food = strongestByTag(context, "food");
  const water = strongestByTag(context, "water");
  const shelter = strongestByTag(context, "shelter");
  const danger = strongestByTag(context, "danger");
  const relationship = strongestByTag(context, "relationship");
  const knownWater = strongestKnowledgeByTag(context.knowledge ?? [], context.agent.id, "water");
  const knownFood = strongestKnowledgeByTag(context.knowledge ?? [], context.agent.id, "food");
  const knownShelter = strongestKnowledgeByTag(context.knowledge ?? [], context.agent.id, "shelter");
  const knownDanger = strongestKnowledgeByTag(context.knowledge ?? [], context.agent.id, "danger");
  const knownNavigation = strongestKnowledgeByTag(context.knowledge ?? [], context.agent.id, "navigation");

  return {
    foodConfidence: Math.max(food.confidence, knownFood ? knownFood.confidence * knownFood.mastery : 0),
    foodCellId: food.cellId,
    waterConfidence: Math.max(water.confidence, knownWater ? knownWater.confidence * knownWater.mastery : 0),
    waterCellId: water.cellId,
    shelterConfidence: Math.max(shelter.confidence, knownShelter ? knownShelter.confidence * knownShelter.mastery : 0),
    shelterCellId: shelter.cellId,
    dangerConfidence: Math.max(danger.confidence, knownDanger ? knownDanger.confidence * knownDanger.mastery : 0),
    dangerCellId: danger.cellId,
    navigationConfidence: knownNavigation ? knownNavigation.confidence * knownNavigation.mastery : 0,
    relationshipConfidence: relationship.confidence,
  };
}

function priorFailures(agent: HumanAgent, type: HumanGoalType): number {
  return agent.goalHistory.filter((entry) =>
    entry.goal.type === type && (entry.event === "Failed" || entry.event === "Interrupted")
  ).slice(-3).length;
}

function relationshipTo(
  relationships: readonly HumanRelationship[],
  fromAgentId: string,
  toAgentId: string,
): HumanRelationship | undefined {
  return relationships.find((relationship) =>
    relationship.fromAgentId === fromAgentId && relationship.toAgentId === toAgentId
  );
}

function relationshipsFrom(context: ResolvedGoalDecisionContext): HumanRelationship[] {
  return context.relationships.filter((relationship) => relationship.humanId === context.agent.id || relationship.fromAgentId === context.agent.id);
}

function relatedAgent(context: ResolvedGoalDecisionContext, relationship: HumanRelationship): HumanAgent | null {
  const targetId = relationship.targetHumanId ?? relationship.toAgentId;

  return context.agents.find((agent) => agent.id === targetId && agent.isAlive) ?? null;
}

function relationshipThreatPressure(context: ResolvedGoalDecisionContext): number {
  return relationshipsFrom(context).reduce((pressure, relationship) => {
    const target = relatedAgent(context, relationship);
    const sameCell = target?.currentCellId === context.agent.currentCellId ? 1 : 0.62;
    const threat = Math.max(
      relationship.status === "Threat" ? 1 : 0,
      relationship.fear,
      relationship.rivalry * 0.72,
    );

    return Math.max(pressure, clamp01(threat * sameCell));
  }, 0);
}

function relationshipRivalryPressure(context: ResolvedGoalDecisionContext): number {
  return relationshipsFrom(context).reduce((pressure, relationship) => {
    const target = relatedAgent(context, relationship);
    const sameCell = target?.currentCellId === context.agent.currentCellId ? 1 : 0.5;

    return Math.max(pressure, clamp01(Math.max(relationship.rivalry, relationship.status === "Rival" ? 0.72 : 0) * sameCell));
  }, 0);
}

function trustedCompanionTarget(context: ResolvedGoalDecisionContext): HumanAgent | null {
  const [entry] = relationshipsFrom(context)
    .map((relationship) => ({ relationship, target: relatedAgent(context, relationship) }))
    .filter((entry): entry is { relationship: HumanRelationship; target: HumanAgent } => Boolean(entry.target))
    .filter((entry) => entry.relationship.fear < 0.55 && entry.relationship.rivalry < 0.55)
    .sort((left, right) =>
      (right.relationship.trust + right.relationship.affection + right.relationship.familiarity) -
      (left.relationship.trust + left.relationship.affection + left.relationship.familiarity) ||
      left.target.id.localeCompare(right.target.id)
    );

  return entry?.target ?? companionTarget(context);
}

function companionTarget(context: ResolvedGoalDecisionContext): HumanAgent | null {
  return context.agents.find((agent) =>
    agent.id !== context.agent.id && agent.isAlive && agent.currentCellId === context.agent.currentCellId
  ) ?? null;
}

function familyTarget(context: ResolvedGoalDecisionContext): HumanAgent | null {
  const candidates = context.agents.filter((candidate) => candidate.id !== context.agent.id && candidate.isAlive);

  return candidates
    .map((candidate) => ({ candidate, relation: relationshipTo(context.relationships, context.agent.id, candidate.id) }))
    .filter((entry) => entry.relation && (entry.relation.kinship !== "none" || entry.relation.status === "Family"))
    .sort((left, right) =>
      ((right.relation?.affection ?? 0) + (right.relation?.trust ?? 0)) -
      ((left.relation?.affection ?? 0) + (left.relation?.trust ?? 0)) ||
      left.candidate.id.localeCompare(right.candidate.id)
    )[0]?.candidate ?? candidates[0] ?? null;
}

function candidate(input: {
  context: ResolvedGoalDecisionContext;
  type: HumanGoalType;
  priority: number;
  confidence: number;
  reason: HumanGoalReason;
  targetId?: string | null;
  targetCellId?: string | null;
  scoreInputs: Record<string, Prisma.InputJsonValue>;
}): HumanGoalCandidate {
  const failurePenalty = priorFailures(input.context.agent, input.type) * input.context.weights.knowledge.memoryFailurePenalty;
  const priority = round(Math.max(0, input.priority - failurePenalty + stableOffset(
    input.context.seed,
    input.context.tick,
    `${stableAgentKey(input.context.agent)}:${input.type}:${stableTargetKey(input.context, input)}`,
  )));

  return {
    type: input.type,
    priority,
    confidence: clamp01(input.confidence),
    reason: input.reason,
    targetId: input.targetId ?? null,
    targetCellId: input.targetCellId ?? input.context.agent.currentCellId,
    scoreInputs: {
      ...input.scoreInputs,
      failurePenalty,
    },
  };
}

function isPluginRelevant(
  pluginType: HumanGoalType,
  context: ResolvedGoalDecisionContext
): boolean {
  const danger = context.environment.dangerScore;
  const hunger = context.agent.needs.hunger;
  const thirst = context.agent.needs.thirst;
  const social = context.agent.needs.social;

  switch (pluginType) {
    case "Escape":
    case "Seek Safety":
    case "Defend Camp":
      return danger > 0.4 || context.agent.emotions.fear > 0.4;

    case "Find Food":
      return hunger > 0.35;

    case "Find Water":
      return thirst > 0.35;

    case "Socialize":
    case "Stay Near Family":
    case "Gather Near Camp":
      return social > 0.3;

    default:
      return true;
  }
}

export const HUMAN_GOAL_PLUGINS: readonly HumanGoalPlugin[] = Object.freeze([
  {
    type: "Defend Camp",
    createCandidate(context) {
      const home = context.agent.homeProfile;
      const homeCellId = home?.primaryHomeCellId ?? context.agent.homeCellId;
      const atHome = context.agent.currentCellId === homeCellId ? 1 : 0.65;
      const campAffinity = home?.cellAffinities[homeCellId] ?? context.agent.familiarityByCell[homeCellId] ?? 0.3;
      const danger = Math.max(context.environment.dangerScore, context.agent.needs.safety, context.agent.emotions.fear);

      if (danger < 0.54 || campAffinity < 0.34) {
        return null;
      }

      return candidate({
        context,
        type: "Defend Camp",
        reason: "Camp Threatened",
        priority: danger * context.weights.settlement.campDefense * atHome + campAffinity * context.weights.settlement.homeAffinity + context.agent.emotions.attachment * 0.18,
        confidence: clamp01(campAffinity * 0.5 + danger * 0.35 + atHome * 0.15),
        targetCellId: homeCellId,
        scoreInputs: { homeCellId, campAffinity, danger, atHome },
      });
    },
  },
  {
    type: "Return Home",
    createCandidate(context) {
      const home = context.agent.homeProfile;
      const homeCellId = home?.primaryHomeCellId ?? context.agent.homeCellId;
      const atHome = context.agent.currentCellId === homeCellId;
      const homeAffinity = home?.cellAffinities[homeCellId] ?? context.agent.familiarityByCell[homeCellId] ?? 0.3;
      const fatiguePull = context.agent.needs.fatigue * context.weights.settlement.returnHomeWhenTired;
      const safetyPull = context.agent.needs.safety * context.weights.settlement.returnHomeWhenUnsafe;
      const awayPull = atHome ? 0 : 0.36;
      const priority = homeAffinity * context.weights.settlement.homeAffinity + fatiguePull + safetyPull + awayPull + context.agent.emotions.attachment * 0.12;

      if (priority < 0.34) {
        return null;
      }

      return candidate({
        context,
        type: "Return Home",
        reason: "Returning Home",
        priority,
        confidence: clamp01(0.38 + homeAffinity * 0.46 + (atHome ? 0.08 : 0)),
        targetCellId: homeCellId,
        scoreInputs: { homeCellId, homeAffinity, fatiguePull, safetyPull, awayPull, atHome },
      });
    },
  },
  {
    type: "Gather Near Camp",
    createCandidate(context) {
      const home = context.agent.homeProfile;
      const gatheringCellId = home?.favoriteGatheringCellIds[0] ?? home?.primaryHomeCellId ?? context.agent.homeCellId;
      const affinity = home?.cellAffinities[gatheringCellId] ?? context.agent.familiarityByCell[gatheringCellId] ?? 0.25;
      const nearbyTrusted = relationshipsFrom(context).reduce((score, relationship) => {
        const target = relatedAgent(context, relationship);
        const samePlace = target?.currentCellId === gatheringCellId || target?.homeProfile?.primaryHomeCellId === gatheringCellId ? 1 : 0;

        return Math.max(score, samePlace * Math.max(relationship.trust, relationship.affection) * (1 - relationship.fear));
      }, 0);
      const overcrowdingPenalty = context.agents.filter((agent) => agent.currentCellId === gatheringCellId).length > 12
        ? context.weights.settlement.overcrowdingAvoidance
        : 0;
      const priority = affinity * context.weights.settlement.campGathering + nearbyTrusted * context.weights.relationships.trust + context.agent.needs.social * 0.18 - overcrowdingPenalty;

      if (priority < 0.28) {
        return null;
      }

      return candidate({
        context,
        type: "Gather Near Camp",
        reason: "Camp Comfort",
        priority,
        confidence: clamp01(0.34 + affinity * 0.38 + nearbyTrusted * 0.22),
        targetCellId: gatheringCellId,
        scoreInputs: { gatheringCellId, affinity, nearbyTrusted, overcrowdingPenalty },
      });
    },
  },  {
    type: "Escape",
    createCandidate(context) {
      const memory = goalMemoryInfluence(context);
      const relationshipThreat = relationshipThreatPressure(context);
      const danger = Math.max(context.agent.needs.safety, context.environment.dangerScore, memory.dangerConfidence, relationshipThreat);

      if (danger < 0.88) {
        return null;
      }

      return candidate({
        context,
        type: "Escape",
        reason: "Danger Nearby",
        priority: danger * context.weights.needs.safety + memory.dangerConfidence * context.weights.memory.danger + relationshipThreat * context.weights.relationships.threatAvoidance + context.agent.emotions.fear * 0.36,
        confidence: danger,
        targetCellId: memory.dangerCellId ?? context.agent.currentCellId,
        scoreInputs: { danger, rememberedDanger: memory.dangerConfidence, relationshipThreat, fear: context.agent.emotions.fear },
      });
    },
  },
  {
    type: "Seek Safety",
    createCandidate(context) {
      const memory = goalMemoryInfluence(context);
      const relationshipThreat = relationshipThreatPressure(context);
      const rivalryPressure = relationshipRivalryPressure(context);
      const danger = Math.max(context.agent.needs.safety, context.environment.dangerScore, context.environment.weatherSeverity, memory.dangerConfidence, relationshipThreat);
      const safetyUrgency = pressureAbove(danger, 0.48);
      const familiarGroup = relationshipsFrom(context).reduce((score, relationship) => {
        const target = relatedAgent(context, relationship);
        const sameCell = target?.currentCellId === context.agent.currentCellId ? 1 : 0;

        return Math.max(score, sameCell * relationship.familiarity * Math.max(relationship.trust, relationship.affection));
      }, 0);

      return candidate({
        context,
        type: "Seek Safety",
        reason: "Danger Nearby",
        priority: safetyUrgency * context.weights.needs.safety + memory.dangerConfidence * context.weights.memory.danger + relationshipThreat * context.weights.relationships.threatAvoidance + rivalryPressure * context.weights.relationships.rivalryAvoidance + familiarGroup * context.weights.relationships.familiarGroupWhenAfraid * context.agent.emotions.fear + context.agent.emotions.fear * 0.22,
        confidence: clamp01(danger * 0.7 + context.agent.emotions.fear * 0.3),
        targetCellId: memory.dangerCellId ?? context.agent.currentCellId,
        scoreInputs: { danger, rememberedDanger: memory.dangerConfidence, relationshipThreat, rivalryPressure, familiarGroup, safetyUrgency, fear: context.agent.emotions.fear },
      });
    },
  },
  {
    type: "Find Water",
    createCandidate(context) {
      const memory = goalMemoryInfluence(context);
      const knownWater = Math.max(knownResourceConfidence(context.agent, "nearby:water"), memory.waterConfidence);
      const thirstPressure = context.agent.needs.thirst;

      return candidate({
        context,
        type: "Find Water",
        reason: "Thirst",
        priority: thirstPressure * context.weights.needs.thirst + knownWater * context.weights.knowledge.knownWater + memory.waterConfidence * context.weights.memory.waterSource + context.environment.waterAvailability * context.weights.environment.waterAvailability,
        confidence: knownWater * 0.55 + context.environment.waterAvailability * 0.3 + (context.agent.familiarityByCell[context.agent.currentCellId] ?? 0.3) * 0.15,
        targetCellId: memory.waterCellId ?? context.agent.currentCellId,
        scoreInputs: { thirstPressure, knownWater, rememberedWater: memory.waterConfidence, waterAvailability: context.environment.waterAvailability },
      });
    },
  },
  {
    type: "Find Food",
    createCandidate(context) {
      const memory = goalMemoryInfluence(context);
      const knownFood = Math.max(knownResourceConfidence(context.agent, "nearby:food"), memory.foodConfidence);
      const hungerPressure = context.agent.needs.hunger;

      return candidate({
        context,
        type: "Find Food",
        reason: "Hungry",
        priority: hungerPressure * context.weights.needs.hunger + knownFood * context.weights.knowledge.knownFood + memory.foodConfidence * context.weights.memory.foodSource + context.environment.edibleFoodAvailability * context.weights.environment.edibleFoodAvailability,
        confidence: knownFood * 0.52 + context.environment.edibleFoodAvailability * 0.32 + (context.agent.familiarityByCell[context.agent.currentCellId] ?? 0.3) * 0.16,
        targetCellId: memory.foodCellId ?? context.agent.currentCellId,
        scoreInputs: { hungerPressure, knownFood, rememberedFood: memory.foodConfidence, edibleFoodAvailability: context.environment.edibleFoodAvailability },
      });
    },
  },
  {
    type: "Rest",
    createCandidate(context) {
      return candidate({
        context,
        type: "Rest",
        reason: "Tired",
        priority: context.agent.needs.fatigue * context.weights.needs.fatigue + context.agent.motivations.restVoluntary * context.weights.motivations.restVoluntary,
        confidence: clamp01(0.52 + context.agent.personality.patience * 0.24 - context.environment.dangerScore * 0.28),
        scoreInputs: { fatigue: context.agent.needs.fatigue, restVoluntary: context.agent.motivations.restVoluntary },
      });
    },
  },
  {
    type: "Seek Shelter",
    createCandidate(context) {
      const memory = goalMemoryInfluence(context);
      const rememberedShelter = Math.max(context.environment.shelterAvailability, memory.shelterConfidence);
      const shelterPressure = Math.max(context.environment.temperatureStress, context.environment.weatherSeverity, pressureAbove(context.agent.needs.safety, 0.55));

      return candidate({
        context,
        type: "Seek Shelter",
        reason: context.environment.temperatureStress > context.environment.weatherSeverity ? "Cold" : "Searching For Shelter",
        priority: shelterPressure * context.weights.environment.temperatureStress + rememberedShelter * context.weights.environment.shelterAvailability + memory.shelterConfidence * context.weights.memory.shelter,
        confidence: rememberedShelter,
        targetCellId: memory.shelterCellId ?? context.agent.currentCellId,
        scoreInputs: {
          shelterPressure,
          temperatureStress: context.environment.temperatureStress,
          weatherSeverity: context.environment.weatherSeverity,
          shelterAvailability: context.environment.shelterAvailability,
          rememberedShelter: memory.shelterConfidence,
        },
      });
    },
  },
  {
    type: "Stay Near Family",
    createCandidate(context) {
      const target = familyTarget(context);

      if (!target) {
        return null;
      }

      const relation = relationshipTo(context.relationships, context.agent.id, target.id);
      const sameCell = target.currentCellId === context.agent.currentCellId ? 1 : 0;
      const kinship = relation && relation.kinship !== "none" ? 1 : 0;
      const memory = goalMemoryInfluence(context);
      const trust = Math.max(relation?.trust ?? 0.45, memory.relationshipConfidence);
      const affection = relation?.affection ?? 0.42;
      const dependency = relation?.dependency ?? 0;

      return candidate({
        context,
        type: "Stay Near Family",
        reason: relation?.kinship === "parent" || relation?.kinship === "child" ? "Following Parent" : "Lonely",
        targetId: target.id,
        targetCellId: target.currentCellId,
        priority: context.agent.needs.social * context.weights.needs.social + sameCell * context.weights.relationships.sameCellCompanion + kinship * context.weights.relationships.kinship + affection * context.weights.relationships.familyBond + trust * context.weights.relationships.trust + dependency * context.weights.relationships.dependency,
        confidence: clamp01(0.46 + sameCell * 0.24 + trust * 0.2),
        scoreInputs: { social: context.agent.needs.social, sameCell, kinship, trust, affection, dependency },
      });
    },
  },
  {
    type: "Socialize",
    createCandidate(context) {
      const target = trustedCompanionTarget(context);

      if (!target) {
        return null;
      }

      const relation = relationshipTo(context.relationships, context.agent.id, target.id);
      const memory = goalMemoryInfluence(context);
      const trust = Math.max(relation?.trust ?? 0.45, memory.relationshipConfidence);
      const affection = relation?.affection ?? 0.42;
      const respect = relation?.respect ?? 0;
      const threatPenalty = (relation?.fear ?? 0) * context.weights.relationships.threatAvoidance;
      const rivalryPenalty = (relation?.rivalry ?? 0) * context.weights.relationships.rivalryAvoidance;

      return candidate({
        context,
        type: "Socialize",
        reason: "Lonely",
        targetId: target.id,
        targetCellId: target.currentCellId,
        priority: context.agent.needs.social * context.weights.needs.social + context.agent.motivations.socialize * context.weights.motivations.socialize + trust * context.weights.relationships.trust + affection * context.weights.relationships.affection + respect * context.weights.relationships.respectedHuman - threatPenalty - rivalryPenalty,
        confidence: clamp01(0.45 + trust * 0.25 + context.agent.personality.sociability * 0.18),
        scoreInputs: { social: context.agent.needs.social, socialize: context.agent.motivations.socialize, trust, affection, respect, threatPenalty, rivalryPenalty },
      });
    },
  },
  {
    type: "Explore",
    createCandidate(context) {
      const memory = goalMemoryInfluence(context);
      const relationshipThreat = relationshipThreatPressure(context);
      const rivalryPressure = relationshipRivalryPressure(context);

      return candidate({
        context,
        type: "Explore",
        reason: "Curiosity",
        priority: context.agent.motivations.explore * context.weights.motivations.explore + context.agent.curiosityProfile.noveltySeeking * 0.34 + memory.navigationConfidence * 0.16 - context.environment.dangerScore * 0.2 - memory.dangerConfidence * context.weights.memory.danger * 0.34 - relationshipThreat * context.weights.relationships.threatAvoidance * 0.38 - rivalryPressure * context.weights.relationships.rivalryAvoidance * 0.24,
        confidence: clamp01(context.agent.confidence + context.agent.curiosityProfile.riskTolerance * 0.34 + memory.navigationConfidence * 0.12),
        scoreInputs: {
          explore: context.agent.motivations.explore,
          noveltySeeking: context.agent.curiosityProfile.noveltySeeking,
          danger: context.environment.dangerScore,
          rememberedDanger: memory.dangerConfidence,
          knownNavigation: memory.navigationConfidence,
          relationshipThreat,
          rivalryPressure,
        },
      });
    },
  },
  {
    type: "Observe",
    createCandidate(context) {
      return candidate({
        context,
        type: "Observe",
        reason: "Staying Oriented",
        priority: context.agent.motivations.observeSurroundings * context.weights.motivations.observeSurroundings + context.agent.curiosityProfile.environmental * 0.28,
        confidence: clamp01((context.agent.familiarityByCell[context.agent.currentCellId] ?? 0.3) + 0.28),
        scoreInputs: {
          observeSurroundings: context.agent.motivations.observeSurroundings,
          environmentalCuriosity: context.agent.curiosityProfile.environmental,
        },
      });
    },
  },
  {
    type: "Wander",
    createCandidate(context) {
      const memory = goalMemoryInfluence(context);
      const relationshipThreat = relationshipThreatPressure(context);
      const rivalryPressure = relationshipRivalryPressure(context);

      return candidate({
        context,
        type: "Wander",
        reason: "Low Pressure",
        priority: 0.18 + context.agent.curiosityProfile.noveltySeeking * 0.12 - context.environment.dangerScore * 0.18 - memory.dangerConfidence * context.weights.memory.danger * 0.22 - relationshipThreat * context.weights.relationships.threatAvoidance * 0.26 - rivalryPressure * context.weights.relationships.rivalryAvoidance * 0.18,
        confidence: clamp01(0.36 + context.agent.confidence * 0.24),
        scoreInputs: { noveltySeeking: context.agent.curiosityProfile.noveltySeeking, danger: context.environment.dangerScore, rememberedDanger: memory.dangerConfidence, relationshipThreat, rivalryPressure },
      });
    },
  },
]);

function sortCandidates(candidates: readonly HumanGoalCandidate[]): HumanGoalCandidate[] {
  return [...candidates].sort((left, right) =>
    right.priority - left.priority || right.confidence - left.confidence || left.type.localeCompare(right.type)
  );
}

export function generateGoalCandidates(context: HumanGoalDecisionContext): HumanGoalCandidate[] {
  const resolved = resolveContext(context);

  return sortCandidates(HUMAN_GOAL_PLUGINS.flatMap((plugin) => {
    if (!isPluginRelevant(plugin.type, resolved)) {
      return [];
    }

    const candidate = plugin.createCandidate(resolved);

    return candidate ? [candidate] : [];
  }));
}

function goalIdFor(context: ResolvedGoalDecisionContext, candidate: HumanGoalCandidate): string {
  const typeKey = candidate.type.toLowerCase().replaceAll(" ", "-");
  const targetKey = candidate.targetId ?? candidate.targetCellId ?? context.agent.currentCellId;

  return `${context.agent.id}:goal:${context.tick.toString()}:${typeKey}:${targetKey}`;
}

function createGoal(context: ResolvedGoalDecisionContext, candidate: HumanGoalCandidate): HumanGoal {
  return {
    id: goalIdFor(context, candidate),
    type: candidate.type,
    priority: candidate.priority,
    createdTick: context.tick.toString(),
    targetId: candidate.targetId,
    targetCellId: candidate.targetCellId,
    progress: 0,
    confidence: candidate.confidence,
    reason: candidate.reason,
    status: "Active",
  };
}

function completedProgress(goal: HumanGoal, agent: HumanAgent, weights: typeof DEFAULT_GOAL_SCORING_WEIGHTS): number {
  switch (goal.type) {
    case "Find Food":
      return needGoalProgress(agent.needs.hunger, weights.completionNeeds.hunger);
    case "Find Water":
      return needGoalProgress(agent.needs.thirst, weights.completionNeeds.thirst);
    case "Rest":
    case "Return Home":
    case "Gather Near Camp":
      return needGoalProgress(agent.needs.fatigue, weights.completionNeeds.fatigue);
    case "Seek Shelter":
    case "Defend Camp":
    case "Seek Safety":
    case "Escape":
      return needGoalProgress(agent.needs.safety, weights.completionNeeds.safety);
    case "Socialize":
    case "Gather Near Camp":
    case "Stay Near Family":
    case "Help Other":
    case "Learn":
    case "Follow":
      return needGoalProgress(agent.needs.social, weights.completionNeeds.social);
    case "Observe":
      return clamp01(goal.progress + weights.progress.observeIncrement);
    case "Explore":
      return clamp01(goal.progress + weights.progress.exploreIncrement);
    case "Wander":
      return clamp01(goal.progress + weights.progress.wanderIncrement);
    default:
      return clamp01(goal.progress + weights.progress.passiveIncrement);
  }
}

function goalWithProgress(goal: HumanGoal, agent: HumanAgent, weights: typeof DEFAULT_GOAL_SCORING_WEIGHTS): HumanGoal {
  const progress = completedProgress(goal, agent, weights);

  return {
    ...goal,
    progress,
    status: progress >= weights.continuity.completionProgress ? "Completed" : "Active",
  };
}

function needGoalProgress(value: number, threshold: number): number {
  if (value <= threshold) {
    return 1;
  }

  return clamp01((1 - value) / (1 - threshold));
}
function targetInvalid(goal: HumanGoal, agents: readonly HumanAgent[]): boolean {
  if (!goal.targetId) {
    return false;
  }

  const target = agents.find((agent) => agent.id === goal.targetId);

  return !target || !target.isAlive;
}

function appendHistory(
  history: readonly HumanGoalHistoryEntry[],
  tick: bigint,
  goal: HumanGoal,
  event: GoalLifecycleEvent,
  previousGoalId: string | null,
): HumanGoalHistoryEntry[] {
  return [
    ...history,
    {
      goal,
      tick: tick.toString(),
      event,
      reason: goal.reason,
      previousGoalId,
    },
  ].slice(-GOAL_HISTORY_LIMIT);
}

function eventTypeFor(event: GoalLifecycleEvent): string {
  switch (event) {
    case "Started":
      return HUMAN_GOAL_EVENT_TYPES.started;
    case "Completed":
      return HUMAN_GOAL_EVENT_TYPES.completed;
    case "Failed":
      return HUMAN_GOAL_EVENT_TYPES.failed;
    case "Interrupted":
      return HUMAN_GOAL_EVENT_TYPES.interrupted;
    case "Changed":
      return HUMAN_GOAL_EVENT_TYPES.changed;
  }
}

function goalEvent(input: {
  context: ResolvedGoalDecisionContext;
  event: GoalLifecycleEvent;
  goal: HumanGoal;
  previousGoal?: HumanGoal | null;
  candidate?: HumanGoalCandidate | null;
}): HumanCausalEvent {
  const type = eventTypeFor(input.event);
  const previousGoal = input.previousGoal ?? null;
  const titleGoal = input.goal.type;
  const summary = input.event === "Started"
    ? `${input.context.agent.sex} human started goal ${titleGoal} because ${input.goal.reason}.`
    : input.event === "Completed"
      ? `${input.context.agent.sex} human completed goal ${titleGoal}.`
      : input.event === "Failed"
        ? `${input.context.agent.sex} human failed goal ${titleGoal} because its target was no longer valid.`
        : input.event === "Interrupted"
          ? `${input.context.agent.sex} human interrupted goal ${previousGoal?.type ?? titleGoal} because ${input.goal.reason}.`
          : `${input.context.agent.sex} human changed goal from ${previousGoal?.type ?? "none"} to ${titleGoal} because ${input.goal.reason}.`;

  return {
    id: `${input.context.worldId}:human-goal-event:${input.context.tick.toString()}:${input.event.toLowerCase()}:${input.context.agent.id}:${input.goal.id}`,
    worldId: input.context.worldId,
    tick: input.context.tick.toString(),
    type,
    title: type,
    summary,
    agentIds: [input.context.agent.id],
    cellId: input.goal.targetCellId ?? input.context.agent.currentCellId,
    causes: {
      goalType: input.goal.type,
      reason: input.goal.reason,
      priority: input.goal.priority,
      confidence: input.goal.confidence,
      previousGoalId: previousGoal?.id ?? "none",
      previousGoalType: previousGoal?.type ?? "none",
      scoreInputs: input.candidate?.scoreInputs ?? {},
    },
    effects: {
      goal: { ...input.goal },
      previousGoal: previousGoal ? { ...previousGoal } : "none",
    },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: true,
  };
}

function chooseBestCandidate(candidates: readonly HumanGoalCandidate[]): HumanGoalCandidate {
  return candidates[0] ?? {
    type: "Wander",
    priority: 0,
    confidence: 0.3,
    reason: "Low Pressure",
    targetId: null,
    targetCellId: null,
    scoreInputs: { fallback: "no generated candidates" },
  };
}

function isInterruptCandidate(candidate: HumanGoalCandidate): boolean {
  return candidate.type === "Escape" || candidate.type === "Seek Safety";
}

export function evaluateGoalDecision(context: HumanGoalDecisionContext): HumanGoalDecisionResult {
  const resolved = resolveContext(context);
  const candidates = generateGoalCandidates(resolved);
  const bestCandidate = chooseBestCandidate(candidates);
  const events: HumanCausalEvent[] = [];
  let history = [...context.agent.goalHistory];
  let currentGoal = context.agent.currentGoal
    ? goalWithProgress(context.agent.currentGoal, context.agent, resolved.weights)
    : null;

  if (currentGoal?.status === "Completed") {
    history = appendHistory(history, context.tick, currentGoal, "Completed", null);
    events.push(goalEvent({ context: resolved, event: "Completed", goal: currentGoal }));
    currentGoal = null;
  }

  if (currentGoal && targetInvalid(currentGoal, context.agents)) {
    const failedGoal: HumanGoal = { ...currentGoal, status: "Failed" };

    history = appendHistory(history, context.tick, failedGoal, "Failed", null);
    events.push(goalEvent({ context: resolved, event: "Failed", goal: failedGoal }));
    currentGoal = null;
  }

  if (!currentGoal) {
    const nextGoal = createGoal(resolved, bestCandidate);

    history = appendHistory(history, context.tick, nextGoal, "Started", null);
    events.push(goalEvent({ context: resolved, event: "Started", goal: nextGoal, candidate: bestCandidate }));

    return {
      agent: {
        ...context.agent,
        currentGoal: nextGoal,
        goalHistory: history,
      },
      events,
      candidates,
    };
  }

  const priorityGap = bestCandidate.priority - currentGoal.priority;
  const shouldInterrupt = isInterruptCandidate(bestCandidate) && priorityGap > resolved.weights.continuity.interruptionMargin;
  const shouldChange = priorityGap > resolved.weights.continuity.persistenceMargin;

  if (shouldInterrupt || shouldChange) {
    const previousGoal: HumanGoal = {
      ...currentGoal,
      status: shouldInterrupt ? "Interrupted" : "Interrupted",
    };
    const nextGoal = createGoal(resolved, bestCandidate);
    const lifecycleEvent: GoalLifecycleEvent = shouldInterrupt ? "Interrupted" : "Changed";

    history = appendHistory(history, context.tick, previousGoal, shouldInterrupt ? "Interrupted" : "Changed", previousGoal.id);
    history = appendHistory(history, context.tick, nextGoal, "Started", previousGoal.id);
    events.push(goalEvent({ context: resolved, event: lifecycleEvent, goal: nextGoal, previousGoal, candidate: bestCandidate }));
    events.push(goalEvent({ context: resolved, event: "Started", goal: nextGoal, previousGoal, candidate: bestCandidate }));

    return {
      agent: {
        ...context.agent,
        currentGoal: nextGoal,
        goalHistory: history,
      },
      events,
      candidates,
    };
  }

  return {
    agent: {
      ...context.agent,
      currentGoal,
      goalHistory: history,
    },
    events,
    candidates,
  };
}

export function goalTypeToAction(type: HumanGoalType): HumanActionType {
  switch (type) {
    case "Find Food":
      return "eat";
    case "Find Water":
      return "drink";
    case "Rest":
    case "Return Home":
      return "rest";
    case "Seek Shelter":
    case "Defend Camp":
    case "Seek Safety":
    case "Escape":
      return "seekSafety";
    case "Socialize":
    case "Gather Near Camp":
    case "Stay Near Family":
    case "Help Other":
    case "Follow":
      return "communicate";
    case "Learn":
      return "observeHuman";
    case "Observe":
      return "observeEnvironment";
    case "Explore":
    case "Wander":
      return "explore";
  }
}

export function getActionBiasForGoal(goal: HumanGoal | null, action: HumanActionType): number {
  if (!goal || goal.status !== "Active") {
    return 0;
  }

  const alignment = DEFAULT_GOAL_SCORING_WEIGHTS.actionAlignment[goal.type] as Partial<Record<HumanActionType, number>>;

  return alignment[action] ?? 0;
}

export function isHumanGoalEvent(event: Pick<HumanCausalEvent, "type">): boolean {
  return Object.values(HUMAN_GOAL_EVENT_TYPES).includes(event.type as typeof HUMAN_GOAL_EVENT_TYPES[keyof typeof HUMAN_GOAL_EVENT_TYPES]);
}
