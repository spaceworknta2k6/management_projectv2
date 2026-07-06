require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const SubmissionPackage = require('../models/SubmissionPackage');

const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);

const migrateSubmissions = async () => {
  const packages = await SubmissionPackage.find({}, null, { includeDeleted: true }).lean();

  for (const pkg of packages) {
    const id = toId(pkg._id);

    const items = Array.isArray(pkg.items)
      ? pkg.items.map((item) => ({
          type: item.type,
          fileId: toId(item.fileId),
          required: Boolean(item.required),
          status: item.status || 'missing',
        }))
      : [];

    const data = {
      id,
      mongoId: id,
      ownerType: pkg.ownerType,
      ownerId: toId(pkg.ownerId),
      groupId: toId(pkg.groupId),
      studentId: toId(pkg.studentId),
      projectOwnerType: pkg.projectOwnerType || null,
      projectOwnerId: toId(pkg.projectOwnerId),
      periodId: toId(pkg.periodId),
      phase: pkg.phase,
      deadline: toDate(pkg.deadline),
      status: pkg.status || 'draft',
      items,
      submittedBy: toId(pkg.submittedBy),
      submittedAt: toDate(pkg.submittedAt),
      reviewedBy: toId(pkg.reviewedBy),
      reviewedAt: toDate(pkg.reviewedAt),
      reviewNotes: pkg.reviewNotes || null,
      lockedAt: toDate(pkg.lockedAt),
      isDeleted: Boolean(pkg.isDeleted),
      deletedAt: toDate(pkg.deletedAt),
      deletedBy: toId(pkg.deletedBy),
      createdAt: toDate(pkg.createdAt) || new Date(),
      updatedAt: toDate(pkg.updatedAt) || new Date(),
    };

    await prisma.submissionPackage.upsert({
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

  return packages.length;
};

const main = async () => {
  await connectDB();
  const count = await migrateSubmissions();
  console.log('SubmissionPackages migrated to PostgreSQL.');
  console.log(`SubmissionPackages: ${count}`);
};

main()
  .catch((error) => {
    console.error('SubmissionPackages migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
