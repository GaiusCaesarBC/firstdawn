import { Prisma, type World } from "@prisma/client";

import type { BiomeGridCell } from "./biome-engine";
import { getBiomeStateAtTick } from "./biome-engine";
import type { BiomeKey } from "./biome-definitions";
import { getCachedDeterministic } from "./deterministic-cache";
import type { SpatialGrid } from "./grid/grid";
import { createGrid } from "./grid/grid";
import { getPlanetResourcesStateAtTick, type PlanetResourceGridCell } from "./resources-engine";
import {
  PLANT_DEFINITIONS,
  PLANT_KEYS,
  getPlantDefinition,
  getPlantDefinitions,
  type PlantDefinition,
  type PlantKey,
} from "./plant-definitions";

export type DominantPlantKey = PlantKey | "none";

export type PlantGridCell = BiomeGridCell & {
  readonly plantSuitabilityScore: number;
  readonly dominantPlantKey: DominantPlantKey;
  readonly dominantPlantName: string;
  readonly dominantPlantCategory: PlantDefinition["category"] | "none";
  readonly dominantPlantColor: string;
  readonly plantDensity: number;
  readonly biomassScore: number;
  readonly ediblePlantScore: number;
  readonly woodMaterialScore: number;
  readonly medicinalPotentialScore: number;
  readonly biodiversityScore: number;
  readonly regrowthRate: number;
  readonly seasonalStressScore: number;
  readonly plantTags: readonly string[];
};

export type PlantDistribution = Record<DominantPlantKey, number>;

export type PlantRegion = {
  readonly cellId: string;
  readonly dominantPlantKey: DominantPlantKey;
  readonly dominantPlantName: string;
  readonly cellCount: number;
  readonly averageScore: number;
  readonly peakScore: number;
  readonly midpointLatitude: number;
  readonly midpointLongitude: number;
};

export type PlantSummary = {
  readonly cellCount: number;
  readonly plantEligibleCellCount: number;
  readonly plantedCellCount: number;
  readonly dominantPlantDistribution: PlantDistribution;
  readonly totalBiomass: number;
  readonly averagePlantDensity: number;
  readonly ediblePlantCoverage: number;
  readonly timberMaterialCoverage: number;
  readonly biodiversityScore: number;
  readonly civilizationStartingZoneSupportScore: number;
  readonly animalCarryingCapacityFoundationScore: number;
  readonly bestForagingZones: readonly PlantRegion[];
  readonly bestTimberMaterialZones: readonly PlantRegion[];
  readonly biodiversityHotspots: readonly PlantRegion[];
  readonly harshestLowPlantZones: readonly PlantRegion[];
  readonly lowResourceDeadZones: readonly PlantRegion[];
};

export type PlantEcologyState = {
  readonly seed: string;
  readonly tick: string;
  readonly cells: readonly PlantGridCell[];
  readonly summary: PlantSummary;
};

export type PersistPlantEcologyResult = {
  readonly planetId: string;
  readonly generatedCells: number;
  readonly updatedCells: number;
  readonly unchangedCells: number;
  readonly summary: PlantSummary;
};

type TickInput = bigint | number | string;

type PlantWorldSource = Pick<
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

type PlantPersistenceClient = Pick<Prisma.TransactionClient, "planet" | "planetCell">;

type PlantCandidate = {
  readonly definition: PlantDefinition;
  readonly suitability: number;
  readonly temperatureFit: number;
  readonly precipitationFit: number;
  readonly waterFit: number;
  readonly fertilityFit: number;
  readonly elevationFit: number;
};

const UINT32_RANGE = 4_294_967_296;
const NONE_PLANT_NAME = "No Established Plant Life";
const NONE_PLANT_COLOR = "#2f302c";
const MARINE_BIOMES = new Set<BiomeKey>(["ocean", "coast", "lake"]);
const LOW_PLANT_BIOMES = new Set<BiomeKey>(["ice-sheet", "volcanic-barren", "badlands-rocky", "alpine-mountain", "desert"]);
const FOREST_PLANTS = new Set<PlantKey>(["temperate-trees", "boreal-trees", "tropical-trees"]);

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
  return hashStringToUint32(`${seed}:plants:${key}`) / UINT32_RANGE;
}

