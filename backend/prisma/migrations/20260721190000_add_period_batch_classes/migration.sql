ALTER TABLE "project_periods"
ADD COLUMN "batch_id" TEXT,
ADD COLUMN "cohort" TEXT,
ADD COLUMN "class_section" TEXT,
ADD COLUMN "class_code" TEXT,
ADD COLUMN "is_batch_child" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "project_periods_batch_id_is_deleted_idx" ON "project_periods"("batch_id", "is_deleted");
