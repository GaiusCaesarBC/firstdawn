import type { AnimalGridCell, AnimalSummary } from "../simulation/animal-engine";
import { getHumanMvaStateAtTick } from "../simulation/human-engine";
import { getSettlementStateAtTick, type Settlement, type SettlementTickResult } from "../simulation/settlement-engine";
import { getFamilyGenerationsStateFromHumanState, type FamilyGenerationsResult } from "../simulation/family-generations-engine";
import { getResourceStorageStateFromHumanState, type HumanInventorySummary, type ResourceStorageResult, type SettlementResourceSummary, type SettlementStorage } from "../simulation/resource-storage-engine";
import type { ChroniclerEntry, HumanAgent, HumanCausalEvent, HumanCommunicationRecord, HumanEmotionState, HumanKnowledge, HumanMemory, HumanNeeds, HumanRelationship, HumanTickResult } from "../simulation/human-types";
import { HUMAN_MVA_DAY_TICKS } from "../simulation/human-types";
import { getAnimalEcologyStateAtTick } from "../simulation/animal-engine";
import type {
  AstronomyState,
} from "../simulation/astronomy-engine";
import { getAstronomyStateAtTick } from "../simulation/astronomy-engine";
import type {
  AtmosphericGridCell,
  AtmosphericSummary,
} from "../simulation/atmosphere-engine";
import { getAtmosphereStateAtTick } from "../simulation/atmosphere-engine";
import type { BiomeGridCell, BiomeSummary } from "../simulation/biome-engine";
import { getBiomeStateAtTick } from "../simulation/biome-engine";
import type {
  ClimateGridCell,
  ClimateState,
} from "../simulation/climate-engine";
import { getClimateGridAtTick, getClimateStateAtTick } from "../simulation/climate-engine";
import { createGrid, getGridSummary, type SpatialGrid } from "../simulation/grid/grid";
import { getSnapshotWorldKey, memoizeSnapshotValue, type TimedSnapshotValue } from "../simulation/snapshot-performance";
import type {
  HydrologyGridCell,
  HydrologySummary,
} from "../simulation/hydrology-engine";
import { getHydrologyState } from "../simulation/hydrology-engine";
import type { PlanetState } from "../simulation/planet-engine";
import { getPlanetState } from "../simulation/planet-engine";
import type {
  PlanetResourceGridCell,
  PlanetResourceSummary,
} from "../simulation/resources-engine";
import { getPlanetResourcesStateAtTick } from "../simulation/resources-engine";
import type { PlantGridCell, PlantSummary } from "../simulation/plant-engine";
import { getPlantEcologyStateAtTick } from "../simulation/plant-engine";
import type {
  TerrainGridCell,
  TerrainSummary,
} from "../simulation/terrain-engine";
import { getTerrainState } from "../simulation/terrain-engine";
import {
  DEFAULT_WORLD_TIME_CONFIG,
  getTimeState,
  getTimeStateAtTick,
  type TimeState,
} from "../simulation/time-engine";
import type {
  WeatherGridCell,
  WeatherSummary,
} from "../simulation/weather-engine";
import { getWeatherStateAtTick } from "../simulation/weather-engine";
import { buildWorldFingerprint, verifyWorldAgainstCanonical, type WorldFingerprint } from "./canonical-world";
import type { WorldWithPlanet } from "./world-lifecycle";

export type AtlasWorldOption = {
  id: string;
  slug: string;
  name: string;
  environment: string;
  status: string;
  yearLengthDays: number;
  currentDay: number;
  hasSeed: boolean;
};

export type AtlasCell = ClimateGridCell & Pick<
  TerrainGridCell,
  | "elevation"
  | "terrainType"
  | "continentalness"
  | "ruggedness"
  | "tectonicActivity"
  | "isCoast"
> & Pick<
  HydrologyGridCell,
  | "isOcean"
  | "isSea"
  | "isLakeCandidate"
  | "isRiverCandidate"
  | "waterBodyType"
  | "drainageDirection"
  | "drainageTargetId"
  | "basinId"
  | "watershedId"
  | "flowAccumulation"
  | "moisturePotential"
  | "distanceToOcean"
  | "distanceToCoast"
> & Pick<
  AtmosphericGridCell,
  | "pressureZone"
  | "pressureValue"
  | "windDirection"
  | "windStrength"
  | "temperatureGradient"
  | "moistureTransportPotential"
  | "orographicLiftPotential"
  | "rainShadowPotential"
  | "atmosphericStability"
  | "seasonalShift"
> & Pick<
  WeatherGridCell,
  | "cloudCover"
  | "relativeHumidity"
  | "precipitationPotential"
  | "weatherType"
  | "snowPotential"
  | "fogPotential"
  | "stormPotential"
  | "evaporationPotential"
  | "drynessIndex"
  | "weatherStability"
> & Pick<
  PlanetResourceGridCell,
  | "bedrockType"
  | "sedimentDepth"
  | "volcanicInfluence"
  | "erosionPotential"
  | "metals"
  | "industrialMaterials"
  | "rareMaterials"
  | "waterResources"
  | "buildingResources"
  | "resourceRichness"
  | "metalRichness"
  | "industrialRichness"
  | "rareMaterialRichness"
  | "waterRichness"
  | "buildingMaterialAvailability"
  | "resourceDiversity"
> & {
  biomeKey: string;
  biomeName: string;
  biomeCategory: string;
  biomeColor: string;
  biomeTags: readonly string[];
  adjustedTemperatureC: number;
  precipitationScore: number;
  humidityScore: number;
  soilMoistureScore: number;
  seasonalityScore: number;
  transitionScore: number;
  habitabilityScore: number;
  fertilityScore: number;
  waterAvailabilityScore: number;
  vegetationDensity: number;
  dominantPlantKey: string;
  dominantPlantName: string;
  dominantPlantCategory: string;
  dominantPlantColor: string;
  plantSuitabilityScore: number;
  plantDensity: number;
  biomassScore: number;
  ediblePlantScore: number;
  woodMaterialScore: number;
  medicinalPotentialScore: number;
  biodiversityScore: number;
  regrowthRate: number;
  seasonalStressScore: number;
  plantTags: readonly string[];
  dominantAnimalGuildKey: string;
  dominantAnimalGuildName: string;
  dominantAnimalGuildCategory: string;
  dominantAnimalGuildColor: string;
  animalSuitabilityScore: number;
  herbivoreCapacity: number;
  predatorCapacity: number;
  preyAvailability: number;
  animalDensity: number;
  migrationPressure: number;
  dangerScore: number;
  huntingValue: number;
  domesticationPotential: number;
  animalBiodiversityScore: number;
  carryingCapacityScore: number;
  animalTags: readonly string[];
  dominantSpeciesId: string;
  dominantSpeciesName: string;
  speciesCount: number;
  totalWildlifePopulation: number;
  averagePopulationHealth: number;
  averageHabitatSuitability: number;
  plantConsumptionRate: number;
  effectivePlantBiomass: number;
  predationPressure: number;
  predatorPreyBalance: number;
  foodStability: number;
  carryingCapacityUsage: number;
  migrationActivity: number;
  populationGrowthRate: number;
  ecosystemHealthScore: number;
  ecosystemHealthStatus: AnimalGridCell["ecosystemHealthStatus"];
  averageFitness: number;
  adaptationDiversity: number;
  averageMigrationInstinct: number;
  averageDiseaseResistance: number;
  averageReproductiveEfficiency: number;
  averageClimateAdaptation: number;
  highestAdaptedPopulation: AnimalGridCell["highestAdaptedPopulation"];
  lowestFitnessPopulation: AnimalGridCell["lowestFitnessPopulation"];
  ecosystemEvents: AnimalGridCell["ecosystemEvents"];
  ecosystemHistory: AnimalGridCell["ecosystemHistory"];
  movementVectors: AnimalGridCell["movementVectors"];
  animalPopulations: AnimalGridCell["animalPopulations"];
};

export type AtlasHumanAgent = {
  id: string;
  label: string;
  sex: "male" | "female";
  approxAgeYears: number;
  currentCellId: string;
  previousCellId: string | null;
  destinationCellId: string | null;
  movementIntent: string;
  movementReason: string;
  lastMovedTick: string | null;
  recentPath: string[];
  stuckTicks: number;
  distanceTraveled: number;
  explorationCount: number;
  currentAction: string | null;
  needs: HumanNeeds;
  emotions: HumanEmotionState;
  currentMotivation?: string | null;
  motivationScores?: Record<string, number>;
  confidence?: number;
  familiarity?: number;
  curiosityProfile?: {
    environmental: number;
    social: number;
    technical: number;
    noveltySeeking: number;
    riskTolerance: number;
  };
  relationshipDrivers?: {
    trust: number;
    affection: number;
    attraction: number;
    companionship: number;
  } | null;
  closestRelationships: AtlasHumanRelationshipSummary[];
  trustedHumans: AtlasHumanRelationshipSummary[];
  fearedHumans: AtlasHumanRelationshipSummary[];
  rivals: AtlasHumanRelationshipSummary[];
  family: AtlasHumanRelationshipSummary[];
  relationshipCount: number;
  strongestBond: AtlasHumanRelationshipSummary | null;
  recentRelationshipChanges: AtlasHumanSocialHistoryEntry[];
  socialHistory: AtlasHumanSocialHistoryEntry[];
  decisionExplanation?: string | null;
  currentGoal?: {
    id: string;
    type: string;
    priority: number;
    createdTick: string;
    targetId: string | null;
    targetCellId: string | null;
    progress: number;
    confidence: number;
    reason: string;
    status: string;
  } | null;
  goalPriority?: number | null;
  goalReason?: string | null;
  goalAge?: number | null;
  goalProgress?: number | null;
  goalHistory?: Array<{
    tick: string;
    event: string;
    type: string;
    reason: string;
    priority: number;
    progress: number;
    status: string;
    previousGoalId: string | null;
  }>;
  relationshipToOther: HumanRelationship | null;
  latestMemory: AtlasHumanMemorySummary | null;
  recentMemories: AtlasHumanMemorySummary[];
  strongestMemories: AtlasHumanMemorySummary[];
  mostRecalledMemories: AtlasHumanMemorySummary[];
  dangerMemories: AtlasHumanMemorySummary[];
  foodMemories: AtlasHumanMemorySummary[];
  relationshipMemories: AtlasHumanMemorySummary[];
  memoryTimeline: AtlasHumanMemorySummary[];
  memoryCount: number;
  averageMemoryConfidence: number;
  averageMemoryImportance: number;
  knownKnowledge: AtlasHumanKnowledgeSummary[];
  knowledgeCategories: Array<{ category: string; count: number; averageMastery: number }>;
  recentlyLearnedKnowledge: AtlasHumanKnowledgeSummary[];
  recentlyTaughtKnowledge: AtlasHumanKnowledgeSummary[];
  knowledgeTimeline: AtlasHumanKnowledgeTimelineEntry[];
  knowledgeCount: number;
  averageKnowledgeConfidence: number;
  averageKnowledgeMastery: number;
  recentCommunications: AtlasHumanCommunicationSummary[];
  messagesSent: number;
  messagesReceived: number;
  mostCommonCommunicationTypes: Array<{ type: string; count: number }>;
  trustedTeachers: Array<{ humanId: string; acceptedTeachings: number }>;
  peopleFrequentlyContacted: Array<{ humanId: string; count: number }>;
  communicationSuccessRate: number;
  ignoredMessages: AtlasHumanCommunicationSummary[];
  teachingHistory: AtlasHumanCommunicationSummary[];
  warningHistory: AtlasHumanCommunicationSummary[];
  communicationTimeline: AtlasHumanCommunicationSummary[];
  personalInventory: HumanInventorySummary["personalInventory"];
  familyInventory: HumanInventorySummary["familyInventory"];
  recentDeposits: HumanInventorySummary["recentDeposits"];
  recentWithdrawals: HumanInventorySummary["recentWithdrawals"];
  contributionHistory: HumanInventorySummary["contributionHistory"];
  latestCausalEvent: {
    tick: string;
    type: string;
    title: string;
    summary: string;
  } | null;
  latestEmotionChangeSummary: string;
  emotionReasons: AtlasHumanEmotionReason[];
};

