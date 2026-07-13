import { Prisma } from "@prisma/client";

import { createChroniclerReport } from "../src/lib/simulation/chronicler";
import { getFamilyGenerationsStateFromHumanState } from "../src/lib/simulation/family-generations-engine";
import { advanceHumanTick } from "../src/lib/simulation/human-engine";
import type { HumanAgent, HumanCausalEvent, HumanMvaState, HumanTickResult } from "../src/lib/simulation/human-types";
import { getSettlementStateAtTick } from "../src/lib/simulation/settlement-engine";
import { persistAtlasSnapshotForTick } from "../src/lib/simulation/snapshot-store";
import { prisma, type WorldWithPlanet } from "../src/lib/worlds/world-lifecycle";

const SANDBOX_SLUG = "local-sandbox";
const SANDBOX_ENVIRONMENT = "SANDBOX";
const HUMAN_SYSTEM_ID = "humans";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonSafe<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function agentsFromState(state: HumanMvaState) {
  return state.agents.map((agent) => ({
    id: agent.id,
    sex: agent.sex,
    approxAgeYears: agent.approxAgeYears,
    isAlive: agent.isAlive,
    currentCellId: agent.currentCellId,
    previousCellId: agent.previousCellId,
    destinationCellId: agent.destinationCellId,
    movementIntent: agent.movementIntent,
    movementReason: agent.movementReason,
    lastMovedTick: agent.lastMovedTick,
    recentPath: agent.recentPath,
    stuckTicks: agent.stuckTicks,
    distanceTraveled: agent.distanceTraveled,
    explorationCount: agent.explorationCount,
    generation: agent.generation,
    motherId: agent.motherId,
    fatherId: agent.fatherId,
    biologicalParentIds: agent.biologicalParentIds,
    guardianIds: agent.guardianIds,
    childIds: agent.childIds,
    siblingIds: agent.siblingIds,
    mateId: agent.mateId,
    familyId: agent.familyId,
    lineageId: agent.lineageId,
    ageStage: agent.ageStage,
    birthplaceCellId: agent.birthplaceCellId,
    birthplaceSettlementId: agent.birthplaceSettlementId,
    inheritedHomeCellId: agent.inheritedHomeCellId,
    inheritedSettlementId: agent.inheritedSettlementId,
    ancestryTags: agent.ancestryTags,
    needs: agent.needs,
    lastDecision: agent.lastDecision,
  }));
}

function getPipeline(metadata: Prisma.JsonValue | null): JsonRecord[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.pipeline)) {
    return [];
  }

  return (metadata.pipeline as unknown[]).filter((entry): entry is JsonRecord => isRecord(entry));
}

function setPipelineEntryMetadata(metadata: JsonRecord, systemName: string, patch: JsonRecord) {
  const pipeline = getPipeline(metadata as Prisma.JsonValue);
  const entry = pipeline.find((item) => item.name === systemName || item.label === systemName);

  if (!entry) {
    return;
  }

  const previousMetadata = isRecord(entry.metadata) ? entry.metadata : {};
  const previousHealth = isRecord(entry.health) ? entry.health : {};
  entry.metadata = { ...previousMetadata, ...patch };

  if (systemName === "humans") {
    entry.health = {
      ...previousHealth,
      metadata: {
        ...(isRecord(previousHealth.metadata) ? previousHealth.metadata : {}),
        agentsAlive: (patch.agents as JsonRecord[]).filter((agent) => agent.isAlive === true).length,
        totalAgents: (patch.agents as JsonRecord[]).length,
      },
    };
  }

  if (systemName === "family-generations") {
    entry.health = {
      ...previousHealth,
      metadata: {
        ...(isRecord(previousHealth.metadata) ? previousHealth.metadata : {}),
        childCount: (patch.agents as JsonRecord[]).filter((agent) => {
          const age = typeof agent.approxAgeYears === "number" ? agent.approxAgeYears : 0;
          return age < 18;
        }).length,
      },
    };
  }
}

