-- CreateTable
CREATE TABLE "submission_packages" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "group_id" TEXT,
    "student_id" TEXT,
    "project_owner_type" TEXT,
    "project_owner_id" TEXT,
    "period_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "items" JSONB NOT NULL DEFAULT '[]',
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "locked_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_packages_mongo_id_key" ON "submission_packages"("mongo_id");

-- CreateIndex
CREATE INDEX "submission_packages_owner_type_owner_id_phase_idx" ON "submission_packages"("owner_type", "owner_id", "phase");

-- CreateIndex
CREATE INDEX "submission_packages_period_id_idx" ON "submission_packages"("period_id");
