require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const Notification = require('../models/Notification');

const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);

const migrateNotifications = async () => {
  const notifications = await Notification.find({}, null, { includeDeleted: true }).lean();

  for (const notification of notifications) {
    const id = toId(notification._id);

    await prisma.notification.upsert({
      where: { mongoId: id },
      create: {
        id,
        mongoId: id,
        recipientId: toId(notification.recipientId),
        type: notification.type,
        title: notification.title,
        body: notification.body,
        entityType: notification.entityType || null,
        entityId: toId(notification.entityId),
        actionUrl: notification.actionUrl || null,
        deadlineAt: toDate(notification.deadlineAt),
        readAt: toDate(notification.readAt),
        isDeleted: Boolean(notification.isDeleted),
        deletedAt: toDate(notification.deletedAt),
        deletedBy: toId(notification.deletedBy),
        createdAt: toDate(notification.createdAt) || new Date(),
      },
      update: {
        recipientId: toId(notification.recipientId),
        type: notification.type,
        title: notification.title,
        body: notification.body,
        entityType: notification.entityType || null,
        entityId: toId(notification.entityId),
        actionUrl: notification.actionUrl || null,
        deadlineAt: toDate(notification.deadlineAt),
        readAt: toDate(notification.readAt),
        isDeleted: Boolean(notification.isDeleted),
        deletedAt: toDate(notification.deletedAt),
        deletedBy: toId(notification.deletedBy),
      },
    });
  }

  return notifications.length;
};

const main = async () => {
  await connectDB();
  const count = await migrateNotifications();
  console.log('Notifications migrated to PostgreSQL.');
  console.log(`Notifications: ${count}`);
};

main()
  .catch((error) => {
    console.error('Notifications migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
