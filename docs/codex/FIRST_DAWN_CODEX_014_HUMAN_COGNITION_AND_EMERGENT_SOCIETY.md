# First Dawn Codex 014: Human Cognition and Emergent Society

## Purpose

This document defines the Minimum Viable Agent foundation for the first two humans in First Dawn.

The goal is not to implement civilization.

The goal is to create two adult human agents, age approximately 20, who can survive, perceive, need, feel, remember, believe, communicate, affect each other, and leave a causal trace in world history.

The first human system must support:

- natural instincts
- spoken language capacity
- emotions from birth
- utility-based decision making
- needs
- lightweight personality traits
- episodic memory
- beliefs
- relationships
- Theory of Mind
- communication
- teaching
- adult-only reproduction constraints
- genealogy foundation
- causal event logging
- an external Chronicler that observes but never intervenes
- complete ignorance by agents that they are simulated

This foundation creates the substrate from which social behavior can emerge later. It must not hardcode culture, government, religion, writing, cities, trade, or civilization.

## Research Basis

The Minimum Viable Agent model should be inspired by stable, broad findings across cognitive science, anthropology, developmental psychology, affective neuroscience, and agent-based modeling. It does not need to simulate the full human mind.

### Embodied Needs

Human decisions begin from embodied pressures. Hunger, thirst, fatigue, pain, temperature stress, injury, safety, and social proximity create recurring utility gradients. These needs do not dictate a single action, but they shape attention, emotion, and action selection.

### Emotions From Birth

Emotions are not learned cultural systems in this foundation. Fear, distress, comfort, curiosity, attachment, frustration, relief, pleasure, and social anxiety are present as innate affective capacities. Culture may later teach display rules and meanings, but the raw affect system exists first.

### Utility-Based Decisions

Agents should choose actions by estimating expected utility under limited information, bounded attention, current needs, current emotion, memory, beliefs, personality, and perceived social context. The model should support irrational or suboptimal behavior when information, fear, fatigue, attachment, habit, or false belief changes perceived value.

### Episodic Memory

Agents need event-like memories: what happened, where, when, who was involved, what the agent felt, what changed, and how important it seemed. Memory should be partial and biased by attention, salience, emotion, recency, repetition, and personal relevance.

### Beliefs

Agents need internal beliefs about the world and about each other. A belief is not guaranteed to be true. Beliefs may be updated by direct perception, communication, teaching, memory reinforcement, and prediction errors.

### Theory of Mind

Agents should maintain simple models of what another agent may want, know, feel, intend, remember, or believe. This is required for cooperation, teaching, deception readiness, conflict avoidance, care, and shared attention. The foundation only needs lightweight approximations.

### Communication and Teaching

Spoken language capacity exists from the beginning as a biological capacity. The first two adults may use a shared initial proto-language seed so they can exchange intentions, warnings, requests, observations, names, and simple explanations. Teaching should be modeled as one agent intentionally trying to change another agent's belief, skill, attention, or behavior.

### Emergent Society

Society begins as repeated interaction, relationship change, shared memory, coordination, teaching, dependency, conflict, attachment, and reproduction. No social institution should be implemented directly at this phase.

## Architecture

The human cognition foundation should be implemented as a simulation system after ecology and before any future social-group or civilization systems.

Recommended system identity:

```text
system id: humans
display name: Human Cognition Foundation
version: 1
depends on: time, terrain, hydrology, weather, biomes, plants, animals
emits events: yes
persists state: yes
observer visible: yes
agent visible: no
```

The system owns individual human agent state. It may read environmental and ecological state. It must not mutate terrain, climate, plants, animals, or future civilization state directly.

### Layer Boundaries

The human system may own:

- human identity and biological state
- age, adult status, sex, fertility readiness, and reproduction constraints
- needs and health
- emotions
- personality traits
- skills and capacities
- memories
- beliefs
- relationship edges
- simple Theory of Mind models
- communication attempts and interpreted messages
- teaching attempts and learning outcomes
- genealogy links
- human-caused causal events

The human system may read:

- current world tick and time
- local cell properties
- weather and temperature
- available water
- plant food support
- animal food support and danger
- terrain movement cost and shelter possibility
- previous human events, memories, relationships, and beliefs scoped to the same world

The human system must not create:

- tribes
- governments
- religions
- writing systems
- cities
- markets
- trade networks
- cultures as direct records
- laws
- formal roles
- institutions

Those may emerge later from accumulated behavior, but they are outside the MVA.

### Agent Ignorance Rule

Human agents never know they are simulated.

No prompt, memory, belief, action, event, debug field, communication payload, or Chronicler output may become available to an agent as evidence of simulation, ticks, code, database rows, UI state, users, observers, or the Chronicler.

