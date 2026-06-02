const mongoose = require('mongoose');

const validateIdParam = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: paramName, code: 'ID_INVALID', message: `Mã ${paramName} không hợp lệ.` });
    }

    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Dữ liệu tham số không hợp lệ.',
        errors,
      });
    }

    next();
  };
};

const validateManualOverride = (req, res, next) => {
  const { result } = req.body;
  const errors = [];

  if (result === undefined) {
    errors.push({ field: 'result', code: 'RESULT_REQUIRED', message: 'Dữ liệu kết quả ghi đè (result) là bắt buộc.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu ghi đè không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateJobId: validateIdParam('id'),
  validateTopicId: validateIdParam('id'),
  validateStudentId: validateIdParam('id'),
  validateSubmissionId: validateIdParam('id'),
  validateProjectId: validateIdParam('id'),
  validateManualOverride,
};
