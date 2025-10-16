// config/cashRequestApprovalChain.js - COMPLETELY FIXED VERSION

const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

/**
 * Get cash request approval chain with STRICT 4-level hierarchy:
 * Level 1: Immediate Supervisor
 * Level 2: Department Head
 * Level 3: Head of Business (President)
 * Level 4: Finance Officer (ALWAYS LAST)
 */
const getCashRequestApprovalChain = (employeeName, department) => {
  const chain = [];
  const seenEmails = new Set();
  
  console.log(`\n=== BUILDING CASH REQUEST APPROVAL CHAIN ===`);
  console.log(`Employee: ${employeeName}`);
  console.log(`Department: ${department}`);

  // Find employee
  let employeeData = null;
  let employeeDepartmentName = department;

  if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head === employeeName) {
    employeeData = {
      name: employeeName,
      email: DEPARTMENT_STRUCTURE[department].headEmail,
      position: 'Department Head',
      supervisor: 'President',
      department: department
    };
    console.log('✓ Employee is Department Head');
  } else {
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
        console.log(`✓ Employee is Department Head of ${deptKey}`);
        break;
      }

      if (deptData.positions) {
        for (const [pos, data] of Object.entries(deptData.positions)) {
          if (data.name === employeeName) {
            employeeData = { ...data, position: pos };
            employeeDepartmentName = deptKey;
            console.log(`✓ Found: ${pos} in ${deptKey}`);
            break;
          }
        }
      }
      if (employeeData) break;
    }
  }

  if (!employeeData) {
    console.warn(`⚠ Employee "${employeeName}" not found. Using fallback.`);
    return getFallbackApprovalChain(department);
  }

  // Helper to add unique approver
  const addApprover = (approverData, role) => {
    if (seenEmails.has(approverData.email)) {
      console.log(`⊘ Skip duplicate: ${approverData.name} (${approverData.email})`);
      return false;
    }

    const level = chain.length + 1;
    chain.push({
      level,
      approver: {
        name: approverData.name,
        email: approverData.email,
        role,
        department: approverData.department || employeeDepartmentName
      },
      status: 'pending',
      assignedDate: new Date()
    });

    seenEmails.add(approverData.email);
    console.log(`✓ Level ${level}: ${approverData.name} (${role}) - ${approverData.email}`);
    return true;
  };

  // LEVEL 1: Immediate Supervisor (if not department head)
  if (employeeData.position !== 'Department Head') {
    const supervisor = findSupervisor(employeeData, employeeDepartmentName);
    if (supervisor) {
      addApprover(supervisor, 'Supervisor');
    }
  }

  // LEVEL 2: Department Head (if different from employee and supervisor)
  const deptHead = DEPARTMENT_STRUCTURE[employeeDepartmentName];
  if (deptHead && employeeData.name !== deptHead.head) {
    addApprover({
      name: deptHead.head,
      email: deptHead.headEmail,
      department: employeeDepartmentName
    }, 'Departmental Head');
  }

  // LEVEL 3: Head of Business / President (if different from above)
  const executive = DEPARTMENT_STRUCTURE['Executive'];
  if (executive) {
    addApprover({
      name: executive.head,
      email: executive.headEmail,
      department: 'Executive'
    }, 'Head of Business');
  }

  // LEVEL 4: Finance Officer (ALWAYS LAST - NEVER SKIP)
  const financeEmail = 'ranibellmambo@gratoengineering.com';
  if (!seenEmails.has(financeEmail)) {
    const finalLevel = chain.length + 1;
    chain.push({
      level: finalLevel,
      approver: {
        name: 'Ms. Ranibell Mambo',
        email: financeEmail,
        role: 'Finance Officer',
        department: 'Business Development & Supply Chain'
      },
      status: 'pending',
      assignedDate: new Date()
    });
    seenEmails.add(financeEmail);
    console.log(`✓ Level ${finalLevel}: Ms. Ranibell Mambo (Finance Officer) - ${financeEmail}`);
  }

  // CRITICAL: Renumber to ensure sequential levels
  chain.forEach((step, index) => {
    step.level = index + 1;
  });

  const finalChain = chain.map(s => `L${s.level}: ${s.approver.name} (${s.approver.role})`).join(' → ');
  console.log(`\n✅ Final Chain (${chain.length} levels): ${finalChain}`);
  console.log('=== END APPROVAL CHAIN ===\n');

  return chain;
};

