const mongoose = require('mongoose');
const ProjectGroup = require('../../models/ProjectGroup');
const Lecturer = require('../../models/Lecturer');

const validateTopicPropose = async (req, res, next) => {
  try {
    // 1. Auto-lookup student active group if not provided
    if (!req.body.groupId && req.user.studentId) {
      const group = await ProjectGroup.findOne({
        periodId: req.body.periodId,
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        'members.studentId': req.user.studentId
      });
      if (group) {
        req.body.groupId = group._id.toString();
      }
    }

    // 2. Auto-lookup first active lecturer if not provided
    if (!req.body.proposedSupervisorId) {
      const supervisor = await Lecturer.findOne({ isDeleted: false });
      if (supervisor) {
        req.body.proposedSupervisorId = supervisor._id.toString();
      }
    }

    // 3. Fallback academic details if not provided
    if (!req.body.objectives) {
      req.body.objectives = 'Phát triển và hoàn thiện hệ thống nghiên cứu đề xuất đạt hiệu năng cao.';
    }
    if (!req.body.scope) {
      req.body.scope = 'Phân tích lý thuyết, thiết kế kiến trúc hệ thống và xây dựng phiên bản thử nghiệm.';
    }
    if (!req.body.expectedResult) {
      req.body.expectedResult = 'Báo cáo kỹ thuật chi tiết cùng mã nguồn chương trình ứng dụng hoàn chỉnh.';
    }
    if (!req.body.plan) {
      req.body.plan = 'Tuần 1-4: Nghiên cứu tài liệu. Tuần 5-10: Thiết kế và lập trình. Tuần 11-15: Viết báo cáo.';
    }

    const {
      periodId,
      groupId,
      title,
      summary,
      objectives,
      scope,
      technologies,
      expectedResult,
      plan,
      proposedSupervisorId,
    } = req.body;

    const errors = [];

    // ObjectId checks
    if (!periodId || !mongoose.Types.ObjectId.isValid(periodId)) {
      errors.push({ field: 'periodId', code: 'PERIOD_ID_INVALID', message: 'Mã đợt đồ án (periodId) không hợp lệ.' });
    }
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      errors.push({ field: 'groupId', code: 'GROUP_ID_INVALID', message: 'Mã nhóm đồ án (groupId) không hợp lệ.' });
    }
    if (!proposedSupervisorId || !mongoose.Types.ObjectId.isValid(proposedSupervisorId)) {
      errors.push({ field: 'proposedSupervisorId', code: 'SUPERVISOR_ID_INVALID', message: 'Mã giảng viên đề xuất hướng dẫn không hợp lệ.' });
    }

    // String field presence checks
    const requiredStrings = {
      title: 'Tên đề tài',
      summary: 'Tóm tắt đề tài',
      objectives: 'Mục tiêu đề tài',
      scope: 'Phạm vi đề tài',
      expectedResult: 'Sản phẩm đầu ra dự kiến',
      plan: 'Kế hoạch thực hiện',
    };

    for (const [field, label] of Object.entries(requiredStrings)) {
      const val = req.body[field];
      if (!val || typeof val !== 'string' || val.trim() === '') {
        errors.push({ field, code: `${field.toUpperCase()}_REQUIRED`, message: `${label} là bắt buộc.` });
      }
    }

    // Technologies array check
    if (technologies !== undefined && !Array.isArray(technologies)) {
      errors.push({ field: 'technologies', code: 'TECHNOLOGIES_MUST_BE_ARRAY', message: 'Danh sách công nghệ sử dụng phải là một mảng.' });
    }

    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Dữ liệu đề xuất đề tài không hợp lệ.',
        errors,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const validateTopicUpdate = async (req, res, next) => {
  try {
    const ProjectTopic = require('../../models/ProjectTopic');
    const topic = await ProjectTopic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Đề tài không tồn tại.' });
    }
    
    // Auto-fill fields if not provided
    if (!req.body.periodId) req.body.periodId = topic.periodId.toString();
    if (!req.body.groupId) req.body.groupId = topic.groupId.toString();
    if (!req.body.proposedSupervisorId && topic.proposedSupervisorId) {
      req.body.proposedSupervisorId = topic.proposedSupervisorId.toString();
    }
    
    return validateTopicPropose(req, res, next);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateTopicPropose,
  validateTopicUpdate,
};
