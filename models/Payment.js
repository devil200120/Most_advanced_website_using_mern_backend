// File: c:\Users\KIIT0001\Desktop\exam_site\backend\models\Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise']
    },
    duration: {
      type: Number // in months
    }
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'razorpay', 'paypal'],
    required: true
  },
  paymentIntentId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  transactionId: {
    type: String
  },
  receiptUrl: {
    type: String
  },
  failureReason: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  refund: {
    amount: Number,
    reason: String,
    refundedAt: Date,
    refundId: String
  },
  invoice: {
    number: String,
    url: String,
    generatedAt: Date
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ user: 1 });
paymentSchema.index({ exam: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentIntentId: 1 });
paymentSchema.index({ createdAt: 1 });

// Method to generate invoice number
paymentSchema.methods.generateInvoiceNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  this.invoice.number = `INV-${year}${month}${day}-${random}`;
  return this.invoice.number;
};

module.exports = mongoose.model('Payment', paymentSchema);