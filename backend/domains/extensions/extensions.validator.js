const mongoose = require('mongoose');

const validateExtensionCreate = (req, res, next) => {
  const { targetType, targetId, projectId, reason, requestedTo } = req.body;
  const errors = [];

  if (!targetType || !['milestone', 'submission', 'project'].includes(targetType)) {
    errors.push({ field: 'targetType', code: 'TARGET_TYPE_INVALID', message: 'Loại đối tượng gia hạn phải là một trong: milestone, submission, project.' });
  }

  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    errors.push({ field: 'targetId', code: 'TARGET_ID_INVALID', message: 'Mã đối tượng gia hạn (targetId) không hợp lệ.' });
  }

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    errors.push({ field: 'projectId', code: 'PROJECT_ID_INVALID', message: 'Mã dự án (projectId) không hợp lệ.' });
  }

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    errors.push({ field: 'reason', code: 'REASON_REQUIRED', message: 'Lý do xin gia hạn là bắt buộc.' });
  }

  if (!requestedTo || isNaN(new Date(requestedTo).getTime())) {
    errors.push({ field: 'requestedTo', code: 'REQUESTED_TO_INVALID', message: 'Thời hạn đề xuất mới không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu yêu cầu gia hạn không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateSupervisorReview = (req, res, next) => {
  const { status, note } = req.body;
  const errors = [];

  if (!status || !['approved', 'rejected'].includes(status)) {
    errors.push({ field: 'status', code: 'REVIEW_STATUS_INVALID', message: 'Ý kiến khuyến nghị của GVHD phải là approved hoặc rejected.' });
  }

  if (!note || typeof note !== 'string' || note.trim() === '') {
    errors.push({ field: 'note', code: 'NOTE_REQUIRED', message: 'Nhận xét chi tiết của GVHD là bắt buộc.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Ý kiến nhận xét của GVHD không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateFacultyDecision = (req, res, next) => {
  const { status, note } = req.body;
  const errors = [];

  if (!status || !['approved', 'rejected'].includes(status)) {
    errors.push({ field: 'status', code: 'DECISION_STATUS_INVALID', message: 'Quyết định phê duyệt của Giáo vụ phải là approved hoặc rejected.' });
  }

  if (!note || typeof note !== 'string' || note.trim() === '') {
    errors.push({ field: 'note', code: 'NOTE_REQUIRED', message: 'Ghi chú quyết định của Giáo vụ là bắt buộc.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Quyết định phê duyệt của Giáo vụ không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateExtensionCreate,
  validateSupervisorReview,
  validateFacultyDecision,
};
