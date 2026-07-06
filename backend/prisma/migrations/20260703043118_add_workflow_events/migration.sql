-- CreateTable
CREATE TABLE "workflow_events" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_events_mongo_id_key" ON "workflow_events"("mongo_id");

-- CreateIndex
CREATE INDEX "workflow_events_entity_type_entity_id_created_at_idx" ON "workflow_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_events_created_at_idx" ON "workflow_events"("created_at");

-- CreateIndex
CREATE INDEX "workflow_events_entity_type_action_created_at_idx" ON "workflow_events"("entity_type", "action", "created_at");

-- CreateIndex
CREATE INDEX "workflow_events_actor_id_created_at_idx" ON "workflow_events"("actor_id", "created_at");
