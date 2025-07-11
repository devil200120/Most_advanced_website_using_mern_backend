// File: c:\Users\KIIT0001\Desktop\exam_site\backend\models\Setting.js
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isEditable: {
    type: Boolean,
    default: true
  },
  validation: {
    min: Number,
    max: Number,
    required: Boolean,
    pattern: String,
    options: [String]
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
settingSchema.index({ key: 1 });
settingSchema.index({ category: 1 });
settingSchema.index({ isPublic: 1 });

module.exports = mongoose.model('Setting', settingSchema);