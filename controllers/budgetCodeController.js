const BudgetCode = require('../models/BudgetCode');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const User = require('../models/User');

// Create new budget code
const createBudgetCode = async (req, res) => {
  try {
    console.log('=== CREATE BUDGET CODE ===');
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
      endDate,
      active = true
    } = req.body;

    console.log('Extracted fields:', {
      code,
      name,
      description,
      budget,
      department,
      budgetType,
      budgetPeriod,
      budgetOwner,
      startDate,
      endDate,
      active
    });

    // Validate required fields
    if (!code || !name || !budget || !department || !budgetType || !budgetPeriod || !budgetOwner) {
      console.log('Missing required fields validation failed');
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
      active,
      createdBy: req.user.userId,
      approvedBy: req.user.userId
    });

    await budgetCode.save();

    console.log('Budget code created successfully:', budgetCode._id);

    res.status(201).json({
      success: true,
      message: 'Budget code created successfully',
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

// Get all budget codes
const getBudgetCodes = async (req, res) => {
  try {
    const { 
      active, 
      department, 
      budgetType, 
      utilizationThreshold,
      page = 1, 
      limit = 50 
    } = req.query;

    let filter = {};
    
    // Apply filters
    if (active !== undefined) filter.active = active === 'true';
    if (department) filter.department = department;
    if (budgetType) filter.budgetType = budgetType;

    const budgetCodes = await BudgetCode.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Apply utilization filter if specified
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

// Get single budget code by ID or code
const getBudgetCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    
    // Try to find by MongoDB ID first, then by budget code
    let budgetCode = await BudgetCode.findById(codeId)
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('allocations.requisitionId', 'title requisitionNumber employee');

    if (!budgetCode) {
      budgetCode = await BudgetCode.findOne({ code: codeId.toUpperCase() })
        .populate('createdBy', 'fullName email')
        .populate('approvedBy', 'fullName email')
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

    console.log('=== UPDATE BUDGET CODE ===');
    console.log('Code ID:', codeId);
    console.log('Update data:', updateData);

    // Find budget code
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

    // Check if user can update budget codes
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
      
      // Validate new budget amount
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

    await budgetCode.save();

    console.log('Budget code updated successfully:', budgetCode._id);

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

    // Find budget code
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

    // Check for requisitions using this budget code
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

// Get budget code utilization report
const getBudgetCodeUtilization = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { period = 'monthly', startDate, endDate } = req.query;

    // Find budget code
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

    // Filter allocations by date range if specified
    let allocations = budgetCode.allocations;
    if (startDate || endDate) {
      allocations = allocations.filter(alloc => {
        const allocDate = alloc.allocationDate;
        if (startDate && allocDate < new Date(startDate)) return false;
        if (endDate && allocDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Calculate utilization metrics
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
    const totalSpent = allocations.reduce((sum, alloc) => sum + (alloc.actualSpent || 0), 0);
    
    // Group by period for trend analysis
    const utilizationTrend = {};
    allocations.forEach(alloc => {
      const date = alloc.allocationDate;
      let periodKey;
      
      switch (period) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarterly':
          const quarter = Math.ceil((date.getMonth() + 1) / 3);
          periodKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        default:
          periodKey = date.toISOString().split('T')[0];
      }

      if (!utilizationTrend[periodKey]) {
        utilizationTrend[periodKey] = {
          allocated: 0,
          spent: 0,
          count: 0
        };
      }

      utilizationTrend[periodKey].allocated += alloc.allocatedAmount;
      utilizationTrend[periodKey].spent += (alloc.actualSpent || 0);
      utilizationTrend[periodKey].count += 1;
    });

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
      trend: utilizationTrend,
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

// Get budget codes requiring attention (high utilization, expiring, etc.)
const getBudgetCodesRequiringAttention = async (req, res) => {
  try {
    const { threshold = 75 } = req.query;

    // Get high utilization codes
    const highUtilizationCodes = await BudgetCode.getRequiringAttention();

    // Get expiring codes (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringCodes = await BudgetCode.find({
      active: true,
      endDate: { $lte: thirtyDaysFromNow, $gte: new Date() }
    }).sort({ endDate: 1 });

    // Get inactive codes with remaining budget
    const inactiveWithBudget = await BudgetCode.find({
      active: false,
      $expr: { $gt: [{ $subtract: ["$budget", "$used"] }, 0] }
    });

    res.json({
      success: true,
      data: {
        highUtilization: highUtilizationCodes,
        expiringSoon: expiringCodes,
        inactiveWithBudget: inactiveWithBudget,
        summary: {
          totalRequiringAttention: highUtilizationCodes.length + expiringCodes.length + inactiveWithBudget.length,
          highUtilizationCount: highUtilizationCodes.length,
          expiringCount: expiringCodes.length,
          inactiveWithBudgetCount: inactiveWithBudget.length
        }
      }
    });

  } catch (error) {
    console.error('Get budget codes requiring attention error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget codes requiring attention',
      error: error.message
    });
  }
};

// Get budget allocation report
const getBudgetAllocationReport = async (req, res) => {
  try {
    const { 
      department, 
      budgetType, 
      period = 'monthly',
      startDate, 
      endDate 
    } = req.query;

    let matchFilter = { active: true };
    if (department) matchFilter.department = department;
    if (budgetType) matchFilter.budgetType = budgetType;

    // Date range for allocations
    let dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const allocationReport = await BudgetCode.aggregate([
      { $match: matchFilter },
      { $unwind: { path: "$allocations", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...(Object.keys(dateFilter).length > 0 && {
            "allocations.allocationDate": dateFilter
          })
        }
      },
      {
        $group: {
          _id: {
            department: "$department",
            budgetType: "$budgetType"
          },
          totalBudget: { $sum: "$budget" },
          totalUsed: { $sum: "$used" },
          totalAllocated: { $sum: "$allocations.allocatedAmount" },
          totalSpent: { $sum: "$allocations.actualSpent" },
          budgetCodes: { $addToSet: "$code" },
          allocationCount: { $sum: { $cond: [{ $ifNull: ["$allocations", false] }, 1, 0] } }
        }
      },
      {
        $addFields: {
          utilizationRate: {
            $cond: {
              if: { $eq: ["$totalBudget", 0] },
              then: 0,
              else: { $multiply: [{ $divide: ["$totalUsed", "$totalBudget"] }, 100] }
            }
          },
          remainingBudget: { $subtract: ["$totalBudget", "$totalUsed"] }
        }
      },
      { $sort: { "_id.department": 1, "_id.budgetType": 1 } }
    ]);

    // Calculate totals
    const totals = allocationReport.reduce((acc, item) => ({
      totalBudget: acc.totalBudget + item.totalBudget,
      totalUsed: acc.totalUsed + item.totalUsed,
      totalAllocated: acc.totalAllocated + (item.totalAllocated || 0),
      totalSpent: acc.totalSpent + (item.totalSpent || 0),
      allocationCount: acc.allocationCount + item.allocationCount
    }), {
      totalBudget: 0,
      totalUsed: 0,
      totalAllocated: 0,
      totalSpent: 0,
      allocationCount: 0
    });

    res.json({
      success: true,
      data: {
        report: allocationReport,
        totals: {
          ...totals,
          overallUtilizationRate: totals.totalBudget > 0 ? 
            Math.round((totals.totalUsed / totals.totalBudget) * 100) : 0,
          remainingBudget: totals.totalBudget - totals.totalUsed
        },
        period,
        filters: { department, budgetType, startDate, endDate }
      }
    });

  } catch (error) {
    console.error('Get budget allocation report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget allocation report',
      error: error.message
    });
  }
};

// Allocate budget to purchase requisition
const allocateBudgetToRequisition = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { requisitionId, amount } = req.body;

    console.log('=== ALLOCATE BUDGET TO REQUISITION ===');
    console.log('Budget Code ID:', codeId);
    console.log('Requisition ID:', requisitionId);
    console.log('Amount:', amount);

    // Find budget code
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

    // Find requisition
    const requisition = await PurchaseRequisition.findById(requisitionId);
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Purchase requisition not found'
      });
    }

    // Check if allocation already exists
    const existingAllocation = budgetCode.allocations.find(
      alloc => alloc.requisitionId.equals(requisitionId)
    );

    if (existingAllocation) {
      return res.status(400).json({
        success: false,
        message: 'Budget already allocated to this requisition'
      });
    }

    // Allocate budget
    await budgetCode.allocateBudget(requisitionId, parseFloat(amount));

    // Update requisition with budget allocation
    if (!requisition.financeVerification) {
      requisition.financeVerification = {};
    }
    requisition.financeVerification.budgetCode = budgetCode.code;
    requisition.financeVerification.assignedBudget = parseFloat(amount);
    await requisition.save();

    console.log('Budget allocated successfully');

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
  getBudgetCodes,
  getBudgetCode,
  updateBudgetCode,
  deleteBudgetCode,
  getBudgetCodeUtilization,
  getBudgetCodesRequiringAttention,
  getBudgetAllocationReport,
  allocateBudgetToRequisition
};

