import type { SimulationRunState, TickAdvance, WorldTime } from "./types";

export const DEFAULT_TIME_SCALE = 1;
export const FOUNDING_GENERATION = 0;

interface CreateWorldTimeOptions {
  tick?: bigint;
  runState?: SimulationRunState;
  timeScale?: number;
  currentGeneration?: number;
}

export function createWorldTime(options: CreateWorldTimeOptions = {}): WorldTime {
  return {
    tick: options.tick ?? 0n,
    runState: options.runState ?? "paused",
    timeScale: options.timeScale ?? DEFAULT_TIME_SCALE,
    currentGeneration: options.currentGeneration ?? FOUNDING_GENERATION,
  };
}

export function pauseTime(time: WorldTime): WorldTime {
  return {
    ...time,
    runState: "paused",
  };
}

export function runTime(time: WorldTime): WorldTime {
  return {
    ...time,
    runState: "running",
  };
}

export function setTimeScale(time: WorldTime, timeScale: number): WorldTime {
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    throw new Error("Simulation timeScale must be a positive finite number.");
  }

  return {
    ...time,
    timeScale,
  };
}

export function advanceTicks(time: WorldTime, ticks: bigint): {
  time: WorldTime;
  advance: TickAdvance;
} {
  if (ticks < 0n) {
    throw new Error("Cannot advance simulation time by a negative tick count.");
  }

  const fromTick = time.tick;
  const toTick = fromTick + ticks;

  return {
    time: {
      ...time,
      tick: toTick,
    },
    advance: {
      fromTick,
      toTick,
      elapsedTicks: ticks,
    },
  };
}
