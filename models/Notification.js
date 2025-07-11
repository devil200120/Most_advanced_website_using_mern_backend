// File: c:\Users\KIIT0001\Desktop\exam_site\backend\models\Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['exam-reminder', 'result-published', 'payment-success', 'payment-failed', 'system-update', 'message'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  channels: {
    email: {
      type: Boolean,
      default: false
    },
    sms: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: true
    },
    inApp: {
      type: Boolean,
      default: true
    }
  },
  deliveryStatus: {
    email: {
      sent: Boolean,
      deliveredAt: Date,
      error: String
    },
    sms: {
      sent: Boolean,
      deliveredAt: Date,
      error: String
    },
    push: {
      sent: Boolean,
      deliveredAt: Date,
      error: String
    }
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ createdAt: 1 });
notificationSchema.index({ expiresAt: 1 });

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);