const ITSupportRequest = require('../models/ITSupportRequest');
const User = require('../models/User');
const { getApprovalChain } = require('../config/departmentStructure');
const { sendITSupportEmail, sendEmail } = require('../services/emailService');
const fs = require('fs');
const path = require('path');


// Create new IT support request
const createITRequest = async (req, res) => {
  try {
    console.log('=== CREATE IT SUPPORT REQUEST STARTED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      ticketNumber,
      requestType,
      title,
      description,
      category,
      subcategory,
      priority,
      urgency,
      businessJustification,
      businessImpact,
      location,
      contactInfo,
      preferredContactMethod,
      requestedItems,
      deviceDetails,
      issueDetails,
      troubleshootingAttempted,
      troubleshootingSteps
    } = req.body;

    // Validate required fields
    if (!ticketNumber) {
      return res.status(400).json({
        success: false,
        message: 'Ticket number is required'
      });
    }

    if (!title || title.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Title must be at least 5 characters long'
      });
    }

    // Enhanced description validation and generation
    let finalDescription = description;
    
    if (!finalDescription || finalDescription.length < 10) {
      // Try to create a meaningful description from available data
      if (businessJustification && businessJustification.length >= 10) {
        finalDescription = businessJustification;
      } else {
        // Parse requested items if available
        let parsedRequestedItems = [];
        try {
          if (requestedItems) {
            parsedRequestedItems = typeof requestedItems === 'string' ? JSON.parse(requestedItems) : requestedItems;
          }
        } catch (e) {
          // Continue with empty array
        }
        
        if (parsedRequestedItems && parsedRequestedItems.length > 0) {
          const itemNames = parsedRequestedItems
            .filter(item => item.item)
            .map(item => item.item)
            .join(', ');
          
          finalDescription = `${requestType === 'material_request' ? 'Material request' : 'Technical support'} for: ${itemNames}`;
          
          if (businessJustification) {
            finalDescription += `. ${businessJustification}`;
          }
        } else {
          finalDescription = requestType === 'material_request' 
            ? 'Material request for IT equipment and supplies'
            : 'Technical support request for IT assistance';
          
          if (title && title.length >= 5) {
            finalDescription = `${finalDescription}: ${title}`;
          }
        }
      }
    }

    // Final check - ensure we have at least 10 characters
    if (!finalDescription || finalDescription.length < 10) {
      finalDescription = `IT ${requestType === 'material_request' ? 'Material' : 'Support'} Request - ${new Date().toLocaleDateString()}`;
    }

    // FIXED: Validate and set proper category
    let validCategory = category;
    if (!validCategory || validCategory === 'undefined') {
      // Set default category based on request type
      validCategory = requestType === 'material_request' ? 'hardware' : 'other';
    }

    // Validate category against enum values
    const validCategories = ['hardware', 'software', 'network', 'mobile', 'security', 'accessories', 'other'];
    if (!validCategories.includes(validCategory)) {
      validCategory = 'other'; // Default fallback
    }

    // FIXED: Validate and set proper subcategory
    let validSubcategory = subcategory;
    if (!validSubcategory || validSubcategory === 'undefined') {
      // Set default subcategory based on category
      const defaultSubcategories = {
        'hardware': 'computer',
        'software': 'application',
        'network': 'connectivity',
        'mobile': 'device',
        'security': 'access',
        'accessories': 'peripheral',
        'other': 'general'
      };
      validSubcategory = defaultSubcategories[validCategory] || 'general';
    }

    console.log('Final description:', finalDescription);
    console.log('Valid category:', validCategory);
    console.log('Valid subcategory:', validSubcategory);

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

    // Parse complex fields if they're strings
    let parsedRequestedItems = [];
    let parsedDeviceDetails = {};
    let parsedIssueDetails = {};
    let parsedContactInfo = {};
    let parsedTroubleshootingSteps = [];

    try {
      if (requestedItems) {
        parsedRequestedItems = typeof requestedItems === 'string' ? JSON.parse(requestedItems) : requestedItems;
      }
      if (deviceDetails) {
        parsedDeviceDetails = typeof deviceDetails === 'string' ? JSON.parse(deviceDetails) : deviceDetails;
      }
      if (issueDetails) {
        parsedIssueDetails = typeof issueDetails === 'string' ? JSON.parse(issueDetails) : issueDetails;
      }
      if (contactInfo) {
        parsedContactInfo = typeof contactInfo === 'string' ? JSON.parse(contactInfo) : contactInfo;
      }
      if (troubleshootingSteps) {
        parsedTroubleshootingSteps = typeof troubleshootingSteps === 'string' ? JSON.parse(troubleshootingSteps) : troubleshootingSteps;
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data format in request fields'
      });
    }

    // Validate request type specific fields
    if (requestType === 'material_request') {
      if (!parsedRequestedItems || !Array.isArray(parsedRequestedItems) || parsedRequestedItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one item must be specified for material requests'
        });
      }
    }

    // Generate approval chain based on employee name and department
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
      for (const file of req.files) {
        try {
          const fileName = `${Date.now()}-${file.originalname}`;
          const uploadDir = path.join(__dirname, '../uploads/it-support');
          const filePath = path.join(uploadDir, fileName);

          // Ensure directory exists
          await fs.promises.mkdir(uploadDir, { recursive: true });

          // Move file to permanent location
          if (file.path) {
            await fs.promises.rename(file.path, filePath);
          }

          attachments.push({
            name: file.originalname,
            url: `/uploads/it-support/${fileName}`,
            publicId: fileName,
            size: file.size,
            mimetype: file.mimetype
          });
        } catch (fileError) {
          console.error('Error processing file:', file.originalname, fileError);
        }
      }
    }

    // Calculate total estimated cost for material requests
    let totalEstimatedCost = 0;
    if (requestType === 'material_request' && parsedRequestedItems.length > 0) {
      totalEstimatedCost = parsedRequestedItems.reduce((total, item) => {
        return total + ((item.estimatedCost || 0) * (item.quantity || 1));
      }, 0);
    }

    // FIXED: Create the IT support request with proper approval chain structure
    const request = new ITSupportRequest({
      ticketNumber,
      employee: req.user.userId,
      requestType,
      title,
      description: finalDescription,
      department: employee.department,
      category: validCategory, 
      subcategory: validSubcategory, 
      priority: priority || 'medium',
      urgency: urgency || 'normal',
      businessJustification: businessJustification || '',
      businessImpact: businessImpact || '',
      location: location || 'Office',
      contactInfo: {
        phone: parsedContactInfo.phone || employee.phone || '',
        email: employee.email,
        alternateContact: parsedContactInfo.alternateContact || ''
      },
      preferredContactMethod: preferredContactMethod || 'email',
      requestedItems: parsedRequestedItems,
      totalEstimatedCost,
      deviceDetails: parsedDeviceDetails,
      issueDetails: parsedIssueDetails,
      troubleshootingAttempted: troubleshootingAttempted === 'true' || troubleshootingAttempted === true,
      troubleshootingSteps: parsedTroubleshootingSteps,
      attachments,
      status: 'pending_supervisor',
      submittedBy: employee.email,
      submittedAt: new Date(),
      // FIXED: Proper approval chain structure with all required fields
      approvalChain: approvalChain.map(step => ({
        level: step.level,
        approver: {
          name: step.approver || step.name || 'Unknown', 
          email: step.email || step.approverEmail || '',
          role: step.role || 'Approver',
          department: step.department || employee.department 
        },
        status: 'pending',
        comments: '',
        actionDate: null,
        actionTime: null,
        decidedBy: null,
        assignedDate: new Date()
      })),
      slaMetrics: {
        submittedDate: new Date(),
        targetResponseTime: priority === 'critical' ? 4 : priority === 'high' ? 8 : 24, 
        targetResolutionTime: priority === 'critical' ? 24 : priority === 'high' ? 48 : 120, 
        slaBreached: false
      }
    });

    await request.save();

    console.log('IT support request created successfully:', {
      id: request._id,
      ticketNumber: request.ticketNumber,
      status: request.status,
      description: finalDescription
    });

    // Send notifications
    const notifications = [];

    // Notify first approver in chain
    if (approvalChain.length > 0) {
      const firstApprover = approvalChain[0];
      
      notifications.push(
        sendITSupportEmail.newRequestToSupervisor(
          firstApprover.email || firstApprover.approverEmail,
          employee.fullName,
          requestType,
          title,
          request.ticketNumber,
          priority || 'medium',
          totalEstimatedCost || null,
          urgency || 'normal'
        ).catch(error => {
          console.error('Failed to send supervisor notification:', error);
          return { error, type: 'supervisor' };
        })
      );
    }

    // Notify employee of submission
    notifications.push(
      sendITSupportEmail.statusUpdateToEmployee(
        employee.email,
        request.ticketNumber,
        'pending_supervisor',
        'Your IT support request has been successfully submitted and is now awaiting supervisor approval.',
        'System',
        'You will receive email notifications as your request progresses through the approval process.'
      ).catch(error => {
        console.error('Failed to send employee notification:', error);
        return { error, type: 'employee' };
      })
    );

    // Wait for all notifications to complete
    const notificationResults = await Promise.allSettled(notifications);

    // Populate the request for response
    await request.populate('employee', 'fullName email department');

    res.json({
      success: true,
      message: 'IT support request submitted successfully',
      data: request,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Create IT request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create IT support request',
      error: error.message
    });
  }
};


