# First Dawn Permanent Architecture Design Document

## 1. Purpose

First Dawn is a deterministic planetary simulation engine that begins with physical world formation and gradually builds toward ecosystems, intelligent life, culture, and civilizations.

The project must be treated as a long-term simulation platform, not a normal web application.

Every future feature must follow these principles:

* deterministic simulation behavior
* clear system ownership
* strict tick ordering
* no hidden state mutations
* no UI-owned simulation logic
* persistent history for important changes
* performance-aware batch processing
* testable system boundaries

The goal is to keep First Dawn expandable for years without turning the simulation into tangled feature code.

---

## 2. Core Architecture Layers

First Dawn is divided into five major layers.

### 2.1 Engine Layer

Responsible for running the simulation.

Includes:

* scheduler
* tick lifecycle
* system registry
* world locking
* deterministic seed utilities
* event pipeline
* persistence coordination
* health reporting

The engine does not know about UI components.

### 2.2 Simulation Systems Layer

Contains individual simulation domains.

Current and future systems include:

* time
* astronomy
* terrain
* hydrology
* atmosphere
* climate
* weather
* biomes
* plants
* animals
* migration
* food webs
* adaptation
* disturbances
* intelligent species
* tribes
* civilizations
* technology
* diplomacy
* warfare
* religion
* economy
* history

Each system owns its own calculations and state.

### 2.3 Persistence Layer

Responsible for storing world state.

Includes:

* Prisma models
* migrations
* repositories
* batch writes
* snapshot persistence
* historical records
* event storage

Simulation systems should not scatter raw database writes everywhere. Whenever possible, writes should flow through system-specific persistence helpers.

### 2.4 API Layer

Responsible for exposing read/write operations to the app.

Includes:

* world APIs
* map snapshot APIs
* health APIs
* action APIs
* simulation tick APIs
* admin/debug APIs

APIs should call engine/domain services. They should not contain core simulation math.

### 2.5 UI Layer

Responsible for visualization and control.

Includes:

* world dashboard
* planet atlas
* cell inspector
* health panels
* overlays
* charts
* debugging tools

The UI must never be the source of truth for simulation state.

---

## 3. Core Engine Modules

Recommended long-term structure:

```text
src/lib/engine/
  scheduler/
  ticks/
  registry/
  locks/
  events/
  history/
  persistence/
  deterministic/
  health/

src/lib/simulation/
  systems/
  time/
  astronomy/
  terrain/
  hydrology/
  atmosphere/
  climate/
  weather/
  biomes/
  plants/
  animals/
  adaptation/
  evolution/
  intelligence/
  civilizations/

src/lib/worlds/
  map-atlas/
  snapshots/
  repositories/
  selectors/

src/app/
  api/
  worlds/
  components/
  worlds/
```

Current structure does not need to be fully moved immediately, but future code should trend toward this separation.

---

## 4. Simulation System Lifecycle

Every simulation system should follow the same lifecycle.

### 4.1 System Metadata

Each system should declare:

* system id
* display name
* version
* dependencies
* order
* whether it mutates state
* whether it emits events
* whether it writes persistence
* whether it contributes health metrics

Example:

```ts
export const animalSystem = {
  id: "animals",
  name: "Animal Population System",
  version: 1,
  dependencies: ["biomes", "plants", "weather"],
  order: 800,
};
```

### 4.2 Tick Execution

Each system should run in this pattern:

```text
load required state
derive deterministic inputs
calculate next state
emit events
persist changes
return metrics
```

Systems should not depend on UI state, browser state, or wall-clock randomness.

### 4.3 System Result

Every system should return a standard result:

```ts
type SimulationSystemResult = {
  systemId: string;
  status: "success" | "warning" | "failed";
  tickNumber: number;
  metrics: Record<string, number | string | boolean>;
  events: SimulationEvent[];
  warnings: string[];
  error?: string;
};
```

This makes scheduler logging, world health, debugging, and future admin tools much easier.

---

## 5. Tick Ordering and Dependencies

Tick order must be explicit and stable.

Recommended order:

```text
1. Time
2. Astronomy
3. Geology / Terrain
4. Hydrology
5. Atmosphere
6. Climate
7. Weather
8. Biomes
9. Plants
10. Animals
11. Migration
12. Food Web
13. Ecosystem Health
14. Adaptation
15. Disturbances
16. Intelligent Species
17. Social Groups
18. Culture
19. Settlements
20. Civilizations
21. Economy
22. Diplomacy
23. Conflict
24. History
25. World Health
```

A system may only read from systems that run before it.

