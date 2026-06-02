const mongoose = require('mongoose');

const validateAssignReviewer = (req, res, next) => {
  const { reviewerId } = req.body;
  const errors = [];

  if (!reviewerId || !mongoose.Types.ObjectId.isValid(reviewerId)) {
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
