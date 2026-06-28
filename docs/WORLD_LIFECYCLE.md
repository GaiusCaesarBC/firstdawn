# World Lifecycle

## What a World is

A World is the root boundary for First Dawn simulation data. It is the unit of continuity, time, identity, migration, and operational safety. A world owns its tick clock, generation counter, seed value, environment, lifecycle status, and protection state.

The current `World` record is infrastructure only. It does not imply that people, animals, plants, events, memories, or relationships have been created.

## Why every simulation record requires worldId

Every future simulation record must belong to exactly one World through `worldId`. This keeps production, staging, sandbox, and experiment data separate at the database level and makes it possible to run migrations, audits, exports, snapshots, and rollbacks without mixing histories.

No simulation service should query people, memories, events, locations, animals, plants, or relationships without also scoping the query to a `worldId`. Cross-world queries should be reserved for admin tooling and migration workflows.

## World environments

`PRODUCTION` is the canonical long-lived world environment. Production worlds require stronger validation, must be protected before activation, and must never be reset, seeded over, or casually archived.

`STAGING` is for rehearsal. Schema migrations, lifecycle transitions, seed behavior, and operational workflows should be tested here before touching production.

`SANDBOX` is for local development and disposable exploration. Sandbox worlds can be active for developer use, but their data should never be treated as canonical history.

`EXPERIMENT` is for isolated branches of research or feature work. Experiment worlds may diverge from normal assumptions, but they still require `worldId` isolation and must not leak data into staging or production.

## Lifecycle statuses

`DRAFT` worlds exist but are not ready to run.

`ACTIVE` worlds are selected for live simulation work in their environment. By default, only one world per environment should be active at a time.

`PAUSED` worlds are valid and preserved, but simulation services should not advance them.

`ARCHIVED` worlds are retained for history or reference and must not be activated without an explicit lifecycle decision.

## Migration strategy

Migrations must be schema-first and world-aware. When a migration adds a new simulation table, that table must include `worldId`, a relation to `World`, and indexes that support world-scoped access.

Before running a production migration:

1. Validate the Prisma schema.
2. Apply the migration to a local sandbox database.
3. Apply the migration to staging.
4. Confirm staging lifecycle services and world overview pages still work.
5. Back up production.
6. Apply the production migration with a clear rollback plan.

Data migrations must never assume a single world unless the migration explicitly filters to a known world slug or id. If a migration backfills world-scoped data, it must document which world receives the data and why.


## Local validation without a database

Prisma schema validation can use a safe placeholder `DATABASE_URL`, such as `postgresql://first_dawn:first_dawn@localhost:5432/first_dawn?schema=public`, when no real database is available. That placeholder is only for validating and generating client code. Migrations and seed runs still require a real PostgreSQL database that the operator intends to modify.
## Seed data strategy

Seed scripts may create world records, but they must not create people, animals, plants, memories, events, relationships, or other simulation history until the project intentionally reaches that phase.

Seed scripts must be idempotent. Re-running a seed should not duplicate worlds and should not overwrite existing world records. Protected worlds are always skipped by seed scripts.

Production seed data should remain a placeholder until the production world is intentionally launched. Launch data must be reviewed as a migration or operational runbook, not slipped into a general seed script.

## Protected worlds

A protected world is guarded against destructive lifecycle operations. Protected worlds cannot be archived, deleted, reset, or overwritten. The lifecycle service enforces archive protection now, and future reset/delete tools must enforce the same rule before they are added.

Production worlds should be protected before activation. Unprotecting a production world should require explicit confirmation of the world slug and should be treated as an operational event.

## What must never happen to production

A production world must never be accidentally reset.

A production world must never be seeded over.

A production world must never receive sandbox, staging, or experiment data.

A production world must never be activated while unprotected.

A production world must never be used for shortcut simulations or destructive testing.

A production migration must never run without a backup and a rollback plan.

## Future plan

World branching should allow a new sandbox, staging, or experiment world to fork from an existing world at a known tick. The branch must receive its own world id and must never share mutable simulation records with the source world.

Snapshots should capture a world at a specific tick with enough metadata to verify schema version, seed value, migration state, and source world identity.

Rollback should prefer restoring a snapshot into a new protected world record rather than mutating history in place. If in-place rollback is ever required, it must be blocked for protected production worlds unless a dedicated emergency runbook explicitly overrides the protection layer.