const findSupervisor = (employeeData, departmentName) => {
  if (!employeeData.supervisor) return null;

  const department = DEPARTMENT_STRUCTURE[departmentName];
  if (!department) return null;

  // Check in positions
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

  // Check if supervisor is department head
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

const getFallbackApprovalChain = (department) => {
  const chain = [];
  const seenEmails = new Set();
  let level = 1;

  // Department Head
  if (DEPARTMENT_STRUCTURE[department]) {
    const email = DEPARTMENT_STRUCTURE[department].headEmail;
    if (!seenEmails.has(email)) {
      chain.push({
        level: level++,
        approver: {
          name: DEPARTMENT_STRUCTURE[department].head,
          email,
          role: 'Departmental Head',
          department
        },
        status: 'pending',
        assignedDate: new Date()
      });
      seenEmails.add(email);
    }
  }

  // President
  const executive = DEPARTMENT_STRUCTURE['Executive'];
  if (executive && !seenEmails.has(executive.headEmail)) {
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
    seenEmails.add(executive.headEmail);
  }

  // Finance (ALWAYS LAST)
  const financeEmail = 'ranibellmambo@gratoengineering.com';
  if (!seenEmails.has(financeEmail)) {
    chain.push({
      level: level++,
      approver: {
        name: 'Ms. Ranibell Mambo',
        email: financeEmail,
        role: 'Finance Officer',
        department: 'Business Development & Supply Chain'
      },
      status: 'pending',
      assignedDate: new Date()
    });
  }

  return chain;
};

const getNextApprovalStatus = (currentLevel, totalLevels) => {
  // Map based on what level was just approved
  if (currentLevel === totalLevels) {
    return 'approved'; // All levels approved
  }
  
  // Determine next status based on next level
  const nextLevel = currentLevel + 1;
  
  const statusMap = {
    1: 'pending_supervisor',
    2: 'pending_departmental_head',
    3: 'pending_head_of_business',
    4: 'pending_finance'
  };
  
  return statusMap[nextLevel] || 'pending_finance';
};

const getUserApprovalLevel = (userRole, userEmail) => {
  if (userRole === 'finance') return 4;
  
  if (userRole === 'admin') {
    const executive = DEPARTMENT_STRUCTURE['Executive'];
    if (executive && executive.headEmail === userEmail) {
      return 3;
    }
    return 2;
  }
  
  if (userRole === 'supervisor') return 1;
  
  return 0;
};

const canUserApproveAtLevel = (user, approvalStep) => {
  if (!user || !approvalStep) return false;
  if (user.email !== approvalStep.approver.email) return false;
  
  const userApprovalLevel = getUserApprovalLevel(user.role, user.email);
  
  const stepLevelMap = {
    'Supervisor': 1,
    'Departmental Head': 2,
    'Head of Business': 3,
    'Finance Officer': 4
  };
  
  const requiredLevel = stepLevelMap[approvalStep.approver.role];
  
  if (user.role === 'admin') {
    return requiredLevel === 2 || requiredLevel === 3;
  }
  
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












// // config/cashRequestApprovalChain.js - FIXED VERSION

// const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

// /**
//  * Get cash request approval chain with 4-level hierarchy
//  * FIXED: Prevents duplicate approvers in chain
//  */
// const getCashRequestApprovalChain = (employeeName, department) => {
//   const chain = [];
//   const seenEmails = new Set(); // Track emails to prevent duplicates
  
//   console.log(`\n=== BUILDING APPROVAL CHAIN ===`);
//   console.log(`Employee: ${employeeName}`);
//   console.log(`Department: ${department}`);

//   // Find the employee in the department structure
//   let employeeData = null;
//   let employeeDepartmentName = department;

//   // First check if the employee is a department head
//   if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head === employeeName) {
//     employeeData = {
//       name: employeeName,
//       email: DEPARTMENT_STRUCTURE[department].headEmail,
//       position: 'Department Head',
//       supervisor: 'President',
//       department: department
//     };
//     console.log('✓ Employee is a Department Head');
//   } else {
//     // Search for employee in all departments
//     for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
//       if (deptData.head === employeeName) {
//         employeeData = {
//           name: employeeName,
//           email: deptData.headEmail,
//           position: 'Department Head',
//           supervisor: 'President',
//           department: deptKey
//         };
//         employeeDepartmentName = deptKey;
//         console.log(`✓ Employee is Department Head of ${deptKey}`);
//         break;
//       }

//       if (deptData.positions) {
//         for (const [pos, data] of Object.entries(deptData.positions)) {
//           if (data.name === employeeName) {
//             employeeData = { ...data, position: pos };
//             employeeDepartmentName = deptKey;
//             console.log(`✓ Employee found: ${pos} in ${deptKey}`);
//             break;
//           }
//         }
//       }

//       if (employeeData) break;
//     }
//   }

//   if (!employeeData) {
//     console.warn(`⚠ Employee "${employeeName}" not found. Using fallback.`);
//     return getFallbackApprovalChain(department);
//   }

//   console.log(`Employee Email: ${employeeData.email}`);

//   // Helper function to add approver if not duplicate
//   const addApprover = (level, approverData, role) => {
//     if (seenEmails.has(approverData.email)) {
//       console.log(`⊘ Skipping duplicate: ${approverData.name} (${role}) - already at level ${[...chain].find(s => s.approver.email === approverData.email)?.level}`);
//       return false;
//     }

//     chain.push({
//       level,
//       approver: {
//         name: approverData.name,
//         email: approverData.email,
//         role,
//         department: approverData.department || employeeDepartmentName
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });

