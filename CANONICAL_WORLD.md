# Canonical World

First Dawn has one official default planet: `FIRST_DAWN_CANONICAL_WORLD`.

## Canonical Seed

The immutable seed is:

```text
FIRST_DAWN_CANONICAL_WORLD_V1_2026_06_27
```

Development, sandbox, staging, and production must generate the same default planet from this seed. Environment variables, authentication, deployment settings, logging, and debugging tools are not part of world generation.

Custom worlds may provide an explicit custom seed, but ordinary default world creation falls back to the canonical seed.

## Fingerprint Generation

The world fingerprint is a SHA-256 hash over deterministic planet data, including:

- planet seed
- grid dimensions
- axial tilt and orbital parameters
- ocean and land percentages
- average and highest elevation
- largest continent and ocean estimates
- climate distribution
- terrain distribution
- hydrology summary
- atmosphere summary
- weather summary

The fingerprint intentionally excludes environment name, world display name, status, auth, database URL, logging, and deployment configuration.

## Environment Verification

A canonical environment match compares each generated world fingerprint to the canonical fingerprint. If an environment world differs, the UI reports a world mismatch and displays expected and actual hash prefixes instead of silently accepting divergence.

Seeded sandbox, staging, and production rows use separate slugs because database slugs are unique, but they share the same canonical seed and planet parameters.

## Terrain Validation

Terrain generation is deterministic. Attempt 0 uses the world seed directly. If generated terrain violates canonical validation, the engine rejects it and advances to the next derived terrain seed:

```text
<world-seed>:terrain-validation:<attempt>
```

The same world seed will therefore always converge on the same accepted terrain.

Validation targets:

- ocean: 60-75 percent
- land: 25-40 percent
- polar land: less than 15 percent of total land
- temperate plus subtropical land: more than 60 percent of total land
- largest continent: meaningful, but not a single dominant supercontinent
- largest ocean: connected enough to avoid excessive fragmentation

## Habitable Land Normalization

Continental centers now prefer roughly 20-50 degrees north and south. The terrain engine still permits polar islands, arctic archipelagos, antarctic land, and high-latitude mountains, but major continental formation is biased toward temperate and subtropical latitudes.

## Future Official Worlds

Future support for multiple official worlds should add a versioned registry rather than changing this seed in place. Existing canonical seeds should remain immutable so historical simulations, tests, and saved worlds stay reproducible.