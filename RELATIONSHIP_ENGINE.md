# First Dawn Relationship Engine

The Relationship Engine gives each living citizen persistent, deterministic social bonds with other known citizens. It sits after Human Needs, the Goal Decision Engine, and the Episodic Memory Engine so it can consume lived events and social memories before future Civilization systems read the result.

## Scheduler Order

The intended human pipeline is:

1. Humans
2. Goal Decision Engine
3. Episodic Memory Engine
4. Relationship Engine
5. Civilization

The engine is scheduler-friendly: it reuses the cached human MVA replay for the current tick and emits deterministic relationship lifecycle events as scheduler events without creating a second behavioral pass.

## Relationship Model

A relationship is directional. `humanId -> targetHumanId` stores how one human currently understands another human.

Core fields:

- `createdTick`
- `lastInteractionTick`
- `familiarity`
- `trust`
- `affection`
- `fear`
- `respect`
- `rivalry`
- `dependency`
- `grief`
- `kinship`
- `socialMemoryScore`
- `status`
- `tags`
- `history`

Initial statuses are:

- `Unknown`
- `Familiar`
- `Friend`
- `Family`
- `Rival`
- `Threat`
- `Mentor`
- `Dependent`
- `Mate`

Status is inferred deterministically from relationship scores and kinship. Kinship is preserved first, so a family bond remains family even when ordinary familiarity or trust drifts.

## Lifecycle

Relationships form when a living human has a local or meaningful reason to know another human. The current foundation evaluates:

- same-cell proximity and repeated encounters
- causal event participants
- social memories with `relatedHumanId`
- already-known relationships that need deterministic drift

Lifecycle events include:

- relationship formed
- trust increased
- fear increased
- rivalry increased
- friendship formed
- family bond recognized
- relationship decayed
- relationship status changed

Relationship changes are also projected into human causal history so the Chronicler and Atlas can show social history.

## Scoring Model

Each update applies bounded score deltas. Examples:

- proximity increases familiarity and small affection
- communication increases familiarity, trust, affection, and social memory
- teaching increases respect and trust
- food sharing increases trust, affection, dependency, and social memory
- conflict increases fear and rivalry while reducing trust and affection
- shared danger increases fear, dependency, and social salience
- positive social memories reinforce trust and affection
- negative social memories reinforce fear and rivalry

All scores are clamped to `[0, 1]` and rounded, which keeps replay stable across runs.

## Social Memory Integration

The engine runs after episodic memory updates. Newly formed or reinforced memories with social tags can immediately influence relationship scores when they include `relatedHumanId`.

Relationship lifecycle events are written into causal history. Those events can become future social memories, letting relationships and episodic memory reinforce each other over time without requiring non-deterministic randomness or global scans.

## Goal Integration

Relationships influence goal scoring through configurable modifiers in the Goal Decision Engine. They do not add scripted actions.

Current modifiers support:

- staying near family
- avoiding threats
- socializing with trusted humans
- helping or staying close to dependents through dependency scoring
- following or prioritizing respected humans through respect scoring
- seeking familiar groups when afraid
- avoiding rivals

Threat and rivalry pressure can increase `Seek Safety` or `Escape` priority and reduce low-pressure exploration or wandering. Trust, affection, family bond, dependency, and respect can increase social and family-oriented goal priority.

## Decay And Reinforcement

Known relationships drift when not touched by local proximity, recent events, or social memories. Decay is deterministic and light: familiarity, affection, trust, rivalry, fear, and social memory scores move gradually rather than disappearing abruptly.

Family status is preserved through kinship. Other statuses can change when scores cross deterministic thresholds.

## Performance

The Relationship Engine avoids full population pair scans.

It evaluates:

- living humans grouped by current cell
- a bounded number of same-cell targets per human
- participants in current meaningful events
- current social memories with `relatedHumanId`
- already-known relationships for light decay

The local target limit is currently 8 per human. This keeps behavior near `O(n)` for ordinary ticks, while still allowing future spatial partitioning and event indexing for populations in the hundreds of thousands or millions.

## Atlas Integration

Atlas human snapshots expose:

- closest relationships
- trusted humans
- feared humans
- rivals
- family
- relationship count
- strongest bond
- recent relationship changes
- social history

These fields are computed from the deterministic MVA state at the selected Atlas day.

## Future Extension Points

This foundation deliberately does not implement governments, religion, formal economy, language, full culture, war, or marriage.

Prepared extension points include:

- parent-child and sibling kinship recognition
- mate relationships without a marriage system
- teaching and mentor selection
- dependent care
- leader following through respect
- settlement clustering through family, familiarity, safety, and dependency
- tribe and culture formation as later systems that read relationship state
- richer social event taxonomies for injury, helping, shelter sharing, travel, birth, death, and group goal outcomes
