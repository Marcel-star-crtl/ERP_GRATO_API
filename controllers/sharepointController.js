const { SharePointFolder, SharePointFile, SharePointActivityLog } = require('../models/SharePoint');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  canUserAccessFolder,
  canUserUploadToFolder,
  canUserManageFolder,
  canUserDeleteFolder,
  isFolderVisibleToUser
} = require('../utils/sharepointAccessHelpers');
// ============ HELPER FUNCTIONS ============

// const canUserUploadToFolder = (folder, user) => {
//   if (user._id.toString() === folder.createdBy.toString()) return true;
//   if (user.role === 'admin') return true;
//   return folder.accessControl.allowedDepartments.includes(user.department);
// };

// const canUserManageFolder = (folder, user) => {
//   return user._id.toString() === folder.createdBy.toString() || user.role === 'admin';
// };

// const canUserDeleteFolder = (folder, user) => {
//   return user._id.toString() === folder.createdBy.toString() || user.role === 'admin';
// };

// ============ FOLDER OPERATIONS ============

const createFolder = async (req, res) => {
  try {
    const { name, description, department, privacyLevel, allowedDepartments } = req.body;
    const user = await User.findById(req.user.userId);

    // Validation
    if (!name || !description || !department) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, department'
      });
    }

    if (!['public', 'department', 'confidential'].includes(privacyLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid privacy level'
      });
    }

    // Check if folder already exists
    const existingFolder = await SharePointFolder.findOne({ name });
    if (existingFolder) {
      return res.status(400).json({
        success: false,
        message: 'Folder with this name already exists'
      });
    }

    const folder = new SharePointFolder({
      name,
      description,
      department,
      privacyLevel: privacyLevel || 'department',
      isPublic: privacyLevel === 'public', // For backward compatibility
      createdBy: req.user.userId,
      accessControl: {
        allowedDepartments: allowedDepartments || [department],
        allowedUsers: [req.user.userId],
        invitedUsers: [],
        blockedUsers: []
      }
    });

    await folder.save();

    // Log activity
    await new SharePointActivityLog({
      action: 'folder_create',
      userId: req.user.userId,
      folderId: folder._id,
      folderName: folder.name,
      details: {
        department,
        privacyLevel
      }
    }).save();

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      data: folder
    });

  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create folder',
      error: error.message
    });
  }
};


const getFolders = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const { department, includeAll } = req.query;

    // Get ALL folders first
    let allFolders = await SharePointFolder.find({})
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 });

    // Filter folders based on visibility
    const visibleFolders = allFolders.filter(folder => 
      isFolderVisibleToUser(folder, user)
    );

    // Apply department filter if requested
    let filteredFolders = visibleFolders;
    if (department && department !== 'all') {
      filteredFolders = visibleFolders.filter(f => f.department === department);
    }

    // Add access info for current user
    const foldersWithAccess = filteredFolders.map(folder => {
      const access = canUserAccessFolder(folder, user);
      const canUpload = canUserUploadToFolder(folder, user);
      const canManage = canUserManageFolder(folder, user);
      const canDelete = canUserDeleteFolder(folder, user);

      return {
        ...folder.toObject(),
        userAccess: {
          canView: access.canAccess,
          canUpload: canUpload,
          canManage: canManage,
          canDelete: canDelete,
          permission: access.permission,
          reason: access.reason
        }
      };
    });

    console.log('=== GET FOLDERS DEBUG ===');
    console.log('User:', {
      id: user._id.toString(),
      role: user.role,
      department: user.department
    });
    console.log('Total folders in DB:', allFolders.length);
    console.log('Visible to user:', visibleFolders.length);
    console.log('After filters:', foldersWithAccess.length);

    res.json({
      success: true,
      data: foldersWithAccess,
      count: foldersWithAccess.length,
      userDepartment: user.department
    });

  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch folders',
      error: error.message
    });
  }
};

const getFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    
    const folder = await SharePointFolder.findById(folderId)
      .populate('createdBy', 'fullName email');

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Check access permission
    const user = await User.findById(req.user.userId);
    const hasAccess = 
      folder.isPublic ||
      folder.department === user.department ||
      folder.accessControl.allowedDepartments.includes(user.department) ||
      folder.accessControl.allowedUsers.includes(req.user.userId) ||
      user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this folder'
      });
    }

    res.json({
      success: true,
      data: folder
    });

  } catch (error) {
    console.error('Get folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch folder',
      error: error.message
    });
  }
};

const updateFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { description, isPublic, allowedDepartments } = req.body;

    const folder = await SharePointFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    const user = await User.findById(req.user.userId);

    // Check permission
    if (!canUserManageFolder(folder, user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage this folder'
      });
    }

    // Update fields
    if (description) folder.description = description;
    if (isPublic !== undefined) folder.isPublic = isPublic;
    if (allowedDepartments) folder.accessControl.allowedDepartments = allowedDepartments;

    folder.updatedAt = new Date();
    await folder.save();

    res.json({
      success: true,
      message: 'Folder updated successfully',
      data: folder
    });

  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update folder',
      error: error.message
    });
  }
};

const deleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;

    const folder = await SharePointFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    const user = await User.findById(req.user.userId);

    // Check permission
    if (!canUserDeleteFolder(folder, user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this folder'
      });
    }

    // Check if folder has files
    const fileCount = await SharePointFile.countDocuments({ folderId, isDeleted: false });
    if (fileCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete folder with existing files. Please delete files first.'
      });
    }

    await SharePointFolder.findByIdAndDelete(folderId);

    // Log activity
    await new SharePointActivityLog({
      action: 'delete',
      userId: req.user.userId,
      folderId,
      folderName: folder.name
    }).save();

    res.json({
      success: true,
      message: 'Folder deleted successfully'
    });

  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete folder',
      error: error.message
    });
  }
};

// ============ FILE OPERATIONS ============

const uploadFile = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { description, tags } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const folder = await SharePointFolder.findById(folderId);
    if (!folder) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    const user = await User.findById(req.user.userId);

    // Check upload permission using new access control
    if (!canUserUploadToFolder(folder, user)) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload to this folder'
      });
    }

    // Check storage quota
    const totalSize = await SharePointFile.aggregate([
      { $match: { folderId: folder._id, isDeleted: false } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } }
    ]);

    const currentTotal = totalSize[0]?.totalSize || 0;
    const maxStoragePerFolder = 10 * 1024 * 1024 * 1024; // 10GB

    if (currentTotal + req.file.size > maxStoragePerFolder) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Storage quota exceeded for this folder'
      });
    }

    // Create file document
    const file = new SharePointFile({
      folderId,
      name: req.file.originalname,
      description,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      publicId: req.file.filename,
      uploadedBy: req.user.userId,
      tags: tags ? tags.split(',').map(t => t.trim()) : []
    });

    await file.save();

    // Update folder metadata
    folder.fileCount += 1;
    folder.totalSize += req.file.size;
    folder.lastModified = new Date();
    await folder.save();

    // Log activity
    await new SharePointActivityLog({
      action: 'upload',
      userId: req.user.userId,
      fileId: file._id,
      folderId,
      fileName: file.name,
      folderName: folder.name
    }).save();

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: file
    });

  } catch (error) {
    console.error('Upload file error:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message
    });
  }
};


