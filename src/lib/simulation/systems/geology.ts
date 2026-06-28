import { getTerrainSummary } from "../terrain-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "geology";
const SYSTEM_LABEL = "Geology";
const SYSTEM_ORDER = 50;

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const terrainSummary = getTerrainSummary(context.world);

  return systemSuccess({
    static: true,
    erosion: "unmodeled",
    plateMovement: "unmodeled",
    earthquakes: "unmodeled",
    landPercent: terrainSummary.landPercent,
    oceanPercent: terrainSummary.oceanPercent,
    mountainPercent: terrainSummary.mountainPercent,
    coastlineCells: terrainSummary.coastlineCells,
    largestContinentEstimate: terrainSummary.largestContinentEstimate,
    largestOceanEstimate: terrainSummary.largestOceanEstimate,
  });
}

export const geologySystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);
