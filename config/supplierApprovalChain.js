const SUPPLIER_APPROVAL_CHAINS = {
  // NEW SIMPLIFIED WORKFLOW: Department Head → Head of Business only
  'HSE': [
    {
      level: 1,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Refurbishment': [
    {
      level: 1,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', // Department head
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', // Head of Business
      department: 'Business Development & Supply Chain'
    }
  ],

  'Project': [
    {
      level: 1,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Operations': [
    {
      level: 1,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Diesel': [
    {
      level: 1,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Supply Chain': [
    {
      level: 1,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain',
      department: 'Business Development & Supply Chain'
    }
  ],

  'HR & Admin': [
    {
      level: 1,
      approver: 'Mrs. Bruiline Tsitoh',
      email: 'bruiline.tsitoh@gratoglobal.com',
      role: 'HR & Admin Head', 
      department: 'HR & Admin'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'General': [
    {
      level: 1,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  // Department-based assignments (simplified)
  'Technical': [
    {
      level: 1,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Business Development & Supply Chain': [
    {
      level: 1,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Finance': [
    {
      level: 1,
      approver: 'Ms. Ranibell Mambo',
      email: 'ranibell.mambo@gratoglobal.com',
      role: 'Finance Head', 
      department: 'Finance'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ]
};

// Helper function to get approval chain based on service category and department
const getSupplierApprovalChain = (assignedDepartment, serviceCategory) => {
  console.log(`Getting supplier approval chain for: Department: ${assignedDepartment}, Service Category: ${serviceCategory}`);
  
  // Priority 1: Service category specific chains (these have supervisors → department heads → Kelvin)
  if (serviceCategory && SUPPLIER_APPROVAL_CHAINS[serviceCategory]) {
    console.log(`Found service category chain for: ${serviceCategory}`);
    return SUPPLIER_APPROVAL_CHAINS[serviceCategory];
  }
  
  // Priority 2: Department specific chains (for when no specific service category chain exists)
  if (assignedDepartment && SUPPLIER_APPROVAL_CHAINS[assignedDepartment]) {
    console.log(`Found department chain for: ${assignedDepartment}`);
    return SUPPLIER_APPROVAL_CHAINS[assignedDepartment];
  }
  
  // Handle department name variations
  const departmentMapping = {
    'HR & Admin': 'HR & Admin',
    'HR/Admin': 'HR & Admin',
    'Technical': 'Technical',
    'Business Development': 'Business Development & Supply Chain',
    'Business Dev': 'Business Development & Supply Chain',
    'Supply Chain': 'Business Development & Supply Chain', 
    'Finance': 'Finance'
  };
  
  const mappedDepartment = departmentMapping[assignedDepartment];
  if (mappedDepartment && SUPPLIER_APPROVAL_CHAINS[mappedDepartment]) {
    console.log(`Found mapped department chain: ${assignedDepartment} → ${mappedDepartment}`);
    return SUPPLIER_APPROVAL_CHAINS[mappedDepartment];
  }
  
  // Fall back to General (Kelvin only)
  console.log(`No specific chain found, using General chain (Kelvin only)`);
  return SUPPLIER_APPROVAL_CHAINS['General'];
};

// Get all service categories
const getServiceCategories = () => {
  return Object.keys(SUPPLIER_APPROVAL_CHAINS)
    .filter(key => !['General', 'Technical', 'Business Development & Supply Chain', 'Finance'].includes(key))
    .map(key => ({
      key,
      name: key,
      approvalLevels: SUPPLIER_APPROVAL_CHAINS[key].length,
      approvers: SUPPLIER_APPROVAL_CHAINS[key].map(step => step.approver),
      hierarchy: SUPPLIER_APPROVAL_CHAINS[key].map(step => `L${step.level}: ${step.role}`)
    }));
};

// Get approvers for a specific service category
const getApproversForCategory = (serviceCategory) => {
  const chain = SUPPLIER_APPROVAL_CHAINS[serviceCategory];
  if (!chain) return [];
  
  return chain.map(step => ({
    level: step.level,
    name: step.approver,
    email: step.email,
    role: step.role,
    department: step.department,
    hierarchy: step.level === 1 ? 'Department Head' : 
               step.level === 2 ? 'Head of Business' : 'Approver'
  }));
};

// Get all unique approvers across all supplier chains
const getAllSupplierApprovers = () => {
  const approvers = new Map();
  
  Object.values(SUPPLIER_APPROVAL_CHAINS).forEach(chain => {
    chain.forEach(step => {
      if (!approvers.has(step.email)) {
        approvers.set(step.email, {
          name: step.approver,
          email: step.email,
          role: step.role,
          department: step.department,
          categories: [step]
        });
      } else {
        approvers.get(step.email).categories.push(step);
      }
    });
  });
  
  return Array.from(approvers.values());
};

// Check if user is a supplier approver
const isSupplierApprover = (userEmail) => {
  return Object.values(SUPPLIER_APPROVAL_CHAINS).some(chain =>
    chain.some(step => step.email === userEmail)
  );
};

// Get categories that a user can approve
const getCategoriesForApprover = (userEmail) => {
  const categories = [];
  
  Object.entries(SUPPLIER_APPROVAL_CHAINS).forEach(([category, chain]) => {
    const approverStep = chain.find(step => step.email === userEmail);
    if (approverStep) {
      categories.push({
        category,
        level: approverStep.level,
        role: approverStep.role,
        department: approverStep.department,
        hierarchy: approverStep.level === 1 ? 'Department Head' : 
                  approverStep.level === 2 ? 'Head of Business' : 'Approver'
      });
    }
  });
  
  return categories;
};

// Get next approver in chain for a specific category
const getNextApproverInChain = (serviceCategory, currentLevel) => {
  const chain = SUPPLIER_APPROVAL_CHAINS[serviceCategory];
  if (!chain) return null;
  
  return chain.find(step => step.level === currentLevel + 1) || null;
};

// Validate service category
const isValidServiceCategory = (category) => {
  return Object.keys(SUPPLIER_APPROVAL_CHAINS).includes(category);
};

// Get approval chain summary for dashboard
const getApprovalChainSummary = () => {
  const summary = {};
  
  Object.entries(SUPPLIER_APPROVAL_CHAINS).forEach(([category, chain]) => {
    summary[category] = {
      levels: chain.length,
      approvers: chain.map(step => ({
        level: step.level,
        name: step.approver,
        role: step.role,
        department: step.department,
        hierarchy: step.level === 1 ? 'Department Head' : 
                  step.level === 2 ? 'Head of Business' : 'Approver'
      })),
      finalApprover: chain[chain.length - 1]?.approver || 'Unknown',
      workflow: chain.length === 1 ? 'Direct Head of Business Approval' :
               chain.length === 2 ? 'Department Head → Head of Business' : 'Multi-level'
    };
  });
  
  return summary;
};

// Get approval hierarchy explanation
const getApprovalHierarchy = () => {
  return {
    description: "NEW SUPPLIER INVOICE APPROVAL: Simplified 2-level workflow",
    levels: {
      1: {
        title: "Department Head Level", 
        description: "Department heads provide initial approval for invoices in their department",
        examples: ["Technical Director", "HR & Admin Head", "Finance Head", "Head of Business Dev & Supply Chain"]
      },
      2: {
        title: "Head of Business Level",
        description: "Head of Business Dev & Supply Chain provides final approval before finance processing",
        examples: ["Head of Business Dev & Supply Chain (Mr. E.T Kelvin)"]
      }
    },
    workflow: "Finance assigns to department → Department Head approves → Head of Business approves → Finance processes",
    specialCases: {
      "Supply Chain & Business Development": "Single level approval - direct to Head of Business Dev & Supply Chain",
      "General": "Direct approval by Head of Business Dev & Supply Chain for uncategorized invoices"
    }
  };
};

module.exports = {
  SUPPLIER_APPROVAL_CHAINS,
  getSupplierApprovalChain,
  getServiceCategories,
  getApproversForCategory,
  getAllSupplierApprovers,
  isSupplierApprover,
  getCategoriesForApprover,
  getNextApproverInChain,
  isValidServiceCategory,
  getApprovalChainSummary,
  getApprovalHierarchy
};




