import type {
  HumanActionCandidate,
  HumanAgent,
  HumanDecision,
  HumanRelationship,
} from "./human-types";
import { dominantMotivation } from "./human-motivations";

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

function stableScoreOffset(seed: string, tick: bigint, label: string): number {
  let hash = 2_166_136_261;
  const input = `${seed}:${tick.toString()}:${label}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return ((hash >>> 0) % 10_000) / 1_000_000;
}

function findRelationship(
  relationships: readonly HumanRelationship[],
  fromAgentId: string,
  toAgentId: string,
): HumanRelationship | undefined {
  return relationships.find((relationship) =>
    relationship.fromAgentId === fromAgentId && relationship.toAgentId === toAgentId,
  );
}

export function createActionCandidates(
  agent: HumanAgent,
  others: readonly HumanAgent[],
  relationships: readonly HumanRelationship[],
  tick: bigint,
  seed: string,
): HumanActionCandidate[] {
  const socialTarget = others.find((other) => other.isAlive && other.currentCellId === agent.currentCellId);
  const relationship = socialTarget
    ? findRelationship(relationships, agent.id, socialTarget.id)
    : undefined;
  const socialPull = relationship
    ? (relationship.trust + relationship.affection + relationship.companionship + relationship.attraction) / 4
    : 0.5;
  const firstContactBoost = Object.keys(agent.beliefs).some((key) => key.startsWith("communication:"))
    ? 0
    : 0.35;
  const targetAgentId = socialTarget?.id;
  const safetyUrgency = pressureAbove(agent.needs.safety, 0.52);
  const curiosity = agent.curiosityProfile;
  const motivations = agent.motivations;
  const topMotivation = dominantMotivation(motivations);
  const discretionary = agent.needs.hunger < 0.55 && agent.needs.thirst < 0.55 && agent.needs.fatigue < 0.6 && agent.needs.safety < 0.55;

  const candidates: HumanActionCandidate[] = [
    {
      type: "drink",
      expectedUtility: agent.needs.thirst * 1.45 + 0.18,
      causes: { thirst: agent.needs.thirst },
    },
    {
      type: "eat",
      expectedUtility: agent.needs.hunger * 1.35 + 0.12,
      causes: { hunger: agent.needs.hunger },
    },
    {
      type: "rest",
      expectedUtility: agent.needs.fatigue * 1.2 + agent.personality.patience * 0.1 + (discretionary ? motivations.restVoluntary * 0.25 : 0),
      causes: { fatigue: agent.needs.fatigue, restVoluntary: motivations.restVoluntary },
    },
    {
      type: "seekSafety",
      expectedUtility: safetyUrgency * 1.15 + agent.emotions.fear * 0.18,
      causes: { safety: agent.needs.safety, safetyUrgency, fear: agent.emotions.fear },
    },
    {
      type: "communicate",
      targetAgentId,
      expectedUtility: targetAgentId
        ? agent.needs.social * 0.95 + agent.personality.sociability * 0.35 + socialPull * 0.25 + firstContactBoost + (discretionary ? motivations.socialize * 0.35 : 0)
        : 0,
      causes: {
        socialNeed: agent.needs.social,
        sociability: agent.personality.sociability,
        relationshipPull: socialPull,
        firstContactBoost,
        socialMotivation: motivations.socialize,
      },
    },
    {
      type: "teach",
      targetAgentId,
      expectedUtility: targetAgentId
        ? agent.personality.teachAffinity * 0.34 + (relationship?.trust ?? 0) + (discretionary ? motivations.teach * 0.3 : 0)
        : 0,
      causes: {
        teachAffinity: agent.personality.teachAffinity,
        trust: relationship?.trust ?? 0,
        teachMotivation: motivations.teach,
      },
    },
    {
      type: "observeHuman",
      targetAgentId,
      expectedUtility: targetAgentId
        ? agent.personality.curiosity * 0.25 + agent.emotions.curiosity * 0.2 + (discretionary ? motivations.socialize * 0.15 : 0)
        : 0,
      causes: {
        curiosity: agent.personality.curiosity,
        emotionalCuriosity: agent.emotions.curiosity,
        socialMotivation: motivations.socialize,
      },
    },
    {
      type: "court",
      targetAgentId,
      expectedUtility: targetAgentId
        ? (relationship?.attraction ?? 0) * 0.35 + (relationship?.trust ?? 0) * 0.2
        : 0,
      causes: {
        attraction: relationship?.attraction ?? 0,
        trust: relationship?.trust ?? 0,
        activeDecisionRequired: true,
      },
    },
    {
      type: "observeEnvironment",
      expectedUtility: (discretionary ? motivations.observeSurroundings * 0.6 : 0.05) + curiosity.environmental * 0.25 + agent.emotions.curiosity * 0.15,
      causes: {
        environmentalCuriosity: curiosity.environmental,
        motivation: motivations.observeSurroundings,
      },
    },
    {
      type: "explore",
      expectedUtility: (discretionary ? motivations.explore * 0.7 : 0.02) + curiosity.noveltySeeking * 0.3 + (1 - agent.emotions.fear) * 0.15,
      causes: {
        noveltySeeking: curiosity.noveltySeeking,
        exploreMotivation: motivations.explore,
        fear: agent.emotions.fear,
      },
    },
  ];

  return candidates.map((candidate) => ({
    ...candidate,
    expectedUtility: clamp01(candidate.expectedUtility + stableScoreOffset(seed, tick, `${agent.sex}:${candidate.type}`)),
    causes: {
      ...candidate.causes,
      topMotivation: topMotivation.key,
    },
  }));
}

export function selectHumanDecision(
  agent: HumanAgent,
  candidates: readonly HumanActionCandidate[],
  tick: bigint,
): HumanDecision {
  const [selected] = [...candidates].sort((left, right) =>
    right.expectedUtility - left.expectedUtility || left.type.localeCompare(right.type),
  );

  if (!selected) {
    return {
      action: "rest",
      targetAgentId: null,
      utility: 0,
      scoredAtTick: tick.toString(),
      causes: { fallback: "no available candidates" },
    };
  }

  return {
    action: selected.type,
    targetAgentId: selected.targetAgentId ?? null,
    utility: selected.expectedUtility,
    scoredAtTick: tick.toString(),
    causes: selected.causes,
  };
}



