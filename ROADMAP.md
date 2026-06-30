# First Dawn Roadmap

This roadmap starts from the current implementation and describes the phased path toward emergent civilization.

Read with:

- [FIRST_DAWN_CONTEXT.md](./FIRST_DAWN_CONTEXT.md) for current project context.
- [VISION.md](./VISION.md) for long-term purpose.
- [ARCHITECTURE.md](./ARCHITECTURE.md) for engineering rules.

## Roadmap Principles

First Dawn must grow in dependency order. Later systems must consume the evidence and pressures created by earlier systems.

Core rules:

- No civilization before survival.
- No culture before memory and teaching.
- No technology before discovery.
- No institutions before groups.
- No scripted history.
- No system that bypasses deterministic causality.

## Phase Overview

| Phase | Status | Theme |
| --- | --- | --- |
| Phase 1 | Completed / foundation complete | Deterministic world, ecology, atlas, Human MVA, discovery foundation. |
| Phase 2 | Next | Persistent human life and survival. |
| Phase 3 | Planned | Environmental disturbance and ecological pressure. |
| Phase 4 | Planned | Expanded discovery, tools, fire, shared knowledge. |
| Phase 5 | Planned | Tribes, language, agriculture, religion, government, writing. |
| Phase 6 | Long-term | Cities, nations, science, industry, global civilization. |

## Phase 1: Completed Foundation

Phase 1 created the deterministic simulation foundation and observatory.

| Item | Why It Exists | Prerequisites / Dependencies | Data Model | UI | Testing | Completion Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| World lifecycle | Worlds are the root boundary for time, identity, data isolation, and operational safety. | Prisma, world-scoped architecture. | `World`, `WorldActionLog`, environment/status/protection fields. | Developer Control Room world list and action history. | Lifecycle transitions, protected world behavior, action logs. | Worlds have environments, statuses, protection, action logs, and safe operations. |
| Scheduler | The project needs one authority for time advancement. | Registered systems, deterministic random utilities, Prisma transaction support. | `SimulationTick` metadata, event persistence, world tick updates. | Simulation controls, metrics, tick history. | Scheduler order, failures, metrics, dependency validation. | Systems run in deterministic order with metrics, health, events, and tick metadata. |
| Planet generation | Civilization needs a physical world. | Canonical seed, grid, coordinate system. | `Planet`, `PlanetCell`. | Planet overview, atlas base layers. | Canonical fingerprint, terrain validation, determinism. | Deterministic planet state exists with canonical seed and fingerprint verification. |
| Climate | Life and survival require seasonal and temperature context. | Time, astronomy, planet grid. | Derived climate fields and summaries. | Climate layer, season/time panels. | Deterministic bands and summaries. | Climate bands and solar/daylight context are available. |
| Weather | Agents and ecosystems need changing local pressure. | Atmosphere, climate. | Weather snapshot data in cells/metadata. | Weather layers and health summaries. | Humidity, cloud, storm, snow, fog, dryness tests. | Weather fields exist and vary deterministically by world/tick. |
| Resources | Future tools, trade, shelter, and industry require material constraints. | Geology, climate, terrain. | Resource summaries and cell resource fields. | Resource overlays and inspector fields. | Resource distribution determinism. | Metals, industrial materials, water, building materials, and rare materials are modeled. |
| Biomes | Plants and animals need habitat classification. | Weather, resources, terrain, hydrology. | Biome fields on `PlanetCell`. | Biome map and inspector. | Biome coverage and determinism. | Biome keys, categories, habitability, fertility, water, vegetation, and tags exist. |
| Plants | Animals and humans need food, biomass, wood, medicine potential, and ecological pressure. | Biomes, weather, hydrology. | Plant ecology fields on `PlanetCell`. | Plant map, vegetation layers, inspector. | Plant suitability, biomass, stress, coverage. | Plant suitability, density, biomass, edible score, wood, medicinal potential, biodiversity, regrowth, and stress exist. |
| Animals | Ecosystems need population pressure, predation, migration, and danger. | Plants, biology, biomes, weather. | `AnimalPopulation`, animal/ecosystem fields on `PlanetCell`. | Animal map, animal layers, movement overlays, inspector. | Population, migration, food web, ecosystem health tests. | Animal populations, guilds, carrying capacity, predation, migration, food stability, and ecosystem health exist. |
| Adaptation | Long-term ecology needs populations to respond to pressure. | Animals, climate, weather, food pressure. | Adaptation profile/trend fields on `AnimalPopulation` and cell summaries. | Adaptation overlays and health metrics. | Fitness, trait trends, milestone events. | Fitness scores, adaptation profiles, trait trends, diversity, and milestone events exist. |
| Human MVA | Civilization must begin with individual embodied agents. | Adaptation, ecology, time, event bus. | Deterministic replay metadata; future persistence not complete. | Human MVA health fields and atlas inspector hooks. | Human spawning, needs, emotions, memory, communication, teaching, agent ignorance. | Two adult agents can act, need, feel, remember, communicate, teach, and emit causal events. |
| Discovery Engine foundation | Knowledge must emerge from evidence. | Humans, memory/events, chronicler boundary. | Discovery types and foundation engine. | Discovery-facing atlas/dashboard fields planned. | Observation/hypothesis lifecycle tests as implementation expands. | Observation, hypothesis, discovery, and shared-knowledge lifecycle is defined. |
| Observer UI | Developers need to inspect and operate worlds safely. | World lifecycle, scheduler state, health services. | Reads world/action/tick/health data. | Developer Control Room. | UI and world map tests. | Dashboard shows worlds, health, ticks, canonical status, and summaries. |
| Planet Atlas | Spatial systems need visual inspection. | Atlas snapshots, planet systems, client renderer. | Serialized atlas snapshot shape. | Layers, overlays, search, inspector, legends, globe preview. | Atlas navigation and rendering tests. | Atlas supports inspection of major planet/ecology/adaptation layers. |

