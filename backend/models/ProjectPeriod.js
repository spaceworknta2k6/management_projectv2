const mongoose = require('mongoose');

const ProjectPeriodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  schoolYear: {
    type: String,
    required: true,
    trim: true, // e.g. "2025-2026"
  },
  semester: {
    type: String,
    required: true,
    trim: true, // e.g. "Học kỳ II"
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  type: {
    type: String,
    enum: ['foundation_project', 'interdisciplinary_project'],
    required: true,
  },
  registrationStart: {
    type: Date,
    required: true,
  },
  registrationEnd: {
    type: Date,
    required: true,
  },
  projectStart: {
    type: Date,
    required: true,
  },
  projectEnd: {
    type: Date,
    required: true,
  },
  preDefenseSubmissionDeadline: {
    type: Date,
    required: true,
  },
  defenseStart: {
    type: Date,
    required: true,
  },
  defenseEnd: {
    type: Date,
    required: true,
  },
  postDefenseRevisionDeadline: {
    type: Date,
    required: true,
  },
  archiveDeadline: {
    type: Date,
    required: true,
  },
  minGroupSize: {
    type: Number,
    required: true,
    default: 1,
  },
  maxGroupSize: {
    type: Number,
    required: true,
    default: 3,
  },
  topicChangeDeadline: {
    type: Date,
    required: true,
  },
  varianceThreshold: {
    type: Number,
    required: true,
    default: 2.0, // Difference limit in score criteria
  },
  passScore: {
    type: Number,
    required: true,
    default: 5.0, // Out of 10
  },
  rubricVersion: {
    type: String,
    required: true,
  },
  scoringFormula: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    required: true, // e.g. { supervisor: 0.3, reviewer: 0.2, committee: 0.5 }
  },
  status: {
    type: String,
    enum: ['draft', 'registration_open', 'topic_review', 'in_progress', 'defense', 'scoring', 'result_locked', 'archived'],
    default: 'draft',
  },
  lockedAt: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

module.exports = mongoose.model('ProjectPeriod', ProjectPeriodSchema);
