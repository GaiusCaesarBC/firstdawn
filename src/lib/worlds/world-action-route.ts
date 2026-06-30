import { WorldEnvironment } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { advanceTicksWithCheckpoints } from "../simulation/scheduler";
import {
  durationToTicks,
  normalizeSimulationFidelityMode,
  type SimulationDurationUnit,
} from "../simulation/simulation-limits";
import {
  archiveWorld,
  getWorldBySlug,
  pauseWorld,
  PRODUCTION_CONFIRMATION_PHRASE,
  protectWorld,
  resumeWorld,
  unprotectWorld,
  WorldLifecycleError,
} from "./world-lifecycle";

const ACTION_LABELS: Record<string, string> = {
  activate: "activated",
  archive: "archived",
  pause: "paused",
  protect: "protected",
  unprotect: "unprotected",
};

const RUN_TICK_ACTION_PATTERN = /^run-(\d+)$/;
const RUN_YEAR_ACTION_PATTERN = /^run-years-(\d+)$/;
const DURATION_UNITS = new Set<SimulationDurationUnit>(["ticks", "days", "years"]);

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToWorlds(request: NextRequest, key: "notice" | "error", message: string) {
  const url = new URL("/worlds", request.url);
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
}

function readFixedTickRunCount(action: string): number | null {
  const match = RUN_TICK_ACTION_PATTERN.exec(action);
  return match ? Number(match[1]) : null;
}

function readDurationUnit(value: string): SimulationDurationUnit {
  return DURATION_UNITS.has(value as SimulationDurationUnit)
    ? value as SimulationDurationUnit
    : "ticks";
}

function readTickRunCount(action: string, formData: FormData, world: {
  tickDurationSeconds: number;
  dayLengthSeconds: number;
  yearLengthDays: number;
}): number | null {
  const yearMatch = RUN_YEAR_ACTION_PATTERN.exec(action);

  if (yearMatch) {
    return durationToTicks({ value: Number(yearMatch[1]), unit: "years" }, world);
  }

  if (action === "run-duration") {
    const value = Number(readFormString(formData, "durationValue"));
    const unit = readDurationUnit(readFormString(formData, "durationUnit"));
    return durationToTicks({ value, unit }, world);
  }

  return readFixedTickRunCount(action);
}

export async function handleWorldActionPost(request: NextRequest) {
  const formData = await request.formData();
  const action = readFormString(formData, "action");
  const slug = readFormString(formData, "slug");
  const reason = readFormString(formData, "reason");
  const confirmation = readFormString(formData, "productionConfirmation");

  try {
    const world = await getWorldBySlug(slug);

    if (!world) {
      throw new WorldLifecycleError(`World not found: ${slug}`, "WORLD_NOT_FOUND");
    }

    if (
      world.environment === WorldEnvironment.PRODUCTION &&
      confirmation !== PRODUCTION_CONFIRMATION_PHRASE
    ) {
      throw new WorldLifecycleError(
        `Production world changes require the exact confirmation phrase: ${PRODUCTION_CONFIRMATION_PHRASE}`,
        "PRODUCTION_CONFIRMATION_REQUIRED",
      );
    }

    const tickRunCount = readTickRunCount(action, formData, world);
    const fidelityMode = normalizeSimulationFidelityMode(readFormString(formData, "fidelityMode"));
    const confirmAccurateLongRun = readFormString(formData, "confirmAccurateLongRun") === "on";

    if (tickRunCount !== null) {
      const result = await advanceTicksWithCheckpoints(world.id, tickRunCount, {
        fidelityMode,
        confirmAccurateLongRun,
      });
      const lastTick = result.lastTick?.toString() ?? world.currentTick.toString();
      return redirectToWorlds(
        request,
        result.success ? "notice" : "error",
        result.success
          ? `${world.name} advanced ${result.completedTicks.toLocaleString("en-US")} tick${result.completedTicks === 1 ? "" : "s"} in ${fidelityMode} mode to ${lastTick}.`
          : `${world.name} stopped after ${result.completedTicks.toLocaleString("en-US")} of ${result.requestedTicks.toLocaleString("en-US")} requested ticks. Failed systems: ${result.failedSystems.join(", ") || "unknown"}.`,
      );
    }

    const options = {
      actor: "local-developer",
      confirmProductionChange: confirmation,
      metadata: {
        routeAction: action,
        source: new URL(request.url).pathname,
      },
      reason,
    };

    switch (action) {
      case "activate":
        await resumeWorld(slug, options);
        break;
      case "pause":
        await pauseWorld(slug, options);
        break;
      case "protect":
        await protectWorld(slug, options);
        break;
      case "unprotect":
        await unprotectWorld(slug, options);
        break;
      case "archive":
        await archiveWorld(slug, options);
        break;
      default:
        throw new WorldLifecycleError(`Unknown world action: ${action}`, "INVALID_WORLD");
    }

    return redirectToWorlds(request, "notice", `${world.name} ${ACTION_LABELS[action]}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "World action failed.";
    return redirectToWorlds(request, "error", message);
  }
}
