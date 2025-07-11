// File: c:\Users\KIIT0001\Desktop\exam_site\backend\utils\validators.js
const validator = require('validator');

// Email validation
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Phone validation
const isValidPhone = (phone) => {
  return validator.isMobilePhone(phone);
};

// Password strength validation
const isStrongPassword = (password) => {
  return validator.isStrongPassword(password, {
    minLength: 6,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0
  });
};

// URL validation
const isValidURL = (url) => {
  return validator.isURL(url);
};

// Date validation
const isValidDate = (date) => {
  return validator.isISO8601(date);
};

// MongoDB ObjectId validation
const isValidObjectId = (id) => {
  return validator.isMongoId(id);
};

// File extension validation
const isValidFileExtension = (filename, allowedExtensions) => {
  const extension = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(extension);
};

// File size validation (in bytes)
const isValidFileSize = (size, maxSize) => {
  return size <= maxSize;
};

// Exam duration validation
const isValidExamDuration = (duration) => {
  return Number.isInteger(duration) && duration >= 5 && duration <= 480; // 5 minutes to 8 hours
};

// Grade validation
const isValidGrade = (grade) => {
  const validGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  return validGrades.includes(grade);
};

// Role validation
const isValidRole = (role) => {
  const validRoles = ['student', 'teacher', 'parent', 'admin'];
  return validRoles.includes(role);
};

// Question type validation
const isValidQuestionType = (type) => {
  const validTypes = ['multiple-choice', 'true-false', 'fill-blanks', 'essay', 'matching', 'ordering'];
  return validTypes.includes(type);
};

// Difficulty level validation
const isValidDifficulty = (difficulty) => {
  const validDifficulties = ['easy', 'medium', 'hard'];
  return validDifficulties.includes(difficulty);
};

// Sanitize HTML input
const sanitizeHTML = (input) => {
  return validator.escape(input);
};

// Validate exam schedule
const isValidExamSchedule = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  
  return start < end && start > now;
};

module.exports = {
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  isValidURL,
  isValidDate,
  isValidObjectId,
  isValidFileExtension,
  isValidFileSize,
  isValidExamDuration,
  isValidGrade,
  isValidRole,
  isValidQuestionType,
  isValidDifficulty,
  sanitizeHTML,
  isValidExamSchedule
};