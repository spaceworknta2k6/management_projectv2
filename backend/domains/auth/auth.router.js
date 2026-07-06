const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const router = express.Router();

const authController = require('./auth.controller');
const authService = require('./auth.service');
const authValidator = require('./auth.validator');
const { protect } = require('../../middlewares/auth.middleware');
const { getJwtSecret } = require('../../config/jwt');
const { authLimiter } = require('../../config/rate-limit');
const prisma = require('../../config/prisma');

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Public Endpoints
router.post('/login', authLimiter, authValidator.validateLogin, authController.login);
router.post('/logout', authController.logout);
router.get('/google', authController.startGoogleLogin);
router.get('/google/callback', authController.handleGoogleCallback);
router.get('/google/session', authController.consumeGoogleSession);

router.post('/refresh', async (req, res, next) => {
  try {
    let refreshToken;
    const cookies = req.headers.cookie || '';
    const tokenPair = cookies
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('karl_refresh_token='));
    
    if (tokenPair) {
      refreshToken = decodeURIComponent(tokenPair.slice('karl_refresh_token='.length));
    }

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Làm mới token thất bại: Không tìm thấy Refresh Token.',
      });
    }

    // Verify Refresh Token
    const decoded = jwt.verify(refreshToken, getJwtSecret());
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Làm mới token thất bại: Refresh Token không hợp lệ.',
      });
    }

    // Find User and check constraints
    const user = await authService.getUserByIdForAuth(decoded.id);
    if (!user || user.isDeleted || user.status === 'locked' || user.status === 'inactive') {
      return res.status(401).json({
        success: false,
        message: 'Làm mới token thất bại: Tài khoản không tồn tại hoặc đã bị khóa.',
      });
    }

    // Generate new Access Token
    const accessToken = jwt.sign(
      { id: user.id, roles: user.roles },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `karl_token=${encodeURIComponent(accessToken)}; HttpOnly; Max-Age=${15 * 60}; SameSite=Lax; Path=/${secure}`
    );

    return res.status(200).json({
      success: true,
      message: 'Làm mới token thành công!',
      data: { accessToken },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Làm mới token thất bại: Refresh Token đã hết hạn hoặc không hợp lệ.',
    });
  }
});

// Protected Endpoints
router.get('/me', protect, authController.getMe);
router.patch('/me', protect, authValidator.validateUpdateMe, authController.updateMe);
router.patch('/me/avatar', protect, avatarUpload.single('avatar'), authController.updateAvatar);
router.post('/change-password', protect, authValidator.validateChangePassword, authController.changePassword);

// Fetch all lecturers
router.get('/lecturers', protect, async (req, res, next) => {
  try {
    const lecturers = await prisma.lecturer.findMany({
      where: { isDeleted: false },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { lecturerCode: 'asc' },
    });

    const data = lecturers.map((lecturer) => ({
      ...lecturer,
      _id: lecturer.id,
      userId: lecturer.user
        ? {
            _id: lecturer.user.id,
            id: lecturer.user.id,
            fullName: lecturer.user.fullName,
            email: lecturer.user.email,
          }
        : lecturer.userId,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
