const express = require('express');
const router = express.Router();

const controller = require('./topic-change-requests.controller');
const validator = require('./topic-change-requests.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

router.use(protect);

router.get('/', controller.getRequests);
router.get('/:id', validator.validateIdParam, controller.getRequestById);
router.post('/:id/supervisor-approve', validator.validateIdParam, validator.validateReview, controller.supervisorApprove);
router.post('/:id/supervisor-reject', validator.validateIdParam, validator.validateReview, controller.supervisorReject);
router.post('/:id/faculty-approve', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']), validator.validateIdParam, validator.validateReview, controller.facultyApprove);
router.post('/:id/faculty-reject', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']), validator.validateIdParam, validator.validateReview, controller.facultyReject);
router.post('/:id/cancel', validator.validateIdParam, controller.cancelRequest);

module.exports = router;
