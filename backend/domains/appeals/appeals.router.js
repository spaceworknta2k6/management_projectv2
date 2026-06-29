const express = require('express');
const router = express.Router();

const appealsController = require('./appeals.controller');
const appealsValidator = require('./appeals.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

router.use(protect);

// Sinh viên nộp đơn và xem đơn của mình
router.post('/', requireRole(['STUDENT']), appealsValidator.validateSubmitAppeal, appealsController.submitAppeal);
router.get('/my', requireRole(['STUDENT']), appealsController.getMyAppeals);
router.patch('/:id/cancel', appealsController.cancelAppeal);

// Giáo vụ / Admin quản lý
router.get('/', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']), appealsController.getAppeals);
router.patch('/:id/assign', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']), appealsValidator.validateAssignRecheck, appealsController.assignRecheck);
router.post('/:id/complete', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']), appealsController.completeAppeal);

// Chi tiết đơn (sinh viên xem đơn của mình, staff xem tất cả)
router.get('/:id', appealsController.getAppealById);

module.exports = router;
