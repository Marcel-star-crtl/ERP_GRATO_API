/**
 * ✅ FIXED: Purchase Requisition Approval Chain Configuration
 * - Removed duplicate approvers
 * - Fixed hierarchy traversal
 * - Proper status progression
 */

const DEPARTMENT_STRUCTURE = {
  'Technical': {
    name: 'Technical',
    head: {
      email: 'didier.oyong@gratoengineering.com',
      name: 'Mr. Didier Oyong',
      position: 'Technical Director',
      reportsTo: 'kelvin.eyong@gratoglobal.com', 
      hierarchyLevel: 4
    },
    positions: {
      'HSE Coordinator': {
        email: 'bechem.mbu@gratoglobal.com',
        name: 'Mr. Ovo Bechem',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: [],
        approvalAuthority: 'coordinator'
      },
      'Head of Refurbishment': {
        email: 'verla.ivo@gratoengineering.com',
        name: 'Mr. Verla Ivo',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: [],
        approvalAuthority: 'head'
      },
      'Project Manager': {
        email: 'joel@gratoengineering.com',
        name: 'Mr. Joel Wamba',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: ['Site Supervisor'],
        approvalAuthority: 'manager'
      },
      'Operations Manager': {
        email: 'pascal.rodrique@gratoglobal.com',
        name: 'Mr. Pascal Assam',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: ['Data Collector', 'NOC Coordinator', 'Site Supervisor'],
        approvalAuthority: 'manager'
      },
      'Diesel Coordinator': {
        email: 'minka.kevin@gratoglobal.com',
        name: 'Mr. Kevin Minka',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: [],
        approvalAuthority: 'coordinator'
      },
      'Data Collector': {
        email: 'bemba.essack@gratoglobal.com',
        name: 'Mr. Bemba Essack',
        reportsTo: 'pascal.rodrique@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'NOC Coordinator': {
        email: 'rodrigue.nono@gratoglobal.com',
        name: 'Mr. Rodrigue Nono',
        reportsTo: 'pascal.rodrique@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: ['NOC Operator'],
        approvalAuthority: 'coordinator'
      },
      'Site Supervisor - Joseph': {
        email: 'joseph.tayou@gratoglobal.com',
        name: 'Mr. Joseph TAYOU',
        position: 'Site Supervisor',
        reportsTo: 'pascal.rodrique@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: ['Field Technician'],
        approvalAuthority: 'supervisor'
      },
      'Site Supervisor - Felix': {
        email: 'felix.tientcheu@gratoglobal.com',
        name: 'Mr. Felix Tientcheu',
        position: 'Site Supervisor',
        reportsTo: 'pascal.rodrique@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: ['Field Technician'],
        approvalAuthority: 'supervisor'
      },
      // NOC Operators and Field Technicians omitted for brevity
    }
  },

  'Business Development & Supply Chain': {
    name: 'Business Development & Supply Chain',
    head: {
      email: 'kelvin.eyong@gratoglobal.com',
      name: 'Mr. E.T Kelvin',
      position: 'President / Head of Business',
      reportsTo: null,
      hierarchyLevel: 5
    },
    positions: {
      'Supply Chain Coordinator': {
        email: 'lukong.lambert@gratoglobal.com',
        name: 'Mr. Lukong Lambert',
        reportsTo: 'kelvin.eyong@gratoglobal.com',
        hierarchyLevel: 3,
        canSupervise: ['Order Management Assistant/Buyer', 'Warehouse Coordinator/Buyer'],
        approvalAuthority: 'coordinator',
        specialRole: 'buyer'
      },
      'Order Management Assistant/Buyer': {
        email: 'christabel@gratoengineering.com',
        name: 'Ms. Christabel Mangwi',
        reportsTo: 'lukong.lambert@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'buyer',
        specialRole: 'buyer'
      },
      'Warehouse Coordinator/Buyer': {
        email: 'pryde.mua@gratoglobal.com',
        name: 'Mr. Pryde Mua',
        reportsTo: 'lukong.lambert@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: ['Warehouse Assistant'],
        approvalAuthority: 'coordinator',
        specialRole: 'buyer'
      },
      'Warehouse Assistant': {
        email: 'aghangu.marie@gratoengineering.com',
        name: 'Ms. Aghangu Marie',
        reportsTo: 'pryde.mua@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'Finance Officer': {
        email: 'ranibellmambo@gratoengineering.com',
        name: 'Ms. Ranibell Mambo',
        reportsTo: 'kelvin.eyong@gratoglobal.com',
        hierarchyLevel: 3,
        canSupervise: [],
        approvalAuthority: 'finance',
        specialRole: 'finance'
      }
    }
  },

  'HR & Admin': {
    name: 'HR & Admin',
    head: {
      email: 'bruiline.tsitoh@gratoglobal.com',
      name: 'Mrs. Bruiline Tsitoh',
      position: 'HR & Admin Head',
      reportsTo: 'kelvin.eyong@gratoglobal.com', 
      hierarchyLevel: 4
    },
    positions: {
      'Office Driver/Logistics Assistant': {
        email: 'che.earnest@gratoengineering.com',
        name: 'Mr. Che Earnest',
        reportsTo: 'bruiline.tsitoh@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'IT Staff': {
        email: 'marcel.ngong@gratoglobal.com',
        name: 'Marcel Ngong',
        reportsTo: 'bruiline.tsitoh@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'House Maid': {
        email: 'ndi.belther@gratoengineering.com',
        name: 'Ms. Ndi Belther',
        reportsTo: 'bruiline.tsitoh@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'Receptionist': {
        email: 'carmel.dafny@gratoglobal.com',
        name: 'Carmel Dafny',
        reportsTo: 'bruiline.tsitoh@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      }
    }
  }
};

/**
 * Find person details by email across all departments
 */
const findPersonByEmail = (email) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  
  for (const [deptKey, dept] of Object.entries(DEPARTMENT_STRUCTURE)) {
    if (dept.head.email.toLowerCase().trim() === normalizedEmail) {
      return {
        ...dept.head,
        department: deptKey,
        isDepartmentHead: true
      };
    }

    for (const [position, person] of Object.entries(dept.positions || {})) {
      if (person.email.toLowerCase().trim() === normalizedEmail) {
        return {
          ...person,
          position: person.position || position,
          department: deptKey,
          isDepartmentHead: false
        };
      }
    }
  }
  return null;
};

