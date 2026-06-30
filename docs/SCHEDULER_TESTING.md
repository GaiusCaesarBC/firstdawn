# Scheduler Testing

The simulation heartbeat is covered by a Vitest suite before any astronomy or time progression is added. The goal is to make scheduler behavior deterministic, guarded, and auditable while the systems are still placeholders.

## Commands

Run all tests:

```powershell
npm run test
```

Run the scheduler suite:

```powershell
npm run test:scheduler
```

Watch tests while editing:

```powershell
npm run test:watch
```

Run the production build:

```powershell
npm run build
```

Validate Prisma:

```powershell
npm run prisma:validate
```

## npm and npx shim fallback

On this Windows machine the global `npm` or `npx` shims may be broken. If that happens, call the local or direct binaries instead.

Direct npm CLI example:

```powershell
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run lint
```

Local Prisma binary example:

```powershell
.\node_modules\.bin\prisma validate
```

## Pure unit tests

`tests/scheduler/determinism.test.ts` does not require a database. It verifies that `createDeterministicRandom` returns the same sequence for the same world seed, tick, and system name, and different sequences when the tick or system changes.

The same file also scans `src/lib/simulation` for `Math.random()` so simulation systems stay deterministic.

## Database tests

`tests/scheduler/scheduler.test.ts` and `tests/scheduler/world-actions.test.ts` require `DATABASE_URL` to point at the local development database. The Vitest setup file loads `.env` from the project root so the tests use the same local Prisma connection as development commands.

These tests verify:

- paused, archived, production, and protected production worlds cannot advance
- invalid tick counts and counts above the configured maximum simulation years are rejected
- successful ticks increment `World.currentTick`
- each successful tick creates a `SimulationTick`
- `SimulationTick.systemCount` matches the registered system count
- systems execute in the intended pipeline order
- failed systems mark the tick failed and record clear metadata
- developer world actions work through `/api/worlds/actions`

## Test world isolation

Test worlds use slugs like:

```text
test-world-${Date.now()}-${randomSafeSuffix}
```

The suffix is created with cryptographic random bytes, not `Math.random()`. Helpers live in `tests/helpers/test-worlds.ts`:

- `createTestWorld`
- `cleanupTestWorld`
- `createActiveSandboxTestWorld`

Cleanup refuses to delete any slug that does not start with `test-world-`, so the real seeded worlds are not removed by accident. Cascading Prisma relations remove associated action logs and simulation ticks with the temporary world.

## Why determinism matters

Every simulation system receives a deterministic random generator seeded by world seed, tick, and system name. That makes a tick reproducible: if a future astronomy or time progression system behaves strangely, the same inputs should replay the same random sequence. This is the baseline for debugging, regression testing, and eventually comparing long-running simulation histories.

## Action route diagnosis

The original route handler lived at `/worlds/actions`, which is valid in the App Router but easy to confuse with a page-local form endpoint. Direct developer POST checks should use the API route:

```text
/api/worlds/actions
```

The `/worlds` page now posts to `/api/worlds/actions`. The old `/worlds/actions` route remains as a compatibility alias to the same handler.
