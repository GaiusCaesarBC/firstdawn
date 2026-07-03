import { runSimulationWorker } from "../src/lib/simulation/simulation-worker";
import { prisma } from "../src/lib/worlds/world-lifecycle";

function readBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function main() {
  const controller = new AbortController();
  const once = process.argv.includes("--once") || readBoolean(process.env.FIRST_DAWN_SIM_WORKER_ONCE);
  const intervalMs = readPositiveInteger(process.env.FIRST_DAWN_SIM_WORKER_INTERVAL_MS);
  const maxTicks = readPositiveInteger(process.env.FIRST_DAWN_SIM_WORKER_MAX_TICKS);
  const persistSnapshots = process.env.FIRST_DAWN_SIM_WORKER_PERSIST_SNAPSHOTS === "0"
    ? false
    : true;

  process.once("SIGINT", () => {
    console.info("[sim-worker] SIGINT received; stopping after current tick");
    controller.abort();
  });
  process.once("SIGTERM", () => {
    console.info("[sim-worker] SIGTERM received; stopping after current tick");
    controller.abort();
  });

  await runSimulationWorker({
    intervalMs,
    maxTicks,
    once,
    persistSnapshots,
    signal: controller.signal,
  });
}

main()
  .catch((error) => {
    console.error("[sim-worker] fatal error", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
