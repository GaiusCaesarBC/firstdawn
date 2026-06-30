# First Dawn Context

This is the complete handoff document for First Dawn. It is intended for new engineers, AI coding agents, maintainers, and contributors who need to understand the project before making changes.

For supporting canonical documents, see:

- [VISION.md](./VISION.md) for the project purpose and philosophy.
- [ARCHITECTURE.md](./ARCHITECTURE.md) for the engineering handbook.
- [ROADMAP.md](./ROADMAP.md) for phased development planning.
- [CONSTITUTION.md](./CONSTITUTION.md) for foundational project rules.
- [CANONICAL_WORLD.md](./CANONICAL_WORLD.md) for canonical world seed and fingerprint rules.

## Project Summary

First Dawn is a long-term deterministic artificial civilization simulation and observer platform.

It is not a conventional game. It is not a scripted story generator. It is a simulation engine designed to create a world whose history emerges from physical, ecological, cognitive, and social rules.

The website is an observatory attached to the simulation. The observatory may display, inspect, explain, and operate approved development controls, but it must never become the source of simulation truth.

## Mission

Build the most believable deterministic artificial civilization ever created.

That means:

- The world must continue to make sense when no one is watching.
- Causes must produce consequences.
- Consequences must leave evidence.
- History must be inspectable and explainable.
- Intelligent behavior must arise from interaction with the simulated world.
- Civilization must emerge from accumulated state, not from authorial scripts.

## Philosophy

First Dawn is built around restraint. The project deliberately avoids jumping directly to cities, governments, religions, technology trees, or scripted cultures. Those systems must eventually arise from lower-level world state.

The intended growth path is:

```text
physical world
  -> climate and weather
  -> resources and terrain constraints
  -> plants and animals
  -> adaptation and ecological pressure
  -> individual humans
  -> memory, belief, relationships, teaching
  -> discovery
  -> shared knowledge
  -> groups
  -> culture
  -> institutions
  -> civilizations
```

The project favors explainability over spectacle. A future observer should be able to inspect a world event and answer what caused it, which systems contributed, what evidence was recorded, who or what was affected, what changed afterward, and what future pressures were created.

## Long-Term Vision

The eventual simulation should support ecosystems, intelligent agents, families, communities, cultures, governments, economies, religions, scientific discovery, industrialization, exploration, and modern civilizations.

None of those outcomes should be hardcoded.

For example:

- A religion should not appear because a "religion system" decides one is due.
- A government should not appear because a tech tree unlocks it.
- A city should not appear because a phase requires it.
- Scientific discovery should not be a scripted checklist.

Instead, these should emerge from population pressure, memory, teaching, shared belief, resource constraints, environmental threats, cooperation, conflict, communication, and accumulated evidence.

## Technology Stack

| Area | Technology |
| --- | --- |
| Application framework | Next.js |
| UI runtime | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database ORM | Prisma |
| Database target | PostgreSQL |
| Testing | Vitest, Testing Library |
| Simulation model | Deterministic TypeScript systems |
| Rendering model | Server-rendered dashboard plus client-side atlas canvas/UI |

The current codebase is a Next.js application with simulation logic under `src/lib/simulation`, world services under `src/lib/worlds`, app routes under `src/app`, Prisma schema and migrations under `prisma`, and tests under `tests`.

## Core Architectural Rules

These rules are non-negotiable.

| Rule | Meaning |
| --- | --- |
| Simulation first | The engine is the product; the UI is an observatory. |
| World-scoped data | Every simulation record must belong to a `worldId`. |
| Scheduler-owned time | Only the scheduler may advance simulation time. |
| Deterministic output | Same seed, tick, prior state, and system versions must produce the same result. |
| UI is not truth | React state may display simulation state but must not become authoritative. |
| Explicit ownership | Systems own their own state and must not casually mutate another system's state. |
| Events explain history | Important changes must emit events or leave inspectable evidence. |
| Emergence over scripts | Civilization, culture, religion, science, and institutions must emerge from lower-level state. |
| Production safety | Production worlds must be protected from destructive developer operations. |
| Tests protect determinism | Changes to simulation formulas require focused deterministic tests. |

