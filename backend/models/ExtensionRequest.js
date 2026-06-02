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
    enum: ['milestone', 'submission', 'defense_session', 'project'],
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
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
    required: true,
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
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ExtensionRequest', ExtensionRequestSchema);
