const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Enhanced storage configuration with better security
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create user-specific temporary directories
    const userDir = req.user?.userId || 'anonymous';
    const uploadDir = path.join(__dirname, `../temp/uploads/${userDir}/`);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true, mode: 0o750 });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate cryptographically secure filename
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Validate extension matches mimetype
    const expectedExt = getExpectedExtension(file.mimetype);
    const finalExt = expectedExt || ext || '.bin';
    
    const filename = `${hash}_${timestamp}${finalExt}`;
    cb(null, filename);
  }
});

// Enhanced file filter with virus scanning placeholder
const fileFilter = (req, file, cb) => {
  console.log('File filter check:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Comprehensive allowed types with validation
  const allowedMimeTypes = {
    // Images
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/bmp': ['.bmp'],
    'image/webp': ['.webp'],
    'image/svg+xml': ['.svg'], // Be careful with SVG - can contain scripts

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
    const error = new Error(`Unsupported file type: ${file.mimetype}`);
    error.code = 'UNSUPPORTED_MIME_TYPE';
    return cb(error, false);
  }

  // Verify extension matches mimetype
  const expectedExtensions = allowedMimeTypes[file.mimetype];
  if (!expectedExtensions.includes(fileExtension)) {
    const error = new Error(`File extension ${fileExtension} doesn't match content type ${file.mimetype}`);
    error.code = 'EXTENSION_MISMATCH';
    return cb(error, false);
  }

  // Check filename for suspicious patterns
  if (containsSuspiciousPatterns(file.originalname)) {
    const error = new Error('Filename contains suspicious patterns');
    error.code = 'SUSPICIOUS_FILENAME';
    return cb(error, false);
  }

  // File size pre-check (multer will also check this)
  const maxSizes = {
    'image/jpeg': 10 * 1024 * 1024,  // 10MB for images
    'image/png': 10 * 1024 * 1024,
    'application/pdf': 25 * 1024 * 1024, // 25MB for documents
    'application/msword': 25 * 1024 * 1024,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 25 * 1024 * 1024
  };

  const maxSize = maxSizes[file.mimetype] || 10 * 1024 * 1024;
  if (file.size && file.size > maxSize) {
    const error = new Error(`File too large. Maximum size for ${file.mimetype} is ${maxSize} bytes`);
    error.code = 'FILE_TOO_LARGE';
    return cb(error, false);
  }

  cb(null, true);
};

// Helper function to get expected file extension from mimetype
function getExpectedExtension(mimetype) {
  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'application/rtf': '.rtf'
  };
  
  return mimeToExt[mimetype];
}

// Check for suspicious filename patterns
function containsSuspiciousPatterns(filename) {
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|scr|pif|com)$/i,
    /\.(php|asp|aspx|jsp|js)$/i,
    /\.\.\//, // Path traversal
    /[<>"|*?]/,
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
    /%[0-9a-fA-F]{2}/, // URL encoded characters
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(filename));
}

// Create multer instance with enhanced security
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 25 * 1024 * 1024,    // 25MB max per file
    files: 5,                      // Reduced from 10 to 5 for better control
    fields: 20,                    // Reduced from 50 
    fieldNameSize: 50,             // Reduced from 100
    fieldSize: 1024 * 1024,        // 1MB max field size
    parts: 30                      // Total parts limit
  }
});

// Enhanced error handling
const handleMulterError = (error, req, res, next) => {
  console.error('Upload error:', error);

  // Clean up any uploaded files on error
  if (req.files) {
    cleanupFiles(req.files);
  }

  if (error instanceof multer.MulterError) {
    const errorMessages = {
      'LIMIT_FILE_SIZE': 'File too large. Maximum size is 25MB per file.',
      'LIMIT_FILE_COUNT': 'Too many files. Maximum is 5 files per request.',
      'LIMIT_FIELD_COUNT': 'Too many form fields. Maximum is 20 fields.',
      'LIMIT_FIELD_KEY': 'Field name too long. Maximum is 50 characters.',
      'LIMIT_FIELD_VALUE': 'Field value too large. Maximum is 1MB.',
      'LIMIT_PART_COUNT': 'Too many parts in multipart data.',
      'LIMIT_UNEXPECTED_FILE': 'Unexpected file field.'
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

  next(error);
};

// File validation middleware (runs after multer)
const validateFiles = async (req, res, next) => {
  if (!req.files) {
    return next();
  }

  try {
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    
    for (const file of files) {
      // Additional file content validation
      await validateFileContent(file);
      
      // Check for embedded malware signatures (placeholder)
      // In production, integrate with antivirus service
      const isSafe = await scanForMalware(file.path);
      if (!isSafe) {
        throw new Error(`File ${file.originalname} failed security scan`);
      }
    }
    
    next();
  } catch (error) {
    console.error('File validation error:', error);
    
    // Cleanup files
    if (req.files) {
      cleanupFiles(req.files);
    }
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: {
        type: 'FILE_SECURITY_ERROR'
      }
    });
  }
};

// Validate file content (basic checks)
async function validateFileContent(file) {
  const buffer = await fs.promises.readFile(file.path);
  
  // Check file signature/magic numbers
  const signatures = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
    'image/gif': [0x47, 0x49, 0x46]
  };
  
  const expectedSignature = signatures[file.mimetype];
  if (expectedSignature) {
    const actualSignature = Array.from(buffer.slice(0, expectedSignature.length));
    if (!arraysEqual(actualSignature, expectedSignature)) {
      throw new Error(`File signature doesn't match declared type for ${file.originalname}`);
    }
  }
  
  // Check for embedded scripts in images (basic)
  if (file.mimetype.startsWith('image/')) {
    const content = buffer.toString('ascii', 0, Math.min(1024, buffer.length));
    if (content.includes('<script>') || content.includes('javascript:')) {
      throw new Error(`Potentially malicious content detected in ${file.originalname}`);
    }
  }
}

// Placeholder for malware scanning
async function scanForMalware(filePath) {
  // TODO: Integrate with antivirus service like ClamAV
  // For now, return true (safe)
  return true;
}

// Helper function to compare arrays
function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, index) => val === b[index]);
}

// Clean up files helper
function cleanupFiles(files) {
  const fileList = Array.isArray(files) ? files : Object.values(files).flat();
  
  fileList.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, (err) => {
        if (err) console.warn('Failed to cleanup file:', file.path, err.message);
      });
    }
  });
}

// Enhanced cleanup middleware
const cleanupTempFiles = (req, res, next) => {
  const originalEnd = res.end;
  
  res.end = function(...args) {
    if (req.files) {
      // Delay cleanup to ensure response is sent
      setTimeout(() => {
        cleanupFiles(req.files);
        
        // Also cleanup user's temp directory if empty
        const userDir = req.user?.userId;
        if (userDir) {
          const uploadDir = path.join(__dirname, `../temp/uploads/${userDir}/`);
          fs.readdir(uploadDir, (err, files) => {
            if (!err && files.length === 0) {
              fs.rmdir(uploadDir, () => {}); // Remove empty directory
            }
          });
        }
      }, 2000);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

module.exports = upload;
module.exports.handleMulterError = handleMulterError;
module.exports.cleanupTempFiles = cleanupTempFiles;
module.exports.validateFiles = validateFiles;