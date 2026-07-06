require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const ProjectTopic = require('../models/ProjectTopic');
const Project = require('../models/Project');

const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);
const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const migrateTopics = async () => {
  const topics = await ProjectTopic.find({}, null, { includeDeleted: true }).lean();

  for (const topic of topics) {
    const id = toId(topic._id);

    const duplicateRisk = toPlainObject(topic.aiDuplicateRisk) || {};
    const aiDuplicateRisk = {
      checked: Boolean(duplicateRisk.checked),
      maxSimilarityScore: Number(duplicateRisk.maxSimilarityScore ?? 0),
      riskLevel: duplicateRisk.riskLevel || 'low',
    };
    if (duplicateRisk.aiJobId) {
      aiDuplicateRisk.aiJobId = toId(duplicateRisk.aiJobId);
    }

    const data = {
      id,
      mongoId: id,
      periodId: toId(topic.periodId),
      ownerType: topic.ownerType || null,
      ownerId: toId(topic.ownerId),
      studentId: toId(topic.studentId),
      groupId: toId(topic.groupId),
      proposedByStudentId: toId(topic.proposedByStudentId),
      createdByRole: topic.createdByRole || 'student',
      createdByUserId: toId(topic.createdByUserId),
      proposedByLecturerId: toId(topic.proposedByLecturerId),
      approvedByLecturerId: toId(topic.approvedByLecturerId),
      capacityMaxStudents: Number(topic.capacityMaxStudents ?? 1),
      capacityMaxGroups: Number(topic.capacityMaxGroups ?? 1),
      currentStudentCount: Number(topic.currentStudentCount ?? 0),
      currentGroupCount: Number(topic.currentGroupCount ?? 0),
      allowedOwnerTypes: topic.allowedOwnerTypes || ['student', 'group'],
      allowIndividual: topic.allowIndividual !== undefined ? Boolean(topic.allowIndividual) : null,
      allowGroup: topic.allowGroup !== undefined ? Boolean(topic.allowGroup) : null,
      minGroupSize: topic.minGroupSize !== undefined && topic.minGroupSize !== null ? Number(topic.minGroupSize) : null,
      maxGroupSize: topic.maxGroupSize !== undefined && topic.maxGroupSize !== null ? Number(topic.maxGroupSize) : null,
      publishedByStaffId: toId(topic.publishedByStaffId),
      publishedAt: toDate(topic.publishedAt),
      title: topic.title,
      summary: topic.summary,
      objectives: topic.objectives,
      scope: topic.scope,
      technologies: topic.technologies || [],
      expectedResult: topic.expectedResult,
      plan: topic.plan,
      keywords: topic.keywords || [],
      academicUnit: topic.academicUnit || 'computer_science',
      topicDomain: topic.topicDomain || 'software_development',
      supervisorId: toId(topic.supervisorId),
      proposedSupervisorId: toId(topic.proposedSupervisorId),
      departmentId: toId(topic.departmentId),
      status: topic.status || 'draft',
      rejectionReason: topic.rejectionReason || null,
      aiDuplicateRisk,
      approvedBy: toId(topic.approvedBy),
      approvedAt: toDate(topic.approvedAt),
      version: Number(topic.version ?? 1),
      isDeleted: Boolean(topic.isDeleted),
      deletedAt: toDate(topic.deletedAt),
      deletedBy: toId(topic.deletedBy),
      createdAt: toDate(topic.createdAt) || new Date(),
      updatedAt: toDate(topic.updatedAt) || new Date(),
    };

    await prisma.projectTopic.upsert({
      where: { mongoId: id },
      create: data,
      update: {
        ...data,
        id: undefined,
        mongoId: undefined,
        createdAt: undefined,
      },
    });
  }

  return topics.length;
};

const migrateProjects = async () => {
  const projects = await Project.find({}, null, { includeDeleted: true }).lean();

  for (const project of projects) {
    const id = toId(project._id);

    const data = {
      id,
      mongoId: id,
      periodId: toId(project.periodId),
      ownerType: project.ownerType || null,
      ownerId: toId(project.ownerId),
      studentId: toId(project.studentId),
      groupId: toId(project.groupId),
      topicId: toId(project.topicId),
      supervisorId: toId(project.supervisorId),
      reviewerId: toId(project.reviewerId),
      status: project.status || 'assigned',
      extendedUntil: toDate(project.extendedUntil),
      finalGradeId: toId(project.finalGradeId),
      lockedAt: toDate(project.lockedAt),
      version: Number(project.version ?? 1),
      isDeleted: Boolean(project.isDeleted),
      deletedAt: toDate(project.deletedAt),
      deletedBy: toId(project.deletedBy),
      createdAt: toDate(project.createdAt) || new Date(),
      updatedAt: toDate(project.updatedAt) || new Date(),
    };

    await prisma.project.upsert({
      where: { mongoId: id },
      create: data,
      update: {
        ...data,
        id: undefined,
        mongoId: undefined,
        createdAt: undefined,
      },
    });
  }

  return projects.length;
};

const main = async () => {
  await connectDB();
  const topicCount = await migrateTopics();
  const projectCount = await migrateProjects();
  console.log('ProjectTopics and Projects migrated to PostgreSQL.');
  console.log(`ProjectTopics: ${topicCount}`);
  console.log(`Projects: ${projectCount}`);
};

main()
  .catch((error) => {
    console.error('Topics/Projects migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
