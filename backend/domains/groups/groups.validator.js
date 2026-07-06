const { isObjectId } = require('../../utils/object-id');

const validateGroupCreate = (req, res, next) => {
  const { periodId, name } = req.body;
  const errors = [];

  if (!periodId || !isObjectId(periodId)) {
    errors.push({ field: 'periodId', code: 'PERIOD_ID_INVALID', message: 'Mã đợt đồ án (periodId) không hợp lệ.' });
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({ field: 'name', code: 'GROUP_NAME_REQUIRED', message: 'Tên nhóm đồ án là bắt buộc.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu khởi tạo nhóm đồ án không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateInviteMember = (req, res, next) => {
  const { studentId, studentCode } = req.body;
  const errors = [];

  if (studentId && !isObjectId(studentId)) {
    errors.push({ field: 'studentId', code: 'STUDENT_ID_INVALID', message: 'Mã định danh sinh viên không hợp lệ.' });
  }

  if (!studentId && (!studentCode || typeof studentCode !== 'string' || studentCode.trim() === '')) {
    errors.push({ field: 'studentCode', code: 'STUDENT_CODE_REQUIRED', message: 'Vui lòng nhập mã sinh viên cần mời.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu mời thành viên không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateGroupUpdate = (req, res, next) => {
  const { name } = req.body;
  const errors = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    errors.push({ field: 'name', code: 'GROUP_NAME_INVALID', message: 'Tên nhóm đồ án không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu chỉnh sửa nhóm đồ án không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateGroupCreate,
  validateInviteMember,
  validateGroupUpdate,
};
