// File: c:\Users\KIIT0001\Desktop\exam_site\backend\config\database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.info('Mongoose disconnected from MongoDB');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('Mongoose connection closed due to application termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
};

// Database health check
const checkDBHealth = async () => {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return {
      status: states[state],
      state: state,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  } catch (error) {
    logger.error('Database health check error:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
};

// Clear database (for testing purposes only)
const clearDatabase = async () => {
  if (process.env.NODE_ENV === 'test') {
    try {
      const collections = await mongoose.connection.db.collections();
      
      for (let collection of collections) {
        await collection.deleteMany({});
      }
      
      logger.info('Database cleared for testing');
    } catch (error) {
      logger.error('Error clearing database:', error);
      throw error;
    }
  } else {
    throw new Error('Database clearing is only allowed in test environment');
  }
};

// Seed initial data
const seedDatabase = async () => {
  try {
    const User = require('../models/User');
    const Setting = require('../models/Setting');
    
    // Check if admin user exists
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      // Create default admin user
      const adminUser = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@examsite.com',
        password: 'admin123',
        role: 'admin',
        isVerified: true,
        isActive: true
      });
      
      await adminUser.save();
      logger.info('Default admin user created');
    }
    
    // Check if default settings exist
    const settingsExist = await Setting.findOne({});
    
    if (!settingsExist) {
      // Create default settings
      const defaultSettings = [
        {
          key: 'site_name',
          value: 'Exam Management System',
          type: 'string',
          category: 'general',
          description: 'The name of the website',
          isPublic: true,
          isEditable: true
        },
        {
          key: 'max_exam_duration',
          value: 180,
          type: 'number',
          category: 'exam',
          description: 'Maximum exam duration in minutes',
          isPublic: false,
          isEditable: true,
          validation: { min: 30, max: 480 }
        },
        {
          key: 'enable_proctoring',
          value: false,
          type: 'boolean',
          category: 'exam',
          description: 'Enable proctoring features',
          isPublic: false,
          isEditable: true
        },
        {
          key: 'payment_methods',
          value: ['stripe', 'razorpay'],
          type: 'array',
          category: 'payment',
          description: 'Enabled payment methods',
          isPublic: true,
          isEditable: true
        },
        {
          key: 'subscription_plans',
          value: {
            basic: { price: 9.99, features: ['Basic exams', 'Email support'] },
            premium: { price: 19.99, features: ['Advanced exams', 'Priority support', 'Analytics'] },
            enterprise: { price: 49.99, features: ['All features', 'Custom branding', 'API access'] }
          },
          type: 'object',
          category: 'subscription',
          description: 'Available subscription plans',
          isPublic: true,
          isEditable: true
        }
      ];
      
      await Setting.insertMany(defaultSettings);
      logger.info('Default settings created');
    }
    
  } catch (error) {
    logger.error('Database seeding error:', error);
    throw error;
  }
};

module.exports = {
  connectDB,
  checkDBHealth,
  clearDatabase,
  seedDatabase
};