function childIdFromBirthMetadata(metadata: Prisma.JsonValue | null): string | null {
  if (!isRecord(metadata) || !Array.isArray(metadata.humanIds)) {
    return null;
  }

  const ids = metadata.humanIds.filter((id): id is string => typeof id === "string");
  return ids.find((id) => id.includes(":child:")) ?? null;
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined)));
}

function sexForChild(worldId: string, tick: bigint, ordinal: number, parentIds: readonly string[]): "male" | "female" {
  const text = `${worldId}:${tick.toString()}:${ordinal}:${parentIds.join(":")}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619);
  }
  return (hash >>> 0) % 2 === 0 ? "female" : "male";
}

function relationship(worldId: string, fromId: string, toId: string, kinship: "parent" | "child" | "partner", tick: bigint) {
  const parentChild = kinship === "parent" || kinship === "child";
  const partner = kinship === "partner";
  return {
    worldId,
    humanId: fromId,
    targetHumanId: toId,
    fromAgentId: fromId,
    toAgentId: toId,
    createdTick: tick.toString(),
    kinship,
    familiarity: parentChild ? 0.9 : 0.82,
    trust: parentChild ? 0.88 : 0.82,
    affection: parentChild ? 0.92 : 0.84,
    fear: 0,
    respect: 0.64,
    rivalry: 0,
    resentment: 0,
    dependency: kinship === "child" ? 0.85 : kinship === "parent" ? 0.35 : 0.2,
    grief: 0,
    attraction: partner ? 0.82 : 0,
    companionship: parentChild ? 0.74 : 0.82,
    socialMemoryScore: 0.72,
    status: partner ? "Mate" : "Family",
    tags: unique([kinship, "family", parentChild ? "care" : "kinship"]),
    history: [{ tick: tick.toString(), event: "family bond formed", summary: `Kinship ${kinship} restored by the Sandbox birth repair.`, deltas: { familiarity: 0.72, trust: 0.72, affection: 0.72 }, sourceEventId: null }],
    lastInteractionTick: tick.toString(),
  };
}

function upsertRelationshipRecord<T extends { fromAgentId: string; toAgentId: string }>(relationships: T[], next: T): T[] {
  const index = relationships.findIndex((entry) => entry.fromAgentId === next.fromAgentId && entry.toAgentId === next.toAgentId);
  return index < 0 ? [...relationships, next] : relationships.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...next } : entry);
}

function materializeChildFromBirthEvent(state: HumanMvaState, metadata: JsonRecord, tick: bigint): HumanMvaState {
  const humanIds = Array.isArray(metadata.humanIds) ? metadata.humanIds.filter((id): id is string => typeof id === "string") : [];
  const childId = humanIds.find((id) => id.includes(":child:"));
  const parentIds = humanIds.filter((id) => id !== childId).sort();

  if (!childId || parentIds.length < 2) {
    throw new Error("Birth event metadata did not include one child and two parents.");
  }

  if (state.agents.some((agent) => agent.id === childId)) {
    return state;
  }

  const parents = parentIds.map((id) => state.agents.find((agent) => agent.id === id));
  if (parents.some((parent) => !parent)) {
    throw new Error(`Birth parents were not found in checkpoint state: ${parentIds.join(", ")}`);
  }

  const typedParents = parents as NonNullable<(typeof parents)[number]>[];
  const mother = typedParents.find((parent) => parent.sex === "female") ?? typedParents[0];
  const father = typedParents.find((parent) => parent.sex === "male") ?? typedParents[1] ?? typedParents[0];
  const familyId = typeof metadata.familyId === "string" ? metadata.familyId : `${state.worldId}:family:repaired:first-humans`;
  const lineageId = typeof metadata.lineageId === "string" ? metadata.lineageId : `${state.worldId}:lineage:first-humans`;
  const settlementId = typeof metadata.settlementId === "string" ? metadata.settlementId : null;
  const birthplaceCellId = typeof metadata.cellId === "string" ? metadata.cellId : mother.currentCellId;
  const homeCellId = birthplaceCellId;
  const ordinal = 1;
  const birthHistory = { tick: tick.toString(), type: "Birth", summary: `Born into ${familyId} at ${birthplaceCellId}.`, relatedHumanIds: parentIds, settlementId };
  const child: HumanAgent = {
    ...mother,
    id: childId,
    sex: sexForChild(state.worldId, tick, ordinal, parentIds),
    isAlive: true,
    birthTick: tick.toString(),
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
    homeProfile: { ...mother.homeProfile, primaryHomeCellId: homeCellId, preferredSleepingCellId: homeCellId, birthplaceCellId, knownSafeCellIds: unique([homeCellId, ...(mother.homeProfile?.knownSafeCellIds ?? [])]), favoriteGatheringCellIds: unique([homeCellId, ...(mother.homeProfile?.favoriteGatheringCellIds ?? [])]), cellAffinities: { ...(mother.homeProfile?.cellAffinities ?? {}), [homeCellId]: 0.92 }, lastUpdatedTick: tick.toString() },
    motherId: mother.id,
    fatherId: father.id,
    generation: Math.max(...typedParents.map((parent) => parent.generation)) + 1,
    biologicalParentIds: parentIds,
    guardianIds: parentIds,
    childIds: [],
    siblingIds: [],
    mateId: null,
    familyId,
    lineageId,
    ageStage: "Infant",
    birthplaceCellId,
    birthplaceSettlementId: settlementId,
    inheritedHomeCellId: homeCellId,
    inheritedSettlementId: settlementId,
    ancestryTags: unique(["born-in-simulation", `birthplace:${birthplaceCellId}`, ...(settlementId ? [`settlement:${settlementId}`] : []), ...typedParents.flatMap((parent) => parent.ancestryTags ?? [])]),
    familyHistory: [birthHistory],
    needs: { hunger: 0.22, thirst: 0.24, fatigue: 0.42, safety: 0.08, social: 0.16 },
    emotions: { ...mother.emotions, fear: 0.08, distress: 0.12, comfort: 0.62, trust: 0.72, attachment: 0.78, loneliness: 0.04, relief: 0.4 },
    motivations: { ...mother.motivations, explore: 0.02, learn: 0.18, socialize: 0.28, restVoluntary: 0.3, teach: 0 },
    confidence: 0.08,
    familiarityByCell: { [birthplaceCellId]: 0.88, [homeCellId]: 0.9 },
    safetyStreak: 0,
    currentGoal: { id: `${childId}:goal:${tick.toString()}:stay-near-family:${mother.id}`, type: "Stay Near Family", priority: 1, createdTick: tick.toString(), targetId: mother.id, targetCellId: mother.currentCellId, progress: 0, confidence: 0.92, reason: "Following Parent", status: "Active" },
    goalHistory: [],
    beliefs: { "family:guardians": { claim: "My guardians are safety and home.", confidence: 0.92, valence: 0.84, lastUpdatedTick: tick.toString() }, "home:birthplace": { claim: `Home begins at ${birthplaceCellId}.`, confidence: 0.9, valence: 0.82, lastUpdatedTick: tick.toString() } },
    theoryOfMind: {},
    lastDecision: null,
  };

  let relationships = [...state.relationships];
  for (const parent of typedParents) {
    relationships = upsertRelationshipRecord(relationships, relationship(state.worldId, parent.id, childId, "parent", tick) as never);
    relationships = upsertRelationshipRecord(relationships, relationship(state.worldId, childId, parent.id, "child", tick) as never);
  }
  relationships = upsertRelationshipRecord(relationships, relationship(state.worldId, mother.id, father.id, "partner", tick) as never);
  relationships = upsertRelationshipRecord(relationships, relationship(state.worldId, father.id, mother.id, "partner", tick) as never);

  const agents = state.agents.map((agent) => parentIds.includes(agent.id)
    ? {
      ...agent,
      childIds: unique([...(agent.childIds ?? []), childId]),
      mateId: parentIds.find((id) => id !== agent.id) ?? agent.mateId,
      familyId,
      lineageId,
      ancestryTags: unique([...(agent.ancestryTags ?? []), "parent", ...(settlementId ? [`settlement:${settlementId}`] : [])]),
      familyHistory: [...(agent.familyHistory ?? []), birthHistory].slice(-24),
    }
    : agent);

  const birthCausalEvent: HumanCausalEvent = {
    id: typeof metadata.eventId === "string" ? metadata.eventId : `${state.worldId}:family-event:${tick.toString()}:birth:${childId}`,
    worldId: state.worldId,
    tick: tick.toString(),
    type: "Human Birth",
    title: "First Birth",
    summary: `${childId} was born to ${parentIds.join(" and ")}.`,
    agentIds: [childId, ...parentIds].sort(),
    cellId: birthplaceCellId,
    causes: { familyId, lineageId, settlementId: settlementId ?? "" },
    effects: { childId, parentIds },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: true,
  };

  return {
    ...state,
    tick: tick.toString(),
    agents: [...agents, child],
    relationships,
    causalEvents: state.causalEvents.some((event) => event.id === birthCausalEvent.id)
      ? state.causalEvents
      : [...state.causalEvents, birthCausalEvent].slice(-100),
  };
}
async function main() {
  const world = await prisma.world.findUnique({
    where: { slug: SANDBOX_SLUG },
    include: { planet: true },
  });

  if (!world) {
    throw new Error(`Sandbox world ${SANDBOX_SLUG} was not found.`);
  }

  if (world.environment !== SANDBOX_ENVIRONMENT || world.slug !== SANDBOX_SLUG) {
    throw new Error(`Refusing repair for non-sandbox world ${world.slug} (${world.environment}).`);
  }

  if ((world.environment as string) === "PRODUCTION" || world.protected) {
    throw new Error(`Refusing repair for protected/production world ${world.slug}.`);
  }

  const tick = BigInt(world.currentTick ?? 0);
  const birthEvents = await prisma.event.findMany({
    where: { worldId: world.id, type: "Human Birth" },
    orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: { id: true, tick: true, metadata: true, title: true },
  });
  const birthEvent = birthEvents.find((event) => childIdFromBirthMetadata(event.metadata));
  const expectedChildId = birthEvent ? childIdFromBirthMetadata(birthEvent.metadata) : null;

  if (!expectedChildId) {
    throw new Error("No Sandbox Human Birth event with a child id was found; refusing to infer a child without an event.");
  }

  const latestCheckpoint = await prisma.simulationCheckpoint.findFirst({
    where: { worldId: world.id, systemId: HUMAN_SYSTEM_ID, tick: { lte: tick } },
    orderBy: { tick: "desc" },
  });

  if (!latestCheckpoint) {
    throw new Error("No humans checkpoint exists for the Sandbox world.");
  }

  const latestCheckpointState = latestCheckpoint.state as unknown as HumanMvaState;
  const existingMatches = latestCheckpointState.agents.filter((agent) => agent.id === expectedChildId).length;
  let finalState = latestCheckpointState;
  let repairedFromTick: string | null = null;

  if (existingMatches !== 1 || latestCheckpointState.agents.length < 3) {
    const birthTick = BigInt(birthEvent!.tick);
    const sourceCheckpoint = await prisma.simulationCheckpoint.findFirst({
      where: { worldId: world.id, systemId: HUMAN_SYSTEM_ID, tick: { lt: birthTick } },
      orderBy: { tick: "desc" },
    });

    if (!sourceCheckpoint) {
      throw new Error(`No humans checkpoint exists before birth tick ${birthTick.toString()}.`);
    }

    const checkpointState = sourceCheckpoint.state as unknown as HumanMvaState;
    let result: HumanTickResult = {
      state: checkpointState,
      newEvents: [],
      memoryEvents: [],
      relationshipEvents: [],
      knowledgeEvents: [],
      communicationEvents: [],
      chroniclerReport: createChroniclerReport(checkpointState, []),
    };
    let previousHumanResult: HumanTickResult | null = null;

    for (let currentTick = BigInt(sourceCheckpoint.tick) + 1n; currentTick <= tick; currentTick += 1n) {
      previousHumanResult = result;
      result = advanceHumanTick(result.state, world.seed?.trim() || "first-dawn-human-mva", currentTick);
    }

    const settlementResult = getSettlementStateAtTick({
      world: world as WorldWithPlanet,
      tick,
      humanResult: result,
      previousHumanResult,
    });
    const familyResult = getFamilyGenerationsStateFromHumanState({
      worldId: world.id,
      tick,
      state: result.state,
      previousState: previousHumanResult?.state ?? null,
      settlements: settlementResult,
    });
    finalState = familyResult.state;
    repairedFromTick = sourceCheckpoint.tick.toString();
  }

  let finalMatches = finalState.agents.filter((agent) => agent.id === expectedChildId).length;
  if (finalMatches !== 1 || finalState.agents.length < 3) {
    finalState = materializeChildFromBirthEvent(latestCheckpointState, birthEvent!.metadata as JsonRecord, BigInt(birthEvent!.tick));
    repairedFromTick = repairedFromTick ? `${repairedFromTick};event-materialized` : "event-materialized";
    finalMatches = finalState.agents.filter((agent) => agent.id === expectedChildId).length;
  }

  if (finalMatches !== 1 || finalState.agents.length < 3) {
    throw new Error(`Repair did not produce exactly one expected child. matches=${finalMatches}, agents=${finalState.agents.length}`);
  }

  await prisma.simulationCheckpoint.upsert({
    where: {
      worldId_systemId_tick: {
        worldId: world.id,
        systemId: HUMAN_SYSTEM_ID,
        tick,
      },
    },
    update: {
      state: jsonSafe(finalState),
      metadata: jsonSafe({
        source: "repair-sandbox-human-birth",
        idempotent: true,
        expectedChildId,
        birthEventId: birthEvent?.id ?? null,
        repairedFromTick,
      }),
    },
    create: {
      worldId: world.id,
      systemId: HUMAN_SYSTEM_ID,
      tick,
      state: jsonSafe(finalState),
      metadata: jsonSafe({
        source: "repair-sandbox-human-birth",
        idempotent: true,
        expectedChildId,
        birthEventId: birthEvent?.id ?? null,
        repairedFromTick,
      }),
    },
  });

  const agents = agentsFromState(finalState) as unknown as JsonRecord[];
  const chroniclerReport = createChroniclerReport(finalState, finalState.causalEvents.slice(-8));
  const simulationTick = await prisma.simulationTick.findUnique({
    where: { worldId_tick: { worldId: world.id, tick } },
    select: { metadata: true },
  });

  if (!simulationTick) {
    throw new Error(`No SimulationTick exists for Sandbox tick ${tick.toString()}.`);
  }

  const tickMetadata = isRecord(simulationTick.metadata) ? simulationTick.metadata : {};
  setPipelineEntryMetadata(tickMetadata, "humans", {
    agents,
    relationships: finalState.relationships,
    chroniclerReport,
  });
  setPipelineEntryMetadata(tickMetadata, "family-generations", {
    agents,
    relationships: finalState.relationships,
    chroniclerReport,
  });

  if (isRecord(tickMetadata.publicBroadcast)) {
    tickMetadata.publicBroadcast = {
      ...tickMetadata.publicBroadcast,
      activeHumans: finalState.agents.filter((agent) => agent.isAlive).length,
    };
  }

  await prisma.simulationTick.update({
    where: { worldId_tick: { worldId: world.id, tick } },
    data: { metadata: jsonSafe(tickMetadata) },
  });

  const refreshAtlas = process.argv.includes("--refresh-atlas");
  const atlas = refreshAtlas ? await persistAtlasSnapshotForTick(world as WorldWithPlanet, tick) : null;

  console.log(JSON.stringify({
    worldId: world.id,
    slug: world.slug,
    environment: world.environment,
    tick: tick.toString(),
    checkpointTick: tick.toString(),
    latestSourceCheckpointTick: latestCheckpoint.tick.toString(),
    repairedFromTick,
    expectedChildId,
    birthEventId: birthEvent?.id ?? null,
    humanCount: finalState.agents.length,
    children: finalState.agents.filter((agent) => agent.approxAgeYears < 18).length,
    atlasRefreshed: Boolean(atlas),
    atlasSelectedDay: atlas?.selectedDay ?? null,
    atlasHumans: atlas?.snapshot.humans.agents.length ?? null,
    atlasChildren: atlas?.snapshot.humans.agents.filter((agent) => agent.approxAgeYears < 18).length ?? null,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });