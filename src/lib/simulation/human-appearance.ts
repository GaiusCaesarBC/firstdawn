import { createDeterministicRandom, type DeterministicRandom } from "./random";
import type {
  HumanAgeStage,
  HumanAgent,
  HumanAppearance,
  HumanBodyBuild,
  HumanBodyHeight,
  HumanClothingColor,
  HumanClothingStyle,
  HumanEyeColor,
  HumanFaceShape,
  HumanFacialHair,
  HumanFootwearStyle,
  HumanHairColor,
  HumanHairStyle,
  HumanPosture,
  HumanSex,
  HumanShoulderWidth,
  HumanSkinTone,
  HumanSleeveLength,
  HumanTrouserStyle,
} from "./human-types";

const APPEARANCE_VERSION = 2 as const;
const FOUNDER_SKIN_TONE: HumanSkinTone = "fair";

const SKIN_TONES: readonly HumanSkinTone[] = ["deep-brown", "brown", "medium-brown", "olive", "tan", "fair"];
const HAIR_COLORS: readonly HumanHairColor[] = ["black", "dark-brown", "brown", "auburn", "sandy"];
const HAIR_COLORS_WITH_GRAY: readonly HumanHairColor[] = ["black", "dark-brown", "brown", "auburn", "sandy", "gray"];
const HAIR_STYLES: readonly HumanHairStyle[] = ["short", "cropped", "shoulder", "long", "braided", "wrapped"];
const FACIAL_HAIR_STYLES: readonly HumanFacialHair[] = ["none", "stubble", "short-beard", "full-beard"];
const FACE_SHAPES: readonly HumanFaceShape[] = ["oval", "round", "long", "square"];
const BODY_BUILDS: readonly HumanBodyBuild[] = ["slender", "average", "sturdy", "broad"];
const BODY_HEIGHTS: readonly HumanBodyHeight[] = ["short", "average", "tall"];
const SHOULDER_WIDTHS: readonly HumanShoulderWidth[] = ["narrow", "average", "wide"];
const CLOTHING_STYLES: readonly HumanClothingStyle[] = ["simple-tunic", "woven-dress", "tunic-trousers", "wrapped-robe", "belted-wrap"];
const CLOTHING_COLORS: readonly HumanClothingColor[] = ["cream", "tan", "brown", "gray", "faded-green", "muted-blue"];
const EYE_COLORS: readonly HumanEyeColor[] = ["dark-brown", "brown", "hazel", "gray", "blue"];
const SLEEVE_LENGTHS: readonly HumanSleeveLength[] = ["short", "elbow", "long"];
const TROUSER_STYLES: readonly HumanTrouserStyle[] = ["none", "straight", "wrapped", "loose"];
const FOOTWEAR_STYLES: readonly HumanFootwearStyle[] = ["bare", "primitive-shoes", "leg-wraps"];
const POSTURES: readonly HumanPosture[] = ["upright", "relaxed", "stooped"];

export type HumanSpriteProportions = {
  widthScale: number;
  heightScale: number;
  headScale: number;
  postureOffset: number;
  showWrinkles: boolean;
  grayHair: boolean;
};

type HumanAppearanceV1 = {
  version: 1;
  seed: string;
  skinTone: HumanSkinTone;
  hairColor: HumanHairColor;
  hairStyle: HumanHairStyle;
  facialHair: HumanFacialHair;
  bodyBuild: HumanBodyBuild;
  clothingStyle: HumanClothingStyle;
  clothingColor: HumanClothingColor;
  accentColor: HumanClothingColor;
  eyeColor: HumanEyeColor;
};

function safeSeed(seed: string): string {
  return seed.trim() || "first-dawn-human-appearance";
}

function safeBirthTick(agent: Pick<HumanAgent, "birthTick">): bigint {
  try {
    return BigInt(agent.birthTick);
  } catch {
    return 0n;
  }
}

function appearanceSeed(worldSeed: string, humanId: string): string {
  return `${safeSeed(worldSeed)}:${humanId}:appearance:v${APPEARANCE_VERSION}`;
}

function isFoundingHumanId(humanId: string): boolean {
  return /(^|:)first-human-(male|female)$/.test(humanId);
}

function foundingHairColor(humanId: string, sex: HumanSex): HumanHairColor {
  if (sex === "female" || humanId.endsWith("first-human-female")) return "brown";
  return "dark-brown";
}

