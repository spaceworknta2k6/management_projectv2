-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'FACULTY_STAFF', 'LECTURER', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'locked');

-- CreateEnum
CREATE TYPE "AcademicDegree" AS ENUM ('bachelor', 'master', 'phd', 'professor', 'associate_professor');

-- CreateEnum
CREATE TYPE "LecturerStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "roles" "UserRole"[] DEFAULT ARRAY['STUDENT']::"UserRole"[],
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "phone_number" TEXT NOT NULL DEFAULT '',
    "cohort" TEXT NOT NULL DEFAULT '',
    "avatar_url" TEXT NOT NULL DEFAULT '',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "user_id" TEXT NOT NULL,
    "student_code" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "cohort" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecturers" (
    "id" TEXT NOT NULL,
    "mongo_id" TEXT,
    "user_id" TEXT NOT NULL,
    "lecturer_code" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "academic_degree" "AcademicDegree" NOT NULL DEFAULT 'master',
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_projects" INTEGER NOT NULL DEFAULT 5,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "organization" TEXT NOT NULL DEFAULT 'PHENIKAA',
    "status" "LecturerStatus" NOT NULL DEFAULT 'active',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_login_sessions" (
    "code" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_login_sessions_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mongo_id_key" ON "users"("mongo_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_is_deleted_key" ON "users"("email", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "students_mongo_id_key" ON "students"("mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_student_code_key" ON "students"("student_code");

-- CreateIndex
CREATE UNIQUE INDEX "lecturers_mongo_id_key" ON "lecturers"("mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecturers_user_id_key" ON "lecturers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecturers_lecturer_code_key" ON "lecturers"("lecturer_code");

-- CreateIndex
CREATE INDEX "google_login_sessions_expires_at_idx" ON "google_login_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturers" ADD CONSTRAINT "lecturers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
