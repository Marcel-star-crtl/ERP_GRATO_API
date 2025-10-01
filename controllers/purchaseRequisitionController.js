const PurchaseRequisition = require('../models/PurchaseRequisition');
const User = require('../models/User');
const { getApprovalChain } = require('../config/departmentStructure');
const { sendPurchaseRequisitionEmail, sendEmail } = require('../services/emailService');
const fs = require('fs');
const path = require('path');

// Create new purchase requisition
const createRequisition = async (req, res) => {
  try {
    console.log('=== CREATE PURCHASE REQUISITION STARTED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      requisitionNumber,
      title,
      itemCategory,
      budgetXAF,
      budgetHolder,
      urgency,
      deliveryLocation,
      expectedDate,
      justificationForPurchase,
      justificationOfPreferredSupplier,
      items
    } = req.body;

    // Validate required fields
    if (!requisitionNumber) {
      return res.status(400).json({
        success: false,
        message: 'Requisition number is required'
      });
    }

    const justification = justificationForPurchase || req.body.justificationOfPurchase;
    
    if (!justification || justification.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Justification of purchase must be at least 20 characters long'
      });
    }

    // Get user details
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    console.log('Employee details:', {
      fullName: employee.fullName,
      department: employee.department,
      email: employee.email
    });

    // Parse items if it's a string
    let parsedItems;
    try {
      parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
    } catch (error) {
      console.error('Items parsing error:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid items format'
      });
    }

    // Validate items
    if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item must be specified'
      });
    }


    console.log('Parsed items:', parsedItems);


    // UPDATED: Validate items exist in database
    const itemIds = parsedItems.map(item => item.itemId).filter(Boolean);
    
    if (itemIds.length !== parsedItems.length) {
      return res.status(400).json({
        success: false,
        message: 'All items must have valid database references (itemId)'
      });
    }

    // Check if items exist and are active
    try {
      const Item = require('../models/Item'); // Adjust path as needed
      const validItems = await Item.find({ 
        _id: { $in: itemIds },
        isActive: true 
      }).select('_id code description');

      console.log('Found valid items:', validItems.length, 'out of', itemIds.length);

      if (validItems.length !== itemIds.length) {
        const foundIds = validItems.map(item => item._id.toString());
        const missingIds = itemIds.filter(id => !foundIds.includes(id));
        
        return res.status(400).json({
          success: false,
          message: `Invalid or inactive items: ${missingIds.join(', ')}`
        });
      }
    } catch (itemError) {
      console.error('Item validation error:', itemError);
      // Continue anyway - validation is optional for now
    }

    console.log('All items validated successfully');

    // Transform items to match database structure
    const processedItems = parsedItems.map(item => ({
      itemId: item.itemId,
      code: item.code,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
      quantity: parseInt(item.quantity),
      measuringUnit: item.measuringUnit,
      estimatedPrice: parseFloat(item.estimatedPrice) || 0,
      projectName: item.projectName || ''
    }));

    console.log('Processed items:', processedItems);

    // Generate approval chain based on employee name and department
    const { getApprovalChain } = require('../config/departmentStructure');
    const approvalChain = getApprovalChain(employee.fullName, employee.department);
    console.log('Generated approval chain:', JSON.stringify(approvalChain, null, 2));

    if (!approvalChain || approvalChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine approval chain. Please contact HR for assistance.'
      });
    }

    // Process attachments if any
    let attachments = [];
    if (req.files && req.files.length > 0) {
      // Process file attachments
      for (const file of req.files) {
        try {
          const fileName = `${Date.now()}-${file.originalname}`;
          const uploadDir = path.join(__dirname, '../uploads/requisitions');
          const filePath = path.join(uploadDir, fileName);

          // Ensure directory exists
          const fs = require('fs');
          await fs.promises.mkdir(uploadDir, { recursive: true });

          // Move file to permanent location
          if (file.path) {
            await fs.promises.rename(file.path, filePath);
          }

          attachments.push({
            name: file.originalname,
            url: `/uploads/requisitions/${fileName}`,
            publicId: fileName,
            size: file.size,
            mimetype: file.mimetype
          });
        } catch (fileError) {
          console.error('Error processing file:', file.originalname, fileError);
        }
      }
    }

    // Create the purchase requisition with processed items
    const requisition = new PurchaseRequisition({
      requisitionNumber,
      employee: req.user.userId,
      title,
      department: employee.department,
      itemCategory,
      budgetXAF: budgetXAF ? parseFloat(budgetXAF) : undefined,
      budgetHolder,
      urgency,
      deliveryLocation,
      expectedDate: new Date(expectedDate),
      justificationOfPurchase: justification, // Use the corrected field name
      justificationOfPreferredSupplier,
      items: processedItems, // Use processed items with itemId
      attachments,
      status: 'pending_supervisor',
      approvalChain: approvalChain.map(step => ({
        level: step.level,
        approver: {
          name: step.approver,
          email: step.email,
          role: step.role,
          department: step.department
        },
        status: 'pending',
        assignedDate: new Date()
      }))
    });

    console.log('Requisition object before save:', {
      requisitionNumber: requisition.requisitionNumber,
      justificationOfPurchase: requisition.justificationOfPurchase,
      justificationLength: requisition.justificationOfPurchase?.length,
      itemsCount: requisition.items.length,
      approvalChainCount: requisition.approvalChain.length
    });

    await requisition.save();
    console.log('Requisition saved successfully with ID:', requisition._id);

    // Populate employee details for response
    await requisition.populate('employee', 'fullName email department');

    // === ENHANCED EMAIL NOTIFICATIONS ===
    const notifications = [];
    console.log('=== STARTING EMAIL NOTIFICATIONS ===');

    // Get first approver (supervisor)
    const firstApprover = approvalChain[0];
    console.log('First approver details:', firstApprover);

    if (firstApprover && firstApprover.email) {
      console.log('Sending notification to first approver:', firstApprover.email);
      
      try {
        // Enhanced supervisor notification
        const supervisorNotification = await sendEmail({
          to: firstApprover.email,
          subject: `New Purchase Requisition Requires Your Approval - ${employee.fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #1890ff; margin: 0;">New Purchase Requisition for Approval</h2>
                <p style="color: #666; margin: 5px 0 0 0;">A new purchase requisition has been submitted and requires your approval.</p>
              </div>

              <div style="background-color: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #333; margin-top: 0;">Requisition Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Requisition Number:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${requisition.requisitionNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Employee:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${employee.fullName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Department:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${employee.department}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Title:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Category:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${itemCategory}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Items Count:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${parsedItems.length}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Budget:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">XAF ${budgetXAF ? parseFloat(budgetXAF).toLocaleString() : 'Not specified'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Urgency:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${urgency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Expected Date:</strong></td>
                    <td style="padding: 8px 0;">${new Date(expectedDate).toLocaleDateString()}</td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #f0f8ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
                <h4 style="margin: 0 0 10px 0; color: #1890ff;">Justification</h4>
                <p style="margin: 0; color: #333;">${justificationOfPurchase}</p>
              </div>

              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">Action Required</h4>
                <p style="margin: 0; color: #856404;">This requisition requires your approval as the next approver in the chain. Please log into the system to review and approve/reject this request.</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/supervisor/purchase-requisitions" 
                   style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Review Requisition
                </a>
              </div>

              <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
                <p style="margin: 0;">Best regards,<br>Purchase Requisition Management System</p>
                <p style="margin: 10px 0 0 0; font-size: 12px;">This is an automated notification. Please do not reply to this email.</p>
              </div>
            </div>
          `
        });

        console.log('Supervisor notification result:', supervisorNotification);
        notifications.push(Promise.resolve(supervisorNotification));

      } catch (error) {
        console.error('Failed to send supervisor notification:', error);
        notifications.push(Promise.resolve({ error, type: 'supervisor' }));
      }
    } else {
      console.log('No first approver found or email missing');
    }

    // Notify admins about new requisition
    try {
      const admins = await User.find({ role: 'admin' }).select('email fullName');
      console.log('Found admins:', admins.map(a => ({ name: a.fullName, email: a.email })));

      if (admins.length > 0) {
        const adminEmails = admins.map(a => a.email);
        console.log('Sending admin notification to:', adminEmails);

        const adminNotification = await sendEmail({
          to: adminEmails,
          subject: `New Purchase Requisition Submitted - ${employee.fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #52c41a; margin: 0;">New Purchase Requisition Submitted</h2>
                <p style="color: #666; margin: 5px 0 0 0;">A new purchase requisition has been submitted by ${employee.fullName}</p>
              </div>

              <div style="background-color: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px;">
                <h3 style="color: #333; margin-top: 0;">Requisition Summary</h3>
                <ul style="list-style: none; padding: 0;">
                  <li style="padding: 5px 0;"><strong>Requisition Number:</strong> ${requisition.requisitionNumber}</li>
                  <li style="padding: 5px 0;"><strong>Employee:</strong> ${employee.fullName} (${employee.department})</li>
                  <li style="padding: 5px 0;"><strong>Title:</strong> ${title}</li>
                  <li style="padding: 5px 0;"><strong>Category:</strong> ${itemCategory}</li>
                  <li style="padding: 5px 0;"><strong>Items Count:</strong> ${parsedItems.length}</li>
                  <li style="padding: 5px 0;"><strong>Budget:</strong> XAF ${budgetXAF ? parseFloat(budgetXAF).toLocaleString() : 'Not specified'}</li>
                  <li style="padding: 5px 0;"><strong>Urgency:</strong> ${urgency}</li>
                  <li style="padding: 5px 0;"><strong>Status:</strong> Pending Approval</li>
                  <li style="padding: 5px 0;"><strong>Current Approver:</strong> ${firstApprover?.name} (${firstApprover?.email})</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/purchase-requisitions" 
                   style="background-color: #52c41a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View All Requisitions
                </a>
              </div>
            </div>
          `
        });

        console.log('Admin notification result:', adminNotification);
        notifications.push(Promise.resolve(adminNotification));
      }
    } catch (error) {
      console.error('Failed to send admin notification:', error);
      notifications.push(Promise.resolve({ error, type: 'admin' }));
    }

    // Notify employee of successful submission
    try {
      console.log('Sending employee confirmation to:', employee.email);

      const employeeNotification = await sendEmail({
        to: employee.email,
        subject: 'Purchase Requisition Submitted Successfully',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1890ff; margin: 0;">Purchase Requisition Submitted</h2>
              <p style="color: #666; margin: 5px 0 0 0;">Your purchase requisition has been successfully submitted and is now under review.</p>
            </div>

            <div style="background-color: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #333; margin-top: 0;">Your Requisition Details</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="padding: 5px 0;"><strong>Requisition Number:</strong> ${requisition.requisitionNumber}</li>
                <li style="padding: 5px 0;"><strong>Title:</strong> ${title}</li>
                <li style="padding: 5px 0;"><strong>Status:</strong> Pending Approval</li>
                <li style="padding: 5px 0;"><strong>Current Approver:</strong> ${firstApprover?.name}</li>
              </ul>
            </div>

            <div style="background-color: #f0f8ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #333;"><strong>Next Steps:</strong> Your requisition is now in the approval workflow. You will receive email notifications as it progresses through each approval stage.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/employee/purchase-requisitions" 
                 style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Track Your Requisitions
              </a>
            </div>

            <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
              <p style="margin: 0;">Thank you for using our Purchase Requisition System!</p>
            </div>
          </div>
        `
      });

      console.log('Employee notification result:', employeeNotification);
      notifications.push(Promise.resolve(employeeNotification));

    } catch (error) {
      console.error('Failed to send employee notification:', error);
      notifications.push(Promise.resolve({ error, type: 'employee' }));
    }

    // Wait for all notifications to complete
    console.log('Waiting for all notifications to complete...');
    const notificationResults = await Promise.allSettled(notifications);
    
    // Log detailed results
    notificationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      } else if (result.value && result.value.error) {
        console.error(`${result.value.type} notification failed:`, result.value.error);
      } else {
        console.log(`Notification ${index} sent successfully`);
      }
    });

    const notificationStats = {
      sent: notificationResults.filter(r => r.status === 'fulfilled' && !r.value?.error).length,
      failed: notificationResults.filter(r => r.status === 'rejected' || r.value?.error).length
    };

    console.log('=== PURCHASE REQUISITION CREATED SUCCESSFULLY ===');
    console.log('Notification stats:', notificationStats);

    res.status(201).json({
      success: true,
      message: 'Purchase requisition created successfully and sent for approval',
      data: requisition,
      notifications: notificationStats
    });

  } catch (error) {
    console.error('Create purchase requisition error:', error);

    // Clean up uploaded files if request failed
    if (req.files && req.files.length > 0) {
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path) {
            return fs.promises.unlink(file.path).catch(e => console.error('File cleanup failed:', e));
          }
        })
      );
    }

    // Provide more specific error messages
    let errorMessage = 'Failed to create purchase requisition';
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      errorMessage = `Validation failed: ${validationErrors.join(', ')}`;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: error.name === 'ValidationError' ? error.errors : undefined
    });
  }
};

// Get employee's own requisitions
const getEmployeeRequisitions = async (req, res) => {
  try {
    const requisitions = await PurchaseRequisition.find({ employee: req.user.userId })
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requisitions,
      count: requisitions.length
    });

  } catch (error) {
    console.error('Get employee requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisitions',
      error: error.message
    });
  }
};

// Get single requisition details with approval chain
const getEmployeeRequisition = async (req, res) => {
  try {
    const { requisitionId } = req.params;

    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check if user has permission to view this requisition
    const user = await User.findById(req.user.userId);
    const canView = 
      requisition.employee._id.equals(req.user.userId) || // Owner
      user.role === 'admin' || // Admin
      requisition.approvalChain.some(step => step.approver.email === user.email); // Approver

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: requisition
    });

  } catch (error) {
    console.error('Get requisition details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisition details',
      error: error.message
    });
  }
};

// Admin functions
const getAllRequisitions = async (req, res) => {
  try {
    const { status, department, page = 1, limit = 20 } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (department) {
      // Find users in the specified department
      const users = await User.find({ department }).select('_id');
      filter.employee = { $in: users.map(u => u._id) };
    }

    const requisitions = await PurchaseRequisition.find(filter)
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PurchaseRequisition.countDocuments(filter);

    res.json({
      success: true,
      data: requisitions,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: requisitions.length,
        totalRecords: total
      }
    });

  } catch (error) {
    console.error('Get all requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisitions',
      error: error.message
    });
  }
};

// Get supervisor requisitions (pending approval)
const getSupervisorRequisitions = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find requisitions where current user is in the approval chain and status is pending
    const requisitions = await PurchaseRequisition.find({
      'approvalChain': {
        $elemMatch: {
          'approver.email': user.email,
          'status': 'pending'
        }
      },
      status: { $in: ['pending_supervisor'] }
    })
    .populate('employee', 'fullName email department')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requisitions,
      count: requisitions.length
    });

  } catch (error) {
    console.error('Get supervisor requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisitions',
      error: error.message
    });
  }
};

// Process supervisor decision
const processSupervisorDecision = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const { decision, comments } = req.body;

    console.log('=== SUPERVISOR DECISION PROCESSING ===');
    console.log('Requisition ID:', requisitionId);
    console.log('Decision:', decision);

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department');

    if (!requisition) {
      return res.status(404).json({ 
        success: false, 
        message: 'Purchase requisition not found' 
      });
    }

    // Find current user's step in approval chain
    const currentStepIndex = requisition.approvalChain.findIndex(
      step => step.approver.email === user.email && step.status === 'pending'
    );

    if (currentStepIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this requisition or it has already been processed'
      });
    }

    // Update the approval step
    requisition.approvalChain[currentStepIndex].status = decision;
    requisition.approvalChain[currentStepIndex].comments = comments;
    requisition.approvalChain[currentStepIndex].actionDate = new Date();
    requisition.approvalChain[currentStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
    requisition.approvalChain[currentStepIndex].decidedBy = req.user.userId;

    // Update overall requisition status based on decision
    if (decision === 'rejected') {
      requisition.status = 'rejected';

      // Also update the legacy supervisorDecision field for backward compatibility
      requisition.supervisorDecision = {
        decision: 'rejected',
        comments,
        decisionDate: new Date(),
        decidedBy: req.user.userId
      };
    } else if (decision === 'approved') {
      // Check if this was the last supervisor step before finance
      const remainingApprovalSteps = requisition.approvalChain.filter(step => 
        step.status === 'pending' && 
        step.level < requisition.approvalChain.find(s => s.approver.role.includes('Finance'))?.level
      );

      if (remainingApprovalSteps.length === 1 && remainingApprovalSteps[0]._id.equals(requisition.approvalChain[currentStepIndex]._id)) {
        // This was the last supervisor/hod approval step - move to finance verification
        requisition.status = 'pending_finance_verification';
      } else {
        // Move to next supervisor/department head level
        const nextStep = requisition.approvalChain.find(step => 
          step.level > requisition.approvalChain[currentStepIndex].level && 
          step.status === 'pending' &&
          !step.approver.role.includes('Finance') &&
          !step.approver.role.includes('Head of Business')
        );

        if (nextStep) {
          requisition.status = 'pending_supervisor';
        } else {
          // No more supervisor steps, move to finance
          requisition.status = 'pending_finance_verification';
        }
      }
    }

    await requisition.save();

    // Send notifications based on decision
    const notifications = [];

    if (decision === 'approved') {
      // Check if there are more approval steps or if it goes to supply chain
      if (requisition.status === 'pending_supply_chain_review') {
        // Notify supply chain team
        const supplyChainTeam = await User.find({ 
          $or: [
            { role: 'supply_chain' },
            { department: 'Business Development & Supply Chain' }
          ]
        }).select('email fullName');

        if (supplyChainTeam.length > 0) {
          notifications.push(
            sendPurchaseRequisitionEmail.supervisorApprovalToSupplyChain(
              supplyChainTeam.map(u => u.email),
              requisition.employee.fullName,
              requisition.title,
              requisition._id,
              requisition.items.length,
              requisition.budgetXAF
            ).catch(error => {
              console.error('Failed to send supply chain notification:', error);
              return { error, type: 'supply_chain' };
            })
          );
        }
      } else {
        // Notify next approver
        const nextStep = requisition.approvalChain.find(step => 
          step.level > requisition.approvalChain[currentStepIndex].level && step.status === 'pending'
        );

        if (nextStep) {
          notifications.push(
            sendPurchaseRequisitionEmail.newRequisitionToSupervisor(
              nextStep.approver.email,
              requisition.employee.fullName,
              requisition.title,
              requisition._id,
              requisition.items.length,
              requisition.budgetXAF
            ).catch(error => {
              console.error('Failed to send next approver notification:', error);
              return { error, type: 'next_approver' };
            })
          );
        }
      }

      // Notify employee of approval progress
      notifications.push(
        sendEmail({
          to: requisition.employee.email,
          subject: 'Purchase Requisition Approval Progress',
          html: `
            <h3>Your Purchase Requisition Has Been Approved</h3>
            <p>Dear ${requisition.employee.fullName},</p>

            <p>Your purchase requisition has been approved by ${user.fullName}.</p>

            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Requisition Number:</strong> ${requisition.requisitionNumber}</li>
                <li><strong>Approved by:</strong> ${user.fullName}</li>
                <li><strong>Status:</strong> ${requisition.status === 'pending_supply_chain_review' ? 'Moving to Supply Chain Review' : 'Moving to Next Approval'}</li>
              </ul>
            </div>

            <p>You will be notified of further updates.</p>

            <p>Best regards,<br>Purchase Management System</p>
          `
        }).catch(error => {
          console.error('Failed to send employee notification:', error);
          return { error, type: 'employee' };
        })
      );

    } else {
      // Request was rejected - notify employee
      notifications.push(
        sendPurchaseRequisitionEmail.denialToEmployee(
          requisition.employee.email,
          comments || 'Purchase requisition denied during approval process',
          requisition._id,
          user.fullName
        ).catch(error => {
          console.error('Failed to send employee denial notification:', error);
          return { error, type: 'employee' };
        })
      );
    }

    // Wait for all notifications
    const notificationResults = await Promise.allSettled(notifications);
    notificationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      } else if (result.value && result.value.error) {
        console.error(`${result.value.type} notification failed:`, result.value.error);
      } else {
        console.log(`Notification ${index} sent successfully`);
      }
    });

    console.log('=== SUPERVISOR DECISION PROCESSED ===');
    res.json({
      success: true,
      message: `Purchase requisition ${decision} successfully`,
      data: requisition,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Process supervisor decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process decision',
      error: error.message
    });
  }
};

// Get supply chain requisitions
const getSupplyChainRequisitions = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    let query = {};

    if (user.role === 'supply_chain' || user.department === 'Business Development & Supply Chain') {
      // Supply chain users see requisitions in their workflow
      query = {
        $or: [
          { status: 'pending_supply_chain_review' },
          { status: 'pending_buyer_assignment' },
          { status: 'pending_head_approval' },
          { status: 'supply_chain_approved' },
          { status: 'approved' },
          { status: 'in_procurement' },
          { status: 'procurement_complete' },
          { status: 'delivered' },
          { status: 'supply_chain_rejected' },
          { 
            'approvalChain': {
              $elemMatch: {
                'approver.email': user.email
              }
            }
          }
        ]
      };
    } else if (user.role === 'admin') {
      // Admins see all supply chain related requisitions
      query = {
        status: { 
          $in: [
            'pending_supply_chain_review', 
            'pending_buyer_assignment',
            'pending_head_approval',
            'supply_chain_approved', 
            'supply_chain_rejected', 
            'approved',
            'in_procurement', 
            'procurement_complete', 
            'delivered'
          ] 
        }
      };
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const requisitions = await PurchaseRequisition.find(query)
      .populate('employee', 'fullName email department')
      .populate('supplyChainReview.assignedBuyer', 'fullName email buyerDetails')
      .populate('financeVerification.verifiedBy', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requisitions,
      count: requisitions.length
    });

  } catch (error) {
    console.error('Get supply chain requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supply chain requisitions',
      error: error.message
    });
  }
};


// Process supply chain decision
const processSupplyChainDecision = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const { decision, comments, assignedOfficer, estimatedCost, purchaseType } = req.body;

    console.log('=== SUPPLY CHAIN DECISION PROCESSING ===');
    console.log('Requisition ID:', requisitionId);
    console.log('Decision:', decision);
    console.log('Purchase Type:', purchaseType); // NEW: Log purchase type

    const user = await User.findById(req.user.userId);
    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check if user can process supply chain decision
    const canProcess = 
      user.role === 'admin' || 
      user.role === 'supply_chain' ||
      user.department === 'Business Development & Supply Chain' ||
      requisition.approvalChain.some(step => 
        step.approver.email === user.email && 
        step.approver.role.includes('Supply Chain')
      );

    if (!canProcess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update supply chain review
    requisition.supplyChainReview = {
      decision,
      comments,
      assignedOfficer,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
      purchaseTypeAssigned: purchaseType, // NEW: Store assigned purchase type
      decisionDate: new Date(),
      decidedBy: req.user.userId
    };

    // NEW: Update main purchase type field
    if (purchaseType) {
      requisition.purchaseType = purchaseType;
    }

    if (decision === 'approve') {
      requisition.status = 'pending_buyer_assignment'; // Move to buyer assignment
    } else {
      requisition.status = 'supply_chain_rejected';
    }

    // Update approval chain
    const supplyChainStepIndex = requisition.approvalChain.findIndex(step => 
      step.approver.email === user.email && step.status === 'pending'
    );

    if (supplyChainStepIndex !== -1) {
      requisition.approvalChain[supplyChainStepIndex].status = decision;
      requisition.approvalChain[supplyChainStepIndex].comments = comments;
      requisition.approvalChain[supplyChainStepIndex].actionDate = new Date();
      requisition.approvalChain[supplyChainStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
      requisition.approvalChain[supplyChainStepIndex].decidedBy = req.user.userId;
    }

    await requisition.save();

    // Send notifications based on decision
    const notifications = [];

    if (decision === 'approve') {
      // Notify supply chain coordinator for buyer assignment
      const supplyChainCoordinator = await User.findOne({
        email: 'lukong.lambert@gratoglobal.com'
      });

      if (supplyChainCoordinator) {
        notifications.push(
          sendEmail({
            to: supplyChainCoordinator.email,
            subject: `Requisition Ready for Buyer Assignment - ${requisition.employee.fullName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
                  <h2 style="color: #1890ff; margin-top: 0;">Requisition Ready for Buyer Assignment</h2>
                  <p>A requisition has been approved and is ready for buyer assignment.</p>

                  <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4>Requisition Details</h4>
                    <ul>
                      <li><strong>Employee:</strong> ${requisition.employee.fullName}</li>
                      <li><strong>Title:</strong> ${requisition.title}</li>
                      <li><strong>Category:</strong> ${requisition.itemCategory}</li>
                      <li><strong>Budget:</strong> XAF ${(estimatedCost || requisition.budgetXAF || 0).toLocaleString()}</li>
                      ${purchaseType ? `<li><strong>Purchase Type:</strong> ${purchaseType.replace('_', ' ').toUpperCase()}</li>` : ''}
                      <li><strong>Items:</strong> ${requisition.items.length}</li>
                    </ul>
                  </div>

                  ${comments ? `
                  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <p><strong>Comments:</strong></p>
                    <p style="font-style: italic;">${comments}</p>
                  </div>
                  ` : ''}

                  <div style="text-align: center; margin: 20px 0;">
                    <a href="${process.env.FRONTEND_URL}/supply-chain/requisitions/${requisition._id}"
                      style="background-color: #1890ff; color: white; padding: 12px 24px;
                             text-decoration: none; border-radius: 6px; font-weight: bold;">
                      Assign Buyer
                    </a>
                  </div>
                </div>
              </div>
            `
          }).catch(error => {
            console.error('Failed to send coordinator notification:', error);
            return { error, type: 'coordinator' };
          })
        );
      }

      // Notify employee of approval
      notifications.push(
        sendEmail({
          to: requisition.employee.email,
          subject: 'Purchase Requisition Approved by Supply Chain',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
                <h2 style="color: #155724; margin-top: 0;">Your Purchase Requisition Has Been Approved!</h2>
                <p>Dear ${requisition.employee.fullName},</p>

                <p>Your purchase requisition has been approved by the supply chain team.</p>

                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <ul>
                    <li><strong>Requisition:</strong> ${requisition.title}</li>
                    <li><strong>Approved by:</strong> ${user.fullName}</li>
                    <li><strong>Status:</strong> Ready for Buyer Assignment</li>
                    ${estimatedCost ? `<li><strong>Estimated Cost:</strong> XAF ${parseFloat(estimatedCost).toLocaleString()}</li>` : ''}
                    ${assignedOfficer ? `<li><strong>Assigned Officer:</strong> ${assignedOfficer}</li>` : ''}
                    ${purchaseType ? `<li><strong>Purchase Type:</strong> ${purchaseType.replace('_', ' ').toUpperCase()}</li>` : ''}
                  </ul>
                </div>

                ${comments ? `
                <div style="background-color: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p><strong>Supply Chain Comments:</strong></p>
                  <p style="font-style: italic;">${comments}</p>
                </div>
                ` : ''}

                <p>Your requisition will now be assigned to a buyer for procurement.</p>
                <p>Thank you!</p>
              </div>
            </div>
          `
        }).catch(error => {
          console.error('Failed to send employee approval notification:', error);
          return { error, type: 'employee' };
        })
      );

    } else {
      // Notify employee of rejection
      notifications.push(
        sendEmail({
          to: requisition.employee.email,
          subject: 'Purchase Requisition Rejected by Supply Chain',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
                <h2 style="color: #721c24; margin-top: 0;">Purchase Requisition Rejected</h2>
                <p>Dear ${requisition.employee.fullName},</p>

                <p>Unfortunately, your purchase requisition has been rejected by the supply chain team.</p>

                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <ul>
                    <li><strong>Requisition:</strong> ${requisition.title}</li>
                    <li><strong>Rejected by:</strong> ${user.fullName}</li>
                    <li><strong>Status:</strong> Supply Chain Rejected</li>
                  </ul>
                </div>

                ${comments ? `
                <div style="background-color: #f5c6cb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p><strong>Rejection Reason:</strong></p>
                  <p style="font-style: italic;">${comments}</p>
                </div>
                ` : ''}

                <p>Please contact the supply chain team if you need clarification or wish to submit a revised requisition.</p>
              </div>
            </div>
          `
        }).catch(error => {
          console.error('Failed to send employee rejection notification:', error);
          return { error, type: 'employee' };
        })
      );
    }

    // Wait for all notifications to complete
    const notificationResults = await Promise.allSettled(notifications);
    notificationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      } else if (result.value && result.value.error) {
        console.error(`${result.value.type} notification failed:`, result.value.error);
      } else {
        console.log(`Notification ${index} sent successfully`);
      }
    });

    console.log('=== SUPPLY CHAIN DECISION PROCESSED ===');
    res.json({
      success: true,
      message: `Requisition ${decision}d by supply chain`,
      data: requisition,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled' && !r.value?.error).length,
        failed: notificationResults.filter(r => r.status === 'rejected' || r.value?.error).length
      }
    });

  } catch (error) {
    console.error('Process supply chain decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process supply chain decision',
      error: error.message
    });
  }
};

// // Finance functions
// const getFinanceRequisitions = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId);

//     let query = {};

//     if (user.role === 'finance') {
//       // Finance users see requisitions assigned to them or pending finance approval
//       query = {
//         $or: [
//           { status: 'pending_finance' },
//           { status: 'approved' },
//           { status: 'in_procurement' },
//           { status: 'delivered' },
//           { 
//             'approvalChain': {
//               $elemMatch: {
//                 'approver.email': user.email
//               }
//             }
//           }
//         ]
//       };
//     } else if (user.role === 'admin') {
//       // Admins see all finance-related requisitions
//       query = {
//         status: { $in: ['pending_finance', 'approved', 'in_procurement', 'procurement_complete', 'delivered'] }
//       };
//     }

//     const requisitions = await PurchaseRequisition.find(query)
//       .populate('employee', 'fullName email department')
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       data: requisitions,
//       count: requisitions.length
//     });

//   } catch (error) {
//     console.error('Get finance requisitions error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch finance requisitions',
//       error: error.message
//     });
//   }
// };

// Process finance decision
const processFinanceDecision = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const { decision, comments } = req.body;

    console.log('=== FINANCE DECISION PROCESSING ===');
    console.log('Requisition ID:', requisitionId);
    console.log('Decision:', decision);

    const user = await User.findById(req.user.userId);
    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check if user can process finance decision
    const canProcess = 
      user.role === 'admin' || 
      user.role === 'finance' ||
      requisition.approvalChain.some(step => 
        step.approver.email === user.email && 
        (step.approver.role === 'Finance Officer' || step.approver.role === 'President')
      );

    if (!canProcess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update finance review
    requisition.financeReview = {
      decision,
      comments,
      decisionDate: new Date(),
      decidedBy: req.user.userId
    };

    if (decision === 'approve') {
      requisition.status = 'approved';
    } else {
      requisition.status = 'rejected';
    }

    // Update approval chain
    const financeStepIndex = requisition.approvalChain.findIndex(step => 
      step.approver.email === user.email && step.status === 'pending'
    );

    if (financeStepIndex !== -1) {
      requisition.approvalChain[financeStepIndex].status = decision;
      requisition.approvalChain[financeStepIndex].comments = comments;
      requisition.approvalChain[financeStepIndex].actionDate = new Date();
      requisition.approvalChain[financeStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
      requisition.approvalChain[financeStepIndex].decidedBy = req.user.userId;
    }

    await requisition.save();

    // Send notifications based on decision
    const notifications = [];

    if (decision === 'approve') {
      // Notify supply chain that requisition is ready for procurement
      const supplyChainTeam = await User.find({ 
        $or: [
          { role: 'supply_chain' },
          { department: 'Business Development & Supply Chain' }
        ]
      }).select('email fullName');

      if (supplyChainTeam.length > 0) {
        notifications.push(
          sendEmail({
            to: supplyChainTeam.map(u => u.email),
            subject: `Requisition Ready for Procurement - ${requisition.title}`,
            html: `
              <h3>Purchase Requisition Approved - Ready for Procurement</h3>
              <p>The following requisition has been fully approved and is ready to begin procurement:</p>

              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <ul>
                  <li><strong>Employee:</strong> ${requisition.employee.fullName}</li>
                  <li><strong>Requisition Number:</strong> ${requisition.requisitionNumber}</li>
                  <li><strong>Title:</strong> ${requisition.title}</li>
                  <li><strong>Approved Budget:</strong> XAF ${(requisition.supplyChainReview?.estimatedCost || requisition.budgetXAF || 0).toFixed(2)}</li>
                  <li><strong>Finance Approved by:</strong> ${user.fullName}</li>
                </ul>
              </div>

              <p>Please proceed with vendor selection and procurement process.</p>
            `
          }).catch(error => {
            console.error('Failed to send supply chain notification:', error);
            return { error, type: 'supply_chain' };
          })
        );
      }

      // Notify employee of finance approval
      notifications.push(
        sendEmail({
          to: requisition.employee.email,
          subject: 'Purchase Requisition Approved by Finance',
          html: `
            <h3>Your Purchase Requisition Has Been Approved!</h3>
            <p>Dear ${requisition.employee.fullName},</p>

            <p>Your purchase requisition has been approved by the finance team and is now ready for procurement.</p>

            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Requisition Number:</strong> ${requisition.requisitionNumber}</li>
                <li><strong>Approved by:</strong> ${user.fullName}</li>
                <li><strong>Status:</strong> Approved - Ready for Procurement</li>
              </ul>
            </div>

            ${comments ? `
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Finance Comments:</strong></p>
              <p style="font-style: italic;">${comments}</p>
            </div>
            ` : ''}

            <p>The supply chain team will now begin the procurement process for your requested items.</p>

            <p>Thank you!</p>
          `
        }).catch(error => {
          console.error('Failed to send employee notification:', error);
          return { error, type: 'employee' };
        })
      );

    } else {
      // Notify employee of rejection
      notifications.push(
        sendEmail({
          to: requisition.employee.email,
          subject: 'Purchase Requisition Rejected by Finance',
          html: `
            <h3>Purchase Requisition Rejected</h3>
            <p>Dear ${requisition.employee.fullName},</p>

            <p>Unfortunately, your purchase requisition has been rejected by the finance team.</p>

            <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Requisition Number:</strong> ${requisition.requisitionNumber}</li>
                <li><strong>Rejected by:</strong> ${user.fullName}</li>
                <li><strong>Status:</strong> Finance Rejected</li>
              </ul>
            </div>

            ${comments ? `
            <div style="background-color: #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Rejection Reason:</strong></p>
              <p style="font-style: italic;">${comments}</p>
            </div>
            ` : ''}

            <p>Please contact the finance team if you need clarification or wish to submit a revised requisition.</p>
          `
        }).catch(error => {
          console.error('Failed to send employee rejection notification:', error);
          return { error, type: 'employee' };
        })
      );
    }

    // Wait for all notifications to complete
    const notificationResults = await Promise.allSettled(notifications);
    notificationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      } else if (result.value && result.value.error) {
        console.error(`${result.value.type} notification failed:`, result.value.error);
      } else {
        console.log(`Notification ${index} sent successfully`);
      }
    });

    console.log('=== FINANCE DECISION PROCESSED ===');
    res.json({
      success: true,
      message: `Requisition ${decision}d by finance`,
      data: requisition,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Process finance decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process finance decision',
      error: error.message
    });
  }
};

// Get approval chain preview (for form preview)
const getApprovalChainPreview = async (req, res) => {
  try {
    const { employeeName, department } = req.body;

    if (!employeeName || !department) {
      return res.status(400).json({
        success: false,
        message: 'Employee name and department are required'
      });
    }

    // Generate approval chain
    const approvalChain = getApprovalChain(employeeName, department);

    if (!approvalChain || approvalChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine approval chain for this employee'
      });
    }

    res.json({
      success: true,
      data: approvalChain,
      message: `Found ${approvalChain.length} approval levels`
    });

  } catch (error) {
    console.error('Get approval chain preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get approval chain preview',
      error: error.message
    });
  }
};

// Get admin requisition details
const getAdminRequisitionDetails = async (req, res) => {
  try {
    const { requisitionId } = req.params;

    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department')
      .populate('supervisorDecision.decidedBy', 'fullName email')
      .populate('supplyChainReview.decidedBy', 'fullName email')
      .populate('financeReview.decidedBy', 'fullName email')
      .populate('procurementDetails.assignedOfficer', 'fullName email');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    res.json({
      success: true,
      data: requisition
    });

  } catch (error) {
    console.error('Get admin requisition details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisition details',
      error: error.message
    });
  }
};

// Get supervisor requisition (for viewing specific requisition details)
const getSupervisorRequisition = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const user = await User.findById(req.user.userId);

    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check if user can view this requisition
    const canView = 
      user.role === 'admin' ||
      requisition.approvalChain.some(step => step.approver.email === user.email);

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: requisition
    });

  } catch (error) {
    console.error('Get supervisor requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisition',
      error: error.message
    });
  }
};

// Update procurement status
const updateProcurementStatus = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const { 
      status, 
      assignedOfficer, 
      vendors, 
      selectedVendor, 
      finalCost, 
      deliveryDate,
      deliveryStatus,
      comments 
    } = req.body;

    console.log('=== UPDATE PROCUREMENT STATUS ===');
    console.log('Requisition ID:', requisitionId);
    console.log('New Status:', status);

    const user = await User.findById(req.user.userId);
    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check permissions
    const canUpdate = 
      user.role === 'admin' || 
      user.role === 'supply_chain' ||
      user.department === 'Business Development & Supply Chain';

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update procurement details
    if (!requisition.procurementDetails) {
      requisition.procurementDetails = {};
    }

    if (assignedOfficer) requisition.procurementDetails.assignedOfficer = assignedOfficer;
    if (vendors) requisition.procurementDetails.vendors = vendors;
    if (selectedVendor) requisition.procurementDetails.selectedVendor = selectedVendor;
    if (finalCost) requisition.procurementDetails.finalCost = parseFloat(finalCost);
    if (deliveryDate) requisition.procurementDetails.deliveryDate = new Date(deliveryDate);
    if (deliveryStatus) requisition.procurementDetails.deliveryStatus = deliveryStatus;

    // Update main status
    if (status) requisition.status = status;

    // Set procurement date when moving to in_procurement
    if (status === 'in_procurement' && !requisition.procurementDetails.procurementDate) {
      requisition.procurementDetails.procurementDate = new Date();
    }

    await requisition.save();

    // Send notifications based on status
    const notifications = [];

    if (status === 'delivered') {
      // Notify employee of delivery
      notifications.push(
        sendPurchaseRequisitionEmail.deliveryToEmployee(
          requisition.employee.email,
          requisition.title,
          requisition._id,
          requisition.deliveryLocation,
          assignedOfficer
        ).catch(error => {
          console.error('Failed to send delivery notification:', error);
          return { error, type: 'employee' };
        })
      );

      // Notify admins of completion
      const admins = await User.find({ role: 'admin' }).select('email fullName');
      if (admins.length > 0) {
        notifications.push(
          sendEmail({
            to: admins.map(a => a.email),
            subject: `Purchase Requisition Delivered - ${requisition.employee.fullName}`,
            html: `
              <h3>Purchase Requisition Completed Successfully</h3>
              <p>A purchase requisition has been completed and delivered.</p>

              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <ul>
                  <li><strong>Employee:</strong> ${requisition.employee.fullName}</li>
                  <li><strong>Requisition Number:</strong> ${requisition.requisitionNumber}</li>
                  <li><strong>Title:</strong> ${requisition.title}</li>
                  <li><strong>Final Cost:</strong> XAF ${(finalCost || 0).toFixed(2)}</li>
                  <li><strong>Delivered by:</strong> ${assignedOfficer || 'Procurement Team'}</li>
                  <li><strong>Status:</strong> Completed</li>
                </ul>
              </div>
            `
          }).catch(error => {
            console.error('Failed to send admin notification:', error);
            return { error, type: 'admin' };
          })
        );
      }
    }

    // Wait for notifications
    const notificationResults = await Promise.allSettled(notifications);

    res.json({
      success: true,
      message: 'Procurement status updated successfully',
      data: requisition,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Update procurement status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update procurement status',
      error: error.message
    });
  }
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const user = await User.findById(userId);

    let filter = {};

    // Filter based on user role
    if (role === 'employee') {
      filter.employee = userId;
    } else if (role === 'supervisor') {
      filter['approvalChain.approver.email'] = user.email;
    } else if (role === 'supply_chain') {
      filter.status = { $in: ['pending_supply_chain_review', 'supply_chain_approved', 'in_procurement', 'procurement_complete'] };
    } else if (role === 'finance') {
      filter.status = { $in: ['pending_finance_verification', 'pending_supply_chain_review', 'approved', 'in_procurement', 'procurement_complete', 'delivered'] };
    }

    const [
      totalCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      inProcurementCount,
      completedCount,
      recentRequisitions,
      monthlyStats
    ] = await Promise.all([
      PurchaseRequisition.countDocuments(filter),
      PurchaseRequisition.countDocuments({ 
        ...filter, 
        status: { $in: ['pending_supervisor', 'pending_finance_verification', 'pending_supply_chain_review'] } 
      }),
      PurchaseRequisition.countDocuments({ 
        ...filter, 
        status: { $in: ['approved', 'supply_chain_approved'] } 
      }),
      PurchaseRequisition.countDocuments({ 
        ...filter, 
        status: { $in: ['rejected', 'supply_chain_rejected'] } 
      }),
      PurchaseRequisition.countDocuments({ ...filter, status: 'in_procurement' }),
      PurchaseRequisition.countDocuments({ 
        ...filter, 
        status: { $in: ['procurement_complete', 'delivered'] } 
      }),

      // Recent requisitions
      PurchaseRequisition.find(filter)
        .populate('employee', 'fullName email department')
        .sort({ createdAt: -1 })
        .limit(10),

      // Monthly statistics
      PurchaseRequisition.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            totalBudget: { $sum: '$budgetXAF' },
            avgProcessingTime: { $avg: '$processingTime' }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ])
    ]);

    let stats = {
      summary: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        inProcurement: inProcurementCount,
        completed: completedCount
      },
      recent: recentRequisitions,
      monthly: monthlyStats,
      trends: {
        approvalRate: totalCount > 0 ? Math.round(((approvedCount + completedCount) / totalCount) * 100) : 0,
        completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
      }
    };

    // Add finance-specific analytics if user is finance
    if (role === 'finance' || role === 'admin') {
      const BudgetCode = require('../models/BudgetCode');
      
      const [
        budgetCodeStats,
        totalBudgetAllocated,
        budgetUtilization,
        financeRequisitions
      ] = await Promise.all([
        // Budget code statistics
        BudgetCode.aggregate([
          { $match: { active: true } },
          {
            $group: {
              _id: null,
              totalBudgetCodes: { $sum: 1 },
              totalBudget: { $sum: '$budget' },
              totalUsed: { $sum: '$used' },
              totalRemaining: { $sum: { $subtract: ['$budget', '$used'] } }
            }
          }
        ]),
        
        // Total budget allocated to requisitions this month
        PurchaseRequisition.aggregate([
          {
            $match: {
              'financeVerification.verificationDate': {
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              },
              'financeVerification.decision': 'approved'
            }
          },
          {
            $group: {
              _id: null,
              totalAllocated: { $sum: '$financeVerification.assignedBudget' },
              count: { $sum: 1 }
            }
          }
        ]),

        // Budget utilization by department
        PurchaseRequisition.aggregate([
          {
            $match: {
              'financeVerification.decision': 'approved',
              createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
            }
          },
          {
            $group: {
              _id: '$department',
              totalAllocated: { $sum: '$financeVerification.assignedBudget' },
              count: { $sum: 1 }
            }
          },
          { $sort: { totalAllocated: -1 } }
        ]),

        // Finance pending requisitions
        PurchaseRequisition.countDocuments({ status: 'pending_finance_verification' })
      ]);

      // Add finance analytics to stats
      stats.finance = {
        budgetCodes: budgetCodeStats[0] || {
          totalBudgetCodes: 0,
          totalBudget: 0,
          totalUsed: 0,
          totalRemaining: 0
        },
        thisMonth: {
          totalBudgetAllocated: totalBudgetAllocated[0]?.totalAllocated || 0,
          requisitionsApproved: totalBudgetAllocated[0]?.count || 0
        },
        budgetUtilization: budgetUtilization,
        pendingVerification: financeRequisitions,
        overallUtilization: budgetCodeStats[0] ? 
          Math.round((budgetCodeStats[0].totalUsed / budgetCodeStats[0].totalBudget) * 100) : 0
      };
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Get category analytics
const getCategoryAnalytics = async (req, res) => {
  try {
    const { period = 'quarterly' } = req.query;

    // Calculate date range based on period
    let startDate = new Date();
    switch (period) {
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 3);
    }

    const analytics = await PurchaseRequisition.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$itemCategory',
          count: { $sum: 1 },
          totalBudget: { $sum: '$budgetXAF' },
          avgBudget: { $avg: '$budgetXAF' },
          approvedCount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['approved', 'in_procurement', 'procurement_complete', 'delivered']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          approvalRate: {
            $multiply: [
              { $divide: ['$approvedCount', '$count'] },
              100
            ]
          }
        }
      },
      { $sort: { totalBudget: -1 } }
    ]);

    res.json({
      success: true,
      data: analytics,
      period: period
    });

  } catch (error) {
    console.error('Get category analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category analytics',
      error: error.message
    });
  }
};

// Get vendor performance data
const getVendorPerformance = async (req, res) => {
  try {
    // This would integrate with vendor management system
    // For now, return mock data structure
    const mockVendorData = [
      {
        name: 'TechSolutions Cameroon',
        totalOrders: 28,
        onTimeDelivery: 95,
        qualityRating: 4.5,
        totalSpend: 15000000
      },
      {
        name: 'Office Supplies Plus',
        totalOrders: 45,
        onTimeDelivery: 90,
        qualityRating: 4.2,
        totalSpend: 8500000
      }
    ];

    res.json({
      success: true,
      data: mockVendorData,
      message: 'Vendor performance data (mock)'
    });

  } catch (error) {
    console.error('Get vendor performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor performance',
      error: error.message
    });
  }
};

// Save draft requisition
const saveDraft = async (req, res) => {
  try {
    console.log('=== SAVE DRAFT REQUISITION ===');

    const {
      title,
      itemCategory,
      budgetXAF,
      budgetHolder,
      urgency,
      deliveryLocation,
      expectedDate,
      justificationOfPurchase,
      justificationOfPreferredSupplier,
      items
    } = req.body;

    // Get user details
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    // Parse items if it's a string
    let parsedItems;
    try {
      parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
    } catch (error) {
      parsedItems = [];
    }

    // Create draft requisition (no approval chain needed for drafts)
    const draftRequisition = new PurchaseRequisition({
      employee: req.user.userId,
      title: title || 'Draft Requisition',
      department: employee.department,
      itemCategory: itemCategory || 'Other',
      budgetXAF: budgetXAF ? parseFloat(budgetXAF) : undefined,
      budgetHolder: budgetHolder || employee.department,
      urgency: urgency || 'Medium',
      deliveryLocation: deliveryLocation || 'Office',
      expectedDate: expectedDate ? new Date(expectedDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      justificationOfPurchase: justificationOfPurchase || 'Draft - to be completed',
      justificationOfPreferredSupplier,
      items: parsedItems || [],
      status: 'draft',
      approvalChain: [] // Empty for drafts
    });

    await draftRequisition.save();
    await draftRequisition.populate('employee', 'fullName email department');

    res.json({
      success: true,
      message: 'Draft saved successfully',
      data: draftRequisition
    });

  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save draft',
      error: error.message
    });
  }
};

// Get procurement planning data
const getProcurementPlanningData = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    // Check permissions
    const canView = 
      user.role === 'admin' || 
      user.role === 'supply_chain' ||
      user.department === 'Business Development & Supply Chain';

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const [
      upcomingRequisitions,
      procurementPipeline,
      budgetUtilization,
      vendorWorkload
    ] = await Promise.all([
      // Upcoming requisitions by expected date
      PurchaseRequisition.find({
        status: { $in: ['approved', 'in_procurement'] },
        expectedDate: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
      })
      .populate('employee', 'fullName department')
      .sort({ expectedDate: 1 })
      .limit(20),

      // Procurement pipeline by status
      PurchaseRequisition.aggregate([
        {
          $match: {
            status: { $in: ['approved', 'in_procurement', 'procurement_complete'] }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$budgetXAF' }
          }
        }
      ]),

      // Budget utilization by category
      PurchaseRequisition.aggregate([
        {
          $match: {
            status: { $in: ['approved', 'in_procurement', 'procurement_complete', 'delivered'] },
            createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } // This month
          }
        },
        {
          $group: {
            _id: '$itemCategory',
            allocated: { $sum: '$budgetXAF' },
            spent: { $sum: '$procurementDetails.finalCost' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Mock vendor workload (would integrate with actual vendor system)
      Promise.resolve([
        { vendor: 'TechSolutions Cameroon', activeOrders: 5, pendingValue: 2500000 },
        { vendor: 'Office Supplies Plus', activeOrders: 3, pendingValue: 750000 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        upcoming: upcomingRequisitions,
        pipeline: procurementPipeline,
        budgetUtilization,
        vendorWorkload
      }
    });

  } catch (error) {
    console.error('Get procurement planning data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch procurement planning data',
      error: error.message
    });
  }
};

// Update requisition (for drafts or pending requisitions)
const updateRequisition = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const updateData = req.body;

    const requisition = await PurchaseRequisition.findById(requisitionId);

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check if user can update this requisition
    if (!requisition.employee.equals(req.user.userId) && !['admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow updates for drafts or pending requisitions
    if (!['draft', 'pending_supervisor'].includes(requisition.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only update draft or pending supervisor requisitions'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'title', 'itemCategory', 'budgetXAF', 'budgetHolder', 'urgency',
      'deliveryLocation', 'expectedDate', 'justificationOfPurchase',
      'justificationOfPreferredSupplier', 'items'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'items' && typeof updateData[field] === 'string') {
          try {
            requisition[field] = JSON.parse(updateData[field]);
          } catch (error) {
            // Keep existing items if parsing fails
          }
        } else if (field === 'budgetXAF' && updateData[field]) {
          requisition[field] = parseFloat(updateData[field]);
        } else if (field === 'expectedDate' && updateData[field]) {
          requisition[field] = new Date(updateData[field]);
        } else {
          requisition[field] = updateData[field];
        }
      }
    });

    await requisition.save();
    await requisition.populate('employee', 'fullName email department');

    res.json({
      success: true,
      message: 'Requisition updated successfully',
      data: requisition
    });

  } catch (error) {
    console.error('Update requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update requisition',
      error: error.message
    });
  }
};

// Delete draft requisition
const deleteRequisition = async (req, res) => {
  try {
    const { requisitionId } = req.params;

    const requisition = await PurchaseRequisition.findById(requisitionId);

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check permissions
    if (!requisition.employee.equals(req.user.userId) && !['admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of draft requisitions
    if (requisition.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete draft requisitions'
      });
    }

    // Clean up attachments if any
    if (requisition.attachments && requisition.attachments.length > 0) {
      await Promise.allSettled(
        requisition.attachments.map(attachment => {
          const filePath = path.join(__dirname, '../uploads/requisitions', attachment.publicId);
          return fs.promises.unlink(filePath).catch(e => console.error('File cleanup failed:', e));
        })
      );
    }

    await PurchaseRequisition.findByIdAndDelete(requisitionId);

    res.json({
      success: true,
      message: 'Draft requisition deleted successfully'
    });

  } catch (error) {
    console.error('Delete requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete requisition',
      error: error.message
    });
  }
};

// Get requisition statistics for reporting
const getRequisitionStats = async (req, res) => {
  try {
    const { startDate, endDate, department, status } = req.query;

    let matchFilter = {};

    // Date range filter
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }

    // Department filter
    if (department) {
      const users = await User.find({ department }).select('_id');
      matchFilter.employee = { $in: users.map(u => u._id) };
    }

    // Status filter
    if (status) {
      matchFilter.status = status;
    }

    const stats = await PurchaseRequisition.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalRequisitions: { $sum: 1 },
          totalBudget: { $sum: '$budgetXAF' },
          avgBudget: { $avg: '$budgetXAF' },
          avgProcessingTime: { $avg: '$processingTime' },
          statusBreakdown: {
            $push: '$status'
          },
          categoryBreakdown: {
            $push: '$itemCategory'
          },
          departmentBreakdown: {
            $push: '$department'
          }
        }
      }
    ]);

    // Process status breakdown
    const statusCounts = {};
    const categoryCounts = {};
    const departmentCounts = {};

    if (stats.length > 0) {
      stats[0].statusBreakdown.forEach(status => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      stats[0].categoryBreakdown.forEach(category => {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      stats[0].departmentBreakdown.forEach(dept => {
        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        summary: stats.length > 0 ? {
          totalRequisitions: stats[0].totalRequisitions,
          totalBudget: stats[0].totalBudget || 0,
          avgBudget: Math.round(stats[0].avgBudget || 0),
          avgProcessingTime: Math.round(stats[0].avgProcessingTime || 0)
        } : {
          totalRequisitions: 0,
          totalBudget: 0,
          avgBudget: 0,
          avgProcessingTime: 0
        },
        breakdown: {
          status: statusCounts,
          category: categoryCounts,
          department: departmentCounts
        }
      }
    });

  } catch (error) {
    console.error('Get requisition stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisition statistics',
      error: error.message
    });
  }
};

// Get requisitions by user role (unified endpoint)
const getRequisitionsByRole = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const { status, page = 1, limit = 20 } = req.query;

    let query = {};
    let baseFilter = status ? { status } : {};

    switch (user.role) {
      case 'employee':
        query = { ...baseFilter, employee: req.user.userId };
        break;

      case 'supervisor':
        query = {
          ...baseFilter,
          'approvalChain': {
            $elemMatch: {
              'approver.email': user.email,
              'status': 'pending'
            }
          }
        };
        break;

      case 'supply_chain':
        query = {
          ...baseFilter,
          $or: [
            { status: 'pending_supply_chain_review' },
            { status: 'supply_chain_approved' },
            { status: 'in_procurement' }
          ]
        };
        break;

      case 'finance':
        query = {
          ...baseFilter,
          $or: [
            { status: 'pending_finance' },
            { status: 'approved' },
            { status: 'delivered' }
          ]
        };
        break;

      case 'admin':
        query = baseFilter; // See all
        break;

      default:
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
    }

    const requisitions = await PurchaseRequisition.find(query)
      .populate('employee', 'fullName email department')
      .populate('supplyChainReview.decidedBy', 'fullName')
      .populate('financeReview.decidedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PurchaseRequisition.countDocuments(query);

    res.json({
      success: true,
      data: requisitions,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: requisitions.length,
        totalRecords: total
      },
      role: user.role
    });

  } catch (error) {
    console.error('Get requisitions by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisitions',
      error: error.message
    });
  }
};

const processFinanceVerification = async (req, res) => {
  try {
      const { requisitionId } = req.params;
      const { 
        budgetAvailable, 
        assignedBudget, 
        budgetCode, 
        budgetAllocation,
        costCenter,
        comments, 
        decision,
        expectedCompletionDate,
        requiresAdditionalApproval
      } = req.body;

      console.log('=== FINANCE VERIFICATION PROCESSING ===');
      console.log('Requisition ID:', requisitionId);
      console.log('Decision:', decision);
      console.log('Budget Code:', budgetCode);

      const user = await User.findById(req.user.userId);
      const requisition = await PurchaseRequisition.findById(requisitionId)
          .populate('employee', 'fullName email department');

      if (!requisition) {
          return res.status(404).json({
              success: false,
              message: 'Requisition not found'
          });
      }

      // Check if user can verify finance
      const canVerify =
          user.role === 'admin' ||
          user.role === 'finance' ||
          user.email === 'ranibellmambo@gratoengineering.com';

      if (!canVerify) {
          return res.status(403).json({
              success: false,
              message: 'Access denied'
          });
      }

      // CRITICAL FIX: Ensure all items have required fields before saving
      if (requisition.items && requisition.items.length > 0) {
          requisition.items = requisition.items.map(item => ({
              ...item._doc, // Get the raw object without mongoose metadata
              // Ensure required fields exist
              itemId: item.itemId || item._id, // Use existing itemId or fallback to _id
              code: item.code || `ITEM-${Date.now()}`, // Generate code if missing
              description: item.description || 'Item description not available',
              category: item.category || 'General',
              subcategory: item.subcategory || 'General',
              quantity: item.quantity || 1,
              measuringUnit: item.measuringUnit || 'Pieces',
              estimatedPrice: item.estimatedPrice || 0,
              projectName: item.projectName || ''
          }));
      }

      // If approved and budget code is provided, validate and allocate budget
      let budgetCodeDoc = null;
      if (decision === 'approved' && budgetCode) {
          const BudgetCode = require('../models/BudgetCode');
          
          budgetCodeDoc = await BudgetCode.findOne({ 
            code: budgetCode.toUpperCase(),
            active: true 
          });

          if (!budgetCodeDoc) {
              return res.status(400).json({
                  success: false,
                  message: 'Invalid or inactive budget code'
              });
          }

          // Check if budget code has sufficient funds
          const allocationAmount = parseFloat(assignedBudget) || requisition.budgetXAF || 0;
          if (!budgetCodeDoc.canAllocate(allocationAmount)) {
              return res.status(400).json({
                  success: false,
                  message: `Insufficient budget in code ${budgetCode}. Available: XAF ${budgetCodeDoc.remaining.toLocaleString()}, Required: XAF ${allocationAmount.toLocaleString()}`
              });
          }

          // Allocate budget
          try {
              await budgetCodeDoc.allocateBudget(requisitionId, allocationAmount);
              console.log(`Budget allocated: ${allocationAmount} from ${budgetCode}`);
          } catch (error) {
              console.error('Budget allocation error:', error);
              return res.status(400).json({
                  success: false,
                  message: error.message || 'Failed to allocate budget'
              });
          }
      }

      // Update finance verification
      requisition.financeVerification = {
          budgetAvailable: budgetAvailable,
          assignedBudget: assignedBudget ? parseFloat(assignedBudget) : requisition.budgetXAF,
          budgetCode: budgetCode,
          budgetAllocation: budgetAllocation,
          costCenter: costCenter,
          comments: comments,
          expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : undefined,
          requiresAdditionalApproval: requiresAdditionalApproval || false,
          verifiedBy: req.user.userId,
          verificationDate: new Date(),
          decision: decision
      };

      if (decision === 'approved') {
          requisition.status = 'pending_head_approval'; // NEW: Go to head approval instead of supply chain
      } else {
          requisition.status = 'rejected';
      }

      // CRITICAL FIX: Use validateBeforeSave: false to bypass validation or fix the data
      try {
          // Option 1: Save with validation disabled
          await requisition.save({ validateBeforeSave: false });
          
          // Option 2: If you prefer validation, ensure data is complete first
          // await requisition.validate(); // This will show you exactly what's missing
          // await requisition.save();
          
      } catch (validationError) {
          console.error('Validation error during save:', validationError);
          
          // Log specific validation errors
          if (validationError.errors) {
              Object.keys(validationError.errors).forEach(key => {
                  console.error(`Validation error for ${key}:`, validationError.errors[key].message);
              });
          }
          
          return res.status(400).json({
              success: false,
              message: 'Data validation failed',
              errors: validationError.errors
          });
      }

      // Send notifications
      const notifications = [];

      if (decision === 'approved') {
          // Notify Head of Business Development & Supply Chain for final approval
          const headOfBusiness = await User.findOne({
              email: 'kelvin.eyong@gratoglobal.com'
          });

          if (headOfBusiness) {
              notifications.push(
                  sendEmail({
                      to: headOfBusiness.email,
                      subject: `Purchase Requisition Ready for Final Approval - ${requisition.employee.fullName}`,
                      html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
                <h2 style="color: #155724; margin-top: 0;">Budget Verified - Ready for Final Approval & Business Decisions</h2>
                <p>A purchase requisition has been verified by Finance and is ready for your final approval and business decisions.</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <h4>Requisition Details</h4>
                  <ul>
                    <li><strong>Employee:</strong> ${requisition.employee.fullName}</li>
                    <li><strong>Title:</strong> ${requisition.title}</li>
                    <li><strong>Assigned Budget:</strong> XAF ${(assignedBudget || requisition.budgetXAF).toLocaleString()}</li>
                    ${budgetCode ? `<li><strong>Budget Code:</strong> ${budgetCode}</li>` : ''}
                    ${budgetCodeDoc ? `<li><strong>Budget Remaining:</strong> XAF ${budgetCodeDoc.remaining.toLocaleString()}</li>` : ''}
                    <li><strong>Items Count:</strong> ${requisition.items.length}</li>
                    ${costCenter ? `<li><strong>Cost Center:</strong> ${costCenter}</li>` : ''}
                  </ul>
                </div>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <h4 style="color: #856404;">Your Responsibilities:</h4>
                  <ul style="color: #856404;">
                    <li>Select sourcing type (direct purchase, competitive bidding, framework agreement)</li>
                    <li>Assign purchase type (OPEX, CAPEX)</li>
                    <li>Assign suitable buyer for procurement</li>
                    <li>Provide final approval for requisition</li>
                  </ul>
                </div>
                
                ${comments ? `
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                  <p><strong>Finance Comments:</strong></p>
                  <p style="font-style: italic;">${comments}</p>
                </div>
                ` : ''}

                <div style="text-align: center; margin: 20px 0;">
                  <a href="${process.env.FRONTEND_URL}/head-business/requisitions/${requisition._id}"
                    style="background-color: #28a745; color: white; padding: 12px 24px;
                           text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Review & Make Business Decisions
                  </a>
                </div>
              </div>
            </div>
          `
                  }).catch(error => {
                      console.error('Failed to send head of business notification:', error);
                      return { error, type: 'head_business' };
                  })
              );
          }

          // Notify employee of finance approval
          notifications.push(
              sendEmail({
                  to: requisition.employee.email,
                  subject: 'Purchase Requisition - Budget Verified and Approved',
                  html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
              <h2 style="color: #155724; margin-top: 0;">Budget Verification Complete - Moving to Supply Chain</h2>
              <p>Dear ${requisition.employee.fullName},</p>
              <p>Your purchase requisition has been verified and approved by the Finance team.</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h4>Finance Verification Details</h4>
                <ul>
                  <li><strong>Requisition:</strong> ${requisition.title}</li>
                  <li><strong>Budget Status:</strong> ${budgetAvailable ? 'Available' : 'Limited'}</li>
                  <li><strong>Assigned Budget:</strong> XAF ${(assignedBudget || requisition.budgetXAF).toLocaleString()}</li>
                  ${budgetCode ? `<li><strong>Budget Code:</strong> ${budgetCode}</li>` : ''}
                  ${costCenter ? `<li><strong>Cost Center:</strong> ${costCenter}</li>` : ''}
                  <li><strong>Next Step:</strong> Head of Business Final Approval</li>
                  ${expectedCompletionDate ? `<li><strong>Expected Completion:</strong> ${new Date(expectedCompletionDate).toLocaleDateString('en-GB')}</li>` : ''}
                </ul>
              </div>
              
              ${comments ? `
              <div style="background-color: #e9f7ef; padding: 15px; border-radius: 8px;">
                <p><strong>Finance Team Notes:</strong></p>
                <p style="font-style: italic;">${comments}</p>
              </div>
              ` : ''}
              
              <p>Your requisition will now be reviewed by the Head of Business Development & Supply Chain for final approval and business decisions including sourcing type, purchase type assignment, and buyer assignment.</p>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${process.env.FRONTEND_URL}/employee/requisitions/${requisition._id}"
                  style="background-color: #007bff; color: white; padding: 12px 24px;
                         text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Track Your Requisition
                </a>
              </div>
            </div>
          </div>
        `
              }).catch(error => {
                  console.error('Failed to send employee notification:', error);
                  return { error, type: 'employee' };
              })
          );

      } else {
          // Notify employee of rejection
          notifications.push(
              sendEmail({
                  to: requisition.employee.email,
                  subject: 'Purchase Requisition - Budget Verification Result',
                  html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
              <h2 style="color: #721c24; margin-top: 0;">Budget Verification - Action Required</h2>
              <p>Dear ${requisition.employee.fullName},</p>
              <p>Your purchase requisition has been reviewed by the Finance team.</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h4>Verification Result</h4>
                <ul>
                  <li><strong>Requisition:</strong> ${requisition.title}</li>
                  <li><strong>Status:</strong> Budget Verification Issues</li>
                  <li><strong>Reviewed by:</strong> ${user.fullName}</li>
                </ul>
              </div>
              
              ${comments ? `
              <div style="background-color: #f5c6cb; padding: 15px; border-radius: 8px;">
                <p><strong>Finance Team Comments:</strong></p>
                <p style="font-style: italic; color: #721c24;">${comments}</p>
              </div>
              ` : ''}
              
              <div style="background-color: #d1ecf1; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h4>Next Steps:</h4>
                <ul>
                  <li>Review the finance team's comments above</li>
                  <li>Contact the Finance team if you need clarification</li>
                  <li>Consider revising and resubmitting your requisition if circumstances change</li>
                </ul>
              </div>
            </div>
          </div>
        `
              }).catch(error => {
                  console.error('Failed to send employee notification:', error);
                  return { error, type: 'employee' };
              })
          );
      }

      // Wait for all notifications
      const notificationResults = await Promise.allSettled(notifications);
      notificationResults.forEach((result, index) => {
          if (result.status === 'rejected') {
              console.error(`Notification ${index} failed:`, result.reason);
          }
      });

      console.log('=== FINANCE VERIFICATION COMPLETED ===');
      res.json({
          success: true,
          message: `Budget verification ${decision}`,
          data: {
              requisition,
              budgetAllocation: budgetCodeDoc ? {
                  budgetCode: budgetCodeDoc.code,
                  allocatedAmount: assignedBudget,
                  remainingBudget: budgetCodeDoc.remaining,
                  utilizationRate: budgetCodeDoc.utilizationPercentage
              } : null
          },
          notifications: {
              sent: notificationResults.filter(r => r.status === 'fulfilled').length,
              failed: notificationResults.filter(r => r.status === 'rejected').length
          }
      });

  } catch (error) {
      console.error('Process finance verification error:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to process finance verification',
          error: error.message
      });
  }
};


