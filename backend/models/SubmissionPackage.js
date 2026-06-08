const mongoose = require('mongoose');

const PackageItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'report_pdf', 
      'slide', 
      'source_code', 
      'demo_video', 
      'product_file', 
      'supervisor_review_form', 
      'reviewer_review_form', 
      'score_sheet', 
      'minutes', 
      'revision_explanation', 
      'install_guide', 
      'other_form'
    ],
    required: true,
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId, // Link to FileAsset
  },
  required: {
    type: Boolean,
    default: true,
  },
  status: {
    type: String,
    enum: ['missing', 'submitted', 'accepted', 'rejected'],
    default: 'missing',
  },
}, { _id: false });

const SubmissionPackageSchema = new mongoose.Schema({
  ownerType: {
    type: String,
    enum: ['project', 'defense'],
    required: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
    required: true,
  },
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
    required: true,
  },
  phase: {
    type: String,
    enum: ['proposal', 'progress', 'pre_defense', 'post_defense', 'archive'],
    required: true,
  },
  deadline: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'needs_revision', 'accepted', 'late', 'locked'],
    default: 'draft',
  },
  items: {
    type: [PackageItemSchema],
    default: [],
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  submittedAt: {
    type: Date,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
  lockedAt: {
    type: Date,
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

// A specific project/defense context can have only one package per phase
SubmissionPackageSchema.index(
  { ownerType: 1, ownerId: 1, phase: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

module.exports = mongoose.model('SubmissionPackage', SubmissionPackageSchema);
