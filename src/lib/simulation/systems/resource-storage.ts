import { getFamilyGenerationsStateFromHumanState, FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY, type FamilyGenerationsResult } from "../family-generations-engine";
import { getHumanMvaStateAtTick } from "../human-engine";
import { HUMAN_TICK_RESULT_CACHE_KEY } from "../human-goals";
import type { HumanTickResult } from "../human-types";
import {
  getResourceStorageStateFromHumanState,
  RESOURCE_STORAGE_SYSTEM_ID,
  RESOURCE_STORAGE_TICK_RESULT_CACHE_KEY,
  resourceStorageEventToCausalEvent,
  type ResourceStorageSystemEvent,
} from "../resource-storage-engine";
import { getSettlementStateAtTick, SETTLEMENT_TICK_RESULT_CACHE_KEY, type SettlementTickResult } from "../settlement-engine";
import type { SimulationSystem, SimulationSystemContext, SimulationSystemEvent, SimulationSystemResult } from "./types";

const SYSTEM_NAME = RESOURCE_STORAGE_SYSTEM_ID;
const SYSTEM_LABEL = "Resource Storage & Shared Supplies Engine";
const SYSTEM_ORDER = 128;

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
  const result = getSettlementStateAtTick({ world: context.world, tick: context.tick, humanResult, previousHumanResult });
  context.cache.set(SETTLEMENT_TICK_RESULT_CACHE_KEY, result);
  return result;
}

function cachedFamilyResult(context: SimulationSystemContext, humanResult: HumanTickResult, settlementResult: SettlementTickResult): FamilyGenerationsResult {
  const cached = context.cache.get(FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY);
  if (cached && typeof cached === "object" && "families" in cached && "state" in cached) return cached as FamilyGenerationsResult;
  const previousHumanResult = context.tick > 0n ? getHumanMvaStateAtTick(context.world, context.tick - 1n) : null;
  const result = getFamilyGenerationsStateFromHumanState({
    worldId: context.world.id,
    tick: context.tick,
    state: humanResult.state,
    previousState: previousHumanResult?.state ?? null,
    settlements: settlementResult,
    worldSeed: context.seed,
  });
  context.cache.set(FAMILY_GENERATIONS_TICK_RESULT_CACHE_KEY, result);
  return result;
}

function resourceEventToSimulationEvent(event: ResourceStorageSystemEvent): SimulationSystemEvent {
  const causalEvent = resourceStorageEventToCausalEvent(event);

  return {
    type: causalEvent.type,
    title: event.title,
    description: event.summary,
    historicalWeight: event.importance,
    metadata: {
      eventId: event.id,
      tick: event.tick,
      kind: event.kind,
      settlementId: event.settlementId,
      cellId: event.cellId,
      humanIds: event.humanIds,
      resourceType: event.resourceType,
      quantity: event.quantity,
      chroniclerVisible: true,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const humanResult = cachedHumanResult(context);
  const settlementResult = cachedSettlementResult(context, humanResult);
  const familyResult = cachedFamilyResult(context, humanResult, settlementResult);
  const previousStorage = context.cache.get(`${RESOURCE_STORAGE_TICK_RESULT_CACHE_KEY}:previous`);
  const result = getResourceStorageStateFromHumanState({
    worldId: context.world.id,
    tick: context.tick,
    state: familyResult.state,
    settlements: settlementResult,
    previousStorage: previousStorage && typeof previousStorage === "object" && "storages" in previousStorage ? previousStorage as never : null,
  });
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedEvents = turboMode ? [] : fastMode ? result.events.slice(-2) : result.events;
  const totalQuantity = result.settlementSummaries.reduce((sum, summary) => sum + summary.totalQuantity, 0);

  context.cache.set(RESOURCE_STORAGE_TICK_RESULT_CACHE_KEY, result);
  context.cache.set(`${RESOURCE_STORAGE_TICK_RESULT_CACHE_KEY}:previous`, result);
  context.metrics.addEntities(result.storages.length + result.humanInventories.length + result.storages.reduce((sum, storage) => sum + storage.resources.length, 0));

  return {
    success: true,
    events: emittedEvents.map(resourceEventToSimulationEvent),
    health: {
      status: result.storages.length > 0 ? "Healthy" : "Warning",
      diagnostics: result.storages.length > 0 ? undefined : ["No active settlement storage exists yet."],
      metadata: {
        storageCount: result.storages.length,
        storedResourceQuantity: totalQuantity,
      },
    },
    metadata: {
      deterministic: true,
      implementationLayer: "resource storage and shared supplies architectural foundation",
      schedulerOrder: "after Family & Generations Engine and before Civilization",
      economy: "unmodeled",
      trade: "unmodeled",
      currency: "unmodeled",
      configurableScoring: true,
      storageCount: result.storages.length,
      settlementSummaries: result.settlementSummaries,
      humanInventories: result.humanInventories,
      storageScoring: result.scoring.slice(0, 12),
      emittedResourceStorageEvents: emittedEvents.length,
      suppressedResourceStorageEvents: result.events.length - emittedEvents.length,
      forbiddenSystemsImplemented: [],
    },
  };
}

export const resourceStorageSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: ["family-generations"],
  update: run,
  run,
};
