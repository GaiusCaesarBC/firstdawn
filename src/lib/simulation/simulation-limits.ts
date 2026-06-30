export const DEFAULT_MAX_SIMULATION_YEARS = 10_000;
export const DEFAULT_SIMULATION_CHECKPOINT_TICKS = 1_000;
export const DEFAULT_ACCURATE_MAX_UNCONFIRMED_TICKS = 50_000;

export type SimulationDurationUnit = "ticks" | "days" | "years";
export type SimulationFidelityMode = "accurate" | "fast" | "turbo";

export type SimulationTimeConfig = {
  tickDurationSeconds: number;
  dayLengthSeconds: number;
  yearLengthDays: number;
};

export type SimulationDurationInput = {
  value: number;
  unit: SimulationDurationUnit;
};

export type SimulationFidelityPlan = {
  mode: SimulationFidelityMode;
  label: string;
  totalTicks: number;
  effectiveSystemTicks: number;
  tickStride: number;
  checkpointEveryTicks: number;
  persistTickEveryTicks: number;
  uiUpdateEveryTicks: number;
  estimatedRuntimeScale: number;
  accuracyLevel: string;
  eventLogging: "full" | "checkpoint" | "minimal";
  chronicler: "full" | "throttled" | "minimal";
  atlasSnapshots: "full" | "checkpoint" | "start-end-checkpoint";
  approximate: boolean;
  warning: string | null;
};

export const SIMULATION_FIDELITY_MODES: readonly SimulationFidelityMode[] = [
  "accurate",
  "fast",
  "turbo",
];

export const SIMULATION_FIDELITY_LABELS: Record<SimulationFidelityMode, string> = {
  accurate: "Accurate",
  fast: "Fast",
  turbo: "Turbo Test",
};

export const SIMULATION_FIDELITY_ACCURACY: Record<SimulationFidelityMode, string> = {
  accurate: "Exact scheduler behavior",
  fast: "High fidelity aggregate replay",
  turbo: "Approximate development signal",
};

