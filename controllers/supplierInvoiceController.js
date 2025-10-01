const SupplierInvoice = require('../models/SupplierInvoice');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs').promises;


// Submit supplier invoice - FIXED VERSION
exports.submitSupplierInvoice = async (req, res) => {
  try {
    console.log('=== SUPPLIER INVOICE SUBMISSION ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Files received:', req.files ? Object.keys(req.files) : 'No files');
    console.log('Supplier ID:', req.supplier.userId);

    const {
      invoiceNumber,
      poNumber,
      invoiceAmount,
      currency = 'XAF',
      invoiceDate,
      dueDate,
      description,
      serviceCategory,
      lineItems
    } = req.body;

    // SIMPLIFIED VALIDATION - Only require PO number and invoice number initially
    if (!invoiceNumber || !poNumber) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number and PO number are required'
      });
    }

    // Validate PO number format - more flexible pattern
    const poRegex = /^PO-\w{2}\d{8,12}-\d+$/i;
    if (!poRegex.test(poNumber)) {
      return res.status(400).json({
        success: false,
        message: 'PO number format should be: PO-XX########-X (e.g., PO-NG010000000-1)'
      });
    }

    // Check for duplicate invoice
    const existingInvoice = await SupplierInvoice.findOne({
      invoiceNumber: invoiceNumber.trim(),
      supplier: req.supplier.userId
    });

    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'An invoice with this invoice number already exists'
      });
    }

    // Get supplier details
    const supplier = await User.findById(req.supplier.userId);
    if (!supplier || supplier.role !== 'supplier') {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    console.log('Supplier found:', supplier.supplierDetails.companyName);

    // Process file uploads to Cloudinary
    const uploadedFiles = {};
    const uploadPromises = [];

    const uploadToCloudinary = async (file, folder) => {
      try {
        console.log(`Uploading ${file.fieldname} to Cloudinary...`);
        
        const result = await cloudinary.uploader.upload(file.path, {
          folder: `supplier-invoices/${folder}`,
          resource_type: 'auto',
          public_id: `${supplier.supplierDetails.companyName}-${invoiceNumber}-${file.fieldname}-${Date.now()}`,
          use_filename: true,
          unique_filename: true
        });

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
        await fs.unlink(file.path).catch(() => {});
        throw new Error(`Failed to upload ${file.fieldname}: ${error.message}`);
      }
    };

    // Process invoice file
    if (req.files && req.files.invoiceFile && req.files.invoiceFile.length > 0) {
      const invoiceFile = req.files.invoiceFile[0];
      uploadPromises.push(
        uploadToCloudinary(invoiceFile, 'invoices').then(result => {
          uploadedFiles.invoiceFile = result;
        })
      );
    }

    // Process PO file
    if (req.files && req.files.poFile && req.files.poFile.length > 0) {
      const poFile = req.files.poFile[0];
      uploadPromises.push(
        uploadToCloudinary(poFile, 'po-files').then(result => {
          uploadedFiles.poFile = result;
        })
      );
    }

    // Wait for all uploads to complete
    if (uploadPromises.length > 0) {
      await Promise.all(uploadPromises);
      console.log('All files uploaded to Cloudinary successfully');
    }

    // Create supplier invoice record with minimal data initially
    const invoiceData = {
      supplier: req.supplier.userId,
      supplierDetails: {
        companyName: supplier.supplierDetails.companyName,
        contactName: supplier.supplierDetails.contactName,
        email: supplier.email,
        supplierType: supplier.supplierDetails.supplierType,
        businessRegistrationNumber: supplier.supplierDetails.businessRegistrationNumber
      },
      invoiceNumber: invoiceNumber.trim(),
      poNumber: poNumber.toUpperCase(),
      
      // Optional fields - set defaults if not provided
      invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : 0,
      currency,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      description: description ? description.trim() : `Invoice ${invoiceNumber.trim()} for PO ${poNumber.toUpperCase()}`,
      serviceCategory: serviceCategory || 'General',
      
      lineItems: lineItems ? (typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems) : [],
      approvalStatus: 'pending_finance_assignment',
      
      // Track what was provided by supplier vs what needs finance input
      initialSubmission: true,
      supplierProvidedFields: {
        invoiceNumber: true,
        poNumber: true,
        invoiceAmount: !!invoiceAmount,
        invoiceDate: !!invoiceDate,
        dueDate: !!dueDate,
        description: !!description && description.trim() !== `Invoice ${invoiceNumber.trim()} for PO ${poNumber.toUpperCase()}`,
        serviceCategory: !!serviceCategory && serviceCategory !== 'General'
      },
      
      // Add uploaded files
      ...uploadedFiles
    };

    console.log('Creating supplier invoice with data:', JSON.stringify(invoiceData, null, 2));
    const supplierInvoice = await SupplierInvoice.create(invoiceData);
    console.log('Supplier invoice created with ID:', supplierInvoice._id);

    // Send notifications
    const notifications = [];

    // 1. Notify Finance Team
    const financeTeam = await User.find({ role: 'finance' }).select('email fullName');
    if (financeTeam.length > 0) {
      console.log('Notifying finance team:', financeTeam.map(f => f.email));
      
      notifications.push(
        sendEmail({
          to: financeTeam.map(f => f.email),
          subject: `New Supplier Invoice - ${supplier.supplierDetails.companyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
                <h3>New Supplier Invoice Received</h3>
                <p>Dear Finance Team,</p>
                <p>A new supplier invoice has been submitted and requires review and department assignment.</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>Supplier Invoice Details:</strong></p>
                  <ul>
                    <li><strong>Supplier:</strong> ${supplier.supplierDetails.companyName}</li>
                    <li><strong>Contact:</strong> ${supplier.supplierDetails.contactName}</li>
                    <li><strong>Supplier Type:</strong> ${supplier.supplierDetails.supplierType}</li>
                    <li><strong>Invoice Number:</strong> ${supplierInvoice.invoiceNumber}</li>
                    <li><strong>PO Number:</strong> ${supplierInvoice.poNumber}</li>
                    <li><strong>Amount:</strong> ${supplierInvoice.invoiceAmount > 0 ? currency + ' ' + supplierInvoice.invoiceAmount.toLocaleString() : 'To be updated'}</li>
                    <li><strong>Service Category:</strong> ${supplierInvoice.serviceCategory}</li>
                    <li><strong>Status:</strong> Awaiting Finance Review & Assignment</li>
                  </ul>
                </div>
                
                <div style="background-color: #f6ffed; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>Description:</strong></p>
                  <p style="font-style: italic;">${supplierInvoice.description}</p>
                </div>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>Action Required:</strong></p>
                  <ol>
                    <li>Review and complete invoice details if needed</li>
                    <li>Assign to appropriate department for approval</li>
                  </ol>
                </div>
                
                <p>
                  <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/finance/supplier-invoices" 
                     style="background-color: #1890ff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">
                    Review & Assign Invoice
                  </a>
                </p>
              </div>
            </div>
          `
        }).catch(error => ({ error, type: 'finance' }))
      );
    }

    // 2. Confirm to supplier
    notifications.push(
      sendEmail({
        to: supplier.email,
        subject: 'Invoice Submitted Successfully - Pending Finance Review',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; border-left: 4px solid #52c41a;">
              <h3>Invoice Submission Confirmation</h3>
              <p>Dear ${supplier.supplierDetails.contactName},</p>
              
              <p>Your invoice has been submitted successfully and is now being reviewed by our finance team.</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Submission Details:</strong></p>
                <ul>
                  <li><strong>Invoice Number:</strong> ${supplierInvoice.invoiceNumber}</li>
                  <li><strong>PO Number:</strong> ${supplierInvoice.poNumber}</li>
                  <li><strong>Submission Date:</strong> ${new Date().toLocaleDateString('en-GB')}</li>
                  <li><strong>Status:</strong> Pending Finance Review</li>
                  <li><strong>Files Attached:</strong> ${Object.keys(uploadedFiles).length > 0 ? Object.keys(uploadedFiles).join(', ') : 'None'}</li>
                </ul>
              </div>
              
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>What Happens Next:</strong></p>
                <ol>
                  <li>Finance team will review your submission</li>
                  <li>They may update invoice details if needed</li>
                  <li>Invoice will be assigned to the appropriate department</li>
                  <li>Department supervisors will review and approve sequentially</li>
                  <li>Once approved, finance will process the payment</li>
                  <li>You'll receive notifications at each step</li>
                </ol>
              </div>
              
              <p>You can track the status of your invoices in the supplier portal.</p>
              <p>Thank you for your business!</p>
            </div>
          </div>
        `
      }).catch(error => ({ error, type: 'supplier' }))
    );

    // Send all notifications
    const notificationResults = await Promise.allSettled(notifications);
    notificationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      } else {
        console.log(`Notification ${index} sent successfully`);
      }
    });

    console.log('=== SUPPLIER INVOICE SUBMITTED SUCCESSFULLY ===');
    res.status(201).json({
      success: true,
      message: 'Supplier invoice submitted successfully and is pending finance review',
      data: {
        ...supplierInvoice.toObject(),
        needsFinanceReview: supplierInvoice.initialSubmission,
        providedFields: supplierInvoice.supplierProvidedFields
      }
    });

  } catch (error) {
    console.error('=== SUPPLIER INVOICE SUBMISSION FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit supplier invoice'
    });
  }
};

// Get supplier's invoices
exports.getSupplierInvoices = async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    const filter = { supplier: req.supplier.userId };
    if (status) filter.approvalStatus = status;
    if (startDate || endDate) {
      filter.uploadedDate = {};
      if (startDate) filter.uploadedDate.$gte = new Date(startDate);
      if (endDate) filter.uploadedDate.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const invoices = await SupplierInvoice.find(filter)
      .populate('supplier', 'supplierDetails.companyName supplierDetails.contactName email')
      .populate('assignedBy', 'fullName email')
      .populate('approvalChain.approver.userId', 'fullName email')
      .sort({ uploadedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await SupplierInvoice.countDocuments(filter);
    
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
    console.error('Error fetching supplier invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices'
    });
  }
};

// Get specific supplier invoice details
exports.getSupplierInvoiceDetails = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await SupplierInvoice.findById(invoiceId)
      .populate('supplier', 'supplierDetails email')
      .populate('assignedBy', 'fullName email')
      .populate('approvalChain.approver.userId', 'fullName email')
      .populate('financeReview.reviewedBy', 'fullName email');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }
    
    // Check if current user has permission to view
    let canView = false;
    
    if (req.supplier && invoice.supplier._id.toString() === req.supplier.userId) {
      canView = true; // Supplier can view their own invoices
    } else if (req.user && ['admin', 'finance'].includes(req.user.role)) {
      canView = true; // Admin and finance can view all
    } else if (req.user && invoice.approvalChain.some(step => step.approver.email === req.user.email)) {
      canView = true; // Approvers can view invoices in their chain
    }
    
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this invoice'
      });
    }
    
    res.json({
      success: true,
      data: {
        ...invoice.toJSON(),
        approvalHistory: invoice.getApprovalHistory(),
        currentApprover: invoice.getCurrentApprover(),
        approvalProgress: invoice.approvalProgress,
        daysUntilDue: invoice.daysUntilDue
      }
    });
    
  } catch (error) {
    console.error('Error fetching supplier invoice details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice details'
    });
  }
};

// Get all supplier invoices for finance management
exports.getSupplierInvoicesForFinance = async (req, res) => {
  try {
    const { status, serviceCategory, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (status) filter.approvalStatus = status;
    if (serviceCategory) filter.serviceCategory = serviceCategory;
    if (startDate || endDate) {
      filter.uploadedDate = {};
      if (startDate) filter.uploadedDate.$gte = new Date(startDate);
      if (endDate) filter.uploadedDate.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const invoices = await SupplierInvoice.find(filter)
      .populate('supplier', 'supplierDetails email')
      .populate('assignedBy', 'fullName email')
      .populate('approvalChain.approver.userId', 'fullName email')
      .sort({ uploadedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await SupplierInvoice.countDocuments(filter);
    
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
    console.error('Error fetching supplier invoices for finance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supplier invoices'
    });
  }
};

// Assign supplier invoice to department and create approval chain
exports.assignSupplierInvoiceToDepartment = async (req, res) => {
  try {
    console.log('=== ASSIGNING SUPPLIER INVOICE TO DEPARTMENT ===');
    const { invoiceId } = req.params;
    const { department, comments, updateDetails } = req.body;
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department is required'
      });
    }
    
    const invoice = await SupplierInvoice.findById(invoiceId)
      .populate('supplier', 'supplierDetails email');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }
    
    if (invoice.approvalStatus !== 'pending_finance_assignment') {
      return res.status(400).json({
        success: false,
        message: 'Invoice has already been assigned or processed'
      });
    }
    
    console.log('Assigning supplier invoice:', invoice.invoiceNumber, 'to department:', department);
    
    // Option 1: Just assign (like employee invoices)
    if (!updateDetails) {
      invoice.assignToDepartment(department, req.user.userId);
    } else {
      // Option 2: Update details and assign in one step
      invoice.processAndAssign(department, req.user.userId, updateDetails);
    }
    
    // Add comments if provided
    if (comments) {
      invoice.financeReview = {
        ...invoice.financeReview,
        finalComments: comments
      };
    }
    
    await invoice.save();
    
    console.log('Supplier invoice assigned successfully. First approver:', invoice.getCurrentApprover()?.approver.name);
    
    await invoice.populate('assignedBy', 'fullName email');
    
    console.log('=== SUPPLIER INVOICE ASSIGNED SUCCESSFULLY ===');
    
    res.json({
      success: true,
      message: 'Supplier invoice assigned to department successfully',
      data: invoice
    });
    
  } catch (error) {
    console.error('=== SUPPLIER INVOICE ASSIGNMENT FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to assign supplier invoice to department'
    });
  }
};



exports.updateSupplierInvoiceDetails = async (req, res) => {
  try {
    console.log('=== UPDATING SUPPLIER INVOICE DETAILS ===');
    const { invoiceId } = req.params;
    const updateDetails = req.body;
    
    const invoice = await SupplierInvoice.findById(invoiceId)
      .populate('supplier', 'supplierDetails email');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }
    
    if (invoice.approvalStatus !== 'pending_finance_assignment') {
      return res.status(400).json({
        success: false,
        message: 'Invoice details can only be updated while pending finance assignment'
      });
    }
    
    // Update the details
    invoice.updateFinanceDetails(updateDetails, req.user.userId);
    await invoice.save();
    
    console.log('=== SUPPLIER INVOICE DETAILS UPDATED ===');
    
    res.json({
      success: true,
      message: 'Supplier invoice details updated successfully',
      data: {
        ...invoice.toObject(),
        recommendations: invoice.getFinanceRecommendations(),
        hasMinimumInfo: invoice.hasMinimumInfo
      }
    });
    
  } catch (error) {
    console.error('=== SUPPLIER INVOICE DETAILS UPDATE FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update supplier invoice details'
    });
  }
};


exports.bulkAssignSupplierInvoices = async (req, res) => {
  try {
    console.log('=== BULK ASSIGNING SUPPLIER INVOICES ===');
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
    
    console.log(`Attempting to assign ${invoiceIds.length} invoices to department: ${department}`);
    
    // FIXED: Department name mapping to handle variations
    const departmentMapping = {
      'HR & Admin': 'HR & Admin',
      'HR/Admin': 'HR & Admin',
      'Technical': 'Technical',
      'Business Development': 'Business Development & Supply Chain',
      'Business Dev': 'Business Development & Supply Chain',
      'Supply Chain': 'Supply Chain',
      'Finance': 'Finance'
    };
    
    const mappedDepartment = departmentMapping[department] || department;
    console.log(`Mapped department: ${department} -> ${mappedDepartment}`);
    
    const results = {
      successful: [],
      failed: []
    };
    
    // Process each invoice individually to provide detailed error reporting
    for (const invoiceId of invoiceIds) {
      try {
        console.log(`Processing invoice ID: ${invoiceId}`);
        
        const invoice = await SupplierInvoice.findById(invoiceId)
          .populate('supplier', 'supplierDetails email');
        
        if (!invoice) {
          results.failed.push({ 
            invoiceId, 
            error: 'Invoice not found' 
          });
          continue;
        }
        
        console.log(`Found invoice: ${invoice.invoiceNumber}, Status: ${invoice.approvalStatus}`);
        
        if (invoice.approvalStatus !== 'pending_finance_assignment') {
          results.failed.push({ 
            invoiceId, 
            invoiceNumber: invoice.invoiceNumber,
            error: 'Invoice already assigned or processed',
            currentStatus: invoice.approvalStatus
          });
          continue;
        }
        
        // FIXED: Use the department mapping in the assignment
        console.log(`Assigning invoice ${invoice.invoiceNumber} to department: ${mappedDepartment}`);
        
        // Set the department directly to avoid enum validation issues
        invoice.assignedDepartment = mappedDepartment;
        invoice.assignedBy = req.user.userId;
        invoice.assignmentDate = new Date();
        invoice.assignmentTime = new Date().toTimeString().split(' ')[0];
        invoice.approvalStatus = 'pending_department_approval';
        
        // Get approval chain using service category primarily, fall back to department
        const { getSupplierApprovalChain } = require('../config/supplierApprovalChain');
        const chain = getSupplierApprovalChain(department, invoice.serviceCategory);
        
        if (!chain || chain.length === 0) {
          results.failed.push({ 
            invoiceId, 
            invoiceNumber: invoice.invoiceNumber,
            error: `No approval chain found for department: ${department}, service category: ${invoice.serviceCategory}`
          });
          continue;
        }
        
        // Create approval chain
        invoice.approvalChain = chain.map(step => ({
          level: step.level,
          approver: {
            name: step.approver,
            email: step.email,
            role: step.role,
            department: step.department
          },
          status: 'pending',
          activatedDate: step.level === 1 ? new Date() : null
        }));

        invoice.currentApprovalLevel = 1;
        
        // Update finance review
        if (comments) {
          invoice.financeReview = {
            reviewedBy: req.user.userId,
            reviewDate: new Date(),
            reviewTime: new Date().toTimeString().split(' ')[0],
            status: 'assigned',
            finalComments: comments
          };
        }
        
        // Mark as no longer initial submission
        invoice.initialSubmission = false;
        
        // Calculate processing time
        if (invoice.metadata) {
          invoice.metadata.submissionToAssignmentTime = 
            (invoice.assignmentDate - invoice.uploadedDate) / (1000 * 60 * 60 * 24);
        }
        
        // Save the invoice
        await invoice.save();
        
        const firstApprover = invoice.approvalChain[0];
        results.successful.push({
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          supplierName: invoice.supplierDetails.companyName,
          assignedDepartment: invoice.assignedDepartment,
          firstApprover: firstApprover?.approver.name || 'N/A',
          approvalChainLevels: invoice.approvalChain.length
        });
        
        console.log(`✓ Successfully assigned ${invoice.invoiceNumber} to ${invoice.assignedDepartment}. First approver: ${firstApprover?.approver.name}`);
        
      } catch (error) {
        console.error(`Failed to assign supplier invoice ${invoiceId}:`, error);
        results.failed.push({ 
          invoiceId, 
          error: error.message || 'Assignment failed',
          details: error.name === 'ValidationError' ? Object.keys(error.errors).join(', ') : undefined
        });
      }
    }
    
    const totalSuccessful = results.successful.length;
    const totalFailed = results.failed.length;
    
    console.log(`Bulk supplier invoice assignment completed: ${totalSuccessful} successful, ${totalFailed} failed`);
    
    // Log failed assignments for debugging
    if (results.failed.length > 0) {
      console.log('Failed assignments:', JSON.stringify(results.failed, null, 2));
    }
    
    res.json({
      success: totalSuccessful > 0, // Consider it successful if at least one succeeded
      message: `Bulk assignment completed: ${totalSuccessful} successful, ${totalFailed} failed`,
      data: results,
      summary: {
        total: invoiceIds.length,
        successful: totalSuccessful,
        failed: totalFailed,
        successRate: Math.round((totalSuccessful / invoiceIds.length) * 100)
      }
    });
    
  } catch (error) {
    console.error('=== BULK SUPPLIER INVOICE ASSIGNMENT FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Bulk assignment failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Also update the single assignment method for consistency
exports.assignSupplierInvoiceToDepartment = async (req, res) => {
  try {
    console.log('=== ASSIGNING SUPPLIER INVOICE TO DEPARTMENT ===');
    const { invoiceId } = req.params;
    const { department, comments, updateDetails } = req.body;
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department is required'
      });
    }
    
    const invoice = await SupplierInvoice.findById(invoiceId)
      .populate('supplier', 'supplierDetails email');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }
    
    if (invoice.approvalStatus !== 'pending_finance_assignment') {
      return res.status(400).json({
        success: false,
        message: 'Invoice has already been assigned or processed',
        currentStatus: invoice.approvalStatus
      });
    }
    
    console.log(`Assigning supplier invoice: ${invoice.invoiceNumber} to department: ${department}`);
    
    // FIXED: Department name mapping
    const departmentMapping = {
      'HR & Admin': 'HR & Admin',
      'HR/Admin': 'HR & Admin',
      'Technical': 'Technical',
      'Business Development': 'Business Development & Supply Chain',
      'Business Dev': 'Business Development & Supply Chain',
      'Supply Chain': 'Supply Chain',
      'Finance': 'Finance'
    };
    
    const mappedDepartment = departmentMapping[department] || department;
    
    // Update details if provided (optional feature)
    if (updateDetails) {
      invoice.updateFinanceDetails(updateDetails, req.user.userId);
    }
    
    // Assign to department using mapped name
    invoice.assignedDepartment = mappedDepartment;
    invoice.assignedBy = req.user.userId;
    invoice.assignmentDate = new Date();
    invoice.assignmentTime = new Date().toTimeString().split(' ')[0];
    invoice.approvalStatus = 'pending_department_approval';
    
    // Get approval chain
    const { getSupplierApprovalChain } = require('../config/supplierApprovalChain');
    const chain = getSupplierApprovalChain(department, invoice.serviceCategory);
    
    if (!chain || chain.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No approval chain found for department: ${department}, service category: ${invoice.serviceCategory}`
      });
    }
    
    // Create approval chain
    invoice.approvalChain = chain.map(step => ({
      level: step.level,
      approver: {
        name: step.approver,
        email: step.email,
        role: step.role,
        department: step.department
      },
      status: 'pending',
      activatedDate: step.level === 1 ? new Date() : null
    }));

    invoice.currentApprovalLevel = 1;
    
    // Add comments if provided
    if (comments) {
      invoice.financeReview = {
        ...invoice.financeReview,
        reviewedBy: req.user.userId,
        reviewDate: new Date(),
        reviewTime: new Date().toTimeString().split(' ')[0],
        status: 'assigned',
        finalComments: comments
      };
    }
    
    // Mark as processed
    invoice.initialSubmission = false;
    
    await invoice.save();
    
    console.log(`Supplier invoice assigned successfully. First approver: ${invoice.approvalChain[0]?.approver.name}`);
    
    await invoice.populate('assignedBy', 'fullName email');
    
    console.log('=== SUPPLIER INVOICE ASSIGNED SUCCESSFULLY ===');
    
    res.json({
      success: true,
      message: 'Supplier invoice assigned to department successfully',
      data: {
        ...invoice.toObject(),
        currentApprover: invoice.getCurrentApprover(),
        approvalProgress: invoice.approvalProgress
      }
    });
    
  } catch (error) {
    console.error('=== SUPPLIER INVOICE ASSIGNMENT FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to assign supplier invoice to department',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Process supplier invoice approval step
exports.processSupplierApprovalStep = async (req, res) => {
  try {
    console.log('=== PROCESSING SUPPLIER INVOICE APPROVAL STEP ===');
    const { invoiceId } = req.params;
    const { decision, comments } = req.body;
    
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Valid decision (approved/rejected) is required'
      });
    }
    
    const invoice = await SupplierInvoice.findById(invoiceId)
      .populate('supplier', 'supplierDetails email');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }
    
    if (invoice.approvalStatus !== 'pending_department_approval') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is not pending department approval'
      });
    }
    
    const user = await User.findById(req.user.userId).select('email fullName');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if this user can approve at the current level
    if (!invoice.canUserApprove(user.email)) {
      const currentApprover = invoice.getCurrentApprover();
      return res.status(403).json({
        success: false,
        message: `You are not authorized to approve this invoice at this time. Current approver: ${currentApprover?.approver.name} (Level ${currentApprover?.level})`
      });
    }
    
    console.log(`Processing ${decision} by ${user.email} at level ${invoice.currentApprovalLevel}`);
    
    // Process the approval step
    const processedStep = invoice.processApprovalStep(user.email, decision, comments, req.user.userId);
    await invoice.save();
    
    console.log('Supplier invoice approval step processed:', processedStep);
    
    // Send notifications based on decision
    const notifications = [];
    
    if (decision === 'approved') {
      const nextApprover = invoice.getCurrentApprover();
      
      if (nextApprover) {
        // Notify next approver
        console.log(`Notifying next approver: ${nextApprover.approver.name} at level ${nextApprover.level}`);
        // Notification will be sent by post-save middleware
      } else {
        // All approvals complete - notify finance for processing
        console.log('All supplier invoice approvals completed - notifying finance for processing');
        
        const financeUsers = await User.find({ role: 'finance' }).select('email fullName');
        if (financeUsers.length > 0) {
          notifications.push(
            sendEmail({
              to: financeUsers.map(u => u.email),
              subject: `Supplier Invoice Ready for Processing - ${invoice.invoiceNumber}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #d4edda; padding: 20px; border-radius: 8px;">
                    <h2>Supplier Invoice Ready for Processing</h2>
                    <p>A supplier invoice has completed the full approval chain and is ready for finance processing and payment.</p>
                    
                    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <ul>
                        <li><strong>Supplier:</strong> ${invoice.supplierDetails.companyName}</li>
                        <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                        <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
                        <li><strong>Amount:</strong> ${invoice.currency} ${invoice.invoiceAmount.toLocaleString()}</li>
                        <li><strong>Service Category:</strong> ${invoice.serviceCategory}</li>
                        <li><strong>Department:</strong> ${invoice.assignedDepartment}</li>
                        <li><strong>Final Approver:</strong> ${user.fullName}</li>
                        <li><strong>Status:</strong> Ready for Finance Processing</li>
                      </ul>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/finance/supplier-invoices" 
                         style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Process Invoice
                      </a>
                    </div>
                  </div>
                </div>
              `
            }).catch(error => ({ error, success: false }))
          );
        }
      }
      
      // Notify supplier of approval progress
      notifications.push(
        sendEmail({
          to: invoice.supplier.email,
          subject: `Invoice Approval Update - ${invoice.invoiceNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: ${nextApprover ? '#e2e3e5' : '#d4edda'}; padding: 20px; border-radius: 8px;">
                <h2>Invoice Approval Update</h2>
                <p>Dear ${invoice.supplierDetails.contactName},</p>
                <p>Your invoice has been <strong style="color: #28a745;">approved</strong> by ${user.fullName} at Level ${processedStep.level}.</p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <ul>
                    <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                    <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
                    <li><strong>Amount:</strong> ${invoice.currency} ${invoice.invoiceAmount.toLocaleString()}</li>
                    <li><strong>Approved by:</strong> ${user.fullName}</li>
                    <li><strong>Current Status:</strong> ${nextApprover ? 'Pending Next Approval' : 'FULLY APPROVED'}</li>
                  </ul>
                </div>
                
                ${nextApprover ? `
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px;">
                  <p><strong>Next Step:</strong> Your invoice is now waiting for approval from ${nextApprover.approver.name} (${nextApprover.approver.role}).</p>
                </div>
                ` : `
                <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px;">
                  <p><strong>Great News:</strong> Your invoice has completed all approvals and is now being processed for payment by the finance team!</p>
                </div>
                `}
              </div>
            </div>
          `
        }).catch(error => ({ error, success: false }))
      );
      
    } else {
      // Invoice rejected
      console.log(`Supplier invoice rejected by ${user.fullName} at level ${processedStep.level}`);
      
      // Notify supplier
      notifications.push(
        sendEmail({
          to: invoice.supplier.email,
          subject: `Invoice Rejected - ${invoice.invoiceNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px;">
                <h2>Invoice Rejected</h2>
                <p>Dear ${invoice.supplierDetails.contactName},</p>
                <p>Unfortunately, your invoice has been rejected by ${user.fullName} at Level ${processedStep.level}.</p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <ul>
                    <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                    <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
                    <li><strong>Amount:</strong> ${invoice.currency} ${invoice.invoiceAmount.toLocaleString()}</li>
                    <li><strong>Rejected by:</strong> ${user.fullName}</li>
                    <li><strong>Status:</strong> REJECTED</li>
                  </ul>
                </div>
                
                ${comments ? `
                <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px;">
                  <p><strong>Rejection Reason:</strong> "${comments}"</p>
                </div>
                ` : ''}
                
                <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px;">
                  <h4>What You Can Do:</h4>
                  <ul>
                    <li>Review the rejection reason above</li>
                    <li>Contact ${user.fullName} for clarification</li>
                    <li>Submit a corrected invoice if needed</li>
                    <li>Reach out to the finance department for guidance</li>
                  </ul>
                </div>
              </div>
            </div>
          `
        }).catch(error => ({ error, success: false }))
      );
    }
    
    // Send all notifications
    await Promise.allSettled(notifications);
    
    console.log('=== SUPPLIER INVOICE APPROVAL STEP PROCESSED SUCCESSFULLY ===');
    
    res.json({
      success: true,
      message: `Supplier invoice ${decision} successfully`,
      data: {
        ...invoice.toObject(),
        currentApprover: invoice.getCurrentApprover(),
        approvalProgress: invoice.approvalProgress
      },
      processedStep: processedStep
    });
    
  } catch (error) {
    console.error('=== SUPPLIER INVOICE APPROVAL STEP PROCESSING FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to process supplier invoice approval step'
    });
  }
};

