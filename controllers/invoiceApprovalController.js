const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { getInvoiceApprovalChain } = require('../config/invoiceApprovalChain');

// Upload invoice with approval chain
exports.uploadInvoiceWithApprovalChain = async (req, res) => {
  try {
    console.log('=== INVOICE UPLOAD WITH APPROVAL CHAIN STARTED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Files received:', req.files ? Object.keys(req.files) : 'No files');
    console.log('User ID:', req.user.userId);

    const { poNumber, invoiceNumber } = req.body;

    // Validate required fields
    if (!poNumber || !invoiceNumber) {
      throw new Error('PO number and invoice number are required');
    }

    // Validate PO number format
    const poRegex = /^PO-\w{2}\d{10}-\d+$/i;
    if (!poRegex.test(poNumber)) {
      throw new Error('PO number format should be: PO-XX0000000000-X (e.g., PO-NG010000000-1)');
    }

    // Check for duplicate
    const existingInvoice = await Invoice.findOne({
      poNumber: poNumber.toUpperCase(),
      invoiceNumber: invoiceNumber.trim(),
      employee: req.user.userId
    });

    if (existingInvoice) {
      throw new Error('An invoice with this PO number and invoice number already exists');
    }

    // Get employee details
    const employee = await User.findById(req.user.userId).select('fullName email department position');
    if (!employee) {
      throw new Error('Employee not found');
    }

    console.log('Employee found:', employee.fullName, 'Department:', employee.department);

    // Process file uploads (same as before)
    const uploadedFiles = {};
    const { cloudinary } = require('../config/cloudinary');
    const fs = require('fs').promises;

    const uploadToCloudinary = async (file, folder) => {
      try {
        console.log(`🔄 Uploading ${file.fieldname} to Cloudinary...`);
        
        await fs.access(file.path);

        const result = await cloudinary.uploader.upload(file.path, {
          folder: `invoice-uploads/${folder}`,
          resource_type: 'auto',
          public_id: `${poNumber}-${file.fieldname}-${Date.now()}`,
          format: file.mimetype.includes('pdf') ? 'pdf' : undefined,
          use_filename: true,
          unique_filename: true
        });

        console.log(`✅ ${file.fieldname} uploaded successfully`);

        await fs.unlink(file.path).catch(err => 
          console.warn('Failed to delete temp file:', err.message)
        );

        return {
          publicId: result.public_id,
          url: result.secure_url,
          format: result.format,
          resourceType: result.resource_type,
          bytes: result.bytes,
          originalName: file.originalname
        };
      } catch (error) {
        console.error(`❌ Failed to upload ${file.fieldname}:`, error);
        await fs.unlink(file.path).catch(() => {});
        throw new Error(`Failed to upload ${file.fieldname}: ${error.message}`);
      }
    };

    const uploadPromises = [];

    if (req.files && req.files.poFile && req.files.poFile.length > 0) {
      const poFile = req.files.poFile[0];
      uploadPromises.push(
        uploadToCloudinary(poFile, 'po-files').then(result => {
          uploadedFiles.poFile = result;
        })
      );
    }

    if (req.files && req.files.invoiceFile && req.files.invoiceFile.length > 0) {
      const invoiceFile = req.files.invoiceFile[0];
      uploadPromises.push(
        uploadToCloudinary(invoiceFile, 'invoice-files').then(result => {
          uploadedFiles.invoiceFile = result;
        })
      );
    }

    if (uploadPromises.length > 0) {
      await Promise.all(uploadPromises);
      console.log('✅ All files uploaded to Cloudinary successfully');
    }

    // Generate approval chain
    const approvalChain = getInvoiceApprovalChain(employee.fullName, employee.department);

    if (!approvalChain || approvalChain.length === 0) {
      throw new Error('Failed to generate approval chain');
    }

    console.log(`✅ Generated approval chain with ${approvalChain.length} levels`);

    // Create invoice with approval chain
    const invoiceData = {
      poNumber: poNumber.toUpperCase(),
      invoiceNumber: invoiceNumber.trim(),
      employee: req.user.userId,
      employeeDetails: {
        name: employee.fullName,
        email: employee.email,
        department: employee.department,
        position: employee.position || 'Employee'
      },
      uploadedDate: new Date(),
      uploadedTime: new Date().toTimeString().split(' ')[0],
      approvalStatus: 'pending_department_approval',
      approvalChain: approvalChain.map(step => ({
        ...step,
        activatedDate: step.level === 1 ? new Date() : null,
        notificationSent: false
      })),
      currentApprovalLevel: 1,
      ...uploadedFiles
    };

    console.log('Creating invoice with approval chain...');
    const invoice = await Invoice.create(invoiceData);
    console.log('✅ Invoice created with ID:', invoice._id);

    // Send notification to first approver
    const firstApprover = approvalChain[0];
    if (firstApprover) {
      const notificationResult = await sendEmail({
        to: firstApprover.approver.email,
        subject: `🔔 New Invoice Approval Required - ${invoice.poNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
              <h2 style="color: #333; margin-top: 0;">🔔 Invoice Approval Required</h2>
              <p>Dear ${firstApprover.approver.name},</p>
              
              <p>A new invoice has been uploaded and requires your approval.</p>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">Invoice Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employee.fullName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Department:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employee.department}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>PO Number:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${invoice.poNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Invoice Number:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${invoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Your Role:</strong></td>
                    <td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #333; padding: 4px 8px; border-radius: 4px;">${firstApprover.approver.role}</span></td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/invoices" 
                   style="display: inline-block; background-color: #28a745; color: white; 
                          padding: 15px 30px; text-decoration: none; border-radius: 8px;
                          font-weight: bold; font-size: 16px;">
                  👀 Review & Approve Invoice
                </a>
              </div>
              
              <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
                This is an automated message from the Finance Management System.
              </p>
            </div>
          </div>
        `
      }).catch(error => {
        console.error('Failed to send first approver notification:', error);
        return { error };
      });

      if (!notificationResult.error) {
        // Mark notification as sent
        invoice.approvalChain[0].notificationSent = true;
        invoice.approvalChain[0].notificationSentAt = new Date();
        await invoice.save();
      }
    }

    // Send confirmation to employee
    await sendEmail({
      to: employee.email,
      subject: 'Invoice Uploaded Successfully - Approval Chain Initiated',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; border-left: 4px solid #52c41a;">
            <h3>Invoice Upload Confirmation</h3>
            <p>Dear ${employee.fullName},</p>
            
            <p>Your invoice has been uploaded successfully and is now in the approval process.</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Upload Details:</strong></p>
              <ul>
                <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
                <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                <li><strong>Upload Date:</strong> ${new Date().toLocaleDateString('en-GB')}</li>
                <li><strong>Status:</strong> <span style="color: #faad14;">Pending Approval</span></li>
              </ul>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Approval Chain:</strong></p>
              <ol>
                ${approvalChain.map(step => `<li>${step.approver.name} (${step.approver.role})</li>`).join('')}
              </ol>
            </div>
            
            <p>You can track the status of your invoice in the employee portal.</p>
            
            <p>Thank you!</p>
          </div>
        </div>
      `
    }).catch(error => {
      console.error('Failed to send employee confirmation:', error);
    });

    console.log('=== INVOICE UPLOAD WITH APPROVAL CHAIN SUCCESSFUL ===');
    res.status(201).json({
      success: true,
      message: 'Invoice uploaded successfully. Approval chain has been initiated.',
      data: invoice
    });

  } catch (error) {
    console.error('=== INVOICE UPLOAD FAILED ===', error);

    // Clean up Cloudinary files on error
    if (req.uploadedFiles) {
      const { cloudinary } = require('../config/cloudinary');
      const cleanupPromises = Object.values(req.uploadedFiles).map(file => {
        if (file.publicId && cloudinary && cloudinary.uploader) {
          return cloudinary.uploader.destroy(file.publicId).catch(err => 
            console.error('Failed to cleanup Cloudinary file:', err)
          );
        }
      });
      await Promise.allSettled(cleanupPromises);
    }

    // Clean up temp files
    if (req.files) {
      const fs = require('fs').promises;
      const tempFiles = [];
      if (req.files.poFile) tempFiles.push(...req.files.poFile);
      if (req.files.invoiceFile) tempFiles.push(...req.files.invoiceFile);
      
      const cleanupPromises = tempFiles.map(file => 
        fs.unlink(file.path).catch(err => 
          console.warn('Failed to delete temp file:', err.message)
        )
      );
      await Promise.allSettled(cleanupPromises);
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload invoice',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

// Process approval step (sequential approval)
exports.processApprovalStep = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { decision, comments } = req.body;

    console.log('=== PROCESSING INVOICE APPROVAL STEP ===');
    console.log('Invoice ID:', invoiceId);
    console.log('User Email:', req.user.email);
    console.log('Decision:', decision);

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be "approved" or "rejected"'
      });
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate('employee', 'fullName email department');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if user can approve at current level
    if (!invoice.canUserApprove(req.user.email)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this invoice at this level'
      });
    }

    // Process the approval step
    const processedStep = invoice.processApprovalStep(
      req.user.email,
      decision,
      comments,
      req.user.userId
    );

    await invoice.save();

    // Send notification to employee
    const statusText = decision === 'approved' ? 'approved' : 'rejected';
    await sendEmail({
      to: invoice.employee.email,
      subject: `Invoice ${statusText.charAt(0).toUpperCase() + statusText.slice(1)} - ${invoice.poNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${decision === 'approved' ? '#f6ffed' : '#fff2f0'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${decision === 'approved' ? '#52c41a' : '#ff4d4f'};">
            <h3>Invoice ${decision === 'approved' ? 'Approved' : 'Rejected'}</h3>
            <p>Dear ${invoice.employee.fullName},</p>
            
            <p>Your invoice has been ${statusText} by ${processedStep.approver.name} (${processedStep.approver.role}).</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
                <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                <li><strong>Status:</strong> ${invoice.approvalStatus}</li>
                ${comments ? `<li><strong>Comments:</strong> ${comments}</li>` : ''}
              </ul>
            </div>
            
            ${decision === 'approved' && invoice.currentApprovalLevel > 0 ? `
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px;">
              <p><strong>Next Step:</strong> Awaiting approval from ${invoice.getCurrentApprover().approver.name} (${invoice.getCurrentApprover().approver.role})</p>
            </div>
            ` : ''}
            
            <p>Thank you!</p>
          </div>
        </div>
      `
    }).catch(error => {
      console.error('Failed to send employee notification:', error);
    });

    // If approved and there's a next approver, send notification
    if (decision === 'approved' && invoice.currentApprovalLevel > 0) {
      const nextApprover = invoice.getCurrentApprover();
      if (nextApprover && !nextApprover.notificationSent) {
        await invoice.notifyCurrentApprover();
      }
    }

    console.log('=== APPROVAL STEP PROCESSED SUCCESSFULLY ===');
    res.json({
      success: true,
      message: `Invoice ${statusText} successfully`,
      data: invoice
    });

  } catch (error) {
    console.error('Error processing approval step:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to process approval'
    });
  }
};

// Get pending approvals for user (current level only)
exports.getPendingApprovalsForUser = async (req, res) => {
  try {
    console.log('Fetching pending approvals for:', req.user.email);

    const invoices = await Invoice.getPendingForApprover(req.user.email);

    console.log(`Found ${invoices.length} pending invoices for approval`);

    res.json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals'
    });
  }
};

// Get invoice details
exports.getInvoiceDetails = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate('employee', 'fullName email department')
      .populate('approvalChain.approver.userId', 'fullName email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...invoice.toJSON(),
        approvalHistory: invoice.getApprovalHistory(),
        approvalProgress: invoice.approvalProgress,
        currentApprover: invoice.getCurrentApprover(),
        formattedUploadDateTime: invoice.formattedUploadDateTime,
        approvalChainStatus: invoice.getApprovalChainStatus()
      }
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice details'
    });
  }
};

// Get all invoices for supervisor (including upcoming ones)
exports.getSupervisorInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.getForSupervisor(req.user.email);

    res.json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching supervisor invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices'
    });
  }
};

// Assign invoice to department and create sequential approval chain
exports.assignInvoiceToDepartment = async (req, res) => {
  try {
    console.log('=== ASSIGNING INVOICE TO DEPARTMENT ===');
    const { invoiceId } = req.params;
    const { department, comments } = req.body;
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department is required'
      });
    }
    
    const invoice = await Invoice.findById(invoiceId)
      .populate('employee', 'fullName email department');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    if (invoice.approvalStatus !== 'pending_finance_assignment') {
      return res.status(400).json({
        success: false,
        message: 'Invoice has already been assigned or processed'
      });
    }
    
    const employeeName = invoice.employeeDetails?.name || invoice.employee.fullName;
    console.log('Creating approval chain for:', employeeName, 'in department:', department);
    
    // Assign to department and create sequential approval chain
    invoice.assignToDepartment(department, req.user.userId);
    
    if (comments) {
      invoice.financeReview = {
        reviewedBy: req.user.userId,
        reviewDate: new Date(),
        reviewTime: new Date().toTimeString().split(' ')[0],
        status: 'assigned',
        finalComments: comments
      };
    }
    
    await invoice.save();
    
    console.log('Invoice assigned successfully. First approver:', invoice.getCurrentApprover()?.approver.name);
    
    // The post-save middleware will automatically send notification to the first approver
    
    await invoice.populate('assignedBy', 'fullName email');
    
    console.log('=== INVOICE ASSIGNED SUCCESSFULLY ===');
    
    res.json({
      success: true,
      message: 'Invoice assigned to department successfully',
      data: invoice
    });
    
  } catch (error) {
    console.error('=== INVOICE ASSIGNMENT FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to assign invoice to department'
    });
  }
};

// Get approval statistics for dashboard
exports.getApprovalStatistics = async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.uploadedDate = {};
      if (startDate) dateFilter.uploadedDate.$gte = new Date(startDate);
      if (endDate) dateFilter.uploadedDate.$lte = new Date(endDate);
    }
    
    // Overall statistics
    const overallStats = await Invoice.aggregate([
      { $match: { ...dateFilter, ...(department ? { assignedDepartment: department } : {}) } },
      {
        $group: {
          _id: '$approvalStatus',
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $divide: [
                { $subtract: ['$updatedAt', '$uploadedDate'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      }
    ]);
    
    // Department-wise statistics
    const departmentStats = await Invoice.aggregate([
      { $match: dateFilter },
      { $match: { assignedDepartment: { $exists: true } } },
      {
        $group: {
          _id: {
            department: '$assignedDepartment',
            status: '$approvalStatus'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.department',
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          totalInvoices: { $sum: '$count' }
        }
      }
    ]);
    
    // Recent activity
    const recentActivity = await Invoice.find(dateFilter)
      .populate('employee', 'fullName')
      .populate('assignedBy', 'fullName')
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('poNumber invoiceNumber employeeDetails approvalStatus updatedAt assignedDepartment currentApprovalLevel');
    
    res.json({
      success: true,
      data: {
        overall: overallStats,
        byDepartment: departmentStats,
        recentActivity
      }
    });
    
  } catch (error) {
    console.error('Error fetching approval statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval statistics'
    });
  }
};

// Mark invoice as processed (final finance step)
exports.markInvoiceAsProcessed = async (req, res) => {
  try {
    console.log('=== MARKING INVOICE AS PROCESSED ===');
    const { invoiceId } = req.params;
    const { comments } = req.body;
    
    const invoice = await Invoice.findById(invoiceId)
      .populate('employee', 'fullName email');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    if (invoice.approvalStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Invoice must be fully approved before processing'
      });
    }
    
    // Update invoice status
    invoice.approvalStatus = 'processed';
    invoice.financeReview = {
      ...invoice.financeReview,
      reviewedBy: req.user.userId,
      reviewDate: new Date(),
      reviewTime: new Date().toTimeString().split(' ')[0],
      status: 'processed',
      finalComments: comments
    };
    
    await invoice.save();
    
    // Notify employee
    if (invoice.employee.email) {
      await sendEmail({
        to: invoice.employee.email,
        subject: `✅ Invoice Processed - ${invoice.poNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px;">
              <h2>✅ Invoice Successfully Processed</h2>
              <p>Dear ${invoice.employeeDetails.name},</p>
              <p>Your invoice has been successfully processed by the finance team.</p>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px;">
                <ul>
                  <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
                  <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                  <li><strong>Status:</strong> PROCESSED</li>
                </ul>
              </div>
              
              ${comments ? `
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px;">
                <p><strong>Finance Comments:</strong> "${comments}"</p>
              </div>
              ` : ''}
            </div>
          </div>
        `
      }).catch(error => {
        console.error('Failed to send processed notification:', error);
      });
    }
    
    console.log('=== INVOICE MARKED AS PROCESSED ===');
    
    res.json({
      success: true,
      message: 'Invoice marked as processed successfully',
      data: invoice
    });
    
  } catch (error) {
    console.error('=== FAILED TO MARK INVOICE AS PROCESSED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to mark invoice as processed'
    });
  }
};

// Bulk assign invoices to department
exports.bulkAssignInvoices = async (req, res) => {
  try {
    console.log('=== BULK ASSIGNING INVOICES ===');
    const { invoiceIds, department, comments } = req.body;
    
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invoice IDs array is required'
      });
    }
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department is required'
      });
    }
    
    console.log(`Processing ${invoiceIds.length} invoices for department: ${department}`);
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (const invoiceId of invoiceIds) {
      try {
        console.log(`Processing invoice ID: ${invoiceId}`);
        
        const invoice = await Invoice.findById(invoiceId)
          .populate('employee', 'fullName email department');
        
        if (!invoice) {
          console.log(`Invoice not found: ${invoiceId}`);
          results.failed.push({ invoiceId, error: 'Invoice not found' });
          continue;
        }
        
        console.log(`Found invoice: ${invoice.poNumber} for employee: ${invoice.employeeDetails?.name || invoice.employee?.fullName || 'Unknown'}`);
        
        if (invoice.approvalStatus !== 'pending_finance_assignment') {
          console.log(`Invoice ${invoice.poNumber} already assigned or processed. Status: ${invoice.approvalStatus}`);
          results.failed.push({ 
            invoiceId, 
            poNumber: invoice.poNumber,
            error: 'Invoice already assigned or processed' 
          });
          continue;
        }
        
        const employeeName = invoice.employeeDetails?.name || invoice.employee?.fullName || 'Unknown Employee';
        console.log(`Assigning invoice ${invoice.poNumber} for employee "${employeeName}" to department "${department}"`);
        
        // Call the assignment method with error handling
        try {
          invoice.assignToDepartment(department, req.user.userId);
          
          if (comments) {
            invoice.financeReview = {
              reviewedBy: req.user.userId,
              reviewDate: new Date(),
              reviewTime: new Date().toTimeString().split(' ')[0],
              status: 'assigned',
              finalComments: comments
            };
          }
          
          await invoice.save();
          
          results.successful.push({
            invoiceId,
            poNumber: invoice.poNumber,
            employeeName,
            firstApprover: invoice.getCurrentApprover()?.approver.name || 'None'
          });
          
          console.log(`Successfully assigned ${invoice.poNumber} to ${department}. First approver: ${invoice.getCurrentApprover()?.approver.name || 'None'}`);
          
        } catch (assignmentError) {
          console.error(`Assignment error for invoice ${invoice.poNumber}:`, assignmentError);
          results.failed.push({ 
            invoiceId, 
            poNumber: invoice.poNumber,
            error: `Assignment failed: ${assignmentError.message}` 
          });
        }
        
      } catch (error) {
        console.error(`Failed to process invoice ${invoiceId}:`, error);
        results.failed.push({ 
          invoiceId, 
          error: error.message || 'Processing failed' 
        });
      }
    }
    
    console.log(`Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`);
    
    // Log failed assignments for debugging
    if (results.failed.length > 0) {
      console.log('Failed assignments:', results.failed);
    }
    
    res.json({
      success: true,
      message: `Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results
    });
    
  } catch (error) {
    console.error('=== BULK ASSIGNMENT FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Bulk assignment failed'
    });
  }
};

// Get department list for assignment
exports.getDepartments = async (req, res) => {
  try {
    const departments = getDepartmentList();
    res.json({
      success: true,
      data: departments
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments'
    });
  }
};

// Get employees in a department
exports.getDepartmentEmployees = async (req, res) => {
  try {
    const { department } = req.params;
    const employees = getEmployeesInDepartment(department);
    
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('Error fetching department employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department employees'
    });
  }
};

// Get all invoices for finance management
exports.getInvoicesForFinance = async (req, res) => {
  try {
    const { status, department, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (status) filter.approvalStatus = status;
    if (department) filter.assignedDepartment = department;
    if (startDate || endDate) {
      filter.uploadedDate = {};
      if (startDate) filter.uploadedDate.$gte = new Date(startDate);
      if (endDate) filter.uploadedDate.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const invoices = await Invoice.find(filter)
      .populate('employee', 'fullName email department')
      .populate('assignedBy', 'fullName email')
      .populate('approvalChain.approver.userId', 'fullName email')
      .sort({ uploadedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Invoice.countDocuments(filter);
    
    res.json({
      success: true,
      data: invoices,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching finance invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices'
    });
  }
};

module.exports = exports;









// const Invoice = require('../models/Invoice');
// const User = require('../models/User');
// const { sendEmail } = require('../services/emailService');
// const { getApprovalChain, getDepartmentList, getEmployeesInDepartment } = require('../config/departmentStructure');
// const { cloudinary } = require('../config/cloudinary');
// const fs = require('fs').promises;

// // Upload invoice with files
// exports.uploadInvoiceWithApprovalChain = async (req, res) => {
//   try {
//     console.log('=== INVOICE UPLOAD WITH APPROVAL CHAIN STARTED ===');
//     console.log('Request body:', JSON.stringify(req.body, null, 2));
//     console.log('Files received:', req.files ? Object.keys(req.files) : 'No files');
//     console.log('User ID:', req.user.userId);

//     const { poNumber, invoiceNumber } = req.body;

//     // Validate required fields
//     if (!poNumber || !invoiceNumber) {
//       throw new Error('PO number and invoice number are required');
//     }

//     // Validate PO number format
//     const poRegex = /^PO-\w{2}\d{10}-\d+$/i;
//     if (!poRegex.test(poNumber)) {
//       throw new Error('PO number format should be: PO-XX0000000000-X (e.g., PO-NG010000000-1)');
//     }

//     // Check for duplicate PO/Invoice combination
//     const existingInvoice = await Invoice.findOne({
//       poNumber: poNumber.toUpperCase(),
//       invoiceNumber: invoiceNumber.trim(),
//       employee: req.user.userId
//     });

//     if (existingInvoice) {
//       throw new Error('An invoice with this PO number and invoice number already exists');
//     }

//     // Get employee details with department/position info
//     const employee = await User.findById(req.user.userId).select('fullName email department position');
//     if (!employee) {
//       throw new Error('Employee not found');
//     }

//     console.log('Employee found:', employee.fullName, 'Department:', employee.department);

//     // Process file uploads to Cloudinary (same as previous implementation)
//     const uploadedFiles = {};
//     const uploadPromises = [];

//     const uploadToCloudinary = async (file, folder) => {
//       try {
//         console.log(`🔄 Uploading ${file.fieldname} to Cloudinary...`);
        
//         const result = await cloudinary.uploader.upload(file.path, {
//           folder: `invoice-uploads/${folder}`,
//           resource_type: 'auto',
//           public_id: `${poNumber}-${file.fieldname}-${Date.now()}`,
//           format: file.mimetype.includes('pdf') ? 'pdf' : undefined,
//           use_filename: true,
//           unique_filename: true
//         });

//         await fs.unlink(file.path).catch(err => 
//           console.warn('Failed to delete temp file:', err.message)
//         );

//         return {
//           publicId: result.public_id,
//           url: result.secure_url,
//           format: result.format,
//           resourceType: result.resource_type,
//           bytes: result.bytes,
//           originalName: file.originalname
//         };
//       } catch (error) {
//         await fs.unlink(file.path).catch(() => {});
//         throw new Error(`Failed to upload ${file.fieldname}: ${error.message}`);
//       }
//     };

//     // Process file uploads
//     if (req.files && req.files.poFile && req.files.poFile.length > 0) {
//       const poFile = req.files.poFile[0];
//       uploadPromises.push(
//         uploadToCloudinary(poFile, 'po-files').then(result => {
//           uploadedFiles.poFile = result;
//         })
//       );
//     }

//     if (req.files && req.files.invoiceFile && req.files.invoiceFile.length > 0) {
//       const invoiceFile = req.files.invoiceFile[0];
//       uploadPromises.push(
//         uploadToCloudinary(invoiceFile, 'invoice-files').then(result => {
//           uploadedFiles.invoiceFile = result;
//         })
//       );
//     }

//     if (uploadPromises.length > 0) {
//       await Promise.all(uploadPromises);
//     }

//     // Create invoice record
//     const invoiceData = {
//       poNumber: poNumber.toUpperCase(),
//       invoiceNumber: invoiceNumber.trim(),
//       employee: req.user.userId,
//       employeeDetails: {
//         name: employee.fullName,
//         email: employee.email,
//         department: employee.department,
//         position: employee.position || 'Employee'
//       },
//       uploadedDate: new Date(),
//       uploadedTime: new Date().toTimeString().split(' ')[0],
//       approvalStatus: 'pending_finance_assignment',
//       ...uploadedFiles
//     };

//     const invoice = await Invoice.create(invoiceData);

//     // Send notifications (same as before)
//     const notifications = [];

//     // Notify Finance Team
//     const financeTeam = await User.find({ role: 'finance' }).select('email fullName');
//     if (financeTeam.length > 0) {
//       notifications.push(
//         sendEmail({
//           to: financeTeam.map(f => f.email),
//           subject: `📄 New Invoice Upload - ${employee.fullName}`,
//           html: `
//             <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//               <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
//                 <h3>New Invoice Upload Received</h3>
//                 <p>Dear Finance Team,</p>
//                 <p>A new invoice has been uploaded and requires department assignment for approval processing.</p>
                
//                 <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
//                   <p><strong>Invoice Details:</strong></p>
//                   <ul>
//                     <li><strong>Employee:</strong> ${employee.fullName} (${employee.department || 'N/A'})</li>
//                     <li><strong>Position:</strong> ${employee.position || 'Employee'}</li>
//                     <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
//                     <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
//                     <li><strong>Upload Date:</strong> ${new Date().toLocaleDateString('en-GB')}</li>
//                     <li><strong>Status:</strong> Awaiting Department Assignment</li>
//                   </ul>
//                 </div>
                
//                 <p><strong>Action Required:</strong> 
//                   <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/finance/invoices" 
//                      style="background-color: #1890ff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">
//                     Assign to Department
//                   </a>
//                 </p>
//               </div>
//             </div>
//           `
//         }).catch(error => ({ error, type: 'finance' }))
//       );
//     }

//     // Send all notifications
//     await Promise.allSettled(notifications);

//     console.log('=== INVOICE UPLOADED SUCCESSFULLY ===');
//     res.status(201).json({
//       success: true,
//       message: 'Invoice uploaded successfully and awaiting department assignment',
//       data: invoice
//     });

//   } catch (error) {
//     console.error('=== INVOICE UPLOAD FAILED ===', error);
//     res.status(400).json({
//       success: false,
//       message: error.message || 'Failed to upload invoice'
//     });
//   }
// };

// // Get all invoices for finance management
// exports.getInvoicesForFinance = async (req, res) => {
//   try {
//     const { status, department, startDate, endDate, page = 1, limit = 10 } = req.query;
    
//     const filter = {};
//     if (status) filter.approvalStatus = status;
//     if (department) filter.assignedDepartment = department;
//     if (startDate || endDate) {
//       filter.uploadedDate = {};
//       if (startDate) filter.uploadedDate.$gte = new Date(startDate);
//       if (endDate) filter.uploadedDate.$lte = new Date(endDate);
//     }
    
//     const skip = (page - 1) * limit;
    
//     const invoices = await Invoice.find(filter)
//       .populate('employee', 'fullName email department')
//       .populate('assignedBy', 'fullName email')
//       .populate('approvalChain.approver.userId', 'fullName email')
//       .sort({ uploadedDate: -1 })
//       .skip(skip)
//       .limit(parseInt(limit));
    
//     const total = await Invoice.countDocuments(filter);
    
//     res.json({
//       success: true,
//       data: invoices,
//       pagination: {
//         current: parseInt(page),
//         pageSize: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit)
//       }
//     });
    
//   } catch (error) {
//     console.error('Error fetching finance invoices:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch invoices'
//     });
//   }
// };

// // Assign invoice to department and create sequential approval chain
// exports.assignInvoiceToDepartment = async (req, res) => {
//   try {
//     console.log('=== ASSIGNING INVOICE TO DEPARTMENT ===');
//     const { invoiceId } = req.params;
//     const { department, comments } = req.body;
    
//     if (!department) {
//       return res.status(400).json({
//         success: false,
//         message: 'Department is required'
//       });
//     }
    
//     const invoice = await Invoice.findById(invoiceId)
//       .populate('employee', 'fullName email department');
    
//     if (!invoice) {
//       return res.status(404).json({
//         success: false,
//         message: 'Invoice not found'
//       });
//     }
    
//     if (invoice.approvalStatus !== 'pending_finance_assignment') {
//       return res.status(400).json({
//         success: false,
//         message: 'Invoice has already been assigned or processed'
//       });
//     }
    
//     const employeeName = invoice.employeeDetails?.name || invoice.employee.fullName;
//     console.log('Creating approval chain for:', employeeName, 'in department:', department);
    
//     // Assign to department and create sequential approval chain
//     invoice.assignToDepartment(department, req.user.userId);
    
//     if (comments) {
//       invoice.financeReview = {
//         reviewedBy: req.user.userId,
//         reviewDate: new Date(),
//         reviewTime: new Date().toTimeString().split(' ')[0],
//         status: 'assigned',
//         finalComments: comments
//       };
//     }
    
//     await invoice.save();
    
//     console.log('Invoice assigned successfully. First approver:', invoice.getCurrentApprover()?.approver.name);
    
//     // The post-save middleware will automatically send notification to the first approver
    
//     await invoice.populate('assignedBy', 'fullName email');
    
//     console.log('=== INVOICE ASSIGNED SUCCESSFULLY ===');
    
//     res.json({
//       success: true,
//       message: 'Invoice assigned to department successfully',
//       data: invoice
//     });
    
//   } catch (error) {
//     console.error('=== INVOICE ASSIGNMENT FAILED ===', error);
//     res.status(400).json({
//       success: false,
//       message: error.message || 'Failed to assign invoice to department'
//     });
//   }
// };

// // Process approval decision (sequential - only current approver can approve)
// exports.processApprovalStep = async (req, res) => {
//   try {
//     console.log('=== PROCESSING APPROVAL STEP ===');
//     const { invoiceId } = req.params;
//     const { decision, comments } = req.body;
    
//     if (!decision || !['approved', 'rejected'].includes(decision)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Valid decision (approved/rejected) is required'
//       });
//     }
    
//     const invoice = await Invoice.findById(invoiceId)
//       .populate('employee', 'fullName email department');
    
//     if (!invoice) {
//       return res.status(404).json({
//         success: false,
//         message: 'Invoice not found'
//       });
//     }
    
//     if (invoice.approvalStatus !== 'pending_department_approval') {
//       return res.status(400).json({
//         success: false,
//         message: 'Invoice is not pending department approval'
//       });
//     }
    
//     const user = await User.findById(req.user.userId).select('email fullName');
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }
    
//     // Check if this user can approve at the current level
//     if (!invoice.canUserApprove(user.email)) {
//       const currentApprover = invoice.getCurrentApprover();
//       return res.status(403).json({
//         success: false,
//         message: `You are not authorized to approve this invoice at this time. Current approver: ${currentApprover?.approver.name} (Level ${currentApprover?.level})`
//       });
//     }
    
//     console.log(`Processing ${decision} by ${user.email} at level ${invoice.currentApprovalLevel}`);
    
//     // Process the approval step
//     const processedStep = invoice.processApprovalStep(user.email, decision, comments, req.user.userId);
//     await invoice.save();
    
//     console.log('Approval step processed:', processedStep);
    
//     // Send notifications based on decision and current state
//     const notifications = [];
    
//     if (decision === 'approved') {
//       const nextApprover = invoice.getCurrentApprover();
      
//       if (nextApprover) {
//         // Notify next approver in chain
//         console.log(`Notifying next approver: ${nextApprover.approver.name} at level ${nextApprover.level}`);
        
//         notifications.push(
//           sendEmail({
//             to: nextApprover.approver.email,
//             subject: `🔔 Invoice Approval Required - ${invoice.poNumber}`,
//             html: `
//               <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                 <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
//                   <h2>🔔 Invoice Approval Required - Your Turn</h2>
//                   <p>Dear ${nextApprover.approver.name},</p>
//                   <p>An invoice has been approved at Level ${processedStep.level} and now requires your approval at <strong>Level ${nextApprover.level}</strong>.</p>
                  
//                   <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                     <h3>Invoice Details</h3>
//                     <ul>
//                       <li><strong>Employee:</strong> ${invoice.employeeDetails.name}</li>
//                       <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
//                       <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
//                       <li><strong>Previous Approver:</strong> ${user.fullName} (Level ${processedStep.level})</li>
//                       <li><strong>Your Role:</strong> ${nextApprover.approver.role}</li>
//                       <li><strong>Approval Level:</strong> ${nextApprover.level}</li>
//                     </ul>
//                   </div>
                  
//                   ${comments ? `
//                   <div style="background-color: #d4edda; padding: 15px; border-radius: 6px; margin: 20px 0;">
//                     <p><strong>Previous Approver Comments:</strong> "${comments}"</p>
//                   </div>
//                   ` : ''}
                  
//                   <div style="text-align: center; margin: 30px 0;">
//                     <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/supervisor/invoice/${invoice._id}" 
//                        style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
//                       Review & Process Invoice
//                     </a>
//                   </div>
                  
//                   <p style="color: #666; font-size: 12px;">You are currently the active approver. Please review and take action.</p>
//                 </div>
//               </div>
//             `
//           }).catch(error => {
//             console.error('Failed to send next approver notification:', error);
//             return { error, success: false };
//           })
//         );
//       } else {
//         // All approvals complete - notify finance
//         console.log('All approvals completed - notifying finance');
        
//         const financeUsers = await User.find({ role: 'finance' }).select('email fullName');
//         if (financeUsers.length > 0) {
//           notifications.push(
//             sendEmail({
//               to: financeUsers.map(u => u.email),
//               subject: `✅ Invoice Fully Approved - ${invoice.poNumber}`,
//               html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                   <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
//                     <h2>✅ Invoice Fully Approved</h2>
//                     <p>Dear Finance Team,</p>
//                     <p>An invoice has completed the full approval chain and is ready for processing.</p>
                    
//                     <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                       <h3>Invoice Details</h3>
//                       <ul>
//                         <li><strong>Employee:</strong> ${invoice.employeeDetails.name}</li>
//                         <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
//                         <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
//                         <li><strong>Final Approver:</strong> ${user.fullName}</li>
//                         <li><strong>Status:</strong> FULLY APPROVED</li>
//                       </ul>
//                     </div>
                    
//                     <div style="text-align: center; margin: 30px 0;">
//                       <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/finance/invoices" 
//                          style="background-color: #17a2b8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
//                         Process Payment
//                       </a>
//                     </div>
//                   </div>
//                 </div>
//               `
//             }).catch(error => ({ error, success: false }))
//           );
//         }
//       }
      
//       // Notify employee of approval progress
//       notifications.push(
//         sendEmail({
//           to: invoice.employee.email,
//           subject: `📋 Invoice Approval Update - ${invoice.poNumber}`,
//           html: `
//             <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//               <div style="background-color: ${nextApprover ? '#e2e3e5' : '#d4edda'}; padding: 20px; border-radius: 8px;">
//                 <h2>📋 Invoice Approval Update</h2>
//                 <p>Dear ${invoice.employeeDetails.name},</p>
//                 <p>Your invoice has been <strong style="color: #28a745;">approved</strong> by ${user.fullName} at Level ${processedStep.level}.</p>
                
//                 <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                   <ul>
//                     <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
//                     <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
//                     <li><strong>Approved by:</strong> ${user.fullName}</li>
//                     <li><strong>Current Status:</strong> ${nextApprover ? 'Pending Next Approval' : 'FULLY APPROVED'}</li>
//                   </ul>
//                 </div>
                
//                 ${nextApprover ? `
//                 <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px;">
//                   <p><strong>Next Step:</strong> Your invoice is now waiting for approval from ${nextApprover.approver.name} (${nextApprover.approver.role}).</p>
//                 </div>
//                 ` : `
//                 <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px;">
//                   <p><strong>🎉 Great News:</strong> Your invoice has completed all approvals and is now being processed by the finance team!</p>
//                 </div>
//                 `}
//               </div>
//             </div>
//           `
//         }).catch(error => ({ error, success: false }))
//       );
      
//     } else {
//       // Invoice rejected
//       console.log(`Invoice rejected by ${user.fullName} at level ${processedStep.level}`);
      
//       notifications.push(
//         sendEmail({
//           to: invoice.employee.email,
//           subject: `❌ Invoice Rejected - ${invoice.poNumber}`,
//           html: `
//             <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//               <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
//                 <h2>❌ Invoice Rejected</h2>
//                 <p>Dear ${invoice.employeeDetails.name},</p>
//                 <p>Unfortunately, your invoice has been rejected by ${user.fullName} at Level ${processedStep.level}.</p>
                
//                 <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                   <h3>Rejection Details</h3>
//                   <ul>
//                     <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
//                     <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
//                     <li><strong>Rejected by:</strong> ${user.fullName}</li>
//                     <li><strong>Approval Level:</strong> ${processedStep.level}</li>
//                     <li><strong>Status:</strong> REJECTED</li>
//                   </ul>
//                 </div>
                
//                 ${comments ? `
//                 <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px;">
//                   <p><strong>Rejection Reason:</strong> "${comments}"</p>
//                 </div>
//                 ` : ''}
                
//                 <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px;">
//                   <h4>💡 What You Can Do:</h4>
//                   <ul>
//                     <li>Review the rejection reason above</li>
//                     <li>Contact ${user.fullName} for clarification</li>
//                     <li>Submit a new invoice if needed</li>
//                     <li>Reach out to the finance department for guidance</li>
//                   </ul>
//                 </div>
//               </div>
//             </div>
//           `
//         }).catch(error => ({ error, success: false }))
//       );
      
//       // Notify finance of rejection
//       const financeUsers = await User.find({ role: 'finance' }).select('email fullName');
//       if (financeUsers.length > 0) {
//         notifications.push(
//           sendEmail({
//             to: financeUsers.map(u => u.email),
//             subject: `⚠️ Invoice Rejected - ${invoice.poNumber}`,
//             html: `
//               <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                 <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px;">
//                   <h2>⚠️ Invoice Rejected</h2>
//                   <p>An invoice has been rejected during the approval process.</p>
                  
//                   <div style="background-color: white; padding: 20px; border-radius: 8px;">
//                     <ul>
//                       <li><strong>Employee:</strong> ${invoice.employeeDetails.name}</li>
//                       <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
//                       <li><strong>Rejected by:</strong> ${user.fullName}</li>
//                       <li><strong>Level:</strong> ${processedStep.level}</li>
//                       <li><strong>Reason:</strong> ${comments || 'No reason provided'}</li>
//                     </ul>
//                   </div>
//                 </div>
//               </div>
//             `
//           }).catch(error => ({ error, success: false }))
//         );
//       }
//     }
    
//     // Send all notifications
//     await Promise.allSettled(notifications);
    
//     console.log('=== APPROVAL STEP PROCESSED SUCCESSFULLY ===');
    
//     res.json({
//       success: true,
//       message: `Invoice ${decision} successfully`,
//       data: {
//         ...invoice.toObject(),
//         currentApprover: invoice.getCurrentApprover(),
//         nextApprover: invoice.getNextApprover(),
//         approvalChainStatus: invoice.getApprovalChainStatus()
//       },
//       processedStep: processedStep
//     });
    
//   } catch (error) {
//     console.error('=== APPROVAL STEP PROCESSING FAILED ===', error);
//     res.status(400).json({
//       success: false,
//       message: error.message || 'Failed to process approval step'
//     });
//   }
// };

// // Mark invoice as processed (final finance step)
// exports.markInvoiceAsProcessed = async (req, res) => {
//   try {
//     console.log('=== MARKING INVOICE AS PROCESSED ===');
//     const { invoiceId } = req.params;
//     const { comments } = req.body;
    
//     const invoice = await Invoice.findById(invoiceId)
//       .populate('employee', 'fullName email');
    
//     if (!invoice) {
//       return res.status(404).json({
//         success: false,
//         message: 'Invoice not found'
//       });
//     }
    
//     if (invoice.approvalStatus !== 'approved') {
//       return res.status(400).json({
//         success: false,
//         message: 'Invoice must be fully approved before processing'
//       });
//     }
    
//     // Update invoice status
//     invoice.approvalStatus = 'processed';
//     invoice.financeReview = {
//       ...invoice.financeReview,
//       reviewedBy: req.user.userId,
//       reviewDate: new Date(),
//       reviewTime: new Date().toTimeString().split(' ')[0],
//       status: 'processed',
//       finalComments: comments
//     };
    
//     await invoice.save();
    
//     // Notify employee
//     if (invoice.employee.email) {
//       await sendEmail({
//         to: invoice.employee.email,
//         subject: `✅ Invoice Processed - ${invoice.poNumber}`,
//         html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//             <div style="background-color: #d4edda; padding: 20px; border-radius: 8px;">
//               <h2>✅ Invoice Successfully Processed</h2>
//               <p>Dear ${invoice.employeeDetails.name},</p>
//               <p>Your invoice has been successfully processed by the finance team.</p>
              
//               <div style="background-color: white; padding: 20px; border-radius: 8px;">
//                 <ul>
//                   <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
//                   <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
//                   <li><strong>Status:</strong> PROCESSED</li>
//                 </ul>
//               </div>
              
//               ${comments ? `
//               <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px;">
//                 <p><strong>Finance Comments:</strong> "${comments}"</p>
//               </div>
//               ` : ''}
//             </div>
//           </div>
//         `
//       }).catch(error => {
//         console.error('Failed to send processed notification:', error);
//       });
//     }
    
//     console.log('=== INVOICE MARKED AS PROCESSED ===');
    
//     res.json({
//       success: true,
//       message: 'Invoice marked as processed successfully',
//       data: invoice
//     });
    
//   } catch (error) {
//     console.error('=== FAILED TO MARK INVOICE AS PROCESSED ===', error);
//     res.status(400).json({
//       success: false,
//       message: error.message || 'Failed to mark invoice as processed'
//     });
//   }
// };

// // Get invoices pending approval for current user (only those at current level)
// exports.getPendingApprovalsForUser = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId).select('email fullName');
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }
    
//     console.log('Fetching pending approvals for:', user.email);
    
//     // Get invoices where this user is the current active approver
//     const pendingInvoices = await Invoice.getPendingForApprover(user.email);
    
//     console.log(`Found ${pendingInvoices.length} pending invoices for ${user.email}`);
    
//     // Add additional details for each invoice
//     const invoicesWithDetails = pendingInvoices.map(invoice => ({
//       ...invoice.toObject(),
//       currentApprover: invoice.getCurrentApprover(),
//       nextApprover: invoice.getNextApprover(),
//       approvalChainStatus: invoice.getApprovalChainStatus(),
//       canUserApprove: invoice.canUserApprove(user.email)
//     }));
    
//     res.json({
//       success: true,
//       data: invoicesWithDetails,
//       count: invoicesWithDetails.length,
//       userInfo: {
//         email: user.email,
//         name: user.fullName
//       }
//     });
    
//   } catch (error) {
//     console.error('Error fetching pending approvals:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch pending approvals'
//     });
//   }
// };

// // Get all invoices for a supervisor (including completed and upcoming)
// exports.getSupervisorInvoices = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId).select('email fullName');
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }
    
//     // Get all invoices where this supervisor is in the approval chain
//     const supervisorInvoices = await Invoice.getForSupervisor(user.email);
    
//     // Categorize invoices
//     const categorized = {
//       pendingMyApproval: [],
//       approved: [],
//       rejected: [],
//       upcoming: []
//     };
    
//     supervisorInvoices.forEach(invoice => {
//       const currentApprover = invoice.getCurrentApprover();
//       const isCurrentApprover = currentApprover && currentApprover.approver.email === user.email;
      
//       if (invoice.approvalStatus === 'rejected') {
//         categorized.rejected.push({
//           ...invoice.toObject(),
//           currentApprover: invoice.getCurrentApprover(),
//           approvalChainStatus: invoice.getApprovalChainStatus()
//         });
//       } else if (isCurrentApprover) {
//         categorized.pendingMyApproval.push({
//           ...invoice.toObject(),
//           currentApprover: invoice.getCurrentApprover(),
//           approvalChainStatus: invoice.getApprovalChainStatus(),
//           canUserApprove: true
//         });
//       } else if (invoice.approvalStatus === 'approved' || invoice.approvalStatus === 'processed') {
//         categorized.approved.push({
//           ...invoice.toObject(),
//           currentApprover: invoice.getCurrentApprover(),
//           approvalChainStatus: invoice.getApprovalChainStatus()
//         });
//       } else {
//         // Check if this supervisor will approve in the future
//         const supervisorStep = invoice.approvalChain.find(step => step.approver.email === user.email);
//         if (supervisorStep && supervisorStep.status === 'pending' && supervisorStep.level > invoice.currentApprovalLevel) {
//           categorized.upcoming.push({
//             ...invoice.toObject(),
//             currentApprover: invoice.getCurrentApprover(),
//             approvalChainStatus: invoice.getApprovalChainStatus(),
//             supervisorLevel: supervisorStep.level
//           });
//         }
//       }
//     });
    
//     res.json({
//       success: true,
//       data: categorized,
//       totals: {
//         pendingMyApproval: categorized.pendingMyApproval.length,
//         approved: categorized.approved.length,
//         rejected: categorized.rejected.length,
//         upcoming: categorized.upcoming.length,
//         total: supervisorInvoices.length
//       },
//       userInfo: {
//         email: user.email,
//         name: user.fullName
//       }
//     });
    
//   } catch (error) {
//     console.error('Error fetching supervisor invoices:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch supervisor invoices'
//     });
//   }
// };

// // Get invoice details with approval history
// exports.getInvoiceDetails = async (req, res) => {
//   try {
//     const { invoiceId } = req.params;
    
//     const invoice = await Invoice.findById(invoiceId)
//       .populate('employee', 'fullName email department')
//       .populate('assignedBy', 'fullName email')
//       .populate('approvalChain.approver.userId', 'fullName email')
//       .populate('financeReview.reviewedBy', 'fullName email');
    
//     if (!invoice) {
//       return res.status(404).json({
//         success: false,
//         message: 'Invoice not found'
//       });
//     }
    
//     // Check if current user has permission to view this invoice
//     const user = await User.findById(req.user.userId).select('email role');
//     const canView = user.role === 'admin' || 
//                    user.role === 'finance' || 
//                    invoice.employee._id.toString() === req.user.userId ||
//                    invoice.approvalChain.some(step => step.approver.email === user.email);
    
//     if (!canView) {
//       return res.status(403).json({
//         success: false,
//         message: 'You do not have permission to view this invoice'
//       });
//     }
    
//     res.json({
//       success: true,
//       data: {
//         ...invoice.toJSON(),
//         approvalHistory: invoice.getApprovalHistory(),
//         pendingSteps: invoice.getPendingSteps(),
//         approvalProgress: invoice.approvalProgress,
//         currentApprover: invoice.getCurrentApprover(),
//         nextApprover: invoice.getNextApprover(),
//         approvalChainStatus: invoice.getApprovalChainStatus(),
//         canUserApprove: invoice.canUserApprove(user.email),
//         formattedUploadDateTime: invoice.formattedUploadDateTime
//       }
//     });
    
//   } catch (error) {
//     console.error('Error fetching invoice details:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch invoice details'
//     });
//   }
// };

// // Get department list for assignment
// exports.getDepartments = async (req, res) => {
//   try {
//     const departments = getDepartmentList();
//     res.json({
//       success: true,
//       data: departments
//     });
//   } catch (error) {
//     console.error('Error fetching departments:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch departments'
//     });
//   }
// };

// // Get employees in a department
// exports.getDepartmentEmployees = async (req, res) => {
//   try {
//     const { department } = req.params;
//     const employees = getEmployeesInDepartment(department);
    
//     res.json({
//       success: true,
//       data: employees
//     });
//   } catch (error) {
//     console.error('Error fetching department employees:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch department employees'
//     });
//   }
// };

// // Get approval statistics for dashboard
// exports.getApprovalStatistics = async (req, res) => {
//   try {
//     const { department, startDate, endDate } = req.query;
    
//     const dateFilter = {};
//     if (startDate || endDate) {
//       dateFilter.uploadedDate = {};
//       if (startDate) dateFilter.uploadedDate.$gte = new Date(startDate);
//       if (endDate) dateFilter.uploadedDate.$lte = new Date(endDate);
//     }
    
//     // Overall statistics
//     const overallStats = await Invoice.aggregate([
//       { $match: { ...dateFilter, ...(department ? { assignedDepartment: department } : {}) } },
//       {
//         $group: {
//           _id: '$approvalStatus',
//           count: { $sum: 1 },
//           avgProcessingTime: {
//             $avg: {
//               $divide: [
//                 { $subtract: ['$updatedAt', '$uploadedDate'] },
//                 1000 * 60 * 60 * 24
//               ]
//             }
//           }
//         }
//       }
//     ]);
    
//     // Department-wise statistics
//     const departmentStats = await Invoice.aggregate([
//       { $match: dateFilter },
//       { $match: { assignedDepartment: { $exists: true } } },
//       {
//         $group: {
//           _id: {
//             department: '$assignedDepartment',
//             status: '$approvalStatus'
//           },
//           count: { $sum: 1 }
//         }
//       },
//       {
//         $group: {
//           _id: '$_id.department',
//           statuses: {
//             $push: {
//               status: '$_id.status',
//               count: '$count'
//             }
//           },
//           totalInvoices: { $sum: '$count' }
//         }
//       }
//     ]);
    
//     // Recent activity
//     const recentActivity = await Invoice.find(dateFilter)
//       .populate('employee', 'fullName')
//       .populate('assignedBy', 'fullName')
//       .sort({ updatedAt: -1 })
//       .limit(10)
//       .select('poNumber invoiceNumber employeeDetails approvalStatus updatedAt assignedDepartment currentApprovalLevel');
    
//     res.json({
//       success: true,
//       data: {
//         overall: overallStats,
//         byDepartment: departmentStats,
//         recentActivity
//       }
//     });
    
//   } catch (error) {
//     console.error('Error fetching approval statistics:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch approval statistics'
//     });
//   }
// };

// // Bulk assign invoices to department
// exports.bulkAssignInvoices = async (req, res) => {
//   try {
//     console.log('=== BULK ASSIGNING INVOICES ===');
//     const { invoiceIds, department, comments } = req.body;
    
//     if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invoice IDs array is required'
//       });
//     }
    
//     if (!department) {
//       return res.status(400).json({
//         success: false,
//         message: 'Department is required'
//       });
//     }
    
//     console.log(`Processing ${invoiceIds.length} invoices for department: ${department}`);
    
//     const results = {
//       successful: [],
//       failed: []
//     };
    
//     for (const invoiceId of invoiceIds) {
//       try {
//         console.log(`Processing invoice ID: ${invoiceId}`);
        
//         const invoice = await Invoice.findById(invoiceId)
//           .populate('employee', 'fullName email department');
        
//         if (!invoice) {
//           console.log(`Invoice not found: ${invoiceId}`);
//           results.failed.push({ invoiceId, error: 'Invoice not found' });
//           continue;
//         }
        
//         console.log(`Found invoice: ${invoice.poNumber} for employee: ${invoice.employeeDetails?.name || invoice.employee?.fullName || 'Unknown'}`);
        
//         if (invoice.approvalStatus !== 'pending_finance_assignment') {
//           console.log(`Invoice ${invoice.poNumber} already assigned or processed. Status: ${invoice.approvalStatus}`);
//           results.failed.push({ 
//             invoiceId, 
//             poNumber: invoice.poNumber,
//             error: 'Invoice already assigned or processed' 
//           });
//           continue;
//         }
        
//         const employeeName = invoice.employeeDetails?.name || invoice.employee?.fullName || 'Unknown Employee';
//         console.log(`Assigning invoice ${invoice.poNumber} for employee "${employeeName}" to department "${department}"`);
        
//         // Call the assignment method with error handling
//         try {
//           invoice.assignToDepartment(department, req.user.userId);
          
//           if (comments) {
//             invoice.financeReview = {
//               reviewedBy: req.user.userId,
//               reviewDate: new Date(),
//               reviewTime: new Date().toTimeString().split(' ')[0],
//               status: 'assigned',
//               finalComments: comments
//             };
//           }
          
//           await invoice.save();
          
//           results.successful.push({
//             invoiceId,
//             poNumber: invoice.poNumber,
//             employeeName,
//             firstApprover: invoice.getCurrentApprover()?.approver.name || 'None'
//           });
          
//           console.log(`Successfully assigned ${invoice.poNumber} to ${department}. First approver: ${invoice.getCurrentApprover()?.approver.name || 'None'}`);
          
//         } catch (assignmentError) {
//           console.error(`Assignment error for invoice ${invoice.poNumber}:`, assignmentError);
//           results.failed.push({ 
//             invoiceId, 
//             poNumber: invoice.poNumber,
//             error: `Assignment failed: ${assignmentError.message}` 
//           });
//         }
        
//       } catch (error) {
//         console.error(`Failed to process invoice ${invoiceId}:`, error);
//         results.failed.push({ 
//           invoiceId, 
//           error: error.message || 'Processing failed' 
//         });
//       }
//     }
    
//     console.log(`Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`);
    
//     // Log failed assignments for debugging
//     if (results.failed.length > 0) {
//       console.log('Failed assignments:', results.failed);
//     }
    
//     res.json({
//       success: true,
//       message: `Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`,
//       data: results
//     });
    
//   } catch (error) {
//     console.error('=== BULK ASSIGNMENT FAILED ===', error);
//     res.status(400).json({
//       success: false,
//       message: error.message || 'Bulk assignment failed'
//     });
//   }
// };

// // module.exports = {
// //   uploadInvoiceWithApprovalChain,
// //   getInvoicesForFinance,
// //   assignInvoiceToDepartment,
// //   processApprovalStep,
// //   markInvoiceAsProcessed,
// //   getPendingApprovalsForUser,
// //   getSupervisorInvoices,
// //   getInvoiceDetails,
// //   getDepartments,
// //   getDepartmentEmployees,
// //   getApprovalStatistics,
// //   bulkAssignInvoices
// // };

