// const express = require('express');
// const router = express.Router();
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const upload = require('../middlewares/uploadMiddleware');
// const cashRequestController = require('../controllers/cashRequestController');
// // const CashRequest = require('../models/CashRequest')
// const CashRequest = require('../models/CashRequest');

// // Import error handlers from upload middleware
// const { handleMulterError, cleanupTempFiles, validateFiles } = require('../middlewares/uploadMiddleware');

// // ============================================
// // DASHBOARD STATS
// // ============================================
// router.get(
//   '/dashboard-stats',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   async (req, res) => {
//     try {
//       const CashRequest = require('../models/CashRequest');
//       const User = require('../models/User');
      
//       const user = await User.findById(req.user.userId);
//       console.log(`=== DASHBOARD STATS for ${user.role}: ${user.email} ===`);
      
//       let baseFilter = {};
//       let pendingFilter = {};
      
//       if (user.role === 'employee') {
//         baseFilter = { employee: req.user.userId };
//         pendingFilter = {
//           employee: req.user.userId,
//           status: { $regex: /pending/ }
//         };
//       } else if (user.role === 'supervisor') {
//         baseFilter = {
//           'approvalChain': {
//             $elemMatch: {
//               'approver.email': user.email
//             }
//           }
//         };
//         pendingFilter = {
//           'approvalChain': {
//             $elemMatch: {
//               'approver.email': user.email,
//               'status': 'pending'
//             }
//           }
//         };
//       } else if (user.role === 'finance') {
//         baseFilter = {
//           $or: [
//             { status: { $regex: /pending_finance/ } },
//             { status: 'approved' },
//             { status: 'disbursed' },
//             { status: 'completed' },
//             {
//               'approvalChain': {
//                 $elemMatch: {
//                   'approver.role': 'Finance Officer'
//                 }
//               }
//             }
//           ]
//         };
//         pendingFilter = {
//           $or: [
//             { status: { $regex: /pending_finance/ } },
//             {
//               'approvalChain': {
//                 $elemMatch: {
//                   'approver.email': user.email,
//                   'approver.role': 'Finance Officer',
//                   'status': 'pending'
//                 }
//               }
//             }
//           ]
//         };
//       } else if (user.role === 'admin') {
//         baseFilter = {};
//         pendingFilter = {
//           status: { $regex: /pending/ }
//         };
//       }
      
//       console.log('Base filter:', JSON.stringify(baseFilter, null, 2));
//       console.log('Pending filter:', JSON.stringify(pendingFilter, null, 2));
      
//       const [total, pending, approved, disbursed, completed, denied] = await Promise.all([
//         CashRequest.countDocuments(baseFilter),
//         CashRequest.countDocuments(pendingFilter),
//         CashRequest.countDocuments({ ...baseFilter, status: 'approved' }),
//         CashRequest.countDocuments({ ...baseFilter, status: 'disbursed' }),
//         CashRequest.countDocuments({ ...baseFilter, status: 'completed' }),
//         CashRequest.countDocuments({ ...baseFilter, status: 'denied' })
//       ]);
      
//       const stats = {
//         total,
//         pending,
//         approved,
//         disbursed,
//         completed,
//         denied
//       };
      
//       console.log('Stats calculated:', stats);
      
//       res.json({
//         success: true,
//         data: stats
//       });
      
//     } catch (error) {
//       console.error('Dashboard stats error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch dashboard stats',
//         error: error.message
//       });
//     }
//   }
// );

// // Delete cash request (only if pending and no approvals)
// // router.delete(
// //   '/:requestId',
// //   authMiddleware,
// //   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
// //   async (req, res) => {
// //     try {
// //       const { requestId } = req.params;
// //       const request = await CashRequest.findById(requestId)
// //         .populate('employee', 'fullName email');

// //       if (!request) {
// //         return res.status(404).json({
// //           success: false,
// //           message: 'Request not found'
// //         });
// //       }

// //       // Only owner can delete
// //       if (!request.employee._id.equals(req.user.userId)) {
// //         return res.status(403).json({
// //           success: false,
// //           message: 'Only the request owner can delete it'
// //         });
// //       }

// //       // STRICT: Must be pending_supervisor
// //       if (request.status !== 'pending_supervisor') {
// //         return res.status(400).json({
// //           success: false,
// //           message: 'Cannot delete request after approval process has started. Only pending_supervisor requests can be deleted.',
// //           currentStatus: request.status
// //         });
// //       }

// //       // STRICT: First approver must not have acted
// //       const firstStep = request.approvalChain?.[0];
// //       if (!firstStep || firstStep.status !== 'pending') {
// //         return res.status(400).json({
// //           success: false,
// //           message: 'Cannot delete request - approval process has already started. Once any approver takes action, deletion is no longer possible.'
// //         });
// //       }

// //       // ADDITIONAL CHECK: Verify no other steps have been touched
// //       const anyApprovalTaken = request.approvalChain.some(step => 
// //         step.status !== 'pending'
// //       );

// //       if (anyApprovalTaken) {
// //         return res.status(400).json({
// //           success: false,
// //           message: 'Cannot delete request - approvals have been recorded'
// //         });
// //       }

// //       // Delete associated files
// //       if (request.attachments && request.attachments.length > 0) {
// //         await deleteFiles(request.attachments);
// //       }

// //       // Delete request
// //       await request.deleteOne();

// //       console.log(`✓ Request ${requestId} deleted by ${request.employee.email}`);

// //       res.json({
// //         success: true,
// //         message: 'Request deleted successfully'
// //       });

// //     } catch (error) {
// //       console.error('Delete request error:', error);
// //       res.status(500).json({
// //         success: false,
// //         message: 'Failed to delete request',
// //         error: error.message
// //       });
// //     }
// //   }
// // );


