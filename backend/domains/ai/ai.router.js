const express = require('express');
const router = express.Router();

const aiController = require('./ai.controller');
const aiValidator = require('./ai.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

const checkCommitteeOrStaff = async (req, res, next) => {
  if (['FACULTY_STAFF', 'DEPARTMENT_STAFF'].includes(req.user.role)) {
    return next();
  }
  try {
    const { id } = req.params; // projectId
    const DefenseSession = require('../../models/DefenseSession');
    const Committee = require('../../models/Committee');

    const session = await DefenseSession.findOne({ projectId: id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Dự án chưa được xếp lịch bảo vệ.' });
    }

    const committee = await Committee.findById(session.committeeId);
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
router.post('/jobs/:id/retry', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'LECTURER']), aiValidator.validateJobId, aiController.retryAiJob);
router.post('/jobs/:id/manual-override', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'LECTURER']), aiValidator.validateJobId, aiValidator.validateManualOverride, aiController.manualOverrideJob);

router.post('/topics/:id/check-duplicate', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF']), aiValidator.validateTopicId, aiController.checkDuplicateTopic);
router.post('/students/:id/topic-suggestions', requireRole(['STUDENT', 'FACULTY_STAFF']), aiValidator.validateStudentId, aiController.suggestTopics);
router.post('/submissions/:id/report-feedback', requireRole(['STUDENT', 'LECTURER', 'FACULTY_STAFF']), aiValidator.validateSubmissionId, aiController.analyzeReportFeedback);

// Committee only for defense questions
router.post('/projects/:id/defense-questions', checkCommitteeOrStaff, aiValidator.validateProjectId, aiController.suggestDefenseQuestions);

module.exports = router;
