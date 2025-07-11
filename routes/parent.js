const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get parent dashboard data
router.get('/dashboard', auth, authorize('parent'), async (req, res) => {
  try {
    const parentId = req.user._id;
    
    // Get parent's children
    const children = await User.find({ parentId: parentId }).select('-password');
    
    // Get children's exam data
    const childrenIds = children.map(child => child._id);
    const submissions = await Submission.find({ student: { $in: childrenIds } })
      .populate('exam', 'title subject')
      .populate('student', 'firstName lastName');
    
    // Calculate stats for each child
    const childrenStats = await Promise.all(children.map(async (child) => {
      const childSubmissions = submissions.filter(sub => sub.student._id.toString() === child._id.toString());
      
      const stats = {
        totalExams: childSubmissions.length,
        averageScore: childSubmissions.length > 0 
          ? Math.round(childSubmissions.reduce((sum, sub) => sum + (sub.totalScore || 0), 0) / childSubmissions.length)
          : 0,
        lastExamDate: childSubmissions.length > 0 
          ? Math.max(...childSubmissions.map(sub => new Date(sub.createdAt).getTime()))
          : null,
        performance: childSubmissions.length > 0 
          ? childSubmissions.filter(sub => (sub.totalScore || 0) >= 70).length / childSubmissions.length * 100
          : 0
      };
      
      return {
        ...child.toObject(),
        stats
      };
    }));
    
    // Recent activities
    const recentActivities = submissions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(sub => ({
        id: sub._id,
        childName: `${sub.student.firstName} ${sub.student.lastName}`,
        examTitle: sub.exam.title,
        subject: sub.exam.subject,
        score: sub.totalScore || 0,
        date: sub.createdAt
      }));
    
    const dashboardData = {
      children: childrenStats,
      summary: {
        totalChildren: children.length,
        totalExams: submissions.length,
        averagePerformance: submissions.length > 0 
          ? Math.round(submissions.reduce((sum, sub) => sum + (sub.totalScore || 0), 0) / submissions.length)
          : 0,
        activeChildren: children.filter(child => {
          const childSubmissions = submissions.filter(sub => sub.student._id.toString() === child._id.toString());
          return childSubmissions.some(sub => {
            const timeDiff = Date.now() - new Date(sub.createdAt).getTime();
            return timeDiff < 7 * 24 * 60 * 60 * 1000; // Last 7 days
          });
        }).length
      },
      recentActivities
    };
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Get parent dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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
    
    // Find the child by email
    const child = await User.findOne({ email: childEmail, role: 'student' });
    
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Student not found with this email'
      });
    }
    
    // Check if child already has a parent
    if (child.parentId) {
      return res.status(400).json({
        success: false,
        message: 'This student already has a parent linked'
      });
    }
    
    // Link child to parent
    child.parentId = parentId;
    child.parentRelationship = relationship;
    await child.save();
    
    // Add child to parent's children array
    const parent = await User.findById(parentId);
    if (!parent.children.includes(child._id)) {
      parent.children.push(child._id);
      await parent.save();
    }
    
    res.json({
      success: true,
      message: 'Child added successfully',
      data: {
        child: {
          id: child._id,
          name: `${child.firstName} ${child.lastName}`,
          email: child.email,
          relationship: relationship
        }
      }
    });
  } catch (error) {
    logger.error('Add child error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get child's detailed progress
router.get('/child/:childId/progress', auth, authorize('parent'), async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user._id;
    
    // Verify the child belongs to this parent
    const child = await User.findOne({ _id: childId, parentId: parentId });
    
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found or not linked to your account'
      });
    }
    
    // Get child's submissions
    const submissions = await Submission.find({ student: childId })
      .populate('exam', 'title subject totalMarks')
      .sort({ createdAt: -1 });
    
    const progressData = {
      child: {
        id: child._id,
        name: `${child.firstName} ${child.lastName}`,
        email: child.email
      },
      submissions: submissions.map(sub => ({
        id: sub._id,
        examTitle: sub.exam.title,
        subject: sub.exam.subject,
        score: sub.totalScore || 0,
        totalMarks: sub.exam.totalMarks,
        percentage: sub.exam.totalMarks > 0 ? Math.round((sub.totalScore || 0) / sub.exam.totalMarks * 100) : 0,
        date: sub.createdAt,
        timeTaken: sub.timeTaken
      })),
      stats: {
        totalExams: submissions.length,
        averageScore: submissions.length > 0 
          ? Math.round(submissions.reduce((sum, sub) => sum + (sub.totalScore || 0), 0) / submissions.length)
          : 0,
        bestScore: submissions.length > 0 
          ? Math.max(...submissions.map(sub => sub.totalScore || 0))
          : 0,
        recentTrend: submissions.slice(0, 5).map(sub => ({
          date: sub.createdAt,
          score: sub.totalScore || 0
        }))
      }
    };
    
    res.json({
      success: true,
      data: progressData
    });
  } catch (error) {
    logger.error('Get child progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;