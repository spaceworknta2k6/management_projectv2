const express = require('express');
const router = express.Router();

const extensionsController = require('./extensions.controller');
const extensionsValidator = require('./extensions.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

// Apply protection globally
router.use(protect);

router.post('/', extensionsValidator.validateExtensionCreate, extensionsController.createExtensionRequest);
router.get('/', extensionsController.getRequests);
router.get('/:id', extensionsController.getRequestById);

// Supervisor review
router.post('/:id/supervisor-approve', extensionsValidator.validateSupervisorReview, extensionsController.supervisorRecommend);

// Faculty Staff final decision
router.post('/:id/faculty-approve', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']), extensionsValidator.validateFacultyDecision, extensionsController.facultyDecide);
router.post('/:id/cancel', extensionsController.cancelRequest);

module.exports = router;