function readEnvNumber(name: string, fallback: number): number {
  const value = typeof process === "undefined" ? undefined : process.env[name];
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function positiveIntegerOrDefault(value: number | null | undefined, fallback: number): number {
  const normalized = positiveOrDefault(value, fallback);
  return Number.isInteger(normalized) ? normalized : fallback;
}

function configuredInterval(name: string, fallback: number): number {
  return Math.max(1, Math.floor(readEnvNumber(name, fallback)));
}

export function getConfiguredMaxSimulationYears(): number {
  return readEnvNumber("ATLAS_MAX_SIMULATION_YEARS", DEFAULT_MAX_SIMULATION_YEARS);
}

export function getConfiguredSimulationCheckpointTicks(): number {
  return Math.max(
    1,
    Math.floor(readEnvNumber("ATLAS_SIMULATION_CHECKPOINT_TICKS", DEFAULT_SIMULATION_CHECKPOINT_TICKS)),
  );
}

export function getConfiguredAccurateMaxUnconfirmedTicks(): number {
  return Math.max(
    1,
    Math.floor(readEnvNumber("ATLAS_ACCURATE_MAX_UNCONFIRMED_TICKS", DEFAULT_ACCURATE_MAX_UNCONFIRMED_TICKS)),
  );
}

export function normalizeSimulationFidelityMode(value: string | null | undefined): SimulationFidelityMode {
  return SIMULATION_FIDELITY_MODES.includes(value as SimulationFidelityMode)
    ? value as SimulationFidelityMode
    : "accurate";
}

export function getTicksPerDay(config: SimulationTimeConfig): number {
  const tickDurationSeconds = positiveOrDefault(config.tickDurationSeconds, 60);
  const dayLengthSeconds = positiveOrDefault(config.dayLengthSeconds, 86_400);
  return dayLengthSeconds / tickDurationSeconds;
}

export function getTicksPerYear(config: SimulationTimeConfig): number {
  return getTicksPerDay(config) * positiveIntegerOrDefault(config.yearLengthDays, 365);
}

export function getMaxSimulationTicks(
  config: SimulationTimeConfig,
  maxYears = getConfiguredMaxSimulationYears(),
): number {
  return Math.floor(Math.min(Number.MAX_SAFE_INTEGER, getTicksPerYear(config) * maxYears));
}

export function getSimulationFidelityPlan(
  modeInput: SimulationFidelityMode,
  totalTicks: number,
  config: SimulationTimeConfig,
): SimulationFidelityPlan {
  const mode = normalizeSimulationFidelityMode(modeInput);
  const safeTotalTicks = Number.isFinite(totalTicks) && totalTicks > 0 ? Math.floor(totalTicks) : 0;
  const ticksPerDay = Math.max(1, Math.round(getTicksPerDay(config)));
  const ticksPerYear = Math.max(ticksPerDay, Math.round(getTicksPerYear(config)));
  const accurateCheckpoint = getConfiguredSimulationCheckpointTicks();

  if (mode === "fast") {
    const tickStride = ticksPerDay;
    const checkpointEveryTicks = configuredInterval(
      "ATLAS_FAST_SIMULATION_CHECKPOINT_TICKS",
      Math.max(accurateCheckpoint, ticksPerDay * 30),
    );
    const persistTickEveryTicks = configuredInterval(
      "ATLAS_FAST_SIMULATION_PERSIST_TICKS",
      Math.max(ticksPerDay, ticksPerDay * 7),
    );
    const effectiveSystemTicks = safeTotalTicks > 0 ? Math.ceil(safeTotalTicks / tickStride) : 0;

    return {
      mode,
      label: SIMULATION_FIDELITY_LABELS[mode],
      totalTicks: safeTotalTicks,
      effectiveSystemTicks,
      tickStride,
      checkpointEveryTicks,
      persistTickEveryTicks,
      uiUpdateEveryTicks: checkpointEveryTicks,
      estimatedRuntimeScale: safeTotalTicks > 0 ? effectiveSystemTicks / safeTotalTicks : 0,
      accuracyLevel: SIMULATION_FIDELITY_ACCURACY[mode],
      eventLogging: "checkpoint",
      chronicler: "throttled",
      atlasSnapshots: "checkpoint",
      approximate: true,
      warning: null,
    };
  }

  if (mode === "turbo") {
    const tickStride = ticksPerYear;
    const checkpointEveryTicks = configuredInterval(
      "ATLAS_TURBO_SIMULATION_CHECKPOINT_TICKS",
      Math.max(ticksPerYear, ticksPerYear * 10),
    );
    const persistTickEveryTicks = configuredInterval(
      "ATLAS_TURBO_SIMULATION_PERSIST_TICKS",
      checkpointEveryTicks,
    );
    const effectiveSystemTicks = safeTotalTicks > 0 ? Math.ceil(safeTotalTicks / tickStride) : 0;

    return {
      mode,
      label: SIMULATION_FIDELITY_LABELS[mode],
      totalTicks: safeTotalTicks,
      effectiveSystemTicks,
      tickStride,
      checkpointEveryTicks,
      persistTickEveryTicks,
      uiUpdateEveryTicks: checkpointEveryTicks,
      estimatedRuntimeScale: safeTotalTicks > 0 ? effectiveSystemTicks / safeTotalTicks : 0,
      accuracyLevel: SIMULATION_FIDELITY_ACCURACY[mode],
      eventLogging: "minimal",
      chronicler: "minimal",
      atlasSnapshots: "start-end-checkpoint",
      approximate: true,
      warning: "Turbo Test results are approximate and intended for development testing only.",
    };
  }

  return {
    mode,
    label: SIMULATION_FIDELITY_LABELS[mode],
    totalTicks: safeTotalTicks,
    effectiveSystemTicks: safeTotalTicks,
    tickStride: 1,
    checkpointEveryTicks: accurateCheckpoint,
    persistTickEveryTicks: 1,
    uiUpdateEveryTicks: 1,
    estimatedRuntimeScale: 1,
    accuracyLevel: SIMULATION_FIDELITY_ACCURACY[mode],
    eventLogging: "full",
    chronicler: "full",
    atlasSnapshots: "full",
    approximate: false,
    warning: null,
  };
}

export function durationToTicks(input: SimulationDurationInput, config: SimulationTimeConfig): number {
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return NaN;
  }

  const multiplier = input.unit === "years"
    ? getTicksPerYear(config)
    : input.unit === "days"
      ? getTicksPerDay(config)
      : 1;

  return Math.round(input.value * multiplier);
}

export function formatTickEstimate(ticks: number): string {
  return Number.isFinite(ticks) ? Math.round(ticks).toLocaleString("en-US") : "-";
}