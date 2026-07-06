const { isObjectId } = require('../../utils/object-id');

const validateCreate = (req, res, next) => {
  const { newTitle, newScope, newPlan, reason } = req.body;
  const errors = [];

  if (!newTitle || typeof newTitle !== 'string' || newTitle.trim() === '') {
    errors.push({ field: 'newTitle', code: 'NEW_TITLE_REQUIRED', message: 'Vui lòng nhập tên đề tài mới.' });
  }
  if (!newScope || typeof newScope !== 'string' || newScope.trim() === '') {
    errors.push({ field: 'newScope', code: 'NEW_SCOPE_REQUIRED', message: 'Vui lòng nhập phạm vi đề tài mới.' });
  }
  if (!newPlan || typeof newPlan !== 'string' || newPlan.trim() === '') {
    errors.push({ field: 'newPlan', code: 'NEW_PLAN_REQUIRED', message: 'Vui lòng nhập kế hoạch thực hiện mới.' });
  }
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    errors.push({ field: 'reason', code: 'REASON_REQUIRED', message: 'Vui lòng nhập lý do đổi đề tài.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu đơn đổi đề tài không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateReview = (req, res, next) => {
  const { note } = req.body;
  const errors = [];

  if (!note || typeof note !== 'string' || note.trim() === '') {
    errors.push({ field: 'note', code: 'NOTE_REQUIRED', message: 'Vui lòng nhập ghi chú xử lý.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu xử lý đơn đổi đề tài không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateIdParam = (req, res, next) => {
  if (!isObjectId(req.params.id)) {
    return res.status(422).json({
      success: false,
      message: 'Mã đơn đổi đề tài không hợp lệ.',
      errors: [{ field: 'id', code: 'ID_INVALID', message: 'Mã đơn đổi đề tài không hợp lệ.' }],
    });
  }
  next();
};

module.exports = {
  validateCreate,
  validateReview,
  validateIdParam,
};
