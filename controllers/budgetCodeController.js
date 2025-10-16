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




