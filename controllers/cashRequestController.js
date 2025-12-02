const CashRequest = require('../models/CashRequest');
const User = require('../models/User');
const BudgetCode = require('../models/BudgetCode');
const Project = require('../models/Project');
const { getCashRequestApprovalChain, getNextApprovalStatus, canUserApproveAtLevel } = require('../config/cashRequestApprovalChain');
const { sendCashRequestEmail, sendEmail } = require('../services/emailService');
const { 
  saveFile, 
  deleteFile,
  deleteFiles,
  STORAGE_CATEGORIES 
} = require('../utils/localFileStorage');
const fs = require('fs');
const fsSync = require('fs');
const path = require('path');
const mongoose = require('mongoose');



// Helper: Export as CSV
async function exportAsCSV(res, requests) {
  const csvRows = [];
  
  // Header
  csvRows.push([
    'Request ID',
    'Employee Name',
    'Department',
    'Position',
    'Request Type',
    'Amount Requested',
    'Amount Approved',
    'Total Disbursed',
    'Remaining Balance',
    'Disbursement Progress',
    'Status',
    'Urgency',
    'Budget Code',
    'Project',
    'Date Submitted',
    'Date Approved',
    'Date Fully Disbursed',
    'Approval Chain',
    'Number of Disbursements'
  ].join(','));

  // Data rows
  requests.forEach(req => {
    const approvalChainText = (req.approvalChain || [])
      .map(step => `${step.approver.name} (${step.status})`)
      .join('; ');

    const dateApproved = req.approvalChain?.find(s => s.status === 'approved')?.actionDate || '';
    const dateFullyDisbursed = req.status === 'fully_disbursed' ? 
      (req.disbursements[req.disbursements.length - 1]?.date || '') : '';

    csvRows.push([
      `REQ-${req._id.toString().slice(-6).toUpperCase()}`,
      req.employee?.fullName || '',
      req.employee?.department || '',
      req.employee?.position || '',
      req.requestType || '',
      req.amountRequested || 0,
      req.amountApproved || req.amountRequested || 0,
      req.totalDisbursed || 0,
      req.remainingBalance || 0,
      `${req.disbursementProgress || 0}%`,
      req.status || '',
      req.urgency || '',
      req.budgetAllocation?.budgetCode || '',
      req.projectId?.name || '',
      req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-GB') : '',
      dateApproved ? new Date(dateApproved).toLocaleDateString('en-GB') : '',
      dateFullyDisbursed ? new Date(dateFullyDisbursed).toLocaleDateString('en-GB') : '',
      `"${approvalChainText}"`,
      req.disbursements?.length || 0
    ].join(','));
  });

  const csvContent = csvRows.join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="cash_requests_${Date.now()}.csv"`);
  res.send(csvContent);
}

// Helper: Export as Excel (using simple method - can enhance with a library)
async function exportAsExcel(res, requests) {
  // For now, use CSV format with .xlsx extension
  // In production, use a library like 'exceljs' for proper formatting
  
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ];

  const totalRequested = requests.reduce((sum, r) => sum + (r.amountRequested || 0), 0);
  const totalApproved = requests.reduce((sum, r) => sum + (r.amountApproved || r.amountRequested || 0), 0);
  const totalDisbursed = requests.reduce((sum, r) => sum + (r.totalDisbursed || 0), 0);

  summarySheet.addRows([
    { metric: 'Total Requests', value: requests.length },
    { metric: 'Total Amount Requested', value: `XAF ${totalRequested.toLocaleString()}` },
    { metric: 'Total Amount Approved', value: `XAF ${totalApproved.toLocaleString()}` },
    { metric: 'Total Disbursed', value: `XAF ${totalDisbursed.toLocaleString()}` },
    { metric: 'Export Date', value: new Date().toLocaleString('en-GB') }
  ]);

  // Details Sheet
  const detailsSheet = workbook.addWorksheet('Cash Requests');
  detailsSheet.columns = [
    { header: 'Request ID', key: 'requestId', width: 15 },
    { header: 'Employee', key: 'employee', width: 25 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Amount Requested', key: 'amountRequested', width: 18 },
    { header: 'Amount Approved', key: 'amountApproved', width: 18 },
    { header: 'Total Disbursed', key: 'totalDisbursed', width: 18 },
    { header: 'Remaining', key: 'remaining', width: 15 },
    { header: 'Progress', key: 'progress', width: 12 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Date Submitted', key: 'dateSubmitted', width: 15 }
  ];

  requests.forEach(req => {
    detailsSheet.addRow({
      requestId: `REQ-${req._id.toString().slice(-6).toUpperCase()}`,
      employee: req.employee?.fullName || '',
      department: req.employee?.department || '',
      amountRequested: req.amountRequested || 0,
      amountApproved: req.amountApproved || req.amountRequested || 0,
      totalDisbursed: req.totalDisbursed || 0,
      remaining: req.remainingBalance || 0,
      progress: `${req.disbursementProgress || 0}%`,
      status: req.status || '',
      dateSubmitted: req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-GB') : ''
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="cash_requests_${Date.now()}.xlsx"`);
  
  await workbook.xlsx.write(res);
  res.end();
}

// Helper: Export as PDF (multi-request report)
async function exportAsPDF(res, requests) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ 
    size: 'A4', 
    margins: { top: 50, bottom: 50, left: 40, right: 40 }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="cash_requests_report_${Date.now()}.pdf"`);
  
  doc.pipe(res);

  // Title
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .text('Cash Requests Report', 40, 50);

  doc.fontSize(10)
     .font('Helvetica')
     .text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, 75);

  doc.fontSize(10)
     .text(`Total Requests: ${requests.length}`, 40, 90);

  let yPos = 120;

  // List each request
  requests.forEach((req, index) => {
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }

    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text(`${index + 1}. REQ-${req._id.toString().slice(-6).toUpperCase()}`, 40, yPos);

    yPos += 15;

    doc.fontSize(9)
       .font('Helvetica')
       .text(`Employee: ${req.employee?.fullName || 'N/A'}`, 50, yPos);
    
    yPos += 12;

    doc.text(`Amount: XAF ${(req.amountApproved || req.amountRequested || 0).toLocaleString()}`, 50, yPos);
    
    yPos += 12;

    doc.text(`Disbursed: XAF ${(req.totalDisbursed || 0).toLocaleString()} (${req.disbursementProgress || 0}%)`, 50, yPos);
    
    yPos += 12;

    doc.text(`Status: ${req.status || 'N/A'}`, 50, yPos);

    yPos += 20;
  });

  doc.end();
}


/**
 * Maps raw approval chain from getCashRequestApprovalChain() to CashRequest schema format
 * @param {Array} rawApprovalChain - Raw approval chain from config
 * @returns {Array} Properly formatted approval chain for CashRequest model
 */
const mapApprovalChainForCashRequest = (rawApprovalChain) => {
  if (!rawApprovalChain || !Array.isArray(rawApprovalChain)) {
    throw new Error('Invalid approval chain provided');
  }

  return rawApprovalChain.map(step => {
    // Extract approver details properly
    const approverData = step.approver || {};
    
    return {
      level: step.level,
      approver: {
        name: typeof approverData.name === 'string' ? approverData.name : approverData.name?.toString() || '',
        email: typeof approverData.email === 'string' ? approverData.email : approverData.email?.toString() || '',
        role: (approverData.role || approverData.position || '').toString(),
        department: (approverData.department || '').toString()
      },
      status: step.status || 'pending',
      assignedDate: step.level === 1 ? new Date() : null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    };
  });
};

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
    
    // Helper function to check if all previous levels are approved
    const isPreviousLevelApproved = (request, currentLevel) => {
      const previousLevels = request.approvalChain.filter(step => step.level < currentLevel);
      return previousLevels.length === 0 || previousLevels.every(step => step.status === 'approved');
    };
    
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

    // Filter requests to ensure proper approval hierarchy with enhanced logging
    const validRequests = requests.filter(req => {
      const financeStep = req.approvalChain.find(s => 
        s.approver.email === user.email && s.approver.role === 'Finance Officer'
      );
      
      console.log(`\n🔍 Checking request ${req._id}:`);
      console.log(`  Current status: ${req.status}`);
      console.log(`  Finance step found: ${!!financeStep}`);
      
      if (financeStep) {
        console.log(`  Finance step level: ${financeStep.level}, status: ${financeStep.status}`);
      }
      
      // If no finance step for this user, check if it's a general finance status
      if (!financeStep) {
        const isGeneralFinanceStatus = ['approved', 'disbursed', 'completed', 'justification_pending_finance'].includes(req.status);
        console.log(`  No finance step for user, general finance status: ${isGeneralFinanceStatus}`);
        return isGeneralFinanceStatus;
      }
      
      // For requests with pending finance step, ensure all previous levels are approved
      if (financeStep.status === 'pending') {
        const allPreviousApproved = isPreviousLevelApproved(req, financeStep.level);
        const previousSteps = req.approvalChain.filter(s => s.level < financeStep.level);
        
        console.log(`  Previous steps (${previousSteps.length}):`);
        previousSteps.forEach(step => {
          console.log(`    Level ${step.level}: ${step.approver.role} - ${step.status}`);
        });
        
        if (!allPreviousApproved) {
          console.log(`  ❌ FILTERED OUT: Previous levels not all approved`);
          return false;
        }
        console.log(`  ✅ INCLUDED: All previous levels approved`);
      } else {
        console.log(`  ✅ INCLUDED: Finance step status is ${financeStep.status}`);
      }
      
      return true;
    });
    
    console.log(`Valid requests after hierarchy check: ${validRequests.length}`);

    // Add detailed debug info for each request
    const requestsWithDebug = validRequests.map(req => {
      const financeStep = req.approvalChain.find(s => 
        s.approver.email === user.email && s.approver.role === 'Finance Officer'
      );
      
      const allPreviousLevels = req.approvalChain.filter(s => 
        financeStep ? s.level < financeStep.level : true
      );
      
      return {
        ...req.toObject(),
        _debug: {
          status: req.status,
          financeStepLevel: financeStep ? financeStep.level : 'Not found',
          financeStepStatus: financeStep ? financeStep.status : 'N/A',
          financeStepEmail: financeStep ? financeStep.approver.email : 'N/A',
          previousLevelsApproved: financeStep ? isPreviousLevelApproved(req, financeStep.level) : 'N/A',
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
    console.log('Disbursement Amount:', disbursementAmount);

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

    // Find finance step
    const financeStepIndex = request.approvalChain.findIndex(step => 
      step.approver.email === user.email && 
      step.approver.role === 'Finance Officer' &&
      step.status === 'pending'
    );

    if (financeStepIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'This request is not pending your approval'
      });
    }

    const financeStep = request.approvalChain[financeStepIndex];

    // Verify previous approvals
    const allPreviousApproved = request.approvalChain
      .filter(s => s.level < financeStep.level)
      .every(s => s.status === 'approved');

    if (!allPreviousApproved) {
      return res.status(400).json({
        success: false,
        message: 'Cannot process finance approval until all previous levels are approved'
      });
    }

    if (decision === 'approved') {
      // Determine final amount
      const finalAmount = parseFloat(amountApproved || request.amountRequested);
      console.log(`Final approved amount: XAF ${finalAmount.toLocaleString()}`);

      // ============================================
      // BUDGET CODE ASSIGNMENT
      // ============================================
      let budgetCode = null;
      
      if (!budgetCodeId) {
        return res.status(400).json({
          success: false,
          message: 'Budget code must be assigned for approval'
        });
      }

      console.log(`💼 Finance assigning budget code: ${budgetCodeId}`);
      budgetCode = await BudgetCode.findById(budgetCodeId);
      
      if (!budgetCode) {
        return res.status(404).json({
          success: false,
          message: 'Budget code not found'
        });
      }

      console.log(`\n💰 Budget Code: ${budgetCode.code} - ${budgetCode.name}`);
      console.log(`   Department: ${budgetCode.department}`);
      console.log(`   Available: XAF ${budgetCode.remaining.toLocaleString()}`);

      // Check budget sufficiency
      if (budgetCode.remaining < finalAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient budget. Available: XAF ${budgetCode.remaining.toLocaleString()}, Required: XAF ${finalAmount.toLocaleString()}`
        });
      }

      console.log(`✅ Budget check passed`);

      // ✅ HANDLE RE-APPROVAL: Release any existing allocation first
      const existingAllocation = budgetCode.allocations.find(
        a => a.requisitionId && a.requisitionId.toString() === requestId.toString()
      );

      if (existingAllocation) {
        console.log(`\n🔄 Found existing allocation (${existingAllocation.status})`);
        
        if (existingAllocation.status !== 'released') {
          console.log(`   Releasing previous allocation...`);
          
          try {
            await budgetCode.releaseReservation(requestId, 'Re-approval - releasing old allocation');
            console.log(`   ✅ Previous allocation released`);
            
            // ✅ Refresh budget code after release
            budgetCode = await BudgetCode.findById(budgetCodeId);
          } catch (releaseError) {
            console.error(`   ❌ Failed to release: ${releaseError.message}`);
            // Continue anyway - reserveBudget will handle it
          }
        }
      }

      // ✅ Reserve budget (will create new allocation or update released one)
      try {
        console.log(`\n💰 RESERVING budget...`);
        
        await budgetCode.reserveBudget(request._id, finalAmount, req.user.userId);
        
        console.log('✅ Budget reserved successfully');

        // Update request allocation info
        request.budgetAllocation = {
          budgetCodeId: budgetCode._id,
          budgetCode: budgetCode.code,
          allocatedAmount: finalAmount,
          allocationStatus: 'allocated',
          assignedBy: req.user.userId,
          assignedAt: new Date()
        };

      } catch (budgetError) {
        console.error('❌ Budget reservation failed:', budgetError);
        return res.status(500).json({
          success: false,
          message: `Failed to reserve budget: ${budgetError.message}`
        });
      }

      // Update approval chain
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

      request.amountApproved = finalAmount;
      request.financeOfficer = req.user.userId;

      // ============================================
      // HANDLE DISBURSEMENT (if provided immediately)
      // ============================================
      if (disbursementAmount) {
        const disbursedAmount = parseFloat(disbursementAmount);
        
        console.log(`\n💸 Processing immediate disbursement...`);
        console.log(`   Amount: XAF ${disbursedAmount.toLocaleString()}`);

        if (disbursedAmount > finalAmount) {
          // Rollback reservation
          try {
            await budgetCode.releaseReservation(request._id, 'Disbursement amount exceeds approved amount');
          } catch (rollbackError) {
            console.error('Failed to rollback reservation:', rollbackError);
          }

          return res.status(400).json({
            success: false,
            message: `Disbursement amount cannot exceed approved amount`
          });
        }

        try {
          // Deduct from budget
          await budgetCode.deductBudget(request._id, disbursedAmount);
          console.log('✅ Budget deducted successfully');

          // Initialize disbursements array
          if (!request.disbursements) {
            request.disbursements = [];
          }

          // Add disbursement record
          request.disbursements.push({
            amount: disbursedAmount,
            date: new Date(),
            disbursedBy: req.user.userId,
            notes: comments || '',
            disbursementNumber: request.disbursements.length + 1
          });

          // Update disbursement tracking
          request.totalDisbursed = disbursedAmount;
          request.remainingBalance = finalAmount - disbursedAmount;

          // Set appropriate status
          if (request.remainingBalance === 0) {
            request.status = 'fully_disbursed';
            console.log('✅ Request FULLY DISBURSED');
          } else {
            request.status = 'partially_disbursed';
            console.log(`✅ Request PARTIALLY DISBURSED (${Math.round((disbursedAmount / finalAmount) * 100)}%)`);
          }

          // Update budget allocation status
          request.budgetAllocation.allocationStatus = 'spent';
          request.budgetAllocation.actualSpent = disbursedAmount;

        } catch (deductError) {
          console.error('❌ Budget deduction failed:', deductError);
          
          // Rollback reservation
          try {
            await budgetCode.releaseReservation(request._id, 'Disbursement failed');
            console.log('✅ Budget reservation rolled back');
          } catch (rollbackError) {
            console.error('❌ Failed to rollback reservation:', rollbackError);
          }

          return res.status(500).json({
            success: false,
            message: `Budget deduction failed: ${deductError.message}`
          });
        }
      } else {
        // Approved but not yet disbursed
        request.status = 'approved';
        console.log('✅ Request APPROVED (budget reserved, awaiting disbursement)');
      }

      await request.save();
      console.log('✅ Request saved successfully');

      // Send notifications
      const isFullyDisbursed = request.status === 'fully_disbursed';
      
      await sendEmail({
        to: request.employee.email,
        subject: isFullyDisbursed ? 
          '✅ Reimbursement Approved and Disbursed' : 
          '✅ Reimbursement Approved',
        html: `
          <h3>${isFullyDisbursed ? 'Your Reimbursement Has Been Disbursed! 🎉' : 'Your Reimbursement Has Been Approved! 🎉'}</h3>
          <p>Dear ${request.employee.fullName},</p>

          <p>Great news! Your reimbursement request has been approved by finance${disbursementAmount ? ' and funds have been disbursed' : ''}.</p>

          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
            <p><strong>Approval Details:</strong></p>
            <ul>
              <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Amount Approved:</strong> XAF ${finalAmount.toLocaleString()}</li>
              ${disbursementAmount ? `<li><strong>Amount Disbursed:</strong> XAF ${parseFloat(disbursementAmount).toLocaleString()}</li>` : ''}
              ${request.remainingBalance > 0 ? `<li><strong>Remaining:</strong> XAF ${request.remainingBalance.toLocaleString()}</li>` : ''}
              <li><strong>Budget Code:</strong> ${budgetCode.code} - ${budgetCode.name}</li>
              <li><strong>Approved by:</strong> ${user.fullName} (Finance)</li>
            </ul>
          </div>

          ${disbursementAmount ? 
            (isFullyDisbursed ?
              '<p><strong>Status:</strong> Your reimbursement has been fully processed and you should receive your funds soon.</p>' :
              `<p><strong>Status:</strong> Partial payment processed (${Math.round((parseFloat(disbursementAmount) / finalAmount) * 100)}%). More payments may follow.</p>`
            ) :
            '<p><strong>Next Step:</strong> Disbursement will be processed by the Finance team.</p>'
          }

          <p>Thank you for following the proper reimbursement process!</p>
        `
      }).catch(err => console.error('Failed to send notification:', err));

      console.log('=== FINANCE APPROVAL COMPLETED ===\n');

      await request.populate('employee', 'fullName email department');

      res.json({
        success: true,
        message: `Reimbursement approved${disbursementAmount ? ' and funds disbursed' : ' (awaiting disbursement)'}`,
        data: request,
        budgetAllocation: {
          budgetCode: budgetCode.code,
          budgetName: budgetCode.name,
          allocatedAmount: finalAmount,
          remainingBudget: budgetCode.remaining
        },
        disbursement: disbursementAmount ? {
          amount: parseFloat(disbursementAmount),
          disbursementNumber: request.disbursements.length,
          totalDisbursed: request.totalDisbursed,
          remainingBalance: request.remainingBalance,
          progress: Math.round((request.totalDisbursed / finalAmount) * 100),
          status: request.status
        } : null
      });

    } else {
      // Handle rejection
      console.log('❌ Reimbursement REJECTED by finance');
      
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

      await sendEmail({
        to: request.employee.email,
        subject: '⚠️ Reimbursement Request Denied',
        html: `
          <h3>Reimbursement Request Denied</h3>
          <p>Dear ${request.employee.fullName},</p>

          <p>Your reimbursement request has been denied by the finance team.</p>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</p>
            <p><strong>Amount:</strong> XAF ${request.amountRequested.toLocaleString()}</p>
            ${comments ? `<p><strong>Reason:</strong> ${comments}</p>` : ''}
          </div>

          <p>If you have questions, please contact the finance team.</p>
        `
      }).catch(err => console.error('Failed to send denial email:', err));

      console.log('=== REIMBURSEMENT DENIED ===\n');
      
      return res.json({
        success: true,
        message: 'Reimbursement rejected by finance',
        data: request
      });
    }

  } catch (error) {
    console.error('❌ Process finance decision error:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process finance decision',
      error: error.message
    });
  }
};