// /**
//  * @route   DELETE /api/cash-requests/:id
//  * @desc    Delete a cash request (only if pending with no approvals)
//  * @access  Private (Employee)
//  */
// router.delete('/:id', authMiddleware, async (req, res) => {
//   try {
//     const { id } = req.params;

//     console.log('\n=== DELETE REQUEST ===');
//     console.log('Request ID:', id);
//     console.log('User ID:', req.user._id);

//     // Find the request
//     const request = await CashRequest.findById(id);

//     if (!request) {
//       return res.status(404).json({
//         success: false,
//         message: 'Request not found or already deleted'
//       });
//     }

//     console.log('Found request:', {
//       id: request._id,
//       status: request.status,
//       employee: request.employee
//     });

//     // Verify ownership
//     if (request.employee.toString() !== req.user._id.toString()) {
//       return res.status(403).json({
//         success: false,
//         message: 'You can only delete your own requests'
//       });
//     }

//     // STRICT deletion rules
//     // Only allow deletion if:
//     // 1. Status is pending_supervisor AND
//     // 2. First approver hasn't taken any action yet
    
//     if (request.status !== 'pending_supervisor') {
//       return res.status(400).json({
//         success: false,
//         message: 'Can only delete requests that are pending first approval',
//         details: `Current status: ${request.status}`
//       });
//     }

//     // Check if ANY approver has taken action
//     const hasApproverAction = request.approvalChain.some(step => 
//       step.status !== 'pending'
//     );

//     if (hasApproverAction) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot delete - approval process has already started',
//         details: 'At least one approver has taken action on this request'
//       });
//     }

//     // Check first approver specifically
//     const firstApprover = request.approvalChain[0];
//     if (!firstApprover || firstApprover.status !== 'pending') {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot delete - first approver has already reviewed this request'
//       });
//     }

//     // All checks passed - delete the request
//     await CashRequest.findByIdAndDelete(id);

//     console.log('✅ Request deleted successfully');

//     return res.status(200).json({
//       success: true,
//       message: 'Request deleted successfully',
//       data: {
//         deletedId: id,
//         displayId: request.displayId
//       }
//     });

//   } catch (error) {
//     console.error('Delete request error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to delete request',
//       error: error.message
//     });
//   }
// });



// // Edit cash request
// router.put(
//   '/:requestId/edit',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   upload.array('attachments', 10),
//   handleMulterError,
//   validateFiles,
//   cashRequestController.editCashRequest,
//   cleanupTempFiles
// );

// // Get edit history
// router.get(
//   '/:requestId/edit-history',
//   authMiddleware,
//   async (req, res) => {
//     try {
//       const { requestId } = req.params;
//       const request = await CashRequest.findById(requestId)
//         .populate('editHistory.editedBy', 'fullName email')
//         .select('editHistory totalEdits isEdited originalValues');

//       if (!request) {
//         return res.status(404).json({
//           success: false,
//           message: 'Request not found'
//         });
//       }

//       res.json({
//         success: true,
//         data: {
//           isEdited: request.isEdited,
//           totalEdits: request.totalEdits,
//           editHistory: request.editHistory || [],
//           originalValues: request.originalValues
//         }
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch edit history',
//         error: error.message
//       });
//     }
//   }
// );

// // ============================================
// // APPROVAL CHAIN PREVIEW (before generic routes)
// // ============================================
// router.post(
//   '/approval-chain-preview',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getApprovalChainPreview
// );

// router.get(
//   '/dashboard/stats',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getDashboardStats
// );

// router.get(
//   '/check-pending',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.checkPendingRequests
// );

// // ============================================
// // EMPLOYEE ROUTES
// // ============================================

// // Get employee's own requests
// router.get(
//   '/employee',
//   authMiddleware,
//   cashRequestController.getEmployeeRequests
// );

// // Get request for justification submission
// router.get(
//   '/employee/:requestId/justification',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getRequestForJustification
// );

// // Get single request details (employee's own)
// router.get(
//   '/employee/:requestId',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getEmployeeRequest
// );

// // Get supervisor justifications
// router.get(
//   '/supervisor/justifications',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getSupervisorJustifications
// );

// // Get supervisor's pending approvals (NEW - to handle the "pending" path)
// router.get(
//   '/supervisor/pending',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getSupervisorRequests
// );

// // Get single justification for supervisor review
// router.get(
//   '/supervisor/justification/:requestId',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getSupervisorJustification
// );

// // Process supervisor justification decision
// router.put(
//   '/justification/:requestId/decision',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.processJustificationDecision
// );

// // Process supervisor approval/denial decision
// router.put(
//   '/:requestId/supervisor',
//   authMiddleware,
//   cashRequestController.processSupervisorDecision
// );

// // Get supervisor's team requests (general)
// router.get(
//   '/supervisor',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getSupervisorRequests
// );

// // Process supervisor approval/denial decision (for cash requests)
// router.put(
//   '/supervisor/:requestId',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.processSupervisorDecision
// );

// // Get single request for supervisor approval - MUST BE LAST IN SUPERVISOR SECTION
// router.get(
//   '/supervisor/:requestId',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getSupervisorRequest
// );

// // ============================================
// // FINANCE ROUTES (SPECIFIC PATHS FIRST)
// // ============================================

// // Get finance justifications
// router.get(
//   '/finance/justifications',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.getFinanceJustifications
// );

// // Process finance justification decision
// router.put(
//   '/finance/justification/:requestId',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.processFinanceJustificationDecision
// );

// // Get finance requests (pending approval and disbursement)
// router.get(
//   '/finance',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.getFinanceRequests
// );

