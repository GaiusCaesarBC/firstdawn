ALTER TABLE "PlanetCell"
ADD COLUMN "dominantSpeciesId" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "dominantSpeciesName" TEXT NOT NULL DEFAULT 'No Established Wildlife',
ADD COLUMN "animalSpeciesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalWildlifePopulation" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "averageAnimalHealth" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "averageHabitatSuitability" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "AnimalPopulation" (
  "id" TEXT NOT NULL,
  "planetCellId" TEXT NOT NULL,
  "speciesId" TEXT NOT NULL,
  "population" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "health" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "foodAvailability" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "migrationPressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "habitatSuitability" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "carryingCapacity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastUpdatedTick" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnimalPopulation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnimalPopulation_planetCellId_speciesId_key" ON "AnimalPopulation"("planetCellId", "speciesId");
CREATE INDEX "AnimalPopulation_speciesId_idx" ON "AnimalPopulation"("speciesId");
CREATE INDEX "AnimalPopulation_lastUpdatedTick_idx" ON "AnimalPopulation"("lastUpdatedTick");
CREATE INDEX "PlanetCell_planetId_dominantSpeciesId_idx" ON "PlanetCell"("planetId", "dominantSpeciesId");

ALTER TABLE "AnimalPopulation"
ADD CONSTRAINT "AnimalPopulation_planetCellId_fkey"
FOREIGN KEY ("planetCellId") REFERENCES "PlanetCell"("id") ON DELETE CASCADE ON UPDATE CASCADE;
