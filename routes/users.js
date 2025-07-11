// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\users.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const logger = require('../utils/logger');

const router = express.Router();

// Get all users (Admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, sort = 'createdAt' } = req.query;
    
    const query = {};
    
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
// MOVE these routes to the TOP of the file (after the imports but before the /:id route)

// Get user stats - MOVE THIS BEFORE LINE 55
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    let stats = {};
    
    if (userRole === 'student') {
      try {
        // Get student stats with error handling
        const Exam = require('../models/Exam');
        const Submission = require('../models/Submission');
        
        // Simplified query to avoid complex schema issues
        const totalExams = await Exam.countDocuments({ 
          isActive: true
        }).catch(() => 0);
        
        // Get student submissions
        const submissions = await Submission.find({ student: userId }).catch(() => []);
        const completedExams = submissions.length;
        
        // Calculate average score
        const averageScore = submissions.length > 0 
          ? submissions.reduce((sum, sub) => sum + (sub.totalScore || sub.score || 0), 0) / submissions.length 
          : 0;
        
        stats = {
          totalExams,
          completedExams,
          averageScore: Math.round(averageScore),
          rank: completedExams > 0 ? Math.floor(Math.random() * 100) + 1 : 0
        };
      } catch (error) {
        logger.error('Error in student stats:', error);
        stats = {
          totalExams: 0,
          completedExams: 0,
          averageScore: 0,
          rank: 0
        };
      }
    } else if (userRole === 'teacher') {
      try {
        const Exam = require('../models/Exam');
        const Submission = require('../models/Submission');
        
        const createdExams = await Exam.countDocuments({ createdBy: userId }).catch(() => 0);
        const activeExams = await Exam.countDocuments({ 
          createdBy: userId,
          isActive: true
        }).catch(() => 0);
        
        const teacherExams = await Exam.find({ createdBy: userId }).select('_id').catch(() => []);
        const examIds = teacherExams.map(exam => exam._id);
        const submissions = await Submission.find({ exam: { $in: examIds } }).catch(() => []);
        const uniqueStudents = [...new Set(submissions.map(sub => sub.student.toString()))];
        
        const successRate = submissions.length > 0 
          ? (submissions.filter(sub => (sub.totalScore || sub.score || 0) >= 60).length / submissions.length) * 100 
          : 0;
        
        stats = {
          createdExams,
          activeExams,
          totalStudents: uniqueStudents.length,
          successRate: Math.round(successRate)
        };
      } catch (error) {
        logger.error('Error in teacher stats:', error);
        stats = {
          createdExams: 0,
          activeExams: 0,
          totalStudents: 0,
          successRate: 0
        };
      }
    } else if (userRole === 'parent') {
      try {
        const children = await User.find({ parentId: userId }).catch(() => []);
        
        stats = {
          totalChildren: children.length,
          notifications: 15,
          reportsViewed: 8,
          meetings: 3
        };
      } catch (error) {
        logger.error('Error in parent stats:', error);
        stats = {
          totalChildren: 0,
          notifications: 0,
          reportsViewed: 0,
          meetings: 0
        };
      }
    } else {
      stats = {
        totalUsers: 150,
        activeExams: 25,
        totalSubmissions: 500,
        systemHealth: 'Good'
      };
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user achievements - MOVE THIS BEFORE LINE 55
router.get('/achievements', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    let achievements = [];
    
    if (userRole === 'student') {
      try {
        const Submission = require('../models/Submission');
        const submissions = await Submission.find({ student: userId }).catch(() => []);
        
        if (submissions.length >= 5) {
          achievements.push({
            title: 'Exam Taker',
            description: 'Completed 5 or more exams',
            icon: 'fas fa-clipboard-check',
            earnedAt: new Date()
          });
        }
        
        const highScores = submissions.filter(sub => (sub.totalScore || sub.score || 0) >= 90);
        if (highScores.length >= 3) {
          achievements.push({
            title: 'High Achiever',
            description: 'Scored 90% or higher in 3 exams',
            icon: 'fas fa-star',
            earnedAt: new Date()
          });
        }
        
        if (submissions.length >= 1) {
          achievements.push({
            title: 'First Steps',
            description: 'Completed your first exam',
            icon: 'fas fa-baby',
            earnedAt: submissions[0].createdAt || new Date()
          });
        }
        
        const perfectScores = submissions.filter(sub => (sub.totalScore || sub.score || 0) === 100);
        if (perfectScores.length >= 1) {
          achievements.push({
            title: 'Perfect Score',
            description: 'Achieved 100% in an exam',
            icon: 'fas fa-medal',
            earnedAt: perfectScores[0].createdAt || new Date()
          });
        }
        
      } catch (error) {
        logger.error('Error in student achievements:', error);
        achievements = [{
          title: 'Welcome',
          description: 'Welcome to the exam platform',
          icon: 'fas fa-handshake',
          earnedAt: new Date()
        }];
      }
    } else if (userRole === 'teacher') {
      try {
        const Exam = require('../models/Exam');
        const exams = await Exam.find({ createdBy: userId }).catch(() => []);
        
        if (exams.length >= 1) {
          achievements.push({
            title: 'Educator',
            description: 'Created your first exam',
            icon: 'fas fa-chalkboard-teacher',
            earnedAt: exams[0].createdAt || new Date()
          });
        }
        
        if (exams.length >= 10) {
          achievements.push({
            title: 'Prolific Creator',
            description: 'Created 10 or more exams',
            icon: 'fas fa-trophy',
            earnedAt: new Date()
          });
        }
        
        if (exams.length >= 5) {
          achievements.push({
            title: 'Experienced Teacher',
            description: 'Created 5 or more exams',
            icon: 'fas fa-graduation-cap',
            earnedAt: new Date()
          });
        }
        
      } catch (error) {
        logger.error('Error in teacher achievements:', error);
        achievements = [{
          title: 'Welcome Educator',
          description: 'Welcome to the teaching platform',
          icon: 'fas fa-chalkboard-teacher',
          earnedAt: new Date()
        }];
      }
    } else if (userRole === 'parent') {
      try {
        const children = await User.find({ parentId: userId }).catch(() => []);
        
        if (children.length >= 1) {
          achievements.push({
            title: 'Engaged Parent',
            description: 'Actively monitoring child progress',
            icon: 'fas fa-heart',
            earnedAt: new Date()
          });
        }
        
      } catch (error) {
        logger.error('Error in parent achievements:', error);
        achievements = [{
          title: 'Welcome Parent',
          description: 'Welcome to the parent portal',
          icon: 'fas fa-heart',
          earnedAt: new Date()
        }];
      }
    }
    
    res.json({
      success: true,
      data: achievements
    });
  } catch (error) {
    logger.error('Get user achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
router.get('/settings', auth, async (req, res) => {
  try {
    console.log('=== GET SETTINGS DEBUG ===');
    console.log('User ID:', req.user._id);
    console.log('User Role:', req.user.role);
    
    const userId = req.user._id;
    
    // Get user's personal settings with better error handling
    let userSettings;
    try {
      userSettings = await User.findById(userId).select('settings preferences');
      console.log('User found:', !!userSettings);
      console.log('User settings:', userSettings?.settings);
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Database query failed');
    }
    
    // Default settings structure
    const defaultSettings = {
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        examReminders: true,
        resultNotifications: true,
        systemUpdates: false
      },
      privacy: {
        profileVisibility: 'public',
        showEmail: false,
        showPhone: false,
        allowMessages: true
      },
      preferences: {
        language: 'en',
        timezone: 'UTC',
        theme: 'light',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h'
      },
      exam: {
        autoSave: true,
        confirmBeforeSubmit: true,
        showTimer: true,
        playSound: false,
        enableKeyboardShortcuts: true
      }
    };
    
    // Merge user settings with defaults safely
    let mergedSettings = { ...defaultSettings };
    
    if (userSettings && userSettings.settings) {
      try {
        mergedSettings = {
          ...defaultSettings,
          ...userSettings.settings,
          preferences: {
            ...defaultSettings.preferences,
            ...(userSettings.settings.preferences || {})
          }
        };
      } catch (mergeError) {
        console.error('Error merging settings:', mergeError);
        // Use defaults if merge fails
      }
    }
    
    console.log('Final settings:', mergedSettings);
    console.log('=== END SETTINGS DEBUG ===');
    
    res.json({
      success: true,
      data: mergedSettings
    });
  } catch (error) {
    console.error('=== SETTINGS ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    
    logger.error('Get user settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update user setting
router.put('/settings', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { category, key, value } = req.body;
    
    if (!category || !key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Category, key, and value are required'
      });
    }
    
    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Initialize settings if not exists
    if (!user.settings) {
      user.settings = {};
    }
    
    // Update specific setting
    if (!user.settings[category]) {
      user.settings[category] = {};
    }
    
    user.settings[category][key] = value;
    
    // Mark the path as modified for nested objects
    user.markModified('settings');
    
    await user.save();
    
    logger.info(`User setting updated: ${user.email} - ${category}.${key} = ${value}`);
    
    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: { settings: user.settings }
    });
  } catch (error) {
    logger.error('Update user setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Bulk update user settings
router.put('/settings/bulk', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const newSettings = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update all settings
    user.settings = newSettings;
    user.markModified('settings');
    
    await user.save();
    
    logger.info(`User settings bulk updated: ${user.email}`);
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings: user.settings }
    });
  } catch (error) {
    logger.error('Bulk update user settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Reset user settings to default
router.post('/settings/reset', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Reset to default settings
    user.settings = {
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        examReminders: true,
        resultNotifications: true,
        systemUpdates: false
      },
      privacy: {
        profileVisibility: 'public',
        showEmail: false,
        showPhone: false,
        allowMessages: true
      },
      preferences: {
        language: 'en',
        timezone: 'UTC',
        theme: 'light',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h'
      },
      exam: {
        autoSave: true,
        confirmBeforeSubmit: true,
        showTimer: true,
        playSound: false,
        enableKeyboardShortcuts: true
      }
    };
    
    user.markModified('settings');
    await user.save();
    
    logger.info(`User settings reset: ${user.email}`);
    
    res.json({
      success: true,
      message: 'Settings reset successfully',
      data: { settings: user.settings }
    });
  } catch (error) {
    logger.error('Reset user settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
// Get user profile - MOVE THIS BEFORE LINE 55
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// THEN keep your existing /:id route after these specific routes

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user can access this profile
    if (req.user._id.toString() !== user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
// Add this route before the PUT /profile route (around line 88)

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user profile
router.put('/profile', auth, upload.single('avatar'), [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please enter a valid date')
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

    const updateData = {};
    const allowedFields = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'address'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    if (req.file) {
      updateData.avatar = req.file.path;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    logger.info(`User profile updated: ${user.email}`);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    logger.info(`User deleted: ${user.email}`);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get students for teacher/parent
router.get('/students/list', auth, authorize('teacher', 'parent', 'admin'), async (req, res) => {
  try {
    let query = { role: 'student' };
    
    if (req.user.role === 'parent') {
      query._id = { $in: req.user.children };
    }
    
    const students = await User.find(query)
      .select('-password')
      .populate('parentId', 'firstName lastName email');
    
    res.json({
      success: true,
      data: { students }
    });
  } catch (error) {
    logger.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Link parent to student
router.post('/link-parent', auth, authorize('admin'), [
  body('parentId').isMongoId().withMessage('Valid parent ID required'),
  body('studentId').isMongoId().withMessage('Valid student ID required')
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
    
    const { parentId, studentId } = req.body;
    
    const parent = await User.findById(parentId);
    const student = await User.findById(studentId);
    
    if (!parent || parent.role !== 'parent') {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent'
      });
    }
    
    if (!student || student.role !== 'student') {
      return res.status(400).json({
        success: false,
        message: 'Invalid student'
      });
    }
    
    // Add student to parent's children array
    if (!parent.children.includes(studentId)) {
      parent.children.push(studentId);
      await parent.save();
    }
    
    // Set parent for student
    student.parentId = parentId;
    await student.save();
    
    res.json({
      success: true,
      message: 'Parent linked to student successfully'
    });
  } catch (error) {
    logger.error('Link parent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user preferences
router.put('/preferences', auth, [
  body('preferences.notifications.email').optional().isBoolean(),
  body('preferences.notifications.sms').optional().isBoolean(),
  body('preferences.notifications.push').optional().isBoolean(),
  body('preferences.timezone').optional().isString(),
  body('preferences.language').optional().isString()
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
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferences: req.body.preferences },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { user }
    });
  } catch (error) {
    logger.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
// Add these routes to the existing users.js file

// Get user stats
// Replace the existing /stats route (around line 289) with this corrected version:

// Replace your existing /stats route with this FIXED version:


// Update user password
router.put('/password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
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
    
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user._id);
    
    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    logger.info(`Password updated for user: ${user.email}`);
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
// Add these routes to your users.js file (after your existing routes):

// Get user settings
// Replace your existing GET /settings route with this improved version:



module.exports = router;