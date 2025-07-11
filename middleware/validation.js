// File: c:\Users\KIIT0001\Desktop\exam_site\backend\middleware\validation.js
const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['student', 'teacher', 'parent']).withMessage('Invalid role'),
  body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number')
];

const validateUserLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Exam validation rules
const validateExamCreation = [
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('grade').notEmpty().withMessage('Grade is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('passingMarks').isInt({ min: 0 }).withMessage('Passing marks must be a positive integer'),
  body('schedule.startDate').isISO8601().withMessage('Valid start date required'),
  body('schedule.endDate').isISO8601().withMessage('Valid end date required')
];

// Question validation rules
const validateQuestionCreation = [
  body('text').trim().isLength({ min: 10 }).withMessage('Question text must be at least 10 characters'),
  body('type').isIn(['multiple-choice', 'true-false', 'fill-blanks', 'essay', 'matching', 'ordering']).withMessage('Invalid question type'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('topic').notEmpty().withMessage('Topic is required'),
  body('marks').isInt({ min: 1 }).withMessage('Marks must be a positive integer'),
  body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level')
];

// Payment validation rules
const validatePaymentCreation = [
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  body('currency').optional().isString().withMessage('Currency must be a string'),
  body('examId').optional().isMongoId().withMessage('Valid exam ID required'),
  body('subscriptionPlan').optional().isIn(['basic', 'premium', 'enterprise']).withMessage('Invalid subscription plan')
];

// Submission validation rules
const validateSubmissionStart = [
  body('examId').isMongoId().withMessage('Valid exam ID required')
];

const validateAnswerSubmission = [
  body('submissionId').isMongoId().withMessage('Valid submission ID required'),
  body('questionId').isMongoId().withMessage('Valid question ID required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('timeTaken').isInt({ min: 0 }).withMessage('Time taken must be a positive integer')
];

// Parameter validation
const validateObjectId = [
  param('id').isMongoId().withMessage('Valid ID required')
];

// Query validation
const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateExamCreation,
  validateQuestionCreation,
  validatePaymentCreation,
  validateSubmissionStart,
  validateAnswerSubmission,
  validateObjectId,
  validatePagination
};