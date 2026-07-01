# Goal Decision Engine

The Goal Decision Engine is the intent layer for human behavior. It chooses what a citizen is trying to accomplish; it does not execute the action. Existing behavior/action systems remain responsible for doing work such as eating, drinking, resting, moving, communicating, or observing.

## Decision Pipeline

Each living human follows the same deterministic pipeline inside the human tick:

1. Needs update.
2. Curiosity, motivation, and emotion state update.
3. Goal Decision Engine evaluates the current goal lifecycle.
4. Goal plugins generate possible goals.
5. Goal candidates are scored with centralized weights.
6. The best goal is selected only when persistence rules allow it.
7. The selected goal biases existing action candidates.
8. The behavior system executes the chosen action.

The scheduler also exposes a distinct `Goal Decision Engine` system after `Humans`. The human system caches the tick result, and the goal system emits goal lifecycle events under its own system identity without replaying extra work.

## Goal Object

Human goals are structured records:

- `id`
- `type`
- `priority`
- `createdTick`
- `targetId`
- `targetCellId`
- `progress`
- `confidence`
- `reason`
- `status`

Supported statuses are `Pending`, `Active`, `Completed`, `Failed`, and `Interrupted`. Each agent also keeps a bounded recent `goalHistory` for Atlas, debugging, and future story systems.

## Lifecycle

Goals persist between ticks. A current goal is retained when it remains valid and no candidate exceeds the configured persistence margin.

A goal changes only when:

- it completes by crossing its completion threshold,
- its target becomes invalid,
- a higher-priority candidate exceeds the persistence margin,
- an interrupt candidate such as `Seek Safety` or `Escape` exceeds the interruption margin.

Goal lifecycle events are deterministic human causal events: start, complete, fail, interrupt, and change. The scheduler persists them through the normal event pipeline, so the Chronicler can read them without mutating state.

## Scoring And Plugins

Goal scoring lives in `src/lib/simulation/human-goals.ts` under `DEFAULT_GOAL_SCORING_WEIGHTS`. Individual plugins generate candidates for goal types such as `Find Food`, `Find Water`, `Rest`, `Seek Shelter`, `Wander`, `Explore`, `Socialize`, `Observe`, and `Stay Near Family`.

New goals should be added as plugins with local candidate logic and should use the shared weights object for tunable values. Avoid embedding one-off constants inside behavior systems. Goal plugins should read local state, known resources, memories, relationships, and cached environmental summaries rather than scanning the world.

## Scheduler Order

The current order is:

1. Human state and needs update in `Humans`.
2. Goal selection happens inside the human tick before action scoring.
3. `Goal Decision Engine` emits goal lifecycle events from the cached tick result.
4. Future civilization systems run after goal decisions.

This preserves the intended model: needs create pressure, goals express intent, behavior executes actions, and later social systems can consume the resulting decisions.

## Atlas Integration

The Developer Atlas exposes each selected citizen's current goal, priority, reason, age, progress, and recent goal history. These fields are meant for inspection first and story generation later.

## Performance Notes

The engine is O(n) over humans for the current MVA. It avoids full-world scans and pathfinding. Candidate targets come from local agent state, relationships, beliefs, and optional local environment inputs. Future target discovery should be cached per tick or per region and passed into plugins rather than recomputed for every citizen.

The goal history is bounded to avoid unbounded per-agent growth during long deterministic replays.
