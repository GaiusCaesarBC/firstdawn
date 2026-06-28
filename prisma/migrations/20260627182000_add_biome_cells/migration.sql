CREATE TABLE "PlanetCell" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "biomeKey" TEXT NOT NULL,
    "biomeName" TEXT NOT NULL,
    "biomeCategory" TEXT NOT NULL,
    "habitabilityScore" DOUBLE PRECISION NOT NULL,
    "fertilityScore" DOUBLE PRECISION NOT NULL,
    "waterAvailability" DOUBLE PRECISION NOT NULL,
    "vegetationDensity" DOUBLE PRECISION NOT NULL,
    "biomeColor" TEXT NOT NULL,
    "biomeTags" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanetCell_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanetCell_planetId_cellId_key" ON "PlanetCell"("planetId", "cellId");
CREATE INDEX "PlanetCell_planetId_idx" ON "PlanetCell"("planetId");
CREATE INDEX "PlanetCell_planetId_biomeKey_idx" ON "PlanetCell"("planetId", "biomeKey");
CREATE INDEX "PlanetCell_planetId_biomeCategory_idx" ON "PlanetCell"("planetId", "biomeCategory");
CREATE INDEX "PlanetCell_row_column_idx" ON "PlanetCell"("row", "column");

ALTER TABLE "PlanetCell" ADD CONSTRAINT "PlanetCell_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;