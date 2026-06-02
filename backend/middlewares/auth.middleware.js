const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Lecturer = require('../models/Lecturer');

// Protect route against unauthenticated users
const protect = async (req, res, next) => {
  let token;

  // Retrieve token from Authorization header (Bearer <token>)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized! No token provided in headers.',
    });
  }

  try {
    // Verify token payload integrity
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_should_be_at_least_32_characters');

    // Retrieve corresponding User and check status constraints
    const user = await User.findById(decoded.id || decoded.userId);
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
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      status: user.status,
    };

    // Proactively query specific role profiles
    if (user.roles.includes('STUDENT')) {
      const student = await Student.findOne({ userId: user._id, isDeleted: false });
      if (student) {
        req.user.studentId = student._id;
        req.user.studentCode = student.studentCode;
      }
    }

    if (user.roles.includes('LECTURER') || user.roles.includes('DEPARTMENT_STAFF')) {
      const lecturer = await Lecturer.findOne({ userId: user._id, isDeleted: false });
      if (lecturer) {
        req.user.lecturerId = lecturer._id;
        req.user.lecturerCode = lecturer.lecturerCode;
      }
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
