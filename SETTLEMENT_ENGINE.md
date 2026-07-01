# Emergent Camps & Settlements Engine

The Emergent Camps & Settlements Engine lets homes, camps, and settlements arise from citizen behavior. It does not spawn villages and it does not call a scripted `CreateVillage()` path. A settlement is derived from repeated local decisions: returning to a place, resting there, sharing food, communicating nearby, learning local resources, and forming trusted relationships.

## Scheduler Position

The engine runs after the Communication Engine and before Civilization:

Humans -> Goal Decision Engine -> Episodic Memory Engine -> Relationship Engine -> Knowledge & Learning Engine -> Communication Engine -> Emergent Camps & Settlements Engine -> Civilization

This keeps settlement state downstream from personal needs, goals, memory, relationships, knowledge, and local communication while leaving governments, economy, trade, technology, religion, roads, agriculture, and cities for future systems.

## Settlement Lifecycle

The engine evaluates local cell signals with configurable scoring. Cells gather score from population presence, repeated familiarity, sleeping or rest goals, stored food and water evidence, safety memories, trusted relationships, family clustering, teaching, local knowledge, fire patterns, and simple shelter. Danger and overcrowding reduce the score. The scoring table is data driven in `DEFAULT_CAMP_FORMATION_SCORING`.

A place moves gradually through status and type as permanence rises:

- Temporary camp patterns appear first.
- Repeated safe use increases permanence.
- Seasonal camps emerge from stronger revisit patterns.
- Permanent settlements require high permanence and importance.
- Abandonment appears when population leaves or danger overwhelms local safety.

Settlement type definitions are held in a registry. Future plugins can register village, town, city, fortress, port, religious site, capital, or other types without redesigning the model.

## Camp Formation

A camp forms from accumulated evidence, not a spawned object. Signals include:

- Citizens repeatedly at the same cell.
- Home affinity and familiarity increasing there.
- Rest and return-home goals targeting the area.
- Food and water memories or fulfillment events.
- Safety checks and shelter memories.
- Trusted relationships and family bonds among residents.
- Teaching and local knowledge tied to the cell.
- Shared fire, simple shelter, and supplies inferred from repeated local behavior.

## Growth And Abandonment

Settlements grow because agents identify with and remain near a place. Current population is based on living agents whose current or primary home cell matches the settlement cell. Peak population is derived from current replay state for this architectural foundation and can be backed by persistence later.

Unsafe places are downgraded or abandoned through danger memories and safety failures. Overcrowding is represented as a configurable penalty so future movement and migration systems can make citizens leave crowded camps without magic population changes.

## Membership And Home Selection

Each citizen now maintains a home profile:

- Primary home cell.
- Secondary home cells.
- Preferred sleeping cell.
- Known safe cells.
- Favorite gathering cells.
- Birthplace cell.
- Per-cell affinity scores.

Home affinity changes deterministically from current cell, familiarity, safety, social comfort, and local events. These profiles influence future goal scoring for returning home, gathering near camp, and defending camp.

## Goal Integration

The goal decision engine includes settlement-aware candidates:

- Return Home.
- Gather Near Camp.
- Defend Camp.

These are normal weighted goal plugins. They compete with hunger, thirst, fatigue, safety, social, and curiosity goals through deterministic scoring. No non-deterministic randomness is used.

## Memory, Relationship, Knowledge, And Communication Integration

The settlement engine reads existing outputs rather than duplicating them:

- Memories provide safety, food, water, shelter, and danger signals.
- Relationships decide whether nearby people are trusted, family, rivals, or threats.
- Knowledge contributes local expertise and discovery history.
- Communication supplies local teaching, coordination, and shared-fire/supply patterns.

Future systems can extend these signals by adding new memory tags, knowledge categories, relationship statuses, communication types, or settlement scoring weights.

## Atlas Support

Atlas snapshots expose a Settlement Inspector model with:

- Settlement name.
- Population and age.
- Founders and current residents.
- Structures and stored resources.
- Knowledge summary and discovery history.
- Relationship graph.
- Major events, births, deaths, and growth timeline.
- Nearby resources and seasonal status.

The map client includes a Settlements layer and a cell inspector section for camps associated with the selected cell.

## Chronicler Support

The scheduler system emits deterministic historical events:

- First Camp.
- Camp Founded.
- Camp Expanded.
- Camp Abandoned.
- Family Established.
- Population Milestone.
- First Shared Fire.
- First Stored Food.
- Settlement Merged.
- Settlement Split.

Merged and split events are reserved in the event model for future migration and multi-camp behavior.

## Performance Considerations

The foundation avoids global clustering and flood fills. It groups existing human, memory, knowledge, relationship, and event data by local cells, then scores those cells once. Work is near O(n) relative to currently simulated human state. Future persistence can cache membership, peak population, and historical transitions without changing the settlement model.

## Extension Points

Future work can add:

- Persistent settlement rows.
- Migration between nearby cells.
- Children and birthplace memories.
- Resource stockpile mechanics.
- Construction simulation.
- Trade, economy, government, religion, agriculture, roads, villages, towns, and cities.

Those are intentionally excluded from this milestone.