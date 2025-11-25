const mongoose = require('mongoose');

// ============================================
// ENHANCED FOLDER SCHEMA WITH GRANULAR ACCESS CONTROL
// ============================================
const SharePointFolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  department: {
    type: String,
    required: true,
    enum: ['Company', 'Finance', 'HR & Admin', 'IT', 'Supply Chain', 'Technical']
  },
  
  // ===== NEW: PRIVACY LEVELS =====
  privacyLevel: {
    type: String,
    enum: ['public', 'department', 'confidential'],
    default: 'department',
    required: true
  },
  
  // Legacy field - kept for backward compatibility
  isPublic: {
    type: Boolean,
    default: false
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // ===== ENHANCED: ACCESS CONTROL =====
  accessControl: {
    // Legacy - department-level access
    allowedDepartments: [String],
    
    // Legacy - user-level access (basic)
    allowedUsers: [mongoose.Schema.Types.ObjectId],
    
    // NEW: Explicit user invitations with permissions
    invitedUsers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      permission: {
        type: String,
        enum: ['view', 'download', 'upload', 'manage'],
        default: 'download',
        required: true
      },
      invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      invitedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // NEW: Blocked users (cannot access even if in department)
    blockedUsers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      blockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      blockedAt: {
        type: Date,
        default: Date.now
      },
      reason: String
    }],
    
    // Legacy - denied users
    deniedUsers: [mongoose.Schema.Types.ObjectId]
  },

  // Metadata
  fileCount: {
    type: Number,
    default: 0
  },
  totalSize: {
    type: Number,
    default: 0
  },
  lastModified: Date
}, { timestamps: true });

// Index for faster queries
SharePointFolderSchema.index({ department: 1, privacyLevel: 1 });
SharePointFolderSchema.index({ 'accessControl.invitedUsers.userId': 1 });
SharePointFolderSchema.index({ createdBy: 1 });

// ============================================
// ENHANCED FILE SCHEMA WITH GRANULAR SHARING
// ============================================
const SharePointFileSchema = new mongoose.Schema({
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SharePointFolder',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  description: String,
  mimetype: String,
  size: Number,
  path: String,
  publicId: String,
  
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  
  // ===== ENHANCED: SHARING & ACCESS =====
  sharedWith: [{
    // User-level sharing
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Department-level sharing
    department: String,
    
    // NEW: Permission type
    permission: {
      type: String,
      enum: ['view', 'download', 'edit'],
      default: 'download'
    },
    
    // Share type
    type: {
      type: String,
      enum: ['view', 'download', 'edit'],
      default: 'download'
    },
    sharedAt: Date,
    sharedBy: mongoose.Schema.Types.ObjectId
  }],
  
  // ===== NEW: PUBLIC SHARE LINK =====
  shareLink: {
    token: String,
    expiresAt: Date,
    createdBy: mongoose.Schema.Types.ObjectId,
    accessCount: {
      type: Number,
      default: 0
    },
    maxAccess: Number, // Optional limit
    password: String // Optional password protection
  },
  
  // Tracking
  downloads: {
    type: Number,
    default: 0
  },
  downloadLog: [{
    userId: mongoose.Schema.Types.ObjectId,
    downloadedAt: Date,
    ipAddress: String
  }],
  
  // Tags and categorization
  tags: [String],
  category: String,
  
  // Version control
  versions: [{
    versionNumber: Number,
    path: String,
    size: Number,
    mimetype: String,
    uploadedBy: mongoose.Schema.Types.ObjectId,
    uploadedAt: Date
  }],
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

// Index for faster queries
SharePointFileSchema.index({ folderId: 1, isDeleted: 1 });
SharePointFileSchema.index({ uploadedBy: 1 });
SharePointFileSchema.index({ 'sharedWith.userId': 1 });
SharePointFileSchema.index({ 'shareLink.token': 1 });

// ============================================
// ACTIVITY LOG SCHEMA - Enhanced
// ============================================
const SharePointActivityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      'upload', 'download', 'delete', 'share', 'view', 
      'folder_create', 'access_granted', 'access_revoked',
      'user_invited', 'user_blocked', 'permission_changed',
      'version_create', 'version_restore'
    ],
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileId: mongoose.Schema.Types.ObjectId,
  folderId: mongoose.Schema.Types.ObjectId,
  fileName: String,
  folderName: String,
  
  // NEW: Additional context
  targetUserId: mongoose.Schema.Types.ObjectId, // For invite/block actions
  permission: String, // Permission level for access changes
  
  details: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for activity queries
SharePointActivityLogSchema.index({ userId: 1, timestamp: -1 });
SharePointActivityLogSchema.index({ folderId: 1, timestamp: -1 });
SharePointActivityLogSchema.index({ action: 1, timestamp: -1 });

module.exports = {
  SharePointFolder: mongoose.model('SharePointFolder', SharePointFolderSchema),
  SharePointFile: mongoose.model('SharePointFile', SharePointFileSchema),
  SharePointActivityLog: mongoose.model('SharePointActivityLog', SharePointActivityLogSchema)
};









// const mongoose = require('mongoose');

// const SharePointFolderSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//     maxlength: 100
//   },
//   description: {
//     type: String,
//     required: true,
//     maxlength: 500
//   },
//   department: {
//     type: String,
//     required: true,
//     enum: ['Company', 'Finance', 'HR & Admin', 'IT', 'Supply Chain', 'Technical']
//   },
//   isPublic: {
//     type: Boolean,
//     default: false
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   },
  
