const express = require('express');
const router = express.Router();

const aiController = require('./ai.controller');
const aiValidator = require('./ai.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

const hasAnyRole = (user, allowedRoles) => {
  const roles = user.roles || (user.role ? [user.role] : []);
  return roles.some((role) => allowedRoles.includes(role));
};

const checkCommitteeOrStaff = async (req, res, next) => {
  if (hasAnyRole(req.user, ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF'])) {
    return next();
  }
  try {
    const { id } = req.params; // projectId
    const DefenseSession = require('../../models/DefenseSession');
    const Committee = require('../../models/Committee');

    const session = await DefenseSession.findOne({ projectId: id, isDeleted: { $ne: true } });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Dự án chưa được xếp lịch bảo vệ.' });
    }

    const committee = await Committee.findOne({ _id: session.committeeId, isDeleted: { $ne: true } });
    if (!committee) {
      return res.status(404).json({ success: false, message: 'Hội đồng chấm không tồn tại.' });
    }

    if (!req.user.lecturerId) {
      return res.status(403).json({ success: false, message: 'Yêu cầu tài khoản Giảng viên để truy cập câu hỏi bảo vệ.' });
    }

    const isMember = committee.members.some(m => m.lecturerId.toString() === req.user.lecturerId.toString());
    if (isMember) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối: Chỉ thành viên Hội đồng chấm hoặc Giáo vụ mới được truy cập câu hỏi bảo vệ.'
    });
  } catch (error) {
    next(error);
  }
};

router.use(protect);

router.get('/jobs/:id', aiValidator.validateJobId, aiController.getJobById);
router.post('/jobs/:id/retry', requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF', 'LECTURER']), aiValidator.validateJobId, aiController.retryAiJob);
router.post('/jobs/:id/manual-override', requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF', 'LECTURER']), aiValidator.validateJobId, aiValidator.validateManualOverride, aiController.manualOverrideJob);

router.post('/topics/:id/check-duplicate', requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF']), aiValidator.validateTopicId, aiController.checkDuplicateTopic);
router.post('/students/:id/topic-suggestions', requireRole(['STUDENT', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateStudentId, aiController.suggestTopics);
router.post('/students/:id/topic-chat', requireRole(['STUDENT', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateStudentId, aiController.chatTopicSuggestion);
router.post('/submissions/:id/report-feedback', requireRole(['STUDENT', 'LECTURER', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateSubmissionId, aiController.analyzeReportFeedback);

// Committee only for defense questions
router.post('/projects/:id/defense-questions', checkCommitteeOrStaff, aiValidator.validateProjectId, aiController.suggestDefenseQuestions);

module.exports = router;
