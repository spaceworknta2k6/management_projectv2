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

const ExtensionRequestSchema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: ['milestone', 'submission', 'project'],
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
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
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  evidenceFileIds: {
    type: [mongoose.Schema.Types.ObjectId], // References to FileAsset
    default: [],
  },
  requestedTo: {
    type: Date,
    required: true, // Requested new deadline
  },
  supervisorApproval: {
    type: ApprovalBlockSchema,
    default: () => ({}),
  },
  facultyDecision: {
    type: ApprovalBlockSchema,
    default: () => ({}),
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

ExtensionRequestSchema.pre('validate', function () {
  if (!this.ownerType && this.groupId) this.ownerType = 'group';
  if (!this.ownerId && this.ownerType === 'group' && this.groupId) this.ownerId = this.groupId;
  if (!this.ownerId && this.ownerType === 'student' && this.studentId) this.ownerId = this.studentId;
  if (!this.studentId && this.ownerType === 'student' && this.ownerId) this.studentId = this.ownerId;
});

ExtensionRequestSchema.index(
  { targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('ExtensionRequest', ExtensionRequestSchema);
