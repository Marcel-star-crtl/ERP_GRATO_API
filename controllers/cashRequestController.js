const CashRequest = require('../models/CashRequest');
const User = require('../models/User');
const BudgetCode = require('../models/BudgetCode');
const Project = require('../models/Project');
const { getCashRequestApprovalChain, getNextApprovalStatus, canUserApproveAtLevel } = require('../config/cashRequestApprovalChain');
const { sendCashRequestEmail, sendEmail } = require('../services/emailService');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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


const getFinanceRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    console.log('=== FETCHING FINANCE REQUESTS ===');
    console.log(`User: ${user.fullName} (${user.email})`);
    console.log(`Role: ${user.role}`);
    
    let query = {};
    
    if (user.role === 'finance') {
      // Finance users see:
      // 1. Requests pending their approval (ANY level, not just 4)
      // 2. Requests they've already approved
      // 3. All approved/disbursed/completed requests
      query = {
        $or: [
          { 
            // Requests waiting for this finance officer's approval (ANY level)
            'approvalChain': {
              $elemMatch: {
                'approver.email': user.email,
                'approver.role': 'Finance Officer',
                'status': 'pending'
              }
            }
          },
          { 
            // Requests approved by this finance officer
            'approvalChain': {
              $elemMatch: {
                'approver.email': user.email,
                'approver.role': 'Finance Officer',
                'status': 'approved'
              }
            }
          },
          { 
            // Requests rejected by this finance officer (for visibility)
            'approvalChain': {
              $elemMatch: {
                'approver.email': user.email,
                'approver.role': 'Finance Officer',
                'status': 'rejected'
              }
            }
          },
          // Direct status checks
          { status: 'pending_finance' },
          { status: 'approved' },
          { status: 'disbursed' },
          { status: 'completed' },
          { status: 'justification_pending_finance' }
        ]
      };
    } else if (user.role === 'admin') {
      // Admins see all finance-related requests
      query = {
        $or: [
          { 
            // All requests with Finance Officer in chain
            'approvalChain.approver.role': 'Finance Officer'
          },
          { 
            status: { 
              $in: [
                'pending_finance', 
                'approved', 
                'disbursed', 
                'completed', 
                'justification_pending_finance'
              ] 
            } 
          }
        ]
      };
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    const requests = await CashRequest.find(query)
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 });

    console.log(`Finance requests found: ${requests.length}`);

    // Add detailed debug info for each request
    const requestsWithDebug = requests.map(req => {
      const financeStep = req.approvalChain.find(s => 
        s.approver.email === user.email && s.approver.role === 'Finance Officer'
      );
      
      return {
        ...req.toObject(),
        _debug: {
          status: req.status,
          financeStepLevel: financeStep ? financeStep.level : 'Not found',
          financeStepStatus: financeStep ? financeStep.status : 'N/A',
          financeStepEmail: financeStep ? financeStep.approver.email : 'N/A',
          allLevels: req.approvalChain.map(s => ({
            level: s.level,
            role: s.approver.role,
            email: s.approver.email,
            status: s.status
          }))
        }
      };
    });

    // Log first request details if available
    if (requestsWithDebug.length > 0) {
      console.log('First request debug info:', JSON.stringify(requestsWithDebug[0]._debug, null, 2));
    }

    res.json({
      success: true,
      data: requestsWithDebug,
      count: requestsWithDebug.length,
      userInfo: {
        name: user.fullName,
        email: user.email,
        role: user.role
      }
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


const processFinanceDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments, amountApproved, disbursementAmount, budgetCodeId } = req.body;

    console.log('\n=== FINANCE DECISION PROCESSING ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);
    console.log('Budget Code ID:', budgetCodeId);
    console.log('User Email:', req.user.email);

    const user = await User.findById(req.user.userId);
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department')
      .populate('projectId', 'name code budgetCodeId');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    console.log(`Current Status: ${request.status}`);
    console.log(`Approval Chain:`);
    request.approvalChain.forEach(step => {
      console.log(`  L${step.level}: ${step.approver.name} (${step.approver.role}) - ${step.status}`);
    });

    // Find finance step in approval chain - DON'T hardcode level, search by role and email
    const financeStepIndex = request.approvalChain.findIndex(step => 
      step.approver.email === user.email && 
      step.approver.role === 'Finance Officer' &&
      step.status === 'pending'
    );

    if (financeStepIndex === -1) {
      console.log('❌ No pending finance approval found for this user');
      console.log('   Looking for: email =', user.email, ', role = Finance Officer, status = pending');
      
      // Show what we found instead
      const anyFinanceStep = request.approvalChain.find(s => 
        s.approver.email === user.email && s.approver.role === 'Finance Officer'
      );
      
      if (anyFinanceStep) {
        console.log(`   Found Finance step at Level ${anyFinanceStep.level} with status: ${anyFinanceStep.status}`);
      }
      
      return res.status(403).json({
        success: false,
        message: 'This request is not pending your approval. It may have already been processed.',
        currentStatus: anyFinanceStep ? anyFinanceStep.status : 'not_found'
      });
    }

    const financeStep = request.approvalChain[financeStepIndex];
    console.log(`✓ Found pending finance approval at Level ${financeStep.level}`);

    // Verify this is the final approval level OR all previous levels are approved
    const allPreviousApproved = request.approvalChain
      .filter(s => s.level < financeStep.level)
      .every(s => s.status === 'approved');

    if (!allPreviousApproved) {
      console.log('⚠️  Warning: Not all previous levels are approved');
      return res.status(400).json({
        success: false,
        message: 'Cannot process finance approval until all previous levels are approved'
      });
    }

    if (decision === 'approved') {
      const finalAmount = disbursementAmount || amountApproved || request.amountRequested;
      console.log(`Final approved amount: XAF ${finalAmount}`);

      // Handle budget allocation
      let budgetCode = null;
      
      if (request.projectId && request.projectId.budgetCodeId) {
        console.log('Using project budget code');
        budgetCode = await BudgetCode.findById(request.projectId.budgetCodeId);
      } else if (budgetCodeId) {
        console.log(`Finance assigning budget code: ${budgetCodeId}`);
        budgetCode = await BudgetCode.findById(budgetCodeId);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Budget code must be assigned for approval'
        });
      }

      if (!budgetCode) {
        return res.status(404).json({
          success: false,
          message: 'Budget code not found'
        });
      }

      console.log(`Budget code: ${budgetCode.code} (Available: XAF ${budgetCode.remaining.toLocaleString()})`);

      // Check budget sufficiency
      if (budgetCode.remaining < parseFloat(finalAmount)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient budget. Available: XAF ${budgetCode.remaining.toLocaleString()}`
        });
      }

      // Allocate budget
      try {
        await budgetCode.allocateBudget(request._id, parseFloat(finalAmount));
        console.log('✅ Budget allocated successfully');

        request.budgetAllocation = {
          budgetCodeId: budgetCode._id,
          budgetCode: budgetCode.code,
          allocatedAmount: parseFloat(finalAmount),
          allocationStatus: 'allocated',
          assignedBy: req.user.userId,
          assignedAt: new Date()
        };
      } catch (budgetError) {
        console.error('❌ Budget allocation failed:', budgetError);
        return res.status(500).json({
          success: false,
          message: `Failed to allocate budget: ${budgetError.message}`
        });
      }

      // Update finance approval
      request.approvalChain[financeStepIndex].status = 'approved';
      request.approvalChain[financeStepIndex].comments = comments;
      request.approvalChain[financeStepIndex].actionDate = new Date();
      request.approvalChain[financeStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
      request.approvalChain[financeStepIndex].decidedBy = req.user.userId;

      request.financeDecision = {
        decision: 'approved',
        comments,
        decisionDate: new Date()
      };

      // Set final status
      if (disbursementAmount) {
        request.status = 'disbursed';
        request.disbursementDetails = {
          date: new Date(),
          amount: parseFloat(disbursementAmount),
          disbursedBy: req.user.userId
        };
        console.log('✅ Request DISBURSED');
      } else {
        request.status = 'approved';
        console.log('✅ Request APPROVED (awaiting disbursement)');
      }

      if (amountApproved) {
        request.amountApproved = parseFloat(amountApproved);
      }

      request.financeOfficer = req.user.userId;
      await request.save();

      console.log('=== FINANCE APPROVAL COMPLETED ===\n');

      // Send notifications
      const notifications = [];

      // Notify employee
      const budgetInfo = `
        <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1890ff;">
          <p><strong>Budget Allocation:</strong></p>
          <ul>
            <li><strong>Budget Code:</strong> ${budgetCode.code} - ${budgetCode.name}</li>
            <li><strong>Allocated Amount:</strong> XAF ${parseFloat(finalAmount).toLocaleString()}</li>
            <li><strong>Budget Remaining:</strong> XAF ${budgetCode.remaining.toLocaleString()}</li>
          </ul>
        </div>
      `;

      notifications.push(
        sendEmail({
          to: request.employee.email,
          subject: `Cash Request ${disbursementAmount ? 'Disbursed' : 'Approved'} - ${request.employee.fullName}`,
          html: `
            <h3>Cash Request ${disbursementAmount ? 'Disbursed' : 'Approved'}</h3>
            <p>Dear ${request.employee.fullName},</p>
            
            <p>Your cash request has been ${disbursementAmount ? 'approved and disbursed' : 'approved by the finance team'}.</p>

            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Amount Approved:</strong> XAF ${parseFloat(finalAmount).toLocaleString()}</li>
                <li><strong>Approved by:</strong> ${user.fullName}</li>
              </ul>
            </div>

            ${budgetInfo}

            ${disbursementAmount ? 
              '<p><em>Please submit your justification with receipts within the required timeframe.</em></p>' : 
              '<p><em>Please wait for disbursement processing.</em></p>'
            }
          `
        }).catch(error => {
          console.error('Failed to send employee notification:', error);
          return { error, type: 'employee' };
        })
      );

      // Notify admins
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
                  <li><strong>Amount:</strong> XAF ${parseFloat(finalAmount).toLocaleString()}</li>
                  <li><strong>Budget Code:</strong> ${budgetCode.code} - ${budgetCode.name}</li>
                  <li><strong>Budget Remaining:</strong> XAF ${budgetCode.remaining.toLocaleString()}</li>
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

      await Promise.allSettled(notifications);

      return res.json({
        success: true,
        message: `Request ${decision} by finance and budget allocated from ${budgetCode.code}`,
        data: {
          request,
          budgetAllocation: {
            budgetCode: budgetCode.code,
            budgetName: budgetCode.name,
            allocatedAmount: parseFloat(finalAmount),
            remainingBudget: budgetCode.remaining
          }
        }
      });

    } else {
      // Handle rejection
      console.log('❌ Request REJECTED by finance');
      
      request.status = 'denied';
      request.financeDecision = {
        decision: 'rejected',
        comments,
        decisionDate: new Date()
      };

      request.approvalChain[financeStepIndex].status = 'rejected';
      request.approvalChain[financeStepIndex].comments = comments;
      request.approvalChain[financeStepIndex].actionDate = new Date();
      request.approvalChain[financeStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
      request.approvalChain[financeStepIndex].decidedBy = req.user.userId;

      await request.save();

      // Notify employee of denial
      await sendCashRequestEmail.denialToEmployee(
        request.employee.email,
        comments || 'Request denied by finance team',
        requestId,
        user.fullName
      ).catch(err => console.error('Failed to send denial email:', err));

      console.log('=== REQUEST DENIED ===\n');
      return res.json({
        success: true,
        message: 'Request rejected by finance',
        data: request
      });
    }

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


const getSupervisorJustifications = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('=== GET SUPERVISOR JUSTIFICATIONS ===');
    console.log(`User: ${user.fullName} (${user.email})`);

    const requests = await CashRequest.find({
      status: 'justification_pending_supervisor',
      $or: [
        { supervisor: req.user.userId },
        { 'approvalChain.approver.email': user.email }
      ]
    })
    .populate('employee', 'fullName email department')
    .sort({ 'justification.justificationDate': -1 });

    console.log(`Found ${requests.length} pending supervisor justifications`);

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



const submitJustification = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { amountSpent, balanceReturned, details } = req.body;

    console.log('=== JUSTIFICATION SUBMISSION WITH DOCUMENT HANDLING ===');
    console.log('Request body:', { amountSpent, balanceReturned, detailsLength: details?.length });
    console.log('Files received:', req.files?.length || 0);

    // Validate required fields
    if (!amountSpent || balanceReturned === undefined || !details) {
      throw new Error('Missing required fields: amountSpent, balanceReturned, or details');
    }

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

    // Check permissions - only employee can submit
    if (!request.employee._id.equals(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the employee who made the request can submit justification'
      });
    }

    if (!request.canSubmitJustification()) {
      return res.status(400).json({
        success: false,
        message: 'Request is not in a state where justification can be submitted'
      });
    }

    // Process justification documents with enhanced error handling
    let documents = [];
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} justification documents`);
      
      const uploadDir = path.join(__dirname, '../uploads/justifications');
      
      // Ensure upload directory exists
      try {
        await fs.promises.mkdir(uploadDir, { recursive: true });
        console.log(`✓ Justification upload directory ready: ${uploadDir}`);
      } catch (dirError) {
        console.error('Failed to create upload directory:', dirError);
        throw new Error('Failed to prepare upload directory');
      }

      for (const file of req.files) {
        try {
          console.log(`Processing justification document: ${file.originalname}`);
          
          // Generate unique filename
          const timestamp = Date.now();
          const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileName = `${timestamp}-${sanitizedName}`;
          const filePath = path.join(uploadDir, fileName);

          if (!file.path || !fs.existsSync(file.path)) {
            console.error(`Temp file not found: ${file.path}`);
            continue;
          }

          // Move file from temp to permanent location
          await fs.promises.rename(file.path, filePath);
          
          console.log(`✓ Justification document saved: ${fileName}`);

          documents.push({
            name: file.originalname,
            url: `/uploads/justifications/${fileName}`,
            publicId: fileName,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });
        } catch (fileError) {
          console.error(`Error processing justification file ${file.originalname}:`, fileError);
          
          // Clean up temp file if it exists
          if (file.path && fs.existsSync(file.path)) {
            try {
              await fs.promises.unlink(file.path);
            } catch (cleanupError) {
              console.error('Failed to clean up temp file:', cleanupError);
            }
          }
          
          continue;
        }
      }

      console.log(`Successfully processed ${documents.length} justification documents`);
    }

    // Validate amounts against disbursed amount
    const disbursedAmount = request.disbursementDetails?.amount || 0;
    const total = spentAmount + returnedAmount;

    if (Math.abs(total - disbursedAmount) > 0.01) {
      throw new Error(`Total of amount spent (${spentAmount}) and balance returned (${returnedAmount}) must equal disbursed amount (${disbursedAmount})`);
    }

    // Update budget with actual spending
    if (request.budgetAllocation && request.budgetAllocation.budgetCodeId) {
      console.log('Updating budget with actual spending...');
      
      const budgetCode = await BudgetCode.findById(request.budgetAllocation.budgetCodeId);
      if (budgetCode) {
        try {
          await budgetCode.recordSpending(request._id, spentAmount);
          console.log(`Budget updated. Actual spent: XAF ${spentAmount.toLocaleString()}`);

          request.budgetAllocation.allocationStatus = 'spent';
          request.budgetAllocation.actualSpent = spentAmount;
          request.budgetAllocation.balanceReturned = returnedAmount;

        } catch (budgetError) {
          console.error('Failed to update budget:', budgetError);
        }
      }
    }

    // Update justification with documents
    request.justification = {
      amountSpent: spentAmount,
      balanceReturned: returnedAmount,
      details,
      documents,
      justificationDate: new Date(),
      submittedBy: req.user.userId
    };

    request.status = 'justification_pending_supervisor';

    // Clear previous justification approvals
    request.justificationApproval = {
      supervisorDecision: null,
      supervisorDecisionDate: null,
      financeDecision: null,
      financeDecisionDate: null
    };

    await request.save();

    // Send notifications
    const notifications = [];

    // Notify supervisor(s) in approval chain
    const approversToNotify = request.approvalChain.filter(step => 
      step.approver.role === 'Supervisor' || step.approver.role === 'Departmental Head'
    );

    for (const approver of approversToNotify) {
      notifications.push(
        sendEmail({
          to: approver.approver.email,
          subject: `🔍 Cash Justification Needs Your Approval - ${request.employee.fullName}`,
          html: `
            <h3>Cash Justification Requires Your Approval</h3>
            <p>Dear ${approver.approver.name},</p>

            <p><strong>${request.employee.fullName}</strong> has submitted justification for their cash request.</p>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
              <p><strong>Justification Summary:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Employee:</strong> ${request.employee.fullName}</li>
                <li><strong>Amount Disbursed:</strong> XAF ${disbursedAmount.toFixed(2)}</li>
                <li><strong>Amount Spent:</strong> XAF ${spentAmount.toFixed(2)}</li>
                <li><strong>Balance Returned:</strong> XAF ${returnedAmount.toFixed(2)}</li>
                <li><strong>Documents Attached:</strong> ${documents.length}</li>
                ${request.budgetAllocation ? `<li><strong>Budget Code:</strong> ${request.budgetAllocation.budgetCode}</li>` : ''}
              </ul>
            </div>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Spending Details:</strong></p>
              <p style="font-style: italic; white-space: pre-wrap;">${details}</p>
            </div>

            ${documents.length > 0 ? `
              <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Supporting Documents (${documents.length}):</strong></p>
                <ul>
                  ${documents.map(doc => `<li>${doc.name} (${(doc.size / 1024).toFixed(1)} KB)</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <p><strong>Action Required:</strong> Please review and approve or reject this justification in the system.</p>
          `
        }).catch(error => {
          console.error(`Failed to send notification to ${approver.approver.email}:`, error);
          return { error, type: 'supervisor', email: approver.approver.email };
        })
      );
    }

    const notificationResults = await Promise.allSettled(notifications);
    console.log('=== JUSTIFICATION SUBMITTED WITH DOCUMENTS ===');

    res.json({
      success: true,
      message: 'Justification submitted successfully with supporting documents',
      data: request,
      documentsUploaded: {
        count: documents.length,
        files: documents.map(d => ({ name: d.name, size: d.size }))
      }
    });

  } catch (error) {
    console.error('Submit justification error:', error);

    // Clean up uploaded files if submission failed
    if (req.files && req.files.length > 0) {
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path && fs.existsSync(file.path)) {
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

    const user = await User.findById(req.user.userId);
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email')
      .populate('supervisor', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Verify supervisor has permission to approve
    const canApprove = 
      request.status === 'justification_pending_supervisor' &&
      request.approvalChain.some(step => 
        step.approver.email === user.email && 
        (step.approver.role === 'Supervisor' || step.approver.role === 'Departmental Head')
      );

    if (!canApprove && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to approve this justification'
      });
    }

    // Update justification approval
    request.justificationApproval = request.justificationApproval || {};
    request.justificationApproval.supervisorDecision = {
      decision,
      comments,
      decisionDate: new Date(),
      decidedBy: req.user.userId,
      decidedByName: user.fullName,
      decidedByEmail: user.email
    };
    request.justificationApproval.supervisorDecisionDate = new Date();

    if (decision === 'approve') {
      request.status = 'justification_pending_finance';
      console.log('Justification APPROVED by supervisor - moving to finance');
    } else {
      request.status = 'justification_rejected_supervisor';
      console.log('Justification REJECTED by supervisor');
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
                  <li><strong>Amount Disbursed:</strong> XAF ${(request.disbursementDetails?.amount || 0).toFixed(2)}</li>
                  <li><strong>Amount Spent:</strong> XAF ${(request.justification?.amountSpent || 0).toFixed(2)}</li>
                  <li><strong>Balance Returned:</strong> XAF ${(request.justification?.balanceReturned || 0).toFixed(2)}</li>
                  <li><strong>Supporting Documents:</strong> ${(request.justification?.documents || []).length}</li>
                  <li><strong>Supervisor:</strong> ${user.fullName}</li>
                  <li><strong>Status:</strong> <span style="color: #28a745;">✅ Supervisor Approved</span></li>
                </ul>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Spending Details:</strong></p>
                <p style="font-style: italic; white-space: pre-wrap;">${request.justification?.details || 'No details provided'}</p>
              </div>
              
              ${comments ? `
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #6c757d;">
                <p><strong>Supervisor Comments:</strong></p>
                <p style="font-style: italic;">${comments}</p>
              </div>
              ` : ''}
              
              <p><strong>Next Step:</strong> Please review and finalize this justification in the finance portal.</p>
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
          subject: '✅ Your Cash Justification Has Been Approved!',
          html: `
            <h3>Your Justification Has Been Approved!</h3>
            <p>Dear ${request.employee.fullName},</p>
            
            <p>Good news! Your cash justification has been approved by your supervisor and is now with the finance team for final review.</p>
            
            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
              <p><strong>Approval Details:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Approved by:</strong> ${user.fullName}</li>
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
          console.error('Failed to send employee approval notification:', error);
          return { error, type: 'employee' };
        })
      );

    } else {
      // Justification was rejected
      notifications.push(
        sendEmail({
          to: request.employee.email,
          subject: '⚠️ Your Cash Justification Requires Revision',
          html: `
            <h3>Justification Needs Revision</h3>
            <p>Dear ${request.employee.fullName},</p>
            
            <p>Your supervisor has reviewed your cash justification and requires some revisions.</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
              <p><strong>Review Details:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Reviewed by:</strong> ${user.fullName}</li>
                <li><strong>Status:</strong> <span style="color: #ffc107;">Revision Required</span></li>
              </ul>
            </div>
            
            ${comments ? `
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
              <p><strong>Required Changes:</strong></p>
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
          console.error('Failed to send rejection notification:', error);
          return { error, type: 'employee' };
        })
      );
    }

    // Wait for all notifications
    const notificationResults = await Promise.allSettled(notifications);
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

    const user = await User.findById(req.user.userId);
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email')
      .populate('supervisor', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.status !== 'justification_pending_finance') {
      return res.status(400).json({
        success: false,
        message: 'Justification is not pending finance approval'
      });
    }

    request.justificationApproval = request.justificationApproval || {};
    request.justificationApproval.financeDecision = {
      decision,
      comments,
      decisionDate: new Date(),
      decidedBy: req.user.userId,
      decidedByName: user.fullName,
      decidedByEmail: user.email
    };
    request.justificationApproval.financeDecisionDate = new Date();

    if (decision === 'approve') {
      request.status = 'completed';
      console.log('Justification APPROVED by finance - Request COMPLETED');
    } else {
      request.status = 'justification_rejected_finance';
      console.log('Justification REJECTED by finance');
    }

    await request.save();

    // Send final notification to employee
    const notification = sendEmail({
      to: request.employee.email,
      subject: decision === 'approve' ? '🎉 Cash Request Completed Successfully!' : '⚠️ Justification Requires Additional Information',
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
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
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
    const user = await User.findById(req.user.userId);
    
    console.log('=== GET SUPERVISOR JUSTIFICATION ===');
    console.log(`Request ID: ${requestId}`);
    console.log(`User: ${user.email}`);

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Verify supervisor has access to this justification
    const canApprove = 
      request.status === 'justification_pending_supervisor' &&
      (request.approvalChain.some(step => step.approver.email === user.email) ||
       user.role === 'admin');

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to review this justification'
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



const createRequest = async (req, res) => {
  try {
    console.log('=== CREATE CASH REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      requestType,
      amountRequested,
      purpose,
      businessJustification,
      urgency,
      requiredDate,
      projectCode,
      projectId
    } = req.body;

    // Get user details
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    console.log(`Creating cash request for: ${employee.fullName} (${employee.department})`);

    // Validate project if provided
    let selectedProject = null;
    let projectBudgetCode = null;

    if (projectId) {
      console.log(`Project ID provided: ${projectId}`);
      
      selectedProject = await Project.findById(projectId)
        .populate('budgetCodeId', 'code name budget used remaining');

      if (!selectedProject) {
        return res.status(404).json({
          success: false,
          message: 'Selected project not found'
        });
      }

      console.log(`Project found: ${selectedProject.name}`);

      if (selectedProject.budgetCodeId) {
        projectBudgetCode = selectedProject.budgetCodeId;
        console.log(`Project has budget code: ${projectBudgetCode.code}`);
        
        if (projectBudgetCode.remaining < parseFloat(amountRequested)) {
          return res.status(400).json({
            success: false,
            message: `Insufficient budget. Project budget remaining: XAF ${projectBudgetCode.remaining.toLocaleString()}`
          });
        }
      }
    }

    // Generate approval chain
    const approvalChain = getCashRequestApprovalChain(employee.fullName, employee.department);

    if (!approvalChain || approvalChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine approval chain. Please contact HR for assistance.'
      });
    }

    console.log(`Approval chain generated with ${approvalChain.length} levels`);

    // Process attachments with proper error handling
    let attachments = [];
    
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} attachments`);
      
      const uploadDir = path.join(__dirname, '../uploads/attachments');
      
      // Ensure upload directory exists
      try {
        await fs.promises.mkdir(uploadDir, { recursive: true });
        console.log(`✓ Upload directory ready: ${uploadDir}`);
      } catch (dirError) {
        console.error('Failed to create upload directory:', dirError);
        throw new Error('Failed to prepare upload directory');
      }

      for (const file of req.files) {
        try {
          console.log(`Processing file: ${file.originalname}`);
          
          // Generate unique filename
          const timestamp = Date.now();
          const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileName = `${timestamp}-${sanitizedName}`;
          const filePath = path.join(uploadDir, fileName);

          // Check if temp file exists
          if (!file.path || !fs.existsSync(file.path)) {
            console.error(`Temp file not found: ${file.path}`);
            continue; // Skip this file
          }

          console.log(`Moving file from: ${file.path}`);
          console.log(`To: ${filePath}`);

          // Move file from temp to permanent location
          await fs.promises.rename(file.path, filePath);
          
          console.log(`✓ File saved: ${fileName}`);

          attachments.push({
            name: file.originalname,
            url: `/uploads/attachments/${fileName}`,
            publicId: fileName,
            size: file.size,
            mimetype: file.mimetype
          });
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          
          // Clean up temp file if it exists
          if (file.path && fs.existsSync(file.path)) {
            try {
              await fs.promises.unlink(file.path);
            } catch (cleanupError) {
              console.error('Failed to clean up temp file:', cleanupError);
            }
          }
          
          // Continue processing other files
          continue;
        }
      }

      console.log(`Successfully processed ${attachments.length} attachments`);
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
      approvalChain,
      projectId: selectedProject ? selectedProject._id : null,
      budgetAllocation: projectBudgetCode ? {
        budgetCodeId: projectBudgetCode._id,
        budgetCode: projectBudgetCode.code,
        allocatedAmount: parseFloat(amountRequested),
        allocationStatus: 'pending',
        assignedBy: null,
        assignedAt: null
      } : null
    });

    await cashRequest.save();
    console.log(`Cash request created: ${cashRequest._id}`);

    // Populate employee details
    await cashRequest.populate('employee', 'fullName email department');
    if (selectedProject) {
      await cashRequest.populate('projectId', 'name code department');
    }

    // Send notifications
    const notifications = [];

    // Notify first approver
    const firstApprover = approvalChain[0];
    if (firstApprover) {
      notifications.push(
        sendCashRequestEmail.newRequestToSupervisor(
          firstApprover.approver.email,
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
      const projectInfo = selectedProject 
        ? `<li><strong>Project:</strong> ${selectedProject.name}</li>
           <li><strong>Budget Code:</strong> ${projectBudgetCode ? projectBudgetCode.code : 'To be assigned'}</li>`
        : '<li><strong>Project:</strong> Not specified</li>';

      notifications.push(
        sendEmail({
          to: admins.map(a => a.email),
          subject: `New Cash Request from ${employee.fullName}`,
          html: `
            <h3>New Cash Request Submitted</h3>
            <p>A new cash request has been submitted by <strong>${employee.fullName}</strong></p>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <ul>
                <li><strong>Request ID:</strong> REQ-${cashRequest._id.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Amount:</strong> XAF ${parseFloat(amountRequested).toLocaleString()}</li>
                <li><strong>Type:</strong> ${requestType}</li>
                <li><strong>Urgency:</strong> ${urgency}</li>
                ${projectInfo}
              </ul>
            </div>
          `
        }).catch(error => {
          console.error('Failed to send admin notification:', error);
          return { error, type: 'admin' };
        })
      );
    }

    // Notify employee
    notifications.push(
      sendEmail({
        to: employee.email,
        subject: 'Cash Request Submitted Successfully',
        html: `
          <h3>Your Cash Request Has Been Submitted</h3>
          <p>Dear ${employee.fullName},</p>

          <p>Your cash request has been successfully submitted.</p>

          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ul>
              <li><strong>Request ID:</strong> REQ-${cashRequest._id.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Amount:</strong> XAF ${parseFloat(amountRequested).toLocaleString()}</li>
              <li><strong>Status:</strong> Pending Approval</li>
            </ul>
          </div>
        `
      }).catch(error => {
        console.error('Failed to send employee notification:', error);
        return { error, type: 'employee' };
      })
    );

    await Promise.allSettled(notifications);

    console.log('=== REQUEST CREATED SUCCESSFULLY ===');
    res.status(201).json({
      success: true,
      message: 'Cash request created successfully',
      data: cashRequest
    });

  } catch (error) {
    console.error('Create cash request error:', error);

    // Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path && fs.existsSync(file.path)) {
            return fs.promises.unlink(file.path).catch(e => 
              console.error('File cleanup failed:', e)
            );
          }
        })
      );
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create cash request',
      error: error.message
    });
  }
};