## Phase 2: Persistent Human Life And Survival

Phase 2 turns the Human MVA into persistent long-term human life.

| Item | Why It Exists | Prerequisites / Dependencies | Expected Data Model Changes | Expected UI Changes | Testing Requirements | Completion Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Persistent humans | Human history cannot be replay-only forever. Agents need durable identity, state, memories, relationships, location, biology, and life history. | Human MVA, scheduler, world isolation, `Person`/`Memory`/`Relationship` foundation. Depends on time, terrain, hydrology, weather, biomes, plants, animals, adaptation. | Human agent table or extended `Person`; biological state; needs; emotions; beliefs; memory links; relationship links; current/home cell; action history. | Human panel, atlas human overlay, human inspector, event timeline. | Deterministic initialization, persistence round trips, world isolation, tick continuity, scheduler integration, no observer leakage. | First two humans persist across ticks and reloads with deterministic world-scoped state. |
| Families | Families create kinship, dependency, care, inheritance of memory, and long-term social continuity. | Persistent humans, reproduction eligibility, genealogy fields. Depends on humans, memory, relationships. | Parent-child links, kinship relationship types, family event metadata. | Genealogy view, family inspector, birth/parentage events. | Kinship correctness, no duplicate links, deterministic relationship updates. | Children can be connected to known parents and kinship affects behavior. |
| Pregnancy | Population continuity requires biological reproduction with time, risk, constraints, and care. | Persistent adults, reproduction eligibility, health state, family/genealogy model. Depends on humans, relationships, time, needs/health. | Pregnancy state, conception tick, expected birth tick, pregnancy health/risk metadata, parent references. | Pregnancy status, birth events, health warnings. | Adults-only constraints, deterministic timing, no coercive reproduction mechanic, genealogy links. | Pregnancy begins only under valid conditions and birth creates a world-scoped child. |
| Childhood | Childhood creates dependency, learning, vulnerability, family bonds, teaching, and generational continuity. | Birth, aging, family relationships, persistent memory. Depends on humans, families, teaching, needs. | Developmental stage, dependency level, growth progression, learning modifiers. | Age stage indicators, child dependency warnings, caregiver relation views. | Age transitions, child survival constraints, caregiver effects, deterministic development. | Children age, differ from adults, and are affected by care, environment, and teaching. |
| Aging | Aging creates mortality, generational turnover, skill accumulation, dependency, and historical depth. | Persistent humans and time system. Depends on humans and time. | Age in days/ticks, life stage, fertility status, age-related health modifiers. | Age/life-stage display, population age distribution. | Deterministic age progression, threshold transitions, fertility constraints. | Age affects fertility, health, decisions, and social behavior without hardcoding institutions. |
| Death | Mortality gives survival stakes and creates grief, memory, lineage, and historical consequence. | Persistent health, aging, events, relationships, memories. Depends on humans, health, events, memory. | Death tick, cause of death, death event metadata, survivor memory links. | Death events, deceased state, population history, relationship aftermath. | Deterministic death causes, no dead-agent actions, survivor memory creation, genealogy intact. | Humans can die from explainable causes and death affects other agents. |
| Hunting | Hunting connects humans to animal ecology, danger, food, skill, cooperation, and tool pressure. | Persistent humans, animals, hunger, local perception, event pipeline. Depends on humans, animals, terrain, weather, future tools. | Hunting attempt events, injury risk, skill/experience fields, local animal pressure consumption. | Hunting events, cell food pressure, human skill summaries. | Deterministic success/failure, animal population impact, injury/death risk, no hunting in empty habitats. | Hunting can produce food, risk, memories, and ecological effects. |
| Gathering | Gathering is an early food and knowledge pathway tied to plant ecology and discovery. | Persistent humans, plant ecology, hunger, memory/belief. Depends on humans, plants, biomes, weather, discovery. | Gathering events, known edible plant beliefs, carried food or short-term food state. | Gathered food events, plant knowledge inspector. | Deterministic availability, plant biomass impact if modeled, memory/discovery hooks. | Humans can gather food from appropriate cells and learn from outcomes. |
| Shelter | Shelter connects terrain, weather, materials, safety, fatigue, and future technology. | Persistent humans, weather stress, building resources, location/home concepts. Depends on humans, terrain, weather, resources. | Shelter site/location, shelter quality, material use, shelter events. | Shelter markers, shelter quality inspector, weather protection summaries. | Deterministic shelter selection, weather mitigation, material constraints. | Humans can seek or improve shelter and receive survival effects from it. |
| Migration | Humans need to move in response to water, food, danger, weather, memory, and curiosity. | Persistent location, atlas topology, local perception, memory. Depends on humans, terrain, hydrology, weather, plants, animals. | Movement history, known locations, route memories, home/current cell separation. | Human movement overlay, route history, known-place inspector. | Deterministic neighbor movement, movement cost, memory-driven return behavior, no teleportation. | Humans move between cells for explainable reasons and remember places. |
| Seasonal survival | Seasons create pressure for memory, planning, migration, storage, clothing, shelter, and cooperation. | Persistent humans, weather/climate, food/water/shelter, memory. Depends on time, astronomy, climate, weather, humans, plants, animals. | Seasonal stress effects, remembered seasonal locations, survival strategy metadata. | Seasonal risk panel, survival warnings, seasonal migration display. | Deterministic seasonal cycles, pressure changes by season, long-run stability tests. | Humans alter behavior due to seasons and can survive or fail for explainable reasons. |

