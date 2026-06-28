-- CreateTable
CREATE TABLE "Planet" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL,
    "gravityMS2" DOUBLE PRECISION NOT NULL,
    "massKg" DOUBLE PRECISION NOT NULL,
    "rotationPeriodHours" DOUBLE PRECISION NOT NULL,
    "orbitalPeriodDays" DOUBLE PRECISION NOT NULL,
    "axialTiltDegrees" DOUBLE PRECISION NOT NULL,
    "orbitalEccentricity" DOUBLE PRECISION NOT NULL,
    "atmospherePressureKPa" DOUBLE PRECISION NOT NULL,
    "atmosphereComposition" JSONB NOT NULL,
    "oceanCoveragePercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Planet_worldId_key" ON "Planet"("worldId");

-- AddForeignKey
ALTER TABLE "Planet" ADD CONSTRAINT "Planet_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