The agent's subjective world contains only the simulated world.

### Chronicler Boundary

The Chronicler is an external read-only observer.

It may:

- read simulation state
- read events
- summarize causal chains
- explain why an event happened
- provide UI-facing historical narration
- identify emergent patterns for human observers

It may not:

- mutate simulation state
- add memories to agents
- send messages to agents
- alter beliefs
- alter relationships
- alter decisions
- become known by agents
- provide divine, supernatural, authorial, or meta-simulation content inside the world

The Chronicler is part of the observatory layer, not the agent layer.

## Data Model Proposal

This is a proposed persistence shape, not an implementation requirement for this document.

All records must include `worldId`.

### HumanAgent

Represents one individual human.

Recommended fields:

- `id`
- `worldId`
- `birthTick`
- `ageDays`
- `approxAgeYears`
- `sex`
- `isAlive`
- `deathTick`
- `currentCellId`
- `homeCellId`
- `motherId`
- `fatherId`
- `generation`
- `adultStatus`
- `fertilityStatus`
- `pregnancyState`
- `health`
- `needs`
- `emotions`
- `personality`
- `skills`
- `languageProfile`
- `beliefSummary`
- `lastDecision`
- `metadata`
- `createdAt`
- `updatedAt`

### HumanNeedState

May be embedded JSON at first, then normalized later if needed.

Recommended need channels:

- `hunger`
- `thirst`
- `fatigue`
- `sleepPressure`
- `pain`
- `injuryRisk`
- `temperatureStress`
- `safety`
- `socialContact`
- `reproductiveDrive`
- `curiosity`

Each channel should support:

- current value
- rate of change
- urgency
- last satisfied tick
- known or believed satisfaction options

### HumanEmotionState

May be embedded JSON at first.

Recommended affect channels:

- `fear`
- `distress`
- `anger`
- `sadness`
- `comfort`
- `joy`
- `curiosity`
- `trust`
- `attachment`
- `loneliness`
- `frustration`
- `relief`

Emotions should be influenced by needs, perception, memory recall, relationship state, and prediction errors.

### HumanPersonality

A lightweight, stable trait vector.

Recommended traits:

- `boldness`
- `sociability`
- `curiosity`
- `patience`
- `aggression`
- `empathy`
- `neuroticism`
- `teachAffinity`
- `explorationDrive`
- `riskTolerance`

Traits should bias decisions without fully determining them.

### HumanMemory

Represents episodic memory.

Recommended fields:

- `id`
- `worldId`
- `agentId`
- `tick`
- `cellId`
- `participants`
- `eventType`
- `summary`
- `sensoryTags`
- `emotionAtEncoding`
- `needContext`
- `salience`
- `confidence`
- `valence`
- `decay`
- `sourceEventId`
- `causalLinks`
- `metadata`

Memory is agent-owned. Two agents may remember the same event differently.

### HumanBelief

Represents an agent's internal model of the world.

Recommended fields:

- `id`
- `worldId`
- `agentId`
- `subjectType`
- `subjectId`
- `claim`
- `confidence`
- `valence`
- `evidenceMemoryIds`
- `source`
- `lastUpdatedTick`
- `metadata`

Beliefs may be inaccurate.

### HumanRelationship

Represents a directed relationship from one agent to another.

Recommended fields:

- `id`
- `worldId`
- `fromAgentId`
- `toAgentId`
- `kinship`
- `familiarity`
- `trust`
- `affection`
- `fear`
- `resentment`
- `dependency`
- `attraction`
- `cooperationHistory`
- `conflictHistory`
- `lastInteractionTick`
- `metadata`

Relationships are directional. Agent A's relationship to Agent B may differ from Agent B's relationship to Agent A.

### HumanTheoryOfMind

Represents one agent's model of another agent's likely state.

Recommended fields:

- `id`
- `worldId`
- `observerAgentId`
- `targetAgentId`
- `believedNeeds`
- `believedEmotions`
- `believedIntent`
- `believedKnowledge`
- `confidence`
- `lastUpdatedTick`
- `evidenceMemoryIds`
- `metadata`

This is not omniscience. It is a subjective estimate.

### HumanCommunication

Represents an attempted spoken communication.

Recommended fields:

- `id`
- `worldId`
- `tick`
- `speakerAgentId`
- `listenerAgentIds`
- `cellId`
- `intent`
- `topic`
- `utteranceMeaning`
- `emotionalTone`
- `languageComplexity`
- `understandingScore`
- `beliefEffects`
- `relationshipEffects`
- `sourceEventId`
- `metadata`

The system does not need to store literal dialogue at first. It should store meaning, intent, and outcome.

### HumanTeachingAttempt

