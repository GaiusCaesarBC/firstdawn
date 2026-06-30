# Discovery Engine (Developer Atlas)

The Discovery Engine turns repeated human-environment experiences into emergent knowledge without scripting specific technologies. It reads episodic memories and simulation events, recognizes stable patterns, maintains hypotheses with graded confidence, and confirms discoveries as evidence accumulates.

## Model Overview
- Observation: a single experience mapped to a general phenomenon (e.g., need:thirst:reduced, safety:improved) with participants and location.
- Hypothesis: aggregated observations for a phenomenon with counts, confidence, people/locations, related events/memories.
- Discovery: the same phenomenon after lifecycle progression toward reliability and sharing.

## Lifecycle
Unknown → Observed → Repeated → Understood → Reliable → Teachable → Shared Knowledge

Knowledge only increases gradually through experience, teaching, confirmation by others, and multi-location support. Failures and contradictions reduce confidence.

## Atlas Snapshot Fields
- Current observations
- Current hypotheses (phenomenon, confidence, counts)
- Confirmed discoveries (knowledge level)
- Participants (unique count)
- Locations (unique count)
- Latest discovery event
- Discovery timeline (lifecycle stage changes)

## First Implementation Scope
Environmental discoveries only. No fire, tools, rope, pottery, agriculture, religion, writing, or government.

## Determinism & Chronicler
- Deterministic: derived solely from recorded events and current-tick causal outputs.
- Chronicler entries: Observation Created, Pattern Recognized, Hypothesis Formed, Discovery Confirmed, Discovery Shared.

## Extensibility
Future systems (fire, tools, medicine, agriculture) emit outcome-rich events. The Discovery Engine maps outcomes to phenomena keys and lets knowledge emerge without hardcoding any specific discovery.