// Get pending supplier approvals for current user
exports.getPendingSupplierApprovalsForUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email fullName');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('Fetching pending supplier approvals for:', user.email);
    
    // Get supplier invoices where this user is the current active approver
    const pendingInvoices = await SupplierInvoice.getPendingForApprover(user.email);
    
    console.log(`Found ${pendingInvoices.length} pending supplier invoices for ${user.email}`);
    
    // Add additional details for each invoice
    const invoicesWithDetails = pendingInvoices.map(invoice => ({
      ...invoice.toObject(),
      currentApprover: invoice.getCurrentApprover(),
      approvalProgress: invoice.approvalProgress,
      canUserApprove: invoice.canUserApprove(user.email),
      daysUntilDue: invoice.daysUntilDue
    }));
    
    res.json({
      success: true,
      data: invoicesWithDetails,
      count: invoicesWithDetails.length,
      userInfo: {
        email: user.email,
        name: user.fullName
      }
    });
    
  } catch (error) {
    console.error('Error fetching pending supplier approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending supplier approvals'
    });
  }
};

// Process supplier invoice payment
exports.processSupplierInvoicePayment = async (req, res) => {
  try {
    console.log('=== PROCESSING SUPPLIER INVOICE PAYMENT ===');
    const { invoiceId } = req.params;
    const { 
      paymentAmount, 
      paymentMethod, 
      transactionReference, 
      bankReference, 
      paymentDate,
      comments 
    } = req.body;
    
    const invoice = await SupplierInvoice.findById(invoiceId)
      .populate('supplier', 'supplierDetails email');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }
    
    if (invoice.approvalStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Invoice must be fully approved before payment processing'
      });
    }
    
    // Update payment details
    invoice.paymentStatus = 'paid';
    invoice.approvalStatus = 'paid';
    invoice.paymentDetails = {
      amountPaid: paymentAmount || invoice.invoiceAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      transactionReference,
      bankReference,
      paidBy: req.user.userId
    };
    
    // Update finance review
    invoice.financeReview = {
      ...invoice.financeReview,
      reviewedBy: req.user.userId,
      reviewDate: new Date(),
      reviewTime: new Date().toTimeString().split(' ')[0],
      status: 'paid',
      finalComments: comments,
      paymentDate: invoice.paymentDetails.paymentDate,
      paymentReference: transactionReference,
      paymentAmount: invoice.paymentDetails.amountPaid,
      paymentMethod: invoice.paymentDetails.paymentMethod
    };
    
    await invoice.save();
    
    // Notify supplier of payment
    if (invoice.supplier.email) {
      await sendEmail({
        to: invoice.supplier.email,
        subject: `Payment Processed - Invoice ${invoice.invoiceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px;">
              <h2>Payment Processed Successfully</h2>
              <p>Dear ${invoice.supplierDetails.contactName},</p>
              <p>Your invoice payment has been processed successfully.</p>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Payment Details</h3>
                <ul>
                  <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                  <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
                  <li><strong>Amount Paid:</strong> ${invoice.currency} ${invoice.paymentDetails.amountPaid.toLocaleString()}</li>
                  <li><strong>Payment Date:</strong> ${invoice.paymentDetails.paymentDate.toLocaleDateString('en-GB')}</li>
                  <li><strong>Payment Method:</strong> ${invoice.paymentDetails.paymentMethod}</li>
                  ${transactionReference ? `<li><strong>Transaction Reference:</strong> ${transactionReference}</li>` : ''}
                  ${bankReference ? `<li><strong>Bank Reference:</strong> ${bankReference}</li>` : ''}
                </ul>
              </div>
              
              ${comments ? `
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px;">
                <p><strong>Finance Comments:</strong> "${comments}"</p>
              </div>
              ` : ''}
              
              <p>Thank you for your business with Grato Engineering.</p>
            </div>
          </div>
        `
      }).catch(error => {
        console.error('Failed to send payment notification:', error);
      });
    }
    
    console.log('=== SUPPLIER INVOICE PAYMENT PROCESSED ===');
    
    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: invoice
    });
    
  } catch (error) {
    console.error('=== FAILED TO PROCESS SUPPLIER INVOICE PAYMENT ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to process payment'
    });
  }
};

