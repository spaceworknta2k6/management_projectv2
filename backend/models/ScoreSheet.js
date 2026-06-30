const mongoose = require('mongoose');

const CriteriaScoreSchema = new mongoose.Schema({
  criteriaCode: {
    type: String,
    required: true,
    trim: true, // e.g. "C1", "C2"
  },
  criteriaName: {
    type: String,
    required: true,
    trim: true,
  },
  maxScore: {
    type: Number,
    required: true,
    default: 10,
  },
  score: {
    type: Number,
    required: true,
    min: 0,
  },
  weight: {
    type: Number,
    required: true,
    default: 1.0,
  },
}, { _id: false });

const ScoreSheetSchema = new mongoose.Schema({
  rubricId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  rubricRole: {
    type: String,
    enum: ['SUPERVISOR', 'REVIEWER', 'SECOND_MARKER', 'RECHECK'],
    required: true,
  },
  rubricVersion: {
    type: String,
    required: true,
  },
  targetType: {
    type: String,
    enum: ['SUPERVISOR', 'REVIEWER', 'SECOND_MARKER', 'RECHECK'],
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId, // Link to Project or Student
    required: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
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
  graderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
    required: true,
  },
  graderRole: {
    type: String,
    required: true, // e.g. "REVIEWER", "SUPERVISOR", "RECHECK"
  },
  criteriaScores: {
    type: [CriteriaScoreSchema],
    default: [],
  },
  rawTotal: {
    type: Number,
    required: true,
    default: 0,
  },
  roundedTotal: {
    type: Number,
    required: true,
    default: 0,
  },
  comment: {
    type: String,
    trim: true,
  },
  consentForDefense: {
    type: Boolean,
    default: true, // Applicable for supervisor reviews
  },
  lockedAt: {
    type: Date,
  },
  digitalSignature: {
    type: String,
    trim: true,
  },
  version: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

ScoreSheetSchema.pre('validate', function () {
  if (!this.ownerType && this.groupId) this.ownerType = 'group';
  if (!this.ownerId && this.ownerType === 'group' && this.groupId) this.ownerId = this.groupId;
  if (!this.ownerId && this.ownerType === 'student' && this.studentId) this.ownerId = this.studentId;
  if (!this.studentId && this.ownerType === 'student' && this.ownerId) this.studentId = this.ownerId;
});

// Enforce unique grading scorecards: one sheet per target per grader
ScoreSheetSchema.index({ targetType: 1, targetId: 1, graderId: 1 }, { unique: true });

module.exports = mongoose.model('ScoreSheet', ScoreSheetSchema);
