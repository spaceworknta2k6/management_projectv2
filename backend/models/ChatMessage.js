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

const AttachmentSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileAsset',
    required: true,
  },
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  mimeType: {
    type: String,
    required: true,
    trim: true,
  },
  size: {
    type: Number,
    required: true,
  },
  kind: {
    type: String,
    enum: ['image', 'file'],
    default: 'file',
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
    default: '',
    trim: true,
    maxlength: 4000,
  },
  attachments: {
    type: [AttachmentSchema],
    default: [],
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

ChatMessageSchema.pre('validate', function () {
  const hasBody = Boolean(String(this.body || '').trim());
  const hasAttachments = Array.isArray(this.attachments) && this.attachments.length > 0;
  if (!hasBody && !hasAttachments) {
    this.invalidate('body', 'Tin nhắn cần có nội dung hoặc tệp đính kèm.');
  }
});

ChatMessageSchema.index({ roomId: 1, createdAt: -1, isDeleted: 1 });

ChatMessageSchema.pre(/^find/, function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
