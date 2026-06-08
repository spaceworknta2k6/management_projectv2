const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const authController = require('./auth.controller');
const authValidator = require('./auth.validator');
const { protect } = require('../../middlewares/auth.middleware');
const { getJwtSecret } = require('../../config/jwt');

// Public Endpoints
router.post('/login', authValidator.validateLogin, authController.login);
router.post('/logout', authController.logout);
router.get('/google', authController.startGoogleLogin);
router.get('/google/callback', authController.handleGoogleCallback);
router.get('/google/session', authController.consumeGoogleSession);

router.post('/refresh', protect, (req, res, next) => {
  try {
    const accessToken = jwt.sign(
      { id: req.user._id, roles: req.user.roles },
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Lam moi token thanh cong!',
      data: { accessToken },
    });
  } catch (error) {
    next(error);
  }
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
      data: lecturers,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
