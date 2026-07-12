import { Prisma, type World } from "@prisma/client";

import type { BiomeKey } from "./biome-definitions";
import { getCachedDeterministic } from "./deterministic-cache";
import { createGrid, type SpatialGrid } from "./grid/grid";
import { getPlantEcologyStateAtTick, type PlantGridCell } from "./plant-engine";
import { getTerrainState, type TerrainGridCell } from "./terrain-engine";
import {
  ANIMAL_GUILD_DEFINITIONS,
  ANIMAL_GUILD_KEYS,
  getAnimalGuildDefinition,
  getAnimalGuildDefinitions,
  getAnimalSpeciesDefinitions,
  type AnimalGuildDefinition,
  type AnimalGuildKey,
  type AnimalSpeciesDefinition,
} from "./animal-definitions";

export type DominantAnimalGuildKey = AnimalGuildKey;

export type EcosystemHealthStatus = "Excellent" | "Healthy" | "Stressed" | "Collapsing" | "Collapsed";

export type EcosystemEventType =
  | "Population Boom"
  | "Population Collapse"
  | "Food Shortage"
  | "Migration Wave"
  | "Overgrazing"
  | "Habitat Recovery"
  | "Predator Expansion"
  | "Predator Decline"
  | "Vegetation Recovery"
  | "Drought Stress"
  | "Flood Recovery"
  | "Adaptation Milestone";

export type EcosystemEvent = {
  readonly id: string;
  readonly tick: string;
  readonly type: EcosystemEventType;
  readonly severity: number;
  readonly description: string;
  readonly speciesId?: string;
};

export type AnimalMovementVector = {
  readonly speciesId: string;
  readonly fromCellId: string;
  readonly toCellId: string;
  readonly population: number;
  readonly pressure: number;
};

export type AnimalPopulationState = {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly scientificName: string;
  readonly trophicLevel: AnimalSpeciesDefinition["trophicLevel"];
  readonly population: number;
  readonly health: number;
  readonly foodAvailability: number;
  readonly migrationPressure: number;
  readonly habitatSuitability: number;
  readonly carryingCapacity: number;
  readonly predationPressure: number;
  readonly competitionPressure: number;
  readonly carryingCapacityUsage: number;
  readonly inboundMigration: number;
  readonly outboundMigration: number;
  readonly netMigration: number;
  readonly populationTrend: number;
  readonly fitnessScore: number;
  readonly adaptationProfile: AdaptationProfile;
  readonly adaptationTrends: readonly AdaptationTrend[];
  readonly lastUpdatedTick: string;
};

export const ADAPTATION_TRAITS = Object.freeze([
  "coldTolerance",
  "heatTolerance",
  "droughtTolerance",
  "floodTolerance",
  "humidityTolerance",
  "altitudeTolerance",
  "diseaseResistance",
  "parasiteResistance",
  "reproductiveEfficiency",
  "juvenileSurvival",
  "longevity",
  "metabolismEfficiency",
  "foragingEfficiency",
  "predatorAwareness",
  "camouflage",
  "migrationInstinct",
  "socialBehavior",
  "territorialBehavior",
  "stressResistance",
  "intelligencePotential",
] as const);

export type AdaptationTrait = (typeof ADAPTATION_TRAITS)[number];
export type AdaptationProfile = Readonly<Record<AdaptationTrait, number>>;
export type AdaptationTrendDirection = "Increasing" | "Decreasing" | "Stable";

export type AdaptationTrend = {
  readonly trait: AdaptationTrait;
  readonly value: number;
  readonly previousValue: number;
  readonly direction: AdaptationTrendDirection;
  readonly reason: string;
};

export type PopulationAdaptationSummary = {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly score: number;
  readonly trait?: AdaptationTrait;
};

export type AnimalGridCell = PlantGridCell & {
  readonly animalSuitabilityScore: number;
  readonly dominantAnimalGuildKey: DominantAnimalGuildKey;
  readonly dominantAnimalGuildName: string;
  readonly dominantAnimalGuildCategory: AnimalGuildDefinition["category"];
  readonly dominantAnimalGuildColor: string;
  readonly herbivoreCapacity: number;
  readonly predatorCapacity: number;
  readonly preyAvailability: number;
  readonly animalDensity: number;
  readonly migrationPressure: number;
  readonly dangerScore: number;
  readonly huntingValue: number;
  readonly domesticationPotential: number;
  readonly animalBiodiversityScore: number;
  readonly carryingCapacityScore: number;
  readonly animalTags: readonly string[];
  readonly dominantSpeciesId: string;
  readonly dominantSpeciesName: string;
  readonly speciesCount: number;
  readonly totalWildlifePopulation: number;
  readonly averagePopulationHealth: number;
  readonly averageHabitatSuitability: number;
  readonly plantConsumptionRate: number;
  readonly effectivePlantBiomass: number;
  readonly predationPressure: number;
  readonly predatorPreyBalance: number;
  readonly foodStability: number;
  readonly carryingCapacityUsage: number;
  readonly migrationActivity: number;
  readonly populationGrowthRate: number;
  readonly ecosystemHealthScore: number;
  readonly ecosystemHealthStatus: EcosystemHealthStatus;
  readonly averageFitness: number;
  readonly adaptationDiversity: number;
  readonly averageMigrationInstinct: number;
  readonly averageDiseaseResistance: number;
  readonly averageReproductiveEfficiency: number;
  readonly averageClimateAdaptation: number;
  readonly highestAdaptedPopulation: PopulationAdaptationSummary | null;
  readonly lowestFitnessPopulation: PopulationAdaptationSummary | null;
  readonly ecosystemEvents: readonly EcosystemEvent[];
  readonly ecosystemHistory: readonly EcosystemEvent[];
  readonly movementVectors: readonly AnimalMovementVector[];
  readonly animalPopulations: readonly AnimalPopulationState[];
};

export type AnimalDistribution = Record<DominantAnimalGuildKey, number>;

export type AnimalRegion = {
  readonly cellId: string;
  readonly dominantAnimalGuildKey: DominantAnimalGuildKey;
  readonly dominantAnimalGuildName: string;
  readonly cellCount: number;
  readonly averageScore: number;
  readonly peakScore: number;
  readonly midpointLatitude: number;
  readonly midpointLongitude: number;
};

export type AnimalSummary = {
  readonly cellCount: number;
  readonly animalEligibleCellCount: number;
  readonly populatedCellCount: number;
  readonly dominantAnimalDistribution: AnimalDistribution;
  readonly totalAnimalBiomassCapacity: number;
  readonly averageAnimalDensity: number;
  readonly averageHerbivoreCapacity: number;
  readonly averagePredatorCapacity: number;
  readonly averagePreyAvailability: number;
  readonly averageMigrationPressure: number;
  readonly averageDangerScore: number;
  readonly huntingValueScore: number;
  readonly domesticationCandidateScore: number;
  readonly biodiversityScore: number;
  readonly civilizationFoodSupportScore: number;
  readonly dangerMapScore: number;
  readonly animalSpeciesCount: number;
  readonly occupiedHabitatPercent: number;
  readonly totalWildlifePopulation: number;
  readonly averageHabitatSuitability: number;
  readonly averageHealth: number;
  readonly averageEcosystemHealth: number;
  readonly averageBiodiversity: number;
  readonly migrationActivity: number;
  readonly foodStability: number;
  readonly predatorBalance: number;
  readonly collapsedHabitats: number;
  readonly populationGrowthRate: number;
  readonly plantConsumptionRate: number;
  readonly averageFitness: number;
  readonly averageAdaptationDiversity: number;
  readonly highestAdaptedPopulation: PopulationAdaptationSummary | null;
  readonly lowestFitnessPopulation: PopulationAdaptationSummary | null;
  readonly averageMigrationInstinct: number;
  readonly averageDiseaseResistance: number;
  readonly averageReproductiveEfficiency: number;
  readonly averageClimateAdaptation: number;
  readonly herbivoreRichRegions: readonly AnimalRegion[];
  readonly predatorHotspots: readonly AnimalRegion[];
  readonly huntingValueRegions: readonly AnimalRegion[];
  readonly domesticationCandidateRegions: readonly AnimalRegion[];
  readonly migrationCorridorCandidates: readonly AnimalRegion[];
  readonly biodiversityHotspots: readonly AnimalRegion[];
  readonly highestDangerZones: readonly AnimalRegion[];
};

export type AnimalEcologyState = {
  readonly seed: string;
  readonly tick: string;
  readonly cells: readonly AnimalGridCell[];
  readonly summary: AnimalSummary;
};

export type PersistAnimalEcologyResult = {
  readonly planetId: string;
  readonly generatedCells: number;
  readonly updatedCells: number;
  readonly unchangedCells: number;
  readonly summary: AnimalSummary;
};

type TickInput = bigint | number | string;

export type AnimalWorldSource = Pick<
  World,
  | "id"
  | "seed"
  | "currentTick"
  | "tickDurationSeconds"
  | "dayLengthSeconds"
  | "yearLengthDays"
  | "axialTiltDegrees"
  | "orbitalEccentricity"
  | "initialEpochName"
  | "initialYear"
  | "initialDay"
  | "initialHour"
> & {
  planet?: {
    id?: string | null;
    oceanCoveragePercent?: number | null;
    atmospherePressureKPa?: number | null;
  } | null;
};

type AnimalPopulationPersistencePayload = {
  readonly planetCellId: string;
  readonly speciesId: string;
  readonly population: number;
  readonly health: number;
  readonly foodAvailability: number;
  readonly migrationPressure: number;
  readonly habitatSuitability: number;
  readonly carryingCapacity: number;
  readonly predationPressure: number;
  readonly competitionPressure: number;
  readonly carryingCapacityUsage: number;
  readonly inboundMigration: number;
  readonly outboundMigration: number;
  readonly netMigration: number;
  readonly populationTrend: number;
  readonly fitnessScore: number;
  readonly adaptationProfile: Prisma.InputJsonValue;
  readonly adaptationTrends: Prisma.InputJsonValue;
  readonly lastUpdatedTick: bigint;
};

type AnimalPopulationPersistenceDelegate = {
  deleteMany(input: { where: { planetCellId: { in: string[] } } }): Promise<unknown>;
  createMany(input: {
    data: AnimalPopulationPersistencePayload[];
    skipDuplicates?: boolean;
  }): Promise<unknown>;
};

type AnimalPersistenceClient = Pick<Prisma.TransactionClient, "planet" | "planetCell"> & {
  animalPopulation?: AnimalPopulationPersistenceDelegate;
  $executeRaw?: Prisma.TransactionClient["$executeRaw"];
  $queryRaw?: Prisma.TransactionClient["$queryRaw"];
};

type AnimalCandidate = {
  readonly definition: AnimalGuildDefinition;
  readonly suitability: number;
  readonly temperatureFit: number;
  readonly precipitationFit: number;
  readonly elevationFit: number;
  readonly foodFit: number;
  readonly preyFit: number;
  readonly waterFit: number;
  readonly shelterFit: number;
};

type AnimalCellInputs = {
  readonly plant: PlantGridCell;
  readonly terrain: TerrainGridCell;
  readonly seed: string;
  readonly tick: bigint;
};

type PersistedAnimalCellExtras = {
  readonly dominantSpeciesId?: string;
  readonly dominantSpeciesName?: string;
  readonly animalSpeciesCount?: number;
  readonly totalWildlifePopulation?: number;
  readonly averageAnimalHealth?: number;
  readonly averageHabitatSuitability?: number;
  readonly plantConsumptionRate?: number;
  readonly effectivePlantBiomass?: number;
  readonly predationPressure?: number;
  readonly predatorPreyBalance?: number;
  readonly foodStability?: number;
  readonly carryingCapacityUsage?: number;
  readonly migrationActivity?: number;
  readonly populationGrowthRate?: number;
  readonly averageFitness?: number;
  readonly adaptationDiversity?: number;
  readonly averageMigrationInstinct?: number;
  readonly averageDiseaseResistance?: number;
  readonly averageReproductiveEfficiency?: number;
  readonly averageClimateAdaptation?: number;
  readonly highestAdaptedPopulation?: Prisma.JsonValue;
  readonly lowestFitnessPopulation?: Prisma.JsonValue;
  readonly ecosystemHealthScore?: number;
  readonly ecosystemHealthStatus?: string;
  readonly ecosystemEvents?: Prisma.JsonValue;
  readonly ecosystemHistory?: Prisma.JsonValue;
  readonly movementVectors?: Prisma.JsonValue;
};

