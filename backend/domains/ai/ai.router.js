const express = require('express');
const router = express.Router();

const aiController = require('./ai.controller');
const aiValidator = require('./ai.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');
const { aiLimiter } = require('../../config/rate-limit');

router.use(protect);

router.get('/jobs/:id', aiValidator.validateJobId, aiController.getJobById);
router.post('/jobs/:id/retry', requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF', 'LECTURER']), aiValidator.validateJobId, aiController.retryAiJob);
router.post('/jobs/:id/manual-override', requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF', 'LECTURER']), aiValidator.validateJobId, aiValidator.validateManualOverride, aiController.manualOverrideJob);

router.post('/topics/:id/check-duplicate', aiLimiter, requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateTopicId, aiController.checkDuplicateTopic);
router.post('/students/:id/topic-suggestions', aiLimiter, requireRole(['STUDENT', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateStudentId, aiController.suggestTopics);
router.post('/students/:id/topic-chat', aiLimiter, requireRole(['STUDENT', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateStudentId, aiController.chatTopicSuggestion);
router.post('/submissions/:id/report-feedback', aiLimiter, requireRole(['STUDENT', 'LECTURER', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateSubmissionId, aiController.analyzeReportFeedback);
router.post('/milestones/:milestoneId/files/:fileId/analyze', aiLimiter, requireRole(['STUDENT', 'LECTURER', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiController.analyzeMilestoneReport);

module.exports = router;
