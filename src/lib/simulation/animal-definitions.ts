import type { BiomeKey } from "./biome-definitions";


export type AnimalTrophicLevel = "Herbivore" | "Omnivore" | "Carnivore";
export type AnimalActivityPattern = "Diurnal" | "Nocturnal" | "Crepuscular";
export type AnimalPreferenceRange = readonly [number, number];

export type AnimalSpeciesDefinition = {
  readonly id: string;
  readonly name: string;
  readonly scientificName: string;
  readonly trophicLevel: AnimalTrophicLevel;
  readonly preferredBiomes: readonly BiomeKey[];
  readonly acceptableTemperatureRange: AnimalPreferenceRange;
  readonly acceptableRainfallRange: AnimalPreferenceRange;
  readonly acceptableElevationRange: AnimalPreferenceRange;
  readonly preferredPlantDensity: AnimalPreferenceRange;
  readonly reproductionRate: number;
  readonly naturalMortalityRate: number;
  readonly migrationThreshold: number;
  readonly starvationThreshold: number;
  readonly carryingCapacityModifier: number;
  readonly bodyMass: number;
  readonly activityPattern: AnimalActivityPattern;
  readonly climateTolerance: number;
  readonly tags: readonly string[];
};

function defineSpecies(definition: AnimalSpeciesDefinition): AnimalSpeciesDefinition {
  return Object.freeze(definition);
}

