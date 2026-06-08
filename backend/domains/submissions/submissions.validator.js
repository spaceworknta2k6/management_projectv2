const mongoose = require('mongoose');

const validatePackageInitialize = (req, res, next) => {
  const { projectId, phase } = req.body;
  const errors = [];

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    errors.push({ field: 'projectId', code: 'PROJECT_ID_INVALID', message: 'Mã dự án (projectId) không hợp lệ.' });
  }

  if (!phase || !['proposal', 'progress', 'pre_defense', 'post_defense', 'archive'].includes(phase)) {
    errors.push({ field: 'phase', code: 'PHASE_INVALID', message: 'Giai đoạn nộp báo cáo phải là một trong: proposal, progress, pre_defense, post_defense, archive.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu khởi tạo gói nộp bài không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateItemUpload = (req, res, next) => {
  const { type, fileId } = req.body;
  const errors = [];

  if (!type || typeof type !== 'string' || type.trim() === '') {
    errors.push({ field: 'type', code: 'ITEM_TYPE_REQUIRED', message: 'Loại tài liệu nộp là bắt buộc.' });
  }

  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    errors.push({ field: 'fileId', code: 'FILE_ID_INVALID', message: 'Mã tệp tin nộp (fileId) không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu nộp tài liệu không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateItemReview = (req, res, next) => {
  const { type, status } = req.body;
  const errors = [];

  if (!type || typeof type !== 'string' || type.trim() === '') {
    errors.push({ field: 'type', code: 'ITEM_TYPE_REQUIRED', message: 'Loại tài liệu nhận xét là bắt buộc.' });
  }

  if (!status || !['accepted', 'rejected'].includes(status)) {
    errors.push({ field: 'status', code: 'REVIEW_STATUS_INVALID', message: 'Kết quả nhận xét tài liệu phải là accepted hoặc rejected.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu đánh giá tài liệu không hợp lệ.',
      errors,
    });
  }

  next();
};

const validatePackageUpdate = (req, res, next) => {
  const { deadline, status, items } = req.body;
  const errors = [];

  if (deadline !== undefined && isNaN(new Date(deadline).getTime())) {
    errors.push({ field: 'deadline', code: 'DEADLINE_INVALID', message: 'Hạn nộp không hợp lệ.' });
  }

  if (status !== undefined && !['draft', 'submitted', 'needs_revision', 'accepted', 'late', 'locked'].includes(status)) {
    errors.push({ field: 'status', code: 'PACKAGE_STATUS_INVALID', message: 'Trạng thái gói nộp không hợp lệ.' });
  }

  if (items !== undefined && !Array.isArray(items)) {
    errors.push({ field: 'items', code: 'PACKAGE_ITEMS_INVALID', message: 'Danh sách tài liệu nộp không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu chỉnh sửa gói nộp không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validatePackageInitialize,
  validateItemUpload,
  validateItemReview,
  validatePackageUpdate,
};