// // Process finance approval/denial with budget allocation
// router.put(
//   '/finance/:requestId',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.processFinanceDecision
// );

// router.put(
//   '/:requestId/finance',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.processFinanceDecision
// );

// // Disbursement routes
// router.post(
//   '/:requestId/disburse',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.processDisbursement
// );

// router.get(
//   '/:requestId/disbursements',
//   authMiddleware,
//   requireRoles('finance', 'admin', 'employee'),
//   cashRequestController.getDisbursementHistory
// );

// router.get(
//   '/finance/pending-disbursements',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.getPendingDisbursements
// );

// // Export routes
// router.get(
//   '/export',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.exportCashRequests
// );

// // ============================================
// // JUSTIFICATION ROUTES
// // ============================================

// // // Process justification decision (generic)
// // router.post(
// //   '/justification/:requestId/decision',
// //   authMiddleware,
// //   cashRequestController.processJustificationDecision
// // );

// // Process justification decision (generic)
// router.put(
//   '/justification/:requestId/decision',
//   authMiddleware,
//   cashRequestController.processJustificationDecision
// );

// // Get supervisor justifications pending (alternative path)
// router.get(
//   '/justifications/supervisor/pending',
//   authMiddleware,
//   cashRequestController.getSupervisorJustifications
// );



// // ============================================
// // ADMIN ROUTES (SPECIFIC PATHS FIRST)
// // ============================================

// // Get detailed request info (admin)
// router.get(
//   '/admin/:requestId',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.getAdminRequestDetails
// );

// // Get all cash requests (admin oversight)
// router.get(
//   '/admin',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.getAllRequests
// );

// // ============================================
// // CREATE REQUEST (POST - before generic GET routes)
// // ============================================

// router.post(
//   '/',
//   authMiddleware,
//   (req, res, next) => {
//     console.log('\n=== CASH REQUEST UPLOAD INITIATED ===');
//     console.log('User:', req.user?.userId);
//     console.log('Content-Type:', req.headers['content-type']);
//     next();
//   },
//   upload.array('attachments', 10),
//   handleMulterError,
//   validateFiles,
//   (req, res, next) => {
//     console.log('Files uploaded successfully:');
//     if (req.files) {
//       req.files.forEach(file => {
//         console.log(`  - ${file.originalname} (${file.size} bytes) at ${file.path}`);
//       });
//     }
//     next();
//   },
//   cashRequestController.createRequest,
//   cleanupTempFiles
// );

// // ============================================
// // SUBMIT JUSTIFICATION (POST with files)
// // ============================================

// router.post(
//   '/:requestId/justification',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   (req, res, next) => {
//     console.log('=== JUSTIFICATION UPLOAD MIDDLEWARE ===');
//     console.log('Request ID:', req.params.requestId);
//     console.log('Content-Type:', req.headers['content-type']);
//     console.log('Request has files:', !!req.files);
//     console.log('User:', req.user?.userId);
//     next();
//   },
//   // ✅ Accept files from multiple possible field names
//   upload.fields([
//     { name: 'documents', maxCount: 10 },
//     { name: 'attachments', maxCount: 10 },
//     { name: 'justificationDocuments', maxCount: 10 }
//   ]),
//   // ✅ Normalize file fields into a single array
//   (req, res, next) => {
//     if (req.files) {
//       const allFiles = [];
      
//       // Collect files from all possible fields
//       if (req.files.documents) {
//         console.log(`Found ${req.files.documents.length} files in 'documents'`);
//         allFiles.push(...req.files.documents);
//       }
//       if (req.files.attachments) {
//         console.log(`Found ${req.files.attachments.length} files in 'attachments'`);
//         allFiles.push(...req.files.attachments);
//       }
//       if (req.files.justificationDocuments) {
//         console.log(`Found ${req.files.justificationDocuments.length} files in 'justificationDocuments'`);
//         allFiles.push(...req.files.justificationDocuments);
//       }
      
//       // Convert to simple array for downstream processing
//       req.files = allFiles;
//       console.log(`Normalized ${allFiles.length} total files for justification`);
//     } else {
//       console.log('⚠️ No files detected in request');
//     }
//     next();
//   },
//   handleMulterError,
//   validateFiles,
//   (req, res, next) => {
//     console.log('Files after validation:', req.files?.length || 0);
//     if (req.files && req.files.length > 0) {
//       console.log('Justification documents:');
//       req.files.forEach(file => {
//         console.log(`  - ${file.originalname} (${file.size} bytes)`);
//       });
//     }
//     next();
//   },
//   cashRequestController.submitJustification,
//   cleanupTempFiles
// );

// // ============================================
// // GENERIC ROUTES (MUST BE ABSOLUTELY LAST)
// // ============================================

// // Get single request by ID - THIS MUST BE THE LAST ROUTE
// router.get(
//   '/:requestId',
//   authMiddleware,
//   async (req, res, next) => {
//     try {
//       const { requestId } = req.params;
      
//       // Validate ObjectId format before querying
//       if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid request ID format'
//         });
//       }
      
//       const CashRequest = require('../models/CashRequest');
//       const User = require('../models/User');

//       console.log(`\n=== GET REQUEST DETAILS ===`);
//       console.log(`Request ID: ${requestId}`);
//       console.log(`User: ${req.user.userId} (${req.user.role})`);

//       const request = await CashRequest.findById(requestId)
//         .populate('employee', 'fullName email department position')
//         .populate('projectId', 'name code')
//         .populate('budgetAllocation.budgetCodeId', 'code name');

//       if (!request) {
//         console.log('❌ Request not found');
//         return res.status(404).json({
//           success: false,
//           message: 'Request not found'
//         });
//       }

//       const user = await User.findById(req.user.userId);