//     seenEmails.add(approverData.email);
//     console.log(`✓ Level ${level}: ${approverData.name} (${role})`);
//     return true;
//   };

//   let currentLevel = 1;

//   // Level 1: Immediate Supervisor (if not department head)
//   if (employeeData.position !== 'Department Head') {
//     const supervisor = findSupervisor(employeeData, employeeDepartmentName);
//     if (supervisor) {
//       addApprover(currentLevel, supervisor, 'Supervisor');
//       currentLevel++;
//     } else {
//       console.log('⚠ No supervisor found, moving to department head');
//     }
//   }

//   // Level 2: Departmental Head
//   const deptHead = DEPARTMENT_STRUCTURE[employeeDepartmentName];
//   if (deptHead && employeeData.name !== deptHead.head) {
//     const added = addApprover(currentLevel, {
//       name: deptHead.head,
//       email: deptHead.headEmail,
//       department: employeeDepartmentName
//     }, 'Departmental Head');
    
//     if (added) currentLevel++;
//   }

//   // Level 3: Head of Business (President/Executive)
//   const executive = DEPARTMENT_STRUCTURE['Executive'];
//   if (executive) {
//     const added = addApprover(currentLevel, {
//       name: executive.head,
//       email: executive.headEmail,
//       department: 'Executive'
//     }, 'Head of Business');
    
//     if (added) currentLevel++;
//   }

//   // Level 4: Finance Officer (Always required)
//   addApprover(currentLevel, {
//     name: 'Ms. Ranibell Mambo',
//     email: 'ranibellmambo@gratoengineering.com',
//     department: 'Business Development & Supply Chain'
//   }, 'Finance Officer');

//   // Renumber levels to ensure they're sequential
//   chain.forEach((step, index) => {
//     step.level = index + 1;
//   });

//   // Set only first step as truly pending
//   chain.forEach((step, index) => {
//     step.status = index === 0 ? 'pending' : 'pending';
//   });

//   console.log(`\n✓ Approval chain created with ${chain.length} unique levels`);
//   console.log('Chain:', chain.map(s => `L${s.level}: ${s.approver.name} (${s.approver.role})`).join(' → '));
//   console.log('=== END APPROVAL CHAIN ===\n');

//   return chain;
// };

// /**
//  * Find immediate supervisor for an employee
//  */
// const findSupervisor = (employeeData, departmentName) => {
//   if (!employeeData.supervisor) {
//     console.log('⚠ No supervisor field found');
//     return null;
//   }

//   const department = DEPARTMENT_STRUCTURE[departmentName];
//   if (!department) {
//     console.log(`⚠ Department ${departmentName} not found`);
//     return null;
//   }

//   console.log(`Looking for supervisor: "${employeeData.supervisor}"`);

