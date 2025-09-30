const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

/**
 * Get cash request approval chain with 4-level hierarchy:
 * 1. Supervisor - immediate supervisor approval
 * 2. Departmental Head - department head approval  
 * 3. Head of Business - executive approval
 * 4. Finance - final approval and disbursement
 */
const getCashRequestApprovalChain = (employeeName, department) => {
  const chain = [];
  
  console.log(`Getting cash request approval chain for: ${employeeName} in ${department}`);

  // Find the employee in the department structure
  let employeeData = null;
  let employeeDepartmentName = department;

  // First check if the employee is a department head
  if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head === employeeName) {
    employeeData = {
      name: employeeName,
      email: DEPARTMENT_STRUCTURE[department].headEmail,
      position: 'Department Head',
      supervisor: 'President',
      department: department
    };
  } else {
    // Search for employee in all departments
    for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
      if (deptData.head === employeeName) {
        employeeData = {
          name: employeeName,
          email: deptData.headEmail,
          position: 'Department Head',
          supervisor: 'President',
          department: deptKey
        };
        employeeDepartmentName = deptKey;
        break;
      }

      if (deptData.positions) {
        for (const [pos, data] of Object.entries(deptData.positions)) {
          if (data.name === employeeName) {
            employeeData = { ...data, position: pos };
            employeeDepartmentName = deptKey;
            break;
          }
        }
      }

      if (employeeData) break;
    }
  }

  if (!employeeData) {
    console.warn(`Employee "${employeeName}" not found. Using fallback approval chain.`);
    return getFallbackApprovalChain(department);
  }

  // Level 1: Immediate Supervisor (if employee is not already a department head)
  if (employeeData.position !== 'Department Head') {
    const supervisor = findSupervisor(employeeData, employeeDepartmentName);
    if (supervisor) {
      chain.push({
        level: 1,
        approver: {
          name: supervisor.name,
          email: supervisor.email,
          role: 'Supervisor',
          department: supervisor.department || employeeDepartmentName
        },
        status: 'pending',
        assignedDate: new Date()
      });
    }
  }

  // Level 2: Departmental Head (if not already the department head and not already added)
  const deptHead = DEPARTMENT_STRUCTURE[employeeDepartmentName];
  if (deptHead && employeeData.name !== deptHead.head && !chain.find(step => step.approver.name === deptHead.head)) {
    chain.push({
      level: chain.length + 1,
      approver: {
        name: deptHead.head,
        email: deptHead.headEmail,
        role: 'Departmental Head',
        department: employeeDepartmentName
      },
      status: 'pending',
      assignedDate: new Date()
    });
  }

  // Level 3: Head of Business (President/Executive)
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

  // Level 4: Finance Officer (Final approval and disbursement)
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

  // Set only the first step as pending initially
  chain.forEach((step, index) => {
    if (index === 0) {
      step.status = 'pending';
    } else {
      step.status = 'pending'; // All steps are created as pending but only first is active
    }
  });

  console.log(`Cash request approval chain created with ${chain.length} levels:`,
    chain.map(step => `Level ${step.level}: ${step.approver.name} (${step.approver.role})`));

  return chain;
};

/**
 * Find immediate supervisor for an employee
 */
const findSupervisor = (employeeData, departmentName) => {
  if (!employeeData.supervisor) return null;

  const department = DEPARTMENT_STRUCTURE[departmentName];
  if (!department) return null;

  // Check if supervisor is in the same department
  if (department.positions) {
    for (const [pos, data] of Object.entries(department.positions)) {
      if (pos === employeeData.supervisor || data.name === employeeData.supervisor) {
        return {
          ...data,
          position: pos,
          department: departmentName
        };
      }
    }
  }

  // Check if supervisor is the department head
  if (department.head === employeeData.supervisor || employeeData.supervisor.includes('Head')) {
    return {
      name: department.head,
      email: department.headEmail,
      position: 'Department Head',
      department: departmentName
    };
  }

  return null;
};

/**
 * Fallback approval chain when employee is not found
 */
const getFallbackApprovalChain = (department) => {
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
 * Get the next status based on current approval level
 */
const getNextApprovalStatus = (currentLevel, totalLevels) => {
  switch (currentLevel) {
    case 1:
      return 'pending_departmental_head';
    case 2:
      return 'pending_head_of_business';
    case 3:
      return 'pending_finance';
    case 4:
      return 'approved'; // Ready for disbursement
    default:
      return 'approved';
  }
};

/**
 * Map user roles to their approval authority levels
 */
const getUserApprovalLevel = (userRole, userEmail) => {
  // Finance has final authority (Level 4)
  if (userRole === 'finance') return 4;
  
  // Admin can handle both departmental head (Level 2) and head of business (Level 3)
  if (userRole === 'admin') {
    // Check if this admin is the head of business (President)
    const executive = DEPARTMENT_STRUCTURE['Executive'];
    if (executive && executive.headEmail === userEmail) {
      return 3; // Head of Business level
    }
    return 2; // Departmental Head level
  }
  
  // Supervisor handles immediate supervisor approval (Level 1)
  if (userRole === 'supervisor') return 1;
  
  return 0; // No approval authority
};

/**
 * Check if a user can approve a request at a specific level
 */
const canUserApproveAtLevel = (user, approvalStep) => {
  if (!user || !approvalStep) return false;
  
  // Check if user email matches the approver email
  if (user.email !== approvalStep.approver.email) return false;
  
  // Check if user role matches the required role for this level
  const userApprovalLevel = getUserApprovalLevel(user.role, user.email);
  
  // Map approval step roles to levels based on new role names
  const stepLevelMap = {
    'Supervisor': 1,
    'Departmental Head': 2,
    'Head of Business': 3,
    'Finance Officer': 4
  };
  
  const requiredLevel = stepLevelMap[approvalStep.approver.role];
  
  // For admin users, check if they can handle this specific level
  if (user.role === 'admin') {
    // Admin can handle Level 2 (Departmental Head) and Level 3 (Head of Business)
    return requiredLevel === 2 || requiredLevel === 3;
  }
  
  // For other roles, check if user level matches required level
  return userApprovalLevel === requiredLevel;
};

module.exports = {
  getCashRequestApprovalChain,
  getNextApprovalStatus,
  getUserApprovalLevel,
  canUserApproveAtLevel,
  findSupervisor,
  getFallbackApprovalChain
};
