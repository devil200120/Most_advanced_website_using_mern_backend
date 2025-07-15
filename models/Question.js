// File: c:\Users\KIIT0001\Desktop\exam_site\backend\models\Question.js
const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  explanation: {
    type: String
  }
});

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'fill-blanks', 'essay', 'matching', 'ordering'],
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  marks: {
    type: Number,
    required: true,
    default: 1
  },
  negativeMarks: {
    type: Number,
    default: 0
  },
  options: [optionSchema],
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed
  },
  explanation: {
    type: String
  },
  hints: [{
    type: String
  }],
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number
  }],
  tags: [{
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  analytics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    correctAttempts: {
      type: Number,
      default: 0
    },
    averageTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
questionSchema.index({ subject: 1 });
questionSchema.index({ topic: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ createdBy: 1 });
questionSchema.index({ tags: 1 });

// Virtual for success rate
questionSchema.virtual('successRate').get(function() {
  if (this.analytics.totalAttempts === 0) return 0;
  return (this.analytics.correctAttempts / this.analytics.totalAttempts) * 100;
});

// Method to validate answer
// Method to validate answer
questionSchema.methods.validateAnswer = function(userAnswer) {
  switch (this.type) {
    case 'multiple-choice':
      // Handle case-insensitive comparison and trim whitespace
      const correctAnswer = String(this.correctAnswer).toLowerCase().trim();
      const userAnswerNormalized = String(userAnswer).toLowerCase().trim();
      return correctAnswer === userAnswerNormalized;
    case 'true-false':
      // Handle case-insensitive comparison for true/false
      const correctBool = String(this.correctAnswer).toLowerCase().trim();
      const userBool = String(userAnswer).toLowerCase().trim();
      return correctBool === userBool;
    case 'fill-blanks':
      if (Array.isArray(this.correctAnswer)) {
        return this.correctAnswer.every((answer, index) => 
          answer.toLowerCase().trim() === userAnswer[index].toLowerCase().trim()
        );
      }
      return this.correctAnswer.toLowerCase().trim() === userAnswer.toLowerCase().trim();
    case 'essay':
      return null; // Requires manual grading
    case 'matching':
      return JSON.stringify(this.correctAnswer.sort()) === JSON.stringify(userAnswer.sort());
    case 'ordering':
      return JSON.stringify(this.correctAnswer) === JSON.stringify(userAnswer);
    default:
      return false;
  }
};
// Method to calculate marks for answer
questionSchema.methods.calculateMarks = function(userAnswer) {
  const isCorrect = this.validateAnswer(userAnswer);
  
  if (isCorrect === null) {
    return null; // Manual grading required
  }
  
  if (isCorrect) {
    return this.marks;
  } else {
    return -this.negativeMarks;
  }
};

module.exports = mongoose.model('Question', questionSchema);
