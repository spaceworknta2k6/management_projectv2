const mongoose = require('mongoose');

const VarianceFlagSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['committee_member_variance', 'supervisor_reviewer_variance', 'marker_variance'],
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
  evaluationMode: {
    type: String,
    enum: ['defense', 'non_defense', 'recheck'],
    default: 'defense',
  },
  componentScores: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    required: true, // e.g. { supervisor: 8.5, reviewer: 9.0, committee: 8.7 }
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

module.exports = mongoose.model('FinalGrade', FinalGradeSchema);
