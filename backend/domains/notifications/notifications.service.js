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

  return await notification.save();
};

const getNotifications = async (recipientId) => {
  return await Notification.find({ recipientId }).sort({ createdAt: -1 });
};

const markAsRead = async (id, recipientId) => {
  const notification = await Notification.findById(id);
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
    { recipientId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } }
  );
  // Also handle null case if any
  await Notification.updateMany(
    { recipientId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return { success: true, message: 'Đã đánh dấu đọc toàn bộ thông báo.' };
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
};
