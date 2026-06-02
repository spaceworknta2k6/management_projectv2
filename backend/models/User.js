const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  roles: {
    type: [String],
    enum: ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF', 'LECTURER', 'STUDENT'],
    default: ['STUDENT'],
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'locked'],
    default: 'active',
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Unique index on email only for non-deleted users to support soft-deletion duplicate reuse
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

module.exports = mongoose.model('User', UserSchema);
