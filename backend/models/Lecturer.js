const mongoose = require('mongoose');

const LecturerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Strict 1-to-1 linkage
  },
  lecturerCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  academicDegree: {
    type: String,
    enum: ['bachelor', 'master', 'phd', 'professor', 'associate_professor'],
    default: 'master',
  },
  expertise: {
    type: [String],
    default: [],
  },
  maxProjects: {
    type: Number,
    required: true,
    default: 5, // Capacity constraint for project guidelines
  },
  isExternal: {
    type: Boolean,
    default: false,
  },
  organization: {
    type: String,
    trim: true,
    default: 'PHENIKAA',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
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

LecturerSchema.pre(/^find/, function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('Lecturer', LecturerSchema);
