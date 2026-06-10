const mongoose = require('mongoose');

const ReadReceiptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  readAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const ChatMessageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
    index: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4000,
  },
  readBy: {
    type: [ReadReceiptSchema],
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
  timestamps: { createdAt: true, updatedAt: false },
});

ChatMessageSchema.index({ roomId: 1, createdAt: -1, isDeleted: 1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
