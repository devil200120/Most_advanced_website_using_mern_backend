// File: c:\Users\KIIT0001\Desktop\exam_site\backend\controllers\reportController.js
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Question = require('../models/Question');
const logger = require('../utils/logger');

// Get exam performance report
const getExamPerformanceReport = async (req, res) => {
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
};

// Get student progress report
const getStudentProgressReport = async (req, res) => {
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
};

// Get system overview report
const getSystemOverviewReport = async (req, res) => {
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
        }
      }
    });
  } catch (error) {
    logger.error('Get system overview report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getExamPerformanceReport,
  getStudentProgressReport,
  getSystemOverviewReport
};