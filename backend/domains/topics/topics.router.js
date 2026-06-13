const express = require('express');
const router = express.Router();

const topicsController = require('./topics.controller');
const topicsValidator = require('./topics.validator');
const topicChangeRequestsController = require('../topic-change-requests/topic-change-requests.controller');
const topicChangeRequestsValidator = require('../topic-change-requests/topic-change-requests.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

// Apply protection globally
router.use(protect);

// Student/authenticated endpoints
router.post('/', topicsValidator.validateTopicPropose, topicsController.proposeTopic);
router.put('/:id', topicsValidator.validateTopicUpdate, topicsController.updateTopic);
router.get('/', topicsController.getTopics);
router.get('/:id', topicsController.getTopicById);
router.post('/:id/change-requests', topicChangeRequestsValidator.validateCreate, topicChangeRequestsController.createChangeRequest);
router.get('/:id/change-requests', topicChangeRequestsController.getTopicRequests);

// Staff restricted administrative actions
router.use(requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']));
router.post('/:id/approve', topicsController.approveTopic);
router.post('/:id/reject', topicsController.rejectTopic);
router.post('/:id/request-revision', topicsController.requestRevision);
router.post('/:id/assign-supervisor', topicsController.assignSupervisor);
router.post('/:id/cancel', topicsController.cancelTopic);

module.exports = router;
