require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const ProjectGroup = require('../models/ProjectGroup');

const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);

const migrateGroups = async () => {
  const groups = await ProjectGroup.find({}, null, { includeDeleted: true }).lean();

  for (const group of groups) {
    const id = toId(group._id);

    const members = (group.members || []).map((m) => ({
      studentId: toId(m.studentId),
      role: m.role || 'MEMBER',
      contributionWeight: Number(m.contributionWeight ?? 1.0),
      status: m.status || 'invited',
    }));

    const data = {
      id,
      mongoId: id,
      periodId: toId(group.periodId),
      name: group.name,
      avatarUrl: group.avatarUrl || '',
      leaderStudentId: toId(group.leaderStudentId),
      members,
      status: group.status || 'draft',
      isDeleted: Boolean(group.isDeleted),
      deletedAt: toDate(group.deletedAt),
      deletedBy: toId(group.deletedBy),
      createdAt: toDate(group.createdAt) || new Date(),
      updatedAt: toDate(group.updatedAt) || new Date(),
    };

    await prisma.projectGroup.upsert({
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

  return groups.length;
};

const main = async () => {
  await connectDB();
  const groupCount = await migrateGroups();
  console.log('ProjectGroups migrated to PostgreSQL.');
  console.log(`ProjectGroups: ${groupCount}`);
};

main()
  .catch((error) => {
    console.error('Groups migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
