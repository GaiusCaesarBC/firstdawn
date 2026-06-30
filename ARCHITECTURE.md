# First Dawn Architecture

This is the engineering handbook for First Dawn. It is the canonical architecture reference for contributors, maintainers, and AI coding agents.

Read this with:

- [FIRST_DAWN_CONTEXT.md](./FIRST_DAWN_CONTEXT.md) for full project handoff.
- [VISION.md](./VISION.md) for project philosophy.
- [ROADMAP.md](./ROADMAP.md) for phased implementation.
- [CANONICAL_WORLD.md](./CANONICAL_WORLD.md) for canonical world rules.

## Architectural Thesis

First Dawn is a deterministic simulation engine with a website attached to it.

```text
Observer Website
      |
      v
API Layer
      |
      v
Simulation Engine
      |
      v
Simulation Systems
      |
      v
Persistence Layer
      |
      v
World History
```

The UI reads and explains. The engine advances. The systems calculate. The database records. History emerges from evidence.

## Project Structure

Current high-level structure:

```text
.
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── public/
├── scripts/
├── src/
│   ├── app/
│   │   ├── api/
│   │   └── worlds/
│   └── lib/
│       ├── simulation/
│       ├── utils/
│       └── worlds/
├── tests/
│   ├── helpers/
│   ├── scheduler/
│   └── ui/
└── docs/
```

Important current modules:

| Path | Purpose |
| --- | --- |
| `src/lib/simulation/scheduler.ts` | Tick orchestration and simulation state. |
| `src/lib/simulation/systems/` | Registered simulation systems. |
| `src/lib/simulation/registry.ts` | System registry and dependency validation. |
| `src/lib/simulation/event-bus.ts` | Deterministic event collection. |
| `src/lib/simulation/*-engine.ts` | Domain engines for planet, ecology, humans, and discovery. |
| `src/lib/worlds/world-lifecycle.ts` | World CRUD, lifecycle, and Prisma access. |
| `src/lib/worlds/canonical-world.ts` | Canonical seed and fingerprint verification. |
| `src/lib/worlds/map-atlas.ts` | Atlas snapshot construction. |
| `src/app/worlds/` | Developer Control Room and world UI routes. |
| `src/app/api/worlds/` | World, atlas, health, plant, animal, and action APIs. |
| `tests/scheduler/` | Simulation and scheduler tests. |
| `tests/ui/` | UI behavior tests. |

Long-term structure should gradually move toward clearer engine boundaries:

```text
src/lib/engine/
  scheduler/
  registry/
  events/
  persistence/
  health/
  deterministic/

src/lib/simulation/
  systems/
  terrain/
  hydrology/
  atmosphere/
  weather/
  biomes/
  plants/
  animals/
  humans/
  discovery/

src/lib/worlds/
  lifecycle/
  snapshots/
  atlas/
  repositories/
```

Do not perform a large restructure just for neatness. Move toward this shape when it reduces real complexity.

## Layer Model

```text
+--------------------------------------------------+
| Observer Layer                                   |
| Dashboards, atlas, inspector, controls           |
+--------------------------------------------------+
| API Layer                                        |
| Route handlers, request validation, service calls |
+--------------------------------------------------+
| Engine Layer                                     |
| Scheduler, registry, event bus, health, metrics  |
+--------------------------------------------------+
| Simulation Systems Layer                         |
| Time, planet, ecology, humans, discovery         |
+--------------------------------------------------+
| Persistence Layer                                |
| Prisma models, migrations, events, snapshots     |
+--------------------------------------------------+
```

Rules:

- Observer code must not contain core simulation math.
- API routes must call engine/domain services.
- The scheduler must own tick advancement.
- Systems must own their own formulas and state.
- Persistence must stay world-scoped.

## Simulation Architecture

A simulation tick is an ordered pipeline of systems. Each system receives a deterministic context and returns a standard result.

System context includes:

- current world
- target tick
- seed
- time scale
- deterministic random stream
- Prisma transaction client
- repositories
- tick-local cache
- event bus
- metrics collector
- logger
- fidelity mode
- fidelity plan

Systems should communicate through context, events, persistence, or explicit shared cache entries. They should not directly call other systems to mutate their state.

