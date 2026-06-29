# FIRST DAWN ARCHITECTURE

For the permanent simulation architecture contract, see [PERMANENT_ARCHITECTURE.md](./PERMANENT_ARCHITECTURE.md).

First Dawn must be built as a simulation engine with a website attached to it.

The website is not the product.

The simulation is the product.

The website is the observatory.

Architecture layers:

Observer Website
API Layer
Simulation Engine
World Engine
Citizen Engine
Memory Engine
History Engine
Event Engine
Database

Core rule:

The observer layer can read the world, but the inhabitants can never perceive the observer layer.

Testing worlds must remain separate from production.

Every simulation record must belong to a worldId.

Initial stack:

* Next.js
* TypeScript
* Tailwind CSS
* Prisma
* PostgreSQL
* Modular simulation libraries

Future stack additions:

* Redis
* Queue system
* Dedicated simulation worker
* AI reasoning layer
* Backups
* Event replay
* Admin audit logging

Core modules to scaffold:

src/lib/simulation/time.ts
src/lib/simulation/world.ts
src/lib/simulation/types.ts

The initial homepage should be visually polished, but the simulation should remain minimal.

## Simulation Plugin Architecture

All deterministic simulation modules now conform to a shared `SimulationSystem` contract in `src/lib/simulation/systems/types.ts`.

```ts
export type SimulationSystem = {
  id: string;
  name: string;
  version: number;
  label: string;
  order: number;
  dependencies: string[];
  initialize?(context: SimulationSystemContext): Promise<void> | void;
  update(context: SimulationSystemContext): Promise<SimulationSystemResult> | SimulationSystemResult;
  persist?(context: SimulationSystemContext): Promise<void> | void;
  emitEvents?(context: SimulationSystemContext): Promise<SimulationSystemEvent[]> | SimulationSystemEvent[];
  health?(context: SimulationSystemContext): Promise<SimulationSystemHealth> | SimulationSystemHealth;
  serialize?(context: SimulationSystemContext): Promise<Prisma.InputJsonValue> | Prisma.InputJsonValue;
};
```

The legacy `run(context)` function remains supported through `createPlaceholderSystem()` for backwards compatibility, but new systems should implement the lifecycle through `update(context)` and optional hooks.

### Execution Context

Every system receives a `SimulationSystemContext` containing the current `world`, `tick`, deterministic `seed`, `timeScale`, per-system deterministic `random`, repository access, shared tick `cache`, engine-owned `eventBus`, `metrics` collector, and `logger`.

Systems should communicate through the context. They should not directly call another simulation system.

### Registry

The central registry lives at `src/lib/simulation/registry.ts` and exposes:

* `registerSystem(system)`
* `getSystem(id)`
* `getSystems()`
* `validateDependencies(systems?)`
* `assertValidSystems(systems?)`

Default systems are registered in `src/lib/simulation/systems/index.ts`, then discovered by the scheduler. Future systems such as evolution, disease, civilizations, economy, religion, and technology should only need to export a `SimulationSystem` and register it with the registry bundle. Scheduler code must not change when a new system is added.

### Scheduler Lifecycle

For each tick, the scheduler:

1. Locks and validates the world.
2. Loads registered systems sorted by `order`.
3. Validates duplicate ids, missing dependencies, dependency cycles, and dependency execution order.
4. Builds a shared `SimulationSystemContext`.
5. Runs `initialize`, `update`, optional event emission, optional health reporting, optional persistence, and optional serialization.
6. Records per-system execution duration, cells processed, entities processed, events emitted, warnings, errors, memory estimate, cells/sec, and entities/sec.
7. Aggregates emitted events and persists them after the tick envelope is written.
8. Stores pipeline metadata, profiling totals, failed systems, and aggregate health on `SimulationTick.metadata`.

The scheduler owns orchestration only. Simulation formulas remain in the individual engine modules.

### Dependency Rules

A dependency must reference a registered system id. A system must run after its dependencies, so every dependency must have a lower execution `order`. Cycles are invalid. Duplicate ids are invalid. If validation fails, simulation startup or tick execution refuses to proceed.

### Health Reporting

Systems may return `Healthy`, `Warning`, or `Error` with optional diagnostics. The scheduler aggregates these statuses into tick metadata. The World Health summary reads this aggregate and can surface warnings or errors alongside existing world coverage and tick status checks.

### Event Bus

Systems emit domain events through the engine-owned event bus or return them from `events` / `emitEvents()`. The scheduler persists collected events only after system execution for the tick completes. Systems should not directly notify or mutate other systems.

### Best Practices For Adding Systems

* Give every system a stable, lowercase `id`.
* Keep deterministic calculations inside the system or its engine helpers.
* Declare every upstream dependency explicitly.
* Use context repositories for persistence and context cache for tick-local shared data.
* Emit events instead of calling other systems.
* Report metrics and health diagnostics where practical.
* Preserve deterministic outputs when refactoring existing formulas.