// Universal approval function for the 4-level hierarchy
const processApprovalDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments, amountApproved, disbursementAmount } = req.body;
    
    console.log('=== APPROVAL DECISION PROCESSING ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);
    console.log('User Role:', req.user.role);

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

    const currentStep = request.approvalChain[currentStepIndex];
    
    // Update the approval step
    currentStep.status = decision === 'approved' ? 'approved' : 'rejected';
    currentStep.comments = comments;
    currentStep.actionDate = new Date();
    currentStep.actionTime = new Date().toLocaleTimeString('en-GB');
    currentStep.decidedBy = req.user.userId;

    // Handle rejection
    if (decision === 'rejected') {
      request.status = 'denied';
      
      // Send rejection email to employee
      await sendEmail({
        to: request.employee.email,
        subject: `Cash Request Denied - ${request.employee.fullName}`,
        html: `
          <h3>Cash Request Denied</h3>
          <p>Your cash request has been denied by ${user.fullName} (${currentStep.approver.role}).</p>
          <p><strong>Reason:</strong> ${comments || 'No reason provided'}</p>
          <p><strong>Amount:</strong> XAF ${request.amountRequested?.toLocaleString()}</p>
          <p><strong>Purpose:</strong> ${request.purpose}</p>
        `
      });

      await request.save();
      return res.json({
        success: true,
        message: 'Request denied successfully',
        data: request
      });
    }

    // Handle approval - determine next status based on current level
    let nextStatus;
    let nextApproverLevel = currentStep.level + 1;
    
    switch (currentStep.level) {
      case 1: // Supervisor approval
        nextStatus = 'pending_departmental_head';
        break;
      case 2: // Departmental head approval  
        nextStatus = 'pending_head_of_business';
        break;
      case 3: // Head of business approval
        nextStatus = 'pending_finance';
        break;
      case 4: // Finance approval
        nextStatus = 'approved';
        if (amountApproved) {
          request.amountApproved = parseFloat(amountApproved);
        }
        
        // Handle disbursement if amount is provided
        if (disbursementAmount) {
          const disbursedAmount = parseFloat(disbursementAmount);
          request.status = 'disbursed';
          request.disbursementDetails = {
            date: new Date(),
            amount: disbursedAmount,
            disbursedBy: req.user.userId
          };
          nextStatus = 'disbursed';
        }
        break;
      default:
        nextStatus = 'approved';
    }

    // Update request status
    request.status = nextStatus;

    // If not final approval, activate next approval step
    if (nextApproverLevel <= request.approvalChain.length && nextStatus !== 'approved' && nextStatus !== 'disbursed') {
      const nextStepIndex = request.approvalChain.findIndex(step => step.level === nextApproverLevel);
      if (nextStepIndex !== -1) {
        request.approvalChain[nextStepIndex].assignedDate = new Date();
        
        // Send email to next approver
        const nextApprover = request.approvalChain[nextStepIndex].approver;
        await sendEmail({
          to: nextApprover.email,
          subject: `Cash Request Approval Required - ${request.employee.fullName}`,
          html: `
            <h3>Cash Request Approval Required</h3>
            <p>A cash request requires your approval.</p>
            <p><strong>Employee:</strong> ${request.employee.fullName}</p>
            <p><strong>Amount:</strong> XAF ${request.amountRequested?.toLocaleString()}</p>
            <p><strong>Purpose:</strong> ${request.purpose}</p>
            <p><strong>Urgency:</strong> ${request.urgency}</p>
            <p><strong>Your Role:</strong> ${nextApprover.role}</p>
            <p>Please review and take action in the system.</p>
          `
        });
      }
    } else if (nextStatus === 'approved' || nextStatus === 'disbursed') {
      // Send completion email to employee
      await sendEmail({
        to: request.employee.email,
        subject: `Cash Request ${nextStatus === 'disbursed' ? 'Disbursed' : 'Approved'} - ${request.employee.fullName}`,
        html: `
          <h3>Cash Request ${nextStatus === 'disbursed' ? 'Disbursed' : 'Approved'}</h3>
          <p>Your cash request has been ${nextStatus === 'disbursed' ? 'approved and disbursed' : 'approved'}.</p>
          <p><strong>Amount Approved:</strong> XAF ${(request.amountApproved || request.amountRequested)?.toLocaleString()}</p>
          <p><strong>Purpose:</strong> ${request.purpose}</p>
          ${nextStatus === 'disbursed' ? 
            `<p><strong>Disbursed Amount:</strong> XAF ${disbursementAmount ? parseFloat(disbursementAmount).toLocaleString() : 'TBD'}</p>
             <p><em>Please submit your justification with receipts within the required timeframe.</em></p>` : 
            '<p><em>Please wait for disbursement processing.</em></p>'
          }
        `
      });
    }

    await request.save();

    console.log(`Request ${requestId} approved by ${user.fullName} at level ${currentStep.level}. New status: ${nextStatus}`);

    res.json({
      success: true,
      message: `Request ${decision} successfully`,
      data: request,
      nextStatus: nextStatus
    });

  } catch (error) {
    console.error('Approval decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process approval decision',
      error: error.message
    });
  }
};