## Scheduler Lifecycle

The scheduler lifecycle is:

```text
advanceTick(worldId)
  |
  v
validate registered systems
  |
  v
open transaction
  |
  v
lock world row
  |
  v
load world and validate runnability
  |
  v
resolve target tick and fidelity plan
  |
  v
for each system in order:
  initialize
  update/run
  collect result events
  emit additional events
  collect health
  persist if successful
  serialize metadata
  collect metrics
  stop on failure
  |
  v
update World.currentTick
  |
  v
persist SimulationTick metadata
  |
  v
persist collected events
  |
  v
emit scheduler lifecycle events
```

The scheduler records from tick, to tick, fidelity mode, tick stride, checkpoint flag, event logging mode, events emitted, events persisted, per-system pipeline metadata, metrics, health, and failed systems.

## System Registration

Simulation systems implement a shared `SimulationSystem` contract.

Core fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable lowercase identifier. |
| `name` | Stable system name. |
| `label` | Human-readable display label. |
| `version` | Formula/data version. |
| `order` | Execution order. |
| `dependencies` | Systems that must run before this system. |
| `initialize` | Optional setup hook. |
| `update` / `run` | Main system execution. |
| `persist` | Optional persistence hook. |
| `emitEvents` | Optional event emission hook. |
| `health` | Optional health hook. |
| `serialize` | Optional metadata hook. |

Default systems are registered in `src/lib/simulation/systems/index.ts`.

New systems should:

1. Export a `SimulationSystem`.
2. Declare stable metadata.
3. Declare dependencies explicitly.
4. Register in the default systems bundle.
5. Add deterministic tests.
6. Add health metrics.
7. Emit meaningful events where appropriate.
8. Update atlas/health/UI surfaces only if relevant.

## Dependency Validation

The registry validates duplicate system ids, missing dependencies, dependency cycles, and dependency order violations.

Dependency rules exist because simulation state must have a stable causal order.

Example:

```text
weather depends on atmosphere and climate
plants depend on biomes
animals depend on plants and biology
adaptation depends on animals
humans depend on adaptation
discovery depends on memory and humans
```

A system may read from systems that run before it. It must not rely on future systems.

## Event Pipeline

Events are the bridge between simulation math and world history.

Event flow:

```text
System result events
      |
      v
Tick event bus
      |
      v
Scheduler collection
      |
      v
SimulationTick metadata
      |
      v
Event table persistence
      |
      v
Observer / Chronicler / Discovery
```

Events should be deterministic, world-scoped, tick-scoped, ordered, meaningful, queryable, and useful to observers and future systems.

Do not emit events for every tiny numeric adjustment. Emit events when a meaningful state transition occurred or when future history needs evidence.

## Checkpoint System

Long simulations cannot persist every detail at maximum fidelity forever.

The scheduler supports fidelity plans that control:

- tick stride
- checkpoint cadence
- event logging density
- chronicler output
- atlas snapshot density
- approximate mode labels

Checkpoint events are recorded in `WorldActionLog` so long runs can be audited.

Checkpointing exists to support long-range testing, performance profiling, partial progress inspection, future replay anchors, and bounded database growth.

## World Isolation

Every world-specific record must belong to one world.

```text
World
  ├── Planet
  │   └── PlanetCell
  │       └── AnimalPopulation
  ├── SimulationTick
  ├── Event
  ├── Person
  ├── Memory
  ├── Relationship
  ├── Location
  ├── Animal
  ├── Plant
  └── WorldActionLog
```

Rules:

- All world-state queries must scope by `worldId`.
- Cross-world queries are admin-only.
- Seed scripts must be idempotent.
- Protected worlds must not be reset, overwritten, archived, or destroyed by ordinary tools.
- Production worlds must not be advanced by local developer controls.

## Deterministic Random Generation

Simulation variation must use deterministic random utilities.

The random stream should be based on:

- world seed
- tick
- system name
- optionally entity/cell identity

This ensures that the same world and tick produce stable outcomes.

Never use `Math.random()`, `Date.now()`, or wall-clock dates for simulation decisions. Wall-clock time may be used for profiling, logs, and operation timestamps, but not for simulation outcomes.

## Ownership Rules

Each system owns its domain.

