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
    enum: ['SUPERVISOR', 'REVIEWER', 'COMMITTEE_MEMBER'],
    required: true,
  },
  rubricVersion: {
    type: String,
    required: true,
  },
  targetType: {
    type: String,
    enum: ['SUPERVISOR', 'REVIEWER', 'COMMITTEE_MEMBER', 'NON_DEFENSE_MARKER', 'RECHECK'],
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
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
    required: true,
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
    required: true, // e.g. "COMMITTEE_CHAIR", "REVIEWER", "SUPERVISOR"
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
  version: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Enforce unique grading scorecards: one sheet per target per grader
ScoreSheetSchema.index({ targetType: 1, targetId: 1, graderId: 1 }, { unique: true });

module.exports = mongoose.model('ScoreSheet', ScoreSheetSchema);
