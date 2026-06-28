# Plant Ecology Foundation

The plant ecology foundation is the deterministic primary-producer layer for First Dawn. It sits on top of the biome foundation and assigns broad plant guilds to the fixed 18 x 36 planet grid. These are not individual species yet; they are ecological groups that future animals, people, settlements, agriculture, survival systems, and civilizations can consume.

## Plant Categories

The first plant model defines these guilds:

- Algae / aquatic plants for ocean edges, lakes, rivers, marshes, and wet coastal productivity.
- Moss / lichens for tundra, alpine, rocky, glacial edge, and pioneer surfaces.
- Grasses for grasslands, savannas, grazing foundations, and edible seed biomass.
- Shrubs for dry, seasonal, transitional, browsing, berry, and cover habitats.
- Reeds / wetland plants for river corridors, marshes, lakes, floodplains, nesting cover, and fiber.
- Temperate trees for deciduous/mixed forests, fruit/nut potential, shelter, and timber.
- Boreal trees for cold conifer forests, fuel, shelter, and northern timber.
- Tropical trees for rainforest and seasonal tropical canopy biomass and biodiversity.
- Desert plants for sparse drought-resistant productivity in deserts and badlands.
- Alpine plants for high elevation, thin-soil, wind-stressed productivity.
- Fungal / decomposer layer for forest-floor and wet-soil decomposition, soil food webs, and medicinal potential.

Each plant definition has biome preferences, temperature and precipitation ranges, water and fertility requirements, elevation tolerance, growth and spread rates, edible value, shelter value, fuel/material value, biodiversity value, resilience, color, and tags.

## Suitability Rules

For each cell, the engine scores every plant guild against deterministic inputs from biomes, terrain, hydrology, climate, atmosphere, weather, and planet resources. The strongest guild becomes the dominant plant type unless the cell is too hostile for established plant life.

Suitability uses:

- biome key/category/tags
- adjusted temperature
- precipitation potential
- water availability and resource freshwater
- fertility and clay/alluvial hints
- elevation tolerance
- vegetation density
- seasonal stress
- erosion, volcanic disturbance, coast/ocean constraints
- deterministic seed-based tie-breaking

Biome caps enforce ecological realism. Deserts and badlands stay sparse. Tropical rainforests can reach high biomass and biodiversity. Grasslands favor edible grass biomass and low wood. Wetlands favor reeds and aquatic plants. Boreal regions favor conifers plus moss/lichen. Tundra, alpine, ice, volcanic, and deep barren cells stay low density. Ocean cells can carry limited aquatic productivity but do not become forests or grasslands.

## Persistence

Plant ecology is persisted onto `PlanetCell` after biome generation:

- dominant plant key/name
- plant suitability
- plant density
- biomass
- edible plant score
- wood/material score
- medicinal potential
- biodiversity
- regrowth rate
- seasonal stress
- plant tags
- plant generated/updated timestamps

The scheduler system is idempotent. Re-running with the same world seed, tick, and upstream planet state produces the same plant outputs and leaves unchanged rows untouched.

## Dependency On Biomes

Plants depend on biome cells because the biome layer provides the stable ecological envelope: habitability, fertility, water availability, vegetation density, category, color, and tags. Persistence requires existing `PlanetCell` biome rows, so the scheduler runs Plant Ecology after Biomes and before Biology, Animals, Humans, and Civilization.

The pure plant engine can recompute deterministic plant ecology from the world seed and upstream layers for debugging and tests, but the persistent scheduler path validates that biome cells already exist.

## Downstream Use

Animals can use biomass, edible plant score, plant density, biodiversity, water availability, shelter tags, and regrowth rate as carrying-capacity inputs.

People and survival systems can use edible plant coverage, timber/material score, medicinal potential, and harsh low-plant zones to evaluate foraging, fuel, construction, and risk.

Settlements and civilizations can use civilization starting-zone support, timber/material coverage, water-adjacent plant productivity, and low-resource dead zones to guide founding, migration, agriculture, expansion, and conflict pressure.

Farming systems can later specialize these guilds into crop suitability, wild domestication candidates, soil improvement, fallow cycles, irrigation demand, and seasonal harvest behavior.