Represents intentional instruction.

Recommended fields:

- `id`
- `worldId`
- `tick`
- `teacherAgentId`
- `learnerAgentId`
- `topic`
- `targetSkill`
- `targetBelief`
- `method`
- `learnerAttention`
- `successScore`
- `memoryIds`
- `eventId`
- `metadata`

Teaching is a communication subtype with a learning target.

### HumanGenealogyLink

Represents biological ancestry.

Recommended fields:

- `id`
- `worldId`
- `childAgentId`
- `parentAgentId`
- `parentRole`
- `birthTick`
- `generation`
- `metadata`

The first two humans have no known in-world parents unless a future origin model explicitly defines them.

### HumanCausalEvent

Represents a world event caused by or involving human agents.

Recommended fields:

- `id`
- `worldId`
- `tick`
- `systemId`
- `type`
- `severity`
- `agentIds`
- `cellId`
- `title`
- `summary`
- `causes`
- `effects`
- `memoryIds`
- `relationshipEffects`
- `beliefEffects`
- `chroniclerVisible`
- `agentVisible`
- `metadata`

This can map onto the existing simulation event bus if event shape remains compatible.

## Tick Lifecycle

Each human tick should follow a stable order.

### 1. Load State

Load living human agents, local environment, relevant nearby resources, recent events, relationships, active memories, beliefs, and pending biological states.

### 2. Perceive

Each agent samples local world state through limited perception.

Perception may include:

- own needs and body state
- temperature and weather
- visible water, food, shelter, danger, and terrain
- nearby human agent state cues
- recent sounds or communication
- remembered locations or expectations

Perception is not omniscient. Agents can miss things.

### 3. Update Needs

Needs change from time, exertion, weather, injury, sleep, food, water, social contact, reproduction drive, and environmental stress.

Needs should be clamped and deterministic.

### 4. Update Emotions

Emotions update from needs, perceived threats, comfort, surprise, memories, relationship interactions, social proximity, success, failure, and uncertainty.

### 5. Recall Memory

Retrieve a small set of relevant memories for each agent.

Recall should be biased by:

- current location
- current need
- current emotion
- current social partner
- recent repeated events
- high salience

### 6. Update Beliefs and Theory of Mind

Agents update beliefs about food, water, danger, safety, another agent's needs, another agent's emotional state, and likely consequences.

Theory of Mind estimates should be subjective and confidence-scored.

### 7. Generate Candidate Actions

Generate available MVA actions from current state.

Actions should include utility inputs, constraints, expected effects, and possible event outputs.

### 8. Score Utility

Score candidate actions using:

- need urgency
- expected survival benefit
- expected social effect
- expected future options
- emotional pressure
- personality bias
- memory and belief evidence
- perceived risk
- effort and opportunity cost
- relationship context

The highest utility action may still fail if the world does not support it.

### 9. Resolve Action

Apply selected action outcomes deterministically. Update location, needs, health, memories, beliefs, relationships, reproduction state, or communication outcomes as appropriate.

### 10. Emit Causal Events

Emit events for meaningful state changes, not every micro-adjustment.

Examples:

- first spoken exchange of the day
- successful food gathering
- failed water search
- injury
- comfort interaction
- conflict
- teaching success
- relationship threshold crossing
- pregnancy begins
- birth
- death

### 11. Persist State

Persist updated agents, relationships, memories, beliefs, Theory of Mind estimates, communication records, genealogy links, and causal events in batched writes where possible.

### 12. Chronicler Read Pass

After persistence, the Chronicler may read the tick's human events and produce observer-facing summaries. This pass must not affect simulation state.

## MVA Action Set

The first action set should be small, survival-focused, and socially expressive enough to create emergence.

### Survival Actions

- `rest`
- `sleep`
- `seekWater`
- `drink`
- `seekFood`
- `gatherFood`
- `eat`
- `seekShelter`
- `moveToNearbyCell`
- `avoidThreat`
- `inspectEnvironment`

### Social Actions

- `approachHuman`
- `avoidHuman`
- `observeHuman`
- `comfortHuman`
- `requestHelp`
- `offerHelp`
- `shareFood`
- `shareWater`
- `communicate`
- `teach`

### Cognitive Actions

- `remember`
- `reevaluateBelief`
- `planNextNeed`
- `attendToSignal`

These may be internal actions or substeps rather than visible top-level actions.

### Reproduction Actions

- `court`
- `mate`
- `careForPregnancy`
- `careForInfant`

For the first MVA, reproduction may be constrained but not necessarily fully simulated through infant development.

Reproduction constraints:

