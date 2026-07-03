import { WorldEnvironment, WorldStatus } from "@prisma/client";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { CANONICAL_PLANET_CONFIG, FIRST_DAWN_CANONICAL_SEED } from "../../src/lib/worlds/canonical-world";
import { prisma, createWorld, getWorldBySlug, syncCanonicalDefaultWorlds, type WorldWithPlanet } from "../../src/lib/worlds/world-lifecycle";

const createdSlugs = new Set<string>();

async function cleanupSlug(slug: string): Promise<void> {
  await prisma.world.deleteMany({ where: { slug } });
}

afterEach(async () => {
  for (const slug of [...createdSlugs]) {
    await cleanupSlug(slug);
    createdSlugs.delete(slug);
  }
  vi.restoreAllMocks();
});

describe("world lifecycle transactions", () => {
  it("returns a payload with planet when fetching by slug", async () => {
    const slug = `planet-query-${Date.now()}`;
    createdSlugs.add(slug);

    const mockWorld = {
      id: "world-planet",
      slug,
      name: "Planet Query World",
      planet: {
        id: "planet-planet",
        worldId: "world-planet",
        name: "Planet Query World Planet",
      },
    };

    const mockClient = {
      world: {
        findUnique: vi.fn().mockResolvedValue(mockWorld),
      },
    };

    const result = await getWorldBySlug(slug, { client: mockClient as any });

    expect(result).toEqual(mockWorld);
    expect(mockClient.world.findUnique).toHaveBeenCalledWith({
      where: { slug },
      include: { planet: true },
    });
    expectTypeOf(result).toMatchTypeOf<WorldWithPlanet | null>();
  });

  it("uses the transactional path when planet creation fails", async () => {
    const slug = `atomic-world-${Date.now()}`;
    createdSlugs.add(slug);

    const transactionClient = {
      world: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "world-1", slug, name: "Atomic World" }),
      },
      planet: {
        create: vi.fn().mockRejectedValueOnce(new Error("planet create failed")),
      },
      worldActionLog: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };

    const transactionSpy = vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(transactionClient));

    await expect(
      createWorld(
        {
          name: "Atomic World",
          slug,
          description: "Temporary world for transaction rollback testing.",
        },
        {
          client: prisma,
        },
      ),
    ).rejects.toThrow("planet create failed");

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(transactionClient.planet.create).toHaveBeenCalledTimes(1);
  });

  it("repairs canonical default world drift without resetting runtime state", async () => {
    const staleSandbox = {
      id: "sandbox-world",
      name: "Sandbox World",
      slug: "local-sandbox",
      environment: WorldEnvironment.SANDBOX,
      status: WorldStatus.ACTIVE,
      currentTick: 144n,
      timeScale: 4,
      tickDurationSeconds: 60,
      dayLengthSeconds: 86400,
      yearLengthDays: 365,
      axialTiltDegrees: 23.44,
      orbitalEccentricity: 0.0167,
      initialEpochName: "First Dawn",
      initialYear: 0,
      initialDay: 0,
      initialHour: 6,
      currentGeneration: 3,
      seed: FIRST_DAWN_CANONICAL_SEED,
      description: "Official immutable First Dawn world generated identically in every environment.",
      protected: false,
      planet: {
        id: "sandbox-planet",
        worldId: "sandbox-world",
        ...CANONICAL_PLANET_CONFIG,
        radiusKm: CANONICAL_PLANET_CONFIG.radiusKm + 10,
      },
    };

    const transactionClient = {
      world: {
        findUnique: vi.fn().mockImplementation(({ where }: any) =>
          where.slug === "local-sandbox" ? Promise.resolve(staleSandbox) : Promise.resolve(null),
        ),
        create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: `created-${data.slug}`, slug: data.slug })),
        update: vi.fn().mockResolvedValue({ ...staleSandbox, planet: CANONICAL_PLANET_CONFIG }),
      },
      worldActionLog: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };

    const transactionSpy = vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(transactionClient));

    const results = await syncCanonicalDefaultWorlds({ client: prisma, actor: "vitest" });
    const updateCall = transactionClient.world.update.mock.calls[0][0];

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({
      label: "Sandbox",
      slug: "local-sandbox",
      action: "repaired",
      drift: ["planet.radiusKm"],
    });
    expect(updateCall.where).toEqual({ id: staleSandbox.id });
    expect(updateCall.data.seed).toBe(FIRST_DAWN_CANONICAL_SEED);
    expect(updateCall.data.planet.upsert.update.radiusKm).toBe(CANONICAL_PLANET_CONFIG.radiusKm);
    expect(updateCall.data).not.toHaveProperty("status");
    expect(updateCall.data).not.toHaveProperty("currentTick");
    expect(updateCall.data).not.toHaveProperty("currentGeneration");
    expect(updateCall.data).not.toHaveProperty("timeScale");
  });
});
