-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_client" TEXT NOT NULL,
    "mime_verified" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "scan_status" TEXT NOT NULL DEFAULT 'clean',
    "access_policy" TEXT NOT NULL DEFAULT 'private',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_mongo_id_key" ON "file_assets"("mongo_id");
