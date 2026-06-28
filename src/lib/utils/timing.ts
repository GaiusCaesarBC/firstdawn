// High-resolution timing utilities for server-side instrumentation
// Dev-only logging is performed based on NODE_ENV.

type StageResult = {
  name: string;
  durationMs: number;
};

function nowNs(): bigint {
  return process.hrtime.bigint();
}

function nsToMs(ns: bigint): number {
  return Number(ns) / 1_000_000;
}

export type HrTimer = {
  start: (name: string) => void;
  end: (name: string) => void;
  record: (name: string, durationMs?: number) => void;
  time: <T>(name: string, fn: () => T | Promise<T>) => Promise<T>;
  getBreakdown: () => StageResult[];
  logDevBreakdown: (label?: string) => void;
};

export function createHrTimer(): HrTimer {
  const starts = new Map<string, bigint>();
  const results: StageResult[] = [];

  function start(name: string) {
    starts.set(name, nowNs());
  }

  function end(name: string) {
    const startNs = starts.get(name);
    if (!startNs) return;
    const duration = nsToMs(nowNs() - startNs);
    results.push({ name, durationMs: duration });
    starts.delete(name);
  }

  function record(name: string, durationMs = 0) {
    results.push({ name, durationMs });
  }

  async function time<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    start(name);
    try {
      return await fn();
    } finally {
      end(name);
    }
  }

  function getBreakdown(): StageResult[] {
    return [...results];
  }

  function logDevBreakdown(label = "/worlds timing") {
    if (process.env.NODE_ENV !== "development") return;
    const breakdown = getBreakdown();
    const total = breakdown.reduce((sum, r) => sum + r.durationMs, 0);
    const sorted = [...breakdown].sort((a, b) => b.durationMs - a.durationMs);
    const top3 = sorted.slice(0, 3);

    // Pretty print
    const lines = [
      `\n=== ${label} (total ${total.toFixed(2)} ms) ===`,
      ...sorted.map((r, idx) => {
        const star = idx < 3 ? "*" : " ";
        return `${star} ${r.name.padEnd(26)} ${r.durationMs.toFixed(2)} ms`;
      }),
      `Top 3 slowest: ${top3.map((r) => r.name).join(", ")}`,
      "==============================================\n",
    ];

    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  }

  return { start, end, record, time, getBreakdown, logDevBreakdown };
}
