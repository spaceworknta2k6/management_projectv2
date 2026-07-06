-- CreateTable
CREATE TABLE "project_groups" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "period_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT NOT NULL DEFAULT '',
    "leader_student_id" TEXT NOT NULL,
    "members" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_groups_mongo_id_key" ON "project_groups"("mongo_id");

-- CreateIndex
CREATE INDEX "project_groups_period_id_status_idx" ON "project_groups"("period_id", "status");

-- CreateIndex
CREATE INDEX "project_groups_period_id_is_deleted_idx" ON "project_groups"("period_id", "is_deleted");