//       // Check if user has permission to view this request
//       const isOwner = request.employee._id.equals(req.user.userId);
//       const isApprover = request.approvalChain.some(step => 
//         step.approver.email === user.email
//       );
//       const isAdmin = user.role === 'admin';
//       const isFinance = user.role === 'finance';

//       if (!isOwner && !isApprover && !isAdmin && !isFinance) {
//         console.log('❌ Access denied');
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       console.log('✅ Request found and access granted');
//       console.log(`Status: ${request.status}`);

//       res.json({
//         success: true,
//         data: request
//       });

//     } catch (error) {
//       console.error('Get request details error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch request details',
//         error: error.message
//       });
//     }
//   }
// );

// router.get(
//   '/:requestId/pdf',
//   authMiddleware,
//   cashRequestController.generateCashRequestPDF
// );

// // ============================================
// // ERROR HANDLING MIDDLEWARE (MUST BE LAST)
// // ============================================

// router.use((error, req, res, next) => {
//   console.error('Cash request route error:', error);
  
//   if (req.files) {
//     const { cleanupFiles } = require('../middlewares/uploadMiddleware');
//     cleanupFiles(req.files);
//   }
  
//   res.status(500).json({
//     success: false,
//     message: error.message || 'Internal server error',
//     error: process.env.NODE_ENV === 'development' ? error.stack : undefined
//   });
// });

// // Reimbursement routes
// // router.post(
// //   '/reimbursement',
// //   authMiddleware,
// //   requireRoles('employee', 'supervisor', 'admin', 'finance', 'it', 'hr', 'supply_chain'),
// //   upload.array('receiptDocuments', 10),
// //   handleMulterError,
// //   validateFiles,
// //   cashRequestController.createReimbursementRequest,
// //   cleanupTempFiles
// // );

// // Create reimbursement request - CRITICAL: Accept multiple possible field names
// router.post(
//   '/reimbursement',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   (req, res, next) => {
//     console.log('\n=== REIMBURSEMENT REQUEST UPLOAD INITIATED ===');
//     console.log('User:', req.user?.userId);
//     console.log('Content-Type:', req.headers['content-type']);
//     console.log('Raw body keys:', Object.keys(req.body));
//     console.log('Has files object:', !!req.files);
//     next();
//   },
//   // FIXED: Accept files from multiple possible field names
//   upload.fields([
//     { name: 'receiptDocuments', maxCount: 10 },
//     { name: 'attachments', maxCount: 10 },
//     { name: 'documents', maxCount: 10 }
//   ]),
//   // Normalize file fields into a single array
//   (req, res, next) => {
//     if (req.files) {
//       const allFiles = [];
      
//       // Collect files from all possible fields
//       if (req.files.receiptDocuments) {
//         console.log(`Found ${req.files.receiptDocuments.length} files in 'receiptDocuments'`);
//         allFiles.push(...req.files.receiptDocuments);
//       }
//       if (req.files.attachments) {
//         console.log(`Found ${req.files.attachments.length} files in 'attachments'`);
//         allFiles.push(...req.files.attachments);
//       }
//       if (req.files.documents) {
//         console.log(`Found ${req.files.documents.length} files in 'documents'`);
//         allFiles.push(...req.files.documents);
//       }
      
//       // Convert to simple array for downstream processing
//       req.files = allFiles;
//       console.log(`Normalized ${allFiles.length} total files for reimbursement`);
//     } else {
//       console.log('⚠️ No files detected in request');
//     }
//     next();
//   },
//   handleMulterError,
//   validateFiles,
//   (req, res, next) => {
//     console.log('Files after validation:', req.files?.length || 0);
//     if (req.files && req.files.length > 0) {
//       console.log('Receipt documents:');
//       req.files.forEach(file => {
//         console.log(`  - ${file.originalname} (${file.size} bytes)`);
//       });
//     }
//     next();
//   },
//   cashRequestController.createReimbursementRequest,
//   cleanupTempFiles
// );

// // Add this route to serve justification documents
// router.get('/justification-document/:requestId/:filename', protect, async (req, res) => {
//   try {
//     const { requestId, filename } = req.params;
    
//     // Find the request
//     const request = await CashRequest.findById(requestId);
    
//     if (!request) {
//       return res.status(404).json({
//         success: false,
//         message: 'Request not found'
//       });
//     }
    
//     // Check if user has permission to view this document
//     const canView = 
//       req.user._id.toString() === request.employee.toString() ||
//       req.user.role === 'admin' ||
//       req.user.role === 'finance' ||
//       req.user.role === 'supervisor';
    
//     if (!canView) {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to view this document'
//       });
//     }
    
//     // Find the document in the justification
//     const doc = request.justification?.documents?.find(d => d.name === filename);
    
//     if (!doc) {
//       return res.status(404).json({
//         success: false,
//         message: 'Document not found'
//       });
//     }
    
//     // Serve the file
//     const filePath = path.join(__dirname, '..', doc.localPath || doc.url);
    
//     if (!fs.existsSync(filePath)) {
//       return res.status(404).json({
//         success: false,
//         message: 'File not found on server'
//       });
//     }
    
//     res.sendFile(filePath);
    
//   } catch (error) {
//     console.error('Error serving document:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error retrieving document'
//     });
//   }
// });

// router.get(
//   '/reimbursement/limit-status',
//   authMiddleware,
//   requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
//   cashRequestController.getReimbursementLimitStatus
// );

// router.get(
//   '/reports/analytics',
//   authMiddleware,
//   requireRoles('finance', 'admin'),
//   cashRequestController.getFinanceReportsData
// );


// module.exports = router;






const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const cashRequestController = require('../controllers/cashRequestController');
const CashRequest = require('../models/CashRequest');