// const processFinanceDecision = async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const { decision, comments, amountApproved, disbursementAmount, budgetCodeId } = req.body;

//     console.log('\n=== FINANCE DECISION PROCESSING ===');
//     console.log('Request ID:', requestId);
//     console.log('Decision:', decision);
//     console.log('Budget Code ID:', budgetCodeId);
//     console.log('Amount Approved:', amountApproved);
//     console.log('Disbursement Amount:', disbursementAmount);

//     const user = await User.findById(req.user.userId);
//     const request = await CashRequest.findById(requestId)
//       .populate('employee', 'fullName email department')
//       .populate('projectId', 'name code budgetCodeId');

//     if (!request) {
//       return res.status(404).json({
//         success: false,
//         message: 'Request not found'
//       });
//     }

//     // Find finance step
//     const financeStepIndex = request.approvalChain.findIndex(step => 
//       step.approver.email === user.email && 
//       step.approver.role === 'Finance Officer' &&
//       step.status === 'pending'
//     );

//     if (financeStepIndex === -1) {
//       return res.status(403).json({
//         success: false,
//         message: 'This request is not pending your approval'
//       });
//     }

//     const financeStep = request.approvalChain[financeStepIndex];

//     // Verify previous approvals
//     const allPreviousApproved = request.approvalChain
//       .filter(s => s.level < financeStep.level)
//       .every(s => s.status === 'approved');

//     if (!allPreviousApproved) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot process finance approval until all previous levels are approved'
//       });
//     }

//     if (decision === 'approved') {
//       // Determine final amount
//       const finalAmount = parseFloat(amountApproved || request.amountRequested);
//       console.log(`Final approved amount: XAF ${finalAmount.toLocaleString()}`);

//       // ============================================
//       // STEP 1: GET OR ASSIGN BUDGET CODE
//       // ============================================
//       let budgetCode = null;
//       let isReApproval = false; // ✅ Track if this is a re-approval
      
//       // ✅ Check if this is a re-approval with existing allocation
//       if (request.budgetAllocation && request.budgetAllocation.budgetCodeId) {
//         console.log('⚠️  Existing budget allocation found');
//         budgetCode = await BudgetCode.findById(request.budgetAllocation.budgetCodeId);
        
//         if (budgetCode) {
//           // ✅ Check if allocation exists for this request
//           const existingAllocation = budgetCode.allocations.find(
//             a => a.requisitionId && a.requisitionId.toString() === requestId.toString()
//           );

//           if (existingAllocation) {
//             console.log(`   Existing allocation status: ${existingAllocation.status}`);
            
//             // ✅ If allocation exists with any status, this is a re-approval
//             if (['spent', 'released', 'allocated'].includes(existingAllocation.status)) {
//               isReApproval = true;
              
//               // ✅ If allocation was spent or allocated, release it first
//               if (existingAllocation.status === 'spent' || existingAllocation.status === 'allocated') {
//                 console.log(`   🔄 Releasing previous ${existingAllocation.status} allocation...`);
                
//                 // Manually release the allocation
//                 existingAllocation.status = 'released';
//                 existingAllocation.releaseDate = new Date();
//                 existingAllocation.releaseReason = 'Re-approval after rejection';
                
//                 // If it was spent, return the funds
//                 if (existingAllocation.status === 'spent') {
//                   budgetCode.used -= existingAllocation.amount;
//                 }
                
//                 await budgetCode.save();
//                 console.log('   ✅ Previous allocation released');
//               }
//             }
//           }
//         }
//       }
      
//       // ✅ Get fresh budget code if not already loaded
//       if (!budgetCode) {
//         // Try project budget code
//         if (request.projectId && request.projectId.budgetCodeId) {
//           console.log('📦 Using project budget code');
//           budgetCode = await BudgetCode.findById(request.projectId.budgetCodeId);
//         }
//         // Use finance-assigned budget code
//         else if (budgetCodeId) {
//           console.log(`💼 Finance assigning budget code: ${budgetCodeId}`);
//           budgetCode = await BudgetCode.findById(budgetCodeId);
//         } else {
//           return res.status(400).json({
//             success: false,
//             message: 'Budget code must be assigned for approval'
//           });
//         }
//       }

//       if (!budgetCode) {
//         return res.status(404).json({
//           success: false,
//           message: 'Budget code not found'
//         });
//       }

//       console.log(`\n💰 Budget Code: ${budgetCode.code} - ${budgetCode.name}`);
//       console.log(`   Current Budget: XAF ${budgetCode.budget.toLocaleString()}`);
//       console.log(`   Used: XAF ${budgetCode.used.toLocaleString()}`);
//       console.log(`   Available: XAF ${budgetCode.remaining.toLocaleString()}`);
//       console.log(`   Is Re-Approval: ${isReApproval ? 'YES' : 'NO'}`);

//       // Check budget sufficiency
//       if (budgetCode.remaining < finalAmount) {
//         return res.status(400).json({
//           success: false,
//           message: `Insufficient budget. Available: XAF ${budgetCode.remaining.toLocaleString()}, Required: XAF ${finalAmount.toLocaleString()}`
//         });
//       }

//       console.log(`✅ Budget check passed`);

//       // ============================================
//       // STEP 2: RESERVE BUDGET (Fresh or Re-reserve)
//       // ============================================
//       try {
//         console.log(`\n💰 ${isReApproval ? 'RE-RESERVING' : 'RESERVING'} budget...`);
        
//         await budgetCode.reserveBudget(
//           request._id, 
//           finalAmount, 
//           req.user.userId
//         );
//         console.log('✅ Budget reserved successfully');

//         // Update request allocation info
//         request.budgetAllocation = {
//           budgetCodeId: budgetCode._id,
//           budgetCode: budgetCode.code,
//           allocatedAmount: finalAmount,
//           allocationStatus: 'allocated', // ✅ RESERVED
//           assignedBy: req.user.userId,
//           assignedAt: new Date()
//         };

//       } catch (budgetError) {
//         console.error('❌ Budget reservation failed:', budgetError);
//         return res.status(500).json({
//           success: false,
//           message: `Failed to reserve budget: ${budgetError.message}`
//         });
//       }

//       // ============================================
//       // STEP 3: UPDATE APPROVAL CHAIN
//       // ============================================
//       request.approvalChain[financeStepIndex].status = 'approved';
//       request.approvalChain[financeStepIndex].comments = comments;
//       request.approvalChain[financeStepIndex].actionDate = new Date();
//       request.approvalChain[financeStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
//       request.approvalChain[financeStepIndex].decidedBy = req.user.userId;

//       request.financeDecision = {
//         decision: 'approved',
//         comments,
//         decisionDate: new Date()
//       };

//       request.amountApproved = finalAmount;
//       request.financeOfficer = req.user.userId;

//       // ============================================
//       // STEP 4: HANDLE DISBURSEMENT (if provided)
//       // ============================================
//       if (disbursementAmount) {
//         const disbursedAmount = parseFloat(disbursementAmount);
        
//         console.log(`\n💸 Processing disbursement...`);
//         console.log(`   Disbursement amount: XAF ${disbursedAmount.toLocaleString()}`);

//         // Validate disbursement amount
//         if (disbursedAmount > finalAmount) {
//           // Rollback reservation
//           try {
//             await budgetCode.releaseReservation(request._id, 'Disbursement amount exceeds approved amount');
//           } catch (rollbackError) {
//             console.error('Failed to rollback reservation:', rollbackError);
//           }

//           return res.status(400).json({
//             success: false,
//             message: `Disbursement amount (XAF ${disbursedAmount.toLocaleString()}) cannot exceed approved amount (XAF ${finalAmount.toLocaleString()})`
//           });
//         }

//         try {
//           // ✅ DEDUCT from budget
//           await budgetCode.deductBudget(request._id, disbursedAmount);
//           console.log('✅ Budget deducted successfully');

//           // ✅ Initialize disbursements array if needed
//           if (!request.disbursements) {
//             request.disbursements = [];
//           }

//           // ✅ Add disbursement record
//           request.disbursements.push({
//             amount: disbursedAmount,
//             date: new Date(),
//             disbursedBy: req.user.userId,
//             notes: comments || '',
//             disbursementNumber: request.disbursements.length + 1
//           });

//           // ✅ Update disbursement tracking
//           request.totalDisbursed = disbursedAmount;
//           request.remainingBalance = finalAmount - disbursedAmount;

//           // ✅ Set appropriate status
//           if (request.remainingBalance === 0) {
//             request.status = 'fully_disbursed';
//             console.log('✅ Request FULLY DISBURSED');
//           } else {
//             request.status = 'partially_disbursed';
//             console.log(`✅ Request PARTIALLY DISBURSED (${Math.round((disbursedAmount / finalAmount) * 100)}% complete)`);
//           }

//           // ✅ Update budget allocation status
//           request.budgetAllocation.allocationStatus = 'spent';
//           request.budgetAllocation.actualSpent = disbursedAmount;

//         } catch (deductError) {
//           console.error('❌ Budget deduction failed:', deductError);
          
//           // ✅ ROLLBACK: Release the reservation
//           try {
//             await budgetCode.releaseReservation(request._id, 'Disbursement failed');
//             console.log('✅ Budget reservation rolled back');
//           } catch (rollbackError) {
//             console.error('❌ Failed to rollback reservation:', rollbackError);
//           }

//           return res.status(500).json({
//             success: false,
//             message: `Budget deduction failed: ${deductError.message}`
//           });
//         }

//       } else {
//         // ✅ Approved but not disbursed yet
//         request.status = 'approved';
//         console.log('✅ Request APPROVED (budget reserved, awaiting disbursement)');
//       }

//       // ============================================
//       // STEP 5: SAVE REQUEST
//       // ============================================
//       await request.save();
//       console.log('✅ Request saved successfully');

//       // ============================================
//       // STEP 6: SEND NOTIFICATIONS
//       // ============================================
//       const notifications = [];

//       const budgetInfo = `
//         <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1890ff;">
//           <p><strong>💰 Budget Allocation:</strong></p>
//           <ul>
//             <li><strong>Budget Code:</strong> ${budgetCode.code} - ${budgetCode.name}</li>
//             <li><strong>Amount Approved:</strong> XAF ${finalAmount.toLocaleString()}</li>
//             ${disbursementAmount ? `<li><strong>Amount Disbursed:</strong> XAF ${parseFloat(disbursementAmount).toLocaleString()}</li>` : ''}
//             ${disbursementAmount && request.remainingBalance > 0 ? `<li><strong>Remaining to Disburse:</strong> XAF ${request.remainingBalance.toLocaleString()}</li>` : ''}
//             <li><strong>Budget Remaining:</strong> XAF ${budgetCode.remaining.toLocaleString()}</li>
//             <li><strong>Status:</strong> ${disbursementAmount ? '💸 Funds Disbursed' : '💰 Funds Reserved'}</li>
//           </ul>
//         </div>
//       `;

//       // Notify employee
//       notifications.push(
//         sendEmail({
//           to: request.employee.email,
//           subject: `Cash Request ${disbursementAmount ? 'Approved & Disbursed' : 'Approved'} - ${request.employee.fullName}`,
//           html: `
//             <h3>Cash Request ${disbursementAmount ? 'Approved & Disbursed' : 'Approved'}</h3>
//             <p>Dear ${request.employee.fullName},</p>
            
//             <p>Your cash request has been ${disbursementAmount ? 'approved and funds have been disbursed' : 'approved by the finance team'}.</p>

//             <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
//               <p><strong>Approval Details:</strong></p>
//               <ul>
//                 <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
//                 <li><strong>Amount Approved:</strong> XAF ${finalAmount.toLocaleString()}</li>
//                 <li><strong>Approved by:</strong> ${user.fullName} (Finance Officer)</li>
//                 <li><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</li>
//               </ul>
//             </div>

//             ${budgetInfo}

//             ${disbursementAmount ? 
//               request.status === 'fully_disbursed' ?
//                 `<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
//                   <p><strong>⚠️ Next Step: Submit Justification</strong></p>
//                   <p>Your funds have been fully disbursed. Please submit your justification with receipts within the required timeframe.</p>
//                 </div>` :
//                 `<div style="background-color: #e6f7ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
//                   <p><em>💡 Partial disbursement (${Math.round((parseFloat(disbursementAmount) / finalAmount) * 100)}% of approved amount). More disbursements may follow.</em></p>
//                 </div>`
//               : 
//               `<div style="background-color: #e6f7ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
//                 <p><em>💰 Budget has been reserved. Please wait for disbursement processing by the Finance team.</em></p>
//               </div>`
//             }

//             <p>Thank you!</p>
//           `
//         }).catch(error => {
//           console.error('Failed to send employee notification:', error);
//           return { error, type: 'employee' };
//         })
//       );

//       await Promise.allSettled(notifications);

//       console.log('\n=== FINANCE APPROVAL COMPLETED ===\n');

//       // ============================================
//       // STEP 7: RETURN RESPONSE
//       // ============================================
//       await request.populate('employee', 'fullName email department');

//       res.json({
//         success: true,
//         message: `Request ${isReApproval ? 're-' : ''}approved${disbursementAmount ? ' and funds disbursed' : ' (awaiting disbursement)'}`,
//         data: request,
//         budgetAllocation: {
//           budgetCode: budgetCode.code,
//           budgetName: budgetCode.name,
//           allocatedAmount: finalAmount,
//           remainingBudget: budgetCode.remaining,
//           status: disbursementAmount ? 'disbursed' : 'reserved',
//           isReApproval
//         },
//         disbursement: disbursementAmount ? {
//           amount: parseFloat(disbursementAmount),
//           disbursementNumber: request.disbursements.length,
//           totalDisbursed: request.totalDisbursed,
//           remainingBalance: request.remainingBalance,
//           progress: Math.round((request.totalDisbursed / finalAmount) * 100),
//           status: request.status
//         } : null
//       });

//     } else {
//       // ============================================
//       // HANDLE REJECTION
//       // ============================================
//       console.log('❌ Request REJECTED by finance');
      
//       request.status = 'denied';
//       request.financeDecision = {
//         decision: 'rejected',
//         comments,
//         decisionDate: new Date()
//       };

//       request.approvalChain[financeStepIndex].status = 'rejected';
//       request.approvalChain[financeStepIndex].comments = comments;
//       request.approvalChain[financeStepIndex].actionDate = new Date();
//       request.approvalChain[financeStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
//       request.approvalChain[financeStepIndex].decidedBy = req.user.userId;

//       await request.save();

//       await sendCashRequestEmail.denialToEmployee(
//         request.employee.email,
//         comments || 'Request denied by finance team',
//         requestId,
//         user.fullName
//       ).catch(err => console.error('Failed to send denial email:', err));

//       console.log('=== REQUEST DENIED ===\n');
      
//       return res.json({
//         success: true,
//         message: 'Request rejected by finance',
//         data: request
//       });
//     }

//   } catch (error) {
//     console.error('❌ Process finance decision error:', error);
//     console.error('Stack trace:', error.stack);
    
//     res.status(500).json({
//       success: false,
//       message: 'Failed to process finance decision',
//       error: error.message
//     });
//   }
// };


// const processFinanceDecision = async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const { decision, comments, amountApproved, disbursementAmount, budgetCodeId } = req.body;

//     console.log('\n=== FINANCE DECISION PROCESSING ===');
//     console.log('Request ID:', requestId);
//     console.log('Decision:', decision);
//     console.log('Budget Code ID:', budgetCodeId);
//     console.log('Disbursement Amount:', disbursementAmount);

//     const user = await User.findById(req.user.userId);
//     const request = await CashRequest.findById(requestId)
//       .populate('employee', 'fullName email department')
//       .populate('projectId', 'name code budgetCodeId');

//     if (!request) {
//       return res.status(404).json({
//         success: false,
//         message: 'Request not found'
//       });
//     }

//     // Find finance step
//     const financeStepIndex = request.approvalChain.findIndex(step => 
//       step.approver.email === user.email && 
//       step.approver.role === 'Finance Officer' &&
//       step.status === 'pending'
//     );

