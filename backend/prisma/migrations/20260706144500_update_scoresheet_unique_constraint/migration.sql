-- Migration: update_scoresheet_unique_constraint
-- Generated: 2026-07-06

-- DropIndex
DROP INDEX "score_sheets_target_type_target_id_grader_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "score_sheets_target_type_target_id_grader_id_rubric_role_key" ON "score_sheets"("target_type", "target_id", "grader_id", "rubric_role");