const getFiles = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { search, sortBy, tags } = req.query;
    const user = await User.findById(req.user.userId);

    // Verify folder exists
    const folder = await SharePointFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Check if user has access to this folder
    const access = canUserAccessFolder(folder, user);
    if (!access.canAccess) {
      return res.status(403).json({
        success: false,
        message: access.reason || 'You do not have access to this folder'
      });
    }

    let query = { folderId, isDeleted: false };

    // Search filter
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      query.tags = { $in: tagArray };
    }

    let fileQuery = SharePointFile.find(query)
      .populate('uploadedBy', 'fullName email')
      .populate('sharedWith.userId', 'fullName email');

    // Sorting
    if (sortBy === 'recent') {
      fileQuery = fileQuery.sort({ uploadedAt: -1 });
    } else if (sortBy === 'size') {
      fileQuery = fileQuery.sort({ size: -1 });
    } else if (sortBy === 'name') {
      fileQuery = fileQuery.sort({ name: 1 });
    } else {
      fileQuery = fileQuery.sort({ uploadedAt: -1 });
    }

    const files = await fileQuery.exec();

    // Add user permissions to each file
    const filesWithPermissions = files.map(file => ({
      ...file.toObject(),
      userPermissions: {
        canDownload: ['download', 'upload', 'manage'].includes(access.permission),
        canDelete: access.permission === 'manage' || file.uploadedBy._id.toString() === user._id.toString(),
        canShare: ['upload', 'manage'].includes(access.permission)
      }
    }));

    res.json({
      success: true,
      data: filesWithPermissions,
      count: filesWithPermissions.length,
      folder: {
        id: folder._id,
        name: folder.name,
        department: folder.department,
        privacyLevel: folder.privacyLevel
      },
      userPermission: access.permission
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files',
      error: error.message
    });
  }
};

const getFileDetails = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = await SharePointFile.findById(fileId)
      .populate('uploadedBy', 'fullName email')
      .populate('folderId', 'name department')
      .populate('sharedWith.userId', 'fullName email');

    if (!file || file.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      data: file
    });

  } catch (error) {
    console.error('Get file details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file details',
      error: error.message
    });
  }
};

const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await SharePointFile.findById(fileId);
    if (!file || file.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Log download
    file.downloads += 1;
    file.downloadLog.push({
      userId: req.user.userId,
      downloadedAt: new Date(),
      ipAddress: req.ip
    });
    await file.save();

    // Log activity
    await new SharePointActivityLog({
      action: 'download',
      userId: req.user.userId,
      fileId,
      fileName: file.name
    }).save();

    // Send file
    res.download(file.path, file.name, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });

  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { permanently } = req.query;
    const user = await User.findById(req.user.userId);

    const file = await SharePointFile.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permission
    if (file.uploadedBy.toString() !== req.user.userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this file'
      });
    }

    if (permanently === 'true') {
      // Permanently delete
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      // Update folder metadata
      const folder = await SharePointFolder.findById(file.folderId);
      if (folder) {
        folder.fileCount -= 1;
        folder.totalSize -= file.size;
        await folder.save();
      }

      await SharePointFile.findByIdAndDelete(fileId);
    } else {
      // Soft delete
      file.isDeleted = true;
      file.deletedAt = new Date();
      file.deletedBy = req.user.userId;
      await file.save();
    }

    // Log activity
    await new SharePointActivityLog({
      action: 'delete',
      userId: req.user.userId,
      fileId,
      fileName: file.name
    }).save();

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
};

// ============ USER-SPECIFIC OPERATIONS ============

const getUserFiles = async (req, res) => {
  try {
    const { search, folderId, sortBy } = req.query;

    let query = {
      uploadedBy: req.user.userId,
      isDeleted: false
    };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (folderId && folderId !== 'all') {
      query.folderId = folderId;
    }

    let fileQuery = SharePointFile.find(query)
      .populate('uploadedBy', 'fullName email')
      .populate('folderId', 'name department');

    // Apply sorting
    if (sortBy === 'recent') {
      fileQuery = fileQuery.sort({ uploadedAt: -1 });
    } else if (sortBy === 'size') {
      fileQuery = fileQuery.sort({ size: -1 });
    } else if (sortBy === 'name') {
      fileQuery = fileQuery.sort({ name: 1 });
    } else {
      fileQuery = fileQuery.sort({ uploadedAt: -1 });
    }

    const files = await fileQuery.exec();

    res.json({
      success: true,
      data: files,
      count: files.length
    });

  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your files',
      error: error.message
    });
  }
};


const getUserStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    // Get folders belonging to user's department or created by user
    const userFolders = await SharePointFolder.find({
      $or: [
        { department: user.department },
        { createdBy: req.user.userId },
        { 'accessControl.allowedDepartments': user.department },
        { 'accessControl.allowedUsers': req.user.userId }
      ]
    });

    const userFolderIds = userFolders.map(f => f._id);

    // Get files from accessible folders only
    const stats = await SharePointFile.aggregate([
      {
        $match: {
          folderId: { $in: userFolderIds },
          uploadedBy: mongoose.Types.ObjectId(req.user.userId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          filesUploaded: { $sum: 1 },
          totalSize: { $sum: '$size' },
          totalDownloads: { $sum: '$downloads' }
        }
      }
    ]);

    const activityStats = await SharePointActivityLog.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(req.user.userId) } },
      { $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent uploads from accessible folders
    const recentUploads = await SharePointFile.find({
      folderId: { $in: userFolderIds },
      uploadedBy: req.user.userId,
      isDeleted: false
    })
    .sort({ uploadedAt: -1 })
    .limit(5)
    .populate('folderId', 'name department');

    console.log('=== USER STATS DEBUG ===');
    console.log('User:', {
      id: user._id.toString(),
      department: user.department
    });
    console.log('Accessible folders count:', userFolderIds.length);
    console.log('User uploads:', stats[0]?.filesUploaded || 0);

    res.json({
      success: true,
      data: {
        uploads: stats[0] || {
          filesUploaded: 0,
          totalSize: 0,
          totalDownloads: 0
        },
        activity: activityStats,
        recentUploads,
        userDepartment: user.department,
        accessibleFoldersCount: userFolderIds.length
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: error.message
    });
  }
};

// ============ SHARING OPERATIONS ============
const shareFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { shareWith, permission, type } = req.body;

    const file = await SharePointFile.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const user = await User.findById(req.user.userId);
    
    // Check if user can share (uploader, manage permission, or admin)
    const folder = await SharePointFolder.findById(file.folderId);
    const access = canUserAccessFolder(folder, user);
    
    if (!['upload', 'manage'].includes(access.permission) && 
        file.uploadedBy.toString() !== req.user.userId && 
        user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to share this file'
      });
    }

    // Handle sharing by user or department
    if (type === 'user') {
      let userId = shareWith;
      
      // If it looks like an email, find the user
      if (shareWith.includes('@')) {
        const targetUser = await User.findOne({ email: shareWith });
        if (!targetUser) {
          return res.status(404).json({
            success: false,
            message: `User with email ${shareWith} not found`
          });
        }
        userId = targetUser._id.toString();
      } else {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(shareWith)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid user ID or email format'
          });
        }
        
        const targetUser = await User.findById(shareWith);
        if (!targetUser) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }
      }

      // Check if already shared
      const existingShare = file.sharedWith.find(s => s.userId?.toString() === userId);
      if (existingShare) {
        // Update permission
        existingShare.permission = permission || 'download';
        existingShare.type = permission || 'download';
      } else {
        // Add new share
        file.sharedWith.push({
          userId: userId,
          permission: permission || 'download',
          type: permission || 'download',
          sharedAt: new Date(),
          sharedBy: req.user.userId
        });
      }
    } else if (type === 'department') {
      // Check if already shared with department
      const existingDeptShare = file.sharedWith.find(s => s.department === shareWith);
      if (existingDeptShare) {
        existingDeptShare.permission = permission || 'download';
        existingDeptShare.type = permission || 'download';
      } else {
        file.sharedWith.push({
          department: shareWith,
          permission: permission || 'download',
          type: permission || 'download',
          sharedAt: new Date(),
          sharedBy: req.user.userId
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid share type. Must be "user" or "department"'
      });
    }

    await file.save();

    // Log activity
    await new SharePointActivityLog({
      action: 'share',
      userId: req.user.userId,
      fileId,
      fileName: file.name,
      details: { shareWith, permission, type }
    }).save();

    res.json({
      success: true,
      message: 'File shared successfully',
      data: file
    });

  } catch (error) {
    console.error('Share file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share file',
      error: error.message
    });
  }
};


const revokeAccess = async (req, res) => {
  try {
    const { fileId, userId } = req.params;

    const file = await SharePointFile.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Remove from shared list
    file.sharedWith = file.sharedWith.filter(s => s.userId?.toString() !== userId);
    await file.save();

    // Log activity
    await new SharePointActivityLog({
      action: 'access_revoked',
      userId: req.user.userId,
      fileId,
      fileName: file.name
    }).save();

    res.json({
      success: true,
      message: 'Access revoked successfully'
    });

  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke access',
      error: error.message
    });
  }
};