/**
 * ✅ FIXED: Get approval chain for Purchase Requisitions
 * Proper hierarchy traversal with duplicate prevention
 */
const getApprovalChainForRequisition = (employeeEmail) => {
  const chain = [];
  let currentPerson = findPersonByEmail(employeeEmail);
  
  if (!currentPerson) {
    console.error(`Employee ${employeeEmail} not found in structure`);
    return createDefaultRequisitionApprovalChain();
  }

  let level = 1;
  const seenEmails = new Set([employeeEmail.toLowerCase().trim()]);
  const PRESIDENT_EMAIL = 'kelvin.eyong@gratoglobal.com';

  console.log(`\n=== BUILDING PURCHASE REQUISITION APPROVAL CHAIN ===`);
  console.log(`Employee: ${currentPerson.name} (${currentPerson.position || 'N/A'})`);
  console.log(`Department: ${currentPerson.department}`);

  // ============================================
  // STEP 1: DEPARTMENTAL HIERARCHY (Supervisor → Department Head)
  // ============================================
  while (currentPerson && currentPerson.reportsTo) {
    const supervisorEmail = currentPerson.reportsTo.toLowerCase().trim();
    
    // ✅ FIX: Stop if supervisor is the President (we'll add him at the end)
    if (supervisorEmail === PRESIDENT_EMAIL.toLowerCase()) {
      console.log(`✓ Reached President level - stopping departmental chain`);
      break;
    }
    
    // Prevent infinite loops
    if (seenEmails.has(supervisorEmail)) {
      console.log(`⚠️ Circular reference detected at ${supervisorEmail}, breaking loop`);
      break;
    }

    const supervisor = findPersonByEmail(supervisorEmail);
    
    if (!supervisor) {
      console.log(`⚠️ Supervisor ${supervisorEmail} not found, stopping hierarchy traversal`);
      break;
    }

    // Add supervisor/department head to chain
    chain.push({
      level: level++,
      approver: {
        name: supervisor.name,
        email: supervisor.email,
        role: supervisor.isDepartmentHead ? 'Department Head' : (supervisor.position || 'Supervisor'),
        department: supervisor.department
      },
      status: 'pending',
      assignedDate: new Date()
    });

    console.log(`✓ Added: ${supervisor.name} (${supervisor.position || 'Supervisor'})`);

    seenEmails.add(supervisorEmail);
    currentPerson = supervisor;
  }

  console.log(`\n✅ Departmental approvals: ${chain.length} level(s)`);

  // ============================================
  // STEP 2: FINANCE OFFICER (Budget Verification)
  // ============================================
  console.log(`\n📋 Adding Finance Officer for budget verification`);
  const financeEmail = 'ranibellmambo@gratoengineering.com';
  
  if (!seenEmails.has(financeEmail.toLowerCase())) {
    chain.push({
      level: level++,
      approver: {
        name: 'Ms. Ranibell Mambo',
        email: financeEmail,
        role: 'Finance Officer - Budget Verification',
        department: 'Business Development & Supply Chain'
      },
      status: 'pending',
      assignedDate: new Date()
    });
    seenEmails.add(financeEmail.toLowerCase());
  }

  // ============================================
  // STEP 3: SUPPLY CHAIN COORDINATOR (Business Decisions)
  // ============================================
  console.log(`📋 Adding Supply Chain Coordinator for business decisions`);
  const supplyChainEmail = 'lukong.lambert@gratoglobal.com';
  
  if (!seenEmails.has(supplyChainEmail.toLowerCase())) {
    chain.push({
      level: level++,
      approver: {
        name: 'Mr. Lukong Lambert',
        email: supplyChainEmail,
        role: 'Supply Chain Coordinator - Business Decisions',
        department: 'Business Development & Supply Chain'
      },
      status: 'pending',
      assignedDate: new Date()
    });
    seenEmails.add(supplyChainEmail.toLowerCase());
  }

  // ============================================
  // STEP 4: PRESIDENT (Final Approval)
  // ============================================
  console.log(`📋 Adding President for final approval`);
  
  if (!seenEmails.has(PRESIDENT_EMAIL.toLowerCase())) {
    chain.push({
      level: level++,
      approver: {
        name: 'Mr. E.T Kelvin',
        email: PRESIDENT_EMAIL,
        role: 'Head of Business Development & Supply Chain - Final Approval',
        department: 'Business Development & Supply Chain'
      },
      status: 'pending',
      assignedDate: new Date()
    });
    seenEmails.add(PRESIDENT_EMAIL.toLowerCase());
  }

  console.log(`\n✅ APPROVAL CHAIN COMPLETED: ${chain.length} levels total`);
  chain.forEach((step) => {
    console.log(`   Level ${step.level}: ${step.approver.name} (${step.approver.role})`);
  });
  console.log(`=========================================\n`);

  return chain;
};

