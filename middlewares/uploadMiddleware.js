// middlewares/uploadMiddleware.js
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const expressAsyncHandler = require("express-async-handler");

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../public/images/");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ".jpeg");
  },
});

// File filter for images
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format. Only images are allowed."), false);
  }
};

// Configure multer upload
const uploadPhoto = multer({
  storage: storage,
  fileFilter: multerFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // Maximum 5 files
  },
});

// Image resizing middleware
const resizeImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  try {
    await Promise.all(
      req.files.map(async (file) => {
        await sharp(file.path)
          .resize(300, 300)
          .toFormat("jpeg")
          .jpeg({ quality: 90 })
          .toFile(path.join(path.dirname(file.path), 'resized-' + path.basename(file.path)));
        
        // Replace original file with resized version
        fs.unlinkSync(file.path);
        fs.renameSync(
          path.join(path.dirname(file.path), 'resized-' + path.basename(file.path)),
          file.path
        );
      })
    );
    next();
  } catch (error) {
    // Clean up any files if resize fails
    req.files.forEach(file => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
    next(error);
  }
};


const handleUpload = expressAsyncHandler(async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return next(new Error('No files provided'));
      }
  
      // Process each file
      const processedFiles = await Promise.all(req.files.map(async (file) => {
        const fileBuffer = fs.readFileSync(file.path);
        fs.unlinkSync(file.path); // Clean up temp file after reading
  
        return {
          originalname: file.originalname,
          buffer: fileBuffer,
          mimetype: file.mimetype,
          size: file.size
        };
      }));
  
      req.processedFiles = processedFiles;
      next();
    } catch (error) {
      next(error);
    }
  });
  


// Error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  if (err.message.includes('Unsupported file format')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  next(err);
};

module.exports = {
  upload: uploadPhoto,
  resizeImages,
  handleUpload,
  handleUploadError
};
















