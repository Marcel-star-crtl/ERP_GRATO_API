const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

/**
 * Get budget code approval chain with 3-level hierarchy:
 * 1. Departmental Head - department head approval
 * 2. Head of Business - executive approval  
 * 3. Finance - final approval and activation
 */
const getBudgetCodeApprovalChain = (creatorName, department, budgetType = 'departmental') => {
  const chain = [];
  
  console.log(`Getting budget code approval chain for: ${creatorName} in ${department}, type: ${budgetType}`);

  // Find the creator in the department structure
  let creatorData = null;
  let creatorDepartmentName = department;

  // First check if the creator is a department head
  if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head === creatorName) {
    creatorData = {
      name: creatorName,
      email: DEPARTMENT_STRUCTURE[department].headEmail,
      position: 'Department Head',
      department: department
    };
  } else {
    // Search for creator in all departments
    for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
      if (deptData.head === creatorName) {
        creatorData = {
          name: creatorName,
          email: deptData.headEmail,
          position: 'Department Head',
          department: deptKey
        };
        creatorDepartmentName = deptKey;
        break;
      }

      if (deptData.positions) {
        for (const [pos, data] of Object.entries(deptData.positions)) {
          if (data.name === creatorName) {
            creatorData = { ...data, position: pos };
            creatorDepartmentName = deptKey;
            break;
          }
        }
      }

      if (creatorData) break;
    }
  }

  if (!creatorData) {
    console.warn(`Creator "${creatorName}" not found. Using fallback approval chain.`);
    return getFallbackBudgetCodeApprovalChain(department);
  }

  // Level 1: Departmental Head (if creator is not already the department head)
  const deptHead = DEPARTMENT_STRUCTURE[creatorDepartmentName];
  if (deptHead && creatorData.name !== deptHead.head) {
    chain.push({
      level: 1,
      approver: {
        name: deptHead.head,
        email: deptHead.headEmail,
        role: 'Departmental Head',
        department: creatorDepartmentName
      },
      status: 'pending',
      assignedDate: new Date()
    });
  }

  // Level 2: Head of Business (President/Executive)
  const executive = DEPARTMENT_STRUCTURE['Executive'];
  if (executive && !chain.find(step => step.approver.email === executive.headEmail)) {
    chain.push({
      level: chain.length + 1,
      approver: {
        name: executive.head,
        email: executive.headEmail,
        role: 'Head of Business',
        department: 'Executive'
      },
      status: 'pending',
      assignedDate: new Date()
    });
  }

  // Level 3: Finance Officer (Final approval and budget code activation)
  chain.push({
    level: chain.length + 1,
    approver: {
      name: 'Ms. Rambell Mambo',
      email: 'ranibellmambo@gratoengineering.com',
      role: 'Finance Officer',
      department: 'Business Development & Supply Chain'
    },
    status: 'pending',
    assignedDate: new Date()
  });

  // Set only the first step as active initially
  chain.forEach((step, index) => {
    if (index === 0) {
      step.status = 'pending';
    } else {
      step.status = 'pending'; // All steps are created as pending but only first is active
    }
  });

  console.log(`Budget code approval chain created with ${chain.length} levels:`,
    chain.map(step => `Level ${step.level}: ${step.approver.name} (${step.approver.role})`));

  return chain;
};

/**
 * Fallback approval chain when creator is not found
 */
const getFallbackBudgetCodeApprovalChain = (department) => {
  const chain = [];
  let level = 1;

  // Level 1: Department Head (if exists)
  if (DEPARTMENT_STRUCTURE[department]) {
    chain.push({
      level: level++,
      approver: {
        name: DEPARTMENT_STRUCTURE[department].head,
        email: DEPARTMENT_STRUCTURE[department].headEmail,
        role: 'Departmental Head',
        department: department
      },
      status: 'pending',
      assignedDate: new Date()
    });
  }

  // Level 2: Head of Business
  const executive = DEPARTMENT_STRUCTURE['Executive'];
  if (executive) {
    chain.push({
      level: level++,
      approver: {
        name: executive.head,
        email: executive.headEmail,
        role: 'Head of Business',
        department: 'Executive'
      },
      status: 'pending',
      assignedDate: new Date()
    });
  }

  // Level 3: Finance
  chain.push({
    level: level++,
    approver: {
      name: 'Ms. Rambell Mambo',
      email: 'ranibellmambo@gratoengineering.com',
      role: 'Finance Officer',
      department: 'Business Development & Supply Chain'
    },
    status: 'pending',
    assignedDate: new Date()
  });

  return chain;
};

