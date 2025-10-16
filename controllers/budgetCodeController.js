const BudgetCode = require('../models/BudgetCode');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const User = require('../models/User');
const { getBudgetCodeApprovalChain, validateBudgetCodeApproval, getNextBudgetCodeStatus } = require('../config/budgetCodeApprovalChain');
const { sendEmail } = require('../services/emailService');

// Create new budget code with approval workflow
const createBudgetCode = async (req, res) => {
  try {
    console.log('=== CREATE BUDGET CODE WITH APPROVAL WORKFLOW ===');
    console.log('Request data:', req.body);
    console.log('User:', req.user);

    const {
      code,
      name,
      description,
      budget,
      department,
      budgetType,
      budgetPeriod,
      budgetOwner,
      startDate,
      endDate
    } = req.body;

    // Validate required fields
    if (!code || !name || !budget || !department || !budgetType || !budgetPeriod || !budgetOwner) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, name, budget, department, budgetType, budgetPeriod, budgetOwner'
      });
    }

    // Check if budget code already exists
    const existingCode = await BudgetCode.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: 'Budget code already exists'
      });
    }

    // Validate budget amount
    if (budget <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Budget amount must be greater than zero'
      });
    }

    // Get creator information
    const creator = await User.findById(req.user.userId);
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: 'Creator not found'
      });
    }

    // Generate approval chain
    const approvalChain = getBudgetCodeApprovalChain(creator.fullName, department, budgetType);

    // Determine initial status
    let initialStatus = 'pending';
    if (approvalChain.length > 0) {
      initialStatus = 'pending_departmental_head';
    }

    // Create budget code
    const budgetCode = new BudgetCode({
      code: code.toUpperCase(),
      name,
      description,
      budget: parseFloat(budget),
      department,
      budgetType,
      budgetPeriod,
      budgetOwner,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      active: false, // Budget code starts as inactive until approved
      status: initialStatus,
      approvalChain,
      createdBy: req.user.userId
    });

    await budgetCode.save();

    console.log('Budget code created successfully:', budgetCode._id);

    // Send notification to first approver
    if (approvalChain.length > 0) {
      const firstApprover = approvalChain[0].approver;
      await sendBudgetCodeApprovalEmail(
        firstApprover.email,
        firstApprover.name,
        budgetCode,
        creator.fullName
      );
    }

    res.status(201).json({
      success: true,
      message: 'Budget code created successfully and sent for approval',
      data: budgetCode
    });

  } catch (error) {
    console.error('Create budget code error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${validationErrors.join(', ')}`
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Budget code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create budget code',
      error: error.message
    });
  }
};

// Process budget code approval/rejection
const processBudgetCodeApproval = async (req, res) => {
  try {
    console.log('=== PROCESS BUDGET CODE APPROVAL ===');
    const { codeId } = req.params;
    const { decision, comments } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be "approved" or "rejected"'
      });
    }

    // Find budget code
    let budgetCode = await BudgetCode.findById(codeId)
      .populate('createdBy', 'fullName email')
      .populate('budgetOwner', 'fullName email');
    
    if (!budgetCode) {
      budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() })
        .populate('createdBy', 'fullName email')
        .populate('budgetOwner', 'fullName email');
    }

    if (!budgetCode) {
      return res.status(404).json({
        success: false,
        message: 'Budget code not found'
      });
    }

    // Get user information
    const user = await User.findById(req.user.userId);

    // Validate approval permission
    const validation = validateBudgetCodeApproval(user, budgetCode);
    if (!validation.canApprove) {
      return res.status(403).json({
        success: false,
        message: validation.reason
      });
    }

    // Find current approval step
    const currentStep = budgetCode.approvalChain.find(step => step.status === 'pending');
    if (!currentStep) {
      return res.status(400).json({
        success: false,
        message: 'No pending approval step found'
      });
    }

    // Update current step
    currentStep.status = decision;
    currentStep.actionDate = new Date();
    currentStep.actionTime = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    currentStep.comments = comments;

    if (decision === 'rejected') {
      // Handle rejection
      budgetCode.status = 'rejected';
      budgetCode.active = false;
      budgetCode.rejectionReason = comments;
      budgetCode.rejectedBy = req.user.userId;
      budgetCode.rejectionDate = new Date();

      await budgetCode.save();

      // Notify creator of rejection
      await sendBudgetCodeRejectionEmail(
        budgetCode.createdBy.email,
        budgetCode.createdBy.fullName,
        budgetCode,
        user.fullName,
        comments
      );

      return res.json({
        success: true,
        message: 'Budget code rejected',
        data: budgetCode
      });
    }

    // Handle approval
    const nextStepIndex = budgetCode.approvalChain.findIndex(
      step => step.level === currentStep.level + 1
    );

    if (nextStepIndex !== -1) {
      // Move to next approval level
      const nextStep = budgetCode.approvalChain[nextStepIndex];
      budgetCode.status = getNextBudgetCodeStatus(currentStep.level, budgetCode.approvalChain.length);

      await budgetCode.save();

      // Notify next approver
      await sendBudgetCodeApprovalEmail(
        nextStep.approver.email,
        nextStep.approver.name,
        budgetCode,
        user.fullName,
        currentStep.level
      );

      return res.json({
        success: true,
        message: `Budget code approved. Moved to next approval level (${nextStep.approver.role})`,
        data: budgetCode
      });
    } else {
      // Final approval - activate budget code
      budgetCode.status = 'active';
      budgetCode.active = true;
      budgetCode.approvedBy = req.user.userId;

      await budgetCode.save();

      // Notify creator and budget owner of activation
      await sendBudgetCodeActivationEmail(
        budgetCode.createdBy.email,
        budgetCode.createdBy.fullName,
        budgetCode,
        user.fullName
      );

      if (budgetCode.budgetOwner && budgetCode.budgetOwner._id.toString() !== budgetCode.createdBy._id.toString()) {
        await sendBudgetCodeActivationEmail(
          budgetCode.budgetOwner.email,
          budgetCode.budgetOwner.fullName,
          budgetCode,
          user.fullName
        );
      }

      return res.json({
        success: true,
        message: 'Budget code fully approved and activated',
        data: budgetCode
      });
    }

  } catch (error) {
    console.error('Process budget code approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process approval',
      error: error.message
    });
  }
};

// Get budget codes with approval status filtering
const getBudgetCodes = async (req, res) => {
  try {
    const { 
      active, 
      department, 
      budgetType, 
      status,
      utilizationThreshold,
      page = 1, 
      limit = 50 
    } = req.query;

    let filter = {};
    
    if (active !== undefined) filter.active = active === 'true';
    if (department) filter.department = department;
    if (budgetType) filter.budgetType = budgetType;
    if (status) filter.status = status;

    const budgetCodes = await BudgetCode.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('budgetOwner', 'fullName email department')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    let filteredCodes = budgetCodes;
    if (utilizationThreshold) {
      const threshold = parseFloat(utilizationThreshold);
      filteredCodes = budgetCodes.filter(code => code.utilizationPercentage >= threshold);
    }

    const total = await BudgetCode.countDocuments(filter);

    res.json({
      success: true,
      data: filteredCodes,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: filteredCodes.length,
        totalRecords: total
      }
    });

  } catch (error) {
    console.error('Get budget codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget codes',
      error: error.message
    });
  }
};