// Import error handlers from upload middleware
const { handleMulterError, cleanupTempFiles, validateFiles } = require('../middlewares/uploadMiddleware');

// ============================================
// STATIC PATH ROUTES (MUST BE FIRST - NO PARAMETERS)
// ============================================

// Dashboard stats
router.get(
  '/dashboard-stats',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  async (req, res) => {
    try {
      const CashRequest = require('../models/CashRequest');
      const User = require('../models/User');
      
      const user = await User.findById(req.user.userId);
      console.log(`=== DASHBOARD STATS for ${user.role}: ${user.email} ===`);
      
      let baseFilter = {};
      let pendingFilter = {};
      
      if (user.role === 'employee') {
        baseFilter = { employee: req.user.userId };
        pendingFilter = {
          employee: req.user.userId,
          status: { $regex: /pending/ }
        };
      } else if (user.role === 'supervisor') {
        baseFilter = {
          'approvalChain': {
            $elemMatch: {
              'approver.email': user.email
            }
          }
        };
        pendingFilter = {
          'approvalChain': {
            $elemMatch: {
              'approver.email': user.email,
              'status': 'pending'
            }
          }
        };
      } else if (user.role === 'finance') {
        baseFilter = {
          $or: [
            { status: { $regex: /pending_finance/ } },
            { status: 'approved' },
            { status: 'disbursed' },
            { status: 'completed' },
            {
              'approvalChain': {
                $elemMatch: {
                  'approver.role': 'Finance Officer'
                }
              }
            }
          ]
        };
        pendingFilter = {
          $or: [
            { status: { $regex: /pending_finance/ } },
            {
              'approvalChain': {
                $elemMatch: {
                  'approver.email': user.email,
                  'approver.role': 'Finance Officer',
                  'status': 'pending'
                }
              }
            }
          ]
        };
      } else if (user.role === 'admin') {
        baseFilter = {};
        pendingFilter = {
          status: { $regex: /pending/ }
        };
      }
      
      console.log('Base filter:', JSON.stringify(baseFilter, null, 2));
      console.log('Pending filter:', JSON.stringify(pendingFilter, null, 2));
      
      const [total, pending, approved, disbursed, completed, denied] = await Promise.all([
        CashRequest.countDocuments(baseFilter),
        CashRequest.countDocuments(pendingFilter),
        CashRequest.countDocuments({ ...baseFilter, status: 'approved' }),
        CashRequest.countDocuments({ ...baseFilter, status: 'disbursed' }),
        CashRequest.countDocuments({ ...baseFilter, status: 'completed' }),
        CashRequest.countDocuments({ ...baseFilter, status: 'denied' })
      ]);
      
      const stats = {
        total,
        pending,
        approved,
        disbursed,
        completed,
        denied
      };
      
      console.log('Stats calculated:', stats);
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard stats',
        error: error.message
      });
    }
  }
);

router.get(
  '/dashboard/stats',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getDashboardStats
);

router.get(
  '/check-pending',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.checkPendingRequests
);

router.post(
  '/approval-chain-preview',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getApprovalChainPreview
);

router.get(
  '/export',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.exportCashRequests
);

router.get(
  '/reports/analytics',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceReportsData
);

router.get(
  '/justifications/supervisor/pending',
  authMiddleware,
  cashRequestController.getSupervisorJustifications
);

router.get(
  '/reimbursement/limit-status',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getReimbursementLimitStatus
);

// ============================================
// MULTI-SEGMENT ROUTES WITH PARAMETERS (BEFORE SINGLE-SEGMENT ROUTES)
// ============================================

// CRITICAL: This must come before /employee, /finance, /supervisor routes
// router.get(
//   '/justification-document/:requestId/:filename',
//   authMiddleware,
//   async (req, res) => {
//     try {
//       const { requestId, filename } = req.params;
      
//       console.log('\n=== SERVING JUSTIFICATION DOCUMENT ===');
//       console.log('Request ID:', requestId);
//       console.log('Filename:', filename);
//       console.log('User:', req.user.userId);
      
//       // Validate ObjectId format
//       if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid request ID format'
//         });
//       }
      
//       // Find the request
//       const request = await CashRequest.findById(requestId).populate('employee', '_id');
      
//       if (!request) {
//         console.log('❌ Request not found');
//         return res.status(404).json({
//           success: false,
//           message: 'Request not found'
//         });
//       }
      
//       // Check if user has permission to view this document
//       const canView = 
//         request.employee._id.toString() === req.user.userId.toString() ||
//         req.user.role === 'admin' ||
//         req.user.role === 'finance' ||
//         req.user.role === 'supervisor';
      
//       if (!canView) {
//         console.log('❌ Access denied');
//         return res.status(403).json({
//           success: false,
//           message: 'Not authorized to view this document'
//         });
//       }
      
//       // Find the document in the justification
//       const doc = request.justification?.documents?.find(d => d.name === filename);
      
//       if (!doc) {
//         console.log('❌ Document not found in request');
//         console.log('Available documents:', request.justification?.documents?.map(d => d.name));
//         return res.status(404).json({
//           success: false,
//           message: 'Document not found'
//         });
//       }
      
//       // Serve the file
//       const filePath = path.join(__dirname, '..', doc.localPath || doc.url);
      
//       console.log('File path:', filePath);
//       console.log('File exists:', fs.existsSync(filePath));
      
//       if (!fs.existsSync(filePath)) {
//         console.log('❌ File not found on server');
//         return res.status(404).json({
//           success: false,
//           message: 'File not found on server',
//           path: filePath
//         });
//       }
      
//       console.log('✅ Serving file');
//       res.sendFile(filePath);
      
//     } catch (error) {
//       console.error('Error serving document:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Error retrieving document',
//         error: error.message
//       });
//     }
//   }
// );


