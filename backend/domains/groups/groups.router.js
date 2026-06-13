const express = require('express');
const router = express.Router();

const groupsController = require('./groups.controller');
const groupsValidator = require('./groups.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

// Apply protection globally for all group operations
router.use(protect);

router.post('/', groupsValidator.validateGroupCreate, groupsController.createGroup);
router.get('/', groupsController.getGroups);
router.get('/:id', groupsController.getGroupById);
router.patch('/:id', groupsValidator.validateGroupUpdate, groupsController.updateGroup);
router.delete('/:id', groupsController.deleteGroup);
router.post(
  '/:id/cancel-linked-and-delete',
  requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']),
  groupsController.cancelLinkedWorkAndDeleteGroup
);

router.post('/:id/invite', groupsValidator.validateInviteMember, groupsController.inviteMember);
router.post('/:id/accept', groupsController.acceptInvitation);
router.post('/:id/confirm', groupsController.confirmGroup);

module.exports = router;
