import { randomBytes } from "node:crypto";

import { WorldEnvironment, WorldStatus, type World } from "@prisma/client";

import {
  createWorld,
  prisma,
  type CreateWorldInput,
} from "../../src/lib/worlds/world-lifecycle";

function randomSafeSuffix(): string {
  return randomBytes(6).toString("hex");
}

export function createTestWorldSlug(prefix = "test-world"): string {
  return `${prefix}-${Date.now()}-${randomSafeSuffix()}`;
}

export async function createTestWorld(input: Partial<CreateWorldInput> = {}): Promise<World> {
  const slug = input.slug ?? createTestWorldSlug();

  return createWorld(
    {
      name: input.name ?? `Test World ${slug}`,
      slug,
      environment: input.environment ?? WorldEnvironment.SANDBOX,
      status: input.status ?? WorldStatus.DRAFT,
      currentTick: input.currentTick ?? 0n,
      timeScale: input.timeScale ?? 1,
      tickDurationSeconds: input.tickDurationSeconds,
      dayLengthSeconds: input.dayLengthSeconds,
      yearLengthDays: input.yearLengthDays,
      currentGeneration: input.currentGeneration ?? 0,
      seed: input.seed ?? `${slug}-seed`,
      description: input.description ?? "Temporary isolated test world.",
      protected: input.protected ?? false,
      planet: input.planet,
    },
    {
      actor: "vitest",
      allowMultipleActivePerEnvironment: true,
      reason: "create isolated scheduler test world",
    },
  );
}

export async function createActiveSandboxTestWorld(
  input: Partial<CreateWorldInput> = {},
): Promise<World> {
  return createTestWorld({
    ...input,
    environment: WorldEnvironment.SANDBOX,
    status: WorldStatus.ACTIVE,
  });
}

export async function cleanupTestWorld(worldOrSlug: Pick<World, "slug"> | string): Promise<void> {
  const slug = typeof worldOrSlug === "string" ? worldOrSlug : worldOrSlug.slug;

  if (!slug.startsWith("test-world-")) {
    throw new Error(`Refusing to clean up non-test world slug: ${slug}`);
  }

  await prisma.world.deleteMany({ where: { slug } });
}
