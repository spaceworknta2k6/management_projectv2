const express = require('express');
const multer = require('multer');
const router = express.Router();

const chatController = require('./chat.controller');
const { protect } = require('../../middlewares/auth.middleware');

const groupAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.use(protect);

router.get('/rooms', chatController.getRooms);
router.post('/direct-rooms', chatController.requestDirectRoom);
router.get('/rooms/:roomId/messages', chatController.getMessages);
router.post('/rooms/:roomId/messages', chatController.sendMessage);
router.post('/rooms/:roomId/accept', chatController.acceptDirectRoom);
router.patch('/rooms/:roomId/group-settings', chatController.updateGroupSettings);
router.patch('/rooms/:roomId/group-avatar', groupAvatarUpload.single('avatar'), chatController.uploadGroupAvatar);
router.post('/rooms/:roomId/group-invites', chatController.inviteLecturerToGroup);
router.post('/rooms/:roomId/group-invites/accept', chatController.acceptGroupInvite);

module.exports = router;
