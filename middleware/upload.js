// File: c:\Users\KIIT0001\Desktop\exam_site\backend\middleware\upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/';
    
    if (file.fieldname === 'avatar') {
      folder += 'avatars/';
    } else if (file.fieldname === 'examFiles') {
      folder += 'exams/';
    } else if (file.fieldname === 'questionFiles') {
      folder += 'questions/';
    } else {
      folder += 'misc/';
    }
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    avatar: ['image/jpeg', 'image/png', 'image/gif'],
    examFiles: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
    questionFiles: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };
  
  const fieldAllowedTypes = allowedTypes[file.fieldname] || allowedTypes.examFiles;
  
  if (fieldAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${fieldAllowedTypes.join(', ')}`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: parseInt(process.env.MAX_FILES) || 5
  }
});

module.exports = upload;