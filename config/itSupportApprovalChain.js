const { getApprovalChainFromStructure } = require('./departmentStructure');

/**
 * FIXED: Get IT support approval chain with IT Department ALWAYS as final step
 * 
 * @param {string} employeeEmail - Email of employee requesting IT support
 * @returns {array} - Approval chain with levels, IT Department always as final step
 */
const getITSupportApprovalChain = (employeeEmail) => {
  console.log(`\n=== BUILDING IT SUPPORT APPROVAL CHAIN ===`);
  console.log(`Employee Email: ${employeeEmail}`);

  // Validate input
  if (!employeeEmail || typeof employeeEmail !== 'string') {
    console.error('❌ Invalid employee email provided');
    return getFallbackITApprovalChain();
  }

  // Get base approval chain from structure (same as cash requests)
  const baseApprovalChain = getApprovalChainFromStructure(employeeEmail);

  if (!baseApprovalChain || baseApprovalChain.length === 0) {
    console.warn(`⚠️ No approval chain found for ${employeeEmail}`);
    return getFallbackITApprovalChain();
  }

  console.log(`✓ Base approval chain retrieved: ${baseApprovalChain.length} levels`);

  // CRITICAL FIX: Define IT Department details
  const IT_DEPARTMENT = {
    name: 'IT Department',
    email: 'marcel.ngong@gratoglobal.com',
    role: 'IT Department - Final Approval',
    department: 'HR & Admin'
  };

  // Check if IT is already in the chain
  const itIndex = baseApprovalChain.findIndex(step => 
    step.approver?.email?.toLowerCase() === IT_DEPARTMENT.email.toLowerCase()
  );

  const hasIT = itIndex !== -1;

  let itApprovalChain;

  if (hasIT) {
    // IT already in chain - just map it
    console.log(`✓ IT Department already in approval chain at position ${itIndex + 1}`);
    itApprovalChain = baseApprovalChain.map((step, index) => {
      const approver = step.approver || {};
      
      return {
        level: index + 1,
        approver: {
          name: String(approver.name || 'Unknown Approver').trim(),
          email: String(approver.email || '').trim().toLowerCase(),
          role: mapRoleForITApproval(approver.role || 'Approver', index + 1, approver.email),
          department: String(approver.department || 'Unknown Department').trim()
        },
        status: 'pending',
        assignedDate: index === 0 ? new Date() : null,
        comments: '',
        actionDate: null,
        actionTime: null,
        decidedBy: null
      };
    });
  } else {
    // IT NOT in chain - append it as final step
    console.log('✓ Appending IT Department as final approval step');
    
    // Map existing chain
    const mappedBaseChain = baseApprovalChain.map((step, index) => {
      const approver = step.approver || {};
      
      return {
        level: index + 1,
        approver: {
          name: String(approver.name || 'Unknown Approver').trim(),
          email: String(approver.email || '').trim().toLowerCase(),
          role: mapRoleForITApproval(approver.role || 'Approver', index + 1, approver.email),
          department: String(approver.department || 'Unknown Department').trim()
        },
        status: 'pending',
        assignedDate: index === 0 ? new Date() : null,
        comments: '',
        actionDate: null,
        actionTime: null,
        decidedBy: null
      };
    });

    // Append IT Department as final step
    const itStep = {
      level: mappedBaseChain.length + 1,
      approver: {
        name: IT_DEPARTMENT.name,
        email: IT_DEPARTMENT.email,
        role: IT_DEPARTMENT.role,
        department: IT_DEPARTMENT.department
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    };

    itApprovalChain = [...mappedBaseChain, itStep];
  }

  // Validate final chain
  const validation = validateITApprovalChain(itApprovalChain);
  if (!validation.valid) {
    console.error('❌ Generated approval chain is invalid:', validation.error);
    return getFallbackITApprovalChain();
  }

  console.log(`✅ IT approval chain created with ${itApprovalChain.length} levels`);
  const chainSummary = itApprovalChain.map(s => 
    `L${s.level}: ${s.approver.name} (${s.approver.role})`
  ).join(' → ');
  console.log(`Chain: ${chainSummary}`);
  console.log('=== END APPROVAL CHAIN ===\n');

  return itApprovalChain;
};

/**
 * Map role from structure to IT approval role
 */
const mapRoleForITApproval = (structureRole, level, email = '') => {
  const role = String(structureRole || '');
  const roleLower = role.toLowerCase();
  const emailLower = String(email || '').toLowerCase();
  
  // CRITICAL: IT Department role mapping by email (most reliable)
  if (emailLower === 'marcel.ngong@gratoglobal.com') {
    return 'IT Department - Final Approval';
  }

  // IT role mapping by keyword
  if (roleLower.includes('it department') || roleLower.includes('it staff')) {
    return 'IT Department - Final Approval';
  }
  
  // President / Head of Business
  if (roleLower.includes('president') || roleLower === 'head of business') {
    return 'Head of Business';
  }
  
  // Department Heads and Directors
  if (roleLower.includes('head') || roleLower.includes('director')) {
    return 'Departmental Head';
  }

  // Supervisors and Managers
  if (roleLower.includes('supervisor') || roleLower.includes('manager') || roleLower.includes('coordinator')) {
    return 'Supervisor';
  }

  // Fallback to level-based mapping
  const levelRoleMap = {
    1: 'Supervisor',
    2: 'Departmental Head', 
    3: 'Head of Business',
    4: 'IT Department - Final Approval'
  };

  return levelRoleMap[level] || role;
};

/**
 * FIXED: Fallback IT approval chain with IT Department as final step
 * This should rarely be used - most employees should be in departmentStructure.js
 */
const getFallbackITApprovalChain = () => {
  console.warn('⚠️ Using fallback IT approval chain - Employee not found in department structure');
  console.warn('⚠️ This employee should be added to config/departmentStructure.js');
  
  return [
    {
      level: 1,
      approver: {
        name: 'Mrs. Bruiline Tsitoh',
        email: 'bruiline.tsitoh@gratoglobal.com',
        role: 'Supervisor',
        department: 'HR & Admin'
      },
      status: 'pending',
      assignedDate: new Date(),
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    },
    {
      level: 2,
      approver: {
        name: 'Mrs. Bruiline Tsitoh',
        email: 'bruiline.tsitoh@gratoglobal.com',
        role: 'Departmental Head',
        department: 'HR & Admin'
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    },
    {
      level: 3,
      approver: {
        name: 'Mr. E.T Kelvin',
        email: 'kelvin.eyong@gratoglobal.com',
        role: 'Head of Business',
        department: 'Executive'
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    },
    {
      level: 4,
      approver: {
        name: 'IT Department',
        email: 'marcel.ngong@gratoglobal.com',
        role: 'IT Department - Final Approval',
        department: 'HR & Admin'
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    }
  ];
};

/**
 * Get next approval status based on current level
 */
const getNextITApprovalStatus = (currentLevel, totalLevels, approvalChain = []) => {
  // Check if we're at the last level
  if (currentLevel === totalLevels) {
    return 'it_approved'; // IT approved = fully approved (no finance for IT requests)
  }
  
  const nextLevel = currentLevel + 1;
  
  // Check if next level is IT Department by examining the approval chain
  if (approvalChain && approvalChain.length > 0) {
    const nextStep = approvalChain.find(s => s.level === nextLevel);
    if (nextStep && nextStep.approver.role === 'IT Department - Final Approval') {
      return 'pending_it_approval';
    }
  }
  
  // Default status mapping
  const statusMap = {
    1: 'pending_supervisor',
    2: 'pending_departmental_head',
    3: 'pending_head_of_business',
    4: 'pending_it_approval'
  };
  
  return statusMap[nextLevel] || 'pending_it_approval';
};

/**
 * Check if user can approve IT request at specific level
 */
const canUserApproveITRequest = (user, approvalStep) => {
  if (!user || !approvalStep) return false;
  
  // Normalize emails for comparison
  const userEmail = String(user.email || '').toLowerCase().trim();
  const stepEmail = String(approvalStep.approver?.email || '').toLowerCase().trim();
  
  // Match by email (most reliable)
  if (userEmail !== stepEmail) return false;
  
  // Check step status is pending
  if (approvalStep.status !== 'pending') return false;
  
  // Admin can approve at levels 2 and 3
  if (user.role === 'admin') {
    return approvalStep.level === 2 || approvalStep.level === 3;
  }
  
  // IT department can approve at their level (final approval)
  if (user.role === 'it') {
    return approvalStep.approver.role === 'IT Department - Final Approval';
  }
  
  // Supervisors can approve at level 1
  if (user.role === 'supervisor') {
    return approvalStep.level === 1;
  }
  
  return false;
};

/**
 * Get user's IT approval level
 */
const getUserITApprovalLevel = (userRole, userEmail) => {
  const email = String(userEmail || '').toLowerCase().trim();
  
  // IT Department
  if (email === 'marcel.ngong@gratoglobal.com' || userRole === 'it') {
    return 4;
  }
  
  // Head of Business (President)
  if (email === 'kelvin.eyong@gratoglobal.com') {
    return 3;
  }
  
  // Department Heads and Admin
  if (userRole === 'admin') {
    return 2;
  }
  
  // Supervisors
  if (userRole === 'supervisor') {
    return 1;
  }
  
  return 0;
};

/**
 * Validate IT approval chain structure
 * Ensures all required fields are present and valid
 */
const validateITApprovalChain = (approvalChain) => {
  if (!Array.isArray(approvalChain) || approvalChain.length === 0) {
    return { valid: false, error: 'Approval chain must be a non-empty array' };
  }

  // Check if IT Department is the last step
  const lastStep = approvalChain[approvalChain.length - 1];
  if (lastStep.approver.role !== 'IT Department - Final Approval') {
    return { valid: false, error: 'IT Department must be the final approver' };
  }

  for (let i = 0; i < approvalChain.length; i++) {
    const step = approvalChain[i];
    
    if (!step.level || typeof step.level !== 'number') {
      return { valid: false, error: `Step ${i + 1}: Missing or invalid level` };
    }

    if (step.level !== i + 1) {
      return { valid: false, error: `Step ${i + 1}: Level mismatch (expected ${i + 1}, got ${step.level})` };
    }

    if (!step.approver || typeof step.approver !== 'object') {
      return { valid: false, error: `Step ${i + 1}: Missing or invalid approver object` };
    }

    const { name, email, role, department } = step.approver;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { valid: false, error: `Step ${i + 1}: Approver name must be a non-empty string` };
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return { valid: false, error: `Step ${i + 1}: Approver email must be a non-empty string` };
    }

    if (!role || typeof role !== 'string' || role.trim().length === 0) {
      return { valid: false, error: `Step ${i + 1}: Approver role must be a non-empty string` };
    }

    if (!department || typeof department !== 'string' || department.trim().length === 0) {
      return { valid: false, error: `Step ${i + 1}: Approver department must be a non-empty string` };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: `Step ${i + 1}: Invalid email format: ${email}` };
    }
  }

  return { valid: true };
};

/**
 * Check if a step is IT Department approval
 */
const isITStep = (step) => {
  if (!step || !step.approver) return false;
  
  return step.approver.role === 'IT Department - Final Approval' || 
         step.approver.email?.toLowerCase() === 'marcel.ngong@gratoglobal.com';
};

/**
 * Find supervisor in department structure
 * (Kept for backward compatibility but not used in new approach)
 */
const findSupervisor = (employeeData, departmentName) => {
  console.warn('⚠️ findSupervisor() is deprecated. Use getApprovalChainFromStructure() instead.');
  return null;
};

module.exports = {
  getITSupportApprovalChain,
  getNextITApprovalStatus,
  canUserApproveITRequest,
  getUserITApprovalLevel,
  getFallbackITApprovalChain,
  validateITApprovalChain,
  isITStep,
  findSupervisor 
};












// const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

// /**
//  * Get IT support request approval chain with STRICT 4-level hierarchy:
//  * Level 1: Immediate Supervisor
//  * Level 2: Department Head
//  * Level 3: Head of Business (President)
//  * Level 4: IT Department (ALWAYS LAST - FINAL APPROVER)
//  * 
//  * NOTE: Finance is NO LONGER in the approval chain
//  */
// const getITSupportApprovalChain = (employeeName, department) => {
//   const chain = [];
//   const seenEmails = new Set();
  
//   console.log(`\n=== BUILDING IT SUPPORT APPROVAL CHAIN ===`);
//   console.log(`Employee: ${employeeName}`);
//   console.log(`Department: ${department}`);

//   // Find employee
//   let employeeData = null;
//   let employeeDepartmentName = department;

//   if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head === employeeName) {
//     employeeData = {
//       name: employeeName,
//       email: DEPARTMENT_STRUCTURE[department].headEmail,
//       position: 'Department Head',
//       supervisor: 'President',
//       department: department
//     };
//     console.log('✓ Employee is Department Head');
//   } else {
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
//             console.log(`✓ Found: ${pos} in ${deptKey}`);
//             break;
//           }
//         }
//       }
//       if (employeeData) break;
//     }
//   }

//   if (!employeeData) {
//     console.warn(`⚠ Employee "${employeeName}" not found. Using fallback.`);
//     return getFallbackITApprovalChain(department);
//   }

//   // Helper to add unique approver
//   const addApprover = (approverData, role) => {
//     if (seenEmails.has(approverData.email)) {
//       console.log(`⊘ Skip duplicate: ${approverData.name} (${approverData.email})`);
//       return false;
//     }

//     const level = chain.length + 1;
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
//     console.log(`✓ Level ${level}: ${approverData.name} (${role}) - ${approverData.email}`);
//     return true;
//   };

//   // LEVEL 1: Immediate Supervisor (if not department head)
//   if (employeeData.position !== 'Department Head') {
//     const supervisor = findSupervisor(employeeData, employeeDepartmentName);
//     if (supervisor) {
//       addApprover(supervisor, 'Supervisor');
//     }
//   }

//   // LEVEL 2: Department Head (if different from employee and supervisor)
//   const deptHead = DEPARTMENT_STRUCTURE[employeeDepartmentName];
//   if (deptHead && employeeData.name !== deptHead.head) {
//     addApprover({
//       name: deptHead.head,
//       email: deptHead.headEmail,
//       department: employeeDepartmentName
//     }, 'Departmental Head');
//   }

//   // LEVEL 3: Head of Business / President (if different from above)
//   const executive = DEPARTMENT_STRUCTURE['Executive'];
//   if (executive) {
//     addApprover({
//       name: executive.head,
//       email: executive.headEmail,
//       department: 'Executive'
//     }, 'Head of Business');
//   }

//   // LEVEL 4: IT Department (ALWAYS LAST - FINAL APPROVER - NEVER SKIP)
//   const itEmail = 'marcel.ngong@gratoglobal.com'; // IT Staff email from your structure
//   if (!seenEmails.has(itEmail)) {
//     const finalLevel = chain.length + 1;
//     chain.push({
//       level: finalLevel,
//       approver: {
//         name: 'IT Department',
//         email: itEmail,
//         role: 'IT Department - Final Approval',
//         department: 'HR & Admin'
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//     seenEmails.add(itEmail);
//     console.log(`✓ Level ${finalLevel}: IT Department (Final Approval) - ${itEmail}`);
//   }

//   // CRITICAL: Renumber to ensure sequential levels
//   chain.forEach((step, index) => {
//     step.level = index + 1;
//   });

//   const finalChain = chain.map(s => `L${s.level}: ${s.approver.name} (${s.approver.role})`).join(' → ');
//   console.log(`\n✅ Final Chain (${chain.length} levels): ${finalChain}`);
//   console.log('=== END APPROVAL CHAIN ===\n');

//   return chain;
// };

// const findSupervisor = (employeeData, departmentName) => {
//   if (!employeeData.supervisor) return null;

//   const department = DEPARTMENT_STRUCTURE[departmentName];
//   if (!department) return null;

//   // Check in positions
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

//   // Check if supervisor is department head
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

// const getFallbackITApprovalChain = (department) => {
//   const chain = [];
//   const seenEmails = new Set();
//   let level = 1;

//   // Department Head
//   if (DEPARTMENT_STRUCTURE[department]) {
//     const email = DEPARTMENT_STRUCTURE[department].headEmail;
//     if (!seenEmails.has(email)) {
//       chain.push({
//         level: level++,
//         approver: {
//           name: DEPARTMENT_STRUCTURE[department].head,
//           email,
//           role: 'Departmental Head',
//           department
//         },
//         status: 'pending',
//         assignedDate: new Date()
//       });
//       seenEmails.add(email);
//     }
//   }

//   // President
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

//   // IT Department (ALWAYS LAST)
//   const itEmail = 'marcel.ngong@gratoglobal.com';
//   if (!seenEmails.has(itEmail)) {
//     chain.push({
//       level: level++,
//       approver: {
//         name: 'IT Department',
//         email: itEmail,
//         role: 'IT Department - Final Approval',
//         department: 'HR & Admin'
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//   }

//   return chain;
// };

// const getNextITApprovalStatus = (currentLevel, totalLevels) => {
//   // Map based on what level was just approved
//   if (currentLevel === totalLevels) {
//     return 'approved'; // All levels approved (IT approved = fully approved)
//   }
  
//   // Determine next status based on next level
//   const nextLevel = currentLevel + 1;
  
//   const statusMap = {
//     1: 'pending_supervisor',
//     2: 'pending_departmental_head',
//     3: 'pending_head_of_business',
//     4: 'pending_it_approval' // NEW: IT is final approval
//   };
  
//   return statusMap[nextLevel] || 'pending_it_approval';
// };

// const getUserITApprovalLevel = (userRole, userEmail) => {
//   // IT department is now level 4 (final approval)
//   if (userRole === 'it') return 4;
  
//   if (userRole === 'admin') {
//     const executive = DEPARTMENT_STRUCTURE['Executive'];
//     if (executive && executive.headEmail === userEmail) {
//       return 3; // President
//     }
//     return 2; // Department Head
//   }
  
//   if (userRole === 'supervisor') return 1;
  
//   return 0;
// };

// const canUserApproveITRequest = (user, approvalStep) => {
//   if (!user || !approvalStep) return false;
//   if (user.email !== approvalStep.approver.email) return false;
  
//   const userApprovalLevel = getUserITApprovalLevel(user.role, user.email);
  
//   const stepLevelMap = {
//     'Supervisor': 1,
//     'Departmental Head': 2,
//     'Head of Business': 3,
//     'IT Department - Final Approval': 4
//   };
  
//   const requiredLevel = stepLevelMap[approvalStep.approver.role];
  
//   if (user.role === 'admin') {
//     return requiredLevel === 2 || requiredLevel === 3;
//   }
  
//   return userApprovalLevel === requiredLevel;
// };

// module.exports = {
//   getITSupportApprovalChain,
//   getNextITApprovalStatus,
//   getUserITApprovalLevel,
//   canUserApproveITRequest,
//   findSupervisor,
//   getFallbackITApprovalChain
// };