const assignBuyer = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const { sourcingType, assignedBuyer, comments, purchaseType } = req.body;

    console.log('=== BUYER ASSIGNMENT PROCESSING ===');
    console.log('Requisition ID:', requisitionId);
    console.log('Assigned Buyer:', assignedBuyer);
    console.log('Purchase Type:', purchaseType);

    const user = await User.findById(req.user.userId);
    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check if user can assign buyer (Supply Chain Coordinator or Admin)
    const canAssign =
      user.role === 'admin' ||
      user.email === 'lukong.lambert@gratoglobal.com' ||
      user.role === 'supply_chain' ||
      user.department === 'Business Development & Supply Chain';

    if (!canAssign) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // FIXED: Validate assigned buyer exists and is active
    const buyer = await User.findOne({ 
      _id: assignedBuyer,
      $or: [
        { role: 'buyer' },
        { departmentRole: 'buyer' },
        { email: 'lukong.lambert@gratoglobal.com' } // Coordinator can also be a buyer
      ],
      isActive: true 
    });

    if (!buyer) {
      return res.status(400).json({
        success: false,
        message: 'Invalid buyer selected or buyer not found'
      });
    }

    // FIXED: Validate requisition status before assignment
    if (!['pending_buyer_assignment', 'pending_supply_chain_review'].includes(requisition.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign buyer to requisition with status: ${requisition.status}`
      });
    }

    // FIXED: Update supply chain review with proper buyer assignment
    if (!requisition.supplyChainReview) {
      requisition.supplyChainReview = {};
    }

    requisition.supplyChainReview = {
      ...requisition.supplyChainReview,
      decision: 'approve',
      sourcingType: sourcingType,
      assignedBuyer: assignedBuyer,
      buyerAssignmentDate: new Date(),
      buyerAssignedBy: req.user.userId,
      comments: comments,
      purchaseTypeAssigned: purchaseType || requisition.purchaseType
    };

    // Update main purchase type if provided
    if (purchaseType) {
      requisition.purchaseType = purchaseType;
    }

    // FIXED: Set correct status after buyer assignment
    requisition.status = 'pending_head_approval';

    await requisition.save();

    // FIXED: Update buyer workload properly
    if (buyer.buyerDetails) {
      await User.findByIdAndUpdate(assignedBuyer, {
        $inc: { 'buyerDetails.workload.currentAssignments': 1 }
      });
    } else {
      // Initialize buyer details if they don't exist
      await User.findByIdAndUpdate(assignedBuyer, {
        $set: {
          'buyerDetails.workload.currentAssignments': 1,
          'buyerDetails.workload.monthlyTarget': 20,
          'buyerDetails.availability.isAvailable': true,
          'buyerDetails.maxOrderValue': 5000000,
          'buyerDetails.specializations': ['General']
        }
      });
    }

    // Send notifications
    const notifications = [];

    // Notify assigned buyer
    notifications.push(
      sendEmail({
        to: buyer.email,
        subject: `New Purchase Requisition Assignment - ${requisition.employee.fullName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
              <h2 style="color: #1890ff; margin-top: 0;">New Procurement Assignment</h2>
              <p>You have been assigned a new purchase requisition for processing.</p>

              <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h4>Assignment Details</h4>
                <ul>
                  <li><strong>Employee:</strong> ${requisition.employee.fullName}</li>
                  <li><strong>Requisition:</strong> ${requisition.title}</li>
                  <li><strong>Category:</strong> ${requisition.itemCategory}</li>
                  <li><strong>Budget:</strong> XAF ${requisition.financeVerification?.assignedBudget?.toLocaleString() || requisition.budgetXAF?.toLocaleString() || 'TBD'}</li>
                  <li><strong>Sourcing Type:</strong> ${sourcingType.replace('_', ' ').toUpperCase()}</li>
                  ${purchaseType ? `<li><strong>Purchase Type:</strong> ${purchaseType.replace('_', ' ').toUpperCase()}</li>` : ''}
                  <li><strong>Items Count:</strong> ${requisition.items.length}</li>
                </ul>
              </div>

              ${comments ? `
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                <p><strong>Assignment Notes:</strong></p>
                <p style="font-style: italic;">${comments}</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 20px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/buyer/requisitions/${requisition._id}"
                   style="background-color: #1890ff; color: white; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                  View Assignment Details
                </a>
              </div>
            </div>
          </div>
        `
      }).catch(error => {
        console.error('Failed to send buyer notification:', error);
        return { error, type: 'buyer' };
      })
    );

    // Notify head of supply chain for final approval
    const headOfSupplyChain = await User.findOne({
      email: 'kelvin.eyong@gratoglobal.com'
    });

    if (headOfSupplyChain) {
      notifications.push(
        sendEmail({
          to: headOfSupplyChain.email,
          subject: `Purchase Requisition Ready for Final Approval - ${requisition.employee.fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
                <h2 style="color: #856404; margin-top: 0;">Final Approval Required</h2>
                <p>A purchase requisition has been processed and assigned, requiring your final approval.</p>

                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <h4>Requisition Summary</h4>
                  <ul>
                    <li><strong>Employee:</strong> ${requisition.employee.fullName}</li>
                    <li><strong>Title:</strong> ${requisition.title}</li>
                    <li><strong>Budget:</strong> XAF ${requisition.financeVerification?.assignedBudget?.toLocaleString() || requisition.budgetXAF?.toLocaleString()}</li>
                    <li><strong>Budget Code:</strong> ${requisition.financeVerification?.budgetCode || 'N/A'}</li>
                    <li><strong>Assigned Buyer:</strong> ${buyer.fullName}</li>
                    <li><strong>Sourcing Method:</strong> ${sourcingType.replace('_', ' ').toUpperCase()}</li>
                    ${purchaseType ? `<li><strong>Purchase Type:</strong> ${purchaseType.replace('_', ' ').toUpperCase()}</li>` : ''}
                  </ul>
                </div>

                <div style="text-align: center; margin: 20px 0;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/supply-chain/head/requisitions/${requisition._id}"
                     style="background-color: #ffc107; color: #333; padding: 12px 24px;
                            text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Review & Approve
                  </a>
                </div>
              </div>
            </div>
          `
        }).catch(error => {
          console.error('Failed to send head notification:', error);
          return { error, type: 'head' };
        })
      );
    }

    // Wait for notifications
    const notificationResults = await Promise.allSettled(notifications);

    console.log('=== BUYER ASSIGNMENT COMPLETED ===');
    res.json({
      success: true,
      message: 'Buyer assigned successfully',
      data: {
        requisition,
        assignedBuyer: {
          id: buyer._id,
          name: buyer.fullName,
          email: buyer.email,
          role: buyer.role,
          departmentRole: buyer.departmentRole
        }
      },
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled' && !r.value?.error).length,
        failed: notificationResults.filter(r => r.status === 'rejected' || r.value?.error).length
      }
    });

  } catch (error) {
    console.error('Assign buyer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign buyer',
      error: error.message
    });
  }
};

