import { NextResponse } from "next/server";

import { requestSimulationRun } from "../../../../lib/simulation/simulation-worker";
import {
  pauseWorld,
  prisma,
  resumeWorld,
} from "../../../../lib/worlds/world-lifecycle";

export const dynamic = "force-dynamic";

type ControlAction = "pause" | "request-step" | "resume";

function isControlAction(value: unknown): value is ControlAction {
  return value === "pause" || value === "resume" || value === "request-step";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    action?: unknown;
    world?: unknown;
    reason?: unknown;
  } | null;
  const action = body?.action;
  const worldQuery = typeof body?.world === "string" ? body.world : "";
  const reason = typeof body?.reason === "string" ? body.reason : null;

  if (!isControlAction(action)) {
    return NextResponse.json({ error: "action must be pause, resume, or request-step." }, { status: 400 });
  }

  if (!worldQuery.trim()) {
    return NextResponse.json({ error: "world is required." }, { status: 400 });
  }

  const world = await prisma.world.findFirst({
    where: { OR: [{ id: worldQuery }, { slug: worldQuery }] },
    select: { id: true, slug: true, name: true },
  });

  if (!world) {
    return NextResponse.json({ error: "Requested world was not found." }, { status: 404 });
  }

  if (action === "pause") {
    const paused = await pauseWorld(world.slug, {
      actor: "simulation-control-api",
      reason,
      metadata: { source: "/api/simulation/control" },
    });
    return NextResponse.json({ ok: true, action, world: paused.slug, status: paused.status });
  }

  if (action === "resume") {
    const resumed = await resumeWorld(world.slug, {
      actor: "simulation-control-api",
      reason,
      metadata: { source: "/api/simulation/control" },
    });
    return NextResponse.json({ ok: true, action, world: resumed.slug, status: resumed.status });
  }

  const simulationRequest = await requestSimulationRun({
    worldId: world.id,
    tickCount: 1,
    fidelityMode: "accurate",
    confirmAccurateLongRun: false,
    requestedBy: "simulation-control-api",
    reason,
    source: "/api/simulation/control",
  });

  return NextResponse.json({
    ok: true,
    action,
    world: world.slug,
    requestLogId: simulationRequest.requestLogId,
  });
}