## Phase 3: Environmental Disturbances And Ecological Pressure

Phase 3 adds disruption. A believable world cannot be static.

| Item | Why It Exists | Prerequisites / Dependencies | Expected Data Model Changes | Expected UI Changes | Testing Requirements | Completion Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Wildfires | Wildfires connect weather, vegetation, heat, dryness, wind, animal migration, human danger, and future fire discovery. | Weather, plants, animals, events, atlas overlays. Depends on climate, weather, plants, animals, humans, discovery. | Disturbance events, burned cell state, recovery timers, smoke/danger metadata. | Wildfire overlay, burned-area history, danger warnings. | Deterministic ignition/spread, fuel constraints, wind/dryness effects, recovery. | Fires start, spread, damage ecosystems, threaten humans, and leave evidence. |
| Floods | Floods connect hydrology, rainfall, terrain, settlements, migration, and memory. | Hydrology, weather, terrain, events. Depends on hydrology, weather, terrain, humans. | Flood events, temporary water stress, affected cell history. | Flood overlay, flood warnings, water-level timeline. | Deterministic flood risk, basin/river influence, human/plant/animal effects. | Flooding occurs in plausible places and changes behavior/history. |
| Drought | Drought creates pressure on plants, animals, humans, migration, conflict, and discovery. | Weather, hydrology, plants, animals, humans. Depends on climate, weather, hydrology, plants, animals, humans. | Drought event state, water scarcity fields, drought recovery. | Drought overlay, scarcity warnings, affected population summaries. | Deterministic onset/end, plant/animal effects, human survival effects. | Droughts reduce water/food support and leave historical evidence. |
| Disease | Disease adds population pressure, mortality, immunity/adaptation, care, fear, and social consequences. | Persistent populations, health state, proximity/contact, events. Depends on animals, humans, adaptation, weather. | Disease state, infection events, immunity/resistance metadata, outbreak history. | Outbreak overlay, health panels, population impact summaries. | Deterministic spread, contact/proximity effects, mortality/recovery, world isolation. | Disease can spread, resolve, and alter population histories. |
| Predator/prey balancing | Ecosystems need dynamic food web feedback and realistic boom/collapse behavior. | Animals, plants, migration, ecosystem health. Depends on plants, animals, adaptation. | Richer food web links, predation events, local carrying pressure. | Predator/prey overlays, species pressure inspector. | Long-run stability, collapse/recovery scenarios, migration boundary tests. | Predator and prey populations influence each other without uncontrolled runaway behavior. |
| Ecological succession | Ecosystems recover and transform after disturbance. | Plants, biomes, disturbances, time. Depends on weather, plants, animals, disturbances. | Succession stage, recovery timers, colonization events. | Succession overlay, recovery timeline. | Deterministic recovery, climate/biome constraints, disturbance aftermath. | Disturbed cells recover or shift based on local conditions. |
| Resource exhaustion | Humans and civilizations must face material limits. | Resource model, human gathering/tool use, future settlements. Depends on resources, humans, future economy/industry. | Extractable resource state, depletion events, regeneration where applicable. | Depletion overlays, resource history. | Deterministic extraction, no negative resources, long-run depletion scenarios. | Resource use leaves persistent consequences. |

