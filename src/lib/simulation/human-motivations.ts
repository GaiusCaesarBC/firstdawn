import { createDeterministicRandom } from "./random";
import type {
  HumanAgent,
  HumanCuriosityProfile,
  HumanGoal,
  HumanMotivations,
  HumanMotivationKey,
} from "./human-types";

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, round(value)));
}

function needStable(agent: HumanAgent): boolean {
  return (
    agent.needs.hunger < 0.45 &&
    agent.needs.thirst < 0.45 &&
    agent.needs.fatigue < 0.5 &&
    agent.needs.safety < 0.52
  );
}

export function initialCuriosityProfile(personalityRiskTolerance: number, seed: string): HumanCuriosityProfile {
  const rng = createDeterministicRandom({ worldSeed: seed, tick: 0n, systemName: "human-curiosity-initial" });

  return {
    environmental: round(rng.float(0.45, 0.7)),
    social: round(rng.float(0.45, 0.7)),
    technical: round(rng.float(0.38, 0.64)),
    noveltySeeking: round(rng.float(0.42, 0.72)),
    riskTolerance: round((personalityRiskTolerance * 0.7) + rng.float(0.08, 0.18)),
  };
}

export function updateCuriosityProfile(agent: HumanAgent): HumanCuriosityProfile {
  const safe = agent.needs.safety < 0.42 && agent.emotions.fear < 0.6 && agent.emotions.distress < 0.65;
  const fatigueBrake = agent.needs.fatigue * 0.1;
  const safeRecovery = safe ? 0.02 + agent.confidence * 0.03 : 0.004;

  return {
    environmental: clamp01(agent.curiosityProfile.environmental + safeRecovery - fatigueBrake * 0.3),
    social: clamp01(agent.curiosityProfile.social + (safe ? 0.015 : 0.004) - fatigueBrake * 0.25),
    technical: clamp01(agent.curiosityProfile.technical + (safe ? 0.012 : 0.003) - fatigueBrake * 0.2),
    noveltySeeking: clamp01(agent.curiosityProfile.noveltySeeking + (safe ? 0.018 : 0.002) - fatigueBrake * 0.25),
    riskTolerance: clamp01(agent.curiosityProfile.riskTolerance * 0.98 + agent.personality.riskTolerance * 0.02),
  };
}

export function computeMotivations(agent: HumanAgent): HumanMotivations {
  const stable = needStable(agent);
  const curiosity = agent.curiosityProfile;
  const fearBrake = agent.emotions.fear * 0.35;
  const distressBrake = agent.emotions.distress * 0.25;
  const brakes = Math.max(0, fearBrake + distressBrake - agent.confidence * 0.25);
  const familiarity = agent.familiarityByCell[agent.currentCellId] ?? 0.3;

  const base: HumanMotivations = {
    explore: 0,
    learn: 0,
    socialize: 0,
    restVoluntary: 0,
    improveShelter: 0,
    observeSurroundings: 0,
    practiceSkills: 0,
    teach: 0,
    collectObjects: 0,
  };

  base.observeSurroundings = clamp01(curiosity.environmental * 0.7 + (stable ? 0.2 : 0) - brakes * 0.3);
  base.explore = clamp01(curiosity.noveltySeeking * 0.6 + curiosity.environmental * 0.4 + (stable ? 0.25 : -0.1) - brakes * 0.6);
  base.learn = clamp01(curiosity.technical * 0.6 + curiosity.noveltySeeking * 0.2 + (stable ? 0.2 : 0) - brakes * 0.3);
  base.practiceSkills = clamp01(curiosity.technical * 0.45 + agent.personality.patience * 0.2 + (stable ? 0.15 : 0) - brakes * 0.25);
  base.improveShelter = clamp01((1 - familiarity) * 0.35 + (stable ? 0.1 : 0) + agent.needs.safety * 0.2);
  base.socialize = clamp01((1 - agent.needs.social) * 0.2 + agent.personality.sociability * 0.3 + curiosity.social * 0.4 + (stable ? 0.15 : 0) - brakes * 0.2);
  base.teach = clamp01(agent.personality.teachAffinity * 0.5 + agent.emotions.trust * 0.25 + (stable ? 0.1 : 0));
  base.collectObjects = clamp01(curiosity.noveltySeeking * 0.5 + curiosity.technical * 0.3 + (stable ? 0.1 : 0) - brakes * 0.2);
  base.restVoluntary = clamp01((stable ? 0.35 : 0.1) + agent.personality.patience * 0.1 - agent.needs.fatigue * 0.2);

  return base;
}

export function dominantMotivation(motivations: HumanMotivations): { key: HumanMotivationKey; score: number } {
  const entries = Object.entries(motivations) as Array<[HumanMotivationKey, number]>;
  const [top] = entries.sort((a, b) => b[1] - a[1]);

  return { key: top?.[0] ?? "observeSurroundings", score: top?.[1] ?? 0 };
}

export function deriveGoal(agent: HumanAgent, motivations: HumanMotivations, tick: bigint): HumanGoal {
  const { key } = dominantMotivation(motivations);
  let text = "";

  if (agent.needs.hunger > 0.65) text = "I'm hungry.";
  else if (agent.needs.thirst > 0.65) text = "I'm thirsty.";
  else {
    switch (key) {
      case "explore": text = "I should explore."; break;
      case "learn": text = "I should examine how things work."; break;
      case "socialize": text = "I want to stay close to my companion."; break;
      case "teach": text = "I should teach something."; break;
      case "improveShelter": text = "I should improve this shelter."; break;
      case "observeSurroundings": text = "I should observe my surroundings."; break;
      case "practiceSkills": text = "I should practice a skill."; break;
      case "collectObjects": text = "I should collect something useful."; break;
      default: text = "I should rest for a moment."; break;
    }
  }

  return {
    id: `${agent.id}:goal:${tick.toString()}:${key}`,
    text,
    createdTick: tick.toString(),
    expiresTick: (tick + 8n).toString(),
  };
}
