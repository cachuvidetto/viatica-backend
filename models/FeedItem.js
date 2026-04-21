const mongoose = require('mongoose');

const feedItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'يجب إدخال عنوان للخبر'],
    trim: true,
  },
  content: {
    type: String,
    required: [true, 'يجب إدخال محتوى للخبر'],
  },
  imageUrl: {
    type: String,
  },
  type: {
    type: String,
    enum: ['news', 'warning', 'tip', 'offer'],
    default: 'news',
  },
  importance: {
    type: String,
    enum: ['normal', 'high'],
    default: 'normal',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true,
});

const FeedItem = mongoose.model('FeedItem', feedItemSchema);
module.exports = FeedItem;
