# First Dawn Atmosphere Foundation

This milestone adds a deterministic atmospheric circulation layer to every grid cell. It describes how air tends to move across the planet from astronomy, passive climate, terrain, and hydrology. It does not create day-to-day weather or precipitation.

## Circulation Model

The atmosphere engine uses a simplified three-cell planetary circulation model:

- Hadley cells dominate the tropics, with low pressure near the thermal equator and high pressure near the subtropics.
- Ferrel cells occupy the temperate latitudes, producing broad mid-latitude flow.
- Polar cells occupy high latitudes, with dense polar high-pressure air moving equatorward.

This is not fluid dynamics. The engine derives stable circulation bands from latitude and shifts those bands seasonally using the astronomy engine's solar declination.

## Pressure Zones

Every cell receives one pressure zone:

- `EQUATORIAL_LOW`
- `SUBTROPICAL_HIGH`
- `TEMPERATE_LOW`
- `POLAR_HIGH`
- `TRANSITION`

Each cell also receives a normalized pressure value from `0.0` to `1.0`. The value starts from the latitude band and is then adjusted by passive climate temperature and terrain elevation.

## Wind Generation

Prevailing wind direction and strength are deterministic. They are derived from:

- latitude and pressure-zone band
- seasonal circulation shift
- local temperature gradient
- terrain drag and mountain deflection
- coastal modification from hydrology distance fields

The wind direction represents the direction air is moving through the cell. Tropical trades, mid-latitude westerlies, and polar easterlies are approximated as broad, reproducible patterns.

## Moisture Transport

Moisture transport potential is normalized from `0.0` to `1.0`. It describes how easily moisture could move through a cell later.

Inputs include:

- ocean and coast distance from hydrology
- hydrology moisture potential
- passive climate temperature
- wind strength
- marine terrain classification
- inland drying

This is not rainfall. It only measures transport capacity.

## Terrain Interaction

Mountains interact with prevailing wind:

- Orographic lift potential rises when wind moves from lower terrain into elevated or rugged terrain.
- Rain shadow potential rises on the leeward side of mountain barriers.
- Rugged terrain also reduces wind strength through terrain drag.

No precipitation, erosion, or biome effects are created here.

## Seasonal Movement

The circulation bands move with the astronomy engine's solar declination. Axial tilt controls how far the bands shift during the year. The dashboard exposes both the seasonal phase and the current shift in degrees.

Because this is driven only by astronomy, the same world at the same tick always produces the same atmosphere.

## Why This Is Not Weather

This foundation has no random fluctuation and no transient events. It does not simulate:

- rain
- snow
- clouds
- storms
- lightning
- hurricanes
- tornadoes

The layer is an invisible physical substrate. Later systems can read it, but it does not produce visible weather by itself.

## Future Integration

Future systems can consume atmosphere fields for:

- clouds from moisture transport and stability
- precipitation from lift, moisture, and rain shadow
- storms from instability, gradients, and wind strength
- erosion from long-term precipitation and runoff
- ecology from climate, water, and atmospheric transport
- civilization from reliable wind corridors, dry regions, and mountain rain shadows

The current milestone stops before those behaviors.