export type AtlasHumanRelationshipSummary = {
  humanId: string;
  targetHumanId: string;
  status: string;
  kinship: string;
  familiarity: number;
  trust: number;
  affection: number;
  fear: number;
  respect: number;
  rivalry: number;
  dependency: number;
  grief: number;
  socialMemoryScore: number;
  strongestScore: number;
  tags: string[];
  lastInteractionTick: string | null;
};

export type AtlasHumanSocialHistoryEntry = {
  tick: string;
  type: string;
  summary: string;
  targetHumanId: string | null;
  status?: string;
};

export type AtlasHumanMemorySummary = {
  id: string;
  tick: string;
  type: string;
  category: string;
  eventType: string;
  summary: string;
  locationCellId: string;
  importance: number;
  confidence: number;
  emotionalWeight: number;
  recallCount: number;
  exposureCount: number;
  tags: string[];
};

export type AtlasHumanKnowledgeSummary = {
  id: string;
  topic: string;
  category: string;
  discoveredTick: string;
  learnedTick: string;
  sourceType: string;
  sourceHumanId: string | null;
  originatingHumanId: string;
  confidence: number;
  mastery: number;
  reliability: number;
  practiceCount: number;
  teachingCount: number;
  lastUsedTick: string | null;
  lastTaughtTick: string | null;
  importance: number;
  teacher: string | null;
  students: string[];
  tags: string[];
};

export type AtlasHumanKnowledgeTimelineEntry = {
  tick: string;
  event: string;
  topic: string;
  category: string;
  summary: string;
  confidence: number;
  mastery: number;
  sourceHumanId: string | null;
};
export type AtlasHumanCommunicationSummary = {
  id: string;
  tick: string;
  senderHumanId: string;
  receiverHumanIds: string[];
  type: string;
  topic: string;
  method: string;
  urgency: number;
  clarity: number;
  confidence: number;
  emotionalWeight: number;
  understood: boolean;
  accepted: boolean;
  successRate: number;
  ignoredCount: number;
  tags: string[];
};
export type AtlasSettlementSummary = {
  id: string;
  name: string;
  foundedTick: string;
  population: number;
  peakPopulation: number;
  ageTicks: number;
  homeCellId: string;
  occupiedCells: string[];
  type: string;
  status: string;
  importance: number;
  permanence: number;
  founders: string[];
  currentResidents: string[];
  structures: string[];
  storedResources: Settlement["storedResources"];
  storage: SettlementStorage | null;
  resourceSummary: SettlementResourceSummary | null;
  foodSupply: number;
  waterSupply: number;
  firewood: number;
  constructionMaterials: number;
  storageCapacity: number;
  storageCapacityUsed: number;
  spoilage: number;
  dailyConsumption: number;
  largestContributors: SettlementResourceSummary["largestContributors"];
  mostNeededResources: string[];
  resourceTrends: SettlementResourceSummary["resourceTrends"];
  culturalTraits: string[];
  knownKnowledge: Settlement["knowledgeSummary"];
  relationships: Settlement["relationshipGraph"];
  majorEvents: Settlement["history"];
  births: Settlement["history"];
  deaths: Settlement["history"];
  growthTimeline: Settlement["history"];
  nearbyResources: string[];
  seasonalStatus: string;
  discoveryHistory: Settlement["discoveryHistory"];
  familiesPresent: string[];
  largestLineage: string | null;
  children: number;
  elders: number;
  foundingFamilies: string[];
  tags: string[];
};

export type AtlasSettlements = {
  tick: string;
  settlements: AtlasSettlementSummary[];
  activeCount: number;
  abandonedCount: number;
  firstSettlement: AtlasSettlementSummary | null;
  recentEvents: Array<{
    id: string;
    tick: string;
    settlementId: string;
    kind: string;
    title: string;
    summary: string;
    importance: number;
    cellId: string;
  }>;
  scoring: Array<{
    cellId: string;
    score: number;
    permanence: number;
    population: number;
    reasons: Record<string, number>;
  }>;
};
export type AtlasFamilyTree = {
  tick: string;
  families: Array<{
    id: string;
    lineageId: string;
    memberIds: string[];
    livingMemberIds: string[];
    parentIds: string[];
    childIds: string[];
    homeCellId: string;
    settlementId: string | null;
    ancestryTags: string[];
    history: FamilyGenerationsResult["families"][number]["history"];
  }>;
  lineages: Array<Omit<FamilyGenerationsResult["lineages"][number], "id" | "founderIds" | "livingDescendantIds" | "knownAncestorIds" | "familyIds" | "settlementIds"> & {
    id: string;
    founderIds: string[];
    livingDescendantIds: string[];
    knownAncestorIds: string[];
    familyIds: string[];
    settlementIds: string[];
  }>;
  events: Array<Omit<FamilyGenerationsResult["events"][number], "id" | "familyId" | "lineageId" | "settlementId" | "humanIds"> & {
    id: string;
    familyId: string | null;
    lineageId: string | null;
    settlementId: string | null;
    humanIds: string[];
  }>;
  settlementSummaries: Array<Omit<FamilyGenerationsResult["settlementSummaries"][number], "settlementId" | "familiesPresent" | "largestLineageId" | "foundingFamilies"> & {
    settlementId: string;
    familiesPresent: string[];
    largestLineageId: string | null;
    foundingFamilies: string[];
  }>;
};
export type AtlasHumanMva = {
  tick: string;
  agents: AtlasHumanAgent[];
  causalEvents: Array<{
    id: string;
    tick: string;
    type: string;
    title: string;
    summary: string;
    agentIds: string[];
    cellId: string;
  }>;
  chroniclerEntries: ChroniclerEntry[];
  canSimulateOneHumanDay: boolean;
  forbiddenSystemsImplemented: [];
};

type AtlasHumanDerivedContext = {
  tick: bigint;
  dayStartTick: bigint;
  humanResult: HumanTickResult;
  dayStartHumanResult: HumanTickResult;
  previousHumanResult: HumanTickResult | null;
  settlementResult: SettlementTickResult;
  familyResult: FamilyGenerationsResult;
  storageResult: ResourceStorageResult;
};
type AtlasHumanEmotionKey = "fear" | "distress" | "relief" | "curiosity" | "trust" | "attachment";

export type AtlasHumanEmotionReason = {
  emotion: AtlasHumanEmotionKey;
  before: number;
  after: number;
  delta: number;
  direction: "increased" | "decreased" | "steady" | "viable";
  summary: string;
  reasons: string[];
  causalEventLinks: Array<{
    id: string;
    tick: string;
    type: string;
    title: string;
    summary: string;
  }>;
};

export type AtlasStatistics = {
  averageTemperatureC: number;
  averageSolarEnergy: number;
  averageDaylightHours: number;
  averageHumidity: number;
  highestElevation: number;
  oceanPercent: number;
  largestWatershedEstimate: number;
  strongestWind: AtmosphericSummary["strongestWinds"][number] | null;
  dominantWeatherType: WeatherSummary["dominantWeatherType"];
  largestContinentEstimate: number;
  largestOceanEstimate: number;
  strongestMiningRegion: PlanetResourceSummary["strongestMiningRegion"];
  richestAquifer: PlanetResourceSummary["largestAquifer"];
  averageMineralRichness: number;
  resourceDiversity: number;
};

export type AtlasSnapshot = {
  worldId: string;
  worldSlug: string;
  worldName: string;
  selectedDay: number;
  tick: string;
  yearLengthDays: number;
  grid: ReturnType<typeof getGridSummary> & {
    cellWidthDegrees: number;
    cellHeightDegrees: number;
  };
  time: TimeState;
  astronomy: AstronomyState;
  planet: PlanetState;
  climate: ClimateState;
  terrainSummary: TerrainSummary;
  hydrologySummary: HydrologySummary;
  atmosphereSummary: AtmosphericSummary;
  weatherSummary: WeatherSummary;
  resourceSummary: PlanetResourceSummary;
  biomeSummary: BiomeSummary | null;
  plantSummary: PlantSummary | null;
  animalSummary: AnimalSummary | null;
  statistics: AtlasStatistics;
  humans: AtlasHumanMva;
  settlements: AtlasSettlements;
  families: AtlasFamilyTree;
  fingerprint: Pick<WorldFingerprint, "seed" | "hash" | "shortHash" | "canonical">;
  integrity: {
    canonical: boolean;
    environmentMatch: boolean;
    terrainValidated: boolean;
    climateValidated: boolean;
    hydrologyValidated: boolean;
    atmosphereValidated: boolean;
    weatherValidated: boolean;
  };
  cells: AtlasCell[];
};

function positiveOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function integerOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isInteger(value) ? Number(value) : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function titleize(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_\s]+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
function getConfiguredYearLengthDays(world: WorldWithPlanet): number {
  return Math.max(
    1,
    integerOrDefault(world.yearLengthDays, DEFAULT_WORLD_TIME_CONFIG.yearLengthDays),
  );
}

function getConfiguredCurrentDay(world: WorldWithPlanet): number {
  return getTimeState(world).dayOfYear + 1;
}

function getAtlasTickForDay(world: WorldWithPlanet, selectedDay: number): bigint {
  const clampedDay = clamp(selectedDay, 1, getConfiguredYearLengthDays(world));
  const targetDayIndex = clampedDay - 1;
  const initialDay = integerOrDefault(world.initialDay, DEFAULT_WORLD_TIME_CONFIG.initialDay);
  const dayLengthSeconds = positiveOrDefault(
    world.dayLengthSeconds,
    DEFAULT_WORLD_TIME_CONFIG.dayLengthSeconds,
  );
  const tickDurationSeconds = positiveOrDefault(
    world.tickDurationSeconds,
    DEFAULT_WORLD_TIME_CONFIG.tickDurationSeconds,
  );
  const secondsOffset = (targetDayIndex - initialDay) * dayLengthSeconds;

  return BigInt(Math.round(secondsOffset / tickDurationSeconds));
}