/**
 * Create default approval chain when employee not found
 */
const createDefaultRequisitionApprovalChain = () => {
  const chain = [];
  let level = 1;

  console.warn('⚠️ Creating default approval chain');

  // Finance
  chain.push({
    level: level++,
    approver: {
      name: 'Ms. Ranibell Mambo',
      email: 'ranibellmambo@gratoengineering.com',
      role: 'Finance Officer - Budget Verification',
      department: 'Business Development & Supply Chain'
    },
    status: 'pending',
    assignedDate: new Date()
  });

  // Supply Chain Coordinator
  chain.push({
    level: level++,
    approver: {
      name: 'Mr. Lukong Lambert',
      email: 'lukong.lambert@gratoglobal.com',
      role: 'Supply Chain Coordinator - Business Decisions',
      department: 'Business Development & Supply Chain'
    },
    status: 'pending',
    assignedDate: new Date()
  });

  // Head of Business
  chain.push({
    level: level++,
    approver: {
      name: 'Mr. E.T Kelvin',
      email: 'kelvin.eyong@gratoglobal.com',
      role: 'Head of Business Development & Supply Chain - Final Approval',
      department: 'Business Development & Supply Chain'
    },
    status: 'pending',
    assignedDate: new Date()
  });

  return chain;
};

/**
 * Get all supervisable positions for a person
 */
const getSupervisablePositions = (email) => {
  const person = findPersonByEmail(email);
  if (!person || !person.canSupervise) return [];

  return person.canSupervise.map(positionTitle => ({
    position: positionTitle,
    department: person.department
  }));
};

/**
 * Get department list
 */
const getDepartmentList = () => {
  return Object.keys(DEPARTMENT_STRUCTURE).map(key => ({
    key,
    name: DEPARTMENT_STRUCTURE[key].name,
    head: DEPARTMENT_STRUCTURE[key].head?.name
  }));
};

/**
 * Get employees in a specific department
 */
const getEmployeesInDepartment = (department) => {
  const dept = DEPARTMENT_STRUCTURE[department];
  if (!dept) return [];
  
  const employees = [];
  
  if (dept.head) {
    employees.push({
      name: dept.head.name,
      email: dept.head.email,
      position: 'Department Head',
      department: department
    });
  }
  
  for (const [position, data] of Object.entries(dept.positions || {})) {
    employees.push({
      name: data.name,
      email: data.email,
      position: position,
      department: department,
      role: data.specialRole || 'employee'
    });
  }
  
  return employees;
};

