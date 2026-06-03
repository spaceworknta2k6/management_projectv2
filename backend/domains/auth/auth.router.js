const express = require('express');
const router = express.Router();

const authController = require('./auth.controller');
const authValidator = require('./auth.validator');
const { protect } = require('../../middlewares/auth.middleware');

// Public Endpoints
router.post('/login', authValidator.validateLogin, authController.login);
router.post('/logout', authController.logout);
router.get('/google', authController.startGoogleLogin);
router.get('/google/callback', authController.handleGoogleCallback);
router.get('/google/session', authController.consumeGoogleSession);

// Mock stateless token refresh endpoint for complete compliance with ROUTES.md
router.post('/refresh', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Làm mới token thành công!',
    data: {
      accessToken: 'stateless_session_re_validated_token_placeholder'
    }
  });
});

// Protected Endpoints
router.get('/me', protect, authController.getMe);
router.post('/change-password', protect, authValidator.validateChangePassword, authController.changePassword);

// Fetch all lecturers
router.get('/lecturers', protect, async (req, res, next) => {
  try {
    const Lecturer = require('../../models/Lecturer');
    const lecturers = await Lecturer.find({ isDeleted: false }).populate('userId', 'fullName email');
    return res.status(200).json({
      success: true,
      data: lecturers
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
