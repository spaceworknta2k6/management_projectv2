const notificationsService = require('./notifications.service');

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await notificationsService.getNotifications(req.user._id);
    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationsService.markAsRead(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu thông báo là đã đọc.',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationsService.markAllAsRead(req.user._id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    await notificationsService.deleteNotification(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Đã xóa thông báo.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
