import { getHumanMvaStateAtTick } from "../human-engine";
import { HUMAN_TICK_RESULT_CACHE_KEY } from "../human-goals";
import type { HumanTickResult } from "../human-types";
import {
  FAMILY_GENERATIONS_SYSTEM_ID,
  FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY,
  familyEventToCausalEvent,
  getFamilyGenerationsStateFromHumanState,
  type FamilySystemEvent,
} from "../family-generations-engine";
import { getSettlementStateAtTick, SETTLEMENT_TICK_RESULT_CACHE_KEY, type SettlementTickResult } from "../settlement-engine";
import type { SimulationSystem, SimulationSystemContext, SimulationSystemEvent, SimulationSystemResult } from "./types";

const SYSTEM_NAME = FAMILY_GENERATIONS_SYSTEM_ID;
const SYSTEM_LABEL = "Family & Generations Engine";
const SYSTEM_ORDER = 127;

function cachedHumanResult(context: SimulationSystemContext): HumanTickResult {
  const cached = context.cache.get(HUMAN_TICK_RESULT_CACHE_KEY);
  if (cached && typeof cached === "object" && "state" in cached && "newEvents" in cached) return cached as HumanTickResult;
  const result = getHumanMvaStateAtTick(context.world, context.tick);
  context.cache.set(HUMAN_TICK_RESULT_CACHE_KEY, result);
  return result;
}

function cachedSettlementResult(context: SimulationSystemContext, humanResult: HumanTickResult): SettlementTickResult {
  const cached = context.cache.get(SETTLEMENT_TICK_RESULT_CACHE_KEY);
  if (cached && typeof cached === "object" && "settlements" in cached && "events" in cached) return cached as SettlementTickResult;
  const previousHumanResult = context.tick > 0n ? getHumanMvaStateAtTick(context.world, context.tick - 1n) : null;
  return getSettlementStateAtTick({ world: context.world, tick: context.tick, humanResult, previousHumanResult });
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
  const previousHumanResult = context.tick > 0n ? getHumanMvaStateAtTick(context.world, context.tick - 1n) : null;
  const result = getFamilyGenerationsStateFromHumanState({
    worldId: context.world.id,
    tick: context.tick,
    state: humanResult.state,
    previousState: previousHumanResult?.state ?? null,
    settlements: settlementResult,
  });
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedEvents = turboMode ? [] : fastMode ? result.events.slice(-2) : result.events;

  context.cache.set(FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY, result);
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
        childCount: result.state.agents.filter((agent) => agent.ageStage === "Infant" || agent.ageStage === "Child" || agent.ageStage === "Adolescent").length,
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
};
