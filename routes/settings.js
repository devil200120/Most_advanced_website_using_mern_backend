// File: c:\Users\KIIT0001\Desktop\exam_site\backend\routes\settings.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Setting = require('../models/Setting');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all settings
router.get('/', auth, async (req, res) => {
  try {
    const { category, isPublic } = req.query;
    
    let query = {};
    
    // Non-admin users can only see public settings
    if (req.user.role !== 'admin') {
      query.isPublic = true;
    } else if (isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    }
    
    if (category) query.category = category;
    
    const settings = await Setting.find(query)
      .populate('updatedBy', 'firstName lastName')
      .sort({ category: 1, key: 1 });
    
    res.json({
      success: true,
      data: { settings }
    });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get setting by key
router.get('/:key', auth, async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key })
      .populate('updatedBy', 'firstName lastName');
    
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }
    
    // Check if user can access this setting
    if (!setting.isPublic && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { setting }
    });
  } catch (error) {
    logger.error('Get setting by key error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create setting
router.post('/', auth, authorize('admin'), [
  body('key').trim().isLength({ min: 2 }).withMessage('Key must be at least 2 characters'),
  body('value').notEmpty().withMessage('Value is required'),
  body('type').isIn(['string', 'number', 'boolean', 'object', 'array']).withMessage('Invalid type'),
  body('category').trim().isLength({ min: 2 }).withMessage('Category must be at least 2 characters'),
  body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters')
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
    
    const { key, value, type, category, description, isPublic = false, isEditable = true, validation } = req.body;
    
    // Check if setting already exists
    const existingSetting = await Setting.findOne({ key });
    if (existingSetting) {
      return res.status(400).json({
        success: false,
        message: 'Setting with this key already exists'
      });
    }
    
    // Validate value based on type
    let validatedValue = value;
    try {
      switch (type) {
        case 'number':
          validatedValue = Number(value);
          if (isNaN(validatedValue)) {
            throw new Error('Invalid number value');
          }
          break;
        case 'boolean':
          validatedValue = Boolean(value);
          break;
        case 'object':
          validatedValue = typeof value === 'object' ? value : JSON.parse(value);
          break;
        case 'array':
          validatedValue = Array.isArray(value) ? value : JSON.parse(value);
          if (!Array.isArray(validatedValue)) {
            throw new Error('Invalid array value');
          }
          break;
        default:
          validatedValue = String(value);
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid value for type ${type}`
      });
    }
    
    const setting = new Setting({
      key,
      value: validatedValue,
      type,
      category,
      description,
      isPublic,
      isEditable,
      validation,
      updatedBy: req.user._id
    });
    
    await setting.save();
    
    logger.info(`Setting created: ${key} by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Setting created successfully',
      data: { setting }
    });
  } catch (error) {
    logger.error('Create setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update setting
router.put('/:key', auth, authorize('admin'), [
  body('value').notEmpty().withMessage('Value is required'),
  body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters')
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
    
    const setting = await Setting.findOne({ key: req.params.key });
    
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }
    
    if (!setting.isEditable) {
      return res.status(403).json({
        success: false,
        message: 'This setting is not editable'
      });
    }
    
    const { value, description, isPublic } = req.body;
    
    // Validate value based on type
    let validatedValue = value;
    try {
      switch (setting.type) {
        case 'number':
          validatedValue = Number(value);
          if (isNaN(validatedValue)) {
            throw new Error('Invalid number value');
          }
          break;
        case 'boolean':
          validatedValue = Boolean(value);
          break;
        case 'object':
          validatedValue = typeof value === 'object' ? value : JSON.parse(value);
          break;
        case 'array':
          validatedValue = Array.isArray(value) ? value : JSON.parse(value);
          if (!Array.isArray(validatedValue)) {
            throw new Error('Invalid array value');
          }
          break;
        default:
          validatedValue = String(value);
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid value for type ${setting.type}`
      });
    }
    
    // Apply validation rules if any
    if (setting.validation) {
      const validation = setting.validation;
      
      if (validation.min !== undefined && validatedValue < validation.min) {
        return res.status(400).json({
          success: false,
          message: `Value must be at least ${validation.min}`
        });
      }
      
      if (validation.max !== undefined && validatedValue > validation.max) {
        return res.status(400).json({
          success: false,
          message: `Value must be at most ${validation.max}`
        });
      }
      
      if (validation.options && !validation.options.includes(validatedValue)) {
        return res.status(400).json({
          success: false,
          message: `Value must be one of: ${validation.options.join(', ')}`
        });
      }
      
      if (validation.pattern && !new RegExp(validation.pattern).test(validatedValue)) {
        return res.status(400).json({
          success: false,
          message: 'Value does not match required pattern'
        });
      }
    }
    
    setting.value = validatedValue;
    if (description !== undefined) setting.description = description;
    if (isPublic !== undefined) setting.isPublic = isPublic;
    setting.updatedBy = req.user._id;
    
    await setting.save();
    
    logger.info(`Setting updated: ${req.params.key} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: { setting }
    });
  } catch (error) {
    logger.error('Update setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete setting
router.delete('/:key', auth, authorize('admin'), async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }
    
    if (!setting.isEditable) {
      return res.status(403).json({
        success: false,
        message: 'This setting cannot be deleted'
      });
    }
    
    await Setting.deleteOne({ key: req.params.key });
    
    logger.info(`Setting deleted: ${req.params.key} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Setting deleted successfully'
    });
  } catch (error) {
    logger.error('Delete setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get settings by category
router.get('/category/:category', auth, async (req, res) => {
  try {
    let query = { category: req.params.category };
    
    // Non-admin users can only see public settings
    if (req.user.role !== 'admin') {
      query.isPublic = true;
    }
    
    const settings = await Setting.find(query)
      .populate('updatedBy', 'firstName lastName')
      .sort({ key: 1 });
    
    res.json({
      success: true,
      data: { settings }
    });
  } catch (error) {
    logger.error('Get settings by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Bulk update settings
router.put('/bulk', auth, authorize('admin'), [
  body('settings').isArray().withMessage('Settings must be an array'),
  body('settings.*.key').notEmpty().withMessage('Key is required'),
  body('settings.*.value').notEmpty().withMessage('Value is required')
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
    
    const { settings } = req.body;
    const results = [];
    
    for (const settingData of settings) {
      try {
        const setting = await Setting.findOne({ key: settingData.key });
        
        if (!setting) {
          results.push({
            key: settingData.key,
            success: false,
            message: 'Setting not found'
          });
          continue;
        }
        
        if (!setting.isEditable) {
          results.push({
            key: settingData.key,
            success: false,
            message: 'Setting is not editable'
          });
          continue;
        }
        
        // Validate and update value
        let validatedValue = settingData.value;
        switch (setting.type) {
          case 'number':
            validatedValue = Number(settingData.value);
            break;
          case 'boolean':
            validatedValue = Boolean(settingData.value);
            break;
          case 'object':
            validatedValue = typeof settingData.value === 'object' ? settingData.value : JSON.parse(settingData.value);
            break;
          case 'array':
            validatedValue = Array.isArray(settingData.value) ? settingData.value : JSON.parse(settingData.value);
            break;
          default:
            validatedValue = String(settingData.value);
        }
        
        setting.value = validatedValue;
        setting.updatedBy = req.user._id;
        await setting.save();
        
        results.push({
          key: settingData.key,
          success: true,
          message: 'Updated successfully'
        });
      } catch (error) {
        results.push({
          key: settingData.key,
          success: false,
          message: error.message
        });
      }
    }
    
    logger.info(`Bulk settings update by ${req.user.email}: ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed`);
    
    res.json({
      success: true,
      message: 'Bulk update completed',
      data: { results }
    });
  } catch (error) {
    logger.error('Bulk update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;