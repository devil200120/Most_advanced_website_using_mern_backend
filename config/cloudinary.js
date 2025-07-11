// File: c:\Users\KIIT0001\Desktop\exam_site\backend\config\cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const logger = require('../utils/logger');

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Test cloudinary connection
const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    logger.info('Cloudinary connection successful:', result);
    return true;
  } catch (error) {
    logger.error('Cloudinary connection failed:', error);
    return false;
  }
};

// Cloudinary storage for different file types
const createCloudinaryStorage = (folder, allowedFormats) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folder,
      allowed_formats: allowedFormats,
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' },
        { quality: 'auto' }
      ]
    }
  });
};

// Storage configurations
const avatarStorage = createCloudinaryStorage('exam_site/avatars', ['jpg', 'jpeg', 'png', 'gif']);
const examFileStorage = createCloudinaryStorage('exam_site/exam_files', ['jpg', 'jpeg', 'png', 'pdf']);
const questionFileStorage = createCloudinaryStorage('exam_site/question_files', ['jpg', 'jpeg', 'png', 'pdf']);

// Multer configurations
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'), false);
    }
  }
});

const uploadExamFiles = multer({
  storage: examFileStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'), false);
    }
  }
});

const uploadQuestionFiles = multer({
  storage: questionFileStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 3
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'), false);
    }
  }
});

// Helper functions
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info('File deleted from Cloudinary:', result);
    return result;
  } catch (error) {
    logger.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

const getFileUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    ...options
  });
};

const optimizeImage = (publicId, width = 800, height = 600, quality = 'auto') => {
  return cloudinary.url(publicId, {
    width: width,
    height: height,
    crop: 'fill',
    quality: quality,
    secure: true
  });
};

module.exports = {
  cloudinary,
  uploadAvatar,
  uploadExamFiles,
  uploadQuestionFiles,
  testCloudinaryConnection,
  deleteFile,
  getFileUrl,
  optimizeImage
};