const CashRequest = require('../models/CashRequest');
const User = require('../models/User');
const { getApprovalChain } = require('../config/departmentStructure');
const { sendCashRequestEmail, sendEmail } = require('../services/emailService');
const fs = require('fs');
const path = require('path');

// Get employee's own requests
const getEmployeeRequests = async (req, res) => {
  try {
    const requests = await CashRequest.find({ employee: req.user.userId })
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get employee requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
};

// Get single request details with approval chain
const getEmployeeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user has permission to view this request
    const user = await User.findById(req.user.userId);
    const canView = 
      request.employee._id.equals(req.user.userId) || // Owner
      user.role === 'admin' || // Admin
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
    console.error('Get request details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request details',
      error: error.message
    });
  }
};

// Admin functions
const getAllRequests = async (req, res) => {
  try {
    const { status, department, page = 1, limit = 20 } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (department) {
      // Find users in the specified department
      const users = await User.find({ department }).select('_id');
      filter.employee = { $in: users.map(u => u._id) };
    }

    const requests = await CashRequest.find(filter)
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CashRequest.countDocuments(filter);

    res.json({
      success: true,
      data: requests,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: requests.length,
        totalRecords: total
      }
    });

  } catch (error) {
    console.error('Get all requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
};

// Finance functions
const getFinanceRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    let query = {};
    
    if (user.role === 'finance') {
      // Finance users see requests assigned to them or pending finance approval
      query = {
        $or: [
          { status: 'pending_finance' },
          { status: 'approved' },
          { status: 'disbursed' },
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
      // Admins see all finance-related requests
      query = {
        status: { $in: ['pending_finance', 'approved', 'disbursed', 'completed'] }
      };
    }

    const requests = await CashRequest.find(query)
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get finance requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch finance requests',
      error: error.message
    });
  }
};

