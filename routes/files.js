const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const { downloadFile, getSignedUrl, viewFile } = require('../controllers/fileController');

// Secure file download
router.get('/download/:publicId', authMiddleware, downloadFile);

// Secure file viewing (inline)
router.get('/view/:publicId', authMiddleware, viewFile);

// Get signed URL for direct access
router.get('/signed-url/:publicId', authMiddleware, getSignedUrl);

// Add a test route to verify the router is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Files route is working'
  });
});

module.exports = router;