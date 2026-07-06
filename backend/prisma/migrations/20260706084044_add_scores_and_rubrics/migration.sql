-- CreateTable
CREATE TABLE "evaluation_rubrics" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "version" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_sheets" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "rubric_id" TEXT,
    "rubric_role" TEXT NOT NULL,
    "rubric_version" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "student_id" TEXT,
    "group_id" TEXT,
    "period_id" TEXT NOT NULL,
    "grader_id" TEXT NOT NULL,
    "grader_role" TEXT NOT NULL,
    "criteriaScores" JSONB NOT NULL DEFAULT '[]',
    "raw_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rounded_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comment" TEXT DEFAULT '',
    "consent_for_defense" BOOLEAN NOT NULL DEFAULT true,
    "locked_at" TIMESTAMP(3),
    "digital_signature" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_grades" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "project_id" TEXT NOT NULL,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "student_id" TEXT,
    "group_id" TEXT,
    "period_id" TEXT NOT NULL,
    "evaluation_mode" TEXT NOT NULL DEFAULT 'standard',
    "component_scores" JSONB NOT NULL,
    "final_score" DOUBLE PRECISION NOT NULL,
    "letter_grade" TEXT NOT NULL,
    "pass_status" TEXT NOT NULL DEFAULT 'pending',
    "variance_flags" JSONB NOT NULL DEFAULT '[]',
    "formula_version" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_rubrics_mongo_id_key" ON "evaluation_rubrics"("mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_sheets_mongo_id_key" ON "score_sheets"("mongo_id");

-- CreateIndex
CREATE INDEX "score_sheets_project_id_idx" ON "score_sheets"("project_id");

-- CreateIndex
CREATE INDEX "score_sheets_period_id_idx" ON "score_sheets"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_sheets_target_type_target_id_grader_id_key" ON "score_sheets"("target_type", "target_id", "grader_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_grades_mongo_id_key" ON "final_grades"("mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_grades_project_id_key" ON "final_grades"("project_id");

-- CreateIndex
CREATE INDEX "final_grades_period_id_idx" ON "final_grades"("period_id");
