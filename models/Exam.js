// File: c:\Users\KIIT0001\Desktop\exam_site\backend\models\Exam.js
const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  grade: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  totalQuestions: {
    type: Number,
    default: 0
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  passingMarks: {
    type: Number,
    required: true
  },
  examType: {
    type: String,
    enum: ['practice', 'mock', 'final', 'assignment'],
    default: 'practice'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  settings: {
    randomizeQuestions: {
      type: Boolean,
      default: false
    },
    randomizeOptions: {
      type: Boolean,
      default: false
    },
    allowReview: {
      type: Boolean,
      default: true
    },
    showResultsImmediately: {
      type: Boolean,
      default: false
    },
    showCorrectAnswers: {
      type: Boolean,
      default: false
    },
    allowMultipleAttempts: {
      type: Boolean,
      default: false
    },
    maxAttempts: {
      type: Number,
      default: 1
    },
    proctoring: {
      enabled: {
        type: Boolean,
        default: false
      },
      webcam: {
        type: Boolean,
        default: false
      },
      screenShare: {
        type: Boolean,
        default: false
      },
      tabSwitch: {
        type: Boolean,
        default: false
      }
    },
    security: {
      preventCopyPaste: {
        type: Boolean,
        default: true
      },
      preventRightClick: {
        type: Boolean,
        default: true
      },
      preventPrint: {
        type: Boolean,
        default: true
      },
      fullScreen: {
        type: Boolean,
        default: false
      }
    }
  },
  eligibleStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  eligibleGrades: [{
    type: String
  }],
  price: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String
  }],
  category: {
    type: String
  },
  instructions: {
    type: String
  },
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number
  }],
  submissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission'
  }],
  analytics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    totalStudents: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    passRate: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
examSchema.index({ createdBy: 1 });
examSchema.index({ subject: 1 });
examSchema.index({ grade: 1 });
examSchema.index({ 'schedule.startDate': 1 });
examSchema.index({ 'schedule.endDate': 1 });
examSchema.index({ isPublished: 1 });
examSchema.index({ isActive: 1 });

// Virtual for exam status
examSchema.virtual('status').get(function() {
  const now = new Date();
  const startDate = this.schedule.startDate;
  const endDate = this.schedule.endDate;
  
  if (now < startDate) return 'upcoming';
  if (now > endDate) return 'completed';
  return 'ongoing';
});

// Method to check if exam is available for student
examSchema.methods.isAvailableForStudent = function(studentId) {
  if (!this.isActive || !this.isPublished) return false;
  
  const now = new Date();
  if (now < this.schedule.startDate || now > this.schedule.endDate) return false;
  
  if (this.eligibleStudents.length > 0) {
    return this.eligibleStudents.includes(studentId);
  }
  
  return true;
};

// Method to calculate total marks
examSchema.methods.calculateTotalMarks = function() {
  return this.questions.reduce((total, question) => {
    return total + (question.marks || 0);
  }, 0);
};

module.exports = mongoose.model('Exam', examSchema);