// Get employee's own IT requests
const getEmployeeITRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, priority, requestType } = req.query;
    
    let filter = { employee: req.user.userId };
    
    // Add filters if provided
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (requestType && requestType !== 'all') filter.requestType = requestType;

    const requests = await ITSupportRequest.find(filter)
      .populate('employee', 'fullName email department')
      .populate('itReview.technicianId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalCount = await ITSupportRequest.countDocuments(filter);

    res.json({
      success: true,
      data: requests,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(totalCount / limit),
        count: requests.length,
        totalRecords: totalCount
      },
      message: `Found ${requests.length} IT support requests`
    });

  } catch (error) {
    console.error('Get employee IT requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IT support requests',
      error: error.message
    });
  }
};

// Get single IT request details with approval chain
const getITRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await ITSupportRequest.findById(requestId)
      .populate('employee', 'fullName email department')
      .populate('itReview.technicianId', 'fullName email')
      .populate('financeReview.decidedBy', 'fullName email')
      .populate('resolution.resolvedById', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'IT request not found'
      });
    }

    // Check if user has permission to view this request
    const user = await User.findById(req.user.userId);
    const canView = 
      request.employee._id.equals(req.user.userId) || // Owner
      user.role === 'admin' || // Admin
      user.role === 'it' || // IT department
      request.approvalChain.some(step => step.approver.email === user.email); // Approver

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Get IT request details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IT request details',
      error: error.message
    });
  }
};

// Get supervisor IT requests (pending approval)
const getSupervisorITRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find requests where current user is in the approval chain and status is pending
    const requests = await ITSupportRequest.find({
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
      data: requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get supervisor IT requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IT requests',
      error: error.message
    });
  }
};

