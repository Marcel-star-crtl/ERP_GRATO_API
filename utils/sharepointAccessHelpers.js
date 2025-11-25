// ============================================
// ENHANCED ACCESS CONTROL HELPER FUNCTIONS
// ============================================

/**
 * Check if user can access a folder
 * @returns {Object} { canAccess: boolean, permission: string, reason: string }
 */
const canUserAccessFolder = (folder, user) => {
  // 1. PRIORITY: Check if user is blocked
  const isBlocked = folder.accessControl.blockedUsers.some(
    block => block.userId.toString() === user._id.toString()
  );
  
  if (isBlocked) {
    return {
      canAccess: false,
      permission: 'none',
      reason: 'User is blocked from this folder'
    };
  }

  // 2. Creator always has full access
  if (folder.createdBy.toString() === user._id.toString()) {
    return {
      canAccess: true,
      permission: 'manage',
      reason: 'Folder creator'
    };
  }

  // 3. Admin has full access to all folders
  if (user.role === 'admin') {
    return {
      canAccess: true,
      permission: 'manage',
      reason: 'Administrator'
    };
  }

  // 4. Check explicit invitations (highest priority for regular users)
  const invitation = folder.accessControl.invitedUsers.find(
    inv => inv.userId.toString() === user._id.toString()
  );
  
  if (invitation) {
    return {
      canAccess: true,
      permission: invitation.permission,
      reason: 'Explicitly invited'
    };
  }

  // 5. Check privacy level
  switch (folder.privacyLevel) {
    case 'public':
      // Everyone can view public folders
      return {
        canAccess: true,
        permission: 'download',
        reason: 'Public folder'
      };
      
    case 'department':
      // Users in same department can access
      if (folder.department === user.department) {
        return {
          canAccess: true,
          permission: 'upload',
          reason: 'Same department'
        };
      }
      
      // Check if user's department is in allowedDepartments
      if (folder.accessControl.allowedDepartments.includes(user.department)) {
        return {
          canAccess: true,
          permission: 'download',
          reason: 'Allowed department'
        };
      }
      break;
      
    case 'confidential':
      // Only invited users can access confidential folders
      // Already checked in step 4, so if we reach here, no access
      return {
        canAccess: false,
        permission: 'none',
        reason: 'Confidential folder - invitation required'
      };
  }

  // 6. No access by default
  return {
    canAccess: false,
    permission: 'none',
    reason: 'No access permissions'
  };
};

/**
 * Check if user can perform specific action on folder
 */
const canUserPerformAction = (folder, user, action) => {
  const access = canUserAccessFolder(folder, user);
  
  if (!access.canAccess) {
    return false;
  }

  const permission = access.permission;

  switch (action) {
    case 'view':
      return ['view', 'download', 'upload', 'manage'].includes(permission);
      
    case 'download':
      return ['download', 'upload', 'manage'].includes(permission);
      
    case 'upload':
      return ['upload', 'manage'].includes(permission);
      
    case 'delete':
      return permission === 'manage';
      
    case 'manage':
      return permission === 'manage';
      
    case 'invite':
      return permission === 'manage';
      
    case 'share':
      return ['upload', 'manage'].includes(permission);
      
    default:
      return false;
  }
};

/**
 * Check if user can upload to folder
 */
const canUserUploadToFolder = (folder, user) => {
  return canUserPerformAction(folder, user, 'upload');
};

/**
 * Check if user can manage folder (invite, change settings, etc)
 */
const canUserManageFolder = (folder, user) => {
  return canUserPerformAction(folder, user, 'manage');
};

/**
 * Check if user can delete folder
 */
const canUserDeleteFolder = (folder, user) => {
  // Only creator and admin can delete
  return (
    folder.createdBy.toString() === user._id.toString() || 
    user.role === 'admin'
  );
};

/**
 * Check if user can invite others to folder
 */
const canUserInviteToFolder = (folder, user) => {
  return canUserPerformAction(folder, user, 'invite');
};

/**
 * Check if user can block others from folder
 */
const canUserBlockFromFolder = (folder, user) => {
  // Only creator and admin can block
  return (
    folder.createdBy.toString() === user._id.toString() || 
    user.role === 'admin'
  );
};

/**
 * Get user's permission level for folder
 */
const getUserFolderPermission = (folder, user) => {
  const access = canUserAccessFolder(folder, user);
  return access.permission;
};

/**
 * Check if folder should be visible to user
 * Confidential folders are invisible unless user has access
 */
const isFolderVisibleToUser = (folder, user) => {
  // Admin sees all folders
  if (user.role === 'admin') {
    return true;
  }

  // Creator sees their own folders
  if (folder.createdBy.toString() === user._id.toString()) {
    return true;
  }

  // Confidential folders are invisible unless user has access
  if (folder.privacyLevel === 'confidential') {
    const invitation = folder.accessControl.invitedUsers.find(
      inv => inv.userId.toString() === user._id.toString()
    );
    return !!invitation;
  }

  // All other folders are visible
  return true;
};

/**
 * Check if user can access file
 */
const canUserAccessFile = async (file, user, SharePointFolder) => {
  // Get parent folder
  const folder = await SharePointFolder.findById(file.folderId);
  
  if (!folder) {
    return {
      canAccess: false,
      permission: 'none',
      reason: 'Folder not found'
    };
  }

  // Check folder access first
  const folderAccess = canUserAccessFolder(folder, user);
  
  if (!folderAccess.canAccess) {
    // Check if file is explicitly shared with user
    const fileShare = file.sharedWith.find(
      share => share.userId?.toString() === user._id.toString()
    );
    
    if (fileShare) {
      return {
        canAccess: true,
        permission: fileShare.permission || fileShare.type,
        reason: 'File explicitly shared'
      };
    }
    
    return folderAccess;
  }

  return folderAccess;
};

/**
 * Get list of users who can access folder
 */
const getFolderAccessList = async (folder, User) => {
  const accessList = [];

  // Add creator
  const creator = await User.findById(folder.createdBy).select('fullName email department');
  if (creator) {
    accessList.push({
      user: creator,
      permission: 'manage',
      reason: 'Creator'
    });
  }

  // Add invited users
  for (const invitation of folder.accessControl.invitedUsers) {
    const user = await User.findById(invitation.userId).select('fullName email department');
    if (user) {
      accessList.push({
        user: user,
        permission: invitation.permission,
        reason: 'Invited',
        invitedAt: invitation.invitedAt,
        invitedBy: invitation.invitedBy
      });
    }
  }

  // Add department users (if not confidential)
  if (folder.privacyLevel !== 'confidential') {
    const deptUsers = await User.find({ 
      department: folder.department,
      _id: { $ne: folder.createdBy }
    }).select('fullName email department');
    
    for (const user of deptUsers) {
      // Skip if already in list
      if (accessList.find(a => a.user._id.toString() === user._id.toString())) {
        continue;
      }
      
      // Skip if blocked
      const isBlocked = folder.accessControl.blockedUsers.some(
        block => block.userId.toString() === user._id.toString()
      );
      
      if (!isBlocked) {
        accessList.push({
          user: user,
          permission: folder.privacyLevel === 'public' ? 'download' : 'upload',
          reason: 'Department member'
        });
      }
    }
  }

  return accessList;
};

module.exports = {
  canUserAccessFolder,
  canUserPerformAction,
  canUserUploadToFolder,
  canUserManageFolder,
  canUserDeleteFolder,
  canUserInviteToFolder,
  canUserBlockFromFolder,
  getUserFolderPermission,
  isFolderVisibleToUser,
  canUserAccessFile,
  getFolderAccessList
};