A system may not mutate state owned by earlier systems unless the architecture explicitly allows feedback loops.

Examples:

* Animals may read plants.
* Animals may apply grazing pressure through a plant-consumption interface.
* Animals should not directly rewrite climate data.

---

## 6. Data Ownership Rules

Each system owns specific state.

### 6.1 Terrain System Owns

* elevation
* slope
* land/water classification
* geological base data

### 6.2 Hydrology Owns

* water availability
* rivers
* lakes
* drainage
* moisture flow

### 6.3 Climate / Weather Own

* temperature
* rainfall
* humidity
* wind
* seasonal climate values
* weather snapshots

### 6.4 Biome System Owns

* biome type
* biome tags
* biome confidence
* biome transition data

### 6.5 Plant System Owns

* plant density
* plant biomass
* dominant vegetation
* growth stress
* edible biomass

### 6.6 Animal System Owns

* animal populations
* animal health
* food availability
* migration pressure
* carrying capacity
* predation pressure
* ecosystem health contribution

### 6.7 Adaptation System Owns

* population-level traits
* fitness scores
* adaptation history
* long-term environmental pressure

### 6.8 Civilization Systems Will Own

* intelligent populations
* social groups
* settlements
* culture
* resources
* technology
* governance
* conflict
* trade
* religion
* memory

No system should casually mutate another system's owned state.

Cross-system effects must happen through defined interfaces.

---

## 7. Persistence Strategy

Persistence must support:

* current world state
* historical tick state
* event history
* atlas snapshots
* debugging
* long-term replay potential

### 7.1 Current State

Current state lives on canonical models like:

* World
* Planet
* PlanetCell
* AnimalPopulation
* PlantPopulation
* SimulationTick

This state powers fast UI reads.

### 7.2 Historical State

Important historical changes should be stored as events, not full copies of every cell every tick.

Example events:

* population boom
* migration wave
* drought stress
* food shortage
* ecosystem collapse
* adaptation milestone
* settlement founded
* war started
* religion emerged

### 7.3 Snapshots

Snapshots should be used for:

* atlas rendering
* debugging
* replay anchors
* major milestone states

Do not snapshot everything every tick unless performance and storage targets allow it.

### 7.4 Batch Writes

Simulation systems should batch database writes.

Avoid per-cell individual write loops when possible.

Preferred:

```text
calculate all updates in memory
prepare batch update payloads
write in transaction
record events
record system metrics
```

---

## 8. Event Bus

First Dawn needs a deterministic event system.

Events are the bridge between simulation math and world history.

### 8.1 Event Types

Examples:

```text
CLIMATE_SHIFT
DROUGHT_STARTED
DROUGHT_ENDED
PLANT_BLOOM
FOOD_SHORTAGE
POPULATION_BOOM
POPULATION_COLLAPSE
MIGRATION_WAVE
PREDATOR_EXPANSION
ECOSYSTEM_COLLAPSE
ADAPTATION_MILESTONE
SPECIES_EXTINCTION
INTELLIGENT_SPECIES_EMERGED
TRIBE_FORMED
SETTLEMENT_FOUNDED
WAR_STARTED
RELIGION_EMERGED
TECHNOLOGY_DISCOVERED
```

### 8.2 Event Shape

```ts
type SimulationEvent = {
  id: string;
  worldId: string;
  tickNumber: number;
  systemId: string;
  type: SimulationEventType;
  severity: "info" | "minor" | "major" | "critical";
  cellId?: string;
  regionId?: string;
  speciesId?: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
};
```

### 8.3 Event Rules

Events must be:

* deterministic
* ordered by tick
* deduplicated when needed
* queryable by cell, species, region, system, and severity
* useful to both UI and future AI agents

---

## 9. History System

The history system should turn raw events into meaningful stories.

### 9.1 Cell History

Each cell should be able to answer:

* what happened here?
* why did the ecosystem change?
* what species rose or declined?
* what disasters affected it?
* what civilizations occupied it?

### 9.2 Species History

Each species should be able to answer:

* where did it thrive?
* where did it decline?
* what adaptations emerged?
* where did it migrate?
* did it go extinct?

### 9.3 Civilization History

Future civilization systems should record:

* founding
* migrations
* conflicts
* alliances
* discoveries
* collapses
* religions
* cultural shifts
* leader changes

### 9.4 Replay Compatibility

The history system should eventually support replaying major world changes without recalculating every tick.

---

## 10. UI Boundaries

The UI is a visualization layer only.

It may:

* request snapshots
* display overlays
* inspect cells
* trigger approved actions
* show health panels
* show history
* show charts

It may not:

* calculate simulation truth
* directly mutate simulation models
* bypass the scheduler
* invent state not present in the engine
* store authoritative simulation state in React

### 10.1 Atlas

The atlas should consume serialized snapshots.

It should not reach into database models directly.

### 10.2 Inspector

The inspector should explain data.

It should show:

* current values
* status badges
* trends
* influencing systems
* history
* warnings

### 10.3 Dashboard

The dashboard should show:

* active worlds
* health
* tick progress
* recent events
* system failures
* debug controls

---

## 11. Determinism Rules

First Dawn must remain deterministic.

Rules:

* no `Math.random()` in simulation systems
* no wall-clock time for simulation decisions
* no unordered object iteration when order matters
* no parallel writes that can change results
* no floating-point chaos without clamping/rounding
* no UI-driven simulation state

Use seeded deterministic utilities for variation.

Every system should produce the same result from the same:

* world seed
* tick number
* previous state
* input data
* system version

---

## 12. Performance Targets

First Dawn should be designed for growth.

### 12.1 Current Target

For the current grid size:

* single tick under 1 second in development
* atlas snapshot under 500ms
* health endpoint under 250ms
* full test suite remains manageable

### 12.2 Medium-Term Target

For larger worlds:

* batch processing by region
* cached derived values
* dirty-cell updates
* chunked simulation
* background worker execution
* optional headless simulation mode

### 12.3 Long-Term Target

For very large simulations:

* region partitioning
* tick queues
* snapshot compression
* event-based history instead of full state history
* worker threads or separate simulation service
* database indexes for worldId, tickNumber, cellId, speciesId, event type

---

## 13. Testing Strategy

Every major system needs tests for:

* deterministic output
* edge cases
* persistence behavior
* scheduler integration
* atlas serialization
* world health aggregation
* failure handling

Minimum required before merging:

```text
npm run lint
npm test
npm run build
npx prisma validate
```

For simulation systems, include long-duration stability tests where useful.

Examples:

* 1,000 ticks
* 10,000 ticks
* extreme climates
* empty cells
* collapsed ecosystems
* high population pressure
* migration boundaries

---

## 14. Versioning

Every simulation system should eventually have a version.

Changing core formulas should update the system version.

This allows future support for:

* migration of old worlds
* replay compatibility
* debugging formula changes
* comparing simulation versions

Example:

```ts
const ANIMAL_SYSTEM_VERSION = 1;
const ADAPTATION_SYSTEM_VERSION = 1;
```

---

## 15. Future Roadmap

Recommended long-term build order:

### Phase 1 - Planet Foundation

Completed or underway:

* time
* astronomy
* terrain
* hydrology
* atmosphere
* climate
* weather
* biomes

### Phase 2 - Life Foundation

Completed or underway:

* plants
* animal populations
* migration
* food webs
* ecosystem health
* history events

### Phase 3 - Evolution Foundation

Next:

* population adaptation
* long-term fitness
* regional variation
* eventual speciation readiness

### Phase 4 - Disturbance Engine

Future:

* droughts
* floods
* wildfires
* disease
* storms
* ecological recovery

### Phase 5 - Intelligence Foundation

Future:

* intelligent species
* memory
* learning
* social groups
* tool potential
* communication

### Phase 6 - Civilization Foundation

Future:

* tribes
* settlements
* agriculture
* trade
* culture
* religion
* government
* technology
* warfare
* diplomacy

---

## 16. Non-Negotiable Rules

These rules should protect the project long term.

1. The scheduler is the only authority for advancing simulation time.
2. UI never owns simulation truth.
3. Systems only mutate their owned state.
4. Cross-system effects require explicit interfaces.
5. Simulation output must be deterministic.
6. Every new system must expose health metrics.
7. Important changes must emit history events.
8. Persistence must be batched where possible.
9. Tests must cover deterministic behavior.
10. No civilizations before ecosystems, adaptation, and disturbance systems are stable.

---

## 17. Definition of Done for New Systems

A new simulation system is not complete until it has:

* system module
* deterministic calculation logic
* scheduler registration
* persistence strategy
* health metrics
* event emissions where relevant
* atlas serialization where relevant
* inspector display where relevant
* tests
* passing lint
* passing build
* passing Prisma validation

---

## 18. Final Direction

First Dawn should be built as a deterministic simulation engine with a web-based visualization interface.

The long-term goal is not simply to display a world.

The goal is to create a world whose history can be explained.

Every number should eventually answer:

* why did this happen?
* what caused it?
* what changed afterward?
* what might happen next?

That principle should guide every future architecture decision.
