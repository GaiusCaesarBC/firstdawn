# Knowledge & Learning Engine

The Knowledge & Learning Engine models transferable understanding between citizens. Memory remains personal and episodic; knowledge is portable, teachable, practiced, and fallible.

## Scheduler Order

The human cognition pipeline now runs in this order:

1. Humans
2. Goal Decision Engine
3. Episodic Memory Engine
4. Relationship Engine
5. Knowledge & Learning Engine
6. Civilization

The knowledge system is scheduler friendly and deterministic. It uses the cached human tick result produced by the human simulation layer, emits normal simulation events, and avoids global unlocks.

## Knowledge Model

Each citizen owns knowledge entries with stable ids and extensible fields:

- `id`, `topic`, `category`
- `discoveredTick`, `learnedTick`
- `sourceType`, `sourceHumanId`, `originatingHumanId`
- `confidence`, `mastery`, `reliability`, `importance`
- `practiceCount`, `teachingCount`, `learnerHumanIds`
- `lastUsedTick`, `lastTaughtTick`
- `isForgotten`, `contradicts`, `tags`, `history`

The model is append-friendly: new source types, categories, tags, and future metadata can be added without changing the lifecycle contract.

## Categories

Categories are registered through `registerHumanKnowledgeCategory`. The initial registry includes survival, environmental, social, and technical categories such as food, water, shelter, fire, animals, plants, terrain, weather, navigation, construction, tool use, social, danger, observation, and discovery.

The list is not used as a hardcoded switchboard. Unknown categories fall back to neutral decay and importance defaults, and future systems can register their own definitions.

## Lifecycle

Discovery comes from meaningful human events, not random unlocks. A fulfilled water need can become water knowledge, a food success can become food knowledge, safety failures can become danger knowledge, observation can become landmark knowledge, and exploration can become route knowledge.

Learning can occur through teaching or repeated experience. Teaching creates learner knowledge only when deterministic acceptance scoring passes a threshold. Repeated memories become knowledge once confidence, recall count, and exposure count are high enough.

Practice strengthens knowledge when later events use the same category or tags. Successful use increases confidence, mastery, reliability, practice count, and last-used tick.

Decay weakens stale knowledge. Entries that are not used, taught, or reinforced lose confidence and mastery gradually. Survival and danger knowledge decay more slowly through category resistance, importance, and survival tags. Low-confidence, low-importance knowledge can become forgotten.

Conflicts are represented explicitly through `contradicts`. Competing beliefs can coexist; later experience reinforces the belief that matched the event and shifts confidence through normal reinforcement.

## Teaching And Relationships

Teaching success is deterministic and depends on:

- relationship trust, respect, familiarity, fear, and rivalry
- teacher mastery
- learner attention and curiosity
- knowledge importance
- repeated teaching history

A successful teaching attempt records teacher history, increments teaching count, tracks learner ids, and creates learner knowledge with the original discoverer preserved. Family relationships use `inherited-family-teaching` as the source type.

Relationship updates are handled by the relationship/human interaction layer: teaching interactions can increase respect and trust, while low trust or fear can prevent learning.

## Goal Integration

The Goal Decision Engine reads active knowledge alongside memories. Strong water, food, shelter, danger, and navigation knowledge influence deterministic goal scoring. Knowledge affects the score through confidence times mastery, so a barely learned fact does not behave like mastered expertise.

## Memory Integration

The Episodic Memory Engine remains personal. The Knowledge & Learning Engine can transform repeated, reliable memories into transferable knowledge when exposure and recall are high enough. This keeps the distinction clear:

- Memory: I remember finding water here.
- Knowledge: I know this place has safe drinking water.

## Atlas Integration

The Citizen Inspector exposes:

- known knowledge
- knowledge categories
- confidence and mastery
- recently learned and recently taught entries
- teacher and student ids
- practice and teaching counts
- knowledge timeline

Settlement-level aggregation is intentionally left for a future settlement/civilization layer.

## Chronicler Integration

Knowledge events are emitted as deterministic simulation events and fed into the human causal event/chronicler path. Event kinds include new discovery, knowledge learned, knowledge forgotten, knowledge taught, major invention, first teacher, first student, and spread milestones.

## Performance

The engine is designed for O(n) or near O(n) behavior relative to active human state:

- no global population pairwise comparisons
- no global knowledge unlocks
- local teaching records only
- stable maps for agent and knowledge lookups
- bounded knowledge history length
- bounded teaching processing per tick
- scheduler fidelity modes can suppress emitted event volume

Future large-world implementations should keep teaching and observation local, use spatial indexes, and aggregate settlement knowledge outside individual citizen updates.

## Extension Points

Future systems can build on this foundation by adding source types and categories for language, symbols, books, writing, formal education, tools, agriculture, religion, law, economy, and technology trees. Those systems should produce meaningful events or teaching records rather than directly unlocking knowledge globally.

This foundation intentionally does not implement language, writing, religion, government, economy, agriculture, crafting, technology trees, or formal education.