# Time and Astronomy

First Dawn now has its first non-life natural law: ticks become calendar time, and calendar time drives a simple deterministic sky.

## Ticks vs Simulation Time

The scheduler remains the heartbeat. It advances a world's `currentTick` one step at a time and records each run in `SimulationTick`.

The Time Engine is the calendar. It translates a world configuration plus a tick into a stable `TimeState` with elapsed seconds, year, day of year, clock time, day progress, year progress, and a phase label such as `sunrise`, `noon`, or `midnight`.

Future systems should call `getTimeState(world)` or `getTimeStateAtTick(world, tick)` instead of deriving calendar time themselves.

## Day Length

`tickDurationSeconds` controls how many simulation seconds pass per scheduler tick. The default is `60`, so one tick is one simulated minute.

`dayLengthSeconds` controls how many simulation seconds make one full day. The default is `86400`, so the default world behaves like a familiar 24-hour clock. Clock display is normalized to 24 hours even if a future world uses a shorter or longer day.

`initialDay` and `initialHour` set the starting local time at tick `0`. By default First Dawn begins at day `0`, hour `6`, which places the first tick at sunrise.

## Year Length

`yearLengthDays` controls how many configured days make one year. The default is `365`.

The Time Engine combines initial day/hour with elapsed tick time, then wraps day and year progress deterministically. Advancing exactly one configured year returns to the same normalized year progress while incrementing the year number.

## Seasons

The Astronomy Engine is the sky. It calls the Time Engine first, then derives astronomy state from normalized year and day progress.

Seasons are intentionally simple quarter-year bands:

- `spring`: 0.00 to 0.25 year progress
- `summer`: 0.25 to 0.50 year progress
- `autumn`: 0.50 to 0.75 year progress
- `winter`: 0.75 to 1.00 year progress

Southern hemisphere seasons are the opposite of northern hemisphere seasons.

Solar declination is a deterministic sine wave bounded by `axialTiltDegrees`. The default tilt is `23.44` degrees.

## Simple Sky Math

This is not a full orbital simulation yet. The current model keeps the math small and legible:

- day/night comes from normalized day progress
- daylight peaks near noon and falls to zero around sunrise and sunset
- solar declination follows the configured axial tilt
- orbital eccentricity slightly adjusts solar intensity
- moon phase is a placeholder labeled `unmodeled`

This is deliberate. First Dawn needs stable laws before it needs rich physics.

## Future Climate and Weather

Climate, weather, oceans, ecology, and any future life systems should consume Time Engine and Astronomy Engine state rather than recalculating their own calendars or sun positions.

Expected future consumers:

- climate can use season, solar declination, daylight factor, and solar intensity
- weather can use day phase, season, and solar intensity once weather exists
- ocean and geology systems can use long-term elapsed days and years
- life systems, when allowed, can use day/night and seasonal state without owning time

The scheduler stays the heartbeat. The Time Engine stays the calendar. The Astronomy Engine stays the sky.