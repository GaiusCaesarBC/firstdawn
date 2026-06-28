import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { prisma, createWorld, getWorldBySlug, type WorldWithPlanet } from "../../src/lib/worlds/world-lifecycle";

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
});
