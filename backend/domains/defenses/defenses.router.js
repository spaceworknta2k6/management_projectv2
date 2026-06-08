const express = require('express');
const router = express.Router();

const defensesController = require('./defenses.controller');
const defensesValidator = require('./defenses.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

const checkSecretaryOrStaff = async (req, res, next) => {
  const isStaff = req.user.roles && req.user.roles.some(r => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(r));
  if (isStaff) {
    return next();
  }
  
  try {
    const { id } = req.params;
    const DefenseSession = require('../../models/DefenseSession');
    const Committee = require('../../models/Committee');
    
    const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!session) return res.status(404).json({ success: false, message: 'Phiên bảo vệ không tồn tại.' });
    
    const committee = await Committee.findOne({ _id: session.committeeId, isDeleted: { $ne: true } });
    if (!committee) return res.status(404).json({ success: false, message: 'Hội đồng chấm không tồn tại.' });
    
    if (!req.user.lecturerId) {
      return res.status(403).json({ success: false, message: 'Tài khoản không được liên kết với hồ sơ Giảng viên.' });
    }

    const member = committee.members.find(m => m.lecturerId.toString() === req.user.lecturerId.toString());
    if (member && ['COMMITTEE_SECRETARY', 'COMMITTEE_CHAIR', 'COMMITTEE_MEMBER'].includes(member.role)) {
      return next();
    }
    
    return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối: Yêu cầu vai trò Giáo vụ hoặc thành viên Hội đồng chấm.' });
  } catch (error) {
    next(error);
  }
};

router.use(protect);

router.get('/', defensesController.getSessions);
router.post('/', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), defensesValidator.validateScheduleSession, defensesController.scheduleSession);
router.get('/:id', defensesController.getSessionById);
router.patch('/:id', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), defensesController.updateSession);
router.delete('/:id', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), defensesController.deleteSession);

router.post('/:id/check-identity', checkSecretaryOrStaff, defensesController.checkIdentity);
router.post('/:id/start', checkSecretaryOrStaff, defensesController.startSession);
router.post('/:id/report-incident', checkSecretaryOrStaff, defensesValidator.validateReportIncident, defensesController.reportIncident);
router.post('/:id/upload-recording', checkSecretaryOrStaff, defensesController.uploadRecording);
router.post('/:id/complete', checkSecretaryOrStaff, defensesController.completeSession);
router.post('/:id/reschedule', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), defensesController.rescheduleSession);
router.post('/:id/mark-no-show', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), defensesController.markNoShow);

module.exports = router;
