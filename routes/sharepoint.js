const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const sharepointController = require('../controllers/sharepointController');
const { handleMulterError, validateFiles, cleanupTempFiles } = require('../middlewares/uploadMiddleware');

// ============ FOLDER ROUTES ============
router.post(
  '/folders',
  authMiddleware,
  requireRoles('admin', 'supply_chain', 'finance', 'hr', 'it', 'supervisor'),
  sharepointController.createFolder
);

router.get(
  '/folders',
  authMiddleware,
  sharepointController.getFolders
);

router.get(
  '/folders/:folderId',
  authMiddleware,
  sharepointController.getFolder
);

router.put(
  '/folders/:folderId',
  authMiddleware,
  sharepointController.updateFolder
);

router.delete(
  '/folders/:folderId',
  authMiddleware,
  requireRoles('admin'),
  sharepointController.deleteFolder
);

// ============ FILE ROUTES ============
router.post(
  '/folders/:folderId/files',
  authMiddleware,
  upload.single('file'),
  handleMulterError,
  validateFiles,
  sharepointController.uploadFile,
  cleanupTempFiles
);

router.get(
  '/folders/:folderId/files',
  authMiddleware,
  sharepointController.getFiles
);

router.get(
  '/files/:fileId',
  authMiddleware,
  sharepointController.getFileDetails
);

router.get(
  '/files/:fileId/download',
  authMiddleware,
  sharepointController.downloadFile
);

router.delete(
  '/files/:fileId',
  authMiddleware,
  sharepointController.deleteFile
);

// ============ USER-SPECIFIC ROUTES ============
router.get(
  '/my-files',
  authMiddleware,
  sharepointController.getUserFiles
);

router.get(
  '/user-stats',
  authMiddleware,
  sharepointController.getUserStats
);

// ============ SHARING ROUTES ============
router.post(
  '/files/:fileId/share',
  authMiddleware,
  sharepointController.shareFile
);

router.delete(
  '/files/:fileId/access/:userId',
  authMiddleware,
  sharepointController.revokeAccess
);

router.post(
  '/files/:fileId/share-link',
  authMiddleware,
  sharepointController.generateShareLink
);

// ============ SEARCH & DISCOVERY ============
router.get(
  '/search',
  authMiddleware,
  sharepointController.globalSearch
);

router.get(
  '/recent',
  authMiddleware,
  sharepointController.getRecentFiles
);

// ============ BULK OPERATIONS ============
router.post(
  '/folders/:folderId/bulk-upload',
  authMiddleware,
  upload.array('files', 10),
  handleMulterError,
  validateFiles,
  sharepointController.bulkUploadFiles,
  cleanupTempFiles
);

// ============ ANALYTICS ROUTES (Admin only) ============
router.get(
  '/stats/storage',
  authMiddleware,
  requireRoles('admin'),
  sharepointController.getStorageStats
);

router.get(
  '/stats/activity',
  authMiddleware,
  requireRoles('admin'),
  sharepointController.getActivityLog
);

router.get(
  '/stats/department/:department',
  authMiddleware,
  requireRoles('admin', 'supervisor'),
  sharepointController.getDepartmentStats
);

// ============ VERSION CONTROL ============
router.post(
  '/files/:fileId/version',
  authMiddleware,
  upload.single('file'),
  handleMulterError,
  validateFiles,
  sharepointController.createFileVersion
);

router.get(
  '/files/:fileId/versions',
  authMiddleware,
  sharepointController.getFileVersions
);

router.post(
  '/files/:fileId/restore/:versionIndex',
  authMiddleware,
  sharepointController.restoreFileVersion
);

module.exports = router;