function withFoundingAppearanceDefaults(appearance: HumanAppearance, worldSeed: string, humanId: string, sex: HumanSex): HumanAppearance {
  if (!isFoundingHumanId(humanId)) return appearance;

  const femaleFounder = sex === "female" || humanId.endsWith("first-human-female");

  return {
    ...appearance,
    seed: appearanceSeed(worldSeed, humanId),
    skinTone: FOUNDER_SKIN_TONE,
    hairColor: foundingHairColor(humanId, sex),
    hairStyle: femaleFounder ? "long" : "shoulder",
    facialHair: femaleFounder ? "none" : "full-beard",
    bodyBuild: femaleFounder ? "average" : "sturdy",
    bodyHeight: "average",
    shoulderWidth: femaleFounder ? "average" : "wide",
    clothingStyle: femaleFounder ? "woven-dress" : "wrapped-robe",
    clothingColor: "cream",
    accentColor: "tan",
    sleeveLength: "long",
    trouserStyle: "none",
    beltColor: "brown",
    footwearStyle: "primitive-shoes",
    posture: appearance.posture,
  };
}

function randomFor(worldSeed: string, agent: Pick<HumanAgent, "id" | "birthTick">): DeterministicRandom {
  return createDeterministicRandom({
    worldSeed: safeSeed(worldSeed),
    tick: safeBirthTick(agent),
    systemName: `human-appearance:${agent.id}`,
  });
}

