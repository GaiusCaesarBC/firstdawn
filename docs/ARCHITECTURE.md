# FIRST DAWN ARCHITECTURE

First Dawn must be built as a simulation engine with a website attached to it.

The website is not the product.

The simulation is the product.

The website is the observatory.

Architecture layers:

Observer Website
API Layer
Simulation Engine
World Engine
Citizen Engine
Memory Engine
History Engine
Event Engine
Database

Core rule:

The observer layer can read the world, but the inhabitants can never perceive the observer layer.

Testing worlds must remain separate from production.

Every simulation record must belong to a worldId.

Initial stack:

* Next.js
* TypeScript
* Tailwind CSS
* Prisma
* PostgreSQL
* Modular simulation libraries

Future stack additions:

* Redis
* Queue system
* Dedicated simulation worker
* AI reasoning layer
* Backups
* Event replay
* Admin audit logging

Core modules to scaffold:

src/lib/simulation/time.ts
src/lib/simulation/world.ts
src/lib/simulation/types.ts

The initial homepage should be visually polished, but the simulation should remain minimal.