//     if (financeStepIndex === -1) {
//       return res.status(403).json({
//         success: false,
//         message: 'This request is not pending your approval'
//       });
//     }

//     const financeStep = request.approvalChain[financeStepIndex];

//     // Verify previous approvals
//     const allPreviousApproved = request.approvalChain
//       .filter(s => s.level < financeStep.level)
//       .every(s => s.status === 'approved');

//     if (!allPreviousApproved) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot process finance approval until all previous levels are approved'
//       });
//     }

//     if (decision === 'approved') {
//       // Determine final amount
//       const finalAmount = parseFloat(amountApproved || request.amountRequested);
//       console.log(`Final approved amount: XAF ${finalAmount.toLocaleString()}`);

//       // ============================================
//       // BUDGET CODE ASSIGNMENT (happens during approval, not disbursement)
//       // ============================================
//       let budgetCode = null;
      
//       if (budgetCodeId) {
//         console.log(`💼 Finance assigning budget code: ${budgetCodeId}`);
//         budgetCode = await BudgetCode.findById(budgetCodeId);
        
//         if (!budgetCode) {
//           return res.status(404).json({
//             success: false,
//             message: 'Budget code not found'
//           });
//         }

//         console.log(`\n💰 Budget Code: ${budgetCode.code} - ${budgetCode.name}`);
//         console.log(`   Available: XAF ${budgetCode.remaining.toLocaleString()}`);

//         // Check budget sufficiency
//         if (budgetCode.remaining < finalAmount) {
//           return res.status(400).json({
//             success: false,
//             message: `Insufficient budget. Available: XAF ${budgetCode.remaining.toLocaleString()}, Required: XAF ${finalAmount.toLocaleString()}`
//           });
//         }

//         console.log(`✅ Budget check passed`);

//         // Reserve budget
//         try {
//           console.log(`\n💰 RESERVING budget...`);
//           await budgetCode.reserveBudget(request._id, finalAmount, req.user.userId);
//           console.log('✅ Budget reserved successfully');

//           // Update request allocation info
//           request.budgetAllocation = {
//             budgetCodeId: budgetCode._id,
//             budgetCode: budgetCode.code,
//             allocatedAmount: finalAmount,
//             allocationStatus: 'allocated',
//             assignedBy: req.user.userId,
//             assignedAt: new Date()
//           };

//         } catch (budgetError) {
//           console.error('❌ Budget reservation failed:', budgetError);
//           return res.status(500).json({
//             success: false,
//             message: `Failed to reserve budget: ${budgetError.message}`
//           });
//         }
//       } else {
//         return res.status(400).json({
//           success: false,
//           message: 'Budget code must be assigned for approval'
//         });
//       }

//       // Update approval chain
//       request.approvalChain[financeStepIndex].status = 'approved';
//       request.approvalChain[financeStepIndex].comments = comments;
//       request.approvalChain[financeStepIndex].actionDate = new Date();
//       request.approvalChain[financeStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
//       request.approvalChain[financeStepIndex].decidedBy = req.user.userId;

//       request.financeDecision = {
//         decision: 'approved',
//         comments,
//         decisionDate: new Date()
//       };

//       request.amountApproved = finalAmount;
//       request.financeOfficer = req.user.userId;

//       // ============================================
//       // HANDLE DISBURSEMENT (if provided immediately)
//       // ============================================
//       if (disbursementAmount) {
//         const disbursedAmount = parseFloat(disbursementAmount);
        
//         console.log(`\n💸 Processing immediate disbursement...`);
//         console.log(`   Amount: XAF ${disbursedAmount.toLocaleString()}`);

//         if (disbursedAmount > finalAmount) {
//           // Rollback reservation
//           try {
//             await budgetCode.releaseReservation(request._id, 'Disbursement amount exceeds approved amount');
//           } catch (rollbackError) {
//             console.error('Failed to rollback reservation:', rollbackError);
//           }

//           return res.status(400).json({
//             success: false,
//             message: `Disbursement amount cannot exceed approved amount`
//           });
//         }

//         try {
//           // Deduct from budget
//           await budgetCode.deductBudget(request._id, disbursedAmount);
//           console.log('✅ Budget deducted successfully');

//           // Initialize disbursements array
//           if (!request.disbursements) {
//             request.disbursements = [];
//           }

//           // Add disbursement record
//           request.disbursements.push({
//             amount: disbursedAmount,
//             date: new Date(),
//             disbursedBy: req.user.userId,
//             notes: comments || '',
//             disbursementNumber: request.disbursements.length + 1
//           });

//           // Update disbursement tracking
//           request.totalDisbursed = disbursedAmount;
//           request.remainingBalance = finalAmount - disbursedAmount;

//           // Set appropriate status
//           if (request.remainingBalance === 0) {
//             request.status = 'fully_disbursed';
//             console.log('✅ Request FULLY DISBURSED');
//           } else {
//             request.status = 'partially_disbursed';
//             console.log(`✅ Request PARTIALLY DISBURSED (${Math.round((disbursedAmount / finalAmount) * 100)}%)`);
//           }

//           // Update budget allocation status
//           request.budgetAllocation.allocationStatus = 'spent';
//           request.budgetAllocation.actualSpent = disbursedAmount;

//         } catch (deductError) {
//           console.error('❌ Budget deduction failed:', deductError);
          
//           // Rollback reservation
//           try {
//             await budgetCode.releaseReservation(request._id, 'Disbursement failed');
//             console.log('✅ Budget reservation rolled back');
//           } catch (rollbackError) {
//             console.error('❌ Failed to rollback reservation:', rollbackError);
//           }

//           return res.status(500).json({
//             success: false,
//             message: `Budget deduction failed: ${deductError.message}`
//           });
//         }
//       } else {
//         // Approved but not yet disbursed
//         request.status = 'approved';
//         console.log('✅ Request APPROVED (budget reserved, awaiting disbursement)');
//       }

//       await request.save();
//       console.log('✅ Request saved successfully');

//       // Send notifications
//       const isFullyDisbursed = request.status === 'fully_disbursed';
      
//       await sendEmail({
//         to: request.employee.email,
//         subject: isFullyDisbursed ? 
//           '✅ Reimbursement Approved and Disbursed' : 
//           '✅ Reimbursement Approved',
//         html: `
//           <h3>${isFullyDisbursed ? 'Your Reimbursement Has Been Disbursed! 🎉' : 'Your Reimbursement Has Been Approved! 🎉'}</h3>
//           <p>Dear ${request.employee.fullName},</p>

//           <p>Great news! Your reimbursement request has been approved by finance${disbursementAmount ? ' and funds have been disbursed' : ''}.</p>

//           <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
//             <p><strong>Approval Details:</strong></p>
//             <ul>
//               <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
//               <li><strong>Amount Approved:</strong> XAF ${finalAmount.toLocaleString()}</li>
//               ${disbursementAmount ? `<li><strong>Amount Disbursed:</strong> XAF ${parseFloat(disbursementAmount).toLocaleString()}</li>` : ''}
//               ${request.remainingBalance > 0 ? `<li><strong>Remaining:</strong> XAF ${request.remainingBalance.toLocaleString()}</li>` : ''}
//               <li><strong>Budget Code:</strong> ${budgetCode.code} - ${budgetCode.name}</li>
//               <li><strong>Approved by:</strong> ${user.fullName} (Finance)</li>
//             </ul>
//           </div>

//           ${disbursementAmount ? 
//             (isFullyDisbursed ?
//               '<p><strong>Status:</strong> Your reimbursement has been fully processed and you should receive your funds soon.</p>' :
//               `<p><strong>Status:</strong> Partial payment processed (${Math.round((parseFloat(disbursementAmount) / finalAmount) * 100)}%). More payments may follow.</p>`
//             ) :
//             '<p><strong>Next Step:</strong> Disbursement will be processed by the Finance team.</p>'
//           }

//           <p>Thank you for following the proper reimbursement process!</p>
//         `
//       }).catch(err => console.error('Failed to send notification:', err));

//       console.log('=== FINANCE APPROVAL COMPLETED ===\n');

//       await request.populate('employee', 'fullName email department');

//       res.json({
//         success: true,
//         message: `Reimbursement approved${disbursementAmount ? ' and funds disbursed' : ' (awaiting disbursement)'}`,
//         data: request,
//         budgetAllocation: {
//           budgetCode: budgetCode.code,
//           budgetName: budgetCode.name,
//           allocatedAmount: finalAmount,
//           remainingBudget: budgetCode.remaining
//         },
//         disbursement: disbursementAmount ? {
//           amount: parseFloat(disbursementAmount),
//           disbursementNumber: request.disbursements.length,
//           totalDisbursed: request.totalDisbursed,
//           remainingBalance: request.remainingBalance,
//           progress: Math.round((request.totalDisbursed / finalAmount) * 100),
//           status: request.status
//         } : null
//       });

//     } else {
//       // Handle rejection
//       console.log('❌ Reimbursement REJECTED by finance');
      
//       request.status = 'denied';
//       request.financeDecision = {
//         decision: 'rejected',
//         comments,
//         decisionDate: new Date()
//       };

//       request.approvalChain[financeStepIndex].status = 'rejected';
//       request.approvalChain[financeStepIndex].comments = comments;
//       request.approvalChain[financeStepIndex].actionDate = new Date();
//       request.approvalChain[financeStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
//       request.approvalChain[financeStepIndex].decidedBy = req.user.userId;

//       await request.save();

//       await sendEmail({
//         to: request.employee.email,
//         subject: '⚠️ Reimbursement Request Denied',
//         html: `
//           <h3>Reimbursement Request Denied</h3>
//           <p>Dear ${request.employee.fullName},</p>

//           <p>Your reimbursement request has been denied by the finance team.</p>

//           <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
//             <p><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</p>
//             <p><strong>Amount:</strong> XAF ${request.amountRequested.toLocaleString()}</p>
//             ${comments ? `<p><strong>Reason:</strong> ${comments}</p>` : ''}
//           </div>

//           <p>If you have questions, please contact the finance team.</p>
//         `
//       }).catch(err => console.error('Failed to send denial email:', err));

//       console.log('=== REIMBURSEMENT DENIED ===\n');
      
//       return res.json({
//         success: true,
//         message: 'Reimbursement rejected by finance',
//         data: request
//       });
//     }

//   } catch (error) {
//     console.error('❌ Process finance decision error:', error);
//     console.error('Stack trace:', error.stack);
    
