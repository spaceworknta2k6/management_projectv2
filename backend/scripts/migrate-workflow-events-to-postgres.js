require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const WorkflowEvent = require('../models/WorkflowEvent');

const toId = (value) => (value ? value.toString() : null);

const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const migrateWorkflowEvents = async () => {
  const events = await WorkflowEvent.find({}).lean();

  for (const event of events) {
    const id = toId(event._id);

    await prisma.workflowEvent.upsert({
      where: { mongoId: id },
      create: {
        id,
        mongoId: id,
        entityType: event.entityType,
        entityId: toId(event.entityId),
        fromStatus: event.fromStatus || null,
        toStatus: event.toStatus,
        actorId: toId(event.actorId),
        actorRoles: event.actorRoles || [],
        action: event.action,
        reason: event.reason || null,
        metadata: toPlainObject(event.metadata),
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        createdAt: event.createdAt ? new Date(event.createdAt) : new Date(),
      },
      update: {
        entityType: event.entityType,
        entityId: toId(event.entityId),
        fromStatus: event.fromStatus || null,
        toStatus: event.toStatus,
        actorId: toId(event.actorId),
        actorRoles: event.actorRoles || [],
        action: event.action,
        reason: event.reason || null,
        metadata: toPlainObject(event.metadata),
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
      },
    });
  }

  return events.length;
};

const main = async () => {
  await connectDB();
  const count = await migrateWorkflowEvents();
  console.log('Workflow events migrated to PostgreSQL.');
  console.log(`WorkflowEvents: ${count}`);
};

main()
  .catch((error) => {
    console.error('Workflow event migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
