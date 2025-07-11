// File: c:\Users\KIIT0001\Desktop\exam_site\backend\controllers\questionController.js
const Question = require('../models/Question');
const logger = require('../utils/logger');

// Get all questions
const getAllQuestions = async (req, res) => {
  try {
    const { page = 1, limit = 10, subject, topic, difficulty, search } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'teacher') {
      query.createdBy = req.user._id;
    }
    
    if (subject) query.subject = subject;
    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.$or = [
        { text: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } }
      ];
    }
    
    const questions = await Question.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Question.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        questions,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    logger.error('Get questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get question by ID
const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if user can access this question
    if (req.user.role === 'teacher' && question.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { question }
    });
  } catch (error) {
    logger.error('Get question by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Create question
const createQuestion = async (req, res) => {
  try {
    const questionData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Handle file attachments
    if (req.files && req.files.length > 0) {
      questionData.attachments = req.files.map(file => ({
        filename: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
    }
    
    // Parse options if they're sent as JSON string
    if (typeof questionData.options === 'string') {
      questionData.options = JSON.parse(questionData.options);
    }
    
    const question = new Question(questionData);
    await question.save();
    
    logger.info(`Question created: ${question.text.substring(0, 50)}... by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: { question }
    });
  } catch (error) {
    logger.error('Create question error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update question
const updateQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if user can update this question
    if (req.user.role === 'teacher' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const updateData = { ...req.body };
    
    // Handle file attachments
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(file => ({
        filename: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
      updateData.attachments = [...(question.attachments || []), ...newAttachments];
    }
    
    // Parse options if they're sent as JSON string
    if (typeof updateData.options === 'string') {
      updateData.options = JSON.parse(updateData.options);
    }
    
    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');
    
    logger.info(`Question updated: ${updatedQuestion.text.substring(0, 50)}... by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Question updated successfully',
      data: { question: updatedQuestion }
    });
  } catch (error) {
    logger.error('Update question error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete question
const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Check if user can delete this question
    if (req.user.role === 'teacher' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    await Question.findByIdAndDelete(req.params.id);
    
    logger.info(`Question deleted: ${question.text.substring(0, 50)}... by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    logger.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Bulk create questions
const bulkCreateQuestions = async (req, res) => {
  try {
    const { questions } = req.body;
    
    // Add createdBy to each question
    const questionsWithCreator = questions.map(q => ({
      ...q,
      createdBy: req.user._id
    }));
    
    const createdQuestions = await Question.insertMany(questionsWithCreator);
    
    logger.info(`${createdQuestions.length} questions created in bulk by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: `${createdQuestions.length} questions created successfully`,
      data: { questions: createdQuestions }
    });
  } catch (error) {
    logger.error('Bulk create questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get question statistics
const getQuestionStats = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
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
    
    const stats = {
      totalAttempts: question.analytics.totalAttempts,
      correctAttempts: question.analytics.correctAttempts,
      successRate: question.successRate,
      averageTime: question.analytics.averageTime,
      usageCount: question.usageCount
    };
    
    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    logger.error('Get question stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkCreateQuestions,
  getQuestionStats
};