//     res.status(500).json({
//       success: false,
//       message: 'Failed to process finance decision',
//       error: error.message
//     });
//   }
// };

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

    // Find all justifications where this user is in approval chain
    const requests = await CashRequest.find({
      status: { $regex: /^justification_/ },
      'approvalChain': {
        $elemMatch: {
          'approver.email': user.email
        }
      }
    })
    .populate('employee', 'fullName email department')
    .sort({ 'justification.justificationDate': -1 });

    console.log(`Found ${requests.length} justifications`);

    // Filter to show only those pending for this user
    const pendingForUser = requests.filter(req => {
      const userStep = req.approvalChain.find(s =>
        s.approver.email === user.email && s.status === 'pending'
      );

      if (!userStep) return false;

      // Check if this is the correct status for this level
      const statusMap = {
        1: 'justification_pending_supervisor',
        2: 'justification_pending_departmental_head',
        3: 'justification_pending_head_of_business',
        4: 'justification_pending_finance'
      };

      return req.status === statusMap[userStep.level];
    });

    console.log(`${pendingForUser.length} pending for this user`);

    res.json({
      success: true,
      data: pendingForUser,
      count: pendingForUser.length
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
    const { amountSpent, balanceReturned, details, itemizedBreakdown } = req.body;

    console.log('=== JUSTIFICATION SUBMISSION ===');
    console.log('Request ID:', requestId);
    console.log('User:', req.user.userId);

    // Validation
    if (!amountSpent || balanceReturned === undefined || !details) {
      throw new Error('Missing required fields: amountSpent, balanceReturned, or details');
    }

    const spentAmount = Number(amountSpent);
    const returnedAmount = Number(balanceReturned);

    if (isNaN(spentAmount) || isNaN(returnedAmount)) {
      throw new Error('Invalid amounts');
    }

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email')
      .populate('approvalChain.decidedBy', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Only employee can submit
    if (!request.employee._id.equals(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the employee can submit justification'
      });
    }

    // ✅ UPDATED: Can only submit if request is fully_disbursed, partially_disbursed, or justification was rejected
    const canResubmit = ['fully_disbursed', 'partially_disbursed', 'disbursed'].includes(request.status) || 
                        request.status.includes('justification_rejected');

    if (!canResubmit) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit justification. Request status is ${request.status}. Justification can only be submitted for fully disbursed requests.`
      });
    }

    // ✅ UPDATED: Validate amounts match total disbursed amount (not approved amount)
    const totalDisbursed = request.totalDisbursed || 0;
    const total = spentAmount + returnedAmount;

    if (Math.abs(total - totalDisbursed) > 0.01) {
      throw new Error(
        `Total of amount spent (${spentAmount}) and balance returned (${returnedAmount}) ` +
        `must equal total disbursed amount (${totalDisbursed})`
      );
    }

    // ✅ Process documents using local storage
    let documents = [];
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} justification document(s)...`);
      
      for (const file of req.files) {
        try {
          console.log(`   Processing: ${file.originalname}`);
          
          // Save file using local storage
          const fileMetadata = await saveFile(
            file,
            STORAGE_CATEGORIES.JUSTIFICATIONS,
            '', // no subfolder
            null // auto-generate filename
          );

          documents.push({
            name: file.originalname,
            url: fileMetadata.url,
            publicId: fileMetadata.publicId,
            localPath: fileMetadata.localPath,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });

          console.log(`   ✅ Saved: ${fileMetadata.publicId}`);
          
        } catch (fileError) {
          console.error(`   ❌ Error processing ${file.originalname}:`, fileError);
          continue;
        }
      }
      
      console.log(`✅ ${documents.length} document(s) processed`);
    }

    // ✅ Parse itemized breakdown if provided
    let parsedBreakdown = null;
    if (itemizedBreakdown) {
      try {
        parsedBreakdown = typeof itemizedBreakdown === 'string' 
          ? JSON.parse(itemizedBreakdown) 
          : itemizedBreakdown;
        
        if (Array.isArray(parsedBreakdown) && parsedBreakdown.length > 0) {
          // Validate itemized breakdown
          const breakdownTotal = parsedBreakdown.reduce((sum, item) => 
            sum + parseFloat(item.amount || 0), 0
          );
          
          const discrepancy = Math.abs(breakdownTotal - spentAmount);
          if (discrepancy > 0.01) {
            throw new Error(
              `Itemized breakdown total (${breakdownTotal.toFixed(2)}) must match amount spent (${spentAmount.toFixed(2)})`
            );
          }
          
          console.log(`📋 Itemized breakdown validated: ${parsedBreakdown.length} items, total XAF ${breakdownTotal.toLocaleString()}`);
        } else {
          parsedBreakdown = null;
        }
      } catch (parseError) {
        console.error('Failed to parse/validate itemized breakdown:', parseError);
        
        // Clean up uploaded files
        if (documents.length > 0) {
          await deleteFiles(documents).catch(e => 
            console.error('Cleanup failed:', e)
          );
        }
        
        return res.status(400).json({
          success: false,
          message: `Invalid itemized breakdown: ${parseError.message}`
        });
      }
    }

    // Update budget with actual spending
    if (request.budgetAllocation && request.budgetAllocation.budgetCodeId) {
      const budgetCode = await BudgetCode.findById(request.budgetAllocation.budgetCodeId);
      if (budgetCode) {
        try {
          await budgetCode.recordSpending(request._id, spentAmount);
          request.budgetAllocation.allocationStatus = 'spent';
          request.budgetAllocation.actualSpent = spentAmount;
          request.budgetAllocation.balanceReturned = returnedAmount;
        } catch (budgetError) {
          console.error('Failed to update budget:', budgetError);
        }
      }
    }

    // ✅ Update justification with itemized breakdown
    request.justification = {
      amountSpent: spentAmount,
      balanceReturned: returnedAmount,
      details,
      documents,
      justificationDate: new Date(),
      submittedBy: req.user.userId,
      itemizedBreakdown: parsedBreakdown || []
    };

    // Create justification approval chain
    request.justificationApprovalChain = request.approvalChain.map(step => ({
      level: step.level,
      approver: {
        name: step.approver.name,
        email: step.approver.email,
        role: step.approver.role,
        department: step.approver.department
      },
      status: 'pending',
      assignedDate: step.level === 1 ? new Date() : null
    }));

    console.log(`Created justification approval chain with ${request.justificationApprovalChain.length} levels`);

    // Set status to first approval level (supervisor)
    request.status = 'justification_pending_supervisor';

    request.justificationApproval = {
      submittedDate: new Date(),
      submittedBy: req.user.userId
    };

    await request.save();

    // Notify approvers in the chain
    const notifications = [];
    const firstApprover = request.justificationApprovalChain[0];

    if (firstApprover) {
      notifications.push(
        sendEmail({
          to: firstApprover.approver.email,
          subject: `Justification Requires Your Approval - ${request.employee.fullName}`,
          html: `
            <h3>Cash Justification Requires Your Approval</h3>
            <p>Dear ${firstApprover.approver.name},</p>

            <p><strong>${request.employee.fullName}</strong> has submitted justification for cash request REQ-${requestId.toString().slice(-6).toUpperCase()}.</p>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
              <p><strong>Justification Summary:</strong></p>
              <ul>
                <li><strong>Amount Disbursed:</strong> XAF ${totalDisbursed.toLocaleString()}</li>
                <li><strong>Amount Spent:</strong> XAF ${spentAmount.toLocaleString()}</li>
                <li><strong>Balance Returned:</strong> XAF ${returnedAmount.toLocaleString()}</li>
                <li><strong>Documents:</strong> ${documents.length}</li>
                ${parsedBreakdown ? `<li><strong>Itemized Breakdown:</strong> ${parsedBreakdown.length} expense items</li>` : ''}
                <li><strong>Your Level:</strong> ${firstApprover.level} - ${firstApprover.approver.role}</li>
              </ul>
            </div>

            ${parsedBreakdown && parsedBreakdown.length > 0 ? `
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1890ff;">
              <p><strong>📋 Itemized Expenses:</strong></p>
              <ul>
                ${parsedBreakdown.slice(0, 5).map(item => `
                  <li>${item.description}: XAF ${parseFloat(item.amount).toLocaleString()}${item.category ? ` (${item.category})` : ''}</li>
                `).join('')}
                ${parsedBreakdown.length > 5 ? `<li><em>...and ${parsedBreakdown.length - 5} more items</em></li>` : ''}
              </ul>
            </div>
            ` : ''}

            <p>Please review and make a decision in the system.</p>
          `
        }).catch(error => {
          console.error(`Failed to send notification to ${firstApprover.approver.email}:`, error);
          return { error, type: 'approver' };
        })
      );
    }

    notifications.push(
      sendEmail({
        to: request.employee.email,
        subject: 'Justification Submitted Successfully',
        html: `
          <h3>Your Justification Has Been Submitted</h3>
          <p>Dear ${request.employee.fullName},</p>
          
          <p>Your cash justification has been submitted and is awaiting approval.</p>
          
          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ul>
              <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Amount Spent:</strong> XAF ${spentAmount.toLocaleString()}</li>
              <li><strong>Balance Returned:</strong> XAF ${returnedAmount.toLocaleString()}</li>
              <li><strong>Documents Uploaded:</strong> ${documents.length}</li>
              ${parsedBreakdown ? `<li><strong>Itemized Expenses:</strong> ${parsedBreakdown.length} items</li>` : ''}
              <li><strong>Total Approvals Required:</strong> ${request.justificationApprovalChain.length}</li>
            </ul>
          </div>

          ${parsedBreakdown && parsedBreakdown.length > 0 ? `
          <div style="background-color: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <p><em>✅ Itemized breakdown provided - this helps speed up approval!</em></p>
          </div>
          ` : ''}

          <p>You will be notified as your justification progresses through the approval chain.</p>
        `
      }).catch(error => {
        console.error('Failed to notify employee:', error);
        return { error, type: 'employee' };
      })
    );

    await Promise.allSettled(notifications);

    console.log('=== JUSTIFICATION SUBMITTED WITH APPROVAL CHAIN ===');
    res.json({
      success: true,
      message: 'Justification submitted successfully',
      data: request,
      metadata: {
        documentsUploaded: documents.length,
        hasItemizedBreakdown: !!(parsedBreakdown && parsedBreakdown.length > 0),
        itemizedExpenseCount: parsedBreakdown ? parsedBreakdown.length : 0,
        approvalChainLevels: request.justificationApprovalChain.length
      }
    });

  } catch (error) {
    console.error('Submit justification error:', error);

    // ✅ Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      console.log('Cleaning up uploaded files due to error...');
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path && fsSync.existsSync(file.path)) {
            return fs.promises.unlink(file.path).catch(e => 
              console.error('File cleanup failed:', e)
            );
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

    if (!['approved', 'rejected'].includes(decision)) {
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

    if (decision === 'approved') {
      request.status = 'justification_pending_finance';
      console.log('Justification APPROVED by supervisor - moving to finance');
    } else {
      request.status = 'justification_rejected_supervisor';
      console.log('Justification REJECTED by supervisor');
    }

    await request.save();

    // Send notifications
    const notifications = [];

    if (decision === 'approved') {
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
    console.log('Files received:', req.files?.length || 0);

    const {
      requestType,
      amountRequested,
      purpose,
      businessJustification,
      urgency,
      requiredDate,
      projectCode,
      projectId,
      itemizedBreakdown
    } = req.body;

    // Get user details
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    console.log(`Creating cash request for: ${employee.fullName} (${employee.email})`);

    // Parse itemized breakdown
    let parsedBreakdown = null;
    if (itemizedBreakdown) {
      try {
        parsedBreakdown = typeof itemizedBreakdown === 'string' 
          ? JSON.parse(itemizedBreakdown) 
          : itemizedBreakdown;

        if (Array.isArray(parsedBreakdown) && parsedBreakdown.length > 0) {
          const breakdownTotal = parsedBreakdown.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
          const discrepancy = Math.abs(breakdownTotal - parseFloat(amountRequested));

          if (discrepancy > 1) {
            return res.status(400).json({
              success: false,
              message: `Itemized breakdown total (XAF ${breakdownTotal.toFixed(2)}) must match requested amount (XAF ${parseFloat(amountRequested).toFixed(2)})`
            });
          }

          console.log(`✓ Itemized breakdown validated: ${parsedBreakdown.length} items, total XAF ${breakdownTotal.toLocaleString()}`);
        } else {
          parsedBreakdown = null;
        }
      } catch (parseError) {
        console.error('Error parsing itemized breakdown:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid itemized breakdown format'
        });
      }
    }

    // ✅ NEW: Validate and get project with budget code
    let selectedProject = null;
    let projectBudgetCode = null;

    if (projectId) {
      console.log(`\n🎯 Project ID provided: ${projectId}`);

      selectedProject = await Project.findById(projectId)
        .populate('budgetCodeId', 'code name budget used remaining');

      if (!selectedProject) {
        return res.status(404).json({
          success: false,
          message: 'Selected project not found'
        });
      }

      console.log(`✅ Project found: ${selectedProject.name} (${selectedProject.code})`);

      // Check if project has budget code
      if (selectedProject.budgetCodeId) {
        projectBudgetCode = selectedProject.budgetCodeId;
        console.log(`💰 Project has budget code: ${projectBudgetCode.code} - ${projectBudgetCode.name}`);
        console.log(`   Available: XAF ${projectBudgetCode.remaining.toLocaleString()}`);

        // Validate budget sufficiency
        if (projectBudgetCode.remaining < parseFloat(amountRequested)) {
          return res.status(400).json({
            success: false,
            message: `Insufficient budget in project. Available: XAF ${projectBudgetCode.remaining.toLocaleString()}, Requested: XAF ${parseFloat(amountRequested).toLocaleString()}`
          });
        }

        console.log('✅ Budget check passed');
      } else {
        console.log('⚠️  Project has no budget code assigned - will need manual budget assignment');
      }
    }

    // Generate approval chain
    console.log('\n📋 Generating approval chain...');
    const approvalChain = getCashRequestApprovalChain(employee.email);

    if (!approvalChain || approvalChain.length === 0) {
      console.error('❌ Failed to generate approval chain');
      return res.status(400).json({
        success: false,
        message: 'Unable to determine approval chain. Please contact HR for assistance.'
      });
    }

    console.log(`✓ Approval chain generated with ${approvalChain.length} levels`);

    // Map approval chain to proper format
    const mappedApprovalChain = mapApprovalChainForCashRequest(approvalChain);
    console.log('✓ Approval chain mapped for CashRequest schema');

    // Verify Finance Officer is final approver
    const lastApprover = approvalChain[approvalChain.length - 1];
    if (!lastApprover || lastApprover.approver.role !== 'Finance Officer') {
      console.error('❌ Finance Officer is not the final approver');
      return res.status(500).json({
        success: false,
        message: 'System error: Invalid approval chain configuration.'
      });
    }

    console.log(`✅ Finance Officer (${lastApprover.approver.name}) is final approver at Level ${lastApprover.level}`);

    // ✅ UPDATED: Process attachments using local storage
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(`\n📎 Processing ${req.files.length} attachment(s)...`);

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        try {
          console.log(`   Processing file ${i + 1}/${req.files.length}: ${file.originalname}`);

          // Save file using local storage
          const fileMetadata = await saveFile(
            file,
            STORAGE_CATEGORIES.CASH_REQUESTS,
            'attachments', // subfolder
            null // auto-generate filename
          );

          attachments.push({
            name: file.originalname,
            publicId: fileMetadata.publicId,
            url: fileMetadata.url,
            localPath: fileMetadata.localPath, // ✅ Store local path
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });

          console.log(`   ✅ Saved: ${fileMetadata.publicId}`);

        } catch (fileError) {
          console.error(`   ❌ Error processing ${file.originalname}:`, fileError);
          continue;
        }
      }

      console.log(`\n✅ ${attachments.length} attachment(s) processed successfully`);
    }

    // ✅ Create cash request with project budget integration
    console.log('\n💾 Creating CashRequest document...');
    const cashRequest = new CashRequest({
      employee: req.user.userId,
      requestMode: 'advance',
      requestType,
      amountRequested: parseFloat(amountRequested),
      purpose,
      businessJustification,
      urgency,
      requiredDate: new Date(requiredDate),
      projectCode,
      attachments,
      itemizedBreakdown: parsedBreakdown || [],
      status: 'pending_supervisor',
      approvalChain: mappedApprovalChain,

      // ✅ NEW: Project integration
      projectId: selectedProject ? selectedProject._id : null,

      // ✅ NEW: Auto-assign project budget code if available
      budgetAllocation: projectBudgetCode ? {
        budgetCodeId: projectBudgetCode._id,
        budgetCode: projectBudgetCode.code,
        allocatedAmount: parseFloat(amountRequested),
        allocationStatus: 'pending',
        assignedBy: null, 
        assignedAt: null
      } : null
    });

    console.log('Saving cash request...');
    await cashRequest.save();
    console.log(`✅ Cash request created with ID: ${cashRequest._id}`);

    // Populate employee details
    await cashRequest.populate('employee', 'fullName email department');
    if (selectedProject) {
      await cashRequest.populate('projectId', 'name code department');
    }

    // ============================================
    // FIXED: Send notifications with better error handling
    // ============================================
    console.log('\n📧 Sending notifications...');
    const notifications = [];

    // Notify first approver
    const firstApprover = approvalChain[0];
    if (firstApprover && firstApprover.approver.email) {
      console.log(`📧 Notifying first approver: ${firstApprover.approver.email}`);
      
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

    // Enhanced notification for admins (include project info)
    const admins = await User.find({ role: 'admin' }).select('email fullName');
    if (admins.length > 0) {
      console.log(`📧 Notifying ${admins.length} admin(s)`);
      
      const projectInfo = selectedProject 
        ? `<li><strong>Project:</strong> ${selectedProject.name} (${selectedProject.code})</li>
           <li><strong>Budget Code:</strong> ${projectBudgetCode ? projectBudgetCode.code : 'To be assigned'}</li>`
        : '<li><strong>Project:</strong> Not specified</li>';

      const itemizedInfo = parsedBreakdown && parsedBreakdown.length > 0
        ? `<li><strong>Itemized Breakdown:</strong> ${parsedBreakdown.length} expense items</li>`
        : '';

      const breakdownDetails = parsedBreakdown && parsedBreakdown.length > 0 ? 
        `<div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1890ff;">
          <p><strong>📋 Itemized Expenses (Top 5):</strong></p>
          <ul>
            ${parsedBreakdown.slice(0, 5).map(item => 
              `<li>${item.description}: XAF ${parseFloat(item.amount).toLocaleString()}${item.category ? ` (${item.category})` : ''}</li>`
            ).join('')}
            ${parsedBreakdown.length > 5 ? `<li><em>...and ${parsedBreakdown.length - 5} more items</em></li>` : ''}
          </ul>
        </div>` : '';

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
                <li><strong>Employee:</strong> ${employee.fullName} (${employee.department})</li>
                <li><strong>Amount:</strong> XAF ${parseFloat(amountRequested).toLocaleString()}</li>
                <li><strong>Type:</strong> ${requestType}</li>
                <li><strong>Urgency:</strong> ${urgency}</li>
                ${projectInfo}
                ${itemizedInfo}
                ${attachments.length > 0 ? `<li><strong>Attachments:</strong> ${attachments.length} file(s)</li>` : ''}
                <li><strong>Approval Levels:</strong> ${approvalChain.length}</li>
              </ul>
            </div>

            ${breakdownDetails}
          `
        }).catch(error => {
          console.error('Failed to send admin notification:', error);
          return { error, type: 'admin' };
        })
      );
    }

    // Wait for ALL notifications with better error handling
    console.log(`📧 Sending ${notifications.length} notification(s)...`);
    const notificationResults = await Promise.allSettled(notifications);

    // Log notification results
    let successCount = 0;
    let failureCount = 0;

    notificationResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value && !result.value.error) {
          successCount++;
          console.log(`✅ Notification ${index + 1} sent successfully`);
        } else {
          failureCount++;
          console.error(`❌ Notification ${index + 1} failed:`, result.value?.error);
        }
      } else {
        failureCount++;
        console.error(`❌ Notification ${index + 1} rejected:`, result.reason);
      }
    });

    console.log(`📧 Notification summary: ${successCount} succeeded, ${failureCount} failed`);

    console.log('\n=== REQUEST CREATED SUCCESSFULLY ===');
    console.log(`Request ID: ${cashRequest._id}`);
    console.log(`Attachments: ${attachments.length}`);
    if (parsedBreakdown) {
      console.log(`Itemized Breakdown: ${parsedBreakdown.length} items`);
    }
    if (selectedProject) {
      console.log(`Project: ${selectedProject.name}`);
      console.log(`Budget Code: ${projectBudgetCode ? projectBudgetCode.code : 'None'}`);
    }
    console.log('=====================================\n');

    res.status(201).json({
      success: true,
      message: 'Cash request created successfully',
      data: cashRequest,
      metadata: {
        attachmentsUploaded: attachments.length,
        hasItemizedBreakdown: !!(parsedBreakdown && parsedBreakdown.length > 0),
        itemizedExpenseCount: parsedBreakdown ? parsedBreakdown.length : 0,
        approvalLevels: approvalChain.length,
        finalApprover: lastApprover.approver.name,
        projectBudgetAssigned: !!projectBudgetCode,
        notificationsSent: successCount,
        notificationsFailed: failureCount
      }
    });

  } catch (error) {
    console.error('❌ Create cash request error:', error);
    console.error('Stack trace:', error.stack);

    // ✅ UPDATED: Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      console.log('Cleaning up uploaded files due to error...');
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path && fsSync.existsSync(file.path)) {
            return fs.promises.unlink(file.path).catch(e => 
              console.error('File cleanup failed:', e.message)
            );
          }
        })
      );
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create cash request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
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

    // Handle approval - determine next status based on current level with enhanced logging
    let nextStatus;
    let nextApproverLevel = currentStep.level + 1;
    
    console.log(`\n🔄 APPROVAL TRANSITION:`);
    console.log(`  Current level: ${currentStep.level} (${currentStep.approver.role})`);
    console.log(`  Next level would be: ${nextApproverLevel}`);
    console.log(`  Total approval levels: ${request.approvalChain.length}`);
    
    switch (currentStep.level) {
      case 1: // Supervisor approval
        nextStatus = 'pending_departmental_head';
        console.log(`  ✅ Level 1 approved → ${nextStatus}`);
        break;
      case 2: // Departmental head approval  
        nextStatus = 'pending_head_of_business';
        console.log(`  ✅ Level 2 approved → ${nextStatus}`);
        break;
      case 3: // Head of business approval
        nextStatus = 'pending_finance';
        console.log(`  ✅ Level 3 approved → ${nextStatus}`);
        break;
      case 4: // Finance approval
        nextStatus = 'approved';
        console.log(`  ✅ Level 4 (Finance) approved → ${nextStatus}`);
        
        if (amountApproved) {
          request.amountApproved = parseFloat(amountApproved);
          console.log(`  💰 Amount approved: XAF ${parseFloat(amountApproved).toLocaleString()}`);
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
          console.log(`  💵 Disbursed: XAF ${disbursedAmount.toLocaleString()}`);
        }
        break;
      default:
        nextStatus = 'approved';
        console.log(`  ⚠️ Unknown level ${currentStep.level} → defaulting to approved`);
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

// Get team requests for supervisor/admin with filtering
const getSupervisorRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('=== GET SUPERVISOR/TEAM REQUESTS ===');
    console.log(`User: ${user.fullName} (${user.email}) - Role: ${user.role}`);
    
    // Get query parameters for filtering
    const { status, department, showAll = 'false' } = req.query;
    
    let baseQuery = {
      // Show all requests where current user is in the approval chain (regardless of status)
      'approvalChain': {
        $elemMatch: {
          'approver.email': user.email
        }
      }
    };
    
    // Apply status filter if provided
    if (status && status !== 'all') {
      if (status === 'pending') {
        // Show only requests pending for this user
        baseQuery['approvalChain.$elemMatch.status'] = 'pending';
        baseQuery.status = { $regex: /pending/ };
      } else if (status === 'approved') {
        // Show requests this user has approved
        baseQuery = {
          $or: [
            {
              'approvalChain': {
                $elemMatch: {
                  'approver.email': user.email,
                  'status': 'approved'
                }
              }
            },
            { status: { $in: ['approved', 'disbursed', 'completed'] } }
          ]
        };
      } else if (status === 'denied') {
        baseQuery.status = 'denied';
      } else {
        baseQuery.status = status;
      }
    }
    
    // Apply department filter if provided
    if (department && department !== 'all') {
      // Find users in the specified department
      const departmentUsers = await User.find({ department }).select('_id');
      baseQuery.employee = { $in: departmentUsers.map(u => u._id) };
    }
    
    console.log('Query filter:', JSON.stringify(baseQuery, null, 2));
    
    const requests = await CashRequest.find(baseQuery)
      .populate('employee', 'fullName email department position')
      .populate({
        path: 'approvalChain.decidedBy',
        select: 'fullName email',
        options: { strictPopulate: false }
      })
      .sort({ createdAt: -1 });
    
    console.log(`Found ${requests.length} team requests`);
    
    // Helper function to check if all previous levels are approved (reused)
    const isPreviousLevelApproved = (request, currentLevel) => {
      const previousLevels = request.approvalChain.filter(step => step.level < currentLevel);
      return previousLevels.length === 0 || previousLevels.every(step => step.status === 'approved');
    };
    
    // Filter requests to ensure proper approval hierarchy
    const validRequests = requests.filter(req => {
      const userSteps = req.approvalChain.filter(step => 
        step.approver.email === user.email
      );
      
      // If user has no steps in this request, they shouldn't see it unless it's for general visibility
      if (userSteps.length === 0) {
        return false;
      }
      
      // Check each user step to ensure hierarchy is followed
      const pendingUserSteps = userSteps.filter(step => step.status === 'pending');
      
      for (const step of pendingUserSteps) {
        const allPreviousApproved = isPreviousLevelApproved(req, step.level);
        if (!allPreviousApproved) {
          console.log(`❌ Filtering out request ${req._id}: Previous levels not all approved for Level ${step.level}`);
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`Valid requests after hierarchy check: ${validRequests.length}`);
    
    // Add additional metadata for each request
    const enrichedRequests = validRequests.map(request => {
      const userSteps = request.approvalChain.filter(step => 
        step.approver.email === user.email
      );
      
      const currentUserPendingSteps = userSteps.filter(step => step.status === 'pending');
      const currentUserApprovedSteps = userSteps.filter(step => step.status === 'approved');
      const currentUserRejectedSteps = userSteps.filter(step => step.status === 'rejected');
      
      return {
        ...request.toObject(),
        teamRequestMetadata: {
          userHasPendingApproval: currentUserPendingSteps.length > 0,
          userHasApproved: currentUserApprovedSteps.length > 0,
          userHasRejected: currentUserRejectedSteps.length > 0,
          userApprovalLevels: userSteps.map(s => s.level),
          pendingLevels: currentUserPendingSteps.map(s => s.level),
          approvedLevels: currentUserApprovedSteps.map(s => s.level)
        }
      };
    });
    
    // Generate statistics
    const stats = {
      total: enrichedRequests.length,
      pending: enrichedRequests.filter(r => r.teamRequestMetadata.userHasPendingApproval).length,
      approved: enrichedRequests.filter(r => r.teamRequestMetadata.userHasApproved).length,
      byStatus: {
        pending_supervisor: enrichedRequests.filter(r => r.status === 'pending_supervisor').length,
        pending_finance: enrichedRequests.filter(r => r.status === 'pending_finance').length,
        approved: enrichedRequests.filter(r => r.status === 'approved').length,
        disbursed: enrichedRequests.filter(r => r.status === 'disbursed').length,
        completed: enrichedRequests.filter(r => r.status === 'completed').length,
        denied: enrichedRequests.filter(r => r.status === 'denied').length
      }
    };
    
    console.log('Team requests stats:', stats);

    res.json({
      success: true,
      data: enrichedRequests,
      count: enrichedRequests.length,
      stats,
      userInfo: {
        name: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department
      },
      filters: {
        status: status || 'all',
        department: department || 'all',
        showAll: showAll === 'true'
      }
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

    console.log(`Current request status: ${request.status}`);
    console.log(`Approval chain levels: ${request.approvalChain.length}`);

    // Find ALL pending steps for this user
    const userPendingSteps = request.approvalChain
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => 
        step.approver.email === user.email && step.status === 'pending'
      );

    if (userPendingSteps.length === 0) {
      console.log('❌ No pending approvals found for this user');
      return res.status(403).json({
        success: false,
        message: 'You do not have any pending approvals for this request'
      });
    }

    console.log(`✓ Found ${userPendingSteps.length} pending step(s) for this user`);
    userPendingSteps.forEach(({ step }) => {
      console.log(`  - Level ${step.level}: ${step.approver.role}`);
    });

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
      console.log(`Highest level approved by user: ${highestApprovedLevel}`);

      // Check if this was Finance approval (final step)
      const isFinanceApproval = userPendingSteps.some(({ step }) => 
        step.approver.role === 'Finance Officer'
      );

      if (isFinanceApproval) {
        console.log('✅ FINANCE APPROVAL COMPLETED - This is the final step');
        
        // All approvals complete
        request.status = 'approved';
        
        // Set approved amount
        if (req.body.amountApproved) {
          request.amountApproved = parseFloat(req.body.amountApproved);
          console.log(`💰 Amount approved: XAF ${request.amountApproved.toLocaleString()}`);
        }
        
        // Handle disbursement if provided
        if (req.body.disbursementAmount) {
          const disbursedAmount = parseFloat(req.body.disbursementAmount);
          request.status = 'disbursed';
          request.disbursementDetails = {
            date: new Date(),
            amount: disbursedAmount,
            disbursedBy: req.user.userId
          };
          console.log(`💵 Request DISBURSED: XAF ${disbursedAmount.toLocaleString()}`);
        }

        await request.save();

        // Notify employee of completion
        try {
          await sendEmail({
            to: request.employee.email,
            subject: request.status === 'disbursed' ? 
              '✅ Cash Request Approved and Disbursed' : 
              '✅ Cash Request Fully Approved',
            html: `
              <h3>${request.status === 'disbursed' ? 
                'Your Cash Request Has Been Approved and Disbursed! 🎉' : 
                'Your Cash Request Has Been Fully Approved! 🎉'}</h3>
              <p>Dear ${request.employee.fullName},</p>
              
              <p>Great news! Your cash request has been fully approved by all authorities${request.status === 'disbursed' ? ' and the funds have been disbursed' : ''}.</p>
              
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
                <p><strong>Approval Summary:</strong></p>
                <ul>
                  <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                  <li><strong>Amount Approved:</strong> XAF ${(request.amountApproved || request.amountRequested).toLocaleString()}</li>
                  ${request.status === 'disbursed' ? 
                    `<li><strong>Amount Disbursed:</strong> XAF ${request.disbursementDetails.amount.toLocaleString()}</li>` : 
                    ''}
                  <li><strong>Final Approver:</strong> ${user.fullName} (Finance Officer)</li>
                  <li><strong>Status:</strong> ${request.status === 'disbursed' ? 'DISBURSED' : 'APPROVED'}</li>
                  <li><strong>All Approvals:</strong> ${request.approvalChain.length} levels completed ✅</li>
                </ul>
              </div>

              ${request.status === 'disbursed' ? 
                `<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
                  <p><strong>⚠️ Important Next Step:</strong></p>
                  <p>Please submit your justification with receipts within the required timeframe.</p>
                </div>` : 
                `<p><strong>Next Step:</strong> Please wait for disbursement processing by the Finance team.</p>`
              }

              <p>Thank you for following the proper approval process!</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send completion email:', emailError);
        }

        console.log('=== APPROVAL PROCESS COMPLETED ===\n');
        return res.json({
          success: true,
          message: `Request fully approved by Finance${request.status === 'disbursed' ? ' and disbursed' : ''}`,
          data: request,
          nextStatus: request.status
        });
      }

      // Not Finance - find next pending step from a DIFFERENT user
      const nextPendingStep = request.approvalChain.find(step => 
        step.level > highestApprovedLevel && 
        step.status === 'pending' &&
        step.approver.email !== user.email
      );

      if (nextPendingStep) {
        console.log(`Next approver: Level ${nextPendingStep.level} - ${nextPendingStep.approver.name} (${nextPendingStep.approver.role})`);
        
        // CRITICAL FIX: Determine status based on next approver's role
        let nextStatus;
        
        if (nextPendingStep.approver.role === 'Finance Officer') {
          nextStatus = 'pending_finance';
          console.log(`✅ Moving to Finance approval → ${nextStatus}`);
        } else {
          // Map status based on level
          const statusMap = {
            1: 'pending_supervisor',
            2: 'pending_departmental_head',
            3: 'pending_head_of_business',
            4: 'pending_finance'
          };
          
          nextStatus = statusMap[nextPendingStep.level] || 'pending_finance';
          console.log(`✅ Level ${highestApprovedLevel} approved → ${nextStatus}`);
        }
        
        request.status = nextStatus;
        nextPendingStep.assignedDate = new Date();
        
        await request.save();

        // Send notification to next approver
        try {
          console.log(`📧 Sending notification to ${nextPendingStep.approver.email}`);
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
          console.log('✅ Next approver notified successfully');
        } catch (emailError) {
          console.error('❌ Failed to notify next approver:', emailError);
        }

        // Notify employee of progress
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

        console.log('=== APPROVAL PROCESSED - MOVED TO NEXT LEVEL ===\n');
        return res.json({
          success: true,
          message: `Request approved at level(s) ${userPendingSteps.map(s => s.step.level).join(', ')}`,
          data: request,
          nextApprover: {
            name: nextPendingStep.approver.name,
            role: nextPendingStep.approver.role,
            level: nextPendingStep.level
          },
          nextStatus: nextStatus
        });

      } else {
        // No next different approver found
        console.log('⚠️ No more different approvers found');
        
        // Check if ALL levels are approved
        const allApproved = request.approvalChain.every(s => s.status === 'approved');
        
        if (allApproved) {
          console.log('✅ All approvals completed - Request FULLY APPROVED');
          request.status = 'approved';
        } else {
          // Should not happen, but default to pending_finance
          console.log('⚠️ Not all approved but no next approver - defaulting to pending_finance');
          request.status = 'pending_finance';
        }

        await request.save();

        // Notify employee
        try {
          await sendEmail({
            to: request.employee.email,
            subject: '✅ Cash Request Fully Approved',
            html: `
              <h3>Your Cash Request Has Been Fully Approved! 🎉</h3>
              <p>Dear ${request.employee.fullName},</p>
              
              <p>Great news! Your cash request has been approved by all required authorities.</p>
              
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <ul>
                  <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                  <li><strong>Amount:</strong> XAF ${parseFloat(request.amountRequested).toLocaleString()}</li>
                  <li><strong>Status:</strong> ${request.status.replace(/_/g, ' ').toUpperCase()}</li>
                  <li><strong>All Approvals:</strong> ${request.approvalChain.length} levels completed ✅</li>
                </ul>
              </div>
            `
          });
        } catch (emailError) {
          console.error('Failed to send completion email:', emailError);
        }

        console.log('=== APPROVAL COMPLETED ===\n');
        return res.json({
          success: true,
          message: 'Request fully approved',
          data: request
        });
      }

    } else {
      // Handle rejection - deny at first pending level only
      const firstPendingStep = userPendingSteps[0];
      
      console.log(`❌ Denying request at Level ${firstPendingStep.step.level}`);
      
      request.status = 'denied';
      request.approvalChain[firstPendingStep.index].status = 'rejected';
      request.approvalChain[firstPendingStep.index].comments = comments;
      request.approvalChain[firstPendingStep.index].actionDate = new Date();
      request.approvalChain[firstPendingStep.index].actionTime = new Date().toLocaleTimeString('en-GB');
      request.approvalChain[firstPendingStep.index].decidedBy = req.user.userId;

      await request.save();

      // Notify employee of denial
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
    console.error('❌ Process approval decision error:', error);
    console.error('Stack trace:', error.stack);
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


const processJustificationDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, comments } = req.body;

    console.log('=== JUSTIFICATION DECISION PROCESSING ===');
    console.log('Request ID:', requestId);
    console.log('Decision:', decision);
    console.log('User:', req.user.userId);

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be "approved" or "rejected"'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email')
      .populate('justificationApprovalChain.decidedBy', 'fullName email')
      .populate('budgetAllocation.budgetCodeId', 'code name budget remaining');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if justification approval chain exists
    if (!request.justificationApprovalChain || request.justificationApprovalChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No justification approval chain found'
      });
    }

    console.log(`Current Status: ${request.status}`);
    console.log(`User Email: ${user.email}`);
    console.log(`Justification Approval Chain Levels: ${request.justificationApprovalChain.length}`);

    // Find ALL pending steps for this user (multi-role support)
    const userPendingSteps = request.justificationApprovalChain
      .map((step, index) => ({ step, index }))
      .filter(({ step }) =>
        step.approver.email.toLowerCase() === user.email.toLowerCase() && 
        step.status === 'pending'
      );

    if (userPendingSteps.length === 0) {
      console.log('No pending justification approval found for this user');
      return res.status(403).json({
        success: false,
        message: 'You do not have a pending justification approval',
        yourEmail: user.email
      });
    }

    console.log(`✓ Found ${userPendingSteps.length} pending step(s) for this user`);

    // Get the LOWEST level this user has pending (should be current status level)
    const lowestPendingLevel = Math.min(...userPendingSteps.map(({ step }) => step.level));
    
    // Verify this user is at the CURRENT status level
    const statusMap = {
      1: 'justification_pending_supervisor',
      2: 'justification_pending_departmental_head',
      3: 'justification_pending_head_of_business',
      4: 'justification_pending_finance'
    };

    const expectedStatus = statusMap[lowestPendingLevel];
    if (request.status !== expectedStatus) {
      return res.status(400).json({
        success: false,
        message: `This justification is not at your approval level. Current status: ${request.status}, Expected: ${expectedStatus}`
      });
    }

    console.log(`✓ User is authorized at Level ${lowestPendingLevel} (and ${userPendingSteps.length - 1} additional level(s))`);

    if (decision === 'approved') {
      // ============================================
      // APPROVAL PATH
      // ============================================
      
      // Approve ALL pending steps for this user (multi-role handling)
      const approvedLevels = [];
      
      userPendingSteps.forEach(({ step, index }) => {
        console.log(`  Approving Level ${step.level}: ${step.approver.role}`);
        request.justificationApprovalChain[index].status = 'approved';
        request.justificationApprovalChain[index].comments = comments;
        request.justificationApprovalChain[index].actionDate = new Date();
        request.justificationApprovalChain[index].actionTime = new Date().toLocaleTimeString('en-GB');
        request.justificationApprovalChain[index].decidedBy = req.user.userId;
        approvedLevels.push(step.level);
      });

      const highestApprovedLevel = Math.max(...approvedLevels);
      console.log(`Approved levels: ${approvedLevels.join(', ')} (highest: ${highestApprovedLevel})`);

      // Find next pending step that belongs to a DIFFERENT user
      const nextPendingStep = request.justificationApprovalChain.find(step => 
        step.level > highestApprovedLevel && 
        step.status === 'pending' &&
        step.approver.email.toLowerCase() !== user.email.toLowerCase()
      );

      let nextStatus;

      if (nextPendingStep) {
        // ============================================
        // MOVE TO NEXT APPROVAL LEVEL
        // ============================================
        nextStatus = statusMap[nextPendingStep.level];
        nextPendingStep.assignedDate = new Date();
        
        console.log(`Next approver: Level ${nextPendingStep.level} - ${nextPendingStep.approver.name} (${nextPendingStep.approver.role})`);

        request.status = nextStatus;
        await request.save();

        // Send notification to next approver
        await sendEmail({
          to: nextPendingStep.approver.email,
          subject: `Justification Requires Your Approval - ${request.employee.fullName}`,
          html: `
            <h3>Cash Justification Requires Your Approval</h3>
            <p>Dear ${nextPendingStep.approver.name},</p>

            <p>A cash justification has been approved by <strong>${user.fullName}</strong> ${userPendingSteps.length > 1 ? `(Levels ${approvedLevels.join(', ')})` : `(Level ${lowestPendingLevel})`} and requires your review.</p>

            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #17a2b8;">
              <p><strong>Justification Details:</strong></p>
              <ul>
                <li><strong>Employee:</strong> ${request.employee.fullName}</li>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Amount Disbursed:</strong> XAF ${(request.disbursementDetails?.amount || 0).toLocaleString()}</li>
                <li><strong>Amount Spent:</strong> XAF ${(request.justification?.amountSpent || 0).toLocaleString()}</li>
                <li><strong>Balance Returned:</strong> XAF ${(request.justification?.balanceReturned || 0).toLocaleString()}</li>
                <li><strong>Your Level:</strong> ${nextPendingStep.level} - ${nextPendingStep.approver.role}</li>
                <li><strong>Progress:</strong> Levels ${approvedLevels.join(', ')} completed</li>
              </ul>
            </div>

            <p>Please review and make a decision in the system.</p>
          `
        }).catch(err => console.error('Failed to notify next approver:', err));

        // Notify employee of progress
        await sendEmail({
          to: request.employee.email,
          subject: `Justification Progress Update - Level${approvedLevels.length > 1 ? 's' : ''} ${approvedLevels.join(', ')} Approved`,
          html: `
            <h3>Your Justification is Progressing</h3>
            <p>Dear ${request.employee.fullName},</p>

            <p>Your cash justification has been approved by <strong>${user.fullName}</strong> ${userPendingSteps.length > 1 ? `at multiple levels (${approvedLevels.join(', ')})` : `at Level ${lowestPendingLevel}`}.</p>

            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Levels Completed:</strong> ${approvedLevels.join(', ')} of ${request.justificationApprovalChain.length}</li>
                <li><strong>Next Approver:</strong> ${nextPendingStep.approver.name} (${nextPendingStep.approver.role})</li>
                <li><strong>Current Status:</strong> Level ${nextPendingStep.level} - Pending ${nextPendingStep.approver.role}</li>
              </ul>
            </div>

            <p>You will be notified once the justification is fully approved.</p>
          `
        }).catch(err => console.error('Failed to notify employee:', err));

        console.log(`✅ Moved to next approval level: ${nextStatus}`);

      } else {
        // ============================================
        // ALL APPROVALS COMPLETED
        // ============================================
        
        // Check if ALL levels are now approved
        const allApproved = request.justificationApprovalChain.every(s => s.status === 'approved');
        
        if (allApproved) {
          nextStatus = 'completed';
          console.log('✅ All justification approvals completed - Request COMPLETED');

          // ============================================
          // PHASE 3: RETURN UNUSED FUNDS TO BUDGET
          // ============================================
          if (request.budgetAllocation && request.budgetAllocation.budgetCodeId) {
            const balanceReturned = request.justification?.balanceReturned || 0;
            
            console.log(`\n💵 Processing budget return:`);
            console.log(`   Budget Code: ${request.budgetAllocation.budgetCode}`);
            console.log(`   Amount Spent: XAF ${(request.justification?.amountSpent || 0).toLocaleString()}`);
            console.log(`   Balance to Return: XAF ${balanceReturned.toLocaleString()}`);
            
            if (balanceReturned > 0) {
              try {
                const budgetCode = await BudgetCode.findById(request.budgetAllocation.budgetCodeId);
                
                if (budgetCode) {
                  console.log(`   Current budget used: XAF ${budgetCode.used.toLocaleString()}`);
                  console.log(`   Current budget remaining: XAF ${budgetCode.remaining.toLocaleString()}`);
                  
                  await budgetCode.returnUnusedFunds(request._id, balanceReturned);
                  
                  // Update request allocation info
                  request.budgetAllocation.balanceReturned = balanceReturned;
                  request.budgetAllocation.actualSpent = request.justification.amountSpent;
                  
                  console.log(`   ✅ Returned XAF ${balanceReturned.toLocaleString()} to budget ${budgetCode.code}`);
                  console.log(`   New budget used: XAF ${budgetCode.used.toLocaleString()}`);
                  console.log(`   New budget remaining: XAF ${budgetCode.remaining.toLocaleString()}\n`);
                } else {
                  console.warn('   ⚠️  Budget code not found - cannot return funds');
                }
              } catch (returnError) {
                console.error('❌ Failed to return funds to budget:', returnError);
                // Don't fail the entire operation - funds can be manually adjusted
              }
            } else {
              console.log(`   ℹ️  No balance to return (fully spent)\n`);
            }
          }

          request.status = nextStatus;
          await request.save();

          // ============================================
          // FINAL COMPLETION NOTIFICATION
          // ============================================
          
          const finalBudgetInfo = request.budgetAllocation ? `
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1890ff;">
              <p><strong>💰 Budget Summary:</strong></p>
              <ul>
                <li><strong>Budget Code:</strong> ${request.budgetAllocation.budgetCode}</li>
                <li><strong>Disbursed:</strong> XAF ${(request.disbursementDetails?.amount || 0).toLocaleString()}</li>
                <li><strong>Actually Spent:</strong> XAF ${(request.justification?.amountSpent || 0).toLocaleString()}</li>
                <li><strong>Returned to Budget:</strong> XAF ${(request.justification?.balanceReturned || 0).toLocaleString()} ✅</li>
                ${request.justification?.balanceReturned > 0 ? '<li><em>💡 Unused funds have been returned to the budget pool</em></li>' : ''}
              </ul>
            </div>
          ` : '';

          await sendEmail({
            to: request.employee.email,
            subject: '🎉 Cash Justification Completed Successfully!',
            html: `
              <h3>Your Justification Has Been Completed! 🎉</h3>
              <p>Dear ${request.employee.fullName},</p>

              <p>Congratulations! Your cash justification has been approved by all required authorities.</p>

              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
                <p><strong>Final Summary:</strong></p>
                <ul>
                  <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                  <li><strong>Amount Disbursed:</strong> XAF ${(request.disbursementDetails?.amount || 0).toLocaleString()}</li>
                  <li><strong>Amount Spent:</strong> XAF ${(request.justification?.amountSpent || 0).toLocaleString()}</li>
                  <li><strong>Balance Returned:</strong> XAF ${(request.justification?.balanceReturned || 0).toLocaleString()}</li>
                  <li><strong>All Approvals:</strong> ${request.justificationApprovalChain.length} levels completed ✅</li>
                  <li><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">COMPLETED</span></li>
                </ul>
              </div>

              ${finalBudgetInfo}

              <p>This request is now closed. Thank you for your compliance with the cash justification process!</p>
              
              ${request.justification?.balanceReturned > 0 ? 
                '<p style="background-color: #d1ecf1; padding: 10px; border-radius: 5px;"><em>💡 Note: The unused funds (XAF ' + 
                (request.justification.balanceReturned).toLocaleString() + 
                ') have been automatically returned to the budget pool and are now available for other requests.</em></p>' 
                : ''
              }
            `
          }).catch(err => console.error('Failed to notify employee:', err));

          console.log('✅ Justification completed - funds returned to budget');

        } else {
          // Shouldn't happen, but fallback
          console.log('⚠️ Warning: No next approver found but not all approved');
          nextStatus = 'completed';
          request.status = nextStatus;
          await request.save();
        }
      }

      console.log('=== JUSTIFICATION APPROVED ===');
      
      return res.json({
        success: true,
        message: decision === 'approved' 
          ? `Justification approved at level${approvedLevels.length > 1 ? 's' : ''} ${approvedLevels.join(', ')}`
          : `Justification rejected at level ${lowestPendingLevel}`,
        data: request,
        nextStatus: nextStatus,
        approvalProgress: {
          levelsProcessed: approvedLevels,
          totalLevels: request.justificationApprovalChain.length,
          completed: request.justificationApprovalChain.filter(s => s.status === 'approved').length
        },
        budgetReturned: nextStatus === 'completed' && request.budgetAllocation ? {
          budgetCode: request.budgetAllocation.budgetCode,
          balanceReturned: request.justification?.balanceReturned || 0,
          actualSpent: request.justification?.amountSpent || 0
        } : null
      });

    } else {
      // ============================================
      // REJECTION PATH
      // ============================================
      
      // Set specific rejection status based on lowest level
      const rejectionStatusMap = {
        1: 'justification_rejected_supervisor',
        2: 'justification_rejected_departmental_head',
        3: 'justification_rejected_head_of_business',
        4: 'justification_rejected_finance'
      };

      request.status = rejectionStatusMap[lowestPendingLevel] || 'disbursed';
      
      // Only reject the FIRST pending step (don't reject all user's levels)
      const firstPendingIndex = userPendingSteps[0].index;
      request.justificationApprovalChain[firstPendingIndex].status = 'rejected';
      request.justificationApprovalChain[firstPendingIndex].comments = comments;
      request.justificationApprovalChain[firstPendingIndex].actionDate = new Date();
      request.justificationApprovalChain[firstPendingIndex].actionTime = new Date().toLocaleTimeString('en-GB');
      request.justificationApprovalChain[firstPendingIndex].decidedBy = req.user.userId;

      await request.save();

      console.log(`❌ Justification rejected by ${user.fullName} at level ${lowestPendingLevel}`);

      // Notify employee to resubmit
      await sendEmail({
        to: request.employee.email,
        subject: '⚠️ Your Justification Requires Revision',
        html: `
          <h3>Justification Requires Revision</h3>
          <p>Dear ${request.employee.fullName},</p>

          <p>Your cash justification has been reviewed and requires revision.</p>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <p><strong>Review Details:</strong></p>
            <ul>
              <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Reviewed by:</strong> ${user.fullName} (${userPendingSteps[0].step.approver.role})</li>
              <li><strong>Rejected at:</strong> Level ${lowestPendingLevel} of ${request.justificationApprovalChain.length}</li>
            </ul>
          </div>

          ${comments ? `
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
            <p><strong>Required Changes:</strong></p>
            <p style="font-style: italic; white-space: pre-wrap;">${comments}</p>
          </div>
          ` : ''}

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Review the feedback carefully</li>
            <li>Gather any additional documentation needed</li>
            <li>Contact ${user.fullName} if you need clarification</li>
            <li>Resubmit your justification with the requested changes</li>
          </ol>

          <p>Please address the concerns and resubmit your justification.</p>
        `
      }).catch(err => console.error('Failed to notify employee of rejection:', err));

      console.log('=== JUSTIFICATION REJECTED ===');
      
      return res.json({
        success: true,
        message: `Justification rejected at level ${lowestPendingLevel}`,
        data: request,
        nextStatus: request.status
      });
    }

  } catch (error) {
    console.error('Process justification decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process justification decision',
      error: error.message
    });
  }
};

