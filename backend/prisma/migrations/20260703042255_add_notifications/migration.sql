-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "recipient_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "action_url" TEXT,
    "deadline_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_mongo_id_key" ON "notifications"("mongo_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_is_deleted_read_at_created_at_idx" ON "notifications"("recipient_id", "is_deleted", "read_at", "created_at");
