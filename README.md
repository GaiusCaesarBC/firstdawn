# First Dawn

First Dawn is a long-term artificial civilization simulation and observer platform.

It is not a game. It is a living world designed so history can emerge from consistent laws rather than scripted outcomes.

The public home is intended to be [FirstDawn.life](https://firstdawn.life). The original internal codename was Eden; the public project name is First Dawn.

## Foundation

This repository currently establishes the foundation only:

* Next.js application shell
* TypeScript project structure
* Tailwind CSS styling
* Prisma schema prepared for PostgreSQL
* Foundational simulation modules
* Population adaptation foundation for deterministic wildlife fitness and long-term local adaptation
* Project constitution, vision, roadmap, and architecture notes

The first two people do not exist yet. No AI citizens have been created. No production simulation loop has been started.

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
* [docs/QUESTIONS.md](./docs/QUESTIONS.md)
* [docs/IDEAS.md](./docs/IDEAS.md)