function detailRandomFor(worldSeed: string, agent: Pick<HumanAgent, "id" | "birthTick">): DeterministicRandom {
  return createDeterministicRandom({
    worldSeed: safeSeed(worldSeed),
    tick: safeBirthTick(agent),
    systemName: `human-appearance-detail:${agent.id}`,
  });
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isHumanAppearanceV1(value: unknown): value is HumanAppearanceV1 {
  if (!value || typeof value !== "object") return false;
  const appearance = value as Partial<HumanAppearanceV1>;

  return appearance.version === 1
    && typeof appearance.seed === "string"
    && isOneOf(appearance.skinTone, SKIN_TONES)
    && isOneOf(appearance.hairColor, HAIR_COLORS_WITH_GRAY)
    && isOneOf(appearance.hairStyle, HAIR_STYLES)
    && isOneOf(appearance.facialHair, FACIAL_HAIR_STYLES)
    && isOneOf(appearance.bodyBuild, BODY_BUILDS)
    && isOneOf(appearance.clothingStyle, CLOTHING_STYLES)
    && isOneOf(appearance.clothingColor, CLOTHING_COLORS)
    && isOneOf(appearance.accentColor, CLOTHING_COLORS)
    && isOneOf(appearance.eyeColor, EYE_COLORS);
}

export function isHumanAppearance(value: unknown): value is HumanAppearance {
  if (!value || typeof value !== "object") return false;
  const appearance = value as Partial<HumanAppearance>;

  return appearance.version === APPEARANCE_VERSION
    && typeof appearance.seed === "string"
    && isOneOf(appearance.skinTone, SKIN_TONES)
    && isOneOf(appearance.hairColor, HAIR_COLORS_WITH_GRAY)
    && isOneOf(appearance.hairStyle, HAIR_STYLES)
    && isOneOf(appearance.facialHair, FACIAL_HAIR_STYLES)
    && isOneOf(appearance.faceShape, FACE_SHAPES)
    && isOneOf(appearance.bodyBuild, BODY_BUILDS)
    && isOneOf(appearance.bodyHeight, BODY_HEIGHTS)
    && isOneOf(appearance.shoulderWidth, SHOULDER_WIDTHS)
    && isOneOf(appearance.clothingStyle, CLOTHING_STYLES)
    && isOneOf(appearance.clothingColor, CLOTHING_COLORS)
    && isOneOf(appearance.accentColor, CLOTHING_COLORS)
    && isOneOf(appearance.sleeveLength, SLEEVE_LENGTHS)
    && isOneOf(appearance.trouserStyle, TROUSER_STYLES)
    && isOneOf(appearance.beltColor, CLOTHING_COLORS)
    && isOneOf(appearance.footwearStyle, FOOTWEAR_STYLES)
    && isOneOf(appearance.posture, POSTURES)
    && isOneOf(appearance.eyeColor, EYE_COLORS);
}

function inheritedTrait<T extends string>(
  random: DeterministicRandom,
  parents: readonly HumanAppearance[],
  read: (appearance: HumanAppearance) => T,
  fallback: readonly T[],
): T {
  if (parents.length === 0 || random.boolean(0.12)) {
    return random.pick(fallback);
  }

  if (parents.length === 1 || random.boolean(0.5)) {
    return read(random.pick(parents));
  }

  return read(parents[random.integer(0, 1)]);
}

function facialHairFor(random: DeterministicRandom, sex: HumanSex, parents: readonly HumanAppearance[]): HumanFacialHair {
  if (sex === "female") return "none";
  const inherited = inheritedTrait(random, parents, (appearance) => appearance.facialHair, FACIAL_HAIR_STYLES);

  if (inherited !== "none" && random.boolean(0.76)) return inherited;
  return random.pick(FACIAL_HAIR_STYLES);
}

function postureFor(random: DeterministicRandom, parents: readonly HumanAppearance[], ageStage?: HumanAgeStage): HumanPosture {
  if (ageStage === "Elder" && random.boolean(0.72)) return "stooped";
  if (ageStage === "Child" || ageStage === "Infant") return random.pick(["upright", "relaxed"] as const);
  return inheritedTrait(random, parents, (appearance) => appearance.posture, POSTURES);
}

function trouserStyleFor(random: DeterministicRandom, clothingStyle: HumanClothingStyle, parents: readonly HumanAppearance[]): HumanTrouserStyle {
  if (clothingStyle === "woven-dress" || clothingStyle === "wrapped-robe") return "none";
  if (clothingStyle === "tunic-trousers") {
    return inheritedTrait(random, parents, (appearance) => appearance.trouserStyle === "none" ? "straight" : appearance.trouserStyle, ["straight", "wrapped", "loose"] as const);
  }
  return inheritedTrait(random, parents, (appearance) => appearance.trouserStyle, TROUSER_STYLES);
}

function completeAppearance(input: {
  base: HumanAppearanceV1;
  worldSeed: string;
  humanId: string;
  birthTick: string;
  sex: HumanSex;
  ageStage?: HumanAgeStage;
  parentAppearances?: readonly HumanAppearance[];
}): HumanAppearance {
  const random = detailRandomFor(input.worldSeed, { id: input.humanId, birthTick: input.birthTick });
  const parents = input.parentAppearances?.filter(isHumanAppearance) ?? [];
  const bodyHeight = inheritedTrait(random, parents, (appearance) => appearance.bodyHeight, BODY_HEIGHTS);
  const shoulderWidth = inheritedTrait(random, parents, (appearance) => appearance.shoulderWidth, SHOULDER_WIDTHS);
  const sleeveLength = input.base.clothingStyle === "wrapped-robe"
    ? random.pick(["elbow", "long"] as const)
    : inheritedTrait(random, parents, (appearance) => appearance.sleeveLength, SLEEVE_LENGTHS);

  return {
    ...input.base,
    version: APPEARANCE_VERSION,
    seed: appearanceSeed(input.worldSeed, input.humanId),
    faceShape: inheritedTrait(random, parents, (appearance) => appearance.faceShape, FACE_SHAPES),
    bodyHeight,
    shoulderWidth,
    sleeveLength,
    trouserStyle: trouserStyleFor(random, input.base.clothingStyle, parents),
    beltColor: inheritedTrait(random, parents, (appearance) => appearance.beltColor, CLOTHING_COLORS.filter((color) => color !== input.base.clothingColor)),
    footwearStyle: inheritedTrait(random, parents, (appearance) => appearance.footwearStyle, FOOTWEAR_STYLES),
    posture: postureFor(random, parents, input.ageStage),
  };
}

export function createHumanAppearance(input: {
  worldSeed: string;
  humanId: string;
  birthTick: string;
  sex: HumanSex;
  ageStage?: HumanAgeStage;
  parentAppearances?: readonly HumanAppearance[];
}): HumanAppearance {
  const random = randomFor(input.worldSeed, { id: input.humanId, birthTick: input.birthTick });
  const parents = input.parentAppearances?.filter(isHumanAppearance) ?? [];
  const clothingStyleFallback = input.sex === "female"
    ? (["simple-tunic", "woven-dress", "wrapped-robe", "belted-wrap"] as const)
    : (["simple-tunic", "tunic-trousers", "wrapped-robe", "belted-wrap"] as const);
  const clothingColor = inheritedTrait(random, parents, (appearance) => appearance.clothingColor, CLOTHING_COLORS);
  const accentFallback = CLOTHING_COLORS.filter((color) => color !== clothingColor);
  const clothingStyle = inheritedTrait(random, parents, (appearance) => appearance.clothingStyle, clothingStyleFallback);

  const base: HumanAppearanceV1 = {
    version: 1,
    seed: appearanceSeed(input.worldSeed, input.humanId),
    skinTone: isFoundingHumanId(input.humanId) ? FOUNDER_SKIN_TONE : inheritedTrait(random, parents, (appearance) => appearance.skinTone, SKIN_TONES),
    hairColor: isFoundingHumanId(input.humanId)
      ? foundingHairColor(input.humanId, input.sex)
      : inheritedTrait(random, parents, (appearance) => appearance.hairColor === "gray" ? "dark-brown" : appearance.hairColor, HAIR_COLORS),
    hairStyle: inheritedTrait(random, parents, (appearance) => appearance.hairStyle, HAIR_STYLES),
    facialHair: facialHairFor(random, input.sex, parents),
    bodyBuild: inheritedTrait(random, parents, (appearance) => appearance.bodyBuild, BODY_BUILDS),
    clothingStyle,
    clothingColor,
    accentColor: inheritedTrait(random, parents, (appearance) => appearance.accentColor, accentFallback.length > 0 ? accentFallback : CLOTHING_COLORS),
    eyeColor: inheritedTrait(random, parents, (appearance) => appearance.eyeColor, EYE_COLORS),
  };

  return withFoundingAppearanceDefaults(completeAppearance({ ...input, base, parentAppearances: parents }), input.worldSeed, input.humanId, input.sex);
}

export function normalizeHumanAppearance(
  agent: HumanAgent,
  worldSeed: string,
  parentAppearances: readonly HumanAppearance[] = [],
): HumanAppearance {
  const existing = (agent as Partial<HumanAgent>).appearance;
  if (isHumanAppearance(existing)) return withFoundingAppearanceDefaults(existing, worldSeed, agent.id, agent.sex);
  if (isHumanAppearanceV1(existing)) {
    return withFoundingAppearanceDefaults(completeAppearance({
      base: existing,
      worldSeed,
      humanId: agent.id,
      birthTick: agent.birthTick,
      sex: agent.sex,
      ageStage: agent.ageStage,
      parentAppearances,
    }), worldSeed, agent.id, agent.sex);
  }

  return createHumanAppearance({
    worldSeed,
    humanId: agent.id,
    birthTick: agent.birthTick,
    sex: agent.sex,
    ageStage: agent.ageStage,
    parentAppearances,
  });
}

export function normalizeLegacyHumanAppearance(input: {
  appearance: unknown;
  worldSeed: string;
  humanId: string;
  birthTick: string;
  sex: HumanSex;
  ageStage?: HumanAgeStage;
}): HumanAppearance {
  if (isHumanAppearance(input.appearance)) return withFoundingAppearanceDefaults(input.appearance, input.worldSeed, input.humanId, input.sex);
  if (isHumanAppearanceV1(input.appearance)) {
    return withFoundingAppearanceDefaults(completeAppearance({
      base: input.appearance,
      worldSeed: input.worldSeed,
      humanId: input.humanId,
      birthTick: input.birthTick,
      sex: input.sex,
      ageStage: input.ageStage,
    }), input.worldSeed, input.humanId, input.sex);
  }

  return createHumanAppearance(input);
}

export function normalizeHumanAppearances(agents: readonly HumanAgent[], worldSeed: string): HumanAgent[] {
  const appearancesById = new Map<string, HumanAppearance>();
  const sorted = [...agents].sort((left, right) => {
    const generationDelta = left.generation - right.generation;
    if (generationDelta !== 0) return generationDelta;
    const birthDelta = safeBirthTick(left) - safeBirthTick(right);
    if (birthDelta !== 0n) return birthDelta < 0n ? -1 : 1;
    return left.id.localeCompare(right.id);
  });

  for (const agent of sorted) {
    const parentAppearances = (agent.biologicalParentIds ?? [])
      .map((parentId) => appearancesById.get(parentId))
      .filter((appearance): appearance is HumanAppearance => Boolean(appearance));
    appearancesById.set(agent.id, normalizeHumanAppearance(agent, worldSeed, parentAppearances));
  }

  return agents.map((agent) => ({
    ...agent,
    appearance: appearancesById.get(agent.id) ?? normalizeHumanAppearance(agent, worldSeed),
  }));
}

export function getHumanSpriteProportions(ageStage: HumanAgeStage, bodyBuild: HumanBodyBuild): HumanSpriteProportions {
  const buildWidth: Record<HumanBodyBuild, number> = {
    slender: 0.86,
    average: 1,
    sturdy: 1.1,
    broad: 1.2,
  };

  switch (ageStage) {
    case "Infant":
      return { widthScale: buildWidth[bodyBuild] * 0.64, heightScale: 0.56, headScale: 1.18, postureOffset: 1, showWrinkles: false, grayHair: false };
    case "Child":
      return { widthScale: buildWidth[bodyBuild] * 0.76, heightScale: 0.72, headScale: 1.12, postureOffset: 0.5, showWrinkles: false, grayHair: false };
    case "Adolescent":
      return { widthScale: buildWidth[bodyBuild] * 0.9, heightScale: 0.88, headScale: 1.04, postureOffset: 0, showWrinkles: false, grayHair: false };
    case "Elder":
      return { widthScale: buildWidth[bodyBuild] * 0.96, heightScale: 0.96, headScale: 1, postureOffset: 1.2, showWrinkles: true, grayHair: true };
    case "Adult":
    default:
      return { widthScale: buildWidth[bodyBuild], heightScale: 1, headScale: 1, postureOffset: 0, showWrinkles: false, grayHair: false };
  }
}