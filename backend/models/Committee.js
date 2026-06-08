const mongoose = require('mongoose');

const CommitteeMemberSchema = new mongoose.Schema({
  lecturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
    required: true,
  },
  role: {
    type: String,
    enum: ['COMMITTEE_CHAIR', 'COMMITTEE_SECRETARY', 'REVIEWER', 'COMMITTEE_MEMBER'],
    required: true,
  },
  conflictOfInterestDeclared: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const CommitteeSchema = new mongoose.Schema({
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true, // e.g. "Hội đồng HĐ-03A"
  },
  evaluationMode: {
    type: String,
    enum: ['defense', 'non_defense', 'recheck'],
    default: 'defense',
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  members: {
    type: [CommitteeMemberSchema],
    validate: {
      validator: function (members) {
        return members && members.length >= 3; // Minimum 3 members for institutional board validity
      },
      message: 'A committee must have at least 3 members.',
    },
  },
  status: {
    type: String,
    enum: ['draft', 'approved', 'active', 'finished', 'cancelled'],
    default: 'draft',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
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

module.exports = mongoose.model('Committee', CommitteeSchema);
