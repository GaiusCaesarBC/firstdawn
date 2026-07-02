import {
  Prisma,
  PrismaClient,
  WorldEnvironment,
  WorldStatus,
  type World,
} from "@prisma/client";

import { DEFAULT_WORLD_TIME_CONFIG } from "../simulation/time-engine";
import {
  CANONICAL_PLANET_CONFIG,
  createCanonicalWorldInput,
  FIRST_DAWN_CANONICAL_SEED,
  FIRST_DAWN_CANONICAL_WORLD,
} from "./canonical-world";

export const PRODUCTION_CONFIRMATION_PHRASE = "CONFIRM PRODUCTION WORLD CHANGE";
export const DEFAULT_WORLD_ACTION_ACTOR = "local-developer";

type WorldLifecycleClient = PrismaClient | Prisma.TransactionClient;

type WorldActionOptions = {
  actor?: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

type WorldLifecycleOptions = WorldActionOptions & {
  client?: WorldLifecycleClient;
};

type ActiveWorldOptions = WorldLifecycleOptions & {
  allowMultipleActivePerEnvironment?: boolean;
  confirmProductionChange?: string | null;
};

type UnprotectWorldOptions = WorldLifecycleOptions & {
  confirmProductionChange?: string | null;
  confirmProductionSlug?: string;
};

export type PlanetInput = {
  name?: string;
  radiusKm?: number;
  gravityMS2?: number;
  massKg?: number;
  rotationPeriodHours?: number;
  orbitalPeriodDays?: number;
  axialTiltDegrees?: number;
  orbitalEccentricity?: number;
  atmospherePressureKPa?: number;
  atmosphereComposition?: Prisma.InputJsonValue | null;
  oceanCoveragePercent?: number;
};

export type CreateWorldInput = {
  name: string;
  slug?: string;
  environment?: WorldEnvironment;
  status?: WorldStatus;
  currentTick?: bigint | number;
  timeScale?: number;
  tickDurationSeconds?: number;
  dayLengthSeconds?: number;
  yearLengthDays?: number;
  axialTiltDegrees?: number;
  orbitalEccentricity?: number;
  initialEpochName?: string;
  initialYear?: number;
  initialDay?: number;
  initialHour?: number;
  currentGeneration?: number;
  seed?: string | null;
  description?: string | null;
  protected?: boolean;
  planet?: PlanetInput;
};

export type ListWorldsInput = {
  environment?: WorldEnvironment;
  status?: WorldStatus;
  includeArchived?: boolean;
  excludeTestWorlds?: boolean;
};

export type WorldWithPlanet = Prisma.WorldGetPayload<{
  include: { planet: true };
}>;

export type WorldLifecycleErrorCode =
  | "ACTIVE_WORLD_EXISTS"
  | "INVALID_WORLD"
  | "PROTECTED_WORLD"
  | "PRODUCTION_CONFIRMATION_REQUIRED"
  | "WORLD_NOT_FOUND";

export class WorldLifecycleError extends Error {
  public readonly code: WorldLifecycleErrorCode;

  constructor(message: string, code: WorldLifecycleErrorCode) {
    super(message);
    this.name = "WorldLifecycleError";
    this.code = code;
  }
}

const globalForPrisma = globalThis as unknown as {
  firstDawnPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.firstDawnPrisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.firstDawnPrisma = prisma;
}

const WORLD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function makeSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeBigInt(value: bigint | number | undefined): bigint {
  if (value === undefined) {
    return 0n;
  }

  if (typeof value === "number" && !Number.isInteger(value)) {
    throw new WorldLifecycleError("currentTick must be an integer.", "INVALID_WORLD");
  }

  return BigInt(value);
}

function assertValidSlug(slug: string): void {
  if (slug.length < 3 || slug.length > 80 || !WORLD_SLUG_PATTERN.test(slug)) {
    throw new WorldLifecycleError(
      "World slugs must be 3-80 lowercase letters, numbers, or hyphen-separated words.",
      "INVALID_WORLD",
    );
  }
}

function assertValidWorldInput(input: Required<Pick<CreateWorldInput, "name">> & {
  slug: string;
  environment: WorldEnvironment;
  status: WorldStatus;
  currentTick: bigint;
  timeScale: number;
  tickDurationSeconds: number;
  dayLengthSeconds: number;
  yearLengthDays: number;
  axialTiltDegrees: number;
  orbitalEccentricity: number;
  initialEpochName: string;
  initialYear: number;
  initialDay: number;
  initialHour: number;
  currentGeneration: number;
  seed?: string | null;
  description?: string | null;
  protected: boolean;
  planet?: PlanetInput;
}): void {
  if (!input.name.trim()) {
    throw new WorldLifecycleError("World name is required.", "INVALID_WORLD");
  }

  assertValidSlug(input.slug);

  if (input.currentTick < 0n) {
    throw new WorldLifecycleError("currentTick cannot be negative.", "INVALID_WORLD");
  }

  if (input.currentGeneration < 0) {
    throw new WorldLifecycleError("currentGeneration cannot be negative.", "INVALID_WORLD");
  }

  if (!Number.isFinite(input.timeScale) || input.timeScale <= 0) {
    throw new WorldLifecycleError("timeScale must be a positive finite number.", "INVALID_WORLD");
  }

  if (!Number.isFinite(input.tickDurationSeconds) || input.tickDurationSeconds <= 0) {
    throw new WorldLifecycleError("tickDurationSeconds must be a positive finite number.", "INVALID_WORLD");
  }

  if (!Number.isFinite(input.dayLengthSeconds) || input.dayLengthSeconds <= 0) {
    throw new WorldLifecycleError("dayLengthSeconds must be a positive finite number.", "INVALID_WORLD");
  }

  if (!Number.isInteger(input.yearLengthDays) || input.yearLengthDays < 1) {
    throw new WorldLifecycleError("yearLengthDays must be a positive integer.", "INVALID_WORLD");
  }

  if (!Number.isFinite(input.axialTiltDegrees) || input.axialTiltDegrees < 0 || input.axialTiltDegrees > 90) {
    throw new WorldLifecycleError("axialTiltDegrees must be a finite number between 0 and 90.", "INVALID_WORLD");
  }

  if (!Number.isFinite(input.orbitalEccentricity) || input.orbitalEccentricity < 0 || input.orbitalEccentricity >= 1) {
    throw new WorldLifecycleError("orbitalEccentricity must be a finite number from 0 up to, but not including, 1.", "INVALID_WORLD");
  }

  if (input.planet) {
    if (input.planet.radiusKm !== undefined && (!Number.isFinite(input.planet.radiusKm) || input.planet.radiusKm <= 0)) {
      throw new WorldLifecycleError("planet.radiusKm must be a positive finite number.", "INVALID_WORLD");
    }

    if (input.planet.gravityMS2 !== undefined && (!Number.isFinite(input.planet.gravityMS2) || input.planet.gravityMS2 <= 0)) {
      throw new WorldLifecycleError("planet.gravityMS2 must be a positive finite number.", "INVALID_WORLD");
    }

    if (input.planet.massKg !== undefined && (!Number.isFinite(input.planet.massKg) || input.planet.massKg <= 0)) {
      throw new WorldLifecycleError("planet.massKg must be a positive finite number.", "INVALID_WORLD");
    }

    if (input.planet.rotationPeriodHours !== undefined && (!Number.isFinite(input.planet.rotationPeriodHours) || input.planet.rotationPeriodHours <= 0)) {
      throw new WorldLifecycleError("planet.rotationPeriodHours must be a positive finite number.", "INVALID_WORLD");
    }

    if (input.planet.orbitalPeriodDays !== undefined && (!Number.isFinite(input.planet.orbitalPeriodDays) || input.planet.orbitalPeriodDays <= 0)) {
      throw new WorldLifecycleError("planet.orbitalPeriodDays must be a positive finite number.", "INVALID_WORLD");
    }

    if (input.planet.axialTiltDegrees !== undefined && (!Number.isFinite(input.planet.axialTiltDegrees) || input.planet.axialTiltDegrees < 0 || input.planet.axialTiltDegrees > 90)) {
      throw new WorldLifecycleError("planet.axialTiltDegrees must be a finite number between 0 and 90.", "INVALID_WORLD");
    }

    if (input.planet.orbitalEccentricity !== undefined && (!Number.isFinite(input.planet.orbitalEccentricity) || input.planet.orbitalEccentricity < 0 || input.planet.orbitalEccentricity >= 1)) {
      throw new WorldLifecycleError("planet.orbitalEccentricity must be a finite number from 0 up to, but not including, 1.", "INVALID_WORLD");
    }

    if (input.planet.atmospherePressureKPa !== undefined && (!Number.isFinite(input.planet.atmospherePressureKPa) || input.planet.atmospherePressureKPa < 0)) {
      throw new WorldLifecycleError("planet.atmospherePressureKPa must be a non-negative finite number.", "INVALID_WORLD");
    }

    if (input.planet.oceanCoveragePercent !== undefined && (!Number.isFinite(input.planet.oceanCoveragePercent) || input.planet.oceanCoveragePercent < 0 || input.planet.oceanCoveragePercent > 100)) {
      throw new WorldLifecycleError("planet.oceanCoveragePercent must be a finite number from 0 to 100.", "INVALID_WORLD");
    }
  }

  if (!input.initialEpochName.trim()) {
    throw new WorldLifecycleError("initialEpochName is required.", "INVALID_WORLD");
  }

  if (!Number.isInteger(input.initialYear)) {
    throw new WorldLifecycleError("initialYear must be an integer.", "INVALID_WORLD");
  }

  if (!Number.isInteger(input.initialDay) || input.initialDay < 0 || input.initialDay >= input.yearLengthDays) {
    throw new WorldLifecycleError("initialDay must be an integer within the configured year.", "INVALID_WORLD");
  }

  if (!Number.isFinite(input.initialHour) || input.initialHour < 0 || input.initialHour >= 24) {
    throw new WorldLifecycleError("initialHour must be a finite number from 0 up to, but not including, 24.", "INVALID_WORLD");
  }

  if (input.environment !== WorldEnvironment.PRODUCTION) {
    return;
  }

  if (!input.seed?.trim()) {
    throw new WorldLifecycleError("Production worlds require a seed value.", "INVALID_WORLD");
  }

  if (!input.description?.trim()) {
    throw new WorldLifecycleError("Production worlds require a description.", "INVALID_WORLD");
  }

  if (input.timeScale !== 1) {
    throw new WorldLifecycleError("Production worlds must use a timeScale of 1.", "INVALID_WORLD");
  }

  if (input.status === WorldStatus.ACTIVE && !input.protected) {
    throw new WorldLifecycleError(
      "Active production worlds must be protected.",
      "INVALID_WORLD",
    );
  }
}

async function runWithWorldClient<T>(
  client: WorldLifecycleClient | undefined,
  task: (client: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (client) {
    if (typeof (client as PrismaClient).$transaction === "function") {
      return (client as PrismaClient).$transaction(async (transaction) => task(transaction));
    }

    return task(client as Prisma.TransactionClient);
  }

  return prisma.$transaction(async (transaction) => task(transaction));
}

function normalizeActor(actor: string | undefined): string {
  return actor?.trim() || DEFAULT_WORLD_ACTION_ACTOR;
}

function normalizeReason(reason: string | null | undefined): string | null {
  return reason?.trim() || null;
}

async function logWorldAction(
  client: WorldLifecycleClient,
  worldId: string,
  action: string,
  options: WorldActionOptions = {},
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  const actionMetadata = metadata ?? options.metadata ?? null;

  await client.worldActionLog.create({
    data: {
      worldId,
      action,
      actor: normalizeActor(options.actor),
      reason: normalizeReason(options.reason),
      metadata: actionMetadata === null ? Prisma.JsonNull : actionMetadata,
    },
  });
}

export async function getWorldBySlug(
  slug: string,
  options: WorldLifecycleOptions = {},
): Promise<WorldWithPlanet | null> {
  assertValidSlug(slug);
  const client = options.client ?? prisma;

  return client.world.findUnique({
    where: { slug },
    include: { planet: true },
  });
}

async function requireWorldBySlug(
  client: WorldLifecycleClient,
  slug: string,
): Promise<World> {
  assertValidSlug(slug);

  const world = await client.world.findUnique({ where: { slug } });

  if (!world) {
    throw new WorldLifecycleError(`World not found: ${slug}`, "WORLD_NOT_FOUND");
  }

  return world;
}

async function assertNoActiveWorldConflict(
  client: WorldLifecycleClient,
  environment: WorldEnvironment,
  exceptWorldId?: string,
): Promise<void> {
  const activeWorld = await client.world.findFirst({
    where: {
      environment,
      status: WorldStatus.ACTIVE,
      ...(exceptWorldId ? { id: { not: exceptWorldId } } : {}),
    },
    select: { slug: true, environment: true },
  });

  if (activeWorld) {
    throw new WorldLifecycleError(
      `Environment ${activeWorld.environment} already has an active world: ${activeWorld.slug}`,
      "ACTIVE_WORLD_EXISTS",
    );
  }
}

function assertProductionConfirmation(world: World, confirmation: string | null | undefined): void {
  if (world.environment !== WorldEnvironment.PRODUCTION) {
    return;
  }

  if (confirmation !== PRODUCTION_CONFIRMATION_PHRASE) {
    throw new WorldLifecycleError(
      `Production world changes require the exact confirmation phrase: ${PRODUCTION_CONFIRMATION_PHRASE}`,
      "PRODUCTION_CONFIRMATION_REQUIRED",
    );
  }
}

function assertCanArchive(world: World): void {
  if (world.protected) {
    throw new WorldLifecycleError(
      `Protected world cannot be archived: ${world.slug}`,
      "PROTECTED_WORLD",
    );
  }
}

function assertCanActivate(world: World): void {
  if (world.status === WorldStatus.ARCHIVED) {
    throw new WorldLifecycleError(
      `Archived world cannot be activated: ${world.slug}`,
      "INVALID_WORLD",
    );
  }

  if (world.environment === WorldEnvironment.PRODUCTION && !world.protected) {
    throw new WorldLifecycleError(
      "Production worlds must be protected before activation.",
      "INVALID_WORLD",
    );
  }
}

export async function createWorld(
  input: CreateWorldInput,
  options: ActiveWorldOptions = {},
): Promise<World> {
  const canonicalInput = createCanonicalWorldInput(input.name, {
    slug: input.slug,
    environment: input.environment,
    status: input.status,
    protected: input.protected,
    description: input.description,
  });
  const resolvedSeed = input.seed?.trim() || canonicalInput.seed;
  const planetInput: PlanetInput = {
    ...CANONICAL_PLANET_CONFIG,
    ...canonicalInput.planet,
    ...input.planet,
  };
  const defaultDescription = input.seed?.trim()
    ? input.description
    : input.description ?? canonicalInput.description ?? FIRST_DAWN_CANONICAL_WORLD.description;
  const derivedDayLengthSeconds = planetInput.rotationPeriodHours !== undefined
    ? planetInput.rotationPeriodHours * 3_600
    : input.dayLengthSeconds ?? DEFAULT_WORLD_TIME_CONFIG.dayLengthSeconds;
  const derivedYearLengthDays = planetInput.orbitalPeriodDays !== undefined
    ? planetInput.orbitalPeriodDays
    : input.yearLengthDays ?? DEFAULT_WORLD_TIME_CONFIG.yearLengthDays;

  const worldInput = {
    name: input.name,
    slug: input.slug ?? makeSlug(input.name),
    environment: input.environment ?? WorldEnvironment.SANDBOX,
    status: input.status ?? WorldStatus.DRAFT,
    currentTick: normalizeBigInt(input.currentTick),
    timeScale: input.timeScale ?? 1,
    tickDurationSeconds: input.tickDurationSeconds ?? DEFAULT_WORLD_TIME_CONFIG.tickDurationSeconds,
    dayLengthSeconds: derivedDayLengthSeconds,
    yearLengthDays: derivedYearLengthDays,
    axialTiltDegrees: input.axialTiltDegrees ?? DEFAULT_WORLD_TIME_CONFIG.axialTiltDegrees,
    orbitalEccentricity: input.orbitalEccentricity ?? DEFAULT_WORLD_TIME_CONFIG.orbitalEccentricity,
    initialEpochName: input.initialEpochName ?? DEFAULT_WORLD_TIME_CONFIG.initialEpochName,
    initialYear: input.initialYear ?? DEFAULT_WORLD_TIME_CONFIG.initialYear,
    initialDay: input.initialDay ?? DEFAULT_WORLD_TIME_CONFIG.initialDay,
    initialHour: input.initialHour ?? DEFAULT_WORLD_TIME_CONFIG.initialHour,
    currentGeneration: input.currentGeneration ?? 0,
    seed: resolvedSeed || FIRST_DAWN_CANONICAL_SEED,
    description: defaultDescription,
    protected: input.protected ?? false,
    planet: planetInput,
  };

  assertValidWorldInput(worldInput);

  return runWithWorldClient(options.client, async (client) => {
    const existingWorld = await client.world.findUnique({
      where: { slug: worldInput.slug },
      select: { slug: true, protected: true },
    });

    if (existingWorld) {
      const protection = existingWorld.protected ? " Protected worlds cannot be overwritten." : "";
      throw new WorldLifecycleError(
        `World slug already exists: ${worldInput.slug}.${protection}`,
        "INVALID_WORLD",
      );
    }

    if (
      worldInput.status === WorldStatus.ACTIVE &&
      !options.allowMultipleActivePerEnvironment
    ) {
      await assertNoActiveWorldConflict(client, worldInput.environment);
    }

    const world = await client.world.create({
      data: {
        name: worldInput.name.trim(),
        slug: worldInput.slug,
        environment: worldInput.environment,
        status: worldInput.status,
        currentTick: worldInput.currentTick,
        timeScale: worldInput.timeScale,
        tickDurationSeconds: worldInput.tickDurationSeconds,
        dayLengthSeconds: worldInput.dayLengthSeconds,
        yearLengthDays: worldInput.yearLengthDays,
        axialTiltDegrees: worldInput.axialTiltDegrees,
        orbitalEccentricity: worldInput.orbitalEccentricity,
        initialEpochName: worldInput.initialEpochName.trim() || DEFAULT_WORLD_TIME_CONFIG.initialEpochName,
        initialYear: worldInput.initialYear,
        initialDay: worldInput.initialDay,
        initialHour: worldInput.initialHour,
        currentGeneration: worldInput.currentGeneration,
        seed: worldInput.seed?.trim() || null,
        description: worldInput.description?.trim() || null,
        protected: worldInput.protected,
      },
    });

    await client.planet.create({
      data: {
        worldId: world.id,
        name: planetInput.name?.trim() || `${world.name} Planet`,
        radiusKm: planetInput.radiusKm ?? 6371,
        gravityMS2: planetInput.gravityMS2 ?? 9.81,
        massKg: planetInput.massKg ?? 5.972e24,
        rotationPeriodHours: planetInput.rotationPeriodHours ?? 24,
        orbitalPeriodDays: planetInput.orbitalPeriodDays ?? 365,
        axialTiltDegrees: planetInput.axialTiltDegrees ?? 23.44,
        orbitalEccentricity: planetInput.orbitalEccentricity ?? 0.0167,
        atmospherePressureKPa: planetInput.atmospherePressureKPa ?? 101.3,
        atmosphereComposition: planetInput.atmosphereComposition ?? {
          nitrogen: 78,
          oxygen: 21,
          argon: 0.93,
          carbonDioxide: 0.04,
        },
        oceanCoveragePercent: planetInput.oceanCoveragePercent ?? 71,
      },
    });

    await logWorldAction(client, world.id, "CREATE_WORLD", options, {
      slug: world.slug,
      environment: world.environment,
      status: world.status,
    });

    return world;
  });
}

export async function listWorlds(
  input: ListWorldsInput = {},
  options: WorldLifecycleOptions = {},
): Promise<WorldWithPlanet[]> {
  const client = options.client ?? prisma;

  return client.world.findMany({
    where: {
      environment: input.environment,
      slug: input.excludeTestWorlds ? { not: { startsWith: "test-world-" } } : undefined,
      status: input.status ?? (input.includeArchived === false ? { not: WorldStatus.ARCHIVED } : undefined),
    },
    orderBy: [{ environment: "asc" }, { status: "asc" }, { name: "asc" }],
    include: {
      planet: true,
    },
  });
}

export async function listAtlasWorldOptions(
  input: ListWorldsInput = {},
  options: WorldLifecycleOptions = {},
): Promise<WorldWithPlanet[]> {
  const client = options.client ?? prisma;

  return client.world.findMany({
    where: {
      environment: input.environment,
      slug: input.excludeTestWorlds
        ? { not: { startsWith: "test-world-" } }
        : undefined,
      status:
        input.status ??
        (input.includeArchived === false
          ? { not: WorldStatus.ARCHIVED }
          : undefined),
    },
    orderBy: [{ environment: "asc" }, { status: "asc" }, { name: "asc" }],
    include: {
      planet: true,
    },
  });
}

export async function listWorldActionLogs(limit = 20) {
  return prisma.worldActionLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      world: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });
}