## World Architecture

A `World` is the root boundary for simulation continuity.

It owns identity, slug, environment, lifecycle status, protection state, tick clock, time scale, seed, planet relation, simulation history, events, people, memories, relationships, locations, animals, and plants.

World environments:

| Environment | Purpose |
| --- | --- |
| `PRODUCTION` | Canonical long-lived world. Must be protected and treated as permanent history. |
| `STAGING` | Rehearsal environment for migrations and operational workflows. |
| `SANDBOX` | Local development and disposable exploration. |
| `EXPERIMENT` | Isolated research or branch worlds. |

World statuses:

| Status | Meaning |
| --- | --- |
| `DRAFT` | Exists but is not ready to run. |
| `ACTIVE` | Selected for simulation work in its environment. |
| `PAUSED` | Preserved but not advancing. |
| `ARCHIVED` | Retained for reference and not normally reactivated. |

The production world must never be accidentally reset, seeded over, or polluted with sandbox/staging data.

## Canonical World

First Dawn has one official default planet:

```text
FIRST_DAWN_CANONICAL_WORLD
```

Its immutable seed is:

```text
FIRST_DAWN_CANONICAL_WORLD_V1_2026_06_27
```

Canonical world generation is verified through a deterministic fingerprint. The fingerprint includes generated planet data such as seed, grid dimensions, orbital parameters, terrain distribution, hydrology, atmosphere, weather, climate, ocean percentage, land percentage, and elevation summaries.

The fingerprint intentionally excludes environment name, world display name, database URL, authentication, logging, and deployment configuration.

## Scheduler Architecture

The scheduler is the engine authority. It advances active non-production worlds through ordered simulation ticks.

For each tick, the scheduler:

1. Locks the world row.
2. Validates that the world can run.
3. Resolves the next target tick.
4. Loads registered systems sorted by order.
5. Validates system dependencies.
6. Creates a deterministic context for each system.
7. Runs system lifecycle hooks.
8. Collects metrics, health, warnings, errors, and events.
9. Stops the pipeline on system failure.
10. Updates `World.currentTick`.
11. Persists `SimulationTick` metadata.
12. Persists collected events when configured.
13. Emits scheduler lifecycle events.

The scheduler supports accurate, fast, and turbo-style fidelity modes for long simulations. It also supports checkpoints so progress can be audited without storing every intermediate tick at full fidelity.

## Deterministic Simulation Rules

Simulation systems must be deterministic.

Do:

- Use seeded deterministic random utilities.
- Include world seed, tick, and system identity in random streams.
- Include entity or cell identity when local variation is needed.
- Clamp and round values where floating-point drift could matter.
- Sort collections before order-sensitive operations.
- Scope all queries by `worldId`.
- Emit events for meaningful state changes.
- Add tests before changing formulas with broad effects.

Do not:

- Use `Math.random()` inside simulation systems.
- Use wall-clock time to decide simulation outcomes.
- Let React state become authoritative simulation state.
- Depend on unordered object iteration when order matters.
- Mutate another system's owned state without a defined interface.
- Use production worlds for shortcut testing.

## Current Simulation Systems

The default registry currently includes:

