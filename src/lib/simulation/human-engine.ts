import type { Prisma } from "@prisma/client";

import { createChroniclerReport } from "./chronicler";
import { createHumanCommunication, updateCommunicationEngine } from "./human-communication";
import { evaluateGoalDecision } from "./human-goals";
import { createActionCandidates, selectHumanDecision } from "./human-decisions";
import { updateKnowledgeEngine } from "./human-knowledge";
import { createHumanMemoryIndex, updateEpisodicMemories } from "./human-memory";
import { buildHumanMovementEnvironment, updateHumanMovements } from "./human-movement";
import {
  createInitialRelationships,
  updateRelationshipEngine,
  updateRelationshipForInteraction,
} from "./human-relationships";
import { computeMotivations, initialCuriosityProfile, updateCuriosityProfile } from "./human-motivations";
import {
  FIRST_HUMAN_AGE_YEARS,
  FIRST_HUMAN_START_CELL_ID,
  HUMAN_ADULT_AGE_YEARS,
  HUMAN_MVA_DAY_TICKS,
  type HumanAgeStage,
  type HumanAgent,
  type HumanBeliefDictionary,
  type HumanCausalEvent,
  type HumanCommunicationRecord,
  type HumanCommunicationSystemEvent,
  type HumanMemorySystemEvent,
  type HumanEmotionState,
  type HumanKnowledgeSystemEvent,
  type HumanMotivations,
  type HumanMvaState,
  type HumanNeedKey,
  type HumanNeeds,
  type HumanPersonality,
  type HumanRelationship,
  type HumanRelationshipSystemEvent,
  type HumanTheoryOfMindEstimate,
  type HumanTeachingRecord,
  type HumanTickResult,
} from "./human-types";
import { createDeterministicRandom } from "./random";
import { applyHomeProfilesToAgents, createHomeProfile } from "./settlement-engine";

type HumanWorldSource = {
  id: string;
  seed?: string | null;
};

type MutableTickState = {
  agents: HumanAgent[];
  relationships: HumanRelationship[];
  events: HumanCausalEvent[];
  communications: HumanCommunicationRecord[];
  teachingAttempts: HumanTeachingRecord[];
};

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, round(value)));
}

function pressureAbove(value: number, threshold: number): number {
  if (value <= threshold) {
    return 0;
  }

  return clamp01((value - threshold) / (1 - threshold));
}

function ageStageForYears(years: number): HumanAgeStage {
  if (years < 2) {
    return "Infant";
  }

  if (years < 12) {
    return "Child";
  }

  if (years < HUMAN_ADULT_AGE_YEARS) {
    return "Adolescent";
  }

  if (years >= 60) {
    return "Elder";
  }

  return "Adult";
}

function createPersonality(seed: string, tick: bigint, label: string): HumanPersonality {
  const random = createDeterministicRandom({ worldSeed: seed, tick, systemName: `human-personality:${label}` });

  return {
    boldness: round(random.float(0.42, 0.68)),
    sociability: round(random.float(0.48, 0.72)),
    curiosity: round(random.float(0.5, 0.76)),
    patience: round(random.float(0.38, 0.65)),
    empathy: round(random.float(0.48, 0.74)),
    riskTolerance: round(random.float(0.35, 0.62)),
    teachAffinity: round(random.float(0.42, 0.7)),
  };
}

function initialNeeds(): HumanNeeds {
  return {
    hunger: 0.34,
    thirst: 0.32,
    fatigue: 0.26,
    safety: 0.18,
    social: 0.58,
  };
}

function initialEmotions(): HumanEmotionState {
  return {
    fear: 0.16,
    distress: 0.12,
    comfort: 0.45,
    curiosity: 0.55,
    trust: 0.42,
    attachment: 0.2,
    loneliness: 0.38,
    relief: 0.2,
  };
}

function initialBeliefs(tick: bigint): HumanBeliefDictionary {
  return {
    "self:alive": {
      claim: "I am alive in this place.",
      confidence: 1,
      valence: 0.7,
      lastUpdatedTick: tick.toString(),
    },
    "nearby:water": {
      claim: "Water may be found nearby.",
      confidence: 0.62,
      valence: 0.65,
      lastUpdatedTick: tick.toString(),
    },
    "nearby:food": {
      claim: "Food may be found nearby.",
      confidence: 0.58,
      valence: 0.62,
      lastUpdatedTick: tick.toString(),
    },
  };
}

