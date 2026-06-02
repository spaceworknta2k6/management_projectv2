const mongoose = require('mongoose');

const FileAssetSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  storageKey: {
    type: String,
    required: true, // Cloudinary identifier or local path key
    trim: true,
  },
  mimeClient: {
    type: String,
    required: true, // MIME claimed by client browser
  },
  mimeVerified: {
    type: String, // MIME verified by server-side magic number analysis
  },
  size: {
    type: Number,
    required: true, // File size in bytes
  },
  sha256: {
    type: String, // Integrity hash check
    trim: true,
  },
  ownerType: {
    type: String, // e.g. "project", "milestone", "submission"
    trim: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  scanStatus: {
    type: String,
    enum: ['pending', 'clean', 'infected', 'failed'],
    default: 'pending',
  },
  accessPolicy: {
    type: String,
    enum: ['private', 'role_scoped', 'signed_url_only'],
    default: 'private',
  },
  metadata: {
    type: mongoose.Schema.Types.Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: { createdAt: true, updatedAt: false }, // Only log upload timestamps
});

module.exports = mongoose.model('FileAsset', FileAssetSchema);
