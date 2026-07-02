const rateLimit = require('express-rate-limit');

/**
 * Auth limiter: 10 requests / 15 minutes per IP.
 * Protects login against brute-force attempts.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Qua nhieu lan thu dang nhap. Vui long thu lai sau 15 phut.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Upload limiter: 30 requests / minute per IP.
 * Reduces storage flooding on file upload endpoints.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Qua nhieu yeu cau tai len. Vui long thu lai sau.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { authLimiter, uploadLimiter };