// Mark supplier invoice as processed (final finance step)
exports.markSupplierInvoiceAsProcessed = async (req, res) => {
  try {
    console.log('=== MARKING SUPPLIER INVOICE AS PROCESSED ===');
    const { invoiceId } = req.params;
    const { comments } = req.body;

    const invoice = await SupplierInvoice.findById(invoiceId)
      .populate('supplier', 'supplierDetails email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }

    if (invoice.approvalStatus !== 'pending_finance_processing') {
      return res.status(400).json({
        success: false,
        message: 'Invoice must be pending finance processing to mark as processed'
      });
    }

    // Update invoice status
    invoice.approvalStatus = 'processed';
    
    // Update finance review
    invoice.financeReview = {
      ...invoice.financeReview,
      reviewedBy: req.user.userId,
      reviewDate: new Date(),
      reviewTime: new Date().toTimeString().split(' ')[0],
      status: 'processed',
      finalComments: comments || 'Invoice processed and ready for payment'
    };

    await invoice.save();

    // Send notification to supplier
    if (invoice.supplier && invoice.supplier.email) {
      await sendEmail({
        to: invoice.supplier.email,
        subject: `Invoice Processed - ${invoice.invoiceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; border-left: 4px solid #0bc5ea;">
              <h2 style="color: #333; margin-top: 0;">Invoice Processed</h2>
              <p style="color: #555;">Dear ${invoice.supplierDetails.companyName},</p>
              <p>Your invoice has been processed by our finance team and is now ready for payment.</p>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Invoice Details</h3>
                <ul style="list-style: none; padding: 0;">
                  <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                  <li><strong>PO Number:</strong> ${invoice.poNumber}</li>
                  <li><strong>Amount:</strong> ${invoice.currency} ${invoice.invoiceAmount.toLocaleString()}</li>
                  <li><strong>Status:</strong> Processed - Ready for Payment</li>
                  <li><strong>Processed Date:</strong> ${new Date().toLocaleDateString('en-GB')}</li>
                </ul>
              </div>
              
              ${comments ? `
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p><strong>Finance Comments:</strong></p>
                <p style="font-style: italic;">${comments}</p>
              </div>
              ` : ''}
              
              <p>Payment will be processed according to our payment terms. You will receive a separate notification once payment is completed.</p>
              
              <p>Thank you for your business with Grato Engineering.</p>
            </div>
          </div>
        `
      }).catch(error => {
        console.error('Failed to send invoice processed notification:', error);
      });
    }

    console.log('=== SUPPLIER INVOICE MARKED AS PROCESSED ===');

    res.json({
      success: true,
      message: 'Invoice marked as processed successfully',
      data: {
        ...invoice.toObject(),
        currentApprover: invoice.getCurrentApprover(),
        approvalProgress: invoice.approvalProgress
      }
    });

  } catch (error) {
    console.error('=== FAILED TO MARK SUPPLIER INVOICE AS PROCESSED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to mark invoice as processed'
    });
  }
};