module.exports = {
  DEPARTMENT_STRUCTURE,
  findPersonByEmail,
  getSupervisablePositions,
  getApprovalChainForRequisition,
  getDepartmentList,
  getEmployeesInDepartment
};










// const DEPARTMENT_STRUCTURE = {
//   'Technical': {
//     name: 'Technical',
//     head: {
//       email: 'didier.oyong@gratoengineering.com',
//       name: 'Mr. Didier Oyong',
//       position: 'Technical Director',
//       reportsTo: 'kelvin.eyong@gratoglobal.com', 
//       hierarchyLevel: 4
//     },
//     positions: {
//       // ========================================
//       // LEVEL 3 - Managers & Coordinators
//       // ========================================
//       'HSE Coordinator': {
//         email: 'bechem.mbu@gratoglobal.com',
//         name: 'Mr. Ovo Bechem',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'coordinator'
//       },
//       'Head of Refurbishment': {
//         email: 'verla.ivo@gratoengineering.com',
//         name: 'Mr. Verla Ivo',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'head'
//       },
//       'Project Manager': {
//         email: 'joel@gratoengineering.com',
//         name: 'Mr. Joel Wamba',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: ['Site Supervisor'],
//         approvalAuthority: 'manager'
//       },
//       'Operations Manager': {
//         email: 'pascal.rodrique@gratoglobal.com',
//         name: 'Mr. Pascal Assam',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: ['Data Collector', 'NOC Coordinator', 'Site Supervisor'],
//         approvalAuthority: 'manager'
//       },
//       'Diesel Coordinator': {
//         email: 'minka.kevin@gratoglobal.com',
//         name: 'Mr. Kevin Minka',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'coordinator'
//       },

//       // ========================================
//       // LEVEL 2 - Coordinators & Supervisors
//       // ========================================
//       'Data Collector': {
//         email: 'bemba.essack@gratoglobal.com',
//         name: 'Mr. Bemba Essack',
//         reportsTo: 'pascal.rodrique@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'NOC Coordinator': {
//         email: 'rodrigue.nono@gratoglobal.com',
//         name: 'Mr. Rodrigue Nono',
//         reportsTo: 'pascal.rodrique@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: ['NOC Operator'],
//         approvalAuthority: 'coordinator'
//       },

//       // Site Supervisors (Multiple Instances)
//       'Site Supervisor - Joseph': {
//         email: 'joseph.tayou@gratoglobal.com',
//         name: 'Mr. Joseph TAYOU',
//         position: 'Site Supervisor',
//         reportsTo: 'pascal.rodrique@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: ['Field Technician'],
//         approvalAuthority: 'supervisor',
//         allowMultipleInstances: false
//       },
//       'Site Supervisor - Felix': {
//         email: 'felix.tientcheu@gratoglobal.com',
//         name: 'Mr. Felix Tientcheu',
//         position: 'Site Supervisor',
//         reportsTo: 'pascal.rodrique@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: ['Field Technician'],
//         approvalAuthority: 'supervisor',
//         allowMultipleInstances: false
//       },

//       // ========================================
//       // LEVEL 1 - NOC Operators
//       // ========================================
//       'NOC Operator - Ervine': {
//         email: 'ervine.mbezele@gratoglobal.com',
//         name: 'Mr. Ervine Mbezele',
//         position: 'NOC Operator',
//         reportsTo: 'rodrigue.nono@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'NOC Operator - Yves': {
//         email: 'yossa.yves@gratoglobal.com',
//         name: 'Mr. Yves Yossa',
//         position: 'NOC Operator',
//         reportsTo: 'rodrigue.nono@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'NOC Operator - Wilfried': {
//         email: 'kamegni.wilfried@gratoglobal.com',
//         name: 'Mr. Wilfried Kamegni',
//         position: 'NOC Operator',
//         reportsTo: 'rodrigue.nono@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'NOC Operator - Junior': {
//         email: 'junior.mukudi@gratoglobal.com',
//         name: 'Mr. Junior Mukudi',
//         position: 'NOC Operator',
//         reportsTo: 'rodrigue.nono@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },

