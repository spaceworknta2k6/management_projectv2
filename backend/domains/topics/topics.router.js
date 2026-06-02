const express = require('express');
const router = express.Router();

const topicsController = require('./topics.controller');
const topicsValidator = require('./topics.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

// Apply protection globally
router.use(protect);

// Student/authenticated endpoints
router.post('/', topicsValidator.validateTopicPropose, topicsController.proposeTopic);
router.get('/', topicsController.getTopics);
router.get('/:id', topicsController.getTopicById);

// Staff restricted administrative actions
router.use(requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF']));
router.post('/:id/approve', topicsController.approveTopic);
router.post('/:id/reject', topicsController.rejectTopic);
router.post('/:id/request-revision', topicsController.requestRevision);
router.post('/:id/assign-supervisor', topicsController.assignSupervisor);

module.exports = router;
