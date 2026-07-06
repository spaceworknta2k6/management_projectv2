-- CreateTable
CREATE TABLE "extension_requests" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "student_id" TEXT,
    "group_id" TEXT,
    "reason" TEXT NOT NULL,
    "evidence_file_ids" JSONB NOT NULL DEFAULT '[]',
    "requested_to" TIMESTAMP(3) NOT NULL,
    "supervisor_approval" JSONB NOT NULL DEFAULT '{}',
    "faculty_decision" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_requests_mongo_id_key" ON "extension_requests"("mongo_id");

-- CreateIndex
CREATE INDEX "extension_requests_project_id_idx" ON "extension_requests"("project_id");

-- CreateIndex
CREATE INDEX "extension_requests_target_type_target_id_idx" ON "extension_requests"("target_type", "target_id");
