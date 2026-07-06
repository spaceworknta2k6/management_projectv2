const { randomBytes } = require('crypto');
const prisma = require('../../config/prisma');

const newObjectId = () => randomBytes(12).toString('hex');

const toPublicNotification = (notification) => {
  if (!notification) return null;
  return {
    ...notification,
    _id: notification.id,
  };
};

const createNotification = async (data) => {
  const {
    recipientId,
    type,
    title,
    body,
    entityType,
    entityId,
    actionUrl,
    deadlineAt,
  } = data;

  const id = newObjectId();
  const notification = await prisma.notification.create({
    data: {
      id,
      mongoId: id,
      recipientId: recipientId.toString(),
      type,
      title,
      body,
      entityType: entityType || null,
      entityId: entityId ? entityId.toString() : null,
      actionUrl: actionUrl || null,
      deadlineAt: deadlineAt ? new Date(deadlineAt) : null,
    },
  });

  const publicNotification = toPublicNotification(notification);

  try {
    const socketIoHolder = require('../../config/socket-io-holder');
    const io = socketIoHolder.getIo();
    if (io) {
      io.to(`user:${recipientId}`).emit('notification:new', publicNotification);
    }
  } catch (error) {
    console.error('Lỗi khi phát sự kiện socket thông báo:', error.message);
  }

  return publicNotification;
};

const getNotifications = async (recipientId) => {
  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: recipientId.toString(),
      isDeleted: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return notifications.map(toPublicNotification);
};

const findOwnedNotification = async (id, recipientId) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });

  if (!notification) {
    throw { status: 404, message: 'Thông báo không tồn tại.' };
  }

  if (notification.recipientId !== recipientId.toString()) {
    throw { status: 403, message: 'Quyền truy cập bị từ chối: Bạn không sở hữu thông báo này.' };
  }

  return notification;
};

const markAsRead = async (id, recipientId) => {
  await findOwnedNotification(id, recipientId);

  const notification = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return toPublicNotification(notification);
};

const markAllAsRead = async (recipientId) => {
  await prisma.notification.updateMany({
    where: {
      recipientId: recipientId.toString(),
      isDeleted: false,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return { success: true, message: 'Đã đánh dấu đọc toàn bộ thông báo.' };
};

const deleteNotification = async (id, recipientId) => {
  await findOwnedNotification(id, recipientId);

  const notification = await prisma.notification.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: recipientId.toString(),
    },
  });

  return toPublicNotification(notification);
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
