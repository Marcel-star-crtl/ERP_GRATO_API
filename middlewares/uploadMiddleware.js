const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist on startup
const ensureUploadDirectories = () => {
  const directories = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../uploads/temp'),
    path.join(__dirname, '../uploads/attachments'),
    path.join(__dirname, '../uploads/justifications')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
  });
};

// Call this immediately when module loads
ensureUploadDirectories();

// Simple and reliable storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    
    // Ensure directory exists (double-check)
    if (!fs.existsSync(uploadDir)) {
      console.log(`Creating upload directory: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = file.fieldname + '-' + uniqueSuffix + ext;
    
    console.log(`Saving file: ${filename}`);
    cb(null, filename);
  }
});

// File filter with comprehensive validation
const fileFilter = (req, file, cb) => {
  console.log('File filter check:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype
  });

  // Allowed file types
  const allowedMimeTypes = {
    // Images
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/bmp': ['.bmp'],
    'image/webp': ['.webp'],

    // Documents
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'text/plain': ['.txt'],
    'application/rtf': ['.rtf']
  };

  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Check if mimetype is allowed
  if (!allowedMimeTypes[file.mimetype]) {
    console.error(`Unsupported file type: ${file.mimetype}`);
    const error = new Error(`Unsupported file type: ${file.mimetype}`);
    error.code = 'UNSUPPORTED_MIME_TYPE';
    return cb(error, false);
  }

  // Verify extension matches mimetype
  const expectedExtensions = allowedMimeTypes[file.mimetype];
  if (!expectedExtensions.includes(fileExtension)) {
    console.error(`Extension mismatch: ${fileExtension} for ${file.mimetype}`);
    const error = new Error(`File extension ${fileExtension} doesn't match content type ${file.mimetype}`);
    error.code = 'EXTENSION_MISMATCH';
    return cb(error, false);
  }

  // Check for suspicious patterns in filename
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|scr|pif|com)$/i,
    /\.(php|asp|aspx|jsp)$/i,
    /\.\.\//, // Path traversal
    /[<>"|*?]/,
    /%[0-9a-fA-F]{2}/, // URL encoded
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
    console.error(`Suspicious filename: ${file.originalname}`);
    const error = new Error('Filename contains suspicious patterns');
    error.code = 'SUSPICIOUS_FILENAME';
    return cb(error, false);
  }

  console.log('File passed validation');
  cb(null, true);
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 25 * 1024 * 1024,    // 25MB max per file
    files: 10,                      // Max 10 files
    fields: 20,                     // Max 20 fields
    fieldNameSize: 100,             // Max field name length
    fieldSize: 1024 * 1024,         // 1MB max field size
  }
});

// Enhanced error handling middleware
const handleMulterError = (error, req, res, next) => {
  console.error('Upload error:', error);

  // Clean up any uploaded files on error
  if (req.files) {
    cleanupFiles(req.files);
  }
  if (req.file) {
    cleanupFiles([req.file]);
  }

  if (error instanceof multer.MulterError) {
    const errorMessages = {
      'LIMIT_FILE_SIZE': 'File too large. Maximum size is 25MB per file.',
      'LIMIT_FILE_COUNT': 'Too many files. Maximum is 10 files per request.',
      'LIMIT_FIELD_COUNT': 'Too many form fields.',
      'LIMIT_UNEXPECTED_FILE': 'Unexpected file field.',
    };

    return res.status(400).json({
      success: false,
      message: errorMessages[error.code] || `Upload error: ${error.message}`,
      error: {
        type: 'MULTER_ERROR',
        code: error.code
      }
    });
  }

  // Custom error codes
  if (error.code === 'UNSUPPORTED_MIME_TYPE' || 
      error.code === 'EXTENSION_MISMATCH' ||
      error.code === 'SUSPICIOUS_FILENAME') {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: {
        type: 'FILE_VALIDATION_ERROR',
        code: error.code
      }
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    message: error.message || 'File upload failed',
    error: {
      type: 'UPLOAD_ERROR'
    }
  });
};

// Clean up files helper
function cleanupFiles(files) {
  if (!files) return;
  
  const fileList = Array.isArray(files) ? files : Object.values(files).flat();
  
  fileList.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.warn('Failed to cleanup file:', file.path, err.message);
        } else {
          console.log('Cleaned up file:', file.path);
        }
      });
    }
  });
}

// Cleanup middleware for after response
const cleanupTempFiles = (req, res, next) => {
  const originalEnd = res.end;
  
  res.end = function(...args) {
    // Call original end first
    originalEnd.apply(this, args);
    
    // Then cleanup after a short delay
    if (req.files || req.file) {
      setTimeout(() => {
        if (req.files) cleanupFiles(req.files);
        if (req.file) cleanupFiles([req.file]);
      }, 2000);
    }
  };
  
  next();
};

// Validation middleware (runs after multer)
const validateFiles = async (req, res, next) => {
  if (!req.files && !req.file) {
    return next();
  }

  try {
    const files = req.files 
      ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
      : [req.file];
    
    console.log(`Validating ${files.length} file(s)`);
    
    for (const file of files) {
      // Additional validation can be added here
      if (!fs.existsSync(file.path)) {
        throw new Error(`File not found after upload: ${file.originalname}`);
      }
      
      const stats = fs.statSync(file.path);
      console.log(`File ${file.originalname}: ${stats.size} bytes`);
      
      // Verify file size
      if (stats.size === 0) {
        throw new Error(`File is empty: ${file.originalname}`);
      }
      
      if (stats.size > 25 * 1024 * 1024) {
        throw new Error(`File too large: ${file.originalname}`);
      }
    }
    
    console.log('All files validated successfully');
    next();
  } catch (error) {
    console.error('File validation error:', error);
    
    // Cleanup on error
    if (req.files) cleanupFiles(req.files);
    if (req.file) cleanupFiles([req.file]);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: {
        type: 'FILE_VALIDATION_ERROR'
      }
    });
  }
};

module.exports = upload;
module.exports.handleMulterError = handleMulterError;
module.exports.cleanupTempFiles = cleanupTempFiles;
module.exports.validateFiles = validateFiles;
module.exports.ensureUploadDirectories = ensureUploadDirectories; 