//   // Check positions in department
//   if (department.positions) {
//     for (const [pos, data] of Object.entries(department.positions)) {
//       if (pos === employeeData.supervisor || data.name === employeeData.supervisor) {
//         console.log(`✓ Found supervisor in positions: ${data.name}`);
//         return {
//           ...data,
//           position: pos,
//           department: departmentName
//         };
//       }
//     }
//   }

//   // Check if supervisor is the department head
//   if (department.head === employeeData.supervisor || employeeData.supervisor.includes('Head')) {
//     console.log(`✓ Supervisor is department head: ${department.head}`);
//     return {
//       name: department.head,
//       email: department.headEmail,
//       position: 'Department Head',
//       department: departmentName
//     };
//   }

//   console.log('⚠ Supervisor not found in department');
//   return null;
// };

// /**
//  * Fallback approval chain when employee is not found
//  */
// const getFallbackApprovalChain = (department) => {
//   const chain = [];
//   const seenEmails = new Set();
//   let level = 1;

//   console.log('Building fallback approval chain');

//   // Level 1: Department Head (if exists)
//   if (DEPARTMENT_STRUCTURE[department]) {
//     chain.push({
//       level: level++,
//       approver: {
//         name: DEPARTMENT_STRUCTURE[department].head,
//         email: DEPARTMENT_STRUCTURE[department].headEmail,
//         role: 'Departmental Head',
//         department: department
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//     seenEmails.add(DEPARTMENT_STRUCTURE[department].headEmail);
//   }

//   // Level 2: Head of Business
//   const executive = DEPARTMENT_STRUCTURE['Executive'];
//   if (executive && !seenEmails.has(executive.headEmail)) {
//     chain.push({
//       level: level++,
//       approver: {
//         name: executive.head,
//         email: executive.headEmail,
//         role: 'Head of Business',
//         department: 'Executive'
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//     seenEmails.add(executive.headEmail);
//   }

//   // Level 3: Finance
//   const financeEmail = 'ranibellmambo@gratoengineering.com';
//   if (!seenEmails.has(financeEmail)) {
//     chain.push({
//       level: level++,
//       approver: {
//         name: 'Ms. Ranibell Mambo',
//         email: financeEmail,
//         role: 'Finance Officer',
//         department: 'Business Development & Supply Chain'
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//   }

//   return chain;
// };

// /**
//  * Get the next status based on current approval level
//  */
// const getNextApprovalStatus = (currentLevel, totalLevels) => {
//   const statusMap = {
//     1: 'pending_departmental_head',
//     2: 'pending_head_of_business',
//     3: 'pending_finance',
//     4: 'approved'
//   };
  
//   return statusMap[currentLevel] || 'approved';
// };

// /**
//  * Map user roles to their approval authority levels
//  */
// const getUserApprovalLevel = (userRole, userEmail) => {
//   // Finance has final authority (Level 4)
//   if (userRole === 'finance') return 4;
  
//   // Admin can handle multiple levels
//   if (userRole === 'admin') {
//     const executive = DEPARTMENT_STRUCTURE['Executive'];
//     if (executive && executive.headEmail === userEmail) {
//       return 3; // Head of Business level
//     }
//     return 2; // Departmental Head level
//   }
  
//   // Supervisor handles immediate supervisor approval (Level 1)
//   if (userRole === 'supervisor') return 1;
  
//   return 0;
// };

// /**
//  * Check if a user can approve a request at a specific level
//  */
// const canUserApproveAtLevel = (user, approvalStep) => {
//   if (!user || !approvalStep) return false;
  
//   // Primary check: email match
//   if (user.email !== approvalStep.approver.email) return false;
  
//   const userApprovalLevel = getUserApprovalLevel(user.role, user.email);
  
//   const stepLevelMap = {
//     'Supervisor': 1,
//     'Departmental Head': 2,
//     'Head of Business': 3,
//     'Finance Officer': 4
//   };
  
//   const requiredLevel = stepLevelMap[approvalStep.approver.role];
  
//   if (user.role === 'admin') {
//     return requiredLevel === 2 || requiredLevel === 3;
//   }
  
//   return userApprovalLevel === requiredLevel;
// };

// module.exports = {
//   getCashRequestApprovalChain,
//   getNextApprovalStatus,
//   getUserApprovalLevel,
//   canUserApproveAtLevel,
//   findSupervisor,
//   getFallbackApprovalChain
// };









// const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

