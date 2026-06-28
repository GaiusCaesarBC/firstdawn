# Hydrology Foundation

This milestone adds the first deterministic water and hydrology layer for First Dawn. It is a static projection over the existing spatial grid, terrain engine, and passive climate engine. It does not persist new records, mutate terrain, or change on simulation ticks.

## Pipeline

`src/lib/simulation/hydrology-engine.ts` builds hydrology in a fixed order:

1. Generate the existing terrain grid from the world seed.
2. Project the existing passive climate grid onto the same cells.
3. Recognize marine cells and coastal water from terrain and adjacency.
4. Compute distance-to-ocean and distance-to-coast fields with grid traversal.
5. Assign land drainage toward the lowest downhill neighbor.
6. Accumulate upstream flow along downhill links.
7. Resolve each cell to an ocean outlet or inland basin.
8. Assign deterministic watershed and basin identifiers.
9. Estimate moisture potential from passive climate and marine proximity.
10. Mark static lake, river source, and river channel candidates.

Every hydrology cell keeps the original grid identity and receives:

- `isOcean`
- `isSea`
- `isLakeCandidate`
- `isRiverCandidate`
- `waterBodyType`
- `drainageDirection`
- `basinId`
- `watershedId`
- `flowAccumulation`
- `moisturePotential`
- `distanceToOcean`
- `distanceToCoast`

## Ocean Recognition

Hydrology reads the terrain classification directly. `DEEP_OCEAN`, `OCEAN`, and `SHALLOW_SEA` terrain cells become marine hydrology cells. Marine cells adjacent to land become `COASTAL_WATER`, deep marine cells remain `DEEP_OCEAN`, and non-coastal shallow cells remain `SHALLOW_SEA`.

Land cells remain land unless later marked as `INLAND_BASIN`, `LAKE_CANDIDATE`, `RIVER_SOURCE_CANDIDATE`, or `RIVER_CHANNEL_CANDIDATE`.

## Drainage Direction

For each land cell, hydrology inspects neighboring cells and selects the lowest neighbor with strictly lower elevation. Ties are resolved by stable cell ID ordering. The drainage direction is stored as a compass direction such as `N`, `SE`, or `W`.

If no neighboring cell is lower, the cell is marked as `INLAND_BASIN`. This means it is a local depression in the static terrain projection. It does not mean a lake already exists.

## Flow Accumulation

Each land cell begins with one unit of potential upstream contribution. Land cells are processed from high elevation to low elevation, and each cell contributes its accumulated value to its downhill target. The result is a deterministic estimate of how many upstream cells eventually drain through each cell.

This is only a static routing estimate. It is not water volume, rainfall, river discharge, flood behavior, or erosion.

## Watersheds And Basins

Hydrology follows each drainage chain until it reaches either marine water or an inland depression.

Cells that drain to the same marine outlet receive a matching ocean watershed ID. Cells trapped behind the same inland depression receive a matching basin ID and basin watershed ID.

The IDs are derived from stable cell IDs, so the same seed and grid always produce the same watershed and basin assignments.

## Moisture Potential

Moisture potential is a future-facing input derived from:

- distance to ocean
- distance to coast
- passive climate temperature
- daylight moderation
- whether the cell is marine

It is not rainfall. It does not create weather, humidity simulation, groundwater, snowpack, or plant growth.

## Current Integration

The scheduler exposes hydrology as a static derived layer in `SimulationState`. The existing Oceans scheduler system reports static hydrology summary metadata, including candidate counts and watershed/basin estimates, without advancing or animating water.

The world dashboard now includes a **Water & Hydrology Summary** section. The grid inspector joins terrain, passive climate, and hydrology by grid cell ID so sample cells show all three layers together.

## Intentionally Not Simulated

This milestone intentionally does not simulate:

- active weather
- flowing rivers
- rainfall
- erosion
- groundwater
- tides
- floods
- snow or ice movement
- plants
- animals
- resources
- settlements
- farming
- migration
- civilizations

The hydrology layer only answers where water can exist, collect, and eventually move.

## Future Connections

Future milestones can use this layer as a foundation for:

- river path carving and named river networks
- rainfall and seasonal weather
- erosion and sediment transport
- wetlands, lakes, deltas, and floodplains
- ecological moisture bands
- plant and animal habitat constraints
- freshwater access for settlements
- farming suitability
- migration corridors
- trade routes and territorial boundaries
- civilization growth around rivers, lakes, and coasts

Those systems should consume hydrology as input rather than replacing terrain or passive climate data.
