// File: c:\Users\KIIT0001\Desktop\exam_site\backend\models\User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'parent', 'admin'],
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  
  // Student specific fields
  studentId: {
    type: String,
    sparse: true,
    unique: true
  },
  grade: {
    type: String
  },
  section: {
    type: String
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Teacher specific fields
  teacherId: {
    type: String,
    sparse: true,
    unique: true
  },
  subject: {
    type: String
  },
  qualification: {
    type: String
  },
  experience: {
    type: Number
  },
  // Parent specific fields
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Common fields
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  // Add this field after the preferences field (around line 125):

 
  
  // ADD THIS SETTINGS FIELD:
  settings: {
    notifications: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      pushNotifications: {
        type: Boolean,
        default: true
      },
      examReminders: {
        type: Boolean,
        default: true
      },
      resultNotifications: {
        type: Boolean,
        default: true
      },
      systemUpdates: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'private', 'friends'],
        default: 'public'
      },
      showEmail: {
        type: Boolean,
        default: false
      },
      showPhone: {
        type: Boolean,
        default: false
      },
      allowMessages: {
        type: Boolean,
        default: true
      }
    },
    preferences: {
      language: {
        type: String,
        default: 'en'
      },
      timezone: {
        type: String,
        default: 'UTC'
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'light'
      },
      dateFormat: {
        type: String,
        default: 'MM/DD/YYYY'
      },
      timeFormat: {
        type: String,
        enum: ['12h', '24h'],
        default: '12h'
      }
    },
    exam: {
      autoSave: {
        type: Boolean,
        default: true
      },
      confirmBeforeSubmit: {
        type: Boolean,
        default: true
      },
      showTimer: {
        type: Boolean,
        default: true
      },
      playSound: {
        type: Boolean,
        default: false
      },
      enableKeyboardShortcuts: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // ...existing code continues with subscription field...
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ teacherId: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

module.exports = mongoose.model('User', userSchema);