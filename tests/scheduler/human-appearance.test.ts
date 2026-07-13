import { describe, expect, it } from "vitest";

import {
  createHumanAppearance,
  getHumanSpriteProportions,
  normalizeHumanAppearances,
} from "../../src/lib/simulation/human-appearance";
import {
  buildHumanMapSpriteModel,
  buildHumanSpriteModel,
  HUMAN_HAIR_COLORS,
  HUMAN_SPRITE_LAYER_IDS,
  HUMAN_SPRITE_NATIVE_HEIGHT,
  HUMAN_SPRITE_NATIVE_WIDTH,
} from "../../src/lib/simulation/human-sprite";
import { spawnFirstTwoHumans } from "../../src/lib/simulation/human-engine";
import { normalizeAtlasSnapshotHumanAppearances, type AtlasSnapshot } from "../../src/lib/worlds/map-atlas";
import type { HumanAgent } from "../../src/lib/simulation/human-types";

const world = {
  id: "human-appearance-test-world",
  seed: "human-appearance-seed",
};

describe("Human appearance generation", () => {
  it("creates deterministic permanent appearances for the same human seed", () => {
    const first = spawnFirstTwoHumans(world, 0n);
    const second = spawnFirstTwoHumans(world, 0n);

    expect(first.agents.map((agent) => agent.appearance)).toEqual(second.agents.map((agent) => agent.appearance));
    expect(first.agents[0].appearance.seed).toContain(first.agents[0].id);
    expect(first.agents[0].appearance).not.toEqual(first.agents[1].appearance);
  });

  it("starts founding humans with light skin", () => {
    const state = spawnFirstTwoHumans(world, 0n);

    expect(state.agents.map((agent) => agent.appearance.skinTone)).toEqual(["fair", "fair"]);
    expect(state.agents.map((agent) => agent.appearance.hairColor)).toEqual(["dark-brown", "brown"]);
  });

  it("normalizes existing worlds that do not have appearance data", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const oldAgents = state.agents.map((agent) => {
      const { appearance: _appearance, ...legacyAgent } = agent;
      return legacyAgent;
    }) as unknown as HumanAgent[];

    const normalized = normalizeHumanAppearances(oldAgents, world.seed);
    const repeated = normalizeHumanAppearances(oldAgents, world.seed);

    expect(normalized.every((agent) => agent.appearance.version === 2)).toBe(true);
    expect(normalized.map((agent) => agent.appearance)).toEqual(repeated.map((agent) => agent.appearance));
  });

  it("keeps inherited child traits related but not identical to parents", () => {
    const parents = spawnFirstTwoHumans(world, 0n).agents;
    const child = createHumanAppearance({
      worldSeed: world.seed,
      humanId: `${world.id}:child:test:1`,
      birthTick: "4",
      sex: "female",
      parentAppearances: parents.map((parent) => parent.appearance),
    });
    const parentValues = parents.map((parent) => parent.appearance);
    const inheritedMatches = [
      parentValues.some((parent) => parent.skinTone === child.skinTone),
      parentValues.some((parent) => parent.hairColor === child.hairColor),
      parentValues.some((parent) => parent.eyeColor === child.eyeColor),
      parentValues.some((parent) => parent.bodyBuild === child.bodyBuild),
    ].filter(Boolean).length;

    expect(inheritedMatches).toBeGreaterThanOrEqual(2);
    expect(parentValues).not.toContainEqual(child);
  });

  it("upgrades persisted atlas humans that predate appearance fields", () => {
    const snapshot = {
      worldId: world.id,
      fingerprint: { seed: world.seed },
      humans: {
        agents: [{
          id: "first-human-male",
          label: "First Male Human",
          sex: "male",
          approxAgeYears: 20,
          currentCellId: "cell-09-18",
        }],
      },
    } as unknown as AtlasSnapshot;

    const upgraded = normalizeAtlasSnapshotHumanAppearances(snapshot);
    const repeated = normalizeAtlasSnapshotHumanAppearances(snapshot);

    expect(upgraded.humans.agents[0].appearance.version).toBe(2);
    expect(upgraded.humans.agents[0].ageStage).toBe("Adult");
    expect(upgraded.humans.agents[0].appearance).toEqual(repeated.humans.agents[0].appearance);
  });
  it("builds the same authored pixel sprite for the same human identity", () => {
    const human = spawnFirstTwoHumans(world, 0n).agents[0];
    const first = buildHumanSpriteModel(human);
    const second = buildHumanSpriteModel(human);

    expect(first).toEqual(second);
    expect(first.nativeResolution).toBe("48x72");
    expect(first.width).toBe(HUMAN_SPRITE_NATIVE_WIDTH);
    expect(first.height).toBe(HUMAN_SPRITE_NATIVE_HEIGHT);
    expect(first.layerIds).toEqual(HUMAN_SPRITE_LAYER_IDS);
    expect(first.metadata.hasWeaponsOrEquipment).toBe(false);
  });

  it("creates visibly different sprite pixels for different appearance seeds", () => {
    const first = spawnFirstTwoHumans(world, 0n).agents[0];
    const differentAppearance = createHumanAppearance({
      worldSeed: "different-appearance-seed",
      humanId: `${world.id}:different-human`,
      birthTick: "0",
      sex: "male",
    });
    const different = { ...first, id: `${world.id}:different-human`, appearance: differentAppearance };

    expect(buildHumanSpriteModel(first).pixels).not.toEqual(buildHumanSpriteModel(different).pixels);
    expect(buildHumanMapSpriteModel(first).pixels).not.toEqual(buildHumanMapSpriteModel(different).pixels);
  });

  it("does not force male and female humans into one identical body template", () => {
    const [male, female] = spawnFirstTwoHumans(world, 0n).agents;
    const maleSprite = buildHumanSpriteModel(male);
    const femaleSprite = buildHumanSpriteModel(female);

    expect(maleSprite.metadata.clothingStyle).not.toBeUndefined();
    expect(femaleSprite.metadata.clothingStyle).not.toBeUndefined();
    expect(maleSprite.pixels).not.toEqual(femaleSprite.pixels);
  });

  it("renders child proportions as shorter with a large readable head", () => {
    const adult = spawnFirstTwoHumans(world, 0n).agents[0];
    const child = { ...adult, ageStage: "Child" as const, approxAgeYears: 7 };
    const adultSprite = buildHumanSpriteModel(adult);
    const childSprite = buildHumanSpriteModel(child);
    const adultNonShadowY = adultSprite.pixels.filter((pixel) => pixel.color !== "rgba(3, 7, 12, 0.5)").map((pixel) => pixel.y);
    const childNonShadowY = childSprite.pixels.filter((pixel) => pixel.color !== "rgba(3, 7, 12, 0.5)").map((pixel) => pixel.y);

    expect(Math.max(...childNonShadowY) - Math.min(...childNonShadowY)).toBeLessThan(Math.max(...adultNonShadowY) - Math.min(...adultNonShadowY));
    expect(childSprite.pixels.length).toBeGreaterThan(80);
  });

  it("renders elders with gray hair, posture, and face age pixels", () => {
    const adult = spawnFirstTwoHumans(world, 0n).agents[0];
    const elder = { ...adult, ageStage: "Elder" as const, approxAgeYears: 72 };
    const sprite = buildHumanSpriteModel(elder);

    expect(sprite.metadata.effectiveHairColor).toBe(HUMAN_HAIR_COLORS.gray);
    expect(sprite.metadata.posture).toBe("stooped");
    expect(sprite.pixels.some((pixel) => pixel.color === "#6b6258")).toBe(true);
  });

  it("upgrades version-one saved appearance records while preserving visible base traits", () => {
    const state = spawnFirstTwoHumans(world, 0n);
    const legacyAgents = state.agents.map((agent) => ({
      ...agent,
      appearance: {
        version: 1 as const,
        seed: agent.appearance.seed,
        skinTone: agent.appearance.skinTone,
        hairColor: agent.appearance.hairColor,
        hairStyle: agent.appearance.hairStyle,
        facialHair: agent.appearance.facialHair,
        bodyBuild: agent.appearance.bodyBuild,
        clothingStyle: agent.appearance.clothingStyle,
        clothingColor: agent.appearance.clothingColor,
        accentColor: agent.appearance.accentColor,
        eyeColor: agent.appearance.eyeColor,
      },
    })) as unknown as HumanAgent[];

    const upgraded = normalizeHumanAppearances(legacyAgents, world.seed);
    const repeated = normalizeHumanAppearances(legacyAgents, world.seed);

    expect(upgraded.map((agent) => agent.appearance)).toEqual(repeated.map((agent) => agent.appearance));
    expect(upgraded[0].appearance.version).toBe(2);
    expect(upgraded[0].appearance.skinTone).toBe(legacyAgents[0].appearance.skinTone);
    expect(upgraded[0].appearance.clothingColor).toBe(legacyAgents[0].appearance.clothingColor);
    expect(upgraded[0].appearance.faceShape).toBeTruthy();
    expect(upgraded[0].appearance.footwearStyle).toBeTruthy();
  });

  it("changes sprite proportions across child, adolescent, adult, and elder stages", () => {
    const child = getHumanSpriteProportions("Child", "average");
    const adolescent = getHumanSpriteProportions("Adolescent", "average");
    const adult = getHumanSpriteProportions("Adult", "average");
    const elder = getHumanSpriteProportions("Elder", "average");

    expect(child.heightScale).toBeLessThan(adolescent.heightScale);
    expect(adolescent.heightScale).toBeLessThan(adult.heightScale);
    expect(elder.grayHair).toBe(true);
    expect(elder.showWrinkles).toBe(true);
  });
});