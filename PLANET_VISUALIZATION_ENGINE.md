# Planet Visualization Engine

## Purpose

`/worlds/map` is the primary developer atlas for First Dawn. It renders the full planetary grid and exposes existing deterministic simulation layers without modifying simulation rules, constants, or calculations.

This milestone is visualization-only.

## Rendering Architecture

- The atlas page is served from `src/app/worlds/map/page.tsx`.
- Initial state is built on the server through `src/lib/worlds/map-atlas.ts`.
- Interactive day and world changes are fetched through `src/app/api/worlds/map/route.ts`.
- The interactive canvas atlas lives in `src/app/worlds/map/world-map-atlas-client.tsx`.
- All layer values come from existing simulation engines:
  - Planet
  - Climate
  - Terrain
  - Hydrology
  - Atmosphere
  - Weather

The atlas snapshot builder recomputes seasonal views by calling existing `...AtTick` functions for the selected day. No new simulation logic is introduced.

## Layer System

The atlas groups layers by simulation domain:

- Planet: planet, elevation, terrain
- Climate: climate bands, average temperature, solar energy, daylight hours
- Hydrology: water body class, ocean mask, watersheds, river candidates, lake candidates, distance to ocean
- Atmosphere: atmospheric stability, pressure zones, wind direction, wind strength, moisture transport, rain shadow
- Weather: weather class, humidity, cloud cover, storm potential, snow potential, fog potential, dryness, weather type
- Future Layers: biomes, vegetation, animals, civilizations

Future layers are intentionally disabled placeholders so later milestones can plug into the same atlas instead of creating separate debug surfaces.

## Color Palettes

The atlas uses domain-specific palettes instead of a generic debug ramp:

- Elevation: deep ocean blue through coastline sand, plains green, mountain brown, alpine gray, snow white
- Temperature: dark blue through green, yellow, orange, and red
- Humidity: dry brown through green and dark green
- Pressure: blue to white to red
- Weather type: explicit categorical colors for clear, cloudy, fog-prone, snow-prone, dry, wet, and storm-prone states
- Watersheds: hashed categorical hues keyed by watershed ID for stable deterministic color assignment

## Overlays

Available overlays and debug tools:

- Latitude bands
- Wind arrows
- Watershed boundaries
- Coastlines
- Grid lines
- Cell IDs
- Neighbor links
- Drainage arrows
- Pressure bands
- Mountain outlines

These overlays are visual only and never mutate snapshot data.

## Performance Considerations

- Rendering uses a single canvas rather than DOM-per-cell markup.
- The client redraws from the current atlas snapshot instead of rebuilding React nodes for each cell.
- Cell lookup tables are cached in refs for hover, click, and overlay resolution.
- Layer changes reuse the current snapshot and only redraw the canvas.
- Day changes request a fresh server snapshot for the selected world/day pair.
- The current implementation is designed to remain viable as grid density increases into the tens of thousands of cells.

## Developer Workflow

1. Open `/worlds/map`.
2. Select a world.
3. Switch layers to inspect deterministic outputs from each simulation system.
4. Drag the day slider to inspect seasonal changes.
5. Hover cells for a compact summary.
6. Click cells to open the full inspector.
7. Enable overlays when tracing drainage, wind, coastlines, or watershed boundaries.

## Testing

UI coverage lives in `tests/ui/world-map.test.ts` and verifies:

- Map rendering
- Layer switching
- Hover tooltip visibility
- Cell inspector behavior
- Time slider updates
- Statistics updates
- Deterministic rendering behavior