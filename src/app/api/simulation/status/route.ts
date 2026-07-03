import { NextResponse } from "next/server";

import { getSimulationWorkerStatus } from "../../../../lib/simulation/simulation-worker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const worldQuery = searchParams.get("world");
  const status = await getSimulationWorkerStatus(worldQuery);

  return NextResponse.json(status);
}