const generateCashRequestPDF = async (req, res) => {
  try {
    const { requestId } = req.params;
    const user = await User.findById(req.user.userId);

    console.log('=== GENERATE CASH REQUEST PDF ===');
    console.log('Request ID:', requestId);
    console.log('Requested by:', user.email);

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department position')
      .populate('approvalChain.decidedBy', 'fullName email')
      .populate('projectId', 'name code')
      .populate('budgetAllocation.budgetCodeId', 'code name budget remaining')
      .populate('disbursementDetails.disbursedBy', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Cash request not found'
      });
    }

    // Verify user has access
    const hasAccess = 
      request.employee._id.equals(req.user.userId) ||
      request.approvalChain.some(step => step.approver.email === user.email) ||
      user.role === 'admin' ||
      user.role === 'finance';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this request.'
      });
    }

    // Verify request is disbursed or completed
    if (request.status !== 'disbursed' && request.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'PDF can only be generated for disbursed or completed requests',
        currentStatus: request.status
      });
    }

    // Generate PDF
    const PDFService = require('../services/pdfService');
    const pdfResult = await PDFService.generateCashRequestPDF(
      request.toObject(),
      null
    );

    if (!pdfResult.success) {
      throw new Error('PDF generation failed');
    }

    // Save download audit trail
    if (!request.pdfDownloadHistory) {
      request.pdfDownloadHistory = [];
    }

    request.pdfDownloadHistory.push({
      downloadedBy: req.user.userId,
      downloadedAt: new Date(),
      filename: pdfResult.filename
    });

    await request.save();
    console.log('✓ PDF download audit saved');

    // Send PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
    res.send(pdfResult.buffer);

    console.log(`✓ PDF generated and sent: ${pdfResult.filename}`);

  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
};


