const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

/**
 * Get IT support request approval chain with STRICT 4-level hierarchy:
 * Level 1: Immediate Supervisor
 * Level 2: Department Head
 * Level 3: Head of Business (President)
 * Level 4: IT Department (ALWAYS LAST - FINAL APPROVER)
 * 
 * NOTE: Finance is NO LONGER in the approval chain
 */
const getITSupportApprovalChain = (employeeName, department) => {
  const chain = [];
  const seenEmails = new Set();
  
  console.log(`\n=== BUILDING IT SUPPORT APPROVAL CHAIN ===`);
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
    return getFallbackITApprovalChain(department);
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

  // LEVEL 4: IT Department (ALWAYS LAST - FINAL APPROVER - NEVER SKIP)
  const itEmail = 'marcel.ngong@gratoglobal.com'; // IT Staff email from your structure
  if (!seenEmails.has(itEmail)) {
    const finalLevel = chain.length + 1;
    chain.push({
      level: finalLevel,
      approver: {
        name: 'IT Department',
        email: itEmail,
        role: 'IT Department - Final Approval',
        department: 'HR & Admin'
      },
      status: 'pending',
      assignedDate: new Date()
    });
    seenEmails.add(itEmail);
    console.log(`✓ Level ${finalLevel}: IT Department (Final Approval) - ${itEmail}`);
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

const getFallbackITApprovalChain = (department) => {
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

  // IT Department (ALWAYS LAST)
  const itEmail = 'marcel.ngong@gratoglobal.com';
  if (!seenEmails.has(itEmail)) {
    chain.push({
      level: level++,
      approver: {
        name: 'IT Department',
        email: itEmail,
        role: 'IT Department - Final Approval',
        department: 'HR & Admin'
      },
      status: 'pending',
      assignedDate: new Date()
    });
  }

  return chain;
};

const getNextITApprovalStatus = (currentLevel, totalLevels) => {
  // Map based on what level was just approved
  if (currentLevel === totalLevels) {
    return 'approved'; // All levels approved (IT approved = fully approved)
  }
  
  // Determine next status based on next level
  const nextLevel = currentLevel + 1;
  
  const statusMap = {
    1: 'pending_supervisor',
    2: 'pending_departmental_head',
    3: 'pending_head_of_business',
    4: 'pending_it_approval' // NEW: IT is final approval
  };
  
  return statusMap[nextLevel] || 'pending_it_approval';
};

const getUserITApprovalLevel = (userRole, userEmail) => {
  // IT department is now level 4 (final approval)
  if (userRole === 'it') return 4;
  
  if (userRole === 'admin') {
    const executive = DEPARTMENT_STRUCTURE['Executive'];
    if (executive && executive.headEmail === userEmail) {
      return 3; // President
    }
    return 2; // Department Head
  }
  
  if (userRole === 'supervisor') return 1;
  
  return 0;
};

const canUserApproveITRequest = (user, approvalStep) => {
  if (!user || !approvalStep) return false;
  if (user.email !== approvalStep.approver.email) return false;
  
  const userApprovalLevel = getUserITApprovalLevel(user.role, user.email);
  
  const stepLevelMap = {
    'Supervisor': 1,
    'Departmental Head': 2,
    'Head of Business': 3,
    'IT Department - Final Approval': 4
  };
  
  const requiredLevel = stepLevelMap[approvalStep.approver.role];
  
  if (user.role === 'admin') {
    return requiredLevel === 2 || requiredLevel === 3;
  }
  
  return userApprovalLevel === requiredLevel;
};

module.exports = {
  getITSupportApprovalChain,
  getNextITApprovalStatus,
  getUserITApprovalLevel,
  canUserApproveITRequest,
  findSupervisor,
  getFallbackITApprovalChain
};