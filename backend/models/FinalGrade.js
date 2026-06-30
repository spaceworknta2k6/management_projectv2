const mongoose = require('mongoose');

const VarianceFlagSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['supervisor_reviewer_variance', 'marker_variance'],
    required: true,
  },
  maxDifference: {
    type: Number,
    required: true,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedAt: {
    type: Date,
  },
  resolution: {
    type: String,
    trim: true,
  },
}, { _id: false });

const FinalGradeSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true, // Only one aggregated grade record per project
  },
  ownerType: {
    type: String,
    enum: ['student', 'group'],
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
  },
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
    required: true,
  },
  evaluationMode: {
    type: String,
    enum: ['standard', 'recheck'],
    default: 'standard',
  },
  componentScores: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    required: true, // e.g. { supervisor: 8.5, reviewer: 9.0 }
  },
  finalScore: {
    type: Number,
    required: true,
    min: 0,
    max: 10,
  },
  letterGrade: {
    type: String,
    required: true, // e.g. "A", "B+", "C", "F"
    trim: true,
  },
  passStatus: {
    type: String,
    enum: ['passed', 'failed', 'pending', 'cancelled'],
    default: 'pending',
  },
  varianceFlags: {
    type: [VarianceFlagSchema],
    default: [],
  },
  formulaVersion: {
    type: String,
    required: true,
  },
  publishedAt: {
    type: Date,
  },
  lockedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

FinalGradeSchema.pre('validate', function () {
  if (!this.ownerType && this.groupId) this.ownerType = 'group';
  if (!this.ownerId && this.ownerType === 'group' && this.groupId) this.ownerId = this.groupId;
  if (!this.ownerId && this.ownerType === 'student' && this.studentId) this.ownerId = this.studentId;
  if (!this.studentId && this.ownerType === 'student' && this.ownerId) this.studentId = this.ownerId;
});

module.exports = mongoose.model('FinalGrade', FinalGradeSchema);
