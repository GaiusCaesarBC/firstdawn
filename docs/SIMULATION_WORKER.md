# Simulation Worker Architecture

First Dawn now treats the web app as an observatory and control panel, not the simulation engine.

```text
Simulation Worker -> Database -> API -> Browser Viewer
```

## Responsibilities

The simulation worker is the only process that should advance simulation time during normal operation.

It:

* loads the active non-production world from Prisma
* runs deterministic scheduler ticks server-side
* persists `SimulationTick` rows, emitted events, worker action logs, and health metadata
* persists the latest Atlas snapshot into `SimulationTick.metadata.atlasSnapshot`
* logs active world id, tick number, tick duration, snapshot duration, success, and failures
* stops safely on `SIGINT` or `SIGTERM` after the current tick finishes

The Next.js app should:

* read status from `/api/simulation/status`
* read latest persisted Atlas data from `/api/simulation/snapshot` or `/api/worlds/map`
* request controls through `/api/simulation/control`
* queue tick requests instead of running ticks inside API request handlers

## Local Windows Commands

Start the Next.js viewer/control panel:

```powershell
npm run dev
```

Start the headless simulation worker:

```powershell
npm run sim:worker
```

Run one deterministic worker pass for debugging:

```powershell
npm run sim:step
```

Useful worker environment variables:

```powershell
$env:FIRST_DAWN_SIM_WORKER_INTERVAL_MS = "1000"
$env:FIRST_DAWN_SIM_WORKER_MAX_TICKS = "10"
$env:FIRST_DAWN_SIM_WORKER_PERSIST_SNAPSHOTS = "1"
npm run sim:worker
```

## API Endpoints

```text
GET  /api/simulation/status?world=<id-or-slug>
GET  /api/simulation/snapshot?world=<id-or-slug>
POST /api/simulation/control
```

Control payloads:

```json
{ "world": "first-dawn-sandbox", "action": "pause" }
{ "world": "first-dawn-sandbox", "action": "resume" }
{ "world": "first-dawn-sandbox", "action": "request-step" }
```

Existing world run controls now create `SIMULATION_RUN_REQUESTED` action-log entries. The worker claims those requests and writes `SIMULATION_RUN_STARTED`, `SIMULATION_RUN_COMPLETED`, or `SIMULATION_RUN_FAILED`.

## Current Audit

Moved or corrected in this migration:

* `src/lib/worlds/world-action-route.ts` no longer runs `advanceTicksWithCheckpoints` inside the API lifecycle.
* `src/app/worlds/map/page.tsx` reads the latest persisted Atlas snapshot instead of building one during page render.
* `src/app/api/worlds/map/route.ts` reads persisted Atlas snapshots instead of building them during the request.
* `src/app/world/page.tsx` reads persisted public snapshots instead of building them during page render.
* `src/app/worlds/page.tsx` reads world rows, tick history, health summaries, metrics, and worker snapshots only. It no longer creates grids, synchronizes canonical worlds, or computes deterministic simulation summaries during server render.
* `src/app/worlds/animals/page.tsx`, `src/app/worlds/plants/page.tsx`, `src/app/worlds/biomes/page.tsx`, and `src/app/worlds/grid/page.tsx` render persisted Atlas snapshot data only. If no worker snapshot exists, they show a lightweight unavailable state instead of recomputing the world.
* `src/app/api/worlds/animals/route.ts`, `src/app/api/worlds/plants/route.ts`, and `src/app/api/worlds/biomes/route.ts` read summary data from `SimulationTick.metadata.atlasSnapshot` instead of generating ecology state inside the request lifecycle.
* `scripts/sim-worker.ts` is the standalone process entrypoint.

Current boundary rules:

* `src/lib/worlds/map-atlas.ts` remains the snapshot builder and belongs on the worker path for production viewing.
* Next.js pages and viewer APIs may read persisted snapshots, world lifecycle rows, tick metrics, action logs, and lightweight health/status rows.
* Next.js pages and viewer APIs must not call scheduler ticks, grid builders, deterministic cache builders, or ecology/terrain/weather generation functions during render or request handling.
* `src/app/worlds/map/planet-globe-renderer.tsx` may use browser animation frames for visual rendering only. It must not advance world state.
## Future Linux Deployment

The same worker entrypoint can later run under `systemd`, Docker, or PM2.

Example `systemd` shape:

```ini
[Unit]
Description=First Dawn Simulation Worker
After=network.target postgresql.service

[Service]
WorkingDirectory=/srv/first-dawn
Environment=NODE_ENV=production
Environment=FIRST_DAWN_SIM_WORKER_INTERVAL_MS=1000
ExecStart=/usr/bin/npm run sim:worker
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Docker/PM2 should use the same split:

```text
web:    npm run start
worker: npm run sim:worker
```

The database remains the handoff boundary between engine and viewer.
