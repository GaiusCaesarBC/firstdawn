import { afterAll, afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { WorldEnvironment, WorldStatus } from "@prisma/client";

import { POST as postWorldAction } from "../../src/app/api/worlds/actions/route";
import {
  prisma,
  PRODUCTION_CONFIRMATION_PHRASE,
} from "../../src/lib/worlds/world-lifecycle";
import { cleanupTestWorld, createTestWorld } from "../helpers/test-worlds";

const createdSlugs = new Set<string>();

async function track<T extends { slug: string }>(worldPromise: Promise<T>): Promise<T> {
  const world = await worldPromise;
  createdSlugs.add(world.slug);
  return world;
}

function actionRequest(fields: Record<string, string>): NextRequest {
  const body = new URLSearchParams(fields);

  return new NextRequest("http://localhost/api/worlds/actions", {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
}

function redirectSearch(response: Response): URLSearchParams {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location ?? "http://localhost/worlds").searchParams;
}

afterEach(async () => {
  for (const slug of [...createdSlugs]) {
    await cleanupTestWorld(slug);
    createdSlugs.delete(slug);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("developer world action route", () => {
  it("activates, pauses, and protects a test world through the API route", async () => {
    const world = await track(
      createTestWorld({
        environment: WorldEnvironment.EXPERIMENT,
        status: WorldStatus.DRAFT,
      }),
    );

    const activateResponse = await postWorldAction(actionRequest({
      action: "activate",
      slug: world.slug,
    }));
    expect(activateResponse.status).toBe(303);
    expect(redirectSearch(activateResponse).get("notice")).toContain("activated");
    await expect(prisma.world.findUniqueOrThrow({ where: { id: world.id } })).resolves.toMatchObject({
      status: WorldStatus.ACTIVE,
    });

    const pauseResponse = await postWorldAction(actionRequest({
      action: "pause",
      slug: world.slug,
    }));
    expect(pauseResponse.status).toBe(303);
    expect(redirectSearch(pauseResponse).get("notice")).toContain("paused");
    await expect(prisma.world.findUniqueOrThrow({ where: { id: world.id } })).resolves.toMatchObject({
      status: WorldStatus.PAUSED,
    });

    const protectResponse = await postWorldAction(actionRequest({
      action: "protect",
      slug: world.slug,
    }));
    expect(protectResponse.status).toBe(303);
    expect(redirectSearch(protectResponse).get("notice")).toContain("protected");
    await expect(prisma.world.findUniqueOrThrow({ where: { id: world.id } })).resolves.toMatchObject({
      protected: true,
    });
  });

  it("blocks archive for protected worlds through the API route", async () => {
    const world = await track(createTestWorld({ protected: true }));

    const response = await postWorldAction(actionRequest({
      action: "archive",
      slug: world.slug,
    }));
    const updatedWorld = await prisma.world.findUniqueOrThrow({ where: { id: world.id } });

    expect(response.status).toBe(303);
    expect(redirectSearch(response).get("error")).toContain("Protected world cannot be archived");
    expect(updatedWorld.status).not.toBe(WorldStatus.ARCHIVED);
  });

  it("requires the exact production confirmation phrase for production actions", async () => {
    const world = await track(
      createTestWorld({
        description: "Temporary isolated production route confirmation test world.",
        environment: WorldEnvironment.PRODUCTION,
        protected: true,
        status: WorldStatus.PAUSED,
      }),
    );

    const blockedResponse = await postWorldAction(actionRequest({
      action: "protect",
      productionConfirmation: "confirm production world change",
      slug: world.slug,
    }));
    expect(blockedResponse.status).toBe(303);
    expect(redirectSearch(blockedResponse).get("error")).toContain(PRODUCTION_CONFIRMATION_PHRASE);

    const allowedResponse = await postWorldAction(actionRequest({
      action: "protect",
      productionConfirmation: PRODUCTION_CONFIRMATION_PHRASE,
      slug: world.slug,
    }));
    expect(allowedResponse.status).toBe(303);
    expect(redirectSearch(allowedResponse).get("notice")).toContain("protected");
  });
});