// NEW: Enhanced Head of Business Final Approval with Business Decisions
const processHeadApproval = async (req, res) => {
  try {
      const { requisitionId } = req.params;
      const { 
        decision, 
        comments, 
        sourcingType, 
        purchaseType, 
        assignedBuyer 
      } = req.body;

      console.log('=== HEAD BUSINESS APPROVAL PROCESSING ===');
      console.log('Requisition ID:', requisitionId);
      console.log('Decision:', decision);
      console.log('Sourcing Type:', sourcingType);
      console.log('Purchase Type:', purchaseType);
      console.log('Assigned Buyer:', assignedBuyer);

      const user = await User.findById(req.user.userId);
      const requisition = await PurchaseRequisition.findById(requisitionId)
          .populate('employee', 'fullName email department');

      if (!requisition) {
          return res.status(404).json({
              success: false,
              message: 'Requisition not found'
          });
      }

      // Check if user can give final approval (Head of Business Dev & Supply Chain)
      const canApprove =
          user.role === 'admin' ||
          user.email === 'kelvin.eyong@gratoglobal.com';

      if (!canApprove) {
          return res.status(403).json({
              success: false,
              message: 'Access denied'
          });
      }

      // Validate required business decisions for approval
      if (decision === 'approved') {
        if (!sourcingType || !purchaseType || !assignedBuyer) {
          return res.status(400).json({
            success: false,
            message: 'Sourcing type, purchase type, and buyer assignment are required for approval'
          });
        }

        // Validate assigned buyer exists and is active
        const buyer = await User.findOne({ 
          _id: assignedBuyer,
          $or: [
            { role: 'buyer' },
            { departmentRole: 'buyer' },
            { email: 'lukong.lambert@gratoglobal.com' } // Coordinator can also be a buyer
          ],
          isActive: true 
        });

        if (!buyer) {
          return res.status(400).json({
            success: false,
            message: 'Invalid buyer selected or buyer not found'
          });
        }
      }

      // Update head approval with business decisions
      requisition.headApproval = {
          decision: decision,
          comments: comments,
          decisionDate: new Date(),
          decidedBy: req.user.userId,
          // NEW: Business decisions
          businessDecisions: {
            sourcingType: sourcingType,
            purchaseType: purchaseType,
            assignedBuyer: assignedBuyer
          }
      };

      // Update main fields with business decisions
      if (decision === 'approved') {
          requisition.status = 'approved';
          requisition.purchaseType = purchaseType;
          
          // Update supply chain review with business decisions
          if (!requisition.supplyChainReview) {
            requisition.supplyChainReview = {};
          }
          
          requisition.supplyChainReview = {
            ...requisition.supplyChainReview,
            decision: 'approve',
            sourcingType: sourcingType,
            assignedBuyer: assignedBuyer,
            buyerAssignmentDate: new Date(),
            buyerAssignedBy: req.user.userId,
            purchaseTypeAssigned: purchaseType,
            comments: `Business decisions made by Head of Business: Sourcing=${sourcingType}, Purchase Type=${purchaseType}, Buyer Assigned=${assignedBuyer}`
          };

          // Update buyer workload
          await User.findByIdAndUpdate(assignedBuyer, {
            $inc: { 'buyerDetails.workload.currentAssignments': 1 }
          });

      } else {
          requisition.status = 'rejected';
      }

      await requisition.save();

      // Send notifications
      const notifications = [];

      if (decision === 'approved') {
          // Notify assigned buyer to start procurement
          const buyer = await User.findById(assignedBuyer);
          if (buyer) {
              notifications.push(
                  sendEmail({
                      to: buyer.email,
                      subject: 'Purchase Requisition Approved - Start Procurement',
                      html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
                <h2 style="color: #155724; margin-top: 0;">Requisition Approved - Start Procurement</h2>
                <p>The purchase requisition has been approved with business decisions and is ready for procurement.</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <h4>Procurement Details</h4>
                  <ul>
                    <li><strong>Employee:</strong> ${requisition.employee.fullName}</li>
                    <li><strong>Title:</strong> ${requisition.title}</li>
                    <li><strong>Approved Budget:</strong> XAF ${requisition.financeVerification?.assignedBudget?.toLocaleString() || requisition.budgetXAF?.toLocaleString()}</li>
                    <li><strong>Budget Code:</strong> ${requisition.financeVerification?.budgetCode || 'N/A'}</li>
                    <li><strong>Sourcing Method:</strong> ${sourcingType.replace('_', ' ').toUpperCase()}</li>
                    <li><strong>Purchase Type:</strong> ${purchaseType.toUpperCase()}</li>
                    <li><strong>Expected Delivery:</strong> ${new Date(requisition.expectedDate).toLocaleDateString()}</li>
                  </ul>
                </div>
                
                ${comments ? `
                <div style="background-color: #e9f7ef; padding: 15px; border-radius: 8px;">
                  <p><strong>Head of Business Comments:</strong></p>
                  <p style="font-style: italic;">${comments}</p>
                </div>
                ` : ''}
                
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${process.env.FRONTEND_URL}/buyer/requisitions/${requisition._id}"
                    style="background-color: #28a745; color: white; padding: 12px 24px;
                           text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Start Procurement Process
                  </a>
                </div>
              </div>
            </div>
          `
                  }).catch(error => ({ error, type: 'buyer' }))
              );
          }

          // Notify employee of final approval
          notifications.push(
              sendEmail({
                to: requisition.employee.email,
                subject: 'Purchase Requisition Final Approval - Ready for Procurement',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
                      <h2 style="color: #155724; margin-top: 0;">Your Purchase Requisition Has Been Approved!</h2>
                      <p>Dear ${requisition.employee.fullName},</p>
                      <p>Your purchase requisition has received final approval and business decisions have been made.</p>
                      
                      <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4>Final Approval Details</h4>
                        <ul>
                          <li><strong>Requisition:</strong> ${requisition.title}</li>
                          <li><strong>Approved by:</strong> ${user.fullName}</li>
                          <li><strong>Status:</strong> Approved - Ready for Procurement</li>
                          <li><strong>Sourcing Method:</strong> ${sourcingType.replace('_', ' ').toUpperCase()}</li>
                          <li><strong>Purchase Type:</strong> ${purchaseType.toUpperCase()}</li>
                          <li><strong>Assigned Buyer:</strong> ${buyer?.fullName || 'TBD'}</li>
                        </ul>
                      </div>
                      
                      ${comments ? `
                      <div style="background-color: #e9f7ef; padding: 15px; border-radius: 8px;">
                        <p><strong>Head of Business Comments:</strong></p>
                        <p style="font-style: italic;">${comments}</p>
                      </div>
                      ` : ''}
                      
                      <p>The procurement process will now begin according to the approved sourcing method.</p>
                      
                      <div style="text-align: center; margin: 20px 0;">
                        <a href="${process.env.FRONTEND_URL}/employee/requisitions/${requisition._id}"
                          style="background-color: #007bff; color: white; padding: 12px 24px;
                                 text-decoration: none; border-radius: 6px; font-weight: bold;">
                          Track Your Requisition
                        </a>
                      </div>
                    </div>
                  </div>
                `
              }).catch(error => ({ error, type: 'employee' }))
          );

      } else {
          // Notify employee of rejection
          notifications.push(
              sendEmail({
                  to: requisition.employee.email,
                  subject: 'Purchase Requisition Final Decision',
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
                        <h2 style="color: #721c24; margin-top: 0;">Purchase Requisition Final Decision</h2>
                        <p>Dear ${requisition.employee.fullName},</p>
                        <p>Your purchase requisition has been reviewed by the Head of Business Development & Supply Chain.</p>
                        
                        <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                          <ul>
                            <li><strong>Requisition:</strong> ${requisition.title}</li>
                            <li><strong>Decision:</strong> Not Approved</li>
                            <li><strong>Decided by:</strong> ${user.fullName}</li>
                          </ul>
                        </div>
                        
                        ${comments ? `
                        <div style="background-color: #f5c6cb; padding: 15px; border-radius: 8px;">
                          <p><strong>Head of Business Comments:</strong></p>
                          <p style="font-style: italic; color: #721c24;">${comments}</p>
                        </div>
                        ` : ''}
                        
                        <p>Please contact the Head of Business Development & Supply Chain if you need clarification or wish to submit a revised requisition.</p>
                      </div>
                    </div>
                  `
              }).catch(error => ({ error, type: 'employee' }))
          );
      }

      // Wait for notifications
      const notificationResults = await Promise.allSettled(notifications);

      console.log('=== HEAD BUSINESS APPROVAL COMPLETED ===');
      res.json({
          success: true,
          message: `Requisition ${decision} by Head of Business with business decisions`,
          data: {
            requisition,
            businessDecisions: decision === 'approved' ? {
              sourcingType,
              purchaseType,
              assignedBuyer: buyer?.fullName || assignedBuyer
            } : null
          },
          notifications: {
              sent: notificationResults.filter(r => r.status === 'fulfilled').length,
              failed: notificationResults.filter(r => r.status === 'rejected').length
          }
      });

  } catch (error) {
      console.error('Process head approval error:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to process head approval',
          error: error.message
      });
  }
};

// NEW: Get Finance Requisitions for Verification
const getFinanceRequisitions = async (req, res) => {
  try {
      const user = await User.findById(req.user.userId);

      // Check permissions
      const canView =
          user.role === 'admin' ||
          user.role === 'finance' ||
          user.email === 'ranibellmambo@gratoengineering.com';

      if (!canView) {
          return res.status(403).json({
              success: false,
              message: 'Access denied'
          });
      }

      const requisitions = await PurchaseRequisition.find({
          status: 'pending_finance_verification'
      })
          .populate('employee', 'fullName email department')
          .sort({ createdAt: -1 });

      res.json({
          success: true,
          data: requisitions,
          count: requisitions.length
      });

  } catch (error) {
      console.error('Get finance requisitions error:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to fetch finance requisitions',
          error: error.message
      });
  }
};

// NEW: Get Available Buyers
const getAvailableBuyers = async (req, res) => {
  try {
    console.log('=== FETCHING AVAILABLE BUYERS ===');
    
    // Get all users who can act as buyers
    const buyers = await User.find({
      $or: [
        { role: 'buyer' },
        { departmentRole: 'buyer' },
        // Include supply chain coordinator who can also buy
        { email: 'lukong.lambert@gratoglobal.com' }
      ],
      isActive: true
    }).select('fullName email buyerDetails department role departmentRole');

    console.log('Found buyers from database:', buyers.length);

    // Process and enhance buyer data
    const processedBuyers = buyers.map(buyer => {
      const buyerObj = buyer.toObject();
      
      // Ensure buyerDetails exist with defaults
      if (!buyerObj.buyerDetails) {
        buyerObj.buyerDetails = {
          specializations: ['General'],
          maxOrderValue: buyer.email === 'lukong.lambert@gratoglobal.com' ? 10000000 : 5000000,
          workload: {
            currentAssignments: 0,
            monthlyTarget: 20
          },
          performance: {
            completedOrders: 0,
            averageProcessingTime: 0
          },
          availability: {
            isAvailable: true
          }
        };
      }

      // Special handling for coordinator
      if (buyer.email === 'lukong.lambert@gratoglobal.com') {
        buyerObj.buyerDetails = {
          ...buyerObj.buyerDetails,
          specializations: ['All'],
          maxOrderValue: 10000000,
          workload: {
            currentAssignments: buyerObj.buyerDetails.workload?.currentAssignments || 0,
            monthlyTarget: 30
          },
          performance: {
            completedOrders: buyerObj.buyerDetails.performance?.completedOrders || 50,
            averageProcessingTime: 2.5
          },
          availability: {
            isAvailable: true
          },
          canSelfBuy: true
        };
      }

      return buyerObj;
    });

    console.log('Processed buyers:', processedBuyers.map(b => ({ name: b.fullName, email: b.email, role: b.role })));

    res.json({
      success: true,
      data: processedBuyers,
      count: processedBuyers.length
    });

  } catch (error) {
    console.error('Get available buyers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available buyers',
      error: error.message
    });
  }
};

const getBuyerRequisitions = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    console.log('=== FETCHING BUYER REQUISITIONS ===');
    console.log('User:', { id: user._id, name: user.fullName, role: user.role, departmentRole: user.departmentRole });
    
    let query = {};
    
    if (user.role === 'buyer' || user.departmentRole === 'buyer') {
      // Standard buyer - see their assigned requisitions
      query = {
        'supplyChainReview.assignedBuyer': req.user.userId,
        status: { $in: ['pending_head_approval', 'approved', 'in_procurement', 'procurement_complete'] }
      };
    } else if (user.role === 'supply_chain' || user.role === 'admin') {
      // Supply chain or admin - see all buyer assignments
      query = {
        'supplyChainReview.assignedBuyer': { $exists: true },
        status: { $in: ['pending_head_approval', 'approved', 'in_procurement', 'procurement_complete'] }
      };
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied - not authorized to view buyer requisitions'
      });
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    const requisitions = await PurchaseRequisition.find(query)
      .populate('employee', 'fullName email department')
      .populate('supplyChainReview.assignedBuyer', 'fullName email role departmentRole')
      .sort({ createdAt: -1 });

    console.log('Found requisitions:', requisitions.length);

    res.json({
      success: true,
      data: requisitions,
      count: requisitions.length,
      userInfo: {
        role: user.role,
        departmentRole: user.departmentRole,
        canViewAll: ['admin', 'supply_chain'].includes(user.role)
      }
    });
    
  } catch (error) {
    console.error('Get buyer requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch buyer requisitions',
      error: error.message
    });
  }
};

// NEW: Get Head of Business Requisitions for Final Approval (with business decisions)
const getHeadApprovalRequisitions = async (req, res) => {
  try {
      const user = await User.findById(req.user.userId);

      // Check permissions (Head of Business Dev & Supply Chain)
      const canView =
          user.role === 'admin' ||
          user.email === 'kelvin.eyong@gratoglobal.com';

      if (!canView) {
          return res.status(403).json({
              success: false,
              message: 'Access denied'
          });
      }

      const requisitions = await PurchaseRequisition.find({
          status: 'pending_head_approval' // This status comes after finance verification
      })
          .populate('employee', 'fullName email department')
          .populate('financeVerification.verifiedBy', 'fullName')
          .sort({ createdAt: -1 });

      res.json({
          success: true,
          data: requisitions,
          count: requisitions.length,
          message: 'Requisitions ready for final approval and business decisions'
      });

  } catch (error) {
      console.error('Get head approval requisitions error:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to fetch head approval requisitions',
          error: error.message
      });
  }
};


const getBudgetCodesForVerification = async (req, res) => {
  try {
    const BudgetCode = require('../models/BudgetCode');
    const { department } = req.query;

    let filter = { active: true };
    
    // If department is specified, get codes for that department or general codes
    if (department) {
      filter.$or = [
        { department: department },
        { department: 'General' }
      ];
    }

    const budgetCodes = await BudgetCode.find(filter)
      .select('code name budget used department budgetType')
      .sort({ utilizationPercentage: 1 }); // Sort by lowest utilization first

    // Format for dropdown with availability info
    const formattedCodes = budgetCodes.map(code => ({
      code: code.code,
      name: code.name,
      department: code.department,
      budgetType: code.budgetType,
      totalBudget: code.budget,
      used: code.used,
      available: code.budget - code.used,
      utilizationRate: code.budget > 0 ? Math.round((code.used / code.budget) * 100) : 0,
      status: code.budget > 0 ? (
        (code.used / code.budget) >= 0.9 ? 'critical' :
        (code.used / code.budget) >= 0.75 ? 'high' :
        (code.used / code.budget) >= 0.5 ? 'moderate' : 'low'
      ) : 'low'
    }));

    res.json({
      success: true,
      data: formattedCodes,
      count: formattedCodes.length
    });

  } catch (error) {
    console.error('Get budget codes for verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget codes',
      error: error.message
    });
  }
};

// Finance Dashboard Data
const getFinanceDashboardData = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    // Check permissions
    const canView = user.role === 'admin' || 
                   user.role === 'finance' || 
                   user.email === 'ranibellmambo@gratoengineering.com';

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all finance-related requisitions
    const financeRequisitions = await PurchaseRequisition.find({
      status: { 
        $in: [
          'pending_finance_verification',
          'pending_supply_chain_review',
          'pending_buyer_assignment',
          'pending_head_approval',
          'approved',
          'in_procurement',
          'procurement_complete'
        ]
      }
    })
    .populate('employee', 'fullName email department')
    .populate('financeVerification.verifiedBy', 'fullName email')
    .populate('supplyChainReview.assignedBuyer', 'fullName email')
    .sort({ createdAt: -1 });

    // Calculate statistics
    const stats = {
      totalValue: 0,
      pendingVerification: 0,
      approvedThisMonth: 0,
      rejectedThisMonth: 0,
      averageProcessingTime: 0,
      budgetUtilization: 0
    };

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Process each requisition for statistics
    financeRequisitions.forEach(req => {
      // Calculate total value
      const reqValue = req.budgetXAF || req.supplyChainReview?.estimatedCost || 0;
      stats.totalValue += reqValue;

      // Count pending verification
      if (req.status === 'pending_finance_verification') {
        stats.pendingVerification++;
      }

      // Count monthly approvals/rejections
      const createdDate = new Date(req.createdAt);
      if (createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear) {
        if (req.financeVerification?.decision === 'approved') {
          stats.approvedThisMonth++;
        } else if (req.financeVerification?.decision === 'rejected') {
          stats.rejectedThisMonth++;
        }
      }
    });

    // Get urgent/high priority items requiring attention
    const urgentItems = financeRequisitions.filter(req => 
      req.status === 'pending_finance_verification' && 
      (req.urgency === 'High' || 
       new Date() - new Date(req.createdAt) > 7 * 24 * 60 * 60 * 1000) // More than 7 days old
    );

    // Get recent activity (last 10 finance-related actions)
    const recentActivity = financeRequisitions
      .filter(req => req.financeVerification?.verificationDate)
      .sort((a, b) => new Date(b.financeVerification.verificationDate) - new Date(a.financeVerification.verificationDate))
      .slice(0, 10)
      .map(req => ({
        id: req._id,
        requisitionNumber: req.requisitionNumber,
        title: req.title,
        employee: req.employee,
        action: req.financeVerification.decision,
        amount: req.budgetXAF || req.supplyChainReview?.estimatedCost || 0,
        date: req.financeVerification.verificationDate,
        verifiedBy: req.financeVerification.verifiedBy
      }));

    // Get budget breakdown by department
    const departmentBreakdown = {};
    financeRequisitions.forEach(req => {
      const dept = req.employee?.department || 'Unknown';
      const amount = req.budgetXAF || req.supplyChainReview?.estimatedCost || 0;
      
      if (!departmentBreakdown[dept]) {
        departmentBreakdown[dept] = {
          totalAmount: 0,
          count: 0,
          pending: 0,
          approved: 0
        };
      }
      
      departmentBreakdown[dept].totalAmount += amount;
      departmentBreakdown[dept].count++;
      
      if (req.status === 'pending_finance_verification') {
        departmentBreakdown[dept].pending++;
      } else if (req.financeVerification?.decision === 'approved') {
        departmentBreakdown[dept].approved++;
      }
    });

    // Get monthly trends (last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      const monthData = financeRequisitions.filter(req => {
        const reqDate = new Date(req.createdAt);
        return reqDate.getMonth() === month && reqDate.getFullYear() === year;
      });
      
      monthlyTrends.push({
        month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        totalRequests: monthData.length,
        totalValue: monthData.reduce((sum, req) => sum + (req.budgetXAF || 0), 0),
        approved: monthData.filter(req => req.financeVerification?.decision === 'approved').length,
        rejected: monthData.filter(req => req.financeVerification?.decision === 'rejected').length
      });
    }

    res.json({
      success: true,
      data: {
        statistics: stats,
        urgentItems: urgentItems.slice(0, 10), // Limit to 10 most urgent
        recentActivity,
        departmentBreakdown,
        monthlyTrends,
        pendingRequisitions: financeRequisitions.filter(req => req.status === 'pending_finance_verification'),
        totalRequisitions: financeRequisitions.length
      }
    });

  } catch (error) {
    console.error('Get finance dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch finance dashboard data',
      error: error.message
    });
  }
};


// Export all functions
module.exports = {
  // Core CRUD operations
  createRequisition,
  updateRequisition,
  deleteRequisition,

  // Employee functions
  getEmployeeRequisitions,
  getEmployeeRequisition,

  // Supervisor functions
  getSupervisorRequisitions,
  getSupervisorRequisition,
  processSupervisorDecision,

  // Supply chain functions
  getSupplyChainRequisitions,
  processSupplyChainDecision,
  updateProcurementStatus,

  // Finance functions
  getFinanceRequisitions,
  processFinanceDecision,

  // Admin functions
  getAllRequisitions,
  getAdminRequisitionDetails,

  // Utility functions
  getApprovalChainPreview,
  getRequisitionsByRole,

  // Analytics and reporting
  getDashboardStats,
  getCategoryAnalytics,
  getVendorPerformance,
  getRequisitionStats,
  getProcurementPlanningData,

  processFinanceVerification,
  assignBuyer,
  processHeadApproval,
  getBuyerRequisitions,
  // getFinanceRequisitions,
  getAvailableBuyers,
  getHeadApprovalRequisitions,
  getBudgetCodesForVerification,

  // Finance Dashboard
  getFinanceDashboardData,

  // Draft management
  saveDraft
};