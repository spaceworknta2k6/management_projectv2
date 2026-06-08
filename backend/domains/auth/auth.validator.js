// Validation rules for auth requests matching the standard in VALIDATION.md

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || email.trim() === '') {
    errors.push({
      field: 'email',
      code: 'EMAIL_REQUIRED',
      message: 'Email là bắt buộc và không được để trống.',
    });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push({
        field: 'email',
        code: 'EMAIL_INVALID',
        message: 'Định dạng email không hợp lệ.',
      });
    }
  }

  if (!password || typeof password !== 'string' || password.trim() === '') {
    errors.push({
      field: 'password',
      code: 'PASSWORD_REQUIRED',
      message: 'Mật khẩu là bắt buộc và không được để trống.',
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu đăng nhập không hợp lệ',
      errors,
    });
  }

  next();
};

const validateChangePassword = (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const errors = [];

  if (!oldPassword || typeof oldPassword !== 'string' || oldPassword.trim() === '') {
    errors.push({
      field: 'oldPassword',
      code: 'OLD_PASSWORD_REQUIRED',
      message: 'Mật khẩu cũ là bắt buộc.',
    });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim() === '') {
    errors.push({
      field: 'newPassword',
      code: 'NEW_PASSWORD_REQUIRED',
      message: 'Mật khẩu mới là bắt buộc.',
    });
  } else if (newPassword.length < 6) {
    errors.push({
      field: 'newPassword',
      code: 'NEW_PASSWORD_TOO_SHORT',
      message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu thay đổi mật khẩu không hợp lệ',
      errors,
    });
  }

  next();
};

const validateUpdateMe = (req, res, next) => {
  const { fullName, phoneNumber = '', cohort = '' } = req.body;
  const errors = [];

  if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
    errors.push({
      field: 'fullName',
      code: 'FULL_NAME_REQUIRED',
      message: 'Họ tên là bắt buộc.',
    });
  }

  if (phoneNumber && (typeof phoneNumber !== 'string' || !/^[0-9+\-\s().]{8,20}$/.test(phoneNumber.trim()))) {
    errors.push({
      field: 'phoneNumber',
      code: 'PHONE_INVALID',
      message: 'Số điện thoại không hợp lệ.',
    });
  }

  if (cohort && (typeof cohort !== 'string' || !/^K\d{1,3}$/i.test(cohort.trim()))) {
    errors.push({
      field: 'cohort',
      code: 'COHORT_INVALID',
      message: 'Khóa học phải có dạng K18, K67...',
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu thông tin cá nhân không hợp lệ',
      errors,
    });
  }

  next();
};

module.exports = {
  validateLogin,
  validateChangePassword,
  validateUpdateMe,
};
