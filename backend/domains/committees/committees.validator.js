const mongoose = require('mongoose');

const validateCommitteeCreate = (req, res, next) => {
  const { periodId, name, evaluationMode, members } = req.body;
  const errors = [];

  if (!periodId || !mongoose.Types.ObjectId.isValid(periodId)) {
    errors.push({ field: 'periodId', code: 'PERIOD_ID_INVALID', message: 'Mã đợt đồ án (periodId) không hợp lệ.' });
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({ field: 'name', code: 'NAME_REQUIRED', message: 'Tên hội đồng là bắt buộc.' });
  }

  if (evaluationMode && !['defense', 'non_defense', 'recheck'].includes(evaluationMode)) {
    errors.push({ field: 'evaluationMode', code: 'EVALUATION_MODE_INVALID', message: 'Hình thức đánh giá không hợp lệ.' });
  }

  if (!members || !Array.isArray(members) || members.length < 3) {
    errors.push({ field: 'members', code: 'MEMBERS_MIN_REQUIRED', message: 'Một hội đồng phải có tối thiểu 3 thành viên.' });
  } else {
    members.forEach((m, idx) => {
      if (!m.lecturerId || !mongoose.Types.ObjectId.isValid(m.lecturerId)) {
        errors.push({ field: `members[${idx}].lecturerId`, code: 'LECTURER_ID_INVALID', message: 'Mã giảng viên không hợp lệ.' });
      }
      if (!m.role || !['COMMITTEE_CHAIR', 'COMMITTEE_SECRETARY', 'REVIEWER', 'COMMITTEE_MEMBER'].includes(m.role)) {
        errors.push({ field: `members[${idx}].role`, code: 'MEMBER_ROLE_INVALID', message: 'Vai trò thành viên hội đồng không hợp lệ.' });
      }
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu hội đồng không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateCommitteeUpdate = (req, res, next) => {
  const { name, evaluationMode, members } = req.body;
  const errors = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    errors.push({ field: 'name', code: 'NAME_REQUIRED', message: 'Tên hội đồng là bắt buộc.' });
  }

  if (evaluationMode !== undefined && !['defense', 'non_defense', 'recheck'].includes(evaluationMode)) {
    errors.push({ field: 'evaluationMode', code: 'EVALUATION_MODE_INVALID', message: 'Hình thức đánh giá không hợp lệ.' });
  }

  if (members !== undefined) {
    if (!Array.isArray(members) || members.length < 3) {
      errors.push({ field: 'members', code: 'MEMBERS_MIN_REQUIRED', message: 'Một hội đồng phải có tối thiểu 3 thành viên.' });
    } else {
      members.forEach((m, idx) => {
        if (!m.lecturerId || !mongoose.Types.ObjectId.isValid(m.lecturerId)) {
          errors.push({ field: `members[${idx}].lecturerId`, code: 'LECTURER_ID_INVALID', message: 'Mã giảng viên không hợp lệ.' });
        }
        if (!m.role || !['COMMITTEE_CHAIR', 'COMMITTEE_SECRETARY', 'REVIEWER', 'COMMITTEE_MEMBER'].includes(m.role)) {
          errors.push({ field: `members[${idx}].role`, code: 'MEMBER_ROLE_INVALID', message: 'Vai trò thành viên hội đồng không hợp lệ.' });
        }
      });
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu cập nhật hội đồng không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateCommitteeCreate,
  validateCommitteeUpdate,
};
