import { getPlanetResourceSummary } from "../resources-engine";
import { createPlaceholderSystem, systemSuccess } from "./types";
import type { SimulationSystemContext, SimulationSystemResult } from "./types";

const SYSTEM_NAME = "resources";
const SYSTEM_LABEL = "Planet Resources";
const SYSTEM_ORDER = 75;

export function run(context: SimulationSystemContext): SimulationSystemResult {
  const resourceSummary = getPlanetResourceSummary(context.world);

  return systemSuccess({
    deterministic: true,
    extraction: "unmodeled",
    mining: "unmodeled",
    economy: "unmodeled",
    richestIronRegion: resourceSummary.richestIronRegion,
    largestCoalBasin: resourceSummary.largestCoalBasin,
    largestAquifer: resourceSummary.largestAquifer,
    strongestMiningRegion: resourceSummary.strongestMiningRegion,
    volcanicRegionCount: resourceSummary.volcanicRegions.length,
    rareEarthHotspotCount: resourceSummary.rareEarthHotspots.length,
    averageMineralRichness: resourceSummary.averageMineralRichness,
    resourceDiversity: resourceSummary.resourceDiversity,
  });
}

export const resourcesSystem = createPlaceholderSystem(
  SYSTEM_NAME,
  SYSTEM_LABEL,
  SYSTEM_ORDER,
  run,
);

