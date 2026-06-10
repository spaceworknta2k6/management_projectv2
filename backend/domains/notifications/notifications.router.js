const express = require('express');
const router = express.Router();

const notificationsController = require('./notifications.controller');
const notificationsValidator = require('./notifications.validator');
const { protect } = require('../../middlewares/auth.middleware');

router.use(protect);

router.get('/', notificationsController.getNotifications);
router.post('/:id/read', notificationsValidator.validateNotificationId, notificationsController.markAsRead);
router.post('/read-all', notificationsController.markAllAsRead);
router.delete('/:id', notificationsValidator.validateNotificationId, notificationsController.deleteNotification);

module.exports = router;
