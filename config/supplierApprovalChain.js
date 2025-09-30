const SUPPLIER_APPROVAL_CHAINS = {
  'HSE': [
    {
      level: 1,
      approver: 'Mr. Ovo Bechem',
      email: 'bechem.mbu@gratoglobal.com',
      role: 'HSE Coordinator', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 3,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Refurbishment': [
    {
      level: 1,
      approver: 'Mr. verla Ivo',
      email: 'verla.ivo@gratoengineering.com',
      role: 'Head of Refurbishment', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', // This is the department head
      department: 'Technical'
    },
    {
      level: 3,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', // Final approver
      department: 'Business Development & Supply Chain'
    }
  ],

  'Project': [
    {
      level: 1,
      approver: 'Mr. Joel Wamba',
      email: 'joel@gratoengineering.com',
      role: 'Project Manager', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 3,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Operations': [
    {
      level: 1,
      approver: 'Mr. Pascal Assam',
      email: 'pascal.rodrique@gratoglobal.com',
      role: 'Operations Manager', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 3,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Diesel': [
    {
      level: 1,
      approver: 'Mr. Kevin Minka',
      email: 'minka.kevin@gratoglobal.com',
      role: 'Diesel Coordinator', 
      department: 'Technical'
    },
    {
      level: 2,
      approver: 'Mr. Didier Oyong',
      email: 'didier.oyong@gratoengineering.com',
      role: 'Technical Director', 
      department: 'Technical'
    },
    {
      level: 3,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain', 
      department: 'Business Development & Supply Chain'
    }
  ],

  'Supply Chain': [
    {
      level: 1,
      approver: 'Mr. Lukong Lambert',
      email: 'lukong.lambert@gratoglobal.com',
      role: 'Supply Chain Coordinator', 
      department: 'Business Development & Supply Chain'
    },
    {
      level: 2,
      approver: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Dev & Supply Chain',
      department: 'Business Development & Supply Chain'
    }
  ],

  'HR & Admin': [
    {
      level: 1,
      approver: 'Ms. Cristabel Mangwi',
      email: 'marcel.ngong@gratoglobal.com',
      role: 'Order Management Assistant', 
      department: 'Business Development & Supply Chain'
    },
    {
      level: 2,
      approver: 'Mrs. Bruiline Tsitoh',
      email: 'bruiline.tsitoh@gratoglobal.com',
      role: 'HR & Admin Head', 
      department: 'HR & Admin'
    },
    {
      level: 3,
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

  // New chains for department-based assignments
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
      approver: 'Mr. Lukong Lambert',
      email: 'lukong.lambert@gratoglobal.com',
      role: 'Supply Chain Coordinator', 
      department: 'Business Development & Supply Chain'
    },
    {
      level: 2,
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
    hierarchy: step.level === 1 ? 'Supervisor' : 
               step.level === 2 && step.role.includes('Director') || step.role.includes('Head') ? 'Department Head' :
               step.level === 3 || step.email === 'kelvin.eyong@gratoglobal.com' ? 'Final Approver' : 'Approver'
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
        hierarchy: approverStep.level === 1 ? 'Supervisor' : 
                  approverStep.level === 2 && (approverStep.role.includes('Director') || approverStep.role.includes('Head')) ? 'Department Head' :
                  approverStep.level === 3 || approverStep.email === 'kelvin.eyong@gratoglobal.com' ? 'Final Approver' : 'Approver'
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
        hierarchy: step.level === 1 ? 'Supervisor' : 
                  step.level === 2 && (step.role.includes('Director') || step.role.includes('Head')) ? 'Department Head' :
                  step.level === 3 || step.email === 'kelvin.eyong@gratoglobal.com' ? 'Final Approver' : 'Approver'
      })),
      finalApprover: chain[chain.length - 1]?.approver || 'Unknown',
      workflow: chain.length === 1 ? 'Direct Approval' :
               chain.length === 2 ? 'Supervisor → Final' :
               chain.length === 3 ? 'Supervisor → Department Head → Final' : 'Multi-level'
    };
  });
  
  return summary;
};

// Get approval hierarchy explanation
const getApprovalHierarchy = () => {
  return {
    description: "Supplier invoice approval follows a hierarchical structure:",
    levels: {
      1: {
        title: "Supervisor Level", 
        description: "First line supervisors/coordinators review invoices in their area of expertise",
        examples: ["HSE Coordinator", "Project Manager", "Operations Manager", "Diesel Coordinator", "Supply Chain Coordinator"]
      },
      2: {
        title: "Department Head Level",
        description: "Department heads provide departmental approval after supervisor review", 
        examples: ["Technical Director", "HR & Admin Head", "Finance Head"]
      },
      3: {
        title: "Final Approval Level",
        description: "Head of Business Dev & Supply Chain provides final approval for most invoices",
        examples: ["Head of Business Dev & Supply Chain (Mr. E.T Kelvin)"]
      }
    },
    specialCases: {
      "Supply Chain": "Only 2 levels: Coordinator → Department Head (who is also final approver)",
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