// Process finance decision
const processFinanceDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments, amountApproved, disbursementAmount } = req.body;
    
    console.log('=== FINANCE DECISION PROCESSING ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);

    const user = await User.findById(req.user.userId);
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user can process finance decision
    const canProcess = 
      user.role === 'admin' || 
      user.role === 'finance' ||
      request.approvalChain.some(step => 
        step.approver.email === user.email && 
        (step.approver.role === 'Finance Officer' || step.approver.role === 'President')
      );

    if (!canProcess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update finance decision
    request.financeDecision = {
      decision,
      comments,
      decisionDate: new Date()
    };

    if (decision === 'approved') {
      request.status = 'approved';
      if (amountApproved) {
        request.amountApproved = parseFloat(amountApproved);
      }
      
      // If disbursement amount provided, mark as disbursed
      if (disbursementAmount) {
        request.status = 'disbursed';
        request.disbursementDetails = {
          date: new Date(),
          amount: parseFloat(disbursementAmount),
          disbursedBy: req.user.userId
        };
      }
    } else {
      request.status = 'denied';
    }

    // Update approval chain
    const financeStepIndex = request.approvalChain.findIndex(step => 
      step.approver.email === user.email && step.status === 'pending'
    );

    if (financeStepIndex !== -1) {
      request.approvalChain[financeStepIndex].status = decision;
      request.approvalChain[financeStepIndex].comments = comments;
      request.approvalChain[financeStepIndex].actionDate = new Date();
      request.approvalChain[financeStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
      request.approvalChain[financeStepIndex].decidedBy = req.user.userId;
    }

    request.financeOfficer = req.user.userId;

    await request.save();

    // Send notifications based on decision
    const notifications = [];

    if (decision === 'approved') {
      // Notify employee of approval and disbursement
      const disbursedAmount = disbursementAmount || amountApproved || request.amountRequested;
      
      notifications.push(
        sendCashRequestEmail.approvalToEmployee(
          request.employee.email,
          disbursedAmount,
          requestId,
          user.fullName,
          comments
        ).catch(error => {
          console.error('Failed to send employee approval notification:', error);
          return { error, type: 'employee' };
        })
      );

      // If disbursed, send disbursement notification
      if (disbursementAmount) {
        notifications.push(
          sendCashRequestEmail.disbursementToEmployee(
            request.employee.email,
            parseFloat(disbursementAmount),
            requestId,
            user.fullName
          ).catch(error => {
            console.error('Failed to send disbursement notification:', error);
            return { error, type: 'disbursement' };
          })
        );
      }

      // Notify admins of approval
      const admins = await User.find({ role: 'admin' }).select('email fullName');
      if (admins.length > 0) {
        notifications.push(
          sendEmail({
            to: admins.map(a => a.email),
            subject: `Cash Request ${disbursementAmount ? 'Disbursed' : 'Approved'} - ${request.employee.fullName}`,
            html: `
              <h3>Cash Request ${disbursementAmount ? 'Disbursed' : 'Approved'}</h3>
              <p>A cash request has been ${disbursementAmount ? 'approved and disbursed' : 'approved'} by the finance team.</p>
              
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <ul>
                  <li><strong>Employee:</strong> ${request.employee.fullName}</li>
                  <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                  <li><strong>Amount:</strong> XAF ${parseFloat(disbursedAmount).toFixed(2)}</li>
                  <li><strong>Processed by:</strong> ${user.fullName}</li>
                  <li><strong>Status:</strong> ${request.status.replace(/_/g, ' ').toUpperCase()}</li>
                </ul>
              </div>
            `
          }).catch(error => {
            console.error('Failed to send admin notification:', error);
            return { error, type: 'admin' };
          })
        );
      }

    } else {
      // Notify employee of denial
      notifications.push(
        sendCashRequestEmail.denialToEmployee(
          request.employee.email,
          comments || 'Request denied by finance team',
          requestId,
          user.fullName
        ).catch(error => {
          console.error('Failed to send employee denial notification:', error);
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
      message: `Request ${decision} by finance`,
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

// Get supervisor justifications (for pending justification approvals)
const getSupervisorJustifications = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const requests = await CashRequest.find({
      status: 'justification_pending_supervisor',
      $or: [
        { supervisor: req.user.userId },
        { 'approvalChain.approver.email': user.email }
      ]
    })
    .populate('employee', 'fullName email department')
    .sort({ 'justification.justificationDate': -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get supervisor justifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch justifications',
      error: error.message
    });
  }
};

// Get finance justifications
const getFinanceJustifications = async (req, res) => {
  try {
    const requests = await CashRequest.find({
      status: 'justification_pending_finance'
    })
    .populate('employee', 'fullName email department')
    .sort({ 'justification.justificationDate': -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get finance justifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch justifications',
      error: error.message
    });
  }
};

// Submit justification
const submitJustification = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { amountSpent, balanceReturned, details } = req.body;

    console.log('=== JUSTIFICATION SUBMISSION STARTED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Files received:', req.files ? req.files.length : 0);

    // Validate required fields
    if (!amountSpent || !balanceReturned || !details) {
      throw new Error('Missing required fields: amountSpent, balanceReturned, or details');
    }

    // Convert and validate amounts
    const spentAmount = Number(amountSpent);
    const returnedAmount = Number(balanceReturned);
    
    if (isNaN(spentAmount)) throw new Error('Invalid amount spent');
    if (isNaN(returnedAmount)) throw new Error('Invalid balance returned');
    if (spentAmount < 0) throw new Error('Amount spent cannot be negative');
    if (returnedAmount < 0) throw new Error('Balance returned cannot be negative');

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email')
      .populate('supervisor', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user can submit justification
    if (!request.employee._id.equals(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!request.canSubmitJustification()) {
      return res.status(400).json({
        success: false,
        message: 'Request is not in a state where justification can be submitted'
      });
    }

    // Process justification documents
    let documents = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const fileName = `${Date.now()}-${file.originalname}`;
          const uploadDir = path.join(__dirname, '../uploads/justifications');
          const filePath = path.join(uploadDir, fileName);
          
          await fs.promises.mkdir(uploadDir, { recursive: true });
          if (file.path) {
            await fs.promises.rename(file.path, filePath);
          }
          
          documents.push({
            name: file.originalname,
            url: `/uploads/justifications/${fileName}`,
            publicId: fileName,
            size: file.size,
            mimetype: file.mimetype
          });
        } catch (fileError) {
          console.error('Error processing justification file:', file.originalname, fileError);
          throw new Error(`Failed to process file: ${file.originalname}`);
        }
      }
    }

    // Validate amounts against disbursed amount
    const disbursedAmount = request.disbursementDetails?.amount || 0;
    const total = spentAmount + returnedAmount;
    
    if (Math.abs(total - disbursedAmount) > 0.01) { // Allow small rounding differences
      throw new Error(`Total of amount spent (${spentAmount}) and balance returned (${returnedAmount}) must equal disbursed amount (${disbursedAmount})`);
    }

    // Update justification
    request.justification = {
      amountSpent: spentAmount,
      balanceReturned: returnedAmount,
      details,
      documents,
      justificationDate: new Date()
    };

    request.status = 'justification_pending_supervisor';

    // Clear previous justification approvals if any exist
    request.justificationApproval = {
      supervisorDecision: null,
      financeDecision: null
    };

    await request.save();

    // Send notifications
    const notifications = [];
    
    // 1. Notify supervisor that justification needs approval
    if (request.supervisor) {
      notifications.push(
        sendEmail({
          to: request.supervisor.email,
          subject: `🔍 Cash Justification Needs Your Approval - ${request.employee.fullName}`,
          html: `
            <h3>Cash Justification Requires Your Approval</h3>
            <p>Dear ${request.supervisor.fullName},</p>
            
            <p><strong>${request.employee.fullName}</strong> has submitted justification for their cash request and requires your approval.</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
              <p><strong>Justification Details:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Amount Disbursed:</strong> XAF ${disbursedAmount.toFixed(2)}</li>
                <li><strong>Amount Spent:</strong> XAF ${spentAmount.toFixed(2)}</li>
                <li><strong>Balance Returned:</strong> XAF ${returnedAmount.toFixed(2)}</li>
                <li><strong>Status:</strong> <span style="color: #ffc107;">Awaiting Your Approval</span></li>
              </ul>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Spending Details:</strong></p>
              <p style="font-style: italic;">${details}</p>
            </div>
            
            <p>Please review and approve the justification in the supervisor portal.</p>
            
            <p><strong>Action Required:</strong> <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/supervisor/justification/${requestId}" style="color: #007bff;">Review Justification</a></p>
            
            <p>Thank you!</p>
          `
        }).catch(error => {
          console.error('Failed to send supervisor justification notification:', error);
          return { error, type: 'supervisor' };
        })
      );
    }

    // 2. Notify admins
    const admins = await User.find({ role: 'admin' }).select('email fullName');
    if (admins.length > 0) {
      notifications.push(
        sendEmail({
          to: admins.map(a => a.email),
          subject: `Justification Submitted - ${request.employee.fullName}`,
          html: `
            <h3>Cash Justification Submitted for Approval</h3>
            <p>A cash justification has been submitted and is pending supervisor approval.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Employee:</strong> ${request.employee.fullName}</li>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Amount Spent:</strong> XAF ${spentAmount.toFixed(2)}</li>
                <li><strong>Balance Returned:</strong> XAF ${returnedAmount.toFixed(2)}</li>
                <li><strong>Supervisor:</strong> ${request.supervisor?.fullName || 'N/A'}</li>
                <li><strong>Status:</strong> Pending Supervisor Approval</li>
              </ul>
            </div>
            
            <p>The supervisor will review and approve before it goes to finance for final closure.</p>
          `
        }).catch(error => {
          console.error('Failed to send admin notification:', error);
          return { error, type: 'admin' };
        })
      );
    }

    // 3. Confirm to employee that justification was submitted
    notifications.push(
      sendEmail({
        to: request.employee.email,
        subject: 'Justification Submitted Successfully',
        html: `
          <h3>Your Justification Has Been Submitted</h3>
          <p>Dear ${request.employee.fullName},</p>
          
          <p>Thank you for submitting your cash justification. It has been received and is now under review.</p>
          
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
            <p><strong>Justification Summary:</strong></p>
            <ul>
              <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Amount Spent:</strong> XAF ${spentAmount.toFixed(2)}</li>
              <li><strong>Balance Returned:</strong> XAF ${returnedAmount.toFixed(2)}</li>
              <li><strong>Status:</strong> <span style="color: #ffc107;">Pending Supervisor Review</span></li>
            </ul>
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Your supervisor will review and approve the justification</li>
            <li>Once supervisor approved, finance will conduct final review</li>
            <li>You will be notified of the final status</li>
          </ol>
          
          <p>You will receive email notifications as your justification progresses through the approval process.</p>
          
          <p>Thank you!</p>
        `
      }).catch(error => {
        console.error('Failed to send employee confirmation:', error);
        return { error, type: 'employee' };
      })
    );

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

    console.log('=== JUSTIFICATION SUBMITTED SUCCESSFULLY ===');
    res.json({
      success: true,
      message: 'Justification submitted successfully and is pending supervisor approval',
      data: request,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Submit justification error:', error);
    
    // Clean up uploaded files if submission failed
    if (req.files && req.files.length > 0) {
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path) {
            return fs.promises.unlink(file.path).catch(e => console.error('File cleanup failed:', e));
          }
        })
      );
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit justification',
      error: error.message
    });
  }
};