const generateShareLink = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { expiresIn = 604800 } = req.body; // Default 7 days in seconds
    const user = await User.findById(req.user.userId);

    const file = await SharePointFile.findById(fileId);
    if (!file || file.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permission
    if (file.uploadedBy.toString() !== req.user.userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to generate share link'
      });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    file.shareLink = {
      token,
      expiresAt,
      createdBy: req.user.userId
    };

    await file.save();

    const shareLink = `${process.env.FRONTEND_URL}/sharepoint/shared/${token}`;

    res.json({
      success: true,
      message: 'Share link generated successfully',
      data: {
        shareLink,
        expiresAt
      }
    });

  } catch (error) {
    console.error('Generate share link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate share link',
      error: error.message
    });
  }
};

const globalSearch = async (req, res) => {
  try {
    const { query, fileType, department } = req.query;
    const user = await User.findById(req.user.userId);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Get folders accessible to user based on their department
    const accessibleFolders = await SharePointFolder.find({
      $or: [
        { isPublic: true },
        { department: user.department },
        { 'accessControl.allowedDepartments': user.department },
        { 'accessControl.allowedUsers': req.user.userId },
        { createdBy: req.user.userId },
        ...(user.role === 'admin' ? [{}] : []) // Admin can access all
      ]
    });

    const accessibleFolderIds = accessibleFolders.map(f => f._id);

    let searchQuery = {
      isDeleted: false,
      folderId: { $in: accessibleFolderIds },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };

    // File type filter
    if (fileType) {
      searchQuery.mimetype = { $regex: fileType, $options: 'i' };
    }

    // Department filter (if user is allowed to view other departments)
    if (department && (user.role === 'admin' || user.department === department)) {
      searchQuery['folder.department'] = department;
    }

    const files = await SharePointFile.find(searchQuery)
      .populate('uploadedBy', 'fullName email')
      .populate('folderId', 'name department')
      .sort({ uploadedAt: -1 })
      .limit(50);

    console.log('=== GLOBAL SEARCH DEBUG ===');
    console.log('User department:', user.department);
    console.log('Accessible folders:', accessibleFolderIds.length);
    console.log('Search results:', files.length);

    res.json({
      success: true,
      data: files,
      count: files.length,
      userDepartment: user.department
    });

  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search files',
      error: error.message
    });
  }
};

const getRecentFiles = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const user = await User.findById(req.user.userId);

    // Get folders accessible to user's department
    const accessibleFolders = await SharePointFolder.find({
      $or: [
        { isPublic: true },
        { department: user.department },
        { 'accessControl.allowedDepartments': user.department },
        { 'accessControl.allowedUsers': req.user.userId },
        { createdBy: req.user.userId },
        ...(user.role === 'admin' ? [{}] : [])
      ]
    });

    const accessibleFolderIds = accessibleFolders.map(f => f._id);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const files = await SharePointFile.find({
      uploadedAt: { $gte: startDate },
      isDeleted: false,
      folderId: { $in: accessibleFolderIds }
    })
      .populate('uploadedBy', 'fullName email')
      .populate('folderId', 'name department')
      .sort({ uploadedAt: -1 })
      .limit(20);

    console.log('=== RECENT FILES DEBUG ===');
    console.log('User department:', user.department);
    console.log('Days range:', days);
    console.log('Recent files found:', files.length);

    res.json({
      success: true,
      data: files,
      count: files.length,
      userDepartment: user.department
    });

  } catch (error) {
    console.error('Get recent files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent files',
      error: error.message
    });
  }
};

// ============ BULK OPERATIONS ============

