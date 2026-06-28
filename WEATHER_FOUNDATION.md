# Weather Foundation

First Dawn's weather foundation is a deterministic environmental layer. It classifies per-cell weather state from existing world systems without generating random events, moving storms, rainfall, flooding, or erosion.

## Generation Pipeline

Weather is computed in `src/lib/simulation/weather-engine.ts` for every spatial grid cell.

The engine reads:

- Climate: seasonal temperature, daylight, solar energy, and climate band.
- Terrain: elevation, terrain type, ruggedness, coastlines, and local valley shape.
- Hydrology: ocean/coast distance, water body type, moisture potential, drainage, and basin context.
- Atmosphere: pressure zone, wind, moisture transport, temperature gradient, orographic lift, rain shadow, and stability.
- Astronomy: current seasonal phase through tick-aware climate and atmospheric state.

For each cell, the engine derives normalized values from `0.0` to `1.0`:

- Cloud cover
- Relative humidity
- Precipitation potential
- Snow potential
- Fog potential
- Storm potential
- Evaporation potential
- Dryness index
- Weather stability

It also assigns one weather classification:

- `CLEAR`
- `PARTLY_CLOUDY`
- `CLOUDY`
- `OVERCAST`
- `DRY`
- `WET`
- `FOG_PRONE`
- `SNOW_PRONE`
- `STORM_PRONE`

These are classifications and potentials only. They do not represent actual weather events.

## Climate Relationship

Climate provides the broad thermal and solar context. Seasonal temperature and solar energy drive evaporation, snow potential, and storm potential. The weather engine uses tick-aware climate so weather changes gradually as the year advances.

Winter-like conditions increase cold support and snow potential. Summer-like conditions increase evaporation and convective storm potential. Transitional seasons produce moderate values unless terrain, hydrology, or atmospheric lift pushes a cell toward fog, clouds, or precipitation potential.

## Atmosphere Interaction

Atmosphere supplies the dynamic-looking but still deterministic circulation context:

- Moisture transport feeds humidity and clouds.
- Orographic lift increases cloud and precipitation potential on windward terrain.
- Rain shadow increases dryness and suppresses precipitation potential.
- Atmospheric stability suppresses storms and supports fog in calm, humid locations.
- Temperature gradient contributes to clouds and storm potential.

The weather layer does not create new winds or pressure systems. It consumes the atmospheric circulation layer as an input.

## Terrain Effects

Terrain changes weather state through elevation, ruggedness, local shape, and coastal flags.

Mountains increase snow potential through elevation cooling and can increase precipitation potential where atmospheric lift is present. Downwind rain-shadow terrain becomes drier. Valley-like cells retain humidity and increase fog potential, especially when winds are light and air is stable.

## Hydrology Effects

Hydrology controls moisture availability and water proximity.

Coastal and ocean cells retain humidity, moderate dryness, and support fog/cloud potential. Interior cells tend to dry out as distance from coast increases, especially when evaporation is high and rain-shadow potential is present. Lake candidates and coastal water also increase local fog potential.

## Deterministic Update Model

Weather is recomputed from deterministic inputs for the requested tick. The scheduler's `weather` system publishes summary metadata each simulation tick, including average humidity, cloud cover, precipitation potential, storm potential, fog potential, snow potential, evaporation, dryness, dominant weather type, and seasonal weather state.

No random weather generation is used. The scheduler passes a deterministic random source to every system, but the weather foundation does not consume it.

## Current Limits

This milestone intentionally does not implement:

- Moving storms
- Rainfall events
- Thunderstorms or lightning
- Flooding
- River changes
- Erosion
- Vegetation
- Animals
- Civilizations
- AI behavior

## Future Expansion

Future milestones can build on weather state without changing its deterministic foundation:

- Dynamic storm cells that form from high storm potential.
- Rainfall and snowfall accumulation from precipitation potential.
- Lightning from storm intensity and atmospheric instability.
- Flooding from rainfall, hydrology, basins, and drainage limits.
- Erosion from runoff, terrain slope, and repeated precipitation.
- Ecosystems and biomes that consume humidity, dryness, snow, fog, evaporation, and seasonal stability.

The important contract is that weather remains derived from world state first. Later event systems can add time-local behavior, but this layer is the stable environmental substrate they read from.