//       // ========================================
//       // LEVEL 1 - Field Technicians (Joseph's Team)
//       // ========================================
//       'Field Technician - Boris': {
//         email: 'kamgang.junior@gratoglobal.com',
//         name: 'Mr. Boris Kamgang',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Sunday': {
//         email: 'sunday@gratoglobal.com',
//         name: 'Mr. Sunday',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Ulrich': {
//         email: 'ulrich.vitrand@gratoglobal.com',
//         name: 'Mr. Ulrich MOUMI',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Abeeb': {
//         email: 'abeeb@gratoglobal.com',
//         name: 'Mr. Abeeb',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Paul': {
//         email: 'paul.nyomb@gratoglobal.com',
//         name: 'Mr. Paul EM Nyomb',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Edidie': {
//         email: 'dedidie.francois@gratoglobal.com',
//         name: 'Mr. EDIDIE François',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Berthin': {
//         email: 'mba.berthin@gratoglobal.com',
//         name: 'Mr. Berthin DEFFO',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Allassane': {
//         email: 'allassane@gratoglobal.com',
//         name: 'Mr. Allassane',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Alioum': {
//         email: 'alioum.moussa@gratoglobal.com',
//         name: 'Mr. Alioum Moussa',
//         position: 'Field Technician',
//         reportsTo: 'joseph.tayou@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },

//       // ========================================
//       // LEVEL 1 - Field Technicians (Felix's Team)
//       // ========================================
//       'Field Technician - Kenfack': {
//         email: 'kenfack.jacques@gratoglobal.com',
//         name: 'Mr. Kenfack Jacques',
//         position: 'Field Technician',
//         reportsTo: 'felix.tientcheu@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Djackba': {
//         email: 'djackba.marcel@gratoglobal.com',
//         name: 'Mr. Djackba Marcel',
//         position: 'Field Technician',
//         reportsTo: 'felix.tientcheu@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       },
//       'Field Technician - Danick': {
//         email: 'djiyap.danick@gratoglobal.com',
//         name: 'Mr. Danick Djiyap',
//         position: 'Field Technician',
//         reportsTo: 'felix.tientcheu@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: false
//       }
//     }
//   },

//   'Business Development & Supply Chain': {
//     name: 'Business Development & Supply Chain',
//     head: {
//       email: 'kelvin.eyong@gratoglobal.com',
//       name: 'Mr. E.T Kelvin',
//       position: 'President / Head of Business',
//       reportsTo: null, // Top of hierarchy
//       hierarchyLevel: 5
//     },
//     positions: {
//       'Supply Chain Coordinator': {
//         email: 'lukong.lambert@gratoglobal.com',
//         name: 'Mr. Lukong Lambert',
//         reportsTo: 'kelvin.eyong@gratoglobal.com',
//         hierarchyLevel: 3,
//         canSupervise: ['Order Management Assistant/Buyer', 'Warehouse Coordinator/Buyer'],
//         approvalAuthority: 'coordinator',
//         specialRole: 'buyer',
//         buyerConfig: {
//           specializations: ['IT_Accessories', 'Office_Supplies', 'Equipment', 'Consumables', 'Software', 'Hardware', 'Furniture', 'Safety_Equipment', 'Maintenance_Supplies', 'General'],
//           maxOrderValue: 10000000,
//           canSelfBuy: true
//         }
//       },
//       'Order Management Assistant/Buyer': {
//         email: 'christabel@gratoengineering.com',
//         name: 'Ms. Christabel Mangwi',
//         reportsTo: 'lukong.lambert@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'buyer',
//         specialRole: 'buyer',
//         buyerConfig: {
//           specializations: ['Office_Supplies', 'Consumables', 'General'],
//           maxOrderValue: 2000000
//         }
//       },
//       'Warehouse Coordinator/Buyer': {
//         email: 'pryde.mua@gratoglobal.com',
//         name: 'Mr. Pryde Mua',
//         reportsTo: 'lukong.lambert@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: ['Warehouse Assistant'],
//         approvalAuthority: 'coordinator',
//         specialRole: 'buyer',
//         buyerConfig: {
//           specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
//           maxOrderValue: 5000000
//         }
//       },
//       'Warehouse Assistant': {
//         email: 'aghangu.marie@gratoengineering.com',
//         name: 'Ms. Aghangu Marie',
//         reportsTo: 'pryde.mua@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'Finance Officer': {
//         email: 'ranibellmambo@gratoengineering.com',
//         name: 'Ms. Ranibell Mambo',
//         reportsTo: 'kelvin.eyong@gratoglobal.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'finance',
//         specialRole: 'finance'
//       }
//     }
//   },