function findFileRecursive(directory, filename) {
  if (!fs.existsSync(directory)) return null;
  
  try {
    const items = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(directory, item.name);
      
      if (item.isDirectory()) {
        const found = findFileRecursive(fullPath, filename);
        if (found) return found;
      } else if (item.name === filename) {
        return fullPath;
      }
    }
  } catch (error) {
    console.error(`Error searching ${directory}:`, error.message);
  }
  
  return null;
}


router.get(
  '/justification-document/:requestId/:filename',
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId, filename } = req.params;
      
      console.log('\n=== SERVING JUSTIFICATION DOCUMENT ===');
      console.log('Request ID:', requestId);
      console.log('Requested filename:', filename);
      console.log('User:', req.user.userId);
      console.log('Platform:', process.platform);
      
      // Validate ObjectId format
      if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request ID format'
        });
      }
      
      // Find the request
      const request = await CashRequest.findById(requestId).populate('employee', '_id');
      
      if (!request) {
        console.log('❌ Request not found');
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }
      
      // Check if user has permission
      const canView = 
        request.employee._id.toString() === req.user.userId.toString() ||
        req.user.role === 'admin' ||
        req.user.role === 'finance' ||
        req.user.role === 'supervisor';
      
      if (!canView) {
        console.log('❌ Access denied');
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this document'
        });
      }
      
      // Decode filename
      const decodedFilename = decodeURIComponent(filename);
      console.log('Decoded filename:', decodedFilename);
      
      // Find document by name, publicId, or path basename
      const doc = request.justification?.documents?.find(d => {
        if (d.name === decodedFilename) return true;
        if (d.publicId === decodedFilename) return true;
        
        if (d.localPath) {
          const pathFilename = path.basename(d.localPath);
          if (pathFilename === decodedFilename) return true;
        }
        
        return false;
      });
      
      if (!doc) {
        console.log('❌ Document not found in request');
        console.log('Available documents:', request.justification?.documents?.map(d => ({
          name: d.name,
          publicId: d.publicId
        })));
        
        return res.status(404).json({
          success: false,
          message: 'Document not found in request',
          availableDocuments: request.justification?.documents?.map(d => d.name)
        });
      }
      
      console.log('✅ Document found:');
      console.log('   Name:', doc.name);
      console.log('   Public ID:', doc.publicId);
      console.log('   Local Path:', doc.localPath);
      
      // ✅ BUILD CORRECT PATH FOR CURRENT ENVIRONMENT
      let filePath = null;
      
      // Strategy 1: Use stored localPath if it exists
      if (doc.localPath && fs.existsSync(doc.localPath)) {
        console.log('✅ Using stored localPath');
        filePath = doc.localPath;
      } 
      // Strategy 2: Build path from publicId
      else {
        console.log('⚠️  Stored path not found, building from publicId');
        
        // Get absolute path to uploads directory
        const uploadsDir = path.resolve(__dirname, '../uploads/justifications');
        const builtPath = path.join(uploadsDir, doc.publicId);
        
        console.log('   Uploads dir:', uploadsDir);
        console.log('   Built path:', builtPath);
        console.log('   File exists:', fs.existsSync(builtPath));
        
        if (fs.existsSync(builtPath)) {
          console.log('✅ Found file at built path');
          filePath = builtPath;
          
          // Update database with correct path
          doc.localPath = builtPath;
          await request.save();
          console.log('   Updated database with correct path');
        }
      }
      
      // Strategy 3: Try alternative uploads locations
      if (!filePath || !fs.existsSync(filePath)) {
        console.log('⚠️  Trying alternative locations...');
        
        const alternativePaths = [
          // Try without 'justifications' subfolder
          path.resolve(__dirname, '../uploads', doc.publicId),
          
          // Try with 'justifications' subfolder
          path.resolve(__dirname, '../uploads/justifications', doc.publicId),
          
          // Try project root uploads
          path.resolve(process.cwd(), 'uploads/justifications', doc.publicId),
          path.resolve(process.cwd(), 'uploads', doc.publicId),
          
          // Try src/uploads (Render might use this)
          path.resolve(process.cwd(), 'src/uploads/justifications', doc.publicId),
          path.resolve(process.cwd(), 'src/uploads', doc.publicId)
        ];
        
        for (const altPath of alternativePaths) {
          console.log('   Checking:', altPath);
          if (fs.existsSync(altPath)) {
            console.log('   ✅ Found!');
            filePath = altPath;
            
            // Update database
            doc.localPath = altPath;
            await request.save();
            break;
          }
        }
      }
      
      // Strategy 4: Last resort - recursive search
      if (!filePath || !fs.existsSync(filePath)) {
        console.log('⚠️  Last resort: Recursive search...');
        
        const searchRoots = [
          path.resolve(__dirname, '../uploads'),
          path.resolve(process.cwd(), 'uploads'),
          path.resolve(process.cwd(), 'src/uploads')
        ];
        
        for (const root of searchRoots) {
          if (fs.existsSync(root)) {
            console.log('   Searching in:', root);
            const found = findFileRecursive(root, doc.publicId);
            
            if (found) {
              console.log('   ✅ Found at:', found);
              filePath = found;
              
              // Update database
              doc.localPath = found;
              await request.save();
              break;
            }
          }
        }
      }
      
      // Final check
      if (!filePath || !fs.existsSync(filePath)) {
        console.log('❌ File not found anywhere');
        console.log('   Searched locations:');
        console.log('   - Stored path:', doc.localPath);
        console.log('   - __dirname:', __dirname);
        console.log('   - process.cwd():', process.cwd());
        
        // List what's actually in the justifications folder
        const justificationsDir = path.resolve(__dirname, '../uploads/justifications');
        console.log('   Justifications dir:', justificationsDir);
        
        if (fs.existsSync(justificationsDir)) {
          try {
            const files = fs.readdirSync(justificationsDir);
            console.log('   Files in justifications folder:', files.slice(0, 10));
          } catch (err) {
            console.log('   Could not list files:', err.message);
          }
        } else {
          console.log('   Justifications directory does not exist!');
        }
        
        return res.status(404).json({
          success: false,
          message: 'File not found on server',
          details: {
            requestedFilename: decodedFilename,
            storedName: doc.name,
            publicId: doc.publicId,
            storedPath: doc.localPath,
            platform: process.platform,
            cwd: process.cwd(),
            dirname: __dirname
          }
        });
      }
      
      console.log('📂 Final file path:', filePath);
      console.log('✅ Serving file');
      
      // Set proper headers
      res.setHeader('Content-Type', doc.mimetype || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
      
      // Use streaming for better performance
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('❌ Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error streaming file',
            error: error.message
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Error serving document:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving document',
        error: error.message
      });
    }
  }
);

