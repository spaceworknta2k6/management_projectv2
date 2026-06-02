const mongoose = require('mongoose');

const validateEntityHistory = (req, res, next) => {
  const { entityType, entityId } = req.params;
  const errors = [];

  if (!entityType || typeof entityType !== 'string' || entityType.trim() === '') {
    errors.push({ field: 'entityType', code: 'ENTITY_TYPE_REQUIRED', message: 'Loại thực thể (entityType) là bắt buộc.' });
  }

  if (!entityId || !mongoose.Types.ObjectId.isValid(entityId)) {
    errors.push({ field: 'entityId', code: 'ENTITY_ID_INVALID', message: 'Mã thực thể (entityId) không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu yêu cầu lịch sử không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateEntityHistory,
};
