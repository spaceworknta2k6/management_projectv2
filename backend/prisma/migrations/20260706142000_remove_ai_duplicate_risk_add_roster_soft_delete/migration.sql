-- Migration: remove_ai_duplicate_risk_add_roster_soft_delete
-- Generated: 2026-07-06

-- AlterTable: Add soft delete fields to project_rosters
ALTER TABLE "project_rosters" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by" TEXT,
ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Remove AI field from project_topics
ALTER TABLE "project_topics" DROP COLUMN "ai_duplicate_risk";

-- CreateIndex
CREATE INDEX "project_rosters_period_id_is_deleted_idx" ON "project_rosters"("period_id", "is_deleted");
