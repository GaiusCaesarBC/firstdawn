"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import {
  durationToTicks,
  formatTickEstimate,
  getConfiguredAccurateMaxUnconfirmedTicks,
  getMaxSimulationTicks,
  getSimulationFidelityPlan,
  SIMULATION_FIDELITY_LABELS,
  type SimulationDurationUnit,
  type SimulationFidelityMode,
} from "../../lib/simulation/simulation-limits";

const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const MAX_ACCEPTABLE_CUSTOM_RUNTIME_SECONDS = 12 * 60 * 60;

function ControlButton({
  disabled,
  value,
  variant = "default",
  children,
}: {
  disabled: boolean;
  value: string;
  variant?: "default" | "dashboard";
  children: string;
}) {
  const className =
    variant === "dashboard"
      ? "rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-100 transition hover:border-dawn-gold/30 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-stone-600"
      : "border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-100 transition hover:border-dawn-gold/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-stone-600";

  return (
    <button
      className={className}
      disabled={disabled}
      name="action"
      type="submit"
      value={value}
      suppressHydrationWarning
    >
      {children}
    </button>
  );
}

function formatRuntimeEstimate(ticks: number, averageTickTimeMs: number | null | undefined): string {
  if (!averageTickTimeMs || averageTickTimeMs <= 0 || !Number.isFinite(ticks)) {
    return "pending timing data";
  }

  const seconds = Math.max(0, ticks * averageTickTimeMs / 1000);

  if (seconds < 60) return `${seconds.toFixed(1)} sec`;

  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;

  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)} hr`;

  return `${(hours / 24).toFixed(1)} days`;
}

export function WorldControlsClient({
  slug,
  isProtected,
  isArchived,
  isActive,
  isPaused,
  isProduction,
  productionPhrase,
  tickDurationSeconds,
  dayLengthSeconds,
  yearLengthDays,
  averageTickTimeMs,
  maxSimulationYears,
  variant = "default",
}: {
  slug: string;
  isProtected: boolean;
  isArchived: boolean;
  isActive: boolean;
  isPaused: boolean;
  isProduction: boolean;
  productionPhrase: string;
  tickDurationSeconds: number;
  dayLengthSeconds: number;
  yearLengthDays: number;
  averageTickTimeMs?: number | null;
  maxSimulationYears: number;
  variant?: "default" | "dashboard";
}) {
  const [durationValue, setDurationValue] = useState("10");
  const [durationUnit, setDurationUnit] = useState<SimulationDurationUnit>("years");
  const [fidelityMode, setFidelityMode] = useState<SimulationFidelityMode>("accurate");
  const [confirmAccurateLongRun, setConfirmAccurateLongRun] = useState(false);
  const canRunSimulation = isActive && !isProduction;
  const mounted = useSyncExternalStore(emptySubscribe, clientSnapshot, serverSnapshot);
  const timeConfig = useMemo(() => ({
    tickDurationSeconds,
    dayLengthSeconds,
    yearLengthDays,
  }), [dayLengthSeconds, tickDurationSeconds, yearLengthDays]);
  const maxTicks = useMemo(
    () => getMaxSimulationTicks(timeConfig, maxSimulationYears),
    [maxSimulationYears, timeConfig],
  );
  const maxForUnit = durationUnit === "years"
    ? maxSimulationYears
    : durationUnit === "days"
      ? maxSimulationYears * yearLengthDays
      : maxTicks;
  const estimatedTicks = useMemo(() => durationToTicks({
    value: Number(durationValue),
    unit: durationUnit,
  }, timeConfig), [durationUnit, durationValue, timeConfig]);
  const safeEstimatedTicks = Number.isFinite(estimatedTicks) && estimatedTicks > 0 ? estimatedTicks : 0;
  const fidelityPlan = useMemo(() => getSimulationFidelityPlan(fidelityMode, safeEstimatedTicks, timeConfig), [fidelityMode, safeEstimatedTicks, timeConfig]);
  const estimatedRuntimeSeconds = averageTickTimeMs && averageTickTimeMs > 0
    ? fidelityPlan.effectiveSystemTicks * averageTickTimeMs / 1000
    : null;
  const runtimeAcceptable = estimatedRuntimeSeconds === null || estimatedRuntimeSeconds <= MAX_ACCEPTABLE_CUSTOM_RUNTIME_SECONDS;
  const accurateLongRunRequiresConfirmation = fidelityMode === "accurate" && safeEstimatedTicks > getConfiguredAccurateMaxUnconfirmedTicks();
  const formClassName =
    variant === "dashboard"
      ? "space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4"
      : "space-y-3";
  const sectionLabelClass =
    variant === "dashboard"
      ? "text-[10px] uppercase tracking-[0.24em] text-stone-500"
      : "text-[11px] uppercase tracking-[0.24em] text-stone-500";
  const buttonGroupClass =
    variant === "dashboard" ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2";
  const inputClassName =
    variant === "dashboard"
      ? "mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-stone-100 outline-none focus:border-dawn-gold/60"
      : "mt-1 w-full border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-stone-100 outline-none focus:border-dawn-gold/60";

  if (!mounted) return null;

  return (
    <form action="/api/worlds/actions" className={formClassName} method="post" suppressHydrationWarning>
      <input name="slug" type="hidden" value={slug} />
      <input name="fidelityMode" type="hidden" value={fidelityMode} />

      <div className="space-y-2">
        <p className={sectionLabelClass}>Simulation</p>
        <div className={buttonGroupClass}>
          <ControlButton disabled={isActive || isArchived} value="activate" variant={variant}>
            {isPaused ? "Resume" : "Activate"}
          </ControlButton>
          <ControlButton disabled={isPaused || isArchived} value="pause" variant={variant}>
            Pause
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-1" variant={variant}>
            Step Tick
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-10" variant={variant}>
            Run 10 Ticks
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-years-10" variant={variant}>
            Run 10 Years
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-years-100" variant={variant}>
            Run 100 Years
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-years-1000" variant={variant}>
            Run 1000 Years
          </ControlButton>
        </div>
      </div>

      <div className="space-y-2">
        <p className={sectionLabelClass}>Speed / Fidelity</p>
        <label className="block text-xs text-stone-400">
          Mode
          <select
            className={inputClassName}
            onChange={(event) => {
              setFidelityMode(event.target.value as SimulationFidelityMode);
              setConfirmAccurateLongRun(false);
            }}
            value={fidelityMode}
            suppressHydrationWarning
          >
            <option value="accurate">Accurate</option>
            <option value="fast">Fast</option>
            <option value="turbo">Turbo Test</option>
          </select>
        </label>
        {fidelityPlan.warning ? (
          <p className="border border-dawn-gold/30 bg-dawn-gold/10 p-2 text-xs leading-5 text-dawn-amber">
            {fidelityPlan.warning}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className={sectionLabelClass}>Duration</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="block text-xs text-stone-400">
            Custom
            <input
              className={inputClassName}
              max={maxForUnit}
              min={1}
              name="durationValue"
              onChange={(event) => setDurationValue(event.target.value)}
              step={durationUnit === "ticks" ? 1 : 0.01}
              type="number"
              value={durationValue}
              suppressHydrationWarning
            />
          </label>
          <label className="block text-xs text-stone-400">
            Unit
            <select
              className={inputClassName}
              name="durationUnit"
              onChange={(event) => setDurationUnit(event.target.value as SimulationDurationUnit)}
              value={durationUnit}
              suppressHydrationWarning
            >
              <option value="years">Years</option>
              <option value="days">Days</option>
              <option value="ticks">Ticks</option>
            </select>
          </label>
        </div>
        <div className="grid gap-2 text-xs text-stone-400 sm:grid-cols-2">
          <p>Total ticks: <span className="font-mono text-stone-200">{formatTickEstimate(safeEstimatedTicks)}</span></p>
          <p>Mode: <span className="font-mono text-stone-200">{SIMULATION_FIDELITY_LABELS[fidelityMode]}</span></p>
          <p>Runtime: <span className="font-mono text-stone-200">{formatRuntimeEstimate(fidelityPlan.effectiveSystemTicks, averageTickTimeMs)}</span></p>
          <p>Accuracy: <span className="font-mono text-stone-200">{fidelityPlan.accuracyLevel}</span></p>
        </div>
        {accurateLongRunRequiresConfirmation ? (
          <label className="flex items-start gap-2 text-xs leading-5 text-dawn-amber">
            <input
              checked={confirmAccurateLongRun}
              className="mt-1"
              name="confirmAccurateLongRun"
              onChange={(event) => setConfirmAccurateLongRun(event.target.checked)}
              type="checkbox"
            />
            Confirm Accurate Mode long run
          </label>
        ) : null}
        <ControlButton disabled={!canRunSimulation || safeEstimatedTicks < 1 || safeEstimatedTicks > maxTicks || !runtimeAcceptable || (accurateLongRunRequiresConfirmation && !confirmAccurateLongRun)} value="run-duration" variant={variant}>
          Run Custom
        </ControlButton>
      </div>

      <div className="space-y-2">
        <p className={sectionLabelClass}>Protection</p>
        <div className={buttonGroupClass}>
          <ControlButton disabled={isProtected} value="protect" variant={variant}>
            Protect
          </ControlButton>
          <ControlButton disabled={!isProtected} value="unprotect" variant={variant}>
            Unprotect
          </ControlButton>
        </div>
      </div>

      <div className="space-y-2">
        <p className={sectionLabelClass}>Danger</p>
        <ControlButton disabled={isProtected || isArchived} value="archive" variant={variant}>
          Archive
        </ControlButton>
      </div>

      <label className="block text-xs text-stone-400">
        Reason
        <input
          className={inputClassName}
          name="reason"
          placeholder="Optional local note"
          type="text"
          suppressHydrationWarning
        />
      </label>

      {isProduction ? (
        <label className="block text-xs text-dawn-amber">
          Production confirmation
          <input
            className={
              variant === "dashboard"
                ? "mt-1 w-full rounded-2xl border border-dawn-gold/40 bg-black/30 px-3 py-2 font-mono text-xs text-stone-100 outline-none focus:border-dawn-gold"
                : "mt-1 w-full border border-dawn-gold/40 bg-black/30 px-2 py-1.5 font-mono text-xs text-stone-100 outline-none focus:border-dawn-gold"
            }
            name="productionConfirmation"
            placeholder={productionPhrase}
            required
            type="text"
            suppressHydrationWarning
          />
        </label>
      ) : null}
    </form>
  );
}