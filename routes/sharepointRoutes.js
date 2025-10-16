const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const SharePoint = require('../models/SharePoint');

// Get all folders
router.get('/folders', auth, async (req, res) => {
  try {
    const folders = await SharePoint.find();
    res.json({ success: true, data: folders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create folder
router.post('/folders', auth, async (req, res) => {
  try {
    const { name, description, department, isPublic } = req.body;
    const folder = new SharePoint({
      name,
      description,
      department,
      isPublic,
      createdBy: req.user.id,
      files: []
    });
    await folder.save();
    res.json({ success: true, data: folder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload file to folder
router.post('/folders/:folderId/files', auth, async (req, res) => {
  try {
    const { folderId } = req.params;
    const folder = await SharePoint.findById(folderId);
    
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const file = {
      id: Date.now(),
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      url: req.file.path,
      uploadedBy: req.user.fullName,
      uploadedAt: new Date(),
      downloads: 0
    };

    folder.files.push(file);
    await folder.save();
    res.json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete file
router.delete('/files/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await SharePoint.updateOne(
      { 'files.id': fileId },
      { $pull: { files: { id: fileId } } }
    );
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;