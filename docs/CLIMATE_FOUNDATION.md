# Climate Foundation

The climate foundation is intentionally passive. It computes deterministic background conditions for each latitude band and grid cell without simulating moving weather, hydrology, terrain, or life.

## Why climate is passive

This milestone establishes stable environmental inputs first:

- solar energy
- daylight duration
- average temperature
- seasonal modifier
- thermal climate band

These values describe long-term equilibrium conditions, not day-to-day weather. That keeps the model deterministic, cheap to validate, and safe to reuse across future systems.

## Why there is no weather yet

Weather requires short-timescale fluid dynamics and moisture transport:

- wind
- clouds
- rain
- storms
- fronts

Those systems depend on baseline climate values already existing. Adding them now would mix transient behavior with foundational inputs and make the simulation harder to verify.

## How future weather will consume these values

Later weather systems can treat the climate engine as a fixed boundary layer. For each grid cell they will be able to read:

- latitude and hemisphere
- seasonal context
- normalized solar energy
- daylight hours
- equilibrium average temperature
- thermal climate band

Weather can then derive local anomalies relative to that baseline instead of inventing temperatures from scratch every tick.

## Why deterministic inputs are required

The climate engine must return identical results for identical world state. That matters because:

- scheduler tests need stable expectations
- dashboard and debug views must match the same world tick
- later systems need reproducible environmental dependencies
- saved worlds must replay without hidden randomness

For that reason the climate layer does not use `Math.random()` and does not store stochastic state.

## How life will later depend on these values

Life systems come after climate, not before.

- plants will use light and temperature envelopes
- animals will use habitat suitability and seasonal pressure
- humans and civilizations will use agricultural and settlement constraints

Those systems should consume the passive climate layer as input data, while remaining separate from terrain generation, weather, and ecosystem simulation.