// Process supervisor decision
const processSupervisorDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments } = req.body;

    console.log('=== SUPERVISOR IT DECISION PROCESSING ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const request = await ITSupportRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'IT support request not found' 
      });
    }

    // Find current user's step in approval chain
    const currentStepIndex = request.approvalChain.findIndex(
      step => step.approver.email === user.email && step.status === 'pending'
    );

    if (currentStepIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this request or it has already been processed'
      });
    }

    // Update the approval step
    request.approvalChain[currentStepIndex].status = decision;
    request.approvalChain[currentStepIndex].comments = comments;
    request.approvalChain[currentStepIndex].actionDate = new Date();
    request.approvalChain[currentStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
    request.approvalChain[currentStepIndex].decidedBy = req.user.userId;

    // Update overall request status based on decision
    if (decision === 'rejected') {
      request.status = 'supervisor_rejected';

      // Update the legacy supervisorDecision field for backward compatibility
      request.supervisorDecision = {
        decision: 'rejected',
        comments,
        decisionDate: new Date(),
        decidedBy: req.user.userId
      };
    } else if (decision === 'approved') {
      request.status = 'pending_it_review';
      
      // Update legacy supervisorDecision field
      request.supervisorDecision = {
        decision: 'approved',
        comments,
        decisionDate: new Date(),
        decidedBy: req.user.userId
      };
    }

    await request.save();

    // Send notifications based on decision
    const notifications = [];

    if (decision === 'approved') {
      // Notify IT department
      const itDepartment = await User.find({ role: 'it' }).select('email fullName');
    
      if (itDepartment.length > 0) {
        notifications.push(
          sendITSupportEmail.supervisorApprovalToIT(
            itDepartment.map(u => u.email),
            request.employee.fullName,
            request.requestType,
            request.title,
            request.ticketNumber,
            user.fullName,
            request.totalEstimatedCost || null,
            comments
          ).catch(error => {
            console.error('Failed to send IT notification:', error);
            return { error, type: 'it' };
          })
        );
      }
    
      // Notify employee of approval progress
      notifications.push(
        sendITSupportEmail.statusUpdateToEmployee(
          request.employee.email,
          request.ticketNumber,
          'approved',
          `Your IT support request has been approved by ${user.fullName} and is now being reviewed by the IT department.`,
          user.fullName,
          'The IT team will review your request and assign appropriate resources. You will receive updates as work progresses.'
        ).catch(error => {
          console.error('Failed to send employee notification:', error);
          return { error, type: 'employee' };
        })
      );
    
    } else {
      // Request was rejected - notify employee
      notifications.push(
        sendITSupportEmail.statusUpdateToEmployee(
          request.employee.email,
          request.ticketNumber,
          'rejected',
          comments || 'Your IT support request was not approved by the supervisor.',
          user.fullName,
          'Please contact your supervisor for more information or submit a revised request if circumstances change.'
        ).catch(error => {
          console.error('Failed to send employee notification:', error);
          return { error, type: 'employee' };
        })
      );
    }

    // Wait for notifications
    const notificationResults = await Promise.allSettled(notifications);

    res.json({
      success: true,
      message: `IT support request ${decision} successfully`,
      data: request,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Process supervisor decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process supervisor decision',
      error: error.message
    });
  }
};

// Get IT department requests
const getITDepartmentRequests = async (req, res) => {
  try {
    const requests = await ITSupportRequest.find({
      status: { $in: ['pending_it_review', 'it_assigned', 'in_progress', 'waiting_parts'] }
    })
    .populate('employee', 'fullName email department')
    .populate('itReview.technicianId', 'fullName')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get IT department requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IT department requests',
      error: error.message
    });
  }
};

// Process IT department decision
const processITDepartmentDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { 
      decision, 
      comments, 
      estimatedCost, 
      technicianId, 
      priorityLevel,
      estimatedCompletionTime 
    } = req.body;

    const user = await User.findById(req.user.userId);
    const request = await ITSupportRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Update IT review
    request.itReview = {
      decision,
      comments,
      estimatedCost: estimatedCost || 0,
      technicianId: technicianId || req.user.userId,
      reviewDate: new Date(),
      decidedBy: req.user.userId,
      priorityLevel: priorityLevel || request.priority,
      estimatedCompletionTime
    };

    // Update status based on decision
    if (decision === 'approved') {
      if (request.requestType === 'material_request' && estimatedCost > 100000) {
        request.status = 'pending_finance';
      } else {
        request.status = 'it_assigned';
      }
    } else {
      request.status = 'it_rejected';
    }

    await request.save();

    // Send notifications
    const notifications = [];

    if (decision === 'approved') {
      if (request.needsFinanceApproval() && estimatedCost > 100000) {
        // Notify finance department
        const financeUsers = await User.find({ role: 'finance' }).select('email fullName');
        
        if (financeUsers.length > 0) {
          notifications.push(
            sendITSupportEmail.itApprovalToFinance(
              financeUsers.map(u => u.email),
              request.employee.fullName,
              request.title,
              request.ticketNumber,
              estimatedCost,
              comments || 'Approved by IT department'
            ).catch(error => ({ error, type: 'finance' }))
          );
        }
    
        // Notify employee of finance review step
        notifications.push(
          sendITSupportEmail.statusUpdateToEmployee(
            request.employee.email,
            request.ticketNumber,
            'pending_finance',
            'Your IT request has been approved by the IT department and is now pending finance approval due to the high cost.',
            user.fullName,
            'Finance team will review the budget requirements. You will be notified once approved.'
          ).catch(error => ({ error, type: 'employee' }))
        );
    
      } else {
        // Notify employee of IT approval and assignment
        notifications.push(
          sendITSupportEmail.statusUpdateToEmployee(
            request.employee.email,
            request.ticketNumber,
            'it_assigned',
            `Your IT request has been approved and assigned to ${request.itReview.assignedTechnician || 'our IT team'}.`,
            user.fullName,
            estimatedCompletionTime ? `Estimated completion: ${estimatedCompletionTime}` : 'Work will begin shortly and you will receive updates as it progresses.'
          ).catch(error => ({ error, type: 'employee' }))
        );
      }
    
    } else {
      // IT rejected - notify employee
      notifications.push(
        sendITSupportEmail.statusUpdateToEmployee(
          request.employee.email,
          request.ticketNumber,
          'rejected',
          comments || 'Your IT request was not approved by the IT department.',
          user.fullName,
          'Please contact the IT department for more information about alternative solutions.'
        ).catch(error => ({ error, type: 'employee' }))
      );
    }

    const notificationResults = await Promise.allSettled(notifications);

    res.json({
      success: true,
      message: `IT request ${decision} successfully`,
      data: request,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Process IT department decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process IT department decision',
      error: error.message
    });
  }
};

