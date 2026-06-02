const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fileIds: {
    type: [mongoose.Schema.Types.ObjectId], // Reference to FileAsset
    default: [],
  },
  note: {
    type: String,
    trim: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const FeedbackSchema = new mongoose.Schema({
  lecturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
    required: true,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['accepted', 'needs_revision', 'rejected'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const MilestoneSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true, // e.g. "Báo cáo giữa kỳ"
  },
  description: {
    type: String,
    trim: true,
  },
  deadline: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'submitted', 'accepted', 'needs_revision', 'late', 'locked'],
    default: 'open',
  },
  submissions: {
    type: [SubmissionSchema],
    default: [],
  },
  feedback: {
    type: [FeedbackSchema],
    default: [],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Milestone', MilestoneSchema);
