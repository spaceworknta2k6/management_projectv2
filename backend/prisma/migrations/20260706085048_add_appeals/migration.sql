-- CreateTable
CREATE TABLE "appeal_requests" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "project_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "final_grade_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fee_paid_at" TIMESTAMP(3),
    "recheck_grader_id" TEXT,
    "recheck_score_sheet_id" TEXT,
    "admin_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appeal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appeal_requests_mongo_id_key" ON "appeal_requests"("mongo_id");

-- CreateIndex
CREATE INDEX "appeal_requests_period_id_idx" ON "appeal_requests"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "appeal_requests_project_id_student_id_period_id_key" ON "appeal_requests"("project_id", "student_id", "period_id");