function createHumanAgent(
  worldId: string,
  seed: string,
  tick: bigint,
  sex: "male" | "female",
  index: number,
  cellId: string,
): HumanAgent {
  const ageDays = FIRST_HUMAN_AGE_YEARS * 365 + index * 11;

  return {
    id: `${worldId}:first-human-${sex}`,
    worldId,
    sex,
    isAlive: true,
    birthTick: (tick - BigInt(ageDays)).toString(),
    ageDays,
    approxAgeYears: round(ageDays / 365),
    currentCellId: cellId,
    previousCellId: null,
    destinationCellId: cellId,
    movementIntent: "stay",
    movementReason: "newly spawned",
    lastMovedTick: null,
    recentPath: [cellId],
    stuckTicks: 0,
    distanceTraveled: 0,
    explorationCount: 0,
    homeCellId: cellId,
    homeProfile: createHomeProfile(cellId, tick),
    motherId: null,
    fatherId: null,
    generation: 0,
    biologicalParentIds: [],
    guardianIds: [],
    childIds: [],
    siblingIds: [],
    mateId: null,
    familyId: `${worldId}:family:first-humans`,
    lineageId: `${worldId}:lineage:first-humans`,
    ageStage: ageStageForYears(round(ageDays / 365)),
    birthplaceCellId: cellId,
    birthplaceSettlementId: null,
    inheritedHomeCellId: cellId,
    inheritedSettlementId: null,
    ancestryTags: ["founding-generation", `birthplace:${cellId}`],
    familyHistory: [{ tick: tick.toString(), type: "Lineage Established", summary: "A founding adult began a traceable lineage.", relatedHumanIds: [], settlementId: null }],
    needs: initialNeeds(),
    emotions: initialEmotions(),
    curiosityProfile: initialCuriosityProfile(0.5, seed),
    motivations: {
      explore: 0,
      learn: 0,
      socialize: 0,
      restVoluntary: 0,
      improveShelter: 0,
      observeSurroundings: 0,
      practiceSkills: 0,
      teach: 0,
      collectObjects: 0,
    } as HumanMotivations,
    confidence: 0.2,
    familiarityByCell: { [cellId]: 0.5 },
    safetyStreak: 0,
    currentGoal: null,
    goalHistory: [],
    personality: createPersonality(seed, tick, sex),
    beliefs: initialBeliefs(tick),
    theoryOfMind: {},
    lastDecision: null,
  };
}

export function spawnFirstTwoHumans(
  world: HumanWorldSource,
  tick: bigint = 0n,
  cellId = FIRST_HUMAN_START_CELL_ID,
): HumanMvaState {
  const seed = world.seed?.trim() || "first-dawn-human-mva";
  const agents = [
    createHumanAgent(world.id, seed, tick, "male", 0, cellId),
    createHumanAgent(world.id, seed, tick, "female", 1, cellId),
  ];

  return {
    worldId: world.id,
    tick: tick.toString(),
    agents,
    relationships: createInitialRelationships(agents),
    memories: [],
    communications: [],
    teachingAttempts: [],
    knowledge: [],
    causalEvents: [],
  };
}

function updateNeeds(needs: HumanNeeds): HumanNeeds {
  return {
    hunger: clamp01(needs.hunger + 0.045),
    thirst: clamp01(needs.thirst + 0.065),
    fatigue: clamp01(needs.fatigue + 0.04),
    safety: clamp01(needs.safety + 0.005),
    social: clamp01(needs.social + 0.03),
  };
}

function reduceNeed(needs: HumanNeeds, key: HumanNeedKey, amount: number): HumanNeeds {
  return {
    ...needs,
    [key]: clamp01(needs[key] - amount),
  };
}

