# Terrain Foundation

The terrain foundation creates the planet's permanent physical surface. It is deterministic, seed-based, and independent of weather, water movement, ecology, resources, and civilizations.

## Generation Pipeline

1. Build the spatial grid with the existing latitude/longitude grid engine.
2. Read the world's seed. Terrain generation fails without a seed so no unseeded randomness can enter the simulation.
3. Generate deterministic continental centers from the seed.
4. Project layered procedural noise onto each grid cell.
5. Compute continentalness, tectonic activity, and raw elevation.
6. Choose a deterministic sea level from the configured planet ocean coverage, clamped to realistic bounds.
7. Normalize elevation to `0.0 - 1.0`, with sea level anchored at `0.42`.
8. Compute ruggedness from local elevation variation among neighboring cells.
9. Classify terrain type from elevation plus ruggedness and tectonic activity.
10. Mark coast cells where land borders ocean.
11. Build summary metrics, terrain distribution, and largest connected land/ocean estimates.

Terrain is regenerated from the same inputs whenever inspected, but the values are static: no terrain system mutates them during ticks.

## Noise Layers

The engine uses deterministic value noise and fractal noise. All lattice values are derived from a stable string hash of the world seed, layer name, and lattice coordinate.

Current layers:

- `continental-warp`: large-scale distortion for continent shapes, peninsulas, and gulfs.
- `oceanic-chain`: ridged noise that can create sparse island-chain influence without producing salt-and-pepper islands.
- `plate-boundary`: ridged tectonic structure used to cluster mountain belts.
- `crustal-stress`: local tectonic variation.
- `continental-detail`: broad elevation detail.
- `local-detail`: fine elevation detail.

The engine does not call `Math.random`.

## Terrain Classification

Elevation is normalized from `0.0` to `1.0`.

Classification order:

- `DEEP_OCEAN`: elevation below `0.18`
- `OCEAN`: elevation below `0.34`
- `SHALLOW_SEA`: elevation below sea level (`0.42`)
- `BEACH`: low land below `0.46`
- `PLATEAU`: elevated land with low ruggedness and moderate tectonic activity
- `PLAINS`: lower inland terrain
- `HILLS`: mid-elevation terrain
- `MOUNTAINS`: high rugged terrain
- `HIGH_MOUNTAINS`: highest terrain

Plateaus are geological only. They do not imply vegetation, biome, rainfall, or settlement suitability.

## Data Model

Each terrain cell extends the existing grid cell and climate can be projected onto the same cell without replacement.

Terrain fields:

- `elevation`: normalized `0.0 - 1.0`
- `terrainType`: one of `OCEAN`, `DEEP_OCEAN`, `SHALLOW_SEA`, `BEACH`, `PLAINS`, `HILLS`, `MOUNTAINS`, `HIGH_MOUNTAINS`, `PLATEAU`
- `continentalness`: normalized closeness to continental centers
- `ruggedness`: normalized local elevation variation
- `tectonicActivity`: normalized static tectonic activity
- `isCoast`: true when a land cell borders ocean

Summary fields:

- highest, lowest, and average elevation
- land, ocean, and mountain percentages
- coastline cell count
- terrain distribution
- largest continent estimate
- largest ocean estimate

## Scheduler Integration

The geology scheduler system exposes static terrain metadata. It does not move plates, erode surfaces, create earthquakes, or alter terrain. `getSimulationState` also exposes terrain summary data for seeded worlds.

## Future Integration

Terrain is intended as stable input for later systems:

- Rivers can flow from elevation and ruggedness.
- Oceans can consume ocean and shallow sea cells.
- Erosion can later modify a separate evolving terrain layer, while preserving the initial geological foundation if needed.
- Weather can use elevation, coastlines, and mountain barriers.
- Ecology can combine terrain with climate when plants and animals exist.
- Civilizations can evaluate terrain, coast access, and climate when settlement systems exist.

Not implemented in this milestone: weather, rainfall, rivers, lakes, erosion, plants, animals, civilizations, resources, volcanoes, earthquakes, or plate movement.
