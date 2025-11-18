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
      // ========================================
      // LEVEL 3 - Managers & Coordinators
      // ========================================
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

      // ========================================
      // LEVEL 2 - Coordinators & Supervisors
      // ========================================
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

      // Site Supervisors (Multiple Instances)
      'Site Supervisor - Joseph': {
        email: 'joseph.tayou@gratoglobal.com',
        name: 'Mr. Joseph TAYOU',
        position: 'Site Supervisor',
        reportsTo: 'pascal.rodrique@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: ['Field Technician'],
        approvalAuthority: 'supervisor',
        allowMultipleInstances: false
      },
      'Site Supervisor - Felix': {
        email: 'felix.tientcheu@gratoglobal.com',
        name: 'Mr. Felix Tientcheu',
        position: 'Site Supervisor',
        reportsTo: 'pascal.rodrique@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: ['Field Technician'],
        approvalAuthority: 'supervisor',
        allowMultipleInstances: false
      },

      // ========================================
      // LEVEL 1 - NOC Operators
      // ========================================
      'NOC Operator - Ervine': {
        email: 'ervine.mbezele@gratoglobal.com',
        name: 'Mr. Ervine Mbezele',
        position: 'NOC Operator',
        reportsTo: 'rodrigue.nono@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'NOC Operator - Yves': {
        email: 'yossa.yves@gratoglobal.com',
        name: 'Mr. Yves Yossa',
        position: 'NOC Operator',
        reportsTo: 'rodrigue.nono@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'NOC Operator - Wilfried': {
        email: 'kamegni.wilfried@gratoglobal.com',
        name: 'Mr. Wilfried Kamegni',
        position: 'NOC Operator',
        reportsTo: 'rodrigue.nono@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'NOC Operator - Junior': {
        email: 'junior.mukudi@gratoglobal.com',
        name: 'Mr. Junior Mukudi',
        position: 'NOC Operator',
        reportsTo: 'rodrigue.nono@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },

      // ========================================
      // LEVEL 1 - Field Technicians (Joseph's Team)
      // ========================================
      'Field Technician - Boris': {
        email: 'kamgang.junior@gratoglobal.com',
        name: 'Mr. Boris Kamgang',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Sunday': {
        email: 'sunday@gratoglobal.com',
        name: 'Mr. Sunday',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Ulrich': {
        email: 'ulrich.vitrand@gratoglobal.com',
        name: 'Mr. Ulrich MOUMI',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Abeeb': {
        email: 'abeeb@gratoglobal.com',
        name: 'Mr. Abeeb',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Paul': {
        email: 'paul.nyomb@gratoglobal.com',
        name: 'Mr. Paul EM Nyomb',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Edidie': {
        email: 'dedidie.francois@gratoglobal.com',
        name: 'Mr. EDIDIE François',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Berthin': {
        email: 'mba.berthin@gratoglobal.com',
        name: 'Mr. Berthin DEFFO',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Allassane': {
        email: 'allassane@gratoglobal.com',
        name: 'Mr. Allassane',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Alioum': {
        email: 'alioum.moussa@gratoglobal.com',
        name: 'Mr. Alioum Moussa',
        position: 'Field Technician',
        reportsTo: 'joseph.tayou@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },

      // ========================================
      // LEVEL 1 - Field Technicians (Felix's Team)
      // ========================================
      'Field Technician - Kenfack': {
        email: 'kenfack.jacques@gratoglobal.com',
        name: 'Mr. Kenfack Jacques',
        position: 'Field Technician',
        reportsTo: 'felix.tientcheu@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Djackba': {
        email: 'djackba.marcel@gratoglobal.com',
        name: 'Mr. Djackba Marcel',
        position: 'Field Technician',
        reportsTo: 'felix.tientcheu@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      },
      'Field Technician - Danick': {
        email: 'djiyap.danick@gratoglobal.com',
        name: 'Mr. Danick Djiyap',
        position: 'Field Technician',
        reportsTo: 'felix.tientcheu@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: false
      }
    }
  },

  'Business Development & Supply Chain': {
    name: 'Business Development & Supply Chain',
    head: {
      email: 'kelvin.eyong@gratoglobal.com',
      name: 'Mr. E.T Kelvin',
      position: 'President / Head of Business',
      reportsTo: null, // Top of hierarchy
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
        specialRole: 'buyer',
        buyerConfig: {
          specializations: ['IT_Accessories', 'Office_Supplies', 'Equipment', 'Consumables', 'Software', 'Hardware', 'Furniture', 'Safety_Equipment', 'Maintenance_Supplies', 'General'],
          maxOrderValue: 10000000,
          canSelfBuy: true
        }
      },
      'Order Management Assistant/Buyer': {
        email: 'christabel@gratoengineering.com',
        name: 'Ms. Christabel Mangwi',
        reportsTo: 'lukong.lambert@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'buyer',
        specialRole: 'buyer',
        buyerConfig: {
          specializations: ['Office_Supplies', 'Consumables', 'General'],
          maxOrderValue: 2000000
        }
      },
      'Warehouse Coordinator/Buyer': {
        email: 'pryde.mua@gratoglobal.com',
        name: 'Mr. Pryde Mua',
        reportsTo: 'lukong.lambert@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: ['Warehouse Assistant'],
        approvalAuthority: 'coordinator',
        specialRole: 'buyer',
        buyerConfig: {
          specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
          maxOrderValue: 5000000
        }
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
        name: 'Ms. Carmel Dafny',
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
 * ✅ FIXED: Get approval chain for Purchase Requisitions
 * NOW ACCEPTS EMAIL instead of name, and returns proper flat structure
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

  console.log(`\n=== BUILDING PURCHASE REQUISITION APPROVAL CHAIN ===`);
  console.log(`Employee: ${currentPerson.name} (${currentPerson.position || 'N/A'})`);
  console.log(`Department: ${currentPerson.department}`);

  // ============================================
  // STEP 1: DEPARTMENTAL HIERARCHY (Supervisor → Department Head)
  // ============================================
  while (currentPerson && currentPerson.reportsTo) {
    const supervisorEmail = currentPerson.reportsTo.toLowerCase().trim();
    
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

    // ✅ FIXED: Flatten the structure - don't nest approver object
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

    // Stop if we've reached the top (President/CEO)
    if (!supervisor.reportsTo || supervisor.email.toLowerCase().trim() === 'kelvin.eyong@gratoglobal.com') {
      console.log(`✓ Reached top of hierarchy: ${supervisor.name}`);
      break;
    }
  }

  console.log(`\n✅ Departmental approvals: ${chain.length} level(s)`);

  // ============================================
  // STEP 2: FINANCE OFFICER (Budget Verification)
  // ============================================
  console.log(`\n📋 Adding Finance Officer for budget verification`);
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

  // ============================================
  // STEP 3: SUPPLY CHAIN COORDINATOR (Business Decisions)
  // ============================================
  console.log(`📋 Adding Supply Chain Coordinator for business decisions`);
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

  // ============================================
  // STEP 4: HEAD OF BUSINESS (Final Approval)
  // ============================================
  console.log(`📋 Adding Head of Business for final approval`);
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
 * Get all positions that can be created
 */
const getAllAvailablePositions = () => {
  const positions = [];

  for (const [deptKey, dept] of Object.entries(DEPARTMENT_STRUCTURE)) {
    // Department head
    positions.push({
      key: `${deptKey}-head`,
      department: deptKey,
      position: dept.head.position,
      name: dept.head.name,
      email: dept.head.email,
      reportsTo: dept.head.reportsTo,
      hierarchyLevel: dept.head.hierarchyLevel,
      isDepartmentHead: true,
      allowMultiple: false
    });

    // All positions
    for (const [posTitle, posData] of Object.entries(dept.positions)) {
      positions.push({
        key: `${deptKey}-${posTitle}`,
        department: deptKey,
        position: posData.position || posTitle,
        name: posData.name,
        email: posData.email,
        reportsTo: posData.reportsTo,
        hierarchyLevel: posData.hierarchyLevel,
        canSupervise: posData.canSupervise || [],
        approvalAuthority: posData.approvalAuthority,
        specialRole: posData.specialRole,
        buyerConfig: posData.buyerConfig,
        allowMultiple: posData.allowMultipleInstances || false,
        dynamicSupervisor: posData.dynamicSupervisor || false
      });
    }
  }

  return positions;
};

/**
 * Get potential supervisors for a position (for dynamic assignment)
 */
const getPotentialSupervisors = (department, position) => {
  const supervisors = [];
  const dept = DEPARTMENT_STRUCTURE[department];
  
  if (!dept) return supervisors;

  // Check all positions in department
  for (const [posTitle, posData] of Object.entries(dept.positions)) {
    if (posData.canSupervise && posData.canSupervise.includes(position)) {
      supervisors.push({
        email: posData.email,
        name: posData.name,
        position: posData.position || posTitle
      });
    }
  }

  return supervisors;
};

/**
 * Get available buyers for assignment
 */
const getAvailableBuyers = () => {
  const buyers = [];
  
  Object.values(DEPARTMENT_STRUCTURE).forEach(department => {
    Object.entries(department.positions || {}).forEach(([position, person]) => {
      if (person.specialRole === 'buyer') {
        buyers.push({
          id: person.email,
          name: person.name,
          email: person.email,
          position: position,
          department: person.department || department.name,
          specializations: person.buyerConfig?.specializations || [],
          maxOrderValue: person.buyerConfig?.maxOrderValue || 1000000
        });
      }
    });
  });

  // Add coordinator as potential buyer
  buyers.push({
    id: 'lukong.lambert@gratoglobal.com',
    name: 'Mr. Lukong Lambert',
    email: 'lukong.lambert@gratoglobal.com',
    position: 'Supply Chain Coordinator',
    department: 'Business Development & Supply Chain',
    specializations: ['All'],
    maxOrderValue: 10000000,
    canSelfBuy: true
  });

  return buyers;
};

/**
 * Get suitable buyer for a requisition
 */
const getSuitableBuyer = (requisition) => {
  const buyers = getAvailableBuyers();
  const estimatedValue = requisition.budgetXAF || 
    requisition.financeVerification?.assignedBudget || 0;

  const suitableBuyers = buyers.filter(buyer => {
    if (estimatedValue > buyer.maxOrderValue) return false;
    
    if (buyer.specializations.includes('All')) return true;
    
    const itemCategory = requisition.itemCategory?.replace(' ', '_');
    return buyer.specializations.includes(itemCategory) ||
           buyer.specializations.includes('General');
  });

  return suitableBuyers.sort((a, b) => {
    const aHasExact = a.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
    const bHasExact = b.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
    
    if (aHasExact && !bHasExact) return -1;
    if (!aHasExact && bHasExact) return 1;
    
    return b.maxOrderValue - a.maxOrderValue;
  });
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
      role: data.specialRole || 'employee',
      specializations: data.buyerConfig?.specializations,
      maxOrderValue: data.buyerConfig?.maxOrderValue
    });
  }
  
  return employees;
};

module.exports = {
  DEPARTMENT_STRUCTURE,
  findPersonByEmail,
  getSupervisablePositions,
  getApprovalChainForRequisition,
  getAllAvailablePositions,
  getPotentialSupervisors,
  getAvailableBuyers,
  getSuitableBuyer,
  getDepartmentList,
  getEmployeesInDepartment
};










// const DEPARTMENT_STRUCTURE = {
//     'Technical': {
//         name: 'Technical',
//         head: {
//             email: 'didier.oyong@gratoengineering.com',
//             name: 'Mr. Didier Oyong',
//             position: 'Technical Director',
//             reportsTo: 'kelvin.eyong@gratoglobal.com',
//             hierarchyLevel: 4
//         },
//         positions: {
//             'HSE Coordinator': {
//                 email: 'bechem.mbu@gratoglobal.com',
//                 name: 'Mr. Ovo Bechem',
//                 reportsTo: 'didier.oyong@gratoengineering.com',
//                 hierarchyLevel: 3
//             },
//             'Operations Manager': {
//                 email: 'pascal.rodrique@gratoglobal.com',
//                 name: 'Mr. Pascal Assam',
//                 reportsTo: 'didier.oyong@gratoengineering.com',
//                 hierarchyLevel: 3
//             }
//             // ... other positions
//         }
//     },
//     'Business Development & Supply Chain': {
//         name: 'Business Development & Supply Chain',
//         head: {
//             email: 'kelvin.eyong@gratoglobal.com',
//             name: 'Mr. E.T Kelvin',
//             position: 'Head of Business Development & Supply Chain',
//             reportsTo: null,
//             hierarchyLevel: 5
//         },
//         positions: {
//             'Supply Chain Coordinator': {
//                 email: 'lukong.lambert@gratoglobal.com',
//                 name: 'Mr. Lukong Lambert',
//                 reportsTo: 'kelvin.eyong@gratoglobal.com',
//                 hierarchyLevel: 3,
//                 role: 'supply_chain_coordinator',
//                 specializations: ['All'],
//                 maxOrderValue: 10000000,
//                 canSelfBuy: true
//             },
//             'Finance Officer': {
//                 email: 'ranibellmambo@gratoengineering.com',
//                 name: 'Ms. Ranibell Mambo',
//                 reportsTo: 'kelvin.eyong@gratoglobal.com',
//                 hierarchyLevel: 3,
//                 role: 'finance'
//             },
//             'Order Management Assistant/Buyer': {
//                 email: 'christabel@gratoengineering.com',
//                 name: 'Ms. Christabel Mangwi',
//                 reportsTo: 'lukong.lambert@gratoglobal.com',
//                 hierarchyLevel: 2,
//                 role: 'buyer',
//                 specializations: ['Office_Supplies', 'Consumables', 'General'],
//                 maxOrderValue: 2000000
//             },
//             'Warehouse Coordinator/Buyer': {
//                 email: 'pryde.mua@gratoglobal.com',
//                 name: 'Mr. Pryde Mua',
//                 reportsTo: 'lukong.lambert@gratoglobal.com',
//                 hierarchyLevel: 2,
//                 role: 'buyer',
//                 specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
//                 maxOrderValue: 5000000
//             }
//         }
//     },
//     'HR & Admin': {
//         name: 'HR & Admin',
//         head: {
//             email: 'bruiline.tsitoh@gratoglobal.com',
//             name: 'Mrs. Bruiline Tsitoh',
//             position: 'HR & Admin Head',
//             reportsTo: 'kelvin.eyong@gratoglobal.com',
//             hierarchyLevel: 4
//         },
//         positions: {
//             // ... positions
//         }
//     }
// };

// /**
//  * ✅ ENHANCED: Get approval chain with Finance → Supply Chain Coordinator → Head of Business
//  */
// const getApprovalChain = (employeeName, department) => {
//     const chain = [];
    
//     console.log(`\n=== BUILDING REQUISITION APPROVAL CHAIN ===`);
//     console.log(`Employee: ${employeeName} in ${department}`);
    
//     // Find employee's data
//     let employeeData = null;
//     let employeeDepartmentName = department;
    
//     // Search for employee in department structure
//     if (DEPARTMENT_STRUCTURE[department]) {
//         if (DEPARTMENT_STRUCTURE[department].head && DEPARTMENT_STRUCTURE[department].head.name === employeeName) {
//             employeeData = {
//                 ...DEPARTMENT_STRUCTURE[department].head,
//                 position: 'Department Head',
//                 department: department
//             };
//         } else {
//             for (const [pos, data] of Object.entries(DEPARTMENT_STRUCTURE[department].positions || {})) {
//                 if (data.name === employeeName) {
//                     employeeData = { ...data, position: pos, department: department };
//                     break;
//                 }
//             }
//         }
//     }
    
//     // If not found, search all departments
//     if (!employeeData) {
//         for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
//             if (deptData.head && deptData.head.name === employeeName) {
//                 employeeData = {
//                     ...deptData.head,
//                     position: 'Department Head',
//                     department: deptKey
//                 };
//                 employeeDepartmentName = deptKey;
//                 break;
//             }
            
//             if (deptData.positions) {
//                 for (const [pos, data] of Object.entries(deptData.positions)) {
//                     if (data.name === employeeName) {
//                         employeeData = { ...data, position: pos, department: deptKey };
//                         employeeDepartmentName = deptKey;
//                         break;
//                     }
//                 }
//             }
//             if (employeeData) break;
//         }
//     }
    
//     // If still not found, create default chain
//     if (!employeeData) {
//         console.warn(`❌ Employee "${employeeName}" not found. Creating default approval chain.`);
//         return createDefaultApprovalChain(department);
//     }
    
//     let currentEmployee = employeeData;
//     let currentDepartment = employeeDepartmentName;
//     let level = 1;
    
//     console.log(`Starting from: ${currentEmployee.name} (${currentEmployee.position})`);
    
//     // ============================================
//     // STEP 1: DEPARTMENTAL APPROVALS (Supervisor → HOD)
//     // ============================================
//     while (currentEmployee && currentEmployee.reportsTo) {
//         let supervisorFound = false;
        
//         console.log(`Looking for supervisor: "${currentEmployee.reportsTo}"`);
        
//         // Check current department's positions
//         if (DEPARTMENT_STRUCTURE[currentDepartment] && DEPARTMENT_STRUCTURE[currentDepartment].positions) {
//             for (const [pos, data] of Object.entries(DEPARTMENT_STRUCTURE[currentDepartment].positions)) {
//                 if (pos === currentEmployee.reportsTo || data.name === currentEmployee.reportsTo) {
//                     chain.push({
//                         level: level++,
//                         approver: data.name,
//                         email: data.email,
//                         role: pos,
//                         department: currentDepartment
//                     });
//                     currentEmployee = { ...data, position: pos };
//                     supervisorFound = true;
//                     console.log(`✓ Found supervisor: ${data.name} (${pos})`);
//                     break;
//                 }
//             }
//         }
        
//         // Check if supervisor is department head
//         if (!supervisorFound && DEPARTMENT_STRUCTURE[currentDepartment] && DEPARTMENT_STRUCTURE[currentDepartment].head) {
//             const head = DEPARTMENT_STRUCTURE[currentDepartment].head;
//             if (head.name === currentEmployee.reportsTo || currentEmployee.reportsTo.includes('Head')) {
//                 chain.push({
//                     level: level++,
//                     approver: head.name,
//                     email: head.email,
//                     role: head.position || 'Department Head',
//                     department: currentDepartment
//                 });
//                 currentEmployee = {
//                     ...head,
//                     position: head.position || 'Department Head',
//                     supervisor: 'President'
//                 };
//                 supervisorFound = true;
//                 console.log(`✓ Found department head: ${head.name}`);
//             }
//         }
        
//         // Break if supervisor is President or not found
//         if (!supervisorFound && currentEmployee.reportsTo === 'President') {
//             break;
//         }
        
//         if (!supervisorFound) {
//             console.warn(`⚠️ Supervisor "${currentEmployee.reportsTo}" not found`);
//             break;
//         }
//     }
    
//     console.log(`\n✅ Departmental approvals: ${chain.length} level(s)`);
    
//     // ============================================
//     // STEP 2: FINANCE VERIFICATION (Budget Check)
//     // ============================================
//     console.log(`\n📋 Adding Finance Officer for budget verification`);
//     chain.push({
//         level: level++,
//         approver: 'Ms. Ranibell Mambo',
//         email: 'ranibellmambo@gratoengineering.com',
//         role: 'Finance Officer - Budget Verification',
//         department: 'Business Development & Supply Chain',
//         responsibilities: {
//             budgetVerification: true,
//             budgetCodeAssignment: true,
//             costCenterVerification: true
//         }
//     });
    
//     // ============================================
//     // STEP 3: SUPPLY CHAIN COORDINATOR (Business Decisions)
//     // ============================================
//     console.log(`📋 Adding Supply Chain Coordinator for business decisions`);
//     chain.push({
//         level: level++,
//         approver: 'Mr. Lukong Lambert',
//         email: 'lukong.lambert@gratoglobal.com',
//         role: 'Supply Chain Coordinator - Business Decisions',
//         department: 'Business Development & Supply Chain',
//         responsibilities: {
//             sourcingTypeSelection: true,
//             purchaseTypeAssignment: true,
//             paymentMethodSelection: true,
//             buyerAssignment: true
//         }
//     });
    
//     // ============================================
//     // STEP 4: HEAD OF BUSINESS (Final Approval)
//     // ============================================
//     console.log(`📋 Adding Head of Business for final approval`);
//     chain.push({
//         level: level++,
//         approver: 'Mr. E.T Kelvin',
//         email: 'kelvin.eyong@gratoglobal.com',
//         role: 'Head of Business Development & Supply Chain - Final Approval',
//         department: 'Business Development & Supply Chain',
//         responsibilities: {
//             finalApproval: true,
//             pettyCashFormGeneration: true
//         }
//     });
    
//     console.log(`\n✅ APPROVAL CHAIN COMPLETED: ${chain.length} levels total`);
//     chain.forEach((step, index) => {
//         console.log(`   Level ${step.level}: ${step.approver} (${step.role})`);
//     });
//     console.log(`=========================================\n`);
    
//     return chain;
// };

// /**
//  * Create default approval chain when employee not found
//  */
// const createDefaultApprovalChain = (department) => {
//     const chain = [];
//     let level = 1;
    
//     // Add department head if available
//     if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head) {
//         const head = DEPARTMENT_STRUCTURE[department].head;
//         chain.push({
//             level: level++,
//             approver: head.name,
//             email: head.email,
//             role: head.position || 'Department Head',
//             department: department
//         });
//     }
    
//     // Add Finance
//     chain.push({
//         level: level++,
//         approver: 'Ms. Ranibell Mambo',
//         email: 'ranibellmambo@gratoengineering.com',
//         role: 'Finance Officer - Budget Verification',
//         department: 'Business Development & Supply Chain',
//         responsibilities: { budgetVerification: true }
//     });
    
//     // Add Supply Chain Coordinator
//     chain.push({
//         level: level++,
//         approver: 'Mr. Lukong Lambert',
//         email: 'lukong.lambert@gratoglobal.com',
//         role: 'Supply Chain Coordinator - Business Decisions',
//         department: 'Business Development & Supply Chain',
//         responsibilities: { 
//             sourcingTypeSelection: true,
//             purchaseTypeAssignment: true,
//             paymentMethodSelection: true,
//             buyerAssignment: true
//         }
//     });
    
//     // Add Head of Business
//     chain.push({
//         level: level++,
//         approver: 'Mr. E.T Kelvin',
//         email: 'kelvin.eyong@gratoglobal.com',
//         role: 'Head of Business Development & Supply Chain - Final Approval',
//         department: 'Business Development & Supply Chain',
//         responsibilities: { finalApproval: true }
//     });
    
//     return chain;
// };

// /**
//  * Get available buyers for assignment
//  */
// const getAvailableBuyers = () => {
//     const buyers = [];
    
//     Object.values(DEPARTMENT_STRUCTURE).forEach(department => {
//         Object.entries(department.positions).forEach(([position, person]) => {
//             if (person.role === 'buyer') {
//                 buyers.push({
//                     id: person.email,
//                     name: person.name,
//                     email: person.email,
//                     position: position,
//                     department: person.department || department.name,
//                     specializations: person.specializations || [],
//                     maxOrderValue: person.maxOrderValue || 1000000
//                 });
//             }
//         });
//     });
    
//     // Add coordinator as potential buyer
//     buyers.push({
//         id: 'lukong.lambert@gratoglobal.com',
//         name: 'Mr. Lukong Lambert',
//         email: 'lukong.lambert@gratoglobal.com',
//         position: 'Supply Chain Coordinator',
//         department: 'Business Development & Supply Chain',
//         specializations: ['All'],
//         maxOrderValue: 10000000,
//         canSelfBuy: true
//     });
    
//     return buyers;
// };

// /**
//  * Get suitable buyer for a requisition
//  */
// const getSuitableBuyer = (requisition) => {
//     const buyers = getAvailableBuyers();
//     const estimatedValue = requisition.budgetXAF || 
//         requisition.financeVerification?.assignedBudget || 0;
    
//     // Filter by capacity and specialization
//     const suitableBuyers = buyers.filter(buyer => {
//         if (estimatedValue > buyer.maxOrderValue) return false;
        
//         if (buyer.specializations.includes('All')) return true;
        
//         const itemCategory = requisition.itemCategory?.replace(' ', '_');
//         return buyer.specializations.includes(itemCategory) ||
//                buyer.specializations.includes('General');
//     });
    
//     // Sort by specialization match and capacity
//     return suitableBuyers.sort((a, b) => {
//         const aHasExact = a.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
//         const bHasExact = b.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
        
//         if (aHasExact && !bHasExact) return -1;
//         if (!aHasExact && bHasExact) return 1;
        
//         return b.maxOrderValue - a.maxOrderValue;
//     });
// };

// const getDepartmentList = () => {
//     return Object.keys(DEPARTMENT_STRUCTURE)
//         .filter(key => key !== 'Executive')
//         .map(key => ({
//             key,
//             name: DEPARTMENT_STRUCTURE[key].name,
//             head: DEPARTMENT_STRUCTURE[key].head?.name
//         }));
// };

// const getEmployeesInDepartment = (department) => {
//     const dept = DEPARTMENT_STRUCTURE[department];
//     if (!dept) return [];
    
//     const employees = [];
    
//     if (dept.head && department !== 'Executive') {
//         employees.push({
//             name: dept.head.name,
//             email: dept.head.email,
//             position: 'Department Head',
//             department: department
//         });
//     }
    
//     for (const [position, data] of Object.entries(dept.positions || {})) {
//         employees.push({
//             name: data.name,
//             email: data.email,
//             position: position,
//             department: department,
//             role: data.role || 'employee',
//             specializations: data.specializations,
//             maxOrderValue: data.maxOrderValue
//         });
//     }
    
//     return employees;
// };

// module.exports = {
//     DEPARTMENT_STRUCTURE,
//     getApprovalChain,
//     getDepartmentList,
//     getEmployeesInDepartment,
//     getAvailableBuyers,
//     getSuitableBuyer
// };









// // const DEPARTMENT_STRUCTURE = {
// //     'Technical': {
// //         name: 'Technical',
// //         head: 'Mr. Didier Oyong',
// //         headEmail: 'didier.oyong@gratoengineering.com',
// //         positions: {
// //             'HSE Coordinator': {
// //                 name: 'Mr. Ovo Becheni',
// //                 email: 'bechem.mbu@gratoglobal.com',
// //                 supervisor: 'Technical Director',
// //                 department: 'Technical'
// //             },
// //             'Head of Refurbishment': {
// //                 name: 'Mr. Yerla Ivo',
// //                 email: 'verla.ivo@gratoengineering.com',
// //                 supervisor: 'Technical Director',
// //                 department: 'Technical'
// //             },
// //             'Project Manager': {
// //                 name: 'Mr. Joel Wamba',
// //                 email: 'joel@gratoengineering.com',
// //                 supervisor: 'Technical Director',
// //                 department: 'Technical'
// //             },
// //             'Operations Manager': {
// //                 name: 'Mr. Pascal Assam',
// //                 email: 'pascal.rodrique@gratoglobal.com',
// //                 supervisor: 'Technical Director',
// //                 department: 'Technical'
// //             },
// //             'Diesel Coordinator': {
// //                 name: 'Mr. Kevin Minka',
// //                 email: 'minka.kevin@gratoglobal.com',
// //                 supervisor: 'Technical Director',
// //                 department: 'Technical'
// //             },
// //             'Data Collector': {
// //                 name: 'Mr. Bomba Yvone',
// //                 email: 'bemba.essack@gratoglobal.com',
// //                 supervisor: 'Operations Manager',
// //                 department: 'Technical'
// //             },
// //             'NOC Coordinator': {
// //                 name: 'Mr. Rodrigue Nono',
// //                 email: 'rodrigue.nono@gratoglobal.com',
// //                 supervisor: 'Diesel Coordinator',
// //                 department: 'Technical'
// //             },
// //             'Site Supervisor': {
// //                 name: 'Site Supervisors',
// //                 email: 'site.supervisors@gratoengineering.com',
// //                 supervisor: 'Project Manager',
// //                 department: 'Technical'
// //             },
// //             'Field Technician': {
// //                 name: 'Field Technicians',
// //                 email: 'field.technicians@gratoengineering.com',
// //                 supervisor: 'Site Supervisor',
// //                 department: 'Technical'
// //             },
// //             'NOC Operator': {
// //                 name: 'NOC Operators',
// //                 email: 'noc.operators@gratoengineering.com',
// //                 supervisor: 'NOC Coordinator',
// //                 department: 'Technical'
// //             }
// //         }
// //     },

// //     // Business Development & Supply Chain
// //     'Business Development & Supply Chain': {
// //         name: 'Business Development & Supply Chain',
// //         head: 'Mr. E.T Kelvin',
// //         headEmail: 'kelvin.eyong@gratoglobal.com',
// //         positions: {
// //             'Supply Chain Coordinator': {
// //                 name: 'Mr. Lukong Lambert',
// //                 email: 'lukong.lambert@gratoglobal.com',
// //                 supervisor: 'Head of Business Dev & Supply Chain',
// //                 department: 'Business Development & Supply Chain'
// //             },
// //             // ENHANCED: Buyers with specific roles and specializations
// //             'Order Management Assistant/Buyer': {
// //                 name: 'Mr. Christabel Mangwi',
// //                 email: 'christabel@gratoengineering.com',
// //                 supervisor: 'Supply Chain Coordinator',
// //                 department: 'Business Development & Supply Chain',
// //                 role: 'buyer',
// //                 specializations: ['Office_Supplies', 'Consumables', 'General'],
// //                 maxOrderValue: 2000000
// //             },
// //             'Warehouse Coordinator/Buyer': {
// //                 name: 'Mr. Pryde Mua',
// //                 email: 'pryde.mua@gratoglobal.com',
// //                 supervisor: 'Supply Chain Coordinator',
// //                 department: 'Business Development & Supply Chain',
// //                 role: 'buyer',
// //                 specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
// //                 maxOrderValue: 5000000
// //             },
// //             'Warehouse Assistant': {
// //                 name: 'Ms. Aghangu Marie',
// //                 email: 'aghangu.marie@gratoengineering.com',
// //                 supervisor: 'Warehouse Coordinator',
// //                 department: 'Business Development & Supply Chain'
// //             },
// //             'Finance Officer': {
// //                 name: 'Ms. Rambell Mambo',
// //                 email: 'ranibellmambo@gratoengineering.com',
// //                 supervisor: 'Head of Business Dev & Supply Chain',
// //                 department: 'Business Development & Supply Chain'
// //             }
// //         }
// //     },

// //     // HR & Admin
// //     'HR & Admin': {
// //         name: 'HR & Admin',
// //         head: 'Mrs. Brunline Teitoh',
// //         headEmail: 'bruiline.tsitoh@gratoglobal.com',
// //         positions: {
// //             'Office Driver/Logistics Assistant': {
// //                 name: 'Mr. Che Earnest',
// //                 email: 'che.earnest@gratoengineering.com',
// //                 supervisor: 'HR & Admin Head',
// //                 department: 'HR & Admin'
// //             },
// //             'IT Staff': {
// //                 name: 'Mr. Ngong Marcel',
// //                 email: 'marcel.ngong@gratoglobal.com',
// //                 supervisor: 'HR & Admin Head',
// //                 department: 'HR & Admin'
// //             },
// //             'House Maid': {
// //                 name: 'Ms. Ndi Belther',
// //                 email: 'ndi.belther@gratoengineering.com',
// //                 supervisor: 'HR & Admin Head',
// //                 department: 'HR & Admin'
// //             }
// //         }
// //     },

// //     // Executive - Kelvin now serves as President/Ultimate Authority
// //     'Executive': {
// //         name: 'Executive',
// //         head: 'Mr. E.T Kelvin',
// //         headEmail: 'kelvin.eyong@gratoglobal.com',
// //         positions: {
// //             'Technical Director': {
// //                 name: 'Mr. Didier Oyong',
// //                 email: 'didier.oyong@gratoengineering.com',
// //                 supervisor: 'President',
// //                 department: 'Executive'
// //             },
// //             'Head of HR & Admin': {
// //                 name: 'Mrs. Brunline Teitoh',
// //                 email: 'bruiline.tsitoh@gratoglobal.com',
// //                 supervisor: 'President',
// //                 department: 'Executive'
// //             }
// //         }
// //     }
// // };

// // // ENHANCED: Get available buyers for assignment
// // const getAvailableBuyers = () => {
// //     const buyers = [];

// //     // Extract buyers from department structure
// //     Object.values(DEPARTMENT_STRUCTURE).forEach(department => {
// //         Object.entries(department.positions).forEach(([position, person]) => {
// //             if (person.role === 'buyer') {
// //                 buyers.push({
// //                     id: person.email,
// //                     name: person.name,
// //                     email: person.email,
// //                     position: position,
// //                     department: person.department,
// //                     specializations: person.specializations || [],
// //                     maxOrderValue: person.maxOrderValue || 1000000
// //                 });
// //             }
// //         });
// //     });

// //     // Add coordinator as potential buyer (can buy themselves)
// //     buyers.push({
// //         id: 'lukong.lambert@gratoglobal.com',
// //         name: 'Mr. Lukong Lambert',
// //         email: 'lukong.lambert@gratoglobal.com',
// //         position: 'Supply Chain Coordinator',
// //         department: 'Business Development & Supply Chain',
// //         specializations: ['All'],
// //         maxOrderValue: 10000000,
// //         canSelfBuy: true
// //     });

// //     return buyers;
// // };

// // // ENHANCED: Get suitable buyer for a requisition
// // const getSuitableBuyer = (requisition) => {
// //     const buyers = getAvailableBuyers();
// //     const estimatedValue = requisition.budgetXAF ||
// //         requisition.financeVerification?.assignedBudget ||
// //         0;

// //     // Filter buyers based on specialization and order value
// //     const suitableBuyers = buyers.filter(buyer => {
// //         // Check order value capacity
// //         if (estimatedValue > buyer.maxOrderValue) return false;

// //         // Check specialization match
// //         if (buyer.specializations.includes('All')) return true;

// //         const itemCategory = requisition.itemCategory?.replace(' ', '_');
// //         return buyer.specializations.includes(itemCategory) ||
// //             buyer.specializations.includes('General');
// //     });

// //     // Sort by workload and specialization match
// //     return suitableBuyers.sort((a, b) => {
// //         // Prefer exact specialization match
// //         const aHasExact = a.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
// //         const bHasExact = b.specializations.includes(requisition.itemCategory?.replace(' ', '_'));

// //         if (aHasExact && !bHasExact) return -1;
// //         if (!aHasExact && bHasExact) return 1;

// //         // Then by max order value (higher capacity first for complex orders)
// //         return b.maxOrderValue - a.maxOrderValue;
// //     });
// // };

// // // ENHANCED: Updated approval chain to include finance verification
// // const getApprovalChain = (employeeName, department) => {
// //     const chain = [];

// //     console.log(`Getting approval chain for: ${employeeName} in ${department}`);

// //     // Find the employee's data
// //     let employeeData = null;
// //     let employeeDepartmentName = department;

// //     // Search for employee in specified department first
// //     if (DEPARTMENT_STRUCTURE[department]) {
// //         if (DEPARTMENT_STRUCTURE[department].head === employeeName) {
// //             employeeData = {
// //                 name: employeeName,
// //                 email: DEPARTMENT_STRUCTURE[department].headEmail,
// //                 position: 'Department Head',
// //                 supervisor: 'President',
// //                 department: department
// //             };
// //         } else {
// //             for (const [pos, data] of Object.entries(DEPARTMENT_STRUCTURE[department].positions || {})) {
// //                 if (data.name === employeeName) {
// //                     employeeData = { ...data, position: pos };
// //                     break;
// //                 }
// //             }
// //         }
// //     }

// //     // If not found, search all departments
// //     if (!employeeData) {
// //         for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
// //             if (deptData.head === employeeName) {
// //                 employeeData = {
// //                     name: employeeName,
// //                     email: deptData.headEmail,
// //                     position: 'Department Head',
// //                     supervisor: 'President',
// //                     department: deptKey
// //                 };
// //                 employeeDepartmentName = deptKey;
// //                 break;
// //             }

// //             if (deptData.positions) {
// //                 for (const [pos, data] of Object.entries(deptData.positions)) {
// //                     if (data.name === employeeName) {
// //                         employeeData = { ...data, position: pos };
// //                         employeeDepartmentName = deptKey;
// //                         break;
// //                     }
// //                 }
// //             }

// //             if (employeeData) break;
// //         }
// //     }

// //     // If still not found, create default chain
// //     if (!employeeData) {
// //         console.warn(`Employee "${employeeName}" not found. Creating default approval chain.`);

// //         if (DEPARTMENT_STRUCTURE[department]) {
// //             chain.push({
// //                 level: 1,
// //                 approver: DEPARTMENT_STRUCTURE[department].head,
// //                 email: DEPARTMENT_STRUCTURE[department].headEmail,
// //                 role: 'Department Head',
// //                 department: department
// //             });
// //         }

// //         // Add finance verification step
// //         chain.push({
// //             level: 2,
// //             approver: 'Ms. Rambell Mambo',
// //             email: 'ranibellmambo@gratoengineering.com',
// //             role: 'Finance Officer - Budget Verification',
// //             department: 'Business Development & Supply Chain'
// //         });

// //         // Add Head of Business as final approver
// //         chain.push({
// //             level: 3,
// //             approver: 'Mr. E.T Kelvin',
// //             email: 'kelvin.eyong@gratoglobal.com',
// //             role: 'Head of Business Development & Supply Chain - Final Approval',
// //             department: 'Business Development & Supply Chain',
// //             responsibilities: {
// //                 sourcingTypeSelection: true,
// //                 purchaseTypeAssignment: true,
// //                 buyerAssignment: true,
// //                 finalApproval: true
// //             }
// //         });

// //         return chain;
// //     }

// //     let currentEmployee = employeeData;
// //     let currentDepartment = employeeDepartmentName;
// //     let level = 1;

// //     console.log(`Starting approval chain traversal from: ${currentEmployee.name} (${currentEmployee.position}) in ${currentDepartment}`);

// //     // Traverse up the chain for supervisor approvals
// //     while (currentEmployee && currentEmployee.supervisor) {
// //         let supervisorFound = false;

// //         console.log(`Looking for supervisor: "${currentEmployee.supervisor}" for ${currentEmployee.name}`);

// //         // Check within the current department first
// //         if (DEPARTMENT_STRUCTURE[currentDepartment] && DEPARTMENT_STRUCTURE[currentDepartment].positions) {
// //             for (const [pos, data] of Object.entries(DEPARTMENT_STRUCTURE[currentDepartment].positions)) {
// //                 if (pos === currentEmployee.supervisor || data.name === currentEmployee.supervisor) {
// //                     chain.push({
// //                         level: level++,
// //                         approver: data.name,
// //                         email: data.email,
// //                         role: pos,
// //                         department: currentDepartment
// //                     });
// //                     currentEmployee = { ...data, position: pos };
// //                     supervisorFound = true;
// //                     console.log(`Found supervisor in positions: ${data.name} (${pos})`);
// //                     break;
// //                 }
// //             }
// //         }

// //         // If not found in current department's positions, check if supervisor is the department head
// //         if (!supervisorFound && DEPARTMENT_STRUCTURE[currentDepartment] &&
// //             (DEPARTMENT_STRUCTURE[currentDepartment].head === currentEmployee.supervisor ||
// //                 currentEmployee.supervisor.includes('Head'))) {

// //             chain.push({
// //                 level: level++,
// //                 approver: DEPARTMENT_STRUCTURE[currentDepartment].head,
// //                 email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
// //                 role: 'Department Head',
// //                 department: currentDepartment
// //             });

// //             currentEmployee = {
// //                 name: DEPARTMENT_STRUCTURE[currentDepartment].head,
// //                 email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
// //                 position: 'Department Head',
// //                 supervisor: 'President',
// //                 department: currentDepartment
// //             };
// //             supervisorFound = true;
// //             console.log(`Found supervisor as department head: ${DEPARTMENT_STRUCTURE[currentDepartment].head}`);
// //         }

// //         // If supervisor is 'President', break and add remaining chain
// //         if (!supervisorFound && currentEmployee.supervisor === 'President') {
// //             break;
// //         }

// //         if (!supervisorFound) {
// //             console.warn(`Supervisor "${currentEmployee.supervisor}" not found for "${currentEmployee.name}". Breaking chain traversal.`);

// //             // Add department head and president as fallback if not already in chain
// //             if (DEPARTMENT_STRUCTURE[currentDepartment] && !chain.some(step => step.role === 'Department Head')) {
// //                 chain.push({
// //                     level: level++,
// //                     approver: DEPARTMENT_STRUCTURE[currentDepartment].head,
// //                     email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
// //                     role: 'Department Head',
// //                     department: currentDepartment
// //                 });
// //             }

// //             break;
// //         }
// //     }

// //     // ENHANCED: Add finance verification step after supervisor/hod approvals
// //     console.log('Adding finance verification step');
// //     chain.push({
// //         level: level++,
// //         approver: 'Ms. Rambell Mambo',
// //         email: 'ranibellmambo@gratoengineering.com',
// //         role: 'Finance Officer - Budget Verification',
// //         department: 'Business Development & Supply Chain'
// //     });

// //     // NEW WORKFLOW: Add Head of Business Dev & Supply Chain as final approver (with enhanced responsibilities)
// //     console.log('Adding Head of Business for final approval with enhanced responsibilities');
// //     chain.push({
// //         level: level++,
// //         approver: 'Mr. E.T Kelvin',
// //         email: 'kelvin.eyong@gratoglobal.com',
// //         role: 'Head of Business Development & Supply Chain - Final Approval',
// //         department: 'Business Development & Supply Chain',
// //         responsibilities: {
// //             sourcingTypeSelection: true,
// //             purchaseTypeAssignment: true,
// //             buyerAssignment: true,
// //             finalApproval: true
// //         }
// //     });

// //     console.log(`Final approval chain created with ${chain.length} levels:`,
// //         chain.map(step => `Level ${step.level}: ${step.approver} (${step.role})`));

// //     return chain.length > 0 ? chain : null;
// // };

// // const getDepartmentList = () => {
// //     return Object.keys(DEPARTMENT_STRUCTURE).filter(key => key !== 'Executive').map(key => ({
// //         key,
// //         name: DEPARTMENT_STRUCTURE[key].name,
// //         head: DEPARTMENT_STRUCTURE[key].head
// //     }));
// // };

// // const getEmployeesInDepartment = (department) => {
// //     const dept = DEPARTMENT_STRUCTURE[department];
// //     if (!dept) return [];

// //     const employees = [];

// //     // Add department head if not 'Executive' itself
// //     if (department !== 'Executive') {
// //         employees.push({
// //             name: dept.head,
// //             email: dept.headEmail,
// //             position: 'Department Head',
// //             department: department,
// //             supervisor: 'President'
// //         });
// //     }

// //     // Add other positions
// //     for (const [position, data] of Object.entries(dept.positions)) {
// //         employees.push({
// //             name: data.name,
// //             email: data.email,
// //             position: position,
// //             department: department,
// //             supervisor: data.supervisor,
// //             role: data.role || 'employee',
// //             specializations: data.specializations,
// //             maxOrderValue: data.maxOrderValue
// //         });
// //     }

// //     return employees;
// // };

// // module.exports = {
// //     DEPARTMENT_STRUCTURE,
// //     getApprovalChain,
// //     getDepartmentList,
// //     getEmployeesInDepartment,
// //     getAvailableBuyers,
// //     getSuitableBuyer
// // };