// Get finance IT requests
const getFinanceITRequests = async (req, res) => {
  try {
    const requests = await ITSupportRequest.find({
      $or: [
        { status: 'pending_finance' },
        { requestType: 'material_request', totalEstimatedCost: { $gt: 100000 } }
      ]
    })
    .populate('employee', 'fullName email department')
    .populate('itReview.technicianId', 'fullName')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get finance IT requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch finance IT requests',
      error: error.message
    });
  }
};

// Process finance decision
const processFinanceDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments, approvedAmount } = req.body;

    const user = await User.findById(req.user.userId);
    const request = await ITSupportRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Update finance review
    request.financeReview = {
      decision,
      comments,
      approvedAmount: approvedAmount || request.itReview?.estimatedCost || 0,
      reviewDate: new Date(),
      decidedBy: req.user.userId
    };

    // Update status
    if (decision === 'approved') {
      request.status = 'it_assigned';
    } else {
      request.status = 'finance_rejected';
    }

    await request.save();

    // Send notifications
    const notifications = [];

    if (decision === 'approved') {
      // Notify IT department to proceed
      const itUsers = await User.find({ role: 'it' }).select('email fullName');
      
      if (itUsers.length > 0) {
        notifications.push(
          sendEmail({
            to: itUsers.map(u => u.email),
            subject: `Finance Approved IT Request - Proceed with Work`,
            html: `
              <h3>Finance Department Approved IT Request</h3>
              <p>The finance department has approved a high-cost IT request. You can now proceed with the work.</p>

              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <ul>
                  <li><strong>Employee:</strong> ${request.employee.fullName}</li>
                  <li><strong>Ticket Number:</strong> ${request.ticketNumber}</li>
                  <li><strong>Approved Amount:</strong> ${approvedAmount?.toFixed(2) || 'N/A'}</li>
                  <li><strong>Approved by:</strong> ${user.fullName}</li>
                </ul>
              </div>

              <p>Please assign a technician and begin work on this request.</p>
            `
          }).catch(error => ({ error, type: 'it' }))
        );
      }

      // Notify employee
      notifications.push(
        sendEmail({
          to: request.employee.email,
          subject: 'IT Support Request - Finance Approval Received',
          html: `
            <h3>Your IT Support Request Has Been Approved</h3>
            <p>Dear ${request.employee.fullName},</p>

            <p>Your IT support request has received final approval from the finance department and work will now begin.</p>

            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Ticket Number:</strong> ${request.ticketNumber}</li>
                <li><strong>Status:</strong> Approved - Work Starting</li>
                <li><strong>Approved by:</strong> ${user.fullName} (Finance)</li>
              </ul>
            </div>

            <p>A technician will be assigned shortly and you will receive updates as work progresses.</p>
          `
        }).catch(error => ({ error, type: 'employee' }))
      );

    } else {
      // Finance rejected - notify employee
      notifications.push(
        sendEmail({
          to: request.employee.email,
          subject: 'IT Support Request - Finance Decision',
          html: `
            <h3>IT Support Request - Finance Department Decision</h3>
            <p>Dear ${request.employee.fullName},</p>

            <p>Your IT support request has been reviewed by the finance department.</p>

            <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Ticket Number:</strong> ${request.ticketNumber}</li>
                <li><strong>Decision:</strong> Not Approved</li>
                <li><strong>Reason:</strong> ${comments || 'Budget constraints or cost concerns'}</li>
              </ul>
            </div>

            <p>Please contact the finance department or your supervisor for more information about alternative options.</p>
          `
        }).catch(error => ({ error, type: 'employee' }))
      );
    }

    const notificationResults = await Promise.allSettled(notifications);

    res.json({
      success: true,
      message: `Finance decision processed successfully`,
      data: request,
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

// Save draft IT request
const saveDraft = async (req, res) => {
  try {
    console.log('=== SAVE DRAFT IT REQUEST ===');

    const {
      ticketNumber,
      requestType,
      title,
      description,
      category,
      subcategory,
      priority,
      urgency,
      requestedItems,
      deviceDetails,
      issueDetails
    } = req.body;

    // Get user details
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    // Parse complex fields if they're strings with more relaxed error handling
    let parsedRequestedItems = [];
    let parsedDeviceDetails = {};
    let parsedIssueDetails = {};

    try {
      if (requestedItems) {
        parsedRequestedItems = typeof requestedItems === 'string' ? JSON.parse(requestedItems) : requestedItems;
        if (!Array.isArray(parsedRequestedItems)) {
          parsedRequestedItems = [];
        }
      }
      if (deviceDetails) {
        parsedDeviceDetails = typeof deviceDetails === 'string' ? JSON.parse(deviceDetails) : deviceDetails;
        if (typeof parsedDeviceDetails !== 'object' || parsedDeviceDetails === null) {
          parsedDeviceDetails = {};
        }
      }
      if (issueDetails) {
        parsedIssueDetails = typeof issueDetails === 'string' ? JSON.parse(issueDetails) : issueDetails;
        if (typeof parsedIssueDetails !== 'object' || parsedIssueDetails === null) {
          parsedIssueDetails = {};
        }
      }
    } catch (error) {
      // Use empty defaults if parsing fails for drafts
      console.warn('JSON parsing warning for draft:', error);
    }

    // Create draft IT request (no approval chain needed for drafts and minimal validation)
    const draftRequest = new ITSupportRequest({
      ticketNumber: ticketNumber || `DRAFT-${Date.now()}`,
      employee: req.user.userId,
      requestType: requestType || 'technical_issue',
      title: title || 'Draft IT Request',
      description: description || 'Draft - to be completed',
      department: employee.department,
      category: category || 'other',
      subcategory: subcategory || 'other',
      priority: priority || 'medium',
      urgency: urgency || 'normal',
      requestedItems: parsedRequestedItems,
      deviceDetails: parsedDeviceDetails,
      issueDetails: parsedIssueDetails,
      contactInfo: {
        phone: employee.phone || '',
        email: employee.email
      },
      status: 'draft',
      approvalChain: [] // Empty for drafts
    });

    await draftRequest.save();
    await draftRequest.populate('employee', 'fullName email department');

    res.json({
      success: true,
      message: 'Draft saved successfully',
      data: draftRequest
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


// Get IT request statistics
const getITRequestStats = async (req, res) => {
    try {
      const { startDate, endDate, department, status, requestType } = req.query;
  
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
      if (status) matchFilter.status = status;
  
      // Request type filter
      if (requestType) matchFilter.requestType = requestType;
  
      const stats = await ITSupportRequest.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            avgResolutionTime: { $avg: '$slaMetrics.resolutionTime' },
            statusBreakdown: { $push: '$status' },
            categoryBreakdown: { $push: '$category' },
            priorityBreakdown: { $push: '$priority' },
            requestTypeBreakdown: { $push: '$requestType' }
          }
        }
      ]);
  
      // Process breakdowns
      const statusCounts = {};
      const categoryCounts = {};
      const priorityCounts = {};
      const requestTypeCounts = {};
  
      if (stats.length > 0) {
        stats[0].statusBreakdown.forEach(status => {
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
  
        stats[0].categoryBreakdown.forEach(category => {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
  
        stats[0].priorityBreakdown.forEach(priority => {
          priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
        });
  
        stats[0].requestTypeBreakdown.forEach(type => {
          requestTypeCounts[type] = (requestTypeCounts[type] || 0) + 1;
        });
      }
  
      res.json({
        success: true,
        data: {
          summary: stats.length > 0 ? {
            totalRequests: stats[0].totalRequests,
            avgResolutionTime: Math.round(stats[0].avgResolutionTime || 0)
          } : {
            totalRequests: 0,
            avgResolutionTime: 0
          },
          breakdown: {
            status: statusCounts,
            category: categoryCounts,
            priority: priorityCounts,
            requestType: requestTypeCounts
          }
        }
      });
  
    } catch (error) {
      console.error('Get IT request stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch IT request statistics',
        error: error.message
      });
    }
};
  

// Get inventory status
const getInventoryStatus = async (req, res) => {
    try {
      // Mock inventory data - would integrate with actual inventory management system
      const mockInventoryData = [
        {
          item: 'Wireless Mouse',
          category: 'accessories',
          inStock: 15,
          allocated: 8,
          available: 7,
          reorderLevel: 10,
          needsReorder: false
        },
        {
          item: 'HDMI Cable',
          category: 'accessories', 
          inStock: 3,
          allocated: 2,
          available: 1,
          reorderLevel: 5,
          needsReorder: true
        },
        {
          item: 'Laptop Charger',
          category: 'hardware',
          inStock: 8,
          allocated: 5,
          available: 3,
          reorderLevel: 4,
          needsReorder: true
        }
      ];
  
      res.json({
        success: true,
        data: mockInventoryData,
        message: 'Inventory status data (mock)'
      });
  
    } catch (error) {
      console.error('Get inventory status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch inventory status',
        error: error.message
      });
    }
};

// Get asset analytics
const getAssetAnalytics = async (req, res) => {
    try {
      const [
        totalAssets,
        assetsByCategory,
        recentAssignments
      ] = await Promise.all([
        ITSupportRequest.aggregate([
          { $unwind: '$assetAssignment.assignedAssets' },
          { $count: 'totalAssets' }
        ]),
  
        ITSupportRequest.aggregate([
          { $unwind: '$assetAssignment.assignedAssets' },
          {
            $group: {
              _id: '$category',
              assetCount: { $sum: 1 },
              totalValue: { $sum: '$assetAssignment.totalAssignedValue' }
            }
          },
          { $sort: { assetCount: -1 } }
        ]),
  
        ITSupportRequest.find({ 
          'assetAssignment.assignedAssets': { $exists: true, $ne: [] },
          'assetAssignment.assignedAssets.assignmentDate': { 
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
          }
        })
        .populate('employee', 'fullName department')
        .sort({ 'assetAssignment.assignedAssets.assignmentDate': -1 })
        .limit(10)
      ]);
  
      res.json({
        success: true,
        data: {
          totalAssets: totalAssets[0]?.totalAssets || 0,
          assetsByCategory,
          recentAssignments
        }
      });
  
    } catch (error) {
      console.error('Get asset analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch asset analytics',
        error: error.message
      });
    }
};

// Get category analytics
const getCategoryAnalytics = async (req, res) => {
    try {
      const { period = 'monthly' } = req.query;
  
      // Calculate date range based on period
      let startDate = new Date();
      switch (period) {
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarterly':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        default:
          startDate.setMonth(startDate.getMonth() - 1);
      }
  
      const analytics = await ITSupportRequest.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            resolvedCount: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['resolved', 'closed']] },
                  1,
                  0
                ]
              }
            },
            avgResolutionTime: { $avg: '$slaMetrics.resolutionTime' },
            criticalCount: {
              $sum: {
                $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0]
              }
            }
          }
        },
        {
          $addFields: {
            resolutionRate: {
              $multiply: [
                { $divide: ['$resolvedCount', '$count'] },
                100
              ]
            }
          }
        },
        { $sort: { count: -1 } }
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

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const user = await User.findById(userId);

    let filter = {};

    console.log('=== GET DASHBOARD STATS ===');
    console.log('User:', { userId, role, department: user.department });

    // FIXED: Role-based filtering logic
    if (role === 'employee') {
      filter.employee = userId;
    } else if (role === 'supervisor') {
      // Supervisors see requests they can approve
      filter['approvalChain.approver.email'] = user.email;
    } else if (role === 'it') {
      // FIXED: IT sees all requests that need their attention
      filter.$or = [
        { status: { $in: ['pending_it_review', 'supervisor_approved', 'it_assigned', 'in_progress', 'waiting_parts'] } },
        { 'itReview.technicianId': userId }
      ];
    } else if (role === 'finance') {
      // Finance sees high-cost requests
      filter.$or = [
        { status: 'pending_finance' },
        { requestType: 'material_request', totalEstimatedCost: { $gt: 100000 } }
      ];
    }
    // Admin sees all (no filter)

    console.log('Dashboard filter:', JSON.stringify(filter, null, 2));

    const [
      totalCount,
      pendingCount,
      inProgressCount,
      resolvedCount,
      materialRequestCount,
      technicalIssueCount,
      criticalCount,
      recentRequests,
      slaBreached
    ] = await Promise.all([
      ITSupportRequest.countDocuments(filter),
      ITSupportRequest.countDocuments({ 
        ...filter, 
        status: { $in: ['pending_supervisor', 'pending_it_review', 'pending_finance'] } 
      }),
      ITSupportRequest.countDocuments({ 
        ...filter, 
        status: { $in: ['it_assigned', 'in_progress', 'waiting_parts'] } 
      }),
      ITSupportRequest.countDocuments({ 
        ...filter, 
        status: { $in: ['resolved', 'closed'] } 
      }),
      ITSupportRequest.countDocuments({ ...filter, requestType: 'material_request' }),
      ITSupportRequest.countDocuments({ ...filter, requestType: 'technical_issue' }),
      ITSupportRequest.countDocuments({ 
        ...filter, 
        priority: 'critical',
        status: { $nin: ['resolved', 'closed', 'rejected'] }
      }),

      // Recent requests (last 10)
      ITSupportRequest.find(filter)
        .populate('employee', 'fullName email department')
        .sort({ createdAt: -1 })
        .limit(10),

      // SLA breached count
      ITSupportRequest.countDocuments({
        ...filter,
        'slaMetrics.slaBreached': true,
        status: { $nin: ['resolved', 'closed'] }
      })
    ]);

    // FIXED: Debug information
    if (totalCount === 0) {
      console.log('=== DEBUG: No requests found, checking database ===');
      const allRequestsCount = await ITSupportRequest.countDocuments({});
      console.log('Total requests in database:', allRequestsCount);
      
      if (allRequestsCount > 0) {
        const sampleRequests = await ITSupportRequest.find({}).limit(5).select('status employee requestType');
        console.log('Sample requests:', sampleRequests);
      }
    }

    const stats = {
      summary: {
        total: totalCount,
        pending: pendingCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        materialRequests: materialRequestCount,
        technicalIssues: technicalIssueCount,
        critical: criticalCount,
        slaBreached: slaBreached
      },
      recent: recentRequests,
      trends: {
        resolutionRate: totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0,
        avgResponseTime: 45, // Mock data - would calculate from actual SLA metrics
        slaCompliance: totalCount > 0 ? Math.round(((totalCount - slaBreached) / totalCount) * 100) : 100
      }
    };

    console.log('Dashboard stats result:', {
      total: totalCount,
      pending: pendingCount,
      inProgress: inProgressCount,
      resolved: resolvedCount
    });

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
  
