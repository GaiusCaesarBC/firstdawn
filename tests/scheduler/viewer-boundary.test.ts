import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();

const viewerFiles = [
  "src/app/worlds/page.tsx",
  "src/app/worlds/animals/page.tsx",
  "src/app/worlds/plants/page.tsx",
  "src/app/worlds/biomes/page.tsx",
  "src/app/worlds/grid/page.tsx",
  "src/app/api/worlds/animals/route.ts",
  "src/app/api/worlds/plants/route.ts",
  "src/app/api/worlds/biomes/route.ts",
] as const;

const forbiddenRenderWork = [
  { label: "spatial grid generation", pattern: /\bcreateGrid\s*\(/ },
  { label: "scheduler tick state", pattern: /\bgetSimulationState\s*\(/ },
  { label: "deterministic cache generation", pattern: /\bgetCachedDeterministic\s*\(/ },
  { label: "selected deterministic cache generation", pattern: /\bgetCachedSelected\s*\(/ },
  { label: "canonical world sync", pattern: /\bsyncCanonicalDefaultWorlds\s*\(/ },
  { label: "planet state generation", pattern: /\bgetPlanetState\s*\(/ },
  { label: "climate state generation", pattern: /\bgetClimateState\s*\(/ },
  { label: "terrain state generation", pattern: /\bgetTerrainState\s*\(/ },
  { label: "hydrology state generation", pattern: /\bgetHydrologyState\s*\(/ },
  { label: "atmosphere state generation", pattern: /\bgetAtmosphereState\s*\(/ },
  { label: "weather state generation", pattern: /\bgetWeatherState\s*\(/ },
  { label: "resource state generation", pattern: /\bgetPlanetResourcesState\s*\(/ },
  { label: "biome state generation", pattern: /\bgetBiomeState\s*\(/ },
  { label: "plant ecology generation", pattern: /\bgetPlantEcologyState\s*\(/ },
  { label: "animal ecology generation", pattern: /\bgetAnimalEcologyState\s*\(/ },
] as const;

function readWorkspaceFile(filePath: string): string {
  return readFileSync(path.join(workspaceRoot, filePath), "utf8");
}

describe("viewer-only simulation boundary", () => {
  it("keeps migrated pages and viewer APIs out of simulation/grid/ecology generation", () => {
    const violations: string[] = [];

    for (const filePath of viewerFiles) {
      const source = readWorkspaceFile(filePath);

      for (const forbidden of forbiddenRenderWork) {
        if (forbidden.pattern.test(source)) {
          violations.push(`${filePath} calls ${forbidden.label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("routes viewer pages and summary APIs through persisted Atlas snapshots", () => {
    for (const filePath of viewerFiles) {
      const source = readWorkspaceFile(filePath);

      expect(source, filePath).toMatch(/getLatestPersistedAtlasSnapshot/);
    }
  });
});