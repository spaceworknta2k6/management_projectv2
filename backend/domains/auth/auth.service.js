const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Student = require('../../models/Student');
const Lecturer = require('../../models/Lecturer');

const login = async (email, password) => {
  // Find non-deleted user
  const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
  if (!user) {
    throw { status: 400, message: 'Email hoặc mật khẩu không chính xác.' };
  }

  // Account status validation
  if (user.status === 'locked') {
    throw { status: 403, message: 'Tài khoản của bạn đã bị khóa.' };
  }
  if (user.status === 'inactive') {
    throw { status: 403, message: 'Tài khoản của bạn hiện đang ngưng hoạt động.' };
  }

  // Password matching
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw { status: 400, message: 'Email hoặc mật khẩu không chính xác.' };
  }

  // Proactively find dynamic sub-profiles (Student / Lecturer) to return in payload
  let studentId = undefined;
  let lecturerId = undefined;

  if (user.roles.includes('STUDENT')) {
    const student = await Student.findOne({ userId: user._id, isDeleted: false });
    if (student) studentId = student._id;
  }

  if (user.roles.includes('LECTURER') || user.roles.includes('DEPARTMENT_STAFF')) {
    const lecturer = await Lecturer.findOne({ userId: user._id, isDeleted: false });
    if (lecturer) lecturerId = lecturer._id;
  }

  // Generate stateless JWT Token
  const tokenPayload = {
    id: user._id,
    roles: user.roles,
  };

  const accessToken = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET || 'your_jwt_secret_key_should_be_at_least_32_characters',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    accessToken,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      studentId,
      lecturerId,
    }
  };
};

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw { status: 404, message: 'Người dùng không tồn tại.' };
  }

  // Compare old password hash
  const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isMatch) {
    throw { status: 400, message: 'Mật khẩu cũ không chính xác.' };
  }

  // Hash new password and save
  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  await user.save();

  return { success: true };
};

module.exports = {
  login,
  changePassword,
};
