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
import type { SimulationSystem } from "./types";

export const DEFAULT_SIMULATION_SYSTEMS: SimulationSystem[] = [
  timeSystem,
  astronomySystem,
  physicsSystem,
  climateSystem,
  geologySystem,
  oceansSystem,
  atmosphereSystem,
  weatherSystem,
  resourcesSystem,
  biomesSystem,
  plantsSystem,
  chemistrySystem,
  biologySystem,
  animalsSystem,
  humansSystem,
  civilizationSystem,
  economySystem,
  cultureSystem,
  memorySystem,
  eventGenerationSystem,
  metricsSystem,
  saveStateSystem,
];

export type { SimulationSystem, SimulationSystemContext, SimulationSystemResult } from "./types";