/**
 * Get the next status based on current approval level for budget codes
 */
const getNextBudgetCodeStatus = (currentLevel, totalLevels) => {
  switch (currentLevel) {
    case 1:
      return 'pending_head_of_business';
    case 2:
      return 'pending_finance';
    case 3:
      return 'active'; // Budget code becomes active after all approvals
    default:
      return 'active';
  }
};

/**
 * Map user roles to their approval authority levels for budget codes
 */
const getUserBudgetCodeApprovalLevel = (userRole, userEmail) => {
  // Finance has final authority (Level 3) and can activate budget codes
  if (userRole === 'finance') return 3;
  
  // Admin can handle both departmental head (Level 1) and head of business (Level 2)
  if (userRole === 'admin') {
    // Check if this admin is the head of business (President)
    const executive = DEPARTMENT_STRUCTURE['Executive'];
    if (executive && executive.headEmail === userEmail) {
      return 2; // Head of Business level
    }
    return 1; // Departmental Head level
  }
  
  return 0; // No approval authority
};

/**
 * Check if a user can approve a budget code at a specific level
 */
const canUserApproveBudgetCode = (user, approvalStep) => {
  if (!user || !approvalStep) return false;
  
  // Check if user email matches the approver email
  if (user.email !== approvalStep.approver.email) return false;
  
  // Check if user role matches the required role for this level
  const userApprovalLevel = getUserBudgetCodeApprovalLevel(user.role, user.email);
  
  // Map approval step roles to levels
  const stepLevelMap = {
    'Departmental Head': 1,
    'Head of Business': 2,
    'Finance Officer': 3
  };
  
  const requiredLevel = stepLevelMap[approvalStep.approver.role];
  
  // For admin users, check if they can handle this specific level
  if (user.role === 'admin') {
    // Admin can handle Level 1 (Departmental Head) and Level 2 (Head of Business)
    return requiredLevel === 1 || requiredLevel === 2;
  }
  
  // For other roles, check if user level matches required level
  return userApprovalLevel === requiredLevel;
};

/**
 * Validate budget code approval permissions
 */
const validateBudgetCodeApproval = (user, budgetCode) => {
  if (!user || !budgetCode) {
    return {
      canApprove: false,
      reason: 'Missing user or budget code information'
    };
  }

  // Find the current pending approval step
  const currentStep = budgetCode.approvalChain?.find(step => step.status === 'pending');
  
  if (!currentStep) {
    return {
      canApprove: false,
      reason: 'No pending approval step found'
    };
  }

  // Check if user can approve at this level
  const canApprove = canUserApproveBudgetCode(user, currentStep);
  
  if (!canApprove) {
    return {
      canApprove: false,
      reason: `Only ${currentStep.approver.role} (${currentStep.approver.name}) can approve at this level`
    };
  }

  return {
    canApprove: true,
    currentLevel: currentStep.level,
    approverRole: currentStep.approver.role
  };
};

/**
 * Get budget code statistics by approval status
 */
const getBudgetCodeApprovalStats = (budgetCodes) => {
  const stats = {
    pending: 0,
    pending_departmental_head: 0,
    pending_head_of_business: 0,
    pending_finance: 0,
    active: 0,
    rejected: 0,
    total: budgetCodes.length
  };

  budgetCodes.forEach(code => {
    if (code.status === 'active') {
      stats.active++;
    } else if (code.status === 'rejected') {
      stats.rejected++;
    } else {
      stats.pending++;
      
      // Find current approval level
      const currentStep = code.approvalChain?.find(step => step.status === 'pending');
      if (currentStep) {
        switch (currentStep.level) {
          case 1:
            stats.pending_departmental_head++;
            break;
          case 2:
            stats.pending_head_of_business++;
            break;
          case 3:
            stats.pending_finance++;
            break;
        }
      }
    }
  });

  return stats;
};

module.exports = {
  getBudgetCodeApprovalChain,
  getNextBudgetCodeStatus,
  getUserBudgetCodeApprovalLevel,
  canUserApproveBudgetCode,
  validateBudgetCodeApproval,
  getBudgetCodeApprovalStats,
  getFallbackBudgetCodeApprovalChain
};




