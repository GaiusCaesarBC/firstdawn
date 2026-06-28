# Planet Resources Foundation

The Planet Resources Engine is the deterministic layer between Weather and Biosphere. It derives what naturally exists beneath and upon each canonical grid cell. It does not create plants, animals, civilizations, cities, mining activity, or economic behavior.

## Simulation Inputs

Resources are derived from existing physical systems only:

- Terrain: elevation, terrain type, continentalness, ruggedness, tectonic activity, coastline.
- Hydrology: ocean/sea status, basins, watersheds, river candidates, flow accumulation, moisture potential, distance to ocean/coast.
- Climate: latitude-derived temperature, daylight, and seasonal climate bands.
- Atmosphere: orographic lift, rain shadow, stability, and moisture transport.
- Weather: humidity, precipitation potential, storms, evaporation, dryness, snow, fog.
- Latitude: through the canonical grid cell midpoint and climate state.

The engine is deterministic. It uses no random calls and makes no writes back into terrain, hydrology, atmosphere, weather, or climate.

## Geological Assumptions

Each cell receives a bedrock type, sediment depth, volcanic influence, tectonic activity, and erosion potential.

- Mountain belts, uplift, ruggedness, and tectonic activity increase metal potential.
- Ancient continental crust favors iron, tin, uranium, quartz, and rare earth elements.
- Faulted volcanic arcs favor copper, gold, silver, nickel, sulfur, and volcanic rock.
- Low-relief sedimentary basins favor coal, clay, salt, groundwater storage, and aquifers.
- Shallow marine shelves and coastal sediment favor limestone, sand, and salt.
- River candidates and high flow accumulation favor clay, gravel, alluvial deposits, freshwater, and springs.
- Dry inland basins with high evaporation favor salt.

Timber is intentionally a zero-valued placeholder until vegetation exists.

## Atlas Layers

The Developer Atlas now includes a Resources section with deterministic heatmaps:

- Resource Richness: composite natural resource potential.
- Metals: iron, copper, gold, silver, tin, and nickel.
- Industrial: coal, limestone, granite, clay, sand, and salt.
- Water: groundwater, aquifer, freshwater, and spring potential.
- Building Materials: stone, gravel, clay, and placeholder timber.
- Rare Materials: rare earth elements, uranium, sulfur, and quartz.

The Cell Inspector exposes bedrock, iron, copper, coal, gold, groundwater, stone, clay, rare earths, volcanic influence, and sediment depth.

## Planet Resource Summary

The engine produces a Planet Resource Summary containing:

- Richest iron region.
- Largest coal basin.
- Largest aquifer.
- Strongest mining region, as natural geologic potential only.
- Volcanic regions.
- Rare-earth hotspots.
- Major sedimentary basins.
- Average mineral richness.
- Resource diversity.

The `/worlds` dashboard shows the strongest mining region, total resource diversity, richest aquifer, volcanic zones, and major sedimentary basins.

## Future Biosphere Interaction

Future vegetation and biome systems can consume resource and water outputs without changing how resources are generated. Soil development, nutrients, wetland formation, and timber potential should eventually derive from the resource layer plus hydrology and climate. Until then, timber remains unmodeled.

## Future Civilization Interaction

Future civilization systems may use resources to reason about settlement pressure, material access, trade routes, technology, and extraction. This milestone does not perform any of those actions. It only exposes natural availability so later systems can make their own deterministic decisions.
