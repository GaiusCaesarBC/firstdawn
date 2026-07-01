# Episodic Memory Engine

The Episodic Memory Engine gives each living citizen a deterministic, personal history. It runs after the Goal Decision Engine and before Civilization so later society systems can depend on remembered experience without introducing scripted behavior.

## Memory Lifecycle

A memory begins as a meaningful human causal event, is encoded into a typed structured record, may be recalled by goal scoring, may be reinforced by repeated matching experience, and then fades gradually through deterministic decay. Memories are not deleted immediately when they weaken; low-confidence records remain available for future retention policy work.

Each memory stores identity, type, category, subject, location, creation tick, last recall tick, importance, confidence, emotional weight, source, related entity or human ids, tags, notes, recall count, exposure count, and compatibility fields for current human event displays.

## Creation

The encoder only creates memories above a configurable significance threshold. Food, water, safety, communication, teaching, observation, exploration, and goal outcomes are currently mapped into the registry. Ordinary low-significance actions do not create memories.

Memory types are registry based. The initial registry covers Food Source, Water Source, Shelter, Danger, Predator, Storm, Fire, Flood, Death, Birth, Discovery, Friendship, Conflict, Conversation, Travel, Observation, Unknown Object, Lost Resource, and Safe Area, plus goal outcome types used by the current MVA layer.

## Reinforcement

Repeated experience at the same location with the same subject reinforces the existing memory instead of creating duplicates. Reinforcement raises confidence and importance deterministically, increments exposure and recall counts, merges tags and causal links, and keeps the stronger summary when the new event is more important.

## Decay

Decay is deterministic and type-aware. Each memory type has a retention window. Confidence, importance, and emotional weight fade slowly, with high-importance survival memories protected longer than ordinary observations. Major fades can emit Chronicler-visible memory events.

## Recall

Goal scoring receives a prebuilt per-agent memory index. Recall asks for a bounded set of relevant memories using current cell, active goal, tags, related people, confidence, importance, emotional weight, and recency. This avoids unbounded per-goal global scans and keeps behavior O(population + memories touched) for the current in-memory simulation.

## Goal Integration

Goal plugins consume generic memory influence scores. Remembered food and water increase resource-seeking confidence and can supply target cells. Remembered shelter improves shelter confidence. Remembered danger raises Escape or Seek Safety scoring and suppresses Explore or Wander. Relationship memories can lift social trust scoring.

## Scheduler Order

The system order is:

1. Humans
2. Goal Decision Engine
3. Episodic Memory Engine
4. Civilization

The current human MVA snapshot is replayed deterministically and cached for these systems during a scheduler tick.

## Atlas And Chronicler

Atlas exposes each citizen's recent memories, strongest memories, most recalled memories, danger memories, food memories, relationship memories, timeline, memory count, average confidence, and average importance.

The memory system emits deterministic events when important memories form, major memories fade, or critical memories reinforce. These events use the normal simulation event pipeline and are Chronicler-visible through metadata.

## Extension Points

Future systems should register memory types instead of changing the schema. New encoders can map domain events into typed memories with tags and subjects. Goal systems should consume memory influence by category or tag rather than hardcoding specific behavior.

## Performance Notes

Memory updates use stable maps by agent and merge key, bounded recall, and small sorted slices for Atlas summaries. The architecture is designed to move from the current replayed MVA state to persisted batched memory storage without changing the memory object contract.