// Get budget codes pending approval for current user
const getPendingApprovalsForUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const pendingCodes = await BudgetCode.find({
      'approvalChain.approver.email': user.email,
      'approvalChain.status': 'pending',
      status: { $nin: ['active', 'rejected'] }
    })
    .populate('createdBy', 'fullName email')
    .populate('budgetOwner', 'fullName email department')
    .sort({ createdAt: -1 });

    // Filter to only show codes where current step is for this user
    const userPendingCodes = pendingCodes.filter(code => {
      const currentStep = code.approvalChain.find(step => step.status === 'pending');
      return currentStep && currentStep.approver.email === user.email;
    });

    res.json({
      success: true,
      data: userPendingCodes,
      count: userPendingCodes.length
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

// Get single budget code by ID or code
const getBudgetCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    
    let budgetCode = await BudgetCode.findById(codeId)
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('budgetOwner', 'fullName email department')
      .populate('allocations.requisitionId', 'title requisitionNumber employee');

    if (!budgetCode) {
      budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() })
        .populate('createdBy', 'fullName email')
        .populate('approvedBy', 'fullName email')
        .populate('budgetOwner', 'fullName email department')
        .populate('allocations.requisitionId', 'title requisitionNumber employee');
    }

    if (!budgetCode) {
      return res.status(404).json({
        success: false,
        message: 'Budget code not found'
      });
    }

    res.json({
      success: true,
      data: budgetCode
    });

  } catch (error) {
    console.error('Get budget code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget code',
      error: error.message
    });
  }
};

// Update budget code
const updateBudgetCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const updateData = req.body;

    let budgetCode = await BudgetCode.findById(codeId);
    if (!budgetCode) {
      budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() });
    }

    if (!budgetCode) {
      return res.status(404).json({
        success: false,
        message: 'Budget code not found'
      });
    }

    // Check permissions
    const user = await User.findById(req.user.userId);
    const canUpdate = 
      user.role === 'admin' || 
      user.role === 'finance' ||
      user.email === 'ranibellmambo@gratoengineering.com';

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Handle budget amount changes
    if (updateData.budget && updateData.budget !== budgetCode.budget) {
      const newBudget = parseFloat(updateData.budget);
      const reason = updateData.budgetChangeReason || 'Budget adjustment';
      
      if (newBudget < budgetCode.used) {
        return res.status(400).json({
          success: false,
          message: `New budget amount cannot be less than already used amount (XAF ${budgetCode.used.toLocaleString()})`
        });
      }

      await budgetCode.updateBudget(newBudget, reason, req.user.userId);
    }

    // Update other fields
    const allowedFields = [
      'name', 'description', 'department', 'budgetType', 
      'budgetPeriod', 'budgetOwner', 'active', 'startDate', 'endDate'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          budgetCode[field] = updateData[field] ? new Date(updateData[field]) : null;
        } else {
          budgetCode[field] = updateData[field];
        }
      }
    });

    budgetCode.lastModifiedBy = req.user.userId;
    await budgetCode.save();

    res.json({
      success: true,
      message: 'Budget code updated successfully',
      data: budgetCode
    });

  } catch (error) {
    console.error('Update budget code error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${validationErrors.join(', ')}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update budget code',
      error: error.message
    });
  }
};

// Delete budget code
const deleteBudgetCode = async (req, res) => {
  try {
    const { codeId } = req.params;

    let budgetCode = await BudgetCode.findById(codeId);
    if (!budgetCode) {
      budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() });
    }

    if (!budgetCode) {
      return res.status(404).json({
        success: false,
        message: 'Budget code not found'
      });
    }

    // Check if budget code is in use
    const activeAllocations = budgetCode.allocations.filter(alloc => alloc.status === 'allocated');
    if (activeAllocations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete budget code with active allocations'
      });
    }

    const requisitionsUsingCode = await PurchaseRequisition.countDocuments({
      'financeVerification.budgetCode': budgetCode.code
    });

    if (requisitionsUsingCode > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete budget code that is referenced by purchase requisitions'
      });
    }

    await BudgetCode.findByIdAndDelete(budgetCode._id);

    res.json({
      success: true,
      message: 'Budget code deleted successfully'
    });

  } catch (error) {
    console.error('Delete budget code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete budget code',
      error: error.message
    });
  }
};