export async function selectActiveWorld(
  slug: string,
  options: ActiveWorldOptions = {},
): Promise<World> {
  return runWithWorldClient(options.client, async (client) => {
    const world = await requireWorldBySlug(client, slug);
    assertCanActivate(world);
    assertProductionConfirmation(world, options.confirmProductionChange);

    if (!options.allowMultipleActivePerEnvironment) {
      const activeWorlds = await client.world.findMany({
        where: {
          environment: world.environment,
          status: WorldStatus.ACTIVE,
          id: { not: world.id },
        },
        select: { id: true, slug: true },
      });

      if (activeWorlds.length > 0) {
        await client.world.updateMany({
          where: {
            id: { in: activeWorlds.map((activeWorld) => activeWorld.id) },
          },
          data: { status: WorldStatus.PAUSED },
        });

        for (const activeWorld of activeWorlds) {
          await logWorldAction(client, activeWorld.id, "AUTO_PAUSE_FOR_ACTIVATION", options, {
            activatedSlug: world.slug,
          });
        }
      }
    }

    const activatedWorld = await client.world.update({
      where: { id: world.id },
      data: { status: WorldStatus.ACTIVE },
    });

    await logWorldAction(client, activatedWorld.id, "ACTIVATE_WORLD", options, {
      slug: activatedWorld.slug,
      environment: activatedWorld.environment,
    });

    return activatedWorld;
  });
}

