# First Dawn

First Dawn is a long-term artificial civilization simulation and observer platform.

It is not a game. It is a living world designed so history can emerge from consistent laws rather than scripted outcomes.

The public home is intended to be [FirstDawn.life](https://firstdawn.life). The original internal codename was Eden; the public project name is First Dawn.

## Foundation

This repository currently contains the deterministic simulation foundation and observer surfaces:

* Next.js application shell
* TypeScript project structure
* Tailwind CSS styling
* Prisma schema prepared for PostgreSQL
* World lifecycle, scheduler, tick history, and health telemetry
* Deterministic planet, climate, terrain, hydrology, weather, resource, biome, plant, animal, and adaptation systems
* Human MVA foundation with agents, needs, emotions, memory, communication, teaching, and causal events
* Early family, settlement, storage, and public world observatory surfaces
* Project constitution, vision, roadmap, and architecture notes

The Human MVA is not yet the final persistent human database model. Long-term persistent human life, pregnancy/birth lifecycle, childhood, aging, death, survival loops, and full civilization systems remain future work.

## Core Rule

Every simulation record belongs to a `worldId`.

Production, staging, and sandbox worlds must remain isolated so test data can never contaminate the production world.

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Validate the Prisma schema:

```bash
npx prisma validate
```

Run the development server:

```bash
npm run dev
```

Run the headless simulation worker in a separate terminal:

```bash
npm run sim:worker
```

Run one deterministic worker pass for debugging:

```bash
npm run sim:step
```

## Scripts

```bash
npm run lint
npm run build
npm run prisma:validate
```

## Project Documents

* [CONSTITUTION.md](./CONSTITUTION.md)
* [VISION.md](./VISION.md)
* [ROADMAP.md](./ROADMAP.md)
* [FOUNDING.md](./FOUNDING.md)
* [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
* [docs/PERMANENT_ARCHITECTURE.md](./docs/PERMANENT_ARCHITECTURE.md)
* [docs/SIMULATION_WORKER.md](./docs/SIMULATION_WORKER.md)
* [docs/QUESTIONS.md](./docs/QUESTIONS.md)
* [docs/IDEAS.md](./docs/IDEAS.md)
