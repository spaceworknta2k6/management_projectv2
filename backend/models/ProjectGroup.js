const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  role: {
    type: String,
    default: 'MEMBER', // e.g. "LEADER", "DEVELOPER", "RESEARCHER"
  },
  contributionWeight: {
    type: Number,
    required: true,
    default: 1.0, // Multiplier for scoring split calculations
  },
  status: {
    type: String,
    enum: ['invited', 'accepted', 'removed'],
    default: 'invited',
  },
}, { _id: false });

const ProjectGroupSchema = new mongoose.Schema({
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true, // e.g. "DA-042"
  },
  leaderStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  members: {
    type: [MemberSchema],
    validate: {
      validator: function (members) {
        return members && members.length > 0;
      },
      message: 'Group must contain at least one member.',
    },
  },
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'locked', 'cancelled'],
    default: 'draft',
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Index to quickly search active groups inside a cohort period
ProjectGroupSchema.index({ periodId: 1, status: 1 });
ProjectGroupSchema.index({ periodId: 1, isDeleted: 1 });

module.exports = mongoose.model('ProjectGroup', ProjectGroupSchema);
