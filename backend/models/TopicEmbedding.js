const mongoose = require('mongoose');

const TopicEmbeddingSchema = new mongoose.Schema({
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectTopic',
    required: true,
    unique: true, // Only one embedding vector record per topic
  },
  embeddingVector: {
    type: [Number],
    required: true, // Vector weights array (e.g. 768 elements)
  },
  keywords: {
    type: [String],
    default: [],
  },
  model: {
    type: String,
    required: true, // Embedding model used (e.g. text-embedding-004)
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

module.exports = mongoose.model('TopicEmbedding', TopicEmbeddingSchema);
