const mongoose = require('mongoose');

const ApprovalBlockSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  at: {
    type: Date,
  },
  note: {
    type: String,
    trim: true,
  },
}, { _id: false });

const TopicChangeRequestSchema = new mongoose.Schema({
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectTopic',
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
  oldTitle: {
    type: String,
    required: true,
    trim: true,
  },
  newTitle: {
    type: String,
    required: true,
    trim: true,
  },
  newScope: {
    type: String,
    required: true,
    trim: true,
  },
  newPlan: {
    type: String,
    required: true,
    trim: true,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  supervisorApproval: {
    type: ApprovalBlockSchema,
    default: () => ({}),
  },
  facultyApproval: {
    type: ApprovalBlockSchema,
    default: () => ({}),
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired', 'cancelled'],
    default: 'pending',
  },
  cancelledAt: {
    type: Date,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

TopicChangeRequestSchema.pre('validate', function () {
  if (!this.ownerType && this.groupId) this.ownerType = 'group';
  if (!this.ownerId && this.ownerType === 'group' && this.groupId) this.ownerId = this.groupId;
  if (!this.ownerId && this.ownerType === 'student' && this.studentId) this.ownerId = this.studentId;
  if (!this.studentId && this.ownerType === 'student' && this.ownerId) this.studentId = this.ownerId;
});

TopicChangeRequestSchema.index(
  { topicId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('TopicChangeRequest', TopicChangeRequestSchema);
module.exports.ApprovalBlockSchema = ApprovalBlockSchema; // Export for potential reuse in other models
