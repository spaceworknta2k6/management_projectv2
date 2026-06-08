const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('../../models/User');
const Student = require('../../models/Student');
const Lecturer = require('../../models/Lecturer');
const { getJwtSecret } = require('../../config/jwt');

const buildAuthResult = async (user) => {
  let studentId = undefined;
  let lecturerId = undefined;
  let studentCode = undefined;
  let lecturerCode = undefined;
  let cohort = user.cohort || '';

  if (user.roles.includes('STUDENT')) {
    const student = await Student.findOne({ userId: user._id, isDeleted: false });
    if (student) {
      studentId = student._id;
      studentCode = student.studentCode;
      cohort = cohort || student.cohort || '';
    }
  }

  if (user.roles.includes('LECTURER') || user.roles.includes('DEPARTMENT_STAFF')) {
    const lecturer = await Lecturer.findOne({ userId: user._id, isDeleted: false });
    if (lecturer) {
      lecturerId = lecturer._id;
      lecturerCode = lecturer.lecturerCode;
    }
  }

  const tokenPayload = {
    id: user._id,
    roles: user.roles,
  };

  const accessToken = jwt.sign(
    tokenPayload,
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    accessToken,
    user: {
      _id: user._id,
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      status: user.status,
      phoneNumber: user.phoneNumber || '',
      cohort,
      avatarUrl: user.avatarUrl || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      studentId,
      studentCode,
      lecturerId,
      lecturerCode,
    }
  };
};

const ALLOWED_DOMAIN = 'st.phenikaa-uni.edu.vn';

const loginWithGoogleEmail = async (email, fullName = '') => {
  const normalizedEmail = email.toLowerCase();

  // Chỉ cho phép email nội bộ Phenikaa
  if (!normalizedEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
    throw {
      status: 403,
      message: `Chỉ tài khoản Google của Phenikaa (@${ALLOWED_DOMAIN}) mới được phép đăng nhập.`,
    };
  }

  let user = await User.findOne({ email: normalizedEmail, isDeleted: false });
  if (!user) {
    // Tự động tạo user mới nếu chưa tồn tại
    const salt = await bcrypt.genSalt(10);
    // password ngẫu nhiên vì login qua Google không dùng password
    const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), salt);
    
    // Tìm facultyId từ giảng viên/sinh viên hiện tại để tránh ObjectId ngẫu nhiên không thuộc khoa nào
    let facultyId;
    const existingLecturer = await Lecturer.findOne({ isDeleted: false });
    if (existingLecturer) {
      facultyId = existingLecturer.facultyId;
    } else {
      const existingStudent = await Student.findOne({ isDeleted: false });
      if (existingStudent) {
        facultyId = existingStudent.facultyId;
      } else {
        facultyId = new mongoose.Types.ObjectId();
      }
    }

    user = await User.create({
      fullName: fullName || email.split('@')[0],
      email: normalizedEmail,
      passwordHash,
      roles: ['STUDENT'],
      status: 'active',
      cohort: 'K67',
    });

    // Tạo thông tin Student profile
    const emailPrefix = normalizedEmail.split('@')[0];
    let studentCode = emailPrefix;
    const isCodeExists = await Student.findOne({ studentCode, isDeleted: false });
    if (isCodeExists) {
      studentCode = `${emailPrefix}_${Date.now()}`;
    }

    await Student.create({
      userId: user._id,
      studentCode,
      className: 'CNTT-K67',
      cohort: 'K67',
      major: 'Công nghệ thông tin',
      facultyId,
    });

    // Gửi thông báo cho Admin hệ thống
    try {
      const Notification = require('../../models/Notification');
      const admins = await User.find({ roles: 'SYSTEM_ADMIN', isDeleted: false });
      for (const admin of admins) {
        await Notification.create({
          recipientId: admin._id,
          type: 'USER_REGISTER_GOOGLE',
          title: 'Thành viên mới đăng ký qua Google',
          body: `Tài khoản sinh viên mới ${user.fullName} (${normalizedEmail}) đã tự động đăng ký vào hệ thống qua Google. Vui lòng duyệt lại vai trò nếu cần.`,
          entityType: 'User',
          entityId: user._id,
          actionUrl: '/dashboard/users',
        });
      }
    } catch (notifyErr) {
      console.error('Không gửi được thông báo cho Admin:', notifyErr);
    }
  }

  if (user.status === 'locked') {
    throw { status: 403, message: 'Tài khoản của bạn đã bị khóa.' };
  }
  if (user.status === 'inactive') {
    throw { status: 403, message: 'Tài khoản của bạn hiện đang ngưng hoạt động.' };
  }

  return buildAuthResult(user);
};

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

  return buildAuthResult(user);
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

const updateProfile = async (userId, { fullName, phoneNumber = '', cohort = '' }) => {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw { status: 404, message: 'Người dùng không tồn tại.' };
  }

  user.fullName = fullName.trim();
  user.phoneNumber = phoneNumber.trim();
  if (user.roles.includes('STUDENT')) {
    user.cohort = cohort.trim().toUpperCase();
  }
  await user.save();

  if (user.roles.includes('STUDENT')) {
    await Student.findOneAndUpdate(
      { userId: user._id, isDeleted: false },
      { cohort: user.cohort }
    );
  }

  return buildAuthResult(user);
};

const updateAvatar = async (userId, file) => {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw { status: 404, message: 'Người dùng không tồn tại.' };
  }

  if (!file) {
    throw { status: 400, message: 'Vui lòng chọn ảnh đại diện.' };
  }

  const allowedMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const extension = allowedMime[file.mimetype];
  if (!extension) {
    throw { status: 400, message: 'Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WEBP.' };
  }

  const uploadDir = path.join(__dirname, '../../public/uploads/avatars');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `${user._id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`;
  fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);

  user.avatarUrl = `/public/uploads/avatars/${fileName}`;
  await user.save();

  return buildAuthResult(user);
};

module.exports = {
  login,
  loginWithGoogleEmail,
  changePassword,
  updateProfile,
  updateAvatar,
};
