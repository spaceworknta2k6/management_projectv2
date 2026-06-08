const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
    required: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
    required: true,
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectTopic',
    required: true,
  },
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
    required: true,
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
  },
  status: {
    type: String,
    enum: [
      'assigned',
      'in_progress',
      'pre_defense_submitted',
      'supervisor_reviewed',
      'reviewer_reviewed',
      'defense_eligible',
      'scheduled',
      'defended',
      'post_defense_revision',
      'archived',
      'finalized',
      'failed',
      'cancelled'
    ],
    default: 'assigned',
  },
  extendedUntil: {
    type: Date,
  },
  finalGradeId: {
    type: mongoose.Schema.Types.ObjectId, // Link to FinalGrade
  },
  lockedAt: {
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

// A group can only have one active (non-cancelled) project in a given period
ProjectSchema.index(
  { periodId: 1, groupId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { status: { $ne: 'cancelled' }, isDeleted: false } 
  }
);

ProjectSchema.pre(/^find/, function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('Project', ProjectSchema);
