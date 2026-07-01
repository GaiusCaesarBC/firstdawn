# Family & Generations Engine

The Family & Generations Engine turns temporary human groups into traceable families, lineages, and settlement-rooted generations. It is deterministic, replayable, scheduler-friendly, and built as a projection over human, relationship, knowledge, memory, communication, and settlement state.

## Scheduler Position

The engine runs after the Emergent Camps & Settlements Engine and before Civilization:

1. Humans
2. Goal Decision Engine
3. Episodic Memory Engine
4. Relationship Engine
5. Knowledge & Learning Engine
6. Communication Engine
7. Emergent Camps & Settlements Engine
8. Family & Generations Engine
9. Civilization

This lets family continuity use home, safety, resource, bond, and settlement signals without introducing government, legal systems, economics, religion, or formal marriage.

## Lifecycle

Every human carries family fields for biological parents, guardians, children, siblings, mate, family, lineage, birth tick, age stage, birthplace, inherited home, ancestry tags, and family history. Founding humans begin as a founding lineage. Children born later join the same lineage unless a future extension explicitly creates a new lineage rule.

Age stages are derived from age:

- Infant: under 2 years
- Child: 2 to 11 years
- Adolescent: 12 to 17 years
- Adult: 18 to 59 years
- Elder: 60 years and older

## Birth Model

Births are not random. A pair is scored from deterministic inputs:

- adult biological compatibility
- mate or strong relationship bond
- shared stable home
- settlement permanence and importance
- safety and low fear
- food/water availability
- health and low need pressure
- population pressure penalty
- minimum tick and birth spacing gates

Only scores above the configurable threshold produce a birth. The child id, sex, family id, and lineage id are derived deterministically from world id, tick, parents, and ordinal.

## Parenting

Children list biological parents as guardians. Parent-child relationships start with high trust, affection, and dependency. Infants and children are kept near a living guardian and receive a `Stay Near Family` goal targeting that guardian.

Parents gain child ids, mate links, family history entries, and stronger attachment. Siblings are detected from shared biological parents and receive family relationships.

## Inheritance

Children inherit:

- birthplace cell and settlement
- inherited home cell and settlement
- ancestry tags
- early home memories
- family history
- survival knowledge from parents or guardians

Family knowledge uses `inherited-family-teaching` so later Atlas views can trace survival knowledge across generations.

## Learning

The engine copies a small deterministic set of high-importance survival knowledge from guardians to children. Eligible topics include water, food, shelter, danger, navigation, and knowledge tagged as survival. This is deliberately slow and traceable rather than a full education system.

## Family Relationships

Family relationships are stronger and more persistent than ordinary proximity bonds. Parent, child, sibling, and mate kinship records are maintained in both directions. Family death creates grief memories and increases grief on existing family relationships.

## Settlement Integration

Families anchor settlement permanence by exposing settlement family summaries:

- families present
- largest lineage
- births and deaths
- children and elders
- founding families

Birth events also become chronicler-visible causal events, including first birth and settlement birth milestone events.

## Atlas Integration

Atlas exposes a top-level family tree projection with families, lineages, events, and settlement summaries. Human Atlas records include parents, guardians, children, siblings, mate, lineage, birthplace, inherited home, ancestry tags, and family history. Settlement Atlas records include families present, largest lineage, children, elders, and founding families.

## Performance

The engine is bounded and replayable. It works over current human and settlement state, sorts all output deterministically, and limits family history, memory, and knowledge growth. It does not perform database writes itself; scheduler persistence remains centralized.

## Future Extensions

Safe extension points include:

- richer guardianship changes
- adoption or foster care
- childhood play and peer learning
- migration history by family
- elder mentorship
- multi-settlement lineages
- configurable age pacing by world time scale
- optional hereditary traits without genetic simulation

Out of scope: government, religion, formal marriage, law, inheritance law, economy, caste/class systems, and detailed genetics.
