const mongoose = require('mongoose');

const WorkflowEventSchema = new mongoose.Schema({
  entityType: {
    type: String,
    required: true, // e.g. "Project", "ProjectTopic", "SubmissionPackage"
    trim: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  fromStatus: {
    type: String,
    trim: true,
  },
  toStatus: {
    type: String,
    required: true,
    trim: true,
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actorRoles: {
    type: [String],
    default: [], // e.g. ["LECTURER", "SUPERVISOR"] at dynamic action execution time
  },
  action: {
    type: String,
    required: true, // e.g. "APPROVE_TOPIC", "SUBMIT_REPORT"
    trim: true,
  },
  reason: {
    type: String,
    trim: true, // Optional explanation for the transition
  },
  metadata: {
    type: mongoose.Schema.Types.Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
    trim: true,
  },
  userAgent: {
    type: String,
    trim: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false }, // Only log generation timestamp
});

// Compound index to compile and audit transaction history on an entity
WorkflowEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('WorkflowEvent', WorkflowEventSchema);
