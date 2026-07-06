require('../config/env').loadEnv();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const TopicChangeRequest = require('../models/TopicChangeRequest');
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

  const requests = await TopicChangeRequest.find({}).lean();

  let count = 0;
  for (const r of requests) {
    const id = toId(r._id);

    const supervisorApproval = toPlain(r.supervisorApproval) || {};
    if (supervisorApproval.by) supervisorApproval.by = toId(supervisorApproval.by);
    if (supervisorApproval.at) supervisorApproval.at = toDate(supervisorApproval.at);

    const facultyApproval = toPlain(r.facultyApproval) || {};
    if (facultyApproval.by) facultyApproval.by = toId(facultyApproval.by);
    if (facultyApproval.at) facultyApproval.at = toDate(facultyApproval.at);

    const data = {
      id,
      mongoId: id,
      topicId: toId(r.topicId),
      ownerType: r.ownerType || null,
      ownerId: toId(r.ownerId),
      studentId: toId(r.studentId),
      groupId: toId(r.groupId),
      oldTitle: r.oldTitle,
      newTitle: r.newTitle,
      newScope: r.newScope,
      newPlan: r.newPlan,
      reason: r.reason,
      supervisorApproval,
      facultyApproval,
      requestedAt: toDate(r.requestedAt) || toDate(r.createdAt) || new Date(),
      status: r.status || 'pending',
      cancelledAt: toDate(r.cancelledAt),
      cancelledBy: toId(r.cancelledBy),
      createdAt: toDate(r.createdAt) || new Date(),
      updatedAt: toDate(r.updatedAt) || new Date(),
    };

    await prisma.topicChangeRequest.upsert({
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

  console.log(`TopicChangeRequests migrated to PostgreSQL: ${count}`);
};

main()
  .catch((err) => {
    console.error('TopicChangeRequest migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
