const { sendEmail } = require('./emailService');

const sharepointEmailTemplates = {
  /**
   * Notify when user is granted folder access
   */
  folderAccessGranted: async (recipientEmail, recipientName, folderName, grantedByName, permission) => {
    try {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      const folderLink = `${clientUrl}/sharepoint/portal`;
      
      const permissionLabels = {
        view: 'View only',
        download: 'View and Download',
        upload: 'View, Download and Upload',
        manage: 'Full Management'
      };

      const subject = `📁 You've been granted access to "${folderName}"`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
            <h2 style="color: #333; margin-top: 0;">🎉 Folder Access Granted</h2>
            <p style="color: #555; line-height: 1.6;">
              Hi ${recipientName},
            </p>
            <p style="color: #555; line-height: 1.6;">
              <strong>${grantedByName}</strong> has invited you to access the folder <strong>"${folderName}"</strong>.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0;">Your Access Level</h3>
              <div style="background-color: #1890ff; color: white; padding: 10px 15px; border-radius: 6px; display: inline-block; font-weight: bold;">
                ${permissionLabels[permission]}
              </div>
              <div style="margin-top: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
                ${permission === 'view' ? '👁️ You can view files in this folder' : ''}
                ${permission === 'download' ? '⬇️ You can view and download files' : ''}
                ${permission === 'upload' ? '⬆️ You can view, download, and upload files' : ''}
                ${permission === 'manage' ? '🔧 You have full management rights (invite others, delete files, etc.)' : ''}
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${folderLink}" 
                 style="display: inline-block; background-color: #1890ff; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px;">
                Access Folder Now
              </a>
            </div>

            <div style="margin-top: 20px; padding: 15px; background-color: #fff7e6; border-radius: 6px; border-left: 3px solid #faad14;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                💡 <strong>Tip:</strong> You can now access this folder from the SharePoint Portal under your accessible folders list.
              </p>
            </div>
          </div>
        </div>
      `;

      return await sendEmail({ to: recipientEmail, subject, html });

    } catch (error) {
      console.error('Error sending folder access granted notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Notify when user access is revoked
   */
  folderAccessRevoked: async (recipientEmail, recipientName, folderName, revokedByName) => {
    try {
      const subject = `Access removed from "${folderName}"`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #856404; margin-top: 0;">⚠️ Access Removed</h2>
            <p style="color: #856404; line-height: 1.6;">
              Hi ${recipientName},
            </p>
            <p style="color: #856404; line-height: 1.6;">
              Your access to the folder <strong>"${folderName}"</strong> has been removed by <strong>${revokedByName}</strong>.
            </p>
            <p style="color: #856404; line-height: 1.6;">
              You will no longer be able to access files in this folder.
            </p>
            
            <div style="margin-top: 20px; padding: 15px; background-color: white; border-radius: 6px;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                If you believe this was done in error, please contact <strong>${revokedByName}</strong> or your administrator.
              </p>
            </div>
          </div>
        </div>
      `;

      return await sendEmail({ to: recipientEmail, subject, html });

    } catch (error) {
      console.error('Error sending folder access revoked notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Notify when file is shared with user
   */
  fileShared: async (recipientEmail, recipientName, fileName, folderName, sharedByName, accessType) => {
    try {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      const fileLink = `${clientUrl}/sharepoint/portal`;

      const subject = `📁 ${sharedByName} shared "${fileName}" with you`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f0ebff; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
            <h2 style="color: #333; margin-top: 0;">📁 File Shared With You</h2>
            <p style="color: #555; line-height: 1.6;">
              Hi ${recipientName},
            </p>
            <p style="color: #555; line-height: 1.6;">
              <strong>${sharedByName}</strong> has shared a file with you on the SharePoint Portal.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">File Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>File Name:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${fileName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Folder:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${folderName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Access Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="background-color: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                      ${accessType.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${fileLink}" 
                 style="display: inline-block; background-color: #667eea; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px;">
                View File
              </a>
            </div>
          </div>
        </div>
      `;

      return await sendEmail({ to: recipientEmail, subject, html });

    } catch (error) {
      console.error('Error sending file shared notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Notify when file is uploaded to a folder user has access to
   */
  fileUploaded: async (departmentEmails, fileName, folderName, uploadedByName, fileSize) => {
    try {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      const folderLink = `${clientUrl}/sharepoint/portal`;

      const subject = `📤 New file uploaded to ${folderName}: ${fileName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h2 style="color: #155724; margin-top: 0;">📤 New File Uploaded</h2>
            <p style="color: #155724; line-height: 1.6;">
              <strong>${uploadedByName}</strong> has uploaded a new file to the <strong>${folderName}</strong> folder.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0;">File Information</h3>
              <p><strong>File:</strong> ${fileName}</p>
              <p><strong>Size:</strong> ${(fileSize / 1024).toFixed(2)} KB</p>
              <p><strong>Uploaded by:</strong> ${uploadedByName}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${folderLink}" 
                 style="display: inline-block; background-color: #28a745; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px;">
                Access Folder
              </a>
            </div>
          </div>
        </div>
      `;

      return await sendEmail({ to: departmentEmails, subject, html });

    } catch (error) {
      console.error('Error sending file upload notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Notify about storage quota warning
   */
  storageQuotaWarning: async (folderAdminEmail, folderName, usedSpace, maxSpace) => {
    try {
      const percentUsed = ((usedSpace / maxSpace) * 100).toFixed(2);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

      const subject = `⚠️ Storage quota warning for ${folderName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #856404; margin-top: 0;">⚠️ Storage Quota Warning</h2>
            <p style="color: #856404; line-height: 1.6;">
              The <strong>${folderName}</strong> folder is running low on storage space.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span>Storage Used</span>
                  <span>${percentUsed}%</span>
                </div>
                <div style="background-color: #e9ecef; border-radius: 4px; height: 20px; overflow: hidden;">
                  <div style="background-color: #ffc107; height: 100%; width: ${percentUsed}%;"></div>
                </div>
              </div>
              <p style="margin: 0; color: #666; font-size: 14px;">
                Used: ${(usedSpace / 1024 / 1024).toFixed(2)} MB / ${(maxSpace / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <div style="background-color: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <p style="color: #721c24; margin: 0;">
                <strong>Action Required:</strong> Please delete or archive old files to free up storage space.
              </p>
            </div>
          </div>
        </div>
      `;

      return await sendEmail({ to: folderAdminEmail, subject, html });

    } catch (error) {
      console.error('Error sending quota warning:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Notify when user is blocked from folder
   */
  userBlocked: async (recipientEmail, recipientName, folderName, blockedByName, reason) => {
    try {
      const subject = `🚫 Access blocked from "${folderName}"`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
            <h2 style="color: #721c24; margin-top: 0;">🚫 Access Blocked</h2>
            <p style="color: #721c24; line-height: 1.6;">
              Hi ${recipientName},
            </p>
            <p style="color: #721c24; line-height: 1.6;">
              Your access to the folder <strong>"${folderName}"</strong> has been blocked by <strong>${blockedByName}</strong>.
            </p>
            ${reason ? `
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #666;">
                  <strong>Reason:</strong> ${reason}
                </p>
              </div>
            ` : ''}
            <p style="color: #721c24; line-height: 1.6;">
              If you have questions, please contact <strong>${blockedByName}</strong> or your administrator.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({ to: recipientEmail, subject, html });

    } catch (error) {
      console.error('Error sending user blocked notification:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = sharepointEmailTemplates;








// const { sendEmail } = require('./emailService');

// const sharepointEmailTemplates = {
//   /**
//    * Notify when file is shared with user
//    */
//   fileShared: async (recipientEmail, recipientName, fileName, folderName, sharedByName, accessType) => {
//     try {
//       const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
//       const fileLink = `${clientUrl}/sharepoint/portal`;

//       const subject = `📁 ${sharedByName} shared "${fileName}" with you`;
//       const html = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//           <div style="background-color: #f0ebff; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
//             <h2 style="color: #333; margin-top: 0;">📁 File Shared With You</h2>
//             <p style="color: #555; line-height: 1.6;">
//               Hi ${recipientName},
//             </p>
//             <p style="color: #555; line-height: 1.6;">
//               <strong>${sharedByName}</strong> has shared a file with you on the SharePoint Portal.
//             </p>

//             <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
//               <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">File Details</h3>
//               <table style="width: 100%; border-collapse: collapse;">
//                 <tr>
//                   <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>File Name:</strong></td>
//                   <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${fileName}</td>
//                 </tr>
//                 <tr>
//                   <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Folder:</strong></td>
//                   <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${folderName}</td>
//                 </tr>
//                 <tr>
//                   <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Access Type:</strong></td>
//                   <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
//                     <span style="background-color: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
//                       ${accessType.toUpperCase()}
//                     </span>
//                   </td>
//                 </tr>
//               </table>
//             </div>

//             <div style="text-align: center; margin: 30px 0;">
//               <a href="${fileLink}" 
//                  style="display: inline-block; background-color: #667eea; color: white; 
//                         padding: 15px 30px; text-decoration: none; border-radius: 8px;
//                         font-weight: bold; font-size: 16px;">
//                 View File
//               </a>
//             </div>
//           </div>
//         </div>
//       `;

//       return await sendEmail({
//         to: recipientEmail,
//         subject,
//         html
//       });

//     } catch (error) {
//       console.error('Error sending file shared notification:', error);
//       return { success: false, error: error.message };
//     }
//   },

//   /**
//    * Notify when file is uploaded to a folder
//    */
//   fileUploaded: async (departmentEmails, fileName, folderName, uploadedByName, fileSize) => {
//     try {
//       const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
//       const folderLink = `${clientUrl}/sharepoint/portal`;

//       const subject = `📤 New file uploaded to ${folderName}: ${fileName}`;
//       const html = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//           <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
//             <h2 style="color: #155724; margin-top: 0;">📤 New File Uploaded</h2>
//             <p style="color: #155724; line-height: 1.6;">
//               <strong>${uploadedByName}</strong> has uploaded a new file to the <strong>${folderName}</strong> folder.
//             </p>

//             <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
//               <h3 style="color: #333; margin-top: 0;">File Information</h3>
//               <p><strong>File:</strong> ${fileName}</p>
//               <p><strong>Size:</strong> ${(fileSize / 1024).toFixed(2)} KB</p>
//               <p><strong>Uploaded by:</strong> ${uploadedByName}</p>
//             </div>

//             <div style="text-align: center; margin: 30px 0;">
//               <a href="${folderLink}" 
//                  style="display: inline-block; background-color: #28a745; color: white; 
//                         padding: 15px 30px; text-decoration: none; border-radius: 8px;
//                         font-weight: bold; font-size: 16px;">
//                 Access Folder
//               </a>
//             </div>
//           </div>
//         </div>
//       `;

//       return await sendEmail({
//         to: departmentEmails,
//         subject,
//         html
//       });

//     } catch (error) {
//       console.error('Error sending file upload notification:', error);
//       return { success: false, error: error.message };
//     }
//   },

//   /**
//    * Notify about storage quota warning
//    */
//   storageQuotaWarning: async (folderAdminEmail, folderName, usedSpace, maxSpace) => {
//     try {
//       const percentUsed = ((usedSpace / maxSpace) * 100).toFixed(2);
//       const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

//       const subject = `⚠️ Storage quota warning for ${folderName}`;
//       const html = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//           <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
//             <h2 style="color: #856404; margin-top: 0;">⚠️ Storage Quota Warning</h2>
//             <p style="color: #856404; line-height: 1.6;">
//               The <strong>${folderName}</strong> folder is running low on storage space.
//             </p>

//             <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
//               <div style="margin-bottom: 15px;">
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
//                   <span>Storage Used</span>
//                   <span>${percentUsed}%</span>
//                 </div>
//                 <div style="background-color: #e9ecef; border-radius: 4px; height: 20px; overflow: hidden;">
//                   <div style="background-color: #ffc107; height: 100%; width: ${percentUsed}%;"></div>
//                 </div>
//               </div>
//               <p style="margin: 0; color: #666; font-size: 14px;">
//                 Used: ${(usedSpace / 1024 / 1024).toFixed(2)} MB / ${(maxSpace / 1024 / 1024).toFixed(2)} MB
//               </p>
//             </div>

//             <div style="background-color: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
//               <p style="color: #721c24; margin: 0;">
//                 Please delete or archive old files to free up storage space.
//               </p>
//             </div>
//           </div>
//         </div>
//       `;

//       return await sendEmail({
//         to: folderAdminEmail,
//         subject,
//         html
//       });

//     } catch (error) {
//       console.error('Error sending quota warning:', error);
//       return { success: false, error: error.message };
//     }
//   }
// };

// module.exports = sharepointEmailTemplates;









// // ==========================================
// // ADVANCED CONTROLLER - Advanced Features
// // ==========================================

// const mongoose = require('mongoose');
// const { SharePointFolder, SharePointFile, SharePointActivityLog } = require('../models/SharePoint');
// const User = require('../models/User');
// const sharepointEmailTemplates = require('../services/sharepointEmailService');

// /**
//  * Search across all files and folders
//  */
// const globalSearch = async (req, res) => {
//   try {
//     const { query, type, department, tags } = req.query;
//     const user = await User.findById(req.user.userId);

//     if (!query || query.trim().length < 2) {
//       return res.status(400).json({
//         success: false,
//         message: 'Search query must be at least 2 characters'
//       });
//     }

//     const searchRegex = { $regex: query, $options: 'i' };
//     const results = { folders: [], files: [] };

//     // Search folders
//     if (!type || type === 'folders') {
//       let folderQuery = {
//         name: searchRegex,
//         $or: [
//           { isPublic: true },
//           { department: user.department },
//           { 'accessControl.allowedDepartments': user.department },
//           { 'accessControl.allowedUsers': req.user.userId }
//         ]
//       };

//       if (department) folderQuery.department = department;

//       results.folders = await SharePointFolder.find(folderQuery)
//         .populate('createdBy', 'fullName email')
//         .limit(10);
//     }

//     // Search files
//     if (!type || type === 'files') {
//       let fileQuery = {
//         name: searchRegex,
//         isDeleted: false
//       };

//       if (tags) {
//         fileQuery.tags = { $in: tags.split(',').map(t => t.trim()) };
//       }

//       results.files = await SharePointFile.find(fileQuery)
//         .populate('uploadedBy', 'fullName email')
//         .limit(10);
//     }

//     res.json({
//       success: true,
//       data: results,
//       totalResults: results.folders.length + results.files.length
//     });

//   } catch (error) {
//     console.error('Global search error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Search failed',
//       error: error.message
//     });
//   }
// };

// /**
//  * Get recent files for dashboard
//  */
// const getRecentFiles = async (req, res) => {
//   try {
//     const { limit = 10 } = req.query;
//     const user = await User.findById(req.user.userId);

//     const files = await SharePointFile.find({
//       isDeleted: false,
//       uploadedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
//     })
//     .populate('uploadedBy', 'fullName email')
//     .populate('folderId', 'name')
//     .sort({ uploadedAt: -1 })
//     .limit(parseInt(limit));

//     res.json({
//       success: true,
//       data: files
//     });

//   } catch (error) {
//     console.error('Get recent files error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch recent files',
//       error: error.message
//     });
//   }
// };

// /**
//  * Get user's upload statistics
//  */
// const getUserStats = async (req, res) => {
//   try {
//     const stats = await SharePointFile.aggregate([
//       { $match: { uploadedBy: mongoose.Types.ObjectId(req.user.userId), isDeleted: false } },
//       { $group: {
//           _id: null,
//           filesUploaded: { $sum: 1 },
//           totalSize: { $sum: '$size' },
//           totalDownloads: { $sum: '$downloads' }
//         }
//       }
//     ]);

//     const activityStats = await SharePointActivityLog.aggregate([
//       { $match: { userId: mongoose.Types.ObjectId(req.user.userId) } },
//       { $group: {
//           _id: '$action',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     res.json({
//       success: true,
//       data: {
//         uploads: stats[0] || { filesUploaded: 0, totalSize: 0, totalDownloads: 0 },
//         activity: activityStats
//       }
//     });

//   } catch (error) {
//     console.error('Get user stats error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch user statistics',
//       error: error.message
//     });
//   }
// };

// /**
//  * Generate share link for file
//  */
// const generateShareLink = async (req, res) => {
//   try {
//     const { fileId } = req.params;
//     const { expiresIn } = req.body;

//     const file = await SharePointFile.findById(fileId);
//     if (!file) {
//       return res.status(404).json({
//         success: false,
//         message: 'File not found'
//       });
//     }

//     // Check permission
//     if (file.uploadedBy.toString() !== req.user.userId && req.user.role !== 'admin') {
//       return res.status(403).json({
//         success: false,
//         message: 'You do not have permission to share this file'
//       });
//     }

//     // Generate unique share token
//     const shareToken = require('crypto').randomBytes(32).toString('hex');
//     const expirationDate = expiresIn ? new Date(Date.now() + parseInt(expiresIn) * 1000) : null;

//     // Store share link (implement in your ShareLink model)
//     // For now, construct the link
//     const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
//     const shareLink = `${clientUrl}/sharepoint/shared/${shareToken}`;

//     res.json({
//       success: true,
//       data: {
//         shareLink,
//         shareToken,
//         expiresAt: expirationDate
//       }
//     });

//   } catch (error) {
//     console.error('Generate share link error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to generate share link',
//       error: error.message
//     });
//   }
// };

// /**
//  * Create file version/backup
//  */
// const createFileVersion = async (req, res) => {
//   try {
//     const { fileId } = req.params;

//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: 'No file provided'
//       });
//     }

//     const file = await SharePointFile.findById(fileId);
//     if (!file) {
//       return res.status(404).json({
//         success: false,
//         message: 'File not found'
//       });
//     }

//     // Check permission
//     if (file.uploadedBy.toString() !== req.user.userId && req.user.role !== 'admin') {
//       return res.status(403).json({
//         success: false,
//         message: 'You do not have permission to version this file'
//       });
//     }

//     // Add to versions
//     file.versions.push({
//       fileId: file.publicId,
//       uploadedAt: new Date(),
//       uploadedBy: req.user.userId,
//       size: file.size
//     });

//     // Update current file
//     file.path = req.file.path;
//     file.publicId = req.file.filename;
//     file.size = req.file.size;
//     file.mimetype = req.file.mimetype;

//     await file.save();

//     res.json({
//       success: true,
//       message: 'File version created successfully',
//       data: file
//     });

//   } catch (error) {
//     console.error('Create file version error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to create file version',
//       error: error.message
//     });
//   }
// };

// /**
//  * Restore file from version
//  */
// const restoreFileVersion = async (req, res) => {
//   try {
//     const { fileId, versionIndex } = req.params;

//     const file = await SharePointFile.findById(fileId);
//     if (!file) {
//       return res.status(404).json({
//         success: false,
//         message: 'File not found'
//       });
//     }

//     // Check permission
//     if (file.uploadedBy.toString() !== req.user.userId && req.user.role !== 'admin') {
//       return res.status(403).json({
//         success: false,
//         message: 'You do not have permission to restore this file'
//       });
//     }

//     const version = file.versions[versionIndex];
//     if (!version) {
//       return res.status(404).json({
//         success: false,
//         message: 'Version not found'
//       });
//     }

//     // Restore version
//     const originalFileId = file.publicId;
//     file.publicId = version.fileId;
//     file.size = version.size;
//     file.updatedAt = new Date();

//     file.versions.splice(versionIndex, 1);
//     file.versions.push({
//       fileId: originalFileId,
//       uploadedAt: new Date(),
//       uploadedBy: req.user.userId,
//       size: file.size
//     });

//     await file.save();

//     res.json({
//       success: true,
//       message: 'File restored from version successfully',
//       data: file
//     });

//   } catch (error) {
//     console.error('Restore file version error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to restore file version',
//       error: error.message
//     });
//   }
// };

// /**
//  * Bulk upload files
//  */
// const bulkUploadFiles = async (req, res) => {
//   try {
//     const { folderId } = req.params;

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No files provided'
//       });
//     }

//     const folder = await SharePointFolder.findById(folderId);
//     if (!folder) {
//       return res.status(404).json({
//         success: false,
//         message: 'Folder not found'
//       });
//     }

//     const uploadedFiles = [];
//     const failedFiles = [];

//     for (const file of req.files) {
//       try {
//         const sharePointFile = new SharePointFile({
//           folderId,
//           name: file.originalname,
//           mimetype: file.mimetype,
//           size: file.size,
//           path: file.path,
//           publicId: file.filename,
//           uploadedBy: req.user.userId
//         });

//         await sharePointFile.save();
//         uploadedFiles.push(sharePointFile);

//         // Update folder metadata
//         folder.fileCount += 1;
//         folder.totalSize += file.size;

//       } catch (fileError) {
//         failedFiles.push({
//           fileName: file.originalname,
//           error: fileError.message
//         });
//       }
//     }

//     await folder.save();

//     res.json({
//       success: true,
//       message: `${uploadedFiles.length} files uploaded successfully`,
//       data: {
//         uploaded: uploadedFiles,
//         failed: failedFiles,
//         total: uploadedFiles.length + failedFiles.length
//       }
//     });

//   } catch (error) {
//     console.error('Bulk upload error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Bulk upload failed',
//       error: error.message
//     });
//   }
// };

// module.exports = {
//   globalSearch,
//   getRecentFiles,
//   getUserStats,
//   generateShareLink,
//   createFileVersion,
//   restoreFileVersion,
//   bulkUploadFiles
// };