const bulkUploadFiles = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { description, tags } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const folder = await SharePointFolder.findById(folderId);
    if (!folder) {
      // Cleanup files
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    const user = await User.findById(req.user.userId);

    // Check upload permission
    if (!canUserUploadToFolder(folder, user)) {
      // Cleanup files
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload to this folder'
      });
    }

    const uploadedFiles = [];
    let totalSize = 0;

    for (const file of req.files) {
      const newFile = new SharePointFile({
        folderId,
        name: file.originalname,
        description,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        publicId: file.filename,
        uploadedBy: req.user.userId,
        tags: tags ? tags.split(',').map(t => t.trim()) : []
      });

      await newFile.save();
      uploadedFiles.push(newFile);
      totalSize += file.size;

      // Log activity
      await new SharePointActivityLog({
        action: 'upload',
        userId: req.user.userId,
        fileId: newFile._id,
        folderId,
        fileName: newFile.name,
        folderName: folder.name
      }).save();
    }

    // Update folder metadata
    folder.fileCount += uploadedFiles.length;
    folder.totalSize += totalSize;
    folder.lastModified = new Date();
    await folder.save();

    res.status(201).json({
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully`,
      data: uploadedFiles
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
};

// ============ ANALYTICS & REPORTING ============

const getStorageStats = async (req, res) => {
  try {
    const { folderId, department } = req.query;

    let match = { isDeleted: false };
    if (folderId) match.folderId = mongoose.Types.ObjectId(folderId);

    const stats = await SharePointFile.aggregate([
      { $match: match },
      { $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          averageFileSize: { $avg: '$size' },
          largestFile: { $max: '$size' }
        }
      }
    ]);

    const filesByType = await SharePointFile.aggregate([
      { $match: match },
      { $group: {
          _id: '$mimetype',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      }
    ]);

    const folderStats = await SharePointFolder.aggregate([
      { $group: {
          _id: '$department',
          folderCount: { $sum: 1 },
          totalFiles: { $sum: '$fileCount' },
          totalSize: { $sum: '$totalSize' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overall: stats[0] || {},
        byType: filesByType,
        byDepartment: folderStats
      }
    });

  } catch (error) {
    console.error('Get storage stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage stats',
      error: error.message
    });
  }
};

const getActivityLog = async (req, res) => {
  try {
    const { days = 30, action, userId } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let query = { timestamp: { $gte: startDate } };
    if (action) query.action = action;
    if (userId) query.userId = userId;

    const logs = await SharePointActivityLog.find(query)
      .populate('userId', 'fullName email')
      .sort({ timestamp: -1 })
      .limit(1000);

    res.json({
      success: true,
      data: logs,
      count: logs.length
    });

  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity log',
      error: error.message
    });
  }
};

const getDepartmentStats = async (req, res) => {
  try {
    const { department } = req.params;
    const user = await User.findById(req.user.userId);

    // Check permission
    if (user.role !== 'admin' && user.department !== department) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const folders = await SharePointFolder.find({ department });
    
    const stats = await SharePointFile.aggregate([
      {
        $lookup: {
          from: 'sharepointfolders',
          localField: 'folderId',
          foreignField: '_id',
          as: 'folder'
        }
      },
      { $unwind: '$folder' },
      { $match: { 'folder.department': department, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          totalDownloads: { $sum: '$downloads' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        department,
        folders: folders.length,
        ...stats[0] || { totalFiles: 0, totalSize: 0, totalDownloads: 0 }
      }
    });

  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department statistics',
      error: error.message
    });
  }
};

// ============ VERSION CONTROL ============

const createFileVersion = async (req, res) => {
  try {
    const { fileId } = req.params;
    const user = await User.findById(req.user.userId);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const file = await SharePointFile.findById(fileId);
    if (!file || file.isDeleted) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permission
    if (file.uploadedBy.toString() !== req.user.userId && user.role !== 'admin') {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create versions'
      });
    }

    // Save current version
    file.versions.push({
      versionNumber: file.versions.length + 1,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.uploadedAt
    });

    // Update to new version
    file.path = req.file.path;
    file.size = req.file.size;
    file.mimetype = req.file.mimetype;
    file.uploadedAt = new Date();
    file.publicId = req.file.filename;

    await file.save();

    // Log activity
    await new SharePointActivityLog({
      action: 'version_create',
      userId: req.user.userId,
      fileId,
      fileName: file.name,
      details: { versionNumber: file.versions.length }
    }).save();

    res.json({
      success: true,
      message: 'New version created successfully',
      data: file
    });

  } catch (error) {
    console.error('Create file version error:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create file version',
      error: error.message
    });
  }
};

const getFileVersions = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = await SharePointFile.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      data: file.versions || []
    });

  } catch (error) {
    console.error('Get file versions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file versions',
      error: error.message
    });
  }
};

const restoreFileVersion = async (req, res) => {
  try {
    const { fileId, versionIndex } = req.params;
    const user = await User.findById(req.user.userId);

    const file = await SharePointFile.findById(fileId);
    if (!file || file.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permission
    if (file.uploadedBy.toString() !== req.user.userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to restore versions'
      });
    }

    const version = file.versions[parseInt(versionIndex)];
    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    // Check if version file exists
    if (!fs.existsSync(version.path)) {
      return res.status(404).json({
        success: false,
        message: 'Version file not found on server'
      });
    }

    // Save current as version
    file.versions.push({
      versionNumber: file.versions.length + 1,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.uploadedAt
    });

    // Restore version
    file.path = version.path;
    file.size = version.size;
    file.mimetype = version.mimetype;
    file.uploadedAt = new Date();

    await file.save();

    // Log activity
    await new SharePointActivityLog({
      action: 'version_restore',
      userId: req.user.userId,
      fileId,
      fileName: file.name,
      details: { restoredVersion: version.versionNumber }
    }).save();

    res.json({
      success: true,
      message: 'Version restored successfully',
      data: file
    });

  } catch (error) {
    console.error('Restore file version error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore file version',
      error: error.message
    });
  }
};

// Get SharePoint dashboard statistics (for dashboard card)
const getSharePointDashboardStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    console.log('=== GET SHAREPOINT DASHBOARD STATS ===');
    console.log('User:', userId);
    console.log('Role:', user.role);
    console.log('Department:', user.department);

    // Get folders accessible to user
    const accessibleFolders = await SharePointFolder.find({
      $or: [
        { isPublic: true },
        { department: user.department },
        { 'accessControl.allowedDepartments': user.department },
        { 'accessControl.allowedUsers': userId },
        { createdBy: userId },
        ...(user.role === 'admin' ? [{}] : [])
      ]
    });

    const accessibleFolderIds = accessibleFolders.map(f => f._id);

    // Get file statistics
    const [
      totalFiles,
      userUploadedFiles,
      recentFiles
    ] = await Promise.all([
      SharePointFile.countDocuments({
        folderId: { $in: accessibleFolderIds },
        isDeleted: false
      }),
      SharePointFile.countDocuments({
        uploadedBy: userId,
        isDeleted: false
      }),
      SharePointFile.countDocuments({
        folderId: { $in: accessibleFolderIds },
        isDeleted: false,
        uploadedAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      })
    ]);

    const stats = {
      pending: 0, // SharePoint doesn't have pending concept, but keeping for consistency
      total: totalFiles,
      userUploaded: userUploadedFiles,
      recent: recentFiles,
      accessibleFolders: accessibleFolders.length
    };

    console.log('SharePoint Stats:', stats);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching SharePoint dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SharePoint dashboard stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


module.exports = {
  // Folder operations
  createFolder,
  getFolders,
  getFolder,
  updateFolder,
  deleteFolder,
  
  // File operations
  uploadFile,
  getFiles,
  getFileDetails,
  downloadFile,
  deleteFile,
  
  // User-specific
  getUserFiles,
  getUserStats,
  
  // Sharing
  shareFile,
  revokeAccess,
  generateShareLink,
  
  // Search & Discovery
  globalSearch,
  getRecentFiles,
  
  // Bulk operations
  bulkUploadFiles,
  
  // Analytics
  getStorageStats,
  getActivityLog,
  getDepartmentStats,
  
  // Version control
  createFileVersion,
  getFileVersions,
  restoreFileVersion,

  // Dashboard stats
  getSharePointDashboardStats
  
}

