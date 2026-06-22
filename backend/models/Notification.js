const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    required: true, // e.g. "TOPIC_APPROVED", "MILESTONE_DEADLINE_NEAR"
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    required: true,
    trim: true,
  },
  entityType: {
    type: String, // e.g. "Project", "ProjectTopic", "ExtensionRequest"
    trim: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  actionUrl: {
    type: String,
    trim: true, // Link to redirect user inside Frontend
  },
  deadlineAt: {
    type: Date, // If action requires urgent reply before a date
  },
  readAt: {
    type: Date, // Timestamp when user opens/reads the alert
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
  timestamps: { createdAt: true, updatedAt: false },
});

// Index to quickly fetch unread notifications for a user in chronological order
NotificationSchema.index({ recipientId: 1, isDeleted: 1, readAt: 1, createdAt: -1 });

NotificationSchema.pre(/^find/, function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);
