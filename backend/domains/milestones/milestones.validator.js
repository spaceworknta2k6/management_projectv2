const mongoose = require('mongoose');

const validateMilestoneCreate = (req, res, next) => {
  const { title, deadline } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim() === '') {
    errors.push({ field: 'title', code: 'TITLE_REQUIRED', message: 'Tiêu đề mốc tiến độ là bắt buộc.' });
  }

  if (!deadline || isNaN(new Date(deadline).getTime())) {
    errors.push({ field: 'deadline', code: 'DEADLINE_INVALID', message: 'Hạn chót mốc tiến độ không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu mốc tiến độ không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateMilestoneUpdate = (req, res, next) => {
  const { title, deadline, status } = req.body;
  const errors = [];

  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    errors.push({ field: 'title', code: 'TITLE_INVALID', message: 'Tiêu đề mốc tiến độ không hợp lệ.' });
  }

  if (deadline !== undefined && isNaN(new Date(deadline).getTime())) {
    errors.push({ field: 'deadline', code: 'DEADLINE_INVALID', message: 'Hạn chót mốc tiến độ không hợp lệ.' });
  }

  if (status !== undefined && !['open', 'submitted', 'accepted', 'needs_revision', 'rejected', 'late', 'locked'].includes(status)) {
    errors.push({ field: 'status', code: 'STATUS_INVALID', message: 'Trạng thái mốc tiến độ không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu chỉnh sửa mốc tiến độ không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateMilestoneSubmit = (req, res, next) => {
  const { note, fileIds } = req.body;
  const errors = [];

  if (fileIds !== undefined && !Array.isArray(fileIds)) {
    errors.push({ field: 'fileIds', code: 'FILE_IDS_MUST_BE_ARRAY', message: 'Danh sách mã tệp tin đính kèm phải là một mảng.' });
  } else if (Array.isArray(fileIds)) {
    fileIds.forEach((id, index) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        errors.push({ field: `fileIds[${index}]`, code: 'FILE_ID_INVALID', message: 'Mã tệp tin đính kèm không hợp lệ.' });
      }
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu nộp tiến độ không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateMilestoneFeedback = (req, res, next) => {
  const { comment, status } = req.body;
  const errors = [];

  if (!comment || typeof comment !== 'string' || comment.trim() === '') {
    errors.push({ field: 'comment', code: 'COMMENT_REQUIRED', message: 'Nhận xét của giảng viên là bắt buộc.' });
  }

  if (!status || !['accepted', 'needs_revision', 'rejected'].includes(status)) {
    errors.push({ field: 'status', code: 'STATUS_INVALID', message: 'Trạng thái đánh giá phải là một trong: accepted, needs_revision, rejected.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu đánh giá tiến độ không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateMilestoneCreate,
  validateMilestoneUpdate,
  validateMilestoneSubmit,
  validateMilestoneFeedback,
};