| Order | System | Role |
| ---: | --- | --- |
| 1 | Time | Tick time, day/year labels, phase state. |
| 2 | Astronomy | Seasons, solar intensity, sky state. |
| 3 | Physics | Physical placeholder/foundation. |
| 4 | Climate | Climate bands and temperature context. |
| 5 | Geology | Geological and terrain foundation. |
| 6 | Oceans | Ocean-related world state. |
| 7 | Atmosphere | Pressure zones, wind, stability, moisture transport. |
| 8 | Weather | Humidity, clouds, storms, snow, fog, dryness. |
| 9 | Resources | Metals, water resources, building materials, rare materials. |
| 10 | Biomes | Biome classification and habitability context. |
| 11 | Plants | Plant ecology, biomass, edible support, regrowth. |
| 12 | Chemistry | Placeholder/foundation after plants. |
| 13 | Biology | Placeholder/foundation after chemistry. |
| 14 | Animals | Animal populations, food webs, migration, ecosystem health. |
| 15 | Adaptation | Population-level fitness and long-term adaptation pressure. |
| 16 | Humans | Minimum viable human agent foundation. |
| 17 | Civilization | Future boundary placeholder. |
| 18 | Economy | Future boundary placeholder. |
| 19 | Culture | Future boundary placeholder. |
| 20 | Memory | Future boundary placeholder. |
| 21 | Discovery | Discovery foundation from events and memories. |
| 22 | Event generation | Event pipeline boundary. |
| 23 | Metrics | Metrics aggregation. |
| 24 | Save state | Persistence/save-state boundary. |

New systems must register through the system registry and declare explicit dependencies. The scheduler should not require code changes when a new system is added correctly.

## Planet Systems

Current planet simulation work includes:

- Grid and coordinate utilities.
- Canonical deterministic planet generation.
- Terrain types, elevation, ruggedness, continentalness, coastlines, mountains.
- Hydrology, watersheds, basins, drainage, river candidates, lake candidates, distance to ocean.
- Atmosphere, pressure bands, wind direction, wind strength, rain shadows, moisture transport.
- Climate bands, temperature, solar energy, daylight hours, seasonal modifiers.
- Weather fields including humidity, cloud cover, storms, snow, fog, dryness, and weather class.
- Resource richness including metals, industrial materials, water resources, building resources, and rare materials.
- Biome classification, habitability, fertility, water availability, vegetation density, and tags.
- Plant ecology including dominant plants, biomass, edible score, wood, medicinal potential, biodiversity, regrowth, and seasonal stress.
- Animal ecology including species populations, guilds, habitat suitability, food availability, predation pressure, migration, carrying capacity, ecosystem health, movement vectors, and ecosystem history.
- Population adaptation including fitness, adaptation profiles, trait trends, highest/lowest fitness populations, adaptation diversity, and adaptation milestone events.

## Human MVA Foundation

The Human MVA is a minimum viable agent foundation. It is not full civilization.

Current implementation characteristics:

- Deterministically spawns two first humans, one male and one female.
- Both begin as adults around age 20.
- Both start together in the same cell.
- Agents have needs, emotions, personality, curiosity profiles, motivations, beliefs, directional relationships, and lightweight Theory of Mind estimates.
- Agents choose actions using deterministic utility scoring.
- Current action foundation includes drinking, eating, seeking safety, resting, communicating, teaching, observing the environment, and exploring.
- Meaningful events create episodic memories.
- Human causal events are emitted through the scheduler system boundary.
- The Chronicler can summarize causal events for observers without mutating state.
- Reproduction eligibility is constrained to living adults over 18 and appropriate relationship/decision conditions.

Important limitation:

The current Human MVA is a deterministic replay foundation and not yet the final persistent human database model. Persistent humans, families, pregnancy, childhood, aging, death, migration, hunting, gathering, shelter, and survival loops are future work.

Hard boundary:

Human agents must never know they are simulated. No memory, belief, prompt, communication, event, debug field, or chronicler output may become available to agents as evidence of simulation, ticks as code, UI state, users, observers, databases, or the Chronicler.

The Human MVA must not hardcode tribes, governments, religions, writing, cities, markets, trade, technology trees, laws, social classes, warfare, scripted romance, scripted first words, guaranteed reproduction, or guaranteed survival.

## Discovery Engine

The Discovery Engine foundation turns repeated human-environment experiences into emergent knowledge.

Conceptual lifecycle:

```text
Unknown
  -> Observed
  -> Repeated
  -> Understood
  -> Reliable
  -> Teachable
  -> Shared Knowledge
```

Core concepts:

