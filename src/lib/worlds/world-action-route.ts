import { WorldEnvironment } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { advanceTicks } from "../simulation/scheduler";
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

const RUN_TICK_ACTION_PATTERN = /^run-(1|10|100|1000)$/;

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToWorlds(request: NextRequest, key: "notice" | "error", message: string) {
  const url = new URL("/worlds", request.url);
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
}

function readTickRunCount(action: string): number | null {
  const match = RUN_TICK_ACTION_PATTERN.exec(action);
  return match ? Number(match[1]) : null;
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

    const tickRunCount = readTickRunCount(action);

    if (tickRunCount !== null) {
      const results = await advanceTicks(world.id, tickRunCount);
      const lastResult = results[results.length - 1];
      return redirectToWorlds(
        request,
        "notice",
        `${world.name} advanced ${results.length} tick${results.length === 1 ? "" : "s"} to ${lastResult.tick.toString()}.`,
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
