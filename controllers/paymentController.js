// File: c:\Users\KIIT0001\Desktop\exam_site\backend\controllers\paymentController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Exam = require('../models/Exam');
const logger = require('../utils/logger');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Stripe payment intent
const createStripePaymentIntent = async (req, res) => {
  try {
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
};

// Create Razorpay order
const createRazorpayOrder = async (req, res) => {
  try {
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
};

// Confirm payment
const confirmPayment = async (req, res) => {
  try {
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
};

// Get payment history
const getPaymentHistory = async (req, res) => {
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
};

// Get payment by ID
const getPaymentById = async (req, res) => {
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
};

// Refund payment
const refundPayment = async (req, res) => {
  try {
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
};

// Get all payments (Admin only)
const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentMethod } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    
    const payments = await Payment.find(query)
      .populate('user', 'firstName lastName email')
      .populate('exam', 'title subject')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Payment.countDocuments(query);
    
    // Calculate statistics
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          completedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          completedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        payments,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
        stats: stats[0] || {
          totalAmount: 0,
          totalPayments: 0,
          completedPayments: 0,
          completedAmount: 0
        }
      }
    });
  } catch (error) {
    logger.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Handle Stripe webhook
const handleStripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // Update payment status in database
        await Payment.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          { status: 'completed', transactionId: paymentIntent.id }
        );
        logger.info(`Payment succeeded: ${paymentIntent.id}`);
        break;
      
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        // Update payment status in database
        await Payment.findOneAndUpdate(
          { paymentIntentId: failedPayment.id },
          { status: 'failed', failureReason: failedPayment.last_payment_error?.message }
        );
        logger.info(`Payment failed: ${failedPayment.id}`);
        break;
      
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook handling failed'
    });
  }
};

// Handle Razorpay webhook
const handleRazorpayWebhook = async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    switch (event) {
      case 'payment.captured':
        // Update payment status in database
        await Payment.findOneAndUpdate(
          { paymentIntentId: payload.payment.entity.order_id },
          { 
            status: 'completed', 
            transactionId: payload.payment.entity.id 
          }
        );
        logger.info(`Razorpay payment captured: ${payload.payment.entity.id}`);
        break;
      
      case 'payment.failed':
        // Update payment status in database
        await Payment.findOneAndUpdate(
          { paymentIntentId: payload.payment.entity.order_id },
          { 
            status: 'failed', 
            failureReason: payload.payment.entity.error_reason 
          }
        );
        logger.info(`Razorpay payment failed: ${payload.payment.entity.id}`);
        break;
      
      default:
        logger.info(`Unhandled Razorpay event: ${event}`);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Razorpay webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook handling failed'
    });
  }
};

module.exports = {
  createStripePaymentIntent,
  createRazorpayOrder,
  confirmPayment,
  getPaymentHistory,
  getPaymentById,
  refundPayment,
  getAllPayments,
  handleStripeWebhook,
  handleRazorpayWebhook
};