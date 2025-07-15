// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\submissions.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
// Add this RIGHT AFTER the router declaration (around line 11, before the /start route)

// Handle direct submission (what the frontend is currently calling)
// Handle direct submission (what the frontend is currently calling)
router.post('/', auth, authorize('student'), async (req, res) => {
  try {
    console.log('📝 Direct submission received:', req.body);
    
    const { examId, answers, timeSpent, securityFlags } = req.body;
    
    if (!examId) {
      return res.status(400).json({
        success: false,
        message: 'Exam ID is required'
      });
    }

    // Find the exam
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
if (!exam.isAvailableForStudent(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Exam is not available for you'
      });
    }

    // ✅ ADD THIS MULTIPLE ATTEMPT PREVENTION CODE
    // Check if student has already attempted this exam
    const existingSubmission = await Submission.findOne({
      student: req.user._id,
      exam: examId,
      isSubmitted: true
    });

    if (existingSubmission && !exam.settings.allowMultipleAttempts) {
      return res.status(400).json({
        success: false,
        message: 'You have already attempted this exam. Multiple attempts are not allowed.'
      });
    }

    // Check attempt limit if multiple attempts are allowed
    const attemptCount = await Submission.countDocuments({
      student: req.user._id,
      exam: examId,
      isSubmitted: true
    });

    if (exam.settings.allowMultipleAttempts && attemptCount >= exam.settings.maxAttempts) {
      return res.status(400).json({
        success: false,
        message: `Maximum attempts (${exam.settings.maxAttempts}) exceeded for this exam.`
      });
    }
    // Find existing submission or create new one
    let submission = await Submission.findOne({
      student: req.user._id,
      exam: examId,
      isSubmitted: false
    });

    if (!submission) {
      // Create new submission if none exists
      submission = new Submission({
        student: req.user._id,
        exam: examId,
        startTime: new Date(Date.now() - (timeSpent * 1000) || 0),
        answers: [],
        attemptNumber: 1
      });
    }

    // Convert answers to the required format with proper validation
    const formattedAnswers = [];
    for (const questionId in answers) {
      if (answers[questionId] && answers[questionId].trim() !== '') {
        try {
          // Find the question to validate the answer
          const question = await Question.findById(questionId);
          if (question) {
            const userAnswer = answers[questionId].trim();
            const isCorrect = question.validateAnswer(userAnswer);
            const marksAwarded = question.calculateMarks(userAnswer);
            
            formattedAnswers.push({
              questionId,
              answer: userAnswer,
              timeTaken: Math.floor((timeSpent || 300) / Object.keys(answers).length) || 30,
              isCorrect: isCorrect,
              marksAwarded: marksAwarded || 0
            });
          } else {
            console.warn(`Question ${questionId} not found`);
            formattedAnswers.push({
              questionId,
              answer: answers[questionId].trim(),
              timeTaken: Math.floor((timeSpent || 300) / Object.keys(answers).length) || 30,
              isCorrect: false,
              marksAwarded: 0
            });
          }
        } catch (questionError) {
          console.error(`Error processing question ${questionId}:`, questionError);
          formattedAnswers.push({
            questionId,
            answer: answers[questionId].trim(),
            timeTaken: Math.floor((timeSpent || 300) / Object.keys(answers).length) || 30,
            isCorrect: false,
            marksAwarded: 0
          });
        }
      }
    }

    // Update submission
    submission.answers = formattedAnswers;
    submission.isSubmitted = true;
    submission.submittedAt = new Date();
    submission.endTime = new Date();
    submission.timeTaken = Math.floor((timeSpent || 300) / 60) || 1;
    
    // Add security flags if provided
    if (securityFlags) {
      submission.securityFlags = {
        tabSwitches: securityFlags.tabSwitches || 0,
        fullscreenExited: securityFlags.fullscreenExited || 0,
        warningsReceived: securityFlags.warningsReceived || 0
      };
    }

    // Calculate total marks and scores
    let totalMarks = 0;
    let obtainedMarks = 0;
    
    formattedAnswers.forEach(answer => {
      obtainedMarks += answer.marksAwarded || 0;
    });
    
    // Get total marks from exam questions
    const examQuestions = await Question.find({ _id: { $in: formattedAnswers.map(a => a.questionId) } });
    totalMarks = examQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);
    
    submission.totalMarks = totalMarks;
    submission.marksObtained = obtainedMarks;
    submission.percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;
    
    // Assign grade
    const percentage = submission.percentage;
    if (percentage >= 90) submission.grade = 'A+';
    else if (percentage >= 80) submission.grade = 'A';
    else if (percentage >= 70) submission.grade = 'B+';
    else if (percentage >= 60) submission.grade = 'B';
    else if (percentage >= 50) submission.grade = 'C';
    else if (percentage >= 40) submission.grade = 'D';
    else submission.grade = 'F';
    
    // Check if passed
    submission.isPassed = submission.percentage >= (exam.passingMarks || 60);
    submission.isGraded = true;

    // Save submission
    await submission.save();

    // Update exam analytics
    try {
      await Exam.findByIdAndUpdate(examId, {
        $inc: { 'analytics.totalAttempts': 1 }
      });
    } catch (analyticsError) {
      console.warn('Analytics update error (non-critical):', analyticsError.message);
    }

    logger.info(`Exam submitted directly: ${exam.title} by ${req.user.email} - Score: ${submission.percentage}%`);

    res.json({
      success: true,
      message: 'Exam submitted successfully',
      data: { 
        submission,
        submissionId: submission._id
      }
    });
  } catch (error) {
    console.error('❌ Direct submission error:', error);
    logger.error('Direct submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});
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
// Check if student has previous attempts for an exam
router.get('/check/:examId', auth, authorize('student'), async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user._id;

    // Find exam
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Count submitted attempts
    const attemptCount = await Submission.countDocuments({
      student: studentId,
      exam: examId,
      isSubmitted: true
    });

    // Check if any attempt exists
    const hasAttempted = attemptCount > 0;

    // Check if can attempt again
    const canAttempt = !hasAttempted || 
                      (exam.settings.allowMultipleAttempts && attemptCount < exam.settings.maxAttempts);

    res.json({
      success: true,
      data: {
        hasAttempted,
        attemptCount,
        maxAttempts: exam.settings.maxAttempts,
        allowMultipleAttempts: exam.settings.allowMultipleAttempts,
        canAttempt,
        nextAttemptNumber: attemptCount + 1
      }
    });

  } catch (error) {
    logger.error('Check attempts error:', error);
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
