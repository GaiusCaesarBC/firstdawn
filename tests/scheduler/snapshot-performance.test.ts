import { describe, expect, it } from "vitest";

import { createGrid } from "../../src/lib/simulation/grid/grid";
import { getSnapshotWorldKey } from "../../src/lib/simulation/snapshot-performance";

const baseWorld = {
  id: "world-cache-key-test",
  seed: "cache-key-seed",
  currentTick: 42n,
  tickDurationSeconds: 60,
  dayLengthSeconds: 86_400,
  yearLengthDays: 365,
  axialTiltDegrees: 23.44,
  orbitalEccentricity: 0.0167,
  initialEpochName: "First Dawn",
  initialYear: 0,
  initialDay: 0,
  initialHour: 6,
  planet: {
    id: "planet-a",
    worldId: "world-cache-key-test",
    name: "Cache Key Planet",
    radiusKm: 6371,
    gravityMS2: 9.81,
    massKg: 5.972e24,
    rotationPeriodHours: 24,
    orbitalPeriodDays: 365,
    axialTiltDegrees: 23.44,
    orbitalEccentricity: 0.0167,
    atmospherePressureKPa: 101.3,
    atmosphereComposition: {
      nitrogen: 78,
      oxygen: 21,
      argon: 0.93,
      carbonDioxide: 0.04,
    },
    oceanCoveragePercent: 71,
    createdAt: new Date("2026-06-26T00:00:00.000Z"),
    updatedAt: new Date("2026-06-26T00:00:00.000Z"),
  },
};

describe("snapshot performance cache keys", () => {
  it("ignores relational planet metadata that does not affect deterministic snapshots", () => {
    const grid = createGrid();
    const firstKey = getSnapshotWorldKey(baseWorld, grid, "atlas:1");
    const secondKey = getSnapshotWorldKey({
      ...baseWorld,
      planet: {
        ...baseWorld.planet,
        id: "planet-b",
        worldId: "another-world-id",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-02T00:00:00.000Z"),
      },
    }, grid, "atlas:1");

    expect(secondKey).toBe(firstKey);
  });

  it("invalidates when world tick or deterministic planet data changes", () => {
    const grid = createGrid();
    const firstKey = getSnapshotWorldKey(baseWorld, grid, "atlas:1");
    const nextTickKey = getSnapshotWorldKey({ ...baseWorld, currentTick: 43n }, grid, "atlas:1");
    const nextPlanetKey = getSnapshotWorldKey({
      ...baseWorld,
      planet: {
        ...baseWorld.planet,
        oceanCoveragePercent: 70,
      },
    }, grid, "atlas:1");

    expect(nextTickKey).not.toBe(firstKey);
    expect(nextPlanetKey).not.toBe(firstKey);
  });
});
