-- CreateTable
CREATE TABLE "project_topics" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "period_id" TEXT NOT NULL,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "student_id" TEXT,
    "group_id" TEXT,
    "proposed_by_student_id" TEXT,
    "created_by_role" TEXT NOT NULL DEFAULT 'student',
    "created_by_user_id" TEXT,
    "proposed_by_lecturer_id" TEXT,
    "approved_by_lecturer_id" TEXT,
    "capacity_max_students" INTEGER NOT NULL DEFAULT 1,
    "capacity_max_groups" INTEGER NOT NULL DEFAULT 1,
    "current_student_count" INTEGER NOT NULL DEFAULT 0,
    "current_group_count" INTEGER NOT NULL DEFAULT 0,
    "allowed_owner_types" TEXT[] DEFAULT ARRAY['student', 'group']::TEXT[],
    "allow_individual" BOOLEAN,
    "allow_group" BOOLEAN,
    "min_group_size" INTEGER,
    "max_group_size" INTEGER,
    "published_by_staff_id" TEXT,
    "published_at" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expected_result" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "academic_unit" TEXT NOT NULL DEFAULT 'computer_science',
    "topic_domain" TEXT NOT NULL DEFAULT 'software_development',
    "supervisor_id" TEXT,
    "proposed_supervisor_id" TEXT,
    "department_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rejection_reason" TEXT,
    "ai_duplicate_risk" JSONB NOT NULL DEFAULT '{"checked":false,"maxSimilarityScore":0,"riskLevel":"low"}',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "period_id" TEXT NOT NULL,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "student_id" TEXT,
    "group_id" TEXT,
    "topic_id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "extended_until" TIMESTAMP(3),
    "final_grade_id" TEXT,
    "locked_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_topics_mongo_id_key" ON "project_topics"("mongo_id");

-- CreateIndex
CREATE INDEX "project_topics_period_id_status_idx" ON "project_topics"("period_id", "status");

-- CreateIndex
CREATE INDEX "project_topics_period_id_is_deleted_idx" ON "project_topics"("period_id", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "projects_mongo_id_key" ON "projects"("mongo_id");

-- CreateIndex
CREATE INDEX "projects_period_id_status_idx" ON "projects"("period_id", "status");

-- CreateIndex
CREATE INDEX "projects_period_id_is_deleted_idx" ON "projects"("period_id", "is_deleted");
