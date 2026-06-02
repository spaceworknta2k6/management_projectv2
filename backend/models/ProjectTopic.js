const mongoose = require('mongoose');

const ProjectTopicSchema = new mongoose.Schema({
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
    required: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
    required: true,
  },
  proposedByStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  summary: {
    type: String,
    required: true,
    trim: true,
  },
  objectives: {
    type: String,
    required: true,
    trim: true,
  },
  scope: {
    type: String,
    required: true,
    trim: true,
  },
  technologies: {
    type: [String],
    default: [],
  },
  expectedResult: {
    type: String,
    required: true,
    trim: true,
  },
  plan: {
    type: String,
    required: true,
    trim: true,
  },
  keywords: {
    type: [String],
    default: [],
  },
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
  },
  proposedSupervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'ai_checked', 'needs_revision', 'approved', 'assigned', 'locked', 'changed', 'cancelled', 'completed'],
    default: 'draft',
  },
  aiDuplicateRisk: {
    checked: { type: Boolean, default: false },
    maxSimilarityScore: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    aiJobId: { type: mongoose.Schema.Types.ObjectId },
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  version: {
    type: Number,
    default: 1,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Partial index: only one active topic per group per period. Allows multiple drafts or cancelled ones.
ProjectTopicSchema.index(
  { periodId: 1, groupId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      isDeleted: false, 
      status: { $in: ['submitted', 'ai_checked', 'needs_revision', 'approved', 'assigned', 'locked', 'completed'] } 
    } 
  }
);

module.exports = mongoose.model('ProjectTopic', ProjectTopicSchema);
