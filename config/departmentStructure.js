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
  for (const [deptKey, dept] of Object.entries(DEPARTMENT_STRUCTURE)) {
    if (dept.head.email === email) {
      return {
        ...dept.head,
        department: deptKey,
        isDepartmentHead: true
      };
    }

    for (const [position, person] of Object.entries(dept.positions)) {
      if (person.email === email) {
        return {
          ...person,
          position: person.position || position, // Use person.position if exists, else key
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
const getSupevisablePositions = (email) => {
  const person = findPersonByEmail(email);
  if (!person || !person.canSupervise) return [];

  return person.canSupervise.map(positionTitle => ({
    position: positionTitle,
    department: person.department
  }));
};

/**
 * Get complete approval chain for an employee
 */
const getApprovalChainFromStructure = (employeeEmail) => {
  const chain = [];
  let currentPerson = findPersonByEmail(employeeEmail);
  
  if (!currentPerson) {
    console.error(`Employee ${employeeEmail} not found in structure`);
    return [];
  }

  let level = 1;
  const seenEmails = new Set([employeeEmail]);

  // Traverse up the hierarchy
  while (currentPerson && currentPerson.reportsTo) {
    const supervisor = findPersonByEmail(currentPerson.reportsTo);
    
    if (!supervisor || seenEmails.has(supervisor.email)) break;

    chain.push({
      level: level++,
      approver: {
        name: supervisor.name,
        email: supervisor.email,
        role: supervisor.isDepartmentHead ? 'Department Head' : supervisor.position,
        department: supervisor.department
      },
      status: 'pending',
      assignedDate: new Date()
    });

    seenEmails.add(supervisor.email);
    currentPerson = supervisor;
  }

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
        position: posData.position || posTitle, // Use explicit position if exists
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

module.exports = {
  DEPARTMENT_STRUCTURE,
  findPersonByEmail,
  getSupevisablePositions,
  getApprovalChainFromStructure,
  getAllAvailablePositions,
  getPotentialSupervisors
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
//       'HSE Coordinator': {
//         email: 'bechem.mbu@gratoglobal.com',
//         name: 'Mr. Ovo Becheni',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'coordinator'
//       },
//       'Head of Refurbishment': {
//         email: 'verla.ivo@gratoengineering.com',
//         name: 'Mr. Yerla Ivo',
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
//         canSupervise: ['Data Collector', 'NOC Coordinator'],
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
//       'Site Supervisor': {
//         email: null, // Multiple instances
//         name: 'Site Supervisors',
//         reportsTo: 'joel@gratoengineering.com',
//         hierarchyLevel: 2,
//         canSupervise: ['Field Technician'],
//         approvalAuthority: 'supervisor',
//         allowMultipleInstances: true // NEW: Handle multiple people in same role
//       },
//       'Field Technician': {
//         email: null,
//         name: 'Field Technicians',
//         reportsTo: null, // Set dynamically based on assigned Site Supervisor
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: true,
//         dynamicSupervisor: true // NEW: Supervisor assigned on creation
//       },
//       'NOC Operator': {
//         email: null,
//         name: 'NOC Operators',
//         reportsTo: 'rodrigue.nono@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: true
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
//         name: 'Marcel',
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
//         name: 'Carmel Dafny',
//         reportsTo: 'bruiline.tsitoh@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//     }
//   }
// };

// /**
//  * Find person details by email across all departments
//  */
// const findPersonByEmail = (email) => {
//   for (const [deptKey, dept] of Object.entries(DEPARTMENT_STRUCTURE)) {
//     if (dept.head.email === email) {
//       return {
//         ...dept.head,
//         department: deptKey,
//         isDepartmentHead: true
//       };
//     }

//     for (const [position, person] of Object.entries(dept.positions)) {
//       if (person.email === email) {
//         return {
//           ...person,
//           position,
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
// const getSupevisablePositions = (email) => {
//   const person = findPersonByEmail(email);
//   if (!person || !person.canSupervise) return [];

//   return person.canSupervise.map(positionTitle => ({
//     position: positionTitle,
//     department: person.department
//   }));
// };

// /**
//  * Get complete approval chain for an employee
//  */
// const getApprovalChainFromStructure = (employeeEmail) => {
//   const chain = [];
//   let currentPerson = findPersonByEmail(employeeEmail);
  
//   if (!currentPerson) {
//     console.error(`Employee ${employeeEmail} not found in structure`);
//     return [];
//   }

//   let level = 1;
//   const seenEmails = new Set([employeeEmail]);

//   // Traverse up the hierarchy
//   while (currentPerson && currentPerson.reportsTo) {
//     const supervisor = findPersonByEmail(currentPerson.reportsTo);
    
//     if (!supervisor || seenEmails.has(supervisor.email)) break;

//     chain.push({
//       level: level++,
//       approver: {
//         name: supervisor.name,
//         email: supervisor.email,
//         role: supervisor.isDepartmentHead ? 'Department Head' : supervisor.position,
//         department: supervisor.department
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });

//     seenEmails.add(supervisor.email);
//     currentPerson = supervisor;
//   }

//   // Always add Finance Officer as final approver (if not already in chain)
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
//         position: posTitle,
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
//         position: posTitle
//       });
//     }
//   }

//   return supervisors;
// };

// module.exports = {
//   DEPARTMENT_STRUCTURE,
//   findPersonByEmail,
//   getSupevisablePositions,
//   getApprovalChainFromStructure,
//   getAllAvailablePositions,
//   getPotentialSupervisors
// };












// const DEPARTMENT_STRUCTURE = {
//   'Technical': {
//       name: 'Technical',
//       head: 'Mr. Didier Oyong',
//       headEmail: 'didier.oyong@gratoengineering.com',
//       positions: {
//           'HSE Coordinator': {
//               name: 'Mr. Ovo Becheni',
//               email: 'bechem.mbu@gratoglobal.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Head of Refurbishment': {
//               name: 'Mr. Yerla Ivo',
//               email: 'verla.ivo@gratoengineering.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Project Manager': {
//               name: 'Mr. Joel Wamba',
//               email: 'joel@gratoengineering.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Operations Manager': {
//               name: 'Mr. Pascal Assam',
//               email: 'pascal.rodrique@gratoglobal.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Diesel Coordinator': {
//               name: 'Mr. Kevin Minka',
//               email: 'minka.kevin@gratoglobal.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Data Collector': {
//               name: 'Mr. Bomba Yvone',
//               email: 'bemba.essack@gratoglobal.com',
//               supervisor: 'Operations Manager',
//               department: 'Technical'
//           },
//           'NOC Coordinator': {
//               name: 'Mr. Rodrigue Nono',
//               email: 'rodrigue.nono@gratoglobal.com',
//               supervisor: 'Diesel Coordinator',
//               department: 'Technical'
//           },
//           'Site Supervisor': {
//               name: 'Site Supervisors',
//               email: 'site.supervisors@gratoengineering.com',
//               supervisor: 'Project Manager',
//               department: 'Technical'
//           },
//           'Field Technician': {
//               name: 'Field Technicians',
//               email: 'field.technicians@gratoengineering.com',
//               supervisor: 'Site Supervisor',
//               department: 'Technical'
//           },
//           'NOC Operator': {
//               name: 'NOC Operators',
//               email: 'noc.operators@gratoengineering.com',
//               supervisor: 'NOC Coordinator',
//               department: 'Technical'
//           }
//       }
//   },

//   // Business Development & Supply Chain
//   'Business Development & Supply Chain': {
//       name: 'Business Development & Supply Chain',
//       head: 'Mr. E.T Kelvin',
//       headEmail: 'kelvin.eyong@gratoglobal.com',
//       positions: {
//           'Supply Chain Coordinator': {
//               name: 'Mr. Lukong Lambert',
//               email: 'lukong.lambert@gratoglobal.com',
//               supervisor: 'Head of Business Dev & Supply Chain',
//               department: 'Business Development & Supply Chain'
//           },
//           // FIXED: Buyers with correct role structure
//           'Order Management Assistant/Buyer': {
//               name: 'Ms. Christabel Mangwi',
//               email: 'christabel@gratoengineering.com',
//               supervisor: 'Supply Chain Coordinator',
//               department: 'Business Development & Supply Chain',
//               role: 'employee', 
//               departmentRole: 'buyer', 
//               specializations: ['Office_Supplies', 'Consumables', 'General'],
//               maxOrderValue: 2000000
//           },
//           'Warehouse Coordinator/Buyer': {
//               name: 'Mr. Pryde Mua',
//               email: 'pryde.mua@gratoglobal.com',
//               supervisor: 'Supply Chain Coordinator',
//               department: 'Business Development & Supply Chain',
//               role: 'employee', 
//               departmentRole: 'buyer', 
//               specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
//               maxOrderValue: 5000000
//           },
//           'Warehouse Assistant': {
//               name: 'Ms. Aghangu Marie',
//               email: 'aghangu.marie@gratoengineering.com',
//               supervisor: 'Warehouse Coordinator',
//               department: 'Business Development & Supply Chain'
//           },
//           'Finance Officer': {
//               name: 'Ms. Ranibell Mambo',
//               email: 'ranibellmambo@gratoengineering.com',
//               supervisor: 'Head of Business Dev & Supply Chain',
//               department: 'Business Development & Supply Chain'
//           }
//       }
//   },

//   // HR & Admin
//   'HR & Admin': {
//       name: 'HR & Admin',
//       head: 'Mrs. Bruiline Tsitoh',
//       headEmail: 'bruiline.tsitoh@gratoglobal.com',
//       positions: {
//           'Office Driver/Logistics Assistant': {
//               name: 'Mr. Che Earnest',
//               email: 'che.earnest@gratoengineering.com',
//               supervisor: 'HR & Admin Head',
//               department: 'HR & Admin'
//           },
//           'IT Staff': {
//               name: 'Marcel',
//               email: 'marcel.ngong@gratoglobal.com',
//               supervisor: 'HR & Admin Head',
//               department: 'HR & Admin'
//           },
//           'House Maid': {
//               name: 'Ms. Ndi Belther',
//               email: 'ndi.belther@gratoengineering.com',
//               supervisor: 'HR & Admin Head',
//               department: 'HR & Admin'
//           }
//       }
//   },

//   'Executive': {
//       name: 'Executive',
//       head: 'Mr. E.T Kelvin',
//       headEmail: 'kelvin.eyong@gratoglobal.com',
//       positions: {
//           'Technical Director': {
//               name: 'Mr. Didier Oyong',
//               email: 'didier.oyong@gratoengineering.com',
//               supervisor: 'President',
//               department: 'Executive'
//           },
//           'Head of HR & Admin': {
//               name: 'Mrs. Bruiline Tsitoh',
//               email: 'bruiline.tsitoh@gratoglobal.com',
//               supervisor: 'President',
//               department: 'Executive'
//           }
//       }
//   }
// };

// const getAvailableBuyers = () => {
//   const buyers = [];

//   // Extract buyers from department structure
//   Object.values(DEPARTMENT_STRUCTURE).forEach(department => {
//       Object.entries(department.positions).forEach(([position, person]) => {
//           if (person.departmentRole === 'buyer') {
//               buyers.push({
//                   id: person.email,
//                   name: person.name,
//                   email: person.email,
//                   position: position,
//                   department: person.department,
//                   role: person.role || 'employee', 
//                   departmentRole: person.departmentRole, 
//                   specializations: person.specializations || [],
//                   maxOrderValue: person.maxOrderValue || 1000000
//               });
//           }
//       });
//   });

//   buyers.push({
//       id: 'lukong.lambert@gratoglobal.com',
//       name: 'Mr. Lukong Lambert',
//       email: 'lukong.lambert@gratoglobal.com',
//       position: 'Supply Chain Coordinator',
//       department: 'Business Development & Supply Chain',
//       role: 'supervisor', 
//       departmentRole: 'coordinator',
//       specializations: ['All'],
//       maxOrderValue: 10000000,
//       canSelfBuy: true
//   });

//   return buyers;
// };

// const getSuitableBuyer = (requisition) => {
//   const buyers = getAvailableBuyers();
//   const estimatedValue = requisition.budgetXAF ||
//       requisition.financeVerification?.assignedBudget ||
//       0;

//   const suitableBuyers = buyers.filter(buyer => {
//       if (estimatedValue > buyer.maxOrderValue) return false;

//       if (buyer.specializations.includes('All')) return true;

//       const itemCategory = requisition.itemCategory?.replace(' ', '_');
//       return buyer.specializations.includes(itemCategory) ||
//           buyer.specializations.includes('General');
//   });

//   return suitableBuyers.sort((a, b) => {
//       const aHasExact = a.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
//       const bHasExact = b.specializations.includes(requisition.itemCategory?.replace(' ', '_'));

//       if (aHasExact && !bHasExact) return -1;
//       if (!aHasExact && bHasExact) return 1;

//       return b.maxOrderValue - a.maxOrderValue;
//   });
// };

// const getApprovalChain = (employeeName, department) => {
//   const chain = [];

//   console.log(`Getting approval chain for: ${employeeName} in ${department}`);

//   let employeeData = null;
//   let employeeDepartmentName = department;

//   if (DEPARTMENT_STRUCTURE[department]) {
//       if (DEPARTMENT_STRUCTURE[department].head === employeeName) {
//           employeeData = {
//               name: employeeName,
//               email: DEPARTMENT_STRUCTURE[department].headEmail,
//               position: 'Department Head',
//               supervisor: 'President',
//               department: department
//           };
//       } else {
//           for (const [pos, data] of Object.entries(DEPARTMENT_STRUCTURE[department].positions || {})) {
//               if (data.name === employeeName) {
//                   employeeData = { ...data, position: pos };
//                   break;
//               }
//           }
//       }
//   }

//   if (!employeeData) {
//       for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
//           if (deptData.head === employeeName) {
//               employeeData = {
//                   name: employeeName,
//                   email: deptData.headEmail,
//                   position: 'Department Head',
//                   supervisor: 'President',
//                   department: deptKey
//               };
//               employeeDepartmentName = deptKey;
//               break;
//           }

//           if (deptData.positions) {
//               for (const [pos, data] of Object.entries(deptData.positions)) {
//                   if (data.name === employeeName) {
//                       employeeData = { ...data, position: pos };
//                       employeeDepartmentName = deptKey;
//                       break;
//                   }
//               }
//           }

//           if (employeeData) break;
//       }
//   }

//   if (!employeeData) {
//       console.warn(`Employee "${employeeName}" not found. Creating default approval chain.`);

//       if (DEPARTMENT_STRUCTURE[department]) {
//           chain.push({
//               level: 1,
//               approver: DEPARTMENT_STRUCTURE[department].head,
//               email: DEPARTMENT_STRUCTURE[department].headEmail,
//               role: 'Department Head',
//               department: department
//           });
//       }

//       chain.push({
//           level: 2,
//           approver: 'Ms. Ranibell Mambo',
//           email: 'ranibellmambo@gratoengineering.com',
//           role: 'Finance Officer',
//           department: 'Business Development & Supply Chain'
//       });

//       if (DEPARTMENT_STRUCTURE['Executive']) {
//           chain.push({
//               level: 3,
//               approver: DEPARTMENT_STRUCTURE['Executive'].head,
//               email: DEPARTMENT_STRUCTURE['Executive'].headEmail,
//               role: 'President',
//               department: 'Executive'
//           });
//       }

//       return chain;
//   }

//   let currentEmployee = employeeData;
//   let currentDepartment = employeeDepartmentName;
//   let level = 1;

//   console.log(`Starting approval chain traversal from: ${currentEmployee.name} (${currentEmployee.position}) in ${currentDepartment}`);

//   while (currentEmployee && currentEmployee.supervisor) {
//       let supervisorFound = false;

//       console.log(`Looking for supervisor: "${currentEmployee.supervisor}" for ${currentEmployee.name}`);

//       if (DEPARTMENT_STRUCTURE[currentDepartment] && DEPARTMENT_STRUCTURE[currentDepartment].positions) {
//           for (const [pos, data] of Object.entries(DEPARTMENT_STRUCTURE[currentDepartment].positions)) {
//               if (pos === currentEmployee.supervisor || data.name === currentEmployee.supervisor) {
//                   chain.push({
//                       level: level++,
//                       approver: data.name,
//                       email: data.email,
//                       role: pos,
//                       department: currentDepartment
//                   });
//                   currentEmployee = { ...data, position: pos };
//                   supervisorFound = true;
//                   console.log(`Found supervisor in positions: ${data.name} (${pos})`);
//                   break;
//               }
//           }
//       }

//       if (!supervisorFound && DEPARTMENT_STRUCTURE[currentDepartment] &&
//           (DEPARTMENT_STRUCTURE[currentDepartment].head === currentEmployee.supervisor ||
//               currentEmployee.supervisor.includes('Head'))) {

//           chain.push({
//               level: level++,
//               approver: DEPARTMENT_STRUCTURE[currentDepartment].head,
//               email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
//               role: 'Department Head',
//               department: currentDepartment
//           });

//           currentEmployee = {
//               name: DEPARTMENT_STRUCTURE[currentDepartment].head,
//               email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
//               position: 'Department Head',
//               supervisor: 'President',
//               department: currentDepartment
//           };
//           supervisorFound = true;
//           console.log(`Found supervisor as department head: ${DEPARTMENT_STRUCTURE[currentDepartment].head}`);
//       }

//       if (!supervisorFound && currentEmployee.supervisor === 'President') {
//           break;
//       }

//       if (!supervisorFound) {
//           console.warn(`Supervisor "${currentEmployee.supervisor}" not found for "${currentEmployee.name}". Breaking chain traversal.`);

//           if (DEPARTMENT_STRUCTURE[currentDepartment] && !chain.some(step => step.role === 'Department Head')) {
//               chain.push({
//                   level: level++,
//                   approver: DEPARTMENT_STRUCTURE[currentDepartment].head,
//                   email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
//                   role: 'Department Head',
//                   department: currentDepartment
//               });
//           }

//           break;
//       }
//   }

//   console.log('Adding finance verification step');
//   chain.push({
//       level: level++,
//       approver: 'Ms. Ranibell Mambo',
//       email: 'ranibellmambo@gratoengineering.com',
//       role: 'Finance Officer - Budget Verification',
//       department: 'Business Development & Supply Chain'
//   });

//   if (DEPARTMENT_STRUCTURE['Executive'] && !chain.some(step => step.role === 'President')) {
//       chain.push({
//           level: level++,
//           approver: DEPARTMENT_STRUCTURE['Executive'].head,
//           email: DEPARTMENT_STRUCTURE['Executive'].headEmail,
//           role: 'President',
//           department: 'Executive'
//       });
//   }

//   console.log(`Final approval chain created with ${chain.length} levels:`,
//       chain.map(step => `Level ${step.level}: ${step.approver} (${step.role})`));

//   return chain.length > 0 ? chain : null;
// };

// const getDepartmentList = () => {
//   return Object.keys(DEPARTMENT_STRUCTURE).filter(key => key !== 'Executive').map(key => ({
//       key,
//       name: DEPARTMENT_STRUCTURE[key].name,
//       head: DEPARTMENT_STRUCTURE[key].head
//   }));
// };

// const getEmployeesInDepartment = (department) => {
//   const dept = DEPARTMENT_STRUCTURE[department];
//   if (!dept) return [];

//   const employees = [];

//   if (department !== 'Executive') {
//       employees.push({
//           name: dept.head,
//           email: dept.headEmail,
//           position: 'Department Head',
//           department: department,
//           supervisor: 'President'
//       });
//   }

//   for (const [position, data] of Object.entries(dept.positions)) {
//       employees.push({
//           name: data.name,
//           email: data.email,
//           position: position,
//           department: department,
//           supervisor: data.supervisor,
//           role: data.role || 'employee', 
//           departmentRole: data.departmentRole || 'staff', 
//           specializations: data.specializations,
//           maxOrderValue: data.maxOrderValue
//       });
//   }

//   return employees;
// };

// module.exports = {
//   DEPARTMENT_STRUCTURE,
//   getApprovalChain,
//   getDepartmentList,
//   getEmployeesInDepartment,
//   getAvailableBuyers,
//   getSuitableBuyer
// };






// // utils/enhancedDepartmentStructure.js

// const ENHANCED_DEPARTMENT_STRUCTURE = {
//   'Technical': {
//     name: 'Technical',
//     head: {
//       email: 'didier.oyong@gratoengineering.com',
//       name: 'Mr. Didier Oyong',
//       position: 'Technical Director',
//       reportsTo: 'kelvin.eyong@gratoglobal.com', // Now reports to Kelvin
//       hierarchyLevel: 4
//     },
//     positions: {
//       'HSE Coordinator': {
//         email: 'bechem.mbu@gratoglobal.com',
//         name: 'Mr. Ovo Becheni',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'coordinator'
//       },
//       'Head of Refurbishment': {
//         email: 'verla.ivo@gratoengineering.com',
//         name: 'Mr. Yerla Ivo',
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
//         canSupervise: ['Data Collector', 'NOC Coordinator'],
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
//         reportsTo: 'pascal.rodrique@gratoglobal.com', // Changed from Kevin
//         hierarchyLevel: 2,
//         canSupervise: ['NOC Operator'],
//         approvalAuthority: 'coordinator'
//       },
//       'Site Supervisor': {
//         email: null, // Multiple instances
//         name: 'Site Supervisors',
//         reportsTo: 'joel@gratoengineering.com',
//         hierarchyLevel: 2,
//         canSupervise: ['Field Technician'],
//         approvalAuthority: 'supervisor',
//         allowMultipleInstances: true // NEW: Handle multiple people in same role
//       },
//       'Field Technician': {
//         email: null,
//         name: 'Field Technicians',
//         reportsTo: null, // Set dynamically based on assigned Site Supervisor
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: true,
//         dynamicSupervisor: true // NEW: Supervisor assigned on creation
//       },
//       'NOC Operator': {
//         email: null,
//         name: 'NOC Operators',
//         reportsTo: 'rodrigue.nono@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: true
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
//           specializations: ['All'],
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
//       reportsTo: 'kelvin.eyong@gratoglobal.com', // Now reports to Kelvin
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
//         name: 'Marcel',
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
//       }
//     }
//   }
// };

// /**
//  * Find person details by email across all departments
//  */
// const findPersonByEmail = (email) => {
//   for (const [deptKey, dept] of Object.entries(ENHANCED_DEPARTMENT_STRUCTURE)) {
//     if (dept.head.email === email) {
//       return {
//         ...dept.head,
//         department: deptKey,
//         isDepartmentHead: true
//       };
//     }

//     for (const [position, person] of Object.entries(dept.positions)) {
//       if (person.email === email) {
//         return {
//           ...person,
//           position,
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
// const getSupevisablePositions = (email) => {
//   const person = findPersonByEmail(email);
//   if (!person || !person.canSupervise) return [];

//   return person.canSupervise.map(positionTitle => ({
//     position: positionTitle,
//     department: person.department
//   }));
// };

// /**
//  * Get complete approval chain for an employee
//  */
// const getApprovalChainFromStructure = (employeeEmail) => {
//   const chain = [];
//   let currentPerson = findPersonByEmail(employeeEmail);
  
//   if (!currentPerson) {
//     console.error(`Employee ${employeeEmail} not found in structure`);
//     return [];
//   }

//   let level = 1;
//   const seenEmails = new Set([employeeEmail]);

//   // Traverse up the hierarchy
//   while (currentPerson && currentPerson.reportsTo) {
//     const supervisor = findPersonByEmail(currentPerson.reportsTo);
    
//     if (!supervisor || seenEmails.has(supervisor.email)) break;

//     chain.push({
//       level: level++,
//       approver: {
//         name: supervisor.name,
//         email: supervisor.email,
//         role: supervisor.isDepartmentHead ? 'Department Head' : supervisor.position,
//         department: supervisor.department
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });

//     seenEmails.add(supervisor.email);
//     currentPerson = supervisor;
//   }

//   // Always add Finance Officer as final approver (if not already in chain)
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
//  * Get all positions that can be created
//  */
// const getAllAvailablePositions = () => {
//   const positions = [];

//   for (const [deptKey, dept] of Object.entries(ENHANCED_DEPARTMENT_STRUCTURE)) {
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
//         position: posTitle,
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
//   const dept = ENHANCED_DEPARTMENT_STRUCTURE[department];
  
//   if (!dept) return supervisors;

//   // Check all positions in department
//   for (const [posTitle, posData] of Object.entries(dept.positions)) {
//     if (posData.canSupervise && posData.canSupervise.includes(position)) {
//       supervisors.push({
//         email: posData.email,
//         name: posData.name,
//         position: posTitle
//       });
//     }
//   }

//   return supervisors;
// };

// module.exports = {
//   ENHANCED_DEPARTMENT_STRUCTURE,
//   findPersonByEmail,
//   getSupevisablePositions,
//   getApprovalChainFromStructure,
//   getAllAvailablePositions,
//   getPotentialSupervisors
// };