const validateRubricSubmit = (req, res, next) => {
  const { name, version, criteria } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({ field: 'name', code: 'NAME_REQUIRED', message: 'Tên Rubric là bắt buộc và không được để trống.' });
  }

  if (!version || typeof version !== 'string' || version.trim() === '') {
    errors.push({ field: 'version', code: 'VERSION_REQUIRED', message: 'Phiên bản Rubric là bắt buộc và không được để trống.' });
  }

  if (criteria) {
    const roles = ['SUPERVISOR', 'REVIEWER', 'SECOND_MARKER'];
    roles.forEach((role) => {
      const criteriaList = criteria[role];
      if (criteriaList !== undefined) {
        if (!Array.isArray(criteriaList)) {
          errors.push({ field: `criteria.${role}`, code: 'CRITERIA_MUST_BE_ARRAY', message: `Danh sách tiêu chí của ${role} phải là một mảng.` });
        } else {
          criteriaList.forEach((c, idx) => {
            const prefix = `criteria.${role}[${idx}]`;
            if (!c.criteriaCode || typeof c.criteriaCode !== 'string' || c.criteriaCode.trim() === '') {
              errors.push({ field: `${prefix}.criteriaCode`, code: 'CRITERIA_CODE_REQUIRED', message: 'Mã tiêu chí là bắt buộc.' });
            }
            if (!c.criteriaName || typeof c.criteriaName !== 'string' || c.criteriaName.trim() === '') {
              errors.push({ field: `${prefix}.criteriaName`, code: 'CRITERIA_NAME_REQUIRED', message: 'Tên tiêu chí là bắt buộc.' });
            }
            if (c.maxScore === undefined || typeof c.maxScore !== 'number' || c.maxScore <= 0) {
              errors.push({ field: `${prefix}.maxScore`, code: 'MAX_SCORE_INVALID', message: 'Điểm tối đa của tiêu chí phải là số dương.' });
            }
            if (c.weight === undefined || typeof c.weight !== 'number' || c.weight < 0) {
              errors.push({ field: `${prefix}.weight`, code: 'WEIGHT_INVALID', message: 'Trọng số của tiêu chí phải là số không âm.' });
            }
          });
        }
      }
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu Rubric không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateRubricSubmit,
};
