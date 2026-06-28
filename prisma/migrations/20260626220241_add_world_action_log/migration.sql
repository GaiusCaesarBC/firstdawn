-- CreateTable
CREATE TABLE "WorldActionLog" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'local-developer',
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorldActionLog_worldId_idx" ON "WorldActionLog"("worldId");

-- CreateIndex
CREATE INDEX "WorldActionLog_action_idx" ON "WorldActionLog"("action");

-- CreateIndex
CREATE INDEX "WorldActionLog_createdAt_idx" ON "WorldActionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "WorldActionLog" ADD CONSTRAINT "WorldActionLog_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
