-- Add failed-system count materialization for aggregate metrics.
ALTER TABLE "SimulationTick" ADD COLUMN "failedSystemCount" INTEGER NOT NULL DEFAULT 0;

-- Preserve historical failed-system totals where legacy metadata recorded them.
UPDATE "SimulationTick"
SET "failedSystemCount" = jsonb_array_length("metadata"->'failedSystems')
WHERE jsonb_typeof("metadata"->'failedSystems') = 'array';

-- Support metrics and failure-focused lookups by world and success status.
CREATE INDEX "SimulationTick_worldId_success_idx" ON "SimulationTick"("worldId", "success");

-- PostgreSQL partial index for the sparse failed-tick path.
CREATE INDEX "SimulationTick_worldId_failed_partial_idx"
ON "SimulationTick"("worldId")
WHERE "success" = false;