## Phase 4: Expanded Discovery And Early Technology

Phase 4 turns repeated survival into shared knowledge.

| Item | Why It Exists | Prerequisites / Dependencies | Expected Data Model Changes | Expected UI Changes | Testing Requirements | Completion Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Expanded Discovery Engine | Discovery is the bridge from experience to technology, culture, and science. | Persistent humans, memories, events, teaching, environmental outcomes. Depends on humans, memory, events, chronicler. | Observation records, hypothesis records, discovery records, shared knowledge records, evidence links. | Discovery timeline, knowledge inspector, evidence chain view. | Confidence progression, contradiction handling, multi-agent evidence, no scripted discoveries. | Discoveries emerge from repeated evidence and can become teachable/shared. |
| Fire | Fire transforms survival, food, warmth, danger, ecology, and technology. | Wildfire/disturbance, wood/fuel, human observation, discovery, teaching. Depends on weather, plants, humans, discovery, shelter. | Fire knowledge, controlled fire events, fuel use, burn risk. | Fire events, knowledge status, risk overlays. | No controlled fire without evidence, deterministic control/failure, ecological/human effects. | Humans can discover, use, lose, teach, and be endangered by fire. |
| Stone tools | Tools extend human ability and create technological dependency chains. | Resources, discovery, hands-on practice, memory. Depends on resources, humans, discovery. | Tool objects or capability state, skill records, material use, production events. | Tool knowledge panel, resource-to-tool links, human skill inspector. | Deterministic discovery/production, material constraints, skill effects. | Stone tools improve survival actions and leave evidence. |
| Clothing | Clothing connects weather, temperature stress, hunting, materials, tools, and survival. | Hunting/gathering, weather stress, tool use, discovery. Depends on humans, animals/plants, weather, discovery. | Clothing knowledge, worn protection state, material records. | Protection display, clothing events. | Weather mitigation, material constraints, degradation if modeled. | Clothing reduces environmental stress for explainable reasons. |
| Primitive shelter | Shelter becomes technology when humans can intentionally improve places. | Shelter foundation, resources, tools, discovery. Depends on terrain, resources, humans, discovery. | Constructed shelter state, durability, material consumption, location proximity. | Shelter markers, shelter quality timeline. | Deterministic construction, material constraints, survival benefit. | Humans can create improved shelters that persist and affect survival. |
| Cooperation | Cooperation is the root of society. | Relationships, communication, teaching, shared goals, memory. Depends on humans, relationships, memory. | Cooperative action events, shared goal metadata, trust/dependency changes. | Cooperation events, relationship timeline. | Relationship effects, success/failure outcomes, no forced cooperation. | Agents coordinate because state makes coordination useful. |
| Shared knowledge | Culture begins when knowledge persists beyond one individual's experience. | Discovery, teaching, memory, communication. Depends on humans, discovery, memory. | Shared knowledge table, source evidence, participants, confidence. | Shared knowledge browser, knowledge spread visualization. | Evidence-backed knowledge creation, teaching effects, loss/forgetting if modeled. | Knowledge becomes shared and influences future decisions. |