// Get IT requests by user role (unified endpoint)
const getITRequestsByRole = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const { status, page = 1, limit = 20, requestType, priority } = req.query;

    let query = {};
    let baseFilter = {};

    if (status) baseFilter.status = status;
    if (requestType) baseFilter.requestType = requestType;
    if (priority) baseFilter.priority = priority;

    console.log('=== GET IT REQUESTS BY ROLE ===');
    console.log('User:', {
      userId: req.user.userId,
      role: user.role,
      department: user.department,
      email: user.email,
      fullName: user.fullName
    });

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

      case 'it':
        // FIXED: IT should see ALL requests that need IT attention, not just specific statuses
        query = {
          ...baseFilter,
          $or: [
            // Requests pending IT review
            { status: 'pending_it_review' },
            // Requests already assigned to IT
            { status: { $in: ['it_assigned', 'in_progress', 'waiting_parts'] } },
            // Requests assigned to this specific technician
            { 'itReview.technicianId': user._id },
            // FIXED: Also include supervisor-approved requests that need IT attention
            { status: 'supervisor_approved' },
            // FIXED: Include resolved requests for IT visibility
            { status: 'resolved', 'itReview.technicianId': user._id }
          ]
        };
        break;

      case 'finance':
        query = {
          ...baseFilter,
          $or: [
            { status: 'pending_finance' },
            { requestType: 'material_request', totalEstimatedCost: { $gt: 100000 } },
            // FIXED: Include IT-approved high-cost requests
            { 
              status: 'it_approved', 
              $or: [
                { 'itReview.estimatedCost': { $gt: 100000 } },
                { totalEstimatedCost: { $gt: 100000 } }
              ]
            }
          ]
        };
        break;

      case 'admin':
        query = baseFilter; // Admins see everything
        break;

      default:
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
    }

    console.log('User role:', user.role);
    console.log('Final query:', JSON.stringify(query, null, 2));

    const requests = await ITSupportRequest.find(query)
      .populate('employee', 'fullName email department')
      .populate('itReview.technicianId', 'fullName')
      .populate('financeReview.decidedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ITSupportRequest.countDocuments(query);

    console.log(`Found ${requests.length} requests for ${user.role}`);
    
    // FIXED: Debug log to see what requests exist in database
    if (requests.length === 0 && user.role === 'it') {
      console.log('=== DEBUG: Checking all IT requests in database ===');
      const allRequests = await ITSupportRequest.find({}).select('status ticketNumber employee').populate('employee', 'fullName');
      console.log('All requests in database:', allRequests.map(req => ({
        ticketNumber: req.ticketNumber,
        status: req.status,
        employee: req.employee?.fullName
      })));
    }

    res.json({
      success: true,
      data: requests,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: requests.length,
        totalRecords: total
      },
      role: user.role,
      message: `Found ${requests.length} IT support requests`
    });

  } catch (error) {
    console.error('Get IT requests by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IT requests',
      error: error.message
    });
  }
};