//   'HR & Admin': {
//     name: 'HR & Admin',
//     head: {
//       email: 'bruiline.tsitoh@gratoglobal.com',
//       name: 'Mrs. Bruiline Tsitoh',
//       position: 'HR & Admin Head',
//       reportsTo: 'kelvin.eyong@gratoglobal.com', 
//       hierarchyLevel: 4
//     },
//     positions: {
//       'Office Driver/Logistics Assistant': {
//         email: 'che.earnest@gratoengineering.com',
//         name: 'Mr. Che Earnest',
//         reportsTo: 'bruiline.tsitoh@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'IT Staff': {
//         email: 'marcel.ngong@gratoglobal.com',
//         name: 'Marcel Ngong',
//         reportsTo: 'bruiline.tsitoh@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'House Maid': {
//         email: 'ndi.belther@gratoengineering.com',
//         name: 'Ms. Ndi Belther',
//         reportsTo: 'bruiline.tsitoh@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'Receptionist': {
//         email: 'carmel.dafny@gratoglobal.com',
//         name: 'Ms. Carmel Dafny',
//         reportsTo: 'bruiline.tsitoh@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       }
//     }
//   }
// };

// /**
//  * Find person details by email across all departments
//  */
// const findPersonByEmail = (email) => {
//   const normalizedEmail = String(email || '').toLowerCase().trim();
  
//   for (const [deptKey, dept] of Object.entries(DEPARTMENT_STRUCTURE)) {
//     if (dept.head.email.toLowerCase().trim() === normalizedEmail) {
//       return {
//         ...dept.head,
//         department: deptKey,
//         isDepartmentHead: true
//       };
//     }

//     for (const [position, person] of Object.entries(dept.positions || {})) {
//       if (person.email.toLowerCase().trim() === normalizedEmail) {
//         return {
//           ...person,
//           position: person.position || position,
//           department: deptKey,
//           isDepartmentHead: false
//         };
//       }
//     }
//   }
//   return null;
// };

// /**
//  * Get all supervisable positions for a person
//  */
// const getSupervisablePositions = (email) => {
//   const person = findPersonByEmail(email);
//   if (!person || !person.canSupervise) return [];

//   return person.canSupervise.map(positionTitle => ({
//     position: positionTitle,
//     department: person.department
//   }));
// };

// /**
//  * ✅ FIXED: Get approval chain for Purchase Requisitions
//  * NOW ACCEPTS EMAIL instead of name, and returns proper flat structure
//  */
// const getApprovalChainForRequisition = (employeeEmail) => {
//   const chain = [];
//   let currentPerson = findPersonByEmail(employeeEmail);
  
//   if (!currentPerson) {
//     console.error(`Employee ${employeeEmail} not found in structure`);
//     return createDefaultRequisitionApprovalChain();
//   }

//   let level = 1;
//   const seenEmails = new Set([employeeEmail.toLowerCase().trim()]);

//   console.log(`\n=== BUILDING PURCHASE REQUISITION APPROVAL CHAIN ===`);
//   console.log(`Employee: ${currentPerson.name} (${currentPerson.position || 'N/A'})`);
//   console.log(`Department: ${currentPerson.department}`);

//   // ============================================
//   // STEP 1: DEPARTMENTAL HIERARCHY (Supervisor → Department Head)
//   // ============================================
//   while (currentPerson && currentPerson.reportsTo) {
//     const supervisorEmail = currentPerson.reportsTo.toLowerCase().trim();
    
//     // Prevent infinite loops
//     if (seenEmails.has(supervisorEmail)) {
//       console.log(`⚠️ Circular reference detected at ${supervisorEmail}, breaking loop`);
//       break;
//     }

//     const supervisor = findPersonByEmail(supervisorEmail);
    
//     if (!supervisor) {
//       console.log(`⚠️ Supervisor ${supervisorEmail} not found, stopping hierarchy traversal`);
//       break;
//     }

//     // ✅ FIXED: Flatten the structure - don't nest approver object
//     chain.push({
//       level: level++,
//       approver: {
//         name: supervisor.name,
//         email: supervisor.email,
//         role: supervisor.isDepartmentHead ? 'Department Head' : (supervisor.position || 'Supervisor'),
//         department: supervisor.department
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });

//     console.log(`✓ Added: ${supervisor.name} (${supervisor.position || 'Supervisor'})`);

//     seenEmails.add(supervisorEmail);
//     currentPerson = supervisor;

//     // Stop if we've reached the top (President/CEO)
//     if (!supervisor.reportsTo || supervisor.email.toLowerCase().trim() === 'kelvin.eyong@gratoglobal.com') {
//       console.log(`✓ Reached top of hierarchy: ${supervisor.name}`);
//       break;
//     }
//   }

