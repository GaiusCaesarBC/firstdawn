-- CreateTable
CREATE TABLE "SimulationTick" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "tick" BIGINT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "systemCount" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "SimulationTick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationTick_worldId_idx" ON "SimulationTick"("worldId");

-- CreateIndex
CREATE INDEX "SimulationTick_worldId_tick_idx" ON "SimulationTick"("worldId", "tick");

-- CreateIndex
CREATE INDEX "SimulationTick_startedAt_idx" ON "SimulationTick"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationTick_worldId_tick_key" ON "SimulationTick"("worldId", "tick");

-- AddForeignKey
ALTER TABLE "SimulationTick" ADD CONSTRAINT "SimulationTick_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