// Bulk assign supplier invoices
exports.bulkAssignSupplierInvoices = async (req, res) => {
  try {
    console.log('=== BULK ASSIGNING SUPPLIER INVOICES ===');
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
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (const invoiceId of invoiceIds) {
      try {
        const invoice = await SupplierInvoice.findById(invoiceId)
          .populate('supplier', 'supplierDetails email');
        
        if (!invoice) {
          results.failed.push({ invoiceId, error: 'Invoice not found' });
          continue;
        }
        
        if (invoice.approvalStatus !== 'pending_finance_assignment') {
          results.failed.push({ 
            invoiceId, 
            invoiceNumber: invoice.invoiceNumber,
            error: 'Invoice already assigned or processed' 
          });
          continue;
        }
        
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
          invoiceNumber: invoice.invoiceNumber,
          supplierName: invoice.supplierDetails.companyName,
          firstApprover: invoice.getCurrentApprover()?.approver.name
        });
        
        console.log(`Successfully assigned ${invoice.invoiceNumber} to ${department}`);
        
      } catch (error) {
        console.error(`Failed to assign supplier invoice ${invoiceId}:`, error);
        results.failed.push({ 
          invoiceId, 
          error: error.message || 'Assignment failed' 
        });
      }
    }
    
    console.log(`Bulk supplier invoice assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`);
    
    res.json({
      success: true,
      message: `Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results
    });
    
  } catch (error) {
    console.error('=== BULK SUPPLIER INVOICE ASSIGNMENT FAILED ===', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Bulk assignment failed'
    });
  }
};

// Get supplier invoice analytics
exports.getSupplierInvoiceAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, serviceCategory, supplierType } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.uploadedDate = {};
      if (startDate) dateFilter.uploadedDate.$gte = new Date(startDate);
      if (endDate) dateFilter.uploadedDate.$lte = new Date(endDate);
    }
    
    const matchFilter = { ...dateFilter };
    if (serviceCategory) matchFilter.serviceCategory = serviceCategory;
    
    // Overall statistics
    const overallStats = await SupplierInvoice.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$approvalStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$invoiceAmount' },
          avgAmount: { $avg: '$invoiceAmount' },
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
    
    // By service category
    const categoryStats = await SupplierInvoice.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$serviceCategory',
          count: { $sum: 1 },
          totalAmount: { $sum: '$invoiceAmount' },
          avgAmount: { $avg: '$invoiceAmount' },
          statuses: {
            $push: '$approvalStatus'
          }
        }
      },
      {
        $project: {
          _id: 1,
          count: 1,
          totalAmount: 1,
          avgAmount: 1,
          pendingCount: {
            $size: {
              $filter: {
                input: '$statuses',
                cond: { $in: ['$this', ['pending_finance_assignment', 'pending_department_approval']] }
              }
            }
          },
          approvedCount: {
            $size: {
              $filter: {
                input: '$statuses',
                cond: { $eq: ['$this', 'approved'] }
              }
            }
          },
          paidCount: {
            $size: {
              $filter: {
                input: '$statuses',
                cond: { $eq: ['$this', 'paid'] }
              }
            }
          }
        }
      }
    ]);
    
    // Top suppliers
    const topSuppliers = await SupplierInvoice.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$supplier',
          supplierName: { $first: '$supplierDetails.companyName' },
          supplierType: { $first: '$supplierDetails.supplierType' },
          count: { $sum: 1 },
          totalAmount: { $sum: '$invoiceAmount' }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 }
    ]);
    
    // Recent activity
    const recentActivity = await SupplierInvoice.find(dateFilter)
      .populate('supplier', 'supplierDetails')
      .populate('assignedBy', 'fullName')
      .sort({ updatedAt: -1 })
      .limit(15)
      .select('invoiceNumber supplierDetails approvalStatus invoiceAmount serviceCategory updatedAt currentApprovalLevel');
    
    res.json({
      success: true,
      data: {
        overall: overallStats,
        byCategory: categoryStats,
        topSuppliers,
        recentActivity
      }
    });
    
  } catch (error) {
    console.error('Error fetching supplier invoice analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
};