function updateEmotions(agent: HumanAgent): HumanEmotionState {
  const severeThreatPressure = clamp01(
    pressureAbove(agent.needs.safety, 0.66) * 0.62 +
    pressureAbove(agent.needs.thirst, 0.82) * 0.22 +
    pressureAbove(agent.needs.hunger, 0.86) * 0.16 +
    pressureAbove(agent.needs.fatigue, 0.9) * 0.08,
  );
  const ordinaryStrain = clamp01(
    agent.needs.hunger * 0.11 +
    agent.needs.thirst * 0.13 +
    agent.needs.fatigue * 0.09 +
    agent.needs.social * 0.03,
  );
  const severeStrain = clamp01(
    pressureAbove(agent.needs.hunger, 0.68) * 0.2 +
    pressureAbove(agent.needs.thirst, 0.64) * 0.26 +
    pressureAbove(agent.needs.fatigue, 0.78) * 0.12 +
    pressureAbove(agent.needs.safety, 0.68) * 0.24,
  );
  const targetDistress = clamp01(ordinaryStrain + severeStrain - agent.emotions.relief * 0.08);
  // Situational fear with confidence and familiarity
  const familiarity = agent.familiarityByCell[agent.currentCellId] ?? 0.3;
  const baseSafeRecovery = agent.needs.safety < 0.42 && targetDistress < 0.48
    ? 0.028 + agent.emotions.comfort * 0.03 + agent.emotions.relief * 0.02 + agent.emotions.trust * 0.01
    : 0.012;
  const confidenceBonus = agent.confidence * 0.06 + familiarity * 0.05 + Math.min(0.04, agent.safetyStreak * 0.002);
  const safeRecovery = baseSafeRecovery + confidenceBonus;
  const fearGrowth = severeThreatPressure > 0
    ? severeThreatPressure * Math.max(0.08, 0.2 - (agent.confidence * 0.08 + familiarity * 0.06))
    : 0;
  const nextFear = clamp01(agent.emotions.fear + fearGrowth - safeRecovery);
  const nextDistress = clamp01(agent.emotions.distress * 0.35 + targetDistress * 0.65);
  const targetComfort = clamp01(0.34 + agent.emotions.relief * 0.18 + agent.emotions.trust * 0.08 - nextDistress * 0.18 - severeThreatPressure * 0.28);
  const fearCuriosityBrake = nextFear > 0.72 ? nextFear * 0.08 : nextFear * 0.025;
  const distressCuriosityBrake = nextDistress > 0.72 ? nextDistress * 0.07 : nextDistress * 0.02;
  const profile = agent.curiosityProfile;
  const profileAggregate = clamp01((profile.environmental + profile.social + profile.technical + profile.noveltySeeking) / 4);

  return {
    ...agent.emotions,
    fear: nextFear,
    distress: nextDistress,
    comfort: clamp01(agent.emotions.comfort * 0.72 + targetComfort * 0.28),
    loneliness: clamp01(agent.needs.social * 0.8),
    // Aggregate curiosity derived from profile and affect
    curiosity: clamp01(profileAggregate * 0.75 + agent.personality.curiosity * 0.12 + agent.emotions.comfort * 0.06 - fearCuriosityBrake - distressCuriosityBrake - agent.needs.fatigue * 0.02),
    relief: clamp01(agent.emotions.relief * 0.92),
  };
}

function otherAgents(agent: HumanAgent, agents: readonly HumanAgent[]): HumanAgent[] {
  return agents.filter((other) => other.id !== agent.id);
}

function relationshipFor(
  relationships: readonly HumanRelationship[],
  fromAgentId: string,
  toAgentId: string,
): HumanRelationship | undefined {
  return relationships.find((relationship) =>
    relationship.fromAgentId === fromAgentId && relationship.toAgentId === toAgentId,
  );
}

function replaceRelationship(
  relationships: readonly HumanRelationship[],
  replacement: HumanRelationship,
): HumanRelationship[] {
  return relationships.map((relationship) =>
    relationship.fromAgentId === replacement.fromAgentId && relationship.toAgentId === replacement.toAgentId
      ? replacement
      : relationship,
  );
}

function causalEvent(input: {
  worldId: string;
  tick: bigint;
  type: string;
  title: string;
  summary: string;
  agentIds: string[];
  cellId: string;
  causes: Record<string, Prisma.InputJsonValue>;
  effects: Record<string, Prisma.InputJsonValue>;
}): HumanCausalEvent {
  const stableEventId = [
    input.worldId,
    "human-event",
    input.tick.toString(),
    input.type.toLowerCase().replaceAll(" ", "-"),
    input.agentIds.join("-"),
  ].join(":");

  return {
    id: stableEventId,
    worldId: input.worldId,
    tick: input.tick.toString(),
    type: input.type,
    title: input.title,
    summary: input.summary,
    agentIds: input.agentIds,
    cellId: input.cellId,
    causes: input.causes,
    effects: input.effects,
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: false,
  };
}

