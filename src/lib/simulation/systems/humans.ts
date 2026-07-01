import { getHumanMvaStateAtTick } from "../human-engine";
import { HUMAN_TICK_RESULT_CACHE_KEY, isHumanGoalEvent } from "../human-goals";
import {
  HUMAN_SYSTEM_ID,
  type HumanCausalEvent,
} from "../human-types";
import type {
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemResult,
} from "./types";

const SYSTEM_NAME = HUMAN_SYSTEM_ID;
const SYSTEM_LABEL = "Humans";
const SYSTEM_ORDER = 120;

function humanEventToSimulationEvent(event: HumanCausalEvent): SimulationSystemEvent {
  return {
    type: event.type,
    title: event.title,
    description: event.summary,
    historicalWeight: 0.4,
    metadata: {
      eventId: event.id,
      tick: event.tick,
      agentIds: event.agentIds,
      cellId: event.cellId,
      causes: event.causes,
      effects: event.effects,
      memoryIds: event.memoryIds,
      chroniclerVisible: event.chroniclerVisible,
      agentVisible: event.agentVisible,
    },
  };
}

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const result = getHumanMvaStateAtTick(context.world, context.tick);
  const agentsAlive = result.state.agents.filter((agent) => agent.isAlive).length;
  const turboMode = context.fidelityMode === "turbo";
  const fastMode = context.fidelityMode === "fast";
  context.cache.set(HUMAN_TICK_RESULT_CACHE_KEY, result);
  const behaviorEvents = result.newEvents.filter((event) => !isHumanGoalEvent(event));
  const emittedEvents = turboMode ? [] : fastMode ? behaviorEvents.slice(-2) : behaviorEvents;
  const chroniclerReport = turboMode
    ? { ...result.chroniclerReport, entries: [] }
    : fastMode
      ? { ...result.chroniclerReport, entries: result.chroniclerReport.entries.slice(-2) }
      : result.chroniclerReport;

  context.metrics.addEntities(result.state.agents.length);

  return {
    success: true,
    events: emittedEvents.map(humanEventToSimulationEvent),
    health: {
      status: agentsAlive >= 2 ? "Healthy" : "Warning",
      diagnostics: agentsAlive >= 2 ? undefined : ["Human MVA has fewer than two living citizens."],
      metadata: {
        agentsAlive,
        totalAgents: result.state.agents.length,
      },
    },
    metadata: {
      deterministic: true,
      persistent: false,
      implementationLayer: "minimum viable agent foundation",
      forbiddenSystemsImplemented: [],
      replayedFromSpawn: true,
      agents: result.state.agents.map((agent) => ({
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
      })),
      relationships: result.state.relationships,
      memoryCount: result.state.memories.length,
      communicationCount: result.state.communications.length,
      teachingAttemptCount: result.state.teachingAttempts.length,
      emittedHumanEvents: emittedEvents.length,
      emittedGoalEventsDeferred: result.newEvents.filter((event) => isHumanGoalEvent(event)).length,
      suppressedHumanEvents: behaviorEvents.length - emittedEvents.length,
      chroniclerReport,
      agentIgnorance: {
        agentsReceiveObserverState: false,
        agentsKnowTheyAreSimulated: false,
        chroniclerCanMutate: false,
      },
    },
  };
}
export const humansSystem: SimulationSystem = {
  id: SYSTEM_NAME,
  name: SYSTEM_NAME,
  label: SYSTEM_LABEL,
  version: 1,
  order: SYSTEM_ORDER,
  dependencies: ["adaptation"],
  update: run,
  run,
};
