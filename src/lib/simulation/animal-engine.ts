import { Prisma, type World } from "@prisma/client";

import type { BiomeKey } from "./biome-definitions";
import { createGrid, type SpatialGrid } from "./grid/grid";
import { getPlantEcologyStateAtTick, type PlantGridCell } from "./plant-engine";
import { getTerrainState, type TerrainGridCell } from "./terrain-engine";
import {
  ANIMAL_GUILD_DEFINITIONS,
  ANIMAL_GUILD_KEYS,
  getAnimalGuildDefinition,
  getAnimalGuildDefinitions,
  type AnimalGuildDefinition,
  type AnimalGuildKey,
} from "./animal-definitions";

export type DominantAnimalGuildKey = AnimalGuildKey;

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

type AnimalWorldSource = Pick<
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

type AnimalPersistenceClient = Pick<Prisma.TransactionClient, "planet" | "planetCell">;

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
};

const UINT32_RANGE = 4_294_967_296;
const MARINE_BIOMES = new Set<BiomeKey>(["ocean", "coast", "lake"]);
const AQUATIC_GUILDS = new Set<AnimalGuildKey>(["aquatic-microfauna", "fish"]);
const HERBIVORE_GUILDS = new Set<AnimalGuildKey>(["small-herbivores", "large-herbivores", "browsers", "grazers"]);
const PREDATOR_GUILDS = new Set<AnimalGuildKey>(["small-predators", "apex-predators", "reptiles"]);
const LOW_DENSITY_BIOMES = new Set<BiomeKey>(["ice-sheet", "volcanic-barren", "badlands-rocky", "alpine-mountain", "desert"]);

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
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

function buildAnimalCell(inputs: AnimalCellInputs): AnimalGridCell {
  const { plant, terrain, seed } = inputs;
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
  const seed = requireAnimalSeed(world);
  const tick = normalizeTick(tickInput);
  const plantState = getPlantEcologyStateAtTick(world, tick, grid);
  const terrainState = getTerrainState(world, grid);
  const terrainById = new Map(terrainState.cells.map((cell) => [cell.id, cell]));
  const cells = Object.freeze(plantState.cells.map((plant) => {
    const terrain = terrainById.get(plant.id);

    if (!terrain) {
      throw new Error(`Animal ecology dependencies missing for cell: ${plant.id}`);
    }

    return buildAnimalCell({ plant, terrain, seed });
  }));

  return Object.freeze({
    seed,
    tick: tick.toString(),
    cells,
    summary: buildAnimalSummary(cells, grid),
  });
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
    animalTags: [...cell.animalTags],
  };
}

function samePersistedAnimalCell(
  existing: Awaited<ReturnType<AnimalPersistenceClient["planetCell"]["findMany"]>>[number],
  payload: ReturnType<typeof animalCellPersistencePayload>,
): boolean {
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
    && JSON.stringify(existing.animalTags) === JSON.stringify(payload.animalTags);
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

  for (const cell of state.cells) {
    const payload = animalCellPersistencePayload(cell);
    const existing = existingByCellId.get(cell.id);

    if (!existing) {
      continue;
    }

    if (samePersistedAnimalCell(existing, payload)) {
      unchangedCells += 1;
      continue;
    }

    await client.planetCell.update({
      where: { planetId_cellId: { planetId: planet.id, cellId: cell.id } },
      data: {
        ...payload,
        animalGeneratedAt: existing.animalGeneratedAt ?? now,
        animalUpdatedAt: now,
      },
    });
    updatedCells += 1;
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