function relationshipSystemEventToCausalEvent(event: HumanRelationshipSystemEvent, agentById: ReadonlyMap<string, HumanAgent>): HumanCausalEvent {
  const agent = agentById.get(event.humanId);

  return causalEvent({
    worldId: event.worldId,
    tick: BigInt(event.tick),
    type: "Human Relationship Event",
    title: event.kind,
    summary: event.summary,
    agentIds: [event.humanId, event.targetHumanId],
    cellId: agent?.currentCellId ?? "unknown-cell",
    causes: {
      sourceEventId: event.sourceEventId ?? "none",
      previousStatus: event.previousStatus ?? "none",
    },
    effects: {
      relationshipEventId: event.id,
      status: event.status,
      score: event.score,
    },
  });
}

function communicationSystemEventToCausalEvent(event: HumanCommunicationSystemEvent, agents: readonly HumanAgent[]): HumanCausalEvent {
  const sender = agents.find((agent) => agent.id === event.senderHumanId);

  return causalEvent({
    worldId: event.worldId,
    tick: BigInt(event.tick),
    type: "Human Communication Event",
    title: event.kind,
    summary: event.summary,
    agentIds: [event.senderHumanId, ...event.receiverHumanIds].sort(),
    cellId: sender?.currentCellId ?? "unknown-cell",
    causes: {
      communicationId: event.communicationId,
      communicationType: event.type,
      topic: event.topic,
    },
    effects: {
      successRate: event.successRate,
      importance: event.importance,
      communicationKind: event.kind,
    },
  });
}
function applyDecision(agent: HumanAgent, state: MutableTickState, tick: bigint, seed: string): HumanAgent {
  const target = agent.lastDecision?.targetAgentId
    ? state.agents.find((candidate) => candidate.id === agent.lastDecision?.targetAgentId)
    : undefined;
  const decision = agent.lastDecision;

  if (!decision) {
    return agent;
  }

  if (decision.action === "drink") {
    const nextAgent = {
      ...agent,
      needs: reduceNeed(agent.needs, "thirst", 0.42),
      emotions: {
        ...agent.emotions,
        distress: clamp01(agent.emotions.distress - 0.18),
        fear: clamp01(agent.emotions.fear - 0.025),
        comfort: clamp01(agent.emotions.comfort + 0.035),
        relief: clamp01(agent.emotions.relief + 0.22),
      },
    };
    state.events.push(causalEvent({
      worldId: agent.worldId,
      tick,
      type: "Human Need Fulfilled",
      title: "Human Drank Water",
      summary: `${agent.sex} human reduced thirst by finding water.`,
      agentIds: [agent.id],
      cellId: agent.currentCellId,
      causes: decision.causes,
      effects: { thirstAfter: nextAgent.needs.thirst },
    }));
    return nextAgent;
  }

  if (decision.action === "eat") {
    const nextAgent = {
      ...agent,
      needs: reduceNeed(agent.needs, "hunger", 0.36),
      emotions: {
        ...agent.emotions,
        distress: clamp01(agent.emotions.distress - 0.14),
        fear: clamp01(agent.emotions.fear - 0.015),
        comfort: clamp01(agent.emotions.comfort + 0.025),
        relief: clamp01(agent.emotions.relief + 0.18),
      },
    };
    state.events.push(causalEvent({
      worldId: agent.worldId,
      tick,
      type: "Human Need Fulfilled",
      title: "Human Ate Food",
      summary: `${agent.sex} human reduced hunger by gathering edible food.`,
      agentIds: [agent.id],
      cellId: agent.currentCellId,
      causes: decision.causes,
      effects: { hungerAfter: nextAgent.needs.hunger },
    }));
    return nextAgent;
  }

  if (decision.action === "seekSafety") {
    const safetyCheckScore = clamp01(
      agent.personality.boldness * 0.32 +
      agent.personality.riskTolerance * 0.22 +
      agent.emotions.comfort * 0.22 +
      (1 - agent.emotions.fear) * 0.16 +
      agent.emotions.trust * 0.08,
    );
    const failedSafetyCheck = agent.needs.safety > 0.72 && safetyCheckScore < agent.needs.safety;
    const nextAgent = failedSafetyCheck
      ? {
        ...agent,
        needs: reduceNeed(agent.needs, "safety", 0.08),
        emotions: {
          ...agent.emotions,
          fear: clamp01(agent.emotions.fear + 0.24),
          distress: clamp01(agent.emotions.distress + 0.14),
          comfort: clamp01(agent.emotions.comfort - 0.08),
          relief: clamp01(agent.emotions.relief * 0.85),
        },
        confidence: clamp01(agent.confidence * 0.96),
        safetyStreak: 0,
      }
      : {
        ...agent,
        needs: reduceNeed(agent.needs, "safety", 0.36),
        emotions: {
          ...agent.emotions,
          fear: clamp01(agent.emotions.fear - 0.12),
          distress: clamp01(agent.emotions.distress - 0.08),
          comfort: clamp01(agent.emotions.comfort + 0.08),
          relief: clamp01(agent.emotions.relief + 0.2),
        },
        confidence: clamp01(agent.confidence + 0.05),
        familiarityByCell: {
          ...agent.familiarityByCell,
          [agent.currentCellId]: clamp01((agent.familiarityByCell[agent.currentCellId] ?? 0.3) + 0.06),
        },
      };

    state.events.push(causalEvent({
      worldId: agent.worldId,
      tick,
      type: failedSafetyCheck ? "Human Safety Check Failed" : "Human Safety Secured",
      title: failedSafetyCheck ? "Human Failed Safety Check" : "Human Found Safer Ground",
      summary: failedSafetyCheck
        ? `${agent.sex} human perceived a serious threat and failed to settle safely.`
        : `${agent.sex} human checked the surroundings and settled into a safer position.`,
      agentIds: [agent.id],
      cellId: agent.currentCellId,
      causes: {
        ...decision.causes,
        safetyCheckScore,
      },
      effects: {
        safetyAfter: nextAgent.needs.safety,
        fearAfter: nextAgent.emotions.fear,
        failedSafetyCheck,
      },
    }));

    return nextAgent;
  }

  if (decision.action === "rest") {
    return {
      ...agent,
      needs: reduceNeed(agent.needs, "fatigue", 0.28),
      emotions: {
        ...agent.emotions,
        distress: clamp01(agent.emotions.distress - 0.05),
        comfort: clamp01(agent.emotions.comfort + 0.08),
        relief: clamp01(agent.emotions.relief + 0.04),
      },
      confidence: clamp01(agent.confidence + 0.005),
    };
  }

  if (decision.action === "communicate" && target) {
    const communication = createHumanCommunication({
      worldId: agent.worldId,
      seed,
      tick,
      sender: agent,
      receivers: [target],
      relationships: state.relationships,
      type: "Greeting",
      topic: "companionship",
      communicationMethod: agent.emotions.distress > 0.55 ? "Cry" : "Vocal Sound",
      targetMode: "one-citizen",
      clarity: 0.62 + agent.personality.sociability * 0.16,
      confidence: 0.62 + agent.personality.sociability * 0.2,
      emotionalWeight: agent.emotions.distress > 0.55 ? 0.72 : 0.42,
    });
    const currentRelationship = relationshipFor(state.relationships, agent.id, target.id);

    if (currentRelationship) {
      state.relationships = replaceRelationship(
        state.relationships,
        updateRelationshipForInteraction(currentRelationship, "communication", tick),
      );
    }

    state.communications.push(communication);
    state.events.push(causalEvent({
      worldId: agent.worldId,
      tick,
      type: "Human Communication",
      title: "First Humans Communicated",
      summary: `${agent.sex} human communicated companionship to the other adult.`,
      agentIds: [agent.id, target.id],
      cellId: agent.currentCellId,
      causes: decision.causes,
      effects: {
        communicationId: communication.id,
        communicationType: communication.type,
        accepted: communication.accepted,
        understood: communication.understood,
        listener: target.id,
      },
    }));

    return {
      ...agent,
      needs: reduceNeed(agent.needs, "social", 0.22),
      beliefs: {
        ...agent.beliefs,
        [`communication:${target.id}`]: {
          claim: "The other human can understand simple intent.",
          confidence: communication.understandingScore,
          valence: 0.68,
          lastUpdatedTick: tick.toString(),
        },
      },
      emotions: {
        ...agent.emotions,
        trust: clamp01(agent.emotions.trust + 0.04),
        attachment: clamp01(agent.emotions.attachment + 0.05),
        loneliness: clamp01(agent.emotions.loneliness - 0.16),
      },
      confidence: clamp01(agent.confidence + 0.01),
    };
  }
  if (decision.action === "teach" && target) {
    const communication = createHumanCommunication({
      worldId: agent.worldId,
      seed,
      tick,
      sender: agent,
      receivers: [target],
      relationships: state.relationships,
      type: "Teaching",
      topic: "nearby water",
      communicationMethod: "Gesture",
      targetMode: "one-citizen",
      clarity: 0.56 + agent.personality.teachAffinity * 0.18,
      confidence: 0.58 + agent.personality.teachAffinity * 0.24,
      emotionalWeight: 0.42,
    });
    const currentRelationship = relationshipFor(state.relationships, agent.id, target.id);

    if (currentRelationship) {
      state.relationships = replaceRelationship(
        state.relationships,
        updateRelationshipForInteraction(currentRelationship, "teaching", tick),
      );
    }

    state.communications.push(communication);
    state.events.push(causalEvent({
      worldId: agent.worldId,
      tick,
      type: "Human Teaching",
      title: "Human Attempted Teaching",
      summary: `${agent.sex} human tried to teach the other adult about nearby water.`,
      agentIds: [agent.id, target.id],
      cellId: agent.currentCellId,
      causes: decision.causes,
      effects: {
        communicationId: communication.id,
        accepted: communication.accepted,
        successScore: communication.receptions[0]?.acceptanceScore ?? 0,
      },
    }));

    return agent;
  }
  if (decision.action === "observeEnvironment") {
    const nextAgent = {
      ...agent,
      emotions: {
        ...agent.emotions,
        comfort: clamp01(agent.emotions.comfort + 0.015),
        relief: clamp01(agent.emotions.relief + 0.01),
      },
      curiosityProfile: {
        ...agent.curiosityProfile,
        environmental: clamp01(agent.curiosityProfile.environmental + 0.02),
      },
      familiarityByCell: {
        ...agent.familiarityByCell,
        [agent.currentCellId]: clamp01((agent.familiarityByCell[agent.currentCellId] ?? 0.3) + 0.02),
      },
    };
    state.events.push(causalEvent({
      worldId: agent.worldId,
      tick,
      type: "Human Observation",
      title: "Human Observed Surroundings",
      summary: `${agent.sex} human observed the local surroundings and landmarks.`,
      agentIds: [agent.id],
      cellId: agent.currentCellId,
      causes: decision.causes,
      effects: { familiarityAfter: nextAgent.familiarityByCell[agent.currentCellId] },
    }));
    return nextAgent;
  }

  if (decision.action === "explore") {
    const nextAgent = {
      ...agent,
      emotions: {
        ...agent.emotions,
        relief: clamp01(agent.emotions.relief + 0.015),
      },
      curiosityProfile: {
        ...agent.curiosityProfile,
        noveltySeeking: clamp01(agent.curiosityProfile.noveltySeeking * 0.98 + 0.02),
      },
      confidence: clamp01(agent.confidence + 0.02),
      familiarityByCell: {
        ...agent.familiarityByCell,
        [agent.currentCellId]: clamp01((agent.familiarityByCell[agent.currentCellId] ?? 0.3) + 0.03),
      },
    };
    state.events.push(causalEvent({
      worldId: agent.worldId,
      tick,
      type: "Human Exploration",
      title: "Human Explored Nearby",
      summary: `${agent.sex} human explored the nearby area out of curiosity.`,
      agentIds: [agent.id],
      cellId: agent.currentCellId,
      causes: decision.causes,
      effects: { confidenceAfter: nextAgent.confidence },
    }));
    return nextAgent;
  }

  return agent;
}

