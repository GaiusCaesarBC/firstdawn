ALTER TABLE "PlanetCell"
ADD COLUMN "averageFitness" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "adaptationDiversity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "averageMigrationInstinct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "averageDiseaseResistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "averageReproductiveEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "averageClimateAdaptation" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "highestAdaptedPopulation" JSONB NOT NULL DEFAULT 'null',
ADD COLUMN "lowestFitnessPopulation" JSONB NOT NULL DEFAULT 'null';

ALTER TABLE "AnimalPopulation"
ADD COLUMN "fitnessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "adaptationProfile" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "adaptationTrends" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "PlanetCell_planetId_averageFitness_idx" ON "PlanetCell"("planetId", "averageFitness");
CREATE INDEX "AnimalPopulation_speciesId_fitnessScore_idx" ON "AnimalPopulation"("speciesId", "fitnessScore");