- only living adults over 18 may reproduce
- pregnancy cannot begin without compatible biological constraints
- reproduction cannot be chosen if either participant lacks adult status
- coercive reproduction must not be implemented as an MVA mechanic
- genealogy must be recorded if birth occurs
- offspring must receive `motherId`, `fatherId` where known, `generation`, `birthTick`, and `worldId`

## Emergence Rules

Emergence must come from repeated low-level state transitions.

### Relationship Emergence

Trust, affection, fear, dependency, resentment, attraction, and familiarity change from interaction outcomes.

Examples:

- sharing food may increase trust and affection
- failing to help may reduce trust
- repeated comfort may increase attachment
- repeated avoidance may reduce familiarity growth
- perceived danger may increase dependency
- conflict may increase fear or resentment

No "marriage", "family role", "tribe", or "leader" record should be created in the MVA.

### Communication Emergence

Communication should alter beliefs, emotions, relationships, attention, and future action selection.

Examples:

- one agent indicates water location
- one agent warns of danger
- one agent requests food
- one agent teaches a resource-finding behavior

No writing, literature, formal language tree, myth, law, or cultural archive should be created.

### Teaching Emergence

Teaching emerges when one agent attempts to improve another agent's belief or skill.

The MVA should support:

- demonstration
- pointing or shared attention
- simple verbal instruction
- repeated correction
- learning success or failure

It should not implement schools, traditions, apprenticeships, institutions, professions, or cultural transmission systems yet.

### Social Continuity

If both humans survive, the system should produce a causal chain of shared experience:

- they notice each other
- they respond emotionally
- they remember interactions
- they form beliefs about each other
- they alter behavior based on relationship state
- they may communicate and teach

This is the root of emergent society.

### Event Causality

Every significant human event should be explainable by prior state.

A causal event should be able to answer:

- which needs mattered?
- which beliefs mattered?
- which memories mattered?
- which relationship values mattered?
- what environmental facts mattered?
- what changed afterward?

The Chronicler should depend on this causality, not invent it.

## What Must NOT Be Hardcoded

The MVA must not hardcode civilization systems.

Do not hardcode:

- tribes
- clans
- chiefs
- leaders
- laws
- government
- religion
- gods
- rituals
- myths
- culture records
- ethnicity
- language families
- writing
- symbols
- calendars
- cities
- villages
- permanent settlements
- property
- markets
- trade
- money
- jobs
- social classes
- warfare
- diplomacy
- technology trees
- agriculture systems
- domestication systems

Do not hardcode story outcomes.

Avoid:

- forced pair bonding
- guaranteed cooperation
- guaranteed romance
- guaranteed reproduction
- guaranteed survival
- scripted first words
- scripted discoveries
- authorial narration that becomes agent knowledge
- supernatural intervention
- observer intervention
- UI-driven agent decisions

The first two humans may become cooperative, distant, fearful, attached, reproductive partners, or something else depending on simulation state.

## Success Criteria

The MVA foundation is successful when:

- a world can initialize exactly two living adult human agents around age 20
- each agent has needs, emotions, personality, memory capacity, beliefs, and relationship capacity
- agents can perceive local environment through limited perception
- agents can select actions using utility scoring
- agents can satisfy or fail to satisfy hunger, thirst, fatigue, safety, and social contact
- agents can remember meaningful events
- agents can form and update beliefs
- each agent can maintain a directional relationship with the other
- each agent can maintain a lightweight Theory of Mind estimate about the other
- agents can communicate simple meanings
- agents can attempt teaching
- relationship values can change from interaction outcomes
- reproduction is impossible unless both participants are living adults over 18 and biological constraints allow it
- genealogy fields exist for future descendants
- important human events are logged with causal inputs and effects
- the Chronicler can read and summarize events without changing state
- no agent state references simulation, ticks as code, UI, observers, users, or the Chronicler
- no government, religion, writing, city, trade, culture, or civilization system is implemented directly
- repeated ticks produce deterministic results from the same seed and initial state

## Future Extensions

Future work may build on this foundation only after the MVA is stable.

Potential extensions:

- childhood and development stages
- pregnancy and infant survival in detail
- richer health, injury, disease, and healing
- expanded language complexity
- tool use
- fire use
- long-term pair bonds
- kin networks
- group formation
- migration routes
- camp persistence
- resource knowledge maps
- skill learning and forgetting
- social norms as emergent regularities
- symbolic behavior
- ritual behavior
- oral tradition
- culture as accumulated transmissible patterns
- settlement formation
- agriculture
- domestication
- trade
- government
- religion
- writing
- cities
- formal historical narrative synthesis

These extensions must consume the agent foundation. They must not replace it with scripted civilization state.

## First Implementation Milestone

Two humans survive one simulated day with needs, memory, relationship change, communication, and causal event logging.
