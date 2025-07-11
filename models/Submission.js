// File: c:\Users\KIIT0001\Desktop\exam_site\backend\models\Submission.js
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  timeTaken: {
    type: Number, // in seconds
    default: 0
  },
  isCorrect: {
    type: Boolean
  },
  marksAwarded: {
    type: Number,
    default: 0
  },
  isReviewed: {
    type: Boolean,
    default: false
  },
  teacherFeedback: {
    type: String
  }
});

const submissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  answers: [answerSchema],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  timeTaken: {
    type: Number // in minutes
  },
  isSubmitted: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date
  },
  autoSubmitted: {
    type: Boolean,
    default: false
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  marksObtained: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  grade: {
    type: String
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  isGraded: {
    type: Boolean,
    default: false
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: {
    type: Date
  },
  feedback: {
    type: String
  },
  proctoring: {
    violations: [{
      type: {
        type: String,
        enum: ['tab-switch', 'copy-paste', 'right-click', 'fullscreen-exit', 'multiple-faces', 'no-face']
      },
      timestamp: Date,
      details: String
    }],
    screenshots: [{
      url: String,
      timestamp: Date
    }],
    webcamRecordings: [{
      url: String,
      timestamp: Date
    }]
  },
  analytics: {
    timeSpentPerQuestion: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
      },
      timeSpent: Number
    }],
    flaggedQuestions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    }],
    reviewedQuestions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    }]
  }
}, {
  timestamps: true
});

// Indexes
submissionSchema.index({ student: 1, exam: 1 });
submissionSchema.index({ exam: 1 });
submissionSchema.index({ student: 1 });
submissionSchema.index({ submittedAt: 1 });
submissionSchema.index({ isGraded: 1 });

// Method to calculate final score
submissionSchema.methods.calculateScore = function() {
  let totalMarks = 0;
  let obtainedMarks = 0;
  
  this.answers.forEach(answer => {
    if (answer.marksAwarded !== undefined) {
      obtainedMarks += answer.marksAwarded;
    }
  });
  
  // Get total marks from exam
  totalMarks = this.exam.totalMarks || 0;
  
  this.marksObtained = obtainedMarks;
  this.totalMarks = totalMarks;
  this.percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
  
  return {
    totalMarks,
    obtainedMarks,
    percentage: this.percentage
  };
};

// Method to determine grade
submissionSchema.methods.assignGrade = function() {
  const percentage = this.percentage;
  
  if (percentage >= 90) this.grade = 'A+';
  else if (percentage >= 80) this.grade = 'A';
  else if (percentage >= 70) this.grade = 'B+';
  else if (percentage >= 60) this.grade = 'B';
  else if (percentage >= 50) this.grade = 'C';
  else if (percentage >= 40) this.grade = 'D';
  else this.grade = 'F';
  
  return this.grade;
};

// Method to check if passed
submissionSchema.methods.checkPassed = function(passingMarks) {
  this.isPassed = this.marksObtained >= passingMarks;
  return this.isPassed;
};

module.exports = mongoose.model('Submission', submissionSchema);