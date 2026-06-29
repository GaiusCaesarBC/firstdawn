import { describe, expect, it } from "vitest";

import {
  SimulationRegistryError,
  SimulationSystemRegistry,
  validateDependencies,
} from "../../src/lib/simulation/registry";
import { createPlaceholderSystem } from "../../src/lib/simulation/systems/types";

function system(id: string, order: number, dependencies: string[] = []) {
  return createPlaceholderSystem(id, id, order, () => ({ success: true }), { dependencies });
}

describe("simulation system registry", () => {
  it("registers and retrieves systems by id in execution order", () => {
    const registry = new SimulationSystemRegistry();

    registry.registerSystem(system("second", 20));
    registry.registerSystem(system("first", 10));

    expect(registry.getSystem("first")?.id).toBe("first");
    expect(registry.getSystems().map((entry) => entry.id)).toEqual(["first", "second"]);
  });

  it("rejects duplicate system ids", () => {
    const registry = new SimulationSystemRegistry();

    registry.registerSystem(system("duplicate", 10));

    expect(() => registry.registerSystem(system("duplicate", 20))).toThrow(SimulationRegistryError);
  });

  it("detects missing dependencies", () => {
    const result = validateDependencies([
      system("plants", 20, ["biomes"]),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_DEPENDENCY", dependencyId: "biomes" }),
    ]));
  });

  it("detects invalid execution order", () => {
    const result = validateDependencies([
      system("plants", 10, ["biomes"]),
      system("biomes", 20),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_EXECUTION_ORDER", systemId: "plants", dependencyId: "biomes" }),
    ]));
  });

  it("detects dependency cycles", () => {
    const result = validateDependencies([
      system("climate", 10, ["weather"]),
      system("weather", 20, ["climate"]),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DEPENDENCY_CYCLE" }),
    ]));
  });
});