## Phase 5: Early Society And Institutions

Phase 5 begins social complexity. Nothing in this phase should appear without Phase 2-4 prerequisites.

| Item | Why It Exists | Prerequisites / Dependencies | Expected Data Model Changes | Expected UI Changes | Testing Requirements | Completion Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Tribes | Tribes represent durable group identity formed from kinship, proximity, cooperation, shared memory, and survival. | Families, persistent humans, cooperation, shared knowledge, population growth. Depends on humans, families, relationships, memory, shared knowledge. | Group identity records, membership history, shared location/activity metadata. | Group inspector, membership timeline, territory/proximity overlay. | No group without social basis, deterministic formation/splitting, membership changes. | Tribes emerge from repeated social continuity, not a scripted phase. |
| Language evolution | More complex society requires richer communication. | Communication, teaching, shared knowledge, groups. Depends on humans, memory, discovery, groups. | Language complexity metrics, vocabulary/concept domains, mutual intelligibility. | Language panel, communication success trends. | Deterministic growth, communication effects, divergence under separation. | Language complexity changes because communication pressures exist. |
| Agriculture | Agriculture changes settlement, surplus, population, labor, property pressure, and ecology. | Plant knowledge, seasonal memory, tools, settlement tendency, shared knowledge. Depends on plants, humans, discovery, tools, weather. | Cultivated plots, crop knowledge, yields, labor investment, soil/fertility impact. | Cultivation overlay, yield summaries, food surplus panel. | No agriculture without discovery/prerequisites, seasonal yields, ecological impact. | Agriculture produces surplus and constraints from simulated causes. |
| Trade | Trade emerges from scarcity, surplus, trust, distance, specialization, and memory of obligations. | Groups, surplus, differentiated resources, communication, memory. Depends on resources, groups, economy foundation. | Exchange events, obligation/trust records, route knowledge. | Exchange timeline, trade route overlay. | Deterministic exchange selection, resource conservation, relationship effects. | Trade occurs because it benefits agents/groups under constraints. |
| Villages | Villages are durable settlement clusters, not decorative map labels. | Agriculture or reliable food surplus, shelter, group identity, population density. Depends on humans, shelter, agriculture, groups. | Settlement records, population membership, location/building state. | Settlement markers, village inspector, population/resources summary. | No village without population/resource basis, deterministic founding/abandonment. | Villages persist, grow, shrink, or fail for explainable reasons. |
| Religion | Religion may emerge as shared meaning, ritual, memory, fear, death, identity, authority, and explanation. | Language, death, memory, groups, shared stories. Depends on culture, memory, groups, language. | Belief clusters, ritualized behavior, sacred/narrative concepts only when evidence supports them. | Belief history, ritual/event timeline. | No hardcoded religion, trace beliefs to events/memories, group spread/divergence. | Religious behavior or beliefs emerge from social and cognitive conditions. |
| Government | Government emerges from coordination, conflict, legitimacy, resource control, enforcement, and scale. | Groups, villages, conflict, leadership behavior, shared norms. Depends on groups, culture, economy, conflict. | Authority relationships, decision processes, rule/norm records, enforcement events. | Governance inspector, authority timeline. | No automatic chiefs/kings/states, legitimacy/conflict effects, deterministic role emergence. | Governance appears only when social pressure supports it. |
| Writing | Writing preserves knowledge, records obligations, supports administration, and changes memory. | Language, symbols, tools/materials, trade or administration pressure, teaching. Depends on language, tools, culture, economy, government. | Recorded knowledge artifacts, literacy/skill, durable records. | Artifact/record browser, written history display. | No writing without symbolic/material prerequisites, persistence of records, knowledge preservation effects. | Writing changes memory, administration, and knowledge transfer. |
| Laws | Laws are formalized norms backed by authority and memory. | Governance, writing or strong oral tradition, repeated conflict, enforcement. Depends on government, culture, memory. | Rule records, enforcement events, compliance/conflict history. | Law/norm inspector, enforcement timeline. | Trace laws to social pressures, deterministic enforcement outcomes. | Laws affect behavior because agents/groups remember and enforce them. |

## Phase 6: Advanced Civilizations

Phase 6 is long-term and must not begin until earlier systems produce stable societies.

