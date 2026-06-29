const mongoose = require('mongoose');

const validateSubmitAppeal = (req, res, next) => {
  const { projectId, reason } = req.body;
  const errors = [];

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    errors.push({ field: 'projectId', code: 'PROJECT_ID_INVALID', message: 'Mã dự án (projectId) không hợp lệ.' });
  }

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    errors.push({ field: 'reason', code: 'REASON_REQUIRED', message: 'Lý do phúc khảo là bắt buộc.' });
  } else if (reason.trim().length < 20) {
    errors.push({ field: 'reason', code: 'REASON_TOO_SHORT', message: 'Lý do phúc khảo phải có ít nhất 20 ký tự.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: 'Dữ liệu đơn phúc khảo không hợp lệ.', errors });
  }
  next();
};

const validateAssignRecheck = (req, res, next) => {
  const { recheckGraderId } = req.body;
  const errors = [];

  if (!recheckGraderId || !mongoose.Types.ObjectId.isValid(recheckGraderId)) {
    errors.push({ field: 'recheckGraderId', code: 'GRADER_ID_INVALID', message: 'Mã giảng viên chấm phúc khảo không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: 'Dữ liệu phân công không hợp lệ.', errors });
  }
  next();
};

module.exports = {
  validateSubmitAppeal,
  validateAssignRecheck,
};
