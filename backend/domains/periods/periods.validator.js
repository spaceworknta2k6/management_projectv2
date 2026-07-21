const { isObjectId } = require('../../utils/object-id');
const { ACADEMIC_UNITS } = require('../../constants/academic-units');

const VALID_SEMESTERS = ['1', '2', '3'];

const normalizeSemester = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === '3' || raw === 'iii' || raw.includes('học kỳ iii') || raw.includes('hoc ky iii')) return '3';
  if (raw === '2' || raw === 'ii' || raw.includes('học kỳ ii') || raw.includes('hoc ky ii')) return '2';
  if (raw === '1' || raw === 'i' || raw.includes('học kỳ i') || raw.includes('hoc ky i')) return '1';
  return String(value || '').trim();
};

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
    revisionDeadline,
    archiveDeadline,
    minGroupSize,
    maxGroupSize,
    topicChangeDeadline,
    varianceThreshold,
    passScore,
    rubricVersion,
    rubricId,
    scoringFormula,
    // new fields
    courseCode,
    courseName,
    projectType,
    coordinatorLecturerId,
    cohort,
    classCount,
    courseOfferingCode,
    allowIndividual,
    allowGroup,
    groupMinSize,
    groupMaxSize,
    finalSubmissionDeadline,
    gradingStart,
    gradingEnd,
    academicUnit,
  } = req.body;

  const errors = [];
  if (!req.body.academicUnit) {
    req.body.academicUnit = 'computer_science';
  }

  if (rubricId !== undefined && rubricId !== null && rubricId !== '') {
    if (!isObjectId(rubricId)) {
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
  if (semester && typeof semester === 'string' && semester.trim() !== '') {
    req.body.semester = normalizeSemester(semester);
    if (!VALID_SEMESTERS.includes(req.body.semester)) {
      errors.push({ field: 'semester', code: 'SEMESTER_INVALID', message: 'Hoc ky chi duoc phep la 1, 2 hoac 3.' });
    }
  }

  const effectiveAcademicUnit = req.body.academicUnit;
  if (!effectiveAcademicUnit || !ACADEMIC_UNITS.includes(effectiveAcademicUnit)) {
    errors.push({ field: 'academicUnit', code: 'ACADEMIC_UNIT_INVALID', message: 'Khoa/đơn vị chuyên môn phụ trách không hợp lệ.' });
  }

  const isOfferingFlow = courseCode !== undefined || coordinatorLecturerId !== undefined || projectType !== undefined || classCount !== undefined;

  if (isOfferingFlow) {
    if (!courseCode || typeof courseCode !== 'string' || courseCode.trim() === '') {
      errors.push({ field: 'courseCode', code: 'COURSE_CODE_REQUIRED', message: 'Mã học phần là bắt buộc.' });
    }
    if (!courseName || typeof courseName !== 'string' || courseName.trim() === '') {
      errors.push({ field: 'courseName', code: 'COURSE_NAME_REQUIRED', message: 'Tên học phần là bắt buộc.' });
    }
    if (coordinatorLecturerId && !isObjectId(coordinatorLecturerId)) {
      errors.push({ field: 'coordinatorLecturerId', code: 'COORDINATOR_LECTURER_ID_INVALID', message: 'Giảng viên phụ trách học phần không hợp lệ.' });
    }
    if (classCount !== undefined) {
      const parsedClassCount = parseInt(classCount, 10);
      if (isNaN(parsedClassCount) || parsedClassCount < 1 || parsedClassCount > 50) {
        errors.push({ field: 'classCount', code: 'CLASS_COUNT_INVALID', message: 'So lop hoc phan phai tu 1 den 50.' });
      }
      if (!cohort || typeof cohort !== 'string' || !/^K\d{1,3}$/i.test(cohort.trim())) {
        errors.push({ field: 'cohort', code: 'COHORT_REQUIRED', message: 'Khoa sinh vien phai co dang K17, K18...' });
      }
    }
    if (courseOfferingCode !== undefined && (typeof courseOfferingCode !== 'string' || courseOfferingCode.trim() === '')) {
      errors.push({ field: 'courseOfferingCode', code: 'COURSE_OFFERING_CODE_INVALID', message: 'Ma dot hoc phan khong hop le.' });
    }
    if (allowIndividual === false && allowGroup === false) {
      errors.push({ field: 'allowIndividual', code: 'INDIVIDUAL_AND_GROUP_DISABLED', message: 'Học phần phải cho phép ít nhất làm cá nhân hoặc làm nhóm.' });
    }
    if (allowGroup !== false) {
      const minG = groupMinSize !== undefined ? parseInt(groupMinSize, 10) : 2;
      const maxG = groupMaxSize !== undefined ? parseInt(groupMaxSize, 10) : 5;
      if (isNaN(minG) || minG < 2) {
        errors.push({ field: 'groupMinSize', code: 'GROUP_MIN_SIZE_INVALID', message: 'Số lượng thành viên tối thiểu của nhóm phải lớn hơn hoặc bằng 2.' });
      }
      if (isNaN(maxG) || maxG < minG) {
        errors.push({ field: 'groupMaxSize', code: 'GROUP_MAX_SIZE_INVALID', message: 'Số lượng thành viên tối đa phải lớn hơn hoặc bằng số lượng tối thiểu.' });
      }
    }
  } else {
    if (!type || !['foundation_project', 'interdisciplinary_project'].includes(type)) {
      errors.push({ field: 'type', code: 'PERIOD_TYPE_INVALID', message: 'Loại đợt đồ án phải là foundation_project hoặc interdisciplinary_project.' });
    }
    const min = parseInt(minGroupSize, 10);
    const max = parseInt(maxGroupSize, 10);
    if (isNaN(min) || min < 1) {
      errors.push({ field: 'minGroupSize', code: 'MIN_GROUP_SIZE_INVALID', message: 'Số lượng thành viên tối thiểu phải lớn hơn hoặc bằng 1.' });
    }
    if (isNaN(max) || max < min) {
      errors.push({ field: 'maxGroupSize', code: 'MAX_GROUP_SIZE_INVALID', message: 'Số lượng thành viên tối đa phải lớn hơn hoặc bằng số lượng tối thiểu.' });
    }
  }

  // 3. Scoring Formulas presence and validity checks
  if (!rubricVersion || typeof rubricVersion !== 'string' || rubricVersion.trim() === '') {
    errors.push({ field: 'rubricVersion', code: 'RUBRIC_VERSION_REQUIRED', message: 'Phiên bản tiêu chí chấm (rubric) là bắt buộc.' });
  }
  if (!scoringFormula || typeof scoringFormula !== 'object') {
    errors.push({ field: 'scoringFormula', code: 'SCORING_FORMULA_REQUIRED', message: 'Công thức tính điểm là bắt buộc.' });
  } else {
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
  };

  if (finalSubmissionDeadline) dates.finalSubmissionDeadline = new Date(finalSubmissionDeadline);
  if (gradingStart) dates.gradingStart = new Date(gradingStart);
  if (gradingEnd) dates.gradingEnd = new Date(gradingEnd);
  if (revisionDeadline) dates.revisionDeadline = new Date(revisionDeadline);
  if (archiveDeadline) dates.archiveDeadline = new Date(archiveDeadline);

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
    
    if (dates.finalSubmissionDeadline && dates.projectEnd < dates.finalSubmissionDeadline) {
      errors.push({ field: 'finalSubmissionDeadline', code: 'FINAL_SUBMISSION_DEADLINE_AFTER_PROJECT_END', message: 'Hạn nộp báo cáo cuối cùng phải diễn ra trước khi kết thúc đợt đồ án.' });
    }
    if (dates.finalSubmissionDeadline && dates.gradingStart && dates.finalSubmissionDeadline >= dates.gradingStart) {
      errors.push({ field: 'gradingStart', code: 'GRADING_START_BEFORE_SUBMISSION_DEADLINE', message: 'Thời gian bắt đầu chấm điểm phải diễn ra sau hạn nộp báo cáo.' });
    }
    if (dates.gradingStart && dates.gradingEnd && dates.gradingStart >= dates.gradingEnd) {
      errors.push({ field: 'gradingEnd', code: 'GRADING_END_BEFORE_START', message: 'Thời gian kết thúc chấm điểm phải sau thời gian bắt đầu chấm điểm.' });
    }
    if (dates.gradingEnd && dates.revisionDeadline && dates.gradingEnd >= dates.revisionDeadline) {
      errors.push({ field: 'revisionDeadline', code: 'REVISION_DEADLINE_BEFORE_GRADING_END', message: 'Hạn chỉnh sửa sau báo cáo phải sau thời gian kết thúc chấm điểm.' });
    }
    if (dates.revisionDeadline && dates.archiveDeadline && dates.revisionDeadline >= dates.archiveDeadline) {
      errors.push({ field: 'archiveDeadline', code: 'ARCHIVE_DEADLINE_BEFORE_REVISION_END', message: 'Hạn nộp báo cáo lưu trữ phải sau hạn chỉnh sửa sau báo cáo.' });
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
  const { minGroupSize, maxGroupSize, scoringFormula, rubricId, groupMinSize, groupMaxSize, academicUnit, semester } = req.body;
  const errors = [];

  if (semester !== undefined) {
    req.body.semester = normalizeSemester(semester);
    if (!VALID_SEMESTERS.includes(req.body.semester)) {
      errors.push({ field: 'semester', code: 'SEMESTER_INVALID', message: 'Hoc ky chi duoc phep la 1, 2 hoac 3.' });
    }
  }

  if (rubricId !== undefined && rubricId !== null && rubricId !== '') {
    if (!isObjectId(rubricId)) {
      errors.push({ field: 'rubricId', code: 'RUBRIC_ID_INVALID', message: 'Mã tiêu chí đánh giá (rubricId) không hợp lệ.' });
    }
  }

  if (academicUnit !== undefined && !ACADEMIC_UNITS.includes(academicUnit)) {
    errors.push({ field: 'academicUnit', code: 'ACADEMIC_UNIT_INVALID', message: 'Khoa/đơn vị chuyên môn phụ trách không hợp lệ.' });
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

  if (groupMinSize !== undefined || groupMaxSize !== undefined) {
    const min = groupMinSize !== undefined ? parseInt(groupMinSize, 10) : undefined;
    const max = groupMaxSize !== undefined ? parseInt(groupMaxSize, 10) : undefined;
    
    if (min !== undefined && (isNaN(min) || min < 2)) {
      errors.push({ field: 'groupMinSize', code: 'GROUP_MIN_SIZE_INVALID', message: 'Số lượng tối thiểu phải lớn hơn hoặc bằng 2.' });
    }
    if (max !== undefined && isNaN(max)) {
      errors.push({ field: 'groupMaxSize', code: 'GROUP_MAX_SIZE_INVALID', message: 'Số lượng tối đa không hợp lệ.' });
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
