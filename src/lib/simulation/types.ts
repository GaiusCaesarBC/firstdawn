export type WorldId = string;

export type WorldMode = "production" | "staging" | "sandbox" | "experiment";

export type SimulationRunState = "paused" | "running";

export interface WorldTime {
  tick: bigint;
  runState: SimulationRunState;
  timeScale: number;
  currentGeneration: number;
}

export interface SimulationWorld {
  id: WorldId;
  name: string;
  mode: WorldMode;
  time: WorldTime;
}

export interface WorldScopedRecord {
  worldId: WorldId;
}

export interface TickAdvance {
  fromTick: bigint;
  toTick: bigint;
  elapsedTicks: bigint;
}