// Helper function to save download audit
const savePDFDownloadAudit = async (requestId, userId, filename) => {
  try {
    const request = await CashRequest.findById(requestId);
    if (!request) return;

    if (!request.pdfDownloadHistory) {
      request.pdfDownloadHistory = [];
    }

    request.pdfDownloadHistory.push({
      downloadedBy: userId,
      downloadedAt: new Date(),
      filename: filename
    });

    await request.save();
    console.log('✓ PDF download audit saved');
  } catch (error) {
    console.error('Failed to save PDF download audit:', error);
    // Don't throw - this is non-critical
  }
};


// const createReimbursementRequest = async (req, res) => {
//   try {
//     console.log('=== CREATE REIMBURSEMENT REQUEST ===');
//     console.log('Request body:', JSON.stringify(req.body, null, 2));
//     console.log('Files received:', req.files?.length || 0);

//     const {
//       requestType,
//       amountRequested,
//       purpose,
//       businessJustification,
//       urgency,
//       requiredDate,
//       itemizedBreakdown
//     } = req.body;

//     // STEP 1: Validate user
//     const employee = await User.findById(req.user.userId);
//     if (!employee) {
//       return res.status(404).json({ 
//         success: false, 
//         message: 'Employee not found' 
//       });
//     }

//     console.log(`Creating reimbursement request for: ${employee.fullName}`);

//     // STEP 2: Check monthly reimbursement limit
//     const CashRequest = require('../models/CashRequest');
//     const limitCheck = await CashRequest.checkMonthlyReimbursementLimit(req.user.userId);
    
//     if (!limitCheck.canSubmit) {
//       return res.status(400).json({
//         success: false,
//         message: `Monthly reimbursement limit reached. You have submitted ${limitCheck.count} reimbursement requests this month (limit: 5)`,
//         limitInfo: limitCheck
//       });
//     }

//     console.log(`✓ Monthly limit check passed: ${limitCheck.count}/5 used, ${limitCheck.remaining} remaining`);

//     // STEP 3: Validate amount
//     const amount = parseFloat(amountRequested);
//     if (isNaN(amount) || amount <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please enter a valid amount greater than 0'
//       });
//     }

//     if (amount > 100000) {
//       return res.status(400).json({
//         success: false,
//         message: 'Reimbursement amount cannot exceed XAF 100,000'
//       });
//     }

//     console.log(`✓ Amount validated: XAF ${amount.toLocaleString()}`);

//     // STEP 4: Validate required fields
//     if (!purpose || purpose.trim().length < 10) {
//       return res.status(400).json({
//         success: false,
//         message: 'Purpose must be at least 10 characters long'
//       });
//     }

//     if (!businessJustification || businessJustification.trim().length < 20) {
//       return res.status(400).json({
//         success: false,
//         message: 'Business justification must be at least 20 characters long'
//       });
//     }

//     console.log('✓ Required text fields validated');

//     // STEP 5: Validate itemized breakdown
//     let parsedBreakdown = [];
//     try {
//       if (!itemizedBreakdown) {
//         throw new Error('Itemized breakdown is required');
//       }

//       parsedBreakdown = typeof itemizedBreakdown === 'string' 
//         ? JSON.parse(itemizedBreakdown) 
//         : itemizedBreakdown;
      
//       console.log('Parsed breakdown:', parsedBreakdown);
//     } catch (error) {
//       console.error('Breakdown parsing error:', error);
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid itemized breakdown format. Please ensure all expenses are properly detailed.',
//         error: error.message
//       });
//     }

//     if (!Array.isArray(parsedBreakdown) || parsedBreakdown.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'At least one itemized expense is required for reimbursement'
//       });
//     }

//     // Validate each breakdown item
//     for (let i = 0; i < parsedBreakdown.length; i++) {
//       const item = parsedBreakdown[i];
//       if (!item.description || !item.amount) {
//         return res.status(400).json({
//           success: false,
//           message: `Expense item ${i + 1} is missing description or amount`
//         });
//       }
//       if (parseFloat(item.amount) <= 0) {
//         return res.status(400).json({
//           success: false,
//           message: `Expense item ${i + 1} must have an amount greater than 0`
//         });
//       }
//     }

//     // Validate total matches breakdown
//     const breakdownTotal = parsedBreakdown.reduce((sum, item) => 
//       sum + parseFloat(item.amount || 0), 0
//     );
    
//     const discrepancy = Math.abs(breakdownTotal - amount);
//     if (discrepancy > 0.01) {
//       return res.status(400).json({
//         success: false,
//         message: `Itemized breakdown total (XAF ${breakdownTotal.toFixed(2)}) must match reimbursement amount (XAF ${amount.toFixed(2)}). Difference: XAF ${discrepancy.toFixed(2)}`
//       });
//     }

//     console.log(`✓ Itemized breakdown validated: ${parsedBreakdown.length} items, total XAF ${breakdownTotal.toLocaleString()}`);

//     // STEP 6: Validate receipt documents (MANDATORY)
//     console.log('Checking for receipt documents...');
//     console.log('req.files:', req.files);
//     console.log('Files count:', req.files?.length);

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Receipt documents are mandatory for reimbursement requests. Please upload at least one receipt.',
//         hint: 'Accepted formats: PDF, JPG, PNG, JPEG (max 10 files, 10MB each)'
//       });
//     }

//     let receiptDocuments = [];
//     const uploadDir = path.join(__dirname, '../uploads/reimbursements');
    
//     try {
//       await fs.promises.mkdir(uploadDir, { recursive: true });
//       console.log(`✓ Upload directory ready: ${uploadDir}`);
//     } catch (dirError) {
//       console.error('Failed to create upload directory:', dirError);
//       throw new Error('Failed to prepare upload directory');
//     }

//     // Process files
//     console.log(`Processing ${req.files.length} receipt document(s)...`);
    
//     for (let i = 0; i < req.files.length; i++) {
//       const file = req.files[i];
//       try {
//         console.log(`  Processing file ${i + 1}: ${file.originalname} (${file.size} bytes)`);
        
//         const timestamp = Date.now();
//         const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
//         const fileName = `${timestamp}-${i}-${sanitizedName}`;
//         const filePath = path.join(uploadDir, fileName);

//         if (!file.path || !fs.existsSync(file.path)) {
//           console.error(`  ✗ Temp file not found: ${file.path}`);
//           continue;
//         }

//         await fs.promises.rename(file.path, filePath);
//         console.log(`  ✓ Saved as: ${fileName}`);

//         receiptDocuments.push({
//           name: file.originalname,
//           url: `/uploads/reimbursements/${fileName}`,
//           publicId: fileName,
//           size: file.size,
//           mimetype: file.mimetype,
//           uploadedAt: new Date()
//         });
//       } catch (fileError) {
//         console.error(`  ✗ Error processing file ${file.originalname}:`, fileError);
//         continue;
//       }
//     }

//     if (receiptDocuments.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Failed to upload receipt documents. Please try again.'
//       });
//     }

//     console.log(`✓ Successfully processed ${receiptDocuments.length} receipt document(s)`);

//     // STEP 7: Generate approval chain
//     const approvalChain = getCashRequestApprovalChain(employee.fullName, employee.department);

//     if (!approvalChain || approvalChain.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Unable to determine approval chain. Please contact HR.'
//       });
//     }

//     console.log(`✓ Approval chain generated with ${approvalChain.length} levels`);

//     const mappedApprovalChain = mapApprovalChainForCashRequest(approvalChain);
//     console.log(`✓ Approval chain mapped for CashRequest schema`);

//     // STEP 8: Create reimbursement request
//     const reimbursementRequest = new CashRequest({
//       employee: req.user.userId,
//       requestMode: 'reimbursement',
//       requestType,
//       amountRequested: amount,
//       purpose: purpose.trim(),
//       businessJustification: businessJustification.trim(),
//       urgency,
//       requiredDate: new Date(requiredDate),
//       status: 'pending_supervisor',
//       approvalChain: mappedApprovalChain,  // ✅ Use mapped chain
//       reimbursementDetails: {
//         amountSpent: amount,
//         receiptDocuments,
//         itemizedBreakdown: parsedBreakdown,
//         submittedDate: new Date(),
//         receiptVerified: false
//       }
//     });


//     await reimbursementRequest.save();
//     console.log(`✓ Reimbursement request created: ${reimbursementRequest._id}`);

//     // Populate employee details
//     await reimbursementRequest.populate('employee', 'fullName email department');

//     // STEP 9: Send notifications
//     const notifications = [];

//     // Notify first approver (supervisor)
//     const firstApprover = approvalChain[0];
//     if (firstApprover) {
//       notifications.push(
//         sendEmail({
//           to: firstApprover.approver.email,
//           subject: `💰 Reimbursement Request Requires Approval - ${employee.fullName}`,
//           html: `
//             <h3>Reimbursement Request Requires Your Approval</h3>
//             <p>Dear ${firstApprover.approver.name},</p>

//             <p><strong>${employee.fullName}</strong> has submitted a reimbursement request for your approval.</p>