//   // Access Control
//   accessControl: {
//     allowedDepartments: [String],
//     allowedUsers: [mongoose.Schema.Types.ObjectId],
//     deniedUsers: [mongoose.Schema.Types.ObjectId]
//   },

//   // Metadata
//   fileCount: {
//     type: Number,
//     default: 0
//   },
//   totalSize: {
//     type: Number,
//     default: 0
//   },
//   lastModified: Date
// }, { timestamps: true });

// const SharePointFileSchema = new mongoose.Schema({
//   folderId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'SharePointFolder',
//     required: true
//   },
//   name: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 255
//   },
//   description: String,
//   mimetype: String,
//   size: Number,
//   path: String,
//   publicId: String,
  
//   uploadedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   uploadedAt: {
//     type: Date,
//     default: Date.now
//   },
  
//   // Sharing & Access
//   sharedWith: [{
//     userId: mongoose.Schema.Types.ObjectId,
//     department: String,
//     type: {
//       type: String,
//       enum: ['view', 'download', 'edit'],
//       default: 'view'
//     },
//     sharedAt: Date,
//     sharedBy: mongoose.Schema.Types.ObjectId
//   }],
  
//   // Tracking
//   downloads: {
//     type: Number,
//     default: 0
//   },
//   downloadLog: [{
//     userId: mongoose.Schema.Types.ObjectId,
//     downloadedAt: Date,
//     ipAddress: String
//   }],
  
//   // Tags and categorization
//   tags: [String],
//   category: String,
  
//   // Version control
//   versions: [{
//     fileId: String,
//     uploadedAt: Date,
//     uploadedBy: mongoose.Schema.Types.ObjectId,
//     size: Number
//   }],
  
//   isDeleted: {
//     type: Boolean,
//     default: false
//   },
//   deletedAt: Date,
//   deletedBy: mongoose.Schema.Types.ObjectId
// }, { timestamps: true });

// const SharePointActivityLogSchema = new mongoose.Schema({
//   action: {
//     type: String,
//     enum: ['upload', 'download', 'delete', 'share', 'view', 'folder_create', 'access_granted', 'access_revoked'],
//     required: true
//   },
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   fileId: mongoose.Schema.Types.ObjectId,
//   folderId: mongoose.Schema.Types.ObjectId,
//   fileName: String,
//   folderName: String,
//   details: mongoose.Schema.Types.Mixed,
//   timestamp: {
//     type: Date,
//     default: Date.now,
//     index: true
//   }
// });

// module.exports = {
//   SharePointFolder: mongoose.model('SharePointFolder', SharePointFolderSchema),
//   SharePointFile: mongoose.model('SharePointFile', SharePointFileSchema),
//   SharePointActivityLog: mongoose.model('SharePointActivityLog', SharePointActivityLogSchema)
// };
