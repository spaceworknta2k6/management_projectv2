const mongoose = require('mongoose');

const ProjectRosterSchema = new mongoose.Schema({
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  classSection: {
    type: String,
    required: true,
    trim: true, // Class code/section from registrar's roster
  },
  status: {
    type: String,
    enum: ['active', 'removed'],
    default: 'active',
  },
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  importedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Unique compound index preventing duplicate active registrations in the same period
ProjectRosterSchema.index({ periodId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ProjectRoster', ProjectRosterSchema);
