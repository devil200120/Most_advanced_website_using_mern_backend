// File: c:\Users\KIIT0001\Desktop\exam_site\backend\utils\fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    
    switch (file.fieldname) {
      case 'avatar':
        uploadPath += 'avatars/';
        break;
      case 'examFiles':
        uploadPath += 'exams/';
        break;
      case 'questionFiles':
        uploadPath += 'questions/';
        break;
      default:
        uploadPath += 'misc/';
    }
    
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    avatar: ['image/jpeg', 'image/png', 'image/gif'],
    examFiles: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
    questionFiles: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
  };
  
  const fieldAllowedTypes = allowedTypes[file.fieldname] || allowedTypes.examFiles;
  
  if (fieldAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed: ${fieldAllowedTypes.join(', ')}`), false);
  }
};

// File size limits
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB
  files: 5
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits
});

// Delete file helper
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Get file info
const getFileInfo = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        });
      }
    });
  });
};

module.exports = {
  upload,
  deleteFile,
  getFileInfo,
  ensureDirectoryExists
};