function combineAtlasCells(
  climateCells: readonly ClimateGridCell[],
  terrainCells: readonly TerrainGridCell[],
  hydrologyCells: readonly HydrologyGridCell[],
  atmosphereCells: readonly AtmosphericGridCell[],
  weatherCells: readonly WeatherGridCell[],
  resourceCells: readonly PlanetResourceGridCell[],
  biomeCells: readonly BiomeGridCell[] = [],
  plantCells: readonly PlantGridCell[] = [],
  animalCells: readonly AnimalGridCell[] = [],
): AtlasCell[] {
  const terrainById = new Map(terrainCells.map((cell) => [cell.id, cell]));
  const hydrologyById = new Map(hydrologyCells.map((cell) => [cell.id, cell]));
  const atmosphereById = new Map(atmosphereCells.map((cell) => [cell.id, cell]));
  const weatherById = new Map(weatherCells.map((cell) => [cell.id, cell]));
  const resourcesById = new Map(resourceCells.map((cell) => [cell.id, cell]));
  const biomeById = new Map(biomeCells.map((cell) => [cell.id, cell]));
  const plantById = new Map(plantCells.map((cell) => [cell.id, cell]));
  const animalById = new Map(animalCells.map((cell) => [cell.id, cell]));

  return climateCells.flatMap((cell) => {
    const terrainCell = terrainById.get(cell.id);
    const hydrologyCell = hydrologyById.get(cell.id);
    const atmosphereCell = atmosphereById.get(cell.id);
    const weatherCell = weatherById.get(cell.id);
    const resourceCell = resourcesById.get(cell.id);
    const biomeCell = biomeById.get(cell.id);
    const plantCell = plantById.get(cell.id);
    const animalCell = animalById.get(cell.id);

    if (!terrainCell || !hydrologyCell || !atmosphereCell || !weatherCell || !resourceCell) {
      return [];
    }

    const biomeKey = plantCell?.biomeKey ?? biomeCell?.biomeKey ?? "unclassified";
    const biomeName = plantCell?.biomeName ?? biomeCell?.biomeName ?? "Unclassified";
    const biomeCategory = plantCell?.biomeCategory ?? biomeCell?.biomeCategory ?? "unclassified";
    const biomeColor = plantCell?.biomeColor ?? biomeCell?.biomeColor ?? "#4b5563";
    const biomeTags = plantCell?.biomeTags ?? biomeCell?.biomeTags ?? [];
    const habitabilityScore = plantCell?.habitabilityScore ?? biomeCell?.habitabilityScore ?? 0;
    const fertilityScore = plantCell?.fertilityScore ?? biomeCell?.fertilityScore ?? 0;
    const waterAvailabilityScore = plantCell?.waterAvailabilityScore ?? biomeCell?.waterAvailabilityScore ?? 0;
    const vegetationDensity = plantCell?.vegetationDensity ?? biomeCell?.vegetationDensity ?? 0;

    return [{
      ...cell,
      elevation: terrainCell.elevation,
      terrainType: terrainCell.terrainType,
      continentalness: terrainCell.continentalness,
      ruggedness: terrainCell.ruggedness,
      tectonicActivity: terrainCell.tectonicActivity,
      isCoast: terrainCell.isCoast,
      isOcean: hydrologyCell.isOcean,
      isSea: hydrologyCell.isSea,
      isLakeCandidate: hydrologyCell.isLakeCandidate,
      isRiverCandidate: hydrologyCell.isRiverCandidate,
      waterBodyType: hydrologyCell.waterBodyType,
      drainageDirection: hydrologyCell.drainageDirection,
      drainageTargetId: hydrologyCell.drainageTargetId,
      basinId: hydrologyCell.basinId,
      watershedId: hydrologyCell.watershedId,
      flowAccumulation: hydrologyCell.flowAccumulation,
      moisturePotential: hydrologyCell.moisturePotential,
      distanceToOcean: hydrologyCell.distanceToOcean,
      distanceToCoast: hydrologyCell.distanceToCoast,
      pressureZone: atmosphereCell.pressureZone,
      pressureValue: atmosphereCell.pressureValue,
      windDirection: atmosphereCell.windDirection,
      windStrength: atmosphereCell.windStrength,
      temperatureGradient: atmosphereCell.temperatureGradient,
      moistureTransportPotential: atmosphereCell.moistureTransportPotential,
      orographicLiftPotential: atmosphereCell.orographicLiftPotential,
      rainShadowPotential: atmosphereCell.rainShadowPotential,
      atmosphericStability: atmosphereCell.atmosphericStability,
      seasonalShift: atmosphereCell.seasonalShift,
      cloudCover: weatherCell.cloudCover,
      relativeHumidity: weatherCell.relativeHumidity,
      precipitationPotential: weatherCell.precipitationPotential,
      weatherType: weatherCell.weatherType,
      snowPotential: weatherCell.snowPotential,
      fogPotential: weatherCell.fogPotential,
      stormPotential: weatherCell.stormPotential,
      evaporationPotential: weatherCell.evaporationPotential,
      drynessIndex: weatherCell.drynessIndex,
      weatherStability: weatherCell.weatherStability,
      bedrockType: resourceCell.bedrockType,
      sedimentDepth: resourceCell.sedimentDepth,
      volcanicInfluence: resourceCell.volcanicInfluence,
      erosionPotential: resourceCell.erosionPotential,
      metals: resourceCell.metals,
      industrialMaterials: resourceCell.industrialMaterials,
      rareMaterials: resourceCell.rareMaterials,
      waterResources: resourceCell.waterResources,
      buildingResources: resourceCell.buildingResources,
      resourceRichness: resourceCell.resourceRichness,
      metalRichness: resourceCell.metalRichness,
      industrialRichness: resourceCell.industrialRichness,
      rareMaterialRichness: resourceCell.rareMaterialRichness,
      waterRichness: resourceCell.waterRichness,
      buildingMaterialAvailability: resourceCell.buildingMaterialAvailability,
      resourceDiversity: resourceCell.resourceDiversity,
      biomeKey,
      biomeName,
      biomeCategory,
      biomeColor,
      biomeTags: [...biomeTags],
      adjustedTemperatureC: plantCell?.adjustedTemperatureC ?? biomeCell?.adjustedTemperatureC ?? cell.averageTemperatureC,
      precipitationScore: plantCell?.precipitationScore ?? biomeCell?.precipitationScore ?? weatherCell.precipitationPotential,
      humidityScore: plantCell?.humidityScore ?? biomeCell?.humidityScore ?? weatherCell.relativeHumidity,
      soilMoistureScore: plantCell?.soilMoistureScore ?? biomeCell?.soilMoistureScore ?? hydrologyCell.moisturePotential,
      seasonalityScore: plantCell?.seasonalityScore ?? biomeCell?.seasonalityScore ?? Math.abs(cell.seasonalModifier),
      transitionScore: plantCell?.transitionScore ?? biomeCell?.transitionScore ?? 0,
      habitabilityScore,
      fertilityScore,
      waterAvailabilityScore,
      vegetationDensity,
      dominantPlantKey: plantCell?.dominantPlantKey ?? "none",
      dominantPlantName: plantCell?.dominantPlantName ?? "No Established Plant Life",
      dominantPlantCategory: plantCell?.dominantPlantCategory ?? "none",
      dominantPlantColor: plantCell?.dominantPlantColor ?? "#2f302c",
      plantSuitabilityScore: plantCell?.plantSuitabilityScore ?? 0,
      plantDensity: plantCell?.plantDensity ?? 0,
      biomassScore: plantCell?.biomassScore ?? 0,
      ediblePlantScore: plantCell?.ediblePlantScore ?? 0,
      woodMaterialScore: plantCell?.woodMaterialScore ?? 0,
      medicinalPotentialScore: plantCell?.medicinalPotentialScore ?? 0,
      biodiversityScore: plantCell?.biodiversityScore ?? 0,
      regrowthRate: plantCell?.regrowthRate ?? 0,
      seasonalStressScore: plantCell?.seasonalStressScore ?? 0,
      plantTags: [...(plantCell?.plantTags ?? [])],
      dominantAnimalGuildKey: animalCell?.dominantAnimalGuildKey ?? "none",
      dominantAnimalGuildName: animalCell?.dominantAnimalGuildName ?? "No Established Animal Guild",
      dominantAnimalGuildCategory: animalCell?.dominantAnimalGuildCategory ?? "specialist",
      dominantAnimalGuildColor: animalCell?.dominantAnimalGuildColor ?? "#2d3238",
      animalSuitabilityScore: animalCell?.animalSuitabilityScore ?? 0,
      herbivoreCapacity: animalCell?.herbivoreCapacity ?? 0,
      predatorCapacity: animalCell?.predatorCapacity ?? 0,
      preyAvailability: animalCell?.preyAvailability ?? 0,
      animalDensity: animalCell?.animalDensity ?? 0,
      migrationPressure: animalCell?.migrationPressure ?? 0,
      dangerScore: animalCell?.dangerScore ?? 0,
      huntingValue: animalCell?.huntingValue ?? 0,
      domesticationPotential: animalCell?.domesticationPotential ?? 0,
      animalBiodiversityScore: animalCell?.animalBiodiversityScore ?? 0,
      carryingCapacityScore: animalCell?.carryingCapacityScore ?? 0,
      animalTags: [...(animalCell?.animalTags ?? [])],
      dominantSpeciesId: animalCell?.dominantSpeciesId ?? "none",
      dominantSpeciesName: animalCell?.dominantSpeciesName ?? "No Established Wildlife",
      speciesCount: animalCell?.speciesCount ?? 0,
      totalWildlifePopulation: animalCell?.totalWildlifePopulation ?? 0,
      averagePopulationHealth: animalCell?.averagePopulationHealth ?? 0,
      averageHabitatSuitability: animalCell?.averageHabitatSuitability ?? 0,
      plantConsumptionRate: animalCell?.plantConsumptionRate ?? 0,
      effectivePlantBiomass: animalCell?.effectivePlantBiomass ?? 0,
      predationPressure: animalCell?.predationPressure ?? 0,
      predatorPreyBalance: animalCell?.predatorPreyBalance ?? 0,
      foodStability: animalCell?.foodStability ?? 0,
      carryingCapacityUsage: animalCell?.carryingCapacityUsage ?? 0,
      migrationActivity: animalCell?.migrationActivity ?? 0,
      populationGrowthRate: animalCell?.populationGrowthRate ?? 0,
      ecosystemHealthScore: animalCell?.ecosystemHealthScore ?? 0,
      ecosystemHealthStatus: animalCell?.ecosystemHealthStatus ?? "Collapsed",
      averageFitness: animalCell?.averageFitness ?? 0,
      adaptationDiversity: animalCell?.adaptationDiversity ?? 0,
      averageMigrationInstinct: animalCell?.averageMigrationInstinct ?? 0,
      averageDiseaseResistance: animalCell?.averageDiseaseResistance ?? 0,
      averageReproductiveEfficiency: animalCell?.averageReproductiveEfficiency ?? 0,
      averageClimateAdaptation: animalCell?.averageClimateAdaptation ?? 0,
      highestAdaptedPopulation: animalCell?.highestAdaptedPopulation ?? null,
      lowestFitnessPopulation: animalCell?.lowestFitnessPopulation ?? null,
      ecosystemEvents: [...(animalCell?.ecosystemEvents ?? [])],
      ecosystemHistory: [...(animalCell?.ecosystemHistory ?? [])],
      movementVectors: [...(animalCell?.movementVectors ?? [])],
      animalPopulations: [...(animalCell?.animalPopulations ?? [])],
    }];
  });
}

function buildAtlasStatistics(
  climate: ClimateState,
  terrainSummary: TerrainSummary,
  hydrologySummary: HydrologySummary,
  atmosphereSummary: AtmosphericSummary,
  weatherSummary: WeatherSummary,
  resourceSummary: PlanetResourceSummary,
): AtlasStatistics {
  return {
    averageTemperatureC: round(climate.summary.averageTemperatureC),
    averageSolarEnergy: round(climate.summary.averageSolarEnergy),
    averageDaylightHours: round(climate.summary.averageDaylightHours),
    averageHumidity: round(weatherSummary.averageHumidity),
    highestElevation: round(terrainSummary.highestElevation),
    oceanPercent: round(terrainSummary.oceanPercent),
    largestWatershedEstimate: hydrologySummary.largestWatershedEstimate,
    strongestWind: atmosphereSummary.strongestWinds[0] ?? null,
    dominantWeatherType: weatherSummary.dominantWeatherType,
    largestContinentEstimate: terrainSummary.largestContinentEstimate,
    largestOceanEstimate: terrainSummary.largestOceanEstimate,
    strongestMiningRegion: resourceSummary.strongestMiningRegion,
    richestAquifer: resourceSummary.largestAquifer,
    averageMineralRichness: round(resourceSummary.averageMineralRichness),
    resourceDiversity: round(resourceSummary.resourceDiversity),
  };
}

