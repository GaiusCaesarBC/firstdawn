"use client";

import { useEffect, useState } from "react";

function ControlButton({
  disabled,
  value,
  children,
}: {
  disabled: boolean;
  value: string;
  children: string;
}) {
  return (
    <button
      className="border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-100 transition hover:border-dawn-gold/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-stone-600"
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

export function WorldControlsClient({
  slug,
  isProtected,
  isArchived,
  isActive,
  isPaused,
  isProduction,
  productionPhrase,
}: {
  slug: string;
  isProtected: boolean;
  isArchived: boolean;
  isActive: boolean;
  isPaused: boolean;
  isProduction: boolean;
  productionPhrase: string;
}) {
  const canRunSimulation = isActive && !isProduction;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <form action="/api/worlds/actions" className="space-y-3" method="post" suppressHydrationWarning>
      <input name="slug" type="hidden" value={slug} />

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Simulation</p>
        <div className="flex flex-wrap gap-2">
          <ControlButton disabled={isActive || isArchived} value="activate">
            Activate
          </ControlButton>
          <ControlButton disabled={isPaused || isArchived} value="pause">
            Pause
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-1">
            Run 1
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-10">
            Run 10
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-100">
            Run 100
          </ControlButton>
          <ControlButton disabled={!canRunSimulation} value="run-1000">
            Run 1000
          </ControlButton>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Protection</p>
        <div className="flex flex-wrap gap-2">
          <ControlButton disabled={isProtected} value="protect">
            Protect
          </ControlButton>
          <ControlButton disabled={!isProtected} value="unprotect">
            Unprotect
          </ControlButton>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Danger</p>
        <ControlButton disabled={isProtected || isArchived} value="archive">
          Archive
        </ControlButton>
      </div>

      <label className="block text-xs text-stone-400">
        Reason
        <input
          className="mt-1 w-full border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-stone-100 outline-none focus:border-dawn-gold/60"
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
            className="mt-1 w-full border border-dawn-gold/40 bg-black/30 px-2 py-1.5 font-mono text-xs text-stone-100 outline-none focus:border-dawn-gold"
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