// /**
//  * Get cash request approval chain with 4-level hierarchy:
//  * 1. Supervisor - immediate supervisor approval
//  * 2. Departmental Head - department head approval  
//  * 3. Head of Business - executive approval
//  * 4. Finance - final approval and disbursement
//  */
// const getCashRequestApprovalChain = (employeeName, department) => {
//   const chain = [];
  
//   console.log(`Getting cash request approval chain for: ${employeeName} in ${department}`);

//   // Find the employee in the department structure
//   let employeeData = null;
//   let employeeDepartmentName = department;

//   // First check if the employee is a department head
//   if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head === employeeName) {
//     employeeData = {
//       name: employeeName,
//       email: DEPARTMENT_STRUCTURE[department].headEmail,
//       position: 'Department Head',
//       supervisor: 'President',
//       department: department
//     };
//   } else {
//     // Search for employee in all departments
//     for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
//       if (deptData.head === employeeName) {
//         employeeData = {
//           name: employeeName,
//           email: deptData.headEmail,
//           position: 'Department Head',
//           supervisor: 'President',
//           department: deptKey
//         };
//         employeeDepartmentName = deptKey;
//         break;
//       }

//       if (deptData.positions) {
//         for (const [pos, data] of Object.entries(deptData.positions)) {
//           if (data.name === employeeName) {
//             employeeData = { ...data, position: pos };
//             employeeDepartmentName = deptKey;
//             break;
//           }
//         }
//       }

//       if (employeeData) break;
//     }
//   }

//   if (!employeeData) {
//     console.warn(`Employee "${employeeName}" not found. Using fallback approval chain.`);
//     return getFallbackApprovalChain(department);
//   }

//   // Level 1: Immediate Supervisor (if employee is not already a department head)
//   if (employeeData.position !== 'Department Head') {
//     const supervisor = findSupervisor(employeeData, employeeDepartmentName);
//     if (supervisor) {
//       chain.push({
//         level: 1,
//         approver: {
//           name: supervisor.name,
//           email: supervisor.email,
//           role: 'Supervisor',
//           department: supervisor.department || employeeDepartmentName
//         },
//         status: 'pending',
//         assignedDate: new Date()
//       });
//     }
//   }

//   // Level 2: Departmental Head (if not already the department head and not already added)
//   const deptHead = DEPARTMENT_STRUCTURE[employeeDepartmentName];
//   if (deptHead && employeeData.name !== deptHead.head && !chain.find(step => step.approver.name === deptHead.head)) {
//     chain.push({
//       level: chain.length + 1,
//       approver: {
//         name: deptHead.head,
//         email: deptHead.headEmail,
//         role: 'Departmental Head',
//         department: employeeDepartmentName
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//   }

//   // Level 3: Head of Business (President/Executive)
//   const executive = DEPARTMENT_STRUCTURE['Executive'];
//   if (executive && !chain.find(step => step.approver.email === executive.headEmail)) {
//     chain.push({
//       level: chain.length + 1,
//       approver: {
//         name: executive.head,
//         email: executive.headEmail,
//         role: 'Head of Business',
//         department: 'Executive'
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//   }

//   // Level 4: Finance Officer (Final approval and disbursement)
//   chain.push({
//     level: chain.length + 1,
//     approver: {
//       name: 'Ms. Ranibell Mambo',
//       email: 'ranibellmambo@gratoengineering.com',
//       role: 'Finance Officer',
//       department: 'Business Development & Supply Chain'
//     },
//     status: 'pending',
//     assignedDate: new Date()
//   });

//   // Set only the first step as pending initially
//   chain.forEach((step, index) => {
//     if (index === 0) {
//       step.status = 'pending';
//     } else {
//       step.status = 'pending'; 
//     }
//   });

//   console.log(`Cash request approval chain created with ${chain.length} levels:`,
//     chain.map(step => `Level ${step.level}: ${step.approver.name} (${step.approver.role})`));

//   return chain;
// };

// /**
//  * Find immediate supervisor for an employee
//  */
// const findSupervisor = (employeeData, departmentName) => {
//   if (!employeeData.supervisor) return null;

//   const department = DEPARTMENT_STRUCTURE[departmentName];
//   if (!department) return null;

