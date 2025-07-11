// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\exams.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const logger = require('../utils/logger');

const router = express.Router();

// Get all exams
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, subject, grade, status, search } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'teacher') {
      query.createdBy = req.user._id;
    } else if (req.user.role === 'student') {
      query.isPublished = true;
      query.isActive = true;
      
      // Check if exam is available for student
      const now = new Date();
      query.$or = [
        { eligibleStudents: req.user._id },
        { eligibleStudents: { $size: 0 } }
      ];
      query['schedule.startDate'] = { $lte: now };
      query['schedule.endDate'] = { $gte: now };
    }
    
    if (subject) query.subject = subject;
    if (grade) query.grade = grade;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }
    
    const exams = await Exam.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Exam.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        exams,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    logger.error('Get exams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get exam by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('questions');
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if user can access this exam
    if (req.user.role === 'student') {
      if (!exam.isAvailableForStudent(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Exam not available for you'
        });
      }
    } else if (req.user.role === 'teacher' && exam.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { exam }
    });
  } catch (error) {
    logger.error('Get exam by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create new exam
router.post('/', auth, authorize('teacher', 'admin'), upload.array('attachments', 5), [
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('grade').notEmpty().withMessage('Grade is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('passingMarks').isInt({ min: 0 }).withMessage('Passing marks must be a positive integer'),
  body('schedule.startDate').isISO8601().withMessage('Valid start date required'),
  body('schedule.endDate').isISO8601().withMessage('Valid end date required')
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
    
    const examData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Handle file attachments
    if (req.files && req.files.length > 0) {
      examData.attachments = req.files.map(file => ({
        filename: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
    }
    
    const exam = new Exam(examData);
    await exam.save();
    
    logger.info(`Exam created: ${exam.title} by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: { exam }
    });
  } catch (error) {
    logger.error('Create exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update exam
router.put('/:id', auth, authorize('teacher', 'admin'), upload.array('attachments', 5), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if user can update this exam
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString()) {
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
      updateData.attachments = [...(exam.attachments || []), ...newAttachments];
    }
    
    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');
    
    logger.info(`Exam updated: ${updatedExam.title} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Exam updated successfully',
      data: { exam: updatedExam }
    });
  } catch (error) {
    logger.error('Update exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete exam
router.delete('/:id', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if user can delete this exam
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    await Exam.findByIdAndDelete(req.params.id);
    
    logger.info(`Exam deleted: ${exam.title} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Exam deleted successfully'
    });
  } catch (error) {
    logger.error('Delete exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Add questions to exam
router.post('/:id/questions', auth, authorize('teacher', 'admin'), [
  body('questionIds').isArray().withMessage('Question IDs must be an array'),
  body('questionIds.*').isMongoId().withMessage('Valid question ID required')
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
    
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if user can modify this exam
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const { questionIds } = req.body;
    
    // Verify questions exist
    const questions = await Question.find({ _id: { $in: questionIds } });
    if (questions.length !== questionIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some questions not found'
      });
    }
    
    // Add questions to exam
    exam.questions = [...new Set([...exam.questions, ...questionIds])];
    exam.totalQuestions = exam.questions.length;
    exam.totalMarks = questions.reduce((total, q) => total + q.marks, 0);
    
    await exam.save();
    
    res.json({
      success: true,
      message: 'Questions added to exam successfully',
      data: { exam }
    });
  } catch (error) {
    logger.error('Add questions to exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Publish exam
router.put('/:id/publish', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if user can publish this exam
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Validate exam before publishing
    if (exam.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish exam without questions'
      });
    }
    
    exam.isPublished = true;
    await exam.save();
    
    logger.info(`Exam published: ${exam.title} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Exam published successfully',
      data: { exam }
    });
  } catch (error) {
    logger.error('Publish exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get exam statistics
router.get('/:id/stats', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if user can access this exam
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const submissions = await Submission.find({ exam: req.params.id, isSubmitted: true });
    
    const stats = {
      totalSubmissions: submissions.length,
      averageScore: submissions.reduce((sum, sub) => sum + sub.percentage, 0) / submissions.length || 0,
      passRate: (submissions.filter(sub => sub.isPassed).length / submissions.length) * 100 || 0,
      highestScore: Math.max(...submissions.map(sub => sub.percentage)) || 0,
      lowestScore: Math.min(...submissions.map(sub => sub.percentage)) || 0
    };
    
    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    logger.error('Get exam stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;