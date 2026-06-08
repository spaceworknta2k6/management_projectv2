const mongoose = require('mongoose');

const IncidentReportSchema = new mongoose.Schema({
  reportedAt: {
    type: Date,
    default: Date.now,
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['power', 'network', 'device', 'health', 'other'],
    required: true,
  },
  evidenceFileIds: {
    type: [mongoose.Schema.Types.ObjectId], // References to FileAsset
    default: [],
  },
  accepted: {
    type: Boolean,
    default: false,
  },
  resolution: {
    type: String,
    trim: true,
  },
}, { _id: false });

const DefenseSessionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
    required: true,
  },
  committeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Committee',
    required: true,
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
  },
  mode: {
    type: String,
    enum: ['offline', 'online'],
    required: true,
  },
  room: {
    type: String,
    trim: true, // Offline room name (e.g. "C2-402")
  },
  meetingUrl: {
    type: String,
    trim: true, // Online MS Teams/Zoom link
  },
  recordingUrl: {
    type: String,
    trim: true,
  },
  defenseDate: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true, // e.g. "08:00"
  },
  endTime: {
    type: String,
    required: true, // e.g. "08:45"
  },
  orderNumber: {
    type: Number,
    required: true,
  },
  identityChecked: {
    type: Boolean,
    default: false,
  },
  identityCheckedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'],
    default: 'scheduled',
  },
  incidentReports: {
    type: [IncidentReportSchema],
    default: [],
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

module.exports = mongoose.model('DefenseSession', DefenseSessionSchema);
