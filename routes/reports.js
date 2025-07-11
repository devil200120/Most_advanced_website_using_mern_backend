// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\reports.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Question = require('../models/Question');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.get('/', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Reports endpoint is working',
      data: {
        availableReports: [
          'exam-performance',
          'student-progress',
          'system-usage',
          'financial-summary'
        ]
      }
    });
  } catch (error) {
    logger.error('Error in reports endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get exam performance report
router.get('/exam/:examId/performance', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { examId } = req.params;
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if user can access this exam
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const submissions = await Submission.find({ 
      exam: examId, 
      isSubmitted: true 
    }).populate('student', 'firstName lastName email');
    
    if (submissions.length === 0) {
      return res.json({
        success: true,
        data: {
          exam: exam,
          totalSubmissions: 0,
          performance: {
            averageScore: 0,
            passRate: 0,
            highestScore: 0,
            lowestScore: 0
          },
          submissions: []
        }
      });
    }
    
    // Calculate performance metrics
    const scores = submissions.map(sub => sub.percentage);
    const passedCount = submissions.filter(sub => sub.isPassed).length;
    
    const performance = {
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      passRate: (passedCount / submissions.length) * 100,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores)
    };
    
    // Grade distribution
    const gradeDistribution = submissions.reduce((acc, sub) => {
      acc[sub.grade] = (acc[sub.grade] || 0) + 1;
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        exam: exam,
        totalSubmissions: submissions.length,
        performance,
        gradeDistribution,
        submissions: submissions.map(sub => ({
          student: sub.student,
          score: sub.percentage,
          grade: sub.grade,
          timeTaken: sub.timeTaken,
          submittedAt: sub.submittedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Get exam performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get student progress report
router.get('/student/:studentId/progress', auth, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Check if user can access this student's report
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    if (req.user.role === 'parent' && !req.user.children.includes(studentId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    const submissions = await Submission.find({ 
      student: studentId, 
      isSubmitted: true 
    }).populate('exam', 'title subject grade totalMarks');
    
    if (submissions.length === 0) {
      return res.json({
        success: true,
        data: {
          student: student,
          totalExams: 0,
          progress: {
            averageScore: 0,
            passRate: 0,
            totalTime: 0
          },
          subjectWise: {},
          recentSubmissions: []
        }
      });
    }
    
    // Calculate progress metrics
    const scores = submissions.map(sub => sub.percentage);
    const passedCount = submissions.filter(sub => sub.isPassed).length;
    const totalTime = submissions.reduce((sum, sub) => sum + sub.timeTaken, 0);
    
    const progress = {
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      passRate: (passedCount / submissions.length) * 100,
      totalTime: totalTime
    };
    
    // Subject-wise performance
    const subjectWise = submissions.reduce((acc, sub) => {
      const subject = sub.exam.subject;
      if (!acc[subject]) {
        acc[subject] = {
          totalExams: 0,
          averageScore: 0,
          scores: []
        };
      }
      acc[subject].totalExams++;
      acc[subject].scores.push(sub.percentage);
      acc[subject].averageScore = acc[subject].scores.reduce((sum, score) => sum + score, 0) / acc[subject].scores.length;
      return acc;
    }, {});
    
    // Recent submissions
    const recentSubmissions = submissions
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 10);
    
    res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.fullName,
          email: student.email,
          grade: student.grade
        },
        totalExams: submissions.length,
        progress,
        subjectWise,
        recentSubmissions: recentSubmissions.map(sub => ({
          exam: sub.exam,
          score: sub.percentage,
          grade: sub.grade,
          submittedAt: sub.submittedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Get student progress report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get class performance report
router.get('/class/:grade/:section', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { grade, section } = req.params;
    
    // Get all students in the class
    const students = await User.find({ 
      role: 'student', 
      grade: grade,
      section: section 
    });
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found in this class'
      });
    }
    
    const studentIds = students.map(s => s._id);
    
    // Get all submissions for these students
    const submissions = await Submission.find({ 
      student: { $in: studentIds }, 
      isSubmitted: true 
    }).populate('exam', 'title subject totalMarks')
      .populate('student', 'firstName lastName');
    
    // Calculate class statistics
    const classStats = {
      totalStudents: students.length,
      totalSubmissions: submissions.length,
      averageScore: 0,
      passRate: 0
    };
    
    if (submissions.length > 0) {
      const scores = submissions.map(sub => sub.percentage);
      const passedCount = submissions.filter(sub => sub.isPassed).length;
      
      classStats.averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      classStats.passRate = (passedCount / submissions.length) * 100;
    }
    
    // Top performers
    const studentPerformance = students.map(student => {
      const studentSubmissions = submissions.filter(sub => 
        sub.student._id.toString() === student._id.toString()
      );
      
      if (studentSubmissions.length === 0) {
        return {
          student: student,
          averageScore: 0,
          totalExams: 0,
          passRate: 0
        };
      }
      
      const scores = studentSubmissions.map(sub => sub.percentage);
      const passedCount = studentSubmissions.filter(sub => sub.isPassed).length;
      
      return {
        student: student,
        averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
        totalExams: studentSubmissions.length,
        passRate: (passedCount / studentSubmissions.length) * 100
      };
    });
    
    // Sort by average score
    studentPerformance.sort((a, b) => b.averageScore - a.averageScore);
    
    res.json({
      success: true,
      data: {
        class: { grade, section },
        classStats,
        topPerformers: studentPerformance.slice(0, 10),
        allStudents: studentPerformance
      }
    });
  } catch (error) {
    logger.error('Get class performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get question analysis report
router.get('/question/:questionId/analysis', auth, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { questionId } = req.params;
    
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if user can access this question
    if (req.user.role === 'teacher' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Get all submissions that include this question
    const submissions = await Submission.find({
      'answers.questionId': questionId,
      isSubmitted: true
    }).populate('student', 'firstName lastName');
    
    if (submissions.length === 0) {
      return res.json({
        success: true,
        data: {
          question: question,
          analysis: {
            totalAttempts: 0,
            correctAttempts: 0,
            successRate: 0,
            averageTime: 0
          },
          optionAnalysis: []
        }
      });
    }
    
    // Extract answers for this question
    const answers = [];
    submissions.forEach(submission => {
      const answer = submission.answers.find(ans => 
        ans.questionId.toString() === questionId
      );
      if (answer) {
        answers.push({
          student: submission.student,
          answer: answer.answer,
          isCorrect: answer.isCorrect,
          timeTaken: answer.timeTaken
        });
      }
    });
    
    // Calculate analysis
    const analysis = {
      totalAttempts: answers.length,
      correctAttempts: answers.filter(ans => ans.isCorrect).length,
      successRate: (answers.filter(ans => ans.isCorrect).length / answers.length) * 100,
      averageTime: answers.reduce((sum, ans) => sum + ans.timeTaken, 0) / answers.length
    };
    
    // Option analysis for multiple choice questions
    let optionAnalysis = [];
    if (question.type === 'multiple-choice' && question.options.length > 0) {
      optionAnalysis = question.options.map((option, index) => {
        const count = answers.filter(ans => ans.answer === index).length;
        return {
          option: option.text,
          count: count,
          percentage: (count / answers.length) * 100,
          isCorrect: option.isCorrect
        };
      });
    }
    
    res.json({
      success: true,
      data: {
        question: question,
        analysis,
        optionAnalysis,
        answers: answers
      }
    });
  } catch (error) {
    logger.error('Get question analysis report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get system overview report (Admin only)
router.get('/system/overview', auth, authorize('admin'), async (req, res) => {
  try {
    // Get counts
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalParents = await User.countDocuments({ role: 'parent' });
    
    const totalExams = await Exam.countDocuments();
    const publishedExams = await Exam.countDocuments({ isPublished: true });
    const totalQuestions = await Question.countDocuments();
    const totalSubmissions = await Submission.countDocuments({ isSubmitted: true });
    
    // Recent activity
    const recentSubmissions = await Submission.find({ isSubmitted: true })
      .populate('student', 'firstName lastName')
      .populate('exam', 'title subject')
      .sort({ submittedAt: -1 })
      .limit(10);
    
    const recentExams = await Exam.find({ isPublished: true })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // User registrations by month
    const userRegistrations = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);
    
    res.json({
      success: true,
      data: {
        userCounts: {
          total: totalUsers,
          students: totalStudents,
          teachers: totalTeachers,
          parents: totalParents
        },
        examCounts: {
          total: totalExams,
          published: publishedExams,
          questions: totalQuestions,
          submissions: totalSubmissions
        },
        recentActivity: {
          submissions: recentSubmissions,
          exams: recentExams
        },
        userRegistrations
      }
    });
  } catch (error) {
    logger.error('Get system overview report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;