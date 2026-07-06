const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');
const authService = require('../domains/auth/auth.service');

// Protect route against unauthenticated users
const protect = async (req, res, next) => {
  let token;

  // 1. Prefer Authorization header when the frontend explicitly sends a token.
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 2. Fallback: retrieve token from Cookies (HttpOnly)
  const cookies = req.headers.cookie || '';
  const tokenPair = cookies
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('karl_token='));
  
  if (!token && tokenPair) {
    token = decodeURIComponent(tokenPair.slice('karl_token='.length));
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized! No token provided in cookies or headers.',
    });
  }

  try {
    // Verify token payload integrity
    const decoded = jwt.verify(token, getJwtSecret());

    // Retrieve corresponding User and check status constraints
    const user = await authService.getUserByIdForAuth(decoded.id || decoded.userId);
    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized! The user associated with this token no longer exists.',
      });
    }

    if (user.status === 'locked') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden! This user account has been locked by administration.',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden! This user account is currently inactive.',
      });
    }

    // Attach base user details to request object
    req.user = {
      _id: user.id,
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      status: user.status,
      phoneNumber: user.phoneNumber || '',
      cohort: user.cohort || '',
      avatarUrl: user.avatarUrl || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Proactively query specific role profiles
    if (user.roles.includes('STUDENT') && user.student && !user.student.isDeleted) {
      req.user.studentId = user.student.id;
      req.user.studentCode = user.student.studentCode;
      req.user.cohort = user.cohort || user.student.cohort || '';
    }

    if (user.roles.includes('LECTURER') && user.lecturer && !user.lecturer.isDeleted) {
      req.user.lecturerId = user.lecturer.id;
      req.user.lecturerCode = user.lecturer.lecturerCode;
    }

    next();
  } catch (error) {
    console.error('JWT Token Verification Failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized! Token verification failed or expired.',
    });
  }
};

// Restrict access by global static roles
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized! Authentication check required.',
      });
    }

    // Check if the user carries at least one of the static authorized roles
    const hasAuthorizedRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasAuthorizedRole) {
      return res.status(403).json({
        success: false,
        message: `Forbidden! Requires role: [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};

module.exports = { protect, requireRole };
