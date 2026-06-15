const mongoose = require('mongoose');

const RubricCriteriaSchema = new mongoose.Schema({
  criteriaCode: {
    type: String,
    required: true,
    trim: true, // e.g. "C1", "C2"
  },
  criteriaName: {
    type: String,
    required: true,
    trim: true,
  },
  maxScore: {
    type: Number,
    required: true,
    min: 0,
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
    default: 1.0,
  },
}, { _id: false });

const EvaluationRubricSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  version: {
    type: String,
    required: true,
    trim: true, // e.g. "1.0"
  },
  criteria: {
    SUPERVISOR: {
      type: [RubricCriteriaSchema],
      default: [],
    },
    REVIEWER: {
      type: [RubricCriteriaSchema],
      default: [],
    },
    COMMITTEE_MEMBER: {
      type: [RubricCriteriaSchema],
      default: [],
    },
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('EvaluationRubric', EvaluationRubricSchema);
