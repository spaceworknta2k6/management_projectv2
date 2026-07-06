require('../config/env').loadEnv();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const AppealRequest = require('../models/AppealRequest');
const prisma = require('../config/prisma');

async function main() {
  await connectDB();

  const appeals = await AppealRequest.find({}).setOptions({ includeDeleted: true }).lean();

  let count = 0;
  for (const appeal of appeals) {
    const id = appeal._id.toString();
    const data = {
      id,
      mongoId: id,
      projectId: appeal.projectId.toString(),
      studentId: appeal.studentId.toString(),
      periodId: appeal.periodId.toString(),
      finalGradeId: appeal.finalGradeId.toString(),
      reason: appeal.reason,
      status: appeal.status || 'pending',
      feePaidAt: appeal.feePaidAt ? new Date(appeal.feePaidAt) : null,
      recheckGraderId: appeal.recheckGraderId ? appeal.recheckGraderId.toString() : null,
      recheckScoreSheetId: appeal.recheckScoreSheetId ? appeal.recheckScoreSheetId.toString() : null,
      adminNote: appeal.adminNote || null,
      resolvedAt: appeal.resolvedAt ? new Date(appeal.resolvedAt) : null,
      isDeleted: appeal.isDeleted || false,
      deletedAt: appeal.deletedAt ? new Date(appeal.deletedAt) : null,
      deletedBy: appeal.deletedBy ? appeal.deletedBy.toString() : null,
      createdAt: appeal.createdAt ? new Date(appeal.createdAt) : new Date(),
      updatedAt: appeal.updatedAt ? new Date(appeal.updatedAt) : new Date(),
    };

    await prisma.appealRequest.upsert({
      where: { mongoId: id },
      create: data,
      update: {
        ...data,
        id: undefined,
        mongoId: undefined,
        createdAt: undefined,
      },
    });
    count++;
  }

  console.log(`Appeals migrated to PostgreSQL: ${count}`);
}

main()
  .catch((err) => {
    console.error('Appeals migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
