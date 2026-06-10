const mongoose = require('mongoose');

const GroupTeacherInviteSchema = new mongoose.Schema({
  lecturerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  respondedAt: {
    type: Date,
  },
}, { _id: false });

const ChatRoomSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['group', 'direct'],
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectGroup',
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'accepted', 'rejected'],
    default: 'active',
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  acceptedAt: {
    type: Date,
  },
  memberIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  groupTeacherInvites: {
    type: [GroupTeacherInviteSchema],
    default: [],
  },
  lastMessageAt: {
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

ChatRoomSchema.index(
  { type: 1, groupId: 1 },
  { unique: true, partialFilterExpression: { type: 'group', isDeleted: false } }
);
ChatRoomSchema.index(
  { type: 1, memberIds: 1 },
  { partialFilterExpression: { type: 'direct', isDeleted: false } }
);
ChatRoomSchema.index({ memberIds: 1, isDeleted: 1, lastMessageAt: -1 });

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);