function requirePlantSeed(world: PlantWorldSource): string {
  const seed = world.seed?.trim();

  if (!seed) {
    throw new Error("Plant ecology generation requires a world seed.");
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

function biomePreferenceScore(definition: PlantDefinition, biome: BiomeGridCell): number {
  if (definition.biomePreferences.includes(biome.biomeKey)) {
    return 1;
  }

  if (definition.category === "aquatic" && ["marine", "freshwater", "wetland"].includes(biome.biomeCategory)) {
    return 0.62;
  }

  if (definition.category === "forest" && biome.biomeTags.includes("forest")) {
    return 0.58;
  }

  if (definition.key === "grasses" && includesAny(biome.biomeTags, ["grass", "grazing", "settlement"])) {
    return 0.72;
  }

  if (definition.key === "shrubs" && includesAny(biome.biomeTags, ["shrub", "seasonal", "transition", "dry"])) {
    return 0.66;
  }

  if (definition.key === "desert-plants" && ["dryland", "barren"].includes(biome.biomeCategory)) {
    return 0.64;
  }

  if (definition.key === "alpine-plants" && ["mountain", "polar"].includes(biome.biomeCategory)) {
    return 0.62;
  }

  if (definition.key === "moss-lichen" && ["polar", "mountain", "barren", "forest"].includes(biome.biomeCategory)) {
    return 0.54;
  }

  if (definition.key === "fungal-decomposers" && includesAny(biome.biomeTags, ["forest", "wetland", "fertile", "dense"])) {
    return 0.5;
  }

  return 0.06;
}

function plantBiomeDensityCap(biome: BiomeGridCell): number {
  switch (biome.biomeKey) {
    case "ocean":
      return 0.14;
    case "coast":
      return 0.54;
    case "lake":
      return 0.62;
    case "river-wetland":
      return 0.82;
    case "swamp-marsh":
      return 0.92;
    case "ice-sheet":
      return 0.03;
    case "volcanic-barren":
      return 0.08;
    case "badlands-rocky":
      return 0.18;
    case "desert":
      return 0.14;
    case "alpine-mountain":
      return 0.22;
    case "tundra":
      return 0.28;
    case "boreal-forest":
      return 0.68;
    case "temperate-forest":
      return 0.9;
    case "temperate-grassland":
      return 0.74;
    case "mediterranean-shrubland":
      return 0.5;
    case "savanna":
      return 0.64;
    case "tropical-seasonal-forest":
      return 0.88;
    case "tropical-rainforest":
      return 1;
    default:
      return 0.5;
  }
}

function ecologicalPenalty(definition: PlantDefinition, biome: BiomeGridCell, resources: PlanetResourceGridCell): number {
  const volcanicPenalty = resources.volcanicInfluence >= 0.72 && definition.key !== "moss-lichen" ? 0.12 : 0;
  const erosionPenalty = resources.erosionPotential >= 0.68 && !["moss-lichen", "alpine-plants", "desert-plants"].includes(definition.key) ? 0.08 : 0;
  const saltPenalty = biome.biomeKey === "coast" && !["aquatic-algae", "reeds-wetland", "grasses", "shrubs"].includes(definition.key) ? 0.12 : 0;
  const marinePenalty = biome.biomeKey === "ocean" && definition.key !== "aquatic-algae" ? 0.82 : 0;

  return clamp(volcanicPenalty + erosionPenalty + saltPenalty + marinePenalty);
}

function scorePlantCandidate(
  definition: PlantDefinition,
  biome: BiomeGridCell,
  resources: PlanetResourceGridCell,
): PlantCandidate {
  const preference = biomePreferenceScore(definition, biome);
  const temperatureFit = rangeFit(definition.key === "aquatic-algae" ? Math.max(-2, biome.adjustedTemperatureC) : biome.adjustedTemperatureC, definition.temperatureRangeC, 18);
  const precipitationFit = rangeFit(biome.precipitationScore, definition.precipitationRange, 0.28);
  const waterFit = requirementFit(Math.max(biome.waterAvailabilityScore, resources.waterResources.freshwaterAvailability), definition.waterRequirement);
  const fertilityFit = requirementFit(Math.max(biome.fertilityScore, resources.industrialMaterials.clay * 0.5), definition.fertilityRequirement);
  const elevationFit = rangeFit(biome.elevation, definition.elevationTolerance, 0.2);
  const resilienceBuffer = definition.resilienceScore * 0.08;
  const wetlandBonus = biome.biomeCategory === "wetland" && definition.category === "wetland" ? 0.2 : 0;
  const aquaticBonus = ["lake", "coast", "river-wetland"].includes(biome.biomeKey) && definition.category === "aquatic" ? 0.1 : 0;
  const grasslandBonus = biome.biomeCategory === "grassland" && definition.key === "grasses" ? 0.08 : 0;
  const canopyBonus = (
    (biome.biomeKey === "tropical-rainforest" && definition.key === "tropical-trees")
    || (biome.biomeKey === "tropical-seasonal-forest" && definition.key === "tropical-trees")
    || (biome.biomeKey === "temperate-forest" && definition.key === "temperate-trees")
    || (biome.biomeKey === "boreal-forest" && definition.key === "boreal-trees")
  ) ? 0.16 : 0;
  const wetlandForestPenalty = biome.biomeCategory === "wetland" && definition.category === "forest" ? 0.08 : 0;
  const decomposerDominancePenalty = definition.category === "decomposer" ? 0.1 : 0;
  const penalty = ecologicalPenalty(definition, biome, resources);
  const suitability = round(clamp(
    preference * 0.34
      + temperatureFit * 0.15
      + precipitationFit * 0.13
      + waterFit * 0.14
      + fertilityFit * 0.1
      + elevationFit * 0.08
      + definition.spreadRate * 0.04
      + resilienceBuffer
      + wetlandBonus
      + aquaticBonus
      + grasslandBonus
      + canopyBonus
      - wetlandForestPenalty
      - decomposerDominancePenalty
      - penalty,
  ));

  return Object.freeze({
    definition,
    suitability,
    temperatureFit,
    precipitationFit,
    waterFit,
    fertilityFit,
    elevationFit,
  });
}

function selectDominantPlant(
  biome: BiomeGridCell,
  resources: PlanetResourceGridCell,
  seed: string,
): PlantCandidate | null {
  const candidates = PLANT_KEYS.map((key) => scorePlantCandidate(PLANT_DEFINITIONS[key], biome, resources));
  const sorted = candidates.sort((left, right) => {
    const leftJitter = hashUnit(seed, `${biome.id}:${left.definition.key}:dominance`) * 0.018;
    const rightJitter = hashUnit(seed, `${biome.id}:${right.definition.key}:dominance`) * 0.018;

    return (right.suitability + rightJitter) - (left.suitability + leftJitter)
      || right.definition.biodiversityValue - left.definition.biodiversityValue
      || left.definition.key.localeCompare(right.definition.key);
  });
  const winner = sorted[0];

  if (!winner || (plantBiomeDensityCap(biome) <= 0.04 && winner.suitability < 0.26)) {
    return null;
  }

  if (winner.suitability < 0.12) {
    return null;
  }

  return winner;
}

function seasonalStress(candidate: PlantCandidate | null, biome: BiomeGridCell, resources: PlanetResourceGridCell, seed: string): number {
  if (!candidate) {
    return 1;
  }

  const temperatureStress = 1 - candidate.temperatureFit;
  const precipitationStress = 1 - candidate.precipitationFit;
  const waterStress = clamp(candidate.definition.waterRequirement - Math.max(biome.waterAvailabilityScore, resources.waterResources.freshwaterAvailability));
  const biomeStress = LOW_PLANT_BIOMES.has(biome.biomeKey) ? 0.16 : 0;
  const jitter = (hashUnit(seed, `${biome.id}:seasonal-stress`) - 0.5) * 0.04;

  return round(clamp(
    biome.seasonalityScore * 0.34
      + temperatureStress * 0.24
      + precipitationStress * 0.18
      + waterStress * 0.16
      + Math.max(0, biome.elevation - 0.72) * 0.12
      + biomeStress
      + jitter,
  ));
}

function buildPlantTags(candidate: PlantCandidate | null, biome: BiomeGridCell, density: number, stress: number): readonly string[] {
  if (!candidate) {
    return Object.freeze(["no-established-plants", "low-biomass"]);
  }

  const densityTag = density >= 0.72 ? "dense" : density >= 0.38 ? "moderate-density" : "sparse";
  const stressTag = stress >= 0.62 ? "seasonally-stressed" : "stable-growth";
  const tags = new Set<string>([
    ...candidate.definition.tags,
    ...biome.biomeTags.filter((tag) => ["freshwater", "forest", "grass", "wetland", "tropical", "cold", "arid", "timber", "fertile"].includes(tag)),
    densityTag,
    stressTag,
  ]);

  if (FOREST_PLANTS.has(candidate.definition.key)) {
    tags.add("wood-material");
  }

  if (candidate.definition.edibleValue >= 0.42 || candidate.definition.key === "grasses") {
    tags.add("forage");
  }

  return Object.freeze([...tags].sort());
}

function biomeProductivityBonus(biome: BiomeGridCell): number {
  switch (biome.biomeKey) {
    case "tropical-rainforest":
      return 0.24;
    case "tropical-seasonal-forest":
    case "temperate-forest":
    case "swamp-marsh":
      return 0.09;
    case "boreal-forest":
    case "river-wetland":
    case "temperate-grassland":
      return 0.05;
    default:
      return 0;
  }
}

function buildPlantCell(biome: BiomeGridCell, resources: PlanetResourceGridCell, seed: string): PlantGridCell {
  const candidate = selectDominantPlant(biome, resources, seed);
  const cap = plantBiomeDensityCap(biome);
  const suitability = candidate?.suitability ?? 0;
  const stress = seasonalStress(candidate, biome, resources, seed);
  const densityJitter = (hashUnit(seed, `${biome.id}:density`) - 0.5) * 0.045;
  const marineDensityPenalty = biome.biomeKey === "ocean" ? 0.18 : 0;
  const productivityBonus = biomeProductivityBonus(biome);
  const plantDensity = candidate
    ? round(clamp(cap * (suitability * 0.58 + biome.vegetationDensity * 0.32 + candidate.definition.growthRate * 0.08 + productivityBonus + densityJitter - marineDensityPenalty)))
    : 0;
  const biomassScore = candidate
    ? round(clamp(plantDensity * (0.4 + candidate.definition.shelterValue * 0.22 + candidate.definition.fuelMaterialValue * 0.22 + candidate.definition.growthRate * 0.16)))
    : 0;
  const ediblePlantScore = candidate
    ? round(clamp(plantDensity * (candidate.definition.edibleValue * 0.76 + (candidate.definition.key === "grasses" ? 0.14 : 0) + (candidate.definition.key === "tropical-trees" ? 0.08 : 0))))
    : 0;
  const woodMaterialScore = candidate
    ? round(clamp(plantDensity * (candidate.definition.fuelMaterialValue * 0.86 + candidate.definition.shelterValue * 0.14) * (FOREST_PLANTS.has(candidate.definition.key) ? 1 : 0.55)))
    : 0;
  const biodiversityScore = candidate
    ? round(clamp(
      plantDensity * 0.32
        + candidate.definition.biodiversityValue * 0.32
        + biome.fertilityScore * 0.13
        + biome.waterAvailabilityScore * 0.1
        + (1 - stress) * 0.08
        + (candidate.definition.key === "fungal-decomposers" ? 0.05 : 0),
    ))
    : 0;
  const medicinalPotentialScore = candidate
    ? round(clamp(
      plantDensity * (biodiversityScore * 0.42 + candidate.definition.biodiversityValue * 0.2)
        + (candidate.definition.tags.includes("medicinal") ? 0.16 : 0)
        + (candidate.definition.key === "tropical-trees" || candidate.definition.key === "shrubs" ? 0.06 : 0),
    ))
    : 0;
  const regrowthRate = candidate
    ? round(clamp(candidate.definition.growthRate * 0.46 + candidate.definition.spreadRate * 0.28 + (1 - stress) * 0.18 + plantDensity * 0.08))
    : 0;

  return Object.freeze({
    ...biome,
    plantSuitabilityScore: suitability,
    dominantPlantKey: candidate?.definition.key ?? "none",
    dominantPlantName: candidate?.definition.displayName ?? NONE_PLANT_NAME,
    dominantPlantCategory: candidate?.definition.category ?? "none",
    dominantPlantColor: candidate?.definition.color ?? NONE_PLANT_COLOR,
    plantDensity,
    biomassScore,
    ediblePlantScore,
    woodMaterialScore,
    medicinalPotentialScore,
    biodiversityScore,
    regrowthRate,
    seasonalStressScore: stress,
    plantTags: buildPlantTags(candidate, biome, plantDensity, stress),
  });
}

function buildPlantDistribution(): PlantDistribution {
  return Object.fromEntries([["none", 0], ...PLANT_KEYS.map((key) => [key, 0])]) as PlantDistribution;
}

function isPlantEligibleCell(cell: PlantGridCell): boolean {
  return cell.biomeKey !== "ocean" || cell.dominantPlantKey === "aquatic-algae";
}

function isLandOrUsableWaterCell(cell: PlantGridCell): boolean {
  return !MARINE_BIOMES.has(cell.biomeKey) || cell.biomeKey === "coast" || cell.biomeKey === "lake";
}

function makePlantRegion(component: readonly PlantGridCell[], score: (cell: PlantGridCell) => number): PlantRegion {
  const sorted = [...component].sort((left, right) => score(right) - score(left) || left.id.localeCompare(right.id));
  const peak = sorted[0];

  return Object.freeze({
    cellId: peak.id,
    dominantPlantKey: peak.dominantPlantKey,
    dominantPlantName: peak.dominantPlantName,
    cellCount: component.length,
    averageScore: round(average(component.map(score))),
    peakScore: round(score(peak)),
    midpointLatitude: round(average(component.map((cell) => cell.midpointLatitude)), 3),
    midpointLongitude: round(average(component.map((cell) => cell.midpointLongitude)), 3),
  });
}

function findPlantRegions(
  cells: readonly PlantGridCell[],
  grid: SpatialGrid,
  score: (cell: PlantGridCell) => number,
  threshold: number,
  predicate: (cell: PlantGridCell) => boolean = () => true,
): PlantRegion[] {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const eligible = new Set(cells.filter((cell) => predicate(cell) && score(cell) >= threshold).map((cell) => cell.id));
  const visited = new Set<string>();
  const regions: PlantRegion[] = [];

  for (const cell of cells) {
    if (!eligible.has(cell.id) || visited.has(cell.id)) {
      continue;
    }

    const queue = [cell.id];
    const component: PlantGridCell[] = [];
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

    regions.push(makePlantRegion(component, score));
  }

  return regions.sort((left, right) =>
    right.peakScore - left.peakScore
      || right.averageScore - left.averageScore
      || right.cellCount - left.cellCount
      || left.cellId.localeCompare(right.cellId),
  );
}

function foragingScore(cell: PlantGridCell): number {
  return round(clamp(cell.ediblePlantScore * 0.7 + cell.regrowthRate * 0.16 + cell.waterAvailabilityScore * 0.14 - cell.seasonalStressScore * 0.08));
}

function timberScore(cell: PlantGridCell): number {
  return round(clamp(cell.woodMaterialScore * 0.78 + cell.biomassScore * 0.14 + cell.regrowthRate * 0.08));
}

function lowResourceScore(cell: PlantGridCell): number {
  return round(clamp((1 - cell.plantDensity) * 0.34 + (1 - cell.biomassScore) * 0.22 + (1 - cell.ediblePlantScore) * 0.14 + cell.seasonalStressScore * 0.22 + (LOW_PLANT_BIOMES.has(cell.biomeKey) ? 0.08 : 0)));
}

function civilizationSupportScore(cell: PlantGridCell): number {
  if (!isLandOrUsableWaterCell(cell) || ["ice-sheet", "volcanic-barren"].includes(cell.biomeKey)) {
    return 0;
  }

  return round(clamp(
    cell.habitabilityScore * 0.2
      + cell.waterAvailabilityScore * 0.16
      + cell.ediblePlantScore * 0.24
      + cell.woodMaterialScore * 0.16
      + cell.regrowthRate * 0.1
      + cell.biodiversityScore * 0.08
      + cell.fertilityScore * 0.12
      - cell.seasonalStressScore * 0.1,
  ));
}

function animalCarryingCapacityScore(cell: PlantGridCell): number {
  return round(clamp(
    cell.biomassScore * 0.34
      + cell.ediblePlantScore * 0.28
      + cell.biodiversityScore * 0.22
      + cell.waterAvailabilityScore * 0.12
      + cell.plantDensity * 0.12
      - cell.seasonalStressScore * 0.08,
  ));
}

export function getTotalBiomass(cells: readonly PlantGridCell[]): number {
  return round(cells.reduce((total, cell) => total + cell.biomassScore, 0), 3);
}

export function getEdiblePlantCoverage(cells: readonly PlantGridCell[]): number {
  return round(average(cells.filter(isLandOrUsableWaterCell).map((cell) => cell.ediblePlantScore)));
}

export function getTimberMaterialCoverage(cells: readonly PlantGridCell[]): number {
  return round(average(cells.filter(isLandOrUsableWaterCell).map((cell) => cell.woodMaterialScore)));
}

export function getBiodiversityHotspots(cells: readonly PlantGridCell[], grid: SpatialGrid = createGrid()): readonly PlantRegion[] {
  return Object.freeze(findPlantRegions(cells, grid, (cell) => cell.biodiversityScore, 0.68, isLandOrUsableWaterCell).slice(0, 8));
}

export function getLowResourceDeadZones(cells: readonly PlantGridCell[], grid: SpatialGrid = createGrid()): readonly PlantRegion[] {
  return Object.freeze(findPlantRegions(cells, grid, lowResourceScore, 0.78, (cell) => !["ocean", "coast", "lake"].includes(cell.biomeKey)).slice(0, 8));
}

export function getCivilizationStartingZoneSupportScore(cells: readonly PlantGridCell[]): number {
  const ranked = cells
    .filter(isLandOrUsableWaterCell)
    .map(civilizationSupportScore)
    .sort((left, right) => right - left);
  const sampleSize = Math.max(1, Math.ceil(ranked.length * 0.12));

  return round(average(ranked.slice(0, sampleSize)));
}

export function getAnimalCarryingCapacityFoundationScore(cells: readonly PlantGridCell[]): number {
  return round(average(cells.filter(isLandOrUsableWaterCell).map(animalCarryingCapacityScore)));
}

function buildPlantSummary(cells: readonly PlantGridCell[], grid: SpatialGrid): PlantSummary {
  const distribution = buildPlantDistribution();

  for (const cell of cells) {
    distribution[cell.dominantPlantKey] += 1;
  }

  const usableCells = cells.filter(isLandOrUsableWaterCell);
  const plantedCells = cells.filter((cell) => cell.plantDensity > 0.04);

  return Object.freeze({
    cellCount: cells.length,
    plantEligibleCellCount: usableCells.length,
    plantedCellCount: plantedCells.length,
    dominantPlantDistribution: Object.freeze(distribution),
    totalBiomass: getTotalBiomass(cells),
    averagePlantDensity: round(average(usableCells.map((cell) => cell.plantDensity))),
    ediblePlantCoverage: getEdiblePlantCoverage(cells),
    timberMaterialCoverage: getTimberMaterialCoverage(cells),
    biodiversityScore: round(average(usableCells.map((cell) => cell.biodiversityScore))),
    civilizationStartingZoneSupportScore: getCivilizationStartingZoneSupportScore(cells),
    animalCarryingCapacityFoundationScore: getAnimalCarryingCapacityFoundationScore(cells),
    bestForagingZones: Object.freeze(findPlantRegions(cells, grid, foragingScore, 0.42, isLandOrUsableWaterCell).slice(0, 8)),
    bestTimberMaterialZones: Object.freeze(findPlantRegions(cells, grid, timberScore, 0.5, isLandOrUsableWaterCell).slice(0, 8)),
    biodiversityHotspots: getBiodiversityHotspots(cells, grid),
    harshestLowPlantZones: Object.freeze(findPlantRegions(cells, grid, lowResourceScore, 0.78).slice(0, 8)),
    lowResourceDeadZones: getLowResourceDeadZones(cells, grid),
  });
}

export function getPlantEcologyStateAtTick(
  world: PlantWorldSource,
  tickInput: TickInput,
  grid: SpatialGrid = createGrid(),
): PlantEcologyState {
  const tick = normalizeTick(tickInput);

  return getCachedDeterministic("plant-state", world, grid, () => {
    const seed = requirePlantSeed(world);
    const biomeState = getBiomeStateAtTick(world, tick, grid);
    const resourcesState = getPlanetResourcesStateAtTick(world, tick, grid);
    const resourcesById = new Map(resourcesState.cells.map((cell) => [cell.id, cell]));
    const cells = Object.freeze(biomeState.cells.map((biome) => {
      const resources = resourcesById.get(biome.id);

      if (!resources) {
        throw new Error(`Plant ecology dependencies missing for cell: ${biome.id}`);
      }

      return buildPlantCell(biome, resources, seed);
    }));

    return Object.freeze({
      seed,
      tick: tick.toString(),
      cells,
      summary: buildPlantSummary(cells, grid),
    });
  }, tick.toString());
}

export function getPlantEcologyState(world: PlantWorldSource, grid: SpatialGrid = createGrid()): PlantEcologyState {
  return getPlantEcologyStateAtTick(world, world.currentTick, grid);
}

export function getPlantEcologySummary(world: PlantWorldSource, grid: SpatialGrid = createGrid()): PlantSummary {
  return getPlantEcologyState(world, grid).summary;
}

export function getPlantEcologyDefinitions(): readonly PlantDefinition[] {
  return getPlantDefinitions();
}

function plantCellPersistencePayload(cell: PlantGridCell): {
  dominantPlantKey: string;
  dominantPlantName: string;
  plantSuitabilityScore: number;
  plantDensity: number;
  biomassScore: number;
  ediblePlantScore: number;
  woodMaterialScore: number;
  medicinalPotentialScore: number;
  biodiversityScore: number;
  regrowthRate: number;
  seasonalStressScore: number;
  plantTags: Prisma.InputJsonValue;
} {
  return {
    dominantPlantKey: cell.dominantPlantKey,
    dominantPlantName: cell.dominantPlantName,
    plantSuitabilityScore: cell.plantSuitabilityScore,
    plantDensity: cell.plantDensity,
    biomassScore: cell.biomassScore,
    ediblePlantScore: cell.ediblePlantScore,
    woodMaterialScore: cell.woodMaterialScore,
    medicinalPotentialScore: cell.medicinalPotentialScore,
    biodiversityScore: cell.biodiversityScore,
    regrowthRate: cell.regrowthRate,
    seasonalStressScore: cell.seasonalStressScore,
    plantTags: [...cell.plantTags],
  };
}

function samePersistedPlantCell(
  existing: Awaited<ReturnType<PlantPersistenceClient["planetCell"]["findMany"]>>[number],
  payload: ReturnType<typeof plantCellPersistencePayload>,
): boolean {
  return existing.plantGeneratedAt !== null
    && existing.plantUpdatedAt !== null
    && existing.dominantPlantKey === payload.dominantPlantKey
    && existing.dominantPlantName === payload.dominantPlantName
    && existing.plantSuitabilityScore === payload.plantSuitabilityScore
    && existing.plantDensity === payload.plantDensity
    && existing.biomassScore === payload.biomassScore
    && existing.ediblePlantScore === payload.ediblePlantScore
    && existing.woodMaterialScore === payload.woodMaterialScore
    && existing.medicinalPotentialScore === payload.medicinalPotentialScore
    && existing.biodiversityScore === payload.biodiversityScore
    && existing.regrowthRate === payload.regrowthRate
    && existing.seasonalStressScore === payload.seasonalStressScore
    && JSON.stringify(existing.plantTags) === JSON.stringify(payload.plantTags);
}

export async function persistPlantEcologyState(
  world: PlantWorldSource,
  client: PlantPersistenceClient,
  tick: TickInput = world.currentTick,
  grid: SpatialGrid = createGrid(),
): Promise<PersistPlantEcologyResult> {
  const planet = await client.planet.findUnique({
    where: { worldId: world.id },
    select: { id: true },
  });

  if (!planet) {
    throw new Error(`Plant ecology persistence requires a planet for world: ${world.id}`);
  }

  const state = getPlantEcologyStateAtTick(world, tick, grid);
  const existingCells = await client.planetCell.findMany({ where: { planetId: planet.id } });
  const existingByCellId = new Map(existingCells.map((cell) => [cell.cellId, cell]));
  const missingBiomeCells = state.cells.filter((cell) => !existingByCellId.has(cell.id));

  if (missingBiomeCells.length > 0) {
    throw new Error(`Plant ecology generation requires persisted biome cells. Run Biomes first. Missing cell: ${missingBiomeCells[0].id}`);
  }

  let updatedCells = 0;
  let unchangedCells = 0;
  const now = new Date();

  for (const cell of state.cells) {
    const payload = plantCellPersistencePayload(cell);
    const existing = existingByCellId.get(cell.id);

    if (!existing) {
      continue;
    }

    if (samePersistedPlantCell(existing, payload)) {
      unchangedCells += 1;
      continue;
    }

    await client.planetCell.update({
      where: { planetId_cellId: { planetId: planet.id, cellId: cell.id } },
      data: {
        ...payload,
        plantGeneratedAt: existing.plantGeneratedAt ?? now,
        plantUpdatedAt: now,
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

export { getPlantDefinition };
