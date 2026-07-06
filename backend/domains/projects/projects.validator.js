const { isObjectId } = require('../../utils/object-id');

const validateAssignReviewer = (req, res, next) => {
  const { reviewerId } = req.body;
  const errors = [];

  if (!reviewerId || !isObjectId(reviewerId)) {
    errors.push({ field: 'reviewerId', code: 'REVIEWER_ID_INVALID', message: 'Mã giảng viên phản biện (reviewerId) không hợp lệ.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu phân công phản biện không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateAssignReviewer,
};