| Item | Why It Exists | Prerequisites / Dependencies | Expected Data Model Changes | Expected UI Changes | Testing Requirements | Completion Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Cities | Cities require density, surplus, infrastructure, specialization, governance, trade, and defense. | Villages, agriculture, trade, governance, resource flows. Depends on settlements, economy, government, infrastructure. | Urban settlement model, infrastructure, population specialization, district/resource flows. | City map layer, city inspector, population/economy charts. | No city without surplus/density, growth/decline, resource constraints. | Cities emerge, persist, and fail through simulated pressures. |
| Nations | Nations represent large-scale identity, territory, governance, bureaucracy, conflict, and diplomacy. | Cities, government, writing, trade, conflict systems, shared identity. Depends on government, culture, economy, diplomacy, conflict. | Polity records, borders/claims, institutions, diplomacy records. | Political map, nation inspector, diplomatic timeline. | Deterministic formation/collapse, border and membership changes, conflict/diplomacy effects. | Nations arise from social, economic, and political state, not scripted eras. |
| Science | Science is organized discovery, evidence preservation, method, communication, and institutions. | Writing, education/teaching, accumulated discoveries, surplus, institutions. Depends on discovery, writing, culture, government/economy. | Formal knowledge domains, experiments/evidence records, scholar/teacher roles if emergent. | Knowledge tree as history, evidence lineage view. | No scripted tech tree, trace science to evidence and institutions. | Scientific knowledge accumulates through evidence-backed processes. |
| Engineering | Engineering applies knowledge to structures, machines, infrastructure, and production. | Tools, empirical knowledge, materials, labor coordination, institutions. Depends on science, resources, economy, settlements. | Infrastructure projects, machine/tool capabilities, maintenance/durability. | Infrastructure overlays, project timelines. | Material constraints, labor/time costs, deterministic effects. | Engineering changes world capacity through inspectable projects. |
| Industry | Industry transforms production, population, environment, economy, war, and global change. | Energy sources, metallurgy, engineering, markets/state coordination, transport. Depends on resources, engineering, economy, cities, science. | Production chains, pollution/environmental effects, labor specialization, energy systems. | Industrial overlays, production/resource flow charts, environmental impact panels. | Resource conservation, pollution effects, supply chain failure modes. | Industry emerges from material, knowledge, and institutional prerequisites. |
| Global trade | Global trade creates interdependence, wealth, conflict, disease spread, and cultural exchange. | Nations/cities, transport, navigation, production surplus, diplomacy/conflict. Depends on economy, exploration, diplomacy, industry. | Global routes, trade agreements, supply flows, market shocks. | Global route map, trade dependency inspector. | Route viability, disruption effects, supply/demand constraints. | Long-distance exchange creates real dependency and historical consequences. |
| Exploration | Exploration expands known geography, resources, trade, science, conflict, and cultural contact. | Navigation, transport, maps/writing, motivation, state/economic support or individual necessity. Depends on science, engineering, economy, nations. | Expedition records, discovered locations, route knowledge, contact events. | Exploration timeline, known-world map, expedition inspector. | Deterministic route outcomes, risk/failure, knowledge spread. | Exploration changes world knowledge and relationships through evidence. |
| Advanced civilizations | The long arc of First Dawn should allow complex, modern-like societies if history supports them. | All prior foundations, stable long-run performance, replay/history tooling. Depends on cities, nations, science, engineering, industry, global trade, diplomacy, conflict. | Advanced institutions, modern infrastructure, media/communication systems if emergent, global events. | Civilization dashboard, comparative world history, global timeline, replay tools. | Long-run stability, institutional persistence, collapse/recovery scenarios, performance profiling. | Complex civilizations can emerge, diverge, collapse, recover, and explain their histories. |

## Cross-Phase Requirements

Every roadmap item must satisfy:

- deterministic behavior
- world-scoped data
- scheduler-owned time
- explicit dependencies
- persistence strategy
- event evidence
- health metrics
- tests
- UI only as observer
- no scripted outcomes

## Near-Term Priority

The next practical focus should be Phase 2:

1. Persist Human MVA state.
2. Connect humans to real cell/environment data.
3. Add durable memories and relationships.
4. Add human atlas overlay and inspector.
5. Implement food, water, shelter, danger, fatigue, and seasonal survival as real loops.
6. Preserve the agent ignorance boundary.

The project should not move into tribes, religion, government, agriculture, writing, or cities until persistent human survival and discovery are stable.
