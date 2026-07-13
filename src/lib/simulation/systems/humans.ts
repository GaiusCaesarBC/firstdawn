import { createChroniclerReport } from "../chronicler";
import { getLatestCheckpoint } from "../checkpoint-store";
import { advanceHumanTick, spawnFirstTwoHumans } from "../human-engine";
import { normalizeHumanAppearances } from "../human-appearance";
import { HUMAN_TICK_RESULT_CACHE_KEY, isHumanGoalEvent } from "../human-goals";
import {
  HUMAN_SYSTEM_ID,
  type HumanCausalEvent,
  type HumanMvaState,
  type HumanTickResult,
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

type HumanRuntimeCheckpoint = {
  tick: bigint;
  state: HumanMvaState;
};

type HumanRuntimeCheckpointStore = {
  states: Map<string, HumanRuntimeCheckpoint>;
};

const humanRuntimeCheckpointSymbol = Symbol.for("first-dawn.human-runtime-checkpoints");
const humanRuntimeCheckpointStore =
  (globalThis as unknown as Record<symbol, HumanRuntimeCheckpointStore | undefined>)[humanRuntimeCheckpointSymbol] ?? {
    states: new Map<string, HumanRuntimeCheckpoint>(),
  };

if (!(globalThis as unknown as Record<symbol, HumanRuntimeCheckpointStore | undefined>)[humanRuntimeCheckpointSymbol]) {
  (globalThis as unknown as Record<symbol, HumanRuntimeCheckpointStore>)[humanRuntimeCheckpointSymbol] = humanRuntimeCheckpointStore;
}

function humanRuntimeCheckpointKey(context: SimulationSystemContext): string {
  return JSON.stringify({
    worldId: context.world.id,
    seed: context.world.seed?.trim() || "first-dawn-human-mva",
  });
}

function compactHumanCheckpointState(state: HumanMvaState): HumanMvaState {
  return {
    ...state,
    memories: state.memories.slice(-500),
    communications: state.communications.slice(-100),
    teachingAttempts: state.teachingAttempts.slice(-100),
    knowledge: state.knowledge.slice(-500),
    causalEvents: state.causalEvents.slice(-100),
  };
}

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

async function getCheckpointedHumanResult(context: SimulationSystemContext): Promise<HumanTickResult> {
  const systemId = "humans";
  const seed = context.world.seed?.trim() || "first-dawn-human-mva";
  const runtimeKey = humanRuntimeCheckpointKey(context);
  const runtimeCheckpoint = humanRuntimeCheckpointStore.states.get(runtimeKey);

  const dbCheckpoint =
    runtimeCheckpoint && runtimeCheckpoint.tick <= context.tick
      ? null
      : await getLatestCheckpoint<HumanMvaState>({
          worldId: context.world.id,
          systemId,
          tick: context.tick,
        });

  const selectedCheckpoint =
    runtimeCheckpoint && runtimeCheckpoint.tick <= context.tick
      ? runtimeCheckpoint
      : dbCheckpoint
        ? {
            tick: dbCheckpoint.tick,
            state: dbCheckpoint.state,
          }
        : null;

  let state = compactHumanCheckpointState(selectedCheckpoint?.state ?? spawnFirstTwoHumans(context.world, 0n));
  state = { ...state, agents: normalizeHumanAppearances(state.agents, seed) };
  const startTick = selectedCheckpoint ? selectedCheckpoint.tick + 1n : 1n;

  console.log("[humans-checkpoint]", {
    targetTick: context.tick.toString(),
    checkpointSource:
      runtimeCheckpoint && runtimeCheckpoint.tick <= context.tick
        ? "runtime"
        : dbCheckpoint
          ? "database"
          : "spawn",
    checkpointTick: selectedCheckpoint?.tick.toString() ?? "none",
    startTick: startTick.toString(),
    replayTicks: context.tick >= startTick ? (context.tick - startTick + 1n).toString() : "0",
    agents: state.agents.length,
    memories: state.memories.length,
    communications: state.communications.length,
    teachingAttempts: state.teachingAttempts.length,
    knowledge: state.knowledge.length,
    causalEvents: state.causalEvents.length,
  });

  let result: HumanTickResult = {
    state,
    newEvents: [],
    memoryEvents: [],
    relationshipEvents: [],
    knowledgeEvents: [],
    communicationEvents: [],
    chroniclerReport: createChroniclerReport(state, []),
  };

  for (let currentTick = startTick; currentTick <= context.tick; currentTick += 1n) {
    console.time(`[humans] advance ${currentTick.toString()}`);
    result = advanceHumanTick(result.state, seed, currentTick);
    console.timeEnd(`[humans] advance ${currentTick.toString()}`);

    state = compactHumanCheckpointState(result.state);

    humanRuntimeCheckpointStore.states.set(runtimeKey, {
      tick: currentTick,
      state,
    });

    result = {
      ...result,
      state,
      chroniclerReport: createChroniclerReport(state, result.newEvents),
    };
  }

  if (context.tick < startTick) {
    humanRuntimeCheckpointStore.states.set(runtimeKey, {
      tick: selectedCheckpoint?.tick ?? context.tick,
      state,
    });
  }

  return result;
}

export async function run(context: SimulationSystemContext): Promise<SimulationSystemResult> {
  const result = await getCheckpointedHumanResult(context);
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
      persistent: true,
      implementationLayer: "minimum viable agent foundation",
      forbiddenSystemsImplemented: [],
      checkpointed: true,
      checkpointPersistence: "runtime-memory-with-database-seed",
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