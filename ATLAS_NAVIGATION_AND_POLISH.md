# Atlas Navigation & Visualization Polish

This milestone enhances the Planet Visualization Atlas with search-driven navigation, a dynamic legend system, overlay level-of-detail (LOD) scaling, and targeted performance improvements. No simulation logic was changed.

## Navigation Architecture
- Search input parses:
  - Cell ID: `cell-09-18`, `cell-15-22`
  - Latitude: `45N`, `30S`, `0`, `Equator`, `North Pole`, `South Pole`
  - Coordinates: `45N,120E`, `-35,85`, `10,-70`
- Matching actions center the map, zoom appropriately, highlight the cell, and open the inspector as needed.
- Quick Navigation buttons jump to common targets:
  - North Pole, South Pole, Equator, Prime Meridian
  - Highest Mountain, Lowest Point
  - Largest Continent, Largest Ocean
  - Largest Watershed, Largest Basin
  - Wettest, Driest, Warmest, Coldest, Strongest Wind, Largest Rain Shadow
- Largest Continent/Ocean are computed on the client from connected components using existing neighbor links (no simulation change).
- Search history persists the last 10 queries in localStorage with support for Favorites and Pinned.

## Legend System
- The legend updates immediately when the active layer changes.
- Controls:
  - Collapse/Expand
  - Pin (keeps the legend visible)
  - Opacity slider (for readability over bright layers)
- Elevation, Temperature and other numeric layers render gradient samples representing the layer’s range.
- Categorical layers (Climate, Weather, Pressure zones, Watersheds) render color chips.
- The panel auto-resizes with the layout.

## Overlay Scaling (Resolution-Based)
- Overlays are auto-filtered based on zoom and world size to reduce clutter:
  - Far zoom: coastlines and latitude bands; hides dense detail (grid, IDs, neighbor/drainage links).
  - Medium zoom: adds wind arrows, watersheds, pressure bands, mountain outlines.
  - Close zoom: enables grid, IDs (on smaller worlds), neighbor links, and drainage arrows.
- Grid-size thresholds:
  - ≤ 64×128: can show cell IDs and neighbor links at close zoom.
  - ≥ 256×512: hide IDs; reduce arrow density (implicit via thresholds).
  - ≥ 1024×2048: minimal overlays regardless of zoom to maintain clarity.
- User overlay toggles remain, but auto-scaling may suppress display at inappropriate zoom levels.

## Performance Strategy
- Base layer is rendered once to an in-memory buffer (canvas) per world/day/layer and re-used for pan/zoom.
- Redraw is triggered only on:
  - Layer change
  - Time change
  - Zoom or pan
  - Selection or overlay change
- Cached elements:
  - Base color buffer (layer image)
  - Lightweight computed masks (auto overlay visibility)
  - Largest connected land/ocean components (computed on demand)

## Keyboard Shortcuts
- F: Search
- L: Toggle Legend
- O / W: Overlays / Wind
- G: Grid
- T: Terrain
- C: Climate
- H: Hydrology
- A: Atmosphere
- E: Weather
- Space: Reset View
- ESC: Close Inspector / Search

## Future Extensibility
- Layer-specific legend builders to tune category labels and numeric tick marks.
- Vector clustering for very large worlds (wind/drainage) with sampling density controls.
- Screenshot/export presets (transparent background, UI on/off, watermark).
- Per-layer user presets (favorite zoom + overlay combos), shared via URL params.

## Developer Notes
- All changes are isolated to the atlas client UI; simulation engines and data builders remain untouched.
- Auto-scaling decisions are conservative and can be tuned per project needs.
- Search history is stored in `localStorage` under `atlasSearchHistory`.
