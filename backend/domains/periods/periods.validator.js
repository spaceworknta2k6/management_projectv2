const mongoose = require('mongoose');

const validatePeriodCreate = (req, res, next) => {
  const {
    name,
    schoolYear,
    semester,
    type,
    registrationStart,
    registrationEnd,
    projectStart,
    projectEnd,
    preDefenseSubmissionDeadline,
    defenseStart,
    defenseEnd,
    postDefenseRevisionDeadline,
    archiveDeadline,
    minGroupSize,
    maxGroupSize,
    topicChangeDeadline,
    varianceThreshold,
    passScore,
    rubricVersion,
    rubricId,
    scoringFormula
  } = req.body;

  const errors = [];

  if (rubricId !== undefined && rubricId !== null && rubricId !== '') {
    if (!mongoose.Types.ObjectId.isValid(rubricId)) {
      errors.push({ field: 'rubricId', code: 'RUBRIC_ID_INVALID', message: 'Mã tiêu chí đánh giá (rubricId) không hợp lệ.' });
    }
  }

  // 1. Core Fields presence checks
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({ field: 'name', code: 'PERIOD_NAME_REQUIRED', message: 'Tên đợt đồ án là bắt buộc.' });
  }
  if (!schoolYear || typeof schoolYear !== 'string' || schoolYear.trim() === '') {
    errors.push({ field: 'schoolYear', code: 'SCHOOL_YEAR_REQUIRED', message: 'Năm học là bắt buộc.' });
  }
  if (!semester || typeof semester !== 'string' || semester.trim() === '') {
    errors.push({ field: 'semester', code: 'SEMESTER_REQUIRED', message: 'Học kỳ là bắt buộc.' });
  }
  if (!type || !['foundation_project', 'interdisciplinary_project'].includes(type)) {
    errors.push({ field: 'type', code: 'PERIOD_TYPE_INVALID', message: 'Loại đợt đồ án phải là foundation_project hoặc interdisciplinary_project.' });
  }

  // 2. Group Size boundary checks
  const min = parseInt(minGroupSize, 10);
  const max = parseInt(maxGroupSize, 10);
  if (isNaN(min) || min < 1) {
    errors.push({ field: 'minGroupSize', code: 'MIN_GROUP_SIZE_INVALID', message: 'Số lượng thành viên tối thiểu phải lớn hơn hoặc bằng 1.' });
  }
  if (isNaN(max) || max < min) {
    errors.push({ field: 'maxGroupSize', code: 'MAX_GROUP_SIZE_INVALID', message: 'Số lượng thành viên tối đa phải lớn hơn hoặc bằng số lượng tối thiểu.' });
  }

  // 3. Scoring Formulas presence and validity checks
  if (!rubricVersion || typeof rubricVersion !== 'string' || rubricVersion.trim() === '') {
    errors.push({ field: 'rubricVersion', code: 'RUBRIC_VERSION_REQUIRED', message: 'Phiên bản tiêu chí chấm (rubric) là bắt buộc.' });
  }
  if (!scoringFormula || typeof scoringFormula !== 'object') {
    errors.push({ field: 'scoringFormula', code: 'SCORING_FORMULA_REQUIRED', message: 'Công thức tính điểm là bắt buộc.' });
  } else {
    // e.g. { supervisor: 0.3, reviewer: 0.2, committee: 0.5 }
    const weights = Object.values(scoringFormula);
    const sum = weights.reduce((acc, val) => acc + parseFloat(val || 0), 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      errors.push({ field: 'scoringFormula', code: 'SCORING_FORMULA_INVALID', message: 'Tổng trọng số điểm thành phần phải bằng 1.0 (100%).' });
    }
  }

  // 4. Chronological Date validations
  const dates = {
    registrationStart: new Date(registrationStart),
    registrationEnd: new Date(registrationEnd),
    topicChangeDeadline: new Date(topicChangeDeadline),
    projectStart: new Date(projectStart),
    projectEnd: new Date(projectEnd),
    preDefenseSubmissionDeadline: new Date(preDefenseSubmissionDeadline),
    defenseStart: new Date(defenseStart),
    defenseEnd: new Date(defenseEnd),
    postDefenseRevisionDeadline: new Date(postDefenseRevisionDeadline),
    archiveDeadline: new Date(archiveDeadline),
  };

  // Check if any date is invalid
  for (const [key, value] of Object.entries(dates)) {
    if (isNaN(value.getTime())) {
      errors.push({ field: key, code: `${key.toUpperCase()}_INVALID_DATE`, message: `Định dạng ngày ${key} không hợp lệ.` });
    }
  }

  if (errors.length === 0) {
    // Logical order timeline check
    if (dates.registrationStart >= dates.registrationEnd) {
      errors.push({ field: 'registrationEnd', code: 'REGISTRATION_END_BEFORE_START', message: 'Thời gian kết thúc đăng ký phải sau thời gian bắt đầu đăng ký.' });
    }
    if (dates.registrationEnd > dates.topicChangeDeadline) {
      errors.push({ field: 'topicChangeDeadline', code: 'TOPIC_CHANGE_DEADLINE_BEFORE_REGISTRATION', message: 'Hạn đổi đề tài phải diễn ra sau khi kết thúc đăng ký.' });
    }
    if (dates.registrationEnd > dates.projectStart) {
      errors.push({ field: 'projectStart', code: 'PROJECT_START_BEFORE_REGISTRATION_END', message: 'Thời gian thực hiện đồ án phải sau khi kết thúc đăng ký.' });
    }
    if (dates.projectStart >= dates.projectEnd) {
      errors.push({ field: 'projectEnd', code: 'PROJECT_END_BEFORE_START', message: 'Thời gian kết thúc đồ án phải sau thời gian bắt đầu thực hiện.' });
    }
    if (dates.projectEnd < dates.preDefenseSubmissionDeadline) {
      errors.push({ field: 'preDefenseSubmissionDeadline', code: 'PRE_DEFENSE_DEADLINE_AFTER_PROJECT_END', message: 'Hạn nộp hồ sơ trước bảo vệ phải diễn ra trước khi kết thúc đợt đồ án.' });
    }
    if (dates.preDefenseSubmissionDeadline >= dates.defenseStart) {
      errors.push({ field: 'defenseStart', code: 'DEFENSE_START_BEFORE_SUBMISSION_DEADLINE', message: 'Thời gian bắt đầu bảo vệ phải diễn ra sau hạn nộp hồ sơ trước bảo vệ.' });
    }
    if (dates.defenseStart >= dates.defenseEnd) {
      errors.push({ field: 'defenseEnd', code: 'DEFENSE_END_BEFORE_START', message: 'Thời gian kết thúc bảo vệ phải sau thời gian bắt đầu bảo vệ.' });
    }
    if (dates.defenseEnd >= dates.postDefenseRevisionDeadline) {
      errors.push({ field: 'postDefenseRevisionDeadline', code: 'REVISION_DEADLINE_BEFORE_DEFENSE_END', message: 'Hạn sửa đổi báo cáo sau bảo vệ phải sau khi kết thúc bảo vệ.' });
    }
    if (dates.postDefenseRevisionDeadline >= dates.archiveDeadline) {
      errors.push({ field: 'archiveDeadline', code: 'ARCHIVE_DEADLINE_BEFORE_REVISION_END', message: 'Hạn nộp báo cáo lưu trữ phải sau hạn sửa đổi báo cáo sau bảo vệ.' });
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Thông số cấu hình đợt đồ án không hợp lệ.',
      errors,
    });
  }

  next();
};

