const mongoose = require('mongoose');
const { ACADEMIC_UNITS } = require('../constants/academic-units');

const ProjectPeriodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  schoolYear: {
    type: String,
    required: true,
    trim: true, // e.g. "2025-2026"
  },
  semester: {
    type: String,
    required: true,
    trim: true, // e.g. "Học kỳ II"
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  type: {
    type: String,
    enum: ['foundation_project', 'interdisciplinary_project'],
    required: false,
  },
  courseCode: {
    type: String,
    required: false,
    trim: true,
  },
  courseName: {
    type: String,
    required: false,
    trim: true,
  },
  projectType: {
    type: String,
    enum: ['foundation', 'interdisciplinary'],
    required: false,
  },
  academicUnit: {
    type: String,
    enum: ACADEMIC_UNITS,
    default: 'computer_science',
  },
  programId: {
    type: String,
    required: false,
  },
  programName: {
    type: String,
    required: false,
  },
  coordinatorLecturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
    required: false,
  },
  allowIndividual: {
    type: Boolean,
    default: true,
  },
  allowGroup: {
    type: Boolean,
    default: true,
  },
  groupMinSize: {
    type: Number,
    default: 2,
  },
  groupMaxSize: {
    type: Number,
    default: 5,
  },
  registrationStart: {
    type: Date,
    required: true,
  },
  registrationEnd: {
    type: Date,
    required: true,
  },
  projectStart: {
    type: Date,
    required: true,
  },
  projectEnd: {
    type: Date,
    required: true,
  },
  preDefenseSubmissionDeadline: {
    type: Date,
    required: false,
  },
  defenseStart: {
    type: Date,
    required: false,
  },
  defenseEnd: {
    type: Date,
    required: false,
  },
  postDefenseRevisionDeadline: {
    type: Date,
    required: false,
  },
  archiveDeadline: {
    type: Date,
    required: false,
  },
  finalSubmissionDeadline: {
    type: Date,
    required: false,
  },
  gradingStart: {
    type: Date,
    required: false,
  },
  gradingEnd: {
    type: Date,
    required: false,
  },
  appealDaysAfterPublish: {
    type: Number,
    default: 7,
  },
  appealProcessingDays: {
    type: Number,
    default: 7,
  },
  resultPublishedAt: {
    type: Date,
    required: false,
  },
  minGroupSize: {
    type: Number,
    required: true,
    default: 1,
  },
  maxGroupSize: {
    type: Number,
    required: true,
    default: 3,
  },
  topicChangeDeadline: {
    type: Date,
    required: true,
  },
  varianceThreshold: {
    type: Number,
    required: true,
    default: 2.0,
  },
  passScore: {
    type: Number,
    required: true,
    default: 5.0,
  },
  rubricVersion: {
    type: String,
    required: true,
  },
  rubricId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvaluationRubric',
  },
  scoringFormula: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'registration_open', 'topic_review', 'in_progress', 'defense', 'scoring', 'grading', 'results_published', 'appeal_open', 'result_locked', 'archived', 'cancelled'],
    default: 'draft',
  },
  lockedAt: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

ProjectPeriodSchema.pre(/^find/, function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('ProjectPeriod', ProjectPeriodSchema);
