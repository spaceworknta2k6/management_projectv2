const express = require('express');
const multer = require('multer');
const router = express.Router();

const chatController = require('./chat.controller');
const { protect } = require('../../middlewares/auth.middleware');

const groupAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const messageAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// Every chat API requires login; per-room membership checks happen in chat.service.js.
router.use(protect);

// Room list and direct/group room management.
router.get('/rooms', chatController.getRooms);
router.post('/direct-rooms', chatController.requestDirectRoom);
// Messages and read state.
router.get('/rooms/:roomId/messages', chatController.getMessages);
router.post('/rooms/:roomId/read', chatController.markRoomRead);
router.post('/rooms/:roomId/messages', chatController.sendMessage);
router.post('/rooms/:roomId/messages/attachments', messageAttachmentUpload.single('file'), chatController.sendAttachmentMessage);
router.delete('/rooms/:roomId/messages/:messageId', chatController.deleteMessage);
// Approval/settings flows for direct chat and group chat.
router.post('/rooms/:roomId/accept', chatController.acceptDirectRoom);
router.patch('/rooms/:roomId/group-settings', chatController.updateGroupSettings);
router.patch('/rooms/:roomId/group-avatar', groupAvatarUpload.single('avatar'), chatController.uploadGroupAvatar);
router.post('/rooms/:roomId/group-invites', chatController.inviteLecturerToGroup);
router.post('/rooms/:roomId/group-invites/accept', chatController.acceptGroupInvite);

module.exports = router;