const validatePeriodUpdate = (req, res, next) => {
  // Supports partial updates but ensures updated dates are correct
  const { minGroupSize, maxGroupSize, scoringFormula, rubricId } = req.body;
  const errors = [];

  if (rubricId !== undefined && rubricId !== null && rubricId !== '') {
    if (!mongoose.Types.ObjectId.isValid(rubricId)) {
      errors.push({ field: 'rubricId', code: 'RUBRIC_ID_INVALID', message: 'Mã tiêu chí đánh giá (rubricId) không hợp lệ.' });
    }
  }

  if (minGroupSize !== undefined || maxGroupSize !== undefined) {
    const min = minGroupSize !== undefined ? parseInt(minGroupSize, 10) : undefined;
    const max = maxGroupSize !== undefined ? parseInt(maxGroupSize, 10) : undefined;
    
    if (min !== undefined && (isNaN(min) || min < 1)) {
      errors.push({ field: 'minGroupSize', code: 'MIN_GROUP_SIZE_INVALID', message: 'Số lượng tối thiểu phải lớn hơn hoặc bằng 1.' });
    }
    if (max !== undefined && isNaN(max)) {
      errors.push({ field: 'maxGroupSize', code: 'MAX_GROUP_SIZE_INVALID', message: 'Số lượng tối đa không hợp lệ.' });
    }
  }

  if (scoringFormula !== undefined && typeof scoringFormula === 'object') {
    const weights = Object.values(scoringFormula);
    const sum = weights.reduce((acc, val) => acc + parseFloat(val || 0), 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      errors.push({ field: 'scoringFormula', code: 'SCORING_FORMULA_INVALID', message: 'Tổng trọng số điểm thành phần phải bằng 1.0.' });
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Thông số chỉnh sửa đợt đồ án không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validatePeriodCreate,
  validatePeriodUpdate,
};
