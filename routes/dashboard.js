// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\dashboard.js
const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

const router = express.Router();

// Student Dashboard
router.get('/student', auth, authorize('student'), async (req, res) => {
  try {
    const studentId = req.user._id;
    const currentDate = new Date();

    // Initialize default values
    let upcomingExams = [];
    let recentResults = [];
    let notifications = [];
    let totalSubmissions = 0;
    let completedExams = 0;
    let pendingResults = 0;
    let averageScore = 0;

    try {
      // Get upcoming exams with proper error handling
      upcomingExams = await Exam.find({
        isActive: true,
        isPublished: true,
        $or: [
          { 'schedule.startDate': { $gte: currentDate } },
          { startTime: { $gte: currentDate } }
        ]
      })
      .populate('createdBy', 'firstName lastName')
      .sort({ 'schedule.startDate': 1, startTime: 1 })
      .limit(5)
      .lean() || [];
    } catch (error) {
      logger.warn('Error fetching upcoming exams:', error.message);
      upcomingExams = [];
    }

    try {
      // Get recent submissions/results with proper error handling
      const submissions = await Submission.find({
        student: studentId,
        isSubmitted: true
      })
      .populate('exam', 'title subject totalMarks')
      .sort({ submittedAt: -1 })
      .limit(10)
      .lean() || [];

      // Process results
      recentResults = submissions.map(sub => ({
        _id: sub._id,
        exam: sub.exam,
        percentage: sub.percentage || Math.round((sub.totalScore || 0) / (sub.exam?.totalMarks || 1) * 100),
        marksObtained: sub.totalScore || 0,
        isPassed: sub.isPassed || false,
        submittedAt: sub.submittedAt
      })).slice(0, 5);

      // Calculate stats
      totalSubmissions = submissions.length;
      completedExams = submissions.filter(sub => sub.isGraded).length;
      pendingResults = submissions.filter(sub => !sub.isGraded).length;

      if (submissions.length > 0) {
        const scores = submissions.map(sub => sub.percentage || Math.round((sub.totalScore || 0) / (sub.exam?.totalMarks || 1) * 100));
        averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      }
    } catch (error) {
      logger.warn('Error fetching submissions:', error.message);
    }

    try {
      // Get notifications with fallback
      if (Notification) {
        notifications = await Notification.find({
          recipient: studentId,
          isRead: false
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean() || [];
      }
    } catch (error) {
      logger.warn('Error fetching notifications:', error.message);
      notifications = [];
    }

    const stats = {
      totalExams: totalSubmissions,
      completedExams,
      pendingResults,
      averageScore,
      examsTrend: totalSubmissions > 0 ? 'up' : 'neutral',
      scoreTrend: averageScore > 70 ? 'up' : averageScore > 50 ? 'neutral' : 'down',
      completedTrend: completedExams > 0 ? 'up' : 'neutral',
      pendingTrend: pendingResults > 0 ? 'up' : 'neutral'
    };

    res.json({
      success: true,
      data: {
        stats,
        upcomingExams,
        recentResults,
        notifications
      }
    });

  } catch (error) {
    logger.error('Student dashboard error:', error);
    
    // Return safe defaults on error
    res.json({
      success: true,
      data: {
        stats: {
          totalExams: 0,
          completedExams: 0,
          pendingResults: 0,
          averageScore: 0,
          examsTrend: 'neutral',
          scoreTrend: 'neutral',
          completedTrend: 'neutral',
          pendingTrend: 'neutral'
        },
        upcomingExams: [],
        recentResults: [],
        notifications: []
      }
    });
  }
});

// Teacher Dashboard
router.get('/teacher', auth, authorize('teacher'), async (req, res) => {
  try {
    const teacherId = req.user._id;
    const currentDate = new Date();

    let totalExams = 0;
    let activeExams = 0;
    let upcomingExams = [];
    let pendingGrading = [];
    let totalStudents = 0;

    try {
      totalExams = await Exam.countDocuments({ createdBy: teacherId }) || 0;
      
      activeExams = await Exam.countDocuments({ 
        createdBy: teacherId,
        isActive: true,
        $or: [
          { 'schedule.endDate': { $gte: currentDate } },
          { endTime: { $gte: currentDate } }
        ]
      }) || 0;

      upcomingExams = await Exam.find({
        createdBy: teacherId,
        isActive: true,
        $or: [
          { 'schedule.startDate': { $gte: currentDate } },
          { startTime: { $gte: currentDate } }
        ]
      })
      .sort({ 'schedule.startDate': 1, startTime: 1 })
      .limit(5)
      .lean() || [];
    } catch (error) {
      logger.warn('Error fetching teacher exams:', error.message);
    }

    try {
      // Get teacher's exams for pending grading
      const teacherExams = await Exam.find({ createdBy: teacherId }).select('_id title').lean() || [];
      const examIds = teacherExams.map(exam => exam._id);

      if (examIds.length > 0) {
        pendingGrading = await Submission.find({
          exam: { $in: examIds },
          isSubmitted: true,
          isGraded: false
        })
        .populate('exam', 'title')
        .populate('student', 'firstName lastName')
        .sort({ submittedAt: -1 })
        .limit(10)
        .lean() || [];

        // Get unique students count
        const studentSubmissions = await Submission.distinct('student', { exam: { $in: examIds } }) || [];
        totalStudents = studentSubmissions.length;
      }
    } catch (error) {
      logger.warn('Error fetching pending grading:', error.message);
    }

    const stats = {
      totalExams,
      activeExams,
      totalStudents,
      pendingGrading: pendingGrading.length,
      examsTrend: totalExams > 0 ? 'up' : 'neutral',
      studentsTrend: totalStudents > 0 ? 'up' : 'neutral',
      gradingTrend: pendingGrading.length > 0 ? 'up' : 'neutral'
    };

    res.json({
      success: true,
      data: {
        stats,
        upcomingExams,
        pendingGrading,
        recentActivity: []
      }
    });

  } catch (error) {
    logger.error('Teacher dashboard error:', error);
    
    res.json({
      success: true,
      data: {
        stats: {
          totalExams: 0,
          activeExams: 0,
          totalStudents: 0,
          pendingGrading: 0,
          examsTrend: 'neutral',
          studentsTrend: 'neutral',
          gradingTrend: 'neutral'
        },
        upcomingExams: [],
        pendingGrading: [],
        recentActivity: []
      }
    });
  }
});

// Admin Dashboard
router.get('/admin', auth, authorize('admin'), async (req, res) => {
  try {
    const currentDate = new Date();

    // Initialize default values
    let totalUsers = 0;
    let totalStudents = 0;
    let totalTeachers = 0;
    let totalExams = 0;
    let activeExams = 0;
    let totalSubmissions = 0;
    let pendingGrading = 0;
    let recentUsers = [];
    let recentExams = [];

    try {
      // Get overall stats
      totalUsers = await User.countDocuments() || 0;
      totalStudents = await User.countDocuments({ role: 'student' }) || 0;
      totalTeachers = await User.countDocuments({ role: 'teacher' }) || 0;
      totalExams = await Exam.countDocuments() || 0;
      
      activeExams = await Exam.countDocuments({ 
        isActive: true,
        'schedule.endDate': { $gte: currentDate }
      }) || 0;

      totalSubmissions = await Submission.countDocuments({ isSubmitted: true }) || 0;
      pendingGrading = await Submission.countDocuments({ 
        isSubmitted: true, 
        isGraded: false 
      }) || 0;
    } catch (error) {
      logger.warn('Error fetching admin stats:', error.message);
    }

    try {
      // Get recent activity
      recentUsers = await User.find({ isActive: true })
        .select('firstName lastName email role createdAt')
        .sort({ createdAt: -1 })
        .limit(5) || [];

      recentExams = await Exam.find({ isActive: true })
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(5) || [];
    } catch (error) {
      logger.warn('Error fetching recent activity:', error.message);
    }

    const stats = {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalExams,
      activeExams,
      totalSubmissions,
      pendingGrading,
      usersTrend: totalUsers > 0 ? 'up' : 'neutral',
      examsTrend: totalExams > 0 ? 'up' : 'neutral',
      submissionsTrend: totalSubmissions > 0 ? 'up' : 'neutral'
    };

    res.json({
      success: true,
      data: {
        stats,
        recentUsers,
        recentExams,
        systemHealth: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      }
    });

  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Parent Dashboard
router.get('/parent', auth, authorize('parent'), async (req, res) => {
  try {
    const parentId = req.user._id;

    try {
      // Get parent's children with null check
      const parent = await User.findById(parentId).populate('children');
      
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Parent user not found'
        });
      }

      const childrenIds = parent.children ? parent.children.map(child => child._id) : [];

      if (childrenIds.length === 0) {
        return res.json({
          success: true,
          data: {
            stats: {
              totalChildren: 0,
              totalExamsTaken: 0,
              averagePerformance: 0
            },
            children: [],
            recentResults: [],
            upcomingExams: [],
            message: 'No children linked to this account'
          }
        });
      }

      // Initialize default values
      let childrenSubmissions = [];
      let upcomingExams = [];

      try {
        // Get children's exam data
        childrenSubmissions = await Submission.find({
          student: { $in: childrenIds },
          isSubmitted: true
        })
        .populate('exam', 'title subject totalMarks')
        .populate('student', 'firstName lastName')
        .sort({ submittedAt: -1 }) || [];
      } catch (error) {
        logger.warn('Error fetching children submissions:', error.message);
      }

      try {
        upcomingExams = await Exam.find({
          'schedule.startDate': { $gte: new Date() },
          isActive: true
        })
        .populate('createdBy', 'firstName lastName')
        .sort({ 'schedule.startDate': 1 })
        .limit(10) || [];
      } catch (error) {
        logger.warn('Error fetching upcoming exams for parent:', error.message);
      }

      const stats = {
        totalChildren: childrenIds.length,
        totalExamsTaken: childrenSubmissions.length,
        averagePerformance: childrenSubmissions.length > 0 
          ? Math.round(childrenSubmissions.reduce((sum, sub) => sum + (sub.percentage || 0), 0) / childrenSubmissions.length)
          : 0
      };

      res.json({
        success: true,
        data: {
          stats,
          children: parent.children || [],
          recentResults: childrenSubmissions.slice(0, 10),
          upcomingExams
        }
      });

    } catch (error) {
      logger.warn('Error in parent dashboard:', error.message);
      res.json({
        success: true,
        data: {
          stats: {
            totalChildren: 0,
            totalExamsTaken: 0,
            averagePerformance: 0
          },
          children: [],
          recentResults: [],
          upcomingExams: [],
          message: 'Error loading parent data'
        }
      });
    }

  } catch (error) {
    logger.error('Parent dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test endpoint to verify dashboard routes are working
router.get('/test', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard routes are working properly',
    user: {
      id: req.user._id,
      role: req.user.role,
      email: req.user.email,
      isActive: req.user.isActive
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;