// Get available budget codes for project assignment
const getAvailableBudgetCodes = async (req, res) => {
  try {
    console.log('=== GET AVAILABLE BUDGET CODES FOR PROJECTS ===');

    // Get budget codes with some remaining budget and are active
    const budgetCodes = await BudgetCode.find({
      active: true,
      $expr: { $gt: ['$remaining', 0] } // Only budget codes with remaining amount > 0
    })
    .select('code name department budgetType budget used remaining utilizationRate description startDate endDate')
    .sort({ department: 1, name: 1 });

    // Transform to match frontend expectations
    const transformedBudgetCodes = budgetCodes.map(code => ({
      _id: code._id,
      code: code.code,
      name: code.name,
      department: code.department,
      budgetType: code.budgetType,
      totalBudget: code.budget,
      used: code.used,
      available: code.remaining,
      utilizationRate: code.utilizationRate,
      status: code.active ? 'active' : 'inactive',
      description: code.description,
      startDate: code.startDate,
      endDate: code.endDate
    }));

    console.log(`Found ${transformedBudgetCodes.length} available budget codes`);

    res.json({
      success: true,
      data: transformedBudgetCodes
    });

  } catch (error) {
    console.error('Get available budget codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available budget codes',
      error: error.message
    });
  }
};

module.exports = {
  createBudgetCode,
  getBudgetCodes,
  getBudgetCode,
  updateBudgetCode,
  deleteBudgetCode,
  getBudgetCodeUtilization,
  getBudgetCodesRequiringAttention,
  getBudgetAllocationReport,
  allocateBudgetToRequisition,
  getAvailableBudgetCodes
};