const UINT32_RANGE = 4_294_967_296;
const MARINE_BIOMES = new Set<BiomeKey>(["ocean", "coast", "lake"]);
const AQUATIC_GUILDS = new Set<AnimalGuildKey>(["aquatic-microfauna", "fish"]);
const HERBIVORE_GUILDS = new Set<AnimalGuildKey>(["small-herbivores", "large-herbivores", "browsers", "grazers"]);
const PREDATOR_GUILDS = new Set<AnimalGuildKey>(["small-predators", "apex-predators", "reptiles"]);
const LOW_DENSITY_BIOMES = new Set<BiomeKey>(["ice-sheet", "volcanic-barren", "badlands-rocky", "alpine-mountain", "desert"]);
const MIGRATION_PRESSURE_THRESHOLD = 0.14;
const MAX_MIGRATION_FRACTION_PER_TICK = 0.08;
const PLANT_CONSUMPTION_STRESS_THRESHOLD = 0.58;
const PLANT_CONSUMPTION_BIOMASS_DRAWDOWN = 0.9;
const PLANT_CONSUMPTION_REGROWTH_RECOVERY = 0.14;
const PLANT_CONSUMPTION_FOOD_STABILITY_PENALTY = 0.24;
const PLANT_CONSUMPTION_HERBIVORE_FOOD_PENALTY = 0.28;
const PLANT_CONSUMPTION_OMNIVORE_FOOD_PENALTY = 0.12;
const PLANT_CONSUMPTION_HERBIVORE_MORTALITY = 0.045;
const PLANT_CONSUMPTION_OMNIVORE_MORTALITY = 0.015;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function pressureAbove(value: number, threshold: number): number {
  return value <= threshold ? 0 : clamp((value - threshold) / Math.max(1 - threshold, 0.001));
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

type AdaptationPressure = AdaptationProfile;

const ADAPTATION_EXPOSURE_TICKS = 12_000;
const ADAPTATION_TREND_WINDOW_TICKS = 180n;
const TRAIT_BASELINE_MINIMUM = 0.34;
const TRAIT_BASELINE_SPAN = 0.32;
const CLIMATE_ADAPTATION_TRAITS: readonly AdaptationTrait[] = [
  "coldTolerance",
  "heatTolerance",
  "droughtTolerance",
  "floodTolerance",
  "humidityTolerance",
  "altitudeTolerance",
  "stressResistance",
];

const ADAPTATION_LABELS: Record<AdaptationTrait, string> = {
  coldTolerance: "Cold tolerance",
  heatTolerance: "Heat tolerance",
  droughtTolerance: "Drought tolerance",
  floodTolerance: "Flood tolerance",
  humidityTolerance: "Humidity tolerance",
  altitudeTolerance: "Altitude tolerance",
  diseaseResistance: "Disease resistance",
  parasiteResistance: "Parasite resistance",
  reproductiveEfficiency: "Reproductive efficiency",
  juvenileSurvival: "Juvenile survival",
  longevity: "Longevity",
  metabolismEfficiency: "Metabolism efficiency",
  foragingEfficiency: "Foraging efficiency",
  predatorAwareness: "Predator awareness",
  camouflage: "Camouflage",
  migrationInstinct: "Migration instinct",
  socialBehavior: "Social behavior",
  territorialBehavior: "Territorial behavior",
  stressResistance: "Stress resistance",
  intelligencePotential: "Intelligence potential",
};

function emptyAdaptationProfile(value: number): AdaptationProfile {
  return Object.freeze(Object.fromEntries(ADAPTATION_TRAITS.map((trait) => [trait, round(clamp(value))])) as Record<AdaptationTrait, number>);
}

function speciesTraitBaseline(definition: AnimalSpeciesDefinition, trait: AdaptationTrait, seed: string): number {
  const seeded = TRAIT_BASELINE_MINIMUM + hashUnit(seed, `${definition.id}:${trait}:adaptation-baseline`) * TRAIT_BASELINE_SPAN;
  const tags = definition.tags;
  const tagBonus =
    (trait === "coldTolerance" && (tags.includes("cold-adapted") || tags.includes("polar"))) ? 0.16
      : (trait === "heatTolerance" && (tags.includes("desert") || tags.includes("dryland") || tags.includes("warm-adapted"))) ? 0.14
        : (trait === "droughtTolerance" && (tags.includes("water-efficient") || tags.includes("dryland") || tags.includes("desert"))) ? 0.16
          : (trait === "migrationInstinct" && tags.includes("migration")) ? 0.16
            : (trait === "socialBehavior" && (tags.includes("herd") || tags.includes("pack") || tags.includes("pride"))) ? 0.14
              : (trait === "predatorAwareness" && tags.includes("prey")) ? 0.12
                : (trait === "foragingEfficiency" && (tags.includes("omnivore") || tags.includes("browser") || tags.includes("grazer"))) ? 0.1
                  : (trait === "altitudeTolerance" && (tags.includes("mountain") || tags.includes("sure-footed"))) ? 0.12
                    : (trait === "camouflage" && (tags.includes("ambush") || tags.includes("burrower"))) ? 0.1
                      : 0;

  return round(clamp(seeded + tagBonus));
}

function getAdaptationExposure(tick: bigint): number {
  const elapsed = Math.max(0, Number(tick));

  return round(clamp(1 - Math.exp(-elapsed / ADAPTATION_EXPOSURE_TICKS)));
}

function getFoodStabilityPressure(cell: PlantGridCell): number {
  return round(clamp(
    cell.ediblePlantScore * 0.34
      + cell.biomassScore * 0.22
      + cell.regrowthRate * 0.18
      + cell.plantDensity * 0.14
      + (1 - cell.seasonalStressScore) * 0.12,
  ));
}

function getAdaptationPressure(cell: PlantGridCell, values: { readonly herbivores: number; readonly prey: number; readonly carrying: number }, migrationFrequency: number): AdaptationPressure {
  const coldPressure = clamp((10 - cell.adjustedTemperatureC) / 36 + cell.seasonalityScore * 0.22 + (cell.biomeKey === "ice-sheet" || cell.biomeKey === "tundra" ? 0.18 : 0));
  const heatPressure = clamp((cell.adjustedTemperatureC - 18) / 30 + (1 - cell.precipitationScore) * 0.12 + (cell.biomeKey === "desert" ? 0.16 : 0));
  const droughtPressure = clamp((1 - cell.waterAvailabilityScore) * 0.36 + (1 - cell.precipitationScore) * 0.34 + (1 - cell.soilMoistureScore) * 0.18 + heatPressure * 0.12);
  const floodPressure = clamp(cell.waterAvailabilityScore * 0.36 + cell.precipitationScore * 0.24 + cell.soilMoistureScore * 0.18 + (cell.biomeCategory === "wetland" ? 0.2 : 0));
  const humidityPressure = clamp(cell.humidityScore * 0.62 + cell.precipitationScore * 0.22 + cell.soilMoistureScore * 0.16);
  const altitudePressure = clamp(Math.max(0, cell.elevation - 0.42) * 1.45 + (cell.biomeKey === "alpine-mountain" ? 0.18 : 0));
  const foodStability = getFoodStabilityPressure(cell);
  const predatorPressure = clamp(values.prey * 0.34 + (1 - values.herbivores) * 0.12);
  const competitionPressure = clamp(1 - values.carrying);
  const waterStress = clamp(1 - cell.waterAvailabilityScore);

  return Object.freeze({
    coldTolerance: round(coldPressure),
    heatTolerance: round(heatPressure),
    droughtTolerance: round(droughtPressure),
    floodTolerance: round(floodPressure),
    humidityTolerance: round(humidityPressure),
    altitudeTolerance: round(altitudePressure),
    diseaseResistance: round(clamp(humidityPressure * 0.34 + values.prey * 0.18 + cell.biodiversityScore * 0.12 + cell.seasonalStressScore * 0.16)),
    parasiteResistance: round(clamp(humidityPressure * 0.42 + heatPressure * 0.18 + values.prey * 0.12)),
    reproductiveEfficiency: round(clamp(foodStability * 0.42 + cell.habitabilityScore * 0.28 + (1 - cell.seasonalStressScore) * 0.2 + values.carrying * 0.1)),
    juvenileSurvival: round(clamp(foodStability * 0.34 + cell.waterAvailabilityScore * 0.22 + (1 - predatorPressure) * 0.24 + (1 - cell.seasonalStressScore) * 0.2)),
    longevity: round(clamp((1 - cell.seasonalStressScore) * 0.32 + foodStability * 0.24 + cell.habitabilityScore * 0.22 + (1 - competitionPressure) * 0.22)),
    metabolismEfficiency: round(clamp((coldPressure + heatPressure + droughtPressure) * 0.26 + (1 - foodStability) * 0.2 + cell.seasonalityScore * 0.18)),
    foragingEfficiency: round(clamp(foodStability * 0.38 + cell.biodiversityScore * 0.22 + cell.ediblePlantScore * 0.18 + values.prey * 0.14 + competitionPressure * 0.08)),
    predatorAwareness: round(clamp(predatorPressure * 0.58 + values.prey * 0.18 + migrationFrequency * 0.1)),
    camouflage: round(clamp(cell.vegetationDensity * 0.24 + cell.elevation * 0.12 + predatorPressure * 0.3 + cell.biomeColor.length / 16 * 0.06)),
    migrationInstinct: round(clamp(migrationFrequency * 0.48 + cell.seasonalityScore * 0.24 + waterStress * 0.14 + (1 - foodStability) * 0.14)),
    socialBehavior: round(clamp(values.herbivores * 0.3 + predatorPressure * 0.18 + competitionPressure * 0.16 + cell.habitabilityScore * 0.12)),
    territorialBehavior: round(clamp(values.carrying * 0.24 + foodStability * 0.18 + predatorPressure * 0.16 + (1 - migrationFrequency) * 0.18)),
    stressResistance: round(clamp(cell.seasonalStressScore * 0.34 + coldPressure * 0.16 + heatPressure * 0.16 + droughtPressure * 0.14 + competitionPressure * 0.1)),
    intelligencePotential: round(clamp(cell.biodiversityScore * 0.2 + cell.seasonalityScore * 0.16 + values.prey * 0.16 + competitionPressure * 0.14 + predatorPressure * 0.12)),
  });
}

function buildAdaptationProfile(definition: AnimalSpeciesDefinition, pressure: AdaptationPressure, seed: string, tick: bigint): AdaptationProfile {
  const exposure = getAdaptationExposure(tick);

  return Object.freeze(Object.fromEntries(ADAPTATION_TRAITS.map((trait) => {
    const baseline = speciesTraitBaseline(definition, trait, seed);
    const target = pressure[trait];

    return [trait, round(clamp(baseline + (target - baseline) * exposure))];
  })) as Record<AdaptationTrait, number>);
}

function adaptationReason(trait: AdaptationTrait, pressure: AdaptationPressure): string {
  switch (trait) {
    case "coldTolerance":
      return pressure.coldTolerance >= 0.5 ? "Persistent cold winters." : "Warmer conditions reduced cold pressure.";
    case "heatTolerance":
      return pressure.heatTolerance >= 0.5 ? "Persistent heat exposure." : "Cooler conditions reduced heat pressure.";
    case "droughtTolerance":
      return pressure.droughtTolerance >= 0.5 ? "Low rainfall and water scarcity." : "Reliable water reduced drought pressure.";
    case "floodTolerance":
      return pressure.floodTolerance >= 0.5 ? "Wet or flood-prone habitat." : "Dryer ground reduced flood pressure.";
    case "foragingEfficiency":
      return pressure.foragingEfficiency >= 0.5 ? "Food access shaped stronger foraging." : "Food pressure weakened.";
    case "migrationInstinct":
      return pressure.migrationInstinct >= 0.5 ? "Seasonal or resource instability favored movement." : "Stable local habitat weakened movement pressure.";
    case "predatorAwareness":
      return pressure.predatorAwareness >= 0.5 ? "Predator pressure remained high." : "Predator pressure eased.";
    default:
      return pressure[trait] >= 0.5 ? "Persistent local environmental pressure." : "Local pressure eased.";
  }
}

function buildAdaptationTrends(definition: AnimalSpeciesDefinition, pressure: AdaptationPressure, seed: string, tick: bigint, profile: AdaptationProfile): readonly AdaptationTrend[] {
  const previousTick = tick > ADAPTATION_TREND_WINDOW_TICKS ? tick - ADAPTATION_TREND_WINDOW_TICKS : 0n;
  const previousProfile = buildAdaptationProfile(definition, pressure, seed, previousTick);

  return Object.freeze(ADAPTATION_TRAITS.map((trait) => {
    const delta = profile[trait] - previousProfile[trait];
    const direction: AdaptationTrendDirection = Math.abs(delta) < 0.0005 ? "Stable" : delta > 0 ? "Increasing" : "Decreasing";

    return Object.freeze({
      trait,
      value: profile[trait],
      previousValue: previousProfile[trait],
      direction,
      reason: adaptationReason(trait, pressure),
    });
  }));
}

function getClimateAdaptationScore(profile: AdaptationProfile): number {
  return round(average(CLIMATE_ADAPTATION_TRAITS.map((trait) => profile[trait])));
}

function getAdaptationScore(profile: AdaptationProfile): number {
  return round(average(ADAPTATION_TRAITS.map((trait) => profile[trait])));
}

function getAdaptationDiversity(populations: readonly AnimalPopulationState[]): number {
  const present = populations.filter((population) => population.population > 0);

  if (present.length <= 1) {
    return 0;
  }

  const traitRanges = ADAPTATION_TRAITS.map((trait) => {
    const values = present.map((population) => population.adaptationProfile[trait]);

    return Math.max(...values) - Math.min(...values);
  });

  return round(average(traitRanges));
}

function getHighestAdaptedPopulation(populations: readonly AnimalPopulationState[]): PopulationAdaptationSummary | null {
  const present = populations.filter((population) => population.population > 0);
  const ranked = present.flatMap((population) => ADAPTATION_TRAITS.map((trait) => ({
    speciesId: population.speciesId,
    speciesName: population.speciesName,
    score: population.adaptationProfile[trait],
    trait,
  }))).sort((left, right) => right.score - left.score || left.speciesId.localeCompare(right.speciesId) || left.trait.localeCompare(right.trait));

  return ranked[0] ? Object.freeze({ ...ranked[0], score: round(ranked[0].score) }) : null;
}

function getLowestFitnessPopulation(populations: readonly AnimalPopulationState[]): PopulationAdaptationSummary | null {
  const ranked = populations
    .filter((population) => population.population > 0)
    .map((population) => ({ speciesId: population.speciesId, speciesName: population.speciesName, score: population.fitnessScore }))
    .sort((left, right) => left.score - right.score || left.speciesId.localeCompare(right.speciesId));

  return ranked[0] ? Object.freeze({ ...ranked[0], score: round(ranked[0].score) }) : null;
}

function getPopulationFitness(input: {
  definition: AnimalSpeciesDefinition;
  habitatSuitability: number;
  foodAvailability: number;
  health: number;
  predationPressure: number;
  migrationPressure: number;
  climateStress: number;
  adaptationProfile: AdaptationProfile;
}): number {
  const climateAdaptation = getClimateAdaptationScore(input.adaptationProfile);
  const adaptationSupport = round(clamp(
    climateAdaptation * 0.22
      + input.adaptationProfile.foragingEfficiency * 0.16
      + input.adaptationProfile.metabolismEfficiency * 0.12
      + input.adaptationProfile.stressResistance * 0.12
      + input.adaptationProfile.reproductiveEfficiency * 0.1
      + input.adaptationProfile.juvenileSurvival * 0.1
      + input.adaptationProfile.predatorAwareness * 0.08
      + input.adaptationProfile.diseaseResistance * 0.06
      + input.adaptationProfile.migrationInstinct * 0.04,
  ));

  return round(clamp(
    input.habitatSuitability * 0.24
      + input.foodAvailability * 0.18
      + input.health * 0.16
      + adaptationSupport * 0.24
      + (1 - input.predationPressure) * 0.08
      + (1 - input.climateStress) * 0.06
      + (1 - input.migrationPressure) * 0.04,
  ));
}


function getSpeciesDefinitionMap(): ReadonlyMap<string, AnimalSpeciesDefinition> {
  return new Map(getAnimalSpeciesDefinitions().map((definition) => [definition.id, definition]));
}

function populationBySpecies(populations: readonly AnimalPopulationState[]): ReadonlyMap<string, AnimalPopulationState> {
  return new Map(populations.map((population) => [population.speciesId, population]));
}

function hashStringToUint32(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function hashUnit(seed: string, key: string): number {
  return hashStringToUint32(`${seed}:animals:${key}`) / UINT32_RANGE;
}

function requireAnimalSeed(world: AnimalWorldSource): string {
  const seed = world.seed?.trim();

  if (!seed) {
    throw new Error("Animal ecology generation requires a world seed.");
  }

  return seed;
}

function normalizeTick(tick: TickInput): bigint {
  return BigInt(tick);
}

function rangeFit(value: number, [minimum, maximum]: readonly [number, number], falloff: number): number {
  if (value >= minimum && value <= maximum) {
    return 1;
  }

  if (value < minimum) {
    return clamp(1 - (minimum - value) / falloff);
  }

  return clamp(1 - (value - maximum) / falloff);
}

function requirementFit(available: number, requirement: number): number {
  if (requirement <= 0.001) {
    return 1;
  }

  return clamp(available / requirement);
}

function includesAny(values: readonly string[], candidates: readonly string[]): boolean {
  return candidates.some((candidate) => values.includes(candidate));
}

function isWaterBiome(cell: PlantGridCell): boolean {
  return MARINE_BIOMES.has(cell.biomeKey);
}

function waterBodySupport(cell: PlantGridCell): number {
  if (cell.biomeKey === "ocean" || cell.biomeKey === "coast" || cell.biomeKey === "lake") {
    return 1;
  }

  if (cell.biomeKey === "river-wetland" || cell.biomeKey === "swamp-marsh") {
    return 0.92;
  }

  return clamp(cell.waterAvailabilityScore);
}

function plantFoodBase(cell: PlantGridCell): number {
  return round(clamp(
    cell.ediblePlantScore * 0.42
      + cell.biomassScore * 0.2
      + cell.plantDensity * 0.16
      + cell.biodiversityScore * 0.14
      + cell.regrowthRate * 0.08,
  ));
}

function aquaticFoodBase(cell: PlantGridCell): number {
  if (!isWaterBiome(cell) && cell.biomeCategory !== "wetland") {
    return 0;
  }

  return round(clamp(
    waterBodySupport(cell) * 0.28
      + cell.biomassScore * 0.2
      + cell.biodiversityScore * 0.18
      + cell.waterAvailabilityScore * 0.18
      + (cell.dominantPlantKey === "aquatic-algae" ? 0.18 : 0)
      + (cell.dominantPlantKey === "reeds-wetland" ? 0.08 : 0),
  ));
}

function shelterAvailability(cell: PlantGridCell, terrain: TerrainGridCell): number {
  return round(clamp(
    cell.woodMaterialScore * 0.28
      + cell.biomassScore * 0.22
      + cell.vegetationDensity * 0.18
      + terrain.ruggedness * 0.14
      + (cell.biomeCategory === "wetland" ? 0.12 : 0)
      + (cell.biomeKey === "desert" || cell.biomeKey === "badlands-rocky" ? 0.08 : 0),
  ));
}

function insectPreyBase(cell: PlantGridCell): number {
  return round(clamp(
    cell.biodiversityScore * 0.34
      + cell.plantDensity * 0.24
      + cell.waterAvailabilityScore * 0.14
      + Math.max(0, cell.adjustedTemperatureC) / 40 * 0.16
      + (cell.biomeKey === "tropical-rainforest" || cell.biomeCategory === "wetland" ? 0.18 : 0)
      - cell.seasonalStressScore * 0.12,
  ));
}

function herbivoreCapacity(cell: PlantGridCell): number {
  if (cell.biomeKey === "ocean") {
    return round(aquaticFoodBase(cell) * 0.22);
  }

  return round(clamp(
    plantFoodBase(cell) * 0.52
      + cell.ediblePlantScore * 0.18
      + cell.waterAvailabilityScore * 0.12
      + cell.fertilityScore * 0.08
      + (["temperate-grassland", "savanna"].includes(cell.biomeKey) ? 0.14 : 0)
      + (cell.dominantPlantKey === "grasses" ? 0.1 : 0)
      - cell.seasonalStressScore * 0.12
      - (["ice-sheet", "volcanic-barren"].includes(cell.biomeKey) ? 0.22 : 0),
  ));
}

function preyAvailability(cell: PlantGridCell, herbivores: number): number {
  const aquatic = aquaticFoodBase(cell);
  const insects = insectPreyBase(cell);

  return round(clamp(
    herbivores * 0.44
      + insects * 0.24
      + aquatic * 0.22
      + cell.biodiversityScore * 0.14
  ));
}

function predatorCapacity(cell: PlantGridCell, prey: number, shelter: number): number {
  return round(clamp(
    prey * 0.66
      + shelter * 0.1
      + cell.biodiversityScore * 0.1
      + (cell.biomeKey === "tropical-rainforest" || cell.biomeKey === "savanna" ? 0.08 : 0)
      - (["ice-sheet", "volcanic-barren", "ocean"].includes(cell.biomeKey) ? 0.12 : 0),
  ));
}

function carryingCapacity(cell: PlantGridCell, herbivores: number, prey: number, predators: number): number {
  const aquatic = aquaticFoodBase(cell);
  const base = isWaterBiome(cell)
    ? aquatic * 0.48 + prey * 0.28 + waterBodySupport(cell) * 0.16 + cell.biodiversityScore * 0.12
    : herbivores * 0.38 + prey * 0.22 + predators * 0.12 + cell.waterAvailabilityScore * 0.12 + cell.biodiversityScore * 0.12 + cell.habitabilityScore * 0.08;

  return round(clamp(base - cell.seasonalStressScore * 0.08 - (cell.biomeKey === "ice-sheet" ? 0.18 : 0)));
}

function animalBiomeDensityCap(cell: PlantGridCell): number {
  switch (cell.biomeKey) {
    case "ocean":
      return 0.6;
    case "coast":
    case "lake":
      return 0.72;
    case "river-wetland":
      return 0.78;
    case "swamp-marsh":
      return 0.86;
    case "tropical-rainforest":
      return 0.9;
    case "tropical-seasonal-forest":
    case "temperate-forest":
      return 0.76;
    case "temperate-grassland":
    case "savanna":
      return 0.82;
    case "boreal-forest":
      return 0.52;
    case "tundra":
      return 0.3;
    case "desert":
    case "badlands-rocky":
      return 0.2;
    case "alpine-mountain":
      return 0.18;
    case "volcanic-barren":
      return 0.08;
    case "ice-sheet":
      return 0.06;
    default:
      return 0.46;
  }
}

function biomePreferenceScore(definition: AnimalGuildDefinition, cell: PlantGridCell): number {
  if (definition.biomePreferences.includes(cell.biomeKey)) {
    return 1;
  }

  if (definition.category === "aquatic" && ["marine", "freshwater", "wetland"].includes(cell.biomeCategory)) {
    return 0.62;
  }

  if (definition.key === "birds" && includesAny(cell.biomeTags, ["freshwater", "forest", "grass", "wetland"])) {
    return 0.54;
  }

  if (HERBIVORE_GUILDS.has(definition.key) && includesAny(cell.biomeTags, ["grass", "forest", "fertile", "shrub"])) {
    return 0.52;
  }

  if (PREDATOR_GUILDS.has(definition.key) && !isWaterBiome(cell) && cell.biomeKey !== "ice-sheet") {
    return 0.42;
  }

  if (definition.key === "scavengers" && LOW_DENSITY_BIOMES.has(cell.biomeKey)) {
    return 0.5;
  }

  if (definition.key === "cold-adapted-animals" && cell.adjustedTemperatureC <= 7) {
    return 0.58;
  }

  if (definition.key === "desert-adapted-animals" && (cell.precipitationScore <= 0.24 || includesAny(cell.biomeTags, ["arid", "dry"]))) {
    return 0.58;
  }

  if (definition.key === "wetland-animals" && cell.waterAvailabilityScore >= 0.72) {
    return 0.42;
  }

  return 0.05;
}

function ecologicalPenalty(definition: AnimalGuildDefinition, cell: PlantGridCell, terrain: TerrainGridCell): number {
  const landAnimalInDeepWater = cell.biomeKey === "ocean" && !AQUATIC_GUILDS.has(definition.key) ? 0.92 : 0;
  const fishOutOfWater = definition.key === "fish" && !isWaterBiome(cell) && cell.biomeCategory !== "wetland" ? 0.72 : 0;
  const aquaticOutOfWater = definition.key === "aquatic-microfauna" && !isWaterBiome(cell) && cell.biomeCategory !== "wetland" ? 0.68 : 0;
  const largeAnimalIcePenalty = cell.biomeKey === "ice-sheet" && ["large-herbivores", "apex-predators", "grazers"].includes(definition.key) ? 0.32 : 0;
  const barrenPenalty = cell.biomeKey === "volcanic-barren" && !["insects", "burrowers", "scavengers", "desert-adapted-animals"].includes(definition.key) ? 0.28 : 0;
  const steepLargeAnimalPenalty = terrain.ruggedness >= 0.72 && ["large-herbivores", "grazers"].includes(definition.key) ? 0.16 : 0;
  const heatColdMismatch = definition.key === "cold-adapted-animals" && cell.adjustedTemperatureC > 14 ? 0.36 : 0;

  return clamp(landAnimalInDeepWater + fishOutOfWater + aquaticOutOfWater + largeAnimalIcePenalty + barrenPenalty + steepLargeAnimalPenalty + heatColdMismatch);
}

function scoreAnimalCandidate(
  definition: AnimalGuildDefinition,
  inputs: AnimalCellInputs,
  values: {
    readonly herbivores: number;
    readonly prey: number;
    readonly shelter: number;
  },
): AnimalCandidate {
  const { plant, terrain } = inputs;
  const preference = biomePreferenceScore(definition, plant);
  const temperatureFit = rangeFit(plant.adjustedTemperatureC, definition.temperatureRangeC, 20);
  const precipitationFit = rangeFit(plant.precipitationScore, definition.precipitationRange, 0.32);
  const elevationFit = rangeFit(plant.elevation, definition.elevationTolerance, 0.2);
  const waterFit = requirementFit(Math.max(plant.waterAvailabilityScore, waterBodySupport(plant)), definition.waterDependency);
  const foodFit = definition.plantFoodDependency <= 0.001
    ? 1
    : requirementFit(Math.max(plantFoodBase(plant), aquaticFoodBase(plant)), definition.plantFoodDependency);
  const preyFit = definition.preyDependency <= 0.001
    ? 1
    : requirementFit(values.prey, definition.preyDependency);
  const shelterFit = requirementFit(values.shelter, definition.shelterRequirement);
  const predatorSupportBonus = PREDATOR_GUILDS.has(definition.key) ? values.prey * 0.08 : 0;
  const herbivoreSupportBonus = HERBIVORE_GUILDS.has(definition.key) ? values.herbivores * 0.1 : 0;
  const wetlandBonus = plant.biomeCategory === "wetland" && ["amphibians", "wetland-animals", "birds", "insects"].includes(definition.key) ? 0.12 : 0;
  const rainforestBonus = plant.biomeKey === "tropical-rainforest" && ["insects", "birds", "apex-predators", "amphibians"].includes(definition.key) ? 0.1 : 0;
  const grasslandBonus = ["temperate-grassland", "savanna"].includes(plant.biomeKey) && ["grazers", "large-herbivores", "small-herbivores"].includes(definition.key) ? 0.12 : 0;
  const desertBonus = plant.biomeKey === "desert" && definition.key === "desert-adapted-animals" ? 0.16 : 0;
  const coldBonus = ["tundra", "boreal-forest", "alpine-mountain"].includes(plant.biomeKey) && definition.key === "cold-adapted-animals" ? 0.14 : 0;
  const penalty = ecologicalPenalty(definition, plant, terrain);

  const suitability = round(clamp(
    preference * 0.28
      + temperatureFit * 0.12
      + precipitationFit * 0.08
      + elevationFit * 0.07
      + waterFit * 0.12
      + foodFit * 0.14
      + preyFit * 0.08
      + shelterFit * 0.06
      + definition.reproductionRate * 0.04
      + definition.biodiversityValue * 0.03
      + predatorSupportBonus
      + herbivoreSupportBonus
      + wetlandBonus
      + rainforestBonus
      + grasslandBonus
      + desertBonus
      + coldBonus
      - penalty,
  ));

  return Object.freeze({
    definition,
    suitability,
    temperatureFit,
    precipitationFit,
    elevationFit,
    foodFit,
    preyFit,
    waterFit,
    shelterFit,
  });
}

function selectDominantAnimal(
  inputs: AnimalCellInputs,
  values: {
    readonly herbivores: number;
    readonly prey: number;
    readonly shelter: number;
  },
): AnimalCandidate {
  const candidates = ANIMAL_GUILD_KEYS.map((key) => scoreAnimalCandidate(ANIMAL_GUILD_DEFINITIONS[key], inputs, values));
  const sorted = candidates.sort((left, right) => {
    const leftJitter = hashUnit(inputs.seed, `${inputs.plant.id}:${left.definition.key}:dominance`) * 0.02;
    const rightJitter = hashUnit(inputs.seed, `${inputs.plant.id}:${right.definition.key}:dominance`) * 0.02;

    return (right.suitability + rightJitter) - (left.suitability + leftJitter)
      || right.definition.biodiversityValue - left.definition.biodiversityValue
      || left.definition.key.localeCompare(right.definition.key);
  });

  return sorted[0];
}

function densityMultiplier(definition: AnimalGuildDefinition): number {
  switch (definition.category) {
    case "invertebrate":
      return 1.12;
    case "aquatic":
      return definition.key === "aquatic-microfauna" ? 1.06 : 0.86;
    case "herbivore":
      return definition.key === "large-herbivores" ? 0.78 : 0.95;
    case "predator":
      return definition.key === "apex-predators" ? 0.44 : 0.62;
    case "scavenger":
      return 0.58;
    default:
      return 0.82;
  }
}

function getMigrationPressure(cell: PlantGridCell, terrain: TerrainGridCell, definition: AnimalGuildDefinition, carrying: number, seed: string): number {
  const terrainStress = clamp((cell.elevation - 0.68) * 1.7 + terrain.ruggedness * 0.18);
  const scarcity = 1 - carrying;
  const waterStress = definition.waterDependency > 0.3 ? clamp(definition.waterDependency - Math.max(cell.waterAvailabilityScore, waterBodySupport(cell))) : 0;
  const jitter = (hashUnit(seed, `${cell.id}:migration-pressure`) - 0.5) * 0.04;

  return round(clamp(
    definition.migrationTendency * 0.34
      + cell.seasonalStressScore * 0.24
      + scarcity * 0.18
      + terrainStress * 0.14
      + waterStress * 0.14
      + jitter,
  ));
}

function getDangerScore(definition: AnimalGuildDefinition, density: number, predators: number, cell: PlantGridCell): number {
  return round(clamp(
    definition.dangerScore * 0.42
      + density * definition.dangerScore * 0.2
      + predators * 0.22
      + (cell.biomeKey === "tropical-rainforest" || cell.biomeKey === "swamp-marsh" ? 0.07 : 0)
      + (cell.biomeKey === "desert" || cell.biomeKey === "alpine-mountain" ? 0.04 : 0),
  ));
}

function getHuntingValue(definition: AnimalGuildDefinition, density: number, herbivores: number, prey: number, cell: PlantGridCell): number {
  const fisheryBonus = definition.key === "fish" ? aquaticFoodBase(cell) * 0.24 : 0;

  return round(clamp(
    density * definition.humanFoodValue * 0.46
      + herbivores * 0.22
      + prey * 0.1
      + fisheryBonus
      + (["large-herbivores", "grazers", "browsers"].includes(definition.key) ? 0.12 : 0)
      - definition.dangerScore * 0.08,
  ));
}

function getDomesticationPotential(definition: AnimalGuildDefinition, density: number, herbivores: number, cell: PlantGridCell): number {
  if (!["grazers", "large-herbivores", "browsers", "small-herbivores", "birds"].includes(definition.key) || cell.biomeKey === "ocean") {
    return 0;
  }

  const openHabitatBonus = ["temperate-grassland", "savanna", "river-wetland"].includes(cell.biomeKey) ? 0.14 : 0;
  const manageable = 1 - definition.dangerScore;

  return round(clamp(
    herbivores * 0.28
      + density * 0.2
      + definition.humanFoodValue * 0.18
      + manageable * 0.16
      + cell.waterAvailabilityScore * 0.08
      + openHabitatBonus
      - definition.migrationTendency * 0.06,
  ));
}

function getAnimalBiodiversity(definition: AnimalGuildDefinition, density: number, prey: number, carrying: number, cell: PlantGridCell): number {
  return round(clamp(
    cell.biodiversityScore * 0.34
      + definition.biodiversityValue * 0.24
      + density * 0.16
      + prey * 0.12
      + carrying * 0.1
      + (cell.biomeKey === "tropical-rainforest" || cell.biomeCategory === "wetland" ? 0.1 : 0)
      - (LOW_DENSITY_BIOMES.has(cell.biomeKey) ? 0.08 : 0),
  ));
}

function buildAnimalTags(
  definition: AnimalGuildDefinition,
  cell: PlantGridCell,
  values: {
    readonly density: number;
    readonly herbivores: number;
    readonly predators: number;
    readonly migration: number;
    readonly danger: number;
    readonly domestication: number;
  },
): readonly string[] {
  const densityTag = values.density >= 0.62 ? "dense-fauna" : values.density >= 0.28 ? "moderate-fauna" : "sparse-fauna";
  const tags = new Set<string>([
    ...definition.tags,
    densityTag,
    ...cell.biomeTags.filter((tag) => ["marine", "freshwater", "forest", "grass", "wetland", "tropical", "cold", "arid", "fertile"].includes(tag)),
  ]);

  if (values.herbivores >= 0.48) {
    tags.add("herbivore-rich");
  }

  if (values.predators >= 0.42 || definition.key === "apex-predators") {
    tags.add("predator-support");
  }

  if (values.migration >= 0.58) {
    tags.add("migration-pressure");
  }

  if (values.danger >= 0.48) {
    tags.add("danger-zone");
  }

  if (values.domestication >= 0.52) {
    tags.add("domestication-candidate");
  }

  return Object.freeze([...tags].sort());
}


function speciesBiomeScore(definition: AnimalSpeciesDefinition, cell: PlantGridCell): number {
  if (definition.preferredBiomes.includes(cell.biomeKey)) {
    return 1;
  }

  if (definition.tags.includes("aquatic") && ["marine", "freshwater", "wetland"].includes(cell.biomeCategory)) {
    return 0.56;
  }

  if (definition.trophicLevel === "Herbivore" && includesAny(cell.biomeTags, ["grass", "forest", "shrub", "fertile"])) {
    return 0.44;
  }

  if (definition.trophicLevel === "Carnivore" && !isWaterBiome(cell) && cell.biomeKey !== "volcanic-barren") {
    return 0.34;
  }

  if (definition.tags.includes("polar") && cell.adjustedTemperatureC <= 6) {
    return 0.44;
  }

  if (definition.tags.includes("desert") && (cell.precipitationScore <= 0.22 || includesAny(cell.biomeTags, ["arid", "dry"]))) {
    return 0.48;
  }

  return 0.04;
}

function plantDensityFit(cell: PlantGridCell, definition: AnimalSpeciesDefinition): number {
  if (definition.trophicLevel === "Carnivore" && definition.tags.includes("aquatic")) {
    return 1;
  }

  return rangeFit(cell.plantDensity, definition.preferredPlantDensity, 0.28);
}

function speciesFoodAvailability(
  definition: AnimalSpeciesDefinition,
  cell: PlantGridCell,
  values: { readonly herbivores: number; readonly prey: number },
): number {
  if (definition.tags.includes("aquatic")) {
    return round(clamp(aquaticFoodBase(cell) * 0.56 + values.prey * 0.24 + waterBodySupport(cell) * 0.2));
  }

  switch (definition.trophicLevel) {
    case "Herbivore":
      return round(clamp(plantFoodBase(cell) * 0.56 + cell.ediblePlantScore * 0.24 + cell.waterAvailabilityScore * 0.14 + cell.regrowthRate * 0.06));
    case "Carnivore":
      return round(clamp(values.prey * 0.68 + values.herbivores * 0.18 + aquaticFoodBase(cell) * 0.12));
    case "Omnivore":
      return round(clamp(plantFoodBase(cell) * 0.34 + values.prey * 0.28 + aquaticFoodBase(cell) * 0.16 + cell.biodiversityScore * 0.12 + cell.waterAvailabilityScore * 0.1));
  }
}

export function scoreAnimalSpeciesHabitat(
  definition: AnimalSpeciesDefinition,
  cell: PlantGridCell,
  values: { readonly herbivores: number; readonly prey: number },
): number {
  const biome = speciesBiomeScore(definition, cell);
  const temperature = rangeFit(cell.adjustedTemperatureC, definition.acceptableTemperatureRange, 16 + definition.climateTolerance * 18);
  const rainfall = rangeFit(cell.precipitationScore, definition.acceptableRainfallRange, 0.24 + definition.climateTolerance * 0.18);
  const elevation = rangeFit(cell.elevation, definition.acceptableElevationRange, 0.18 + definition.climateTolerance * 0.08);
  const plants = plantDensityFit(cell, definition);
  const food = speciesFoodAvailability(definition, cell, values);
  const water = definition.tags.includes("water-efficient")
    ? 1
    : requirementFit(Math.max(cell.waterAvailabilityScore, waterBodySupport(cell)), definition.tags.includes("aquatic") ? 0.86 : 0.18);
  const climateBuffer = definition.climateTolerance * 0.05;
  const marineMismatch = definition.tags.includes("aquatic") || !isWaterBiome(cell) || cell.biomeKey === "coast" ? 0 : 0.72;
  const landMismatch = definition.tags.includes("aquatic") && !isWaterBiome(cell) && cell.biomeCategory !== "wetland" ? 0.68 : 0;

  return round(clamp(
    biome * 0.28
      + temperature * 0.16
      + rainfall * 0.1
      + elevation * 0.08
      + plants * 0.12
      + food * 0.16
      + water * 0.08
      + climateBuffer
      - marineMismatch
      - landMismatch,
  ));
}

function speciesCarryingCapacity(definition: AnimalSpeciesDefinition, suitability: number, food: number, carrying: number): number {
  if (suitability < 0.1 || food < 0.08) {
    return 0;
  }

  const massScaler = clamp(9 / Math.sqrt(Math.max(definition.bodyMass, 0.2)), 0.08, 5.2);
  const waterMultiplier = definition.tags.includes("aquatic") ? 1.45 : 1;
  const base = 540 * definition.carryingCapacityModifier * massScaler * waterMultiplier;

  return Math.max(0, Math.round(base * suitability * (food * 0.58 + carrying * 0.42)));
}

function seasonalBirthModifier(cell: PlantGridCell): number {
  const mildTemperature = clamp(1 - Math.abs(cell.adjustedTemperatureC - 15) / 24);
  const springLikeMoisture = clamp(cell.precipitationScore * 0.44 + cell.regrowthRate * 0.34 + (1 - cell.seasonalStressScore) * 0.22);
  const winterStress = cell.adjustedTemperatureC <= 0 ? clamp(Math.abs(cell.adjustedTemperatureC) / 28) : 0;

  return round(clamp(0.68 + mildTemperature * 0.24 + springLikeMoisture * 0.22 - winterStress * 0.34, 0.24, 1.32));
}

function speciesHealth(definition: AnimalSpeciesDefinition, suitability: number, food: number, cell: PlantGridCell): number {
  const starvation = food < definition.starvationThreshold ? (definition.starvationThreshold - food) / Math.max(definition.starvationThreshold, 0.01) : 0;
  const seasonalPenalty = cell.seasonalStressScore * (definition.climateTolerance >= 0.8 ? 0.1 : 0.22);

  return round(clamp(suitability * 0.42 + food * 0.34 + (1 - seasonalPenalty) * 0.18 + definition.climateTolerance * 0.06 - starvation * 0.34));
}

function logisticPopulation(initialPopulation: number, capacity: number, growthRate: number, tick: bigint): number {
  if (capacity <= 0 || initialPopulation <= 0 || growthRate <= 0) {
    return 0;
  }

  const elapsedTicks = Number(tick > 0n ? tick : 0n);
  const elapsedGenerations = Math.min(elapsedTicks / 18, 240);
  const ratio = (capacity - initialPopulation) / initialPopulation;
  const population = capacity / (1 + ratio * Math.exp(-growthRate * elapsedGenerations));

  return Math.max(0, Math.min(capacity, Math.round(population)));
}

function speciesMigrationPressure(definition: AnimalSpeciesDefinition, health: number, food: number, suitability: number, cell: PlantGridCell): number {
  const scarcity = clamp(definition.starvationThreshold - food, 0, 1);
  const crowding = suitability < definition.migrationThreshold ? definition.migrationThreshold - suitability : 0;

  return round(clamp(scarcity * 0.34 + crowding * 0.28 + cell.seasonalStressScore * 0.22 + (1 - health) * 0.16));
}

function buildAnimalPopulations(
  cell: PlantGridCell,
  values: { readonly herbivores: number; readonly prey: number; readonly carrying: number },
  seed: string,
  tick: bigint,
): readonly AnimalPopulationState[] {
  const populations = getAnimalSpeciesDefinitions().map((definition) => {
    const habitatSuitability = scoreAnimalSpeciesHabitat(definition, cell, values);
    const foodAvailability = speciesFoodAvailability(definition, cell, values);
    const carryingCapacity = speciesCarryingCapacity(definition, habitatSuitability, foodAvailability, values.carrying);
    const preliminaryMigration = round(clamp(
      cell.seasonalityScore * 0.26
        + cell.seasonalStressScore * 0.24
        + (1 - foodAvailability) * 0.24
        + (1 - habitatSuitability) * 0.18
        + hashUnit(seed, `${cell.id}:${definition.id}:migration-frequency`) * 0.08,
    ));
    const adaptationPressure = getAdaptationPressure(cell, values, preliminaryMigration);
    const adaptationProfile = buildAdaptationProfile(definition, adaptationPressure, seed, tick);
    const adaptationTrends = buildAdaptationTrends(definition, adaptationPressure, seed, tick, adaptationProfile);
    const birthModifier = seasonalBirthModifier(cell);
    const starvationPenalty = foodAvailability < definition.starvationThreshold ? 0.58 : 1;
    const climateAdaptation = getClimateAdaptationScore(adaptationProfile);
    const growthAdaptation = 0.72
      + adaptationProfile.reproductiveEfficiency * 0.22
      + adaptationProfile.juvenileSurvival * 0.14
      + adaptationProfile.metabolismEfficiency * 0.08
      + climateAdaptation * 0.08;
    const mortalityAdaptation = clamp(
      1.12
        - adaptationProfile.stressResistance * 0.2
        - adaptationProfile.longevity * 0.14
        - climateAdaptation * 0.12,
      0.62,
      1.12,
    );
    const netGrowth = Math.max(
      0,
      definition.reproductionRate * birthModifier * habitatSuitability * starvationPenalty * growthAdaptation
        - definition.naturalMortalityRate * (1 - habitatSuitability) * mortalityAdaptation,
    );
    const seededInitial = carryingCapacity * (0.05 + hashUnit(seed, `${cell.id}:${definition.id}:initial-population`) * 0.18) * habitatSuitability;
    const initial = Math.max(1, seededInitial);
    const population = logisticPopulation(initial, carryingCapacity, netGrowth, tick);
    const previousPopulation = logisticPopulation(initial, carryingCapacity, netGrowth, tick > 0n ? tick - 1n : 0n);
    const baseHealth = speciesHealth(definition, habitatSuitability, foodAvailability, cell);
    const health = population > 0 ? round(clamp(
      baseHealth * 0.78
        + adaptationProfile.stressResistance * 0.08
        + adaptationProfile.metabolismEfficiency * 0.06
        + adaptationProfile.diseaseResistance * 0.04
        + adaptationProfile.juvenileSurvival * 0.04,
    )) : 0;
    const baseMigrationPressure = population > 0 ? speciesMigrationPressure(definition, health, foodAvailability, habitatSuitability, cell) : 0;
    const migrationPressure = population > 0 ? round(clamp(
      baseMigrationPressure * (0.82 + adaptationProfile.migrationInstinct * 0.34 - adaptationProfile.stressResistance * 0.16),
    )) : 0;
    const competitionPressure = carryingCapacity > 0 ? round(clamp(population / Math.max(carryingCapacity, 1) - 0.72, 0, 1)) : 0;
    const fitnessScore = population > 0 ? getPopulationFitness({
      definition,
      habitatSuitability,
      foodAvailability,
      health,
      predationPressure: 0,
      migrationPressure,
      climateStress: cell.seasonalStressScore,
      adaptationProfile,
    }) : 0;

    return Object.freeze({
      speciesId: definition.id,
      speciesName: definition.name,
      scientificName: definition.scientificName,
      trophicLevel: definition.trophicLevel,
      population,
      health,
      foodAvailability,
      migrationPressure,
      habitatSuitability,
      carryingCapacity,
      predationPressure: 0,
      competitionPressure,
      carryingCapacityUsage: carryingCapacity > 0 ? round(clamp(population / carryingCapacity)) : 0,
      inboundMigration: 0,
      outboundMigration: 0,
      netMigration: 0,
      populationTrend: round((population - previousPopulation) / Math.max(previousPopulation, 1) + (fitnessScore - 0.5) * 0.002, 4),
      fitnessScore,
      adaptationProfile,
      adaptationTrends,
      lastUpdatedTick: tick.toString(),
    });
  }).filter((population) => population.population > 0 || population.habitatSuitability >= 0.22);

  return Object.freeze(populations.sort((left, right) =>
    right.population - left.population
      || right.fitnessScore - left.fitnessScore
      || right.habitatSuitability - left.habitatSuitability
      || left.speciesId.localeCompare(right.speciesId),
  ));
}

function averagePopulationMetric(populations: readonly AnimalPopulationState[], metric: (population: AnimalPopulationState) => number): number {
  const present = populations.filter((population) => population.population > 0);

  return round(average((present.length > 0 ? present : populations).map(metric)));
}


type PopulationMigrationDelta = {
  inbound: number;
  outbound: number;
  delta: number;
};

type CellEcosystemMetrics = {
  plantConsumptionRate: number;
  effectivePlantBiomass: number;
  predationPressure: number;
  predatorPreyBalance: number;
  foodStability: number;
  carryingCapacityUsage: number;
  migrationActivity: number;
  populationGrowthRate: number;
  ecosystemHealthScore: number;
  ecosystemHealthStatus: EcosystemHealthStatus;
  averageFitness: number;
  adaptationDiversity: number;
  averageMigrationInstinct: number;
  averageDiseaseResistance: number;
  averageReproductiveEfficiency: number;
  averageClimateAdaptation: number;
  highestAdaptedPopulation: PopulationAdaptationSummary | null;
  lowestFitnessPopulation: PopulationAdaptationSummary | null;
};

function movementKey(cellId: string, speciesId: string): string {
  return `${cellId}:${speciesId}`;
}

function getPopulationScore(population: AnimalPopulationState): number {
  return round(clamp(
    population.habitatSuitability * 0.36
      + population.foodAvailability * 0.28
      + (1 - population.carryingCapacityUsage) * 0.2
      + population.health * 0.16,
  ));
}

function getSpeciesBiomass(populations: readonly AnimalPopulationState[], definitions: ReadonlyMap<string, AnimalSpeciesDefinition>, trophicLevel: AnimalSpeciesDefinition["trophicLevel"]): number {
  return populations.reduce((total, population) => {
    if (population.population <= 0 || population.trophicLevel !== trophicLevel) {
      return total;
    }

    return total + population.population * (definitions.get(population.speciesId)?.bodyMass ?? 1);
  }, 0);
}

function getPlantConsumptionRate(cell: AnimalGridCell, populations: readonly AnimalPopulationState[], definitions: ReadonlyMap<string, AnimalSpeciesDefinition>): number {
  const demand = populations.reduce((total, population) => {
    if (population.population <= 0) {
      return total;
    }

    const definition = definitions.get(population.speciesId);
    const mass = definition?.bodyMass ?? 1;
    const trophicFactor = population.trophicLevel === "Herbivore" ? 1 : population.trophicLevel === "Omnivore" ? 0.34 : 0;

    return total + population.population * mass * trophicFactor;
  }, 0);
  const edibleSupply = Math.max(1, cell.ediblePlantScore * 120_000 + cell.biomassScore * 80_000 + cell.regrowthRate * 30_000);

  return round(clamp(demand / edibleSupply));
}

function effectiveBiomassAfterConsumption(cell: PlantGridCell, plantConsumptionRate: number): number {
  return round(clamp(
    cell.biomassScore * (1 - plantConsumptionRate * PLANT_CONSUMPTION_BIOMASS_DRAWDOWN)
      + cell.regrowthRate * PLANT_CONSUMPTION_REGROWTH_RECOVERY,
  ));
}

function applyPlantConsumptionPressure(
  populations: readonly AnimalPopulationState[],
  plantConsumptionRate: number,
  effectivePlantBiomass: number,
): readonly AnimalPopulationState[] {
  const pressure = pressureAbove(plantConsumptionRate, PLANT_CONSUMPTION_STRESS_THRESHOLD);

  if (pressure <= 0) {
    return populations;
  }

  const biomassShortfall = 1 - effectivePlantBiomass;

  return Object.freeze(populations.map((population) => {
    if (population.population <= 0 || population.trophicLevel === "Carnivore") {
      return population;
    }

    const foodPenalty = population.trophicLevel === "Herbivore"
      ? PLANT_CONSUMPTION_HERBIVORE_FOOD_PENALTY
      : PLANT_CONSUMPTION_OMNIVORE_FOOD_PENALTY;
    const mortalityRate = pressure * biomassShortfall * (population.trophicLevel === "Herbivore"
      ? PLANT_CONSUMPTION_HERBIVORE_MORTALITY
      : PLANT_CONSUMPTION_OMNIVORE_MORTALITY);
    const mortality = Math.min(population.population, Math.floor(population.population * mortalityRate));
    const adjustedPopulation = population.population - mortality;
    const adjustedFoodAvailability = round(clamp(population.foodAvailability - pressure * biomassShortfall * foodPenalty));
    const adjustedHealth = round(clamp(population.health - pressure * biomassShortfall * 0.16));
    const adjustedMigrationPressure = round(clamp(population.migrationPressure + pressure * biomassShortfall * 0.1));
    const adjustedFitness = round(clamp(population.fitnessScore - pressure * biomassShortfall * 0.08));

    return Object.freeze({
      ...population,
      population: adjustedPopulation,
      foodAvailability: adjustedFoodAvailability,
      health: adjustedHealth,
      migrationPressure: adjustedMigrationPressure,
      carryingCapacityUsage: population.carryingCapacity > 0 ? round(clamp(adjustedPopulation / population.carryingCapacity)) : 0,
      fitnessScore: adjustedFitness,
      populationTrend: round(population.populationTrend - mortality / Math.max(population.population, 1) - pressure * biomassShortfall * 0.012, 4),
    });
  }).sort((left, right) => right.population - left.population || right.habitatSuitability - left.habitatSuitability || left.speciesId.localeCompare(right.speciesId)));
}

function getPopulationGrowthRate(populations: readonly AnimalPopulationState[]): number {
  const present = populations.filter((population) => population.population > 0);

  return round(average(present.map((population) => population.populationTrend)), 4);
}

function getEcosystemHealthStatus(score: number): EcosystemHealthStatus {
  if (score >= 0.82) {
    return "Excellent";
  }

  if (score >= 0.62) {
    return "Healthy";
  }

  if (score >= 0.38) {
    return "Stressed";
  }

  if (score >= 0.16) {
    return "Collapsing";
  }

  return "Collapsed";
}

function getCellEcosystemMetrics(
  cell: AnimalGridCell,
  populations: readonly AnimalPopulationState[],
  movementVectors: readonly AnimalMovementVector[],
  definitions: ReadonlyMap<string, AnimalSpeciesDefinition>,
): CellEcosystemMetrics {
  const herbivoreBiomass = getSpeciesBiomass(populations, definitions, "Herbivore");
  const predatorBiomass = getSpeciesBiomass(populations, definitions, "Carnivore");
  const plantConsumptionRate = getPlantConsumptionRate(cell, populations, definitions);
  const effectivePlantBiomass = effectiveBiomassAfterConsumption(cell, plantConsumptionRate);
  const predationPressure = round(clamp(predatorBiomass / Math.max(herbivoreBiomass * 0.28, 1) * 0.5 + cell.predatorCapacity * 0.28));
  const predatorPreyBalance = round(clamp(1 - Math.abs(predatorBiomass / Math.max(herbivoreBiomass * 0.22, 1) - 1) / 2));
  const totalPopulation = populations.reduce((total, population) => total + population.population, 0);
  const totalCapacity = populations.reduce((total, population) => total + population.carryingCapacity, 0);
  const carryingCapacityUsage = totalCapacity > 0 ? round(clamp(totalPopulation / totalCapacity)) : 0;
  const movementTotal = movementVectors.reduce((total, vector) => total + vector.population, 0);
  const migrationActivity = round(clamp(averagePopulationMetric(populations, (population) => population.migrationPressure) * 0.62 + movementTotal / Math.max(totalPopulation, 1) * 0.38));
  const foodStability = round(clamp(
    averagePopulationMetric(populations, (population) => population.foodAvailability) * 0.44
      + effectivePlantBiomass * 0.24
      + cell.waterAvailabilityScore * 0.16
      + (1 - plantConsumptionRate) * 0.16
      - plantConsumptionRate * PLANT_CONSUMPTION_FOOD_STABILITY_PENALTY
      - cell.seasonalStressScore * 0.12,
  ));
  const capacityBalance = clamp(1 - Math.abs(carryingCapacityUsage - 0.62) / 0.62);
  const ecosystemHealthScore = round(clamp(
    cell.animalBiodiversityScore * 0.14
      + cell.biodiversityScore * 0.12
      + foodStability * 0.18
      + predatorPreyBalance * 0.12
      + effectivePlantBiomass * 0.12
      + capacityBalance * 0.12
      + (1 - migrationActivity) * 0.08
      + (1 - cell.seasonalStressScore) * 0.08
      + cell.waterAvailabilityScore * 0.08
      + averagePopulationMetric(populations, (population) => population.health) * 0.06
      + averagePopulationMetric(populations, (population) => population.fitnessScore) * 0.08,
  ));
  const highestAdaptedPopulation = getHighestAdaptedPopulation(populations);
  const lowestFitnessPopulation = getLowestFitnessPopulation(populations);

  return Object.freeze({
    plantConsumptionRate,
    effectivePlantBiomass,
    predationPressure,
    predatorPreyBalance,
    foodStability,
    carryingCapacityUsage,
    migrationActivity,
    populationGrowthRate: getPopulationGrowthRate(populations),
    ecosystemHealthScore,
    ecosystemHealthStatus: getEcosystemHealthStatus(ecosystemHealthScore),
    averageFitness: averagePopulationMetric(populations, (population) => population.fitnessScore),
    adaptationDiversity: getAdaptationDiversity(populations),
    averageMigrationInstinct: averagePopulationMetric(populations, (population) => population.adaptationProfile.migrationInstinct),
    averageDiseaseResistance: averagePopulationMetric(populations, (population) => population.adaptationProfile.diseaseResistance),
    averageReproductiveEfficiency: averagePopulationMetric(populations, (population) => population.adaptationProfile.reproductiveEfficiency),
    averageClimateAdaptation: averagePopulationMetric(populations, (population) => getClimateAdaptationScore(population.adaptationProfile)),
    highestAdaptedPopulation,
    lowestFitnessPopulation,
  });
}

function eventId(cellId: string, tick: bigint, type: EcosystemEventType, speciesId = "cell"): string {
  return `${cellId}:${tick.toString()}:${type}:${speciesId}`.toLowerCase().replace(/[^a-z0-9:-]+/g, "-");
}

function makeEcosystemEvent(cell: AnimalGridCell, tick: bigint, type: EcosystemEventType, severity: number, description: string, speciesId?: string): EcosystemEvent {
  return Object.freeze({
    id: eventId(cell.id, tick, type, speciesId),
    tick: tick.toString(),
    type,
    severity: round(severity),
    description,
    ...(speciesId ? { speciesId } : {}),
  });
}

function getAdaptationMilestoneEvents(cell: AnimalGridCell, populations: readonly AnimalPopulationState[], tick: bigint): readonly EcosystemEvent[] {
  const milestoneTraits = new Set<AdaptationTrait>([
    "coldTolerance",
    "heatTolerance",
    "droughtTolerance",
    "foragingEfficiency",
    "migrationInstinct",
    "predatorAwareness",
  ]);

  return Object.freeze(populations
    .filter((population) => population.population > 0)
    .flatMap((population) => population.adaptationTrends
      .filter((trend) => milestoneTraits.has(trend.trait) && trend.direction !== "Stable")
      .flatMap((trend) => {
        const currentBand = Math.floor(trend.value * 10);
        const previousBand = Math.floor(trend.previousValue * 10);

        if (currentBand === previousBand || (trend.value < 0.58 && trend.value > 0.42)) {
          return [];
        }

        const verb = trend.direction === "Increasing" ? "improved" : "declined";

        return [makeEcosystemEvent(
          cell,
          tick,
          "Adaptation Milestone",
          Math.abs(trend.value - trend.previousValue) + Math.abs(trend.value - 0.5),
          `${ADAPTATION_LABELS[trend.trait]} ${verb} for ${population.speciesName}. ${trend.reason}`,
          population.speciesId,
        )];
      }))
    .sort((left, right) => right.severity - left.severity || left.description.localeCompare(right.description))
    .slice(0, 2));
}

function buildEcosystemEvents(cell: AnimalGridCell, populations: readonly AnimalPopulationState[], metrics: CellEcosystemMetrics, tick: bigint): readonly EcosystemEvent[] {
  const events: EcosystemEvent[] = [...getAdaptationMilestoneEvents(cell, populations, tick)];
  const dominant = populations.find((population) => population.population > 0);

  if (metrics.populationGrowthRate >= 0.035) {
    events.push(makeEcosystemEvent(cell, tick, "Population Boom", metrics.populationGrowthRate, `${dominant?.speciesName ?? "Wildlife"} populations are expanding in this habitat.`, dominant?.speciesId));
  }

  if (metrics.populationGrowthRate <= -0.035) {
    events.push(makeEcosystemEvent(cell, tick, "Population Collapse", Math.abs(metrics.populationGrowthRate), `${dominant?.speciesName ?? "Wildlife"} populations declined from mortality and scarcity.`, dominant?.speciesId));
  }

  if (metrics.foodStability < 0.34) {
    events.push(makeEcosystemEvent(cell, tick, "Food Shortage", 1 - metrics.foodStability, "Food availability is no longer supporting current populations."));
  }

  if (metrics.migrationActivity >= 0.5 || cell.movementVectors.length > 0) {
    events.push(makeEcosystemEvent(cell, tick, "Migration Wave", metrics.migrationActivity, "Outward or inward population movement is reshaping the cell."));
  }

  if (metrics.plantConsumptionRate >= 0.58) {
    events.push(makeEcosystemEvent(cell, tick, "Overgrazing", metrics.plantConsumptionRate, "Grazing pressure is drawing down edible biomass."));
  }

  if (metrics.effectivePlantBiomass >= 0.3 && metrics.plantConsumptionRate < 0.32) {
    events.push(makeEcosystemEvent(cell, tick, "Vegetation Recovery", metrics.effectivePlantBiomass, "Plant biomass recovered faster than local consumption."));
  }

  if (metrics.predationPressure >= 0.58) {
    events.push(makeEcosystemEvent(cell, tick, "Predator Expansion", metrics.predationPressure, "Predator abundance is increasing pressure on prey populations."));
  }

  if (metrics.predationPressure <= 0.12 && cell.herbivoreCapacity >= 0.5) {
    events.push(makeEcosystemEvent(cell, tick, "Predator Decline", 1 - metrics.predationPressure, "Prey habitat is present but predator pressure is unusually low."));
  }

  if (cell.precipitationScore <= 0.18 || cell.waterAvailabilityScore <= 0.2) {
    events.push(makeEcosystemEvent(cell, tick, "Drought Stress", 1 - Math.max(cell.precipitationScore, cell.waterAvailabilityScore), "Dry conditions reduced food stability and increased migration pressure."));
  }

  if (cell.waterAvailabilityScore >= 0.86 && metrics.foodStability >= 0.58) {
    events.push(makeEcosystemEvent(cell, tick, "Flood Recovery", cell.waterAvailabilityScore, "High water availability supported biomass and habitat recovery."));
  }

  if (metrics.ecosystemHealthScore >= 0.72 && metrics.populationGrowthRate >= 0) {
    events.push(makeEcosystemEvent(cell, tick, "Habitat Recovery", metrics.ecosystemHealthScore, "Biodiversity, food, and population balance improved together."));
  }

  return Object.freeze(events.sort((left, right) => right.severity - left.severity || left.type.localeCompare(right.type)).slice(0, 6));
}

function buildEcosystemHistory(cell: AnimalGridCell, events: readonly EcosystemEvent[], tick: bigint): readonly EcosystemEvent[] {
  const recent = [...events];
  const fallbackType: EcosystemEventType = cell.ecosystemHealthScore >= 0.62 ? "Habitat Recovery" : cell.foodStability < 0.38 ? "Food Shortage" : "Migration Wave";

  while (recent.length < 4) {
    const offset = BigInt((recent.length + 1) * 4);
    const historyTick = tick > offset ? tick - offset : 0n;
    recent.push(makeEcosystemEvent(
      cell,
      historyTick,
      fallbackType,
      cell.ecosystemHealthScore,
      fallbackType === "Habitat Recovery"
        ? "Recent conditions remained stable enough for recovery."
        : fallbackType === "Food Shortage"
          ? "Recent scarcity signals continued to affect the cell."
          : "Recent migration pressure remained visible in population movement.",
    ));
  }

  return Object.freeze(recent.sort((left, right) => Number(BigInt(right.tick) - BigInt(left.tick))).slice(0, 6));
}

function replaceCellPopulations(
  cell: AnimalGridCell,
  populations: readonly AnimalPopulationState[],
  movementVectors: readonly AnimalMovementVector[],
  tick: bigint,
  definitions: ReadonlyMap<string, AnimalSpeciesDefinition>,
): AnimalGridCell {
  const presentPopulations = populations.filter((population) => population.population > 0);
  const dominantPopulation = presentPopulations[0] ?? populations[0] ?? null;
  const totalWildlifePopulation = presentPopulations.reduce((total, population) => total + population.population, 0);
  const provisionalCell = Object.freeze({
    ...cell,
    dominantSpeciesId: dominantPopulation?.speciesId ?? "none",
    dominantSpeciesName: dominantPopulation?.speciesName ?? "No Established Wildlife",
    speciesCount: presentPopulations.length,
    totalWildlifePopulation,
    averagePopulationHealth: averagePopulationMetric(populations, (population) => population.health),
    averageHabitatSuitability: averagePopulationMetric(populations, (population) => population.habitatSuitability),
    movementVectors,
    animalPopulations: populations,
  });
  const metrics = getCellEcosystemMetrics(provisionalCell, populations, movementVectors, definitions);
  const events = buildEcosystemEvents(provisionalCell, populations, metrics, tick);
  const finalCell = Object.freeze({
    ...provisionalCell,
    ...metrics,
    ecosystemEvents: events,
    ecosystemHistory: buildEcosystemHistory({ ...provisionalCell, ...metrics, ecosystemEvents: events, ecosystemHistory: [] }, events, tick),
  });

  return finalCell;
}

function applyPredationMortality(populations: readonly AnimalPopulationState[], predationPressure: number): readonly AnimalPopulationState[] {
  return Object.freeze(populations.map((population) => {
    if (population.population <= 0 || population.trophicLevel !== "Herbivore") {
      return population;
    }

    const mortality = Math.min(population.population, Math.floor(population.population * predationPressure * 0.035));
    const adjustedPopulation = population.population - mortality;
    const adjustedHealth = round(clamp(population.health - predationPressure * 0.12));
    const adjustedMigration = round(clamp(population.migrationPressure + predationPressure * 0.08));

    return Object.freeze({
      ...population,
      population: adjustedPopulation,
      health: adjustedHealth,
      migrationPressure: adjustedMigration,
      predationPressure,
      fitnessScore: round(clamp(population.fitnessScore - predationPressure * 0.08)),
      populationTrend: round(population.populationTrend - mortality / Math.max(population.population, 1), 4),
    });
  }).sort((left, right) => right.population - left.population || right.habitatSuitability - left.habitatSuitability || left.speciesId.localeCompare(right.speciesId)));
}

function applyEcosystemDynamics(cells: readonly AnimalGridCell[], grid: SpatialGrid, seed: string, tick: bigint): readonly AnimalGridCell[] {
  const definitions = getSpeciesDefinitionMap();
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const deltas = new Map<string, PopulationMigrationDelta>();
  const vectorsByCell = new Map<string, AnimalMovementVector[]>();

  for (const cell of cells) {
    const sourcePopulations = populationBySpecies(cell.animalPopulations);

    for (const population of cell.animalPopulations) {
      if (population.population <= 0 || population.migrationPressure < MIGRATION_PRESSURE_THRESHOLD) {
        continue;
      }

      const definition = definitions.get(population.speciesId);
      const threshold = Math.min(definition?.migrationThreshold ?? MIGRATION_PRESSURE_THRESHOLD, MIGRATION_PRESSURE_THRESHOLD);

      if (population.migrationPressure < threshold) {
        continue;
      }

      const sourceScore = getPopulationScore(population);
      const candidates = grid.getNeighbors(cell.id)
        .map((neighbor) => byId.get(neighbor.id))
        .flatMap((neighbor): Array<{ cell: AnimalGridCell; population: AnimalPopulationState; score: number; capacity: number }> => {
          const neighborPopulation = neighbor ? populationBySpecies(neighbor.animalPopulations).get(population.speciesId) : null;

          if (!neighbor || !neighborPopulation) {
            return [];
          }

          const capacity = Math.max(0, neighborPopulation.carryingCapacity - neighborPopulation.population);
          const score = getPopulationScore(neighborPopulation) - neighbor.seasonalStressScore * 0.04 + hashUnit(seed, `${cell.id}:${neighbor.id}:${population.speciesId}:migration-choice`) * 0.012;

          return capacity > 0 && score > sourceScore + 0.035 ? [{ cell: neighbor, population: neighborPopulation, score, capacity }] : [];
        })
        .sort((left, right) => right.score - left.score || left.cell.id.localeCompare(right.cell.id))
        .slice(0, 3);

      if (candidates.length === 0) {
        continue;
      }

      const pressureFactor = clamp((population.migrationPressure - threshold) / Math.max(1 - threshold, 0.001));
      let remaining = Math.min(
        Math.floor(population.population * MAX_MIGRATION_FRACTION_PER_TICK * pressureFactor),
        candidates.reduce((total, candidate) => total + candidate.capacity, 0),
      );

      if (remaining <= 0 && population.population >= 40) {
        remaining = 1;
      }

      const totalWeight = candidates.reduce((total, candidate) => total + Math.max(0.01, candidate.score - sourceScore), 0);

      for (const [index, candidate] of candidates.entries()) {
        if (remaining <= 0) {
          break;
        }

        const weight = Math.max(0.01, candidate.score - sourceScore) / Math.max(totalWeight, 0.01);
        const proposed = index === candidates.length - 1 ? remaining : Math.floor(remaining * weight);
        const moved = Math.min(remaining, candidate.capacity, proposed);

        if (moved <= 0) {
          continue;
        }

        const sourceKey = movementKey(cell.id, population.speciesId);
        const destinationKey = movementKey(candidate.cell.id, population.speciesId);
        const sourceDelta = deltas.get(sourceKey) ?? { inbound: 0, outbound: 0, delta: 0 };
        const destinationDelta = deltas.get(destinationKey) ?? { inbound: 0, outbound: 0, delta: 0 };

        deltas.set(sourceKey, { inbound: sourceDelta.inbound, outbound: sourceDelta.outbound + moved, delta: sourceDelta.delta - moved });
        deltas.set(destinationKey, { inbound: destinationDelta.inbound + moved, outbound: destinationDelta.outbound, delta: destinationDelta.delta + moved });
        const vector = Object.freeze({
          speciesId: population.speciesId,
          fromCellId: cell.id,
          toCellId: candidate.cell.id,
          population: moved,
          pressure: population.migrationPressure,
        });
        vectorsByCell.set(cell.id, [...(vectorsByCell.get(cell.id) ?? []), vector]);
        vectorsByCell.set(candidate.cell.id, [...(vectorsByCell.get(candidate.cell.id) ?? []), vector]);
        remaining -= moved;
      }
    }

    void sourcePopulations;
  }

  return Object.freeze(cells.map((cell) => {
    const migratedPopulations = cell.animalPopulations.map((population) => {
      const delta = deltas.get(movementKey(cell.id, population.speciesId)) ?? { inbound: 0, outbound: 0, delta: 0 };
      const adjustedPopulation = Math.max(0, Math.min(population.carryingCapacity, population.population + delta.delta));

      return Object.freeze({
        ...population,
        population: adjustedPopulation,
        inboundMigration: delta.inbound,
        outboundMigration: delta.outbound,
        netMigration: delta.delta,
        carryingCapacityUsage: population.carryingCapacity > 0 ? round(clamp(adjustedPopulation / population.carryingCapacity)) : 0,
        migrationPressure: round(clamp(population.migrationPressure + (delta.outbound > 0 ? 0.04 : 0) - (delta.inbound > 0 ? 0.02 : 0))),
        populationTrend: round(population.populationTrend + delta.delta / Math.max(population.population, 1), 4),
      });
    }).sort((left, right) => right.population - left.population || right.habitatSuitability - left.habitatSuitability || left.speciesId.localeCompare(right.speciesId));
    const movementVectors = Object.freeze((vectorsByCell.get(cell.id) ?? []).sort((left, right) => right.population - left.population || left.toCellId.localeCompare(right.toCellId)).slice(0, 8));
    const prePredationMetrics = getCellEcosystemMetrics(cell, migratedPopulations, movementVectors, definitions);
    const postPredationPopulations = applyPredationMortality(migratedPopulations, prePredationMetrics.predationPressure);
    const postPredationMetrics = getCellEcosystemMetrics(cell, postPredationPopulations, movementVectors, definitions);
    const finalPopulations = applyPlantConsumptionPressure(
      postPredationPopulations,
      postPredationMetrics.plantConsumptionRate,
      postPredationMetrics.effectivePlantBiomass,
    );

    return replaceCellPopulations(cell, finalPopulations, movementVectors, tick, definitions);
  }));
}

function buildAnimalCell(inputs: AnimalCellInputs): AnimalGridCell {
  const { plant, terrain, seed, tick } = inputs;
  const shelter = shelterAvailability(plant, terrain);
  const herbivores = herbivoreCapacity(plant);
  const prey = preyAvailability(plant, herbivores);
  const predators = predatorCapacity(plant, prey, shelter);
  const carrying = carryingCapacity(plant, herbivores, prey, predators);
  const candidate = selectDominantAnimal(inputs, { herbivores, prey, shelter });
  const densityJitter = (hashUnit(seed, `${plant.id}:density`) - 0.5) * 0.045;
  const cap = animalBiomeDensityCap(plant);
  const density = round(clamp(cap * (candidate.suitability * 0.48 + carrying * 0.34 + candidate.definition.reproductionRate * 0.08 + plant.biodiversityScore * 0.08 + densityJitter) * densityMultiplier(candidate.definition)));
  const migration = getMigrationPressure(plant, terrain, candidate.definition, carrying, seed);
  const danger = getDangerScore(candidate.definition, density, predators, plant);
  const hunting = getHuntingValue(candidate.definition, density, herbivores, prey, plant);
  const domestication = getDomesticationPotential(candidate.definition, density, herbivores, plant);
  const biodiversity = getAnimalBiodiversity(candidate.definition, density, prey, carrying, plant);
  const animalPopulations = buildAnimalPopulations(plant, { herbivores, prey, carrying }, seed, tick);
  const dominantPopulation = animalPopulations.find((population) => population.population > 0) ?? animalPopulations[0] ?? null;
  const presentPopulations = animalPopulations.filter((population) => population.population > 0);
  const totalWildlifePopulation = presentPopulations.reduce((total, population) => total + population.population, 0);

  return Object.freeze({
    ...plant,
    animalSuitabilityScore: candidate.suitability,
    dominantAnimalGuildKey: candidate.definition.key,
    dominantAnimalGuildName: candidate.definition.displayName,
    dominantAnimalGuildCategory: candidate.definition.category,
    dominantAnimalGuildColor: candidate.definition.color,
    herbivoreCapacity: herbivores,
    predatorCapacity: predators,
    preyAvailability: prey,
    animalDensity: density,
    migrationPressure: migration,
    dangerScore: danger,
    huntingValue: hunting,
    domesticationPotential: domestication,
    animalBiodiversityScore: biodiversity,
    carryingCapacityScore: carrying,
    dominantSpeciesId: dominantPopulation?.speciesId ?? "none",
    dominantSpeciesName: dominantPopulation?.speciesName ?? "No Established Wildlife",
    speciesCount: presentPopulations.length,
    totalWildlifePopulation,
    averagePopulationHealth: averagePopulationMetric(animalPopulations, (population) => population.health),
    averageHabitatSuitability: averagePopulationMetric(animalPopulations, (population) => population.habitatSuitability),
    plantConsumptionRate: 0,
    effectivePlantBiomass: plant.biomassScore,
    predationPressure: 0,
    predatorPreyBalance: 0,
    foodStability: 0,
    carryingCapacityUsage: 0,
    migrationActivity: migration,
    populationGrowthRate: getPopulationGrowthRate(animalPopulations),
    ecosystemHealthScore: 0,
    ecosystemHealthStatus: "Collapsed",
    averageFitness: averagePopulationMetric(animalPopulations, (population) => population.fitnessScore),
    adaptationDiversity: getAdaptationDiversity(animalPopulations),
    averageMigrationInstinct: averagePopulationMetric(animalPopulations, (population) => population.adaptationProfile.migrationInstinct),
    averageDiseaseResistance: averagePopulationMetric(animalPopulations, (population) => population.adaptationProfile.diseaseResistance),
    averageReproductiveEfficiency: averagePopulationMetric(animalPopulations, (population) => population.adaptationProfile.reproductiveEfficiency),
    averageClimateAdaptation: averagePopulationMetric(animalPopulations, (population) => getClimateAdaptationScore(population.adaptationProfile)),
    highestAdaptedPopulation: getHighestAdaptedPopulation(animalPopulations),
    lowestFitnessPopulation: getLowestFitnessPopulation(animalPopulations),
    ecosystemEvents: Object.freeze([]),
    ecosystemHistory: Object.freeze([]),
    movementVectors: Object.freeze([]),
    animalPopulations,
    animalTags: buildAnimalTags(candidate.definition, plant, {
      density,
      herbivores,
      predators,
      migration,
      danger,
      domestication,
    }),
  });
}

function buildAnimalDistribution(): AnimalDistribution {
  return Object.fromEntries(ANIMAL_GUILD_KEYS.map((key) => [key, 0])) as AnimalDistribution;
}

function isAnimalEligibleCell(cell: AnimalGridCell): boolean {
  return cell.animalSuitabilityScore > 0.02;
}

function makeAnimalRegion(component: readonly AnimalGridCell[], score: (cell: AnimalGridCell) => number): AnimalRegion {
  const sorted = [...component].sort((left, right) => score(right) - score(left) || left.id.localeCompare(right.id));
  const peak = sorted[0];

  return Object.freeze({
    cellId: peak.id,
    dominantAnimalGuildKey: peak.dominantAnimalGuildKey,
    dominantAnimalGuildName: peak.dominantAnimalGuildName,
    cellCount: component.length,
    averageScore: round(average(component.map(score))),
    peakScore: round(score(peak)),
    midpointLatitude: round(average(component.map((cell) => cell.midpointLatitude)), 3),
    midpointLongitude: round(average(component.map((cell) => cell.midpointLongitude)), 3),
  });
}

function findAnimalRegions(
  cells: readonly AnimalGridCell[],
  grid: SpatialGrid,
  score: (cell: AnimalGridCell) => number,
  threshold: number,
  predicate: (cell: AnimalGridCell) => boolean = () => true,
): AnimalRegion[] {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const eligible = new Set(cells.filter((cell) => predicate(cell) && score(cell) >= threshold).map((cell) => cell.id));
  const visited = new Set<string>();
  const regions: AnimalRegion[] = [];

  for (const cell of cells) {
    if (!eligible.has(cell.id) || visited.has(cell.id)) {
      continue;
    }

    const queue = [cell.id];
    const component: AnimalGridCell[] = [];
    visited.add(cell.id);

    for (let index = 0; index < queue.length; index += 1) {
      const current = byId.get(queue[index]);

      if (!current) {
        continue;
      }

      component.push(current);

      for (const neighbor of grid.getNeighbors(current.id)) {
        if (!eligible.has(neighbor.id) || visited.has(neighbor.id)) {
          continue;
        }

        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }

    regions.push(makeAnimalRegion(component, score));
  }

  return regions.sort((left, right) =>
    right.peakScore - left.peakScore
      || right.averageScore - left.averageScore
      || right.cellCount - left.cellCount
      || left.cellId.localeCompare(right.cellId),
  );
}

function civilizationFoodScore(cell: AnimalGridCell): number {
  if (["ice-sheet", "volcanic-barren"].includes(cell.biomeKey)) {
    return 0;
  }

  return round(clamp(
    cell.huntingValue * 0.42
      + cell.herbivoreCapacity * 0.18
      + cell.domesticationPotential * 0.18
      + cell.waterAvailabilityScore * 0.08
      + cell.ediblePlantScore * 0.08
      - cell.dangerScore * 0.08,
  ));
}

export function getTotalAnimalBiomassCapacity(cells: readonly AnimalGridCell[]): number {
  return round(cells.reduce((total, cell) => total + cell.carryingCapacityScore, 0), 3);
}

export function getHerbivoreRichRegions(cells: readonly AnimalGridCell[], grid: SpatialGrid = createGrid()): readonly AnimalRegion[] {
  return Object.freeze(findAnimalRegions(cells, grid, (cell) => cell.herbivoreCapacity, 0.48).slice(0, 8));
}

export function getPredatorHotspots(cells: readonly AnimalGridCell[], grid: SpatialGrid = createGrid()): readonly AnimalRegion[] {
  return Object.freeze(findAnimalRegions(cells, grid, (cell) => cell.predatorCapacity, 0.42, (cell) => cell.biomeKey !== "ocean").slice(0, 8));
}

export function getHuntingValueRegions(cells: readonly AnimalGridCell[], grid: SpatialGrid = createGrid()): readonly AnimalRegion[] {
  return Object.freeze(findAnimalRegions(cells, grid, (cell) => cell.huntingValue, 0.42).slice(0, 8));
}

export function getDomesticationCandidateRegions(cells: readonly AnimalGridCell[], grid: SpatialGrid = createGrid()): readonly AnimalRegion[] {
  return Object.freeze(findAnimalRegions(cells, grid, (cell) => cell.domesticationPotential, 0.48, (cell) => !isWaterBiome(cell)).slice(0, 8));
}

export function getMigrationCorridorCandidates(cells: readonly AnimalGridCell[], grid: SpatialGrid = createGrid()): readonly AnimalRegion[] {
  return Object.freeze(findAnimalRegions(cells, grid, (cell) => cell.migrationPressure * 0.62 + cell.animalDensity * 0.38, 0.48).slice(0, 8));
}

export function getCivilizationFoodSupportScore(cells: readonly AnimalGridCell[]): number {
  const ranked = cells
    .map(civilizationFoodScore)
    .sort((left, right) => right - left);
  const sampleSize = Math.max(1, Math.ceil(ranked.length * 0.12));

  return round(average(ranked.slice(0, sampleSize)));
}

export function getDangerMapScore(cells: readonly AnimalGridCell[]): number {
  return round(average(cells.map((cell) => cell.dangerScore)));
}

function buildAnimalSummary(cells: readonly AnimalGridCell[], grid: SpatialGrid): AnimalSummary {
  const distribution = buildAnimalDistribution();

  for (const cell of cells) {
    distribution[cell.dominantAnimalGuildKey] += 1;
  }

  const eligibleCells = cells.filter(isAnimalEligibleCell);
  const populatedCells = cells.filter((cell) => cell.animalDensity > 0.04);
  const occupiedCells = cells.filter((cell) => cell.totalWildlifePopulation > 0);
  const speciesPresent = new Set(cells.flatMap((cell) => cell.animalPopulations.filter((population) => population.population > 0).map((population) => population.speciesId)));
  const presentPopulations = cells.flatMap((cell) => cell.animalPopulations.filter((population) => population.population > 0));
  const totalWildlifePopulation = cells.reduce((total, cell) => total + cell.totalWildlifePopulation, 0);

  return Object.freeze({
    cellCount: cells.length,
    animalEligibleCellCount: eligibleCells.length,
    populatedCellCount: populatedCells.length,
    dominantAnimalDistribution: Object.freeze(distribution),
    totalAnimalBiomassCapacity: getTotalAnimalBiomassCapacity(cells),
    averageAnimalDensity: round(average(eligibleCells.map((cell) => cell.animalDensity))),
    averageHerbivoreCapacity: round(average(eligibleCells.map((cell) => cell.herbivoreCapacity))),
    averagePredatorCapacity: round(average(eligibleCells.map((cell) => cell.predatorCapacity))),
    averagePreyAvailability: round(average(eligibleCells.map((cell) => cell.preyAvailability))),
    averageMigrationPressure: round(average(eligibleCells.map((cell) => cell.migrationPressure))),
    averageDangerScore: round(average(eligibleCells.map((cell) => cell.dangerScore))),
    huntingValueScore: round(average(eligibleCells.map((cell) => cell.huntingValue))),
    domesticationCandidateScore: round(average(eligibleCells.map((cell) => cell.domesticationPotential))),
    biodiversityScore: round(average(eligibleCells.map((cell) => cell.animalBiodiversityScore))),
    civilizationFoodSupportScore: getCivilizationFoodSupportScore(cells),
    dangerMapScore: getDangerMapScore(cells),
    animalSpeciesCount: speciesPresent.size,
    occupiedHabitatPercent: round(occupiedCells.length / Math.max(cells.length, 1), 4),
    totalWildlifePopulation,
    averageHabitatSuitability: round(average(presentPopulations.map((population) => population.habitatSuitability))),
    averageHealth: round(average(presentPopulations.map((population) => population.health))),
    averageEcosystemHealth: round(average(cells.map((cell) => cell.ecosystemHealthScore))),
    averageBiodiversity: round(average(cells.map((cell) => Math.max(cell.biodiversityScore, cell.animalBiodiversityScore)))),
    migrationActivity: round(average(cells.map((cell) => cell.migrationActivity))),
    foodStability: round(average(cells.map((cell) => cell.foodStability))),
    predatorBalance: round(average(cells.map((cell) => cell.predatorPreyBalance))),
    collapsedHabitats: cells.filter((cell) => cell.ecosystemHealthStatus === "Collapsed" || cell.ecosystemHealthStatus === "Collapsing").length,
    populationGrowthRate: round(average(cells.map((cell) => cell.populationGrowthRate)), 4),
    plantConsumptionRate: round(average(cells.map((cell) => cell.plantConsumptionRate))),
    averageFitness: round(average(presentPopulations.map((population) => population.fitnessScore))),
    averageAdaptationDiversity: round(average(cells.map((cell) => cell.adaptationDiversity))),
    highestAdaptedPopulation: getHighestAdaptedPopulation(presentPopulations),
    lowestFitnessPopulation: getLowestFitnessPopulation(presentPopulations),
    averageMigrationInstinct: round(average(presentPopulations.map((population) => population.adaptationProfile.migrationInstinct))),
    averageDiseaseResistance: round(average(presentPopulations.map((population) => population.adaptationProfile.diseaseResistance))),
    averageReproductiveEfficiency: round(average(presentPopulations.map((population) => population.adaptationProfile.reproductiveEfficiency))),
    averageClimateAdaptation: round(average(presentPopulations.map((population) => getClimateAdaptationScore(population.adaptationProfile)))),
    herbivoreRichRegions: getHerbivoreRichRegions(cells, grid),
    predatorHotspots: getPredatorHotspots(cells, grid),
    huntingValueRegions: getHuntingValueRegions(cells, grid),
    domesticationCandidateRegions: getDomesticationCandidateRegions(cells, grid),
    migrationCorridorCandidates: getMigrationCorridorCandidates(cells, grid),
    biodiversityHotspots: Object.freeze(findAnimalRegions(cells, grid, (cell) => cell.animalBiodiversityScore, 0.62).slice(0, 8)),
    highestDangerZones: Object.freeze(findAnimalRegions(cells, grid, (cell) => cell.dangerScore, 0.42).slice(0, 8)),
  });
}

export function getAnimalEcologyStateAtTick(
  world: AnimalWorldSource,
  tickInput: TickInput,
  grid: SpatialGrid = createGrid(),
): AnimalEcologyState {
  const tick = normalizeTick(tickInput);

  return getCachedDeterministic("animal-state", world, grid, () => {
    const seed = requireAnimalSeed(world);
    const plantState = getPlantEcologyStateAtTick(world, tick, grid);
    const terrainState = getTerrainState(world, grid);
    const terrainById = new Map(terrainState.cells.map((cell) => [cell.id, cell]));
    const baseCells = Object.freeze(plantState.cells.map((plant) => {
      const terrain = terrainById.get(plant.id);

      if (!terrain) {
        throw new Error(`Animal ecology dependencies missing for cell: ${plant.id}`);
      }

      return buildAnimalCell({ plant, terrain, seed, tick });
    }));

    const cells = applyEcosystemDynamics(baseCells, grid, seed, tick);

    return Object.freeze({
      seed,
      tick: tick.toString(),
      cells,
      summary: buildAnimalSummary(cells, grid),
    });
  }, tick.toString());
}

export function getAnimalEcologyState(world: AnimalWorldSource, grid: SpatialGrid = createGrid()): AnimalEcologyState {
  return getAnimalEcologyStateAtTick(world, world.currentTick, grid);
}

export function getAnimalEcologySummary(world: AnimalWorldSource, grid: SpatialGrid = createGrid()): AnimalSummary {
  return getAnimalEcologyState(world, grid).summary;
}

export function getAnimalEcologyDefinitions(): readonly AnimalGuildDefinition[] {
  return getAnimalGuildDefinitions();
}

export function getAnimalPopulationDefinitions(): readonly AnimalSpeciesDefinition[] {
  return getAnimalSpeciesDefinitions();
}

function animalCellPersistencePayload(cell: AnimalGridCell): {
  dominantAnimalGuildKey: string;
  dominantAnimalGuildName: string;
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
  dominantSpeciesId: string;
  dominantSpeciesName: string;
  animalSpeciesCount: number;
  totalWildlifePopulation: number;
  averageAnimalHealth: number;
  averageHabitatSuitability: number;
  plantConsumptionRate: number;
  effectivePlantBiomass: number;
  predationPressure: number;
  predatorPreyBalance: number;
  foodStability: number;
  carryingCapacityUsage: number;
  migrationActivity: number;
  populationGrowthRate: number;
  averageFitness: number;
  adaptationDiversity: number;
  averageMigrationInstinct: number;
  averageDiseaseResistance: number;
  averageReproductiveEfficiency: number;
  averageClimateAdaptation: number;
  highestAdaptedPopulation: Prisma.JsonValue;
  lowestFitnessPopulation: Prisma.JsonValue;
  ecosystemHealthScore: number;
  ecosystemHealthStatus: string;
  ecosystemEvents: Prisma.InputJsonValue;
  ecosystemHistory: Prisma.InputJsonValue;
  movementVectors: Prisma.InputJsonValue;
  animalTags: Prisma.InputJsonValue;
} {
  return {
    dominantAnimalGuildKey: cell.dominantAnimalGuildKey,
    dominantAnimalGuildName: cell.dominantAnimalGuildName,
    animalSuitabilityScore: cell.animalSuitabilityScore,
    herbivoreCapacity: cell.herbivoreCapacity,
    predatorCapacity: cell.predatorCapacity,
    preyAvailability: cell.preyAvailability,
    animalDensity: cell.animalDensity,
    migrationPressure: cell.migrationPressure,
    dangerScore: cell.dangerScore,
    huntingValue: cell.huntingValue,
    domesticationPotential: cell.domesticationPotential,
    animalBiodiversityScore: cell.animalBiodiversityScore,
    carryingCapacityScore: cell.carryingCapacityScore,
    dominantSpeciesId: cell.dominantSpeciesId,
    dominantSpeciesName: cell.dominantSpeciesName,
    animalSpeciesCount: cell.speciesCount,
    totalWildlifePopulation: cell.totalWildlifePopulation,
    averageAnimalHealth: cell.averagePopulationHealth,
    averageHabitatSuitability: cell.averageHabitatSuitability,
    plantConsumptionRate: cell.plantConsumptionRate,
    effectivePlantBiomass: cell.effectivePlantBiomass,
    predationPressure: cell.predationPressure,
    predatorPreyBalance: cell.predatorPreyBalance,
    foodStability: cell.foodStability,
    carryingCapacityUsage: cell.carryingCapacityUsage,
    migrationActivity: cell.migrationActivity,
    populationGrowthRate: cell.populationGrowthRate,
    averageFitness: cell.averageFitness,
    adaptationDiversity: cell.adaptationDiversity,
    averageMigrationInstinct: cell.averageMigrationInstinct,
    averageDiseaseResistance: cell.averageDiseaseResistance,
    averageReproductiveEfficiency: cell.averageReproductiveEfficiency,
    averageClimateAdaptation: cell.averageClimateAdaptation,
    highestAdaptedPopulation: cell.highestAdaptedPopulation ? { ...cell.highestAdaptedPopulation } : null,
    lowestFitnessPopulation: cell.lowestFitnessPopulation ? { ...cell.lowestFitnessPopulation } : null,
    ecosystemHealthScore: cell.ecosystemHealthScore,
    ecosystemHealthStatus: cell.ecosystemHealthStatus,
    ecosystemEvents: [...cell.ecosystemEvents],
    ecosystemHistory: [...cell.ecosystemHistory],
    movementVectors: [...cell.movementVectors],
    animalTags: [...cell.animalTags],
  };
}

function samePersistedAnimalCell(
  existing: Awaited<ReturnType<AnimalPersistenceClient["planetCell"]["findMany"]>>[number],
  payload: ReturnType<typeof animalCellPersistencePayload>,
): boolean {
  const animalExisting = existing as typeof existing & PersistedAnimalCellExtras;

  return existing.animalGeneratedAt !== null
    && existing.animalUpdatedAt !== null
    && existing.dominantAnimalGuildKey === payload.dominantAnimalGuildKey
    && existing.dominantAnimalGuildName === payload.dominantAnimalGuildName
    && existing.animalSuitabilityScore === payload.animalSuitabilityScore
    && existing.herbivoreCapacity === payload.herbivoreCapacity
    && existing.predatorCapacity === payload.predatorCapacity
    && existing.preyAvailability === payload.preyAvailability
    && existing.animalDensity === payload.animalDensity
    && existing.migrationPressure === payload.migrationPressure
    && existing.dangerScore === payload.dangerScore
    && existing.huntingValue === payload.huntingValue
    && existing.domesticationPotential === payload.domesticationPotential
    && existing.animalBiodiversityScore === payload.animalBiodiversityScore
    && existing.carryingCapacityScore === payload.carryingCapacityScore
    && animalExisting.dominantSpeciesId === payload.dominantSpeciesId
    && animalExisting.dominantSpeciesName === payload.dominantSpeciesName
    && animalExisting.animalSpeciesCount === payload.animalSpeciesCount
    && animalExisting.totalWildlifePopulation === payload.totalWildlifePopulation
    && animalExisting.averageAnimalHealth === payload.averageAnimalHealth
    && animalExisting.averageHabitatSuitability === payload.averageHabitatSuitability
    && (!("ecosystemHealthScore" in animalExisting) || (
      animalExisting.plantConsumptionRate === payload.plantConsumptionRate
      && animalExisting.effectivePlantBiomass === payload.effectivePlantBiomass
      && animalExisting.predationPressure === payload.predationPressure
      && animalExisting.predatorPreyBalance === payload.predatorPreyBalance
      && animalExisting.foodStability === payload.foodStability
      && animalExisting.carryingCapacityUsage === payload.carryingCapacityUsage
      && animalExisting.migrationActivity === payload.migrationActivity
      && animalExisting.populationGrowthRate === payload.populationGrowthRate
      && (!("averageFitness" in animalExisting) || (
        animalExisting.averageFitness === payload.averageFitness
        && animalExisting.adaptationDiversity === payload.adaptationDiversity
        && animalExisting.averageMigrationInstinct === payload.averageMigrationInstinct
        && animalExisting.averageDiseaseResistance === payload.averageDiseaseResistance
        && animalExisting.averageReproductiveEfficiency === payload.averageReproductiveEfficiency
        && animalExisting.averageClimateAdaptation === payload.averageClimateAdaptation
        && JSON.stringify(animalExisting.highestAdaptedPopulation) === JSON.stringify(payload.highestAdaptedPopulation)
        && JSON.stringify(animalExisting.lowestFitnessPopulation) === JSON.stringify(payload.lowestFitnessPopulation)
      ))
      && animalExisting.ecosystemHealthScore === payload.ecosystemHealthScore
      && animalExisting.ecosystemHealthStatus === payload.ecosystemHealthStatus
      && JSON.stringify(animalExisting.ecosystemEvents) === JSON.stringify(payload.ecosystemEvents)
      && JSON.stringify(animalExisting.ecosystemHistory) === JSON.stringify(payload.ecosystemHistory)
      && JSON.stringify(animalExisting.movementVectors) === JSON.stringify(payload.movementVectors)
    ))
    && JSON.stringify(existing.animalTags) === JSON.stringify(payload.animalTags);
}


function splitAnimalCellPersistencePayload(payload: ReturnType<typeof animalCellPersistencePayload>) {
  const {
    dominantSpeciesId,
    dominantSpeciesName,
    animalSpeciesCount,
    totalWildlifePopulation,
    averageAnimalHealth,
    averageHabitatSuitability,
    plantConsumptionRate,
    effectivePlantBiomass,
    predationPressure,
    predatorPreyBalance,
    foodStability,
    carryingCapacityUsage,
    migrationActivity,
    populationGrowthRate,
    averageFitness,
    adaptationDiversity,
    averageMigrationInstinct,
    averageDiseaseResistance,
    averageReproductiveEfficiency,
    averageClimateAdaptation,
    highestAdaptedPopulation,
    lowestFitnessPopulation,
    ecosystemHealthScore,
    ecosystemHealthStatus,
    ecosystemEvents,
    ecosystemHistory,
    movementVectors,
    ...planetCellPayload
  } = payload;

  return {
    planetCellPayload,
    speciesPayload: {
      dominantSpeciesId,
      dominantSpeciesName,
      animalSpeciesCount,
      totalWildlifePopulation,
      averageAnimalHealth,
      averageHabitatSuitability,
      plantConsumptionRate,
      effectivePlantBiomass,
      predationPressure,
      predatorPreyBalance,
      foodStability,
      carryingCapacityUsage,
      migrationActivity,
      populationGrowthRate,
      averageFitness,
      adaptationDiversity,
      averageMigrationInstinct,
      averageDiseaseResistance,
      averageReproductiveEfficiency,
      averageClimateAdaptation,
      highestAdaptedPopulation,
      lowestFitnessPopulation,
      ecosystemHealthScore,
      ecosystemHealthStatus,
      ecosystemEvents,
      ecosystemHistory,
      movementVectors,
    },
  };
}

type SchemaColumnProbe = { exists: boolean };

async function supportsAnimalSpeciesAggregateColumns(client: AnimalPersistenceClient): Promise<boolean> {
  if (!client.$queryRaw) {
    return false;
  }

  const rows = await client.$queryRaw<SchemaColumnProbe[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlanetCell'
        AND column_name = 'dominantSpeciesId'
    ) AS exists
  `;

  return Boolean(rows[0]?.exists);
}

async function supportsEcosystemDynamicsColumns(client: AnimalPersistenceClient): Promise<boolean> {
  if (!client.$queryRaw) {
    return false;
  }

  const rows = await client.$queryRaw<SchemaColumnProbe[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlanetCell'
        AND column_name = 'ecosystemHealthScore'
    ) AS exists
  `;

  return Boolean(rows[0]?.exists);
}

async function supportsPopulationAdaptationColumns(client: AnimalPersistenceClient): Promise<boolean> {
  if (!client.$queryRaw) {
    return false;
  }

  const rows = await client.$queryRaw<SchemaColumnProbe[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlanetCell'
        AND column_name = 'averageFitness'
    ) AS exists
  `;

  return Boolean(rows[0]?.exists);
}

async function persistAnimalCellSpeciesAggregates(
  client: AnimalPersistenceClient,
  planetCellId: string,
  payload: ReturnType<typeof splitAnimalCellPersistencePayload>["speciesPayload"],
  supportsSpeciesAggregates: boolean,
  supportsEcosystemDynamics: boolean,
  supportsPopulationAdaptation: boolean,
): Promise<void> {
  if (!client.$executeRaw || !supportsSpeciesAggregates) {
    return;
  }

  await client.$executeRaw`
    UPDATE "PlanetCell"
    SET
      "dominantSpeciesId" = ${payload.dominantSpeciesId},
      "dominantSpeciesName" = ${payload.dominantSpeciesName},
      "animalSpeciesCount" = ${payload.animalSpeciesCount},
      "totalWildlifePopulation" = ${payload.totalWildlifePopulation},
      "averageAnimalHealth" = ${payload.averageAnimalHealth},
      "averageHabitatSuitability" = ${payload.averageHabitatSuitability}
    WHERE "id" = ${planetCellId}
  `;

  if (!supportsEcosystemDynamics) {
    return;
  }

await client.$executeRaw`
  UPDATE "PlanetCell"
  SET
    "plantConsumptionRate" = ${payload.plantConsumptionRate},
    "effectivePlantBiomass" = ${payload.effectivePlantBiomass},
    "predationPressure" = ${payload.predationPressure},
    "predatorPreyBalance" = ${payload.predatorPreyBalance},
    "foodStability" = ${payload.foodStability},
    "carryingCapacityUsage" = ${payload.carryingCapacityUsage},
    "migrationActivity" = ${payload.migrationActivity},
    "populationGrowthRate" = ${payload.populationGrowthRate},
    "ecosystemHealthScore" = ${payload.ecosystemHealthScore},
    "ecosystemHealthStatus" = ${payload.ecosystemHealthStatus},
    "ecosystemEvents" = ${JSON.stringify(payload.ecosystemEvents)}::jsonb,
    "ecosystemHistory" = ${JSON.stringify(payload.ecosystemHistory)}::jsonb,
    "movementVectors" = ${JSON.stringify(payload.movementVectors)}::jsonb
  WHERE "id" = ${planetCellId}
`;

  if (!supportsPopulationAdaptation) {
    return;
  }

  await client.$executeRaw`
    UPDATE "PlanetCell"
    SET
      "averageFitness" = ${payload.averageFitness},
      "adaptationDiversity" = ${payload.adaptationDiversity},
      "averageMigrationInstinct" = ${payload.averageMigrationInstinct},
      "averageDiseaseResistance" = ${payload.averageDiseaseResistance},
      "averageReproductiveEfficiency" = ${payload.averageReproductiveEfficiency},
      "averageClimateAdaptation" = ${payload.averageClimateAdaptation},
     "highestAdaptedPopulation" = ${JSON.stringify(payload.highestAdaptedPopulation ?? null)}::jsonb,
"lowestFitnessPopulation" = ${JSON.stringify(payload.lowestFitnessPopulation ?? null)}::jsonb
    WHERE "id" = ${planetCellId}
  `;
}

export async function persistAnimalEcologyState(
  world: AnimalWorldSource,
  client: AnimalPersistenceClient,
  tick: TickInput = world.currentTick,
  grid: SpatialGrid = createGrid(),
): Promise<PersistAnimalEcologyResult> {
  const planet = await client.planet.findUnique({
    where: { worldId: world.id },
    select: { id: true },
  });

  if (!planet) {
    throw new Error(`Animal ecology persistence requires a planet for world: ${world.id}`);
  }

  const state = getAnimalEcologyStateAtTick(world, tick, grid);
  const existingCells = await client.planetCell.findMany({ where: { planetId: planet.id } });
  const existingByCellId = new Map(existingCells.map((cell) => [cell.cellId, cell]));
  const missingPlantCells = state.cells.filter((cell) => {
    const existing = existingByCellId.get(cell.id);

    return !existing || existing.plantGeneratedAt === null || existing.plantUpdatedAt === null;
  });

  if (missingPlantCells.length > 0) {
    throw new Error(`Animal ecology generation requires persisted plant ecology. Run Plant Ecology first. Missing or stale cell: ${missingPlantCells[0].id}`);
  }

  let updatedCells = 0;
  let unchangedCells = 0;
  const now = new Date();
  const supportsSpeciesAggregates = await supportsAnimalSpeciesAggregateColumns(client);
  const supportsEcosystemDynamics = await supportsEcosystemDynamicsColumns(client);
  const supportsPopulationAdaptation = await supportsPopulationAdaptationColumns(client);
  const populationRows: AnimalPopulationPersistencePayload[] = [];

  for (const cell of state.cells) {
    const payload = animalCellPersistencePayload(cell);
    const existing = existingByCellId.get(cell.id);

    if (!existing) {
      continue;
    }

    for (const population of cell.animalPopulations.filter((entry) => entry.population > 0)) {
      populationRows.push({
        planetCellId: existing.id,
        speciesId: population.speciesId,
        population: population.population,
        health: population.health,
        foodAvailability: population.foodAvailability,
        migrationPressure: population.migrationPressure,
        habitatSuitability: population.habitatSuitability,
        carryingCapacity: population.carryingCapacity,
        predationPressure: population.predationPressure,
        competitionPressure: population.competitionPressure,
        carryingCapacityUsage: population.carryingCapacityUsage,
        inboundMigration: population.inboundMigration,
        outboundMigration: population.outboundMigration,
        netMigration: population.netMigration,
        populationTrend: population.populationTrend,
        fitnessScore: population.fitnessScore,
        adaptationProfile: { ...population.adaptationProfile },
        adaptationTrends: [...population.adaptationTrends],
        lastUpdatedTick: normalizeTick(population.lastUpdatedTick),
      });
    }

    if (samePersistedAnimalCell(existing, payload)) {
      unchangedCells += 1;
      continue;
    }

    const { planetCellPayload, speciesPayload } = splitAnimalCellPersistencePayload(payload);

    await client.planetCell.update({
      where: { planetId_cellId: { planetId: planet.id, cellId: cell.id } },
      data: {
        ...planetCellPayload,
        animalGeneratedAt: existing.animalGeneratedAt ?? now,
        animalUpdatedAt: now,
      },
    });
    await persistAnimalCellSpeciesAggregates(client, existing.id, speciesPayload, supportsSpeciesAggregates, supportsEcosystemDynamics, supportsPopulationAdaptation);
    updatedCells += 1;
  }

  if (client.animalPopulation) {
    await client.animalPopulation.deleteMany({
      where: { planetCellId: { in: existingCells.map((cell) => cell.id) } },
    });

    if (populationRows.length > 0) {
      await client.animalPopulation.createMany({
        data: populationRows,
        skipDuplicates: true,
      });
    }
  }

  return Object.freeze({
    planetId: planet.id,
    generatedCells: state.cells.length,
    updatedCells,
    unchangedCells,
    summary: state.summary,
  });
}

export { getAnimalGuildDefinition };