//             <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
//               <p><strong>Reimbursement Details:</strong></p>
//               <ul>
//                 <li><strong>Request ID:</strong> REQ-${reimbursementRequest._id.toString().slice(-6).toUpperCase()}</li>
//                 <li><strong>Amount:</strong> XAF ${amount.toLocaleString()}</li>
//                 <li><strong>Type:</strong> ${requestType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
//                 <li><strong>Purpose:</strong> ${purpose}</li>
//                 <li><strong>Receipt Documents:</strong> ${receiptDocuments.length}</li>
//                 <li><strong>Itemized Expenses:</strong> ${parsedBreakdown.length}</li>
//                 <li><strong>Urgency:</strong> ${urgency.toUpperCase()}</li>
//               </ul>
//             </div>

//             <div style="background-color: #d1ecf1; padding: 10px; border-radius: 5px; margin: 10px 0;">
//               <p><em>💡 This is a <strong>reimbursement request</strong> - the employee has already spent their personal funds and is requesting reimbursement.</em></p>
//             </div>

//             <p>Please review the attached receipts and approve or reject this request in the system.</p>
//           `
//         }).catch(error => {
//           console.error('Failed to send supervisor notification:', error);
//           return { error, type: 'supervisor' };
//         })
//       );
//     }

//     // Notify employee
//     notifications.push(
//       sendEmail({
//         to: employee.email,
//         subject: '✅ Reimbursement Request Submitted Successfully',
//         html: `
//           <h3>Your Reimbursement Request Has Been Submitted</h3>
//           <p>Dear ${employee.fullName},</p>

//           <p>Your reimbursement request has been successfully submitted and is being reviewed.</p>

//           <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0;">
//             <p><strong>Submission Summary:</strong></p>
//             <ul>
//               <li><strong>Request ID:</strong> REQ-${reimbursementRequest._id.toString().slice(-6).toUpperCase()}</li>
//               <li><strong>Amount:</strong> XAF ${amount.toLocaleString()}</li>
//               <li><strong>Type:</strong> ${requestType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
//               <li><strong>Receipt Documents:</strong> ${receiptDocuments.length}</li>
//               <li><strong>Itemized Expenses:</strong> ${parsedBreakdown.length}</li>
//               <li><strong>Monthly Limit:</strong> ${limitCheck.count + 1}/5 used this month</li>
//             </ul>
//           </div>

//           <div style="background-color: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0;">
//             <p><strong>Next Step:</strong> Your request will be reviewed by ${firstApprover.approver.name} (${firstApprover.approver.role}).</p>
//           </div>

//           <p>You will receive email notifications as your request progresses through the approval chain.</p>

//           <p>Thank you for following the proper reimbursement process!</p>
//         `
//       }).catch(error => {
//         console.error('Failed to send employee notification:', error);
//         return { error, type: 'employee' };
//       })
//     );

//     await Promise.allSettled(notifications);

//     console.log('=== REIMBURSEMENT REQUEST CREATED SUCCESSFULLY ===');
//     res.status(201).json({
//       success: true,
//       message: 'Reimbursement request submitted successfully',
//       data: reimbursementRequest,
//       limitInfo: {
//         monthlyUsed: limitCheck.count + 1,
//         monthlyLimit: 5,
//         remaining: limitCheck.remaining - 1
//       }
//     });

//   } catch (error) {
//     console.error('❌ Create reimbursement request error:', error);
//     console.error('Stack trace:', error.stack);

//     // Clean up uploaded files on error
//     if (req.files && req.files.length > 0) {
//       console.log('Cleaning up uploaded files due to error...');
//       await Promise.allSettled(
//         req.files.map(file => {
//           if (file.path && fs.existsSync(file.path)) {
//             return fs.promises.unlink(file.path).catch(e => 
//               console.error('File cleanup failed:', e)
//             );
//           }
//         })
//       );
//     }

//     res.status(500).json({
//       success: false,
//       message: error.message || 'Failed to create reimbursement request',
//       error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
//     });
//   }
// };


const createReimbursementRequest = async (req, res) => {
  try {
    console.log('=== CREATE REIMBURSEMENT REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Files received:', req.files?.length || 0);

    const {
      requestType,
      amountRequested,
      purpose,
      businessJustification,
      urgency,
      requiredDate,
      itemizedBreakdown
    } = req.body;

    // STEP 1: Validate user
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    console.log(`Creating reimbursement request for: ${employee.fullName}`);

    // STEP 2: Check monthly limit (5 requests)
    const CashRequest = require('../models/CashRequest');
    const limitCheck = await CashRequest.checkMonthlyReimbursementLimit(req.user.userId);
    
    if (!limitCheck.canSubmit) {
      return res.status(400).json({
        success: false,
        message: `Monthly reimbursement limit reached. You have submitted ${limitCheck.count} reimbursement requests this month (limit: 5)`,
        limitInfo: limitCheck
      });
    }

    console.log(`✓ Monthly limit check passed: ${limitCheck.count}/5 used, ${limitCheck.remaining} remaining`);

    // STEP 3: Validate amount
    const amount = parseFloat(amountRequested);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount greater than 0'
      });
    }

    if (amount > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Reimbursement amount cannot exceed XAF 100,000'
      });
    }

    console.log(`✓ Amount validated: XAF ${amount.toLocaleString()}`);

    // STEP 4: Validate required fields
    if (!purpose || purpose.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Purpose must be at least 10 characters long'
      });
    }

    if (!businessJustification || businessJustification.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Business justification must be at least 20 characters long'
      });
    }

    console.log('✓ Required text fields validated');

    // STEP 5: Validate itemized breakdown (if provided)
    let parsedBreakdown = [];
    
    if (itemizedBreakdown) {
      try {
        parsedBreakdown = typeof itemizedBreakdown === 'string' 
          ? JSON.parse(itemizedBreakdown) 
          : itemizedBreakdown;
        
        if (Array.isArray(parsedBreakdown) && parsedBreakdown.length > 0) {
          // Validate each item has required fields
          for (let i = 0; i < parsedBreakdown.length; i++) {
            const item = parsedBreakdown[i];
            if (!item.description || !item.amount || !item.category) {
              return res.status(400).json({
                success: false,
                message: `Expense item ${i + 1} is missing description, amount, or category`
              });
            }
            if (parseFloat(item.amount) <= 0) {
              return res.status(400).json({
                success: false,
                message: `Expense item ${i + 1} must have an amount greater than 0`
              });
            }
          }

          // Validate total matches
          const breakdownTotal = parsedBreakdown.reduce((sum, item) => 
            sum + parseFloat(item.amount || 0), 0
          );
          
          const discrepancy = Math.abs(breakdownTotal - amount);
          if (discrepancy > 0.01) {
            return res.status(400).json({
              success: false,
              message: `Itemized breakdown total (XAF ${breakdownTotal.toFixed(2)}) must match reimbursement amount (XAF ${amount.toFixed(2)})`
            });
          }

          console.log(`✓ Itemized breakdown validated: ${parsedBreakdown.length} items, total XAF ${breakdownTotal.toLocaleString()}`);
        }
      } catch (parseError) {
        console.error('Breakdown parsing error:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid itemized breakdown format',
          error: parseError.message
        });
      }
    } else {
      console.log('⚠️  No itemized breakdown provided (single amount mode)');
    }

    // STEP 6: Validate receipt documents (MANDATORY)
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Receipt documents are mandatory for reimbursement requests. Please upload at least one receipt.',
        hint: 'Accepted formats: PDF, JPG, PNG (max 10 files, 10MB each)'
      });
    }

    console.log(`✓ Receipts validated: ${req.files.length} file(s)`);

    // STEP 7: Process receipt files using local storage
    let receiptDocuments = [];
    const { saveFile, STORAGE_CATEGORIES } = require('../utils/localFileStorage');
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        console.log(`  Processing receipt ${i + 1}: ${file.originalname}`);
        
        const fileMetadata = await saveFile(
          file,
          STORAGE_CATEGORIES.REIMBURSEMENTS,
          '', // no subfolder
          null // auto-generate filename
        );

        receiptDocuments.push({
          name: file.originalname,
          url: fileMetadata.url,
          publicId: fileMetadata.publicId,
          localPath: fileMetadata.localPath,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date()
        });

        console.log(`  ✓ Saved: ${fileMetadata.publicId}`);
        
      } catch (fileError) {
        console.error(`  ❌ Error processing ${file.originalname}:`, fileError);
        continue;
      }
    }

    if (receiptDocuments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload receipt documents. Please try again.'
      });
    }

    console.log(`✓ Successfully processed ${receiptDocuments.length} receipt document(s)`);

    // STEP 8: Generate approval chain
    const { getCashRequestApprovalChain } = require('../config/cashRequestApprovalChain');
    const approvalChain = getCashRequestApprovalChain(employee.email);

    if (!approvalChain || approvalChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine approval chain. Please contact HR.'
      });
    }

    console.log(`✓ Approval chain generated with ${approvalChain.length} levels`);

    const mappedApprovalChain = mapApprovalChainForCashRequest(approvalChain);

    // STEP 9: Create reimbursement request
    const reimbursementRequest = new CashRequest({
      employee: req.user.userId,
      requestMode: 'reimbursement',
      requestType,
      amountRequested: amount,
      purpose: purpose.trim(),
      businessJustification: businessJustification.trim(),
      urgency,
      requiredDate: new Date(requiredDate),
      status: 'pending_supervisor',
      approvalChain: mappedApprovalChain,
      itemizedBreakdown: parsedBreakdown.length > 0 ? parsedBreakdown : null,
      reimbursementDetails: {
        amountSpent: amount, // Employee already spent this
        receiptDocuments,
        itemizedBreakdown: parsedBreakdown.length > 0 ? parsedBreakdown : null,
        submittedDate: new Date(),
        receiptVerified: false
      }
    });

    await reimbursementRequest.save();
    console.log(`✓ Reimbursement request created: ${reimbursementRequest._id}`);

    // Populate employee details
    await reimbursementRequest.populate('employee', 'fullName email department');

    // STEP 10: Send notifications
    const notifications = [];

    // Notify first approver (supervisor)
    const firstApprover = approvalChain[0];
    if (firstApprover) {
      notifications.push(
        sendEmail({
          to: firstApprover.approver.email,
          subject: `💰 Reimbursement Request Requires Approval - ${employee.fullName}`,
          html: `
            <h3>Reimbursement Request Requires Your Approval</h3>
            <p>Dear ${firstApprover.approver.name},</p>

            <p><strong>${employee.fullName}</strong> has submitted a reimbursement request for expenses already paid from personal funds.</p>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
              <p><strong>Reimbursement Details:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${reimbursementRequest._id.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Amount:</strong> XAF ${amount.toLocaleString()}</li>
                <li><strong>Type:</strong> ${requestType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
                <li><strong>Purpose:</strong> ${purpose}</li>
                <li><strong>Receipt Documents:</strong> ${receiptDocuments.length}</li>
                ${parsedBreakdown.length > 0 ? `<li><strong>Itemized Expenses:</strong> ${parsedBreakdown.length}</li>` : ''}
                <li><strong>Urgency:</strong> ${urgency.toUpperCase()}</li>
              </ul>
            </div>

            <div style="background-color: #d1ecf1; padding: 10px; border-radius: 5px; margin: 10px 0;">
              <p><em>💡 This is a <strong>reimbursement request</strong> - the employee has already spent their personal funds.</em></p>
            </div>

            <p>Please review the attached receipts and approve or reject this request in the system.</p>
          `
        }).catch(error => {
          console.error('Failed to send supervisor notification:', error);
          return { error, type: 'supervisor' };
        })
      );
    }

    // Notify employee
    notifications.push(
      sendEmail({
        to: employee.email,
        subject: '✅ Reimbursement Request Submitted Successfully',
        html: `
          <h3>Your Reimbursement Request Has Been Submitted</h3>
          <p>Dear ${employee.fullName},</p>

          <p>Your reimbursement request has been successfully submitted and is being reviewed.</p>

          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Submission Summary:</strong></p>
            <ul>
              <li><strong>Request ID:</strong> REQ-${reimbursementRequest._id.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Amount:</strong> XAF ${amount.toLocaleString()}</li>
              <li><strong>Type:</strong> ${requestType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
              <li><strong>Receipt Documents:</strong> ${receiptDocuments.length}</li>
              ${parsedBreakdown.length > 0 ? `<li><strong>Itemized Expenses:</strong> ${parsedBreakdown.length}</li>` : ''}
              <li><strong>Monthly Limit:</strong> ${limitCheck.count + 1}/5 used this month</li>
            </ul>
          </div>

          <div style="background-color: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <p><strong>Next Step:</strong> Your request will be reviewed by ${firstApprover.approver.name} (${firstApprover.approver.role}).</p>
          </div>

          <p>You will receive email notifications as your request progresses through the approval chain.</p>
        `
      }).catch(error => {
        console.error('Failed to send employee notification:', error);
        return { error, type: 'employee' };
      })
    );

    await Promise.allSettled(notifications);

    console.log('=== REIMBURSEMENT REQUEST CREATED SUCCESSFULLY ===');
    res.status(201).json({
      success: true,
      message: 'Reimbursement request submitted successfully',
      data: reimbursementRequest,
      limitInfo: {
        monthlyUsed: limitCheck.count + 1,
        monthlyLimit: 5,
        remaining: limitCheck.remaining - 1
      }
    });

  } catch (error) {
    console.error('❌ Create reimbursement request error:', error);
    console.error('Stack trace:', error.stack);

    // Clean up uploaded files on error
    const fs = require('fs').promises;
    if (req.files && req.files.length > 0) {
      console.log('Cleaning up uploaded files due to error...');
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path && require('fs').existsSync(file.path)) {
            return fs.unlink(file.path).catch(e => 
              console.error('File cleanup failed:', e)
            );
          }
        })
      );
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create reimbursement request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }
};

// // NEW: Get monthly reimbursement limit status
// const getReimbursementLimitStatus = async (req, res) => {
//   try {
//     const CashRequest = require('../models/CashRequest');
//     const limitCheck = await CashRequest.checkMonthlyReimbursementLimit(req.user.userId);
    
//     res.json({
//       success: true,
//       data: limitCheck
//     });
//   } catch (error) {
//     console.error('Get reimbursement limit status error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to check reimbursement limit',
//       error: error.message
//     });
//   }
// };


const getReimbursementLimitStatus = async (req, res) => {
  try {
    const CashRequest = require('../models/CashRequest');
    const limitCheck = await CashRequest.checkMonthlyReimbursementLimit(req.user.userId);
    
    res.json({
      success: true,
      data: limitCheck
    });
  } catch (error) {
    console.error('Get reimbursement limit status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check reimbursement limit',
      error: error.message
    });
  }
};


// NEW: Get Finance Reports Data
const getFinanceReportsData = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      requestTypes, 
      departments, 
      status,
      requestMode 
    } = req.query;

    console.log('=== GET FINANCE REPORTS DATA ===');
    console.log('Filters:', { startDate, endDate, requestTypes, departments, status, requestMode });

    // Build match query
    let matchQuery = {};

    // Date filter
    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Request types filter
    if (requestTypes && requestTypes !== 'all') {
      const typesArray = requestTypes.split(',').filter(t => t);
      if (typesArray.length > 0) {
        matchQuery.requestType = { $in: typesArray };
      }
    }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'approved_all') {
        matchQuery.status = { $in: ['approved', 'disbursed', 'completed'] };
      } else {
        matchQuery.status = status;
      }
    }

    // Request mode filter
    if (requestMode && requestMode !== 'all') {
      matchQuery.requestMode = requestMode;
    }

    // Department filter
    if (departments && departments !== 'all') {
      const deptArray = departments.split(',').filter(d => d);
      if (deptArray.length > 0) {
        const users = await User.find({ department: { $in: deptArray } }).select('_id');
        matchQuery.employee = { $in: users.map(u => u._id) };
      }
    }

    console.log('Match query:', JSON.stringify(matchQuery, null, 2));

    // Aggregation by Request Type
    const byRequestType = await CashRequest.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$requestType',
          totalAmount: { $sum: '$amountApproved' },
          requestedAmount: { $sum: '$amountRequested' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amountApproved' },
          minAmount: { $min: '$amountApproved' },
          maxAmount: { $max: '$amountApproved' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Aggregation by Month
    const byMonth = await CashRequest.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalAmount: { $sum: '$amountApproved' },
          count: { $sum: 1 },
          approved: {
            $sum: {
              $cond: [{ $in: ['$status', ['approved', 'disbursed', 'completed']] }, 1, 0]
            }
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$status', 'denied'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Aggregation by Department
    const byDepartment = await CashRequest.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeData'
        }
      },
      { $unwind: '$employeeData' },
      {
        $group: {
          _id: '$employeeData.department',
          totalAmount: { $sum: '$amountApproved' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amountApproved' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Aggregation by Request Mode
    const byRequestMode = await CashRequest.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$requestMode',
          totalAmount: { $sum: '$amountApproved' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amountApproved' }
        }
      }
    ]);

    // Overall Statistics - FIXED: Changed $regex to proper $regexMatch
    const overallStats = await CashRequest.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalAmount: { $sum: '$amountApproved' },
          totalRequested: { $sum: '$amountRequested' },
          avgAmount: { $avg: '$amountApproved' },
          approved: {
            $sum: {
              $cond: [{ $in: ['$status', ['approved', 'disbursed', 'completed']] }, 1, 0]
            }
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$status', 'denied'] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [
                { 
                  $regexMatch: { 
                    input: '$status', 
                    regex: /^pending/ 
                  } 
                }, 
                1, 
                0
              ]
            }
          }
        }
      }
    ]);

    // Get detailed records for table
    const detailedRecords = await CashRequest.find(matchQuery)
      .populate('employee', 'fullName email department position')
      .populate('projectId', 'name code')
      .populate('budgetAllocation.budgetCodeId', 'code name')
      .sort({ createdAt: -1 })
      .limit(1000); // Limit to prevent memory issues

    const stats = overallStats[0] || {
      totalRequests: 0,
      totalAmount: 0,
      totalRequested: 0,
      avgAmount: 0,
      approved: 0,
      rejected: 0,
      pending: 0
    };

    console.log(`Report generated: ${stats.totalRequests} requests, XAF ${stats.totalAmount.toLocaleString()}`);

    res.json({
      success: true,
      data: {
        statistics: stats,
        byRequestType,
        byMonth,
        byDepartment,
        byRequestMode,
        detailedRecords,
        filters: {
          startDate,
          endDate,
          requestTypes: requestTypes?.split(',') || [],
          departments: departments?.split(',') || [],
          status,
          requestMode
        }
      }
    });

  } catch (error) {
    console.error('Get finance reports data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate finance reports',
      error: error.message
    });
  }
};


