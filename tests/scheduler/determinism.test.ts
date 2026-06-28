import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createDeterministicRandom } from "../../src/lib/simulation/random";

function randomSequence(tick: bigint, systemName: string): number[] {
  const random = createDeterministicRandom({
    worldSeed: "first-dawn-determinism-test-seed",
    tick,
    systemName,
  });

  return [
    random.next(),
    random.float(-5, 5),
    random.integer(1, 100),
    random.boolean(0.25) ? 1 : 0,
    random.pick([10, 20, 30, 40]),
  ];
}

function listTypescriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return listTypescriptFiles(fullPath);
    }

    return fullPath.endsWith(".ts") ? [fullPath] : [];
  });
}

describe("deterministic random", () => {
  it("returns the same sequence for the same world seed, tick, and system", () => {
    expect(randomSequence(42n, "astronomy")).toEqual(randomSequence(42n, "astronomy"));
  });

  it("returns a different sequence for a different tick", () => {
    expect(randomSequence(42n, "astronomy")).not.toEqual(randomSequence(43n, "astronomy"));
  });

  it("returns a different sequence for a different system name", () => {
    expect(randomSequence(42n, "astronomy")).not.toEqual(randomSequence(42n, "physics"));
  });

  it("keeps simulation code free of Math.random", () => {
    const simulationFiles = listTypescriptFiles(join(process.cwd(), "src", "lib", "simulation"));
    const offenders = simulationFiles.filter((file) => readFileSync(file, "utf8").includes("Math.random"));

    expect(offenders).toEqual([]);
  });
});
