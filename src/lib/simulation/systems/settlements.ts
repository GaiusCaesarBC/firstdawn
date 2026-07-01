import { getHumanMvaStateAtTick } from "../human-engine";
import { HUMAN_TICK_RESULT_CACHE_KEY } from "../human-goals";
import {
  getSettlementStateAtTick,
  SETTLEMENT_SYSTEM_ID,
  SETTLEMENT_TICK_RESULT_CACHE_KEY,
  type SettlementSystemEvent,
} from "../settlement-engine";
import type { HumanTickResult } from "../human-types";
import type {
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemResult,
} from "./types";

const SYSTEM_NAME = SETTLEMENT_SYSTEM_ID;
const SYSTEM_LABEL = "Emergent Camps & Settlements Engine";
const SYSTEM_ORDER = 126;

function cachedHumanResult(context: SimulationSystemContext): HumanTickResult {
  const cached = context.cache.get(HUMAN_TICK_RESULT_CACHE_KEY);

  if (cached && typeof cached === "object" && "state" in cached && "newEvents" in cached) {
    return cached as HumanTickResult;
  }

  const result = getHumanMvaStateAtTick(context.world, context.tick);
  context.cache.set(HUMAN_TICK_RESULT_CACHE_KEY, result);

  return result;
}

function settlementEventToSimulationEvent(event: SettlementSystemEvent): SimulationSystemEvent {
  return {
    type: `Settlement ${event.kind}`,
    title: event.title,
    description: event.summary,
    historicalWeight: event.importance,
    metadata: {
      eventId: event.id,
      tick: event.tick,
      settlementId: event.settlementId,
      cellId: event.cellId,
      humanIds: event.humanIds,
      chroniclerVisible: true,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const humanResult = cachedHumanResult(context);
  const previousHumanResult = context.tick > 0n ? getHumanMvaStateAtTick(context.world, context.tick - 1n) : null;
  const result = getSettlementStateAtTick({
    world: context.world,
    tick: context.tick,
    humanResult,
    previousHumanResult,
  });
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  const emittedEvents = turboMode ? [] : fastMode ? result.events.slice(-2) : result.events;
  const activeSettlements = result.settlements.filter((settlement) => settlement.status !== "abandoned");

  context.cache.set(SETTLEMENT_TICK_RESULT_CACHE_KEY, result);
  context.metrics.addEntities(humanResult.state.agents.length + result.settlements.length);

  return {
    success: true,
    events: emittedEvents.map(settlementEventToSimulationEvent),
    health: {
      status: activeSettlements.length > 0 ? "Healthy" : "Warning",
      diagnostics: activeSettlements.length > 0 ? undefined : ["No active camps or settlements have emerged yet."],
      metadata: {
        settlementCount: result.settlements.length,
        activeSettlementCount: activeSettlements.length,
      },
    },
    metadata: {
      deterministic: true,
      implementationLayer: "emergent camps and settlements architectural foundation",
      schedulerOrder: "after Communication Engine and before Civilization",
      spawnedSettlements: false,
      configurableScoring: true,
      settlementCount: result.settlements.length,
      activeSettlementCount: activeSettlements.length,
      settlements: result.settlements,
      scoring: result.scoring.slice(0, 12),
      emittedSettlementEvents: emittedEvents.length,
      suppressedSettlementEvents: result.events.length - emittedEvents.length,
      forbiddenSystemsImplemented: [],
    },
  };
}

export const settlementsSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: ["communication"],
  update: run,
  run,
};