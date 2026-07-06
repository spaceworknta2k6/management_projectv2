const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const prisma = require('../../config/prisma');
const { getJwtSecret } = require('../../config/jwt');
const { uploadImageBuffer } = require('../../config/cloudinary');

const ALLOWED_DOMAIN = 'st.phenikaa-uni.edu.vn';

const newObjectId = () => new mongoose.Types.ObjectId().toString();

const normalizeUser = (user) => {
  if (!user) return null;
  return {
    ...user,
    _id: user.id,
    roles: user.roles || [],
  };
};

const getUserByIdForAuth = async (userId) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isDeleted: false,
    },
    include: {
      student: true,
      lecturer: true,
    },
  });

  return normalizeUser(user);
};

const assertActiveUser = (user) => {
  if (!user || user.isDeleted) {
    throw { status: 404, message: 'Người dùng không tồn tại.' };
  }
  if (user.status === 'locked') {
    throw { status: 403, message: 'Tài khoản của bạn đã bị khóa.' };
  }
  if (user.status === 'inactive') {
    throw { status: 403, message: 'Tài khoản của bạn hiện đang ngưng hoạt động.' };
  }
};

const buildAuthResult = async (inputUser) => {
  const user = inputUser.student !== undefined || inputUser.lecturer !== undefined
    ? normalizeUser(inputUser)
    : await getUserByIdForAuth(inputUser.id || inputUser._id);

  assertActiveUser(user);

  let studentId = undefined;
  let lecturerId = undefined;
  let studentCode = undefined;
  let lecturerCode = undefined;
  let cohort = user.cohort || '';

  if (user.roles.includes('STUDENT') && user.student && !user.student.isDeleted) {
    studentId = user.student.id;
    studentCode = user.student.studentCode;
    cohort = cohort || user.student.cohort || '';
  }

  if (user.roles.includes('LECTURER') && user.lecturer && !user.lecturer.isDeleted) {
    lecturerId = user.lecturer.id;
    lecturerCode = user.lecturer.lecturerCode;
  }

  const tokenPayload = {
    id: user.id,
    roles: user.roles,
  };

  const accessToken = jwt.sign(
    tokenPayload,
    getJwtSecret(),
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    getJwtSecret(),
    { expiresIn: '7d' }
  );

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user.id,
      id: user.id,
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

const getFallbackFacultyId = async () => {
  const lecturer = await prisma.lecturer.findFirst({
    where: { isDeleted: false },
    select: { facultyId: true },
  });
  if (lecturer?.facultyId) return lecturer.facultyId;

  const student = await prisma.student.findFirst({
    where: { isDeleted: false },
    select: { facultyId: true },
  });
  return student?.facultyId || newObjectId();
};

const loginWithGoogleEmail = async (email, fullName = '') => {
  const normalizedEmail = email.toLowerCase();

  if (!normalizedEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
    throw {
      status: 403,
      message: `Chỉ tài khoản Google của Phenikaa (@${ALLOWED_DOMAIN}) mới được phép đăng nhập.`,
    };
  }

  let user = await prisma.user.findFirst({
    where: { email: normalizedEmail, isDeleted: false },
    include: { student: true, lecturer: true },
  });

  if (!user) {
    const userId = newObjectId();
    const studentId = newObjectId();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), salt);
    const facultyId = await getFallbackFacultyId();

    const emailPrefix = normalizedEmail.split('@')[0];
    let studentCode = emailPrefix;
    const isCodeExists = await prisma.student.findFirst({
      where: { studentCode, isDeleted: false },
      select: { id: true },
    });
    if (isCodeExists) {
      studentCode = `${emailPrefix}_${Date.now()}`;
    }

    user = await prisma.user.create({
      data: {
        id: userId,
        mongoId: userId,
        fullName: fullName || emailPrefix,
        email: normalizedEmail,
        passwordHash,
        roles: ['STUDENT'],
        status: 'active',
        cohort: 'K67',
        student: {
          create: {
            id: studentId,
            mongoId: studentId,
            studentCode,
            className: 'CNTT-K67',
            cohort: 'K67',
            major: 'Công nghệ thông tin',
            facultyId,
          },
        },
      },
      include: { student: true, lecturer: true },
    });
  }

  assertActiveUser(user);
  return buildAuthResult(user);
};

const login = async (email, password) => {
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      isDeleted: false,
    },
    include: {
      student: true,
      lecturer: true,
    },
  });

  if (!user) {
    throw { status: 400, message: 'Email hoặc mật khẩu không chính xác.' };
  }

  assertActiveUser(user);

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw { status: 400, message: 'Email hoặc mật khẩu không chính xác.' };
  }

  return buildAuthResult(user);
};

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await getUserByIdForAuth(userId);
  assertActiveUser(user);

  const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isMatch) {
    throw { status: 400, message: 'Mật khẩu cũ không chính xác.' };
  }

  const salt = await bcrypt.genSalt(10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, salt),
    },
  });

  return { success: true };
};

const updateProfile = async (userId, { fullName, phoneNumber = '', cohort = '' }) => {
  const currentUser = await getUserByIdForAuth(userId);
  assertActiveUser(currentUser);

  const nextCohort = currentUser.roles.includes('STUDENT')
    ? cohort.trim().toUpperCase()
    : currentUser.cohort;

  const user = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      cohort: nextCohort,
      ...(currentUser.roles.includes('STUDENT') && currentUser.student
        ? { student: { update: { cohort: nextCohort } } }
        : {}),
    },
    include: {
      student: true,
      lecturer: true,
    },
  });

  return buildAuthResult(user);
};

const updateAvatar = async (userId, file) => {
  const user = await getUserByIdForAuth(userId);
  assertActiveUser(user);

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

  const publicId = `${user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const fileName = `${publicId}${extension}`;
  const uploadResult = await uploadImageBuffer(file.buffer, {
    folder: 'management-project/avatars',
    publicId,
    filename: fileName,
  });

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: uploadResult.secure_url },
    include: {
      student: true,
      lecturer: true,
    },
  });

  return buildAuthResult(updatedUser);
};

module.exports = {
  login,
  loginWithGoogleEmail,
  changePassword,
  updateProfile,
  updateAvatar,
  getUserByIdForAuth,
  buildAuthResult,
};
