export type Observation = {
  id: string;
  worldId: string;
  tick: string;
  phenomenon: string; // e.g. "need:thirst:reduced", "need:hunger:reduced", "safety:improved"
  description: string;
  success: boolean;
  participants: string[];
  cellId: string;
};

export type Hypothesis = {
  id: string; // stable from phenomenon key
  worldId: string;
  phenomenon: string;
  createdTick: string;
  observationCount: number;
  successCount: number;
  failureCount: number;
  participants: string[]; // unique set of all participants observed
  locations: string[]; // unique set of cellIds
  relatedEventIds: string[]; // event ids that contributed
  relatedObservationIds: string[];
  confidence: number; // 0..1 gradual belief
  knowledgeLevel: DiscoveryKnowledgeLevel; // tracks lifecycle transition for hypothesis/early discovery states
  shared: boolean; // whether communication/teaching contributed
};

export type Discovery = {
  id: string; // stable from phenomenon key (same as hypothesis id)
  worldId: string;
  phenomenon: string;
  firstObservedTick: string;
  confirmedTick: string | null;
  observationCount: number;
  successCount: number;
  failureCount: number;
  participants: string[];
  locations: string[];
  relatedEventIds: string[];
  relatedObservationIds: string[];
  confidence: number;
  knowledgeLevel: DiscoveryKnowledgeLevel; // progresses through lifecycle
  shared: boolean;
};

export type DiscoveryKnowledgeLevel =
  | "Unknown"
  | "Observed"
  | "Repeated"
  | "Understood"
  | "Reliable"
  | "Teachable"
  | "Shared Knowledge";

export type DiscoverySnapshot = {
  worldId: string;
  tick: string;
  observations: Observation[];
  hypotheses: Hypothesis[];
  discoveries: Discovery[];
  latestEvent?: {
    type: "Observation Created" | "Pattern Recognized" | "Hypothesis Formed" | "Discovery Confirmed" | "Discovery Shared";
    phenomenon: string;
    tick: string;
  } | null;
};

export function advanceKnowledgeLevel(
  current: DiscoveryKnowledgeLevel,
  stats: { observationCount: number; successRatio: number; uniqueParticipants: number; uniqueLocations: number; teachingCount: number; communicationCount: number },
): DiscoveryKnowledgeLevel {
  if (current === "Unknown" && stats.observationCount > 0) return "Observed";
  if ((current === "Observed" || current === "Unknown") && stats.observationCount >= 3 && stats.successRatio >= 0.6) return "Repeated";
  if ((current === "Repeated" || current === "Observed") && stats.observationCount >= 5 && stats.successRatio >= 0.65) return "Understood";
  if ((current === "Understood" || current === "Repeated") && stats.observationCount >= 8 && stats.successRatio >= 0.7 && stats.uniqueParticipants >= 2) return "Reliable";
  if ((current === "Reliable" || current === "Understood") && stats.teachingCount >= 1) return "Teachable";
  if ((current === "Teachable" || current === "Reliable") && stats.communicationCount + stats.teachingCount >= 3 && stats.uniqueLocations >= 2) return "Shared Knowledge";
  return current;
}

export function updateConfidence(
  current: number,
  delta: { successCount: number; failureCount: number; teachingCount: number; confirmationByOthers: number; uniqueLocations: number },
): number {
  // Gentle, bounded updates to keep changes gradual and stable
  const successBoost = Math.min(0.25, delta.successCount * 0.02);
  const failureDrop = Math.min(0.3, delta.failureCount * 0.04);
  const teachingBoost = Math.min(0.15, delta.teachingCount * 0.05);
  const othersBoost = Math.min(0.15, delta.confirmationByOthers * 0.03);
  const locationBoost = Math.min(0.1, Math.max(0, delta.uniqueLocations - 1) * 0.03);
  const next = current + successBoost + teachingBoost + othersBoost + locationBoost - failureDrop;
  return Math.max(0, Math.min(1, Number.isFinite(next) ? next : current));
}
