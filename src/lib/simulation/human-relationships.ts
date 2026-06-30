import {
  HUMAN_ADULT_AGE_YEARS,
  type HumanAgent,
  type HumanRelationship,
  type HumanReproductionEligibility,
} from "./human-types";

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, round(value)));
}

export function createNeutralRelationship(
  worldId: string,
  fromAgentId: string,
  toAgentId: string,
): HumanRelationship {
  return {
    worldId,
    fromAgentId,
    toAgentId,
    kinship: "none",
    familiarity: 0.5,
    trust: 0.5,
    affection: 0.5,
    fear: 0.1,
    resentment: 0,
    dependency: 0.1,
    attraction: 0.5,
    companionship: 0.5,
    lastInteractionTick: null,
  };
}

export function createInitialRelationships(agents: readonly HumanAgent[]): HumanRelationship[] {
  return agents.flatMap((agent) =>
    agents
      .filter((other) => other.id !== agent.id)
      .map((other) => createNeutralRelationship(agent.worldId, agent.id, other.id)),
  );
}

export function updateRelationshipForInteraction(
  relationship: HumanRelationship,
  interaction: "communication" | "teaching" | "comfort" | "sharedSurvival",
  tick: bigint,
): HumanRelationship {
  const trustDelta = interaction === "communication" ? 0.025 : interaction === "teaching" ? 0.035 : 0.02;
  const affectionDelta = interaction === "communication" ? 0.02 : interaction === "comfort" ? 0.04 : 0.015;
  const companionshipDelta = interaction === "sharedSurvival" ? 0.035 : 0.025;

  return {
    ...relationship,
    familiarity: clamp01(relationship.familiarity + 0.035),
    trust: clamp01(relationship.trust + trustDelta),
    affection: clamp01(relationship.affection + affectionDelta),
    fear: clamp01(relationship.fear - 0.01),
    resentment: clamp01(relationship.resentment - 0.005),
    dependency: clamp01(relationship.dependency + 0.006),
    attraction: clamp01(relationship.attraction + 0.01),
    companionship: clamp01(relationship.companionship + companionshipDelta),
    lastInteractionTick: tick.toString(),
  };
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

  return {
    ...relationship,
    trust: clamp01(relationship.trust + trustDrift),
    affection: clamp01(relationship.affection + affectionDrift),
    companionship: clamp01(relationship.companionship + companionshipDrift),
    attraction: clamp01(relationship.attraction + attractionDrift),
    fear: clamp01(relationship.fear + fearDrift),
    resentment: clamp01(relationship.resentment + (context.unmetExpectation ? 0.004 : -0.002)),
    dependency: clamp01(relationship.dependency * 0.999 + (proximity ? 0.001 : -0.001)),
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