const checkPendingRequests = async (req, res) => {
  try {
    const pendingRequest = await CashRequest.findOne({
      employee: req.user.userId,
      status: { $regex: /^pending_/ }
    }).select('_id status requestType amountRequested createdAt');

    if (pendingRequest) {
      return res.json({
        success: true,
        hasPending: true,
        pendingRequest: {
          id: pendingRequest._id,
          status: pendingRequest.status,
          type: pendingRequest.requestType,
          amount: pendingRequest.amountRequested,
          createdAt: pendingRequest.createdAt
        }
      });
    }

    res.json({
      success: true,
      hasPending: false
    });

  } catch (error) {
    console.error('Check pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check pending requests',
      error: error.message
    });
  }
};


const editCashRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const {
      requestType,
      amountRequested,
      purpose,
      businessJustification,
      urgency,
      requiredDate,
      projectId,
      itemizedBreakdown,
      editReason // Why user is editing
    } = req.body;

    console.log('\n=== EDIT CASH REQUEST ===');
    console.log('Request ID:', requestId);
    console.log('User:', req.user.userId);

    // Get current request
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Verify ownership
    if (!request.employee._id.equals(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the request owner can edit it'
      });
    }

    // Check if request can be edited
    const canEdit = canRequestBeEdited(request);
    if (!canEdit.allowed) {
      return res.status(400).json({
        success: false,
        message: canEdit.reason
      });
    }

    // Store original values (first time only)
    if (!request.originalValues) {
      request.originalValues = {
        requestType: request.requestType,
        amountRequested: request.amountRequested,
        purpose: request.purpose,
        businessJustification: request.businessJustification,
        urgency: request.urgency,
        requiredDate: request.requiredDate,
        projectId: request.projectId,
        itemizedBreakdown: request.itemizedBreakdown,
        attachments: request.attachments
      };
    }

    // Track what changed
    const changes = {};
    if (requestType !== request.requestType) changes.requestType = { from: request.requestType, to: requestType };
    if (parseFloat(amountRequested) !== request.amountRequested) {
      changes.amountRequested = { from: request.amountRequested, to: parseFloat(amountRequested) };
    }
    if (purpose !== request.purpose) changes.purpose = { from: request.purpose, to: purpose };
    if (businessJustification !== request.businessJustification) {
      changes.businessJustification = { from: request.businessJustification, to: businessJustification };
    }
    if (urgency !== request.urgency) changes.urgency = { from: request.urgency, to: urgency };

    // Parse itemized breakdown
    let parsedBreakdown = null;
    if (itemizedBreakdown) {
      try {
        parsedBreakdown = typeof itemizedBreakdown === 'string' 
          ? JSON.parse(itemizedBreakdown) 
          : itemizedBreakdown;

        if (Array.isArray(parsedBreakdown) && parsedBreakdown.length > 0) {
          const breakdownTotal = parsedBreakdown.reduce((sum, item) => 
            sum + parseFloat(item.amount || 0), 0
          );
          
          const discrepancy = Math.abs(breakdownTotal - parseFloat(amountRequested));
          if (discrepancy > 1) {
            return res.status(400).json({
              success: false,
              message: `Itemized breakdown total must match requested amount`
            });
          }
        }
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid itemized breakdown format'
        });
      }
    }

    // Handle new attachments
    let newAttachments = [...request.attachments]; // Keep existing
    
    if (req.files && req.files.length > 0) {
      console.log(`Adding ${req.files.length} new attachment(s)...`);
      
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        
        try {
          const fileMetadata = await saveFile(
            file,
            STORAGE_CATEGORIES.CASH_REQUESTS,
            'attachments',
            null
          );

          newAttachments.push({
            name: file.originalname,
            publicId: fileMetadata.publicId,
            url: fileMetadata.url,
            localPath: fileMetadata.localPath,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });

          console.log(`   ✅ Added: ${fileMetadata.publicId}`);
        } catch (fileError) {
          console.error(`   ❌ Error processing ${file.originalname}:`, fileError);
        }
      }
    }

    // Update request fields
    request.requestType = requestType;
    request.amountRequested = parseFloat(amountRequested);
    request.purpose = purpose.trim();
    request.businessJustification = businessJustification.trim();
    request.urgency = urgency;
    request.requiredDate = new Date(requiredDate);
    request.projectId = projectId || null;
    request.itemizedBreakdown = parsedBreakdown || [];
    request.attachments = newAttachments;

    // Regenerate approval chain (fresh start)
    const employee = await User.findById(req.user.userId);
    const newApprovalChain = getCashRequestApprovalChain(employee.email);
    
    if (!newApprovalChain || newApprovalChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to regenerate approval chain'
      });
    }

    const mappedApprovalChain = mapApprovalChainForCashRequest(newApprovalChain);
    request.approvalChain = mappedApprovalChain;

    // Reset status to pending_supervisor
    const previousStatus = request.status;
    request.status = 'pending_supervisor';

    // Add to edit history
    request.totalEdits = (request.totalEdits || 0) + 1;
    request.isEdited = true;

    if (!request.editHistory) {
      request.editHistory = [];
    }

    request.editHistory.push({
      editedAt: new Date(),
      editedBy: req.user.userId,
      changes: changes,
      reason: editReason || 'User edited request',
      previousStatus: previousStatus,
      editNumber: request.totalEdits
    });

    await request.save();
    await request.populate('employee', 'fullName email department');

    console.log(`✅ Request edited successfully (Edit #${request.totalEdits})`);

    // Send notifications
    const notifications = [];

    // Notify first approver
    const firstApprover = newApprovalChain[0];
    if (firstApprover) {
      notifications.push(
        sendEmail({
          to: firstApprover.approver.email,
          subject: `📝 Edited Cash Request Requires Your Approval - ${employee.fullName}`,
          html: `
            <h3>Edited Cash Request Requires Your Approval</h3>
            <p>Dear ${firstApprover.approver.name},</p>

            <p><strong>${employee.fullName}</strong> has edited and resubmitted a cash request.</p>

            <div style="background-color: #fff7e6; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #faad14;">
              <p><strong>📝 This is an EDITED request (Edit #${request.totalEdits})</strong></p>
              <p><strong>Previous Status:</strong> ${previousStatus.replace(/_/g, ' ').toUpperCase()}</p>
              ${editReason ? `<p><strong>Edit Reason:</strong> ${editReason}</p>` : ''}
            </div>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Request Details:</strong></p>
              <ul>
                <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
                <li><strong>Amount:</strong> XAF ${parseFloat(amountRequested).toLocaleString()}</li>
                <li><strong>Type:</strong> ${requestType.replace(/-/g, ' ')}</li>
                <li><strong>Purpose:</strong> ${purpose}</li>
              </ul>
            </div>

            ${Object.keys(changes).length > 0 ? `
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>📋 Changes Made:</strong></p>
              <ul>
                ${Object.entries(changes).map(([field, change]) => `
                  <li><strong>${field}:</strong> Updated</li>
                `).join('')}
              </ul>
            </div>
            ` : ''}

            <p>Please review this edited request in the system.</p>
          `
        }).catch(error => {
          console.error('Failed to notify approver:', error);
          return { error, type: 'approver' };
        })
      );
    }

    // Notify employee
    notifications.push(
      sendEmail({
        to: employee.email,
        subject: '✅ Request Edited and Resubmitted Successfully',
        html: `
          <h3>Your Cash Request Has Been Edited and Resubmitted</h3>
          <p>Dear ${employee.fullName},</p>

          <p>Your cash request has been successfully updated and resubmitted for approval.</p>

          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ul>
              <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
              <li><strong>Edit Number:</strong> #${request.totalEdits}</li>
              <li><strong>Previous Status:</strong> ${previousStatus.replace(/_/g, ' ')}</li>
              <li><strong>New Status:</strong> Pending Supervisor</li>
              <li><strong>Changes Made:</strong> ${Object.keys(changes).length} field(s) updated</li>
            </ul>
          </div>

          <p>Your request will now go through the approval process again starting from Level 1.</p>
        `
      }).catch(error => {
        console.error('Failed to notify employee:', error);
        return { error, type: 'employee' };
      })
    );

    await Promise.allSettled(notifications);

    res.json({
      success: true,
      message: `Request edited successfully (Edit #${request.totalEdits})`,
      data: request,
      metadata: {
        totalEdits: request.totalEdits,
        changesCount: Object.keys(changes).length,
        approvalChainReset: true,
        newAttachmentsAdded: req.files?.length || 0
      }
    });

  } catch (error) {
    console.error('Edit cash request error:', error);
    
    // Cleanup uploaded files on error
    if (req.files && req.files.length > 0) {
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path && fsSync.existsSync(file.path)) {
            return fs.promises.unlink(file.path).catch(e => 
              console.error('File cleanup failed:', e)
            );
          }
        })
      );
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to edit request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }
};

// Helper function to check if request can be edited
const canRequestBeEdited = (request) => {
  // STRICT: ONLY allow editing after rejection
  
  // Scenario 1: Request denied/rejected
  if (request.status === 'denied') {
    return { allowed: true, scenario: 'after_rejection' };
  }

  // Scenario 2: Justification rejected (any level)
  if (request.status.includes('justification_rejected')) {
    return { allowed: true, scenario: 'justification_rejected' };
  }

  // REMOVED: No longer allow editing if "pending with no approvals"
  // All other statuses cannot be edited
  return { 
    allowed: false, 
    reason: `Cannot edit request with status: ${request.status}. Only rejected requests can be edited.` 
  };
};


/**
 * Process partial/full disbursement
 * POST /api/cash-requests/:requestId/disburse
 */
const processDisbursement = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { amount, notes } = req.body;

    console.log('=== PROCESS DISBURSEMENT ===');
    console.log('Request ID:', requestId);
    console.log('Amount:', amount);
    console.log('Disbursed by:', req.user.userId);

    // Validate amount
    const disbursementAmount = parseFloat(amount);
    if (isNaN(disbursementAmount) || disbursementAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid disbursement amount'
      });
    }

    // Get request
    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department')
      .populate('budgetAllocation.budgetCodeId', 'code name budget remaining');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Verify request can be disbursed
    if (!request.canDisburseFurther()) {
      return res.status(400).json({
        success: false,
        message: `Cannot disburse. Current status: ${request.status}`
      });
    }

    // Verify amount doesn't exceed remaining balance
    if (disbursementAmount > request.remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds remaining balance. Available: XAF ${request.remainingBalance.toLocaleString()}`
      });
    }

    // ============================================
    // DEDUCT FROM BUDGET (Immediate)
    // ============================================
    if (request.budgetAllocation && request.budgetAllocation.budgetCodeId) {
      const budgetCode = await BudgetCode.findById(request.budgetAllocation.budgetCodeId);
      
      if (budgetCode) {
        try {
          console.log(`Deducting XAF ${disbursementAmount.toLocaleString()} from budget ${budgetCode.code}`);
          await budgetCode.deductBudget(request._id, disbursementAmount);
          
          // Update allocation tracking
          request.budgetAllocation.actualSpent = (request.budgetAllocation.actualSpent || 0) + disbursementAmount;
          
          console.log(`✅ Budget deducted successfully`);
        } catch (budgetError) {
          console.error('❌ Budget deduction failed:', budgetError);
          return res.status(500).json({
            success: false,
            message: `Budget deduction failed: ${budgetError.message}`
          });
        }
      }
    }

    // Add disbursement
    await request.addDisbursement(disbursementAmount, req.user.userId, notes);

    console.log(`✅ Disbursement #${request.disbursements.length} processed`);
    console.log(`   Amount: XAF ${disbursementAmount.toLocaleString()}`);
    console.log(`   Total Disbursed: XAF ${request.totalDisbursed.toLocaleString()}`);
    console.log(`   Remaining: XAF ${request.remainingBalance.toLocaleString()}`);
    console.log(`   New Status: ${request.status}`);

    // ============================================
    // SEND NOTIFICATION TO EMPLOYEE
    // ============================================
    const user = await User.findById(req.user.userId);
    
    const isFullyDisbursed = request.status === 'fully_disbursed';
    const disbursementNumber = request.disbursements.length;

    await sendEmail({
      to: request.employee.email,
      subject: isFullyDisbursed ? 
        '✅ Cash Request Fully Disbursed' : 
        `💰 Partial Disbursement #${disbursementNumber} Processed`,
      html: `
        <h3>${isFullyDisbursed ? 'Cash Request Fully Disbursed' : `Partial Disbursement Processed`}</h3>
        <p>Dear ${request.employee.fullName},</p>
        
        <p>A disbursement has been processed for your cash request.</p>

        <div style="background-color: ${isFullyDisbursed ? '#d4edda' : '#d1ecf1'}; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid ${isFullyDisbursed ? '#28a745' : '#17a2b8'};">
          <p><strong>Disbursement Details:</strong></p>
          <ul>
            <li><strong>Request ID:</strong> REQ-${requestId.toString().slice(-6).toUpperCase()}</li>
            <li><strong>Disbursement #:</strong> ${disbursementNumber} of ${isFullyDisbursed ? disbursementNumber : '?'}</li>
            <li><strong>Amount Disbursed:</strong> XAF ${disbursementAmount.toLocaleString()}</li>
            <li><strong>Total Disbursed:</strong> XAF ${request.totalDisbursed.toLocaleString()}</li>
            <li><strong>Remaining Balance:</strong> XAF ${request.remainingBalance.toLocaleString()}</li>
            <li><strong>Progress:</strong> ${request.disbursementProgress}%</li>
            <li><strong>Disbursed By:</strong> ${user.fullName} (Finance)</li>
            ${notes ? `<li><strong>Notes:</strong> ${notes}</li>` : ''}
          </ul>
        </div>

        ${isFullyDisbursed ? `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <p><strong>⚠️ Next Step: Submit Justification</strong></p>
            <p>Your request has been fully disbursed. Please submit your justification with receipts within the required timeframe.</p>
          </div>
        ` : `
          <div style="background-color: #e7f3ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <p><em>💡 More disbursements may follow. You will be notified on each payment.</em></p>
          </div>
        `}

        <p>Thank you!</p>
      `
    }).catch(err => console.error('Failed to send disbursement notification:', err));

    console.log('=== DISBURSEMENT COMPLETED ===\n');

    // Return updated request
    await request.populate('employee', 'fullName email department');

    res.json({
      success: true,
      message: isFullyDisbursed ? 
        'Request fully disbursed' : 
        `Partial disbursement #${disbursementNumber} processed successfully`,
      data: request,
      disbursement: {
        number: disbursementNumber,
        amount: disbursementAmount,
        totalDisbursed: request.totalDisbursed,
        remainingBalance: request.remainingBalance,
        progress: request.disbursementProgress,
        isFullyDisbursed
      }
    });

  } catch (error) {
    console.error('Process disbursement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process disbursement',
      error: error.message
    });
  }
};

/**
 * Get disbursement history for a request
 * GET /api/cash-requests/:requestId/disbursements
 */
const getDisbursementHistory = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await CashRequest.findById(requestId)
      .populate('employee', 'fullName email department')
      .populate('disbursements.disbursedBy', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.json({
      success: true,
      data: {
        requestId: request._id,
        employee: request.employee,
        amountApproved: request.amountApproved || request.amountRequested,
        totalDisbursed: request.totalDisbursed || 0,
        remainingBalance: request.remainingBalance || 0,
        progress: request.disbursementProgress || 0,
        status: request.status,
        disbursements: request.disbursements || []
      }
    });

  } catch (error) {
    console.error('Get disbursement history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch disbursement history',
      error: error.message
    });
  }
};

/**
 * Export cash requests (CSV/Excel/PDF)
 * GET /api/cash-requests/export?format=csv&startDate=...&endDate=...&department=...&status=...&employee=...
 */
const exportCashRequests = async (req, res) => {
  try {
    const { 
      format = 'csv', 
      startDate, 
      endDate, 
      department, 
      status,
      employeeId 
    } = req.query;

    console.log('=== EXPORT CASH REQUESTS ===');
    console.log('Format:', format);
    console.log('Filters:', { startDate, endDate, department, status, employeeId });

    // Build query
    let query = {};

    // Date range filter
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    // Department filter
    if (department && department !== 'all') {
      const users = await User.find({ department }).select('_id');
      query.employee = { $in: users.map(u => u._id) };
    }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'disbursed') {
        // Include both partial and full
        query.status = { $in: ['partially_disbursed', 'fully_disbursed'] };
      } else {
        query.status = status;
      }
    }

    // Specific employee filter
    if (employeeId && employeeId !== 'all') {
      query.employee = employeeId;
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    // Fetch data
    const requests = await CashRequest.find(query)
      .populate('employee', 'fullName email department position')
      .populate('approvalChain.decidedBy', 'fullName email')
      .populate('budgetAllocation.budgetCodeId', 'code name')
      .populate('projectId', 'name code')
      .sort({ createdAt: -1 });

    console.log(`Found ${requests.length} requests`);

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No requests found matching the filters'
      });
    }

    // Generate export based on format
    if (format === 'csv') {
      return await exportAsCSV(res, requests);
    } else if (format === 'excel') {
      return await exportAsExcel(res, requests);
    } else if (format === 'pdf') {
      return await exportAsPDF(res, requests);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use csv, excel, or pdf'
      });
    }

  } catch (error) {
    console.error('Export cash requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export cash requests',
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
  processJustificationDecision,
  getDashboardStats,
  getAnalytics,
  generateCashRequestPDF,
  createReimbursementRequest,
  getReimbursementLimitStatus,
  getFinanceReportsData,
  checkPendingRequests,
  editCashRequest,
  canRequestBeEdited,
  processDisbursement,
  getDisbursementHistory,
  exportCashRequests
};