// Get pending approvals for current user based on their role and approval level
const getPendingApprovals = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('Getting pending approvals for user:', user.email, 'role:', user.role);

    // Find requests where current user is in the approval chain with pending status
    const requests = await CashRequest.find({
      'approvalChain': {
        $elemMatch: {
          'approver.email': user.email,
          'status': 'pending'
        }
      }
    })
    .populate('employee', 'fullName email department')
    .sort({ createdAt: -1 });

    console.log('Found requests with user in approval chain:', requests.length);

    // Filter requests based on current status to ensure proper level access
    const filteredRequests = requests.filter(request => {
      const userStep = request.approvalChain.find(
        step => step.approver.email === user.email && step.status === 'pending'
      );
      
      if (!userStep) {
        console.log('No pending step found for user in request:', request._id);
        return false;
      }

      console.log(`Request ${request._id}: status=${request.status}, userLevel=${userStep.level}, userRole=${userStep.approver.role}`);

      // Map status to required approval level
      const statusLevelMap = {
        'pending_supervisor': 1,
        'pending_departmental_head': 2, 
        'pending_head_of_business': 3,
        'pending_finance': 4
      };

      const requiredLevel = statusLevelMap[request.status];
      const levelMatches = userStep.level === requiredLevel;
      
      console.log(`Required level: ${requiredLevel}, User level: ${userStep.level}, Matches: ${levelMatches}`);
      
      return levelMatches;
    });

    console.log('Filtered requests count:', filteredRequests.length);

    res.json({
      success: true,
      data: filteredRequests,
      count: filteredRequests.length,
      userRole: user.role,
      userEmail: user.email
    });

  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: error.message
    });
  }
};

