const Notification = require('../../models/Notification');

const createNotification = async (data) => {
  const { recipientId, type, title, body, entityType, entityId, actionUrl, deadlineAt } = data;

  const notification = new Notification({
    recipientId,
    type,
    title,
    body,
    entityType,
    entityId,
    actionUrl,
    deadlineAt,
  });

  const savedNotification = await notification.save();

  try {
    const socketIoHolder = require('../../config/socket-io-holder');
    const io = socketIoHolder.getIo();
    if (io) {
      io.to(`user:${recipientId}`).emit('notification:new', savedNotification);
    }
  } catch (error) {
    console.error('Lỗi khi phát sự kiện socket thông báo:', error.message);
  }

  return savedNotification;
};

const getNotifications = async (recipientId) => {
  return await Notification.find({ recipientId, isDeleted: false }).sort({ createdAt: -1 });
};

const markAsRead = async (id, recipientId) => {
  const notification = await Notification.findOne({ _id: id, isDeleted: false });
  if (!notification) {
    throw { status: 404, message: 'Thông báo không tồn tại.' };
  }

  if (notification.recipientId.toString() !== recipientId.toString()) {
    throw { status: 403, message: 'Quyền truy cập bị từ chối: Bạn không sở hữu thông báo này.' };
  }

  notification.readAt = new Date();
  return await notification.save();
};

const markAllAsRead = async (recipientId) => {
  await Notification.updateMany(
    { recipientId, isDeleted: false, readAt: { $exists: false } },
    { $set: { readAt: new Date() } }
  );
  // Also handle null case if any
  await Notification.updateMany(
    { recipientId, isDeleted: false, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return { success: true, message: 'Đã đánh dấu đọc toàn bộ thông báo.' };
};

const deleteNotification = async (id, recipientId) => {
  const notification = await Notification.findOne({ _id: id, isDeleted: false });
  if (!notification) {
    throw { status: 404, message: 'Thông báo không tồn tại.' };
  }

  if (notification.recipientId.toString() !== recipientId.toString()) {
    throw { status: 403, message: 'Quyền truy cập bị từ chối: Bạn không sở hữu thông báo này.' };
  }

  notification.isDeleted = true;
  notification.deletedAt = new Date();
  notification.deletedBy = recipientId;
  return await notification.save();
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
