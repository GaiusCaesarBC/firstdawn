# Resource Storage & Shared Supplies Engine

The Resource Storage & Shared Supplies Engine is the deterministic foundation for shared settlement supplies. It is not trade, currency, markets, taxation, government, crafting, manufacturing, agriculture, or an ownership-law system.

## Scheduler Position

The engine runs after Family & Generations and before Civilization:

Humans -> Goal Decision -> Movement -> Episodic Memory -> Relationship -> Knowledge & Learning -> Communication -> Emergent Camps & Settlements -> Family & Generations -> Resource Storage & Shared Supplies -> Civilization

This lets storage use family-adjusted population and kinship state while still remaining an input to later civilization systems.

## Storage Lifecycle

Each active settlement receives one `SettlementStorage` record:

- `id`
- `settlementId`
- `createdTick`
- `lastUpdatedTick`
- `resources`
- `capacity`
- `preservationQuality`
- `spoilageRate`
- `accessibility`
- `ownershipMode`
- `history`

The storage object is rebuilt deterministically from the previous storage state plus current settlement, family, relationship, and knowledge signals. Abandoned settlements do not create new active storage, but their previous history can still be preserved by callers that retain old snapshots.

## Resource Model

Resources are reusable data objects:

- `id`
- `type`
- `quantity`
- `quality`
- `freshness`
- `createdTick`
- `storedTick`
- `expiresTick`
- `producerHumanId`
- `settlementId`
- `locationCellId`
- `reservedFor`
- `tags`

Resource types are registered through a type registry. The initial registry includes food, fresh water, firewood, stone, wood, plant fiber, animal hides, medicinal plants, simple tools, and construction materials. Future systems can register metal, cloth, weapons, seeds, livestock, pottery, fuel, or trade goods without changing the storage loop.

## Deposits

Citizens contribute supplies when deterministic scoring says they have:

- excess supplies
- a secure family
- trust in local settlement relationships
- an active home settlement
- available storage capacity
- a settlement with enough permanence to justify contribution

Deposits are scored per resident and never randomly selected. Current deposits can include food, fresh water, and firewood. These are architectural inputs, not a crafting or economy system.

## Withdrawals

Citizens withdraw supplies when needs justify it:

- hunger draws food
- thirst draws fresh water
- children and elders receive priority
- family care and settlement support increase urgency

Withdrawals consume the least-fresh matching resource first so stale food is used before fresher food. This is deterministic and avoids global inventory scans.

## Spoilage

Spoilage is deterministic. Food and medicinal plants spoil quickly, water becomes stale more slowly, wood/fiber/hides degrade lightly, and firewood/stone remain effectively persistent. Spoilage is based on:

- resource type definition
- elapsed storage ticks
- freshness
- expiry tick
- storage preservation quality

Spoiled quantities are recorded in storage history and can emit Chronicler-visible events.

## Preservation

Settlement knowledge and structures improve preservation:

- shared fire
- simple shelter
- survival, food, water, or storage knowledge
- settlement permanence

There is no technology tree. Later knowledge systems can add better preservation by tagging knowledge or registering richer resource definitions.

## Family Interaction

Family context affects storage behavior:

- citizens are more willing to deposit when their family is secure
- children and elders receive withdrawal priority
- personal inventory is exposed separately from family-visible inventory
- contribution and withdrawal history are tracked per human

Personal, family, settlement, and future private inventories are represented without ownership law.

## Settlement Interaction

Storage summaries expose:

- total quantity
- capacity and capacity used
- food supply
- water supply
- firewood
- construction materials
- spoilage
- daily consumption
- largest contributors
- most needed resources
- resource trends

These summaries are designed to increase future settlement permanence, survival, and attractiveness without spawning scripted settlement outcomes.

## Goal Integration

The storage engine provides the data layer needed for future goal plugins:

- returning resources home
- protecting stored food
- gathering for shortages
- preparing for winter
- helping starving family
- supporting the settlement
- avoiding empty camps

The current foundation records shortage, surplus, crisis, contribution, withdrawal, and spoilage signals for future goal scoring.

## Atlas & Chronicler

Atlas settlement summaries expose storage, food, water, firewood, construction materials, capacity, spoilage, daily consumption, contributors, needs, and trends.

Atlas citizen summaries expose personal inventory, family inventory, recent deposits, recent withdrawals, and contribution history.

The Chronicler can record deterministic storage milestones:

- First Shared Food Cache
- First Stored Firewood
- Food Shortage
- Food Surplus
- Resource Crisis
- Largest Community Contribution
- Resource Spoilage

## Performance Considerations

The engine is scheduler-friendly:

- it iterates active settlements and local residents
- it uses previous storage snapshots instead of global inventory scans
- it records resource deltas in storage history
- it limits history arrays
- it keeps resource type behavior in a registry

The intended complexity is near O(active settlements + local residents + stored resource entries), with no settlement-wide recalculation beyond the current settlement being processed.

## Extension Points

Future systems can extend the foundation by:

- registering new resource types
- adding resource-producing actions
- enriching personal and family inventory models
- using storage summaries in goal scoring
- using knowledge to improve preservation
- adding weather damage and covered storage
- adding private ownership, theft, trade, agriculture, crafting, and specialization as separate systems

Those systems should consume and emit deterministic state. They should not introduce random withdrawals, scripted winter supplies, or economic shortcuts.