export const ANIMAL_SPECIES_DEFINITIONS = Object.freeze([
  defineSpecies({ id: "rabbit", name: "Rabbit", scientificName: "Oryctolagus cuniculus", trophicLevel: "Herbivore", preferredBiomes: ["temperate-grassland", "temperate-forest", "mediterranean-shrubland", "savanna", "tundra"], acceptableTemperatureRange: [-12, 34], acceptableRainfallRange: [0.08, 0.86], acceptableElevationRange: [0.22, 0.9], preferredPlantDensity: [0.18, 0.82], reproductionRate: 0.34, naturalMortalityRate: 0.09, migrationThreshold: 0.42, starvationThreshold: 0.24, carryingCapacityModifier: 1.2, bodyMass: 1.8, activityPattern: "Crepuscular", climateTolerance: 0.62, tags: ["small-game", "burrower", "prey", "fast-reproduction"] }),
  defineSpecies({ id: "deer", name: "Deer", scientificName: "Cervidae", trophicLevel: "Herbivore", preferredBiomes: ["temperate-forest", "temperate-grassland", "boreal-forest", "tropical-seasonal-forest", "river-wetland"], acceptableTemperatureRange: [-18, 32], acceptableRainfallRange: [0.12, 0.94], acceptableElevationRange: [0.22, 0.88], preferredPlantDensity: [0.24, 0.9], reproductionRate: 0.14, naturalMortalityRate: 0.06, migrationThreshold: 0.46, starvationThreshold: 0.32, carryingCapacityModifier: 0.72, bodyMass: 72, activityPattern: "Crepuscular", climateTolerance: 0.64, tags: ["browser", "game", "prey", "forest-edge"] }),
  defineSpecies({ id: "bison", name: "Bison", scientificName: "Bison bison", trophicLevel: "Herbivore", preferredBiomes: ["temperate-grassland", "savanna", "tundra"], acceptableTemperatureRange: [-24, 34], acceptableRainfallRange: [0.08, 0.64], acceptableElevationRange: [0.26, 0.78], preferredPlantDensity: [0.26, 0.74], reproductionRate: 0.08, naturalMortalityRate: 0.045, migrationThreshold: 0.5, starvationThreshold: 0.36, carryingCapacityModifier: 0.38, bodyMass: 620, activityPattern: "Diurnal", climateTolerance: 0.72, tags: ["large-grazer", "herd", "migration", "meat"] }),
  defineSpecies({ id: "elephant", name: "Elephant", scientificName: "Loxodonta africana", trophicLevel: "Herbivore", preferredBiomes: ["savanna", "tropical-seasonal-forest", "tropical-rainforest", "river-wetland"], acceptableTemperatureRange: [10, 40], acceptableRainfallRange: [0.18, 0.92], acceptableElevationRange: [0.18, 0.72], preferredPlantDensity: [0.34, 1], reproductionRate: 0.035, naturalMortalityRate: 0.025, migrationThreshold: 0.48, starvationThreshold: 0.42, carryingCapacityModifier: 0.16, bodyMass: 4200, activityPattern: "Diurnal", climateTolerance: 0.52, tags: ["megafauna", "browser", "water-dependent", "keystone"] }),
  defineSpecies({ id: "antelope", name: "Antelope", scientificName: "Antilopinae", trophicLevel: "Herbivore", preferredBiomes: ["savanna", "temperate-grassland", "desert", "mediterranean-shrubland"], acceptableTemperatureRange: [0, 42], acceptableRainfallRange: [0.02, 0.68], acceptableElevationRange: [0.22, 0.82], preferredPlantDensity: [0.16, 0.7], reproductionRate: 0.13, naturalMortalityRate: 0.06, migrationThreshold: 0.52, starvationThreshold: 0.3, carryingCapacityModifier: 0.74, bodyMass: 55, activityPattern: "Diurnal", climateTolerance: 0.72, tags: ["grazer", "herd", "prey", "dryland"] }),
  defineSpecies({ id: "goat", name: "Goat", scientificName: "Capra hircus", trophicLevel: "Herbivore", preferredBiomes: ["alpine-mountain", "badlands-rocky", "mediterranean-shrubland", "temperate-grassland", "desert"], acceptableTemperatureRange: [-10, 38], acceptableRainfallRange: [0.02, 0.76], acceptableElevationRange: [0.32, 1], preferredPlantDensity: [0.08, 0.64], reproductionRate: 0.18, naturalMortalityRate: 0.055, migrationThreshold: 0.46, starvationThreshold: 0.22, carryingCapacityModifier: 0.84, bodyMass: 45, activityPattern: "Diurnal", climateTolerance: 0.78, tags: ["browser", "mountain", "domestication-candidate", "sure-footed"] }),
  defineSpecies({ id: "yak", name: "Yak", scientificName: "Bos grunniens", trophicLevel: "Herbivore", preferredBiomes: ["alpine-mountain", "tundra", "boreal-forest"], acceptableTemperatureRange: [-32, 12], acceptableRainfallRange: [0.04, 0.72], acceptableElevationRange: [0.46, 1], preferredPlantDensity: [0.12, 0.62], reproductionRate: 0.07, naturalMortalityRate: 0.04, migrationThreshold: 0.5, starvationThreshold: 0.36, carryingCapacityModifier: 0.36, bodyMass: 380, activityPattern: "Diurnal", climateTolerance: 0.82, tags: ["cold-adapted", "large-grazer", "mountain", "domestication-candidate"] }),
  defineSpecies({ id: "wolf", name: "Wolf", scientificName: "Canis lupus", trophicLevel: "Carnivore", preferredBiomes: ["boreal-forest", "temperate-forest", "temperate-grassland", "tundra", "alpine-mountain"], acceptableTemperatureRange: [-36, 28], acceptableRainfallRange: [0.06, 0.92], acceptableElevationRange: [0.24, 0.92], preferredPlantDensity: [0.08, 0.86], reproductionRate: 0.09, naturalMortalityRate: 0.055, migrationThreshold: 0.54, starvationThreshold: 0.38, carryingCapacityModifier: 0.18, bodyMass: 42, activityPattern: "Crepuscular", climateTolerance: 0.8, tags: ["pack", "predator", "wide-ranging", "prey-control"] }),
  defineSpecies({ id: "lion", name: "Lion", scientificName: "Panthera leo", trophicLevel: "Carnivore", preferredBiomes: ["savanna", "temperate-grassland", "tropical-seasonal-forest"], acceptableTemperatureRange: [8, 42], acceptableRainfallRange: [0.08, 0.74], acceptableElevationRange: [0.2, 0.76], preferredPlantDensity: [0.08, 0.72], reproductionRate: 0.07, naturalMortalityRate: 0.05, migrationThreshold: 0.46, starvationThreshold: 0.42, carryingCapacityModifier: 0.14, bodyMass: 190, activityPattern: "Nocturnal", climateTolerance: 0.58, tags: ["apex", "pride", "large-predator", "savanna"] }),
  defineSpecies({ id: "tiger", name: "Tiger", scientificName: "Panthera tigris", trophicLevel: "Carnivore", preferredBiomes: ["tropical-rainforest", "tropical-seasonal-forest", "temperate-forest", "swamp-marsh"], acceptableTemperatureRange: [-6, 38], acceptableRainfallRange: [0.24, 1], acceptableElevationRange: [0.18, 0.82], preferredPlantDensity: [0.34, 1], reproductionRate: 0.065, naturalMortalityRate: 0.05, migrationThreshold: 0.42, starvationThreshold: 0.42, carryingCapacityModifier: 0.12, bodyMass: 220, activityPattern: "Nocturnal", climateTolerance: 0.56, tags: ["apex", "ambush", "forest", "large-predator"] }),
  defineSpecies({ id: "bear", name: "Bear", scientificName: "Ursidae", trophicLevel: "Omnivore", preferredBiomes: ["boreal-forest", "temperate-forest", "tundra", "river-wetland", "coast"], acceptableTemperatureRange: [-28, 28], acceptableRainfallRange: [0.08, 0.96], acceptableElevationRange: [0.22, 0.9], preferredPlantDensity: [0.24, 0.9], reproductionRate: 0.05, naturalMortalityRate: 0.035, migrationThreshold: 0.44, starvationThreshold: 0.38, carryingCapacityModifier: 0.16, bodyMass: 260, activityPattern: "Crepuscular", climateTolerance: 0.74, tags: ["omnivore", "large-mammal", "fish", "danger"] }),
  defineSpecies({ id: "fox", name: "Fox", scientificName: "Vulpes vulpes", trophicLevel: "Omnivore", preferredBiomes: ["temperate-forest", "temperate-grassland", "boreal-forest", "tundra", "desert", "mediterranean-shrubland"], acceptableTemperatureRange: [-30, 38], acceptableRainfallRange: [0.02, 0.94], acceptableElevationRange: [0.2, 0.92], preferredPlantDensity: [0.04, 0.82], reproductionRate: 0.17, naturalMortalityRate: 0.075, migrationThreshold: 0.42, starvationThreshold: 0.26, carryingCapacityModifier: 0.54, bodyMass: 6, activityPattern: "Nocturnal", climateTolerance: 0.82, tags: ["small-predator", "omnivore", "burrower", "wide-ranging"] }),
  defineSpecies({ id: "eagle", name: "Eagle", scientificName: "Aquila chrysaetos", trophicLevel: "Carnivore", preferredBiomes: ["alpine-mountain", "temperate-grassland", "tundra", "coast", "lake", "badlands-rocky"], acceptableTemperatureRange: [-24, 36], acceptableRainfallRange: [0.02, 0.88], acceptableElevationRange: [0.16, 1], preferredPlantDensity: [0.02, 0.78], reproductionRate: 0.045, naturalMortalityRate: 0.035, migrationThreshold: 0.5, starvationThreshold: 0.34, carryingCapacityModifier: 0.1, bodyMass: 5, activityPattern: "Diurnal", climateTolerance: 0.72, tags: ["raptor", "aerial", "predator", "nesting-cliffs"] }),
  defineSpecies({ id: "pig", name: "Pig", scientificName: "Sus domesticus", trophicLevel: "Omnivore", preferredBiomes: ["temperate-forest", "river-wetland", "swamp-marsh", "tropical-seasonal-forest", "temperate-grassland"], acceptableTemperatureRange: [-4, 34], acceptableRainfallRange: [0.16, 1], acceptableElevationRange: [0.18, 0.78], preferredPlantDensity: [0.22, 0.92], reproductionRate: 0.24, naturalMortalityRate: 0.065, migrationThreshold: 0.4, starvationThreshold: 0.26, carryingCapacityModifier: 0.76, bodyMass: 85, activityPattern: "Diurnal", climateTolerance: 0.56, tags: ["omnivore", "rooter", "domestication-candidate", "wetland-edge"] }),
  defineSpecies({ id: "boar", name: "Boar", scientificName: "Sus scrofa", trophicLevel: "Omnivore", preferredBiomes: ["temperate-forest", "tropical-seasonal-forest", "swamp-marsh", "mediterranean-shrubland", "river-wetland"], acceptableTemperatureRange: [-8, 38], acceptableRainfallRange: [0.1, 1], acceptableElevationRange: [0.18, 0.82], preferredPlantDensity: [0.2, 0.96], reproductionRate: 0.2, naturalMortalityRate: 0.07, migrationThreshold: 0.42, starvationThreshold: 0.28, carryingCapacityModifier: 0.64, bodyMass: 95, activityPattern: "Nocturnal", climateTolerance: 0.62, tags: ["omnivore", "rooter", "forest", "danger"] }),
  defineSpecies({ id: "raccoon", name: "Raccoon", scientificName: "Procyon lotor", trophicLevel: "Omnivore", preferredBiomes: ["temperate-forest", "river-wetland", "swamp-marsh", "lake", "coast"], acceptableTemperatureRange: [-16, 34], acceptableRainfallRange: [0.16, 1], acceptableElevationRange: [0.16, 0.8], preferredPlantDensity: [0.24, 0.92], reproductionRate: 0.16, naturalMortalityRate: 0.075, migrationThreshold: 0.4, starvationThreshold: 0.24, carryingCapacityModifier: 0.58, bodyMass: 7, activityPattern: "Nocturnal", climateTolerance: 0.66, tags: ["omnivore", "wetland-edge", "scavenger", "small-mammal"] }),
  defineSpecies({ id: "crow", name: "Crow", scientificName: "Corvus brachyrhynchos", trophicLevel: "Omnivore", preferredBiomes: ["temperate-forest", "temperate-grassland", "river-wetland", "coast", "savanna", "tundra"], acceptableTemperatureRange: [-24, 38], acceptableRainfallRange: [0.02, 1], acceptableElevationRange: [0.12, 0.92], preferredPlantDensity: [0.02, 0.9], reproductionRate: 0.12, naturalMortalityRate: 0.06, migrationThreshold: 0.46, starvationThreshold: 0.22, carryingCapacityModifier: 0.62, bodyMass: 0.5, activityPattern: "Diurnal", climateTolerance: 0.84, tags: ["bird", "scavenger", "omnivore", "wide-ranging"] }),
  defineSpecies({ id: "salmon", name: "Salmon", scientificName: "Salmo salar", trophicLevel: "Omnivore", preferredBiomes: ["lake", "river-wetland", "coast"], acceptableTemperatureRange: [-2, 18], acceptableRainfallRange: [0.28, 1], acceptableElevationRange: [0.16, 0.86], preferredPlantDensity: [0.04, 0.82], reproductionRate: 0.28, naturalMortalityRate: 0.11, migrationThreshold: 0.56, starvationThreshold: 0.28, carryingCapacityModifier: 1.12, bodyMass: 4, activityPattern: "Diurnal", climateTolerance: 0.5, tags: ["aquatic", "freshwater", "migration", "fish"] }),
  defineSpecies({ id: "tuna", name: "Tuna", scientificName: "Thunnini", trophicLevel: "Carnivore", preferredBiomes: ["ocean", "coast"], acceptableTemperatureRange: [6, 32], acceptableRainfallRange: [0, 1], acceptableElevationRange: [0, 0.46], preferredPlantDensity: [0, 0.5], reproductionRate: 0.2, naturalMortalityRate: 0.08, migrationThreshold: 0.58, starvationThreshold: 0.34, carryingCapacityModifier: 0.94, bodyMass: 120, activityPattern: "Diurnal", climateTolerance: 0.56, tags: ["aquatic", "marine", "fish", "pelagic"] }),
  defineSpecies({ id: "shark", name: "Shark", scientificName: "Selachimorpha", trophicLevel: "Carnivore", preferredBiomes: ["ocean", "coast"], acceptableTemperatureRange: [4, 34], acceptableRainfallRange: [0, 1], acceptableElevationRange: [0, 0.46], preferredPlantDensity: [0, 0.58], reproductionRate: 0.04, naturalMortalityRate: 0.025, migrationThreshold: 0.5, starvationThreshold: 0.42, carryingCapacityModifier: 0.12, bodyMass: 520, activityPattern: "Crepuscular", climateTolerance: 0.62, tags: ["aquatic", "marine", "apex", "danger"] }),
  defineSpecies({ id: "seal", name: "Seal", scientificName: "Phocidae", trophicLevel: "Carnivore", preferredBiomes: ["coast", "ice-sheet", "tundra", "ocean"], acceptableTemperatureRange: [-34, 12], acceptableRainfallRange: [0, 0.82], acceptableElevationRange: [0, 0.62], preferredPlantDensity: [0, 0.46], reproductionRate: 0.08, naturalMortalityRate: 0.045, migrationThreshold: 0.5, starvationThreshold: 0.36, carryingCapacityModifier: 0.32, bodyMass: 140, activityPattern: "Diurnal", climateTolerance: 0.82, tags: ["polar", "marine", "fish-eater", "coastal"] }),
  defineSpecies({ id: "polar-bear", name: "Polar Bear", scientificName: "Ursus maritimus", trophicLevel: "Carnivore", preferredBiomes: ["ice-sheet", "tundra", "coast", "ocean"], acceptableTemperatureRange: [-40, 6], acceptableRainfallRange: [0, 0.62], acceptableElevationRange: [0, 0.74], preferredPlantDensity: [0, 0.38], reproductionRate: 0.035, naturalMortalityRate: 0.03, migrationThreshold: 0.52, starvationThreshold: 0.46, carryingCapacityModifier: 0.08, bodyMass: 450, activityPattern: "Diurnal", climateTolerance: 0.88, tags: ["polar", "apex", "marine-edge", "danger"] }),
  defineSpecies({ id: "camel", name: "Camel", scientificName: "Camelus dromedarius", trophicLevel: "Herbivore", preferredBiomes: ["desert", "badlands-rocky", "mediterranean-shrubland", "savanna"], acceptableTemperatureRange: [0, 46], acceptableRainfallRange: [0, 0.36], acceptableElevationRange: [0.2, 0.82], preferredPlantDensity: [0.04, 0.42], reproductionRate: 0.07, naturalMortalityRate: 0.04, migrationThreshold: 0.48, starvationThreshold: 0.24, carryingCapacityModifier: 0.34, bodyMass: 480, activityPattern: "Diurnal", climateTolerance: 0.9, tags: ["desert", "water-efficient", "large-herbivore", "domestication-candidate"] }),
] satisfies readonly AnimalSpeciesDefinition[]);

