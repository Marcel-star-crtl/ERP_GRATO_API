const mongoose = require('mongoose');

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
  
  // Access Control
  accessControl: {
    allowedDepartments: [String],
    allowedUsers: [mongoose.Schema.Types.ObjectId],
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
  
  // Sharing & Access
  sharedWith: [{
    userId: mongoose.Schema.Types.ObjectId,
    department: String,
    type: {
      type: String,
      enum: ['view', 'download', 'edit'],
      default: 'view'
    },
    sharedAt: Date,
    sharedBy: mongoose.Schema.Types.ObjectId
  }],
  
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
    fileId: String,
    uploadedAt: Date,
    uploadedBy: mongoose.Schema.Types.ObjectId,
    size: Number
  }],
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

const SharePointActivityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['upload', 'download', 'delete', 'share', 'view', 'folder_create', 'access_granted', 'access_revoked'],
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
  details: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = {
  SharePointFolder: mongoose.model('SharePointFolder', SharePointFolderSchema),
  SharePointFile: mongoose.model('SharePointFile', SharePointFileSchema),
  SharePointActivityLog: mongoose.model('SharePointActivityLog', SharePointActivityLogSchema)
};
