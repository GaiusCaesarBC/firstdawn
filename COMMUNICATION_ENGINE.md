# Communication Engine

The Communication Engine is the primitive information-exchange layer for First Dawn. It is not language, grammar, writing, trade, religion, government, or formal education. It models non-verbal and early vocal communication that lets citizens affect one another before symbolic language exists.

## Scheduler Order

The default cognition and society order is:

1. Humans
2. Goal Decision Engine
3. Episodic Memory Engine
4. Relationship Engine
5. Knowledge & Learning Engine
6. Communication Engine
7. Civilization

The human tick uses the same deterministic cached state across these reporting systems, so Communication Engine metadata, Atlas output, and Chronicler events all describe the same simulated tick.

## Lifecycle

1. A citizen action creates a communication record.
2. The record is evaluated once through deterministic scoring.
3. Each receiver receives an independent reception outcome.
4. Accepted or stored messages can influence goals, emotions, beliefs, and relationships.
5. Teaching communications create teaching attempts that the Knowledge Engine can process.
6. Communication milestones become causal events and episodic memories.
7. Atlas and Chronicler expose the result without mutating simulation state.

## Communication Object

Communication records include:

- `id`
- `senderHumanId`
- `receiverHumanIds`
- `type`
- `topic`
- `createdTick`
- `locationCellId`
- `urgency`
- `clarity`
- `confidence`
- `emotionalWeight`
- `communicationMethod`
- `understood`
- `accepted`
- `tags`
- `history`
- per-receiver `receptions`

Legacy fields such as `speakerAgentId`, `listenerAgentIds`, and `utteranceMeaning` are retained for existing UI and tests, but new systems should prefer the richer sender/receiver fields.

## Type And Method Registries

Communication types and methods are data-driven registries. The initial registry includes warnings, teaching, requests, help, greetings, observations, discoveries, emotions, danger, food found, water found, follow me, stay away, comfort, celebration, and mourning.

Methods include visual signals, gestures, facial expression, body language, pointing, vocal sound, calls, and cries. Future systems can register words, grammar, writing, symbols, maps, books, and technology without changing the base engine.

## Understanding And Trust Model

Receiving a message does not guarantee understanding. Each reception computes deterministic scores from:

- relationship trust, familiarity, fear, and rivalry
- same-cell proximity
- attention
- stress
- current goal alignment
- message clarity, confidence, urgency, and emotional weight
- communication method modifiers
- a deterministic world RNG jitter scoped to the message, receiver, and tick

Outcomes are:

- accepted
- rejected
- ignored
- misunderstood
- stored for later

## Knowledge Integration

Accepted teaching communications generate teaching attempts. The Knowledge & Learning Engine consumes those attempts and transfers or reinforces knowledge only when teaching acceptance, attention, relationship quality, and teacher mastery pass deterministic thresholds.

Failed, ignored, or rejected communication does not transfer knowledge.

## Relationship Integration

Communication updates relationship history and scores. Accepted communication generally increases familiarity and trust. Teaching can increase respect. Comfort can increase affection. Ignored or rejected messages can reduce trust, especially warnings that the receiver does not accept.

## Goal Integration

Accepted communication can create configurable goal pressure:

- warnings, danger, and stay-away messages push `Seek Safety`
- help messages push `Help Other`
- follow messages push `Follow`
- teaching messages push `Learn`
- food and water discoveries push `Find Food` or `Find Water`

These are still ordinary goals and remain subject to the Goal Decision Engine's scoring and continuity model.

## Memory Integration

Communication milestones become causal events. The Episodic Memory Engine encodes important communication as social/conversation memories, and emotionally weighted danger or teaching messages can become salient memories for later recall.

## Atlas And Chronicler

The Citizen Inspector exposes recent communications, sent and received message counts, common communication types, trusted teachers, frequent contacts, success rate, ignored messages, teaching history, warning history, and a communication timeline.

The Chronicler receives deterministic historical events for communication milestones such as first warning, first teaching event, first help request, group coordination, and knowledge transmission.

## Performance

The engine avoids global broadcasts and population-wide scans. It evaluates only explicit receivers selected by local systems, sorts outputs deterministically, reuses existing relationship records, and keeps per-message reception data compact. The architecture is designed to scale through local propagation and future nearby-citizen indexes.

## Future Extension Points

Future systems can register new communication types, methods, target modes, scoring modifiers, goal influences, emotional contexts, and Atlas aggregations. Language, grammar, writing, books, formal education, leadership, culture, and civilization can be layered on top without replacing the primitive communication foundation.

