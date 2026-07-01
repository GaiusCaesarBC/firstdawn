import type { Prisma } from "@prisma/client";
import type { SimulationSystemContext, SimulationSystemEvent } from "./systems/types";
import { advanceKnowledgeLevel, type Discovery, type DiscoverySnapshot, type Hypothesis, type Observation, updateConfidence } from "./discovery-types";

type RawEvent = {
  id: string;
  tick: bigint;
  type: string;
  title: string;
  metadata: Prisma.InputJsonValue | null;
};

function toSafeObject(value: Prisma.InputJsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function normalizePhenomenon(event: RawEvent): { key: string; success: boolean; description: string } | null {
  // Map human causal outcomes to generic environmental phenomena without hardcoding specific technologies
  const meta = toSafeObject(event.metadata);
  const effects = toSafeObject(meta.effects as Prisma.InputJsonValue | null);

  if (event.type === "Human Need Fulfilled") {
    if (typeof effects.thirstAfter === "number") {
      return { key: "need:thirst:reduced", success: true, description: "Observed: environment reduced thirst." };
    }
    if (typeof effects.hungerAfter === "number") {
      return { key: "need:hunger:reduced", success: true, description: "Observed: environment reduced hunger." };
    }
    if (typeof effects.safetyAfter === "number") {
      return { key: "safety:improved", success: true, description: "Observed: area felt safer." };
    }
  }

  if (event.type === "Human Safety Secured") {
    return { key: "safety:improved", success: true, description: "Observed: safer position achieved." };
  }

  if (event.type === "Human Safety Check Failed") {
    return { key: "safety:improved", success: false, description: "Observed: safety attempt failed here." };
  }

  if (event.type === "Human Observation") {
    return { key: "environment:noticed", success: true, description: "Observed: noted environmental features." };
  }

  // Skip purely social/teaching events for observations; they will influence confidence/sharing later
  return null;
}

function buildObservationId(worldId: string, tick: bigint, eventId: string, phenomenon: string): string {
  return `${worldId}:observation:${tick.toString()}:${phenomenon}:${eventId}`;
}

function buildDiscoveryId(worldId: string, phenomenon: string): string {
  return `${worldId}:discovery:${phenomenon}`;
}

export async function analyzeDiscoveryState(context: SimulationSystemContext): Promise<{
  snapshot: DiscoverySnapshot;
  events: SimulationSystemEvent[];
}> {
  const { world, tick, eventBus } = context;
  // Include current-tick emitted events from systems before us only; no DB reads to keep transaction fast
  const inTickEvents = eventBus
    .collect()
    .filter((e) => e.tick === tick && e.systemId === "humans");
  const current: RawEvent[] = inTickEvents.map((e) => ({ id: e.metadata && typeof e.metadata === "object" && !Array.isArray(e.metadata) && (e.metadata as Record<string, unknown>)["eventId"] as string || `${e.systemId}:${e.type}:${tick.toString()}`,
    tick: e.tick,
    type: e.type,
    title: e.title,
    metadata: e.metadata ?? null,
  }));

  const observations: Observation[] = [];
  const byPhenomenon = new Map<string, Hypothesis>();
  const discoveries = new Map<string, Discovery>();

  // Start fresh each tick; future persistence can hydrate state here

  // Track social sharing influence separately
  let teachingCount = 0;
  let communicationCount = 0;

  for (const event of current) {
    if (event.type === "Human Teaching") teachingCount += 1;
    if (event.type === "Human Communication" || event.type === "Human Communication Event") communicationCount += 1;

    const mapped = normalizePhenomenon(event);
    if (!mapped) continue;
    const meta = toSafeObject(event.metadata);
    const rawAgentIds = (meta["agentIds"] as unknown) as unknown[] | undefined;
    const agentIds = Array.isArray(rawAgentIds) ? (rawAgentIds.filter((v) => typeof v === "string") as string[]) : undefined;
    const cellId = typeof meta["cellId"] === "string" ? (meta["cellId"] as string) : "unknown";
    const participants = Array.isArray(agentIds) ? agentIds : [];

    const obs: Observation = {
      id: buildObservationId(world.id, event.tick, event.id, mapped.key),
      worldId: world.id,
      tick: event.tick.toString(),
      phenomenon: mapped.key,
      description: mapped.description,
      success: mapped.success,
      participants,
      cellId,
    };
    observations.push(obs);

    const id = buildDiscoveryId(world.id, mapped.key);
    const existing = byPhenomenon.get(mapped.key);
    const hyp: Hypothesis = existing ?? {
      id,
      worldId: world.id,
      phenomenon: mapped.key,
      createdTick: event.tick.toString(),
      observationCount: 0,
      successCount: 0,
      failureCount: 0,
      participants: [],
      locations: [],
      relatedEventIds: [],
      relatedObservationIds: [],
      confidence: 0.5, // start neutral
      knowledgeLevel: "Unknown",
      shared: false,
    };

    hyp.observationCount += 1;
    hyp.successCount += obs.success ? 1 : 0;
    hyp.failureCount += obs.success ? 0 : 1;
    hyp.participants = Array.from(new Set([...hyp.participants, ...obs.participants]));
    hyp.locations = Array.from(new Set([...hyp.locations, obs.cellId]));
    hyp.relatedEventIds = Array.from(new Set([...hyp.relatedEventIds, event.id]));
    hyp.relatedObservationIds = Array.from(new Set([...hyp.relatedObservationIds, obs.id]));
    byPhenomenon.set(mapped.key, hyp);

    // Maintain a corresponding discovery record (mirrors the evolving hypothesis)
    const existingDisc = discoveries.get(id) ?? {
      id,
      worldId: world.id,
      phenomenon: mapped.key,
      firstObservedTick: event.tick.toString(),
      confirmedTick: null,
      observationCount: 0,
      successCount: 0,
      failureCount: 0,
      participants: [],
      locations: [],
      relatedEventIds: [],
      relatedObservationIds: [],
      confidence: 0.5,
      knowledgeLevel: "Unknown",
      shared: false,
    } as Discovery;

    existingDisc.observationCount += 1;
    existingDisc.successCount += obs.success ? 1 : 0;
    existingDisc.failureCount += obs.success ? 0 : 1;
    existingDisc.participants = Array.from(new Set([...existingDisc.participants, ...obs.participants]));
    existingDisc.locations = Array.from(new Set([...existingDisc.locations, obs.cellId]));
    existingDisc.relatedEventIds = Array.from(new Set([...existingDisc.relatedEventIds, event.id]));
    existingDisc.relatedObservationIds = Array.from(new Set([...existingDisc.relatedObservationIds, obs.id]));
    discoveries.set(id, existingDisc);
  }

  // Apply confidence and lifecycle updates
  const outEvents: SimulationSystemEvent[] = [];
  let latestEvent: DiscoverySnapshot["latestEvent"] = null;

  // Emit observation events for current tick observations (lightweight, one per observation)
  for (const obs of observations) {
    outEvents.push({
      type: "Observation Created",
      title: `Observation: ${obs.phenomenon}`,
      historicalWeight: 0.1,
      metadata: {
        phenomenon: obs.phenomenon,
        observationId: obs.id,
        tick: obs.tick,
        participants: obs.participants,
        cellId: obs.cellId,
        success: obs.success,
      },
    });
    latestEvent = { type: "Observation Created", phenomenon: obs.phenomenon, tick: obs.tick };
  }

  for (const hyp of byPhenomenon.values()) {
    const disc = discoveries.get(hyp.id)!;
    const uniqueParticipants = hyp.participants.length;
    const uniqueLocations = hyp.locations.length;
    const successRatio = hyp.observationCount > 0 ? hyp.successCount / hyp.observationCount : 0;
    const beforeLevel = hyp.knowledgeLevel;

    const conf = updateConfidence(hyp.confidence, {
      successCount: hyp.successCount,
      failureCount: hyp.failureCount,
      teachingCount,
      confirmationByOthers: Math.max(0, uniqueParticipants - 1),
      uniqueLocations,
    });
    hyp.confidence = round(conf);
    disc.confidence = hyp.confidence;

    const nextLevel = advanceKnowledgeLevel(beforeLevel, {
      observationCount: hyp.observationCount,
      successRatio,
      uniqueParticipants,
      uniqueLocations,
      teachingCount,
      communicationCount,
    });
    hyp.knowledgeLevel = nextLevel;
    disc.knowledgeLevel = nextLevel;
    disc.shared = teachingCount + communicationCount > 0 || disc.shared;
    hyp.shared = disc.shared;

    if (beforeLevel !== nextLevel) {
      const titleMap: Record<typeof nextLevel, { type: string; title: string }> = {
        Unknown: { type: "Pattern Recognized", title: "Pattern Noted" },
        Observed: { type: "Observation Created", title: "Observation Logged" },
        Repeated: { type: "Pattern Recognized", title: "Repeated Pattern Recognized" },
        Understood: { type: "Hypothesis Formed", title: "Hypothesis Formed" },
        Reliable: { type: "Discovery Confirmed", title: "Reliable Discovery Confirmed" },
        Teachable: { type: "Discovery Shared", title: "Discovery Considered Teachable" },
        "Shared Knowledge": { type: "Discovery Shared", title: "Discovery Shared Among People" },
      } as const;
      const mapped = titleMap[nextLevel];
      outEvents.push({
        type: mapped.type,
        title: `${mapped.title}: ${hyp.phenomenon}`,
        historicalWeight: nextLevel === "Reliable" || nextLevel === "Shared Knowledge" ? 0.6 : 0.3,
        metadata: {
          phenomenon: hyp.phenomenon,
          hypothesisId: hyp.id,
          confidence: hyp.confidence,
          observationCount: hyp.observationCount,
          successCount: hyp.successCount,
          failureCount: hyp.failureCount,
          uniqueParticipants,
          uniqueLocations,
          knowledgeLevel: nextLevel,
        },
      });
      latestEvent = { type: mapped.type as never, phenomenon: hyp.phenomenon, tick: tick.toString() };
      if (nextLevel === "Reliable" && disc.confirmedTick === null) {
        disc.confirmedTick = tick.toString();
      }
    }
  }

  const snapshot: DiscoverySnapshot = {
    worldId: world.id,
    tick: tick.toString(),
    observations,
    hypotheses: [...byPhenomenon.values()].sort((a, b) => a.phenomenon.localeCompare(b.phenomenon)),
    discoveries: [...discoveries.values()].sort((a, b) => a.phenomenon.localeCompare(b.phenomenon)),
    latestEvent,
  };

  return { snapshot, events: outEvents };
}
