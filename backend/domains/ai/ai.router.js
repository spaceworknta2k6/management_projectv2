const express = require('express');
const router = express.Router();

const aiController = require('./ai.controller');
const aiValidator = require('./ai.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');
const { aiLimiter } = require('../../config/rate-limit');

const hasAnyRole = (user, allowedRoles) => {
  const roles = user.roles || (user.role ? [user.role] : []);
  return roles.some((role) => allowedRoles.includes(role));
};

const checkProjectLecturerOrStaff = async (req, res, next) => {
  if (hasAnyRole(req.user, ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF'])) {
    return next();
  }
  try {
    const { id } = req.params; // projectId
    const Project = require('../../models/Project');
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Dự án không tồn tại.' });
    }

    if (!req.user.lecturerId) {
      return res.status(403).json({ success: false, message: 'Yêu cầu tài khoản Giảng viên để truy cập câu hỏi bảo vệ.' });
    }

    const lecturerId = req.user.lecturerId.toString();
    const isSupervisor = project.supervisorId && project.supervisorId.toString() === lecturerId;
    const isReviewer = project.reviewerId && project.reviewerId.toString() === lecturerId;

    if (isSupervisor || isReviewer) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối: Chỉ Giảng viên hướng dẫn, Giảng viên chấm độc lập hoặc Giáo vụ mới được truy cập câu hỏi bảo vệ.'
    });
  } catch (error) {
    next(error);
  }
};

router.use(protect);

router.get('/jobs/:id', aiValidator.validateJobId, aiController.getJobById);
router.post('/jobs/:id/retry', requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF', 'LECTURER']), aiValidator.validateJobId, aiController.retryAiJob);
router.post('/jobs/:id/manual-override', requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF', 'LECTURER']), aiValidator.validateJobId, aiValidator.validateManualOverride, aiController.manualOverrideJob);

router.post('/topics/:id/check-duplicate', aiLimiter, requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF']), aiValidator.validateTopicId, aiController.checkDuplicateTopic);
router.post('/students/:id/topic-suggestions', aiLimiter, requireRole(['STUDENT', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateStudentId, aiController.suggestTopics);
router.post('/students/:id/topic-chat', aiLimiter, requireRole(['STUDENT', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateStudentId, aiController.chatTopicSuggestion);
router.post('/submissions/:id/report-feedback', aiLimiter, requireRole(['STUDENT', 'LECTURER', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiValidator.validateSubmissionId, aiController.analyzeReportFeedback);
router.post('/milestones/:milestoneId/files/:fileId/analyze', aiLimiter, requireRole(['STUDENT', 'LECTURER', 'SYSTEM_ADMIN', 'FACULTY_STAFF']), aiController.analyzeMilestoneReport);

// Committee only for defense questions
router.post('/projects/:id/defense-questions', aiLimiter, checkProjectLecturerOrStaff, aiValidator.validateProjectId, aiController.suggestDefenseQuestions);

module.exports = router;