| Concept | Meaning |
| --- | --- |
| Observation | A single experience mapped to a general phenomenon. |
| Hypothesis | Aggregated observations with confidence, participants, locations, and evidence. |
| Discovery | A confirmed phenomenon with enough evidence to become reliable or shareable. |

The first implementation scope is environmental discovery only. Fire, tools, pottery, agriculture, religion, writing, government, and other advanced systems must not be hardcoded into this foundation.

Future systems should emit outcome-rich events. The Discovery Engine should consume those events and let knowledge emerge through repeated evidence.

## Observer And UI Architecture

The observer layer exists so humans outside the simulation can inspect the world.

The observer may read world state, display dashboards, show health summaries, render atlas layers, inspect cells, show histories and events, and trigger approved developer actions.

The observer may not invent simulation truth, directly mutate simulation models, bypass scheduler time, leak observer knowledge into agents, or store authoritative state in React.

Current observer surfaces include:

- Root site/home experience.
- Developer Control Room at `/worlds`.
- Planet Atlas at `/worlds/map`.
- Grid, biome, plant, and animal visualization routes.
- World action APIs.
- World health APIs.
- Atlas snapshot APIs.

## Atlas Architecture

The Planet Atlas is the primary visual inspection tool for deterministic planet state.

It includes:

- 2D developer atlas.
- Globe preview mode.
- Layer switching.
- Dynamic legends.
- Overlays.
- Pan and zoom.
- Cell selection.
- Cell inspector.
- Search by cell ID, latitude, coordinates, and named planet features.
- Quick navigation for poles, equator, prime meridian, highest mountain, lowest point, largest continent, largest ocean, largest watershed, largest basin, wettest, driest, warmest, coldest, strongest wind, and largest rain shadow.
- Overlay level-of-detail scaling for large grids.
- Local search history and favorites.

Atlas layers cover planet composite, elevation, terrain, climate, temperature, solar energy, daylight, hydrology, oceans, watersheds, river/lake candidates, atmosphere, wind, rain shadow, weather, resources, biomes, vegetation, animals, migration, food, predation, ecosystem health, carrying capacity, plant consumption, adaptation, and future civilizations.

## Persistence Model

Current Prisma persistence includes:

- `World`
- `WorldActionLog`
- `Planet`
- `PlanetCell`
- `AnimalPopulation`
- `SimulationTick`
- `Person`
- `Memory`
- `Event`
- `Relationship`
- `Location`
- `Animal`
- `Plant`

The existing person/memory/relationship tables are foundational. The Human MVA currently uses deterministic replay state and metadata, so future persistent human work must decide whether to extend current tables, add dedicated human-agent tables, or bridge both models through a clear migration plan.

All future simulation tables must include `worldId` unless they are strictly static catalogs with no world-specific state.

## Testing Coverage

The repository includes tests for:

- Scheduler behavior.
- Registry validation.
- Determinism.
- Canonical world generation.
- World lifecycle.
- World actions.
- World health.
- Time and astronomy.
- Terrain.
- Hydrology.
- Atmosphere.
- Climate.
- Weather.
- Resources.
- Biomes.
- Plants.
- Animals.
- Adaptation.
- Human MVA.
- Atlas/world map UI.

Minimum validation before major changes:

```bash
npm run lint
npm test
npm run build
npm run prisma:validate
```

For formula changes, add deterministic before/after tests and document expected changes.

## Current Implementation Status

Completed or substantially implemented:

- Next.js application shell.
- Tailwind styling foundation.
- Prisma schema and migrations.
- World lifecycle model.
- World environments and statuses.
- Action logging.
- Canonical world seed and fingerprinting.
- Deterministic scheduler and system registry.
- Simulation tick persistence.
- Event bus.
- Health aggregation.
- Planet generation and summary systems.
- Climate, weather, atmosphere, hydrology, terrain, resource, biome, plant, animal, and adaptation foundations.
- Developer Control Room.
- Planet Atlas.
- Atlas navigation and visualization polish.
- Human MVA deterministic foundation.
- Discovery Engine foundation.
- Test coverage across major simulation systems.

