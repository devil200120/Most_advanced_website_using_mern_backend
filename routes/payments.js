// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\payments.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Exam = require('../models/Exam');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Add this route at the beginning of the file, after the router initialization

// Get all payments for user
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let query = { user: req.user._id };
    if (status) query.status = status;
    
    const payments = await Payment.find(query)
      .populate('exam', 'title subject')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Payment.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        payments,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    logger.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create a new payment
router.post('/', auth, [
  body('amount').isNumeric().withMessage('Amount is required'),
  body('paymentMethod').isIn(['stripe', 'razorpay', 'paypal']).withMessage('Invalid payment method'),
  body('type').isIn(['exam', 'subscription']).withMessage('Invalid payment type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { amount, paymentMethod, type, examId, subscriptionPlan } = req.body;
    
    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      amount,
      paymentMethod,
      type,
      exam: examId || null,
      subscriptionPlan: subscriptionPlan || null,
      status: 'pending'
    });
    
    await payment.save();
    
    res.json({
      success: true,
      message: 'Payment created successfully',
      data: { payment }
    });
  } catch (error) {
    logger.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
// Create Stripe payment intent
router.post('/stripe/create-intent', auth, [
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  body('currency').optional().isString().withMessage('Currency must be a string'),
  body('examId').optional().isMongoId().withMessage('Valid exam ID required'),
  body('subscriptionPlan').optional().isIn(['basic', 'premium', 'enterprise']).withMessage('Invalid subscription plan')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, currency = 'usd', examId, subscriptionPlan } = req.body;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        userId: req.user._id.toString(),
        examId: examId || '',
        subscriptionPlan: subscriptionPlan || ''
      }
    });

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      exam: examId || null,
      subscription: subscriptionPlan ? {
        plan: subscriptionPlan,
        duration: subscriptionPlan === 'basic' ? 1 : subscriptionPlan === 'premium' ? 6 : 12
      } : null,
      amount: amount,
      currency: currency.toUpperCase(),
      paymentMethod: 'stripe',
      paymentIntentId: paymentIntent.id,
      status: 'pending'
    });

    await payment.save();

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentId: payment._id
      }
    });
  } catch (error) {
    logger.error('Create Stripe payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create Razorpay order
router.post('/razorpay/create-order', auth, [
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  body('currency').optional().isString().withMessage('Currency must be a string'),
  body('examId').optional().isMongoId().withMessage('Valid exam ID required'),
  body('subscriptionPlan').optional().isIn(['basic', 'premium', 'enterprise']).withMessage('Invalid subscription plan')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, currency = 'INR', examId, subscriptionPlan } = req.body;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: currency.toUpperCase(),
      receipt: `order_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        examId: examId || '',
        subscriptionPlan: subscriptionPlan || ''
      }
    });

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      exam: examId || null,
      subscription: subscriptionPlan ? {
        plan: subscriptionPlan,
        duration: subscriptionPlan === 'basic' ? 1 : subscriptionPlan === 'premium' ? 6 : 12
      } : null,
      amount: amount,
      currency: currency.toUpperCase(),
      paymentMethod: 'razorpay',
      paymentIntentId: order.id,
      status: 'pending'
    });

    await payment.save();

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment._id
      }
    });
  } catch (error) {
    logger.error('Create Razorpay order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Confirm payment
router.post('/confirm', auth, [
  body('paymentId').isMongoId().withMessage('Valid payment ID required'),
  body('paymentMethod').isIn(['stripe', 'razorpay']).withMessage('Invalid payment method'),
  body('transactionId').notEmpty().withMessage('Transaction ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentId, paymentMethod, transactionId } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify payment with respective gateway
    let paymentVerified = false;
    
    if (paymentMethod === 'stripe') {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
        paymentVerified = paymentIntent.status === 'succeeded';
      } catch (error) {
        logger.error('Stripe verification error:', error);
      }
    } else if (paymentMethod === 'razorpay') {
      try {
        const razorpayPayment = await razorpay.payments.fetch(transactionId);
        paymentVerified = razorpayPayment.status === 'captured';
      } catch (error) {
        logger.error('Razorpay verification error:', error);
      }
    }

    if (!paymentVerified) {
      payment.status = 'failed';
      payment.failureReason = 'Payment verification failed';
      await payment.save();
      
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Update payment status
    payment.status = 'completed';
    payment.transactionId = transactionId;
    payment.generateInvoiceNumber();
    await payment.save();

    // Update user subscription if applicable
    if (payment.subscription) {
      const user = await User.findById(payment.user);
      user.subscription = {
        plan: payment.subscription.plan,
        startDate: new Date(),
        endDate: new Date(Date.now() + payment.subscription.duration * 30 * 24 * 60 * 60 * 1000),
        isActive: true
      };
      await user.save();
    }

    logger.info(`Payment confirmed: ${payment._id} - ${payment.amount} ${payment.currency}`);

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: { payment }
    });
  } catch (error) {
    logger.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let query = { user: req.user._id };
    if (status) query.status = status;
    
    const payments = await Payment.find(query)
      .populate('exam', 'title subject')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Payment.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        payments,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('exam', 'title subject');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check if user can access this payment
    if (payment.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { payment }
    });
  } catch (error) {
    logger.error('Get payment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Refund payment
router.post('/:id/refund', auth, [
  body('reason').notEmpty().withMessage('Refund reason is required'),
  body('amount').optional().isInt({ min: 1 }).withMessage('Amount must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { reason, amount } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user can refund this payment
    if (payment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only refund completed payments'
      });
    }

    const refundAmount = amount || payment.amount;
    let refund;

    // Process refund based on payment method
    if (payment.paymentMethod === 'stripe') {
      refund = await stripe.refunds.create({
        payment_intent: payment.paymentIntentId,
        amount: refundAmount * 100
      });
    } else if (payment.paymentMethod === 'razorpay') {
      refund = await razorpay.payments.refund(payment.transactionId, {
        amount: refundAmount * 100
      });
    }

    // Update payment record
    payment.status = 'refunded';
    payment.refund = {
      amount: refundAmount,
      reason: reason,
      refundedAt: new Date(),
      refundId: refund.id
    };
    await payment.save();

    logger.info(`Payment refunded: ${payment._id} - ${refundAmount} ${payment.currency}`);

    res.json({
      success: true,
      message: 'Payment refunded successfully',
      data: { payment }
    });
  } catch (error) {
    logger.error('Refund payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;