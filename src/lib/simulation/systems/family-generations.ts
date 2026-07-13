import { createChroniclerReport } from "../chronicler";
import { HUMAN_TICK_RESULT_CACHE_KEY } from "../human-goals";
import type { HumanTickResult } from "../human-types";
import {
  FAMILY_GENERATIONS_SYSTEM_ID,
  FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY,
  familyEventToCausalEvent,
  getFamilyGenerationsStateFromHumanState,
  type FamilySystemEvent,
} from "../family-generations-engine";
import {
  getSettlementStateAtTick,
  SETTLEMENT_TICK_RESULT_CACHE_KEY,
  type SettlementTickResult,
} from "../settlement-engine";
import type {
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemResult,
} from "./types";

const SYSTEM_NAME = FAMILY_GENERATIONS_SYSTEM_ID;
const SYSTEM_LABEL = "Family & Generations Engine";
const SYSTEM_ORDER = 127;

function jsonSafe<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

function shouldPersistHumanCheckpoint(context: SimulationSystemContext, familyEventCount: number): boolean {
  return Boolean(context.checkpoint) || context.tick % 100n === 0n || familyEventCount > 0;
}

function serializeHumanAgents(result: HumanTickResult) {
  return result.state.agents.map((agent) => ({
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

function cachedHumanResult(context: SimulationSystemContext): HumanTickResult {
  const cached = context.cache.get(HUMAN_TICK_RESULT_CACHE_KEY);

  if (cached && typeof cached === "object" && "state" in cached && "newEvents" in cached) {
    return cached as HumanTickResult;
  }

  throw new Error("Family Generations requires the cached human result from the humans system.");
}

function cachedSettlementResult(
  context: SimulationSystemContext,
  humanResult: HumanTickResult,
): SettlementTickResult {
  const cached = context.cache.get(SETTLEMENT_TICK_RESULT_CACHE_KEY);

  if (cached && typeof cached === "object" && "settlements" in cached && "events" in cached) {
    return cached as SettlementTickResult;
  }

  const previousHumanResult: HumanTickResult | null = null;

  const result = getSettlementStateAtTick({
    world: context.world,
    tick: context.tick,
    humanResult,
    previousHumanResult,
  });

  context.cache.set(SETTLEMENT_TICK_RESULT_CACHE_KEY, result);

  return result;
}

function familyEventToSimulationEvent(event: FamilySystemEvent): SimulationSystemEvent {
  const causalEvent = familyEventToCausalEvent(event);

  return {
    type: causalEvent.type,
    title: event.title,
    description: event.summary,
    historicalWeight: event.importance,
    metadata: {
      eventId: event.id,
      tick: event.tick,
      kind: event.kind,
      familyId: event.familyId,
      lineageId: event.lineageId,
      settlementId: event.settlementId,
      cellId: event.cellId,
      humanIds: event.humanIds,
      chroniclerVisible: true,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const humanResult = cachedHumanResult(context);
  const settlementResult = cachedSettlementResult(context, humanResult);

  const result = getFamilyGenerationsStateFromHumanState({
    worldId: context.world.id,
    tick: context.tick,
    state: humanResult.state,
    previousState: null,
    settlements: settlementResult,
    worldSeed: context.seed,
  });

  const familyCausalEvents = result.events.map(familyEventToCausalEvent);
  const promotedHumanResult: HumanTickResult = {
    ...humanResult,
    state: result.state,
    newEvents: [...humanResult.newEvents, ...familyCausalEvents],
    chroniclerReport: createChroniclerReport(result.state, [
      ...humanResult.newEvents,
      ...familyCausalEvents,
    ]),
  };
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedEvents = turboMode ? [] : fastMode ? result.events.slice(-2) : result.events;

  context.cache.set(FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY, result);
  context.cache.set(HUMAN_TICK_RESULT_CACHE_KEY, promotedHumanResult);
  context.metrics.addEntities(result.state.agents.length + result.families.length + result.lineages.length);

  return {
    success: true,
    events: emittedEvents.map(familyEventToSimulationEvent),
    health: {
      status: result.families.length > 0 ? "Healthy" : "Warning",
      diagnostics: result.families.length > 0 ? undefined : ["No family records were available."],
      metadata: {
        familyCount: result.families.length,
        lineageCount: result.lineages.length,
        childCount: result.state.agents.filter(
          (agent) =>
            agent.ageStage === "Infant" ||
            agent.ageStage === "Child" ||
            agent.ageStage === "Adolescent",
        ).length,
      },
    },
    metadata: {
      deterministic: true,
      implementationLayer: "deterministic family and generations engine",
      schedulerOrder: "after Emergent Camps & Settlements Engine and before Civilization",
      scriptedSpawnFamilyShortcut: false,
      configurableScoring: true,
      familyCount: result.families.length,
      lineageCount: result.lineages.length,
      families: result.families,
      lineages: result.lineages,
      settlementSummaries: result.settlementSummaries,
      birthScoring: result.scoring.slice(0, 12),
      agents: serializeHumanAgents(promotedHumanResult),
      relationships: promotedHumanResult.state.relationships,
      chroniclerReport: promotedHumanResult.chroniclerReport,
      emittedFamilyEvents: emittedEvents.length,
      suppressedFamilyEvents: result.events.length - emittedEvents.length,
      forbiddenSystemsImplemented: [],
    },
  };
}

export const familyGenerationsSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: ["settlements"],
  update: run,
  run,
  async persist(context) {
    const familyResult = context.cache.get(FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY);
    const humanResult = context.cache.get(HUMAN_TICK_RESULT_CACHE_KEY);

    if (
      !familyResult ||
      typeof familyResult !== "object" ||
      !("events" in familyResult) ||
      !humanResult ||
      typeof humanResult !== "object" ||
      !("state" in humanResult)
    ) {
      return;
    }

    const promotedHumanResult = humanResult as HumanTickResult;
    const eventCount = Array.isArray(familyResult.events) ? familyResult.events.length : 0;
    if (!shouldPersistHumanCheckpoint(context, eventCount)) {
      return;
    }

    await context.client.simulationCheckpoint.upsert({
      where: {
        worldId_systemId_tick: {
          worldId: context.world.id,
          systemId: "humans",
          tick: context.tick,
        },
      },
      update: {
        state: jsonSafe(promotedHumanResult.state),
        metadata: jsonSafe({
          sourceSystemId: SYSTEM_NAME,
          promotedAfterFamilyGenerations: true,
          familyEventCount: eventCount,
        }),
      },
      create: {
        worldId: context.world.id,
        systemId: "humans",
        tick: context.tick,
        state: jsonSafe(promotedHumanResult.state),
        metadata: jsonSafe({
          sourceSystemId: SYSTEM_NAME,
          promotedAfterFamilyGenerations: true,
          familyEventCount: eventCount,
        }),
      },
    });
  },
};
