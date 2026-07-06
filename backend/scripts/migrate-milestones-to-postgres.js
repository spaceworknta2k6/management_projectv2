require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const Milestone = require('../models/Milestone');

const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);
const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const migrateMilestones = async () => {
  const milestones = await Milestone.find({}, null, { includeDeleted: true }).lean();

  for (const milestone of milestones) {
    const id = toId(milestone._id);

    const submissions = Array.isArray(milestone.submissions)
      ? milestone.submissions.map((sub) => ({
          submittedBy: toId(sub.submittedBy),
          fileIds: Array.isArray(sub.fileIds) ? sub.fileIds.map(toId) : [],
          note: sub.note || '',
          submittedAt: toDate(sub.submittedAt) || new Date(),
        }))
      : [];

    const feedback = Array.isArray(milestone.feedback)
      ? milestone.feedback.map((fb) => ({
          lecturerId: toId(fb.lecturerId),
          comment: fb.comment || '',
          status: fb.status,
          createdAt: toDate(fb.createdAt) || new Date(),
        }))
      : [];

    const data = {
      id,
      mongoId: id,
      projectId: toId(milestone.projectId),
      title: milestone.title,
      description: milestone.description || '',
      deadline: toDate(milestone.deadline),
      status: milestone.status || 'open',
      submissions,
      feedback,
      isDeleted: Boolean(milestone.isDeleted),
      deletedAt: toDate(milestone.deletedAt),
      deletedBy: toId(milestone.deletedBy),
      createdAt: toDate(milestone.createdAt) || new Date(),
      updatedAt: toDate(milestone.updatedAt) || new Date(),
    };

    await prisma.milestone.upsert({
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

  return milestones.length;
};

const main = async () => {
  await connectDB();
  const count = await migrateMilestones();
  console.log('Milestones migrated to PostgreSQL.');
  console.log(`Milestones: ${count}`);
};

main()
  .catch((error) => {
    console.error('Milestones migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