// Get admin request details
const getAdminRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department')
      .populate('supervisorDecision.decidedBy', 'fullName email')
      .populate('financeOfficer', 'fullName email')
      .populate('disbursementDetails.disbursedBy', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Get admin request details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request details',
      error: error.message
    });
  }
};

// Additional helper methods for justification workflow
const processSupervisorJustificationDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments } = req.body;

    console.log('=== SUPERVISOR JUSTIFICATION DECISION PROCESSING ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);
    console.log('Supervisor:', req.user.userId);

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be "approve" or "reject"'
      });
    }

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email')
      .populate('supervisor', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (!request.canSupervisorApproveJustification()) {
      return res.status(400).json({
        success: false,
        message: 'Justification is not pending supervisor approval'
      });
    }

    request.justificationApproval.supervisorDecision = {
      decision,
      comments,
      decisionDate: new Date(),
      decidedBy: req.user.userId
    };

    if (decision === 'approve') {
      request.status = 'justification_pending_finance';
    } else {
      request.status = 'justification_rejected';
    }

    await request.save();

    // Send notifications
    const notifications = [];

    if (decision === 'approve') {
      // 1. Notify Finance Team
      const financeTeam = await User.find({ role: 'finance' }).select('email fullName');
      
      if (financeTeam.length > 0) {
        notifications.push(
          sendEmail({
            to: financeTeam.map(f => f.email),
            subject: `💰 Cash Justification Ready for Final Approval - ${request.employee.fullName}`,
            html: `
              <h3>Cash Justification Ready for Final Review</h3>
              <p>Dear Finance Team,</p>
              
              <p>A cash justification has been approved by the supervisor and is ready for your final review.</p>
              
              <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #17a2b8;">
                <p><strong>Justification Details:</strong></p>
                <ul>
                  <li><strong>Employee:</strong> ${request.employee.fullName}</li>
                  <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                  <li><strong>Amount Spent:</strong> XAF ${request.justification?.amountSpent?.toFixed(2) || '0.00'}</li>
                  <li><strong>Balance Returned:</strong> XAF ${request.justification?.balanceReturned?.toFixed(2) || '0.00'}</li>
                  <li><strong>Supervisor:</strong> ${request.supervisor?.fullName || 'N/A'}</li>
                  <li><strong>Status:</strong> <span style="color: #28a745;">✅ Supervisor Approved</span></li>
                </ul>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Spending Details:</strong></p>
                <p style="font-style: italic;">${request.justification?.details || 'No details provided'}</p>
              </div>
              
              ${comments ? `
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Supervisor Comments:</strong></p>
                <p style="font-style: italic;">${comments}</p>
              </div>
              ` : ''}
              
              <p>Please review and finalize this justification in the finance portal.</p>
              
              <p><strong>Action Required:</strong> <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/finance/justification/${requestId}" style="color: #007bff;">Review & Finalize</a></p>
            `
          }).catch(error => {
            console.error('Failed to send finance notification:', error);
            return { error, type: 'finance' };
          })
        );
      }

      // 2. Notify Employee of supervisor approval
      notifications.push(
        sendEmail({
          to: request.employee.email,
          subject: 'Justification Approved by Supervisor',
          html: `
            <h3>Your Justification Has Been Approved!</h3>
            <p>Dear ${request.employee.fullName},</p>
            
            <p>Good news! Your cash justification has been approved by your supervisor.</p>
            
            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
              <p><strong>Approval Details:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Approved by:</strong> ${request.supervisor?.fullName || 'Supervisor'}</li>
                <li><strong>Status:</strong> <span style="color: #28a745;">Pending Finance Final Review</span></li>
              </ul>
            </div>
            
            ${comments ? `
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Supervisor Comments:</strong></p>
              <p style="font-style: italic;">${comments}</p>
            </div>
            ` : ''}
            
            <p><strong>Next Step:</strong> Your justification is now with the finance team for final review and closure.</p>
            
            <p>You will receive a final notification once the process is complete.</p>
            
            <p>Thank you!</p>
          `
        }).catch(error => {
          console.error('Failed to send employee notification:', error);
          return { error, type: 'employee' };
        })
      );

    } else {
      // Justification was rejected
      notifications.push(
        sendEmail({
          to: request.employee.email,
          subject: 'Justification Requires Revision',
          html: `
            <h3>Justification Needs Revision</h3>
            <p>Dear ${request.employee.fullName},</p>
            
            <p>Your supervisor has reviewed your cash justification and requires some revisions.</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
              <p><strong>Review Details:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Reviewed by:</strong> ${request.supervisor?.fullName || 'Supervisor'}</li>
                <li><strong>Status:</strong> <span style="color: #ffc107;">Revision Required</span></li>
              </ul>
            </div>
            
            ${comments ? `
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
              <p><strong>Comments & Required Changes:</strong></p>
              <p style="font-style: italic;">${comments}</p>
            </div>
            ` : ''}
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Review the supervisor's comments carefully</li>
              <li>Gather any additional documentation if needed</li>
              <li>Contact your supervisor if you need clarification</li>
              <li>Resubmit your justification with the requested changes</li>
            </ol>
            
            <p>Please address the supervisor's concerns and resubmit your justification.</p>
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
      } else if (result.value && result.value.error) {
        console.error(`${result.value.type} notification failed:`, result.value.error);
      } else {
        console.log(`Notification ${index} sent successfully`);
      }
    });

    console.log('=== SUPERVISOR JUSTIFICATION DECISION PROCESSED ===');
    res.json({
      success: true,
      message: `Justification ${decision}d by supervisor`,
      data: request,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Process supervisor justification decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process justification decision',
      error: error.message
    });
  }
};

const processFinanceJustificationDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments } = req.body;

    console.log('=== FINANCE JUSTIFICATION DECISION PROCESSING ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be "approve" or "reject"'
      });
    }

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email')
      .populate('supervisor', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (!request.canFinanceApproveJustification()) {
      return res.status(400).json({
        success: false,
        message: 'Justification is not pending finance approval'
      });
    }

    request.justificationApproval.financeDecision = {
      decision,
      comments,
      decisionDate: new Date(),
      decidedBy: req.user.userId
    };

    if (decision === 'approve') {
      request.status = 'completed';
    } else {
      request.status = 'justification_rejected';
    }

    await request.save();

    // Send final notification to employee
    const notification = sendEmail({
      to: request.employee.email,
      subject: decision === 'approve' ? 'Cash Request Completed Successfully' : 'Justification Requires Revision',
      html: decision === 'approve' ? 
        `
          <h3>🎉 Cash Request Completed Successfully!</h3>
          <p>Dear ${request.employee.fullName},</p>
          
          <p>Congratulations! Your cash request has been completed successfully.</p>
          
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
            <p><strong>Final Summary:</strong></p>
            <ul>
              <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Amount Disbursed:</strong> XAF ${(request.disbursementDetails?.amount || 0).toFixed(2)}</li>
              <li><strong>Amount Spent:</strong> XAF ${(request.justification?.amountSpent || 0).toFixed(2)}</li>
              <li><strong>Balance Returned:</strong> XAF ${(request.justification?.balanceReturned || 0).toFixed(2)}</li>
              <li><strong>Status:</strong> <span style="color: #28a745;">✅ COMPLETED</span></li>
            </ul>
          </div>
          
          <p>This cash request is now closed. Thank you for your compliance with the justification process.</p>
          
          ${comments ? `
          <div style="background-color: 'e9ecef'; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Finance Comments:</strong></p>
            <p style="font-style: italic;">${comments}</p>
          </div>
          ` : ''}
          
          <p>Thank you for your responsible handling of company funds!</p>
        ` :
        `
          <h3>Justification Requires Additional Information</h3>
          <p>Dear ${request.employee.fullName},</p>
          
          <p>The finance team has reviewed your justification and requires additional information or corrections.</p>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <p><strong>Review Details:</strong></p>
            <ul>
              <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Status:</strong> <span style="color: #ffc107;">Additional Information Required</span></li>
            </ul>
          </div>
          
          ${comments ? `
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
            <p><strong>Required Changes:</strong></p>
            <p style="font-style: italic;">${comments}</p>
          </div>
          ` : ''}
          
          <p>Please contact the finance department to clarify the requirements and resubmit your justification.</p>
        `
    });

    await notification.catch(error => {
      console.error('Failed to send final notification:', error);
    });

    console.log('=== FINANCE JUSTIFICATION DECISION PROCESSED ===');
    res.json({
      success: true,
      message: `Justification ${decision}d by finance`,
      data: request
    });

  } catch (error) {
    console.error('Process finance justification decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process justification decision',
      error: error.message
    });
  }
};

const getRequestForJustification = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check permissions
    if (!request.employee.equals(req.user.userId) && !['admin', 'finance'].includes(req.user.role)) {
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
    console.error('Get request for justification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request',
      error: error.message
    });
  }
};

const getSupervisorRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const user = await User.findById(req.user.userId);
    
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user can view this request
    const canView = 
      user.role === 'admin' ||
      request.approvalChain.some(step => step.approver.email === user.email);

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
    console.error('Get supervisor request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request',
      error: error.message
    });
  }
};

const getSupervisorJustification = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Get supervisor justification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch justification',
      error: error.message
    });
  }
};

// Create new cash request with automatic approval chain
const createRequest = async (req, res) => {
  try {
    console.log('=== CREATE REQUEST STARTED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      requestType,
      amountRequested,
      purpose,
      businessJustification,
      urgency,
      requiredDate,
      projectCode
    } = req.body;

    // Get user details
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    // Generate approval chain based on employee name and department
    const approvalChain = getApprovalChain(employee.fullName, employee.department);
    
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
          const uploadDir = path.join(__dirname, '../uploads/attachments');
          const filePath = path.join(uploadDir, fileName);
          
          // Ensure directory exists
          await fs.promises.mkdir(uploadDir, { recursive: true });
          
          // Move file to permanent location
          if (file.path) {
            await fs.promises.rename(file.path, filePath);
          }
          
          attachments.push({
            name: file.originalname,
            url: `/uploads/attachments/${fileName}`,
            publicId: fileName,
            size: file.size,
            mimetype: file.mimetype
          });
        } catch (fileError) {
          console.error('Error processing file:', file.originalname, fileError);
        }
      }
    }

    // Create the cash request
    const cashRequest = new CashRequest({
      employee: req.user.userId,
      requestType,
      amountRequested: parseFloat(amountRequested),
      purpose,
      businessJustification,
      urgency,
      requiredDate: new Date(requiredDate),
      projectCode,
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

    await cashRequest.save();

    // Populate employee details for response
    await cashRequest.populate('employee', 'fullName email department');

    // Send notifications
    const notifications = [];
    
    // Get first approver (supervisor)
    const firstApprover = approvalChain[0];
    if (firstApprover) {
      notifications.push(
        sendCashRequestEmail.newRequestToSupervisor(
          firstApprover.email,
          employee.fullName,
          parseFloat(amountRequested),
          cashRequest._id,
          purpose
        ).catch(error => {
          console.error('Failed to send supervisor notification:', error);
          return { error, type: 'supervisor' };
        })
      );
    }

    // Notify admins
    const admins = await User.find({ role: 'admin' }).select('email fullName');
    if (admins.length > 0) {
      notifications.push(
        sendEmail({
          to: admins.map(a => a.email),
          subject: `New Cash Request from ${employee.fullName}`,
          html: `
            <h3>New Cash Request Submitted</h3>
            <p>A new cash request has been submitted by <strong>${employee.fullName}</strong></p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Request Details:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${cashRequest._id.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Amount:</strong> XAF ${parseFloat(amountRequested).toFixed(2)}</li>
                <li><strong>Type:</strong> ${requestType}</li>
                <li><strong>Purpose:</strong> ${purpose}</li>
                <li><strong>Urgency:</strong> ${urgency}</li>
                <li><strong>Required Date:</strong> ${new Date(requiredDate).toLocaleDateString()}</li>
                <li><strong>Status:</strong> Pending Approval</li>
              </ul>
            </div>
            
            <p>This request is now in the approval workflow.</p>
          `
        }).catch(error => {
          console.error('Failed to send admin notification:', error);
          return { error, type: 'admin' };
        })
      );
    }

    // Notify employee of successful submission
    notifications.push(
      sendEmail({
        to: employee.email,
        subject: 'Cash Request Submitted Successfully',
        html: `
          <h3>Your Cash Request Has Been Submitted</h3>
          <p>Dear ${employee.fullName},</p>
          
          <p>Your cash request has been successfully submitted and is now under review.</p>
          
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Request Details:</strong></p>
            <ul>
              <li><strong>Request ID:</strong> REQ-${cashRequest._id.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Amount:</strong> XAF ${parseFloat(amountRequested).toFixed(2)}</li>
              <li><strong>Status:</strong> Pending Approval</li>
            </ul>
            </div>
            
            <p>You will receive email notifications as your request progresses through the approval process.</p>
            
            <p>Thank you!</p>
          `
      }).catch(error => {
        console.error('Failed to send employee notification:', error);
        return { error, type: 'employee' };
      })
    );

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

    console.log('=== REQUEST CREATED SUCCESSFULLY ===');
    res.status(201).json({
      success: true,
      message: 'Cash request created successfully and sent for approval',
      data: cashRequest,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Create cash request error:', error);
    
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

    res.status(500).json({
      success: false,
      message: 'Failed to create cash request',
      error: error.message
    });
  }
};

// Get pending approvals for supervisor/admin
const getSupervisorRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find requests where current user is in the approval chain and status is pending
    const requests = await CashRequest.find({
      'approvalChain': {
        $elemMatch: {
          'approver.email': user.email,
          'status': 'pending'
        }
      },
      status: { $in: ['pending_supervisor', 'pending_finance'] }
    })
    .populate('employee', 'fullName email department')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get supervisor requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
};

// Process supervisor/admin decision
const processSupervisorDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments } = req.body;
    
    console.log('=== SUPERVISOR DECISION PROCESSING ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cash request not found' 
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
      request.status = 'denied';
      
      // Also update the legacy supervisorDecision field for backward compatibility
      request.supervisorDecision = {
        decision: 'denied',
        comments,
        decisionDate: new Date(),
        decidedBy: req.user.userId
      };
    } else if (decision === 'approved') {
      // Check if this was the last step in approval chain
      const remainingSteps = request.approvalChain.filter(step => step.status === 'pending');
      
      if (remainingSteps.length === 1 && remainingSteps[0]._id.equals(request.approvalChain[currentStepIndex]._id)) {
        // This was the last approval step
        request.status = 'approved';
      } else {
        // Move to next approval level
        const nextStep = request.approvalChain.find(step => 
          step.level > request.approvalChain[currentStepIndex].level && step.status === 'pending'
        );
        
        if (nextStep) {
          // Determine if next step is finance or supervisor
          if (nextStep.approver.role === 'Finance Officer' || 
              nextStep.approver.role === 'President' ||
              nextStep.level > 2) {
            request.status = 'pending_finance';
          } else {
            request.status = 'pending_supervisor';
          }
        } else {
          request.status = 'approved';
        }
      }
    }

    await request.save();

    // Send notifications based on decision
    const notifications = [];

    if (decision === 'approved') {
      // Check if there are more approval steps
      const nextStep = request.approvalChain.find(step => 
        step.level > request.approvalChain[currentStepIndex].level && step.status === 'pending'
      );

      if (nextStep) {
        // Notify next approver
        notifications.push(
          sendCashRequestEmail.newRequestToSupervisor(
            nextStep.approver.email,
            request.employee.fullName,
            request.amountRequested,
            request._id,
            request.purpose
          ).catch(error => {
            console.error('Failed to send next approver notification:', error);
            return { error, type: 'next_approver' };
          })
        );
      } else {
        // Final approval - notify finance
        request.status = 'pending_finance';
        await request.save();
        
        const financeTeam = await User.find({ role: 'finance' }).select('email fullName');
        if (financeTeam.length > 0) {
          notifications.push(
            sendEmail({
              to: financeTeam.map(f => f.email),
              subject: `Cash Request Ready for Finance Review - ${request.employee.fullName}`,
              html: `
                <h3>Cash Request Ready for Finance Processing</h3>
                <p>A cash request has been fully approved and is ready for finance processing.</p>
                
                <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <ul>
                    <li><strong>Employee:</strong> ${request.employee.fullName}</li>
                    <li><strong>Request ID:</strong> REQ-${request._id.toString().slice(-6).toUpperCase()}</li>
                    <li><strong>Amount:</strong> XAF ${request.amountRequested.toFixed(2)}</li>
                    <li><strong>Purpose:</strong> ${request.purpose}</li>
                    <li><strong>Status:</strong> Ready for Finance Processing</li>
                  </ul>
                </div>
              `
            }).catch(error => {
              console.error('Failed to send finance notification:', error);
              return { error, type: 'finance' };
            })
          );
        }
      }

      // Notify employee of approval progress
      notifications.push(
        sendEmail({
          to: request.employee.email,
          subject: 'Cash Request Approval Progress',
          html: `
            <h3>Your Cash Request Has Been Approved</h3>
            <p>Dear ${request.employee.fullName},</p>
            
            <p>Your cash request has been approved by ${user.fullName}.</p>
            
            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Request ID:</strong> REQ-${request._id.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Approved by:</strong> ${user.fullName}</li>
                <li><strong>Status:</strong> ${nextStep ? 'Moving to Next Approval' : 'Fully Approved - Ready for Finance'}</li>
              </ul>
            </div>
          `
        }).catch(error => {
          console.error('Failed to send employee notification:', error);
          return { error, type: 'employee' };
        })
      );

    } else {
      // Request was rejected
      notifications.push(
        sendCashRequestEmail.denialToEmployee(
          request.employee.email,
          comments || 'Request denied during approval process',
          request._id,
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
      message: `Request ${decision} successfully`,
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
      message: 'Failed to process decision',
      error: error.message
    });
  }
};

// Get analytics data for admin dashboard
const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    // Build department filter
    let pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeData'
        }
      },
      {
        $unwind: '$employeeData'
      }
    ];

    // Apply filters
    let matchStage = { ...dateFilter };
    if (department && department !== 'all') {
      matchStage['employeeData.department'] = department;
    }
    
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Get overview statistics
    const overviewPipeline = [...pipeline, {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalAmount: { $sum: '$amountRequested' },
        pendingRequests: {
          $sum: {
            $cond: [{ $in: ['$status', ['pending_supervisor', 'pending_finance']] }, 1, 0]
          }
        },
        pendingAmount: {
          $sum: {
            $cond: [{ $in: ['$status', ['pending_supervisor', 'pending_finance']] }, '$amountRequested', 0]
          }
        },
        approvedRequests: {
          $sum: {
            $cond: [{ $in: ['$status', ['approved', 'disbursed', 'completed']] }, 1, 0]
          }
        },
        approvedAmount: {
          $sum: {
            $cond: [{ $in: ['$status', ['approved', 'disbursed', 'completed']] }, '$amountRequested', 0]
          }
        },
        rejectedRequests: {
          $sum: {
            $cond: [{ $eq: ['$status', 'denied'] }, 1, 0]
          }
        },
        rejectedAmount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'denied'] }, '$amountRequested', 0]
          }
        }
      }
    }];

    const overviewResult = await CashRequest.aggregate(overviewPipeline);
    const overview = overviewResult[0] || {
      totalRequests: 0,
      totalAmount: 0,
      pendingRequests: 0,
      pendingAmount: 0,
      approvedRequests: 0,
      approvedAmount: 0,
      rejectedRequests: 0,
      rejectedAmount: 0
    };

    // Calculate approval rate
    overview.approvalRate = overview.totalRequests > 0 ? 
      Math.round((overview.approvedRequests / overview.totalRequests) * 100) : 0;

    // Get department breakdown
    const departmentPipeline = [...pipeline, {
      $group: {
        _id: '$employeeData.department',
        totalRequests: { $sum: 1 },
        totalAmount: { $sum: '$amountRequested' },
        approvedRequests: {
          $sum: {
            $cond: [{ $in: ['$status', ['approved', 'disbursed', 'completed']] }, 1, 0]
          }
        },
        avgProcessingTime: { $avg: 2.5 } // Mock processing time
      }
    }, {
      $project: {
        department: '$_id',
        totalRequests: 1,
        totalAmount: 1,
        approvedRequests: 1,
        approvalRate: {
          $cond: [
            { $gt: ['$totalRequests', 0] },
            { $multiply: [{ $divide: ['$approvedRequests', '$totalRequests'] }, 100] },
            0
          ]
        },
        avgProcessingTime: 1
      }
    }, {
      $sort: { totalAmount: -1 }
    }];

    const departmentBreakdown = await CashRequest.aggregate(departmentPipeline);

    // Get top requesters
    const topRequestersPipeline = [...pipeline, {
      $group: {
        _id: '$employee',
        employeeName: { $first: '$employeeData.fullName' },
        department: { $first: '$employeeData.department' },
        requestCount: { $sum: 1 },
        totalAmount: { $sum: '$amountRequested' },
        approvedCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['approved', 'disbursed', 'completed']] }, 1, 0]
          }
        }
      }
    }, {
      $project: {
        employeeId: '$_id',
        employeeName: 1,
        department: 1,
        requestCount: 1,
        totalAmount: 1,
        successRate: {
          $cond: [
            { $gt: ['$requestCount', 0] },
            { $multiply: [{ $divide: ['$approvedCount', '$requestCount'] }, 100] },
            0
          ]
        }
      }
    }, {
      $sort: { totalAmount: -1 }
    }, {
      $limit: 10
    }];

    const topRequesters = await CashRequest.aggregate(topRequestersPipeline);

    // Calculate average processing time (mock for now)
    overview.averageProcessingTime = 18.5;

    res.json({
      success: true,
      data: {
        overview,
        departmentBreakdown,
        topRequesters,
        statusDistribution: [
          { status: 'approved', count: overview.approvedRequests },
          { status: 'pending', count: overview.pendingRequests },
          { status: 'rejected', count: overview.rejectedRequests }
        ],
        monthlyTrends: [], // Could be implemented with time-based aggregation
        urgencyDistribution: [] // Could be implemented based on urgency field
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data',
      error: error.message
    });
  }
};

module.exports = {
  createRequest,
  getSupervisorRequests,
  processSupervisorDecision,
  getEmployeeRequests,
  getEmployeeRequest,
  getAllRequests,
  getFinanceRequests,
  processFinanceDecision,
  getApprovalChainPreview,
  getSupervisorJustifications,
  getFinanceJustifications,
  submitJustification,
  getAdminRequestDetails,
  processSupervisorJustificationDecision,
  processFinanceJustificationDecision,
  getRequestForJustification,
  getSupervisorRequest,
  getSupervisorJustification,
  getAnalytics
};



