const mongoose = require('mongoose');

const validateScoreSheetSubmit = (req, res, next) => {
  const { projectId, groupId, periodId, rubricRole, targetType, targetId, criteriaScores, comment } = req.body;
  const errors = [];

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    errors.push({ field: 'projectId', code: 'PROJECT_ID_INVALID', message: 'Mã dự án (projectId) không hợp lệ.' });
  }

  if (groupId !== undefined && groupId !== null && groupId !== '') {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      errors.push({ field: 'groupId', code: 'GROUP_ID_INVALID', message: 'Mã nhóm (groupId) không hợp lệ.' });
    }
  }

  if (!periodId || !mongoose.Types.ObjectId.isValid(periodId)) {
    errors.push({ field: 'periodId', code: 'PERIOD_ID_INVALID', message: 'Mã đợt đồ án (periodId) không hợp lệ.' });
  }

  if (!rubricRole || !['SUPERVISOR', 'REVIEWER', 'COMMITTEE_MEMBER', 'SECOND_MARKER'].includes(rubricRole)) {
    errors.push({ field: 'rubricRole', code: 'RUBRIC_ROLE_INVALID', message: 'Vai trò rubric phải là một trong: SUPERVISOR, REVIEWER, COMMITTEE_MEMBER, SECOND_MARKER.' });
  }

  if (!targetType || !['SUPERVISOR', 'REVIEWER', 'COMMITTEE_MEMBER', 'NON_DEFENSE_MARKER', 'RECHECK'].includes(targetType)) {
    errors.push({ field: 'targetType', code: 'TARGET_TYPE_INVALID', message: 'Loại chấm điểm (targetType) không hợp lệ.' });
  }

  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    errors.push({ field: 'targetId', code: 'TARGET_ID_INVALID', message: 'Mã đối tượng chấm (targetId) không hợp lệ.' });
  }

  if (!criteriaScores || !Array.isArray(criteriaScores) || criteriaScores.length === 0) {
    errors.push({ field: 'criteriaScores', code: 'CRITERIA_SCORES_REQUIRED', message: 'Danh sách điểm tiêu chí không được rỗng.' });
  } else {
    criteriaScores.forEach((c, idx) => {
      if (!c.criteriaCode || typeof c.criteriaCode !== 'string' || c.criteriaCode.trim() === '') {
        errors.push({ field: `criteriaScores[${idx}].criteriaCode`, code: 'CRITERIA_CODE_REQUIRED', message: 'Mã tiêu chí là bắt buộc.' });
      }
      if (!c.criteriaName || typeof c.criteriaName !== 'string' || c.criteriaName.trim() === '') {
        errors.push({ field: `criteriaScores[${idx}].criteriaName`, code: 'CRITERIA_NAME_REQUIRED', message: 'Tên tiêu chí là bắt buộc.' });
      }
      if (c.maxScore === undefined || typeof c.maxScore !== 'number' || c.maxScore <= 0) {
        errors.push({ field: `criteriaScores[${idx}].maxScore`, code: 'MAX_SCORE_INVALID', message: 'Điểm tối đa phải là số dương.' });
      }
      if (c.score === undefined || typeof c.score !== 'number' || c.score < 0 || c.score > (c.maxScore || 10)) {
        errors.push({ field: `criteriaScores[${idx}].score`, code: 'SCORE_INVALID', message: `Điểm chấm phải từ 0 đến điểm tối đa (${c.maxScore || 10}).` });
      }
      if (c.weight !== undefined && (typeof c.weight !== 'number' || c.weight < 0)) {
        errors.push({ field: `criteriaScores[${idx}].weight`, code: 'WEIGHT_INVALID', message: 'Trọng số tiêu chí không hợp lệ.' });
      }
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu chấm điểm không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateScoreSheetSubmit,
};
