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
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
    required: true,
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
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TopicChangeRequest', TopicChangeRequestSchema);
module.exports.ApprovalBlockSchema = ApprovalBlockSchema; // Export for potential reuse in other models