const updateFulfillmentStatus = async (req, res) => {
    try {
      const { requestId } = req.params;
      const { 
        status, 
        workLog, 
        resolution,
        timeSpent,
        comments 
      } = req.body;
  
      console.log('=== UPDATE FULFILLMENT STATUS ===');
      console.log('Request ID:', requestId);
      console.log('New Status:', status);
  
      const user = await User.findById(req.user.userId);
      const request = await ITSupportRequest.findById(requestId)
        .populate('employee', 'fullName email department');
  
      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }
  
      // Check permissions
      const canUpdate = 
        user.role === 'admin' || 
        user.role === 'it' ||
        request.itReview?.technicianId?.equals(user._id);
  
      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
  
      // Update request status
      if (status) request.status = status;
  
      // Add work log entry
      if (workLog) {
        if (!request.itReview.workLog) {
          request.itReview.workLog = [];
        }
        request.itReview.workLog.push({
          date: new Date(),
          technician: user.fullName,
          activity: workLog,
          timeSpent: timeSpent ? parseInt(timeSpent) : 0,
          status: status || request.status
        });
      }
  
      // Handle resolution
      if (status === 'resolved' && resolution) {
        request.resolution = {
          description: resolution,
          resolvedBy: user.fullName,
          resolvedById: user._id,
          resolvedDate: new Date(),
          solution: resolution
        };
  
        // Calculate resolution time
        if (request.submittedAt) {
          request.slaMetrics.resolutionTime = Math.floor(
            (new Date() - new Date(request.submittedAt)) / (1000 * 60)
          );
        }
      }
  
      await request.save();
  
      // Send notifications based on status
      const notifications = [];
  
      if (status === 'resolved') {
        // Notify employee of resolution
        notifications.push(
          sendITSupportEmail.resolutionToEmployee(
            request.employee.email,
            request.ticketNumber,
            request.requestType,
            resolution,
            user.fullName,
            request.requestType === 'material_request' ? 'Items have been delivered to your specified location.' : ''
          ).catch(error => {
            console.error('Failed to send employee resolution notification:', error);
            return { error, type: 'employee' };
          })
        );
      } else if (status === 'in_progress') {
        // Notify employee that work has started
        notifications.push(
          sendITSupportEmail.statusUpdateToEmployee(
            request.employee.email,
            request.ticketNumber,
            'in_progress',
            workLog || `Work has started on your IT request by ${user.fullName}.`,
            user.fullName,
            'You will receive updates as work progresses. Feel free to contact us if you have any questions.'
          ).catch(error => {
            console.error('Failed to send employee progress notification:', error);
            return { error, type: 'employee' };
          })
        );
      }
  
      // Wait for notifications
      const notificationResults = await Promise.allSettled(notifications);
  
      res.json({
        success: true,
        message: 'Fulfillment status updated successfully',
        data: request,
        notifications: {
          sent: notificationResults.filter(r => r.status === 'fulfilled').length,
          failed: notificationResults.filter(r => r.status === 'rejected').length
        }
      });
  
    } catch (error) {
      console.error('Update fulfillment status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update fulfillment status',
        error: error.message
      });
    }
  };

