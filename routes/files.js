const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const { downloadFile, getSignedUrl, viewFile } = require('../controllers/fileController');
const cloudinary = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');

// Publicly accessible endpoint for viewing images without authentication
const viewImagePublic = async (req, res) => {
  const { publicId } = req.params;
  console.log(`[${new Date().toISOString()}] /image/:publicId - START - publicId: ${publicId}`);

  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
  const fileExtension = path.extname(publicId).toLowerCase();
  console.log(`[${new Date().toISOString()}] /image/:publicId - File extension: ${fileExtension}`);

  if (!allowedExtensions.includes(fileExtension)) {
    console.log(`[${new Date().toISOString()}] /image/:publicId - DENIED - Invalid extension.`);
    return res.status(403).json({ success: false, message: 'Invalid file type' });
  }
  console.log(`[${new Date().toISOString()}] /image/:publicId - Extension check PASSED.`);

  // Differentiate between local files (containing '-' or '_') and other identifiers
  const isLocalFile = (publicId.includes('-') || publicId.includes('_'));
  console.log(`[${new Date().toISOString()}] /image/:publicId - isLocalFile check: ${isLocalFile}`);

  if (isLocalFile) {
    // Sanitize the filename to prevent directory traversal
    const cleanPublicId = path.basename(publicId);
    const filePath = path.join(__dirname, '..', 'uploads', 'attachments', cleanPublicId);
    console.log(`[${new Date().toISOString()}] /image/:publicId - Trying to serve local file. Cleaned ID: ${cleanPublicId}, Full Path: ${filePath}`);

    // Use synchronous check for existence
    if (fs.existsSync(filePath)) {
      console.log(`[${new Date().toISOString()}] /image/:publicId - SUCCESS - File exists. Sending file.`);
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`[${new Date().toISOString()}] /image/:publicId - ERROR sending file:`, err);
          // Avoid sending another response if one has already been partially sent.
        } else {
          console.log(`[${new Date().toISOString()}] /image/:publicId - File sent successfully.`);
        }
      });
    } else {
      console.error(`[${new Date().toISOString()}] /image/:publicId - FAILED - File does not exist at path.`);
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
  } else {
    console.log(`[${new Date().toISOString()}] /image/:publicId - Not a local file, attempting Cloudinary lookup.`);
    try {
      const result = await cloudinary.api.resource(publicId, { resource_type: 'image' });
      console.log(`[${new Date().toISOString()}] /image/:publicId - Cloudinary resource found.`);
      res.redirect(result.secure_url);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] /image/:publicId - FAILED - Cloudinary resource not found for publicId: ${publicId}`);
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
  }
};

// Public supplier document viewing (no auth required, all file types for supplier docs)
const viewSupplierDocumentPublic = async (req, res) => {
  const { publicId } = req.params;
  console.log(`[${new Date().toISOString()}] /supplier-document/:publicId - START - publicId: ${publicId}`);

  // Only allow supplier document files (identified by prefix)
  if (!publicId.startsWith('supplier_doc_')) {
    console.log(`[${new Date().toISOString()}] /supplier-document/:publicId - DENIED - Not a supplier document.`);
    return res.status(403).json({ success: false, message: 'Invalid document type' });
  }

  // Sanitize the filename to prevent directory traversal
  const cleanPublicId = path.basename(publicId);
  const filePath = path.join(__dirname, '..', 'uploads', 'attachments', cleanPublicId);
  console.log(`[${new Date().toISOString()}] /supplier-document/:publicId - Trying to serve file. Cleaned ID: ${cleanPublicId}, Full Path: ${filePath}`);

  // Use synchronous check for existence
  if (fs.existsSync(filePath)) {
    console.log(`[${new Date().toISOString()}] /supplier-document/:publicId - SUCCESS - File exists. Sending file.`);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`[${new Date().toISOString()}] /supplier-document/:publicId - ERROR sending file:`, err);
      } else {
        console.log(`[${new Date().toISOString()}] /supplier-document/:publicId - File sent successfully.`);
      }
    });
  } else {
    console.error(`[${new Date().toISOString()}] /supplier-document/:publicId - FAILED - File does not exist at path.`);
    return res.status(404).json({ success: false, message: 'Document not found' });
  }
};

// Secure file download
router.get('/download/:publicId', authMiddleware, downloadFile);

// Secure file viewing (inline)
router.get('/view/:publicId', authMiddleware, viewFile);

// Public image viewing (no auth required, images only)
router.get('/image/:publicId', viewImagePublic);

// Public supplier document viewing (no auth required, supplier docs only)
router.get('/supplier-document/:publicId', viewSupplierDocumentPublic);

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