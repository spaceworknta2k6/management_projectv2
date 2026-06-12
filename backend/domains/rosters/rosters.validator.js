// Validation rules for roster imports and single student registrations in VALIDATION.md

const validateRosterImport = (req, res, next) => {
  const { roster } = req.body;
  const errors = [];

  if (!roster || !Array.isArray(roster) || roster.length === 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu nhập danh sách trống hoặc không hợp lệ.',
      errors: [{ field: 'roster', code: 'ROSTER_ARRAY_REQUIRED', message: 'Danh sách roster bắt buộc phải là một mảng và không rỗng.' }]
    });
  }

  roster.forEach((student, index) => {
    const { studentCode, classSection, fullName, email } = student;
    
    if (!studentCode || typeof studentCode !== 'string' || studentCode.trim() === '') {
      errors.push({ field: `roster[${index}].studentCode`, code: 'STUDENT_CODE_REQUIRED', message: `MSSV ở dòng thứ ${index + 1} là bắt buộc.` });
    }
    if (!classSection || typeof classSection !== 'string' || classSection.trim() === '') {
      errors.push({ field: `roster[${index}].classSection`, code: 'CLASS_SECTION_REQUIRED', message: `Mã lớp học phần ở dòng thứ ${index + 1} là bắt buộc.` });
    }
    if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
      errors.push({ field: `roster[${index}].fullName`, code: 'FULL_NAME_REQUIRED', message: `Họ và tên ở dòng thứ ${index + 1} là bắt buộc.` });
    }
    if (!email || typeof email !== 'string' || email.trim() === '') {
      errors.push({ field: `roster[${index}].email`, code: 'EMAIL_REQUIRED', message: `Email ở dòng thứ ${index + 1} là bắt buộc.` });
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push({ field: `roster[${index}].email`, code: 'EMAIL_INVALID', message: `Định dạng email ở dòng thứ ${index + 1} không hợp lệ.` });
      }
    }
  });

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Danh sách roster nhập chứa một số phần tử không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateRosterSingleAdd = (req, res, next) => {
  const { studentCode, classSection, fullName, email } = req.body;
  const errors = [];

  if (!studentCode || typeof studentCode !== 'string' || studentCode.trim() === '') {
    errors.push({ field: 'studentCode', code: 'STUDENT_CODE_REQUIRED', message: 'Mã số sinh viên là bắt buộc.' });
  }
  if (!classSection || typeof classSection !== 'string' || classSection.trim() === '') {
    errors.push({ field: 'classSection', code: 'CLASS_SECTION_REQUIRED', message: 'Mã lớp học phần là bắt buộc.' });
  }
  if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
    errors.push({ field: 'fullName', code: 'FULL_NAME_REQUIRED', message: 'Họ và tên là bắt buộc.' });
  }
  if (!email || typeof email !== 'string' || email.trim() === '') {
    errors.push({ field: 'email', code: 'EMAIL_REQUIRED', message: 'Email là bắt buộc.' });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push({ field: 'email', code: 'EMAIL_INVALID', message: 'Định dạng email không hợp lệ.' });
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu đăng ký sinh viên đơn lẻ không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateRosterUpdate = (req, res, next) => {
  const { classSection, fullName, studentCode } = req.body;
  const hasAny = [
    classSection && typeof classSection === 'string' && classSection.trim(),
    fullName && typeof fullName === 'string' && fullName.trim(),
    studentCode && typeof studentCode === 'string' && studentCode.trim(),
  ].some(Boolean);

  if (!hasAny) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu không hợp lệ.',
      errors: [{ field: 'body', code: 'NO_UPDATE_FIELDS', message: 'Phải có ít nhất một trường để cập nhật (fullName, studentCode, classSection).' }],
    });
  }
  next();
};

module.exports = {
  validateRosterImport,
  validateRosterSingleAdd,
  validateRosterUpdate,
};