export type AnimalSpeciesId = (typeof ANIMAL_SPECIES_DEFINITIONS)[number]["id"];

export const ANIMAL_SPECIES_BY_ID: Readonly<Record<string, AnimalSpeciesDefinition>> = Object.freeze(
  Object.fromEntries(ANIMAL_SPECIES_DEFINITIONS.map((definition) => [definition.id, definition])),
);

export function getAnimalSpeciesDefinition(id: string): AnimalSpeciesDefinition {
  const definition = ANIMAL_SPECIES_BY_ID[id];

  if (!definition) {
    throw new Error(`Unknown animal species: ${id}`);
  }

  return definition;
}

export function getAnimalSpeciesDefinitions(): readonly AnimalSpeciesDefinition[] {
  return ANIMAL_SPECIES_DEFINITIONS;
}

export const ANIMAL_GUILD_KEYS = [
  "aquatic-microfauna",
  "fish",
  "amphibians",
  "insects",
  "small-herbivores",
  "large-herbivores",
  "browsers",
  "grazers",
  "small-predators",
  "apex-predators",
  "scavengers",
  "birds",
  "reptiles",
  "burrowers",
  "cold-adapted-animals",
  "desert-adapted-animals",
  "wetland-animals",
] as const;

export type AnimalGuildKey = (typeof ANIMAL_GUILD_KEYS)[number];

