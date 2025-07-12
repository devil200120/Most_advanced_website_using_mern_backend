const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Test route to check auth and user role
router.get('/test', auth, async (req, res) => {
  try {
    console.log('Parent test route - User:', req.user);
    res.json({
      success: true,
      message: 'Parent route accessible',
      user: {
        id: req.user._id,
        role: req.user.role,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      }
    });
  } catch (error) {
    console.error('Parent test error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get parent dashboard data - with better error handling
router.get('/dashboard', auth, async (req, res) => {
  try {
    console.log('Parent dashboard request received for user:', req.user._id, 'Role:', req.user.role);
    
    // Check if user has parent role
    if (req.user.role !== 'parent') {
      return res.status(403).json({
        success: false,
        message: `Access denied. User role is '${req.user.role}', but 'parent' role is required.`,
        userRole: req.user.role,
        requiredRole: 'parent'
      });
    }
    
    const parentId = req.user._id;
    
    // Get parent's children - fix the query
    const children = await User.find({ 
      $or: [
        { parentId: parentId },
        { _id: { $in: req.user.children || [] } }
      ]
    }).select('-password -resetPasswordToken -verificationToken');
    
    console.log('Found children:', children.length);
    
    // If no children found, return empty dashboard
    if (children.length === 0) {
      console.log('No children found, returning empty dashboard');
      return res.json({
        success: true,
        data: {
          children: [],
          summary: {
            totalChildren: 0,
            totalExams: 0,
            averagePerformance: 0,
            activeChildren: 0
          },
          recentActivities: []
        }
      });
    }
    
    // Get children's exam data
    const childrenIds = children.map(child => child._id);
    const submissions = await Submission.find({ 
      student: { $in: childrenIds },
      isSubmitted: true 
    })
      .populate('exam', 'title subject totalMarks')
      .populate('student', 'firstName lastName')
      .sort({ submittedAt: -1 });
    
    console.log('Found submissions:', submissions.length);
    
    // Calculate stats for each child
    const childrenStats = await Promise.all(children.map(async (child) => {
      const childSubmissions = submissions.filter(sub => 
        sub.student && sub.student._id.toString() === child._id.toString()
      );
      
      const totalScore = childSubmissions.reduce((sum, sub) => 
        sum + (sub.percentage || 0), 0
      );
      
      const stats = {
        totalExams: childSubmissions.length,
        averageScore: childSubmissions.length > 0 
          ? Math.round(totalScore / childSubmissions.length)
          : 0,
        lastExamDate: childSubmissions.length > 0 
          ? childSubmissions[0].submittedAt
          : null,
        performance: childSubmissions.length > 0 
          ? totalScore / childSubmissions.length
          : 0,
        bestScore: childSubmissions.length > 0 
          ? Math.max(...childSubmissions.map(sub => sub.percentage || 0))
          : 0,
        recentScore: childSubmissions.length > 0 
          ? childSubmissions[0].percentage || 0
          : 0
      };
      
      return {
        ...child.toObject(),
        stats
      };
    }));
    
    // Recent activities
    const recentActivities = submissions
      .slice(0, 10)
      .map(sub => ({
        id: sub._id,
        childName: sub.student ? `${sub.student.firstName} ${sub.student.lastName}` : 'Unknown Student',
        examTitle: sub.exam ? sub.exam.title : 'Unknown Exam',
        subject: sub.exam ? sub.exam.subject : 'Unknown Subject',
        score: sub.percentage || 0,
        date: sub.submittedAt
      }));
    
    const totalPerformance = submissions.reduce((sum, sub) => 
      sum + (sub.percentage || 0), 0
    );
    
    const dashboardData = {
      children: childrenStats,
      summary: {
        totalChildren: children.length,
        totalExams: submissions.length,
        averagePerformance: submissions.length > 0 
          ? Math.round(totalPerformance / submissions.length)
          : 0,
        activeChildren: childrenStats.filter(child => {
          if (!child.stats.lastExamDate) return false;
          const timeDiff = Date.now() - new Date(child.stats.lastExamDate).getTime();
          return timeDiff < 7 * 24 * 60 * 60 * 1000; // Last 7 days
        }).length
      },
      recentActivities
    };
    
    console.log('Sending dashboard data:', JSON.stringify(dashboardData, null, 2));
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Get parent dashboard error:', error);
    logger.error('Get parent dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Add child to parent account
router.post('/add-child', auth, authorize('parent'), [
  body('childEmail').isEmail().withMessage('Valid email is required'),
  body('relationship').notEmpty().withMessage('Relationship is required')
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
    
    const { childEmail, relationship } = req.body;
    const parentId = req.user._id;
    
    console.log('Adding child request:', { childEmail, relationship, parentId });
    
    // Find the child by email
    const child = await User.findOne({ email: childEmail, role: 'student' });
    
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Student not found with the provided email address'
      });
    }
    
    // Check if child is already linked to this parent
    if (child.parentId && child.parentId.toString() === parentId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'This child is already linked to your account'
      });
    }
    
    // Check if child is already linked to another parent
    if (child.parentId) {
      return res.status(400).json({
        success: false,
        message: 'This child is already linked to another parent account'
      });
    }
    
    // Link child to parent
    await User.findByIdAndUpdate(child._id, {
      parentId: parentId,
      relationship: relationship
    });
    
    // Add child to parent's children array
    await User.findByIdAndUpdate(parentId, {
      $addToSet: { children: child._id }
    });
    
    console.log('Child successfully added to parent');
    
    res.json({
      success: true,
      message: 'Child added successfully',
      data: {
        child: {
          _id: child._id,
          firstName: child.firstName,
          lastName: child.lastName,
          email: child.email,
          relationship: relationship
        }
      }
    });
  } catch (error) {
    console.error('Add child error:', error);
    logger.error('Add child error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get child progress data
router.get('/child/:childId/progress', auth, authorize('parent'), async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user._id;
    
    // Verify the child belongs to this parent
    const child = await User.findOne({
      _id: childId,
      $or: [
        { parentId: parentId },
        { _id: { $in: req.user.children || [] } }
      ]
    }).select('-password -resetPasswordToken -verificationToken');
    
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found or not linked to your account'
      });
    }
    
    // Get child's submissions
    const submissions = await Submission.find({
      student: childId,
      isSubmitted: true
    })
      .populate('exam', 'title subject totalMarks schedule')
      .sort({ submittedAt: -1 });
    
    // Calculate progress data
    const progressData = {
      child: child,
      submissions: submissions,
      stats: {
        totalExams: submissions.length,
        averageScore: submissions.length > 0 
          ? Math.round(submissions.reduce((sum, sub) => sum + (sub.percentage || 0), 0) / submissions.length)
          : 0,
        bestScore: submissions.length > 0 
          ? Math.max(...submissions.map(sub => sub.percentage || 0))
          : 0,
        recentScore: submissions.length > 0 
          ? submissions[0].percentage || 0
          : 0
      }
    };
    
    res.json({
      success: true,
      data: progressData
    });
  } catch (error) {
    console.error('Get child progress error:', error);
    logger.error('Get child progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Remove child from parent account
router.delete('/child/:childId/remove', auth, authorize('parent'), async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user._id;
    
    // Find the child and verify ownership
    const child = await User.findOne({
      _id: childId,
      parentId: parentId
    });
    
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found or not linked to your account'
      });
    }
    
    // Remove parent link from child
    await User.findByIdAndUpdate(childId, {
      $unset: { parentId: 1, relationship: 1 }
    });
    
    // Remove child from parent's children array
    await User.findByIdAndUpdate(parentId, {
      $pull: { children: childId }
    });
    
    res.json({
      success: true,
      message: 'Child removed successfully'
    });
  } catch (error) {
    console.error('Remove child error:', error);
    logger.error('Remove child error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
