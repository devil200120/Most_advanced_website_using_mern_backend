// File: c:\Users\KIIT0001\Desktop\exam_site\backend\controllers\notificationController.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail, sendBulkEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');

// Get all notifications for user
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, isRead } = req.query;
    
    let query = { recipient: req.user._id };
    
    if (type) query.type = type;
    if (isRead !== undefined) query.isRead = isRead === 'true';
    
    const notifications = await Notification.find(query)
      .populate('sender', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      recipient: req.user._id, 
      isRead: false 
    });
    
    res.json({
      success: true,
      data: {
        notifications,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
        unreadCount
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Create notification
const createNotification = async (req, res) => {
  try {
    const { recipients, type, title, message, priority = 'medium', data, channels } = req.body;

    // Verify recipients exist
    const users = await User.find({ _id: { $in: recipients } });
    if (users.length !== recipients.length) {
      return res.status(400).json({
        success: false,
        message: 'Some recipients not found'
      });
    }

    // Create notifications for each recipient
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: req.user._id,
      type,
      title,
      message,
      priority,
      data: data || {},
      channels: channels || { email: true, push: true, inApp: true }
    }));

    const createdNotifications = await Notification.insertMany(notifications);

    // Send email notifications if enabled
    if (channels?.email) {
      const emailRecipients = users
        .filter(user => user.preferences.notifications.email)
        .map(user => user.email);

      if (emailRecipients.length > 0) {
        try {
          await sendBulkEmail(emailRecipients, title, message, `
            <h2>${title}</h2>
            <p>${message}</p>
            <p>Best regards,<br>Exam Management Team</p>
          `);
        } catch (emailError) {
          logger.error('Email notification error:', emailError);
        }
      }
    }

    logger.info(`${createdNotifications.length} notifications created by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Notifications created successfully',
      data: { notifications: createdNotifications }
    });
  } catch (error) {
    logger.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Check if user can mark this notification as read
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    await notification.markAsRead();
    
    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    logger.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Check if user can delete this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    await Notification.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Send system notification
const sendSystemNotification = async (req, res) => {
  try {
    const { title, message, priority = 'medium', userRoles, data } = req.body;

    // Get users based on roles
    let userQuery = { isActive: true };
    if (userRoles && userRoles.length > 0) {
      userQuery.role = { $in: userRoles };
    }

    const users = await User.find(userQuery);

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users found'
      });
    }

    // Create notifications for all users
    const notifications = users.map(user => ({
      recipient: user._id,
      sender: req.user._id,
      type: 'system-update',
      title,
      message,
      priority,
      data: data || {},
      channels: { email: true, push: true, inApp: true }
    }));

    const createdNotifications = await Notification.insertMany(notifications);

    // Send email notifications
    const emailRecipients = users
      .filter(user => user.preferences.notifications.email)
      .map(user => user.email);

    if (emailRecipients.length > 0) {
      try {
        await sendBulkEmail(emailRecipients, title, message, `
          <h2>${title}</h2>
          <p>${message}</p>
          <p>Best regards,<br>Exam Management Team</p>
        `);
      } catch (emailError) {
        logger.error('System notification email error:', emailError);
      }
    }

    logger.info(`System notification sent to ${createdNotifications.length} users by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `System notification sent to ${createdNotifications.length} users`,
      data: { count: createdNotifications.length }
    });
  } catch (error) {
    logger.error('Send system notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get notification statistics
const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      { $match: { recipient: req.user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          byType: {
            $push: {
              type: '$type',
              isRead: '$isRead'
            }
          }
        }
      }
    ]);

    const result = stats[0] || { total: 0, unread: 0, byType: [] };

    // Count by type
    const typeStats = result.byType.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = { total: 0, unread: 0 };
      }
      acc[item.type].total++;
      if (!item.isRead) {
        acc[item.type].unread++;
      }
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total: result.total,
        unread: result.unread,
        byType: typeStats
      }
    });
  } catch (error) {
    logger.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendSystemNotification,
  getNotificationStats
};