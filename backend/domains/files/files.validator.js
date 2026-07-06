const { isObjectId } = require('../../utils/object-id');

const validateFileId = (req, res, next) => {
  const { id } = req.params;
  const errors = [];

  if (!id || !isObjectId(id)) {
    errors.push({ field: 'id', code: 'FILE_ID_INVALID', message: 'Mã tệp tin (id) không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu yêu cầu không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateFileId,
};
