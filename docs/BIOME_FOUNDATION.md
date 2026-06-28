# Biome Foundation

The biome system is the deterministic ecology layer that sits on top of the existing planet foundations. It does not model plants, animals, people, settlements, or consciousness. It classifies each fixed 18 x 36 planet grid cell into one biome that later life and civilization systems can consume.

## Inputs

Biome classification uses the same world seed and grid as terrain, climate, hydrology, atmosphere, weather, and resources. For every cell it reads latitude, elevation, terrain type, coast status, temperature, precipitation potential, relative humidity, hydrology moisture, river/lake flags, distance to coast/ocean, seasonality, snow potential, atmospheric rain shadow/lift, and volcanic or erosion signals from the resource layer.

## Priority Order

The classifier applies high-confidence physical states before climate-zone ecology:

1. Ocean and shallow/coastal water.
2. Lakes, river corridors, and saturated wetlands.
3. Permanent ice.
4. Extreme elevation and alpine terrain.
5. Volcanic or recently barren terrain.
6. Desert and badlands conditions.
7. Cold tundra and boreal zones.
8. Tropical, temperate, grassland, savanna, shrubland, and forest zones.

This order keeps ocean cells from becoming land biomes, prevents tropical labels on permanent ice, and gives mountains, active volcanic terrain, and persistent water bodies precedence over broad climate bands.

## Transition Pass

After base classification, a second deterministic pass checks neighboring cells. Borderline dry grassland can become shrubland, wet grassland near forest can become forest, cold forest near tundra can become boreal forest, and tropical forest can shift between seasonal forest and rainforest based on rainfall seasonality. The transition pass uses a hash derived from the world seed and cell id, never `Math.random`, so the same seed and same environmental inputs always produce the same biome map.

## Persistence

Scheduler ticks run the `biomes` system after terrain, climate, hydrology, atmosphere, weather, and resources. The system writes one `PlanetCell` record per grid cell with the biome key, display name, category, color, habitability score, fertility score, water availability, vegetation density, tags, and timestamps. Existing rows are left unchanged when generated values are identical, so repeated runs are idempotent except when upstream deterministic inputs genuinely change.

## Future Use

Plants can use biome fertility, water, vegetation density, and tags to choose viable ranges. Animals can use vegetation, water, and biome category for habitat suitability. People, settlements, and civilizations can use habitability, fertility, starting-zone candidates, coast and river tags, and harsh-region summaries for migration, founding, and expansion logic.