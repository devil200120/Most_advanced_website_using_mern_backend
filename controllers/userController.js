// File: c:\Users\KIIT0001\Desktop\exam_site\backend\controllers\userController.js
const User = require('../models/User');
const logger = require('../utils/logger');

// Get all users
const getAllUsers = async (req, res) => {
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
};

// Get user by ID
const getUserById = async (req, res) => {
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
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
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
};

// Delete user
const deleteUser = async (req, res) => {
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
};

// Get students
const getStudents = async (req, res) => {
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
};

// Link parent to student
const linkParentToStudent = async (req, res) => {
  try {
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
};

// Update preferences
const updatePreferences = async (req, res) => {
  try {
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
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    logger.info(`Password changed: ${user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateProfile,
  deleteUser,
  getStudents,
  linkParentToStudent,
  updatePreferences,
  changePassword
};