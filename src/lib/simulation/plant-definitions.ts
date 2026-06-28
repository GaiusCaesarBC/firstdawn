import type { BiomeKey } from "./biome-definitions";

export const PLANT_KEYS = [
  "aquatic-algae",
  "moss-lichen",
  "grasses",
  "shrubs",
  "reeds-wetland",
  "temperate-trees",
  "boreal-trees",
  "tropical-trees",
  "desert-plants",
  "alpine-plants",
  "fungal-decomposers",
] as const;

export type PlantKey = (typeof PLANT_KEYS)[number];

export type PlantCategory =
  | "aquatic"
  | "nonvascular"
  | "grassland"
  | "shrubland"
  | "wetland"
  | "forest"
  | "dryland"
  | "mountain"
  | "decomposer";

export type PlantRange = readonly [number, number];

export type PlantDefinition = {
  readonly key: PlantKey;
  readonly displayName: string;
  readonly category: PlantCategory;
  readonly color: string;
  readonly biomePreferences: readonly BiomeKey[];
  readonly temperatureRangeC: PlantRange;
  readonly precipitationRange: PlantRange;
  readonly waterRequirement: number;
  readonly fertilityRequirement: number;
  readonly elevationTolerance: PlantRange;
  readonly growthRate: number;
  readonly spreadRate: number;
  readonly edibleValue: number;
  readonly shelterValue: number;
  readonly fuelMaterialValue: number;
  readonly biodiversityValue: number;
  readonly resilienceScore: number;
  readonly tags: readonly string[];
};

function definePlant(definition: PlantDefinition): PlantDefinition {
  return Object.freeze(definition);
}