function updateTheoryOfMind(agent: HumanAgent, agents: readonly HumanAgent[], tick: bigint): HumanAgent {
  const estimates: Record<string, HumanTheoryOfMindEstimate> = Object.fromEntries(otherAgents(agent, agents).map((target) => [
    target.id,
    {
      targetAgentId: target.id,
      believedNeeds: { ...target.needs },
      believedEmotion: {
        fear: target.emotions.fear,
        comfort: target.emotions.comfort,
        loneliness: target.emotions.loneliness,
        trust: target.emotions.trust,
      },
      believedIntent: target.lastDecision?.action ?? "unknown",
      confidence: 0.52,
      lastUpdatedTick: tick.toString(),
    },
  ]));

  return {
    ...agent,
    theoryOfMind: estimates,
  };
}

export function advanceHumanTick(state: HumanMvaState, seed: string, tick: bigint): HumanTickResult {
  const mutable: MutableTickState = {
    agents: state.agents.map((agent) => ({
      ...agent,
      needs: updateNeeds(agent.needs),
      ageDays: Math.max(0, agent.ageDays + 1),
      approxAgeYears: round(Math.max(0, agent.ageDays + 1) / 365),
      ageStage: ageStageForYears(round(Math.max(0, agent.ageDays + 1) / 365)),
    })),
    relationships: state.relationships.map((relationship) => ({ ...relationship })),
    events: [],
    communications: [],
    teachingAttempts: [],
  };

  // Update curiosity profile and motivations before emotions so aggregate curiosity reflects profile.
  mutable.agents = mutable.agents.map((agent) => {
    const nextProfile = updateCuriosityProfile(agent);
    const nextMotivations = computeMotivations({ ...agent, curiosityProfile: nextProfile } as HumanAgent);
    const nextSafetyStreak = agent.needs.safety < 0.42 ? agent.safetyStreak + 1 : 0;

    return {
      ...agent,
      curiosityProfile: nextProfile,
      motivations: nextMotivations,
      safetyStreak: nextSafetyStreak,
    };
  });

  mutable.agents = mutable.agents.map((agent) => ({
    ...agent,
    emotions: updateEmotions(agent),
  }));

  const memoryIndex = createHumanMemoryIndex(state.memories);

  mutable.agents = mutable.agents.map((agent) => {
    const result = evaluateGoalDecision({
      worldId: state.worldId,
      tick,
      seed,
      agent,
      agents: mutable.agents,
      relationships: mutable.relationships,
      knowledge: state.knowledge,
      memories: state.memories,
      memoryIndex,
    });

    mutable.events.push(...result.events);

    return result.agent;
  });
  const movementEnvironment = buildHumanMovementEnvironment({ id: state.worldId, seed }, tick);
  const movementUpdate = updateHumanMovements({
    agents: mutable.agents,
    relationships: mutable.relationships,
    memories: state.memories,
    knowledge: state.knowledge,
    environment: movementEnvironment,
    tick,
    seed,
  });
  mutable.agents = movementUpdate.agents;
  mutable.events.push(...movementUpdate.events);
  mutable.agents = mutable.agents.map((agent) => {
    const candidates = createActionCandidates(
      agent,
      otherAgents(agent, mutable.agents),
      mutable.relationships,
      tick,
      seed,
    );
    const decision = selectHumanDecision(agent, candidates, tick);

    return { ...agent, lastDecision: decision };
  });

  for (const agent of [...mutable.agents]) {
    const updatedAgent = applyDecision(agent, mutable, tick, seed);

    mutable.agents = mutable.agents.map((candidate) =>
      candidate.id === updatedAgent.id ? updatedAgent : candidate,
    );
  }

  const communicationUpdate = updateCommunicationEngine({
    worldId: state.worldId,
    tick,
    agents: mutable.agents,
    relationships: mutable.relationships,
    communications: mutable.communications,
  });
  mutable.agents = communicationUpdate.agents;
  mutable.relationships = communicationUpdate.relationships;
  mutable.teachingAttempts = [...mutable.teachingAttempts, ...communicationUpdate.teachingAttempts];
  const communicationCausalEvents = communicationUpdate.communicationEvents.map((event) => communicationSystemEventToCausalEvent(event, mutable.agents));
  mutable.events.push(...communicationCausalEvents);

  mutable.agents = mutable.agents.map((agent) => updateTheoryOfMind(agent, mutable.agents, tick));

  const memoryUpdate = updateEpisodicMemories({
    memories: state.memories,
    agents: mutable.agents,
    events: mutable.events,
    tick,
  });
  const eventsWithMemories = mutable.events.map((event) => ({
    ...event,
    memoryIds: memoryUpdate.eventMemoryIds.get(event.id) ?? [],
  }));
  const relationshipUpdate = updateRelationshipEngine({
    worldId: state.worldId,
    relationships: mutable.relationships,
    agents: mutable.agents,
    events: eventsWithMemories,
    memories: memoryUpdate.memories,
    tick,
  });
  const agentById = new Map(mutable.agents.map((agent) => [agent.id, agent]));
  const relationshipCausalEvents = relationshipUpdate.relationshipEvents.map((event) => relationshipSystemEventToCausalEvent(event, agentById));
  const knowledgeUpdate = updateKnowledgeEngine({
    knowledge: state.knowledge,
    agents: mutable.agents,
    relationships: relationshipUpdate.relationships,
    memories: memoryUpdate.memories,
    events: eventsWithMemories,
    teachingAttempts: mutable.teachingAttempts,
    tick,
  });
  const knowledgeCausalEvents = knowledgeUpdate.knowledgeEvents.map((event) => causalEvent({
    worldId: event.worldId,
    tick: BigInt(event.tick),
    type: "Human Knowledge Event",
    title: event.kind,
    summary: event.summary,
    agentIds: event.targetHumanId ? [event.humanId, event.targetHumanId] : [event.humanId],
    cellId: agentById.get(event.humanId)?.currentCellId ?? "unknown-cell",
    causes: { sourceEventId: event.sourceEventId ?? "none", category: event.category },
    effects: { knowledgeId: event.knowledgeId, confidence: event.confidence, mastery: event.mastery },
  }));
  const homeProfiledAgents = applyHomeProfilesToAgents(mutable.agents, eventsWithMemories, tick);
  const nextState: HumanMvaState = {
    worldId: state.worldId,
    tick: tick.toString(),
    agents: homeProfiledAgents,
    relationships: relationshipUpdate.relationships,
    knowledge: knowledgeUpdate.knowledge,
    memories: memoryUpdate.memories,
    communications: [...state.communications, ...communicationUpdate.communications],
    teachingAttempts: [...state.teachingAttempts, ...mutable.teachingAttempts],
    causalEvents: [...state.causalEvents, ...eventsWithMemories, ...relationshipCausalEvents, ...knowledgeCausalEvents],
  };
  const chroniclerReport = createChroniclerReport(nextState, [...eventsWithMemories, ...relationshipCausalEvents, ...knowledgeCausalEvents]);

  return {
    state: nextState,
    newEvents: eventsWithMemories,
    memoryEvents: memoryUpdate.memoryEvents,
    relationshipEvents: relationshipUpdate.relationshipEvents,
    knowledgeEvents: knowledgeUpdate.knowledgeEvents,
    communicationEvents: communicationUpdate.communicationEvents,
    chroniclerReport,
  };
}

