-- CreateEnum
CREATE TYPE "WorldEnvironment" AS ENUM ('PRODUCTION', 'STAGING', 'SANDBOX', 'EXPERIMENT');

-- CreateEnum
CREATE TYPE "WorldStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PersonState" AS ENUM ('ALIVE', 'DEAD');

-- CreateEnum
CREATE TYPE "RelationshipKind" AS ENUM ('FAMILY', 'FRIENDSHIP', 'RIVALRY', 'PARTNERSHIP', 'COMMUNITY');

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "environment" "WorldEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "status" "WorldStatus" NOT NULL DEFAULT 'DRAFT',
    "currentTick" BIGINT NOT NULL DEFAULT 0,
    "timeScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "currentGeneration" INTEGER NOT NULL DEFAULT 0,
    "seed" TEXT,
    "description" TEXT,
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT,
    "state" "PersonState" NOT NULL DEFAULT 'ALIVE',
    "generation" INTEGER NOT NULL DEFAULT 0,
    "bornAtTick" BIGINT,
    "diedAtTick" BIGINT,
    "locationId" TEXT,
    "traits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "eventId" TEXT,
    "summary" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "formedAtTick" BIGINT NOT NULL,
    "lastRecalledAtTick" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "personId" TEXT,
    "locationId" TEXT,
    "tick" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "historicalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" "RelationshipKind" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAtTick" BIGINT,
    "endedAtTick" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT,
    "kind" TEXT NOT NULL,
    "parentId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "traits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "traits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "World_slug_key" ON "World"("slug");

-- CreateIndex
CREATE INDEX "World_environment_idx" ON "World"("environment");

-- CreateIndex
CREATE INDEX "World_status_idx" ON "World"("status");

-- CreateIndex
CREATE INDEX "World_environment_status_idx" ON "World"("environment", "status");

-- CreateIndex
CREATE INDEX "World_protected_idx" ON "World"("protected");

-- CreateIndex
CREATE INDEX "Person_worldId_idx" ON "Person"("worldId");

-- CreateIndex
CREATE INDEX "Person_worldId_state_idx" ON "Person"("worldId", "state");

-- CreateIndex
CREATE INDEX "Person_worldId_generation_idx" ON "Person"("worldId", "generation");

-- CreateIndex
CREATE INDEX "Memory_worldId_idx" ON "Memory"("worldId");

-- CreateIndex
CREATE INDEX "Memory_worldId_personId_idx" ON "Memory"("worldId", "personId");

-- CreateIndex
CREATE INDEX "Memory_worldId_eventId_idx" ON "Memory"("worldId", "eventId");

-- CreateIndex
CREATE INDEX "Event_worldId_idx" ON "Event"("worldId");

-- CreateIndex
CREATE INDEX "Event_worldId_tick_idx" ON "Event"("worldId", "tick");

-- CreateIndex
CREATE INDEX "Event_worldId_type_idx" ON "Event"("worldId", "type");

-- CreateIndex
CREATE INDEX "Relationship_worldId_idx" ON "Relationship"("worldId");

-- CreateIndex
CREATE INDEX "Relationship_worldId_fromId_idx" ON "Relationship"("worldId", "fromId");

-- CreateIndex
CREATE INDEX "Relationship_worldId_toId_idx" ON "Relationship"("worldId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_worldId_fromId_toId_kind_key" ON "Relationship"("worldId", "fromId", "toId", "kind");

-- CreateIndex
CREATE INDEX "Location_worldId_idx" ON "Location"("worldId");

-- CreateIndex
CREATE INDEX "Location_worldId_kind_idx" ON "Location"("worldId", "kind");

-- CreateIndex
CREATE INDEX "Location_worldId_parentId_idx" ON "Location"("worldId", "parentId");

-- CreateIndex
CREATE INDEX "Animal_worldId_idx" ON "Animal"("worldId");

-- CreateIndex
CREATE INDEX "Animal_worldId_species_idx" ON "Animal"("worldId", "species");

-- CreateIndex
CREATE INDEX "Animal_worldId_locationId_idx" ON "Animal"("worldId", "locationId");

-- CreateIndex
CREATE INDEX "Plant_worldId_idx" ON "Plant"("worldId");

-- CreateIndex
CREATE INDEX "Plant_worldId_species_idx" ON "Plant"("worldId", "species");

-- CreateIndex
CREATE INDEX "Plant_worldId_locationId_idx" ON "Plant"("worldId", "locationId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
