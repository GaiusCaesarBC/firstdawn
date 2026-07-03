-- DropIndex
DROP INDEX "PlanetCell_planetId_averageFitness_idx";

-- CreateTable
CREATE TABLE "SimulationCheckpoint" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "tick" BIGINT NOT NULL,
    "state" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationCheckpoint_worldId_systemId_tick_idx" ON "SimulationCheckpoint"("worldId", "systemId", "tick");

-- CreateIndex
CREATE INDEX "SimulationCheckpoint_worldId_systemId_idx" ON "SimulationCheckpoint"("worldId", "systemId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationCheckpoint_worldId_systemId_tick_key" ON "SimulationCheckpoint"("worldId", "systemId", "tick");

-- AddForeignKey
ALTER TABLE "SimulationCheckpoint" ADD CONSTRAINT "SimulationCheckpoint_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
