import { createWorldTime } from "./time";
import type { SimulationWorld, WorldId, WorldMode } from "./types";

interface CreateSimulationWorldOptions {
  id: WorldId;
  name: string;
  mode?: WorldMode;
}

export function createSimulationWorld({
  id,
  name,
  mode = "sandbox",
}: CreateSimulationWorldOptions): SimulationWorld {
  return {
    id,
    name,
    mode,
    time: createWorldTime(),
  };
}

export function assertSameWorld(
  expectedWorldId: WorldId,
  record: { worldId: WorldId },
): void {
  if (record.worldId !== expectedWorldId) {
    throw new Error("Simulation record belongs to a different world.");
  }
}

export function isProductionWorld(world: SimulationWorld): boolean {
  return world.mode === "production";
}
