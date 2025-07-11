// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\submissions.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Start exam (Create submission)
router.post('/start', auth, authorize('student'), [
  body('examId').isMongoId().withMessage('Valid exam ID required')
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
    
    const { examId } = req.body;
    
    // Find exam
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if exam is available
    if (!exam.isAvailableForStudent(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Exam is not available for you'
      });
    }
    
    // Check if student has already attempted
    const existingSubmission = await Submission.findOne({
      student: req.user._id,
      exam: examId,
      isSubmitted: true
    });
    
    if (existingSubmission && !exam.settings.allowMultipleAttempts) {
      return res.status(400).json({
        success: false,
        message: 'You have already attempted this exam'
      });
    }
    
    // Check attempt limit
    const attemptCount = await Submission.countDocuments({
      student: req.user._id,
      exam: examId,
      isSubmitted: true
    });
    
    if (attemptCount >= exam.settings.maxAttempts) {
      return res.status(400).json({
        success: false,
        message: 'Maximum attempts exceeded'
      });
    }
    
    // Create new submission
    const submission = new Submission({
      student: req.user._id,
      exam: examId,
      startTime: new Date(),
      attemptNumber: attemptCount + 1,
      answers: []
    });
    
    await submission.save();
    
    logger.info(`Exam started: ${exam.title} by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Exam started successfully',
      data: { submission }
    });
  } catch (error) {
    logger.error('Start exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Submit answer
router.post('/answer', auth, authorize('student'), [
  body('submissionId').isMongoId().withMessage('Valid submission ID required'),
  body('questionId').isMongoId().withMessage('Valid question ID required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('timeTaken').isInt({ min: 0 }).withMessage('Time taken must be a positive integer')
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
    
    const { submissionId, questionId, answer, timeTaken } = req.body;
    
    // Find submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    // Check if submission belongs to user
    if (submission.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Check if already submitted
    if (submission.isSubmitted) {
      return res.status(400).json({
        success: false,
        message: 'Exam already submitted'
      });
    }
    
    // Find question
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if answer already exists
    const existingAnswerIndex = submission.answers.findIndex(
      ans => ans.questionId.toString() === questionId
    );
    
    const answerData = {
      questionId,
      answer,
      timeTaken,
      isCorrect: question.validateAnswer(answer),
      marksAwarded: question.calculateMarks(answer)
    };
    
    if (existingAnswerIndex !== -1) {
      // Update existing answer
      submission.answers[existingAnswerIndex] = answerData;
    } else {
      // Add new answer
      submission.answers.push(answerData);
    }
    
    await submission.save();
    
    res.json({
      success: true,
      message: 'Answer saved successfully',
      data: { submission }
    });
  } catch (error) {
    logger.error('Submit answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Submit exam
router.post('/submit', auth, authorize('student'), [
  body('submissionId').isMongoId().withMessage('Valid submission ID required')
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
    
    const { submissionId } = req.body;
    
    // Find submission
    const submission = await Submission.findById(submissionId)
      .populate('exam');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    // Check if submission belongs to user
    if (submission.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Check if already submitted
    if (submission.isSubmitted) {
      return res.status(400).json({
        success: false,
        message: 'Exam already submitted'
      });
    }
    
    // Calculate final score
    const scoreData = submission.calculateScore();
    submission.assignGrade();
    submission.checkPassed(submission.exam.passingMarks);
    
    // Mark as submitted
    submission.isSubmitted = true;
    submission.submittedAt = new Date();
    submission.endTime = new Date();
    submission.timeTaken = Math.floor((submission.endTime - submission.startTime) / 60000); // in minutes
    
    await submission.save();
    
    // Update exam analytics
    await Exam.findByIdAndUpdate(submission.exam._id, {
      $inc: { 'analytics.totalAttempts': 1 }
    });
    
    logger.info(`Exam submitted: ${submission.exam.title} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Exam submitted successfully',
      data: { submission }
    });
  } catch (error) {
    logger.error('Submit exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get submission details
router.get('/:id', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('student', 'firstName lastName email')
      .populate('exam', 'title subject grade totalMarks')
      .populate('answers.questionId');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    // Check access permissions
    let hasAccess = false;
    
    if (req.user.role === 'student' && submission.student._id.toString() === req.user._id.toString()) {
      hasAccess = true;
    } else if (req.user.role === 'teacher' && submission.exam.createdBy.toString() === req.user._id.toString()) {
      hasAccess = true;
    } else if (req.user.role === 'admin') {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { submission }
    });
  } catch (error) {
    logger.error('Get submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all submissions
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, examId, studentId } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'student') {
      query.student = req.user._id;
    } else if (req.user.role === 'teacher') {
      // Only show submissions for exams created by this teacher
      const teacherExams = await Exam.find({ createdBy: req.user._id }).select('_id');
      query.exam = { $in: teacherExams.map(e => e._id) };
    }
    
    if (examId) query.exam = examId;
    if (studentId && req.user.role !== 'student') query.student = studentId;
    
    const submissions = await Submission.find(query)
      .populate('student', 'firstName lastName email')
      .populate('exam', 'title subject grade')
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Submission.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        submissions,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    logger.error('Get submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Grade submission (for essay questions)
router.put('/:id/grade', auth, authorize('teacher', 'admin'), [
  body('questionId').isMongoId().withMessage('Valid question ID required'),
  body('marks').isNumeric().withMessage('Marks must be a number'),
  body('feedback').optional().isString().withMessage('Feedback must be a string')
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
    
    const { questionId, marks, feedback } = req.body;
    
    const submission = await Submission.findById(req.params.id)
      .populate('exam');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    // Check if teacher can grade this submission
    if (req.user.role === 'teacher' && submission.exam.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Find the answer to grade
    const answerIndex = submission.answers.findIndex(
      ans => ans.questionId.toString() === questionId
    );
    
    if (answerIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Answer not found'
      });
    }
    
    // Update answer with marks and feedback
    submission.answers[answerIndex].marksAwarded = marks;
    submission.answers[answerIndex].teacherFeedback = feedback;
    submission.answers[answerIndex].isReviewed = true;
    
    // Recalculate total score
    submission.calculateScore();
    submission.assignGrade();
    submission.checkPassed(submission.exam.passingMarks);
    
    submission.gradedBy = req.user._id;
    submission.gradedAt = new Date();
    submission.isGraded = true;
    
    await submission.save();
    
    logger.info(`Submission graded: ${submission._id} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Submission graded successfully',
      data: { submission }
    });
  } catch (error) {
    logger.error('Grade submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;