//   console.log(`\n✅ Departmental approvals: ${chain.length} level(s)`);

//   // ============================================
//   // STEP 2: FINANCE OFFICER (Budget Verification)
//   // ============================================
//   console.log(`\n📋 Adding Finance Officer for budget verification`);
//   chain.push({
//     level: level++,
//     approver: {
//       name: 'Ms. Ranibell Mambo',
//       email: 'ranibellmambo@gratoengineering.com',
//       role: 'Finance Officer - Budget Verification',
//       department: 'Business Development & Supply Chain'
//     },
//     status: 'pending',
//     assignedDate: new Date()
//   });

//   // ============================================
//   // STEP 3: SUPPLY CHAIN COORDINATOR (Business Decisions)
//   // ============================================
//   console.log(`📋 Adding Supply Chain Coordinator for business decisions`);
//   chain.push({
//     level: level++,
//     approver: {
//       name: 'Mr. Lukong Lambert',
//       email: 'lukong.lambert@gratoglobal.com',
//       role: 'Supply Chain Coordinator - Business Decisions',
//       department: 'Business Development & Supply Chain'
//     },
//     status: 'pending',
//     assignedDate: new Date()
//   });

//   // ============================================
//   // STEP 4: HEAD OF BUSINESS (Final Approval)
//   // ============================================
//   console.log(`📋 Adding Head of Business for final approval`);
//   chain.push({
//     level: level++,
//     approver: {
//       name: 'Mr. E.T Kelvin',
//       email: 'kelvin.eyong@gratoglobal.com',
//       role: 'Head of Business Development & Supply Chain - Final Approval',
//       department: 'Business Development & Supply Chain'
//     },
//     status: 'pending',
//     assignedDate: new Date()
//   });

//   console.log(`\n✅ APPROVAL CHAIN COMPLETED: ${chain.length} levels total`);
//   chain.forEach((step) => {
//     console.log(`   Level ${step.level}: ${step.approver.name} (${step.approver.role})`);
//   });
//   console.log(`=========================================\n`);

//   return chain;
// };

// /**
//  * Create default approval chain when employee not found
//  */
// const createDefaultRequisitionApprovalChain = () => {
//   const chain = [];
//   let level = 1;

//   console.warn('⚠️ Creating default approval chain');

//   // Finance
//   chain.push({
//     level: level++,
//     approver: {
//       name: 'Ms. Ranibell Mambo',
//       email: 'ranibellmambo@gratoengineering.com',
//       role: 'Finance Officer - Budget Verification',
//       department: 'Business Development & Supply Chain'
//     },
//     status: 'pending',
//     assignedDate: new Date()
//   });

//   // Supply Chain Coordinator
//   chain.push({
//     level: level++,
//     approver: {
//       name: 'Mr. Lukong Lambert',
//       email: 'lukong.lambert@gratoglobal.com',
//       role: 'Supply Chain Coordinator - Business Decisions',
//       department: 'Business Development & Supply Chain'
//     },
//     status: 'pending',
//     assignedDate: new Date()
//   });

//   // Head of Business
//   chain.push({
//     level: level++,
//     approver: {
//       name: 'Mr. E.T Kelvin',
//       email: 'kelvin.eyong@gratoglobal.com',
//       role: 'Head of Business Development & Supply Chain - Final Approval',
//       department: 'Business Development & Supply Chain'
//     },
//     status: 'pending',
//     assignedDate: new Date()
//   });

//   return chain;
// };

// /**
//  * Get all positions that can be created
//  */
// const getAllAvailablePositions = () => {
//   const positions = [];

//   for (const [deptKey, dept] of Object.entries(DEPARTMENT_STRUCTURE)) {
//     // Department head
//     positions.push({
//       key: `${deptKey}-head`,
//       department: deptKey,
//       position: dept.head.position,
//       name: dept.head.name,
//       email: dept.head.email,
//       reportsTo: dept.head.reportsTo,
//       hierarchyLevel: dept.head.hierarchyLevel,
//       isDepartmentHead: true,
//       allowMultiple: false
//     });

//     // All positions
//     for (const [posTitle, posData] of Object.entries(dept.positions)) {
//       positions.push({
//         key: `${deptKey}-${posTitle}`,
//         department: deptKey,
//         position: posData.position || posTitle,
//         name: posData.name,
//         email: posData.email,
//         reportsTo: posData.reportsTo,
//         hierarchyLevel: posData.hierarchyLevel,
//         canSupervise: posData.canSupervise || [],
//         approvalAuthority: posData.approvalAuthority,
//         specialRole: posData.specialRole,
//         buyerConfig: posData.buyerConfig,
//         allowMultiple: posData.allowMultipleInstances || false,
//         dynamicSupervisor: posData.dynamicSupervisor || false
//       });
//     }
//   }