| System | Owns |
| --- | --- |
| Time | Calendar, phase, tick-to-time interpretation. |
| Astronomy | Seasons, daylight, solar intensity. |
| Terrain/Geology | Elevation, landforms, terrain classification. |
| Hydrology/Oceans | Water bodies, drainage, basins, watersheds. |
| Atmosphere/Weather/Climate | Air, wind, pressure, humidity, storms, temperature context. |
| Resources | Geological and environmental resource potential. |
| Biomes | Biome classification and habitability context. |
| Plants | Vegetation, biomass, edible support, regrowth. |
| Animals | Animal populations, migration, predation, food webs, ecosystem health. |
| Adaptation | Population-level trait shifts and fitness. |
| Humans | Human agent state, decisions, memory, relationships, communication. |
| Discovery | Observations, hypotheses, discoveries, knowledge lifecycle. |

Cross-system effects require explicit interfaces.

Acceptable:

- Animals read plant biomass and record plant consumption through an agreed field/interface.
- Adaptation reads animal population pressures and updates adaptation fields.
- Humans read local environment and emit human events.
- Discovery reads events and memories to infer observations.

Not acceptable:

- UI directly rewriting animal populations.
- Weather directly mutating human beliefs.
- Humans directly rewriting climate state.
- Discovery inventing a technology without event evidence.

## Plugin Architecture

The simulation system registry acts as a plugin architecture.

The goal is that adding a future system such as disease, fire, toolmaking, language, or settlements requires a system module, deterministic logic, declared dependencies, registration, persistence strategy, health metrics, and tests.

It should not require rewriting the scheduler.

## Persistence Model

Prisma is the current persistence layer.

Important models:

| Model | Purpose |
| --- | --- |
| `World` | Root simulation boundary. |
| `WorldActionLog` | Auditable lifecycle and operation history. |
| `Planet` | Planet-level physical state. |
| `PlanetCell` | Current cell-level planet/ecology state. |
| `AnimalPopulation` | Per-cell species population state. |
| `SimulationTick` | Tick execution metadata. |
| `Event` | Historical world events. |
| `Person` | Foundational person model. |
| `Memory` | Foundational memory model. |
| `Relationship` | Foundational relationship model. |
| `Location` | Hierarchical world locations. |
| `Animal` | Foundational animal model. |
| `Plant` | Foundational plant model. |

Persistence principles:

- Batch writes where possible.
- Keep simulation state world-scoped.
- Store important history as events, not full snapshots every tick.
- Use snapshots for atlas rendering, debugging, replay anchors, and major milestones.
- Avoid per-cell write loops when a batch strategy is feasible.
- Treat migrations as part of simulation history stewardship.

## Simulation Replay

Replay is not fully complete, but the architecture must preserve replay compatibility.

Replay requires:

- deterministic formulas
- stable system versions
- world seed
- tick history
- event history
- snapshot anchors
- migration/version metadata

Future replay should support reconstructing major historical changes, debugging formula changes, comparing worlds across versions, replaying atlas states, and explaining chronicler narratives from event evidence.

Do not make changes that would make replay impossible without documenting and versioning them.

## Observer Architecture

The observer layer includes pages, components, API routes, dashboards, and visualizations.

It may read simulation state, display summaries, render atlas layers, inspect cells, show events, and trigger approved actions through APIs.

It may not directly mutate simulation truth, advance time outside the scheduler, create agent knowledge, invent causal explanations, or store authoritative simulation state in the browser.

The observer boundary is especially important for humans. Human agents must never receive evidence of the UI, users, observers, database, code, ticks as code, or Chronicler.

## Atlas Architecture

The Atlas is a serialized snapshot viewer plus a rich client-side inspection tool.

```text
World/Planet state
      |
      v
Atlas snapshot service
      |
      v
Serialized atlas data
      |
      v
Client renderer
      |
      v
Canvas layers + inspector UI
```

Atlas responsibilities:

- render planet layers
- provide navigation
- display legends
- inspect cells
- show overlays
- reveal warnings
- compare systems spatially

Atlas non-responsibilities:

- calculating authoritative simulation outcomes
- mutating planet state
- advancing time
- inventing missing values

Performance strategy:

