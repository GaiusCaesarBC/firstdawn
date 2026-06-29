import type { SimulationSystem } from "./systems/types";

export type DependencyValidationIssueCode =
  | "DUPLICATE_SYSTEM_ID"
  | "MISSING_DEPENDENCY"
  | "DEPENDENCY_CYCLE"
  | "INVALID_EXECUTION_ORDER";

export type DependencyValidationIssue = {
  code: DependencyValidationIssueCode;
  systemId: string;
  dependencyId?: string;
  message: string;
};

export type DependencyValidationResult = {
  valid: boolean;
  issues: DependencyValidationIssue[];
};

export class SimulationRegistryError extends Error {
  public readonly issues: DependencyValidationIssue[];

  constructor(message: string, issues: DependencyValidationIssue[]) {
    super(message);
    this.name = "SimulationRegistryError";
    this.issues = issues;
  }
}

export class SimulationSystemRegistry {
  private readonly systems: SimulationSystem[] = [];

  registerSystem(system: SimulationSystem): void {
    const id = normalizeSystemId(system.id);

    if (!id) {
      throw new SimulationRegistryError("Simulation systems require a stable id.", [
        {
          code: "DUPLICATE_SYSTEM_ID",
          systemId: system.id,
          message: "Simulation systems require a stable id.",
        },
      ]);
    }

    if (this.systems.some((existingSystem) => existingSystem.id === id)) {
      throw new SimulationRegistryError(`Duplicate simulation system id: ${id}.`, [
        {
          code: "DUPLICATE_SYSTEM_ID",
          systemId: id,
          message: `Duplicate simulation system id: ${id}.`,
        },
      ]);
    }

    this.systems.push({
      ...system,
      id,
      name: system.name || id,
      label: system.label || system.name || id,
      version: system.version || 1,
      dependencies: [...system.dependencies],
    });
  }

  getSystem(id: string): SimulationSystem | undefined {
    return this.systems.find((system) => system.id === id);
  }

  getSystems(): SimulationSystem[] {
    return sortSystems(this.systems);
  }

  validateDependencies(): DependencyValidationResult {
    return validateDependencies(this.systems);
  }

  assertValid(): void {
    assertValidSystems(this.systems);
  }
}

const defaultRegistry = new SimulationSystemRegistry();

function normalizeSystemId(id: string): string {
  return id.trim();
}

function sortSystems(systems: readonly SimulationSystem[]): SimulationSystem[] {
  return [...systems].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function detectCycles(systems: readonly SimulationSystem[]): DependencyValidationIssue[] {
  const systemsById = new Map(systems.map((system) => [system.id, system]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const issues: DependencyValidationIssue[] = [];

  function visit(system: SimulationSystem, path: string[]): void {
    if (visited.has(system.id)) {
      return;
    }

    if (visiting.has(system.id)) {
      const cyclePath = [...path, system.id];
      issues.push({
        code: "DEPENDENCY_CYCLE",
        systemId: system.id,
        message: `Dependency cycle detected: ${cyclePath.join(" -> ")}.`,
      });
      return;
    }

    visiting.add(system.id);

    for (const dependencyId of system.dependencies) {
      const dependency = systemsById.get(dependencyId);

      if (dependency) {
        visit(dependency, [...path, system.id]);
      }
    }

    visiting.delete(system.id);
    visited.add(system.id);
  }

  for (const system of systems) {
    visit(system, []);
  }

  return issues;
}

export function validateDependencies(systems: readonly SimulationSystem[] = defaultRegistry.getSystems()): DependencyValidationResult {
  const issues: DependencyValidationIssue[] = [];
  const seen = new Map<string, SimulationSystem>();

  for (const system of systems) {
    const existing = seen.get(system.id);

    if (existing) {
      issues.push({
        code: "DUPLICATE_SYSTEM_ID",
        systemId: system.id,
        message: `Duplicate simulation system id: ${system.id}.`,
      });
      continue;
    }

    seen.set(system.id, system);
  }

  for (const system of systems) {
    for (const dependencyId of system.dependencies) {
      const dependency = seen.get(dependencyId);

      if (!dependency) {
        issues.push({
          code: "MISSING_DEPENDENCY",
          systemId: system.id,
          dependencyId,
          message: `${system.id} depends on missing system ${dependencyId}.`,
        });
        continue;
      }

      if (dependency.order >= system.order) {
        issues.push({
          code: "INVALID_EXECUTION_ORDER",
          systemId: system.id,
          dependencyId,
          message: `${system.id} must run after dependency ${dependencyId}.`,
        });
      }
    }
  }

  issues.push(...detectCycles(systems));

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function assertValidSystems(systems: readonly SimulationSystem[] = defaultRegistry.getSystems()): void {
  const result = validateDependencies(systems);

  if (!result.valid) {
    throw new SimulationRegistryError("Simulation system registry validation failed.", result.issues);
  }
}

export function registerSystem(system: SimulationSystem): void {
  defaultRegistry.registerSystem(system);
}

export function getSystem(id: string): SimulationSystem | undefined {
  return defaultRegistry.getSystem(id);
}

export function getSystems(): SimulationSystem[] {
  return defaultRegistry.getSystems();
}

export { defaultRegistry as simulationRegistry };
