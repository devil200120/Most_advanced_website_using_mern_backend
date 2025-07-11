// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\questions.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Question = require('../models/Question');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const logger = require('../utils/logger');

const router = express.Router();

// Get all questions
router.get('/', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, subject, topic, difficulty, search } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'teacher') {
      query.createdBy = req.user._id;
    }
    
    if (subject) query.subject = subject;
    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.$or = [
        { text: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } }
      ];
    }
    
    const questions = await Question.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Question.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        questions,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    logger.error('Get questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get question by ID
router.get('/:id', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if user can access this question
    if (req.user.role === 'teacher' && question.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { question }
    });
  } catch (error) {
    logger.error('Get question by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create new question
router.post('/', auth, authorize('teacher', 'admin'), upload.array('attachments', 3), [
  body('text').trim().isLength({ min: 10 }).withMessage('Question text must be at least 10 characters'),
  body('type').isIn(['multiple-choice', 'true-false', 'fill-blanks', 'essay', 'matching', 'ordering']).withMessage('Invalid question type'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('topic').notEmpty().withMessage('Topic is required'),
  body('marks').isInt({ min: 1 }).withMessage('Marks must be a positive integer'),
  body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level')
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
    
    const questionData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Handle file attachments
    if (req.files && req.files.length > 0) {
      questionData.attachments = req.files.map(file => ({
        filename: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
    }
    
    // Parse options if they're sent as JSON string
    if (typeof questionData.options === 'string') {
      questionData.options = JSON.parse(questionData.options);
    }
    
    const question = new Question(questionData);
    await question.save();
    
    logger.info(`Question created: ${question.text.substring(0, 50)}... by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: { question }
    });
  } catch (error) {
    logger.error('Create question error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update question
router.put('/:id', auth, authorize('teacher', 'admin'), upload.array('attachments', 3), async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if user can update this question
    if (req.user.role === 'teacher' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const updateData = { ...req.body };
    
    // Handle file attachments
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(file => ({
        filename: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
      updateData.attachments = [...(question.attachments || []), ...newAttachments];
    }
    
    // Parse options if they're sent as JSON string
    if (typeof updateData.options === 'string') {
      updateData.options = JSON.parse(updateData.options);
    }
    
    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');
    
    logger.info(`Question updated: ${updatedQuestion.text.substring(0, 50)}... by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Question updated successfully',
      data: { question: updatedQuestion }
    });
  } catch (error) {
    logger.error('Update question error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete question
router.delete('/:id', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if user can delete this question
    if (req.user.role === 'teacher' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    await Question.findByIdAndDelete(req.params.id);
    
    logger.info(`Question deleted: ${question.text.substring(0, 50)}... by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    logger.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Bulk create questions
router.post('/bulk', auth, authorize('teacher', 'admin'), [
  body('questions').isArray().withMessage('Questions must be an array'),
  body('questions.*.text').trim().isLength({ min: 10 }).withMessage('Question text must be at least 10 characters'),
  body('questions.*.type').isIn(['multiple-choice', 'true-false', 'fill-blanks', 'essay', 'matching', 'ordering']).withMessage('Invalid question type'),
  body('questions.*.subject').notEmpty().withMessage('Subject is required'),
  body('questions.*.topic').notEmpty().withMessage('Topic is required'),
  body('questions.*.marks').isInt({ min: 1 }).withMessage('Marks must be a positive integer')
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
    
    const { questions } = req.body;
    
    // Add createdBy to each question
    const questionsWithCreator = questions.map(q => ({
      ...q,
      createdBy: req.user._id
    }));
    
    const createdQuestions = await Question.insertMany(questionsWithCreator);
    
    logger.info(`${createdQuestions.length} questions created in bulk by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: `${createdQuestions.length} questions created successfully`,
      data: { questions: createdQuestions }
    });
  } catch (error) {
    logger.error('Bulk create questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get question statistics
router.get('/:id/stats', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if user can access this question
    if (req.user.role === 'teacher' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const stats = {
      totalAttempts: question.analytics.totalAttempts,
      correctAttempts: question.analytics.correctAttempts,
      successRate: question.successRate,
      averageTime: question.analytics.averageTime,
      usageCount: question.usageCount
    };
    
    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    logger.error('Get question stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;