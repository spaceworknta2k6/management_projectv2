const mongoose = require('mongoose');

const ProjectTopicSchema = new mongoose.Schema({
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
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
  proposedByStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: false,
  },
  createdByRole: {
    type: String,
    enum: ['student', 'lecturer', 'staff'],
    default: 'student',
  },
  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  proposedByLecturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
  },
  approvedByLecturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
  },
  capacityMaxStudents: {
    type: Number,
    default: 1,
  },
  capacityMaxGroups: {
    type: Number,
    default: 1,
  },
  currentStudentCount: {
    type: Number,
    default: 0,
  },
  currentGroupCount: {
    type: Number,
    default: 0,
  },
  allowedOwnerTypes: {
    type: [String],
    enum: ['student', 'group'],
    default: ['student', 'group'],
  },
  allowIndividual: {
    type: Boolean,
  },
  allowGroup: {
    type: Boolean,
  },
  minGroupSize: {
    type: Number,
    required: false,
  },
  maxGroupSize: {
    type: Number,
    required: false,
  },
  publishedByStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  publishedAt: {
    type: Date,
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
    enum: ['draft', 'submitted', 'ai_checked', 'needs_revision', 'approved', 'published', 'assigned', 'locked', 'changed', 'cancelled', 'completed', 'rejected'],
    default: 'draft',
  },
  rejectionReason: {
    type: String,
    trim: true,
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

ProjectTopicSchema.pre('validate', function () {
  if (!this.ownerType && this.groupId) {
    this.ownerType = 'group';
  }

  if (!this.ownerId && this.ownerType === 'group' && this.groupId) {
    this.ownerId = this.groupId;
  }

  if (!this.ownerId && this.ownerType === 'student' && this.studentId) {
    this.ownerId = this.studentId;
  }

  if (!this.studentId && this.ownerType === 'student' && this.ownerId) {
    this.studentId = this.ownerId;
  }
});

// Partial index: only one active topic per owner per period.
ProjectTopicSchema.index(
  { periodId: 1, ownerType: 1, ownerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      ownerType: { $exists: true },
      ownerId: { $exists: true },
      isDeleted: false,
      status: { $in: ['submitted', 'ai_checked', 'needs_revision', 'approved', 'assigned', 'locked', 'changed', 'completed'] }
    }
  }
);

// Partial index: only one active topic per group per period. Allows multiple drafts or cancelled ones.
ProjectTopicSchema.index(
  { periodId: 1, groupId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      groupId: { $exists: true },
      isDeleted: false, 
      status: { $in: ['submitted', 'ai_checked', 'needs_revision', 'approved', 'assigned', 'locked', 'changed', 'completed'] } 
    } 
  }
);

ProjectTopicSchema.pre(/^find/, function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('ProjectTopic', ProjectTopicSchema);
