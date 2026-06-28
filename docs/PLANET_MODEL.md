# Planet Model

## Why Planet is separate from World

`World` is the operational simulation container: lifecycle status, ticks, time progression, and developer controls live there.

`Planet` is the physical world profile for that simulation container: radius, gravity, mass, orbital timing, atmosphere, and ocean coverage.

Keeping them separate gives the project two useful properties:

1. World lifecycle tools can stay focused on simulation operations.
2. Physical planetary data can evolve independently without overloading the root world record.

This separation also makes it easier to support multiple world states that may eventually reference different planetary profiles, migrations, or debug tooling.

## How the spatial grid works

The current spatial grid is a deterministic coordinate partition of the planet surface.

- Latitude is divided into horizontal bands.
- Longitude is divided into vertical slices.
- Each grid cell has:
  - a deterministic cell id
  - latitude range
  - longitude range
  - midpoint latitude/longitude
  - hemisphere label
  - latitude band metadata
  - neighbor ids

The default grid resolution is:

- 18 latitude divisions
- 36 longitude divisions
- 648 total cells

The current implementation is coordinate-only. It does **not** generate terrain, climate, oceans, weather, or biomes.

## Why there is no terrain yet

This milestone intentionally stops at the coordinate layer.

That keeps the foundation stable before higher-order simulation data is attached to cells. A clean spatial index is needed first so later systems can target the same deterministic cell ids and cell neighborhoods.

## How future systems will use grid cells

Future terrain, climate, weather, plants, animals, humans, and civilizations should attach their state to grid cells instead of inventing separate ad hoc coordinate systems.

Planned usage pattern:

- terrain systems assign elevation/landform data to cells
- climate systems assign temperature, humidity, and seasonal patterns to cells
- weather systems evaluate local and neighboring cells over time
- ecology systems place plants and animals into cells
- human/civilization systems use cells for settlement, travel, logistics, and region ownership

Because cell ids and neighbor relationships are deterministic, those future systems can remain reproducible.

## Default Earth-like values

Current defaults are intentionally Earth-like:

- radius: 6371 km
- gravity: 9.81 m/s²
- mass: 5.972e24 kg
- rotation period: 24 hours
- orbital period: 365 days
- axial tilt: 23.44°
- orbital eccentricity: 0.0167
- atmosphere pressure: 101.3 kPa
- atmosphere composition:
  - nitrogen: 78
  - oxygen: 21
  - argon: 0.93
  - carbon dioxide: 0.04
- ocean coverage: 71%

These values are defaults for developer stability and seed consistency, not a statement that every future world must stay Earth-like.

## Current grid resolution

The active default spatial grid is:

- 18 × 36
- 648 cells total

At this stage, that resolution is enough for:

- deterministic debugging
- basic planetary inspection
- future per-cell simulation attachment

## Future scaling plan

The expected scaling path is incremental:

1. keep the current 18 × 36 developer grid for debugging and verification
2. add higher-resolution grid presets when terrain and climate begin
3. keep deterministic ids or deterministic upgrade rules so old data can be migrated safely
4. eventually support region aggregation so higher-level systems can reason about provinces, biomes, and civilizations without inspecting every cell every tick

Until those later milestones begin, the grid remains intentionally simple: a stable coordinate scaffold for the planet model.