Partially implemented or foundation-only:

- Persistent human state.
- Chronicler as a full historical narrative system.
- Discovery as a long-term persistent shared-knowledge system.
- Civilization, economy, culture, and memory systems beyond boundaries/placeholders.
- Full replay tools.
- Production deployment operations.

Not implemented yet:

- Persistent families.
- Pregnancy and birth lifecycle.
- Childhood and aging.
- Death.
- Hunting/gathering survival loops.
- Shelter.
- Human migration.
- Disturbances such as wildfire, flood, drought, and disease.
- Tool use.
- Fire.
- Language evolution.
- Tribes.
- Agriculture.
- Trade.
- Religion.
- Government.
- Writing.
- Cities.
- Industry.
- Modern civilizations.

## Major Completed Milestones

| Milestone | Outcome |
| --- | --- |
| World lifecycle | Environments, statuses, protected worlds, action logging. |
| Canonical world | Stable seed, deterministic fingerprint, terrain validation. |
| Scheduler foundation | Ordered systems, dependency validation, tick metadata, health, events. |
| Planet foundation | Terrain, hydrology, atmosphere, climate, weather, resources. |
| Ecology foundation | Biomes, plants, animals, food pressure, migration, ecosystem health. |
| Adaptation foundation | Population fitness, trait profiles, long-term adaptation pressure. |
| Observer foundation | Developer Control Room and world health surfaces. |
| Atlas foundation | Multi-layer atlas, inspector, overlays, search, globe preview. |
| Human MVA | First two agents, needs, emotions, memory, communication, teaching, causal events. |
| Discovery foundation | Observation/hypothesis/discovery lifecycle design and system boundary. |

## Known Limitations

- The Human MVA is not yet persisted as normalized long-term human state.
- Some future systems are registered as placeholders or boundaries.
- Atlas rendering is powerful but still developer-oriented.
- Production operations and backup/restore workflows need more formal runbooks.
- Snapshot and replay architecture is not complete.
- Cross-system feedback interfaces need to mature as disturbances, humans, and ecology interact more deeply.
- Large-world performance needs continued profiling, caching, partitioning, and batching.
- Discovery and Chronicler systems need persistence and richer query models before they can serve long historical timelines.

## Planned Future Systems

Future work should proceed in dependency order:

1. Persistent human agents.
2. Human survival loop: food, water, shelter, danger, fatigue.
3. Family, pregnancy, childhood, aging, death.
4. Human migration and seasonal behavior.
5. Environmental disturbances.
6. Expanded discovery and shared knowledge.
7. Tool use and fire.
8. Language evolution.
9. Groups and tribes.
10. Agriculture and domestication.
11. Trade and villages.
12. Religion, government, writing, and law.
13. Cities and nations.
14. Science, engineering, industry.
15. Global trade, exploration, and advanced civilizations.

See [ROADMAP.md](./ROADMAP.md) for detailed phases.

## Development Principles

When contributing to First Dawn:

- Read the existing system before changing it.
- Preserve deterministic behavior.
- Keep changes world-scoped.
- Prefer engine/domain services over UI logic.
- Keep simulation math inside simulation modules.
- Keep persistence batched and explicit.
- Add health metrics to new systems.
- Add events for historically meaningful changes.
- Add tests for deterministic formulas.
- Avoid broad refactors during feature work unless needed.
- Never introduce scripted civilization outcomes.

## Contributor Preservation Rules

Every future contributor must preserve:

1. The scheduler as the sole authority for time advancement.
2. `worldId` isolation for all world-specific state.
3. Deterministic simulation output.
4. The observer boundary.
5. Agent ignorance of simulation and observers.
6. System ownership boundaries.
7. Event-backed explainable history.
8. Production world protection.
9. Emergent civilization rather than scripted civilization.
10. Test coverage for simulation changes.

If a proposed change violates any of these rules, redesign it.
