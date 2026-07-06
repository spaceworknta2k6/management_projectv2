-- CreateTable
CREATE TABLE "project_periods" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "school_year" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "type" TEXT,
    "course_code" TEXT,
    "course_name" TEXT,
    "project_type" TEXT,
    "academic_unit" TEXT NOT NULL DEFAULT 'computer_science',
    "program_id" TEXT,
    "program_name" TEXT,
    "coordinator_lecturer_id" TEXT,
    "allow_individual" BOOLEAN NOT NULL DEFAULT true,
    "allow_group" BOOLEAN NOT NULL DEFAULT true,
    "group_min_size" INTEGER NOT NULL DEFAULT 2,
    "group_max_size" INTEGER NOT NULL DEFAULT 5,
    "registration_start" TIMESTAMP(3) NOT NULL,
    "registration_end" TIMESTAMP(3) NOT NULL,
    "project_start" TIMESTAMP(3) NOT NULL,
    "project_end" TIMESTAMP(3) NOT NULL,
    "revision_deadline" TIMESTAMP(3),
    "archive_deadline" TIMESTAMP(3),
    "final_submission_deadline" TIMESTAMP(3),
    "grading_start" TIMESTAMP(3),
    "grading_end" TIMESTAMP(3),
    "appeal_days_after_publish" INTEGER NOT NULL DEFAULT 7,
    "appeal_processing_days" INTEGER NOT NULL DEFAULT 7,
    "result_published_at" TIMESTAMP(3),
    "min_group_size" INTEGER NOT NULL DEFAULT 1,
    "max_group_size" INTEGER NOT NULL DEFAULT 3,
    "topic_change_deadline" TIMESTAMP(3) NOT NULL,
    "variance_threshold" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "pass_score" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "rubric_version" TEXT NOT NULL,
    "rubric_id" TEXT,
    "scoring_formula" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "locked_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_rosters" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "period_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_section" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "imported_by" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_periods_mongo_id_key" ON "project_periods"("mongo_id");

-- CreateIndex
CREATE INDEX "project_periods_status_is_deleted_idx" ON "project_periods"("status", "is_deleted");

-- CreateIndex
CREATE INDEX "project_periods_academic_unit_idx" ON "project_periods"("academic_unit");

-- CreateIndex
CREATE UNIQUE INDEX "project_rosters_mongo_id_key" ON "project_rosters"("mongo_id");

-- CreateIndex
CREATE INDEX "project_rosters_period_id_status_idx" ON "project_rosters"("period_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_rosters_period_id_student_id_key" ON "project_rosters"("period_id", "student_id");