export type AnimalCategory =
  | "aquatic"
  | "amphibian"
  | "invertebrate"
  | "herbivore"
  | "predator"
  | "scavenger"
  | "aerial"
  | "reptile"
  | "burrower"
  | "specialist";

export type AnimalRange = readonly [number, number];

export type AnimalGuildDefinition = {
  readonly key: AnimalGuildKey;
  readonly displayName: string;
  readonly category: AnimalCategory;
  readonly color: string;
  readonly biomePreferences: readonly BiomeKey[];
  readonly plantFoodDependency: number;
  readonly preyDependency: number;
  readonly waterDependency: number;
  readonly temperatureRangeC: AnimalRange;
  readonly precipitationRange: AnimalRange;
  readonly elevationTolerance: AnimalRange;
  readonly shelterRequirement: number;
  readonly reproductionRate: number;
  readonly mobilityScore: number;
  readonly migrationTendency: number;
  readonly humanFoodValue: number;
  readonly dangerScore: number;
  readonly biodiversityValue: number;
  readonly tags: readonly string[];
};

function defineGuild(definition: AnimalGuildDefinition): AnimalGuildDefinition {
  return Object.freeze(definition);
}

export const ANIMAL_GUILD_DEFINITIONS: Record<AnimalGuildKey, AnimalGuildDefinition> = Object.freeze({
  "aquatic-microfauna": defineGuild({
    key: "aquatic-microfauna",
    displayName: "Aquatic Microfauna",
    category: "aquatic",
    color: "#58b7a0",
    biomePreferences: Object.freeze(["ocean", "coast", "lake", "river-wetland", "swamp-marsh"]),
    plantFoodDependency: 0.34,
    preyDependency: 0.02,
    waterDependency: 0.95,
    temperatureRangeC: [-3, 34],
    precipitationRange: [0, 1],
    elevationTolerance: [0, 0.82],
    shelterRequirement: 0.04,
    reproductionRate: 0.95,
    mobilityScore: 0.32,
    migrationTendency: 0.18,
    humanFoodValue: 0.12,
    dangerScore: 0.01,
    biodiversityValue: 0.62,
    tags: Object.freeze(["aquatic", "microfauna", "plankton", "food-chain-base", "fast-reproduction"]),
  }),
  fish: defineGuild({
    key: "fish",
    displayName: "Fish",
    category: "aquatic",
    color: "#2f91c8",
    biomePreferences: Object.freeze(["ocean", "coast", "lake", "river-wetland"]),
    plantFoodDependency: 0.22,
    preyDependency: 0.24,
    waterDependency: 0.92,
    temperatureRangeC: [-2, 32],
    precipitationRange: [0, 1],
    elevationTolerance: [0, 0.82],
    shelterRequirement: 0.18,
    reproductionRate: 0.62,
    mobilityScore: 0.62,
    migrationTendency: 0.46,
    humanFoodValue: 0.86,
    dangerScore: 0.06,
    biodiversityValue: 0.56,
    tags: Object.freeze(["aquatic", "fishery", "protein", "migration", "freshwater"]),
  }),
  amphibians: defineGuild({
    key: "amphibians",
    displayName: "Amphibians",
    category: "amphibian",
    color: "#74a85c",
    biomePreferences: Object.freeze(["river-wetland", "swamp-marsh", "lake", "temperate-forest", "tropical-rainforest"]),
    plantFoodDependency: 0.2,
    preyDependency: 0.28,
    waterDependency: 0.78,
    temperatureRangeC: [4, 32],
    precipitationRange: [0.42, 1],
    elevationTolerance: [0.28, 0.72],
    shelterRequirement: 0.38,
    reproductionRate: 0.68,
    mobilityScore: 0.28,
    migrationTendency: 0.18,
    humanFoodValue: 0.22,
    dangerScore: 0.08,
    biodiversityValue: 0.64,
    tags: Object.freeze(["amphibian", "wetland", "insect-control", "moisture-sensitive", "indicator-species"]),
  }),
  insects: defineGuild({
    key: "insects",
    displayName: "Insects",
    category: "invertebrate",
    color: "#c6a34a",
    biomePreferences: Object.freeze(["tropical-rainforest", "tropical-seasonal-forest", "swamp-marsh", "temperate-forest", "savanna", "river-wetland"]),
    plantFoodDependency: 0.46,
    preyDependency: 0.04,
    waterDependency: 0.26,
    temperatureRangeC: [4, 38],
    precipitationRange: [0.12, 1],
    elevationTolerance: [0.22, 0.84],
    shelterRequirement: 0.18,
    reproductionRate: 0.92,
    mobilityScore: 0.42,
    migrationTendency: 0.22,
    humanFoodValue: 0.2,
    dangerScore: 0.18,
    biodiversityValue: 0.88,
    tags: Object.freeze(["insect", "pollinator", "decomposer", "prey-base", "disease-vector"]),
  }),
  "small-herbivores": defineGuild({
    key: "small-herbivores",
    displayName: "Small Herbivores",
    category: "herbivore",
    color: "#aeb861",
    biomePreferences: Object.freeze(["temperate-grassland", "temperate-forest", "mediterranean-shrubland", "savanna", "boreal-forest", "tundra"]),
    plantFoodDependency: 0.72,
    preyDependency: 0,
    waterDependency: 0.32,
    temperatureRangeC: [-12, 32],
    precipitationRange: [0.08, 0.84],
    elevationTolerance: [0.28, 0.86],
    shelterRequirement: 0.28,
    reproductionRate: 0.76,
    mobilityScore: 0.5,
    migrationTendency: 0.24,
    humanFoodValue: 0.48,
    dangerScore: 0.03,
    biodiversityValue: 0.38,
    tags: Object.freeze(["herbivore", "small-game", "prey", "forage", "fast-reproduction"]),
  }),
  "large-herbivores": defineGuild({
    key: "large-herbivores",
    displayName: "Large Herbivores",
    category: "herbivore",
    color: "#8d9a48",
    biomePreferences: Object.freeze(["savanna", "temperate-grassland", "temperate-forest", "tropical-seasonal-forest", "boreal-forest"]),
    plantFoodDependency: 0.82,
    preyDependency: 0,
    waterDependency: 0.46,
    temperatureRangeC: [-8, 34],
    precipitationRange: [0.16, 0.82],
    elevationTolerance: [0.32, 0.76],
    shelterRequirement: 0.22,
    reproductionRate: 0.34,
    mobilityScore: 0.72,
    migrationTendency: 0.54,
    humanFoodValue: 0.92,
    dangerScore: 0.24,
    biodiversityValue: 0.42,
    tags: Object.freeze(["herbivore", "large-game", "prey", "migration", "meat"]),
  }),
  browsers: defineGuild({
    key: "browsers",
    displayName: "Browsers",
    category: "herbivore",
    color: "#7c944f",
    biomePreferences: Object.freeze(["temperate-forest", "tropical-seasonal-forest", "mediterranean-shrubland", "savanna", "boreal-forest"]),
    plantFoodDependency: 0.68,
    preyDependency: 0,
    waterDependency: 0.36,
    temperatureRangeC: [-10, 34],
    precipitationRange: [0.18, 0.9],
    elevationTolerance: [0.3, 0.82],
    shelterRequirement: 0.34,
    reproductionRate: 0.44,
    mobilityScore: 0.58,
    migrationTendency: 0.32,
    humanFoodValue: 0.72,
    dangerScore: 0.12,
    biodiversityValue: 0.42,
    tags: Object.freeze(["herbivore", "browse", "forest-edge", "meat", "prey"]),
  }),
  grazers: defineGuild({
    key: "grazers",
    displayName: "Grazers",
    category: "herbivore",
    color: "#b5b84e",
    biomePreferences: Object.freeze(["temperate-grassland", "savanna", "tundra", "river-wetland"]),
    plantFoodDependency: 0.86,
    preyDependency: 0,
    waterDependency: 0.38,
    temperatureRangeC: [-14, 36],
    precipitationRange: [0.12, 0.68],
    elevationTolerance: [0.28, 0.78],
    shelterRequirement: 0.12,
    reproductionRate: 0.48,
    mobilityScore: 0.76,
    migrationTendency: 0.64,
    humanFoodValue: 0.88,
    dangerScore: 0.14,
    biodiversityValue: 0.4,
    tags: Object.freeze(["herbivore", "grazer", "grassland", "migration", "domestication-candidate"]),
  }),
  "small-predators": defineGuild({
    key: "small-predators",
    displayName: "Small Predators",
    category: "predator",
    color: "#9b5b45",
    biomePreferences: Object.freeze(["temperate-forest", "temperate-grassland", "savanna", "boreal-forest", "tropical-seasonal-forest", "tundra"]),
    plantFoodDependency: 0.08,
    preyDependency: 0.56,
    waterDependency: 0.24,
    temperatureRangeC: [-18, 36],
    precipitationRange: [0.08, 0.92],
    elevationTolerance: [0.28, 0.9],
    shelterRequirement: 0.32,
    reproductionRate: 0.46,
    mobilityScore: 0.62,
    migrationTendency: 0.28,
    humanFoodValue: 0.18,
    dangerScore: 0.28,
    biodiversityValue: 0.44,
    tags: Object.freeze(["predator", "mesopredator", "prey-control", "fur", "territorial"]),
  }),
  "apex-predators": defineGuild({
    key: "apex-predators",
    displayName: "Apex Predators",
    category: "predator",
    color: "#7f3d38",
    biomePreferences: Object.freeze(["savanna", "temperate-forest", "tropical-rainforest", "boreal-forest", "tropical-seasonal-forest"]),
    plantFoodDependency: 0.02,
    preyDependency: 0.84,
    waterDependency: 0.34,
    temperatureRangeC: [-16, 36],
    precipitationRange: [0.12, 1],
    elevationTolerance: [0.24, 0.86],
    shelterRequirement: 0.42,
    reproductionRate: 0.18,
    mobilityScore: 0.78,
    migrationTendency: 0.34,
    humanFoodValue: 0.1,
    dangerScore: 0.92,
    biodiversityValue: 0.58,
    tags: Object.freeze(["predator", "apex", "danger", "territorial", "keystone"]),
  }),
  scavengers: defineGuild({
    key: "scavengers",
    displayName: "Scavengers",
    category: "scavenger",
    color: "#8e7054",
    biomePreferences: Object.freeze(["savanna", "desert", "badlands-rocky", "temperate-grassland", "coast", "tundra"]),
    plantFoodDependency: 0.06,
    preyDependency: 0.42,
    waterDependency: 0.18,
    temperatureRangeC: [-16, 42],
    precipitationRange: [0, 0.9],
    elevationTolerance: [0.2, 0.88],
    shelterRequirement: 0.14,
    reproductionRate: 0.38,
    mobilityScore: 0.74,
    migrationTendency: 0.38,
    humanFoodValue: 0.08,
    dangerScore: 0.22,
    biodiversityValue: 0.36,
    tags: Object.freeze(["scavenger", "carrion", "cleanup", "wide-ranging", "disease-risk"]),
  }),
  birds: defineGuild({
    key: "birds",
    displayName: "Birds",
    category: "aerial",
    color: "#88a9bf",
    biomePreferences: Object.freeze(["coast", "lake", "river-wetland", "swamp-marsh", "temperate-forest", "tropical-rainforest", "savanna"]),
    plantFoodDependency: 0.26,
    preyDependency: 0.22,
    waterDependency: 0.28,
    temperatureRangeC: [-12, 36],
    precipitationRange: [0.1, 1],
    elevationTolerance: [0.12, 0.9],
    shelterRequirement: 0.28,
    reproductionRate: 0.42,
    mobilityScore: 0.92,
    migrationTendency: 0.72,
    humanFoodValue: 0.42,
    dangerScore: 0.08,
    biodiversityValue: 0.66,
    tags: Object.freeze(["bird", "aerial", "migration", "eggs", "seed-dispersal"]),
  }),
  reptiles: defineGuild({
    key: "reptiles",
    displayName: "Reptiles",
    category: "reptile",
    color: "#7f9b4b",
    biomePreferences: Object.freeze(["desert", "savanna", "mediterranean-shrubland", "tropical-seasonal-forest", "swamp-marsh", "coast"]),
    plantFoodDependency: 0.12,
    preyDependency: 0.34,
    waterDependency: 0.18,
    temperatureRangeC: [10, 42],
    precipitationRange: [0, 0.82],
    elevationTolerance: [0.22, 0.82],
    shelterRequirement: 0.24,
    reproductionRate: 0.38,
    mobilityScore: 0.42,
    migrationTendency: 0.12,
    humanFoodValue: 0.34,
    dangerScore: 0.34,
    biodiversityValue: 0.44,
    tags: Object.freeze(["reptile", "warm-adapted", "burrow", "ambush", "eggs"]),
  }),
  burrowers: defineGuild({
    key: "burrowers",
    displayName: "Burrowers",
    category: "burrower",
    color: "#a47752",
    biomePreferences: Object.freeze(["temperate-grassland", "desert", "badlands-rocky", "mediterranean-shrubland", "savanna", "tundra"]),
    plantFoodDependency: 0.44,
    preyDependency: 0.1,
    waterDependency: 0.18,
    temperatureRangeC: [-12, 40],
    precipitationRange: [0.02, 0.68],
    elevationTolerance: [0.28, 0.86],
    shelterRequirement: 0.08,
    reproductionRate: 0.64,
    mobilityScore: 0.28,
    migrationTendency: 0.08,
    humanFoodValue: 0.38,
    dangerScore: 0.05,
    biodiversityValue: 0.32,
    tags: Object.freeze(["burrower", "small-game", "soil-turnover", "shelter", "prey"]),
  }),
  "cold-adapted-animals": defineGuild({
    key: "cold-adapted-animals",
    displayName: "Cold-adapted Animals",
    category: "specialist",
    color: "#c8d7d8",
    biomePreferences: Object.freeze(["tundra", "boreal-forest", "ice-sheet", "alpine-mountain"]),
    plantFoodDependency: 0.38,
    preyDependency: 0.18,
    waterDependency: 0.24,
    temperatureRangeC: [-36, 8],
    precipitationRange: [0.02, 0.72],
    elevationTolerance: [0.34, 1],
    shelterRequirement: 0.22,
    reproductionRate: 0.26,
    mobilityScore: 0.68,
    migrationTendency: 0.62,
    humanFoodValue: 0.72,
    dangerScore: 0.22,
    biodiversityValue: 0.28,
    tags: Object.freeze(["cold", "fur", "seasonal-migration", "low-density", "meat"]),
  }),
  "desert-adapted-animals": defineGuild({
    key: "desert-adapted-animals",
    displayName: "Desert-adapted Animals",
    category: "specialist",
    color: "#d2b36b",
    biomePreferences: Object.freeze(["desert", "badlands-rocky", "mediterranean-shrubland"]),
    plantFoodDependency: 0.28,
    preyDependency: 0.16,
    waterDependency: 0.06,
    temperatureRangeC: [2, 45],
    precipitationRange: [0, 0.32],
    elevationTolerance: [0.3, 0.86],
    shelterRequirement: 0.14,
    reproductionRate: 0.32,
    mobilityScore: 0.58,
    migrationTendency: 0.36,
    humanFoodValue: 0.32,
    dangerScore: 0.18,
    biodiversityValue: 0.26,
    tags: Object.freeze(["desert", "water-efficient", "nocturnal", "sparse", "heat-adapted"]),
  }),
  "wetland-animals": defineGuild({
    key: "wetland-animals",
    displayName: "Wetland Animals",
    category: "specialist",
    color: "#4f9a78",
    biomePreferences: Object.freeze(["river-wetland", "swamp-marsh", "lake", "coast"]),
    plantFoodDependency: 0.42,
    preyDependency: 0.24,
    waterDependency: 0.82,
    temperatureRangeC: [0, 34],
    precipitationRange: [0.38, 1],
    elevationTolerance: [0.24, 0.72],
    shelterRequirement: 0.34,
    reproductionRate: 0.54,
    mobilityScore: 0.52,
    migrationTendency: 0.36,
    humanFoodValue: 0.54,
    dangerScore: 0.2,
    biodiversityValue: 0.7,
    tags: Object.freeze(["wetland", "aquatic-edge", "nesting", "high-biodiversity", "water-dependent"]),
  }),
});

export function getAnimalGuildDefinition(key: AnimalGuildKey): AnimalGuildDefinition {
  return ANIMAL_GUILD_DEFINITIONS[key];
}

export function getAnimalGuildDefinitions(): readonly AnimalGuildDefinition[] {
  return ANIMAL_GUILD_KEYS.map((key) => ANIMAL_GUILD_DEFINITIONS[key]);
}