export function getHumanMvaStateAtTick(
  world: HumanWorldSource,
  tick: bigint,
): HumanTickResult {
  const seed = world.seed?.trim() || "first-dawn-human-mva";
  const initialState = spawnFirstTwoHumans(world, 0n);

  if (tick <= 0n) {
    return {
      state: initialState,
      newEvents: [],
      memoryEvents: [],
      relationshipEvents: [],
      knowledgeEvents: [],
      communicationEvents: [],
      chroniclerReport: createChroniclerReport(initialState, []),
    };
  }

  let state = initialState;
  let result: HumanTickResult = {
    state,
    newEvents: [],
    memoryEvents: [],
    relationshipEvents: [],
    knowledgeEvents: [],
    communicationEvents: [],
    chroniclerReport: createChroniclerReport(state, []),
  };

  for (let currentTick = 1n; currentTick <= tick; currentTick += 1n) {
    result = advanceHumanTick(state, seed, currentTick);
    state = result.state;
  }

  return result;
}

export function simulateHumanDay(
  initialState: HumanMvaState,
  seed: string,
  startTick: bigint,
  dayTicks = HUMAN_MVA_DAY_TICKS,
): HumanTickResult {
  let state = initialState;
  let dayEvents: HumanCausalEvent[] = [];
  let dayMemoryEvents: HumanMemorySystemEvent[] = [];
  let dayRelationshipEvents: HumanRelationshipSystemEvent[] = [];
  let dayKnowledgeEvents: HumanKnowledgeSystemEvent[] = [];
  let dayCommunicationEvents: HumanCommunicationSystemEvent[] = [];
  let report = createChroniclerReport(state, []);

  for (let offset = 0; offset < dayTicks; offset += 1) {
    const result = advanceHumanTick(state, seed, startTick + BigInt(offset));
    state = result.state;
    dayEvents = [...dayEvents, ...result.newEvents];
    dayMemoryEvents = [...dayMemoryEvents, ...result.memoryEvents];
    dayRelationshipEvents = [...dayRelationshipEvents, ...result.relationshipEvents];
    dayKnowledgeEvents = [...dayKnowledgeEvents, ...result.knowledgeEvents];
    dayCommunicationEvents = [...dayCommunicationEvents, ...result.communicationEvents];
    report = createChroniclerReport(state, dayEvents);
  }

  return {
    state,
    newEvents: dayEvents,
    memoryEvents: dayMemoryEvents,
    relationshipEvents: dayRelationshipEvents,
    knowledgeEvents: dayKnowledgeEvents,
    communicationEvents: dayCommunicationEvents,
    chroniclerReport: report,
  };
}