// Email notification functions
async function sendBudgetCodeApprovalEmail(approverEmail, approverName, budgetCode, requestorName, previousLevel = 0) {
  try {
    const subject = `Budget Code Approval Required: ${budgetCode.code}`;
    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const approvalLink = `${clientUrl}/finance/budget-codes/${budgetCode._id}/approve`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1890ff;">Budget Code Approval Required</h2>
        <p>Dear ${approverName},</p>
        <p>A new budget code requires your approval:</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Budget Code:</strong> ${budgetCode.code}</p>
          <p><strong>Name:</strong> ${budgetCode.name}</p>
          <p><strong>Department:</strong> ${budgetCode.department}</p>
          <p><strong>Budget Amount:</strong> XAF ${budgetCode.budget.toLocaleString()}</p>
          <p><strong>Budget Type:</strong> ${budgetCode.budgetType}</p>
          <p><strong>Created by:</strong> ${requestorName}</p>
        </div>

        <p style="text-align: center;">
          <a href="${approvalLink}" style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review Budget Code
          </a>
        </p>
      </div>
    `;

    await sendEmail({
      to: approverEmail,
      subject,
      html
    });
  } catch (error) {
    console.error('Failed to send budget code approval email:', error);
  }
}

async function sendBudgetCodeRejectionEmail(userEmail, userName, budgetCode, rejectedBy, reason) {
  try {
    const subject = `Budget Code Rejected: ${budgetCode.code}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff4d4f;">Budget Code Rejected</h2>
        <p>Dear ${userName},</p>
        <p>Your budget code has been rejected:</p>
        
        <div style="background-color: #fff2f0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff4d4f;">
          <p><strong>Budget Code:</strong> ${budgetCode.code}</p>
          <p><strong>Name:</strong> ${budgetCode.name}</p>
          <p><strong>Rejected by:</strong> ${rejectedBy}</p>
          <p><strong>Reason:</strong> ${reason}</p>
        </div>

        <p>You may create a new budget code with the necessary adjustments.</p>
      </div>
    `;

    await sendEmail({
      to: userEmail,
      subject,
      html
    });
  } catch (error) {
    console.error('Failed to send budget code rejection email:', error);
  }
}

async function sendBudgetCodeActivationEmail(userEmail, userName, budgetCode, approvedBy) {
  try {
    const subject = `Budget Code Activated: ${budgetCode.code}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #52c41a;">Budget Code Activated</h2>
        <p>Dear ${userName},</p>
        <p>Your budget code has been fully approved and activated:</p>
        
        <div style="background-color: #f6ffed; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #52c41a;">
          <p><strong>Budget Code:</strong> ${budgetCode.code}</p>
          <p><strong>Name:</strong> ${budgetCode.name}</p>
          <p><strong>Budget Amount:</strong> XAF ${budgetCode.budget.toLocaleString()}</p>
          <p><strong>Department:</strong> ${budgetCode.department}</p>
          <p><strong>Final Approved by:</strong> ${approvedBy}</p>
        </div>

        <p>The budget code is now active and can be used for purchase requisitions.</p>
      </div>
    `;

    await sendEmail({
      to: userEmail,
      subject,
      html
    });
  } catch (error) {
    console.error('Failed to send budget code activation email:', error);
  }
}

// Additional utility functions
const getBudgetCodeUtilization = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { period = 'monthly', startDate, endDate } = req.query;

    let budgetCode = await BudgetCode.findById(codeId)
      .populate('allocations.requisitionId', 'title requisitionNumber employee createdAt');
    
    if (!budgetCode) {
      budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() })
        .populate('allocations.requisitionId', 'title requisitionNumber employee createdAt');
    }

    if (!budgetCode) {
      return res.status(404).json({
        success: false,
        message: 'Budget code not found'
      });
    }

    let allocations = budgetCode.allocations;
    if (startDate || endDate) {
      allocations = allocations.filter(alloc => {
        const allocDate = alloc.allocationDate;
        if (startDate && allocDate < new Date(startDate)) return false;
        if (endDate && allocDate > new Date(endDate)) return false;
        return true;
      });
    }

    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
    const totalSpent = allocations.reduce((sum, alloc) => sum + (alloc.actualSpent || 0), 0);
    
    const utilizationData = {
      budgetCode: {
        code: budgetCode.code,
        name: budgetCode.name,
        totalBudget: budgetCode.budget,
        totalUsed: budgetCode.used,
        utilizationPercentage: budgetCode.utilizationPercentage,
        status: budgetCode.status
      },
      summary: {
        totalAllocated,
        totalSpent,
        pendingAllocations: allocations.filter(a => a.status === 'allocated').length,
        completedAllocations: allocations.filter(a => a.status === 'spent').length,
        averageAllocation: allocations.length > 0 ? totalAllocated / allocations.length : 0
      },
      recentAllocations: allocations
        .sort((a, b) => new Date(b.allocationDate) - new Date(a.allocationDate))
        .slice(0, 10)
    };

    res.json({
      success: true,
      data: utilizationData,
      period
    });

  } catch (error) {
    console.error('Get budget code utilization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget code utilization',
      error: error.message
    });
  }
};

const allocateBudgetToRequisition = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { requisitionId, amount } = req.body;

    let budgetCode = await BudgetCode.findById(codeId);
    if (!budgetCode) {
      budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() });
    }

    if (!budgetCode) {
      return res.status(404).json({
        success: false,
        message: 'Budget code not found'
      });
    }

    if (!budgetCode.active) {
      return res.status(400).json({
        success: false,
        message: 'Budget code is not active'
      });
    }

    const requisition = await PurchaseRequisition.findById(requisitionId);
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Purchase requisition not found'
      });
    }

    const existingAllocation = budgetCode.allocations.find(
      alloc => alloc.requisitionId.equals(requisitionId)
    );

    if (existingAllocation) {
      return res.status(400).json({
        success: false,
        message: 'Budget already allocated to this requisition'
      });
    }

    await budgetCode.allocateBudget(requisitionId, parseFloat(amount));

    if (!requisition.financeVerification) {
      requisition.financeVerification = {};
    }
    requisition.financeVerification.budgetCode = budgetCode.code;
    requisition.financeVerification.assignedBudget = parseFloat(amount);
    await requisition.save();

    res.json({
      success: true,
      message: 'Budget allocated successfully',
      data: {
        budgetCode: budgetCode.code,
        allocatedAmount: amount,
        remainingBudget: budgetCode.remaining
      }
    });

  } catch (error) {
    console.error('Allocate budget error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to allocate budget',
      error: error.message
    });
  }
};

module.exports = {
  createBudgetCode,
  processBudgetCodeApproval,
  getBudgetCodes,
  getPendingApprovalsForUser,
  getBudgetCode,
  updateBudgetCode,
  deleteBudgetCode,
  getBudgetCodeUtilization,
  allocateBudgetToRequisition
};










// const BudgetCode = require('../models/BudgetCode');
// const PurchaseRequisition = require('../models/PurchaseRequisition');
// const User = require('../models/User');
// const { getBudgetCodeApprovalChain, processBudgetCodeApproval, canUserApproveBudgetCode } = require('../config/budgetCodeApprovalChain');
// const { sendEmail } = require('../services/emailService');

// /**
//  * Create new budget code with approval workflow
//  */
// const createBudgetCode = async (req, res) => {
//   try {
//     console.log('=== CREATE BUDGET CODE WITH APPROVAL WORKFLOW ===');
//     console.log('Request data:', req.body);
//     console.log('User:', req.user);

//     const {
//       code,
//       name,
//       description,
//       budget,
//       department,
//       budgetType,
//       budgetPeriod,
//       budgetOwner,
//       startDate,
//       endDate
//     } = req.body;

//     // Validate required fields
//     if (!code || !name || !budget || !department || !budgetType || !budgetPeriod || !budgetOwner) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: code, name, budget, department, budgetType, budgetPeriod, budgetOwner'
//       });
//     }

//     // Check if budget code already exists
//     const existingCode = await BudgetCode.findOne({ code: code.toUpperCase() });
//     if (existingCode) {
//       return res.status(400).json({
//         success: false,
//         message: 'Budget code already exists'
//       });
//     }

//     // Validate budget amount
//     if (budget <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Budget amount must be greater than zero'
//       });
//     }

//     // Get creator information
//     const creator = await User.findById(req.user.userId);
//     if (!creator) {
//       return res.status(404).json({
//         success: false,
//         message: 'Creator not found'
//       });
//     }

//     // Generate approval chain
//     const approvalChain = getBudgetCodeApprovalChain(
//       creator.fullName,
//       department,
//       { code, budget }
//     );

//     // Create budget code
//     const budgetCode = new BudgetCode({
//       code: code.toUpperCase(),
//       name,
//       description,
//       budget: parseFloat(budget),
//       department,
//       budgetType,
//       budgetPeriod,
//       budgetOwner,
//       startDate: startDate ? new Date(startDate) : new Date(),
//       endDate: endDate ? new Date(endDate) : undefined,
//       status: 'pending_departmental_head',
//       active: false,
//       createdBy: req.user.userId,
//       approvalChain
//     });

//     await budgetCode.save();

//     console.log('Budget code created successfully:', budgetCode._id);

//     // Send notification to first approver
//     const firstApprover = approvalChain[0];
//     if (firstApprover) {
//       await sendBudgetCodeApprovalEmail(
//         firstApprover.approver.email,
//         creator.fullName,
//         budgetCode,
//         firstApprover.level
//       );
//     }

//     res.status(201).json({
//       success: true,
//       message: 'Budget code created and submitted for approval',
//       data: budgetCode
//     });

//   } catch (error) {
//     console.error('Create budget code error:', error);

//     if (error.name === 'ValidationError') {
//       const validationErrors = Object.values(error.errors).map(err => err.message);
//       return res.status(400).json({
//         success: false,
//         message: `Validation error: ${validationErrors.join(', ')}`
//       });
//     }

//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: 'Budget code already exists'
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Failed to create budget code',
//       error: error.message
//     });
//   }
// };

// /**
//  * Process budget code approval/rejection
//  */
// const processBudgetCodeApprovalAction = async (req, res) => {
//   try {
//     console.log('=== PROCESS BUDGET CODE APPROVAL ===');
//     const { codeId } = req.params;
//     const { decision, comments, adjustedBudget, adjustmentReason } = req.body;

//     console.log('Budget Code ID:', codeId);
//     console.log('Decision:', decision);
//     console.log('User:', req.user);

//     // Find budget code
//     let budgetCode = await BudgetCode.findById(codeId)
//       .populate('createdBy', 'fullName email')
//       .populate('budgetOwner', 'fullName email');

//     if (!budgetCode) {
//       budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() })
//         .populate('createdBy', 'fullName email')
//         .populate('budgetOwner', 'fullName email');
//     }

//     if (!budgetCode) {
//       return res.status(404).json({
//         success: false,
//         message: 'Budget code not found'
//       });
//     }

//     // Get current user
//     const user = await User.findById(req.user.userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     // Find current pending approval step for this user
//     const currentStep = budgetCode.approvalChain.find(
//       step => step.status === 'pending' && step.approver.email === user.email
//     );

//     if (!currentStep) {
//       return res.status(403).json({
//         success: false,
//         message: 'No pending approval step found for your account'
//       });
//     }

//     // Check if user can approve at this level
//     const canApprove = canUserApproveBudgetCode(user, currentStep);
//     if (!canApprove) {
//       return res.status(403).json({
//         success: false,
//         message: 'You do not have permission to approve at this level'
//       });
//     }

//     // Process the approval
//     const approvalData = {
//       decision,
//       comments,
//       adjustedBudget: adjustedBudget ? parseFloat(adjustedBudget) : null,
//       adjustmentReason
//     };

//     const updatedBudgetCode = await processBudgetCodeApproval(
//       budgetCode,
//       approvalData,
//       { userId: user._id, email: user.email, role: user.role }
//     );

//     await updatedBudgetCode.save();

//     console.log(`Budget code ${decision} by ${user.fullName} at level ${currentStep.level}`);

//     // Send notifications
//     if (decision === 'approved') {
//       // Notify creator
//       await sendBudgetCodeStatusUpdateEmail(
//         budgetCode.createdBy.email,
//         budgetCode.createdBy.fullName,
//         budgetCode,
//         'approved',
//         currentStep.level,
//         user.fullName
//       );

//       // If there's a next approver, notify them
//       const nextStep = updatedBudgetCode.approvalChain.find(
//         step => step.status === 'pending' && step.level === currentStep.level + 1
//       );

//       if (nextStep) {
//         await sendBudgetCodeApprovalEmail(
//           nextStep.approver.email,
//           budgetCode.createdBy.fullName,
//           updatedBudgetCode,
//           nextStep.level
//         );
//       } else {
//         // Final approval - budget code is now active
//         await sendBudgetCodeActivatedEmail(
//           budgetCode.createdBy.email,
//           budgetCode.createdBy.fullName,
//           updatedBudgetCode
//         );
//       }
//     } else {
//       // Notify creator of rejection
//       await sendBudgetCodeStatusUpdateEmail(
//         budgetCode.createdBy.email,
//         budgetCode.createdBy.fullName,
//         budgetCode,
//         'rejected',
//         currentStep.level,
//         user.fullName,
//         comments
//       );
//     }

//     res.json({
//       success: true,
//       message: `Budget code ${decision} successfully`,
//       data: updatedBudgetCode
//     });

//   } catch (error) {
//     console.error('Process budget code approval error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to process budget code approval',
//       error: error.message
//     });
//   }
// };

// /**
//  * Get budget codes pending approval for current user
//  */
// const getPendingApprovals = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     // Find budget codes with pending approval for this user
//     const pendingBudgetCodes = await BudgetCode.find({
//       'approvalChain': {
//         $elemMatch: {
//           'approver.email': user.email,
//           'status': 'pending'
//         }
//       }
//     })
//       .populate('createdBy', 'fullName email department')
//       .populate('budgetOwner', 'fullName email department')
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       data: pendingBudgetCodes,
//       count: pendingBudgetCodes.length
//     });

//   } catch (error) {
//     console.error('Get pending approvals error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch pending approvals',
//       error: error.message
//     });
//   }
// };

// /**
//  * Get all budget codes with filters
//  */
// const getBudgetCodes = async (req, res) => {
//   try {
//     const { 
//       active, 
//       department, 
//       budgetType, 
//       status,
//       utilizationThreshold,
//       page = 1, 
//       limit = 50 
//     } = req.query;

//     let filter = {};

//     // Apply filters
//     if (active !== undefined) filter.active = active === 'true';
//     if (department) filter.department = department;
//     if (budgetType) filter.budgetType = budgetType;
//     if (status) filter.status = status;

//     const budgetCodes = await BudgetCode.find(filter)
//       .populate('createdBy', 'fullName email')
//       .populate('budgetOwner', 'fullName email department')
//       .populate('approvedBy', 'fullName email')
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit);

//     // Apply utilization filter if specified
//     let filteredCodes = budgetCodes;
//     if (utilizationThreshold) {
//       const threshold = parseFloat(utilizationThreshold);
//       filteredCodes = budgetCodes.filter(code => code.utilizationPercentage >= threshold);
//     }

//     const total = await BudgetCode.countDocuments(filter);

//     res.json({
//       success: true,
//       data: filteredCodes,
//       pagination: {
//         current: parseInt(page),
//         total: Math.ceil(total / limit),
//         count: filteredCodes.length,
//         totalRecords: total
//       }
//     });

//   } catch (error) {
//     console.error('Get budget codes error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch budget codes',
//       error: error.message
//     });
//   }
// };

// /**
//  * Get single budget code by ID or code
//  */
// const getBudgetCode = async (req, res) => {
//   try {
//     const { codeId } = req.params;

//     let budgetCode = await BudgetCode.findById(codeId)
//       .populate('createdBy', 'fullName email')
//       .populate('budgetOwner', 'fullName email department')
//       .populate('approvedBy', 'fullName email')
//       .populate('allocations.requisitionId', 'title requisitionNumber employee');

//     if (!budgetCode) {
//       budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() })
//         .populate('createdBy', 'fullName email')
//         .populate('budgetOwner', 'fullName email department')
//         .populate('approvedBy', 'fullName email')
//         .populate('allocations.requisitionId', 'title requisitionNumber employee');
//     }

//     if (!budgetCode) {
//       return res.status(404).json({
//         success: false,
//         message: 'Budget code not found'
//       });
//     }

//     res.json({
//       success: true,
//       data: budgetCode
//     });

//   } catch (error) {
//     console.error('Get budget code error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch budget code',
//       error: error.message
//     });
//   }
// };

// /**
//  * Update budget code (only for active codes)
//  */
// const updateBudgetCode = async (req, res) => {
//   try {
//     const { codeId } = req.params;
//     const updateData = req.body;

//     let budgetCode = await BudgetCode.findById(codeId);
//     if (!budgetCode) {
//       budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() });
//     }

//     if (!budgetCode) {
//       return res.status(404).json({
//         success: false,
//         message: 'Budget code not found'
//       });
//     }

//     // Check if user can update budget codes
//     const user = await User.findById(req.user.userId);
//     const canUpdate = 
//       user.role === 'admin' || 
//       user.role === 'finance' ||
//       user.email === 'ranibellmambo@gratoengineering.com';

//     if (!canUpdate) {
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied'
//       });
//     }

//     // Handle budget amount changes
//     if (updateData.budget && updateData.budget !== budgetCode.budget) {
//       const newBudget = parseFloat(updateData.budget);
//       const reason = updateData.budgetChangeReason || 'Budget adjustment';
//       await budgetCode.updateBudget(newBudget, reason, req.user.userId);
//     }

//     // Update other fields
//     const allowedFields = [
//       'name', 'description', 'department', 'budgetType', 
//       'budgetPeriod', 'budgetOwner', 'active', 'startDate', 'endDate'
//     ];

//     allowedFields.forEach(field => {
//       if (updateData[field] !== undefined) {
//         if (field === 'startDate' || field === 'endDate') {
//           budgetCode[field] = updateData[field] ? new Date(updateData[field]) : null;
//         } else {
//           budgetCode[field] = updateData[field];
//         }
//       }
//     });

//     budgetCode.lastModifiedBy = req.user.userId;
//     await budgetCode.save();

//     res.json({
//       success: true,
//       message: 'Budget code updated successfully',
//       data: budgetCode
//     });

//   } catch (error) {
//     console.error('Update budget code error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update budget code',
//       error: error.message
//     });
//   }
// };

// /**
//  * Email notification helper functions
//  */
// const sendBudgetCodeApprovalEmail = async (approverEmail, creatorName, budgetCode, level) => {
//   try {
//     const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
//     const reviewLink = `${clientUrl}/approvals/budget-codes/${budgetCode._id}`;

//     const subject = `Budget Code Approval Required - ${budgetCode.code}`;
//     const html = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//         <h2 style="color: #1890ff;">Budget Code Approval Required</h2>
//         <p>Dear Approver,</p>
//         <p>A new budget code has been submitted and requires your approval at Level ${level}.</p>
        
//         <div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px;">
//           <h3>Budget Code Details:</h3>
//           <p><strong>Code:</strong> ${budgetCode.code}</p>
//           <p><strong>Name:</strong> ${budgetCode.name}</p>
//           <p><strong>Amount:</strong> XAF ${budgetCode.budget.toLocaleString()}</p>
//           <p><strong>Department:</strong> ${budgetCode.department}</p>
//           <p><strong>Type:</strong> ${budgetCode.budgetType}</p>
//           <p><strong>Created by:</strong> ${creatorName}</p>
//         </div>

//         <p style="text-align: center; margin: 30px 0;">
//           <a href="${reviewLink}" style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
//             Review Budget Code
//           </a>
//         </p>

//         <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
//       </div>
//     `;

//     await sendEmail({
//       to: approverEmail,
//       subject,
//       html
//     });

//     console.log(`Approval email sent to ${approverEmail}`);
//   } catch (error) {
//     console.error('Error sending budget code approval email:', error);
//   }
// };

// const sendBudgetCodeStatusUpdateEmail = async (employeeEmail, employeeName, budgetCode, status, level, approverName, comments = '') => {
//   try {
//     const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
//     const trackingLink = `${clientUrl}/budget-codes/${budgetCode._id}`;

//     const subject = `Budget Code ${status === 'approved' ? 'Approved' : 'Rejected'} - ${budgetCode.code}`;
//     const statusColor = status === 'approved' ? '#52c41a' : '#ff4d4f';
    
//     const html = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//         <h2 style="color: ${statusColor};">Budget Code ${status === 'approved' ? 'Approved' : 'Rejected'}</h2>
//         <p>Dear ${employeeName},</p>
//         <p>Your budget code has been ${status} at approval level ${level} by ${approverName}.</p>
        
//         <div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px;">
//           <p><strong>Code:</strong> ${budgetCode.code}</p>
//           <p><strong>Name:</strong> ${budgetCode.name}</p>
//           <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status.toUpperCase()}</span></p>
//           ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
//         </div>

//         <p style="text-align: center; margin: 30px 0;">
//           <a href="${trackingLink}" style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
//             View Budget Code
//           </a>
//         </p>
//       </div>
//     `;

//     await sendEmail({
//       to: employeeEmail,
//       subject,
//       html
//     });

//     console.log(`Status update email sent to ${employeeEmail}`);
//   } catch (error) {
//     console.error('Error sending budget code status update email:', error);
//   }
// };

// const sendBudgetCodeActivatedEmail = async (employeeEmail, employeeName, budgetCode) => {
//   try {
//     const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
//     const trackingLink = `${clientUrl}/budget-codes/${budgetCode._id}`;

//     const subject = `Budget Code Activated - ${budgetCode.code}`;
    
//     const html = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//         <h2 style="color: #52c41a;">Budget Code Successfully Activated</h2>
//         <p>Dear ${employeeName},</p>
//         <p>Congratulations! Your budget code has been fully approved and is now active.</p>
        
//         <div style="background-color: #f6ffed; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #52c41a;">
//           <h3>Budget Code Details:</h3>
//           <p><strong>Code:</strong> ${budgetCode.code}</p>
//           <p><strong>Name:</strong> ${budgetCode.name}</p>
//           <p><strong>Total Budget:</strong> XAF ${budgetCode.budget.toLocaleString()}</p>
//           <p><strong>Department:</strong> ${budgetCode.department}</p>
//           <p><strong>Status:</strong> <span style="color: #52c41a; font-weight: bold;">ACTIVE</span></p>
//         </div>

//         <p>You can now use this budget code for purchase requisitions and project allocations.</p>

//         <p style="text-align: center; margin: 30px 0;">
//           <a href="${trackingLink}" style="background-color: #52c41a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
//             View Active Budget Code
//           </a>
//         </p>
//       </div>
//     `;

//     await sendEmail({
//       to: employeeEmail,
//       subject,
//       html
//     });

//     console.log(`Activation email sent to ${employeeEmail}`);
//   } catch (error) {
//     console.error('Error sending budget code activation email:', error);
//   }
// };

// module.exports = {
//   createBudgetCode,
//   processBudgetCodeApprovalAction,
//   getPendingApprovals,
//   getBudgetCodes,
//   getBudgetCode,
//   updateBudgetCode
// };











// const BudgetCode = require('../models/BudgetCode');
// const PurchaseRequisition = require('../models/PurchaseRequisition');
// const User = require('../models/User');

// // Create new budget code
// const createBudgetCode = async (req, res) => {
//   try {
//     console.log('=== CREATE BUDGET CODE ===');
//     console.log('Request data:', req.body);
//     console.log('User:', req.user);

//     const {
//       code,
//       name,
//       description,
//       budget,
//       department,
//       budgetType,
//       budgetPeriod,
//       budgetOwner,
//       startDate,
//       endDate,
//       active = true
//     } = req.body;

//     console.log('Extracted fields:', {
//       code,
//       name,
//       description,
//       budget,
//       department,
//       budgetType,
//       budgetPeriod,
//       budgetOwner,
//       startDate,
//       endDate,
//       active
//     });

//     // Validate required fields
//     if (!code || !name || !budget || !department || !budgetType || !budgetPeriod || !budgetOwner) {
//       console.log('Missing required fields validation failed');
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: code, name, budget, department, budgetType, budgetPeriod, budgetOwner'
//       });
//     }

//     // Check if budget code already exists
//     const existingCode = await BudgetCode.findOne({ code: code.toUpperCase() });
//     if (existingCode) {
//       return res.status(400).json({
//         success: false,
//         message: 'Budget code already exists'
//       });
//     }

//     // Validate budget amount
//     if (budget <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Budget amount must be greater than zero'
//       });
//     }

//     // Create budget code
//     const budgetCode = new BudgetCode({
//       code: code.toUpperCase(),
//       name,
//       description,
//       budget: parseFloat(budget),
//       department,
//       budgetType,
//       budgetPeriod,
//       budgetOwner,
//       startDate: startDate ? new Date(startDate) : new Date(),
//       endDate: endDate ? new Date(endDate) : undefined,
//       active,
//       createdBy: req.user.userId,
//       approvedBy: req.user.userId
//     });

//     await budgetCode.save();

//     console.log('Budget code created successfully:', budgetCode._id);

//     res.status(201).json({
//       success: true,
//       message: 'Budget code created successfully',
//       data: budgetCode
//     });

//   } catch (error) {
//     console.error('Create budget code error:', error);
    
//     if (error.name === 'ValidationError') {
//       const validationErrors = Object.values(error.errors).map(err => err.message);
//       return res.status(400).json({
//         success: false,
//         message: `Validation error: ${validationErrors.join(', ')}`
//       });
//     }

//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: 'Budget code already exists'
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Failed to create budget code',
//       error: error.message
//     });
//   }
// };

// // Get all budget codes
// const getBudgetCodes = async (req, res) => {
//   try {
//     const { 
//       active, 
//       department, 
//       budgetType, 
//       utilizationThreshold,
//       page = 1, 
//       limit = 50 
//     } = req.query;

//     let filter = {};
    
//     // Apply filters
//     if (active !== undefined) filter.active = active === 'true';
//     if (department) filter.department = department;
//     if (budgetType) filter.budgetType = budgetType;

//     const budgetCodes = await BudgetCode.find(filter)
//       .populate('createdBy', 'fullName email')
//       .populate('approvedBy', 'fullName email')
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit);

//     // Apply utilization filter if specified
//     let filteredCodes = budgetCodes;
//     if (utilizationThreshold) {
//       const threshold = parseFloat(utilizationThreshold);
//       filteredCodes = budgetCodes.filter(code => code.utilizationPercentage >= threshold);
//     }

//     const total = await BudgetCode.countDocuments(filter);

//     res.json({
//       success: true,
//       data: filteredCodes,
//       pagination: {
//         current: parseInt(page),
//         total: Math.ceil(total / limit),
//         count: filteredCodes.length,
//         totalRecords: total
//       }
//     });

//   } catch (error) {
//     console.error('Get budget codes error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch budget codes',
//       error: error.message
//     });
//   }
// };

// // Get single budget code by ID or code
// const getBudgetCode = async (req, res) => {
//   try {
//     const { codeId } = req.params;
    
//     // Try to find by MongoDB ID first, then by budget code
//     let budgetCode = await BudgetCode.findById(codeId)
//       .populate('createdBy', 'fullName email')
//       .populate('approvedBy', 'fullName email')
//       .populate('allocations.requisitionId', 'title requisitionNumber employee');

//     if (!budgetCode) {
//       budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() })
//         .populate('createdBy', 'fullName email')
//         .populate('approvedBy', 'fullName email')
//         .populate('allocations.requisitionId', 'title requisitionNumber employee');
//     }

//     if (!budgetCode) {
//       return res.status(404).json({
//         success: false,
//         message: 'Budget code not found'
//       });
//     }

//     res.json({
//       success: true,
//       data: budgetCode
//     });

//   } catch (error) {
//     console.error('Get budget code error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch budget code',
//       error: error.message
//     });
//   }
// };

// // Update budget code
// const updateBudgetCode = async (req, res) => {
//   try {
//     const { codeId } = req.params;
//     const updateData = req.body;

//     console.log('=== UPDATE BUDGET CODE ===');
//     console.log('Code ID:', codeId);
//     console.log('Update data:', updateData);

//     // Find budget code
//     let budgetCode = await BudgetCode.findById(codeId);
//     if (!budgetCode) {
//       budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() });
//     }

//     if (!budgetCode) {
//       return res.status(404).json({
//         success: false,
//         message: 'Budget code not found'
//       });
//     }

//     // Check if user can update budget codes
//     const user = await User.findById(req.user.userId);
//     const canUpdate = 
//       user.role === 'admin' || 
//       user.role === 'finance' ||
//       user.email === 'ranibellmambo@gratoengineering.com';

//     if (!canUpdate) {
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied'
//       });
//     }

//     // Handle budget amount changes
//     if (updateData.budget && updateData.budget !== budgetCode.budget) {
//       const newBudget = parseFloat(updateData.budget);
//       const reason = updateData.budgetChangeReason || 'Budget adjustment';
      
//       // Validate new budget amount
//       if (newBudget < budgetCode.used) {
//         return res.status(400).json({
//           success: false,
//           message: `New budget amount cannot be less than already used amount (XAF ${budgetCode.used.toLocaleString()})`
//         });
//       }

//       await budgetCode.updateBudget(newBudget, reason, req.user.userId);
//     }

//     // Update other fields
//     const allowedFields = [
//       'name', 'description', 'department', 'budgetType', 
//       'budgetPeriod', 'budgetOwner', 'active', 'startDate', 'endDate'
//     ];

//     allowedFields.forEach(field => {
//       if (updateData[field] !== undefined) {
//         if (field === 'startDate' || field === 'endDate') {
//           budgetCode[field] = updateData[field] ? new Date(updateData[field]) : null;
//         } else {
//           budgetCode[field] = updateData[field];
//         }
//       }
//     });

//     await budgetCode.save();

//     console.log('Budget code updated successfully:', budgetCode._id);

//     res.json({
//       success: true,
//       message: 'Budget code updated successfully',
//       data: budgetCode
//     });

//   } catch (error) {
//     console.error('Update budget code error:', error);
    
//     if (error.name === 'ValidationError') {
//       const validationErrors = Object.values(error.errors).map(err => err.message);
//       return res.status(400).json({
//         success: false,
//         message: `Validation error: ${validationErrors.join(', ')}`
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Failed to update budget code',
//       error: error.message
//     });
//   }
// };

// // Delete budget code
// const deleteBudgetCode = async (req, res) => {
//   try {
//     const { codeId } = req.params;

//     // Find budget code
//     let budgetCode = await BudgetCode.findById(codeId);
//     if (!budgetCode) {
//       budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() });
//     }

//     if (!budgetCode) {
//       return res.status(404).json({
//         success: false,
//         message: 'Budget code not found'
//       });
//     }

//     // Check if budget code is in use
//     const activeAllocations = budgetCode.allocations.filter(alloc => alloc.status === 'allocated');
//     if (activeAllocations.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot delete budget code with active allocations'
//       });
//     }

//     // Check for requisitions using this budget code
//     const requisitionsUsingCode = await PurchaseRequisition.countDocuments({
//       'financeVerification.budgetCode': budgetCode.code
//     });

//     if (requisitionsUsingCode > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot delete budget code that is referenced by purchase requisitions'
//       });
//     }

//     await BudgetCode.findByIdAndDelete(budgetCode._id);

//     res.json({
//       success: true,
//       message: 'Budget code deleted successfully'
//     });

//   } catch (error) {
//     console.error('Delete budget code error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to delete budget code',
//       error: error.message
//     });
//   }
// };

// // Get budget code utilization report
// const getBudgetCodeUtilization = async (req, res) => {
//   try {
//     const { codeId } = req.params;
//     const { period = 'monthly', startDate, endDate } = req.query;

//     // Find budget code
//     let budgetCode = await BudgetCode.findById(codeId)
//       .populate('allocations.requisitionId', 'title requisitionNumber employee createdAt');
    
//     if (!budgetCode) {
//       budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() })
//         .populate('allocations.requisitionId', 'title requisitionNumber employee createdAt');
//     }

//     if (!budgetCode) {
//       return res.status(404).json({
//         success: false,
//         message: 'Budget code not found'
//       });
//     }

//     // Filter allocations by date range if specified
//     let allocations = budgetCode.allocations;
//     if (startDate || endDate) {
//       allocations = allocations.filter(alloc => {
//         const allocDate = alloc.allocationDate;
//         if (startDate && allocDate < new Date(startDate)) return false;
//         if (endDate && allocDate > new Date(endDate)) return false;
//         return true;
//       });
//     }

//     // Calculate utilization metrics
//     const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
//     const totalSpent = allocations.reduce((sum, alloc) => sum + (alloc.actualSpent || 0), 0);
    
//     // Group by period for trend analysis
//     const utilizationTrend = {};
//     allocations.forEach(alloc => {
//       const date = alloc.allocationDate;
//       let periodKey;
      
//       switch (period) {
//         case 'daily':
//           periodKey = date.toISOString().split('T')[0];
//           break;
//         case 'weekly':
//           const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
//           periodKey = weekStart.toISOString().split('T')[0];
//           break;
//         case 'monthly':
//           periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
//           break;
//         case 'quarterly':
//           const quarter = Math.ceil((date.getMonth() + 1) / 3);
//           periodKey = `${date.getFullYear()}-Q${quarter}`;
//           break;
//         default:
//           periodKey = date.toISOString().split('T')[0];
//       }

//       if (!utilizationTrend[periodKey]) {
//         utilizationTrend[periodKey] = {
//           allocated: 0,
//           spent: 0,
//           count: 0
//         };
//       }

//       utilizationTrend[periodKey].allocated += alloc.allocatedAmount;
//       utilizationTrend[periodKey].spent += (alloc.actualSpent || 0);
//       utilizationTrend[periodKey].count += 1;
//     });

//     const utilizationData = {
//       budgetCode: {
//         code: budgetCode.code,
//         name: budgetCode.name,
//         totalBudget: budgetCode.budget,
//         totalUsed: budgetCode.used,
//         utilizationPercentage: budgetCode.utilizationPercentage,
//         status: budgetCode.status
//       },
//       summary: {
//         totalAllocated,
//         totalSpent,
//         pendingAllocations: allocations.filter(a => a.status === 'allocated').length,
//         completedAllocations: allocations.filter(a => a.status === 'spent').length,
//         averageAllocation: allocations.length > 0 ? totalAllocated / allocations.length : 0
//       },
//       trend: utilizationTrend,
//       recentAllocations: allocations
//         .sort((a, b) => new Date(b.allocationDate) - new Date(a.allocationDate))
//         .slice(0, 10)
//     };

//     res.json({
//       success: true,
//       data: utilizationData,
//       period
//     });

//   } catch (error) {
//     console.error('Get budget code utilization error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch budget code utilization',
//       error: error.message
//     });
//   }
// };

// // Get budget codes requiring attention (high utilization, expiring, etc.)
// const getBudgetCodesRequiringAttention = async (req, res) => {
//   try {
//     const { threshold = 75 } = req.query;

//     // Get high utilization codes
//     const highUtilizationCodes = await BudgetCode.getRequiringAttention();

//     // Get expiring codes (within 30 days)
//     const thirtyDaysFromNow = new Date();
//     thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
//     const expiringCodes = await BudgetCode.find({
//       active: true,
//       endDate: { $lte: thirtyDaysFromNow, $gte: new Date() }
//     }).sort({ endDate: 1 });

//     // Get inactive codes with remaining budget
//     const inactiveWithBudget = await BudgetCode.find({
//       active: false,
//       $expr: { $gt: [{ $subtract: ["$budget", "$used"] }, 0] }
//     });

//     res.json({
//       success: true,
//       data: {
//         highUtilization: highUtilizationCodes,
//         expiringSoon: expiringCodes,
//         inactiveWithBudget: inactiveWithBudget,
//         summary: {
//           totalRequiringAttention: highUtilizationCodes.length + expiringCodes.length + inactiveWithBudget.length,
//           highUtilizationCount: highUtilizationCodes.length,
//           expiringCount: expiringCodes.length,
//           inactiveWithBudgetCount: inactiveWithBudget.length
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Get budget codes requiring attention error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch budget codes requiring attention',
//       error: error.message
//     });
//   }
// };

// // Get budget allocation report
// const getBudgetAllocationReport = async (req, res) => {
//   try {
//     const { 
//       department, 
//       budgetType, 
//       period = 'monthly',
//       startDate, 
//       endDate 
//     } = req.query;

//     let matchFilter = { active: true };
//     if (department) matchFilter.department = department;
//     if (budgetType) matchFilter.budgetType = budgetType;

//     // Date range for allocations
//     let dateFilter = {};
//     if (startDate) dateFilter.$gte = new Date(startDate);
//     if (endDate) dateFilter.$lte = new Date(endDate);

//     const allocationReport = await BudgetCode.aggregate([
//       { $match: matchFilter },
//       { $unwind: { path: "$allocations", preserveNullAndEmptyArrays: true } },
//       {
//         $match: {
//           ...(Object.keys(dateFilter).length > 0 && {
//             "allocations.allocationDate": dateFilter
//           })
//         }
//       },
//       {
//         $group: {
//           _id: {
//             department: "$department",
//             budgetType: "$budgetType"
//           },
//           totalBudget: { $sum: "$budget" },
//           totalUsed: { $sum: "$used" },
//           totalAllocated: { $sum: "$allocations.allocatedAmount" },
//           totalSpent: { $sum: "$allocations.actualSpent" },
//           budgetCodes: { $addToSet: "$code" },
//           allocationCount: { $sum: { $cond: [{ $ifNull: ["$allocations", false] }, 1, 0] } }
//         }
//       },
//       {
//         $addFields: {
//           utilizationRate: {
//             $cond: {
//               if: { $eq: ["$totalBudget", 0] },
//               then: 0,
//               else: { $multiply: [{ $divide: ["$totalUsed", "$totalBudget"] }, 100] }
//             }
//           },
//           remainingBudget: { $subtract: ["$totalBudget", "$totalUsed"] }
//         }
//       },
//       { $sort: { "_id.department": 1, "_id.budgetType": 1 } }
//     ]);

//     // Calculate totals
//     const totals = allocationReport.reduce((acc, item) => ({
//       totalBudget: acc.totalBudget + item.totalBudget,
//       totalUsed: acc.totalUsed + item.totalUsed,
//       totalAllocated: acc.totalAllocated + (item.totalAllocated || 0),
//       totalSpent: acc.totalSpent + (item.totalSpent || 0),
//       allocationCount: acc.allocationCount + item.allocationCount
//     }), {
//       totalBudget: 0,
//       totalUsed: 0,
//       totalAllocated: 0,
//       totalSpent: 0,
//       allocationCount: 0
//     });

//     res.json({
//       success: true,
//       data: {
//         report: allocationReport,
//         totals: {
//           ...totals,
//           overallUtilizationRate: totals.totalBudget > 0 ? 
//             Math.round((totals.totalUsed / totals.totalBudget) * 100) : 0,
//           remainingBudget: totals.totalBudget - totals.totalUsed
//         },
//         period,
//         filters: { department, budgetType, startDate, endDate }
//       }
//     });

//   } catch (error) {
//     console.error('Get budget allocation report error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch budget allocation report',
//       error: error.message
//     });
//   }
// };

// // Allocate budget to purchase requisition
// const allocateBudgetToRequisition = async (req, res) => {
//   try {
//     const { codeId } = req.params;
//     const { requisitionId, amount } = req.body;

//     console.log('=== ALLOCATE BUDGET TO REQUISITION ===');
//     console.log('Budget Code ID:', codeId);
//     console.log('Requisition ID:', requisitionId);
//     console.log('Amount:', amount);

//     // Find budget code
//     let budgetCode = await BudgetCode.findById(codeId);
//     if (!budgetCode) {
//       budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() });
//     }

//     if (!budgetCode) {
//       return res.status(404).json({
//         success: false,
//         message: 'Budget code not found'
//       });
//     }

//     // Find requisition
//     const requisition = await PurchaseRequisition.findById(requisitionId);
//     if (!requisition) {
//       return res.status(404).json({
//         success: false,
//         message: 'Purchase requisition not found'
//       });
//     }

//     // Check if allocation already exists
//     const existingAllocation = budgetCode.allocations.find(
//       alloc => alloc.requisitionId.equals(requisitionId)
//     );

//     if (existingAllocation) {
//       return res.status(400).json({
//         success: false,
//         message: 'Budget already allocated to this requisition'
//       });
//     }

//     // Allocate budget
//     await budgetCode.allocateBudget(requisitionId, parseFloat(amount));

//     // Update requisition with budget allocation
//     if (!requisition.financeVerification) {
//       requisition.financeVerification = {};
//     }
//     requisition.financeVerification.budgetCode = budgetCode.code;
//     requisition.financeVerification.assignedBudget = parseFloat(amount);
//     await requisition.save();

//     console.log('Budget allocated successfully');

//     res.json({
//       success: true,
//       message: 'Budget allocated successfully',
//       data: {
//         budgetCode: budgetCode.code,
//         allocatedAmount: amount,
//         remainingBudget: budgetCode.remaining
//       }
//     });

//   } catch (error) {
//     console.error('Allocate budget error:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message || 'Failed to allocate budget',
//       error: error.message
//     });
//   }
// };

// module.exports = {
//   createBudgetCode,
//   getBudgetCodes,
//   getBudgetCode,
//   updateBudgetCode,
//   deleteBudgetCode,
//   getBudgetCodeUtilization,
//   getBudgetCodesRequiringAttention,
//   getBudgetAllocationReport,
//   allocateBudgetToRequisition
// };

// // Get available budget codes for project assignment
// const getAvailableBudgetCodes = async (req, res) => {
//   try {
//     console.log('=== GET AVAILABLE BUDGET CODES FOR PROJECTS ===');

//     // Get budget codes with some remaining budget and are active
//     const budgetCodes = await BudgetCode.find({
//       active: true,
//       $expr: { $gt: ['$remaining', 0] } // Only budget codes with remaining amount > 0
//     })
//     .select('code name department budgetType budget used remaining utilizationRate description startDate endDate')
//     .sort({ department: 1, name: 1 });

//     // Transform to match frontend expectations
//     const transformedBudgetCodes = budgetCodes.map(code => ({
//       _id: code._id,
//       code: code.code,
//       name: code.name,
//       department: code.department,
//       budgetType: code.budgetType,
//       totalBudget: code.budget,
//       used: code.used,
//       available: code.remaining,
//       utilizationRate: code.utilizationRate,
//       status: code.active ? 'active' : 'inactive',
//       description: code.description,
//       startDate: code.startDate,
//       endDate: code.endDate
//     }));

//     console.log(`Found ${transformedBudgetCodes.length} available budget codes`);

//     res.json({
//       success: true,
//       data: transformedBudgetCodes
//     });

//   } catch (error) {
//     console.error('Get available budget codes error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch available budget codes',
//       error: error.message
//     });
//   }
// };

// module.exports = {
//   createBudgetCode,
//   getBudgetCodes,
//   getBudgetCode,
//   updateBudgetCode,
//   deleteBudgetCode,
//   getBudgetCodeUtilization,
//   getBudgetCodesRequiringAttention,
//   getBudgetAllocationReport,
//   allocateBudgetToRequisition,
//   getAvailableBudgetCodes
// };