- render base layers to an in-memory buffer
- redraw only when relevant state changes
- auto-scale overlays by zoom and grid size
- cache derived client values where safe
- avoid clutter at large world sizes

## Developer Control Room

The Developer Control Room at `/worlds` is the primary operational dashboard.

It shows:

- world list
- statuses
- environments
- protection state
- canonical fingerprint status
- current tick
- time and astronomy
- health summaries
- recent ticks
- recent actions
- simulation metrics
- planet summaries
- Human MVA metrics

Developer controls must call approved server actions or APIs. They must not directly mutate simulation truth from the client.

## Coding Standards

General:

- Use TypeScript types to make system boundaries explicit.
- Prefer existing helpers and patterns.
- Keep edits scoped.
- Avoid broad refactors during feature work.
- Keep docs updated when architecture changes.

Simulation:

- Deterministic only.
- Add tests for formula changes.
- Use seeded random utilities.
- Clamp/round values when needed.
- Sort before order-sensitive operations.
- Return health and metrics.
- Emit meaningful events.

Persistence:

- Scope by `worldId`.
- Use transactions for tick operations.
- Batch where practical.
- Add indexes for world, tick, cell, species, event type, and status as needed.
- Migrations must be reviewed as permanent history changes.

UI:

- Treat UI as observatory.
- Do not place simulation math in components.
- Avoid authoritative browser state.
- Make inspector data traceable to engine/snapshot fields.
- Keep developer tools clear and operationally safe.

## Simulation Rules

Do not add civilizations before their prerequisites exist.

A system should not appear just because it is exciting. It should appear when the lower-level systems can support it.

Examples:

- Fire requires fuel, ignition conditions, risk, observation, memory, teaching, and controlled use.
- Agriculture requires plant knowledge, seasonal memory, place attachment, labor, storage, and reproduction of plant effects.
- Government requires group scale, conflict, coordination, legitimacy, obligation, and enforcement.
- Religion requires meaning-making, memory, mortality, ritualization, shared belief, and tradition.

## Performance Expectations

Current targets:

| Area | Expectation |
| --- | --- |
| Single development tick | Ideally under 1 second for current grid size. |
| Atlas snapshot | Ideally under 500 ms for common cases. |
| Health endpoint | Ideally under 250 ms for common cases. |
| Test suite | Fast enough to run frequently during development. |

Future targets:

- chunked simulation
- dirty-cell updates
- region partitioning
- worker execution
- snapshot compression
- event-first history storage
- profiling for long runs

Any system that loops over cells or populations must be designed with future scale in mind.

## Testing Expectations

Every major system should test deterministic output, edge cases, persistence behavior, scheduler integration, health reporting, event emission, atlas serialization if relevant, and UI display if relevant.

Required validation before major merge:

```bash
npm run lint
npm test
npm run build
npm run prisma:validate
```

Tests should become broader when a change touches scheduler behavior, registry/dependency validation, persistence contracts, world lifecycle, canonical world generation, shared atlas snapshot shape, human agent behavior, or the event pipeline.

## Architectural Decision Rationale

| Decision | Reason |
| --- | --- |
| Deterministic engine | Enables replay, testing, debugging, and causal history. |
| World-scoped data | Prevents contamination between production, staging, sandbox, and experiments. |
| Scheduler-owned time | Prevents hidden state mutation and preserves tick order. |
| System registry | Allows new domains without rewriting orchestration. |
| Explicit dependencies | Keeps causal order stable and inspectable. |
| Event bus | Turns state changes into history and evidence. |
| Observer boundary | Prevents UI and agents from contaminating each other. |
| Canonical fingerprint | Verifies default world consistency across environments. |
| Health metrics | Makes long-running simulation failures visible. |
| Atlas snapshots | Decouple visual inspection from raw database access. |

## Definition Of Done For New Systems

A new simulation system is not complete until it has:

- deterministic calculation logic
- stable system id, label, order, version, and dependencies
- registry integration
- persistence strategy
- health reporting
- metrics
- event emissions where meaningful
- atlas/inspector integration where relevant
- tests
- updated documentation
- passing lint, tests, build, and Prisma validation

## Final Rule

Every architectural change should preserve one principle:

The world must be able to explain itself.