const updateAssetAssignment = async (req, res) => {
    try {
      const { requestId } = req.params;
      const { assignedAssets, totalAssignedValue } = req.body;
  
      const user = await User.findById(req.user.userId);
      const request = await ITSupportRequest.findById(requestId)
        .populate('employee', 'fullName email department');
  
      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }
  
      // Check permissions
      const canUpdate = user.role === 'admin' || user.role === 'it';
  
      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
  
      // Update asset assignment
      request.assetAssignment = {
        assignedAssets: assignedAssets.map(asset => ({
          ...asset,
          assignmentDate: new Date()
        })),
        totalAssignedValue: totalAssignedValue || 0
      };
  
      // Update status to resolved if assets assigned
      if (assignedAssets && assignedAssets.length > 0) {
        request.status = 'resolved';
        request.resolution = {
          description: `Assets assigned: ${assignedAssets.map(a => a.description).join(', ')}`,
          resolvedBy: user.fullName,
          resolvedById: user._id,
          resolvedDate: new Date()
        };
      }
  
      await request.save();
  
      // Notify employee of asset assignment
      if (assignedAssets && assignedAssets.length > 0) {
        await sendEmail({
          to: request.employee.email,
          subject: 'IT Assets Assigned to You',
          html: `
            <h3>IT Assets Have Been Assigned to You</h3>
            <p>Dear ${request.employee.fullName},</p>
  
            <p>The following IT assets have been assigned to you for your request:</p>
  
            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Ticket Number:</strong> ${request.ticketNumber}</li>
                <li><strong>Assigned by:</strong> ${user.fullName}</li>
                <li><strong>Assets:</strong></li>
                <ul>
                  ${assignedAssets.map(asset => `
                    <li>${asset.description} ${asset.assetTag ? `(Tag: ${asset.assetTag})` : ''}</li>
                  `).join('')}
                </ul>
              </ul>
            </div>
  
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Important:</strong> Please take care of these assets and report any issues immediately. Some assets may need to be returned when no longer needed.</p>
            </div>
  
            <p>Thank you for using our IT Support System!</p>
          `
        }).catch(error => {
          console.error('Failed to send asset assignment notification:', error);
        });
      }
  
      res.json({
        success: true,
        message: 'Asset assignment updated successfully',
        data: request
      });
  
    } catch (error) {
      console.error('Update asset assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update asset assignment',
        error: error.message
      });
    }
};

