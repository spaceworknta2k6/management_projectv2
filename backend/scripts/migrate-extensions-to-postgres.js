require('../config/env').loadEnv();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const ExtensionRequest = require('../models/ExtensionRequest');
const prisma = require('../config/prisma');

const toId = (v) => (v ? v.toString() : null);
const toDate = (v) => (v ? new Date(v) : null);
const toPlain = (v) => {
  if (!v) return {};
  if (typeof v.toObject === 'function') return v.toObject();
  return JSON.parse(JSON.stringify(v));
};

const main = async () => {
  await connectDB();

  const requests = await ExtensionRequest.find({}).lean();

  let count = 0;
  for (const r of requests) {
    const id = toId(r._id);

    const supervisorApproval = toPlain(r.supervisorApproval) || {};
    if (supervisorApproval.by) supervisorApproval.by = toId(supervisorApproval.by);
    if (supervisorApproval.at) supervisorApproval.at = toDate(supervisorApproval.at);

    const facultyDecision = toPlain(r.facultyDecision) || {};
    if (facultyDecision.by) facultyDecision.by = toId(facultyDecision.by);
    if (facultyDecision.at) facultyDecision.at = toDate(facultyDecision.at);

    const data = {
      id,
      mongoId: id,
      targetType: r.targetType,
      targetId: toId(r.targetId),
      projectId: toId(r.projectId),
      ownerType: r.ownerType || null,
      ownerId: toId(r.ownerId),
      studentId: toId(r.studentId),
      groupId: toId(r.groupId),
      reason: r.reason,
      evidenceFileIds: (r.evidenceFileIds || []).map(toId),
      requestedTo: toDate(r.requestedTo),
      supervisorApproval,
      facultyDecision,
      status: r.status || 'pending',
      cancelledAt: toDate(r.cancelledAt),
      cancelledBy: toId(r.cancelledBy),
      createdAt: toDate(r.createdAt) || new Date(),
      updatedAt: toDate(r.updatedAt) || new Date(),
    };

    await prisma.extensionRequest.upsert({
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

  console.log(`Extensions migrated to PostgreSQL: ${count}`);
};

main()
  .catch((err) => {
    console.error('Extensions migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
