# Animal Ecology Foundation

The animal ecology foundation is the deterministic consumer layer for First Dawn. It sits after Biomes and Plant Ecology, then assigns broad animal guild support to every cell in the fixed 18 x 36 planet grid. These are not species or individual creatures yet; they are ecological guilds that future people, tribes, settlements, hunting, domestication, migration, danger, and food-chain systems can consume.

## Animal Guilds

The guild catalog covers aquatic microfauna, fish, amphibians, insects, small herbivores, large herbivores, browsers, grazers, small predators, apex predators, scavengers, birds, reptiles, burrowers, cold-adapted animals, desert-adapted animals, and wetland animals.

Each guild definition includes:

- key and display name
- category and map color
- biome preferences
- plant food dependency and prey dependency
- water dependency
- temperature, precipitation, and elevation ranges
- shelter requirement
- reproduction rate
- mobility score and migration tendency
- human food value
- danger score
- biodiversity value
- tags

## Dependencies

Animal ecology depends on deterministic upstream cell data:

- biome key, category, vegetation, fertility, water, tags, temperature, precipitation, elevation, and seasonality
- plant density, biomass, edible plant score, biodiversity, regrowth, wood/material shelter, and seasonal stress
- terrain ruggedness and elevation
- deterministic world seed and tick

The pure engine can recompute the same animal ecology from the world seed and upstream deterministic layers. The persistence path is intentionally stricter: it requires persisted `PlanetCell` rows with plant ecology timestamps. This keeps scheduler order explicit and gives clean failures when Animals runs before Plant Ecology.

## Carrying Capacity Logic

Animal support is built from food-chain foundations before guild selection:

- high edible plants, biomass, regrowth, and water increase herbivore capacity
- wetlands, lakes, coasts, and oceans increase aquatic food support
- insects and microfauna increase prey availability in warm, wet, biodiverse cells
- prey availability gates predator capacity
- shelter comes from plant biomass, wood/material value, vegetation density, wetland cover, and rugged terrain
- harsh seasonality, ice, barren volcanic terrain, and high alpine stress reduce density and carrying capacity

The engine then chooses the dominant guild with seeded deterministic scoring. No `Math.random` is used.

## Predator and Prey Foundation

The current layer does not simulate individual births, deaths, packs, or species. It produces stable cell-level support values:

- `herbivoreCapacity`
- `preyAvailability`
- `predatorCapacity`
- `animalDensity`
- `carryingCapacityScore`

Future species systems can use these values to seed actual populations and trophic relationships.

## Migration Pressure

Migration pressure combines guild mobility, migration tendency, seasonal stress, terrain stress, food scarcity, and water stress. Alpine, cold, sparse, and seasonal grassland systems often produce higher migration pressure than stable forests or wetlands. The summary utility groups high-pressure connected regions as migration corridor candidates.

## Human Use Hooks

The animal layer adds immediate future-facing scores:

- `huntingValue` for food procurement and early survival
- `domesticationPotential` for pastoral and settlement foundations
- `dangerScore` for travel, camp, and settlement risk
- `animalBiodiversityScore` for ecosystem richness and resource variety
- `civilizationFoodSupportScore` for high-level settlement suitability

The summary utilities expose total animal biomass/capacity, herbivore-rich regions, predator hotspots, hunting regions, domestication candidate regions, migration corridors, civilization food support, and danger map scores.

## Scheduler Flow

The intended lifecycle is:

1. Terrain, climate, hydrology, atmosphere, weather, and resources establish physical conditions.
2. Biomes classify each fixed grid cell.
3. Plant Ecology persists primary producers.
4. Animal Ecology persists consumer guild support.
5. Future humans, tribes, settlements, hunting, domestication, culture, economy, and civilization systems consume the food-chain foundation.