export async function pauseWorld(
  slug: string,
  options: WorldLifecycleOptions = {},
): Promise<World> {
  return runWithWorldClient(options.client, async (client) => {
    const world = await requireWorldBySlug(client, slug);

    if (world.status === WorldStatus.ARCHIVED) {
      throw new WorldLifecycleError(
        `Archived world cannot be paused: ${world.slug}`,
        "INVALID_WORLD",
      );
    }

    const pausedWorld = await client.world.update({
      where: { id: world.id },
      data: { status: WorldStatus.PAUSED },
    });

    await logWorldAction(client, pausedWorld.id, "PAUSE_WORLD", options, {
      slug: pausedWorld.slug,
      previousStatus: world.status,
    });

    return pausedWorld;
  });
}

export async function resumeWorld(
  slug: string,
  options: ActiveWorldOptions = {},
): Promise<World> {
  return selectActiveWorld(slug, options);
}

export async function archiveWorld(
  slug: string,
  options: WorldLifecycleOptions = {},
): Promise<World> {
  return runWithWorldClient(options.client, async (client) => {
    const world = await requireWorldBySlug(client, slug);
    assertCanArchive(world);

    const archivedWorld = await client.world.update({
      where: { id: world.id },
      data: { status: WorldStatus.ARCHIVED },
    });

    await logWorldAction(client, archivedWorld.id, "ARCHIVE_WORLD", options, {
      slug: archivedWorld.slug,
      previousStatus: world.status,
    });

    return archivedWorld;
  });
}

export async function protectWorld(
  slug: string,
  options: WorldLifecycleOptions = {},
): Promise<World> {
  return runWithWorldClient(options.client, async (client) => {
    const world = await requireWorldBySlug(client, slug);

    const protectedWorld = await client.world.update({
      where: { id: world.id },
      data: { protected: true },
    });

    await logWorldAction(client, protectedWorld.id, "PROTECT_WORLD", options, {
      slug: protectedWorld.slug,
      wasProtected: world.protected,
    });

    return protectedWorld;
  });
}

export async function unprotectWorld(
  slug: string,
  options: UnprotectWorldOptions = {},
): Promise<World> {
  return runWithWorldClient(options.client, async (client) => {
    const world = await requireWorldBySlug(client, slug);

    assertProductionConfirmation(world, options.confirmProductionChange);

    const unprotectedWorld = await client.world.update({
      where: { id: world.id },
      data: { protected: false },
    });

    await logWorldAction(client, unprotectedWorld.id, "UNPROTECT_WORLD", options, {
      slug: unprotectedWorld.slug,
      wasProtected: world.protected,
    });

    return unprotectedWorld;
  });
}