//   // Check if supervisor is in the same department
//   if (department.positions) {
//     for (const [pos, data] of Object.entries(department.positions)) {
//       if (pos === employeeData.supervisor || data.name === employeeData.supervisor) {
//         return {
//           ...data,
//           position: pos,
//           department: departmentName
//         };
//       }
//     }
//   }

//   // Check if supervisor is the department head
//   if (department.head === employeeData.supervisor || employeeData.supervisor.includes('Head')) {
//     return {
//       name: department.head,
//       email: department.headEmail,
//       position: 'Department Head',
//       department: departmentName
//     };
//   }

//   return null;
// };

// /**
//  * Fallback approval chain when employee is not found
//  */
// const getFallbackApprovalChain = (department) => {
//   const chain = [];
//   let level = 1;

//   // Level 1: Department Head (if exists)
//   if (DEPARTMENT_STRUCTURE[department]) {
//     chain.push({
//       level: level++,
//       approver: {
//         name: DEPARTMENT_STRUCTURE[department].head,
//         email: DEPARTMENT_STRUCTURE[department].headEmail,
//         role: 'Departmental Head',
//         department: department
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//   }

//   // Level 2: Head of Business
//   const executive = DEPARTMENT_STRUCTURE['Executive'];
//   if (executive) {
//     chain.push({
//       level: level++,
//       approver: {
//         name: executive.head,
//         email: executive.headEmail,
//         role: 'Head of Business',
//         department: 'Executive'
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//   }

//   // Level 3: Finance
//   chain.push({
//     level: level++,
//     approver: {
//       name: 'Ms. Ranibell Mambo',
//       email: 'ranibellmambo@gratoengineering.com',
//       role: 'Finance Officer',
//       department: 'Business Development & Supply Chain'
//     },
//     status: 'pending',
//     assignedDate: new Date()
//   });

//   return chain;
// };

// /**
//  * Get the next status based on current approval level
//  */
// const getNextApprovalStatus = (currentLevel, totalLevels) => {
//   switch (currentLevel) {
//     case 1:
//       return 'pending_departmental_head';
//     case 2:
//       return 'pending_head_of_business';
//     case 3:
//       return 'pending_finance';
//     case 4:
//       return 'approved'; 
//     default:
//       return 'approved';
//   }
// };

// /**
//  * Map user roles to their approval authority levels
//  */
// const getUserApprovalLevel = (userRole, userEmail) => {
//   // Finance has final authority (Level 4)
//   if (userRole === 'finance') return 4;
  
//   // Admin can handle both departmental head (Level 2) and head of business (Level 3)
//   if (userRole === 'admin') {
//     // Check if this admin is the head of business (President)
//     const executive = DEPARTMENT_STRUCTURE['Executive'];
//     if (executive && executive.headEmail === userEmail) {
//       return 3; // Head of Business level
//     }
//     return 2; // Departmental Head level
//   }
  
//   // Supervisor handles immediate supervisor approval (Level 1)
//   if (userRole === 'supervisor') return 1;
  
//   return 0; // No approval authority
// };

// /**
//  * Check if a user can approve a request at a specific level
//  */
// const canUserApproveAtLevel = (user, approvalStep) => {
//   if (!user || !approvalStep) return false;
  
//   // Check if user email matches the approver email
//   if (user.email !== approvalStep.approver.email) return false;
  
//   // Check if user role matches the required role for this level
//   const userApprovalLevel = getUserApprovalLevel(user.role, user.email);
  
//   // Map approval step roles to levels based on new role names
//   const stepLevelMap = {
//     'Supervisor': 1,
//     'Departmental Head': 2,
//     'Head of Business': 3,
//     'Finance Officer': 4
//   };
  
//   const requiredLevel = stepLevelMap[approvalStep.approver.role];
  
//   // For admin users, check if they can handle this specific level
//   if (user.role === 'admin') {
//     // Admin can handle Level 2 (Departmental Head) and Level 3 (Head of Business)
//     return requiredLevel === 2 || requiredLevel === 3;
//   }
  
//   // For other roles, check if user level matches required level
//   return userApprovalLevel === requiredLevel;
// };

// module.exports = {
//   getCashRequestApprovalChain,
//   getNextApprovalStatus,
//   getUserApprovalLevel,
//   canUserApproveAtLevel,
//   findSupervisor,
//   getFallbackApprovalChain
// };
