const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  files: {
    type: [{
      filename: String,
      originalName: String,
      path: String,
      type: String
    }],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

knowledgeSchema.index({ title: 'text', description: 'text', content: 'text' });

module.exports = mongoose.model('Knowledge', knowledgeSchema);