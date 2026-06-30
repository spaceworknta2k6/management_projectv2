const mongoose = require('mongoose');

const AiJobSchema = new mongoose.Schema({
  feature: {
    type: String,
    enum: ['duplicate_topic', 'topic_suggestion', 'report_feedback'],
    required: true,
  },
  targetType: {
    type: String,
    required: true, // e.g. "ProjectTopic", "Project"
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  inputHash: {
    type: String,
    required: true, // MD5/SHA256 of inputs to check cache hits
    trim: true,
  },
  promptVersion: {
    type: String,
    required: true,
    default: '1.0',
  },
  model: {
    type: String,
    required: true, // e.g. "gemini-1.5-flash"
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'],
    default: 'queued',
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  error: {
    type: String,
    trim: true,
  },
  result: {
    type: mongoose.Schema.Types.Mixed, // Stores the AI structured outcome
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId, // For supervisor or admin override approval
    ref: 'User',
  },
  manualOverride: {
    type: mongoose.Schema.Types.Mixed, // Manual corrections/results
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: { createdAt: true, updatedAt: true },
});

module.exports = mongoose.model('AiJob', AiJobSchema);