// ============================================
// EMPLOYEE ROUTES (ALL /employee/* paths)
// ============================================
router.get(
  '/employee',
  authMiddleware,
  cashRequestController.getEmployeeRequests
);

router.get(
  '/employee/:requestId/justification',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getRequestForJustification
);

router.get(
  '/employee/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getEmployeeRequest
);

// ============================================
// SUPERVISOR ROUTES (ALL /supervisor/* paths)
// ============================================
router.get(
  '/supervisor/justifications',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorJustifications
);

router.get(
  '/supervisor/pending',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorRequests
);

router.get(
  '/supervisor/justification/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorJustification
);

router.get(
  '/supervisor/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorRequest
);

router.get(
  '/supervisor',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.getSupervisorRequests
);

router.put(
  '/supervisor/:requestId',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.processSupervisorDecision
);

// ============================================
// FINANCE ROUTES (ALL /finance/* paths)
// ============================================
router.get(
  '/finance/justifications',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceJustifications
);

router.get(
  '/finance/pending-disbursements',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getPendingDisbursements
);

router.put(
  '/finance/justification/:requestId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceJustificationDecision
);

router.put(
  '/finance/:requestId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceDecision
);

router.get(
  '/finance',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getFinanceRequests
);

// ============================================
// ADMIN ROUTES (ALL /admin/* paths)
// ============================================
router.get(
  '/admin/:requestId',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getAdminRequestDetails
);

router.get(
  '/admin',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.getAllRequests
);

// ============================================
// REIMBURSEMENT ROUTES
// ============================================
router.post(
  '/reimbursement',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  (req, res, next) => {
    console.log('\n=== REIMBURSEMENT REQUEST UPLOAD INITIATED ===');
    console.log('User:', req.user?.userId);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw body keys:', Object.keys(req.body));
    console.log('Has files object:', !!req.files);
    next();
  },
  upload.fields([
    { name: 'receiptDocuments', maxCount: 10 },
    { name: 'attachments', maxCount: 10 },
    { name: 'documents', maxCount: 10 }
  ]),
  (req, res, next) => {
    if (req.files) {
      const allFiles = [];
      
      if (req.files.receiptDocuments) {
        console.log(`Found ${req.files.receiptDocuments.length} files in 'receiptDocuments'`);
        allFiles.push(...req.files.receiptDocuments);
      }
      if (req.files.attachments) {
        console.log(`Found ${req.files.attachments.length} files in 'attachments'`);
        allFiles.push(...req.files.attachments);
      }
      if (req.files.documents) {
        console.log(`Found ${req.files.documents.length} files in 'documents'`);
        allFiles.push(...req.files.documents);
      }
      
      req.files = allFiles;
      console.log(`Normalized ${allFiles.length} total files for reimbursement`);
    } else {
      console.log('⚠️ No files detected in request');
    }
    next();
  },
  handleMulterError,
  validateFiles,
  (req, res, next) => {
    console.log('Files after validation:', req.files?.length || 0);
    if (req.files && req.files.length > 0) {
      console.log('Receipt documents:');
      req.files.forEach(file => {
        console.log(`  - ${file.originalname} (${file.size} bytes)`);
      });
    }
    next();
  },
  cashRequestController.createReimbursementRequest,
  cleanupTempFiles
);

// ============================================
// CREATE REQUEST (POST)
// ============================================
router.post(
  '/',
  authMiddleware,
  (req, res, next) => {
    console.log('\n=== CASH REQUEST UPLOAD INITIATED ===');
    console.log('User:', req.user?.userId);
    console.log('Content-Type:', req.headers['content-type']);
    next();
  },
  upload.array('attachments', 10),
  handleMulterError,
  validateFiles,
  (req, res, next) => {
    console.log('Files uploaded successfully:');
    if (req.files) {
      req.files.forEach(file => {
        console.log(`  - ${file.originalname} (${file.size} bytes) at ${file.path}`);
      });
    }
    next();
  },
  cashRequestController.createRequest,
  cleanupTempFiles
);

// ============================================
// ROUTES WITH :requestId PARAMETER (BEFORE GENERIC /:requestId)
// ============================================