const EXPLAINED_HUMAN_EMOTIONS: AtlasHumanEmotionKey[] = ["fear", "distress", "relief", "curiosity", "trust", "attachment"];
const EMOTION_CHANGE_EPSILON = 0.005;

function emotionLabel(emotion: AtlasHumanEmotionKey): string {
  return `${emotion.charAt(0).toUpperCase()}${emotion.slice(1)}`;
}

function joinReasonPhrases(reasons: readonly string[]): string {
  if (reasons.length <= 1) {
    return reasons[0] ?? "no direct affect driver changed enough to move it";
  }

  if (reasons.length === 2) {
    return `${reasons[0]} and ${reasons[1]}`;
  }

  return `${reasons.slice(0, -1).join(", ")}, and ${reasons[reasons.length - 1]}`;
}

function addUniqueReason(reasons: string[], reason: string) {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function emotionDirection(emotion: AtlasHumanEmotionKey, before: number, after: number): AtlasHumanEmotionReason["direction"] {
  const delta = after - before;

  if (Math.abs(delta) >= EMOTION_CHANGE_EPSILON) {
    return delta > 0 ? "increased" : "decreased";
  }

  return emotion === "curiosity" && after >= 0.35 ? "viable" : "steady";
}

function hasHumanEvent(events: readonly HumanCausalEvent[], typePart: string): boolean {
  return events.some((event) => event.type.includes(typePart));
}

function linkedEventsForEmotion(
  emotion: AtlasHumanEmotionKey,
  events: readonly HumanCausalEvent[],
  normalizeHumanTextIds: (value: string) => string,
): AtlasHumanEmotionReason["causalEventLinks"] {
  const relevantEvents = events.filter((event) => {
    if (emotion === "fear") {
      return event.type.includes("Safety") || event.type.includes("Need");
    }

    if (emotion === "distress" || emotion === "relief") {
      return event.type.includes("Need") || event.type.includes("Safety");
    }

    if (emotion === "trust" || emotion === "attachment") {
      return event.type.includes("Communication") || event.type.includes("Teaching");
    }

    return event.type.includes("Safety");
  });

  return relevantEvents.slice(-3).map((event) => ({
    id: normalizeHumanTextIds(event.id),
    tick: event.tick,
    type: event.type,
    title: event.title,
    summary: normalizeHumanTextIds(event.summary),
  }));
}

function buildEmotionReasonPhrases(
  emotion: AtlasHumanEmotionKey,
  beforeAgent: HumanAgent,
  afterAgent: HumanAgent,
  dayEvents: readonly HumanCausalEvent[],
): string[] {
  const reasons: string[] = [];
  const needReduced = (key: keyof HumanNeeds) => beforeAgent.needs[key] > afterAgent.needs[key] + EMOTION_CHANGE_EPSILON;
  const needRose = (key: keyof HumanNeeds) => afterAgent.needs[key] > beforeAgent.needs[key] + EMOTION_CHANGE_EPSILON;
  const direction = emotionDirection(emotion, beforeAgent.emotions[emotion], afterAgent.emotions[emotion]);

  if (emotion === "fear") {
    if (direction === "increased") {
      if (hasHumanEvent(dayEvents, "Safety Check Failed")) addUniqueReason(reasons, "a safety check failed under a serious threat");
      if (needRose("safety") || afterAgent.needs.safety > 0.52) addUniqueReason(reasons, "safety pressure stayed high");
      if (afterAgent.needs.thirst > 0.64) addUniqueReason(reasons, "thirst kept danger salient");
      if (afterAgent.needs.hunger > 0.68) addUniqueReason(reasons, "hunger kept danger salient");
    } else if (direction === "decreased") {
      if (afterAgent.needs.safety < 0.42 || needReduced("safety")) addUniqueReason(reasons, "surroundings were safe");
      if (needReduced("hunger")) addUniqueReason(reasons, "hunger was reduced");
      if (needReduced("thirst")) addUniqueReason(reasons, "thirst was reduced");
      if (hasHumanEvent(dayEvents, "Safety Secured")) addUniqueReason(reasons, "safer ground was found");
    } else if (afterAgent.needs.safety < 0.42) {
      addUniqueReason(reasons, "no serious safety threat was present");
    }
  }

  if (emotion === "distress") {
    if (direction === "increased") {
      if (needRose("hunger") || afterAgent.needs.hunger > 0.68) addUniqueReason(reasons, "hunger pressure rose");
      if (needRose("thirst") || afterAgent.needs.thirst > 0.64) addUniqueReason(reasons, "thirst pressure rose");
      if (needRose("fatigue") || afterAgent.needs.fatigue > 0.78) addUniqueReason(reasons, "fatigue added strain");
      if (needRose("safety") || afterAgent.needs.safety > 0.68) addUniqueReason(reasons, "safety pressure added strain");
    } else if (direction === "decreased") {
      if (needReduced("hunger")) addUniqueReason(reasons, "hunger was reduced");
      if (needReduced("thirst")) addUniqueReason(reasons, "thirst was reduced");
      if (needReduced("fatigue")) addUniqueReason(reasons, "fatigue was reduced");
      if (afterAgent.emotions.relief > beforeAgent.emotions.relief) addUniqueReason(reasons, "relief rose after a successful action");
    } else if (afterAgent.needs.safety < 0.42) {
      addUniqueReason(reasons, "basic strain stayed manageable");
    }
  }

  if (emotion === "relief") {
    if (direction === "increased") {
      if (hasHumanEvent(dayEvents, "Need Fulfilled")) addUniqueReason(reasons, "food or water was successfully gathered");
      if (hasHumanEvent(dayEvents, "Safety Secured")) addUniqueReason(reasons, "safer ground was found");
      if (needReduced("fatigue")) addUniqueReason(reasons, "rest reduced fatigue");
    } else if (direction === "decreased") {
      addUniqueReason(reasons, "earlier relief faded without a new major success");
    } else {
      addUniqueReason(reasons, "no major relief-producing event changed it");
    }
  }

  if (emotion === "curiosity") {
    if (direction === "increased") {
      if (afterAgent.emotions.fear < 0.45 && afterAgent.emotions.distress < 0.65) addUniqueReason(reasons, "no serious threat was present");
      if (afterAgent.emotions.comfort >= beforeAgent.emotions.comfort) addUniqueReason(reasons, "comfort supported attention");
      addUniqueReason(reasons, "innate curiosity kept pulling attention outward");
    } else if (direction === "decreased") {
      if (afterAgent.emotions.fear > beforeAgent.emotions.fear) addUniqueReason(reasons, "fear narrowed attention");
      if (afterAgent.emotions.distress > beforeAgent.emotions.distress) addUniqueReason(reasons, "distress narrowed attention");
      if (afterAgent.needs.fatigue > beforeAgent.needs.fatigue) addUniqueReason(reasons, "fatigue reduced exploratory energy");
    } else if (direction === "viable") {
      addUniqueReason(reasons, "no serious threat was present");
    } else {
      addUniqueReason(reasons, "attention stayed constrained by current pressure");
    }
  }

  if (emotion === "trust") {
    if (direction === "increased") {
      if (hasHumanEvent(dayEvents, "Communication")) addUniqueReason(reasons, "companionship was communicated successfully");
      if (hasHumanEvent(dayEvents, "Teaching")) addUniqueReason(reasons, "teaching reinforced reliability");
    } else if (direction === "decreased") {
      addUniqueReason(reasons, "trust was reduced by the day outcome");
    } else {
      addUniqueReason(reasons, "no trust-changing interaction occurred");
    }
  }

  if (emotion === "attachment") {
    if (direction === "increased") {
      if (hasHumanEvent(dayEvents, "Communication")) addUniqueReason(reasons, "companionship was communicated successfully");
      addUniqueReason(reasons, "repeated proximity strengthened bonding");
    } else if (direction === "decreased") {
      addUniqueReason(reasons, "attachment weakened during the day");
    } else {
      addUniqueReason(reasons, "no attachment-changing interaction occurred");
    }
  }

  return reasons.length > 0 ? reasons : ["the background affect update kept it near its prior level"];
}

function buildHumanEmotionReasons(
  beforeAgent: HumanAgent,
  afterAgent: HumanAgent,
  dayEvents: readonly HumanCausalEvent[],
  normalizeHumanTextIds: (value: string) => string,
): AtlasHumanEmotionReason[] {
  return EXPLAINED_HUMAN_EMOTIONS.map((emotion) => {
    const before = round(beforeAgent.emotions[emotion]);
    const after = round(afterAgent.emotions[emotion]);
    const delta = round(after - before);
    const direction = emotionDirection(emotion, before, after);
    const reasons = buildEmotionReasonPhrases(emotion, beforeAgent, afterAgent, dayEvents);
    const directionText = direction === "viable" ? "stayed viable" : direction === "steady" ? "remained steady" : direction;

    return {
      emotion,
      before,
      after,
      delta,
      direction,
      summary: `${emotionLabel(emotion)} ${directionText} because ${joinReasonPhrases(reasons)}.`,
      reasons,
      causalEventLinks: linkedEventsForEmotion(emotion, dayEvents, normalizeHumanTextIds),
    };
  });
}

function latestEmotionChangeSummary(reasons: readonly AtlasHumanEmotionReason[]): string {
  const [latestChange] = [...reasons].sort((left, right) => {
    const rightChanged = Math.abs(right.delta) >= EMOTION_CHANGE_EPSILON ? 1 : 0;
    const leftChanged = Math.abs(left.delta) >= EMOTION_CHANGE_EPSILON ? 1 : 0;

    return rightChanged - leftChanged || Math.abs(right.delta) - Math.abs(left.delta);
  });

  return latestChange?.summary ?? "No tracked emotion changed during the latest day.";
}

function averageMemoryValue(memories: readonly HumanMemory[], key: "confidence" | "importance"): number {
  if (memories.length === 0) {
    return 0;
  }

  return round(memories.reduce((sum, memory) => sum + memory[key], 0) / memories.length);
}

function averageKnowledgeValue(knowledge: readonly HumanKnowledge[], key: "confidence" | "mastery"): number {
  if (knowledge.length === 0) {
    return 0;
  }

  return round(knowledge.reduce((sum, entry) => sum + entry[key], 0) / knowledge.length);
}

function knowledgeSummary(
  knowledge: HumanKnowledge,
  displayId: (sourceId: string) => string,
  normalizeHumanTextIds: (value: string) => string,
): AtlasHumanKnowledgeSummary {
  return {
    id: normalizeHumanTextIds(knowledge.id),
    topic: normalizeHumanTextIds(knowledge.topic),
    category: knowledge.category,
    discoveredTick: knowledge.discoveredTick,
    learnedTick: knowledge.learnedTick,
    sourceType: knowledge.sourceType,
    sourceHumanId: knowledge.sourceHumanId ? displayId(knowledge.sourceHumanId) : null,
    originatingHumanId: displayId(knowledge.originatingHumanId),
    confidence: knowledge.confidence,
    mastery: knowledge.mastery,
    reliability: knowledge.reliability,
    practiceCount: knowledge.practiceCount,
    teachingCount: knowledge.teachingCount,
    lastUsedTick: knowledge.lastUsedTick,
    lastTaughtTick: knowledge.lastTaughtTick,
    importance: knowledge.importance,
    teacher: knowledge.sourceHumanId ? displayId(knowledge.sourceHumanId) : null,
    students: knowledge.learnerHumanIds.map(displayId),
    tags: [...knowledge.tags],
  };
}

function topKnowledgeSummaries(
  knowledge: readonly HumanKnowledge[],
  displayId: (sourceId: string) => string,
  normalizeHumanTextIds: (value: string) => string,
  sortBy: "recent" | "mastery" | "taught" = "mastery",
  limit = 6,
): AtlasHumanKnowledgeSummary[] {
  const sorted = [...knowledge].sort((left, right) => {
    if (sortBy === "recent") {
      return Number(BigInt(right.learnedTick) - BigInt(left.learnedTick)) || left.id.localeCompare(right.id);
    }

    if (sortBy === "taught") {
      return Number(BigInt(right.lastTaughtTick ?? "0") - BigInt(left.lastTaughtTick ?? "0")) || right.teachingCount - left.teachingCount || left.id.localeCompare(right.id);
    }

    return right.mastery - left.mastery || right.confidence - left.confidence || right.importance - left.importance || left.id.localeCompare(right.id);
  });

  return sorted.slice(0, limit).map((entry) => knowledgeSummary(entry, displayId, normalizeHumanTextIds));
}

function knowledgeCategorySummaries(knowledge: readonly HumanKnowledge[]): Array<{ category: string; count: number; averageMastery: number }> {
  const byCategory = new Map<string, HumanKnowledge[]>();

  for (const entry of knowledge) {
    byCategory.set(entry.category, [...(byCategory.get(entry.category) ?? []), entry]);
  }

  return [...byCategory.entries()]
    .map(([category, entries]) => ({ category, count: entries.length, averageMastery: averageKnowledgeValue(entries, "mastery") }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

function communicationSuccessRate(communications: readonly HumanCommunicationRecord[]): number {
  const receptions = communications.flatMap((communication) => communication.receptions);

  if (receptions.length === 0) {
    return 0;
  }

  return round(receptions.filter((reception) => reception.accepted).length / receptions.length);
}

function communicationSummary(
  communication: HumanCommunicationRecord,
  displayId: (sourceId: string) => string,
  normalizeHumanTextIds: (value: string) => string,
): AtlasHumanCommunicationSummary {
  return {
    id: normalizeHumanTextIds(communication.id),
    tick: communication.tick,
    senderHumanId: displayId(communication.senderHumanId),
    receiverHumanIds: communication.receiverHumanIds.map(displayId),
    type: communication.type,
    topic: normalizeHumanTextIds(communication.topic),
    method: communication.communicationMethod,
    urgency: communication.urgency,
    clarity: communication.clarity,
    confidence: communication.confidence,
    emotionalWeight: communication.emotionalWeight,
    understood: communication.understood,
    accepted: communication.accepted,
    successRate: communicationSuccessRate([communication]),
    ignoredCount: communication.receptions.filter((reception) => reception.ignored).length,
    tags: [...communication.tags],
  };
}

function topCommunicationSummaries(
  communications: readonly HumanCommunicationRecord[],
  displayId: (sourceId: string) => string,
  normalizeHumanTextIds: (value: string) => string,
  sortBy: "recent" | "urgency" = "recent",
  limit = 6,
): AtlasHumanCommunicationSummary[] {
  const sorted = [...communications].sort((left, right) => {
    if (sortBy === "urgency") {
      return right.urgency - left.urgency || right.emotionalWeight - left.emotionalWeight || left.id.localeCompare(right.id);
    }

    return Number(BigInt(right.tick) - BigInt(left.tick)) || left.id.localeCompare(right.id);
  });

  return sorted.slice(0, limit).map((communication) => communicationSummary(communication, displayId, normalizeHumanTextIds));
}

function commonCommunicationTypes(communications: readonly HumanCommunicationRecord[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();

  for (const communication of communications) {
    counts.set(communication.type, (counts.get(communication.type) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type))
    .slice(0, 5);
}

function frequentContacts(communications: readonly HumanCommunicationRecord[], agentId: string, displayId: (sourceId: string) => string): Array<{ humanId: string; count: number }> {
  const counts = new Map<string, number>();

  for (const communication of communications) {
    if (communication.senderHumanId === agentId) {
      for (const receiverId of communication.receiverHumanIds) {
        counts.set(receiverId, (counts.get(receiverId) ?? 0) + 1);
      }
    } else if (communication.receiverHumanIds.includes(agentId)) {
      counts.set(communication.senderHumanId, (counts.get(communication.senderHumanId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([humanId, count]) => ({ humanId: displayId(humanId), count }))
    .sort((left, right) => right.count - left.count || left.humanId.localeCompare(right.humanId))
    .slice(0, 5);
}

function trustedTeachers(communications: readonly HumanCommunicationRecord[], agentId: string, displayId: (sourceId: string) => string): Array<{ humanId: string; acceptedTeachings: number }> {
  const counts = new Map<string, number>();

  for (const communication of communications) {
    if (communication.type !== "Teaching" || !communication.receiverHumanIds.includes(agentId)) {
      continue;
    }

    const accepted = communication.receptions.some((reception) => reception.receiverHumanId === agentId && reception.accepted);
    if (accepted) {
      counts.set(communication.senderHumanId, (counts.get(communication.senderHumanId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([humanId, acceptedTeachings]) => ({ humanId: displayId(humanId), acceptedTeachings }))
    .sort((left, right) => right.acceptedTeachings - left.acceptedTeachings || left.humanId.localeCompare(right.humanId))
    .slice(0, 5);
}
function memorySummary(memory: HumanMemory, normalizeHumanTextIds: (value: string) => string): AtlasHumanMemorySummary {
  return {
    id: normalizeHumanTextIds(memory.id),
    tick: memory.createdTick,
    type: memory.type,
    category: memory.category,
    eventType: memory.eventType,
    summary: normalizeHumanTextIds(memory.summary),
    locationCellId: memory.locationCellId,
    importance: memory.importance,
    confidence: memory.confidence,
    emotionalWeight: memory.emotionalWeight,
    recallCount: memory.recallCount,
    exposureCount: memory.exposureCount,
    tags: [...memory.tags],
  };
}

function topMemorySummaries(
  memories: readonly HumanMemory[],
  normalizeHumanTextIds: (value: string) => string,
  sortBy: "recent" | "importance" | "recall" = "recent",
  limit = 5,
): AtlasHumanMemorySummary[] {
  const sorted = [...memories].sort((left, right) => {
    if (sortBy === "importance") {
      return right.importance - left.importance || right.confidence - left.confidence || left.id.localeCompare(right.id);
    }

    if (sortBy === "recall") {
      return right.recallCount - left.recallCount || right.importance - left.importance || left.id.localeCompare(right.id);
    }

    return Number(BigInt(right.createdTick) - BigInt(left.createdTick)) || left.id.localeCompare(right.id);
  });

  return sorted.slice(0, limit).map((memory) => memorySummary(memory, normalizeHumanTextIds));
}

function relationshipStrength(relationship: HumanRelationship): number {
  return Math.round(Math.max(
    relationship.trust + relationship.affection + relationship.familiarity,
    relationship.fear + relationship.rivalry,
    relationship.respect + relationship.dependency,
    relationship.socialMemoryScore,
  ) * 1_000_000) / 1_000_000;
}

function relationshipSummary(
  relationship: HumanRelationship,
  displayId: (sourceId: string) => string,
): AtlasHumanRelationshipSummary {
  return {
    humanId: displayId(relationship.humanId ?? relationship.fromAgentId),
    targetHumanId: displayId(relationship.targetHumanId ?? relationship.toAgentId),
    status: relationship.status,
    kinship: relationship.kinship,
    familiarity: relationship.familiarity,
    trust: relationship.trust,
    affection: relationship.affection,
    fear: relationship.fear,
    respect: relationship.respect,
    rivalry: relationship.rivalry,
    dependency: relationship.dependency,
    grief: relationship.grief,
    socialMemoryScore: relationship.socialMemoryScore,
    strongestScore: relationshipStrength(relationship),
    tags: [...relationship.tags],
    lastInteractionTick: relationship.lastInteractionTick,
  };
}

function topRelationships(
  relationships: readonly HumanRelationship[],
  displayId: (sourceId: string) => string,
  sortBy: "closest" | "trust" | "fear" | "rivalry" | "family" = "closest",
  limit = 5,
): AtlasHumanRelationshipSummary[] {
  const filtered = relationships.filter((relationship) => sortBy !== "family" || relationship.status === "Family" || relationship.kinship !== "none");
  const sorted = [...filtered].sort((left, right) => {
    if (sortBy === "trust") {
      return right.trust - left.trust || right.affection - left.affection || left.targetHumanId.localeCompare(right.targetHumanId);
    }

    if (sortBy === "fear") {
      return right.fear - left.fear || right.rivalry - left.rivalry || left.targetHumanId.localeCompare(right.targetHumanId);
    }

    if (sortBy === "rivalry") {
      return right.rivalry - left.rivalry || right.fear - left.fear || left.targetHumanId.localeCompare(right.targetHumanId);
    }

    if (sortBy === "family") {
      return right.affection - left.affection || right.trust - left.trust || left.targetHumanId.localeCompare(right.targetHumanId);
    }

    return relationshipStrength(right) - relationshipStrength(left) || left.targetHumanId.localeCompare(right.targetHumanId);
  });

  return sorted.slice(0, limit).map((relationship) => relationshipSummary(relationship, displayId));
}

function getAtlasHumanDerivedContext(
  world: WorldWithPlanet,
  tick: bigint,
  dayStartTick: bigint,
  grid: SpatialGrid,
): AtlasHumanDerivedContext {
  const key = getSnapshotWorldKey(world, grid, `atlas:social:${tick.toString()}:${dayStartTick.toString()}`);

  return memoizeSnapshotValue(
    "atlas:social-context",
    key,
    () => {
      const humanResult = getHumanMvaStateAtTick(world, tick);
      const dayStartHumanResult = getHumanMvaStateAtTick(world, dayStartTick);
      const previousHumanResult = tick > 0n ? getHumanMvaStateAtTick(world, tick - 1n) : null;
      const settlementResult = getSettlementStateAtTick({
        world,
        tick,
        humanResult,
        previousHumanResult,
      });
      const familyResult = getFamilyGenerationsStateFromHumanState({
        worldId: world.id,
        tick,
        state: humanResult.state,
        previousState: previousHumanResult?.state ?? null,
        settlements: settlementResult,
      });
      const storageResult = getResourceStorageStateFromHumanState({
        worldId: world.id,
        tick,
        state: familyResult.state,
        settlements: settlementResult,
      });

      return {
        tick,
        dayStartTick,
        humanResult,
        dayStartHumanResult,
        previousHumanResult,
        settlementResult,
        familyResult,
        storageResult,
      };
    },
    0,
  ).value;
}
function buildAtlasSettlements(
  world: WorldWithPlanet,
  selectedDay: number,
  grid: SpatialGrid = createGrid(),
  context?: AtlasHumanDerivedContext,
): AtlasSettlements {
  const dayEndTick = BigInt(Math.max(0, selectedDay - 1) * HUMAN_MVA_DAY_TICKS);
  const derivedContext = context ?? getAtlasHumanDerivedContext(world, dayEndTick, dayEndTick, grid);
  const currentHumanResult = derivedContext.humanResult;
  const result = derivedContext.settlementResult;
  const familyResult = derivedContext.familyResult;
  const storageResult = derivedContext.storageResult;
  const displayIdBySourceId = new Map(currentHumanResult.state.agents.map((agent) => [agent.id, `first-human-${agent.sex}`]));
  const displayId = (sourceId: string) => displayIdBySourceId.get(sourceId) ?? sourceId.replace(`${world.id}:`, "");
  const normalizeSettlementText = (value: string) => value.replaceAll(`${world.id}:`, "").replaceAll(world.id, "atlas-world");
  const residentsByCell = new Map<string, string[]>();

  for (const agent of currentHumanResult.state.agents) {
    const cells = new Set([agent.currentCellId, agent.homeCellId, agent.homeProfile.primaryHomeCellId]);
    for (const cellId of cells) {
      residentsByCell.set(cellId, [...(residentsByCell.get(cellId) ?? []), displayId(agent.id)].sort());
    }
  }

  const settlements = result.settlements.map((settlement) => {
    const familySummary = familyResult.settlementSummaries.find((summary) => summary.settlementId === settlement.id);
    const storage = storageResult.storages.find((entry) => entry.settlementId === settlement.id) ?? null;
    const resourceSummary = storageResult.settlementSummaries.find((summary) => summary.settlementId === settlement.id) ?? null;

    const majorEvents = settlement.history.filter((entry) => entry.importance >= 0.5 || entry.type.includes("Camp") || entry.type.includes("Fire") || entry.type.includes("Food"));
    const resources = Object.entries(settlement.storedResources)
      .filter(([, value]) => value > 0)
      .map(([key]) => titleize(key));

    return {
      id: settlement.id.replace(`${world.id}:`, ""),
      name: settlement.name,
      foundedTick: settlement.foundedTick,
      population: settlement.currentPopulation,
      peakPopulation: settlement.peakPopulation,
      ageTicks: Math.max(0, Number(dayEndTick - BigInt(settlement.foundedTick))),
      homeCellId: settlement.homeCellId,
      occupiedCells: settlement.occupiedCells,
      type: settlement.type,
      status: settlement.status,
      importance: settlement.importance,
      permanence: settlement.permanence,
      founders: settlement.founderIds.map(displayId),
      currentResidents: residentsByCell.get(settlement.homeCellId) ?? [],
      structures: settlement.structures,
      storedResources: settlement.storedResources,
      storage,
      resourceSummary,
      foodSupply: resourceSummary?.foodSupply ?? 0,
      waterSupply: resourceSummary?.waterSupply ?? 0,
      firewood: resourceSummary?.firewood ?? 0,
      constructionMaterials: resourceSummary?.constructionMaterials ?? 0,
      storageCapacity: resourceSummary?.capacity ?? storage?.capacity ?? 0,
      storageCapacityUsed: resourceSummary?.capacityUsed ?? 0,
      spoilage: resourceSummary?.spoilage ?? 0,
      dailyConsumption: resourceSummary?.dailyConsumption ?? 0,
      largestContributors: resourceSummary?.largestContributors.map((entry) => ({ ...entry, humanId: displayId(entry.humanId) })) ?? [],
      mostNeededResources: resourceSummary?.mostNeededResources ?? [],
      resourceTrends: resourceSummary?.resourceTrends ?? [],
      culturalTraits: settlement.culturalTraits,
      knownKnowledge: settlement.knowledgeSummary,
      relationships: settlement.relationshipGraph.map((edge) => ({
        ...edge,
        fromHumanId: displayId(edge.fromHumanId),
        toHumanId: displayId(edge.toHumanId),
      })),
      majorEvents,
      births: settlement.history.filter((entry) => entry.type.includes("Birth")),
      deaths: settlement.history.filter((entry) => entry.type.includes("Death")),
      growthTimeline: settlement.history.filter((entry) => entry.type.includes("Population") || entry.type.includes("Expanded") || entry.type.includes("Founded")),
      nearbyResources: resources,
      seasonalStatus: settlement.status === "seasonal" ? "Revisited seasonally" : settlement.status === "permanent" ? "Permanent" : titleize(settlement.status),
      discoveryHistory: settlement.discoveryHistory.map((entry) => ({ ...entry, humanId: displayId(entry.humanId) })),
      familiesPresent: familySummary?.familiesPresent.map((id) => id.replace(`${world.id}:`, "")) ?? [],
      largestLineage: familySummary?.largestLineageId ? familySummary.largestLineageId.replace(`${world.id}:`, "") : null,
      children: familySummary?.children ?? 0,
      elders: familySummary?.elders ?? 0,
      foundingFamilies: familySummary?.foundingFamilies.map((id) => id.replace(`${world.id}:`, "")) ?? [],
      tags: settlement.tags,
    } satisfies AtlasSettlementSummary;
  });

  return {
    tick: result.tick,
    settlements,
    activeCount: settlements.filter((settlement) => settlement.status !== "abandoned").length,
    abandonedCount: settlements.filter((settlement) => settlement.status === "abandoned").length,
    firstSettlement: settlements[0] ?? null,
    recentEvents: result.events.slice(-8).map((event) => ({
      id: normalizeSettlementText(event.id) ?? event.id,
      tick: event.tick,
      settlementId: event.settlementId.replace(`${world.id}:`, ""),
      kind: event.kind,
      title: normalizeSettlementText(event.title),
      summary: normalizeSettlementText(event.summary),
      importance: event.importance,
      cellId: event.cellId,
    })),
    scoring: result.scoring.slice(0, 12),
  };
}
function buildAtlasHumans(
  world: WorldWithPlanet,
  selectedDay: number,
  grid: SpatialGrid = createGrid(),
  context?: AtlasHumanDerivedContext,
): AtlasHumanMva {
  const dayEndTick = BigInt(Math.max(1, selectedDay) * HUMAN_MVA_DAY_TICKS);
  const dayStartTick = BigInt(Math.max(0, selectedDay - 1) * HUMAN_MVA_DAY_TICKS);
  const derivedContext = context ?? getAtlasHumanDerivedContext(world, dayEndTick, dayStartTick, grid);
  const result = derivedContext.humanResult;
  const dayStartResult = derivedContext.dayStartHumanResult;
  const dayStartAgentById = new Map(dayStartResult.state.agents.map((agent) => [agent.id, agent]));
  const displayIdBySourceId = new Map(result.state.agents.map((agent) => [agent.id, `first-human-${agent.sex}`]));
  const displayId = (sourceId: string) => displayIdBySourceId.get(sourceId) ?? sourceId.replace(`${world.id}:`, "");
  const normalizeHumanTextIds = (value: string) => result.state.agents.reduce(
    (text, agent) => text.split(agent.id).join(displayId(agent.id)),
    value,
  ).replaceAll(`${world.id}:`, "").replaceAll(world.id, "atlas-world");
  const storageResult = derivedContext.storageResult;
  const normalizeStoredResource = (resource: HumanInventorySummary["personalInventory"][number]) => ({
    ...resource,
    id: normalizeHumanTextIds(resource.id),
    producerHumanId: resource.producerHumanId ? displayId(resource.producerHumanId) : null,
    settlementId: resource.settlementId ? normalizeHumanTextIds(resource.settlementId) : null,
  });
  const normalizeStorageHistory = (entry: HumanInventorySummary["recentDeposits"][number]) => ({
    ...entry,
    humanId: entry.humanId ? displayId(entry.humanId) : null,
    summary: normalizeHumanTextIds(entry.summary),
  });
  const latestDayEvents = result.state.causalEvents.filter((event) => {
    const eventTick = BigInt(event.tick);

    return eventTick > dayStartTick && eventTick <= dayEndTick;
  });

  return {
    tick: result.state.tick,
    agents: result.state.agents.map((agent) => {
      const otherAgent = result.state.agents.find((candidate) => candidate.id !== agent.id) ?? null;
      const relationshipToOther = otherAgent
        ? result.state.relationships.find((relationship) =>
          relationship.fromAgentId === agent.id && relationship.toAgentId === otherAgent.id,
        ) ?? null
        : null;
      const agentRelationships = result.state.relationships.filter((relationship) =>
        (relationship.humanId ?? relationship.fromAgentId) === agent.id,
      );
      const closestRelationships = topRelationships(agentRelationships, displayId, "closest", 5);
      const trustedHumans = topRelationships(agentRelationships.filter((relationship) => relationship.trust >= 0.5), displayId, "trust", 5);
      const fearedHumans = topRelationships(agentRelationships.filter((relationship) => relationship.fear >= 0.35 || relationship.status === "Threat"), displayId, "fear", 5);
      const rivals = topRelationships(agentRelationships.filter((relationship) => relationship.rivalry >= 0.25 || relationship.status === "Rival"), displayId, "rivalry", 5);
      const family = topRelationships(agentRelationships, displayId, "family", 5);
      const strongestBond = closestRelationships[0] ?? null;
      const agentMemories = result.state.memories.filter((memory) => memory.agentId === agent.id);
      const latestMemory = topMemorySummaries(agentMemories, normalizeHumanTextIds, "recent", 1)[0] ?? null;
      const recentMemories = topMemorySummaries(agentMemories, normalizeHumanTextIds, "recent", 5);
      const strongestMemories = topMemorySummaries(agentMemories, normalizeHumanTextIds, "importance", 5);
      const mostRecalledMemories = topMemorySummaries(agentMemories, normalizeHumanTextIds, "recall", 5);
      const dangerMemories = topMemorySummaries(agentMemories.filter((memory) => memory.tags.includes("danger")), normalizeHumanTextIds, "importance", 5);
      const foodMemories = topMemorySummaries(agentMemories.filter((memory) => memory.tags.includes("food")), normalizeHumanTextIds, "importance", 5);
      const relationshipMemories = topMemorySummaries(agentMemories.filter((memory) => memory.tags.includes("relationship")), normalizeHumanTextIds, "importance", 5);
      const memoryTimeline = topMemorySummaries(agentMemories, normalizeHumanTextIds, "recent", 12).reverse();
      const agentKnowledge = result.state.knowledge.filter((entry) => entry.agentId === agent.id && !entry.isForgotten);
      const knownKnowledge = topKnowledgeSummaries(agentKnowledge, displayId, normalizeHumanTextIds, "mastery", 8);
      const recentlyLearnedKnowledge = topKnowledgeSummaries(agentKnowledge, displayId, normalizeHumanTextIds, "recent", 6);
      const recentlyTaughtKnowledge = topKnowledgeSummaries(agentKnowledge.filter((entry) => entry.lastTaughtTick), displayId, normalizeHumanTextIds, "taught", 6);
      const knowledgeTimeline = agentKnowledge
        .flatMap((entry) => entry.history.map((history) => ({
          tick: history.tick,
          event: history.event,
          topic: normalizeHumanTextIds(entry.topic),
          category: entry.category,
          summary: normalizeHumanTextIds(history.summary),
          confidence: history.confidence,
          mastery: history.mastery,
          sourceHumanId: history.sourceHumanId ? displayId(history.sourceHumanId) : null,
        })))
        .sort((left, right) => Number(BigInt(right.tick) - BigInt(left.tick)) || left.topic.localeCompare(right.topic))
        .slice(0, 12)
        .reverse();
      const agentCommunications = result.state.communications.filter((communication) =>
        communication.senderHumanId === agent.id || communication.receiverHumanIds.includes(agent.id),
      );
      const sentCommunications = result.state.communications.filter((communication) => communication.senderHumanId === agent.id);
      const receivedCommunications = result.state.communications.filter((communication) => communication.receiverHumanIds.includes(agent.id));
      const ignoredCommunications = receivedCommunications.filter((communication) =>
        communication.receptions.some((reception) => reception.receiverHumanId === agent.id && reception.ignored),
      );
      const teachingCommunications = agentCommunications.filter((communication) => communication.type === "Teaching");
      const warningCommunications = agentCommunications.filter((communication) => communication.type === "Warning" || communication.type === "Danger");
      const recentCommunications = topCommunicationSummaries(agentCommunications, displayId, normalizeHumanTextIds, "recent", 6);
      const communicationTimeline = topCommunicationSummaries(agentCommunications, displayId, normalizeHumanTextIds, "recent", 12).reverse();
      const latestCausalEvent = [...result.state.causalEvents]
        .reverse()
        .find((event) => event.agentIds.includes(agent.id)) ?? null;
      const agentDayEvents = latestDayEvents.filter((event) => event.agentIds.includes(agent.id));
      const relationshipChangeEvents = [...result.state.causalEvents]
        .filter((event) => event.type === "Human Relationship Event" && event.agentIds.includes(agent.id))
        .sort((left, right) => Number(BigInt(right.tick) - BigInt(left.tick)) || left.id.localeCompare(right.id));
      const recentRelationshipChanges = relationshipChangeEvents.slice(0, 6).map((event) => {
        const targetHumanId = event.agentIds.find((agentId) => agentId !== agent.id) ?? null;

        return {
          tick: event.tick,
          type: event.title,
          summary: normalizeHumanTextIds(event.summary),
          targetHumanId: targetHumanId ? displayId(targetHumanId) : null,
          status: typeof event.effects.status === "string" ? event.effects.status : undefined,
        };
      });
      const socialHistory = [
        ...agentRelationships.flatMap((relationship) => relationship.history.map((entry) => ({
          tick: entry.tick,
          type: entry.event,
          summary: normalizeHumanTextIds(entry.summary),
          targetHumanId: displayId(relationship.targetHumanId ?? relationship.toAgentId),
          status: relationship.status,
        }))),
        ...recentRelationshipChanges,
      ].sort((left, right) => Number(BigInt(right.tick) - BigInt(left.tick)) || left.type.localeCompare(right.type)).slice(0, 10);
      const inventory = storageResult.humanInventories.find((entry) => entry.humanId === agent.id);
      const emotionReasons = buildHumanEmotionReasons(
        dayStartAgentById.get(agent.id) ?? agent,
        agent,
        agentDayEvents,
        normalizeHumanTextIds,
      );

      return {
        id: displayId(agent.id),
        label: agent.sex === "male" ? "First Male Human" : "First Female Human",
        sex: agent.sex,
        approxAgeYears: agent.approxAgeYears,
        currentCellId: agent.currentCellId,
        previousCellId: agent.previousCellId,
        destinationCellId: agent.destinationCellId,
        movementIntent: agent.movementIntent,
        movementReason: agent.movementReason,
        lastMovedTick: agent.lastMovedTick,
        recentPath: agent.recentPath,
        stuckTicks: agent.stuckTicks,
        distanceTraveled: agent.distanceTraveled,
        explorationCount: agent.explorationCount,
        currentAction: agent.lastDecision?.action ?? null,
        needs: agent.needs,
        emotions: agent.emotions,
        currentMotivation: agent.motivations ? (Object.entries(agent.motivations).sort((a,b)=> b[1]-a[1])[0]?.[0] ?? null) : null,
        motivationScores: agent.motivations ?? undefined,
        confidence: (agent as any).confidence ?? undefined,
        familiarity: (agent as any).familiarityByCell?.[agent.currentCellId] ?? undefined,
        curiosityProfile: (agent as any).curiosityProfile ?? undefined,
        relationshipDrivers: relationshipToOther ? {
          trust: relationshipToOther.trust,
          affection: relationshipToOther.affection,
          attraction: relationshipToOther.attraction,
          companionship: relationshipToOther.companionship,
        } : null,
        closestRelationships,
        trustedHumans,
        fearedHumans,
        rivals,
        family,
        relationshipCount: agentRelationships.length,
        strongestBond,
        recentRelationshipChanges,
        socialHistory,
        decisionExplanation: (() => {
          const causes = agent.lastDecision?.causes ?? {} as Record<string, unknown>;
          const parts: string[] = [];
          if ((agent.needs.hunger) < 0.45 && (agent.needs.thirst) < 0.45 && (agent.needs.fatigue) < 0.5) {
            parts.push("Hunger and thirst were satisfied.");
          }
          const topMotivation = (causes as any).topMotivation as string | undefined;
          if (topMotivation) {
            parts.push(`Current motivation shifted to ${topMotivation}.`);
          }
          if ((agent as any).curiosityProfile) {
            const cp = (agent as any).curiosityProfile;
            if (cp.environmental >= (cp.social ?? 0)) {
              parts.push("Environmental curiosity exceeded social motivation.");
            }
          }
          if (agent.lastDecision?.action) {
            const label = agent.lastDecision.action === "explore" ? "Explore Nearby" : agent.lastDecision.action;
            parts.push(`Selected ${label}.`);
          }
          return parts.length ? parts.join(" ") : null;
        })(),
        currentGoal: agent.currentGoal
          ? {
            id: normalizeHumanTextIds(agent.currentGoal.id),
            type: agent.currentGoal.type,
            priority: agent.currentGoal.priority,
            createdTick: agent.currentGoal.createdTick,
            targetId: agent.currentGoal.targetId ? displayId(agent.currentGoal.targetId) : null,
            targetCellId: agent.currentGoal.targetCellId,
            progress: agent.currentGoal.progress,
            confidence: agent.currentGoal.confidence,
            reason: agent.currentGoal.reason,
            status: agent.currentGoal.status,
          }
          : null,
        goalPriority: agent.currentGoal?.priority ?? null,
        goalReason: agent.currentGoal?.reason ?? null,
        goalAge: agent.currentGoal ? Number(BigInt(result.state.tick) - BigInt(agent.currentGoal.createdTick)) : null,
        goalProgress: agent.currentGoal?.progress ?? null,
        goalHistory: agent.goalHistory.slice(-8).map((entry) => ({
          tick: entry.tick,
          event: entry.event,
          type: entry.goal.type,
          reason: entry.reason,
          priority: entry.goal.priority,
          progress: entry.goal.progress,
          status: entry.goal.status,
          previousGoalId: entry.previousGoalId ? normalizeHumanTextIds(entry.previousGoalId) : null,
        })),
        relationshipToOther: relationshipToOther ? {
          ...relationshipToOther,
          worldId: "atlas-human-mva",
          humanId: displayId(relationshipToOther.humanId ?? relationshipToOther.fromAgentId),
          targetHumanId: displayId(relationshipToOther.targetHumanId ?? relationshipToOther.toAgentId),
          fromAgentId: displayId(relationshipToOther.fromAgentId),
          toAgentId: displayId(relationshipToOther.toAgentId),
          history: relationshipToOther.history.map((entry) => ({
            ...entry,
            summary: normalizeHumanTextIds(entry.summary),
            sourceEventId: entry.sourceEventId ? normalizeHumanTextIds(entry.sourceEventId) : null,
          })),
        } : null,
        latestMemory,
        recentMemories,
        strongestMemories,
        mostRecalledMemories,
        dangerMemories,
        foodMemories,
        relationshipMemories,
        memoryTimeline,
        memoryCount: agentMemories.length,
        averageMemoryConfidence: averageMemoryValue(agentMemories, "confidence"),
        averageMemoryImportance: averageMemoryValue(agentMemories, "importance"),
        knownKnowledge,
        knowledgeCategories: knowledgeCategorySummaries(agentKnowledge),
        recentlyLearnedKnowledge,
        recentlyTaughtKnowledge,
        knowledgeTimeline,
        knowledgeCount: agentKnowledge.length,
        averageKnowledgeConfidence: averageKnowledgeValue(agentKnowledge, "confidence"),
        averageKnowledgeMastery: averageKnowledgeValue(agentKnowledge, "mastery"),
        recentCommunications,
        messagesSent: sentCommunications.length,
        messagesReceived: receivedCommunications.length,
        mostCommonCommunicationTypes: commonCommunicationTypes(agentCommunications),
        trustedTeachers: trustedTeachers(receivedCommunications, agent.id, displayId),
        peopleFrequentlyContacted: frequentContacts(agentCommunications, agent.id, displayId),
        communicationSuccessRate: communicationSuccessRate(agentCommunications),
        ignoredMessages: topCommunicationSummaries(ignoredCommunications, displayId, normalizeHumanTextIds, "recent", 6),
        teachingHistory: topCommunicationSummaries(teachingCommunications, displayId, normalizeHumanTextIds, "recent", 6),
        warningHistory: topCommunicationSummaries(warningCommunications, displayId, normalizeHumanTextIds, "urgency", 6),
        communicationTimeline,
        personalInventory: inventory?.personalInventory.map(normalizeStoredResource) ?? [],
        familyInventory: inventory?.familyInventory.map(normalizeStoredResource) ?? [],
        recentDeposits: inventory?.recentDeposits.map(normalizeStorageHistory) ?? [],
        recentWithdrawals: inventory?.recentWithdrawals.map(normalizeStorageHistory) ?? [],
        contributionHistory: inventory?.contributionHistory.map(normalizeStorageHistory) ?? [],
        latestCausalEvent: latestCausalEvent
          ? {
            tick: latestCausalEvent.tick,
            type: latestCausalEvent.type,
            title: latestCausalEvent.title,
            summary: normalizeHumanTextIds(latestCausalEvent.summary),
          }
          : null,
        latestEmotionChangeSummary: latestEmotionChangeSummary(emotionReasons),
        emotionReasons,
      };
    }),
    causalEvents: result.state.causalEvents.slice(-8).map((event) => ({
      id: normalizeHumanTextIds(event.id),
      tick: event.tick,
      type: event.type,
      title: normalizeHumanTextIds(event.title),
      summary: normalizeHumanTextIds(event.summary),
      agentIds: event.agentIds.map(displayId),
      cellId: event.cellId,
    })),
    chroniclerEntries: result.chroniclerReport.entries.slice(-8).map((entry) => ({
      ...entry,
      eventId: normalizeHumanTextIds(entry.eventId),
      title: normalizeHumanTextIds(entry.title),
      summary: normalizeHumanTextIds(entry.summary),
      causalSummary: normalizeHumanTextIds(entry.causalSummary),
    })),
    canSimulateOneHumanDay: true,
    forbiddenSystemsImplemented: [],
  };
}

function buildAtlasFamilies(
  world: WorldWithPlanet,
  selectedDay: number,
  grid: SpatialGrid = createGrid(),
  context?: AtlasHumanDerivedContext,
): AtlasFamilyTree {
  const tick = BigInt(Math.max(1, selectedDay) * HUMAN_MVA_DAY_TICKS);
  const dayStartTick = BigInt(Math.max(0, selectedDay - 1) * HUMAN_MVA_DAY_TICKS);
  const result = (context ?? getAtlasHumanDerivedContext(world, tick, dayStartTick, grid)).familyResult;
  const displayIdBySourceId = new Map(result.state.agents.map((agent) => [agent.id, agent.id.includes(":first-human-") ? `first-human-${agent.sex}` : agent.id.replace(`${world.id}:`, "") ]));
  const displayId = (sourceId: string) => displayIdBySourceId.get(sourceId) ?? sourceId.replace(`${world.id}:`, "");
  const normalizeEntityId = (sourceId: string | null) => sourceId ? sourceId.replace(`${world.id}:`, "") : null;
  const normalizeEntityText = (value: string) => value.replaceAll(`${world.id}:`, "").replaceAll(world.id, "atlas-world");
  const normalizeOptionalEntityText = (value: string | null | undefined) => value ? normalizeEntityText(value) : value;

  return {
    tick: result.tick,
    families: result.families.map((family) => ({
      ...family,
      id: family.id.replace(`${world.id}:`, ""),
      lineageId: family.lineageId.replace(`${world.id}:`, ""),
      memberIds: family.memberIds.map(displayId),
      livingMemberIds: family.livingMemberIds.map(displayId),
      parentIds: family.parentIds.map(displayId),
      childIds: family.childIds.map(displayId),
      settlementId: normalizeEntityId(family.settlementId),
      ancestryTags: family.ancestryTags.map(normalizeEntityText),
      history: family.history.map((entry) => ({ ...entry, summary: normalizeEntityText(entry.summary ?? ""), relatedHumanIds: entry.relatedHumanIds.map(displayId), settlementId: normalizeEntityId(entry.settlementId) })),
    })),
    lineages: result.lineages.map((lineage) => ({
      ...lineage,
      id: lineage.id.replace(`${world.id}:`, ""),
      founderIds: lineage.founderIds.map(displayId),
      livingDescendantIds: lineage.livingDescendantIds.map(displayId),
      knownAncestorIds: lineage.knownAncestorIds.map(displayId),
      familyIds: lineage.familyIds.map((id) => id.replace(`${world.id}:`, "")),
      settlementIds: lineage.settlementIds.map((id) => id.replace(`${world.id}:`, "")),
    })),
    events: result.events.map((event) => ({
      ...event,
      id: normalizeEntityText(event.id) ?? event.id,
      worldId: "atlas-world",
      title: normalizeEntityText(event.title) ?? event.title,
      summary: normalizeOptionalEntityText(event.summary) ?? event.summary,
      familyId: normalizeEntityId(event.familyId),
      lineageId: normalizeEntityId(event.lineageId),
      settlementId: normalizeEntityId(event.settlementId),
      humanIds: event.humanIds.map(displayId),
    })),
    settlementSummaries: result.settlementSummaries.map((summary) => ({
      ...summary,
      settlementId: summary.settlementId.replace(`${world.id}:`, ""),
      familiesPresent: summary.familiesPresent.map((id) => id.replace(`${world.id}:`, "")),
      largestLineageId: normalizeEntityId(summary.largestLineageId),
      foundingFamilies: summary.foundingFamilies.map((id) => id.replace(`${world.id}:`, "")),
    })),
  };
}
export function toAtlasWorldOption(world: WorldWithPlanet): AtlasWorldOption {
  return {
    id: world.id,
    slug: world.slug,
    name: world.name,
    environment: world.environment,
    status: world.status,
    yearLengthDays: getConfiguredYearLengthDays(world),
    currentDay: getConfiguredCurrentDay(world),
    hasSeed: Boolean(world.seed?.trim()),
  };
}

export function normalizeAtlasSelectedDay(world: WorldWithPlanet, requestedDay?: number | null): number {
  const yearLengthDays = getConfiguredYearLengthDays(world);

  if (!requestedDay || !Number.isFinite(requestedDay)) {
    return clamp(getConfiguredCurrentDay(world), 1, yearLengthDays);
  }

  return clamp(Math.round(requestedDay), 1, yearLengthDays);
}

type AtlasSnapshotStageTiming = {
  name: string;
  durationMs: number;
};

function nowSnapshotMs(): number {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function timeAtlasStage<T>(timings: AtlasSnapshotStageTiming[], name: string, task: () => T): T {
  const start = nowSnapshotMs();

  try {
    return task();
  } finally {
    timings.push({ name, durationMs: Math.max(0, nowSnapshotMs() - start) });
  }
}

function logAtlasStageTimings(world: WorldWithPlanet, selectedDay: number, timings: AtlasSnapshotStageTiming[]) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const total = timings.reduce((sum, timing) => sum + timing.durationMs, 0);
  const lines = [
    `\n=== atlas:snapshot:stages ${world.slug} day ${selectedDay} (total ${total.toFixed(2)} ms) ===`,
    ...[...timings]
      .sort((left, right) => right.durationMs - left.durationMs)
      .map((timing) => `${timing.name.padEnd(30)} ${timing.durationMs.toFixed(2)} ms`),
    "==============================================\n",
  ];

  console.log(lines.join("\n"));
}
function buildAtlasSnapshotUncached(
  world: WorldWithPlanet,
  selectedDay = getConfiguredCurrentDay(world),
  grid: SpatialGrid = createGrid(),
): AtlasSnapshot {
  const stageTimings: AtlasSnapshotStageTiming[] = [];
  const normalizedDay = normalizeAtlasSelectedDay(world, selectedDay);
  const tick = getAtlasTickForDay(world, normalizedDay);
  const civilizationTick = BigInt(Math.max(1, normalizedDay) * HUMAN_MVA_DAY_TICKS);
  const civilizationDayStartTick = BigInt(Math.max(0, normalizedDay - 1) * HUMAN_MVA_DAY_TICKS);
  const settlementTick = BigInt(Math.max(0, normalizedDay - 1) * HUMAN_MVA_DAY_TICKS);
  const gridSummary = timeAtlasStage(stageTimings, "grid:summary", () => getGridSummary(grid));
  const time = timeAtlasStage(stageTimings, "time", () => getTimeStateAtTick(world, tick));
  const astronomy = timeAtlasStage(stageTimings, "astronomy", () => getAstronomyStateAtTick(world, tick));
  const planet = timeAtlasStage(stageTimings, "planet", () => getPlanetState(world));
  const climate = timeAtlasStage(stageTimings, "climate:summary", () => getClimateStateAtTick(world, tick));
  const climateCells = timeAtlasStage(stageTimings, "climate:cells", () => getClimateGridAtTick(world, tick, grid));
  const terrainState = timeAtlasStage(stageTimings, "terrain", () => getTerrainState(world, grid));
  const hydrologyState = timeAtlasStage(stageTimings, "hydrology", () => getHydrologyState(world, grid));
  const atmosphereState = timeAtlasStage(stageTimings, "atmosphere", () => getAtmosphereStateAtTick(world, tick, grid));
  const weatherState = timeAtlasStage(stageTimings, "weather", () => getWeatherStateAtTick(world, tick, grid));
  const resourceState = timeAtlasStage(stageTimings, "resources", () => getPlanetResourcesStateAtTick(world, tick, grid));
  const biomeState = timeAtlasStage(stageTimings, "biomes", () => world.seed?.trim() ? getBiomeStateAtTick(world, tick, grid) : null);
  const plantState = timeAtlasStage(stageTimings, "plants", () => world.seed?.trim() ? getPlantEcologyStateAtTick(world, tick, grid) : null);
  const animalState = timeAtlasStage(stageTimings, "animals", () => world.seed?.trim() ? getAnimalEcologyStateAtTick(world, tick, grid) : null);
  const fingerprint = timeAtlasStage(stageTimings, "fingerprint", () => buildWorldFingerprint(world, grid));
  const environmentVerification = timeAtlasStage(stageTimings, "canonical:verify", () => verifyWorldAgainstCanonical(world, grid));
  const statistics = timeAtlasStage(stageTimings, "statistics", () => buildAtlasStatistics(
    climate,
    terrainState.summary,
    hydrologyState.summary,
    atmosphereState.summary,
    weatherState.summary,
    resourceState.summary,
  ));
  const civilizationContext = timeAtlasStage(stageTimings, "humans:context", () => getAtlasHumanDerivedContext(
    world,
    civilizationTick,
    civilizationDayStartTick,
    grid,
  ));
  const settlementContext = timeAtlasStage(stageTimings, "settlements:context", () => getAtlasHumanDerivedContext(
    world,
    settlementTick,
    settlementTick,
    grid,
  ));
  const humans = timeAtlasStage(stageTimings, "humans:dossier", () => buildAtlasHumans(
    world,
    normalizedDay,
    grid,
    civilizationContext,
  ));
  const settlements = timeAtlasStage(stageTimings, "settlements:dossier", () => buildAtlasSettlements(
    world,
    normalizedDay,
    grid,
    settlementContext,
  ));
  const families = timeAtlasStage(stageTimings, "families:dossier", () => buildAtlasFamilies(
    world,
    normalizedDay,
    grid,
    civilizationContext,
  ));
  const cells = timeAtlasStage(stageTimings, "cells:combine", () => combineAtlasCells(
    climateCells,
    terrainState.cells,
    hydrologyState.cells,
    atmosphereState.cells,
    weatherState.cells,
    resourceState.cells,
    biomeState?.cells ?? [],
    plantState?.cells ?? [],
    animalState?.cells ?? [],
  ));

  const snapshot: AtlasSnapshot = {
    worldId: world.id,
    worldSlug: world.slug,
    worldName: world.name,
    selectedDay: normalizedDay,
    tick: tick.toString(),
    yearLengthDays: getConfiguredYearLengthDays(world),
    grid: {
      ...gridSummary,
      cellWidthDegrees: round(360 / gridSummary.longitudeDivisions),
      cellHeightDegrees: round(180 / gridSummary.latitudeDivisions),
    },
    time,
    astronomy,
    planet,
    climate,
    terrainSummary: terrainState.summary,
    hydrologySummary: hydrologyState.summary,
    atmosphereSummary: atmosphereState.summary,
    weatherSummary: weatherState.summary,
    resourceSummary: resourceState.summary,
    biomeSummary: biomeState?.summary ?? null,
    plantSummary: plantState?.summary ?? null,
    animalSummary: animalState?.summary ?? null,
    statistics,
    humans,
    settlements,
    families,
    fingerprint: {
      seed: fingerprint.seed,
      hash: fingerprint.hash,
      shortHash: fingerprint.shortHash,
      canonical: fingerprint.canonical,
    },
    integrity: {
      canonical: fingerprint.canonical,
      environmentMatch: environmentVerification.matches,
      terrainValidated: terrainState.validation.valid,
      climateValidated: climate.summary.climateBandsPresent.length > 0,
      hydrologyValidated: hydrologyState.summary.cellCount === terrainState.summary.cellCount,
      atmosphereValidated: atmosphereState.summary.cellCount === terrainState.summary.cellCount,
      weatherValidated: weatherState.summary.cellCount === terrainState.summary.cellCount,
    },
    cells,
  };

  logAtlasStageTimings(world, normalizedDay, stageTimings);

  return snapshot;
}

export function buildAtlasSnapshot(
  world: WorldWithPlanet,
  selectedDay = getConfiguredCurrentDay(world),
  grid: SpatialGrid = createGrid(),
): AtlasSnapshot {
  return buildTimedAtlasSnapshot(world, selectedDay, grid).value;
}

export function buildTimedAtlasSnapshot(
  world: WorldWithPlanet,
  selectedDay = getConfiguredCurrentDay(world),
  grid: SpatialGrid = createGrid(),
): TimedSnapshotValue<AtlasSnapshot> {
  const normalizedDay = normalizeAtlasSelectedDay(world, selectedDay);
  const key = getSnapshotWorldKey(world, grid, `atlas:${normalizedDay}`);
  return memoizeSnapshotValue(
    "atlas:snapshot",
    key,
    () => buildAtlasSnapshotUncached(world, normalizedDay, grid),
    grid.getGridSummary().totalCells,
  );
}
