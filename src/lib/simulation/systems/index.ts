import { adaptationSystem } from "./adaptation";
import { animalsSystem } from "./animals";
import { atmosphereSystem } from "./atmosphere";
import { astronomySystem } from "./astronomy";
import { biologySystem } from "./biology";
import { biomesSystem } from "./biomes";
import { chemistrySystem } from "./chemistry";
import { civilizationSystem } from "./civilization";
import { climateSystem } from "./climate";
import { cultureSystem } from "./culture";
import { economySystem } from "./economy";
import { eventGenerationSystem } from "./event-generation";
import { geologySystem } from "./geology";
import { humansSystem } from "./humans";
import { memorySystem } from "./memory";
import { metricsSystem } from "./metrics";
import { oceansSystem } from "./oceans";
import { physicsSystem } from "./physics";
import { plantsSystem } from "./plants";
import { saveStateSystem } from "./save-state";
import { resourcesSystem } from "./resources";
import { timeSystem } from "./time";
import { weatherSystem } from "./weather";
import { getSystems, registerSystem } from "../registry";
import type { SimulationSystem } from "./types";

function withDependencies(system: SimulationSystem, dependencies: string[]): SimulationSystem {
  return {
    ...system,
    dependencies,
  };
}

registerSystem(withDependencies(timeSystem, []));
registerSystem(withDependencies(astronomySystem, ["time"]));
registerSystem(withDependencies(physicsSystem, ["astronomy"]));
registerSystem(withDependencies(climateSystem, ["astronomy"]));
registerSystem(withDependencies(geologySystem, ["physics"]));
registerSystem(withDependencies(oceansSystem, ["geology", "climate"]));
registerSystem(withDependencies(atmosphereSystem, ["oceans", "climate"]));
registerSystem(withDependencies(weatherSystem, ["atmosphere", "climate"]));
registerSystem(withDependencies(resourcesSystem, ["geology", "climate"]));
registerSystem(withDependencies(biomesSystem, ["weather", "resources"]));
registerSystem(withDependencies(plantsSystem, ["biomes"]));
registerSystem(withDependencies(chemistrySystem, ["plants"]));
registerSystem(withDependencies(biologySystem, ["chemistry"]));
registerSystem(withDependencies(animalsSystem, ["plants", "biology"]));
registerSystem(withDependencies(adaptationSystem, ["animals"]));
registerSystem(withDependencies(humansSystem, ["adaptation"]));
registerSystem(withDependencies(civilizationSystem, ["humans"]));
registerSystem(withDependencies(economySystem, ["civilization"]));
registerSystem(withDependencies(cultureSystem, ["economy"]));
registerSystem(withDependencies(memorySystem, ["culture"]));
registerSystem(withDependencies(eventGenerationSystem, ["memory"]));
registerSystem(withDependencies(metricsSystem, ["event-generation"]));
registerSystem(withDependencies(saveStateSystem, ["metrics"]));

export const DEFAULT_SIMULATION_SYSTEMS: SimulationSystem[] = getSystems();

export type {
  SimulationHealthStatus,
  SimulationMetricsCollector,
  SimulationSystem,
  SimulationSystemContext,
  SimulationSystemEvent,
  SimulationSystemHealth,
  SimulationSystemMetrics,
  SimulationSystemResult,
} from "./types";