export const PLANT_DEFINITIONS: Record<PlantKey, PlantDefinition> = Object.freeze({
  "aquatic-algae": definePlant({
    key: "aquatic-algae",
    displayName: "Algae / Aquatic Plants",
    category: "aquatic",
    color: "#3b8f7a",
    biomePreferences: Object.freeze(["ocean", "coast", "lake", "river-wetland", "swamp-marsh"]),
    temperatureRangeC: [-2, 34],
    precipitationRange: [0, 1],
    waterRequirement: 0.82,
    fertilityRequirement: 0.08,
    elevationTolerance: [0, 0.72],
    growthRate: 0.82,
    spreadRate: 0.74,
    edibleValue: 0.42,
    shelterValue: 0.28,
    fuelMaterialValue: 0.08,
    biodiversityValue: 0.48,
    resilienceScore: 0.72,
    tags: Object.freeze(["aquatic", "primary-producer", "freshwater", "marine", "fast-growth"]),
  }),
  "moss-lichen": definePlant({
    key: "moss-lichen",
    displayName: "Moss / Lichens",
    category: "nonvascular",
    color: "#91a06a",
    biomePreferences: Object.freeze(["tundra", "boreal-forest", "alpine-mountain", "ice-sheet", "volcanic-barren", "badlands-rocky"]),
    temperatureRangeC: [-25, 18],
    precipitationRange: [0.05, 0.82],
    waterRequirement: 0.18,
    fertilityRequirement: 0.02,
    elevationTolerance: [0.38, 1],
    growthRate: 0.2,
    spreadRate: 0.28,
    edibleValue: 0.08,
    shelterValue: 0.16,
    fuelMaterialValue: 0.03,
    biodiversityValue: 0.22,
    resilienceScore: 0.88,
    tags: Object.freeze(["pioneer", "cold", "lichen", "soil-builder", "low-growing"]),
  }),
  "grasses": definePlant({
    key: "grasses",
    displayName: "Grasses",
    category: "grassland",
    color: "#a9b85c",
    biomePreferences: Object.freeze(["temperate-grassland", "savanna", "mediterranean-shrubland", "river-wetland", "tundra"]),
    temperatureRangeC: [0, 34],
    precipitationRange: [0.16, 0.72],
    waterRequirement: 0.24,
    fertilityRequirement: 0.18,
    elevationTolerance: [0.32, 0.76],
    growthRate: 0.76,
    spreadRate: 0.82,
    edibleValue: 0.7,
    shelterValue: 0.28,
    fuelMaterialValue: 0.18,
    biodiversityValue: 0.46,
    resilienceScore: 0.74,
    tags: Object.freeze(["grass", "grazing", "seed", "soil-binding", "fire-adapted"]),
  }),
  "shrubs": definePlant({
    key: "shrubs",
    displayName: "Shrubs",
    category: "shrubland",
    color: "#8f8a4e",
    biomePreferences: Object.freeze(["mediterranean-shrubland", "savanna", "temperate-grassland", "tundra", "badlands-rocky"]),
    temperatureRangeC: [-6, 32],
    precipitationRange: [0.12, 0.62],
    waterRequirement: 0.2,
    fertilityRequirement: 0.12,
    elevationTolerance: [0.36, 0.82],
    growthRate: 0.42,
    spreadRate: 0.52,
    edibleValue: 0.28,
    shelterValue: 0.48,
    fuelMaterialValue: 0.36,
    biodiversityValue: 0.38,
    resilienceScore: 0.78,
    tags: Object.freeze(["shrub", "browse", "berries", "cover", "seasonal"]),
  }),
  "reeds-wetland": definePlant({
    key: "reeds-wetland",
    displayName: "Reeds / Wetland Plants",
    category: "wetland",
    color: "#6aa56b",
    biomePreferences: Object.freeze(["river-wetland", "swamp-marsh", "lake", "coast"]),
    temperatureRangeC: [2, 34],
    precipitationRange: [0.36, 1],
    waterRequirement: 0.72,
    fertilityRequirement: 0.24,
    elevationTolerance: [0.32, 0.64],
    growthRate: 0.86,
    spreadRate: 0.68,
    edibleValue: 0.34,
    shelterValue: 0.66,
    fuelMaterialValue: 0.32,
    biodiversityValue: 0.62,
    resilienceScore: 0.68,
    tags: Object.freeze(["wetland", "reed", "marsh", "nesting", "fiber"]),
  }),
  "temperate-trees": definePlant({
    key: "temperate-trees",
    displayName: "Temperate Trees",
    category: "forest",
    color: "#2f7d4f",
    biomePreferences: Object.freeze(["temperate-forest", "river-wetland", "mediterranean-shrubland"]),
    temperatureRangeC: [4, 24],
    precipitationRange: [0.34, 0.92],
    waterRequirement: 0.42,
    fertilityRequirement: 0.38,
    elevationTolerance: [0.36, 0.74],
    growthRate: 0.44,
    spreadRate: 0.34,
    edibleValue: 0.34,
    shelterValue: 0.86,
    fuelMaterialValue: 0.9,
    biodiversityValue: 0.72,
    resilienceScore: 0.58,
    tags: Object.freeze(["forest", "timber", "nuts", "fruit", "canopy"]),
  }),
  "boreal-trees": definePlant({
    key: "boreal-trees",
    displayName: "Boreal Trees",
    category: "forest",
    color: "#3e6349",
    biomePreferences: Object.freeze(["boreal-forest", "tundra"]),
    temperatureRangeC: [-12, 10],
    precipitationRange: [0.18, 0.74],
    waterRequirement: 0.32,
    fertilityRequirement: 0.16,
    elevationTolerance: [0.38, 0.78],
    growthRate: 0.28,
    spreadRate: 0.24,
    edibleValue: 0.16,
    shelterValue: 0.76,
    fuelMaterialValue: 0.82,
    biodiversityValue: 0.48,
    resilienceScore: 0.78,
    tags: Object.freeze(["conifer", "timber", "needleleaf", "cold", "fuel"]),
  }),
  "tropical-trees": definePlant({
    key: "tropical-trees",
    displayName: "Tropical Trees",
    category: "forest",
    color: "#176d3b",
    biomePreferences: Object.freeze(["tropical-rainforest", "tropical-seasonal-forest", "swamp-marsh"]),
    temperatureRangeC: [20, 36],
    precipitationRange: [0.48, 1],
    waterRequirement: 0.56,
    fertilityRequirement: 0.34,
    elevationTolerance: [0.32, 0.72],
    growthRate: 0.68,
    spreadRate: 0.54,
    edibleValue: 0.46,
    shelterValue: 0.96,
    fuelMaterialValue: 0.86,
    biodiversityValue: 0.98,
    resilienceScore: 0.52,
    tags: Object.freeze(["forest", "tropical", "canopy", "fruit", "biodiverse", "timber"]),
  }),
  "desert-plants": definePlant({
    key: "desert-plants",
    displayName: "Desert Plants",
    category: "dryland",
    color: "#c6ad66",
    biomePreferences: Object.freeze(["desert", "badlands-rocky", "savanna", "mediterranean-shrubland"]),
    temperatureRangeC: [4, 45],
    precipitationRange: [0, 0.32],
    waterRequirement: 0.04,
    fertilityRequirement: 0.02,
    elevationTolerance: [0.34, 0.84],
    growthRate: 0.18,
    spreadRate: 0.22,
    edibleValue: 0.14,
    shelterValue: 0.22,
    fuelMaterialValue: 0.14,
    biodiversityValue: 0.18,
    resilienceScore: 0.92,
    tags: Object.freeze(["desert", "drought-resistant", "succulent", "sparse", "spines"]),
  }),
  "alpine-plants": definePlant({
    key: "alpine-plants",
    displayName: "Alpine Plants",
    category: "mountain",
    color: "#8fa06e",
    biomePreferences: Object.freeze(["alpine-mountain", "tundra", "badlands-rocky"]),
    temperatureRangeC: [-18, 12],
    precipitationRange: [0.08, 0.72],
    waterRequirement: 0.14,
    fertilityRequirement: 0.04,
    elevationTolerance: [0.66, 1],
    growthRate: 0.16,
    spreadRate: 0.18,
    edibleValue: 0.12,
    shelterValue: 0.2,
    fuelMaterialValue: 0.04,
    biodiversityValue: 0.2,
    resilienceScore: 0.86,
    tags: Object.freeze(["alpine", "cushion-plant", "thin-soil", "cold", "wind-resistant"]),
  }),
  "fungal-decomposers": definePlant({
    key: "fungal-decomposers",
    displayName: "Fungal / Decomposer Layer",
    category: "decomposer",
    color: "#7a5f4b",
    biomePreferences: Object.freeze(["temperate-forest", "boreal-forest", "tropical-rainforest", "tropical-seasonal-forest", "swamp-marsh"]),
    temperatureRangeC: [-2, 32],
    precipitationRange: [0.36, 1],
    waterRequirement: 0.46,
    fertilityRequirement: 0.24,
    elevationTolerance: [0.34, 0.78],
    growthRate: 0.54,
    spreadRate: 0.46,
    edibleValue: 0.2,
    shelterValue: 0.18,
    fuelMaterialValue: 0.06,
    biodiversityValue: 0.68,
    resilienceScore: 0.64,
    tags: Object.freeze(["fungal", "decomposer", "soil-food-web", "medicinal", "forest-floor"]),
  }),
});

export function getPlantDefinition(key: PlantKey): PlantDefinition {
  return PLANT_DEFINITIONS[key];
}

export function getPlantDefinitions(): readonly PlantDefinition[] {
  return PLANT_KEYS.map((key) => PLANT_DEFINITIONS[key]);
}