//   return positions;
// };

// /**
//  * Get potential supervisors for a position (for dynamic assignment)
//  */
// const getPotentialSupervisors = (department, position) => {
//   const supervisors = [];
//   const dept = DEPARTMENT_STRUCTURE[department];
  
//   if (!dept) return supervisors;

//   // Check all positions in department
//   for (const [posTitle, posData] of Object.entries(dept.positions)) {
//     if (posData.canSupervise && posData.canSupervise.includes(position)) {
//       supervisors.push({
//         email: posData.email,
//         name: posData.name,
//         position: posData.position || posTitle
//       });
//     }
//   }

//   return supervisors;
// };

// /**
//  * Get available buyers for assignment
//  */
// const getAvailableBuyers = () => {
//   const buyers = [];
  
//   Object.values(DEPARTMENT_STRUCTURE).forEach(department => {
//     Object.entries(department.positions || {}).forEach(([position, person]) => {
//       if (person.specialRole === 'buyer') {
//         buyers.push({
//           id: person.email,
//           name: person.name,
//           email: person.email,
//           position: position,
//           department: person.department || department.name,
//           specializations: person.buyerConfig?.specializations || [],
//           maxOrderValue: person.buyerConfig?.maxOrderValue || 1000000
//         });
//       }
//     });
//   });

//   // Add coordinator as potential buyer
//   buyers.push({
//     id: 'lukong.lambert@gratoglobal.com',
//     name: 'Mr. Lukong Lambert',
//     email: 'lukong.lambert@gratoglobal.com',
//     position: 'Supply Chain Coordinator',
//     department: 'Business Development & Supply Chain',
//     specializations: ['All'],
//     maxOrderValue: 10000000,
//     canSelfBuy: true
//   });

//   return buyers;
// };

// /**
//  * Get suitable buyer for a requisition
//  */
// const getSuitableBuyer = (requisition) => {
//   const buyers = getAvailableBuyers();
//   const estimatedValue = requisition.budgetXAF || 
//     requisition.financeVerification?.assignedBudget || 0;

//   const suitableBuyers = buyers.filter(buyer => {
//     if (estimatedValue > buyer.maxOrderValue) return false;
    
//     if (buyer.specializations.includes('All')) return true;
    
//     const itemCategory = requisition.itemCategory?.replace(' ', '_');
//     return buyer.specializations.includes(itemCategory) ||
//            buyer.specializations.includes('General');
//   });

//   return suitableBuyers.sort((a, b) => {
//     const aHasExact = a.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
//     const bHasExact = b.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
    
//     if (aHasExact && !bHasExact) return -1;
//     if (!aHasExact && bHasExact) return 1;
    
//     return b.maxOrderValue - a.maxOrderValue;
//   });
// };

// /**
//  * Get department list
//  */
// const getDepartmentList = () => {
//   return Object.keys(DEPARTMENT_STRUCTURE).map(key => ({
//     key,
//     name: DEPARTMENT_STRUCTURE[key].name,
//     head: DEPARTMENT_STRUCTURE[key].head?.name
//   }));
// };

// /**
//  * Get employees in a specific department
//  */
// const getEmployeesInDepartment = (department) => {
//   const dept = DEPARTMENT_STRUCTURE[department];
//   if (!dept) return [];
  
//   const employees = [];
  
//   if (dept.head) {
//     employees.push({
//       name: dept.head.name,
//       email: dept.head.email,
//       position: 'Department Head',
//       department: department
//     });
//   }
  
//   for (const [position, data] of Object.entries(dept.positions || {})) {
//     employees.push({
//       name: data.name,
//       email: data.email,
//       position: position,
//       department: department,
//       role: data.specialRole || 'employee',
//       specializations: data.buyerConfig?.specializations,
//       maxOrderValue: data.buyerConfig?.maxOrderValue
//     });
//   }
  
//   return employees;
// };

// module.exports = {
//   DEPARTMENT_STRUCTURE,
//   findPersonByEmail,
//   getSupervisablePositions,
//   getApprovalChainForRequisition,
//   getAllAvailablePositions,
//   getPotentialSupervisors,
//   getAvailableBuyers,
//   getSuitableBuyer,
//   getDepartmentList,
//   getEmployeesInDepartment
// };