// Get requests for admin (departmental head + head of business levels)
const getAdminApprovals = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Admin can see both departmental head and head of business approvals
    const requests = await CashRequest.find({
      $or: [
        { status: 'pending_departmental_head' },
        { status: 'pending_head_of_business' }
      ],
      'approvalChain': {
        $elemMatch: {
          'approver.email': user.email,
          'status': 'pending'
        }
      }
    })
    .populate('employee', 'fullName email department')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length,
      userRole: user.role,
      userEmail: user.email
    });

  } catch (error) {
    console.error('Get admin approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin approvals',
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



const processSupervisorDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments } = req.body;

    console.log('\n=== PROCESSING APPROVAL DECISION ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);
    console.log('User:', req.user.userId);

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`Approver: ${user.fullName} (${user.email}) - Role: ${user.role}`);

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department position');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    // Find ALL pending steps for this user
    const userPendingSteps = request.approvalChain
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => 
        step.approver.email === user.email && step.status === 'pending'
      );

    if (userPendingSteps.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have any pending approvals for this request'
      });
    }

    console.log(`Found ${userPendingSteps.length} pending step(s) for this user`);

    if (decision === 'approved') {
      // Approve ALL steps for this user
      userPendingSteps.forEach(({ step, index }) => {
        console.log(`Approving Level ${step.level}: ${step.approver.role}`);
        request.approvalChain[index].status = 'approved';
        request.approvalChain[index].comments = comments;
        request.approvalChain[index].actionDate = new Date();
        request.approvalChain[index].actionTime = new Date().toLocaleTimeString('en-GB');
        request.approvalChain[index].decidedBy = req.user.userId;
      });

      // Find the HIGHEST level this user just approved
      const highestApprovedLevel = Math.max(...userPendingSteps.map(({ step }) => step.level));
      console.log(`Highest level approved: ${highestApprovedLevel}`);

      // Find next pending step that's NOT this user
      const nextPendingStep = request.approvalChain.find(step => 
        step.level > highestApprovedLevel && 
        step.status === 'pending' &&
        step.approver.email !== user.email
      );

      if (nextPendingStep) {
        console.log(`Next approver: Level ${nextPendingStep.level} - ${nextPendingStep.approver.name} (${nextPendingStep.approver.role})`);
        
        // Set status based on next level
        const statusMap = {
          1: 'pending_supervisor',
          2: 'pending_departmental_head',
          3: 'pending_head_of_business',
          4: 'pending_finance'
        };
        
        request.status = statusMap[nextPendingStep.level] || 'pending_finance';
        console.log(`New status: ${request.status}`);

        await request.save();

        // Send notification to next approver
        try {
          console.log(`📧 Attempt 1/3 to send email to ${nextPendingStep.approver.email}`);
          await sendCashRequestEmail.approvalToNextLevel(
            nextPendingStep.approver.email,
            nextPendingStep.approver.name,
            request.employee.fullName,
            parseFloat(request.amountRequested),
            request._id,
            nextPendingStep.approver.role,
            nextPendingStep.level,
            request.approvalChain.length,
            comments
          );
          console.log('✅ Email sent successfully');
        } catch (emailError) {
          console.error('❌ Failed to send email:', emailError);
        }

        // Notify employee
        try {
          await sendCashRequestEmail.progressToEmployee(
            request.employee.email,
            request.employee.fullName,
            request._id,
            user.fullName,
            nextPendingStep.approver.role,
            nextPendingStep.level,
            request.approvalChain.length,
            request.status
          );
        } catch (emailError) {
          console.error('Failed to notify employee:', emailError);
        }

      } else {
        // No more different approvers found
        // Check if ALL levels are approved
        const allApproved = request.approvalChain.every(s => s.status === 'approved');
        
        if (allApproved) {
          // All approvals complete - Finance has approved
          console.log('✅ All approvals completed - Request FULLY APPROVED');
          request.status = 'approved';
        } else {
          // Find if there's a pending Finance level
          const financeStep = request.approvalChain.find(s => 
            s.approver.role === 'Finance Officer' && s.status === 'pending'
          );
          
          if (financeStep) {
            console.log('⏳ Moving to Finance approval (Pending Finance)');
            request.status = 'pending_finance';
          } else {
            // Should not happen, but default to pending_finance
            console.log('⚠️  No pending Finance step found, but not all approved. Setting to pending_finance');
            request.status = 'pending_finance';
          }
        }

        await request.save();

        // Notify employee
        try {
          await sendEmail({
            to: request.employee.email,
            subject: request.status === 'approved' ? 
              '✅ Cash Request Fully Approved' : 
              '💰 Cash Request Pending Finance Approval',
            html: `
              <h3>${request.status === 'approved' ? 
                'Your Cash Request Has Been Fully Approved! 🎉' : 
                'Cash Request Pending Finance Review'}</h3>
              <p>Dear ${request.employee.fullName},</p>
              
              <p>${request.status === 'approved' ? 
                'Great news! Your cash request has been approved by all authorities.' : 
                'Your cash request has been approved and is now with the finance team for final review.'}</p>
              
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <ul>
                  <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                  <li><strong>Amount:</strong> XAF ${parseFloat(request.amountRequested).toLocaleString()}</li>
                  <li><strong>Status:</strong> ${request.status.replace(/_/g, ' ').toUpperCase()}</li>
                </ul>
              </div>
            `
          });
        } catch (emailError) {
          console.error('Failed to send completion email:', emailError);
        }
      }

      console.log('=== APPROVAL PROCESSED SUCCESSFULLY ===\n');
      return res.json({
        success: true,
        message: `Request approved at level(s) ${userPendingSteps.map(s => s.step.level).join(', ')}`,
        data: request
      });

    } else {
      // Handle rejection - deny at first pending level only
      const firstPendingStep = userPendingSteps[0];
      
      console.log(`❌ Denying request at Level ${firstPendingStep.step.level}`);
      
      request.status = 'denied';
      request.approvalChain[firstPendingStep.index].status = 'rejected'; // FIXED: Use 'rejected'
      request.approvalChain[firstPendingStep.index].comments = comments;
      request.approvalChain[firstPendingStep.index].actionDate = new Date();
      request.approvalChain[firstPendingStep.index].actionTime = new Date().toLocaleTimeString('en-GB');
      request.approvalChain[firstPendingStep.index].decidedBy = req.user.userId;

      await request.save();

      // Notify employee
      try {
        await sendCashRequestEmail.denialToEmployee(
          request.employee.email,
          comments || 'Request denied',
          requestId,
          user.fullName
        );
      } catch (emailError) {
        console.error('Failed to send denial notification:', emailError);
      }

      console.log('=== REQUEST DENIED ===\n');
      return res.json({
        success: true,
        message: 'Request denied',
        data: request
      });
    }

  } catch (error) {
    console.error('Process approval decision error:', error);
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
        monthlyTrends: [], 
        urgencyDistribution: [] 
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

const getDashboardStats = async (req, res) => {
  try {
    console.log('=== GET DASHBOARD STATS ===');
    console.log('User:', {
      userId: req.user.userId,
      role: req.user.role,
      department: req.user.department
    });

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let stats = {
      total: 0,
      pending: 0,
      approved: 0,
      disbursed: 0,
      completed: 0,
      rejected: 0,
      myRequests: 0,
      pendingMyApproval: 0
    };

    // Role-based stats
    if (user.role === 'admin') {
      // Admin sees all requests
      const allRequests = await CashRequest.find({});
      
      stats.total = allRequests.length;
      stats.pending = allRequests.filter(req => 
        ['pending_supervisor', 'pending_departmental_head', 'pending_head_of_business', 'pending_finance'].includes(req.status)
      ).length;
      stats.approved = allRequests.filter(req => req.status === 'approved').length;
      stats.disbursed = allRequests.filter(req => req.status === 'disbursed').length;
      stats.completed = allRequests.filter(req => req.status === 'completed').length;
      stats.rejected = allRequests.filter(req => req.status === 'denied').length;

    } else if (user.role === 'finance') {
      // Finance sees finance-related requests
      const financeRequests = await CashRequest.find({
        status: { $in: ['pending_finance', 'approved', 'disbursed', 'completed'] }
      });
      
      stats.total = financeRequests.length;
      stats.pending = financeRequests.filter(req => req.status === 'pending_finance').length;
      stats.approved = financeRequests.filter(req => req.status === 'approved').length;
      stats.disbursed = financeRequests.filter(req => req.status === 'disbursed').length;
      stats.completed = financeRequests.filter(req => req.status === 'completed').length;
      stats.pendingMyApproval = financeRequests.filter(req => 
        req.status === 'pending_finance' &&
        req.approvalChain?.some(step => 
          step.approver?.email === user.email && step.status === 'pending'
        )
      ).length;

    } else if (user.role === 'supervisor') {
      // Supervisor sees requests in their approval chain
      const supervisorRequests = await CashRequest.find({
        'approvalChain.approver.email': user.email
      });
      
      stats.total = supervisorRequests.length;
      stats.pending = supervisorRequests.filter(req => 
        ['pending_supervisor', 'pending_departmental_head', 'pending_head_of_business'].includes(req.status)
      ).length;
      stats.approved = supervisorRequests.filter(req => 
        ['approved', 'disbursed', 'completed'].includes(req.status)
      ).length;
      stats.rejected = supervisorRequests.filter(req => req.status === 'denied').length;
      stats.pendingMyApproval = supervisorRequests.filter(req => 
        req.approvalChain?.some(step => 
          step.approver?.email === user.email && step.status === 'pending'
        )
      ).length;

    } else {
      // Employee sees only their own requests
      const myRequests = await CashRequest.find({ employee: req.user.userId });
      
      stats.total = myRequests.length;
      stats.myRequests = myRequests.length;
      stats.pending = myRequests.filter(req => 
        ['pending_supervisor', 'pending_departmental_head', 'pending_head_of_business', 'pending_finance'].includes(req.status)
      ).length;
      stats.approved = myRequests.filter(req => req.status === 'approved').length;
      stats.disbursed = myRequests.filter(req => req.status === 'disbursed').length;
      stats.completed = myRequests.filter(req => req.status === 'completed').length;
      stats.rejected = myRequests.filter(req => req.status === 'denied').length;
    }

    console.log('Dashboard stats:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};

module.exports = {
  createRequest,
  processApprovalDecision,   
  getPendingApprovals,       
  getAdminApprovals,         
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
  getDashboardStats,
  getAnalytics
};