const updateITRequest = async (req, res) => {
    try {
      const { requestId } = req.params;
      const updateData = req.body;
  
      const request = await ITSupportRequest.findById(requestId);
  
      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }
  
      // Check if user can update this request
      const user = await User.findById(req.user.userId);
      const canUpdate = 
        request.employee.equals(req.user.userId) || // Owner
        user.role === 'admin' || // Admin
        user.role === 'it'; // IT department
  
      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
  
      // Only allow updates for drafts or certain statuses
      const updatableStatuses = ['draft', 'pending_supervisor', 'it_assigned', 'in_progress'];
      if (!updatableStatuses.includes(request.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update request in current status'
        });
      }
  
      // Update allowed fields
      const allowedFields = [
        'title', 'description', 'category', 'subcategory', 'priority', 'urgency',
        'businessJustification', 'businessImpact', 'location', 'requestedItems',
        'deviceDetails', 'issueDetails', 'troubleshootingSteps'
      ];
  
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          if (['requestedItems', 'deviceDetails', 'issueDetails', 'troubleshootingSteps'].includes(field)) {
            try {
              request[field] = typeof updateData[field] === 'string' ? 
                              JSON.parse(updateData[field]) : updateData[field];
            } catch (error) {
              // Keep existing data if parsing fails
            }
          } else {
            request[field] = updateData[field];
          }
        }
      });
  
      await request.save();
      await request.populate('employee', 'fullName email department');
  
      res.json({
        success: true,
        message: 'IT request updated successfully',
        data: request
      });
  
    } catch (error) {
      console.error('Update IT request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update IT request',
        error: error.message
      });
    }
};

const getAllITRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, department, priority, requestType, startDate, endDate } = req.query;
    
    let filter = {};
    
    // Add filters
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (requestType && requestType !== 'all') filter.requestType = requestType;
    if (department && department !== 'all') {
      const users = await User.find({ department }).select('_id');
      filter.employee = { $in: users.map(u => u._id) };
    }
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const requests = await ITSupportRequest.find(filter)
      .populate('employee', 'fullName email department')
      .populate('itReview.technicianId', 'fullName')
      .populate('financeReview.decidedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalCount = await ITSupportRequest.countDocuments(filter);

    res.json({
      success: true,
      data: requests,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(totalCount / limit),
        count: requests.length,
        totalRecords: totalCount
      }
    });

  } catch (error) {
    console.error('Get all IT requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IT requests',
      error: error.message
    });
  }
};

const getApprovalChainPreview = async (req, res) => {
  try {
    const { department, employeeName } = req.body;
    
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    // Generate approval chain preview
    const approvalChain = getApprovalChain(employee.fullName, employee.department);
    
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

const deleteITRequest = async (req, res) => {
    try {
      const { requestId } = req.params;
  
      const request = await ITSupportRequest.findById(requestId);
  
      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }
  
      // Check permissions
      const user = await User.findById(req.user.userId);
      const canDelete = 
        request.employee.equals(req.user.userId) || 
        user.role === 'admin'; 
  
      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
  
      // Only allow deletion of draft requests
      if (request.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Can only delete draft requests'
        });
      }
  
      // Clean up attachments if any
      if (request.attachments && request.attachments.length > 0) {
        await Promise.allSettled(
          request.attachments.map(attachment => {
            const filePath = path.join(__dirname, '../uploads/it-support', attachment.publicId);
            return fs.promises.unlink(filePath).catch(e => console.error('File cleanup failed:', e));
          })
        );
      }
  
      await ITSupportRequest.findByIdAndDelete(requestId);
  
      res.json({
        success: true,
        message: 'Draft IT request deleted successfully'
      });
  
    } catch (error) {
      console.error('Delete IT request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete IT request',
        error: error.message
      });
    }
};

// Export all functions
module.exports = {
    // Core CRUD operations
    createITRequest,
    updateITRequest,
    deleteITRequest,
  
    // Employee functions
    getEmployeeITRequests,
    getITRequestDetails,
  
    // Supervisor functions
    getSupervisorITRequests,
    processSupervisorDecision,
  
    // IT Department functions
    getITDepartmentRequests,
    processITDepartmentDecision,
    updateFulfillmentStatus,
    updateAssetAssignment,
  
    // Finance functions
    getFinanceITRequests,
    processFinanceDecision,
  
    // Admin functions
    getAllITRequests,
  
    // Utility functions
    getApprovalChainPreview,
    getITRequestsByRole,
  
    // Analytics and reporting
    getDashboardStats,
    getCategoryAnalytics,
    getAssetAnalytics,
    getInventoryStatus,
    getITRequestStats,
  
    // Draft management
    saveDraft
  };