// Submit justification
router.post(
  '/:requestId/justification',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  (req, res, next) => {
    console.log('=== JUSTIFICATION UPLOAD MIDDLEWARE ===');
    console.log('Request ID:', req.params.requestId);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request has files:', !!req.files);
    console.log('User:', req.user?.userId);
    next();
  },
  upload.fields([
    { name: 'documents', maxCount: 10 },
    { name: 'attachments', maxCount: 10 },
    { name: 'justificationDocuments', maxCount: 10 }
  ]),
  (req, res, next) => {
    if (req.files) {
      const allFiles = [];
      
      if (req.files.documents) {
        console.log(`Found ${req.files.documents.length} files in 'documents'`);
        allFiles.push(...req.files.documents);
      }
      if (req.files.attachments) {
        console.log(`Found ${req.files.attachments.length} files in 'attachments'`);
        allFiles.push(...req.files.attachments);
      }
      if (req.files.justificationDocuments) {
        console.log(`Found ${req.files.justificationDocuments.length} files in 'justificationDocuments'`);
        allFiles.push(...req.files.justificationDocuments);
      }
      
      req.files = allFiles;
      console.log(`Normalized ${allFiles.length} total files for justification`);
    } else {
      console.log('⚠️ No files detected in request');
    }
    next();
  },
  handleMulterError,
  validateFiles,
  (req, res, next) => {
    console.log('Files after validation:', req.files?.length || 0);
    if (req.files && req.files.length > 0) {
      console.log('Justification documents:');
      req.files.forEach(file => {
        console.log(`  - ${file.originalname} (${file.size} bytes)`);
      });
    }
    next();
  },
  cashRequestController.submitJustification,
  cleanupTempFiles
);

// Justification decision
router.put(
  '/justification/:requestId/decision',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  cashRequestController.processJustificationDecision
);

// Disbursement routes
router.post(
  '/:requestId/disburse',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processDisbursement
);

router.get(
  '/:requestId/disbursements',
  authMiddleware,
  requireRoles('finance', 'admin', 'employee'),
  cashRequestController.getDisbursementHistory
);

// Edit routes
router.put(
  '/:requestId/edit',
  authMiddleware,
  requireRoles('employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it', 'project'),
  upload.array('attachments', 10),
  handleMulterError,
  validateFiles,
  cashRequestController.editCashRequest,
  cleanupTempFiles
);

router.get(
  '/:requestId/edit-history',
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const request = await CashRequest.findById(requestId)
        .populate('editHistory.editedBy', 'fullName email')
        .select('editHistory totalEdits isEdited originalValues');

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      res.json({
        success: true,
        data: {
          isEdited: request.isEdited,
          totalEdits: request.totalEdits,
          editHistory: request.editHistory || [],
          originalValues: request.originalValues
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch edit history',
        error: error.message
      });
    }
  }
);

// PDF generation
router.get(
  '/:requestId/pdf',
  authMiddleware,
  cashRequestController.generateCashRequestPDF
);

// Supervisor decision
router.put(
  '/:requestId/supervisor',
  authMiddleware,
  cashRequestController.processSupervisorDecision
);

// Finance decision
router.put(
  '/:requestId/finance',
  authMiddleware,
  requireRoles('finance', 'admin'),
  cashRequestController.processFinanceDecision
);

// Delete request
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('\n=== DELETE REQUEST ===');
    console.log('Request ID:', id);
    console.log('User ID:', req.user.userId);

    const request = await CashRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found or already deleted'
      });
    }

    console.log('Found request:', {
      id: request._id,
      status: request.status,
      employee: request.employee
    });

    if (request.employee.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own requests'
      });
    }

    if (request.status !== 'pending_supervisor') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete requests that are pending first approval',
        details: `Current status: ${request.status}`
      });
    }

    const hasApproverAction = request.approvalChain.some(step => 
      step.status !== 'pending'
    );

    if (hasApproverAction) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete - approval process has already started',
        details: 'At least one approver has taken action on this request'
      });
    }

    const firstApprover = request.approvalChain[0];
    if (!firstApprover || firstApprover.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete - first approver has already reviewed this request'
      });
    }

    await CashRequest.findByIdAndDelete(id);

    console.log('✅ Request deleted successfully');

    return res.status(200).json({
      success: true,
      message: 'Request deleted successfully',
      data: {
        deletedId: id,
        displayId: request.displayId
      }
    });

  } catch (error) {
    console.error('Delete request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete request',
      error: error.message
    });
  }
});

// ============================================
// GENERIC /:requestId ROUTE (MUST BE ABSOLUTELY LAST)
// ============================================
router.get(
  '/:requestId',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { requestId } = req.params;
      
      console.log(`\n=== GENERIC GET REQUEST ===`);
      console.log(`Request ID: ${requestId}`);
      console.log(`User: ${req.user.userId}`);
      
      // Validate ObjectId format before querying
      if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request ID format'
        });
      }
      
      const User = require('../models/User');

      const request = await CashRequest.findById(requestId)
        .populate('employee', 'fullName email department position')
        .populate('projectId', 'name code')
        .populate('budgetAllocation.budgetCodeId', 'code name');

      if (!request) {
        console.log('❌ Request not found');
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      const user = await User.findById(req.user.userId);

      const isOwner = request.employee._id.equals(req.user.userId);
      const isApprover = request.approvalChain.some(step => 
        step.approver.email === user.email
      );
      const isAdmin = user.role === 'admin';
      const isFinance = user.role === 'finance';

      if (!isOwner && !isApprover && !isAdmin && !isFinance) {
        console.log('❌ Access denied');
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      console.log('✅ Request found and access granted');
      console.log(`Status: ${request.status}`);

      res.json({
        success: true,
        data: request
      });

    } catch (error) {
      console.error('Get request details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch request details',
        error: error.message
      });
    }
  }
);

// ============================================
// ERROR HANDLING MIDDLEWARE (MUST BE LAST)
// ============================================
router.use((error, req, res, next) => {
  console.error('Cash request route error:', error);
  
  if (req.files) {
    const { cleanupFiles } = require('../middlewares/uploadMiddleware');
    cleanupFiles(req.files);
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

module.exports = router;