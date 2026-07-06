-- CreateTable
CREATE TABLE "topic_change_requests" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "topic_id" TEXT NOT NULL,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "student_id" TEXT,
    "group_id" TEXT,
    "old_title" TEXT NOT NULL,
    "new_title" TEXT NOT NULL,
    "new_scope" TEXT NOT NULL,
    "new_plan" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "supervisor_approval" JSONB NOT NULL DEFAULT '{}',
    "faculty_approval" JSONB NOT NULL DEFAULT '{}',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topic_change_requests_mongo_id_key" ON "topic_change_requests"("mongo_id");

-- CreateIndex
CREATE INDEX "topic_change_requests_topic_id_idx" ON "topic_change_requests"("topic_id");
